import { Group, resolveSignalValue, type PibblNode } from "@pibbl/core";
import {
  defaultGraphEdgeStyle,
  defaultGraphLabelStyle,
  defaultGraphNodeStyle,
  GraphEdge,
  GraphLabel,
  GraphNode,
  resolveMarkStyle,
  useGraphFrame,
} from "./shared.js";
import type {
  GraphData,
  GraphEdgeGeometry,
  NeighborhoodLayout,
  NeighborhoodNodeGeometry,
  NeighborhoodOptions,
  NeighborhoodStyle,
  RadialNeighborhoodProps,
  VizKey,
} from "./types.js";
import {
  checkedBounds,
  finiteGap,
  finiteSize,
  hierarchyLabel,
} from "./hierarchy.js";
import { readAccessor } from "./shared.js";

function key(value: unknown, name: string): VizKey {
  if (
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return value;
  throw new TypeError(`${name}: key must be a string or finite number.`);
}

/** Lay out the reachable neighborhood around one stable key in concentric rings.
 * @param graph - Nodes and edges in source order.
 * @param options - Accessors, center, hops, and finite bounds.
 * @returns Immutable neighborhood geometry. @see {@link NeighborhoodLayout} */
export function layoutNeighborhood<N, E>(
  graph: GraphData<N, E>,
  options: NeighborhoodOptions<N, E>,
): NeighborhoodLayout<N, E> {
  const bounds = checkedBounds(options.bounds, "layoutNeighborhood");
  const hops = options.hops ?? 2;
  if (!Number.isSafeInteger(hops) || hops < 0)
    throw new RangeError(
      "layoutNeighborhood: hops must be a nonnegative safe integer.",
    );
  const ringGap = finiteGap(options.ringGap, 120, "layoutNeighborhood ringGap");
  const nodeGap = finiteGap(options.nodeGap, 12, "layoutNeighborhood nodeGap");
  const nodes = new Map<VizKey, N>();
  const order = new Map<VizKey, number>();
  graph.nodes.forEach((node, index) => {
    const id = key(
      readAccessor(node, options.nodeKey),
      "layoutNeighborhood nodeKey",
    );
    if (nodes.has(id))
      throw new Error(`layoutNeighborhood: duplicate node key ${String(id)}.`);
    nodes.set(id, node);
    order.set(id, index);
  });
  if (!nodes.has(options.centerKey))
    throw new Error(
      `layoutNeighborhood: unknown centerKey ${String(options.centerKey)}.`,
    );
  const edges = graph.edges.map((edge) => {
    const sourceKey = key(
      readAccessor(edge, options.source),
      "layoutNeighborhood source",
    );
    const targetKey = key(
      readAccessor(edge, options.target),
      "layoutNeighborhood target",
    );
    const edgeKey = key(
      readAccessor(edge, options.edgeKey),
      "layoutNeighborhood edgeKey",
    );
    if (!nodes.has(sourceKey) || !nodes.has(targetKey))
      throw new Error(
        `layoutNeighborhood: edge ${String(edgeKey)} references an unknown node.`,
      );
    return { edge, edgeKey, sourceKey, targetKey };
  });
  const direction = options.direction ?? "outbound";
  const adjacency = new Map<VizKey, VizKey[]>();
  for (const { sourceKey, targetKey } of edges) {
    const add = (a: VizKey, b: VizKey) => {
      const list = adjacency.get(a) ?? [];
      list.push(b);
      adjacency.set(a, list);
    };
    if (direction !== "inbound") add(sourceKey, targetKey);
    if (direction !== "outbound") add(targetKey, sourceKey);
  }
  const hop = new Map<VizKey, number>([[options.centerKey, 0]]);
  const queue = [options.centerKey];
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    const depth = hop.get(current)!;
    if (depth === hops) continue;
    for (const next of adjacency.get(current) ?? [])
      if (!hop.has(next)) {
        hop.set(next, depth + 1);
        queue.push(next);
      }
  }
  const rings = Array.from({ length: hops + 1 }, () => [] as VizKey[]);
  for (const [id, depth] of hop) rings[depth].push(id);
  for (const ring of rings) ring.sort((a, b) => order.get(a)! - order.get(b)!);
  const sizes = new Map<VizKey, ReturnType<typeof finiteSize>>();
  let maxFootprint = 0;
  for (const id of hop.keys()) {
    const size = finiteSize(
      nodes.get(id)!,
      options.nodeSize ?? { width: 48, height: 48 },
      "layoutNeighborhood",
    );
    sizes.set(id, size);
    maxFootprint = Math.max(maxFootprint, Math.hypot(size.width, size.height));
  }
  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
  const usedHops = Math.max(0, ...hop.values());
  const outer =
    usedHops === 0 ? maxFootprint / 2 : maxFootprint + usedHops * ringGap;
  if (outer * 2 > Math.min(bounds.width, bounds.height))
    throw new RangeError(
      "layoutNeighborhood: bounds are too small for the requested rings.",
    );
  const geometry: NeighborhoodNodeGeometry<N>[] = [];
  for (let depth = 0; depth < rings.length; depth++) {
    const ring = rings[depth];
    const radius = depth === 0 ? 0 : maxFootprint / 2 + depth * ringGap;
    if (
      depth > 0 &&
      ring.length > 1 &&
      2 * radius * Math.sin(Math.PI / ring.length) < maxFootprint + nodeGap
    )
      throw new RangeError(
        "layoutNeighborhood: ring is too crowded for nodeGap and nodeSize.",
      );
    ring.forEach((id, index) => {
      const angle =
        depth === 0
          ? -Math.PI / 2
          : -Math.PI / 2 + (Math.PI * 2 * index) / ring.length;
      const size = sizes.get(id)!;
      const x = center.x + Math.cos(angle) * radius - size.width / 2;
      const y = center.y + Math.sin(angle) * radius - size.height / 2;
      const datum = nodes.get(id)!;
      const box = Object.freeze({
        x,
        y,
        width: size.width,
        height: size.height,
      });
      geometry.push(
        Object.freeze({
          key: id,
          datum,
          bounds: box,
          label: hierarchyLabel(
            datum,
            options.label,
            {
              x,
              y: y + size.height + 4,
              width: size.width,
              height: 18,
            },
            String(id),
          ),
          detail:
            options.detail === undefined
              ? null
              : hierarchyLabel(datum, options.detail, {
                  x,
                  y: y + size.height + 22,
                  width: size.width,
                  height: 16,
                }),
          hop: depth,
        }),
      );
    });
  }
  const byKey = new Map(geometry.map((node) => [node.key, node]));
  const resultEdges: GraphEdgeGeometry<E>[] = [];
  for (const entry of edges)
    if (byKey.has(entry.sourceKey) && byKey.has(entry.targetKey)) {
      const source = byKey.get(entry.sourceKey)!;
      const target = byKey.get(entry.targetKey)!;
      const sourceAnchor = {
        x: source.bounds.x + source.bounds.width / 2,
        y: source.bounds.y + source.bounds.height / 2,
      };
      const targetAnchor = {
        x: target.bounds.x + target.bounds.width / 2,
        y: target.bounds.y + target.bounds.height / 2,
      };
      const segments = Object.freeze([
        { type: "move" as const, ...sourceAnchor },
        { type: "line" as const, ...targetAnchor },
      ]);
      resultEdges.push(
        Object.freeze({
          key: entry.edgeKey,
          datum: entry.edge,
          sourceKey: entry.sourceKey,
          targetKey: entry.targetKey,
          route: Object.freeze({
            sourceAnchor: Object.freeze(sourceAnchor),
            targetAnchor: Object.freeze(targetAnchor),
            segments,
            arrowSegments: null,
          }),
          path: `M ${sourceAnchor.x} ${sourceAnchor.y} L ${targetAnchor.x} ${targetAnchor.y}`,
          arrowPath: null,
        }),
      );
    }
  return Object.freeze({
    bounds,
    centerKey: options.centerKey,
    nodes: Object.freeze(geometry),
    edges: Object.freeze(resultEdges),
    omittedKeys: Object.freeze([...nodes.keys()].filter((id) => !hop.has(id))),
  });
}

