import {
  FocusManagement,
  Group,
  Rectangle,
  Text,
  pibbl,
  useSignal,
  type PibblController,
} from "@pibbl/core";
import { backdropContrast } from "@pibbl/core/filters";
import { Sankey, SankeyFlow, SankeyNode } from "@pibbl/core/viz";

const nodes = [
  {
    id: "Solar generation",
    name: "Solar generation",
    stage: "supply",
    tone: "#d99426",
  },
  {
    id: "Wind generation",
    name: "Wind generation",
    stage: "supply",
    tone: "#397aa3",
  },
  {
    id: "Natural gas",
    name: "Natural gas",
    stage: "supply",
    tone: "#6d7780",
  },
  {
    id: "Electricity",
    name: "Electricity network",
    stage: "conversion",
    tone: "#126d68",
  },
  {
    id: "District heat",
    name: "District heat",
    stage: "conversion",
    tone: "#d46d4e",
  },
  {
    id: "Losses",
    name: "Conversion losses",
    stage: "conversion",
    tone: "#8b9690",
  },
  { id: "Homes", name: "Homes", stage: "delivery", tone: "#d99426" },
  {
    id: "Industry",
    name: "Industry",
    stage: "delivery",
    tone: "#b75672",
  },
  {
    id: "Transport",
    name: "Transport",
    stage: "delivery",
    tone: "#8065b5",
  },
  {
    id: "Unrecovered",
    name: "Unrecovered energy",
    stage: "delivery",
    tone: "#6d7780",
  },
];

// Illustrative regional energy budget in megawatt-hours for one hour.
const flows = [
  {
    id: "solar-electricity",
    from: "Solar generation",
    to: "Electricity",
    mwh: 300,
  },
  {
    id: "wind-electricity",
    from: "Wind generation",
    to: "Electricity",
    mwh: 260,
  },
  {
    id: "gas-electricity",
    from: "Natural gas",
    to: "Electricity",
    mwh: 190,
  },
  {
    id: "gas-heat",
    from: "Natural gas",
    to: "District heat",
    mwh: 150,
  },
  {
    id: "solar-losses",
    from: "Solar generation",
    to: "Losses",
    mwh: 20,
  },
  {
    id: "wind-losses",
    from: "Wind generation",
    to: "Losses",
    mwh: 20,
  },
  {
    id: "gas-losses",
    from: "Natural gas",
    to: "Losses",
    mwh: 60,
  },
  {
    id: "electricity-homes",
    from: "Electricity",
    to: "Homes",
    mwh: 250,
  },
  {
    id: "electricity-industry",
    from: "Electricity",
    to: "Industry",
    mwh: 300,
  },
  {
    id: "electricity-transport",
    from: "Electricity",
    to: "Transport",
    mwh: 200,
  },
  {
    id: "heat-homes",
    from: "District heat",
    to: "Homes",
    mwh: 100,
  },
  {
    id: "heat-industry",
    from: "District heat",
    to: "Industry",
    mwh: 50,
  },
  {
    id: "losses-unrecovered",
    from: "Losses",
    to: "Unrecovered",
    mwh: 100,
  },
];

const sourceColors: Record<string, string> = {
  "Solar generation": "rgba(217, 148, 38, 0.58)",
  "Wind generation": "rgba(57, 122, 163, 0.54)",
  "Natural gas": "rgba(80, 93, 96, 0.54)",
  Electricity: "rgba(18, 109, 104, 0.48)",
  "District heat": "rgba(212, 109, 78, 0.52)",
  Losses: "rgba(109, 119, 128, 0.42)",
};
const selectedColors: Record<string, string> = {
  "Solar generation": "#c57612",
  "Wind generation": "#23698f",
  "Natural gas": "#3f4e52",
  Electricity: "#075d5a",
  "District heat": "#b95035",
  Losses: "#58645f",
};

