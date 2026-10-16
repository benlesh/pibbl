import { createElement } from "@pibbl/core";
import {
  DependencyGraph,
  ForceNetwork,
  TidyTree,
  AdjacencyMatrix,
  Sankey,
  BipartiteGraph,
  Treemap,
  RadialNeighborhood,
  Icicle,
  ChordDiagram,
  GraphView,
  layoutDependencies,
  layoutForceNetwork,
  layoutTree,
  layoutMatrix,
  layoutSankey,
  layoutBipartite,
  layoutTreemap,
  layoutNeighborhood,
  layoutIcicle,
  layoutChords,
  createForceSimulation,
} from "@pibbl/core/viz";
const graph = {
  nodes: [
    { id: "supply", name: "Supply" },
    { id: "demand", name: "Demand" },
  ],
  edges: [{ id: "flow", from: "supply", to: "demand", amount: 100 }],
};
const access = {
  nodeKey: "id" as const,
  edgeKey: "id" as const,
  source: "from" as const,
  target: "to" as const,
  label: "name" as const,
};
const bounds = { x: 0, y: 0, width: 640, height: 400 };
const style = { width: 640, height: 400 };
interface Item {
  id: string;
  name: string;
  value: number;
  children?: Item[];
}
const root: Item = {
  id: "root",
  name: "Portfolio",
  value: 0,
  children: [{ id: "leaf", name: "Product", value: 100 }],
};
const hierarchy = {
  keyBy: "id" as const,
  childrenBy: "children" as const,
  label: "name" as const,
};
const matrix = {
  rows: graph.nodes,
  columns: graph.nodes,
  relations: graph.edges,
};
const matrixAccess = {
  rowKey: "id" as const,
  columnKey: "id" as const,
  source: "from" as const,
  target: "to" as const,
  value: "amount" as const,
  unit: "MWh/day",
};
const bipartite = {
  left: [graph.nodes[0]],
  right: [graph.nodes[1]],
  edges: graph.edges,
};
const bipartiteAccess = {
  leftKey: "id" as const,
  rightKey: "id" as const,
  edgeKey: "id" as const,
  source: "from" as const,
  target: "to" as const,
};
const chords = { categories: graph.nodes, transfers: graph.edges };
const chordAccess = {
  categoryKey: "id" as const,
  source: "from" as const,
  target: "to" as const,
  value: "amount" as const,
  unit: "MWh/day",
};
export const components = [
  <DependencyGraph graph={graph} {...access} style={style} />,
  <ForceNetwork graph={graph} {...access} style={style} />,
  <TidyTree root={root} {...hierarchy} style={style} />,
  <AdjacencyMatrix data={matrix} {...matrixAccess} style={style} />,
  <Sankey
    graph={graph}
    {...access}
    value="amount"
    unit="MWh/day"
    style={style}
  />,
  <BipartiteGraph graph={bipartite} {...bipartiteAccess} style={style} />,
  <Treemap root={root} {...hierarchy} value="value" unit="GB" style={style} />,
  <RadialNeighborhood
    graph={graph}
    {...access}
    centerKey="supply"
    hops={1}
    style={style}
  />,
  <Icicle root={root} {...hierarchy} value="value" unit="GB" style={style} />,
  <ChordDiagram data={chords} {...chordAccess} style={style} />,
];
export const geometry = [
  layoutDependencies(graph, { ...access, bounds }),
  layoutForceNetwork(graph, { ...access, bounds }),
  layoutTree(root, { ...hierarchy, bounds }),
  layoutMatrix(matrix, { ...matrixAccess, bounds }),
  layoutSankey(graph, { ...access, value: "amount", unit: "MWh/day", bounds }),
  layoutBipartite(bipartite, { ...bipartiteAccess, bounds }),
  layoutTreemap(root, { ...hierarchy, value: "value", unit: "GB", bounds }),
  layoutNeighborhood(graph, {
    ...access,
    centerKey: "supply",
    hops: 1,
    bounds,
  }),
  layoutIcicle(root, { ...hierarchy, value: "value", unit: "GB", bounds }),
  layoutChords(chords, { ...chordAccess, bounds }),
];
export const rebuilt = (
  <GraphView layout={layoutDependencies(graph, { ...access, bounds })} />
);
export const session = createForceSimulation(graph, { ...access, bounds });
session.step({ iterations: 4 });
export const withoutJsx = createElement(
  DependencyGraph<(typeof graph.nodes)[number], (typeof graph.edges)[number]>,
  { graph, ...access, style },
);
