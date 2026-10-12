import {
  Absolute,
  Group,
  Line,
  Rectangle,
  Text,
  pibbl,
  signal,
  useLayoutBox,
  useReaction,
  type PibblController,
  type WritableSignal,
} from "@pibbl/core";
import {
  Axis,
  GridLines,
  HorizontalIntervalSeries,
  IntervalDiamondSeries,
  LinearScale,
  LogScale,
  PointScale,
  ReferenceLine,
  WeightedPointSeries,
} from "@pibbl/core/viz";

// Source: metadat dat.bcg (13 studies), retrieved 2026-10-12:
// https://wviechtb.github.io/metadat/reference/dat.bcg.html
// Static study RR and log-Wald 95% CI were prepared outside Pibbl from the source
// 2x2 counts: yi=log((a/(a+b))/(c/(c+d))), vi=1/a-1/(a+b)+1/c-1/(c+d).
// REML weight percentages were prepared using the source's rounded tau²=0.3132.
// Published predict(res,transf=exp) summary and prediction interval are copied
// separately below. No study weighting, pooling, or inference runs in this example.
const studies = [
  {
    study: "Aronson, 1948",
    index: 0,
    estimate: 0.410939,
    lower: 0.134302,
    upper: 1.257398,
    weight: 5.0593,
    vaccinated: "4/123",
    control: "11/139",
  },
  {
    study: "Ferguson & Simes, 1949",
    index: 1,
    estimate: 0.204868,
    lower: 0.086297,
    upper: 0.486352,
    weight: 6.3645,
    vaccinated: "6/306",
    control: "29/303",
  },
  {
    study: "Rosenthal et al, 1960",
    index: 2,
    estimate: 0.25974,
    lower: 0.073443,
    upper: 0.918609,
    weight: 4.4358,
    vaccinated: "3/231",
    control: "11/220",
  },
  {
    study: "Hart & Sutherland, 1977",
    index: 3,
    estimate: 0.236561,
    lower: 0.179281,
    upper: 0.312141,
    weight: 9.6989,
    vaccinated: "62/13598",
    control: "248/12867",
  },
  {
    study: "Frimodt-Moller et al, 1973",
    index: 4,
    estimate: 0.80449,
    lower: 0.516293,
    upper: 1.253558,
    weight: 8.8685,
    vaccinated: "33/5069",
    control: "47/5808",
  },
  {
    study: "Stein & Aronson, 1953",
    index: 5,
    estimate: 0.455611,
    lower: 0.387132,
    upper: 0.536203,
    weight: 10.096,
    vaccinated: "180/1541",
    control: "372/1451",
  },
  {
    study: "Vandiviere et al, 1973",
    index: 6,
    estimate: 0.197721,
    lower: 0.078357,
    upper: 0.498919,
    weight: 6.027,
    vaccinated: "8/2545",
    control: "10/629",
  },
  {
    study: "TPT Madras, 1980",
    index: 7,
    estimate: 1.012024,
    lower: 0.894572,
    upper: 1.144897,
    weight: 10.1897,
    vaccinated: "505/88391",
    control: "499/88391",
  },
  {
    study: "Coetzee & Berjak, 1968",
    index: 8,
    estimate: 0.625366,
    lower: 0.392576,
    upper: 0.996196,
    weight: 8.7432,
    vaccinated: "29/7499",
    control: "45/7277",
  },
  {
    study: "Rosenthal et al, 1961",
    index: 9,
    estimate: 0.253765,
    lower: 0.149421,
    upper: 0.430976,
    weight: 8.3676,
    vaccinated: "17/1716",
    control: "65/1665",
  },
  {
    study: "Comstock et al, 1974",
    index: 10,
    estimate: 0.712227,
    lower: 0.572514,
    upper: 0.886035,
    weight: 9.9252,
    vaccinated: "186/50634",
    control: "141/27338",
  },
  {
    study: "Comstock & Webster, 1969",
    index: 11,
    estimate: 1.561916,
    lower: 0.373689,
    upper: 6.528374,
    weight: 3.8214,
    vaccinated: "5/2498",
    control: "3/2341",
  },
  {
    study: "Comstock et al, 1976",
    index: 12,
    estimate: 0.982835,
    lower: 0.582137,
    upper: 1.659341,
    weight: 8.4029,
    vaccinated: "27/16913",
    control: "29/17854",
  },
];
const summary = [
  { study: "REML summary", estimate: 0.4894, lower: 0.3441, upper: 0.6962 },
];
const prediction = [
  { study: "REML summary", estimate: 0.4894, lower: 0.1546, upper: 1.549 },
];
const source = "https://wviechtb.github.io/metadat/reference/dat.bcg.html";
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
  align?: "left" | "right";
}) {
  return (
    <Text
      pointerEvents="none"
      style={{
        left: x,
        top: y,
        font: `${weight} ${size}px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif`,
        fill: color,
        textBaseline: "middle",
        textAlign: align,
      }}
    >
      {children}
    </Text>
  );
}
interface Fixture {
  readonly showPrediction?: WritableSignal<boolean>;
}
function Scene({
  canvas,
  showPrediction,
}: {
  canvas: HTMLCanvasElement;
  showPrediction: WritableSignal<boolean>;
}) {
  const { width } = useLayoutBox(),
    compact = width < 720;
  useReaction(() => {
    canvas.style.height = compact ? "1160px" : "830px";
    canvas.style.minHeight = canvas.style.height;
  }, [compact, canvas]);
  const left = compact ? 30 : 340,
    top = 180,
    rowHeight = compact ? 62 : 35;
  const plotWidth = Math.max(1, width - left - (compact ? 30 : 220)),
    plotHeight = studies.length * rowHeight;
  const summaryY = plotHeight + 42;
  return (
    <Group>
      <Rectangle
        pointerEvents="none"
        style={{ width, height: compact ? 1160 : 830, fill: "white" }}
      />
      <Label x={24} y={21} size={10} weight={600} color={muted}>
        PUBLISHED DATA · 13 STUDIES · 1948–1980
      </Label>
      <Label x={24} y={54} size={compact ? 19 : 28} weight={600}>
        BCG vaccine · evidence synthesis
      </Label>
      <Label x={24} y={84} size={11} color={muted}>
        {compact
          ? "Tuberculosis risk ratios · supplied 95% CIs"
          : "Tuberculosis risk ratios · study estimates, supplied REML weights, and 95% confidence intervals"}
      </Label>
      <Label x={24} y={112} size={compact ? 11 : 13} weight={600}>
        REML summary RR 0.49 · 95% CI 0.34–0.70
      </Label>
      <Label x={24} y={135} size={10} color={muted}>
        {compact
          ? "Source I² 92.22% · intervals have distinct meanings"
          : "Source I² 92.22% · study heterogeneity is substantial; confidence and prediction intervals differ"}
      </Label>
      {!compact && (
        <>
          <Label x={24} y={163} size={10} color={muted} weight={600}>
            STUDY
          </Label>
          <Label
            x={width - 24}
            y={163}
            size={10}
            color={muted}
            weight={600}
            align="right"
          >
            RR [95% CI] · WEIGHT
          </Label>
        </>
      )}
      {studies.map((row) => {
        const y = top + (row.index + 0.5) * rowHeight;
        return (
          <Group key={row.study}>
            <Line
              pointerEvents="none"
              style={{
                coords: [
                  [24, y + rowHeight / 2],
                  [width - 24, y + rowHeight / 2],
                ],
                stroke: "#edf1f2",
                strokeWidth: 1,
              }}
            />
            <Label
              x={24}
              y={compact ? y - 20 : y}
              size={compact ? 11 : 12}
              weight={500}
            >
              {row.study}
            </Label>
            <Label
              x={compact ? 24 : width - 24}
              y={compact ? y + 21 : y}
              size={compact ? 10 : 11}
              color={muted}
              align={compact ? "left" : "right"}
            >{`${row.estimate.toFixed(2)} [${row.lower.toFixed(2)}, ${row.upper.toFixed(2)}] · ${row.weight.toFixed(1)}%`}</Label>
          </Group>
        );
      })}
      <Absolute
        style={{ left, top, width: plotWidth, height: plotHeight + 94 }}
      >
        <PointScale
          id="studies"
          domain={studies.map((row) => row.study)}
          range={[rowHeight / 2, plotHeight - rowHeight / 2]}
          style={{ width: plotWidth, height: plotHeight + 94 }}
        >
          <PointScale
            id="summary"
            domain={["REML summary"]}
            range={[summaryY, summaryY]}
          >
            <LinearScale
              id="studyPositions"
              domain={[0, 12]}
              range={[rowHeight / 2, plotHeight - rowHeight / 2]}
            >
              <LogScale id="effect" domain={[0.04, 5]} range={[0, plotWidth]}>
                <GridLines
                  scale="effect"
                  direction="vertical"
                  tickValues={[0.1, 0.25, 0.5, 1, 2, 4]}
                  span={[0, summaryY + 12]}
                  style={{ stroke: "#f0f3f5", strokeWidth: 1 }}
                />
                <ReferenceLine
                  scale="effect"
                  direction="vertical"
                  value={1}
                  span={[0, summaryY + 12]}
                  style={{ stroke: "#9aadb5", strokeWidth: 1 }}
                />
                <HorizontalIntervalSeries
                  data={studies}
                  category="study"
                  estimate="estimate"
                  lower="lower"
                  upper="upper"
                  categoryScale="studies"
                  valueScale="effect"
                  pointerEvents="none"
                  style={{
                    radius: 0,
                    capSize: 6,
                    stroke: teal,
                    strokeWidth: 1.3,
                  }}
                />
                <WeightedPointSeries
                  data={studies}
                  x="estimate"
                  y="index"
                  weight="weight"
                  weightDomain={[0, 15]}
                  radiusRange={[0, 9]}
                  xScale="effect"
                  yScale="studyPositions"
                  pointerEvents="none"
                  style={{ fill: teal, stroke: "white", strokeWidth: 1 }}
                />
                {showPrediction.get() && (
                  <HorizontalIntervalSeries
                    data={prediction}
                    category="study"
                    estimate="estimate"
                    lower="lower"
                    upper="upper"
                    categoryScale="summary"
                    valueScale="effect"
                    pointerEvents="none"
                    style={{
                      radius: 0,
                      capSize: 14,
                      stroke: "#92a6af",
                      strokeWidth: 2,
                    }}
                  />
                )}
                <IntervalDiamondSeries
                  data={summary}
                  category="study"
                  estimate="estimate"
                  lower="lower"
                  upper="upper"
                  categoryScale="summary"
                  valueScale="effect"
                  pointerEvents="none"
                  style={{ height: 16, fill: teal, stroke: teal }}
                />
                <Group
                  style={{ translateY: summaryY + 18 - (plotHeight + 94) }}
                >
                  <Axis
                    scale="effect"
                    position="bottom"
                    tickValues={[0.1, 0.25, 0.5, 1, 2, 4]}
                    tickFormat={(value) => String(value)}
                    style={{ font: "10px sans-serif" }}
                  />
                </Group>
              </LogScale>
            </LinearScale>
          </PointScale>
        </PointScale>
      </Absolute>
      <Label
        x={24}
        y={top + summaryY - (compact ? 21 : 0)}
        size={11}
        weight={600}
      >
        REML summary · 13 studies
      </Label>
      <Label
        x={compact ? width - 24 : width - 24}
        y={top + summaryY + (compact ? 22 : 0)}
        size={11}
        weight={600}
        align="right"
      >
        0.49 [0.34, 0.70]
      </Label>
      <Label x={24} y={top + summaryY + 76} size={10} color={muted}>
        Risk ratio · log axis · null = 1 · circle area = supplied weight
      </Label>
      <Label x={24} y={top + summaryY + 99} size={10} color={muted}>
        {showPrediction.get()
          ? "Grey span: supplied 95% prediction interval 0.15–1.55"
          : "Diamond: supplied 95% CI for the mean effect"}
      </Label>
      <Label x={24} y={top + summaryY + 122} size={10} color={muted}>
        Historical teaching analysis · no inference performed by Pibbl
      </Label>
    </Group>
  );
}
const mounts = new WeakMap<HTMLCanvasElement, PibblController>();
export default function mount(
  canvas: HTMLCanvasElement,
  fixture: Fixture = {},
): PibblController {
  mounts.get(canvas)?.dispose();
  const showPrediction = fixture.showPrediction ?? signal(false);
  const oldHeight = canvas.style.height,
    oldMin = canvas.style.minHeight,
    host = canvas.parentElement,
    oldOverflow = host?.style.overflow,
    oldDisplay = host?.style.display;
  canvas.style.height =
    canvas.clientWidth > 0 && canvas.clientWidth < 720 ? "1160px" : "830px";
  canvas.style.minHeight = canvas.style.height;
  if (host) {
    host.style.overflow = "auto";
    host.style.display = "block";
  }
  const controls = document.createElement("div");
  controls.style.cssText =
    "padding:12px 24px;background:white;font:12px system-ui;color:#203441";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = showPrediction.get();
  checkbox.onchange = () => showPrediction.set(checkbox.checked);
  const label = document.createElement("label");
  label.style.cssText =
    "display:flex;align-items:center;gap:8px;min-height:44px";
  label.append(checkbox, "Show supplied prediction interval");
  controls.append(label);
  const details = document.createElement("details");
  details.style.cssText =
    "padding:12px 24px;background:white;overflow-x:auto;font:12px system-ui;color:#203441";
  const title = document.createElement("summary");
  title.textContent = "Study results, source counts, and analysis provenance";
  const link = document.createElement("a");
  link.href = source;
  link.textContent = "Source: metadat dat.bcg and published REML output";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  const note = document.createElement("p");
  note.textContent =
    "Colditz et al. (1994), via metadat. Study log-Wald intervals prepared offline from source counts. Weight percentages use rounded published tau² 0.3132; the summary and prediction interval are copied separately from the published REML example. No current treatment recommendation is implied.";
  const table = document.createElement("table");
  table.style.cssText =
    "border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums";
  const header = table.createTHead().insertRow();
  for (const text of [
    "Study",
    "RR",
    "95% CI",
    "Weight (%)",
    "Vaccinated TB+/total",
    "Control TB+/total",
  ]) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = text;
    header.append(cell);
  }
  const body = table.createTBody();
  for (const row of [
    ...studies,
    { ...summary[0], weight: 100, vaccinated: "—", control: "—" },
  ]) {
    const tr = body.insertRow();
    const name = document.createElement("th");
    name.scope = "row";
    name.textContent = row.study;
    tr.append(name);
    for (const value of [
      row.estimate.toFixed(4),
      `${row.lower.toFixed(4)}–${row.upper.toFixed(4)}`,
      row.weight.toFixed(2),
      row.vaccinated,
      row.control,
    ])
      tr.insertCell().textContent = value;
  }
  for (const cell of table.querySelectorAll("td,th"))
    (cell as HTMLElement).style.cssText =
      "padding:8px 12px;border-bottom:1px solid #e7edef;text-align:left;white-space:nowrap";
  details.append(title, note, link, table);
  canvas.after(controls, details);
  function restore() {
    canvas.style.height = oldHeight;
    canvas.style.minHeight = oldMin;
    if (host) {
      host.style.overflow = oldOverflow ?? "";
      host.style.display = oldDisplay ?? "";
    }
  }
  try {
    const controller = pibbl(
      canvas,
      <Scene canvas={canvas} showPrediction={showPrediction} />,
      { viewport: "responsive" },
    );
    let disposed = false;
    const owned = {
      dispose() {
        if (disposed) return;
        disposed = true;
        mounts.delete(canvas);
        try {
          controller.dispose();
        } finally {
          controls.remove();
          details.remove();
          restore();
        }
      },
    };
    mounts.set(canvas, owned);
    return owned;
  } catch (error) {
    controls.remove();
    details.remove();
    restore();
    throw error;
  }
}
