import {
  Group,
  Rectangle,
  SvgPath,
  Text,
  resolveSignalValue,
  resolveBox,
  useLayoutBox,
} from "@pibbl/core";
import type {
  GStyle,
  SystemStyle,
  PibblResponsiveStyle,
  PibblNode,
} from "@pibbl/core";
import type {
  Accessor,
  Bounds,
  Style,
  MarkStyle,
  GraphNodeGeometry,
  GraphNodeProps,
  GraphEdgeGeometry,
  GraphEdgeProps,
  GraphLabelProps,
  GraphViewProps,
  LabelGeometry,
  NodeStyle,
  EdgeStyle,
  LabelStyle,
  VizKey,
} from "./types.js";

/** Read an application's typed property or accessor without normalizing away its record. */
export function readAccessor<D, V>(datum: D, accessor: Accessor<D, V>): V {
  return typeof accessor === "function"
    ? accessor(datum)
    : (datum[accessor] as V);
}
/** Validate a finite rectangle in local logical units. */
export function validateBounds(bounds: Bounds): Bounds {
  for (const key of ["x", "y", "width", "height"] as const) {
    if (
      !Number.isFinite(bounds[key]) ||
      ((key === "width" || key === "height") && bounds[key] < 0)
    )
      throw new RangeError(
        `Graph bounds.${key} must be finite${key === "width" || key === "height" ? " and nonnegative" : ""}.`,
      );
  }
  if (
    !Number.isFinite(bounds.x + bounds.width) ||
    !Number.isFinite(bounds.y + bounds.height)
  )
    throw new RangeError("Graph bounds overflow.");
  return bounds;
}
export function validKey(key: VizKey): VizKey {
  if (
    (typeof key !== "string" && typeof key !== "number") ||
    (typeof key === "number" && !Number.isFinite(key))
  )
    throw new TypeError("Graph keys must be strings or finite numbers.");
  return key;
}
/** Resolve ordinary responsive frame style through public sizing and allocation. */
export function useGraphFrame<S extends GStyle>(
  input?: Style<S>,
): { bounds: Bounds; style: S; groupStyle: GStyle } {
  const allocation = useLayoutBox();
  const authored = (resolveSignalValue(input) ?? {}) as PibblResponsiveStyle<S>;
  const merged = { ...authored } as Record<string, unknown>;
  for (const rule of authored.when ?? []) {
    const q = rule.query;
    if (
      (q.minWidth === undefined || allocation.width >= q.minWidth) &&
      (q.maxWidth === undefined || allocation.width <= q.maxWidth) &&
      (q.minHeight === undefined || allocation.height >= q.minHeight) &&
      (q.maxHeight === undefined || allocation.height <= q.maxHeight)
    )
      Object.assign(merged, rule.style);
  }
  delete merged.when;
  for (const key of Object.keys(merged))
    merged[key] = resolveSignalValue(merged[key]);
  if (merged.width === "auto" || merged.height === "auto")
    throw new RangeError(
      "Graph frames require definite width and height or a finite parent allocation.",
    );
  const style = merged as S;
  const box = resolveBox(
    {
      ...style,
      width: style.width ?? allocation.width,
      height: style.height ?? allocation.height,
    },
    {
      minWidth: 0,
      minHeight: 0,
      maxWidth: allocation.width,
      maxHeight: allocation.height,
    },
  );
  const bounds = validateBounds({
    x: 0,
    y: 0,
    width: box.borderBox.width,
    height: box.borderBox.height,
  });
  const groupStyle = { ...style, width: bounds.width, height: bounds.height };
  for (const key of [
    "rankGap",
    "nodeGap",
    "levelGap",
    "siblingGap",
    "cellGap",
    "rowLabelWidth",
    "columnLabelHeight",
    "nodeWidth",
    "columnGap",
    "headerHeight",
    "ringGap",
    "bandWidth",
    "padAngle",
    "startAngle",
  ])
    delete (groupStyle as unknown as Record<string, unknown>)[key];
  return { bounds, style, groupStyle };
}
/** Resolve a per-item paint callback without hiding its signal reads. */
export function resolveMarkStyle<G, S extends SystemStyle>(
  geometry: G,
  input?: MarkStyle<G, S>,
): PibblResponsiveStyle<S> | undefined {
  return resolveSignalValue(
    typeof input === "function" ? input(geometry) : input,
  );
}
/** Build inspectable label regions and original-record node geometry. */
export function graphNodeGeometry<N>(
  datum: N,
  key: VizKey,
  bounds: Bounds,
  label = String(key),
  detail?: string,
): GraphNodeGeometry<N> {
  return {
    key,
    datum,
    bounds,
    label: {
      text: label,
      bounds: {
        x: bounds.x + 10,
        y: bounds.y + 4,
        width: Math.max(0, bounds.width - 20),
        height: detail ? bounds.height / 2 : Math.max(0, bounds.height - 8),
      },
      rotationDegrees: 0,
    },
    detail:
      detail === undefined
        ? null
        : {
            text: detail,
            bounds: {
              x: bounds.x + 10,
              y: bounds.y + bounds.height / 2,
              width: Math.max(0, bounds.width - 20),
              height: bounds.height / 2 - 4,
            },
            rotationDegrees: 0,
          },
  };
}
/**
 * Return the built-in node paint as an ordinary reusable style.
 * @param _node - The node being painted. See {@link GraphNodeGeometry}.
 * @returns Default fill, stroke and corner radius. See {@link NodeStyle}.
 */
