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
  BarScale,
  BarSeries,
  GridLines,
  LinearScale,
  LineSeries,
  PointSeries,
  defineSeries,
  linearInterpolation,
} from "@pibbl/core/viz";
import {
  useNumericInspection,
  usePointInspection,
  useBarInspection,
  nearestRecordedX,
  nearestRecordedPoint,
  sampleRecordedX,
  paintedPointAt,
  paintedBarAt,
  withInspection,
} from "@pibbl/core/viz/inspection";

// Deterministic simulation, not market observations or investment forecasts.
const simulatedPrices = Array.from({ length: 25 }, (_, time) => ({
  time,
  price: 100 + time * 0.22 + Math.sin(time * 0.64) * 2.4,
  instrument: "SIM",
}));
const prices = defineSeries({ data: simulatedPrices, x: "time", y: "price" });
const executions = defineSeries({
  data: [
    { time: 8, price: 100.4, name: "Early" },
    { time: 8.4, price: 100.5, name: "Late" },
  ],
  x: "time",
  y: "price",
});
const risk = {
  data: [
    { desk: "Rates", low: -4, high: 7 },
    { desk: "Credit", low: -2, high: 5 },
    { desk: "FX", low: -6, high: 3 },
  ],
  category: "desk",
  valueStart: "low",
  valueEnd: "high",
} as const;
const interpolate = linearInterpolation();
const ink = "#173a35",
  muted = "#5c726a",
  teal = "#147b68",
  coral = "#c66348";

/** Semantic state emitted by the same public showcase used in Studio. */
interface WorkbenchEvidence {
  /** Selected original source row, or null for an estimate/empty state. */
  sourceIndex: number | null;
  /** Captured recorded price, or null. */
  recorded: number | null;
  /** Explicitly interpolated price, or null. */
  estimate: number | null;
  /** Nearest execution identity, independently of paint order. */
  nearestMark: string | null;
  /** Topmost execution identity covering the selected point. */
  paintedMark: string | null;
  /** Selected categorical risk desk, or null. */
  desk: string | null;
  /** Whether an equal repeated nearest-x request returned the same result object. */
  memoized: boolean;
}

function Label({
  x,
  y,
  text,
  size = 12,
  color = ink,
}: {
  x: number;
  y: number;
  text: string;
  size?: number;
  color?: string;
}) {
  return (
    <Text
      pointerEvents="none"
      style={{
        left: x,
        top: y,
        font: `${size}px sans-serif`,
        fill: color,
        textBaseline: "alphabetic",
      }}
    >
      {text}
    </Text>
  );
}

