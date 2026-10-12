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
  useSignal,
  type PibblController,
  type WritableSignal,
} from "@pibbl/core";
import {
  Axis,
  GridLines,
  IntervalBandSeries,
  LinearScale,
  LineSeries,
  LogScale,
  PointSeries,
} from "@pibbl/core/viz";

// Invented teaching data. Observations and predictions are supplied separately;
// Pibbl performs no fitting, interval calculation, or clinical inference.
const observations = [
  { dose: 0, response: 4 },
  { dose: 1, response: 9 },
  { dose: 3, response: 18 },
  { dose: 10, response: 39 },
  { dose: 30, response: 62 },
  { dose: 100, response: 79 },
  { dose: 300, response: 86 },
];
const predictions = [
  { dose: 1, estimate: 8, lower: 3, upper: 13 },
  { dose: 2, estimate: 13, lower: 7, upper: 19 },
  { dose: 3, estimate: 18, lower: 12, upper: 24 },
  { dose: 5, estimate: 26, lower: 19, upper: 33 },
  { dose: 10, estimate: 39, lower: 31, upper: 47 },
  { dose: 20, estimate: 53, lower: 45, upper: 61 },
  { dose: 30, estimate: 62, lower: 54, upper: 70 },
  { dose: 50, estimate: 71, lower: 64, upper: 78 },
  { dose: 100, estimate: 80, lower: 73, upper: 87 },
  { dose: 200, estimate: 85, lower: 78, upper: 92 },
  { dose: 300, estimate: 87, lower: 79, upper: 95 },
];
interface DoseResponseFixture {
  readonly showBand?: WritableSignal<boolean>;
}
const ink = "#203441",
  muted = "#627480",
  teal = "#087d83";