export function defaultGraphNodeStyle<N>(
  _node: GraphNodeGeometry<N>,
): NodeStyle {
  return {
    fill: "#edf5f2",
    stroke: "#8eb6aa",
    strokeWidth: 1,
    cornerRadius: 7,
  };
}
/**
 * Return the built-in edge paint as an ordinary reusable style.
 * @param _edge - The edge being painted. See {@link GraphEdgeGeometry}.
 * @returns Default stroke and logical stroke width. See {@link EdgeStyle}.
 */
export function defaultGraphEdgeStyle<E>(
  _edge: GraphEdgeGeometry<E>,
): EdgeStyle {
  return { stroke: "#91a9a3", strokeWidth: 1.5 };
}
/**
 * Return the built-in label paint as an ordinary reusable style.
 * @param _label - The label being painted. See {@link LabelGeometry}.
 * @returns Default Canvas font, fill and middle baseline. See {@link LabelStyle}.
 */
export function defaultGraphLabelStyle(_label: LabelGeometry): LabelStyle {
  return { fill: "#203d39", font: "13px sans-serif", textBaseline: "middle" };
}
/**
 * Draw a node box; children use node-local coordinates and ordinary Pibbl events.
 * @param props - Box geometry, paint and event handlers. See {@link GraphNodeProps}.
 * @returns A group containing the box and authored children. See {@link GraphNodeProps}.
 */
export function GraphNode<N>({
  node,
  style,
  children,
  ...events
}: GraphNodeProps<N>): PibblNode {
  const { x, y, width, height } = node.bounds;
  const {
    keyboardFocusable,
    keyboardNavigationBounds,
    pointerEvents,
    ...handlers
  } = events;
  return (
    <Group {...handlers} style={{ translateX: x, translateY: y }}>
      <Rectangle
        keyboardFocusable={
          keyboardFocusable ??
          Boolean(handlers.onClick || handlers.onKeyDown || handlers.onKeyUp)
        }
        keyboardNavigationBounds={keyboardNavigationBounds}
        pointerEvents={pointerEvents}
        style={{ ...resolveSignalValue(style), width, height }}
      />
      {children}
    </Group>
  );
}
/**
 * Draw an edge path and optional arrow with ordinary path targeting.
 * @param props - Edge geometry, paint and event handlers. See {@link GraphEdgeProps}.
 * @returns Path content in diagram-local coordinates. See {@link GraphEdgeProps}.
 */
