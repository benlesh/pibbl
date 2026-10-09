import {
  Circle,
  Clip,
  FocusManagement,
  Rectangle,
  Text,
  pibbl,
  useLayoutBox,
  useSignal,
  type PibblController,
  type PibblLogicalMouseEvent,
  type PibblNode,
} from "@pibbl/core";
import {
  CandlestickSeries,
  LinearScale,
  TradingTimeScale,
  LineSeries,
  PlotSeries,
  LogScale,
  ReferenceLine,
  GridLines,
  formatNumber,
  visibleOhlcPriceExtent,
  padLinearDomain,
  ScaleAdjust,
  VolumeSeries,
} from "@pibbl/core/viz";
import {
  useCandleInspection,
  nearestRecordedCandleX,
  useVolumeInspection,
  withInspection,
} from "@pibbl/core/viz/inspection";
// Fixed simulated weekdays and deterministic price regimes. No live market feed.
const start = Date.UTC(2026, 0, 5),
  day = 86_400_000;
const closeAt = (i: number) =>
  120 +
  i * 0.065 +
  Math.sin(i * 0.33) * 3.4 +
  Math.sin(i * 0.86) * 0.9 -
  (i >= 27 ? 2.8 : 0) +
  (i >= 43 ? 2.1 : 0);
const bars = Array.from({ length: 56 }, (_, i) => {
  const close = closeAt(i),
    open = closeAt(i - 1) + Math.sin(i * 0.71) * 0.25;
  return {
    time: start + (i + Math.floor(i / 5) * 2) * day,
    open,
    close,
    high: Math.max(open, close) + 0.5 + Math.abs(Math.sin(i * 0.77)) * 0.6,
    low: Math.min(open, close) - 0.5 - Math.abs(Math.cos(i * 0.59)) * 0.6,
    // One explicit missing observation demonstrates that a volume gap is not zero.
    volume:
      i === 18
        ? null
        : 900000 +
          Math.sin(i * 0.68) ** 2 * 1200000 +
          (i % 11 === 5 ? 1600000 : 0),
  };
});
const timestamps = bars.map((bar) => bar.time);
const slots = new Map(timestamps.map((time, index) => [time, index]));
const volumeHigh = 4000000;
const priceText = (value: number) =>
  formatNumber(value, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const priceTick = (value: number) =>
  formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const volumeText = (value: number | null) =>
  value === null
    ? "— shares"
    : formatNumber(value, {
        notation: "compact",
        maximumFractionDigits: 1,
        suffix: " shares",
      });
const dateText = (time: number) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(time);
function Label({
  x,
  y,
  children,
  color = "#91a2ba",
  font = "10px sans-serif",
  align = "left",
}: {
  x: number;
  y: number;
  children: string;
  color?: string;
  font?: string;
  align?: CanvasTextAlign;
}): PibblNode {
  return (
    <Text
      pointerEvents="none"
      style={{ left: x, top: y, font, fill: color, textAlign: align }}
    >
      {children}
    </Text>
  );
}
// Each lesson owns its palette and signal; there is no global theme subscription.
const darkPalette = {
  background: "#0d1422",
  plot: "#101a2b",
  text: "#dbe6f1",
  muted: "#91a2ba",
  grid: "#202d42",
  up: "#29c7ab",
  down: "#ed6975",
  highlight: "#1c3049",
  secondary: "#c7d5e8",
  line: "#788ba7",
};
const lightPalette = {
  background: "#f6f8fb",
  plot: "#ffffff",
  text: "#18283d",
  muted: "#586b82",
  grid: "#e6edf5",
  up: "#00876e",
  down: "#cb4057",
  highlight: "#e2ebf6",
  secondary: "#30445e",
  line: "#657a95",
};
function Button({
  x,
  y = 80,
  width,
  label,
  active = false,
  colors,
  onActivate,
}: {
  x: number;
  y?: number;
  width: number;
  label: string;
  active?: boolean;
  colors: typeof darkPalette;
  onActivate: () => void;
}) {
  return (
    <>
      <Rectangle
        keyboardFocusable
        onClick={onActivate}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onActivate();
          }
        }}
        style={{
          left: x,
          top: y,
          width,
          height: 24,
          fill: active ? colors.highlight : colors.plot,
          stroke: active ? colors.line : colors.grid,
          strokeWidth: 0.5,
          cursor: "pointer",
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
function Session() {
  const light = useSignal(false),
    log = useSignal(false);
  const viewport = useSignal<readonly [number, number]>([
    -0.5,
    bars.length - 0.5,
  ]);
  const manual = useSignal<readonly [number, number] | undefined>(undefined);
  const hovered = useSignal<number | undefined>(undefined),
    pinned = useSignal<number | undefined>(undefined);
  const colors = light.get() ? lightPalette : darkPalette;
  const { width: w, height: h } = useLayoutBox();
  const left = 16,
    right = w - 78,
    pw = right - left,
    top = 116,
    bottom = h - 34;
  const priceBottom = top + (bottom - top - 20) * 0.72,
    volumeTop = priceBottom + 20;
  const visibleRange = viewport.get(),
    logarithmic = log.get();
  const visibleBars = bars.filter(
    (_, i) => i >= Math.min(...visibleRange) && i <= Math.max(...visibleRange),
  );
  const extent = visibleOhlcPriceExtent(bars, {
    time: "time",
    open: "open",
    high: "high",
    low: "low",
    close: "close",
    positionAtTime: (time) => slots.get(time),
    visibleRange,
  });
  const logUnavailable = logarithmic && extent !== undefined && extent[0] <= 0;
  const automatic =
    extent && !logUnavailable
      ? logarithmic
        ? (padLinearDomain([Math.log(extent[0]), Math.log(extent[1])], {
            padding: 0.08,
            minimumSpan: 0.02,
          }).map(Math.exp) as [number, number])
        : padLinearDomain(extent, { padding: 0.08, minimumSpan: 0.02 })
      : undefined;
  const domain = manual.get() ?? automatic;
  const activeTime =
    pinned.get() ?? hovered.get() ?? timestamps[timestamps.length - 1]!;
  const active = bars.find((row) => row.time === activeTime)!;
  const selectedVisible = visibleBars.some((row) => row.time === activeTime);
  const latest = bars[bars.length - 1]!,
    previous = bars[bars.length - 2]!;
  const candles = useCandleInspection({
    data: visibleBars,
    time: "time",
    open: "open",
    high: "high",
    low: "low",
    close: "close",
  });
  const volumes = useVolumeInspection({
    data: visibleBars,
    time: "time",
    volume: "volume",
  });
  const snap = (pin: boolean, volume: boolean) =>
    withInspection((event: PibblLogicalMouseEvent, context) => {
      const rendered = context.rendered(candles);
      const volumeRendered = volume ? context.rendered(volumes) : undefined;
      if (!rendered || (volume && !volumeRendered)) return;
      const time = (volumeRendered ?? rendered).timeAtRoot({
        x: event.x,
        y: event.y,
      });
      if (time === undefined) return;
      const hit = context.request(nearestRecordedCandleX, rendered, { time });
      if (!hit) return;
      if (pin) {
        pinned.set(pinned.get() === hit.time ? undefined : hit.time);
        hovered.set(undefined);
      } else hovered.set(hit.time);
    });
  const step = (key: string) => {
    if (key === "Escape") {
      pinned.set(undefined);
      hovered.set(undefined);
      return;
    }
    if (
      !["ArrowLeft", "ArrowRight", "Home", "End", "+", "-", "="].includes(key)
    )
      return;
    if (["+", "-", "="].includes(key)) {
      if (manual.get() && domain) {
        const middle = (domain[0] + domain[1]) / 2;
        const half = ((domain[1] - domain[0]) / 2) * (key === "-" ? 1.2 : 0.8);
        if (!logarithmic || middle - half > 0)
          manual.set([middle - half, middle + half]);
      }
      return;
    }
    if (!visibleBars.length) return;
    const current = visibleBars.findIndex((row) => row.time === activeTime);
    const index =
      key === "Home"
        ? 0
        : key === "End"
          ? visibleBars.length - 1
          : Math.max(
              0,
              Math.min(
                visibleBars.length - 1,
                (current < 0 ? visibleBars.length - 1 : current) +
                  (key === "ArrowLeft" ? -1 : 1),
              ),
            );
    pinned.set(visibleBars[index]!.time);
    hovered.set(undefined);
  };
  const keyboard = (event: { key: string; preventDefault(): void }) => {
    if (
      [
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
        "Escape",
        "+",
        "-",
        "=",
      ].includes(event.key)
    ) {
      event.preventDefault();
      step(event.key);
    }
  };
  const toggleManual = () => manual.set(manual.get() ? undefined : domain);
  const changePresentation = () => {
    log.update((value) => !value);
    // A manually chosen positive price domain remains a price domain in either provider.
  };
  const markWidth = Math.min(
    8,
    (pw / Math.max(1, Math.abs(visibleRange[1] - visibleRange[0]))) * 0.66,
  );
  const pricePath = new Path2D();
  pricePath.rect(left, top, pw, Math.max(1, priceBottom - top));
  const volumePath = new Path2D();
  volumePath.rect(left, volumeTop, pw, Math.max(1, bottom - volumeTop));
  const visibleGuide = (value: number) =>
    domain && value >= Math.min(...domain) && value <= Math.max(...domain);
  const ticks = domain
    ? Array.from({ length: h < 300 ? 3 : 5 }, (_, i) => {
        const fraction = i / (h < 300 ? 2 : 4);
        if (fraction === 0) return domain[0];
        if (fraction === 1) return domain[1];
        return logarithmic
          ? Math.exp(
              Math.log(domain[0]) +
                fraction * (Math.log(domain[1]) - Math.log(domain[0])),
            )
          : domain[0] + fraction * (domain[1] - domain[0]);
      })
    : [];
  const readout = (
    <>
      <Label x={16} y={35} color={colors.secondary}>
        {dateText(activeTime)}
      </Label>
      <Label x={w - 16} y={35} align="right" color={colors.muted}>
        {pinned.get() !== undefined ? "Pinned" : "Inspect"}
      </Label>
      <Label
        x={16}
        y={51}
        color={active.close >= active.open ? colors.up : colors.down}
        font="10px monospace"
      >
        {`O ${priceTick(active.open)}  H ${priceTick(active.high)}  L ${priceTick(active.low)}  C ${priceTick(active.close)}`}
      </Label>
      {w <= 600 && (
        <Label
          x={w - 16}
          y={66}
          align="right"
          color={colors.muted}
          font="9px monospace"
        >{`Prior ${priceText(previous.close)}`}</Label>
      )}
      <Label x={16} y={66} color={colors.muted} font="9px monospace">
        {`USD · ${volumeText(active.volume)}${w > 600 ? ` · Close ${priceText(active.close)}` : ""}`}
      </Label>
    </>
  );
  const priceContent = (
    <>
      <GridLines
        scale="price"
        direction="horizontal"
        span={[left, right]}
        tickValues={ticks}
        style={{ stroke: colors.grid, strokeWidth: 0.5 }}
      />
      {ticks.map((value) => (
        <ScaleAdjust key={value} yScale="price" y={value}>
          <Label x={right + 8} y={-4} color={colors.muted} font="9px monospace">
            {priceTick(value)}
          </Label>
        </ScaleAdjust>
      ))}
      <Clip style={{ d: pricePath }}>
        <LineSeries
          data={visibleBars}
          x="time"
          y="close"
          xScale="session"
          yScale="price"
          pointerEvents="none"
          style={{ stroke: colors.line, strokeWidth: 0.7, opacity: 0.3 }}
        />
        <CandlestickSeries
          data={visibleBars}
          time="time"
          open="open"
          high="high"
          low="low"
          close="close"
          xScale="session"
          yScale="price"
          inspection={candles}
          pointerEvents="none"
          style={(datum) => ({
            bandwidth: markWidth,
            body: { fill: datum.close >= datum.open ? colors.up : colors.down },
            wick: {
              stroke: datum.close >= datum.open ? colors.up : colors.down,
              strokeWidth: 1,
            },
          })}
        />
        {visibleGuide(previous.close) && (
          <ReferenceLine
            scale="price"
            direction="horizontal"
            value={previous.close}
            span={[left, right]}
            style={{ stroke: colors.line, strokeWidth: 0.5, opacity: 0.7 }}
          />
        )}
        {visibleGuide(latest.close) && (
          <ReferenceLine
            scale="price"
            direction="horizontal"
            value={latest.close}
            span={[left, right]}
            style={{ stroke: colors.up, strokeWidth: 0.6 }}
          />
        )}
        {selectedVisible && visibleGuide(active.close) && (
          <>
            <ReferenceLine
              scale="price"
              direction="horizontal"
              value={active.close}
              span={[left, right]}
              style={{
                stroke: colors.secondary,
                strokeWidth: 0.5,
                opacity: 0.65,
              }}
            />
            <ScaleAdjust
              xScale="session"
              x={activeTime}
              yScale="price"
              y={active.close}
            >
              <Circle
                pointerEvents="none"
                style={{
                  radius: 2.5,
                  fill: colors.plot,
                  stroke: colors.text,
                  strokeWidth: 1,
                }}
              />
            </ScaleAdjust>
          </>
        )}
        <PlotSeries
          data={visibleBars.filter((row) => row.time === bars[25]!.time)}
          x="time"
          y="close"
          xScale="session"
          yScale="price"
          render={() => (
            <Circle
              pointerEvents="none"
              style={{ radius: 2, fill: colors.text }}
            />
          )}
        />
      </Clip>
      {visibleGuide(latest.close) && (
        <ScaleAdjust yScale="price" y={latest.close}>
          <Rectangle
            pointerEvents="none"
            style={{
              left: right + 2,
              top: -7,
              width: 68,
              height: 19,
              fill: colors.up,
            }}
          />
          <Label
            x={right + 36}
            y={-2}
            align="center"
            color={colors.plot}
            font="bold 10px monospace"
          >
            {priceText(latest.close)}
          </Label>
        </ScaleAdjust>
      )}
      <Rectangle
        keyboardFocusable
        onMouseMove={snap(false, false)}
        onMouseLeave={() => hovered.set(undefined)}
        onClick={snap(true, false)}
        onKeyDown={keyboard}
        style={{
          left,
          top,
          width: pw,
          height: Math.max(1, priceBottom - top),
          fill: "transparent",
          cursor: "crosshair",
        }}
      />
    </>
  );
  const PriceScale = logarithmic ? LogScale : LinearScale;
  return (
    <>
      <Rectangle
        pointerEvents="none"
        style={{ width: w, height: h, fill: colors.background }}
      />
      <Label x={16} y={13} color={colors.text} font="bold 13px sans-serif">
        Market Session
      </Label>
      {w > 500 && (
        <Label x={w - 92} y={16} align="right" color={colors.muted}>
          Daily · simulation
        </Label>
      )}
      {readout}
      <Button
        x={16}
        width={48}
        label="All"
        active={visibleRange[0] === -0.5 && visibleRange[1] === bars.length - 0.5}
        colors={colors}
        onActivate={() => viewport.set([-0.5, bars.length - 0.5])}
      />
      <Button
        x={70}
        width={56}
        label="Recent"
        active={visibleRange[0] === 35.5}
        colors={colors}
        onActivate={() => viewport.set([35.5, 55.5])}
      />
      <Button
        x={132}
        width={56}
        label="Earlier"
        active={visibleRange[0] === -0.5 && visibleRange[1] === 19.5}
        colors={colors}
        onActivate={() => viewport.set([-0.5, 19.5])}
      />
      <Button
        x={194}
        width={60}
        label={manual.get() ? "Manual" : "Auto"}
        active={manual.get() !== undefined}
        colors={colors}
        onActivate={toggleManual}
      />
      <Button
        x={260}
        width={64}
        label={logarithmic ? "Log" : "Linear"}
        colors={colors}
        onActivate={changePresentation}
      />
      {w > 650 && domain && (
        <Label
          x={right}
          y={87}
          align="right"
          font="9px monospace"
          color={colors.muted}
        >
          {`Visible range ${priceText(domain[0])}–${priceText(domain[1])}`}
        </Label>
      )}
      <Rectangle
        pointerEvents="none"
        style={{
          left,
          top,
          width: pw,
          height: Math.max(1, bottom - top),
          fill: colors.plot,
        }}
      />
      <TradingTimeScale
        id="session"
        timestamps={timestamps}
        logicalRange={viewport}
        range={[left, right]}
      >
        {domain && !logUnavailable ? (
          <PriceScale id="price" domain={domain} range={[priceBottom, top]}>
            {priceContent}
          </PriceScale>
        ) : (
          <Label x={left + 10} y={top + 20} color={colors.text}>
            {logUnavailable
              ? "Log unavailable: visible low ≤ 0"
              : "No observations in this window"}
          </Label>
        )}
        <Label
          x={left}
          y={priceBottom + 6}
          color={colors.muted}
          font="8px sans-serif"
        >
          VOLUME · shares
        </Label>
        <LinearScale
          id="volume"
          domain={[0, volumeHigh]}
          range={[bottom, volumeTop]}
        >
          <GridLines
            scale="volume"
            direction="horizontal"
            span={[left, right]}
            tickValues={[0, volumeHigh]}
            style={{ stroke: colors.grid, strokeWidth: 0.5 }}
          />
          <Clip style={{ d: volumePath }}>
            <VolumeSeries
              data={visibleBars}
              time="time"
              volume="volume"
              xScale="session"
              yScale="volume"
              inspection={volumes}
              pointerEvents="none"
              style={(row) => ({
                width: markWidth,
                fill: row.close >= row.open ? colors.up : colors.down,
                opacity: 0.7,
              })}
            />
          </Clip>
          <Rectangle
            keyboardFocusable
            onMouseMove={snap(false, true)}
            onMouseLeave={() => hovered.set(undefined)}
            onClick={snap(true, true)}
            onKeyDown={keyboard}
            style={{
              left,
              top: volumeTop,
              width: pw,
              height: Math.max(1, bottom - volumeTop),
              fill: "transparent",
              cursor: "crosshair",
            }}
          />
        </LinearScale>
        {selectedVisible && (
          <ReferenceLine
            scale="session"
            direction="vertical"
            value={activeTime}
            span={[top, bottom]}
            style={{
              stroke: colors.secondary,
              strokeWidth: 0.6,
              opacity: 0.75,
            }}
          />
        )}
        {[
          visibleBars[0],
          visibleBars[Math.floor(visibleBars.length / 2)],
          visibleBars[visibleBars.length - 1],
        ]
          .filter(Boolean)
          .map((row, i) => (
            <ScaleAdjust
              key={`${i}:${row!.time}`}
              xScale="session"
              x={row!.time}
            >
              <Label
                x={0}
                y={bottom + 5}
                align={i === 0 ? "left" : i === 2 ? "right" : "center"}
                color={colors.muted}
                font="8px sans-serif"
              >
                {new Intl.DateTimeFormat("en-GB", {
                  day: "2-digit",
                  month: "short",
                  timeZone: "UTC",
                }).format(row!.time)}
              </Label>
            </ScaleAdjust>
          ))}
      </TradingTimeScale>
      <Label x={16} y={h - 12} color={colors.muted} font="8px sans-serif">
        {w > 600
          ? `${selectedVisible ? "Move · tap/click pin · ← → step · Esc clear" : "Selection outside window"} · ${manual.get() ? "Manual: +/− adjusts" : "Auto"} · Last ${priceText(latest.close)} · Prior ${priceText(previous.close)}`
          : `${selectedVisible ? "Tap pin · arrows step · Esc clear" : "Selection outside window"} · simulation`}
      </Label>
      <Button
        x={w - 76}
        y={10}
        width={60}
        label={light.get() ? "Light" : "Dark"}
        colors={colors}
        onActivate={() => light.update((value) => !value)}
      />
    </>
  );
}
/** Mount the responsive financial workstation; disposal releases events and captures. */
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(
    canvas,
    <FocusManagement>
      <Session />
    </FocusManagement>,
    { viewport: "responsive" },
  );
}
