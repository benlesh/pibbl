import {
  FocusManagement,
  Group,
  Rectangle,
  Text,
  pibbl,
  useSignal,
  type PibblController,
} from "@pibbl/core";
import { GraphNode, RadialNeighborhood } from "@pibbl/core/viz";

const incident = {
  nodes: [
    "checkout",
    "payments",
    "inventory",
    "profile",
    "orders",
    "fraud",
    "ledger",
    "catalog",
    "email",
  ].map((id) => ({ id, name: id === "checkout" ? "checkout-api" : id })),
  edges: [
    { id: "c-p", from: "checkout", to: "payments" },
    { id: "c-i", from: "checkout", to: "inventory" },
    { id: "c-u", from: "checkout", to: "profile" },
    { id: "p-f", from: "payments", to: "fraud" },
    { id: "p-l", from: "payments", to: "ledger" },
    { id: "i-c", from: "inventory", to: "catalog" },
    { id: "u-e", from: "profile", to: "email" },
  ],
};

function Scene() {
  const center = useSignal<string | number>("checkout");
  const selected = useSignal<string | number | null>(null);
  return (
    <Group>
      <Rectangle
        onClick={() => selected.set(null)}
        style={{ width: 1000, height: 570, fill: "#fbfaf6" }}
      />
      <Text
        style={{
          left: 28,
          top: 36,
          font: "bold 26px sans-serif",
          fill: "#173b37",
        }}
      >
        Incident neighborhood
      </Text>
      <Text
        style={{ left: 28, top: 67, font: "14px sans-serif", fill: "#58716d" }}
      >
        Two outbound hops from the focal service · select a card, then recenter
        deliberately
      </Text>
      <Rectangle
        style={{
          left: 28,
          top: 86,
          width: 944,
          height: 34,
          fill: "#e8f3ef",
          stroke: "#b8d2c9",
          cornerRadius: 5,
        }}
      />
      <Text
        style={{
          left: 42,
          top: 103,
          font: "13px sans-serif",
          fill: "#173b37",
          textBaseline: "middle",
        }}
      >
        Selected: {selected.get() ?? "Choose a service"}
      </Text>
      <Text
        style={{
          left: 350,
          top: 103,
          font: "13px sans-serif",
          fill: "#40615a",
          textBaseline: "middle",
        }}
      >
        Focal: {String(center.get())}
      </Text>
      <Rectangle
        style={{
          left: 590,
          top: 89,
          width: 180,
          height: 28,
          fill: selected.get() === null ? "#eef5f2" : "#d9f3ec",
          stroke: selected.get() === null ? "#b8d2c9" : "#0f766e",
          cornerRadius: 5,
          cursor: selected.get() === null ? "default" : "pointer",
        }}
        keyboardFocusable={selected.get() !== null}
        onClick={() => {
          if (selected.get() !== null) center.set(selected.get()!);
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 607,
          top: 103,
          font: "bold 12px sans-serif",
          fill: "#173b37",
          textBaseline: "middle",
        }}
      >
        Recenter selected
      </Text>
      <Rectangle
        style={{
          left: 790,
          top: 89,
          width: 170,
          height: 28,
          fill: "#fbfaf6",
          stroke: "#58716d",
          cornerRadius: 5,
          cursor: "pointer",
        }}
        keyboardFocusable
        onClick={() => {
          center.set("checkout");
          selected.set("checkout");
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 831,
          top: 103,
          font: "bold 12px sans-serif",
          fill: "#173b37",
          textBaseline: "middle",
        }}
      >
        Reset view
      </Text>
      <RadialNeighborhood
        graph={incident}
        nodeKey="id"
        edgeKey="id"
        source="from"
        target="to"
        label="name"
        centerKey={center}
        hops={2}
        direction="outbound"
        nodeSize={{ width: 100, height: 38 }}
        style={{ left: 80, top: 132, width: 840, height: 405, ringGap: 45 }}
        renderNode={(node) => (
          <GraphNode
            node={node}
            style={{
              fill: node.key === selected.get() ? "#b8eadb" : "#edf5f2",
              stroke: node.key === center.get() ? "#173b37" : "#8eb6aa",
              strokeWidth: node.key === center.get() ? 3 : 1,
              cornerRadius: 7,
            }}
          >
            <Text
              pointerEvents="none"
              style={{
                left: 50,
                top: 21,
                font: "bold 12px sans-serif",
                fill: "#173b37",
                textAlign: "center",
                textBaseline: "middle",
              }}
            >
              {node.datum.name}
            </Text>
          </GraphNode>
        )}
        onNodeClick={(node) => selected.set(node.key)}
      />
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