/** Render an interactive radial neighborhood from ordinary graph records.
 * @param props - Reactive graph, center, presentation, and frame style.
 * @returns Canvas composition. @see {@link layoutNeighborhood} */
export function RadialNeighborhood<N, E>(
  props: RadialNeighborhoodProps<N, E>,
): PibblNode {
  const frame = useGraphFrame<NeighborhoodStyle>(props.style);
  const graph = resolveSignalValue(props.graph);
  const centerKey = resolveSignalValue(props.centerKey);
  const hops =
    props.hops === undefined ? undefined : resolveSignalValue(props.hops);
  if (frame.bounds.width === 0 || frame.bounds.height === 0)
    return <Group style={frame.groupStyle}>{null}</Group>;
  const layout = layoutNeighborhood(graph, {
    ...props,
    bounds: frame.bounds,
    centerKey,
    hops,
    ringGap: frame.style.ringGap,
    nodeGap: frame.style.nodeGap,
  });
  return (
    <Group style={frame.groupStyle}>
      {layout.edges.map((edge) =>
        props.renderEdge ? (
          <Group
            key={edge.key}
            onClick={(event) => props.onEdgeClick?.(edge, event)}
          >
            {props.renderEdge(edge)}
          </Group>
        ) : (
          <GraphEdge
            key={edge.key}
            edge={edge}
            style={{
              ...defaultGraphEdgeStyle(edge),
              ...resolveMarkStyle(edge, props.edgeStyle),
            }}
            onClick={(event) => props.onEdgeClick?.(edge, event)}
          />
        ),
      )}
      {layout.nodes.map((node) =>
        props.renderNode ? (
          <Group
            key={node.key}
            onClick={(event) => props.onNodeClick?.(node, event)}
          >
            {props.renderNode(node)}
          </Group>
        ) : (
          <Group key={node.key}>
            <GraphNode
              node={node}
              style={{
                ...defaultGraphNodeStyle(node),
                ...resolveMarkStyle(node, props.nodeStyle),
              }}
              onClick={(event) => props.onNodeClick?.(node, event)}
            />
            <GraphLabel
              label={node.label}
              style={{
                ...defaultGraphLabelStyle(node.label),
                ...resolveMarkStyle(node, props.labelStyle),
              }}
            />
          </Group>
        ),
      )}
    </Group>
  );
}
