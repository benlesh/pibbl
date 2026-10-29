---
id: api-component-graph-visualization
title: Graph visualization
summary: Compose graph layouts, original-record geometry, reusable marks, and resource-owned force simulations.
kind: api
slug: graph-visualization
apiCategory: component
symbols:
  [
    Accessor,
    AdjacencyMatrix,
    AdjacencyMatrixProps,
    BipartiteAccessors,
    BipartiteData,
    BipartiteEdgeGeometry,
    BipartiteGraph,
    BipartiteGraphProps,
    BipartiteLayout,
    BipartiteOptions,
    BipartiteStyle,
    Bounds,
    ChordAccessors,
    ChordArc,
    ChordBand,
    ChordBandGeometry,
    ChordData,
    ChordDiagram,
    ChordDiagramProps,
    ChordLayout,
    ChordOptions,
    ChordRibbon,
    ChordRibbonGeometry,
    ChordStyle,
    DependencyGraph,
    DependencyGraphProps,
    DependencyOptions,
    DependencyStyle,
    EdgeStyle,
    ForceHookOptions,
    ForceLayout,
    ForceNetwork,
    ForceNetworkController,
    ForceNetworkProps,
    ForceOptions,
    ForceSettings,
    ForceSimulation,
    ForceSimulationFactory,
    ForceStyle,
    FrameStyle,
    GraphAccessors,
    GraphData,
    GraphEdge,
    GraphEdgeGeometry,
    GraphEdgeProps,
    GraphLabel,
    GraphLabelProps,
    GraphLayout,
    GraphNode,
    GraphNodeGeometry,
    GraphNodeProps,
    GraphPresentation,
    GraphRoute,
    GraphView,
    GraphViewProps,
    HierarchyAccessors,
    Icicle,
    IcicleCell,
    IcicleOptions,
    IcicleProps,
    IcicleStyle,
    LabelGeometry,
    LabelStyle,
    MarkInteraction,
    MarkStyle,
    MatrixAccessors,
    MatrixCell,
    MatrixCellGeometry,
    MatrixCellProps,
    MatrixData,
    MatrixLayout,
    MatrixOptions,
    MatrixStyle,
    NeighborhoodLayout,
    NeighborhoodNodeGeometry,
    NeighborhoodOptions,
    NeighborhoodStyle,
    NodeStyle,
    PartitionAccessors,
    PartitionCellGeometry,
    PartitionCellProps,
    PartitionLayout,
    PartitionPresentation,
    Point,
    RadialNeighborhood,
    RadialNeighborhoodProps,
    Sankey,
    SankeyAccessors,
    SankeyFlow,
    SankeyFlowGeometry,
    SankeyLayout,
    SankeyNode,
    SankeyNodeGeometry,
    SankeyOptions,
    SankeyProps,
    SankeyStyle,
    Style,
    TidyTree,
    TidyTreeProps,
    TreeEdge,
    TreeLayout,
    TreeNodeGeometry,
    TreeOptions,
    TreeStyle,
    Treemap,
    TreemapCell,
    TreemapOptions,
    TreemapProps,
    TreemapStyle,
    VizKey,
    createForceSimulation,
    curvedGraphRoute,
    defaultChordBandStyle,
    defaultChordRibbonStyle,
    defaultGraphEdgeStyle,
    defaultGraphLabelStyle,
    defaultGraphNodeStyle,
    defaultMatrixCellStyle,
    defaultPartitionCellStyle,
    defaultSankeyFlowStyle,
    defaultSankeyNodeStyle,
    layoutBipartite,
    layoutChords,
    layoutDependencies,
    layoutForceNetwork,
    layoutIcicle,
    layoutMatrix,
    layoutNeighborhood,
    layoutSankey,
    layoutTree,
    layoutTreemap,
    orthogonalGraphRoute,
    straightGraphRoute,
    useForceNetwork,
  ]
---

# Graph visualization

Import graph components, layout helpers, marks, and types from `@pibbl/core/viz`.
These are Canvas 2D compositions without a React dependency. Every component has a
public layout-and-marks reconstruction path; the built-ins use the same operations.

