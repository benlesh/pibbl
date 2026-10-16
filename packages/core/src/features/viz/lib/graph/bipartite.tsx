import { Group, SvgPath, resolveSignalValue } from "@pibbl/core";
import type { PathSegment, PibblNode } from "@pibbl/core";
import type {
  Accessor,
  BipartiteData,
  BipartiteGraphProps,
  BipartiteLayout,
  BipartiteOptions,
  GraphNodeGeometry,
  Size,
  VizKey,
} from "./types.js";
import {
  defaultGraphEdgeStyle,
  defaultGraphLabelStyle,
  defaultGraphNodeStyle,
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
      `layoutBipartite: ${name} must be finite${zero ? " and nonnegative" : ""}.`,
    );
  return value;
}
function label(
  text: string,
  bounds: { x: number; y: number; width: number; height: number },
) {
  return Object.freeze({
    text,
    bounds: Object.freeze(bounds),
    rotationDegrees: 0,
  });
}
function route(a: { x: number; y: number }, b: { x: number; y: number }) {
  const middle = (a.x + b.x) / 2;
  const segments = Object.freeze([
    { type: "move" as const, x: a.x, y: a.y },
    {
      type: "cubic" as const,
      cp1x: middle,
      cp1y: a.y,
      cp2x: middle,
      cp2y: b.y,
      x: b.x,
      y: b.y,
    },
  ]);
  return Object.freeze({
    sourceAnchor: Object.freeze(a),
    targetAnchor: Object.freeze(b),
    segments,
    arrowSegments: null,
  });
}
function path(route: { segments: readonly PathSegment[] }) {
  return route.segments
    .map((segment) =>
      segment.type === "move"
        ? `M ${segment.x} ${segment.y}`
        : segment.type === "cubic"
          ? `C ${segment.cp1x} ${segment.cp1y} ${segment.cp2x} ${segment.cp2y} ${segment.x} ${segment.y}`
          : "",
    )
    .join(" ");
}
function placed<D>(
  data: readonly D[],
  keyBy: Accessor<D, VizKey>,
  labelBy: Accessor<D, string> | undefined,
  atX: number,
  bounds: { y: number; height: number },
  size: ((datum: D) => Size) | undefined,
  gap: number,
): readonly GraphNodeGeometry<D>[] {
  const total =
    data.reduce((sum, datum) => sum + (size?.(datum).height ?? 34), 0) +
    Math.max(0, data.length - 1) * gap;
  let y = bounds.y + Math.max(0, (bounds.height - total) / 2);
  const seen = new Set<VizKey>();
  return Object.freeze(
    data.map((datum) => {
      const key = access(keyBy, datum);
      if (seen.has(key))
        throw new Error(
          `layoutBipartite: duplicate node key ${String(key)} on one side.`,
        );
      seen.add(key);
      const dimensions = size?.(datum) ?? { width: 150, height: 34 };
      const box = {
        x: atX,
        y,
        width: dimensions.width,
        height: dimensions.height,
      };
      y += dimensions.height + gap;
      return Object.freeze({
        key,
        datum,
        bounds: Object.freeze(box),
        label: label(labelBy ? access(labelBy, datum) : String(key), box),
        detail: null,
      });
    }),
  );
}

/** Arranges two explicit entity sets in columns, retaining side-qualified identity.
 * @param graph - Explicit left and right entities with cross-set edges. See {@link BipartiteData}.
 * @param options - Accessors, dimensions, and column spacing. See {@link BipartiteOptions}.
 * @returns Immutable side-aware nodes and routed edges. See {@link BipartiteLayout}.
 */