function PricePlot({
  width,
  height,
  compact,
  onEvidence,
}: {
  width: number;
  height: number;
  compact: boolean;
  onEvidence: (e: Partial<WorkbenchEvidence>) => void;
}) {
  const line = useNumericInspection(prices),
    points = usePointInspection(executions);
  const readout = useSignal("Select time · tap, click or use ← →");
  const markReadout = useSignal(
    "Executions: nearest center ≠ painted identity",
  );
  const cursor = useSignal(12);
  const inspect = (
    context: Parameters<Parameters<typeof withInspection>[0]>[1],
    domainX: number | undefined,
    rootPoint?: { x: number; y: number },
  ) => {
    const rendered = context.rendered(line);
    if (!rendered) return;
    const options = { domainX, maxDomainDelta: 3 };
    const recorded = context.request(nearestRecordedX, rendered, options);
    const repeated = context.request(nearestRecordedX, rendered, {
      ...options,
    });
    const sample = context.request(sampleRecordedX, rendered, {
      domainX,
      interpolation: interpolate,
    });
    const estimated = sample?.kind === "interpolated" ? sample.domainY : null;
    readout.set(
      recorded
        ? `Recorded $${recorded.domainY.toFixed(2)} · row ${recorded.sourceIndex}`
        : "No recorded observation",
    );
    if (estimated !== null)
      readout.update((text) => `${text}  |  Estimate $${estimated.toFixed(2)}`);
    onEvidence({
      sourceIndex: recorded?.sourceIndex ?? null,
      recorded: recorded?.domainY ?? null,
      estimate: estimated,
      memoized: recorded === repeated,
    });
    const marks = context.rendered(points);
    if (marks && rootPoint) {
      const nearest = context.request(nearestRecordedPoint, marks, {
        rootPoint,
      });
      const painted = context.request(paintedPointAt, marks, { rootPoint });
      markReadout.set(
        `Nearest ${nearest?.datum.name ?? "none"} · Painted ${painted?.datum.name ?? "none"}`,
      );
      onEvidence({
        nearestMark: nearest?.datum.name ?? null,
        paintedMark: painted?.datum.name ?? null,
      });
    } else {
      markReadout.set("Keyboard selection · no painted-point request");
      onEvidence({ nearestMark: null, paintedMark: null });
    }
  };
  const select = withInspection((event: PibblLogicalMouseEvent, context) => {
    const rendered = context.rendered(line);
    if (!rendered) return;
    const rootPoint = { x: event.x, y: event.y };
    inspect(context, rendered.domainXAtRoot(rootPoint), rootPoint);
  });
  const clip = new Path2D();
  clip.rect(0, 0, width, height);
  return (
    <>
      <Group onClick={select}>
        <Rectangle
          keyboardFocusable
          onKeyDown={withInspection((event, context) => {
            if (!["ArrowLeft", "ArrowRight", "Enter"].includes(event.key))
              return;
            event.preventDefault();
            const time = Math.max(
              0,
              Math.min(
                24,
                cursor.get() +
                  (event.key === "ArrowLeft"
                    ? -1
                    : event.key === "ArrowRight"
                      ? 1
                      : 0),
              ),
            );
            cursor.set(time);
            inspect(context, time);
          })}
          style={{ width, height, fill: "#fffef9", stroke: "#d4dfd5" }}
        />
        <GridLines
          scale="price"
          direction="horizontal"
          span={[0, width]}
          style={{ stroke: "#e0e8e0" }}
        />
        <Clip style={{ d: clip }}>
          <LineSeries
            data={prices.data}
            x={prices.x}
            y={prices.y}
            xScale="time"
            yScale="price"
            inspection={line}
            style={{ stroke: teal, strokeWidth: 2.5 }}
          />
          <PointSeries
            data={executions.data}
            x={executions.x}
            y={executions.y}
            xScale="time"
            yScale="price"
            inspection={points}
            style={(_, index) => ({
              radius: 9,
              fill: index ? coral : teal,
              stroke: "#fffef9",
              strokeWidth: 2,
            })}
          />
        </Clip>
      </Group>
      <Label x={8} y={height + (compact ? 14 : 20)} text="0" color={muted} />
      <Label
        x={width / 2}
        y={height + (compact ? 14 : 20)}
        text="12"
        color={muted}
      />
      <Label
        x={width - 20}
        y={height + (compact ? 14 : 20)}
        text="24 h"
        color={muted}
      />
      <Label
        x={8}
        y={height + (compact ? 30 : 48)}
        text={readout.get()}
        size={width < 450 ? 10 : 13}
      />
      <Label
        x={8}
        y={height + (compact ? 45 : 68)}
        text={markReadout.get()}
        size={width < 450 ? 9 : 11}
        color={muted}
      />
    </>
  );
}

function RiskPlot({
  width,
  height,
  onEvidence,
}: {
  width: number;
  height: number;
  onEvidence: (e: Partial<WorkbenchEvidence>) => void;
}) {
  const inspection = useBarInspection(risk);
  const readout = useSignal("Select risk range · simulated pp");
  return (
    <>
      <Group
        onClick={withInspection((event, context) => {
          const rendered = context.rendered(inspection);
          if (!rendered) return;
          const hit = context.request(paintedBarAt, rendered, {
            rootPoint: { x: event.x, y: event.y },
          });
          readout.set(
            hit
              ? `${hit.datum.desk}: ${hit.valueStart} to +${hit.valueEnd} pp`
              : "No painted risk range",
          );
          onEvidence({ desk: hit?.datum.desk ?? null });
        })}
      >
        <Rectangle
          keyboardFocusable
          onKeyDown={withInspection((event, context) => {
            if (event.key !== "Enter") return;
            const rendered = context.rendered(inspection);
            if (!rendered) return;
            const mark = rendered.marks[0];
            readout.set(
              mark
                ? `${mark.datum.desk}: ${mark.valueStart} to +${mark.valueEnd} pp`
                : "No risk range",
            );
            onEvidence({ desk: mark?.datum.desk ?? null });
          })}
          style={{ width, height, fill: "#fffef9" }}
        />
        <BarSeries
          data={risk.data}
          category={risk.category}
          valueStart={risk.valueStart}
          valueEnd={risk.valueEnd}
          categoryScale="desk"
          valueScale="risk"
          inspection={inspection}
          style={{ fill: "#b3d5c6", stroke: teal, strokeWidth: 1 }}
        />
      </Group>
      <Label x={width / 6 - 14} y={height + 20} text="Rates" />
      <Label x={width / 2 - 16} y={height + 20} text="Credit" />
      <Label x={(width * 5) / 6 - 6} y={height + 20} text="FX" />
      <Label
        x={4}
        y={height + (height < 60 ? 30 : 45)}
        text={readout.get()}
        size={width < 450 ? 10 : 12}
        color={muted}
      />
    </>
  );
}

