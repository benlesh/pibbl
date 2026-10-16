import {
  FocusManagement,
  Group,
  Rectangle,
  Text,
  pibbl,
  useSignal,
  type PibblController,
} from "@pibbl/core";
import { AdjacencyMatrix, GraphLabel, MatrixCell } from "@pibbl/core/viz";

const teams = [
  "Research",
  "Product",
  "Design",
  "Platform",
  "App team",
  "Support",
].map((id) => ({ id }));

// Illustrative weekly request handoffs from a product organization.
const handoffs = [
  { source: "Research", target: "Product", count: 42 },
  { source: "Research", target: "Design", count: 25 },
  { source: "Research", target: "App team", count: 8 },
  { source: "Product", target: "Research", count: 14 },
  { source: "Product", target: "Design", count: 37 },
  { source: "Product", target: "Platform", count: 11 },
  { source: "Product", target: "App team", count: 33 },
  { source: "Design", target: "Product", count: 22 },
  { source: "Design", target: "App team", count: 46 },
  { source: "Design", target: "Support", count: 9 },
  { source: "Platform", target: "App team", count: 39 },
  { source: "Platform", target: "Support", count: 18 },
  { source: "Platform", target: "Product", count: 7 },
  { source: "App team", target: "Platform", count: 31 },
  { source: "App team", target: "Support", count: 44 },
  { source: "App team", target: "Design", count: 13 },
  { source: "Support", target: "App team", count: 28 },
  { source: "Support", target: "Product", count: 16 },
  { source: "Support", target: "Research", count: 6 },
];

function handoffTone(value: number | null) {
  if (value === null) return { fill: "#e9eee8", label: "#6b756d" };
  if (value <= 10) return { fill: "#d3e3de", label: "#173f3b" };
  if (value <= 22) return { fill: "#9fc4bb", label: "#173f3b" };
  if (value <= 32) return { fill: "#286e68", label: "#ffffff" };
  if (value <= 40) return { fill: "#185a58", label: "#ffffff" };
  return { fill: "#0c4749", label: "#ffffff" };
}

function Scene() {
  const selected = useSignal<string | null>(null);
  const selectedKey = selected.get();
  const activeHandoff = handoffs.find(
    (handoff) => `${handoff.source} → ${handoff.target}` === selectedKey,
  );
  const reverseHandoff = activeHandoff
    ? handoffs.find(
        (handoff) =>
          handoff.source === activeHandoff.target &&
          handoff.target === activeHandoff.source,
      )
    : undefined;
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
        Product delivery handoffs
      </Text>
      <Text
        pointerEvents="none"
        style={{ left: 32, top: 58, font: "14px sans-serif", fill: "#59635d" }}
      >
        Weekly requests passed between six teams · blank cells mean no recorded
        handoff
      </Text>
      <Text
        pointerEvents="none"
        style={{
          left: 32,
          top: 86,
          font: "600 12px sans-serif",
          fill: "#49706a",
        }}
      >
        449 handoffs · busiest route: Design → App team (46) · pale to dark =
        low to high
      </Text>
      <Text
        pointerEvents="none"
        style={{
          left: 190,
          top: 108,
          font: "700 11px sans-serif",
          fill: "#6b756d",
        }}
      >
        TO TEAM →
      </Text>
      <Text
        pointerEvents="none"
        style={{
          left: 33,
          top: 150,
          font: "700 11px sans-serif",
          fill: "#6b756d",
        }}
      >
        FROM TEAM
      </Text>
      <Group style={{ translateX: 190, translateY: 124 }}>
        <AdjacencyMatrix
          data={{ rows: teams, columns: teams, relations: handoffs }}
          rowKey="id"
          columnKey="id"
          source="source"
          target="target"
          value="count"
          unit="handoffs"
          rowLabel="id"
          columnLabel="id"
          formatValue={(value) => String(value)}
          style={{
            width: 650,
            height: 390,
            rowLabelWidth: 128,
            columnLabelHeight: 54,
            cellGap: 4,
          }}
          renderCell={(cell) => {
            const isSelected =
              selectedKey === `${cell.rowKey} → ${cell.columnKey}`;
            const tone = handoffTone(cell.value);
            return (
              <Group>
                <MatrixCell
                  cell={cell}
                  style={{
                    fill: tone.fill,
                    cornerRadius: 5,
                    stroke: isSelected ? "#f4b942" : "rgba(255,255,255,0.8)",
                    strokeWidth: isSelected ? 3 : 1,
                  }}
                />
                {cell.label && (
                  <GraphLabel
                    label={cell.label}
                    style={{
                      fill: tone.label,
                      font: "700 13px sans-serif",
                      textAlign: "center",
                    }}
                  />
                )}
              </Group>
            );
          }}
          onCellClick={(cell) =>
            selected.set(`${cell.rowKey} → ${cell.columnKey}`)
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
          fill: selectedKey ? "#e0f0e9" : "#edf1ec",
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
        {selectedKey
          ? activeHandoff
            ? `${selectedKey} · ${activeHandoff.count} requests${reverseHandoff ? ` · reverse: ${reverseHandoff.count}` : " · no recorded reverse"}`
            : `${selectedKey} · no recorded handoff this week`
          : "Select a colored cell to inspect a directed handoff."}
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
