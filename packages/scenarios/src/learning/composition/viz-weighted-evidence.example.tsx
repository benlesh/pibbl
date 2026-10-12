import {
  Absolute,
  Group,
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
  GridLines,
  LinearScale,
  LineSeries,
  WeightedPointSeries,
} from "@pibbl/core/viz";

interface EvidencePoint {
  readonly dose: number;
  readonly response: number;
  readonly precision: number;
  readonly label: string;
}

// Deterministic teaching data. Values and precision weights are supplied by the
// application; Pibbl does not fit this curve or calculate uncertainty.
const observations: readonly EvidencePoint[] = [
  { dose: 0.1, response: 7, precision: 18, label: "Run 01" },
  { dose: 0.25, response: 18, precision: 42, label: "Run 02" },
  { dose: 0.5, response: 31, precision: 63, label: "Run 03" },
  { dose: 1, response: 54, precision: 100, label: "Run 04" },
  { dose: 2, response: 70, precision: 78, label: "Run 05" },
  { dose: 4, response: 83, precision: 50, label: "Run 06" },
  { dose: 8, response: 89, precision: 26, label: "Run 07" },
];
const suppliedTrend = [
  { dose: 0, response: 2 },
  { dose: 0.5, response: 29 },
  { dose: 1, response: 52 },
  { dose: 2, response: 71 },
  { dose: 4, response: 83 },
  { dose: 8, response: 90 },
];
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
        fill: color,
        font: `${weight} ${size}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
        textAlign: align,
        textBaseline: "middle",
      }}
    >
      {children}
    </Text>
  );
}

function Scene({ selected }: { selected: WritableSignal<string | null> }) {
  const box = useLayoutBox();
  const compact = box.width < 610;
  const left = compact ? 48 : 220;
  const top = 168;
  const width = Math.max(230, box.width - left - 52);
  const height = 270;
  const active = observations.find((point) => point.label === selected.get());
  return (
    <Group>
      <Rectangle
        pointerEvents="none"
        style={{ width: box.width, height: box.height, fill: "#ffffff" }}
      />
      <Label x={compact ? 20 : 36} y={20} size={9} weight={600} color={muted}>
        PHARMACEUTICAL RESEARCH
      </Label>
      <Label x={compact ? 20 : 36} y={49} size={compact ? 23 : 28} weight={600}>
        Weighted dose-response evidence
      </Label>
      <Label x={compact ? 20 : 36} y={80} color={muted}>
        Synthetic cell-assay observations · target inhibition at 24 h
      </Label>
      <Label x={compact ? 20 : 36} y={103} size={11} color={muted}>
        Point area represents an externally supplied precision weight; no
        fitting or inference performed.
      </Label>
      {!compact && (
        <>
          <Label x={36} y={157} size={10} weight={600} color={muted}>
            OBSERVATION
          </Label>
          <Label
            x={172}
            y={157}
            size={10}
            weight={600}
            color={muted}
            align="right"
          >
            WEIGHT
          </Label>
        </>
      )}
      <Absolute>
        <LinearScale
          id="dose"
          domain={[0, 8]}
          range="width"
          style={{ left, top, width, height }}
        >
          <LinearScale id="response" domain={[0, 100]} range="height" reverse>
            <GridLines
              scale="response"
              direction="horizontal"
              span={[0, width]}
              tickValues={[0, 25, 50, 75, 100]}
              style={{ stroke: "#edf2f3", strokeWidth: 1 }}
            />
            <LineSeries
              data={suppliedTrend}
              x="dose"
              y="response"
              xScale="dose"
              yScale="response"
              pointerEvents="none"
              style={{ stroke: "#9cc4c0", strokeWidth: 2 }}
            />
            <WeightedPointSeries
              data={observations}
              x="dose"
              y="response"
              weight="precision"
              xScale="dose"
              yScale="response"
              weightDomain={[0, 100]}
              radiusRange={[0, 13]}
              onClick={() => {}}
              style={{
                fill: teal,
                stroke: "#04575b",
                strokeWidth: 1.25,
                cursor: "pointer",
              }}
            />
            <Axis
              scale="dose"
              position="bottom"
              tickValues={[0, 1, 2, 4, 8]}
              style={{
                fill: muted,
                stroke: "#a6bab5",
                font: "11px -apple-system, BlinkMacSystemFont, sans-serif",
              }}
            />
            <Axis
              scale="response"
              position="left"
              tickValues={[0, 25, 50, 75, 100]}
              style={{
                fill: muted,
                stroke: "#a6bab5",
                font: "11px -apple-system, BlinkMacSystemFont, sans-serif",
              }}
            />
          </LinearScale>
        </LinearScale>
      </Absolute>
      <Label
        x={left + width / 2}
        y={top + height + 46}
        color={muted}
        align="center"
      >
        Compound concentration (µM)
      </Label>
      <Label x={left - 18} y={top - 18} color={muted} size={11}>
        Inhibition (%)
      </Label>
      {!compact &&
        observations.map((point, index) => (
          <Group key={point.label}>
            <Rectangle
              onClick={() => selected.set(point.label)}
              style={{
                left: 28,
                top: top + index * 39 - 15,
                width: 158,
                height: 34,
                fill: selected.get() === point.label ? "#e9f3f2" : "#ffffff",
                cursor: "pointer",
                cornerRadius: 4,
              }}
            />
            <Label
              x={40}
              y={top + index * 39 + 2}
              size={12}
              weight={selected.get() === point.label ? 600 : 400}
            >
              {point.label}
            </Label>
            <Label
              x={172}
              y={top + index * 39 + 2}
              size={11}
              color={muted}
              align="right"
            >
              {String(point.precision)}
            </Label>
          </Group>
        ))}
      <Rectangle
        pointerEvents="none"
        style={{
          left: compact ? 20 : 36,
          top: top + height + 70,
          width: box.width - (compact ? 40 : 72),
          height: 54,
          fill: "#f4f7f8",
          cornerRadius: 4,
        }}
      />
      <Label
        x={compact ? 32 : 50}
        y={top + height + 90}
        weight={500}
        color={teal}
      >
        {active
          ? `${active.label}: ${active.response}% inhibition at ${active.dose} µM`
          : "Inspect an observation"}
      </Label>
      <Label
        x={compact ? 32 : 50}
        y={top + height + 111}
        size={11}
        color={muted}
      >
        {active
          ? `Supplied precision weight: ${active.precision} / 100`
          : "Click a row in the data table to view its supplied values."}
      </Label>
      <Label
        x={compact ? 20 : 36}
        y={top + height + 150}
        size={10}
        color={muted}
      >
        Synthetic teaching data · trend line supplied by the application ·
        marker area encodes supplied weight.
      </Label>
    </Group>
  );
}

const mounts = new WeakMap<HTMLCanvasElement, PibblController>();

export default function mount(canvas: HTMLCanvasElement): PibblController {
  mounts.get(canvas)?.dispose();
  const selected = signal<string | null>(null);
  const oldHeight = canvas.style.height;
  const host = canvas.parentElement;
  const oldOverflow = host?.style.overflow;
  canvas.style.height = "640px";
  if (host) host.style.overflow = "auto";
  const details = document.createElement("details");
  details.style.cssText =
    "padding:16px 28px;overflow-x:auto;font:12px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:white;color:#203441;border-top:1px solid #e7edef";
  const summary = document.createElement("summary");
  summary.textContent = "View synthetic assay observations";
  summary.style.cssText =
    "cursor:pointer;font-weight:500;padding:8px 0;color:#087d83";
  details.append(summary);
  const table = document.createElement("table");
  table.style.cssText =
    "width:100%;border-collapse:collapse;text-align:left;margin-top:12px;font-variant-numeric:tabular-nums";
  const head = table.createTHead().insertRow();
  for (const title of [
    "Observation",
    "Concentration (µM)",
    "Inhibition (%)",
    "Supplied weight",
    "Inspect",
  ]) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = title;
    cell.style.cssText =
      "padding:10px 12px;border-bottom:1px solid #cedadd;font-size:10px;color:#627480";
    head.append(cell);
  }
  const body = table.createTBody();
  for (const point of observations) {
    const row = body.insertRow();
    for (const value of [
      point.label,
      String(point.dose),
      String(point.response),
      String(point.precision),
    ]) {
      const cell = row.insertCell();
      cell.textContent = value;
      cell.style.cssText = "padding:10px 12px;border-bottom:1px solid #e7edef";
    }
    const button = document.createElement("button");
    button.textContent = `Inspect ${point.label}`;
    button.onclick = () => selected.set(point.label);
    const cell = row.insertCell();
    cell.append(button);
  }
  details.append(table);
  canvas.insertAdjacentElement("afterend", details);
  let disposed = false;
  try {
    const controller = pibbl(canvas, <Scene selected={selected} />, {
      pixelRatio: 1,
    });
    const wrapped = {
      dispose() {
        if (disposed) return;
        disposed = true;
        controller.dispose();
        details.remove();
        canvas.style.height = oldHeight;
        if (host) host.style.overflow = oldOverflow ?? "";
        mounts.delete(canvas);
      },
    };
    mounts.set(canvas, wrapped);
    return wrapped;
  } catch (error) {
    details.remove();
    canvas.style.height = oldHeight;
    if (host) host.style.overflow = oldOverflow ?? "";
    throw error;
  }
}
