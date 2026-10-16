// Bind the public contracts to application records at your module boundary.
// Inputs/options configure calculations; immutable layouts feed custom marks;
// props/styles customize components without copying framework type definitions.
import type {
  VizKey,
  Accessor,
  Bounds,
  Point,
  Style,
  MarkStyle,
  NodeStyle,
  EdgeStyle,
  LabelStyle,
  FrameStyle,
  LabelGeometry,
  GraphData,
  GraphAccessors,
  GraphNodeGeometry,
  GraphRoute,
  GraphEdgeGeometry,
  GraphLayout,
  GraphPresentation,
  MarkInteraction,
  GraphNodeProps,
  GraphEdgeProps,
  GraphLabelProps,
  GraphViewProps,
  DependencyStyle,
  DependencyOptions,
  DependencyGraphProps,
  ForceSettings,
  ForceOptions,
  ForceLayout,
  ForceNetworkController,
  ForceStyle,
  ForceNetworkProps,
  ForceHookOptions,
  HierarchyAccessors,
  TreeEdge,
  TreeNodeGeometry,
  TreeLayout,
  TreeStyle,
  TreeOptions,
  TidyTreeProps,
  MatrixData,
  MatrixAccessors,
  MatrixCellGeometry,
  MatrixLayout,
  MatrixStyle,
  MatrixOptions,
  AdjacencyMatrixProps,
  MatrixCellProps,
  SankeyNodeGeometry,
  SankeyFlowGeometry,
  SankeyLayout,
  SankeyAccessors,
  SankeyStyle,
  SankeyOptions,
  SankeyProps,
  BipartiteData,
  BipartiteAccessors,
  BipartiteEdgeGeometry,
  BipartiteLayout,
  BipartiteStyle,
  BipartiteOptions,
  BipartiteGraphProps,
  PartitionAccessors,
  PartitionCellGeometry,
  PartitionLayout,
  PartitionPresentation,
  TreemapStyle,
  TreemapOptions,
  TreemapProps,
  PartitionCellProps,
  NeighborhoodStyle,
  NeighborhoodOptions,
  NeighborhoodNodeGeometry,
  NeighborhoodLayout,
  RadialNeighborhoodProps,
  IcicleStyle,
  IcicleOptions,
  IcicleProps,
  ChordData,
  ChordAccessors,
  ChordArc,
  ChordBandGeometry,
  ChordRibbonGeometry,
  ChordLayout,
  ChordStyle,
  ChordOptions,
  ChordDiagramProps,
  ForceSimulation,
  ForceSimulationFactory,
  Size,
} from "@pibbl/core/viz";
interface Delivery {
  id: string;
  name: string;
  from: string;
  to: string;
  amount: number;
  children?: Delivery[];
}
export interface DeliveryGraphContracts {
  readonly vizKey: VizKey;
  readonly accessor: Accessor<Delivery, string>;
  readonly bounds: Bounds;
  readonly point: Point;
  readonly style: Style<NodeStyle>;
  readonly markStyle: MarkStyle<GraphNodeGeometry<Delivery>, NodeStyle>;
  readonly nodeStyle: NodeStyle;
  readonly edgeStyle: EdgeStyle;
  readonly labelStyle: LabelStyle;
  readonly frameStyle: FrameStyle;
  readonly labelGeometry: LabelGeometry;
  readonly graphData: GraphData<Delivery, Delivery>;
  readonly graphAccessors: GraphAccessors<Delivery, Delivery>;
  readonly graphNodeGeometry: GraphNodeGeometry<Delivery>;
  readonly graphRoute: GraphRoute;
  readonly graphEdgeGeometry: GraphEdgeGeometry<Delivery>;
  readonly graphLayout: GraphLayout<Delivery, Delivery>;
  readonly graphPresentation: GraphPresentation<
    Delivery,
    Delivery,
    GraphNodeGeometry<Delivery>
  >;
  readonly markInteraction: MarkInteraction;
  readonly graphNodeProps: GraphNodeProps<Delivery>;
  readonly graphEdgeProps: GraphEdgeProps<Delivery>;
  readonly graphLabelProps: GraphLabelProps;
  readonly graphViewProps: GraphViewProps<Delivery, Delivery>;
  readonly dependencyStyle: DependencyStyle;
  readonly dependencyOptions: DependencyOptions<Delivery, Delivery>;
  readonly dependencyGraphProps: DependencyGraphProps<Delivery, Delivery>;
  readonly forceSettings: ForceSettings;
  readonly forceOptions: ForceOptions<Delivery, Delivery>;
  readonly forceLayout: ForceLayout<Delivery, Delivery>;
  readonly forceNetworkController: ForceNetworkController<Delivery, Delivery>;
  readonly forceStyle: ForceStyle;
  readonly forceNetworkProps: ForceNetworkProps<Delivery, Delivery>;
  readonly forceHookOptions: ForceHookOptions<Delivery, Delivery>;
  readonly hierarchyAccessors: HierarchyAccessors<Delivery>;
  readonly treeEdge: TreeEdge<Delivery>;
  readonly treeNodeGeometry: TreeNodeGeometry<Delivery>;
  readonly treeLayout: TreeLayout<Delivery>;
  readonly treeStyle: TreeStyle;
  readonly treeOptions: TreeOptions<Delivery>;
  readonly tidyTreeProps: TidyTreeProps<Delivery>;
  readonly matrixData: MatrixData<Delivery, Delivery, Delivery>;
  readonly matrixAccessors: MatrixAccessors<Delivery, Delivery, Delivery>;
  readonly matrixCellGeometry: MatrixCellGeometry<Delivery, Delivery, Delivery>;
  readonly matrixLayout: MatrixLayout<Delivery, Delivery, Delivery>;
  readonly matrixStyle: MatrixStyle;
  readonly matrixOptions: MatrixOptions<Delivery, Delivery, Delivery>;
  readonly adjacencyMatrixProps: AdjacencyMatrixProps<
    Delivery,
    Delivery,
    Delivery
  >;
  readonly matrixCellProps: MatrixCellProps<Delivery, Delivery, Delivery>;
  readonly sankeyNodeGeometry: SankeyNodeGeometry<Delivery>;
  readonly sankeyFlowGeometry: SankeyFlowGeometry<Delivery>;
  readonly sankeyLayout: SankeyLayout<Delivery, Delivery>;
  readonly sankeyAccessors: SankeyAccessors<Delivery, Delivery>;
  readonly sankeyStyle: SankeyStyle;
  readonly sankeyOptions: SankeyOptions<Delivery, Delivery>;
  readonly sankeyProps: SankeyProps<Delivery, Delivery>;
  readonly bipartiteData: BipartiteData<Delivery, Delivery, Delivery>;
  readonly bipartiteAccessors: BipartiteAccessors<Delivery, Delivery, Delivery>;
  readonly bipartiteEdgeGeometry: BipartiteEdgeGeometry<
    Delivery,
    Delivery,
    Delivery
  >;
  readonly bipartiteLayout: BipartiteLayout<Delivery, Delivery, Delivery>;
  readonly bipartiteStyle: BipartiteStyle;
  readonly bipartiteOptions: BipartiteOptions<Delivery, Delivery, Delivery>;
  readonly bipartiteGraphProps: BipartiteGraphProps<
    Delivery,
    Delivery,
    Delivery
  >;
  readonly partitionAccessors: PartitionAccessors<Delivery>;
  readonly partitionCellGeometry: PartitionCellGeometry<Delivery>;
  readonly partitionLayout: PartitionLayout<Delivery>;
  readonly partitionPresentation: PartitionPresentation<Delivery>;
  readonly treemapStyle: TreemapStyle;
  readonly treemapOptions: TreemapOptions<Delivery>;
  readonly treemapProps: TreemapProps<Delivery>;
  readonly partitionCellProps: PartitionCellProps<Delivery>;
  readonly neighborhoodStyle: NeighborhoodStyle;
  readonly neighborhoodOptions: NeighborhoodOptions<Delivery, Delivery>;
  readonly neighborhoodNodeGeometry: NeighborhoodNodeGeometry<Delivery>;
  readonly neighborhoodLayout: NeighborhoodLayout<Delivery, Delivery>;
  readonly radialNeighborhoodProps: RadialNeighborhoodProps<Delivery, Delivery>;
  readonly icicleStyle: IcicleStyle;
  readonly icicleOptions: IcicleOptions<Delivery>;
  readonly icicleProps: IcicleProps<Delivery>;
  readonly chordData: ChordData<Delivery, Delivery>;
  readonly chordAccessors: ChordAccessors<Delivery, Delivery>;
  readonly chordArc: ChordArc;
  readonly chordBandGeometry: ChordBandGeometry<Delivery>;
  readonly chordRibbonGeometry: ChordRibbonGeometry<Delivery>;
  readonly chordLayout: ChordLayout<Delivery, Delivery>;
  readonly chordStyle: ChordStyle;
  readonly chordOptions: ChordOptions<Delivery, Delivery>;
  readonly chordDiagramProps: ChordDiagramProps<Delivery, Delivery>;
  readonly forceSimulation: ForceSimulation<Delivery, Delivery>;
  readonly forceSimulationFactory: ForceSimulationFactory<Delivery, Delivery>;
  readonly size: Size;
}
