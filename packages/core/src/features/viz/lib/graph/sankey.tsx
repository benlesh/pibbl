import type { NodeStyle } from "./types.js";
import { Group, SvgPath, resolveSignalValue } from "@pibbl/core";
import type { PibblNode, PathSegment } from "@pibbl/core";
import type {
  Accessor,
  GraphData,
  GraphNodeProps,
  MarkInteraction,
  SankeyFlowGeometry,
  SankeyLayout,
  SankeyNodeGeometry,
  SankeyOptions,
  SankeyProps,
  Style,
  EdgeStyle,
  VizKey,
} from "./types.js";
import {
  defaultGraphLabelStyle,
  GraphLabel,
  GraphNode,
  resolveMarkStyle,
  useGraphFrame,
} from "./shared.js";

function access<D, V>(input: Accessor<D, V>, datum: D): V {
  return typeof input === "function"
    ? input(datum)
    : (datum as Record<PropertyKey, V>)[input];
}
function finite(value: number, name: string, zero = false) {
  if (!Number.isFinite(value) || (zero && value < 0))
    throw new RangeError(
      `layoutSankey: ${name} must be finite${zero ? " and nonnegative" : ""}.`,
    );
  return value;
}
function path(segments: readonly PathSegment[]) {
  return segments
    .map((segment) =>
      segment.type === "move"
        ? `M ${segment.x} ${segment.y}`
        : segment.type === "line"
          ? `L ${segment.x} ${segment.y}`
          : segment.type === "cubic"
            ? `C ${segment.cp1x} ${segment.cp1y} ${segment.cp2x} ${segment.cp2y} ${segment.x} ${segment.y}`
            : segment.type === "close"
              ? "Z"
              : "",
    )
    .join(" ");
}

/** Places an acyclic weighted flow graph in deterministic left-to-right ranks.
 * @param graph - Nodes and acyclic weighted edges. See {@link GraphData}.
 * @param options - Accessors, bounds, and display unit. See {@link SankeyOptions}.
 * @returns Immutable nodes and proportional flow geometry. See {@link SankeyLayout}.
 */