export function GraphEdge<E>({
  edge,
  style,
  ...events
}: GraphEdgeProps<E>): PibblNode {
  const paint = resolveSignalValue(style);
  const {
    keyboardFocusable,
    keyboardNavigationBounds,
    pointerEvents,
    ...handlers
  } = events;
  return (
    <Group {...handlers}>
      <SvgPath
        keyboardFocusable={
          keyboardFocusable ??
          Boolean(handlers.onClick || handlers.onKeyDown || handlers.onKeyUp)
        }
        keyboardNavigationBounds={keyboardNavigationBounds}
        pointerEvents={pointerEvents}
        style={{ ...paint, d: edge.path }}
      />
      {edge.arrowPath && (
        <SvgPath
          pointerEvents={pointerEvents}
          style={{
            ...paint,
            fill: paint?.stroke ?? "#91a9a3",
            d: edge.arrowPath,
          }}
        />
      )}
    </Group>
  );
}
/**
 * Draw decorative label text at its supplied box and rotation.
 * @param props - Text geometry and optional text paint. See {@link GraphLabelProps}.
 * @returns A transformed decorative Text component. See {@link GraphLabelProps}.
 */
export function GraphLabel({ label, style }: GraphLabelProps): PibblNode {
  const { x, y, width, height } = label.bounds;
  const paint = resolveSignalValue(style);
  const align = resolveSignalValue(paint?.textAlign);
  const anchor =
    align === "center"
      ? width / 2
      : align === "right" || align === "end"
        ? width
        : 0;
  return (
    <Group
      style={{
        translateX: x + anchor,
        translateY: y + height / 2,
        rotationDegrees: label.rotationDegrees,
      }}
    >
      <Text
        pointerEvents="none"
        style={{ textBaseline: "middle", fit: "ellipsis", ...paint, width }}
      >
        {label.text}
      </Text>
    </Group>
  );
}
/**
 * Render supplied graph geometry without layout, fitting, or simulation.
 * @param props - A snapshot or signal, item overrides and events. See {@link GraphViewProps}.
 * @returns An ordinary Pibbl composition preserving source paint order. See {@link GraphViewProps}.
 */
export function GraphView<N, E>(props: GraphViewProps<N, E>): PibblNode {
  const layout = resolveSignalValue(props.layout);
  return (
    <Group style={props.style}>
      {layout.edges.map((edge) => (
        <Group
          key={`e:${typeof edge.key}:${edge.key}`}
          onClick={(event) => props.onEdgeClick?.(edge, event)}
        >
          {props.renderEdge ? (
            props.renderEdge(edge)
          ) : (
            <GraphEdge
              edge={edge}
              keyboardFocusable={Boolean(props.onEdgeClick)}
              style={{
                ...defaultGraphEdgeStyle(edge),
                ...resolveMarkStyle(edge, props.edgeStyle),
              }}
            />
          )}
        </Group>
      ))}
      {layout.nodes.map((node) => (
        <Group
          key={`n:${typeof node.key}:${node.key}`}
          onClick={(event) => props.onNodeClick?.(node, event)}
        >
          {props.renderNode ? (
            props.renderNode(node)
          ) : (
            <Group>
              <GraphNode
                node={node}
                keyboardFocusable={Boolean(props.onNodeClick)}
                style={{
                  ...defaultGraphNodeStyle(node),
                  ...resolveMarkStyle(node, props.nodeStyle),
                }}
              />
              <GraphLabel
                label={node.label}
                style={{
                  ...defaultGraphLabelStyle(node.label),
                  ...resolveMarkStyle(node, props.labelStyle),
                }}
              />
              {node.detail && (
                <GraphLabel
                  label={node.detail}
                  style={{
                    ...defaultGraphLabelStyle(node.detail),
                    font: "11px sans-serif",
                    ...resolveMarkStyle(node, props.labelStyle),
                  }}
                />
              )}
            </Group>
          )}
        </Group>
      ))}
    </Group>
  );
}
