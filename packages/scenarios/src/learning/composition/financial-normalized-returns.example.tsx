import {
  Clip,
  FocusManagement,
  Group,
  Rectangle,
  Text,
  pibbl,
  useLayoutBox,
  useSignal,
  type PibblController,
  type PibblLogicalMouseEvent,
} from "@pibbl/core";
import {
  Axis,
  GridLines,
  LinearScale,
  LineSeries,
  ReferenceLine,
  ScaleAdjust,
  TradingTimeScale,
  formatNumber,
  indexTo100,
  padLinearDomain,
  percentageReturns,
} from "@pibbl/core/viz";
import {
  nearestRecordedX,
  useNumericInspection,
  withInspection,
} from "@pibbl/core/viz/inspection";

// Reproducible synthetic daily closes; this is price return, not a real market feed.
const baseTime = Date.UTC(2026, 0, 2, 16);
const calendar: number[] = [];
for (
  let time = baseTime;
  time <= Date.UTC(2026, 2, 20, 16);
  time += 86_400_000
) {
  const weekday = new Date(time).getUTCDay();
  if (weekday !== 0 && weekday !== 6) calendar.push(time);
}
let randomState = 73421;
function innovation() {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
  return randomState / 4294967296 - 0.5;
}
const marketMoves = calendar.map(
  (_, i) =>
    innovation() * 0.019 + (i === 19 ? -0.039 : i === 36 ? 0.027 : 0.0005),
);
function instrument(startingPrice: number, beta: number, volatility: number) {
  let close = startingPrice;
  return calendar.map((time, i) => {
    if (i !== 0)
      close *= Math.exp(
        0.0006 +
          beta * marketMoves[i]! +
          innovation() * volatility +
          (i === 28 && beta > 1 ? 0.042 : 0),
      );
    return { time, close };
  });
}
const northstar = instrument(84.35, 1.35, 0.022).map((row, i) => ({
  ...row,
  close: i === 32 ? null : row.close,
}));
const benchmark = instrument(412.68, 1, 0.004);
const unavailable = instrument(26.4, 0.8, 0.018).slice(35);
const comparison = { time: "time", value: "close", baseTime } as const;
const north = percentageReturns(northstar, comparison)!;
const bench = percentageReturns(benchmark, comparison)!;
const northIndex = indexTo100(northstar, comparison)!;
const benchIndex = indexTo100(benchmark, comparison)!;
const unavailableSeries = percentageReturns(unavailable, comparison);
const values = [...north, ...bench].flatMap((row) =>
  row.returnPercent === null ? [] : [row.returnPercent],
);
const domain = padLinearDomain(
  [Math.min(0, ...values), Math.max(0, ...values)],
  { padding: 0.15, minimumSpan: 5 },
);
const date = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});
const percent = (value: number | null | undefined) =>
  value == null
    ? "—"
    : formatNumber(value, {
        maximumFractionDigits: 1,
        minimumFractionDigits: 1,
        signDisplay: "exceptZero",
        suffix: "%",
      });