function Label({
  x,
  y,
  children,
  size = 12,
  weight = 400,
  color = ink,
}: {
  x: number;
  y: number;
  children: string;
  size?: number;
  weight?: number;
  color?: string;
}) {
  return (
    <Text
      pointerEvents="none"
      style={{
        left: x,
        top: y,
        font: `${weight} ${size}px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif`,
        textBaseline: "middle",
        fill: color,
      }}
    >
      {children}
    </Text>
  );
}
function Scene({ showBand }: { showBand?: WritableSignal<boolean> }) {
  const { width, height } = useLayoutBox();
  const localBand = useSignal(true);
  const band = (showBand ?? localBand).get();
  const compact = width < 620;
  const left = compact ? 54 : 80,
    top = compact ? 196 : 172;
  const plotWidth = Math.max(1, width - left - (compact ? 24 : 56));
  const plotHeight = Math.max(140, height - top - 150);
  return (
    <Group>
      <Rectangle
        pointerEvents="none"
        style={{ width, height, fill: "white" }}
      />
      <Label x={24} y={22} size={10} weight={600} color={muted}>
        PHARMACEUTICAL RESEARCH · SYNTHETIC DATA
      </Label>
      <Label x={24} y={55} size={compact ? 23 : 28} weight={600}>
        Dose–response profile
      </Label>
      <Label x={24} y={84} color={muted}>
        {compact
          ? "Invented Drug A · week 4 response"
          : "Invented Drug A · week 4 response · externally supplied model results"}
      </Label>
      <Circle
        pointerEvents="none"
        style={{
          cx: 30,
          cy: 115,
          radius: 4,
          fill: "white",
          stroke: ink,
          strokeWidth: 1.5,
        }}
      />
      <Label x={42} y={115} size={11}>
        Observed
      </Label>
      <Line
        pointerEvents="none"
        style={{
          coords: [
            [126, 115],
            [146, 115],
          ],
          stroke: teal,
          strokeWidth: 2,
        }}
      />
      <Label x={154} y={115} size={11}>
        Supplied prediction
      </Label>
      <Label
        x={24}
        y={compact ? 145 : 141}
        size={compact ? 10 : 11}
        color={muted}
      >
        Supplied 95% confidence band for mean response
      </Label>
      <Label x={left} y={top - 15} size={11} weight={600}>
        Response (%)
      </Label>
      <Absolute style={{ left, top, width: plotWidth, height: plotHeight }}>
        <LogScale
          id="dose"
          domain={[1, 300]}
          range={[0, plotWidth]}
          style={{ width: plotWidth, height: plotHeight }}
        >
          <LinearScale id="response" domain={[0, 100]} range={[plotHeight, 0]}>
            <GridLines
              scale="response"
              direction="horizontal"
              tickValues={[0, 25, 50, 75, 100]}
              span={[0, plotWidth]}
              style={{ stroke: "#e9eef0", strokeWidth: 1 }}
            />
            {band && (
              <IntervalBandSeries
                data={predictions}
                x="dose"
                lower="lower"
                upper="upper"
                xScale="dose"
                yScale="response"
                pointerEvents="none"
                style={{ fill: "#d8eeeb" }}
              />
            )}
            <LineSeries
              data={predictions}
              x="dose"
              y="estimate"
              xScale="dose"
              yScale="response"
              pointerEvents="none"
              style={{ stroke: teal, strokeWidth: 2 }}
            />
            <PointSeries
              data={observations}
              defined={(d) => d.dose > 0}
              x="dose"
              y="response"
              xScale="dose"
              yScale="response"
              pointerEvents="none"
              style={{
                radius: 4.5,
                fill: "white",
                stroke: ink,
                strokeWidth: 1.5,
              }}
            />
            <Axis
              scale="response"
              position="left"
              tickValues={[0, 25, 50, 75, 100]}
              style={{ font: "11px sans-serif" }}
            />
            <Axis
              scale="dose"
              position="bottom"
              tickValues={[1, 3, 10, 30, 100, 300]}
              style={{ font: "11px sans-serif" }}
            />
          </LinearScale>
        </LogScale>
      </Absolute>
      <Label x={left} y={top + plotHeight + 44} size={11} color={muted}>
        Dose (mg) · logarithmic axis
      </Label>
      <Rectangle
        pointerEvents="none"
        style={{
          left: 24,
          top: top + plotHeight + 64,
          width: Math.max(1, width - 48),
          height: 44,
          fill: "#f2f6f6",
          cornerRadius: 4,
        }}
      />
      <Label x={36} y={top + plotHeight + 85} size={11} weight={500}>
        0 mg control · observed response 4%
      </Label>
      <Label x={24} y={top + plotHeight + 127} size={10} color={muted}>
        {compact
          ? "Control excluded from log axis · no inference"
          : "Zero-dose control is separate from the log axis. Synthetic teaching data; no inference performed."}
      </Label>
    </Group>
  );
}
export default function mount(
  canvas: HTMLCanvasElement,
  fixture: DoseResponseFixture = {},
): PibblController {
  const showBand = fixture.showBand ?? signal(true);
  const controls = document.createElement("div");
  controls.style.cssText =
    "padding:12px 24px;background:white;color:#203441;font:13px system-ui";
  const label = document.createElement("label"),
    checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = showBand.get();
  checkbox.onchange = () => showBand.set(checkbox.checked);
  label.append(checkbox, " Show supplied confidence band");
  controls.append(label);
  const details = document.createElement("details");
  details.style.cssText =
    "padding:12px 24px;background:white;color:#203441;font:12px system-ui;overflow-x:auto";
  const summary = document.createElement("summary");
  summary.textContent = "View observed doses and supplied predictions";
  const table = document.createElement("table");
  table.style.cssText =
    "width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;margin-top:12px";
  const caption = document.createElement("caption");
  caption.textContent =
    "Synthetic observations, including the separate zero-dose control";
  table.append(caption);
  const header = table.createTHead().insertRow();
  for (const title of ["Dose (mg)", "Observed response (%)"]) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = title;
    header.append(cell);
  }
  const body = table.createTBody();
  for (const datum of observations) {
    const row = body.insertRow();
    const cell = document.createElement("th");
    cell.scope = "row";
    cell.textContent = String(datum.dose);
    row.append(cell);
    row.insertCell().textContent = String(datum.response);
  }
  const supplied = document.createElement("pre");
  supplied.style.cssText = "line-height:1.6;font-size:11px";
  supplied.textContent =
    "Supplied predictions · mean response and 95% CI (%)\nDose (mg)   Mean   Lower   Upper\n" +
    predictions
      .map(
        (d) =>
          `${String(d.dose).padEnd(12)}${String(d.estimate).padEnd(7)}${String(d.lower).padEnd(8)}${d.upper}`,
      )
      .join("\n");
  details.append(summary, table, supplied);
  canvas.after(controls, details);
  try {
    const controller = pibbl(canvas, <Scene showBand={showBand} />, {
      viewport: "responsive",
    });
    let disposed = false;
    return {
      dispose() {
        if (disposed) return;
        disposed = true;
        controller.dispose();
        controls.remove();
        details.remove();
      },
    };
  } catch (error) {
    controls.remove();
    details.remove();
    throw error;
  }
}
