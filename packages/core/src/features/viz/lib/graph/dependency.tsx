import type { PibblNode } from "@pibbl/core";
import { Group, resolveSignalValue } from "@pibbl/core";
import type {
  GraphData,
  GraphAccessors,
  GraphLayout,
  DependencyOptions,
  DependencyGraphProps,
  VizKey,
  Size,
} from "./types.js";
import {
  readAccessor,
  validateBounds,
  validKey,
  graphNodeGeometry,
  useGraphFrame,
  GraphView,
} from "./shared.js";
import { orthogonalGraphRoute, routePath } from "./routes.js";
export function graphRecords<N, E>(
  graph: GraphData<N, E>,
  options: GraphAccessors<N, E>,
) {
  const nodes = new Map<VizKey, N>();
  for (const node of graph.nodes) {
    const key = validKey(readAccessor(node, options.nodeKey));
    if (nodes.has(key)) throw new Error(`Duplicate graph node key ${key}.`);
    nodes.set(key, node);
  }
  const edgeKeys = new Set<VizKey>();
  const edges = graph.edges.map((datum) => {
    const key = validKey(readAccessor(datum, options.edgeKey)),
      sourceKey = validKey(readAccessor(datum, options.source)),
      targetKey = validKey(readAccessor(datum, options.target));
    if (edgeKeys.has(key)) throw new Error(`Duplicate graph edge key ${key}.`);
    edgeKeys.add(key);
    if (!nodes.has(sourceKey) || !nodes.has(targetKey))
      throw new Error(`Unknown endpoint for graph edge ${key}.`);
    return { key, datum, sourceKey, targetKey };
  });
  return { nodes, edges };
}
export function nodeSize<N>(
  node: N,
  input: Size | ((node: N) => Size) | undefined,
  fallback: Size,
): Size {
  const size = typeof input === "function" ? input(node) : (input ?? fallback);
  if (
    !Number.isFinite(size.width) ||
    !Number.isFinite(size.height) ||
    size.width <= 0 ||
    size.height <= 0
  )
    throw new RangeError("Node sizes must be finite and positive.");
  return size;
}
/**
 * Place a DAG in longest-path ranks with editable orthogonal routes. Cycles and insufficient bounds throw.
 * @param graph - Original node and edge records. See {@link GraphData}.
 * @param options - Typed accessors, finite bounds, node sizes and nonnegative gaps. See {@link DependencyOptions}.
 * @returns Original-record node geometry and routes in local logical units. See {@link GraphLayout}.
 */
export function layoutDependencies<N, E>(
  graph: GraphData<N, E>,
  options: DependencyOptions<N, E>,
): GraphLayout<N, E> {
  const bounds = validateBounds(options.bounds),
    { nodes, edges } = graphRecords(graph, options);
  const rankGap = options.rankGap ?? 72,
    gap = options.nodeGap ?? 24;
  for (const value of [rankGap, gap])
    if (!Number.isFinite(value) || value < 0)
      throw new RangeError("Graph gaps must be finite and nonnegative.");
  const incoming = new Map<VizKey, number>(
      [...nodes.keys()].map((key) => [key, 0]),
    ),
    outgoing = new Map([...nodes.keys()].map((key) => [key, [] as VizKey[]]));
  for (const edge of edges) {
    incoming.set(edge.targetKey, incoming.get(edge.targetKey)! + 1);
    outgoing.get(edge.sourceKey)!.push(edge.targetKey);
  }
  const queue = [...nodes.keys()].filter((key) => incoming.get(key) === 0),
    ranks = new Map<VizKey, number>([...nodes.keys()].map((key) => [key, 0]));
  for (let index = 0; index < queue.length; index++) {
    const key = queue[index];
    for (const target of outgoing.get(key)!) {
      ranks.set(target, Math.max(ranks.get(target)!, ranks.get(key)! + 1));
      incoming.set(target, incoming.get(target)! - 1);
      if (!incoming.get(target)) queue.push(target);
    }
  }
  if (queue.length !== nodes.size)
    throw new Error("Dependency layout requires a DAG; cycle detected.");
  const sizes = new Map(
    [...nodes].map(([key, datum]) => [
      key,
      nodeSize(datum, options.nodeSize, { width: 160, height: 56 }),
    ]),
  );
  const columns: VizKey[][] = [];
  for (const key of nodes.keys()) (columns[ranks.get(key)!] ??= []).push(key);
  const widths = columns.map((column) =>
    Math.max(...column.map((key) => sizes.get(key)!.width)),
  );
  const requiredWidth =
    widths.reduce((a, b) => a + b, 0) +
    Math.max(0, columns.length - 1) * rankGap;
  const heights = columns.map(
    (column) =>
      column.reduce<number>((sum, key) => sum + sizes.get(key)!.height, 0) +
      Math.max(0, column.length - 1) * gap,
  );
  if (bounds.width === 0 || bounds.height === 0)
    return { bounds, nodes: [], edges: [] };
  if (
    requiredWidth > bounds.width ||
    heights.some((height) => height > bounds.height)
  )
    throw new RangeError(
      "Dependency graph bounds are insufficient for node sizes and gaps.",
    );
  let x = bounds.x + (bounds.width - requiredWidth) / 2;
  const geometry = new Map<VizKey, ReturnType<typeof graphNodeGeometry<N>>>();
  columns.forEach((column, index) => {
    let y = bounds.y + (bounds.height - heights[index]) / 2;
    for (const key of column) {
      const datum = nodes.get(key)!,
        size = sizes.get(key)!;
      geometry.set(
        key,
        graphNodeGeometry(
          datum,
          key,
          { x, y, ...size },
          options.label ? readAccessor(datum, options.label) : String(key),
          options.detail ? readAccessor(datum, options.detail) : undefined,
        ),
      );
      y += size.height + gap;
    }
    x += widths[index] + rankGap;
  });
  return {
    bounds,
    nodes: [...nodes.keys()].map((key) => geometry.get(key)!),
    edges: edges.map((edge) => {
      const source = geometry.get(edge.sourceKey)!.bounds,
        target = geometry.get(edge.targetKey)!.bounds;
      const route = orthogonalGraphRoute(
        {
          sourceAnchor: {
            x: source.x + source.width,
            y: source.y + source.height / 2,
          },
          targetAnchor: { x: target.x, y: target.y + target.height / 2 },
        },
        { arrowLength: 7 },
      );
      return {
        ...edge,
        route,
        path: routePath(route.segments),
        arrowPath: route.arrowSegments ? routePath(route.arrowSegments) : null,
      };
    }),
  };
}
/**
 * Compose the public dependency layout helper and graph marks with useful defaults.
 * @param props - Graph input, accessors, presentation and definite allocation. See {@link DependencyGraphProps}.
 * @returns The same graph composition available through layoutDependencies and GraphView. See {@link GraphView}.
 */
export function DependencyGraph<N, E>(
  props: DependencyGraphProps<N, E>,
): PibblNode {
  const frame = useGraphFrame(props.style);
  const layout = layoutDependencies(resolveSignalValue(props.graph), {
    ...props,
    bounds: frame.bounds,
    rankGap: frame.style.rankGap,
    nodeGap: frame.style.nodeGap,
  });
  return (
    <Group style={frame.groupStyle}>
      <GraphView {...props} style={undefined} layout={layout} />
    </Group>
  );
}
