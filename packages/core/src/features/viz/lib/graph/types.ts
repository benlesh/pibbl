import type {
  PibblNode,
  PibblEventHandlers,
  PibblEventParticipationOptions,
  Signal,
  SignalValue,
  PibblResponsiveStyle,
  GStyle,
  RectStyle,
  SvgPathStyle,
  TextStyle,
  SystemStyle,
  PathSegment,
} from "@pibbl/core";

type ClickEvent = Parameters<NonNullable<PibblEventHandlers["onClick"]>>[0];
/** A stable application identifier used to join graph records and geometry. {@link GraphLayout} */
export type VizKey = string | number;
/** A property key or pure reader for one typed source record. {@link GraphLayout}
 * @param datum - Source record.
 * @returns Accessed value. */
export type Accessor<D, V> =
  | {
      [P in keyof D]-?: D[P] extends V ? P : never;
    }[keyof D] /** A caller-provided pure callback. {@link GraphLayout}
   * @param datum - The source record or geometry supplied by Pibbl.
   * @returns The value produced by this callback. */
  | ((datum: D) => V);
/** An immutable finite rectangle in graph-local logical pixels. {@link GraphLayout} */
export type Bounds = Readonly<{
  /** Horizontal coordinate in local logical pixels. {@link GraphLayout} */
  x: number;
  /** Vertical coordinate in local logical pixels. {@link GraphLayout} */
  y: number;
  /** Finite width in local logical pixels. {@link GraphLayout} */
  width: number;
  /** Finite height in local logical pixels. {@link GraphLayout} */
  height: number;
}>;
export type { Size } from "@pibbl/core";
import type { Size } from "@pibbl/core";
/** An immutable coordinate in graph-local logical pixels. {@link GraphLayout} */
export type Point = Readonly<{
  /** Horizontal coordinate in local logical pixels. {@link GraphLayout} */
  x: number;
  /** Vertical coordinate in local logical pixels. {@link GraphLayout} */
  y: number;
}>;
/** A responsive style value or signal accepted by a Pibbl mark. {@link GraphLayout} */
export type Style<S extends SystemStyle> = SignalValue<PibblResponsiveStyle<S>>;
/** A static or geometry-aware mark style with no retained state. {@link GraphLayout}
 * @param geometry - Mark geometry.
 * @returns Mark style. */
export type MarkStyle<G, S extends SystemStyle> =
  | Style<S> /** A caller-provided pure callback. {@link GraphLayout}
   * @param geometry - The source record or geometry supplied by Pibbl.
   * @returns The value produced by this callback. */
  | ((geometry: G) => Style<S>);
/** Paint properties for a node box; geometry remains layout-owned. {@link GraphLayout} */
export type NodeStyle = Omit<RectStyle, "left" | "top" | "width" | "height">;
/** Paint properties for an edge path; its route remains geometry-owned. {@link GraphLayout} */
export type EdgeStyle = Omit<SvgPathStyle, "d" | "left" | "top">;
/** Paint properties for text; label placement remains geometry-owned. {@link GraphLayout} */
export type LabelStyle = Omit<TextStyle, "left" | "top" | "width" | "height">;
/** Layout and paint properties for a graph component frame. {@link GraphLayout} */
export type FrameStyle = GStyle;
/** A decorative text string with immutable placement. {@link GraphLayout} */
export interface LabelGeometry {
  /** Text displayed by the label. {@link GraphLayout} */
  readonly text: string;
  /** Finite local logical bounds for this geometry. {@link GraphLayout} */
  readonly bounds: Bounds;
  /** Clockwise label rotation in degrees. {@link GraphLayout} */
  readonly rotationDegrees: number;
}
/** Application-owned node and edge records in stable source order. {@link GraphLayout} */
export interface GraphData<N, E> {
  /** Source nodes in application order. {@link GraphLayout} */
  readonly nodes: readonly N[];
  /** Source edges in application order. {@link GraphLayout} */
  readonly edges: readonly E[];
}
/** Typed readers that identify graph records and optional text. {@link GraphLayout} */
export interface GraphAccessors<N, E> {
  /** Reads each node’s stable key. {@link GraphLayout} */
  readonly nodeKey: Accessor<N, VizKey>;
  /** Reads each edge’s stable key. {@link GraphLayout} */
  readonly edgeKey: Accessor<E, VizKey>;
  /** Reads an edge source key. {@link GraphLayout} */
  readonly source: Accessor<E, VizKey>;
  /** Reads an edge target key. {@link GraphLayout} */
  readonly target: Accessor<E, VizKey>;
  /** Optional reader for a node’s primary text. {@link LabelGeometry} */
  readonly label?: Accessor<N, string>;
  /** Optional reader for a node’s secondary text. {@link LabelGeometry} */
  readonly detail?: Accessor<N, string>;
}
/** Immutable node geometry paired with its original record. {@link GraphLayout} */
export interface GraphNodeGeometry<N> {
  /** Stable application-provided key. {@link GraphLayout} */
  readonly key: VizKey;
  /** Original application record. {@link GraphLayout} */
  readonly datum: N;
  /** Finite local logical bounds for this geometry. {@link GraphLayout} */
  readonly bounds: Bounds;
  /** Decorative label geometry. {@link GraphLayout} */
  readonly label: LabelGeometry;
  /** Optional secondary label geometry. {@link GraphLayout} */
  readonly detail: LabelGeometry | null;
}
// Reuse the existing public core PathSegment / PathGeometry / toSvgPathData protocol.
/** Structured anchors and path segments for an edge route. {@link GraphLayout} */
export interface GraphRoute {
  /** Attachment point on the source mark. {@link GraphLayout} */
  readonly sourceAnchor: Point;
  /** Attachment point on the target mark. {@link GraphLayout} */
  readonly targetAnchor: Point;
  /** Path segments from source to target. {@link GraphLayout} */
  readonly segments: readonly Readonly<PathSegment>[];
  /** Optional path segments for an edge arrowhead. {@link GraphLayout} */
  readonly arrowSegments: readonly Readonly<PathSegment>[] | null;
}
/** Immutable edge geometry paired with its original record. {@link GraphLayout} */
export interface GraphEdgeGeometry<E> {
  /** Stable application-provided key. {@link GraphLayout} */
  readonly key: VizKey;
  /** Original application record. {@link GraphLayout} */
  readonly datum: E;
  /** Stable key of the edge source node. {@link GraphLayout} */
  readonly sourceKey: VizKey;
  /** Stable key of the edge target node. {@link GraphLayout} */
  readonly targetKey: VizKey;
  /** Structured route used to produce the serialized path. {@link GraphLayout} */
  readonly route: GraphRoute;
  /** SVG path serialization of the route. {@link GraphLayout} */
  readonly path: string; // Convenience serialization of route.segments; must agree with route.
  /** Optional SVG path for the route arrow. {@link GraphLayout} */
  readonly arrowPath: string | null;
}
/** A pure immutable snapshot that can be painted with graph marks. {@link GraphLayout} */
export interface GraphLayout<N, E> {
  /** Finite local logical bounds for this geometry. {@link GraphLayout} */
  readonly bounds: Bounds;
  /** Source nodes in application order. {@link GraphLayout} */
  readonly nodes: readonly GraphNodeGeometry<N>[];
  /** Source edges in application order. {@link GraphLayout} */
  readonly edges: readonly GraphEdgeGeometry<E>[];
}
/** Optional default-mark overrides and click handlers shared by graph components. {@link GraphLayout} */
export interface GraphPresentation<
  N,
  E,
  NG extends GraphNodeGeometry<N> = GraphNodeGeometry<N>,
