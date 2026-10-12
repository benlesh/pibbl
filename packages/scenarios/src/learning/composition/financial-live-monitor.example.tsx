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
  ReferenceLine,
  TradingTimeScale,
  formatNumber,
  padLinearDomain,
  niceLinearDomain,
  linearTicks,
  CandlestickSeries,
  VolumeSeries,
  LineSeries,
  aggregateOhlcv,
  sessionVwap,
  interpolateNumericRange,
} from "@pibbl/core/viz";
import {
  nearestRecordedCandleX,
  useCandleInspection,
  withInspection,
} from "@pibbl/core/viz/inspection";

// Editable, application-owned feed and navigation; no extra animation loop.
type LogicalRange = readonly [number, number];
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
// Deterministic simulated one-minute OHLCV: two sessions, UTC 13:30–20:00.
// These are invented prices, not an exchange feed or a holiday calendar.
type Quote = { time: number; session: string; open: number; high: number; low: number; close: number; volume: number };
const history: Quote[] = [];
let seed = 8921, prior = 128.4;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed + 1) / 4294967297; };
for (let day = 0; day < 2; day++) {
  const session = `2026-10-${8 + day}`;
  const start = Date.UTC(2026, 9, 8 + day, 13, 30);
  for (let minute = 0; minute < 390; minute++) {
    const open = minute === 0 ? prior + (day ? 1.25 : 0) : prior;
    const opening = minute < 40, shock = day === 1 && minute >= 90 && minute < 105;
    const drift = shock ? -0.17 : day === 1 && minute >= 105 && minute < 165 ? 0.045 : 0.003;
    const close = open + drift + (random() - 0.5) * (opening || shock ? 0.36 : 0.13);
    const wick = 0.015 + random() * (shock ? 0.19 : 0.065);
    history.push({ time: start + minute * 60000, session, open, close,
      high: Math.max(open, close) + wick, low: Math.min(open, close) - wick,
      volume: Math.round((opening ? 26000 : shock ? 48000 : 7000) * (0.6 + random()) * (minute > 350 ? 2 : 1)) });
    prior = close;
  }
}
const initialTick = 510 * 4;
const clock = (time: number) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(time);
const replayClock = (time: number) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC" }).format(time);
const price = (value: number | null) => value === null ? "—" : formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = (value: number) => formatNumber(value, { notation: "compact", maximumFractionDigits: 1 });
function snapshot(tick: number): Quote[] {
  if (tick >= history.length * 4) return [...history];
  const count = Math.min(history.length - 1, Math.floor(tick / 4)), fraction = (tick % 4) / 4;
  const target = history[count]!;
  const close = target.open + (target.close - target.open) * fraction;
  return [...history.slice(0, count), { time: target.time, session: target.session, open: target.open, close,
    high: Math.max(target.open, close) + (target.high - Math.max(target.open, target.close)) * fraction,
    low: Math.min(target.open, close) - (Math.min(target.open, target.close) - target.low) * fraction,
    volume: Math.round(target.volume * fraction) }];
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
  const { width, height } = useLayoutBox(), canvas = useCanvasContext().canvas;
  const narrow = width < 620;
  const tick = useSignal(initialTick), running = useSignal(false), following = useSignal(true), timeframe = useSignal(5), palette = useSignal(false);
  const intent = useSignal<LogicalRange>([450.5, 510.5]), direct = useSignal(false), resetFeed = useSignal(false);
  const preference = useRef<MediaQueryList>();
  preference.current ??= window.matchMedia("(prefers-reduced-motion: reduce)");
  const reducedMotion = useSignal(preference.current.matches);
  useReaction(() => {
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const previous = canvas.style.touchAction; canvas.style.touchAction = "none";
    return () => { if (canvas.style.touchAction === "none") canvas.style.touchAction = previous; };
  }, [canvas]);
  useReaction(() => {
    const media = preference.current!;
    const change = () => { reducedMotion.set(media.matches); intent.set([...intent.get()] as LogicalRange); };
    media.addEventListener("change", change); return () => media.removeEventListener("change", change);
  }, [preference.current]);
  const presentedTick = useAnimatedValue(tick, { animation: tween({ duration: reducedMotion.get() || resetFeed.get() ? 0 : 250, easing: easing.linear }) });
  const rows = snapshot(presentedTick.get()), timestamps = rows.map(row => row.time);
  const bounds: LogicalRange = [-0.5, rows.length - 0.5];
  const viewport = useAnimatedValue(intent, { animation: tween<LogicalRange>({ duration: direct.get() || reducedMotion.get() ? 0 : 180, easing: easing.easeOut, interpolate: interpolateNumericRange }) });
  const navigate = (next: LogicalRange) => { direct.set(false); intent.set([...next] as LogicalRange); };
  const advance = (updates = 2) => {
    if (tick.get() >= history.length * 4) { running.set(false); return; }
    const next = Math.min(history.length * 4, tick.get() + updates);
    resetFeed.set(false);
    tick.set(next);
    if (following.get()) navigate(latestLogicalRange(viewport.get(), { bounds: [-0.5, Math.min(history.length - 1, Math.floor(next / 4)) + 0.5], minimumSpan: 2 }));
  };
  useReaction(() => { if (!running.get()) return; const timer = window.setInterval(() => advance(), 250); return () => window.clearInterval(timer); }, [running.get()]);
  const preview = useSignal<number | undefined>(undefined), pinned = useSignal<number | undefined>(undefined);
  const gesture = useRef<NavigationGesture>({ points: new Map(), startRange: bounds, startX: 0, startCenter: 0, startDistance: 1, dragged: false, suppressClick: false }).current!;
  const colors = palette.get() ? light : dark, range = viewport.get();
  const left = 55, right = width - 18, top = 153, bottom = height - 43;
  const priceBottom = top + (bottom - top) * 0.72, volumeTop = priceBottom + 13;
  const navigation = { bounds, minimumSpan: 2 };
  const visible = (slot: number) => slot >= range[0] && slot <= range[1];
  const minutes = timeframe.get();
  const studies = sessionVwap(rows, { price: row => (row.high + row.low + row.close) / 3, volume: "volume", session: row => row.session });
  const aggregate = (input: readonly Quote[]) => aggregateOhlcv(input, { time: "time", open: "open", high: "high", low: "low", close: "close", volume: "volume", bucket: time => {
    const day = new Date(time); const sessionOpen = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 13, 30);
    const start = sessionOpen + Math.floor((time - sessionOpen) / (minutes * 60000)) * minutes * 60000;
    return { start, end: start + minutes * 60000 };
  } });
  const bars = aggregate(rows).map(bar => ({ time: bar.start, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume, sources: bar.sources }));
  // Volume reflects the received feed directly; only price presentation is tweened.
  const volumeBars = aggregate(snapshot(tick.get())).filter(bar => bar.start <= timestamps.at(-1)!).map(bar => ({ time: bar.start, open: bar.open, close: bar.close, volume: bar.volume, sources: bar.sources }));
  const visibleVolumeBars = volumeBars.filter(bar => bar.sources.some(source => visible(source.sourceIndex)));
  const visibleBars = bars.filter(bar => bar.sources.some(source => visible(source.sourceIndex)));
  const values = visibleBars.flatMap(bar => [bar.low, bar.high]);
  const visibleVwap = studies.filter(point => visible(point.sourceIndex) && point.vwap !== null).map(point => point.vwap!);
  const domain = niceLinearDomain(padLinearDomain([Math.min(...values, ...visibleVwap), Math.max(...values, ...visibleVwap)], { padding: 0.12, minimumSpan: 0.5 }), { count: narrow ? 3 : 6 });
  const priceTicks = linearTicks(domain, { count: narrow ? 3 : 6 });
  const volumeDomain: LogicalRange = [0, Math.max(1, ...visibleVolumeBars.map(bar => bar.volume)) * 1.15];
  const selected = pinned.get() ?? preview.get() ?? bars.at(-1)!.time;
  const selectedBar = bars.find(bar => selected >= bar.time && selected < bar.time + minutes * 60000) ?? bars.at(-1)!;
  const selectedVolume = volumeBars.find(bar => bar.time === selectedBar.time)?.volume ?? selectedBar.volume;
  const selectedStudy = studies[selectedBar.sources.at(-1)!.sourceIndex]!;
  const inspection = useCandleInspection({ data: bars, time: "time", open: "open", high: "high", low: "low", close: "close" });
  const select = (pin: boolean) => withInspection((event: PibblLogicalMouseEvent, context) => {
    const rendered = context.rendered(inspection); if (!rendered) return;
    const time = rendered.timeAtRoot({ x: event.x, y: event.y }); if (time === undefined) return;
    const hit = context.request(nearestRecordedCandleX, rendered, { time }); if (!hit) return;
    if (pin) pinned.set(pinned.get() === hit.time ? undefined : hit.time); else preview.set(hit.time);
  });
  const key = (event: { key: string; preventDefault(): void }) => {
    if (event.key === "Escape") { pinned.set(undefined); preview.set(undefined); event.preventDefault(); return; }
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault(); const shown = visibleBars, at = shown.indexOf(selectedBar);
    const slot = event.key === "Home" ? 0 : event.key === "End" ? shown.length - 1 : Math.max(0, Math.min(shown.length - 1, at + (event.key === "ArrowLeft" ? -1 : 1)));
    pinned.set(shown[slot]?.time);
  };
  const slotAtX = (x: number, source: LogicalRange) =>
    source[0] +
    ((x - left) / Math.max(1, right - left)) * (source[1] - source[0]);
  const wheel = (event: PibblWheelEvent) => {
    event.preventDefault();
    following.set(false);
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
      following.set(false);
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

  const controls = [
    { label: running.get() ? "Pause" : "Play", active: running.get(), activate: () => running.update(value => !value) },
    { label: "Step", active: false, activate: () => { running.set(false); const step = timeframe.get() * 4; advance(step - tick.get() % step); } },
    { label: "Reset", active: false, activate: () => { running.set(false); resetFeed.set(true); tick.set(initialTick); following.set(true); pinned.set(undefined); navigate([450.5, 510.5]); } },
    ...[1, 5, 15].map(value => ({ label: `${value}m`, active: minutes === value, activate: () => { timeframe.set(value); pinned.set(undefined); preview.set(undefined); } })),
  ];
  const ranges = [
    { label: "30m", activate: () => { following.set(false); navigate([bounds[1] - 30, bounds[1]]); } },
    { label: "2h", activate: () => { following.set(false); navigate([bounds[1] - 120, bounds[1]]); } },
    { label: "Session", activate: () => { following.set(false); navigate([389.5, bounds[1]]); } },
    { label: "All", activate: () => { following.set(false); navigate(bounds); } },
    { label: "Follow", activate: () => { following.set(true); navigate(latestLogicalRange(viewport.get(), navigation)); } },
  ];
  const budget = Math.max(2, Math.floor((right-left) / 90));
  const firstSlot = Math.max(0, Math.ceil(range[0])), lastSlot = Math.min(rows.length-1, Math.floor(range[1]));
  // Clock-aligned times retain their identity and move through the same scale as the data.
  // Granularity depends only on window span and label budget, not on its moving endpoints.
  // Round away subpixel arithmetic noise at interval boundaries (e.g. 30 / 3).
  // A translated window must never alternate between 10- and 15-minute ticks.
  const tickSpacing = Number(((range[1]-range[0])/budget).toFixed(8));
  const tickMinutes = [1, 2, 5, 10, 15, 30, 60, 120, 390].find(value => value >= tickSpacing) ?? 390;
  const dateTicks = timestamps.filter((time,slot) => visible(slot) && time % (tickMinutes*60000) === 0);
  const plotPath = new Path2D(); plotPath.rect(left, top, right-left, Math.max(1,priceBottom-top));
  const volumePath = new Path2D(); volumePath.rect(left,volumeTop,right-left,Math.max(1,bottom-volumeTop));
  const barWidth = Math.max(1, Math.min(28, minutes * (right-left) / (range[1]-range[0]) * 0.72));
  const latest = rows.at(-1)!, lastStudy = studies.at(-1)!;
  const feedTime = latest.time + (presentedTick.get() >= history.length * 4 ? 60000 : presentedTick.get() % 4 * 15000);
  const crossVisible = timestamps.indexOf(selectedBar.time) >= range[0] && timestamps.indexOf(selectedBar.time) <= range[1];
  return <>
    <Rectangle style={{width,height,fill:colors.background}} />
    <Label x={16} y={15} color={colors.text} font={`bold ${narrow ? 13 : 17}px sans-serif`}>Live Market Monitor</Label>
    <Button x={width-76} y={10} width={60} label={palette.get() ? "Light" : "Dark"} colors={colors} onActivate={() => palette.update(value => !value)} />
    <Label x={16} y={38} color={colors.muted} font={`${narrow ? 9 : 11}px sans-serif`}>{narrow ? `Simulated · ${running.get() ? "PLAYING" : "PAUSED"} · ${replayClock(feedTime)} UTC` : `NSTR · simulated intraday USD / shares · ${running.get() ? "REPLAY RUNNING" : "REPLAY PAUSED"} · ${following.get() ? "FOLLOWING LATEST" : "BROWSING HISTORY"} · ${replayClock(feedTime)} UTC · 120× replay`}</Label>
    <Label x={16} y={55} color={colors.text} font={`${narrow ? 9 : 11}px sans-serif`}>{`${clock(selectedBar.time)} · O ${price(selectedBar.open)} H ${price(selectedBar.high)} L ${price(selectedBar.low)} C ${price(selectedBar.close)}`}</Label>
    <Label x={16} y={72} color={colors.defensive} font={`${narrow ? 9 : 11}px sans-serif`}>{`VWAP $${price(selectedStudy.vwap)} · Vol ${compact(selectedVolume)} · ${minutes}m bars`}</Label>
    {!narrow && <Label x={470} y={55} color={colors.growth}>{`Last $${price(latest.close)} · session VWAP $${price(lastStudy.vwap)}`}</Label>}
    {!narrow && <Label x={470} y={72} color={colors.muted}>VWAP = volume-weighted average price · estimated from minute bars</Label>}
    {controls.map((control,i) => <Button key={control.label} x={16+i*(narrow?54:80)} y={87} width={narrow?49:74} label={control.label} colors={colors} active={control.active} onActivate={control.activate} />)}
    {ranges.map((control,i) => <Button key={control.label} x={16+i*(narrow?65:80)} y={117} width={narrow?60:74} label={control.label} colors={colors} active={control.label === "Follow" && following.get()} onActivate={control.activate} />)}
    {!narrow && <Label x={520} y={95} color={colors.muted}>Play: 120× replay speed · Step: one displayed candle</Label>}
    {!narrow && <Label x={520} y={125} color={colors.muted}>Opening burst → selloff → recovery · yellow = session VWAP</Label>}
    <TradingTimeScale id="time" timestamps={timestamps} logicalRange={viewport} range={[left,right]}>
      <LinearScale id="price" domain={domain} range={[priceBottom,top]}>
        <Rectangle pointerEvents="none" style={{left,top,width:right-left,height:priceBottom-top,fill:colors.plot}} />
        <GridLines scale="price" direction="horizontal" span={[left,right]} tickValues={priceTicks} style={{stroke:colors.grid,strokeWidth:0.5}} />
        <Label x={left+4} y={top+4} color={colors.muted} font="9px sans-serif">Price (USD)</Label>
        <Group style={{translateX:left}}><Axis scale="price" position="left" tickValues={priceTicks} tickFormat={value => price(Number(value))} style={{stroke:colors.grid,strokeWidth:0.5,fill:colors.muted,font:"9px sans-serif"}} /></Group>
        <Clip style={{d:plotPath}}>
          <CandlestickSeries data={bars} time="time" open="open" high="high" low="low" close="close" xScale="time" yScale="price" inspection={inspection} pointerEvents="none" style={row => ({bandwidth:barWidth, body:{fill:row.close>=row.open?colors.growth:"#e77a8b",stroke:row.close>=row.open?colors.growth:"#e77a8b"},wick:{stroke:row.close>=row.open?colors.growth:"#e77a8b"},strokeWidth:0.8})} />
          <LineSeries data={studies} x={point => point.datum.time} y="vwap" defined={(point,i) => point.vwap !== null && (i === 0 || point.session === studies[i-1]!.session)} xScale="time" yScale="price" pointerEvents="none" style={{stroke:colors.defensive,strokeWidth:1.7}} />
          {following.get() && latest.close >= domain[0] && latest.close <= domain[1] && <ReferenceLine scale="price" direction="horizontal" value={latest.close} span={[left,right]} style={{stroke:colors.growth,strokeWidth:0.6}} />}
          {crossVisible && <ReferenceLine scale="time" direction="vertical" value={selectedBar.time} span={[top,priceBottom]} style={{stroke:colors.text,strokeWidth:0.6}} />}
        </Clip>
      </LinearScale>
      <LinearScale id="volume" domain={volumeDomain} range={[bottom,volumeTop]}>
        <Rectangle pointerEvents="none" style={{left,top:volumeTop,width:right-left,height:bottom-volumeTop,fill:colors.plot}} />
        <Label x={left+4} y={volumeTop+3} color={colors.muted} font="9px sans-serif">Volume (shares)</Label>
        <Group style={{translateX:left}}><Axis scale="volume" position="left" tickValues={linearTicks(volumeDomain,{count:2})} tickFormat={value => compact(Number(value))} style={{stroke:colors.grid,strokeWidth:0.5,fill:colors.muted,font:"9px sans-serif"}} /></Group>
        <Clip style={{d:volumePath}}><VolumeSeries data={volumeBars} time="time" volume="volume" xScale="time" yScale="volume" pointerEvents="none" style={row => ({width:barWidth,fill:row.close>=row.open?colors.growth:"#e77a8b",opacity:0.65})} /></Clip>
      </LinearScale>
      <Rectangle keyboardFocusable onMouseMove={select(false)} onMouseLeave={() => preview.set(undefined)} onClick={pin} onKeyDown={key} onWheel={wheel} onPointerDown={beginPointer} onPointerMove={movePointer} onPointerUp={endPointer} onPointerCancel={event => endPointer(event,true)} style={{left,top,width:right-left,height:bottom-top,fill:"transparent",cursor:"crosshair"}} />
      <Group style={{translateY:bottom-height}}><Axis scale="time" position="bottom" tickValues={dateTicks} tickFormat={value => range[1]-range[0]>390 ? `${new Date(Number(value)).getUTCDate()} Oct ${clock(Number(value))}` : clock(Number(value))} labelOverlap="allow" style={{stroke:colors.grid,strokeWidth:0.5,fill:colors.muted,font:"9px sans-serif"}} /></Group>
    </TradingTimeScale>
    <Label x={right} y={bottom+24} align="right" color={colors.muted} font={`${narrow?8:10}px sans-serif`}>{`${clock(timestamps[firstSlot]!)} – ${clock(timestamps[lastSlot]!)} UTC · ${formatNumber(range[1]-range[0],{maximumFractionDigits:1})} minutes wide`}</Label>
    <Label x={16} y={height-10} color={colors.muted} font={`${narrow?8:10}px sans-serif`}>{narrow ? "VWAP: volume-weighted average · simulated · drag / pinch" : "Simulated feed · current bar is partial · drag / wheel / pinch browse history · click to pin · arrows to inspect"}</Label>
  </>;
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <FocusManagement><Desk /></FocusManagement>, { viewport: "responsive" });
}
