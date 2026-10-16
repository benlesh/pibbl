import {
  FocusManagement,
  Group,
  Rectangle,
  SvgPath,
  Text,
  pibbl,
  useSignal,
  type PibblController,
} from "@pibbl/core";
import { BipartiteGraph, GraphNode } from "@pibbl/core/viz";

const partners = [
  "River Watch",
  "Eastside clinic",
  "Transit alliance",
  "Harbor Works",
  "Youth council",
].map((id) => ({ id }));

const studies = [
  "Heat safety",
  "Air quality",
  "Safe routes",
  "Flood readiness",
  "Home energy",
].map((id) => ({ id }));

// Illustrative partnerships in a civic climate research program.
const contributions = [
  { id: "river-air", source: "River Watch", target: "Air quality" },
  { id: "river-flood", source: "River Watch", target: "Flood readiness" },
  { id: "clinic-heat", source: "Eastside clinic", target: "Heat safety" },
  { id: "clinic-air", source: "Eastside clinic", target: "Air quality" },
  { id: "transit-routes", source: "Transit alliance", target: "Safe routes" },
  { id: "harbor-flood", source: "Harbor Works", target: "Flood readiness" },
  { id: "harbor-energy", source: "Harbor Works", target: "Home energy" },
  { id: "youth-heat", source: "Youth council", target: "Heat safety" },
  { id: "youth-routes", source: "Youth council", target: "Safe routes" },
  { id: "youth-energy", source: "Youth council", target: "Home energy" },
];

function Scene() {
  const selected = useSignal<string | null>(null);
  const selectedKey = selected.get();
  const selectedPartner = selectedKey?.startsWith("partner:")
    ? selectedKey.slice("partner:".length)
    : undefined;
  const selectedStudy = selectedKey?.startsWith("study:")
    ? selectedKey.slice("study:".length)
    : undefined;
  const selectedEdge = contributions.find(
    (edge) => `${edge.source} → ${edge.target}` === selectedKey,
  );
  const partnerCount = (partner: string) =>
    contributions.filter((edge) => edge.source === partner).length;
  const studyCount = (study: string) =>
    contributions.filter((edge) => edge.target === study).length;
  const isConnected = (source: string, target: string) =>
    !selectedKey ||
    selectedKey === `${source} → ${target}` ||
    selectedPartner === source ||
    selectedStudy === target;
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
        Climate research network
      </Text>
      <Text
        pointerEvents="none"
        style={{ left: 32, top: 58, font: "14px sans-serif", fill: "#59635d" }}
      >
        Illustrative participation associations · lines indicate participation,
        not direction
      </Text>
      <Rectangle
        onClick={() => selected.set(null)}
        style={{
          left: 120,
          top: 107,
          width: 164,
          height: 26,
          fill: "#dceaf3",
          cornerRadius: 13,
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 137,
          top: 113,
          font: "700 11px sans-serif",
          fill: "#275d7d",
        }}
      >
        COMMUNITY PARTNERS
      </Text>
      <Rectangle
        onClick={() => selected.set(null)}
        style={{
          left: 616,
          top: 107,
          width: 164,
          height: 26,
          fill: "#f5e3d3",
          cornerRadius: 13,
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 645,
          top: 113,
          font: "700 11px sans-serif",
          fill: "#9a542e",
        }}
      >
        ACTIVE STUDIES
      </Text>
      <Group style={{ translateX: 120, translateY: 145 }}>
        <BipartiteGraph
          graph={{ left: partners, right: studies, edges: contributions }}
          leftKey="id"
          rightKey="id"
          edgeKey="id"
          source="source"
          target="target"
          leftLabel="id"
          rightLabel="id"
          style={{ width: 660, height: 366, nodeGap: 18, columnGap: 160 }}
          leftSize={{ width: 164, height: 46 }}
          rightSize={{ width: 164, height: 46 }}
          renderEdge={(edge) => {
            const isSelected =
              selectedKey === `${edge.sourceKey} → ${edge.targetKey}`;
            const connected = isConnected(
              String(edge.sourceKey),
              String(edge.targetKey),
            );
            return (
              <SvgPath
                pointerEvents="auto"
                onClick={() =>
                  selected.set(`${edge.sourceKey} → ${edge.targetKey}`)
                }
                style={{
                  d: edge.path,
                  stroke: isSelected
                    ? "#e66a3d"
                    : connected
                      ? "rgba(71, 125, 145, 0.58)"
                      : "rgba(71, 125, 145, 0.13)",
                  strokeWidth: isSelected ? 4 : connected ? 2.5 : 1.5,
                  lineInteractionWidth: 16,
                  fill: "transparent",
                }}
              />
            );
          }}
          renderLeftNode={(node) => {
            const isSelected = selectedPartner === String(node.key);
            return (
              <GraphNode
                node={node}
                style={{
                  fill: isSelected ? "#c9e6f3" : "#e4f0f6",
                  stroke: isSelected ? "#e66a3d" : "#6b9db4",
                  strokeWidth: isSelected ? 3 : 1,
                  cornerRadius: 8,
                }}
              >
                <Text
                  pointerEvents="none"
                  style={{
                    left: 14,
                    top: 10,
                    font: "700 13px sans-serif",
                    fill: "#285c78",
                  }}
                >
                  {node.label.text}
                </Text>
                <Text
                  pointerEvents="none"
                  style={{
                    left: 14,
                    top: 27,
                    font: "11px sans-serif",
                    fill: "#3f5d6b",
                  }}
                >
                  {`${partnerCount(String(node.key))} active ${partnerCount(String(node.key)) === 1 ? "study" : "studies"}`}
                </Text>
              </GraphNode>
            );
          }}
          renderRightNode={(node) => {
            const isSelected = selectedStudy === String(node.key);
            return (
              <GraphNode
                node={node}
                style={{
                  fill: isSelected ? "#ffe1c9" : "#fff0e5",
                  stroke: isSelected ? "#e66a3d" : "#d99769",
                  strokeWidth: isSelected ? 3 : 1,
                  cornerRadius: 8,
                }}
              >
                <Text
                  pointerEvents="none"
                  style={{
                    left: 14,
                    top: 10,
                    font: "700 13px sans-serif",
                    fill: "#914d2b",
                  }}
                >
                  {node.label.text}
                </Text>
                <Text
                  pointerEvents="none"
                  style={{
                    left: 14,
                    top: 27,
                    font: "11px sans-serif",
                    fill: "#70513f",
                  }}
                >
                  {`${studyCount(String(node.key))} community partners`}
                </Text>
              </GraphNode>
            );
          }}
          onEdgeClick={(edge) =>
            selected.set(`${edge.sourceKey} → ${edge.targetKey}`)
          }
          onLeftNodeClick={(node) => selected.set(`partner:${node.key}`)}
          onRightNodeClick={(node) => selected.set(`study:${node.key}`)}
        />
      </Group>
      <Rectangle
        onClick={() => selected.set(null)}
        style={{
          left: 32,
          top: 535,
          width: 836,
          height: 28,
          fill: selectedKey ? "#fff0e5" : "#edf1ec",
          cornerRadius: 5,
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 44,
          top: 542,
          font: "600 13px sans-serif",
          fill: "#765039",
        }}
      >
        {selectedEdge
          ? `${selectedEdge.source} and ${selectedEdge.target} · participation in the current cohort`
          : selectedPartner
            ? `${selectedPartner} · ${partnerCount(selectedPartner)} study tracks in the current cohort`
            : selectedStudy
              ? `${selectedStudy} · ${studyCount(selectedStudy)} community partners in the current cohort`
              : "Select an organization, study, or connecting line to inspect the network."}
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