> {
  /** Style or geometry-aware style for node marks. {@link GraphLayout} */
  readonly nodeStyle?: MarkStyle<NG, NodeStyle>;
  /** Style or geometry-aware style for edge marks. {@link GraphLayout} */
  readonly edgeStyle?: MarkStyle<GraphEdgeGeometry<E>, EdgeStyle>;
  /** Style for decorative labels. {@link GraphLayout} */
  readonly labelStyle?: MarkStyle<NG, LabelStyle>;
  /** Replaces the default node mark with this composition. {@link GraphLayout}
   * @param node - The source record or geometry supplied by Pibbl.
   * @returns The value produced by this callback. */
  readonly renderNode?: (node: NG) => PibblNode;
  /** Replaces the default edge mark with this composition. {@link GraphLayout}
   * @param edge - The source record or geometry supplied by Pibbl.
   * @returns The value produced by this callback. */
  readonly renderEdge?: (edge: GraphEdgeGeometry<E>) => PibblNode;
  /** Receives clicks on a node mark. {@link GraphLayout}
   * @param node - The source record or geometry supplied by Pibbl.
   * @param event - The source record or geometry supplied by Pibbl. */
  readonly onNodeClick?: (node: NG, event: ClickEvent) => void;
  /** Receives clicks on an edge mark. {@link GraphLayout}
   * @param edge - The source record or geometry supplied by Pibbl.
   * @param event - The source record or geometry supplied by Pibbl. */
  readonly onEdgeClick?: (
    edge: GraphEdgeGeometry<E>,
    event: ClickEvent,
  ) => void;
}
/** Ordinary Pibbl event and focus participation accepted by graph marks. {@link GraphLayout} */
export interface MarkInteraction
  extends PibblEventHandlers, PibblEventParticipationOptions {
  /** Whether the mark enters logical keyboard focus. {@link GraphLayout} */
  readonly keyboardFocusable?: boolean;
  /** Logical bounds used for keyboard navigation. {@link GraphLayout} */
  readonly keyboardNavigationBounds?: Bounds;
}
/** Geometry, paint, content, and ordinary events for GraphNode. {@link GraphLayout} */
export interface GraphNodeProps<N> extends MarkInteraction {
  /** Immutable node geometry and original datum. {@link GraphLayout} */
  readonly node: GraphNodeGeometry<N>;
  /** Frame style and responsive size allocation. {@link GraphLayout} */
  readonly style?: Style<NodeStyle>;
  /** Optional content painted with this mark. {@link GraphLayout} */
  readonly children?: PibblNode; // Children are local to node.bounds.
}
/** Geometry, paint, and ordinary events for GraphEdge. {@link GraphLayout} */
export interface GraphEdgeProps<E> extends MarkInteraction {
  /** Immutable edge geometry and original datum. {@link GraphLayout} */
  readonly edge: GraphEdgeGeometry<E>;
  /** Frame style and responsive size allocation. {@link GraphLayout} */
  readonly style?: Style<EdgeStyle>;
}
/** Geometry and paint for a decorative GraphLabel. {@link GraphLayout} */
export interface GraphLabelProps {
  /** Decorative label geometry. {@link GraphLayout} */
  readonly label: LabelGeometry;
  /** Frame style and responsive size allocation. {@link GraphLayout} */
  readonly style?: Style<LabelStyle>;
}
/** A layout snapshot plus mark overrides, without running an algorithm. {@link GraphLayout} */
export interface GraphViewProps<N, E> extends GraphPresentation<N, E> {
  /** Immutable layout snapshot for ordinary mark composition. {@link GraphLayout} */
  readonly layout: SignalValue<GraphLayout<N, E>>;
  /** Frame style and responsive size allocation. {@link GraphLayout} */
  readonly style?: Style<FrameStyle>;
}

/** Frame options for rank-based dependency diagrams. {@link GraphLayout} */
export interface DependencyStyle extends GStyle {
  /** Distance between ranks in local logical pixels. {@link GraphLayout} */
  readonly rankGap?: number;
  /** Minimum gap between node marks in local logical pixels. {@link GraphLayout} */
  readonly nodeGap?: number;
}
/** Pure layout inputs for a directed dependency graph. {@link GraphLayout} */
export interface DependencyOptions<N, E> extends GraphAccessors<N, E> {
  /** Finite local logical bounds for this geometry. {@link GraphLayout} */
  readonly bounds: Bounds;
  /** Node size in local logical pixels; defaults to 160 by 56. {@link GraphLayout}
   * @param node - Source record to measure.
   * @returns Finite local logical size. */
  readonly nodeSize?:
    | Size /** A caller-provided pure callback. {@link GraphLayout}
     * @param node - The source record or geometry supplied by Pibbl.
     * @returns The value produced by this callback. */
    | ((node: N) => Size);
  /** Distance between ranks in local logical pixels. {@link GraphLayout} */
  readonly rankGap?: number;
  /** Minimum gap between node marks in local logical pixels. {@link GraphLayout} */
  readonly nodeGap?: number;
}
/** Reactive dependency data and default mark presentation. {@link GraphLayout} */
export interface DependencyGraphProps<N, E>
  extends GraphAccessors<N, E>, GraphPresentation<N, E> {
  /** Graph records; publish a new snapshot to update. {@link GraphLayout} */
  readonly graph: SignalValue<GraphData<N, E>>;
  /** Node size in local logical pixels; defaults to 160 by 56. {@link GraphLayout}
   * @param node - Source record to measure.
   * @returns Finite local logical size. */
  readonly nodeSize?:
    | Size /** A caller-provided pure callback. {@link GraphLayout}
     * @param node - The source record or geometry supplied by Pibbl.
     * @returns The value produced by this callback. */
    | ((node: N) => Size);
  /** Frame style and responsive size allocation. {@link GraphLayout} */
  readonly style?: Style<DependencyStyle>;
}

/** Bounded deterministic numeric settings for force solving. {@link GraphLayout} */
export interface ForceSettings {
  /** Deterministic seed for solver initialization. {@link GraphLayout} */
  readonly seed?: number;
  /** Preferred link distance in local logical pixels. {@link GraphLayout} */
  readonly linkDistance?: number;
  /** Minimum gap between node marks in local logical pixels. {@link GraphLayout} */
  readonly nodeGap?: number;
  /** Maximum solver iterations before exhaustion. {@link GraphLayout} */
  readonly maxIterations?: number;
}
/** Pure force-layout inputs, accessors, bounds, and solver settings. {@link GraphLayout} */
export interface ForceOptions<N, E> extends GraphAccessors<N, E> {
  /** Finite local logical bounds for this geometry. {@link GraphLayout} */
  readonly bounds: Bounds;
  /** Node size in local logical pixels; defaults to 160 by 56. {@link GraphLayout}
   * @param node - Source record to measure.
   * @returns Finite local logical size. */
  readonly nodeSize?:
    | Size /** A caller-provided pure callback. {@link GraphLayout}
     * @param node - The source record or geometry supplied by Pibbl.
     * @returns The value produced by this callback. */
    | ((node: N) => Size);
  /** Optional deterministic solver settings. {@link GraphLayout} */
  readonly simulation?: ForceSettings;
  /** Whether direction affects the algorithm. {@link GraphLayout} */
  readonly directed?: boolean;
}
/** A force-solver snapshot with bounded progress state. {@link GraphLayout} */
export interface ForceLayout<N, E> extends GraphLayout<N, E> {
  /** Iterations completed by the solver. {@link GraphLayout} */
  readonly iterations: number;
  /** Whether the solver reached its stopping condition. {@link GraphLayout} */
  readonly settled: boolean;
}
/** Hook-owned live solver state and commands; released on unmount. {@link GraphLayout} */
export interface ForceNetworkController<N, E> {
  /** Immutable layout snapshot for ordinary mark composition. {@link GraphLayout} */
  readonly layout: Signal<ForceLayout<N, E>>;
  /** Current solver lifecycle status. {@link GraphLayout} */
  readonly status: Signal<
    "running" | "paused" | "settled" | "exhausted" | "failed"
  >;
  /** Most recent solver failure, or null. {@link GraphLayout} */
  readonly error: Signal<Error | null>;
  /** Queues a pause at the next scheduler boundary. {@link GraphLayout} */
  pause(): void;
  /** Queues solver advancement at the next scheduler boundary. {@link GraphLayout} */
  resume(): void;
  /** Restarts the current solver without discarding node positions. {@link GraphLayout} */
  restart(): void;
  /** Restores seeded positions and clears pins. {@link GraphLayout} */
  reset(): void;
  /** Pins one node at a finite local position. {@link GraphLayout}
   * @param key - The source record or geometry supplied by Pibbl.
   * @param position - The source record or geometry supplied by Pibbl. */
  pin(key: VizKey, position: Point): void;
  /** Releases a previously pinned node. {@link GraphLayout}
   * @param key - The source record or geometry supplied by Pibbl. */
  release(key: VizKey): void;
}
/** Frame style for a live force network. {@link GraphLayout} */
export type ForceStyle = GStyle;
/** Reactive force-network data, solver settings, and presentation. {@link GraphLayout} */
export interface ForceNetworkProps<N, E>
  extends GraphAccessors<N, E>, GraphPresentation<N, E> {
  /** Optional compatible numeric solver factory. {@link GraphLayout} */
  readonly createSimulation?: ForceSimulationFactory<N, E>;
  /** Graph records; publish a new snapshot to update. {@link GraphLayout} */
  readonly graph: SignalValue<GraphData<N, E>>;
  /** Node size in local logical pixels; defaults to 160 by 56. {@link GraphLayout}
   * @param node - Source record to measure.
   * @returns Finite local logical size. */
  readonly nodeSize?:
    | Size /** A caller-provided pure callback. {@link GraphLayout}
     * @param node - The source record or geometry supplied by Pibbl.
     * @returns The value produced by this callback. */
    | ((node: N) => Size);
  /** Optional deterministic solver settings. {@link GraphLayout} */
  readonly simulation?: ForceSettings;
  /** Whether direction affects the algorithm. {@link GraphLayout} */
  readonly directed?: boolean;
  /** Signal controlling whether simulation advances. {@link GraphLayout} */
  readonly paused?: SignalValue<boolean>;
  /** Frame style and responsive size allocation. {@link GraphLayout} */
  readonly style?: Style<ForceStyle>;
}
/** Configuration for a hook-owned force solver session. {@link GraphLayout} */
export interface ForceHookOptions<N, E> extends ForceOptions<N, E> {
  /** Initial paused state for a new controller. {@link GraphLayout} */
  readonly initialPaused?: boolean;
  /** Optional compatible numeric solver factory. {@link GraphLayout} */
  readonly createSimulation?: ForceSimulationFactory<N, E>;
}

