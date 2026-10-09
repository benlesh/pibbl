import {
  Circle,
  Clip,
  FocusManagement,
  Rectangle,
  Text,
  pibbl,
  useLayoutBox,
  useRectPath,
  useSignal,
  type PibblController,
  type PibblLogicalMouseEvent,
  type PibblNode,
} from "@pibbl/core";
import {
  LineSeries,
  LinearScale,
  PlotSeries,
  ScaleAdjust,
  TradingTimeScale,
  useTradingTimeScale,
} from "@pibbl/core/viz";
import {
  useNumericInspection,
  nearestRecordedX,
  withInspection,
  anchorInsideClips,
} from "@pibbl/core/viz/inspection";
const quotes = [
  {
    time: Date.UTC(2026, 9, 2, 16),
    price: 101,
    label: "Fri · 02 Oct 16:00 UTC · $101.00",
  },
  {
    time: Date.UTC(2026, 9, 5, 9, 30),
    price: 104,
    label: "Mon · 05 Oct 09:30 UTC · $104.00",
  },
  {
    time: Date.UTC(2026, 9, 6, 9, 30),
    price: 103,
    label: "Tue · 06 Oct 09:30 UTC · $103.00",
  },
];
const timestamps = quotes.map((q) => q.time);
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
function Dates({
  left,
  right,
  bottom,
  color,
}: {
  left: number;
  right: number;
  bottom: number;
  color: string;
}) {
  const scale = useTradingTimeScale("session").get();
  return (
    <>
      {quotes.map((quote, i) => {
        const x = scale.map(quote.time);
        return x >= left + 12 && x <= right - 12 ? (
          <Label
            color={color}
            x={x}
            y={bottom + 6}
            align="center"
            font="9px sans-serif"
          >
            {["Fri 02 Oct", "Mon 05 Oct", "Tue 06 Oct"][i]!}
          </Label>
        ) : null;
      })}
    </>
  );
}
// Each lesson owns its palette and signal; there is no global theme subscription.
const darkPalette = {
  background: "#0d1422",
  plot: "#101a2b",
  text: "#dbe6f1",
  muted: "#91a2ba",
  grid: "#202d42",
  accent: "#738ef1",
  highlight: "#1c3049",
  control: "#1c2b44",
  controlBorder: "#344767",
};
const lightPalette = {
  background: "#f6f8fb",
  plot: "#ffffff",
  text: "#18283d",
  muted: "#586b82",
  grid: "#e6edf5",
  accent: "#4465cc",
  highlight: "#e2ebf6",
  control: "#e5ecf7",
  controlBorder: "#bac9dd",
};
function Chart() {
  const light = useSignal(false);
  const colors = light.get() ? lightPalette : darkPalette;
  const { width: w, height: h } = useLayoutBox(),
    left = 16,
    right = w - 52,
    top = 74,
    bottom = h - 72;
  const viewport = useSignal<readonly [number, number]>([-0.5, 2.5]),
    hover = useSignal(1);
  const inspection = useNumericInspection({
      data: quotes,
      x: "time",
      y: "price",
    }),
    clip = useRectPath(left, top, right - left, bottom - top);
  const pan = (amount: number) =>
    viewport.update(([first, last]) => [first + amount, last + amount]);
  const move = withInspection((event: PibblLogicalMouseEvent, context) => {
    const rendered = context.rendered(inspection);
    if (!rendered) return;
    const time = rendered.domainXAtRoot({ x: event.x, y: event.y });
    if (time === undefined) return;
    const hit = context.request(nearestRecordedX, rendered, {
      domainX: time,
      filter: anchorInsideClips,
    });
    if (hit) hover.set(hit.sourceIndex);
  });
  return (
    <>
      <Rectangle style={{ width: w, height: h, fill: colors.background }} />
      <Label x={16} y={14} color={colors.text} font="bold 13px sans-serif">
        Trading-time observations
      </Label>
      <Label color={colors.muted} x={16} y={33}>
        Equal slots · simulated quotes
      </Label>
      <Label x={16} y={50} color={colors.text} font="10px monospace">
        {quotes[hover.get()]!.label}
      </Label>
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
      {[100, 101, 102, 103, 104, 105].map((value) => {
        const y = bottom - ((value - 100) / 5) * (bottom - top);
        return (
          <>
            <Rectangle
              pointerEvents="none"
              style={{
                left,
                top: y,
                width: right - left,
                height: 0.5,
                fill: colors.grid,
              }}
            />
            <Label
              color={colors.muted}
              x={right + 8}
              y={y - 5}
              font="9px monospace"
            >
              {value.toFixed(2)}
            </Label>
          </>
        );
      })}
      <TradingTimeScale
        id="session"
        timestamps={timestamps}
        logicalRange={viewport}
        range={[left, right]}
      >
        <LinearScale id="price" domain={[100, 105]} range={[bottom, top]}>
          <Clip style={{ d: clip }}>
            <ScaleAdjust xScale="session" x={quotes[hover.get()]!.time}>
              <Rectangle
                pointerEvents="none"
                style={{
                  left: -10,
                  top,
                  width: 20,
                  height: bottom - top,
                  fill: colors.highlight,
                }}
              />
            </ScaleAdjust>
            <LineSeries
              data={quotes}
              x="time"
              y="price"
              xScale="session"
              yScale="price"
              inspection={inspection}
              pointerEvents="none"
              style={{ stroke: colors.accent, strokeWidth: 1.6 }}
            />
            <PlotSeries
              data={quotes}
              x="time"
              y="price"
              xScale="session"
              yScale="price"
              render={(_, index) => (
                <Circle
                  pointerEvents="none"
                  style={{
                    radius: hover.get() === index ? 4 : 3,
                    fill: hover.get() === index ? colors.text : colors.accent,
                    stroke: colors.plot,
                    strokeWidth: 2,
                  }}
                />
              )}
            />
          </Clip>
          <Rectangle
            keyboardFocusable
            onMouseMove={move}
            onClick={move}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                event.preventDefault();
                pan(event.key === "ArrowRight" ? 0.5 : -0.5);
              }
            }}
            style={{
              left,
              top,
              width: right - left,
              height: bottom - top,
              fill: "transparent",
              cursor: "crosshair",
            }}
          />
          <Dates
            color={colors.muted}
            left={left}
            right={right}
            bottom={bottom}
          />
        </LinearScale>
      </TradingTimeScale>
      <Rectangle
        keyboardFocusable
        onClick={() => pan(0.5)}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "Enter") {
            event.preventDefault();
            pan(0.5);
          }
        }}
        style={{
          left: 16,
          top: h - 44,
          width: 134,
          height: 26,
          fill: colors.control,
          stroke: colors.controlBorder,
          strokeWidth: 0.5,
          cursor: "pointer",
        }}
      />
      <Label x={25} y={h - 36} color={colors.text}>
        Pan +0.5 slot →
      </Label>
      <Rectangle
        keyboardFocusable
        onClick={() => viewport.set([-0.5, 2.5])}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            viewport.set([-0.5, 2.5]);
          }
        }}
        style={{
          left: 158,
          top: h - 44,
          width: 54,
          height: 26,
          fill: colors.plot,
          stroke: colors.controlBorder,
          strokeWidth: 0.5,
          cursor: "pointer",
        }}
      />
      <Label color={colors.muted} x={168} y={h - 36}>
        Reset
      </Label>
      {w > 520 && (
        <Label
          color={colors.muted}
          x={right}
          y={h - 35}
          align="right"
        >{`Viewport slots: ${viewport.get()[0]} to ${viewport.get()[1]}`}</Label>
      )}
      <Label color={colors.muted} x={16} y={h - 11} font="8px sans-serif">
        {w > 520
          ? "Friday → Monday: 65.5 elapsed hours, one observation slot · no calendar inferred"
          : "Fri → Mon: 65.5h · one slot · simulated source"}
      </Label>
      <Rectangle
        keyboardFocusable
        onClick={() => light.update((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            light.update((value) => !value);
          }
        }}
        style={{
          left: w - 76,
          top: 10,
          width: 60,
          height: 24,
          fill: colors.plot,
          stroke: colors.muted,
          strokeWidth: 0.5,
          cursor: "pointer",
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: w - 46,
          top: 17,
          font: "10px sans-serif",
          fill: colors.text,
          textAlign: "center",
        }}
      >
        {light.get() ? "Light" : "Dark"}
      </Text>
    </>
  );
}
/** Mount a responsive trading-time lesson with application-owned viewport and lazy mouse inspection. */
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(
    canvas,
    <FocusManagement>
      <Chart />
    </FocusManagement>,
    { viewport: "responsive" },
  );
}