| Component            | Independent calculation                                          | Public marks                             |
| -------------------- | ---------------------------------------------------------------- | ---------------------------------------- |
| `DependencyGraph`    | `layoutDependencies`                                             | `GraphNode`, `GraphEdge`, `GraphLabel`   |
| `ForceNetwork`       | `layoutForceNetwork`, `createForceSimulation`, `useForceNetwork` | `GraphView` and graph marks              |
| `TidyTree`           | `layoutTree`                                                     | Graph marks                              |
| `AdjacencyMatrix`    | `layoutMatrix`                                                   | `MatrixCell`, `GraphLabel`               |
| `Sankey`             | `layoutSankey`                                                   | `SankeyNode`, `SankeyFlow`, `GraphLabel` |
| `BipartiteGraph`     | `layoutBipartite`                                                | Graph marks                              |
| `Treemap`            | `layoutTreemap`                                                  | `TreemapCell`, `GraphLabel`              |
| `RadialNeighborhood` | `layoutNeighborhood`                                             | Graph marks                              |
| `Icicle`             | `layoutIcicle`                                                   | `IcicleCell`, `GraphLabel`               |
| `ChordDiagram`       | `layoutChords`                                                   | `ChordBand`, `ChordRibbon`, `GraphLabel` |

## Start with a component

```tsx
import { Group } from "@pibbl/core";
import {
  DependencyGraph,
  layoutDependencies,
  GraphView,
  GraphNode,
  GraphLabel,
  defaultGraphNodeStyle,
  defaultGraphLabelStyle,
} from "@pibbl/core/viz";
const services = {
  nodes: [
    { id: "checkout", name: "Checkout" },
    { id: "payment", name: "Payment" },
  ],
  edges: [{ id: "authorize", from: "checkout", to: "payment" }],
};
const view = (
  <DependencyGraph
    graph={services}
    nodeKey="id"
    edgeKey="id"
    source="from"
    target="to"
    label="name"
    style={{ width: 600, height: 240 }}
  />
);
```

The equivalent non-JSX authoring is `createElement(DependencyGraph<Node, Edge>, props)`
with application record types `Node` and `Edge`. Explicit instantiation preserves
property-accessor inference with the current `createElement` signature.

## Rebuild and customize

Pure helpers accept the input first and named options second, including finite local
`bounds`. They never schedule work or allocate renderer resources. Results retain
original data references and expose keys, boxes, labels, quantities, and routes.
Do not mutate returned snapshots or application records while they are in use.
Replace the calculation with any function producing the same geometry, transform
its result, or render your own geometry using ordinary core primitives.

```tsx
const geometry = layoutDependencies(services, {
  nodeKey: "id",
  edgeKey: "id",
  source: "from",
  target: "to",
  label: "name",
  bounds: { x: 0, y: 0, width: 600, height: 240 },
});
const custom = (
  <GraphView
    layout={geometry}
    renderNode={(node) => (
      <Group>
        <GraphNode node={node} style={defaultGraphNodeStyle(node)} />
        <GraphLabel
          label={node.label}
          style={defaultGraphLabelStyle(node.label)}
        />
      </Group>
    )}
  />
);
```

`GraphView` only paints supplied coordinates; it never lays them out or silently
fits them to a new box. All geometry uses local logical Canvas units. Graph routes
expose anchors and standard core `PathSegment` arrays as well as serialized SVG
paths. `straightGraphRoute`, `orthogonalGraphRoute`, and `curvedGraphRoute` are
independent route builders. Use existing `PathGeometry` and `toSvgPathData` for
custom shapes. Sankey exposes thickness and source/target spans. Chord geometry
exposes center/radius and angular endpoints in clockwise degrees from twelve o'clock.

Mark components draw geometry; `GraphLabel` draws decorative text separately.
Public `defaultGraph*Style`, `defaultMatrixCellStyle`, `defaultSankey*Style`,
`defaultPartitionCellStyle`, and `defaultChord*Style` return ordinary paint objects.
Component per-item styles merge onto defaults. A `renderNode`, `renderEdge`,
`renderCell`, `renderFlow`, `renderBand`, or `renderRibbon` callback replaces that
whole item, including its default text; returning null hides it. Extract a proper
component when a custom item needs hooks. Parent item click callbacks use ordinary
Pibbl event propagation and honor descendant `stopPropagation()`.