/** Typed readers for one rooted hierarchy with stable child order. {@link GraphLayout} */
export interface HierarchyAccessors<D> {
  /** Reads each hierarchy record’s stable key. {@link GraphLayout} */
  readonly keyBy: Accessor<D, VizKey>;
  /** Reads ordered child records; null and undefined mean no children. {@link GraphLayout} */
  readonly childrenBy: Accessor<D, readonly D[] | null | undefined>;
  /** Optional reader for a node’s primary text. {@link LabelGeometry} */
  readonly label?: Accessor<D, string>;
  /** Whether this item hides its descendants. {@link GraphLayout}
   * @param node - The source record or geometry supplied by Pibbl.
   * @returns The value produced by this callback. */
  readonly collapsed?: (node: D) => boolean;
}
/** The original parent and child records represented by a tree edge. {@link GraphLayout} */
export interface TreeEdge<D> {
  /** Original parent record. {@link GraphLayout} */
  readonly parent: D;
  /** Original child record. {@link GraphLayout} */
  readonly child: D;
}
/** Tree node geometry with ancestry and collapsed-child information. {@link GraphLayout} */
export interface TreeNodeGeometry<D> extends GraphNodeGeometry<D> {
  /** Zero-based hierarchy depth. {@link GraphLayout} */
  readonly depth: number;
  /** Parent key, or null for a top-level item. {@link GraphLayout} */
  readonly parentKey: VizKey | null;
  /** Number of children omitted by collapse. {@link GraphLayout} */
  readonly hiddenChildren: number;
}
/** Immutable tidy-tree node and edge geometry. {@link GraphLayout} */
export interface TreeLayout<D> extends GraphLayout<D, TreeEdge<D>> {
  /** Source nodes in application order. {@link GraphLayout} */
  readonly nodes: readonly TreeNodeGeometry<D>[];
}
/** Frame options controlling tree level and sibling spacing. {@link GraphLayout} */
export interface TreeStyle extends GStyle {
  /** Gap between hierarchy levels in local logical pixels. {@link GraphLayout} */
  readonly levelGap?: number;
  /** Gap between sibling subtrees in local logical pixels. {@link GraphLayout} */
  readonly siblingGap?: number;
}
/** Pure tidy-tree inputs including bounds and optional dimensions. {@link GraphLayout} */
export interface TreeOptions<D> extends HierarchyAccessors<D> {
  /** Finite local logical bounds for this geometry. {@link GraphLayout} */
  readonly bounds: Bounds;
  /** Optional reader for a node’s secondary text. {@link LabelGeometry} */
  readonly detail?: Accessor<D, string>;
  /** Node size in local logical pixels; defaults to 160 by 56. {@link GraphLayout}
   * @param node - Source record to measure.
   * @returns Finite local logical size. */
  readonly nodeSize?:
    | Size /** A caller-provided pure callback. {@link GraphLayout}
     * @param node - The source record or geometry supplied by Pibbl.
     * @returns The value produced by this callback. */
    | ((node: D) => Size);
  /** Gap between hierarchy levels in local logical pixels. {@link GraphLayout} */
  readonly levelGap?: number;
  /** Gap between sibling subtrees in local logical pixels. {@link GraphLayout} */
  readonly siblingGap?: number;
}
/** Reactive hierarchy data and presentation for TidyTree. {@link GraphLayout} */
export interface TidyTreeProps<D>
  extends
    HierarchyAccessors<D>,
    GraphPresentation<D, TreeEdge<D>, TreeNodeGeometry<D>> {
  /** Hierarchy root; publish a new root to update. {@link GraphLayout} */
  readonly root: SignalValue<D>;
  /** Optional reader for a node’s secondary text. {@link LabelGeometry} */
  readonly detail?: Accessor<D, string>;
  /** Node size in local logical pixels; defaults to 160 by 56. {@link GraphLayout}
   * @param node - Source record to measure.
   * @returns Finite local logical size. */
  readonly nodeSize?:
    | Size /** A caller-provided pure callback. {@link GraphLayout}
     * @param node - The source record or geometry supplied by Pibbl.
     * @returns The value produced by this callback. */
    | ((node: D) => Size);
  /** Replaces the default node mark with this composition. {@link GraphLayout}
   * @param node - The source record or geometry supplied by Pibbl.
   * @returns The value produced by this callback. */
  readonly renderNode?: (node: TreeNodeGeometry<D>) => PibblNode;
  /** Receives clicks on a node mark. {@link GraphLayout}
   * @param node - The source record or geometry supplied by Pibbl.
   * @param event - The source record or geometry supplied by Pibbl. */
  readonly onNodeClick?: (node: TreeNodeGeometry<D>, event: ClickEvent) => void;
  /** Frame style and responsive size allocation. {@link GraphLayout} */
  readonly style?: Style<TreeStyle>;
}