function Scene() {
  const selected = useSignal<string | null>(null);
  const selectedKey = selected.get();
  const active = flows.find(
    (flow) => `${flow.from} → ${flow.to}` === selectedKey,
  );
  return (
    <Group>
      <Rectangle
        onClick={() => selected.set(null)}
        style={{ width: 900, height: 580, fill: "#f8f6f0" }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 32,
          top: 26,
          font: "700 25px sans-serif",
          fill: "#202724",
        }}
      >
        Regional energy budget
      </Text>
      <Text
        pointerEvents="none"
        style={{ left: 32, top: 58, font: "14px sans-serif", fill: "#59635d" }}
      >
        Illustrative hourly balance · 1,000 MWh input, delivered energy, and
        conversion losses
      </Text>
      <Group style={{ translateX: 112, translateY: 126 }}>
        <Sankey
          graph={{ nodes, edges: flows }}
          nodeKey="id"
          edgeKey="id"
          source="from"
          target="to"
          value="mwh"
          unit="MWh"
          label="name"
          style={{ width: 676, height: 390, nodeWidth: 18, nodeGap: 16 }}
          renderFlow={(flow) => {
            const isSelected =
              selectedKey === `${flow.sourceKey} → ${flow.targetKey}`;
            return (
              <SankeyFlow
                flow={flow}
                pointerEvents="auto"
                onClick={() =>
                  selected.set(`${flow.sourceKey} → ${flow.targetKey}`)
                }
                style={{
                  fill:
                    (isSelected
                      ? selectedColors[String(flow.sourceKey)]
                      : sourceColors[String(flow.sourceKey)]) ??
                    "rgba(18,109,104,0.42)",
                  opacity: selectedKey && !isSelected ? 0.18 : 1,
                  stroke: isSelected ? "#fff4bd" : undefined,
                  strokeWidth: isSelected ? 4 : 0,
                }}
              />
            );
          }}
          renderNode={(node) => {
            const isTerminal = node.outgoingValue === 0;
            const labelLeft = isTerminal
              ? node.bounds.x - 9
              : node.bounds.x + node.bounds.width + 9;
            return (
              <Group>
                <SankeyNode
                  node={node}
                  style={{
                    fill: node.datum.tone,
                    cornerRadius: 5,
                    stroke: "rgba(255,255,255,0.9)",
                    strokeWidth: 1,
                  }}
                />
                <Group style={{ filter: backdropContrast() }}>
                  <Text
                    pointerEvents="none"
                    style={{
                      left: labelLeft,
                      top:
                        node.bounds.y +
                        Math.max(0, node.bounds.height / 2 - 13),
                      width: 124,
                      font: "700 12px sans-serif",
                      fill: "#27332e",
                      textAlign: isTerminal ? "right" : "left",
                      fit: "ellipsis",
                    }}
                  >
                    {node.label.text}
                  </Text>
                  <Text
                    pointerEvents="none"
                    style={{
                      left: labelLeft,
                      top:
                        node.bounds.y + Math.max(0, node.bounds.height / 2 + 3),
                      width: 124,
                      font: "11px sans-serif",
                      fill: "#2d4439",
                      textAlign: isTerminal ? "right" : "left",
                      fit: "ellipsis",
                    }}
                  >
                    {node.detail?.text}
                  </Text>
                </Group>
              </Group>
            );
          }}
          onNodeClick={() => selected.set(null)}
          onFlowClick={(flow) =>
            selected.set(`${flow.sourceKey} → ${flow.targetKey}`)
          }
        />
      </Group>
      <Rectangle
        onClick={() => selected.set(null)}
        style={{
          left: 32,
          top: 535,
          width: 836,
          height: 28,
          fill: active ? "#e3f0eb" : "#edf1ec",
          cornerRadius: 5,
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 44,
          top: 542,
          font: "600 13px sans-serif",
          fill: "#305449",
        }}
      >
        {active
          ? `${active.from} → ${active.to} · ${active.mwh} MWh`
          : "Select a ribbon to inspect generation, conversion, or delivery."}
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