`GraphLabel` defaults to a middle baseline and single-line ellipsis inside its
supplied width. Set ordinary text paint such as `fit` and `wrap` to choose another
fitting policy. A label is decorative; omitting it does not remove its mark's
pointer or keyboard target. Partition render callbacks can replace the complete
label treatment, including separate name/value lines and an external inspector
for cells too small to label.

## Data, identity, and values

Accessors accept typed property names or functions. Node and edge IDs are explicit;
string and numeric IDs are distinct. Graph endpoints must exist and keys must be
unique. Hierarchy inputs supply `keyBy` and `childrenBy`; `collapsed` is an
application-owned predicate. App selection, filters, inspectors and drill-down state
remain ordinary signals and components. Rendering reevaluates input accessors;
there is no identity-only geometry cache requiring a revision counter.

Dependency and Sankey calculations require directed acyclic graphs. Matrix rows and
columns are separately typed, missing cells remain null, and duplicate relation
records sum. Bipartite node identity is scoped to its side. Partition values apply
to source leaves; branches sum descendant leaves even when collapsed. Chord sums
ordered source/target transfers and keeps opposite directions separate. Numeric
visualizations require a `unit`; `formatValue` returns complete display text.
Nonfinite/negative quantities, cycles where disallowed, duplicate keys, and bounds
insufficient for declared spacing throw. No loss category or conservation correction
is invented. Empty inputs produce empty geometry; zero component allocations paint
nothing. Layout does not imply a clipping boundary; compose core `Clip` if desired.

## Force ownership

`createForceSimulation(graph, options)` is a manually stepped, resource-free numeric
session: `read`, `step({ iterations })`, `update`, `pin`, `release`, `restart`, and
`reset`. The built-in deterministic solver combines repulsion, link relaxation,
damping, rectangular overlap forces, and bounds. Defaults are seed 1, linkDistance
90, nodeGap 8, and maxIterations 300. Settled means movement below 0.02 logical
units for eight iterations; reaching the unconditional budget can remain unsettled.
This is a graph layout, not physically calibrated dynamics or an overlap guarantee.

`layoutForceNetwork` runs that solver synchronously. `useForceNetwork` owns the live
session through core `stepper`, `drive`, `usePlayback`, and signals. It returns
readonly `layout`, `status`, and `error` signals plus pause/resume/restart/reset/pin/release
commands. Render its output through `GraphView`; mounting another ForceNetwork would
create another owner. `createSimulation` supplies a resource-free replacement factory
with the same `ForceSimulation` operations; its identity is fixed for the mount.

Playback advances one numeric iteration per 1/60 second and interpolates immutable
node, label, and edge geometry between solver snapshots for higher refresh displays.
Long frame gaps admit at most 1/30 second of work; hidden tabs cannot trigger an
unbounded catch-up. Pointer commands join the active playback without resetting its
clock, so neighbors keep responding throughout a drag. Paused and terminal snapshots
use exact solver geometry. Playback is released on unmount. There is no separate animation loop. Pins use local
center coordinates. Restart preserves positions and pins and resets the iteration
budget; reset restores seeded initial positions and clears pins. Hook `pin` and
`release` commands restart the iteration budget so neighboring nodes respond even
after settlement or exhaustion, while preserving an explicit pause. Commands are admitted
through playback and published with the next scheduled snapshot. Paint/selection
changes do not restart the solver. Status distinguishes running, paused, settled,
exhausted, and failed. Keep custom solver snapshots immutable and callbacks deterministic.

## Examples

The Examples catalog contains component and reconstruction variants for dependencies,
collaboration networks, organization trees, team handoffs, local energy flows,
research participation, storage allocations, incident neighborhoods, request
breakdowns, and district trips. Their checked-in datasets are explicitly illustrative;
quantities and units belong to those examples, not live external measurements.