/** Ordered row, column, and relation records for an adjacency matrix. {@link GraphLayout} */
export interface MatrixData<R, C, E> {
  /** Ordered source row records. {@link GraphLayout} */
  readonly rows: readonly R[];
  /** Ordered source column records. {@link GraphLayout} */
  readonly columns: readonly C[];
  /** Source relation records. {@link GraphLayout} */
  readonly relations: readonly E[];
}
/** Typed matrix keys, quantity reader, labels, and display unit. {@link GraphLayout} */
export interface MatrixAccessors<R, C, E> {
  /** Stable row key. {@link GraphLayout} */
  readonly rowKey: Accessor<R, VizKey>;
  /** Stable column key. {@link GraphLayout} */
  readonly columnKey: Accessor<C, VizKey>;
  /** Reads an edge source key. {@link GraphLayout} */
  readonly source: Accessor<E, VizKey>;
  /** Reads an edge target key. {@link GraphLayout} */
  readonly target: Accessor<E, VizKey>;
  /** Reads the finite quantitative value. {@link GraphLayout} */
  readonly value: Accessor<E, number>;
  /** Reads a row label. {@link GraphLayout} */
  readonly rowLabel?: Accessor<R, string>;
  /** Reads a column label. {@link GraphLayout} */
  readonly columnLabel?: Accessor<C, string>;
  /** Display unit for quantitative values. {@link GraphLayout} */
  readonly unit: string;
  /** Formats a quantitative value for display. {@link GraphLayout}
   * @param value - The source record or geometry supplied by Pibbl.
   * @returns The value produced by this callback. */
  readonly formatValue?: (value: number) => string;
}
/** Immutable aggregate geometry for one ordered row/column pair. {@link GraphLayout} */
export interface MatrixCellGeometry<R, C, E> {
  /** Original row record. {@link GraphLayout} */
  readonly row: R;
  /** Original column record. {@link GraphLayout} */
  readonly column: C;
  /** Stable row key. {@link GraphLayout} */
  readonly rowKey: VizKey;
  /** Stable column key. {@link GraphLayout} */
  readonly columnKey: VizKey;
  /** Original records represented by this aggregate. {@link GraphLayout} */
  readonly records: readonly E[];
  /** Reads the finite quantitative value. {@link GraphLayout} */
  readonly value: number | null; // An observed zero remains 0.
  /** Finite local logical bounds for this geometry. {@link GraphLayout} */
  readonly bounds: Bounds;
  /** Decorative label geometry. {@link GraphLayout} */
  readonly label: LabelGeometry | null;
}
/** Immutable matrix cells and decorative axis labels. {@link GraphLayout} */
export interface MatrixLayout<R, C, E> {
  /** Finite local logical bounds for this geometry. {@link GraphLayout} */
  readonly bounds: Bounds;
  /** Display unit for quantitative values. {@link GraphLayout} */
  readonly unit: string;
  /** Immutable cells in source-stable layout order. {@link GraphLayout} */
  readonly cells: readonly MatrixCellGeometry<R, C, E>[];
  /** Decorative labels for matrix rows. {@link GraphLayout} */
  readonly rowLabels: readonly LabelGeometry[];
  /** Decorative labels for matrix columns. {@link GraphLayout} */
  readonly columnLabels: readonly LabelGeometry[];
}
/** Frame options for matrix gaps and label reservations. {@link GraphLayout} */
export interface MatrixStyle extends GStyle {
  /** Gap between cells in local logical pixels. {@link GraphLayout} */
  readonly cellGap?: number;
  /** Reserved width for matrix row labels in local logical pixels. {@link GraphLayout} */
  readonly rowLabelWidth?: number;
  /** Reserved height for matrix column labels in local logical pixels. {@link GraphLayout} */
  readonly columnLabelHeight?: number;
}
/** Pure adjacency-matrix inputs and finite output bounds. {@link GraphLayout} */
export interface MatrixOptions<R, C, E> extends MatrixAccessors<R, C, E> {
  /** Finite local logical bounds for this geometry. {@link GraphLayout} */
  readonly bounds: Bounds;
  /** Gap between cells in local logical pixels. {@link GraphLayout} */
  readonly cellGap?: number;
  /** Reserved width for matrix row labels in local logical pixels. {@link GraphLayout} */
  readonly rowLabelWidth?: number;
  /** Reserved height for matrix column labels in local logical pixels. {@link GraphLayout} */
  readonly columnLabelHeight?: number;
}
/** Reactive matrix data and cell presentation. {@link GraphLayout} */
export interface AdjacencyMatrixProps<R, C, E> extends MatrixAccessors<
  R,
  C,
  E
> {
  /** Input records; publish a new snapshot to update. {@link GraphLayout} */
  readonly data: SignalValue<MatrixData<R, C, E>>;
  /** Frame style and responsive size allocation. {@link GraphLayout} */
  readonly style?: Style<MatrixStyle>;
  /** Style or geometry-aware style for cell marks. {@link GraphLayout} */
  readonly cellStyle?: MarkStyle<MatrixCellGeometry<R, C, E>, NodeStyle>;
  /** Style for decorative labels. {@link GraphLayout} */
  readonly labelStyle?: Style<LabelStyle>;
  /** Replaces the default cell mark with this composition. {@link GraphLayout}
   * @param cell - The source record or geometry supplied by Pibbl.
   * @returns The value produced by this callback. */
  readonly renderCell?: (cell: MatrixCellGeometry<R, C, E>) => PibblNode;
  /** Receives clicks on a cell mark. {@link GraphLayout}
   * @param cell - The source record or geometry supplied by Pibbl.
   * @param event - The source record or geometry supplied by Pibbl. */
  readonly onCellClick?: (
    cell: MatrixCellGeometry<R, C, E>,
    event: ClickEvent,
  ) => void;
}
/** Geometry, paint, events, and content for one matrix cell. {@link GraphLayout} */
export interface MatrixCellProps<R, C, E> extends MarkInteraction {
  /** Immutable cell geometry and its original records. {@link GraphLayout} */
  readonly cell: MatrixCellGeometry<R, C, E>;
  /** Frame style and responsive size allocation. {@link GraphLayout} */
  readonly style?: Style<NodeStyle>;
  /** Optional content painted with this mark. {@link GraphLayout} */
  readonly children?: PibblNode;
}