export function layoutSankey<N, E>(
  graph: GraphData<N, E>,
  options: SankeyOptions<N, E>,
): SankeyLayout<N, E> {
  const b = options.bounds;
  finite(b.x, "bounds.x");
  finite(b.y, "bounds.y");
  finite(b.width, "bounds.width", true);
  finite(b.height, "bounds.height", true);
  const nodeWidth = finite(options.nodeWidth ?? 18, "nodeWidth", true),
    nodeGap = finite(options.nodeGap ?? 12, "nodeGap", true);
  const nodes = new Map<VizKey, N>();
  for (const node of graph.nodes) {
    const key = access(options.nodeKey, node);
    if (nodes.has(key))
      throw new Error(`layoutSankey: duplicate node key ${String(key)}.`);
    nodes.set(key, node);
  }
  const edges = graph.edges.map((edge) => {
    const key = access(options.edgeKey, edge),
      sourceKey = access(options.source, edge),
      targetKey = access(options.target, edge),
      value = finite(access(options.value, edge), "edge value", true);
    if (!nodes.has(sourceKey) || !nodes.has(targetKey))
      throw new RangeError("layoutSankey: edge endpoint is not a node key.");
    return { key, edge, sourceKey, targetKey, value };
  });
  const incoming = new Map<VizKey, number>(),
    outgoing = new Map<VizKey, number>(),
    targets = new Map<VizKey, VizKey[]>();
  for (const key of nodes.keys()) {
    incoming.set(key, 0);
    outgoing.set(key, 0);
    targets.set(key, []);
  }
  for (const edge of edges) {
    incoming.set(
      edge.targetKey,
      finite(
        incoming.get(edge.targetKey)! + edge.value,
        "incoming total",
        true,
      ),
    );
    outgoing.set(
      edge.sourceKey,
      finite(
        outgoing.get(edge.sourceKey)! + edge.value,
        "outgoing total",
        true,
      ),
    );
    targets.get(edge.sourceKey)!.push(edge.targetKey);
  }
  const ranks = new Map<VizKey, number>();
  const visit = (key: VizKey, visiting = new Set<VizKey>()): number => {
    if (ranks.has(key)) return ranks.get(key)!;
    if (visiting.has(key))
      throw new RangeError("layoutSankey: flows must be acyclic.");
    visiting.add(key);
    let rank = 0;
    for (const target of targets.get(key)!)
      rank = Math.max(rank, visit(target, visiting) + 1);
    visiting.delete(key);
    ranks.set(key, rank);
    return rank;
  };
  for (const key of nodes.keys()) visit(key);
  const maxRank = Math.max(...ranks.values(), 0);
  for (const [key, rank] of ranks) ranks.set(key, maxRank - rank);
  const columns = Array.from({ length: maxRank + 1 }, () => [] as VizKey[]);
  for (const key of nodes.keys()) columns[ranks.get(key)!].push(key);
  const candidateScale = Math.min(
    ...columns
      .map((column) => {
        const sum = column.reduce<number>(
          (total, key) =>
            total + Math.max(incoming.get(key)!, outgoing.get(key)!),
          0,
        );
        finite(sum, "column total", true);
        return sum > 0
          ? Math.max(
              0,
              (b.height - Math.max(0, column.length - 1) * nodeGap) / sum,
            )
          : Infinity;
      })
      .filter(Number.isFinite),
  );
  const scale = Number.isFinite(candidateScale) ? candidateScale : 0;
  const geometry = new Map<VizKey, SankeyNodeGeometry<N>>();
  columns.forEach((column, rank) => {
    let y = b.y;
    for (const key of column) {
      const datum = nodes.get(key)!;
      const size = Math.max(incoming.get(key)!, outgoing.get(key)!) * scale;
      const bounds = Object.freeze({
        x: b.x + rank * (maxRank === 0 ? 0 : (b.width - nodeWidth) / maxRank),
        y,
        width: nodeWidth,
        height: size,
      });
      const name = options.label ? access(options.label, datum) : String(key);
      const quantity = Math.max(incoming.get(key)!, outgoing.get(key)!);
      const labelBounds = Object.freeze({
        x: bounds.x + bounds.width + 8,
        y: bounds.y + Math.max(0, bounds.height / 2 - 14),
        width: 132,
        height: 16,
      });
      const detailBounds = Object.freeze({
        x: labelBounds.x,
        y: labelBounds.y + 16,
        width: labelBounds.width,
        height: 16,
      });
      const detailText = options.detail
        ? access(options.detail, datum)
        : options.formatValue
          ? options.formatValue(quantity)
          : `${quantity} ${options.unit}`;
      geometry.set(
        key,
        Object.freeze({
          key,
          datum,
          bounds,
          incomingValue: incoming.get(key)!,
          outgoingValue: outgoing.get(key)!,
          netValue: outgoing.get(key)! - incoming.get(key)!,
          label: Object.freeze({
            text: name,
            bounds: labelBounds,
            rotationDegrees: 0,
          }),
          detail: Object.freeze({
            text: detailText,
            bounds: detailBounds,
            rotationDegrees: 0,
          }),
        }),
      );
      y += size + nodeGap;
    }
  });
  const sourceOffsets = new Map<VizKey, number>(),
    targetOffsets = new Map<VizKey, number>();
  for (const key of nodes.keys()) {
    sourceOffsets.set(key, 0);
    targetOffsets.set(key, 0);
  }
  const flows: SankeyFlowGeometry<E>[] = edges.map(
    ({ key, edge, sourceKey, targetKey, value }) => {
      const source = geometry.get(sourceKey)!,
        target = geometry.get(targetKey)!,
        thickness = value * scale;
      const sourceTop = source.bounds.y + sourceOffsets.get(sourceKey)!;
      const targetTop = target.bounds.y + targetOffsets.get(targetKey)!;
      sourceOffsets.set(sourceKey, sourceOffsets.get(sourceKey)! + thickness);
      targetOffsets.set(targetKey, targetOffsets.get(targetKey)! + thickness);
      const sourceSpan = Object.freeze({
        top: Object.freeze({
          x: source.bounds.x + source.bounds.width,
          y: sourceTop,
        }),
        bottom: Object.freeze({
          x: source.bounds.x + source.bounds.width,
          y: sourceTop + thickness,
        }),
      });
      const targetSpan = Object.freeze({
        top: Object.freeze({ x: target.bounds.x, y: targetTop }),
        bottom: Object.freeze({ x: target.bounds.x, y: targetTop + thickness }),
      });
      const middle = (sourceSpan.top.x + targetSpan.top.x) / 2;
      const segments = Object.freeze([
        { type: "move" as const, x: sourceSpan.top.x, y: sourceSpan.top.y },
        {
          type: "cubic" as const,
          cp1x: middle,
          cp1y: sourceSpan.top.y,
          cp2x: middle,
          cp2y: targetSpan.top.y,
          x: targetSpan.top.x,
          y: targetSpan.top.y,
        },
        {
          type: "line" as const,
          x: targetSpan.bottom.x,
          y: targetSpan.bottom.y,
        },
        {
          type: "cubic" as const,
          cp1x: middle,
          cp1y: targetSpan.bottom.y,
          cp2x: middle,
          cp2y: sourceSpan.bottom.y,
          x: sourceSpan.bottom.x,
          y: sourceSpan.bottom.y,
        },
        { type: "close" as const },
      ]);
      return Object.freeze({
        key,
        datum: edge,
        sourceKey,
        targetKey,
        value,
        unit: options.unit,
        thickness,
        sourceSpan,
        targetSpan,
        route: Object.freeze({
          sourceAnchor: sourceSpan.top,
          targetAnchor: targetSpan.top,
          segments,
          arrowSegments: null,
        }),
        segments,
        path: path(segments),
        arrowPath: null,
      });
    },
  );
  return Object.freeze({
    bounds: Object.freeze({ ...b }),
    unit: options.unit,
    nodes: Object.freeze(Array.from(geometry.values())),
    flows: Object.freeze(flows),
  });
}

