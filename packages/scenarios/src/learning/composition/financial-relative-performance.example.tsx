import {
  Clip,
  FocusManagement,
  Group,
  Rectangle,
  Text,
  pibbl,
  useCanvasContext,
  useLayoutBox,
  useAnimatedValue,
  tween,
  easing,
  useReaction,
  useRef,
  useSignal,
  type PibblController,
  type PibblLogicalMouseEvent,
  type PibblPointerEvent,
  type PibblWheelEvent,
} from "@pibbl/core";
import {
  Axis,
  GridLines,
  LinearScale,
  LineSeries,
  ReferenceLine,
  ScaleAdjust,
  TradingTimeScale,
  defineSeries,
  formatNumber,
  padLinearDomain,
  niceLinearDomain,
  linearTicks,
  percentageReturns,
  interpolateNumericRange,
} from "@pibbl/core/viz";
import {
  nearestRecordedX,
  useNumericInspection,
  withInspection,
} from "@pibbl/core/viz/inspection";

// Local navigation keeps this editable Studio source self-contained.
/** Application-local navigation for supplied observation slots. */
type LogicalRange = readonly [number, number];

function utcPeriodRange(
  timestamps: readonly number[],
  { startTime, endTime }: { startTime: number; endTime: number },
): LogicalRange | undefined {
  if (
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime) ||
    startTime > endTime
  )
    throw new Error("utcPeriodRange requires ordered finite UTC times");
  const first = timestamps.findIndex(
    (time) => time >= startTime && time <= endTime,
  );
  if (first < 0) return undefined;
  let last = first;
  for (let index = first + 1; index < timestamps.length; index += 1)
    if (timestamps[index]! >= startTime && timestamps[index]! <= endTime)
      last = index;
  return Object.freeze([first - 0.5, last + 0.5]) as LogicalRange;
}

function calendarMonthsBefore(asOfTime: number, months: number): number {
  if (
    !Number.isSafeInteger(asOfTime) ||
    !Number.isInteger(months) ||
    months < 0
  )
    throw new Error(
      "calendarMonthsBefore requires a safe UTC time and whole non-negative months",
    );
  const source = new Date(asOfTime);
  const targetMonth = source.getUTCMonth() - months;
  const targetYear = source.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(
    Date.UTC(targetYear, normalizedMonth + 1, 0),
  ).getUTCDate();
  return Date.UTC(
    targetYear,
    normalizedMonth,
    Math.min(source.getUTCDate(), lastDay),
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds(),
  );
}

function normalized(
  range: LogicalRange,
  bounds: LogicalRange,
  minimumSpan: number,
): LogicalRange {
  const low = Math.min(...bounds),
    high = Math.max(...bounds);
  const maxSpan = high - low;
  const span = Math.min(
    maxSpan,
    Math.max(minimumSpan, Math.abs(range[1] - range[0])),
  );
  let start = Math.min(...range);
  start = Math.max(low, Math.min(high - span, start));
  return Object.freeze([start, start + span]) as LogicalRange;
}

function shiftLogicalRange(
  range: LogicalRange,
  {
    delta,
    bounds,
    minimumSpan,
  }: { delta: number; bounds: LogicalRange; minimumSpan: number },
): LogicalRange {
  if (!Number.isFinite(delta))
    throw new Error("shiftLogicalRange delta must be finite");
  return normalized([range[0] + delta, range[1] + delta], bounds, minimumSpan);
}

function zoomLogicalRange(
  range: LogicalRange,
  {
    factor,
    bounds,
    minimumSpan,
  }: { factor: number; bounds: LogicalRange; minimumSpan: number },
): LogicalRange {
  if (!Number.isFinite(factor) || factor <= 0)
    throw new Error("zoomLogicalRange factor must be positive");
  const midpoint = (range[0] + range[1]) / 2;
  const half =
    Math.max(minimumSpan, Math.abs(range[1] - range[0]) * factor) / 2;
  return normalized([midpoint - half, midpoint + half], bounds, minimumSpan);
}

function latestLogicalRange(
  range: LogicalRange,
  { bounds, minimumSpan }: { bounds: LogicalRange; minimumSpan: number },
): LogicalRange {
  const span = Math.max(minimumSpan, Math.abs(range[1] - range[0]));
  return normalized(
    [Math.max(...bounds) - span, Math.max(...bounds)],
    bounds,
    minimumSpan,
  );
}