/** Node geometry annotated with incoming, outgoing, and net quantities. {@link GraphLayout} */
export interface SankeyNodeGeometry<N> extends GraphNodeGeometry<N> {
  /** Total value arriving at this node. {@link GraphLayout} */
  readonly incomingValue: number;
  /** Total value leaving this node. {@link GraphLayout} */
  readonly outgoingValue: number;
  /** Outgoing value minus incoming value. {@link GraphLayout} */
  readonly netValue: number;
}
/** Flow geometry annotated with its source quantity and pixel thickness. {@link GraphLayout} */
export interface SankeyFlowGeometry<E> extends GraphEdgeGeometry<E> {
  /** Reads the finite quantitative value. {@link GraphLayout} */
  readonly value: number;
  /** Display unit for quantitative values. {@link GraphLayout} */
  readonly unit: string;
  /** Source-side flow attachment span. {@link GraphLayout} */
  readonly sourceSpan: Readonly<{
    /** Upper endpoint of the attachment span. {@link GraphLayout} */
    top: Point;
    /** Lower endpoint of the attachment span. {@link GraphLayout} */
    bottom: Point;
  }>;
  /** Target-side flow attachment span. {@link GraphLayout} */
  readonly targetSpan: Readonly<{
    /** Upper endpoint of the attachment span. {@link GraphLayout} */
    top: Point;
    /** Lower endpoint of the attachment span. {@link GraphLayout} */
    bottom: Point;
  }>;
  /** Flow width in local logical pixels. {@link GraphLayout} */
  readonly thickness: number; // Local logical units; one scale across all flows.
}
/** Immutable Sankey nodes and flows with their display unit. {@link GraphLayout} */
export interface SankeyLayout<N, E> {
  /** Finite local logical bounds for this geometry. {@link GraphLayout} */
  readonly bounds: Bounds;
  /** Display unit for quantitative values. {@link GraphLayout} */
  readonly unit: string;
  /** Source nodes in application order. {@link GraphLayout} */
  readonly nodes: readonly SankeyNodeGeometry<N>[];
  /** Immutable Sankey flow geometry. {@link GraphLayout} */
  readonly flows: readonly SankeyFlowGeometry<E>[];
}
/** Typed Sankey keys, flow quantity reader, and display unit. {@link GraphLayout} */
export interface SankeyAccessors<N, E> extends GraphAccessors<N, E> {
  /** Reads the finite quantitative value. {@link GraphLayout} */
  readonly value: Accessor<E, number>;
  /** Display unit for quantitative values. {@link GraphLayout} */
  readonly unit: string;
  /** Formats a quantitative value for display. {@link GraphLayout}
   * @param value - The source record or geometry supplied by Pibbl.
   * @returns The value produced by this callback. */
  readonly formatValue?: (value: number) => string;
}
/** Frame options for Sankey node width and separation. {@link GraphLayout} */
export interface SankeyStyle extends GStyle {
  /** Width of Sankey nodes in local logical pixels. {@link GraphLayout} */
  readonly nodeWidth?: number;
  /** Minimum gap between node marks in local logical pixels. {@link GraphLayout} */
  readonly nodeGap?: number;
}
/** Pure Sankey inputs and finite output bounds. {@link GraphLayout} */
export interface SankeyOptions<N, E> extends SankeyAccessors<N, E> {
  /** Finite local logical bounds for this geometry. {@link GraphLayout} */
  readonly bounds: Bounds;
  /** Width of Sankey nodes in local logical pixels. {@link GraphLayout} */
  readonly nodeWidth?: number;
  /** Minimum gap between node marks in local logical pixels. {@link GraphLayout} */
  readonly nodeGap?: number;
}
/** Reactive Sankey data and default flow/node presentation. {@link GraphLayout} */
export interface SankeyProps<N, E> extends SankeyAccessors<N, E> {
  /** Graph records; publish a new snapshot to update. {@link GraphLayout} */
  readonly graph: SignalValue<GraphData<N, E>>;
  /** Frame style and responsive size allocation. {@link GraphLayout} */
  readonly style?: Style<SankeyStyle>;
  /** Style or geometry-aware style for node marks. {@link GraphLayout} */
  readonly nodeStyle?: MarkStyle<SankeyNodeGeometry<N>, NodeStyle>;
  /** Style or geometry-aware style for flow marks. {@link GraphLayout} */
  readonly flowStyle?: MarkStyle<SankeyFlowGeometry<E>, EdgeStyle>;
  /** Style for decorative labels. {@link GraphLayout} */
  readonly labelStyle?: Style<LabelStyle>;
  /** Replaces the default node mark with this composition. {@link GraphLayout}
   * @param node - The source record or geometry supplied by Pibbl.
   * @returns The value produced by this callback. */
  readonly renderNode?: (node: SankeyNodeGeometry<N>) => PibblNode;
  /** Replaces the default flow mark with this composition. {@link GraphLayout}
   * @param flow - The source record or geometry supplied by Pibbl.
   * @returns The value produced by this callback. */
  readonly renderFlow?: (flow: SankeyFlowGeometry<E>) => PibblNode;
  /** Receives clicks on a node mark. {@link GraphLayout}
   * @param node - The source record or geometry supplied by Pibbl.
   * @param event - The source record or geometry supplied by Pibbl. */
  readonly onNodeClick?: (
    node: SankeyNodeGeometry<N>,
    event: ClickEvent,
  ) => void;
  /** Receives clicks on a flow mark. {@link GraphLayout}
   * @param flow - The source record or geometry supplied by Pibbl.
   * @param event - The source record or geometry supplied by Pibbl. */
  readonly onFlowClick?: (
    flow: SankeyFlowGeometry<E>,
    event: ClickEvent,
  ) => void;
}

/** Ordered left, right, and edge records for a two-sided graph. {@link GraphLayout} */
export interface BipartiteData<L, R, E> {
  /** Left-side endpoint geometry. {@link GraphLayout} */
  readonly left: readonly L[];
  /** Right-side endpoint geometry. {@link GraphLayout} */
  readonly right: readonly R[];
  /** Source edges in application order. {@link GraphLayout} */
  readonly edges: readonly E[];
}
/** Typed keys and optional labels for both graph sides. {@link GraphLayout} */
export interface BipartiteAccessors<L, R, E> {
  /** Reads each left-side record’s stable key. {@link GraphLayout} */
  readonly leftKey: Accessor<L, VizKey>;
  /** Reads each right-side record’s stable key. {@link GraphLayout} */
  readonly rightKey: Accessor<R, VizKey>;
  /** Reads each edge’s stable key. {@link GraphLayout} */
  readonly edgeKey: Accessor<E, VizKey>;
  /** Reads an edge source key. {@link GraphLayout} */
  readonly source: Accessor<E, VizKey>;
  /** Reads an edge target key. {@link GraphLayout} */
  readonly target: Accessor<E, VizKey>;
  /** Optional reader for a left-side label. {@link GraphLayout} */
  readonly leftLabel?: Accessor<L, string>;
  /** Optional reader for a right-side label. {@link GraphLayout} */
  readonly rightLabel?: Accessor<R, string>;
}
/** Edge geometry retaining side-qualified endpoints. {@link GraphLayout} */
export interface BipartiteEdgeGeometry<L, R, E> extends GraphEdgeGeometry<E> {
  /** Left-side endpoint geometry. {@link GraphLayout} */
  readonly left: GraphNodeGeometry<L>;
  /** Right-side endpoint geometry. {@link GraphLayout} */
  readonly right: GraphNodeGeometry<R>;
}
/** Immutable left nodes, right nodes, and their connecting edges. {@link GraphLayout} */
export interface BipartiteLayout<L, R, E> {
  /** Finite local logical bounds for this geometry. {@link GraphLayout} */
  readonly bounds: Bounds;
  /** Left-side endpoint geometry. {@link GraphLayout} */
  readonly left: readonly GraphNodeGeometry<L>[];
  /** Right-side endpoint geometry. {@link GraphLayout} */
  readonly right: readonly GraphNodeGeometry<R>[];
  /** Source edges in application order. {@link GraphLayout} */
  readonly edges: readonly BipartiteEdgeGeometry<L, R, E>[];
}
/** Frame options for two-sided graph columns and node spacing. {@link GraphLayout} */
export interface BipartiteStyle extends GStyle {
  /** Distance between bipartite columns in local logical pixels. {@link GraphLayout} */
  readonly columnGap?: number;
  /** Minimum gap between node marks in local logical pixels. {@link GraphLayout} */
  readonly nodeGap?: number;
}
/** Pure bipartite inputs, side dimensions, and finite bounds. {@link GraphLayout} */
export interface BipartiteOptions<L, R, E> extends BipartiteAccessors<L, R, E> {
  /** Finite local logical bounds for this geometry. {@link GraphLayout} */
  readonly bounds: Bounds;
  /** Optional left-node size reader in local logical pixels. {@link GraphLayout}
   * @param datum - Left-side source record to measure.
   * @returns Finite local logical size. */
  readonly leftSize?:
    | Size /** A caller-provided pure callback. {@link GraphLayout}
     * @param datum - The source record or geometry supplied by Pibbl.
     * @returns The value produced by this callback. */
    | ((datum: L) => Size);
  /** Optional right-node size reader in local logical pixels. {@link GraphLayout}
   * @param datum - Right-side source record to measure.
   * @returns Finite local logical size. */
  readonly rightSize?:
    | Size /** A caller-provided pure callback. {@link GraphLayout}
     * @param datum - The source record or geometry supplied by Pibbl.
     * @returns The value produced by this callback. */
    | ((datum: R) => Size);
  /** Distance between bipartite columns in local logical pixels. {@link GraphLayout} */
  readonly columnGap?: number;
  /** Minimum gap between node marks in local logical pixels. {@link GraphLayout} */
  readonly nodeGap?: number;
}
/** Reactive bipartite data and side-specific mark presentation. {@link GraphLayout} */
export interface BipartiteGraphProps<L, R, E> extends BipartiteAccessors<
  L,
  R,
  E
