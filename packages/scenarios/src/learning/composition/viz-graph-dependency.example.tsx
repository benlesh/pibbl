import {
  FocusManagement,
  Group,
  Rectangle,
  Text,
  pibbl,
  useSignal,
  type PibblController,
} from "@pibbl/core";
import { DependencyGraph, type VizKey } from "@pibbl/core/viz";
// Illustrative deployment model for a commerce platform; durations are engineering estimates.
const pipeline = {
  nodes: [
    {
      id: "source",
      name: "Source release",
      phase: "Signed · 10:42 UTC",
    },
    { id: "contracts", name: "API contracts", phase: "Schema checks · 18 sec" },
    { id: "web", name: "Web storefront", phase: "Build + assets · 84 sec" },
    { id: "worker", name: "Order workers", phase: "Container build · 62 sec" },
    { id: "tests", name: "Integration suite", phase: "214 checks · 48 sec" },
    {
      id: "scan",
      name: "Image verification",
      phase: "SBOM + signature",
    },
    { id: "canary", name: "Canary release", phase: "5% of traffic · 4 min" },
    { id: "observe", name: "Health gate", phase: "Errors < 0.2% · 2 min" },
    { id: "release", name: "Global rollout", phase: "3 regions · 8 min" },
  ],
  edges: [
    { id: "s-c", from: "source", to: "contracts" },
    { id: "s-w", from: "source", to: "web" },
    { id: "s-o", from: "source", to: "worker" },
    { id: "c-t", from: "contracts", to: "tests" },
    { id: "w-t", from: "web", to: "tests" },
    { id: "o-v", from: "worker", to: "scan" },
    { id: "t-c", from: "tests", to: "canary" },
    { id: "v-c", from: "scan", to: "canary" },
    { id: "c-h", from: "canary", to: "observe" },
    { id: "h-r", from: "observe", to: "release" },
  ],
};
function Scene() {
  const selected = useSignal<VizKey | null>("canary");

  const selectedNode = pipeline.nodes.find(
    (node) => node.id === selected.get(),
  );
  const presentation = {
    nodeStyle: (node: { key: VizKey }) => ({
      fill: node.key === selected.get() ? "#d6eee5" : "#ffffff",
      stroke: node.key === selected.get() ? "#167663" : "#bfcec8",
      cursor: "pointer",
    }),
    onNodeClick: (node: { key: VizKey }) => selected.set(node.key),
  };
  return (
    <Group>
      <Rectangle
        onClick={() => selected.set(null)}
        style={{ width: 1100, height: 620, fill: "#f5f7f4" }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 32,
          top: 37,
          font: "bold 26px sans-serif",
          fill: "#173c36",
        }}
      >
        One release. Every dependency.
      </Text>
      <Text
        pointerEvents="none"
        style={{ left: 32, top: 68, font: "14px sans-serif", fill: "#62756e" }}
      >
        Illustrative commerce deployment · read left to right · select a stage
        for context
      </Text>
      <Rectangle
        onClick={() => selected.set(null)}
        style={{
          left: 32,
          top: 91,
          width: 1036,
          height: 370,
          fill: "#edf1ec",
          cornerRadius: 10,
        }}
      />
      {[
        "SOURCE",
        "BUILD & VALIDATE",
        "QUALITY GATES",
        "CANARY",
        "OBSERVE",
        "RELEASE",
      ].map((label, i) => (
        <Text
          pointerEvents="none"
          key={label}
          style={{
            left: 45 + i * 169 + 82.5,
            top: 114,
            font: "700 10px sans-serif",
            textAlign: "center",
            fill: "#698175",
          }}
        >
          {label}
        </Text>
      ))}
      <Group style={{ translateX: 45, translateY: 142 }}>
        <DependencyGraph
          nodeKey="id"
          edgeKey="id"
          source="from"
          target="to"
          label="name"
          detail="phase"
          nodeSize={{ width: 140, height: 70 }}
          graph={pipeline}
          nodeStyle={presentation.nodeStyle}
          onNodeClick={presentation.onNodeClick}
          onEdgeClick={() => selected.set(null)}
          style={{ width: 1010, height: 290, rankGap: 29, nodeGap: 22 }}
        />
      </Group>
      <Text
        pointerEvents="none"
        style={{
          left: 34,
          top: 492,
          font: "bold 16px sans-serif",
          fill: "#234b42",
        }}
      >
        {selectedNode?.name ?? "Choose a stage"}
      </Text>
      <Text
        pointerEvents="none"
        style={{ left: 34, top: 520, font: "14px sans-serif", fill: "#63776e" }}
      >
        {selectedNode
          ? `${selectedNode.phase} · ${pipeline.edges.filter((edge) => edge.to === selected.get()).length} prerequisites · ${pipeline.edges.filter((edge) => edge.from === selected.get()).length} downstream stages`
          : "Select a stage to inspect its dependencies."}
      </Text>
      <Text
        pointerEvents="none"
        style={{ left: 34, top: 582, font: "12px sans-serif", fill: "#70827a" }}
      >
        Arrows show required predecessors, not elapsed time. Select any stage to
        inspect its position in the release pipeline.
      </Text>
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
