import {
  Absolute,
  Circle,
  Group,
  Line,
  Rectangle,
  Text,
  pibbl,
  signal,
  useLayoutBox,
  type PibblController,
  type WritableSignal,
} from "@pibbl/core";
import {
  Axis,
  CensoredPointSeries,
  GridLines,
  LinearScale,
  LogScale,
} from "@pibbl/core/viz";

type Result = {
  hour: number;
  concentration: number;
  reporting: "observed" | "below" | "above";
  sample: string;
};

// Invented training data only. The limits and values are supplied results; no
// sample, patient, medicine, substitution, or pharmacokinetic inference is real.
const results: readonly Result[] = [
  { sample: "PK-01", hour: 0.25, concentration: 0.5, reporting: "below" },
  { sample: "PK-02", hour: 0.5, concentration: 8.4, reporting: "observed" },
  { sample: "PK-03", hour: 1, concentration: 50, reporting: "above" },
  { sample: "PK-04", hour: 2, concentration: 31.6, reporting: "observed" },
  { sample: "PK-05", hour: 4, concentration: 12.8, reporting: "observed" },
  { sample: "PK-06", hour: 8, concentration: 3.9, reporting: "observed" },
  { sample: "PK-07", hour: 12, concentration: 1.1, reporting: "observed" },
  { sample: "PK-08", hour: 24, concentration: 0.5, reporting: "below" },
];

interface Fixture {
  readonly selected?: WritableSignal<string | null>;
}
const ink = "#203441",
  muted = "#627480",
  teal = "#087d83",
  amber = "#b45309";
function Label({
  x,
  y,
  children,
  size = 12,
  weight = 400,
  color = ink,
  align = "left",
}: {
  x: number;
  y: number;
  children: string;
  size?: number;
  weight?: number;
  color?: string;
  align?: CanvasTextAlign;
}) {
  return (
    <Text
      pointerEvents="none"
      style={{
        left: x,
        top: y,
        font: `${weight} ${size}px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif`,
        textAlign: align,
        textBaseline: "middle",
        fill: color,
      }}
    >
      {children}
    </Text>
  );
}
function Scene({ selected: supplied }: Fixture) {
  const { width, height } = useLayoutBox();
  const selected = supplied ?? signal<string | null>(null);
  const compact = width < 620;
  const left = compact ? 58 : 88,
    top = compact ? 208 : 184;
  const plotWidth = Math.max(200, width - left - (compact ? 26 : 56));
  const plotHeight = Math.max(220, height - top - 154);
  const current = results.find((result) => result.sample === selected.get());
  return (
    <Group>
      <Rectangle
        pointerEvents="none"
        style={{ width, height, fill: "#ffffff" }}
      />
      <Label x={24} y={22} size={10} weight={650} color={muted}>
        PHARMACOKINETICS · SYNTHETIC TRAINING DATA
      </Label>
      <Label x={24} y={55} size={compact ? 22 : 28} weight={650}>
        Censored concentration-time assay
      </Label>
      <Label x={24} y={84} color={muted}>
        {compact
          ? "Invented analyte · supplied assay reporting"
          : "Invented analyte · supplied assay reporting limits · no substituted values"}
      </Label>
      <Circle
        pointerEvents="none"
        style={{ cx: 30, cy: 116, radius: 4, fill: teal }}
      />
      <Label x={42} y={116} size={11}>
        Observed concentration
      </Label>
      <Line
        pointerEvents="none"
        style={{
          coords: [
            [180, 121],
            [180, 111],
            [174, 116],
            [186, 116],
          ],
          stroke: amber,
          strokeWidth: 1.6,
        }}
      />
      <Label x={194} y={116} size={11}>
        Below LLOQ
      </Label>
      <Line
        pointerEvents="none"
        style={{
          coords: [
            [306, 111],
            [306, 121],
            [300, 116],
            [312, 116],
          ],
          stroke: amber,
          strokeWidth: 1.6,
        }}
      />
      <Label x={320} y={116} size={11}>
        Above ULOQ
      </Label>
      <Rectangle
        pointerEvents="none"
        style={{
          left: 24,
          top: 140,
          width: Math.max(1, width - 48),
          height: 40,
          fill: "#f4f7f7",
          cornerRadius: 4,
        }}
      />
      <Label x={36} y={160} size={11} weight={550}>
        LLOQ 0.5 ng/mL · ULOQ 50 ng/mL · arrows preserve reporting limits
      </Label>
      <Label x={left} y={top - 15} size={11} weight={600}>
        Plasma concentration (ng/mL)
      </Label>
      <Absolute style={{ left, top, width: plotWidth, height: plotHeight }}>
        <LinearScale
          id="time"
          domain={[0, 24]}
          range={[0, plotWidth]}
          style={{ width: plotWidth, height: plotHeight }}
        >
          <LogScale
            id="concentration"
            domain={[0.25, 100]}
            range={[plotHeight, 0]}
          >
            <GridLines
              scale="concentration"
              direction="horizontal"
              tickValues={[0.5, 1, 10, 100]}
              span={[0, plotWidth]}
              style={{ stroke: "#e7edef", strokeWidth: 1 }}
            />
            <CensoredPointSeries
              data={results}
              x="hour"
              y="concentration"
              censoring="reporting"
              xScale="time"
              yScale="concentration"
              pointerEvents="none"
              style={{ radius: 5, fill: teal, stroke: amber, strokeWidth: 1.7 }}
            />
            {results.map((result) => {
              const x = (result.hour / 24) * plotWidth;
              const y =
                plotHeight -
                ((Math.log10(result.concentration) - Math.log10(0.25)) /
                  (Math.log10(100) - Math.log10(0.25))) *
                  plotHeight;
              return (
                <Circle
                  key={result.sample}
                  keyboardFocusable
                  onClick={() => selected.set(result.sample)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selected.set(result.sample);
                    }
                  }}
                  style={{
                    cx: x,
                    cy: y,
                    radius: 14,
                    fill: "transparent",
                    cursor: "pointer",
                  }}
                />
              );
            })}
            <Axis
              scale="concentration"
              position="left"
              tickValues={[0.5, 1, 10, 100]}
              style={{ font: "11px sans-serif" }}
            />
            <Axis
              scale="time"
              position="bottom"
              tickValues={[0, 1, 2, 4, 8, 12, 24]}
              style={{ font: "11px sans-serif" }}
            />
          </LogScale>
        </LinearScale>
      </Absolute>
      <Label x={left} y={top + plotHeight + 42} size={11} color={muted}>
        Nominal time after dose (hours)
      </Label>
      <Rectangle
        pointerEvents="none"
        style={{
          left: 24,
          top: top + plotHeight + 64,
          width: Math.max(1, width - 48),
          height: 48,
          fill: current ? "#e9f3f2" : "#f4f7f7",
          cornerRadius: 4,
        }}
      />
      <Label x={36} y={top + plotHeight + 83} size={11} weight={600}>
        {current
          ? `${current.sample} · ${current.reporting === "observed" ? `${current.concentration} ng/mL observed` : `${current.reporting === "below" ? "<" : ">"} ${current.concentration} ng/mL reporting limit`}`
          : "Select a mark to inspect its supplied result"}
      </Label>
      <Label x={36} y={top + plotHeight + 102} size={10} color={muted}>
        {current
          ? "The displayed limit is not imputed as an exact concentration."
          : "Click, tap, or focus a mark; use the table below for every supplied record."}
      </Label>
    </Group>
  );
}