/** Default node paint for custom Sankey compositions.
 * @param _node - Node geometry.
 * @returns Resolved node paint.
 * @see {@link SankeyNode}
 */
export function defaultSankeyNodeStyle<N>(
  _node: SankeyNodeGeometry<N>,
): NodeStyle {
  return { fill: "#0f766e", cornerRadius: 3 };
}
/** Default flow paint for custom Sankey compositions.
 * @param _flow - Flow geometry.
 * @returns Resolved flow paint.
 * @see {@link SankeyFlow}
 */
export function defaultSankeyFlowStyle<E>(
  _flow: SankeyFlowGeometry<E>,
): EdgeStyle {
  return { fill: "rgba(15, 118, 110, 0.34)" };
}
/** Draw one supplied Sankey node.
 * @param argument - Node props.
 * @returns Canvas node.
 * @see {@link SankeyNodeGeometry}
 */
export function SankeyNode<N>({
  node,
  style: input,
  children,
  ...events
}: GraphNodeProps<N> & { readonly node: SankeyNodeGeometry<N> }): PibblNode {
  return (
    <GraphNode node={node} style={input} {...events}>
      {children}
    </GraphNode>
  );
}
/** Draw one supplied Sankey flow.
 * @param argument - Flow props.
 * @returns Canvas node.
 * @see {@link SankeyFlowGeometry}
 */
export function SankeyFlow<E>({
  flow,
  style: input,
  ...events
}: MarkInteraction & {
  readonly flow: SankeyFlowGeometry<E>;
  readonly style?: Style<EdgeStyle>;
}): PibblNode {
  return (
    <SvgPath
      {...events}
      style={{ ...(resolveSignalValue(input) ?? {}), d: flow.path }}
    />
  );
}
/** Render a weighted acyclic flow graph.
 * @param props - Graph data and presentation.
 * @returns Canvas node.
 * @see {@link layoutSankey}
 */
export function Sankey<N, E>(props: SankeyProps<N, E>): PibblNode {
  const frame = useGraphFrame(props.style),
    style = frame.style;
  if (!frame.bounds.width || !frame.bounds.height)
    return <Group style={frame.groupStyle}>{null}</Group>;
  const layout = layoutSankey(resolveSignalValue(props.graph), {
    ...props,
    bounds: frame.bounds,
    nodeWidth: style.nodeWidth,
    nodeGap: style.nodeGap,
  });
  return (
    <Group style={frame.groupStyle}>
      {layout.flows.map((flow) => (
        <Group
          key={String(flow.key)}
          onClick={(event) => props.onFlowClick?.(flow, event)}
        >
          {props.renderFlow ? (
            props.renderFlow(flow)
          ) : (
            <SankeyFlow
              flow={flow}
              style={{
                ...defaultSankeyFlowStyle(flow),
                ...resolveMarkStyle(flow, props.flowStyle),
              }}
            />
          )}
        </Group>
      ))}
      {layout.nodes.map((node) => (
        <Group
          key={String(node.key)}
          onClick={(event) => props.onNodeClick?.(node, event)}
        >
          {props.renderNode ? (
            props.renderNode(node)
          ) : (
            <Group>
              <SankeyNode
                node={node}
                style={{
                  ...defaultSankeyNodeStyle(node),
                  ...resolveMarkStyle(node, props.nodeStyle),
                }}
              />
              <GraphLabel
                label={node.label}
                style={{
                  ...defaultGraphLabelStyle(node.label),
                  ...resolveSignalValue(props.labelStyle),
                }}
              />
              <GraphLabel
                label={node.detail!}
                style={{
                  ...defaultGraphLabelStyle(node.detail!),
                  font: "11px sans-serif",
                  ...resolveSignalValue(props.labelStyle),
                }}
              />
            </Group>
          )}
        </Group>
      ))}
    </Group>
  );
}