> {
  /** Graph records; publish a new snapshot to update. {@link GraphLayout} */
  readonly graph: SignalValue<BipartiteData<L, R, E>>;
  /** Optional left-node size reader in local logical pixels. {@link GraphLayout}
   * @param datum - Left-side source record to measure.
   * @returns Finite local logical size. */
  readonly leftSize?:
    | Size /** A caller-provided pure callback. {@link GraphLayout}
     * @param datum - The source record or geometry supplied by Pibbl.
     * @returns The value produced by this callback. */
    | ((datum: L) => Size);
  /** Optional right-node size reader in local logical pixels. {@link GraphLayout}
   * @param datum - Right-side source record to measure.
   * @returns Finite local logical size. */
  readonly rightSize?:
    | Size /** A caller-provided pure callback. {@link GraphLayout}
     * @param datum - The source record or geometry supplied by Pibbl.
     * @returns The value produced by this callback. */
    | ((datum: R) => Size);
  /** Frame style and responsive size allocation. {@link GraphLayout} */
  readonly style?: Style<BipartiteStyle>;
  /** Style or geometry-aware style for left nodes. {@link GraphLayout} */
  readonly leftNodeStyle?: MarkStyle<GraphNodeGeometry<L>, NodeStyle>;
  /** Style or geometry-aware style for right nodes. {@link GraphLayout} */
  readonly rightNodeStyle?: MarkStyle<GraphNodeGeometry<R>, NodeStyle>;
  /** Style or geometry-aware style for edge marks. {@link GraphLayout} */
  readonly edgeStyle?: MarkStyle<BipartiteEdgeGeometry<L, R, E>, EdgeStyle>;
  /** Style for decorative labels. {@link GraphLayout} */
  readonly labelStyle?: Style<LabelStyle>;
  /** Replaces a default left-node mark. {@link GraphLayout}
   * @param node - The source record or geometry supplied by Pibbl.
   * @returns The value produced by this callback. */
  readonly renderLeftNode?: (node: GraphNodeGeometry<L>) => PibblNode;
  /** Replaces a default right-node mark. {@link GraphLayout}
   * @param node - The source record or geometry supplied by Pibbl.
   * @returns The value produced by this callback. */
  readonly renderRightNode?: (node: GraphNodeGeometry<R>) => PibblNode;
  /** Replaces the default edge mark with this composition. {@link GraphLayout}
   * @param edge - The source record or geometry supplied by Pibbl.
   * @returns The value produced by this callback. */
  readonly renderEdge?: (edge: BipartiteEdgeGeometry<L, R, E>) => PibblNode;
  /** Receives clicks on left-side nodes. {@link GraphLayout}
   * @param node - The source record or geometry supplied by Pibbl.
   * @param event - The source record or geometry supplied by Pibbl. */
  readonly onLeftNodeClick?: (
    node: GraphNodeGeometry<L>,
    event: ClickEvent,
  ) => void;
  /** Receives clicks on right-side nodes. {@link GraphLayout}
   * @param node - The source record or geometry supplied by Pibbl.
   * @param event - The source record or geometry supplied by Pibbl. */
  readonly onRightNodeClick?: (
    node: GraphNodeGeometry<R>,
    event: ClickEvent,
  ) => void;
  /** Receives clicks on an edge mark. {@link GraphLayout}
   * @param edge - The source record or geometry supplied by Pibbl.
   * @param event - The source record or geometry supplied by Pibbl. */
  readonly onEdgeClick?: (
    edge: BipartiteEdgeGeometry<L, R, E>,
    event: ClickEvent,
  ) => void;
}

/** Hierarchy readers plus a leaf quantity, unit, and optional formatter. {@link GraphLayout} */
export interface PartitionAccessors<D> extends HierarchyAccessors<D> {
  /** Reads the finite quantitative value. {@link GraphLayout} */
  readonly value: Accessor<D, number>;
  /** Display unit for quantitative values. {@link GraphLayout} */
  readonly unit: string;
  /** Formats a quantitative value for display. {@link GraphLayout}
   * @param value - The source record or geometry supplied by Pibbl.
   * @returns The value produced by this callback. */
  readonly formatValue?: (value: number) => string;
}
/** Immutable hierarchy-cell geometry with aggregate quantity metadata. {@link GraphLayout} */
export interface PartitionCellGeometry<D> {
  /** Stable application-provided key. {@link GraphLayout} */
  readonly key: VizKey;
  /** Original application record. {@link GraphLayout} */
  readonly datum: D;
  /** Parent key, or null for a top-level item. {@link GraphLayout} */
  readonly parentKey: VizKey | null;
  /** Zero-based hierarchy depth. {@link GraphLayout} */
  readonly depth: number;
  /** Reads the finite quantitative value. {@link GraphLayout} */
  readonly value: number;
  /** Share of the root total from zero through one. {@link GraphLayout} */
  readonly fraction: number;
  /** Whether the original record has no children. {@link GraphLayout} */
  readonly isLeaf: boolean;
  /** Whether this item hides its descendants. {@link GraphLayout} */
  readonly collapsed: boolean;
  /** Finite local logical bounds for this geometry. {@link GraphLayout} */
  readonly bounds: Bounds;
  /** Decorative label geometry. {@link GraphLayout} */
  readonly label: LabelGeometry | null;
}
/** Immutable hierarchy partition cells and root total. {@link GraphLayout} */
export interface PartitionLayout<D> {
  /** Finite local logical bounds for this geometry. {@link GraphLayout} */
  readonly bounds: Bounds;
  /** Stable key of the hierarchy root. {@link GraphLayout} */
  readonly rootKey: VizKey;
  /** Sum of all source leaf values. {@link GraphLayout} */
  readonly total: number;
  /** Display unit for quantitative values. {@link GraphLayout} */
  readonly unit: string;
  /** Immutable cells in source-stable layout order. {@link GraphLayout} */
  readonly cells: readonly PartitionCellGeometry<D>[];
}
/** Default partition-cell paint, rendering, and click behavior. {@link GraphLayout} */
export interface PartitionPresentation<D> {
  /** Style or geometry-aware style for cell marks. {@link GraphLayout} */
  readonly cellStyle?: MarkStyle<PartitionCellGeometry<D>, NodeStyle>;
  /** Style for decorative labels. {@link GraphLayout} */
  readonly labelStyle?: Style<LabelStyle>;
  /** Replaces the default cell mark with this composition. {@link GraphLayout}
   * @param cell - The source record or geometry supplied by Pibbl.
   * @returns The value produced by this callback. */
  readonly renderCell?: (cell: PartitionCellGeometry<D>) => PibblNode;
  /** Receives clicks on a cell mark. {@link GraphLayout}
   * @param cell - The source record or geometry supplied by Pibbl.
   * @param event - The source record or geometry supplied by Pibbl. */
  readonly onCellClick?: (
    cell: PartitionCellGeometry<D>,
    event: ClickEvent,
  ) => void;
}
/** Frame options for squarified-cell gaps, padding, and headers. {@link GraphLayout} */
export interface TreemapStyle extends GStyle {
  /** Gap between cells in local logical pixels. {@link GraphLayout} */
  readonly cellGap?: number;
  /** Inset inside each parent cell in local logical pixels. {@link GraphLayout} */
  readonly padding?: number;
  /** Reserved parent-header height in local logical pixels. {@link GraphLayout} */
  readonly headerHeight?: number;
}
/** Pure treemap inputs and finite output bounds. {@link GraphLayout} */
export interface TreemapOptions<D> extends PartitionAccessors<D> {
  /** Finite local logical bounds for this geometry. {@link GraphLayout} */
  readonly bounds: Bounds;
  /** Gap between cells in local logical pixels. {@link GraphLayout} */
  readonly cellGap?: number;
  /** Inset inside each parent cell in local logical pixels. {@link GraphLayout} */
  readonly padding?: number;
  /** Reserved parent-header height in local logical pixels. {@link GraphLayout} */
  readonly headerHeight?: number;
}
/** Reactive hierarchy input and presentation for Treemap. {@link GraphLayout} */
export interface TreemapProps<D>
  extends PartitionAccessors<D>, PartitionPresentation<D> {
  /** Hierarchy root; publish a new root to update. {@link GraphLayout} */
  readonly root: SignalValue<D>;
  /** Frame style and responsive size allocation. {@link GraphLayout} */
  readonly style?: Style<TreemapStyle>;
}
/** Geometry, paint, events, and content for one partition cell. {@link GraphLayout} */
export interface PartitionCellProps<D> extends MarkInteraction {
  /** Immutable cell geometry and its original records. {@link GraphLayout} */
  readonly cell: PartitionCellGeometry<D>;
  /** Frame style and responsive size allocation. {@link GraphLayout} */
  readonly style?: Style<NodeStyle>;
  /** Optional content painted with this mark. {@link GraphLayout} */
  readonly children?: PibblNode;
}