// Deterministic illustrative USD closing prices with shared market movement,
// changing volatility, and discrete shocks. This is a teaching dataset, not a feed.
// One shared observation calendar makes missing data explicit rather than bridging it silently.
const timestamps: number[] = [];
for (
  let time = Date.UTC(2025, 11, 1, 16);
  time <= Date.UTC(2026, 2, 20, 16);
  time += 86_400_000
) {
  const weekday = new Date(time).getUTCDay();
  if (weekday !== 0 && weekday !== 6) timestamps.push(time);
}
const baseTime = Date.UTC(2026, 0, 2, 16);
const asOfTime = timestamps.at(-1)!;
const bounds = [-0.5, timestamps.length - 0.5] as const;
const options = { time: "time", value: "close", baseTime } as const;
const correlatedPrices = (
  starting: number,
  beta: number,
  drift: number,
  phase: number,
) => {
  let close = starting;
  return timestamps.map((time, index) => {
    const volatility = index < 22 ? 0.004 : index < 54 ? 0.009 : 0.005;
    const market =
      (((index * 37 + 11) % 19) - 9) * (volatility / 5) +
      (index === 29 ? -0.036 : index === 57 ? 0.024 : 0);
    const idiosyncratic =
      (((index * 17 + phase * 7) % 13) - 6) * (volatility / 8) +
      (phase === 0 && index === 46
        ? -0.062
        : phase === 1 && index === 63
          ? 0.018
          : 0);
    close *= 1 + drift + beta * market + idiosyncratic;
    return { time, close };
  });
};
const growthPrices = correlatedPrices(100, 1.25, 0.00045, 0);
const gapSlot = 53;
const northstar = percentageReturns(
  growthPrices.map((row, index) => ({
    ...row,
    close: index === gapSlot ? null : row.close,
  })),
  options,
)!;
const benchmark = percentageReturns(
  correlatedPrices(240, 0.82, 0.00022, 1),
  options,
)!;
const defensive = percentageReturns(
  correlatedPrices(80, 0.38, 0.00012, 2),
  options,
)!;
const unavailable = percentageReturns(
  correlatedPrices(45, 1.05, 0.0003, 3).map((row) => ({
    ...row,
    close: row.time === baseTime ? null : row.close,
  })),
  options,
);
const inspectionSource = defineSeries({
  data: benchmark,
  x: "time",
  y: "returnPercent",
});
const date = (time: number) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(time);
const percent = (value: number | null) =>
  value === null
    ? "—"
    : formatNumber(value, {
        maximumFractionDigits: 1,
        minimumFractionDigits: 1,
        signDisplay: "exceptZero",
        suffix: "%",
      });