function Workbench({
  onEvidence,
}: {
  onEvidence: (e: Partial<WorkbenchEvidence>) => void;
}) {
  const box = useLayoutBox();
  const compact = box.height < 480;
  const width = Math.max(200, box.width - 48);
  const height = Math.max(
    compact ? 40 : 55,
    box.height - (compact ? 225 : 385),
  );
  const priceTop = compact ? 68 : 105;
  const riskTop = priceTop + height + (compact ? 75 : 115);
  const riskHeight = compact ? 45 : 95;
  return (
    <>
      <Rectangle
        pointerEvents="none"
        style={{ width: box.width, height: box.height, fill: "#f3f5ed" }}
      />
      <Label
        x={24}
        y={compact ? 17 : 30}
        text="INSPECTION / RESEARCH DESK"
        size={11}
        color={teal}
      />
      <Label
        x={24}
        y={compact ? 40 : 60}
        text="Recorded. Estimated. Painted."
        size={compact || box.width < 500 ? 18 : 28}
      />
      <Label
        x={24}
        y={compact ? 56 : 82}
        text="SIM · Deterministic simulation · USD / risk in pp"
        size={11}
        color={muted}
      />
      <Group style={{ translateX: 24, translateY: priceTop }}>
        <LinearScale
          id="time"
          style={{ width, height }}
          domain={[0, 24]}
          range={[8, width - 8]}
        >
          <LinearScale
            id="price"
            style={{ width, height }}
            domain={[97, 109]}
            range={[height - 8, 8]}
          >
            <PricePlot
              width={width}
              height={height}
              compact={compact}
              onEvidence={onEvidence}
            />
          </LinearScale>
        </LinearScale>
      </Group>
      <Label
        x={24}
        y={riskTop - 15}
        text="RISK RANGE / DESK"
        size={11}
        color={teal}
      />
      <Group style={{ translateX: 24, translateY: riskTop }}>
        <BarScale
          id="desk"
          style={{ width, height: riskHeight }}
          domain={["Rates", "Credit", "FX"]}
          range={[0, width]}
          paddingInner={0.45}
          paddingOuter={0.2}
        >
          <LinearScale
            id="risk"
            style={{ width, height: riskHeight }}
            domain={[-8, 8]}
            range={[riskHeight, 0]}
          >
            <RiskPlot
              width={width}
              height={riskHeight}
              onEvidence={onEvidence}
            />
          </LinearScale>
        </BarScale>
      </Group>
    </>
  );
}

interface WorkbenchOptions {
  onEvidence?: (e: WorkbenchEvidence) => void;
}

/** Mount the public simulated inspection workbench; dispose the controller on removal. */
export default function mount(
  canvas: HTMLCanvasElement,
  options: WorkbenchOptions = {},
): PibblController {
  const state: WorkbenchEvidence = {
    sourceIndex: null,
    recorded: null,
    estimate: null,
    nearestMark: null,
    paintedMark: null,
    desk: null,
    memoized: false,
  };
  const publish = (patch: Partial<WorkbenchEvidence>) => {
    Object.assign(state, patch);
    options.onEvidence?.({ ...state });
  };
  return pibbl(
    canvas,
    <FocusManagement>
      <Workbench onEvidence={publish} />
    </FocusManagement>,
    { pixelRatio: 1 },
  );
}