/** Frame options for radial hop-ring and node spacing. {@link GraphLayout} */
export interface NeighborhoodStyle extends GStyle {
  /** Radial distance between hop rings in local logical pixels. {@link GraphLayout} */
  readonly ringGap?: number;
  /** Minimum gap between node marks in local logical pixels. {@link GraphLayout} */
  readonly nodeGap?: number;
}
/** Pure neighborhood inputs centered on one application key. {@link GraphLayout} */
export interface NeighborhoodOptions<N, E> extends GraphAccessors<N, E> {
  /** Finite local logical bounds for this geometry. {@link GraphLayout} */
  readonly bounds: Bounds;
  /** Key placed at the center of the neighborhood. {@link GraphLayout} */
  readonly centerKey: VizKey;
  /** Maximum graph distance from the center; defaults to two. {@link GraphLayout} */
  readonly hops?: number;
  /** Edges followed while collecting the neighborhood. {@link GraphLayout} */
  readonly direction?: "outbound" | "inbound" | "either";
  /** Node size in local logical pixels; defaults to 160 by 56. {@link GraphLayout}
   * @param node - Source record to measure.
   * @returns Finite local logical size. */
  readonly nodeSize?:
    | Size /** A caller-provided pure callback. {@link GraphLayout}
     * @param node - The source record or geometry supplied by Pibbl.
     * @returns The value produced by this callback. */
    | ((node: N) => Size);
  /** Radial distance between hop rings in local logical pixels. {@link GraphLayout} */
  readonly ringGap?: number;
  /** Minimum gap between node marks in local logical pixels. {@link GraphLayout} */
  readonly nodeGap?: number;
}
/** Node geometry annotated with its graph distance from center. {@link GraphLayout} */
export interface NeighborhoodNodeGeometry<N> extends GraphNodeGeometry<N> {
  /** Zero-based graph distance from the center. {@link GraphLayout} */
  readonly hop: number;
}
/** Immutable reachable nodes, retained edges, and omitted keys. {@link GraphLayout} */
export interface NeighborhoodLayout<N, E> extends GraphLayout<N, E> {
  /** Key placed at the center of the neighborhood. {@link GraphLayout} */
  readonly centerKey: VizKey;
  /** Source nodes in application order. {@link GraphLayout} */
  readonly nodes: readonly NeighborhoodNodeGeometry<N>[];
  /** Known node keys outside the requested hop range. {@link GraphLayout} */
  readonly omittedKeys: readonly VizKey[];
}
/** Reactive graph input and presentation for radial neighborhoods. {@link GraphLayout} */
export interface RadialNeighborhoodProps<N, E>
  extends
    GraphAccessors<N, E>,
    GraphPresentation<N, E, NeighborhoodNodeGeometry<N>> {
  /** Graph records; publish a new snapshot to update. {@link GraphLayout} */
  readonly graph: SignalValue<GraphData<N, E>>;
  /** Key placed at the center of the neighborhood. {@link GraphLayout} */
  readonly centerKey: SignalValue<VizKey>;
  /** Maximum graph distance from the center; defaults to two. {@link GraphLayout} */
  readonly hops?: SignalValue<number>;
  /** Edges followed while collecting the neighborhood. {@link GraphLayout} */
  readonly direction?: "outbound" | "inbound" | "either";
  /** Node size in local logical pixels; defaults to 160 by 56. {@link GraphLayout}
   * @param node - Source record to measure.
   * @returns Finite local logical size. */
  readonly nodeSize?:
    | Size /** A caller-provided pure callback. {@link GraphLayout}
     * @param node - The source record or geometry supplied by Pibbl.
     * @returns The value produced by this callback. */
    | ((node: N) => Size);
  /** Replaces the default node mark with this composition. {@link GraphLayout}
   * @param node - The source record or geometry supplied by Pibbl.
   * @returns The value produced by this callback. */
  readonly renderNode?: (node: NeighborhoodNodeGeometry<N>) => PibblNode;
  /** Receives clicks on a node mark. {@link GraphLayout}
   * @param node - The source record or geometry supplied by Pibbl.
   * @param event - The source record or geometry supplied by Pibbl. */
  readonly onNodeClick?: (
    node: NeighborhoodNodeGeometry<N>,
    event: ClickEvent,
  ) => void;
  /** Frame style and responsive size allocation. {@link GraphLayout} */
  readonly style?: Style<NeighborhoodStyle>;
}

/** Frame options for icicle cell and level spacing. {@link GraphLayout} */
export interface IcicleStyle extends GStyle {
  /** Gap between cells in local logical pixels. {@link GraphLayout} */
  readonly cellGap?: number;
  /** Gap between hierarchy levels in local logical pixels. {@link GraphLayout} */
  readonly levelGap?: number;
}
/** Pure icicle inputs and finite output bounds. {@link GraphLayout} */
export interface IcicleOptions<D> extends PartitionAccessors<D> {
  /** Finite local logical bounds for this geometry. {@link GraphLayout} */
  readonly bounds: Bounds;
  /** Gap between cells in local logical pixels. {@link GraphLayout} */
  readonly cellGap?: number;
  /** Gap between hierarchy levels in local logical pixels. {@link GraphLayout} */
  readonly levelGap?: number;
}
/** Reactive hierarchy input and presentation for Icicle. {@link GraphLayout} */
export interface IcicleProps<D>
  extends PartitionAccessors<D>, PartitionPresentation<D> {
  /** Hierarchy root; publish a new root to update. {@link GraphLayout} */
  readonly root: SignalValue<D>;
  /** Frame style and responsive size allocation. {@link GraphLayout} */
  readonly style?: Style<IcicleStyle>;
}

