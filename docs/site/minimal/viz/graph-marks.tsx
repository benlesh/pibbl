import { pibbl, Group, Text } from "@pibbl/core";
import {
  GraphView,
  GraphNode,
  GraphEdge,
  GraphLabel,
  defaultGraphNodeStyle,
  defaultGraphEdgeStyle,
  defaultGraphLabelStyle,
  useForceNetwork,
  straightGraphRoute,
  orthogonalGraphRoute,
  curvedGraphRoute,
  layoutMatrix,
  MatrixCell,
  defaultMatrixCellStyle,
  layoutSankey,
  SankeyNode,
  SankeyFlow,
  defaultSankeyNodeStyle,
  defaultSankeyFlowStyle,
  layoutTreemap,
  TreemapCell,
  defaultPartitionCellStyle,
  layoutIcicle,
  IcicleCell,
  layoutChords,
  ChordBand,
  ChordRibbon,
  defaultChordBandStyle,
  defaultChordRibbonStyle,
} from "@pibbl/core/viz";
const nodes = [
  { id: "wind", name: "Wind" },
  { id: "homes", name: "Homes" },
];
const edges = [{ id: "delivery", from: "wind", to: "homes", value: 80 }];
const graph = { nodes, edges };
const access = {
  nodeKey: "id" as const,
  edgeKey: "id" as const,
  source: "from" as const,
  target: "to" as const,
  label: "name" as const,
};
const bounds = { x: 10, y: 30, width: 240, height: 150 };
interface StorageNode {
  id: string;
  name: string;
  value: number;
  children?: StorageNode[];
}
const hierarchy: StorageNode = {
  id: "region",
  name: "Region",
  value: 0,
  children: [
    { id: "north", name: "North", value: 80 },
    { id: "south", name: "South", value: 20 },
  ],
};
const hierarchyAccess = {
  keyBy: "id" as const,
  childrenBy: "children" as const,
  label: "name" as const,
  value: "value" as const,
  unit: "GB",
};
const matrix = layoutMatrix(
  { rows: nodes, columns: nodes, relations: edges },
  {
    ...access,
    rowKey: "id",
    columnKey: "id",
    value: "value",
    unit: "MWh",
    bounds,
  },
);
const sankey = layoutSankey(graph, {
  ...access,
  value: "value",
  unit: "MWh",
  bounds,
});
const treemap = layoutTreemap(hierarchy, { ...hierarchyAccess, bounds });
const icicle = layoutIcicle(hierarchy, { ...hierarchyAccess, bounds });
const chord = layoutChords(
  { categories: nodes, transfers: edges },
  {
    categoryKey: "id",
    label: "name",
    source: "from",
    target: "to",
    value: "value",
    unit: "MWh",
    bounds,
  },
);
const endpoints = {
  sourceAnchor: { x: 20, y: 20 },
  targetAnchor: { x: 180, y: 90 },
};
// Each route exposes editable anchors and core path segments.
export const routes = [
  straightGraphRoute(endpoints),
  orthogonalGraphRoute(endpoints),
  curvedGraphRoute(endpoints),
];
function Scene() {
  const network = useForceNetwork(graph, { ...access, bounds });
  return (
    <Group>
      <GraphView
        layout={network.layout}
        renderNode={(node) => (
          <Group>
            <GraphNode node={node} style={defaultGraphNodeStyle(node)} />
            <GraphLabel
              label={node.label}
              style={defaultGraphLabelStyle(node.label)}
            />
          </Group>
        )}
        renderEdge={(edge) => (
          <GraphEdge edge={edge} style={defaultGraphEdgeStyle(edge)} />
        )}
      />
      <Group style={{ left: 280 }}>
        <Text style={{ fill: "black" }}>Delivery matrix</Text>
        {matrix.cells.map((cell) => (
          <MatrixCell
            key={String(cell.rowKey) + ":" + String(cell.columnKey)}
            cell={cell}
            style={defaultMatrixCellStyle(cell, { minimum: 0, maximum: 80 })}
          />
        ))}
      </Group>
      <Group style={{ top: 210 }}>
        {sankey.flows.map((flow) => (
          <SankeyFlow
            key={String(flow.key)}
            flow={flow}
            style={defaultSankeyFlowStyle(flow)}
          />
        ))}
        {sankey.nodes.map((node) => (
          <SankeyNode
            key={String(node.key)}
            node={node}
            style={defaultSankeyNodeStyle(node)}
          />
        ))}
      </Group>
      <Group style={{ left: 280, top: 210 }}>
        {treemap.cells.map((cell) => (
          <TreemapCell
            key={String(cell.key)}
            cell={cell}
            style={defaultPartitionCellStyle(cell)}
          />
        ))}
      </Group>
      <Group style={{ top: 420 }}>
        {icicle.cells.map((cell) => (
          <IcicleCell
            key={String(cell.key)}
            cell={cell}
            style={defaultPartitionCellStyle(cell)}
          />
        ))}
      </Group>
      <Group style={{ left: 280, top: 420 }}>
        {chord.ribbons.map((ribbon) => (
          <ChordRibbon
            key={String(ribbon.key)}
            ribbon={ribbon}
            style={defaultChordRibbonStyle(ribbon)}
          />
        ))}
        {chord.bands.map((band) => (
          <ChordBand
            key={String(band.key)}
            band={band}
            style={defaultChordBandStyle(band)}
          />
        ))}
      </Group>
    </Group>
  );
}
export default function mount(canvas: HTMLCanvasElement) {
  return pibbl(canvas, <Scene />);
}

// Minimal-runtime pages execute their module directly.
const canvas = document.createElement("canvas");
canvas.width = 560;
canvas.height = 640;
document.body.append(canvas);
const controller = mount(canvas);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