const money = (value: number | null | undefined) =>
  value == null
    ? "—"
    : formatNumber(value, {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
const indexed = (value: number | null | undefined) =>
  value == null
    ? "—"
    : formatNumber(value, {
        maximumFractionDigits: 1,
        minimumFractionDigits: 1,
      });
function Label({
  x,
  y,
  text,
  color = "#91a2ba",
  font = "10px sans-serif",
  align = "left",
}: {
  x: number;
  y: number;
  text: string;
  color?: string;
  font?: string;
  align?: CanvasTextAlign;
}) {
  return (
    <Text
      pointerEvents="none"
      style={{ left: x, top: y, font, fill: color, textAlign: align }}
    >
      {text}
    </Text>
  );
}
function Lesson() {
  const { width, height } = useLayoutBox();
  const narrow = width < 500;
  const selected = useSignal(calendar.at(-1)!);
  const index = calendar.indexOf(selected.get());
  const inspection = useNumericInspection({
    data: bench,
    x: "time",
    y: "returnPercent",
  });
  const left = 55,
    right = width - (narrow ? 20 : 142),
    top = 104,
    bottom = height - 47;
  const ticks = [
    0,
    Math.floor(calendar.length / 3),
    Math.floor((calendar.length * 2) / 3),
    calendar.length - 1,
  ].map((i) => calendar[i]!);
  const choose = withInspection((event: PibblLogicalMouseEvent, context) => {
    const rendered = context.rendered(inspection),
      domainX = rendered?.domainXAtRoot({ x: event.x, y: event.y });
    if (!rendered || domainX === undefined) return;
    const hit = context.request(nearestRecordedX, rendered, { domainX });
    if (hit) selected.set(hit.domainX);
  });
  const key = (event: { key: string; preventDefault(): void }) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    selected.set(
      calendar[
        Math.max(
          0,
          Math.min(
            calendar.length - 1,
            index + (event.key === "ArrowLeft" ? -1 : 1),
          ),
        )
      ]!,
    );
    event.preventDefault();
  };
  const clip = new Path2D();
  clip.rect(left, top, right - left, bottom - top);
  const axisStyle = {
    font: "10px sans-serif",
    fill: "#a3b3ca",
    stroke: "#50617a",
    strokeWidth: 0.7,
  };
  return (
    <>
      <Rectangle style={{ width, height, fill: "#0d1422" }} />
      <Label
        x={18}
        y={14}
        text="Normalized returns from a common base"
        color="#dbe6f1"
        font="bold 14px sans-serif"
      />
      <Label
        x={18}
        y={34}
        text={
          narrow
            ? "Simulated USD closes · dividends excluded"
            : `Simulated USD daily closes · ${calendar.length} observations · price return, dividends excluded`
        }
      />
      <Label
        x={18}
        y={51}
        text={`Base 02 Jan 2026 · inspecting ${date.format(selected.get())}`}
      />
      <Label
        x={18}
        y={68}
        text={`Northstar ${percent(north[index]?.returnPercent)}${narrow ? "" : ` · ${money(northstar[index]?.close)}`}`}
        color="#29c7ab"
      />
      <Label
        x={narrow ? 179 : 340}
        y={68}
        text={`Benchmark ${percent(bench[index]?.returnPercent)}${narrow ? "" : ` · ${money(benchmark[index]?.close)}`}`}
        color="#e6b766"
      />
      <Label
        x={18}
        y={84}
        text={`Index 100 · N ${indexed(northIndex[index]?.indexValue)} · B ${indexed(benchIndex[index]?.indexValue)}`}
        font="9px sans-serif"
      />
      <Label x={right} y={87} text="Price return (%)" align="right" />
      <TradingTimeScale
        id="time"
        timestamps={calendar}
        logicalRange={[-0.5, calendar.length - 0.5]}
        range={[left, right]}
      >
        <LinearScale id="returns" domain={domain} range={[bottom, top]}>
          <Rectangle
            pointerEvents="none"
            style={{
              left,
              top,
              width: right - left,
              height: bottom - top,
              fill: "#101a2b",
            }}
          />
          <GridLines
            scale="returns"
            direction="horizontal"
            span={[left, right]}
            tickCount={4}
            style={{ stroke: "#26354c", strokeWidth: 0.5 }}
          />
          <ReferenceLine
            scale="returns"
            direction="horizontal"
            value={0}
            span={[left, right]}
            style={{ stroke: "#71839e", strokeWidth: 0.8 }}
          />
          <Clip style={{ d: clip }}>
            <LineSeries
              data={north}
              x="time"
              y="returnPercent"
              xScale="time"
              yScale="returns"
              pointerEvents="none"
              style={{ stroke: "#29c7ab", strokeWidth: 2 }}
            />
            <LineSeries
              data={bench}
              x="time"
              y="returnPercent"
              xScale="time"
              yScale="returns"
              inspection={inspection}
              pointerEvents="none"
              style={{ stroke: "#e6b766", strokeWidth: 1.8 }}
            />
            <ReferenceLine
              scale="time"
              direction="vertical"
              value={selected.get()}
              span={[top, bottom]}
              style={{ stroke: "#dbe6f1", strokeWidth: 0.8 }}
            />
          </Clip>
          <Group style={{ translateX: left }}>
            <Axis
              scale="returns"
              position="left"
              tickCount={4}
              tickFormat={(value) =>
                formatNumber(value as number, {
                  maximumFractionDigits: 0,
                  suffix: "%",
                })
              }
              style={axisStyle}
            />
          </Group>
          {!narrow &&
            [
              { name: "Northstar", rows: north, color: "#29c7ab" },
              { name: "Benchmark", rows: bench, color: "#e6b766" },
            ].map((asset) => {
              const row = asset.rows.at(-1)!;
              return (
                <ScaleAdjust
                  key={asset.name}
                  xScale="time"
                  yScale="returns"
                  x={row.time!}
                  y={row.returnPercent!}
                >
                  <Label
                    x={12}
                    y={-4}
                    text={`${asset.name} ${percent(row.returnPercent)}`}
                    color={asset.color}
                  />
                </ScaleAdjust>
              );
            })}
          <Rectangle
            keyboardFocusable
            onMouseMove={choose}
            onClick={choose}
            onKeyDown={key}
            style={{
              left,
              top,
              width: right - left,
              height: bottom - top,
              fill: "transparent",
              cursor: "crosshair",
            }}
          />
        </LinearScale>
        <Group style={{ translateY: bottom - height }}>
          <Axis
            scale="time"
            position="bottom"
            tickValues={ticks}
            tickFormat={(value) => date.format(value as number)}
            labelOverlap="skip"
            labelGap={8}
            style={axisStyle}
          />
        </Group>
      </TradingTimeScale>
      <Label
        x={18}
        y={height - 13}
        text={
          unavailableSeries === undefined
            ? narrow
              ? "Orbit: base missing · Northstar: missing close"
              : "Unavailable: Orbit has no exact common base · Northstar has one missing close · dates UTC"
            : "Tap or arrows to inspect"
        }
        font={`${narrow ? 9 : 10}px sans-serif`}
      />
    </>
  );
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(
    canvas,
    <FocusManagement>
      <Lesson />
    </FocusManagement>,
    { viewport: "responsive" },
  );
}