/** Ordered categories and directed transfer records for a chord diagram. {@link GraphLayout} */
export interface ChordData<C, T> {
  /** Ordered category records. {@link GraphLayout} */
  readonly categories: readonly C[];
  /** Source transfer records. {@link GraphLayout} */
  readonly transfers: readonly T[];
}
/** Typed category and transfer readers with quantity display settings. {@link GraphLayout} */
export interface ChordAccessors<C, T> {
  /** Reads each category key. {@link GraphLayout} */
  readonly categoryKey: Accessor<C, VizKey>;
  /** Optional reader for a node’s primary text. {@link LabelGeometry} */
  readonly label?: Accessor<C, string>;
  /** Reads an edge source key. {@link GraphLayout} */
  readonly source: Accessor<T, VizKey>;
  /** Reads an edge target key. {@link GraphLayout} */
  readonly target: Accessor<T, VizKey>;
  /** Reads the finite quantitative value. {@link GraphLayout} */
  readonly value: Accessor<T, number>;
  /** Display unit for quantitative values. {@link GraphLayout} */
  readonly unit: string;
  /** Formats a quantitative value for display. {@link GraphLayout}
   * @param value - The source record or geometry supplied by Pibbl.
   * @returns The value produced by this callback. */
  readonly formatValue?: (value: number) => string;
}
/** A clockwise angular span in graph-local polar geometry. {@link GraphLayout} */
export interface ChordArc {
  /** Center point in local logical pixels. {@link GraphLayout} */
  readonly center: Point;
  /** Radius in local logical pixels. {@link GraphLayout} */
  readonly radius: number;
  /** Clockwise start angle from twelve o’clock. {@link GraphLayout} */
  readonly startAngleDegrees: number;
  /** Clockwise end angle from twelve o’clock. {@link GraphLayout} */
  readonly endAngleDegrees: number;
}
/** Immutable outer category band geometry and aggregate quantities. {@link GraphLayout} */
export interface ChordBandGeometry<C> {
  /** Stable application-provided key. {@link GraphLayout} */
  readonly key: VizKey;
  /** Original application record. {@link GraphLayout} */
  readonly datum: C;
  /** Total value arriving at this node. {@link GraphLayout} */
  readonly incomingValue: number;
  /** Total value leaving this node. {@link GraphLayout} */
  readonly outgoingValue: number;
  /** Angular span for the visible category band. {@link GraphLayout} */
  readonly arc: ChordArc;
  /** Inner ribbon radius in local logical pixels. {@link GraphLayout} */
  readonly innerRadius: number;
  /** Path segments from source to target. {@link GraphLayout} */
  readonly segments: readonly Readonly<PathSegment>[];
  /** SVG path serialization of the route. {@link GraphLayout} */
  readonly path: string;
  /** Decorative label geometry. {@link GraphLayout} */
  readonly label: LabelGeometry;
}
/** Immutable grouped transfer-ribbon geometry and source records. {@link GraphLayout} */
export interface ChordRibbonGeometry<T> {
  /** Stable application-provided key. {@link GraphLayout} */
  readonly key: string;
  /** Stable key of the edge source node. {@link GraphLayout} */
  readonly sourceKey: VizKey;
  /** Stable key of the edge target node. {@link GraphLayout} */
  readonly targetKey: VizKey;
  /** Original records represented by this aggregate. {@link GraphLayout} */
  readonly records: readonly T[];
  /** Reads the finite quantitative value. {@link GraphLayout} */
  readonly value: number;
  /** Angular span allocated to the source side. {@link GraphLayout} */
  readonly sourceArc: ChordArc;
  /** Angular span allocated to the target side. {@link GraphLayout} */
  readonly targetArc: ChordArc;
  /** Path segments from source to target. {@link GraphLayout} */
  readonly segments: readonly Readonly<PathSegment>[];
  /** SVG path serialization of the route. {@link GraphLayout} */
  readonly path: string;
}
/** Immutable category bands and grouped transfer ribbons. {@link GraphLayout} */
export interface ChordLayout<C, T> {
  /** Finite local logical bounds for this geometry. {@link GraphLayout} */
  readonly bounds: Bounds;
  /** Display unit for quantitative values. {@link GraphLayout} */
  readonly unit: string;
  /** Sum of all source leaf values. {@link GraphLayout} */
  readonly total: number;
  /** Immutable category-band geometry. {@link GraphLayout} */
  readonly bands: readonly ChordBandGeometry<C>[];
  /** Immutable grouped transfer-ribbon geometry. {@link GraphLayout} */
  readonly ribbons: readonly ChordRibbonGeometry<T>[];
}
/** Frame options for chord band width and angular spacing. {@link GraphLayout} */
export interface ChordStyle extends GStyle {
  /** Chord-band thickness in local logical pixels. {@link GraphLayout} */
  readonly bandWidth?: number;
  /** Angular gap between chord categories in degrees. {@link GraphLayout} */
  readonly padAngle?: number;
  /** Clockwise chord rotation from twelve o’clock in degrees. {@link GraphLayout} */
  readonly startAngle?: number;
}
/** Pure chord inputs and finite output bounds. {@link GraphLayout} */
export interface ChordOptions<C, T> extends ChordAccessors<C, T> {
  /** Finite local logical bounds for this geometry. {@link GraphLayout} */
  readonly bounds: Bounds;
  /** Chord-band thickness in local logical pixels. {@link GraphLayout} */
  readonly bandWidth?: number;
  /** Angular gap between chord categories in degrees. {@link GraphLayout} */
  readonly padAngle?: number;
  /** Clockwise chord rotation from twelve o’clock in degrees. {@link GraphLayout} */
  readonly startAngle?: number;
}
/** Reactive chord data and default band/ribbon presentation. {@link GraphLayout} */
export interface ChordDiagramProps<C, T> extends ChordAccessors<C, T> {
  /** Input records; publish a new snapshot to update. {@link GraphLayout} */
  readonly data: SignalValue<ChordData<C, T>>;
  /** Frame style and responsive size allocation. {@link GraphLayout} */
  readonly style?: Style<ChordStyle>;
  /** Style for category bands. {@link GraphLayout} */
  readonly bandStyle?: MarkStyle<ChordBandGeometry<C>, EdgeStyle>;
  /** Style for transfer ribbons. {@link GraphLayout} */
  readonly ribbonStyle?: MarkStyle<ChordRibbonGeometry<T>, EdgeStyle>;
  /** Style for decorative labels. {@link GraphLayout} */
  readonly labelStyle?: Style<LabelStyle>;
  /** Replaces the default category-band mark with this composition. {@link GraphLayout}
   * @param band - The source record or geometry supplied by Pibbl.
   * @returns The value produced by this callback. */
  readonly renderBand?: (band: ChordBandGeometry<C>) => PibblNode;
  /** Replaces the default ribbon mark with this composition. {@link GraphLayout}
   * @param ribbon - The source record or geometry supplied by Pibbl.
   * @returns The value produced by this callback. */
  readonly renderRibbon?: (ribbon: ChordRibbonGeometry<T>) => PibblNode;
  /** Receives clicks on a band mark. {@link GraphLayout}
   * @param band - The source record or geometry supplied by Pibbl.
   * @param event - The source record or geometry supplied by Pibbl. */
  readonly onBandClick?: (
    band: ChordBandGeometry<C>,
    event: ClickEvent,
  ) => void;
  /** Receives clicks on a ribbon mark. {@link GraphLayout}
   * @param ribbon - The source record or geometry supplied by Pibbl.
   * @param event - The source record or geometry supplied by Pibbl. */
  readonly onRibbonClick?: (
    ribbon: ChordRibbonGeometry<T>,
    event: ClickEvent,
  ) => void;
}

// Public paint defaults. Components use these same functions; marks themselves draw geometry only.
// Functions return ordinary style values, without creating signals, resources, or selection state.

/** A manual deterministic solver with no scheduler or resource ownership. {@link GraphLayout} */
export interface ForceSimulation<N, E> {
  /** Reads the current immutable solver snapshot. {@link GraphLayout}
   * @returns The value produced by this callback. */
  read(): ForceLayout<N, E>;
  /** Advances at most the requested solver iterations. {@link GraphLayout}
   * @param options - The source record or geometry supplied by Pibbl.
   * @returns The value produced by this callback. */
  step(
    options: Readonly<{
      /** Iterations completed by the solver. {@link GraphLayout} */
      iterations: number;
    }>,
  ): ForceLayout<N, E>;
  /** Reconfigures this manual solver with a new graph snapshot. {@link GraphLayout}
   * @param graph - The source record or geometry supplied by Pibbl.
   * @param options - The source record or geometry supplied by Pibbl. */
  update(graph: GraphData<N, E>, options: ForceOptions<N, E>): void;
  /** Restarts the current solver without discarding node positions. {@link GraphLayout} */
  restart(): void;
  /** Restores seeded positions and clears pins. {@link GraphLayout} */
  reset(): void;
  /** Pins one node at a finite local position. {@link GraphLayout}
   * @param key - The source record or geometry supplied by Pibbl.
   * @param position - The source record or geometry supplied by Pibbl. */
  pin(key: VizKey, position: Point): void;
  /** Releases a previously pinned node. {@link GraphLayout}
   * @param key - The source record or geometry supplied by Pibbl. */
  release(key: VizKey): void;
}
/** Creates a compatible manual force solver for supplied graph inputs. {@link GraphLayout}
 * @param graph - Source graph.
 * @param options - Solver options.
 * @returns Simulation. */
export type ForceSimulationFactory<N, E> =
  /** A caller-provided pure callback. {@link GraphLayout}
   * @param graph - The source record or geometry supplied by Pibbl.
   * @param options - The source record or geometry supplied by Pibbl.
   * @returns The value produced by this callback. */
  (
    graph: GraphData<N, E>,
    options: ForceOptions<N, E>,
  ) => ForceSimulation<N, E>;