function zoomAt(
  range: LogicalRange,
  anchor: number,
  factor: number,
  navigation: { bounds: LogicalRange; minimumSpan: number },
): LogicalRange {
  const priorSpan = Math.abs(range[1] - range[0]);
  const span = Math.min(
    Math.abs(navigation.bounds[1] - navigation.bounds[0]),
    Math.max(navigation.minimumSpan, priorSpan * factor),
  );
  const start = anchor - (anchor - range[0]) * (span / priorSpan);
  return shiftLogicalRange([start, start + span], {
    ...navigation,
    delta: 0,
  });
}
function matchingPresets(
  range: LogicalRange,
  presets: readonly { label: string; range: LogicalRange | undefined }[],
): readonly string[] {
  return presets
    .filter(
      (preset) =>
        preset.range !== undefined &&
        Math.abs(range[0] - preset.range[0]) < 0.000001 &&
        Math.abs(range[1] - preset.range[1]) < 0.000001,
    )
    .map((preset) => preset.label);
}
function calendarAxisTicks(
  timestamps: readonly number[],
  { logicalRange, width }: { logicalRange: LogicalRange; width: number },
): {
  readonly values: readonly number[];
  readonly format: (time: number) => string;
} {
  const visible = timestamps.slice(
    Math.max(0, Math.ceil(logicalRange[0])),
    Math.floor(logicalRange[1]) + 1,
  );
  const elapsedDays = visible.length
    ? (visible.at(-1)! - visible[0]!) / 86_400_000
    : 0;
  const monthly = elapsedDays > 60;
  const weekly = elapsedDays > 10 && !monthly;
  const formatter = new Intl.DateTimeFormat(
    "en-GB",
    monthly
      ? { month: "short", year: "numeric", timeZone: "UTC" }
      : { day: "2-digit", month: "short", timeZone: "UTC" },
  );
  const candidates: number[] = [];
  let previousBucket: number | undefined;
  for (const time of visible) {
    const date = new Date(time);
    const bucket = monthly
      ? date.getUTCFullYear() * 12 + date.getUTCMonth()
      : weekly
        ? Math.floor(
            (time - ((date.getUTCDay() + 6) % 7) * 86_400_000) /
              (7 * 86_400_000),
          )
        : Math.floor(time / 86_400_000);
    if (bucket !== previousBucket) candidates.push(time);
    previousBucket = bucket;
  }
  const budget = Math.max(2, Math.floor(width / 80));
  const values =
    candidates.length <= budget
      ? candidates
      : Array.from(
          { length: budget },
          (_, index) =>
            candidates[
              Math.round((index * (candidates.length - 1)) / (budget - 1))
            ]!,
        );
  return { values, format: (time) => formatter.format(time) };
}
interface NavigationGesture {
  readonly points: Map<number, { x: number; y: number }>;
  startRange: LogicalRange;
  startX: number;
  startCenter: number;
  startDistance: number;
  dragged: boolean;
  suppressClick: boolean;
}
const dark = {
  background: "#0d1422",
  plot: "#101a2b",
  text: "#dbe6f1",
  muted: "#91a2ba",
  grid: "#26354c",
  active: "#1c3049",
  growth: "#29c7ab",
  benchmark: "#a7b8d3",
  defensive: "#e6b766",
};
const light = {
  background: "#f6f8fb",
  plot: "#ffffff",
  text: "#18283d",
  muted: "#586b82",
  grid: "#dce5ef",
  active: "#e2ebf6",
  growth: "#00876e",
  benchmark: "#596d8c",
  defensive: "#a26915",
};
function Label({
  x,
  y,
  children,
  color,
  font = "10px sans-serif",
  align = "left",
}: {
  x: number;
  y: number;
  children: string;
  color: string;
  font?: string;
  align?: CanvasTextAlign;
}) {
  return (
    <Text
      pointerEvents="none"
      style={{ left: x, top: y, fill: color, font, textAlign: align }}
    >
      {children}
    </Text>
  );
}
function Button({
  x,
  y,
  width,
  label,
  colors,
  active = false,
  disabled = false,
  onActivate,
}: {
  x: number;
  y: number;
  width: number;
  label: string;
  colors: typeof dark;
  active?: boolean;
  disabled?: boolean;
  onActivate: () => void;
}) {
  const activate = () => {
    if (!disabled) onActivate();
  };
  return (
    <>
      <Rectangle
        keyboardFocusable={!disabled}
        onClick={activate}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            activate();
          }
        }}
        style={{
          left: x,
          top: y,
          width,
          height: 24,
          fill: active ? colors.active : colors.plot,
          stroke: colors.grid,
          strokeWidth: 0.5,
          cursor: disabled ? "default" : "pointer",
        }}
      />
      <Label
        x={x + width / 2}
        y={y + 7}
        align="center"
        color={active ? colors.text : colors.muted}
      >
        {label}
      </Label>
    </>
  );
}
function Desk() {
  const { width, height } = useLayoutBox();
  const canvas = useCanvasContext().canvas;
  useReaction(() => {
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const previous = canvas.style.touchAction;
    canvas.style.touchAction = "none";
    return () => {
      if (canvas.style.touchAction === "none")
        canvas.style.touchAction = previous;
    };
  }, [canvas]);
  const narrow = width < 620;
  const palette = useSignal(false),
    intent = useSignal<readonly [number, number]>(bounds);
  const direct = useSignal(false);
  const preference = useRef<MediaQueryList>();
  preference.current ??= window.matchMedia("(prefers-reduced-motion: reduce)");
  const reducedMotion = useSignal(preference.current.matches);
  useReaction(() => {
    const media = preference.current!;
    const change = () => {
      reducedMotion.set(media.matches);
      // Adopt the new duration even when the destination has not changed.
      intent.set([...intent.get()] as LogicalRange);
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, [preference.current]);
  const viewport = useAnimatedValue(intent, {
    animation: tween<LogicalRange>({
      duration: direct.get() || reducedMotion.get() ? 0 : 180,
      easing: easing.easeOut,
      interpolate: interpolateNumericRange,
    }),
  });
  const navigate = (next: LogicalRange) => {
    direct.set(false);
    intent.set([...next] as LogicalRange);
  };
  const preview = useSignal<number | undefined>(undefined),
    pinned = useSignal<number | undefined>(undefined);
  const gesture = useRef<NavigationGesture>({
    points: new Map(),
    startRange: bounds,
    startX: 0,
    startCenter: 0,
    startDistance: 1,
    dragged: false,
    suppressClick: false,
  }).current!;
  const colors = palette.get() ? light : dark;
  const range = viewport.get(),
    selected = pinned.get() ?? preview.get() ?? asOfTime;
  const index = timestamps.indexOf(selected);
  const left = 50,
    right = width - (narrow ? 18 : 142),
    top = narrow ? 142 : 132,
    bottom = height - 48;
  const visible = (slot: number) => slot >= range[0] && slot <= range[1];
  // Keep the gap rows in each run so null observations split the actual LineSeries.
  const growthRows = northstar.filter((_, slot) => visible(slot));
  const benchmarkRows = benchmark.filter((_, slot) => visible(slot));
  const defensiveRows = defensive.filter((_, slot) => visible(slot));
  const values = [...growthRows, ...benchmarkRows, ...defensiveRows].flatMap(
    (row) => (row.returnPercent === null ? [] : [row.returnPercent]),
  );
  const domain = niceLinearDomain(
    padLinearDomain([Math.min(0, ...values), Math.max(0, ...values)], {
      padding: 0.14,
      minimumSpan: 4,
    }),
    { count: narrow ? 3 : 5 },
  );
  const priceTicks = linearTicks(domain, { count: narrow ? 3 : 5 });
  const inspection = useNumericInspection(inspectionSource);
  const select = (pin: boolean) =>
    withInspection((event: PibblLogicalMouseEvent, context) => {
      const rendered = context.rendered(inspection);
      if (!rendered) return;
      const domainX = rendered.domainXAtRoot({ x: event.x, y: event.y });
      if (domainX === undefined) return;
      const hit = context.request(nearestRecordedX, rendered, { domainX });
      if (!hit) return;
      const time = hit.domainX;
      if (pin) pinned.set(pinned.get() === time ? undefined : time);
      else preview.set(time);
    });
  const key = (event: { key: string; preventDefault(): void }) => {
    if (event.key === "Escape") {
      pinned.set(undefined);
      preview.set(undefined);
      event.preventDefault();
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const first = Math.max(0, Math.ceil(range[0])),
      last = Math.min(timestamps.length - 1, Math.floor(range[1]));
    const slot =
      event.key === "Home"
        ? first
        : event.key === "End"
          ? last
          : Math.max(
              first,
              Math.min(last, index + (event.key === "ArrowLeft" ? -1 : 1)),
            );
    pinned.set(timestamps[slot]);
  };
  const period = (startTime: number) =>
    utcPeriodRange(timestamps, { startTime, endTime: asOfTime });
  const oneMonth = period(calendarMonthsBefore(asOfTime, 1)),
    threeMonths = period(calendarMonthsBefore(asOfTime, 3)),
    ytd = period(Date.UTC(new Date(asOfTime).getUTCFullYear(), 0, 1));
  const navigation = { bounds, minimumSpan: 2 };
  const presets = [
    { label: "1M", range: oneMonth },
    { label: "3M", range: threeMonths },
    { label: "YTD", range: ytd },
    { label: "All", range: bounds },
  ] as const;
  const activePresets = matchingPresets(range, presets);
  const controls = [
    {
      label: "1M",
      activate: () => oneMonth && navigate(oneMonth),
      disabled: !oneMonth,
    },
    {
      label: "3M",
      activate: () => threeMonths && navigate(threeMonths),
      disabled: !threeMonths,
    },
    { label: "YTD", activate: () => ytd && navigate(ytd), disabled: !ytd },
    { label: "All", activate: () => navigate(bounds) },
    {
      label: "Earlier",
      activate: () =>
        navigate(
          shiftLogicalRange(viewport.get(), {
            ...navigation,
            delta: -Math.abs(viewport.get()[1] - viewport.get()[0]) * 0.4,
          }),
        ),
    },
    {
      label: "Later",
      activate: () =>
        navigate(
          shiftLogicalRange(viewport.get(), {
            ...navigation,
            delta: Math.abs(viewport.get()[1] - viewport.get()[0]) * 0.4,
          }),
        ),
    },
    {
      label: "Zoom +",
      activate: () =>
        navigate(
          zoomLogicalRange(viewport.get(), { ...navigation, factor: 0.7 }),
        ),
    },
    {
      label: "Zoom −",
      activate: () =>
        navigate(
          zoomLogicalRange(viewport.get(), { ...navigation, factor: 1 / 0.7 }),
        ),
    },
    { label: "Fit", activate: () => navigate(bounds) },
    {
      label: "Latest",
      activate: () => navigate(latestLogicalRange(viewport.get(), navigation)),
    },
  ];
  const plotPath = new Path2D();
  plotPath.rect(left, top, right - left, Math.max(1, bottom - top));
  const firstSlot = Math.max(0, Math.ceil(range[0])),
    lastSlot = Math.min(timestamps.length - 1, Math.floor(range[1]));
  const dateTicks = calendarAxisTicks(timestamps, {
    logicalRange: range,
    width: right - left,
  });
  const outside = !visible(index);
  const slotAtX = (x: number, source: LogicalRange) =>
    source[0] +
    ((x - left) / Math.max(1, right - left)) * (source[1] - source[0]);
  const wheel = (event: PibblWheelEvent) => {
    event.preventDefault();
    // Accumulate input not yet presented, but take over an animated preset from its displayed range.
    const current = direct.get() ? intent.get() : viewport.get();
    const unit =
      event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? right - left : 1;
    const horizontal =
      !event.ctrlKey &&
      (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY));
    let next: LogicalRange;
    if (horizontal) {
      const pixels = (event.deltaX || event.deltaY) * unit;
      next = shiftLogicalRange(current, {
        ...navigation,
        delta: (pixels / Math.max(1, right - left)) * (current[1] - current[0]),
      });
    } else {
      const factor = Math.exp(
        Math.max(-400, Math.min(400, event.deltaY * unit)) * 0.002,
      );
      next = zoomAt(current, slotAtX(event.x, current), factor, navigation);
    }
    direct.set(true);
    intent.set(next);
  };
  const beginPointer = (event: PibblPointerEvent) => {
    if (event.pointerType !== "touch" && event.button !== 0) return;
    if (gesture.points.size === 0) {
      gesture.suppressClick = false;
      gesture.dragged = false;
    }
    if (gesture.points.size === 0) {
      direct.set(true);
      // A gesture takes over from the presented range, never the unseen destination.
      intent.set([...viewport.get()] as LogicalRange);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.points.set(event.pointerId, { x: event.x, y: event.y });
    gesture.startRange = viewport.get();
    gesture.startX = event.x;
    gesture.dragged = false;
    if (gesture.points.size >= 2) {
      const [first, second] = [...gesture.points.values()];
      gesture.startCenter = (first!.x + second!.x) / 2;
      gesture.startDistance = Math.max(1, Math.abs(second!.x - first!.x));
    }
  };
  const movePointer = (event: PibblPointerEvent) => {
    if (!gesture.points.has(event.pointerId)) return;
    gesture.points.set(event.pointerId, { x: event.x, y: event.y });
    if (gesture.points.size >= 2) {
      const [first, second] = [...gesture.points.values()];
      const center = (first!.x + second!.x) / 2;
      const distance = Math.max(1, Math.abs(second!.x - first!.x));
      const factor = gesture.startDistance / distance;
      const anchor = slotAtX(gesture.startCenter, gesture.startRange);
      const span = Math.min(
        Math.abs(navigation.bounds[1] - navigation.bounds[0]),
        Math.max(
          navigation.minimumSpan,
          Math.abs(gesture.startRange[1] - gesture.startRange[0]) * factor,
        ),
      );
      const start =
        anchor - ((center - left) / Math.max(1, right - left)) * span;
      intent.set(
        shiftLogicalRange([start, start + span], { ...navigation, delta: 0 }),
      );
      gesture.dragged ||=
        Math.abs(distance - gesture.startDistance) > 3 ||
        Math.abs(center - gesture.startCenter) > 3;
      return;
    }
    if (!gesture.dragged && Math.abs(event.x - gesture.startX) <= 3) return;
    const span = gesture.startRange[1] - gesture.startRange[0];
    intent.set(
      shiftLogicalRange(gesture.startRange, {
        ...navigation,
        delta: -((event.x - gesture.startX) / Math.max(1, right - left)) * span,
      }),
    );
    gesture.dragged ||= Math.abs(event.x - gesture.startX) > 3;
  };
  const endPointer = (event: PibblPointerEvent, cancelled = false) => {
    if (!gesture.points.has(event.pointerId)) return;
    if (!cancelled && event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    gesture.points.delete(event.pointerId);
    gesture.suppressClick ||= !cancelled && gesture.dragged;
    if (gesture.points.size === 1) {
      const point = [...gesture.points.values()][0]!;
      gesture.startRange = viewport.get();
      gesture.startX = point.x;
      gesture.dragged = false;
    } else if (gesture.points.size === 0) {
      gesture.dragged = false;
      if (cancelled) gesture.suppressClick = false;
    }
  };
  const pin = (event: PibblLogicalMouseEvent) => {
    if (gesture.suppressClick) {
      gesture.suppressClick = false;
      event.preventDefault();
      return;
    }
    select(true)(event);
  };
  return (
    <>
      <Rectangle style={{ width, height, fill: colors.background }} />
      <Label
        x={16}
        y={15}
        color={colors.text}
        font={`bold ${narrow ? 13 : 17}px sans-serif`}
      >
        Relative Performance Desk
      </Label>
      <Button
        x={width - 76}
        y={10}
        width={60}
        label={palette.get() ? "Light" : "Dark"}
        colors={colors}
        onActivate={() => palette.update((value) => !value)}
      />
      <Label
        x={16}
        y={38}
        color={colors.muted}
      >{`Base ${date(baseTime)} · ${narrow ? "simulated price-only" : `simulated USD closes · dividends excluded · as of ${date(asOfTime)}`}`}</Label>
      <Label
        x={16}
        y={55}
        color={colors.text}
      >{`${date(selected)} · ${pinned.get() !== undefined ? "Pinned" : "Inspect"}${outside ? " · outside window" : ""}`}</Label>
      <Label
        x={16}
        y={72}
        color={colors.growth}
      >{`Northstar ${percent(northstar[index]?.returnPercent ?? null)}`}</Label>
      <Label
        x={narrow ? 130 : 186}
        y={72}
        color={colors.benchmark}
      >{`Benchmark ${percent(benchmark[index]?.returnPercent ?? null)}`}</Label>
      <Label
        x={narrow ? 251 : 378}
        y={72}
        color={colors.defensive}
      >{`${narrow ? "Def." : "Defensive"} ${percent(defensive[index]?.returnPercent ?? null)}`}</Label>
      {controls.map((control, i) => (
        <Button
          key={control.label}
          x={16 + (narrow ? (i % 6) * 54 : i * 61)}
          y={narrow && i >= 6 ? 115 : 87}
          width={narrow ? 49 : 56}
          label={control.label}
          colors={colors}
          active={activePresets.includes(control.label)}
          disabled={control.disabled}
          onActivate={control.activate}
        />
      ))}
      <Label
        x={narrow ? width - 18 : 16}
        y={narrow ? 123 : 117}
        align={narrow ? "right" : "left"}
        color={colors.muted}
        font={`${narrow ? 8 : 10}px sans-serif`}
      >
        {unavailable === undefined
          ? narrow
            ? "New IPO: no base"
            : "New IPO: Unavailable · no observation at the common base"
          : ""}
      </Label>
      <TradingTimeScale
        id="time"
        timestamps={timestamps}
        logicalRange={viewport}
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
              fill: colors.plot,
            }}
          />
          <GridLines
            scale="returns"
            direction="horizontal"
            span={[left, right]}
            tickValues={priceTicks}
            style={{ stroke: colors.grid, strokeWidth: 0.5 }}
          />
          <Label
            x={left + 4}
            y={top + 4}
            color={colors.muted}
            font="9px sans-serif"
          >
            Price return (%)
          </Label>
          <Group style={{ translateX: left }}>
            <Axis
              scale="returns"
              position="left"
              tickValues={priceTicks}
              tickFormat={(value) => percent(Number(value))}
              style={{
                stroke: colors.grid,
                strokeWidth: 0.5,
                fill: colors.muted,
                font: "9px sans-serif",
              }}
            />
          </Group>
          <ReferenceLine
            scale="returns"
            direction="horizontal"
            value={0}
            span={[left, right]}
            style={{ stroke: colors.muted, strokeWidth: 0.7 }}
          />
          <Clip style={{ d: plotPath }}>
            <LineSeries
              data={growthRows}
              x="time"
              y="returnPercent"
              xScale="time"
              yScale="returns"
              pointerEvents="none"
              style={{ stroke: colors.growth, strokeWidth: 2.3 }}
            />
            <LineSeries
              data={benchmarkRows}
              x="time"
              y="returnPercent"
              xScale="time"
              yScale="returns"
              inspection={inspection}
              pointerEvents="none"
              style={{ stroke: colors.benchmark, strokeWidth: 1.7 }}
            />
            <LineSeries
              data={defensiveRows}
              x="time"
              y="returnPercent"
              xScale="time"
              yScale="returns"
              pointerEvents="none"
              style={{ stroke: colors.defensive, strokeWidth: 1.7 }}
            />
            <ReferenceLine
              scale="time"
              direction="vertical"
              value={baseTime}
              span={[top, bottom]}
              style={{ stroke: colors.grid, strokeWidth: 1.5 }}
            />
            {!outside && (
              <ReferenceLine
                scale="time"
                direction="vertical"
                value={selected}
                span={[top, bottom]}
                style={{ stroke: colors.text, strokeWidth: 0.8 }}
              />
            )}
          </Clip>
          {!narrow &&
            [
              { name: "Northstar", rows: northstar, color: colors.growth },
              { name: "Benchmark", rows: benchmark, color: colors.benchmark },
              { name: "Defensive", rows: defensive, color: colors.defensive },
            ].map((asset) => {
              const row = asset.rows[lastSlot]!;
              return row.returnPercent === null ? null : (
                <ScaleAdjust
                  key={asset.name}
                  xScale="time"
                  yScale="returns"
                  x={row.time!}
                  y={row.returnPercent}
                >
                  <Label
                    x={10}
                    y={-4}
                    color={asset.color}
                  >{`${asset.name} ${percent(row.returnPercent)}`}</Label>
                </ScaleAdjust>
              );
            })}
          <Rectangle
            keyboardFocusable
            onMouseMove={select(false)}
            onMouseLeave={() => preview.set(undefined)}
            onClick={pin}
            onKeyDown={key}
            onWheel={wheel}
            onPointerDown={beginPointer}
            onPointerMove={movePointer}
            onPointerUp={endPointer}
            onPointerCancel={(event) => endPointer(event, true)}
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
            tickValues={dateTicks.values}
            tickFormat={(value) => dateTicks.format(Number(value))}
            labelOverlap="skip"
            style={{
              stroke: colors.grid,
              strokeWidth: 0.5,
              fill: colors.muted,
              font: "9px sans-serif",
            }}
          />
        </Group>
      </TradingTimeScale>
      <Label
        x={right}
        y={bottom + 26}
        align="right"
        color={colors.muted}
        font={`${narrow ? 8 : 10}px sans-serif`}
      >{`Window ${date(timestamps[firstSlot]!)} – ${date(timestamps[lastSlot]!)} · Preset ${activePresets.length ? activePresets.join(" + ") : "custom"}`}</Label>
      <Label
        x={left}
        y={height - 13}
        color={colors.muted}
        font={`${narrow ? 8 : 10}px sans-serif`}
      >
        {narrow
          ? `Drag / pinch to navigate · tap to pin · arrows to step`
          : "Drag to pan · wheel to zoom · horizontal / Shift-wheel to pan · touch pinch to zoom · click to pin"}
      </Label>
    </>
  );
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(
    canvas,
    <FocusManagement>
      <Desk />
    </FocusManagement>,
    { viewport: "responsive" },
  );
}