export default function mount(
  canvas: HTMLCanvasElement,
  fixture: Fixture = {},
): PibblController {
  const selected = fixture.selected ?? signal<string | null>(null);
  const details = document.createElement("details");
  details.style.cssText =
    "padding:14px 24px;background:#fff;color:#203441;font:12px system-ui;overflow-x:auto";
  const summary = document.createElement("summary");
  summary.textContent = "View supplied assay records · synthetic data";
  const table = document.createElement("table");
  table.style.cssText =
    "width:100%;border-collapse:collapse;margin-top:12px;font-variant-numeric:tabular-nums";
  const caption = document.createElement("caption");
  caption.textContent =
    "Synthetic assay records. Below/above entries are reporting limits, not observed concentrations.";
  table.append(caption);
  const header = table.createTHead().insertRow();
  for (const title of [
    "Sample",
    "Time (h)",
    "Reported concentration",
    "Status",
  ]) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = title;
    header.append(cell);
  }
  const body = table.createTBody();
  for (const result of results) {
    const row = body.insertRow();
    const sample = document.createElement("th");
    sample.scope = "row";
    sample.textContent = result.sample;
    row.append(sample);
    row.insertCell().textContent = String(result.hour);
    row.insertCell().textContent =
      result.reporting === "observed"
        ? String(result.concentration)
        : `${result.reporting === "below" ? "<" : ">"} ${result.concentration}`;
    row.insertCell().textContent = result.reporting;
  }
  details.append(summary, table);
  canvas.after(details);
  try {
    const controller = pibbl(canvas, <Scene selected={selected} />, {
      viewport: "responsive",
    });
    let disposed = false;
    return {
      dispose() {
        if (disposed) return;
        disposed = true;
        controller.dispose();
        details.remove();
      },
    };
  } catch (error) {
    details.remove();
    throw error;
  }
}
