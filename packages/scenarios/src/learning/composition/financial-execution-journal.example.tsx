import {
  Clip,
  FocusManagement,
  Group,
  Rectangle,
  Path,
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
  ReferenceLine,
  TradingTimeScale,
  formatNumber,
  padLinearDomain,
  niceLinearDomain,
  linearTicks,
  OhlcBarSeries,
  BaselineSeries,
  PlotSeries,
  interpolateNumericRange,
} from "@pibbl/core/viz";
import {
  nearestRecordedOhlcBarX,
  paintedOhlcBarAt,
  useOhlcBarInspection,
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

// Seeded synthetic daily OHLC observations: drift, a volatility shock and recovery.
// Weekdays are supplied observations, not an exchange holiday calendar.
let seed = 7319;
const uniform = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return (seed + 1) / 4294967297;
};
const normal = () =>
  Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
const gapSlot = 104;
const rows: {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number | null;
  volume: number;
}[] = [];
let prior = 104.2;
for (
  let time = Date.UTC(2026, 0, 2, 16);
  rows.length < 180;
  time += 86_400_000
) {
  const day = new Date(time).getUTCDay();
  if (day === 0 || day === 6) continue;
  const slot = rows.length;
  const volatility =
    slot < 55 ? 0.005 : slot < 100 ? 0.018 : slot < 145 ? 0.009 : 0.004;
  const drift =
    slot < 55 ? 0.0018 : slot < 100 ? -0.001 : slot < 145 ? 0.003 : 0.0002;
  const shock = slot === 75 ? -0.067 : slot === 118 ? 0.038 : 0;
  const open = prior * Math.exp(normal() * volatility * 0.25);
  const close = open * Math.exp(drift + normal() * volatility + shock);
  const wick = Math.abs(normal()) * volatility * 0.5 + 0.001;
  rows.push({
    time,
    open,
    high: Math.max(open, close) * (1 + wick),
    low: Math.min(open, close) * (1 - wick),
    close: slot === gapSlot ? null : close,
    volume: Math.round(
      820000 * (1 + Math.abs(close / prior - 1) * 35 + uniform() * 0.7),
    ),
  });
  prior = close;
}
const timestamps = rows.map((row) => row.time);
const asOfTime = timestamps.at(-1)!;
const bounds = [-0.5, timestamps.length - 0.5] as const;
const date = (time: number) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(time);
const price = (value: number | null) =>
  value === null
    ? "warming"
    : formatNumber(value, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
// Simulated fills form two closed lots and one open lot; quantities are shares.
const trades = [
  {
    id: "B1",
    slot: 40,
    side: "Buy",
    quantity: 100,
    note: "Initial trend entry",
  },
  {
    id: "S1",
    slot: 76,
    side: "Sell",
    quantity: 100,
    note: "Risk exit after selloff",
  },
  { id: "B2", slot: 116, side: "Buy", quantity: 150, note: "Recovery entry" },
  {
    id: "E1",
    slot: 116,
    side: "Event",
    quantity: 0,
    note: "Simulated earnings release",
  },
  {
    id: "S2",
    slot: 146,
    side: "Sell",
    quantity: 150,
    note: "Recovery profit taken",
  },
  {
    id: "B3",
    slot: 162,
    side: "Buy",
    quantity: 80,
    note: "Consolidation entry",
  },
].map((trade) => ({
  ...trade,
  time: rows[trade.slot]!.time,
  price: rows[trade.slot]!.close!,
}));
type Trade = (typeof trades)[number];
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
  const view = useSignal<"Bars" | "Baseline" | "Both">("Both");
  const entry = useSignal("B2"),
    selectedFill = useSignal<string | undefined>(undefined);
  const selectedEntry = trades.find((trade) => trade.id === entry.get())!;
  const activeFill = trades.find((trade) => trade.id === selectedFill.get());
  const selectFill = (trade: Trade) => {
    selectedFill.set(trade.id);
    pinned.set(trade.time);
    if (trade.side === "Buy") entry.set(trade.id);
    const current = viewport.get();
    if (trade.slot < current[0] || trade.slot > current[1]) {
      // Reveal an offscreen fill by moving the displayed window, preserving its span.
      navigate(
        shiftLogicalRange(current, {
          bounds,
          minimumSpan: 2,
          delta: trade.slot - (current[0] + current[1]) / 2,
        }),
      );
    }
  };
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
    right = width - 18,
    top = 153,
    bottom = height - 43;
  const visible = (slot: number) => slot >= range[0] && slot <= range[1];
  const values = rows.flatMap((row, slot) =>
    visible(slot) && row.close !== null ? [row.low, row.high] : [],
  );
  const domain = niceLinearDomain(
    padLinearDomain([Math.min(...values), Math.max(...values)], {
      padding: 0.1,
      minimumSpan: 4,
    }),
    { count: narrow ? 3 : 6 },
  );
  const priceTicks = linearTicks(domain, { count: narrow ? 3 : 6 });
  const inspection = useOhlcBarInspection({
    data: rows,
    time: "time",
    open: "open",
    high: "high",
    low: "low",
    close: "close",
  });
  const select = (pin: boolean) =>
    withInspection((event: PibblLogicalMouseEvent, context) => {
      const rendered = context.rendered(inspection);
      if (!rendered) return;
      const domainX = rendered.timeAtRoot({ x: event.x, y: event.y });
      if (domainX === undefined) return;
      const painted = context.request(paintedOhlcBarAt, rendered, {
        rootPoint: { x: event.x, y: event.y },
      });
      const hit =
        painted ??
        context.request(nearestRecordedOhlcBarX, rendered, { time: domainX });
      if (!hit) return;
      const time = hit.time;
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
    threeMonths = period(calendarMonthsBefore(asOfTime, 3));
  const navigation = { bounds, minimumSpan: 2 };
  const presets = [
    { label: "1M", range: oneMonth },
    { label: "3M", range: threeMonths },
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
    { label: "All", activate: () => navigate(bounds) },
    {
      label: "Shock",
      activate: () => {
        pinned.set(timestamps[75]);
        navigate([53.5, 99.5]);
      },
    },
    {
      label: "Gap",
      activate: () => {
        pinned.set(timestamps[gapSlot]);
        navigate([82.5, 136.5]);
      },
    },
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
  const delta =
    rows[index]?.close == null
      ? null
      : rows[index]!.close! - selectedEntry.price;
  const marker = (trade: Trade) => {
    const buy = trade.side === "Buy",
      event = trade.side === "Event",
      offset = buy ? 13 : -13;
    const path = new Path2D();
    path.moveTo(0, 0);
    path.lineTo(0, offset);
    if (event) {
      path.moveTo(0, offset - 4);
      path.lineTo(-4, offset);
      path.lineTo(0, offset + 4);
      path.lineTo(4, offset);
    } else {
      path.moveTo(0, offset + (buy ? -4 : 4));
      path.lineTo(-4, offset + (buy ? 4 : -4));
      path.lineTo(4, offset + (buy ? 4 : -4));
    }
    path.closePath();
    return (
      <>
        <Path
          pointerEvents="none"
          style={{
            d: path,
            fill: event ? colors.benchmark : buy ? colors.growth : "#e77a8b",
            stroke: colors.text,
            strokeWidth: 0.6,
          }}
        />
        {!narrow && (
          <Label x={7} y={offset - 4} color={colors.text} font="9px sans-serif">
            {trade.id}
          </Label>
        )}
        <Rectangle
          keyboardFocusable
          onClick={() => selectFill(trade)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              selectFill(trade);
            }
          }}
          style={{
            left: -8,
            top: Math.min(0, offset) - 6,
            width: 22,
            height: Math.abs(offset) + 12,
            fill: "transparent",
            stroke: activeFill?.id === trade.id ? colors.text : "transparent",
            strokeWidth: 0.8,
            cursor: "pointer",
          }}
        />
      </>
    );
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
        Execution Journal
      </Label>
      <Button
        x={width - 76}
        y={10}
        width={60}
        label={palette.get() ? "Light" : "Dark"}
        colors={colors}
        onActivate={() => palette.update((v) => !v)}
      />
      <Label
        x={16}
        y={38}
        color={colors.muted}
        font={`${narrow ? 9 : 11}px sans-serif`}
      >
        {narrow
          ? activeFill
            ? `${activeFill.id} ${activeFill.side}${activeFill.side === "Event" ? "" : ` ${activeFill.quantity} shares`} · simulated USD`
            : "NSTR · simulated USD prices / fills"
          : "NSTR · simulated USD daily OHLC and fills · two closed lots and one open lot · no fees"}
      </Label>
      <Label
        x={16}
        y={55}
        color={colors.text}
      >{`${date(selected)} · ${rows[index]?.close == null ? "Missing close" : `Close $${price(rows[index]!.close)}`}${outside ? " · outside window" : ""}`}</Label>
      {!narrow && rows[index]?.close !== null && (
        <Label
          x={450}
          y={55}
          color={colors.muted}
        >{`O ${price(rows[index]!.open)} · H ${price(rows[index]!.high)} · L ${price(rows[index]!.low)}`}</Label>
      )}
      <Label
        x={16}
        y={72}
        color={colors.defensive}
        font={`${narrow ? 9 : 11}px sans-serif`}
      >{`Entry ${selectedEntry.id} $${price(selectedEntry.price)}`}</Label>
      <Label
        x={narrow ? 143 : 230}
        y={72}
        color={
          delta === null ? colors.muted : delta >= 0 ? colors.growth : "#e77a8b"
        }
        font={`${narrow ? 9 : 11}px sans-serif`}
      >{`Δ / share ${delta === null ? "—" : formatNumber(delta, { signDisplay: "exceptZero", minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</Label>
      {!narrow && (
        <Label x={450} y={72} color={colors.muted}>
          {activeFill
            ? activeFill.side === "Event"
              ? `${activeFill.id} · ${activeFill.note}`
              : `${activeFill.id} ${activeFill.side} ${activeFill.quantity} shares @ $${price(activeFill.price)} · ${activeFill.note}`
            : "Select a trade marker · buy fills change the entry baseline"}
        </Label>
      )}
      {["Bars", "Baseline", "Both"].map((name, i) => (
        <Button
          key={name}
          x={16 + i * (narrow ? 54 : 80)}
          y={87}
          width={narrow ? 49 : 74}
          label={name}
          colors={colors}
          active={view.get() === name}
          onActivate={() => view.set(name as "Bars" | "Baseline" | "Both")}
        />
      ))}
      {trades
        .filter((trade) => trade.side === "Buy")
        .map((trade, i) => (
          <Button
            key={trade.id}
            x={16 + (i + 3) * (narrow ? 54 : 80)}
            y={87}
            width={narrow ? 49 : 74}
            label={trade.id}
            colors={colors}
            active={entry.get() === trade.id}
            onActivate={() => selectFill(trade)}
          />
        ))}
      {controls.map((control, i) => (
        <Button
          key={control.label}
          x={16 + i * (narrow ? 54 : 80)}
          y={117}
          width={narrow ? 49 : 74}
          label={control.label}
          colors={colors}
          active={activePresets.includes(control.label)}
          disabled={control.disabled}
          onActivate={control.activate}
        />
      ))}
      {!narrow && (
        <Label x={520} y={95} color={colors.muted}>
          Open left · close right · buy below / sell and events above
        </Label>
      )}
      {!narrow && (
        <Label x={520} y={125} color={colors.muted}>
          Above / below selected entry · missing observations leave gaps
        </Label>
      )}
      <TradingTimeScale
        id="time"
        timestamps={timestamps}
        logicalRange={viewport}
        range={[left, right]}
      >
        <LinearScale id="price" domain={domain} range={[bottom, top]}>
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
            scale="price"
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
            Price (USD)
          </Label>
          <Group style={{ translateX: left }}>
            <Axis
              scale="price"
              position="left"
              tickValues={priceTicks}
              tickFormat={(value) =>
                formatNumber(Number(value), { maximumFractionDigits: 0 })
              }
              style={{
                stroke: colors.grid,
                strokeWidth: 0.5,
                fill: colors.muted,
                font: "9px sans-serif",
              }}
            />
          </Group>
          <Clip style={{ d: plotPath }}>
            {view.get() !== "Bars" && (
              <BaselineSeries
                data={rows}
                x="time"
                y="close"
                xScale="time"
                yScale="price"
                baseline={selectedEntry.price}
                pointerEvents="none"
                style={{
                  above: { fill: colors.growth, stroke: colors.growth },
                  below: { fill: "#e77a8b", stroke: "#e77a8b" },
                  fillOpacity: 0.22,
                  strokeWidth: 1.3,
                }}
              />
            )}
            <OhlcBarSeries<(typeof rows)[number]>
              data={rows}
              time="time"
              open="open"
              high="high"
              low="low"
              close="close"
              xScale="time"
              yScale="price"
              inspection={inspection}
              pointerEvents="none"
              style={(row) => ({
                stroke:
                  row.close !== null && row.close >= row.open
                    ? colors.growth
                    : "#e77a8b",
                strokeWidth: narrow ? 0.8 : 1.1,
                opacity: view.get() === "Baseline" ? 0 : 1,
              })}
            />
            {selectedEntry.price >= domain[0] &&
              selectedEntry.price <= domain[1] && (
                <ReferenceLine
                  scale="price"
                  direction="horizontal"
                  value={selectedEntry.price}
                  span={[left, right]}
                  style={{ stroke: colors.defensive, strokeWidth: 0.8 }}
                />
              )}
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
          <Clip style={{ d: plotPath }}>
            <PlotSeries
              data={trades.filter((trade) => visible(trade.slot))}
              keyBy="id"
              x="time"
              y="price"
              xScale="time"
              yScale="price"
              render={marker}
            />
          </Clip>
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
        y={bottom + 24}
        align="right"
        color={colors.muted}
        font={`${narrow ? 8 : 10}px sans-serif`}
      >
        {narrow
          ? `${date(timestamps[firstSlot]!)} – ${date(timestamps[lastSlot]!)}`
          : `Window ${date(timestamps[firstSlot]!)} – ${date(timestamps[lastSlot]!)} · ${formatNumber(range[1] - range[0], { maximumFractionDigits: 1 })} sessions wide · ${activePresets.length ? activePresets.join(" + ") : "custom"}`}
      </Label>
      <Label
        x={16}
        y={height - 10}
        color={colors.muted}
        font={`${narrow ? 8 : 10}px sans-serif`}
      >
        {narrow
          ? `Drag / pinch / wheel · tap to pin · arrows to step`
          : "Drag / wheel / pinch to navigate · select fills · click price to pin · arrows to step"}
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
