import {
  FocusManagement,
  Group,
  Rectangle,
  Text,
  pibbl,
  useSignal,
  type PibblController,
} from "@pibbl/core";
import {
  GraphEdge,
  GraphLabel,
  GraphNode,
  RadialNeighborhood,
  layoutNeighborhood,
} from "@pibbl/core/viz";
const graph = {
  nodes: ["checkout", "payments", "inventory", "fraud", "catalog"].map(
    (id) => ({ id, name: id }),
  ),
  edges: [
    { id: "cp", from: "checkout", to: "payments" },
    { id: "ci", from: "checkout", to: "inventory" },
    { id: "pf", from: "payments", to: "fraud" },
    { id: "ic", from: "inventory", to: "catalog" },
  ],
};
function Scene() {
  const rebuilt = useSignal(false);
  const center = useSignal<string | number>("checkout");
  const layout = layoutNeighborhood(graph, {
    nodeKey: "id",
    edgeKey: "id",
    source: "from",
    target: "to",
    label: "name",
    centerKey: center.get(),
    hops: 2,
    ringGap: 55,
    bounds: { x: 0, y: 0, width: 700, height: 410 },
  });
  const manual = (
    <Group style={{ translateX: 150, translateY: 120 }}>
      {layout.edges.map((edge) => (
        <GraphEdge key={edge.key} edge={edge} />
      ))}
      {layout.nodes.map((node) => (
        <Group key={node.key}>
          <GraphNode node={node} onClick={() => center.set(node.key)} />
          <GraphLabel label={node.label} />
        </Group>
      ))}
    </Group>
  );
  return (
    <Group>
      <Rectangle style={{ width: 1000, height: 570, fill: "#fbfaf6" }} />
      <Text
        style={{
          left: 28,
          top: 36,
          font: "bold 24px sans-serif",
          fill: "#173b37",
        }}
      >
        Neighborhood reconstruction
      </Text>
      <Rectangle
        style={{
          left: 780,
          top: 26,
          width: 190,
          height: 36,
          cornerRadius: 5,
          fill: "#d9f3ec",
          cursor: "pointer",
        }}
        onClick={() => rebuilt.set(!rebuilt.get())}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 795,
          top: 48,
          font: "13px sans-serif",
          fill: "#173b37",
          textBaseline: "middle",
        }}
      >
        {rebuilt.get() ? "Using public marks" : "Using RadialNeighborhood"}
      </Text>
      {rebuilt.get() ? (
        manual
      ) : (
        <Group style={{ translateX: 150, translateY: 120 }}>
          <RadialNeighborhood
            graph={graph}
            nodeKey="id"
            edgeKey="id"
            source="from"
            target="to"
            label="name"
            centerKey={center}
            hops={2}
            style={{ width: 700, height: 410, ringGap: 55 }}
            onNodeClick={(node) => center.set(node.key)}
          />
        </Group>
      )}
    </Group>
  );
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(
    canvas,
    <FocusManagement>
      <Scene />
    </FocusManagement>,
  );
}