export function layoutBipartite<L, R, E>(
  graph: BipartiteData<L, R, E>,
  options: BipartiteOptions<L, R, E>,
): BipartiteLayout<L, R, E> {
  const b = options.bounds;
  finite(b.x, "bounds.x");
  finite(b.y, "bounds.y");
  finite(b.width, "bounds.width", true);
  finite(b.height, "bounds.height", true);
  const gap = finite(options.nodeGap ?? 12, "nodeGap", true),
    columnGap = finite(options.columnGap ?? 120, "columnGap", true);
  const leftSize = options.leftSize,
    leftResolver: ((datum: L) => Size) | undefined =
      typeof leftSize === "function"
        ? leftSize
        : leftSize === undefined
          ? undefined
          : () => leftSize;
  const rightSize = options.rightSize,
    rightResolver: ((datum: R) => Size) | undefined =
      typeof rightSize === "function"
        ? rightSize
        : rightSize === undefined
          ? undefined
          : () => rightSize;
  const left = placed(
    graph.left,
    options.leftKey,
    options.leftLabel,
    b.x,
    b,
    leftResolver,
    gap,
  );
  const rightWidth =
    typeof rightSize === "function" ? 150 : (rightSize?.width ?? 150);
  const right = placed(
    graph.right,
    options.rightKey,
    options.rightLabel,
    Math.max(b.x, b.x + b.width - rightWidth),
    b,
    rightResolver,
    gap,
  );
  const leftByKey = new Map(left.map((node) => [node.key, node])),
    rightByKey = new Map(right.map((node) => [node.key, node]));
  const edgeKeys = new Set<VizKey>();
  const edges = graph.edges.map((edge) => {
    const key = access(options.edgeKey, edge);
    if (edgeKeys.has(key))
      throw new Error(`layoutBipartite: duplicate edge key ${String(key)}.`);
    edgeKeys.add(key);
    const source = access(options.source, edge),
      target = access(options.target, edge),
      leftNode = leftByKey.get(source),
      rightNode = rightByKey.get(target);
    if (!leftNode || !rightNode)
      throw new RangeError(
        "layoutBipartite: every edge must point from a known left key to a known right key.",
      );
    const r = route(
      {
        x: leftNode.bounds.x + leftNode.bounds.width,
        y: leftNode.bounds.y + leftNode.bounds.height / 2,
      },
      {
        x: rightNode.bounds.x,
        y: rightNode.bounds.y + rightNode.bounds.height / 2,
      },
    );
    return Object.freeze({
      key,
      datum: edge,
      sourceKey: source,
      targetKey: target,
      left: leftNode,
      right: rightNode,
      route: r,
      path: path(r),
      arrowPath: null,
    });
  });
  if (
    left.length &&
    right.length &&
    right[0].bounds.x - (left[0].bounds.x + left[0].bounds.width) < columnGap
  )
    throw new RangeError(
      "layoutBipartite: bounds are too narrow for node sizes and columnGap.",
    );
  return Object.freeze({
    bounds: Object.freeze({ ...b }),
    left,
    right,
    edges: Object.freeze(edges),
  });
}

/** Render left/right entity sets and their cross-set relationships.
 * @param props - Entity data and presentation.
 * @returns Canvas node.
 * @see {@link layoutBipartite}
 */
export function BipartiteGraph<L, R, E>(
  props: BipartiteGraphProps<L, R, E>,
): PibblNode {
  const frame = useGraphFrame(props.style),
    style = frame.style;
  if (!frame.bounds.width || !frame.bounds.height)
    return <Group style={frame.groupStyle}>{null}</Group>;
  const layout = layoutBipartite(resolveSignalValue(props.graph), {
    ...props,
    bounds: frame.bounds,
    columnGap: style.columnGap,
    nodeGap: style.nodeGap,
  });
  return (
    <Group style={frame.groupStyle}>
      {layout.edges.map((edge) => (
        <Group
          key={String(edge.key)}
          onClick={(event) => props.onEdgeClick?.(edge, event)}
        >
          {props.renderEdge ? (
            props.renderEdge(edge)
          ) : (
            <SvgPath
              style={{
                ...defaultGraphEdgeStyle(edge),
                ...resolveMarkStyle(edge, props.edgeStyle),
                d: edge.path,
              }}
            />
          )}
        </Group>
      ))}
      {layout.left.map((node) => (
        <Group
          key={`left-${String(node.key)}`}
          onClick={(event) => props.onLeftNodeClick?.(node, event)}
        >
          {props.renderLeftNode ? (
            props.renderLeftNode(node)
          ) : (
            <Group>
              <GraphNode
                node={node}
                style={{
                  ...defaultGraphNodeStyle(node),
                  ...resolveMarkStyle(node, props.leftNodeStyle),
                }}
              />
              <GraphLabel
                label={node.label}
                style={{
                  ...defaultGraphLabelStyle(node.label),
                  ...resolveSignalValue(props.labelStyle),
                }}
              />
            </Group>
          )}
        </Group>
      ))}
      {layout.right.map((node) => (
        <Group
          key={`right-${String(node.key)}`}
          onClick={(event) => props.onRightNodeClick?.(node, event)}
        >
          {props.renderRightNode ? (
            props.renderRightNode(node)
          ) : (
            <Group>
              <GraphNode
                node={node}
                style={{
                  ...defaultGraphNodeStyle(node),
                  ...resolveMarkStyle(node, props.rightNodeStyle),
                }}
              />
              <GraphLabel
                label={node.label}
                style={{
                  ...defaultGraphLabelStyle(node.label),
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
