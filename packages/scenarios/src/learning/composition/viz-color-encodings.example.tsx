import {
  FocusManagement,
  Rectangle,
  Text,
  pibbl,
  useLayoutBox,
  useSignal,
  type PibblController,
  type PibblPointerEvent,
} from "@pibbl/core";
import {
  SequentialColorScale,
  DivergingColorScale,
  ThresholdColorScale,
  useSequentialColorScale,
  useDivergingColorScale,
  useThresholdColorScale,
} from "@pibbl/core/viz";
// NOAA GML / Scripps Mauna Loa monthly CO2 means, ppm, Jan–Dec 1980.
// https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv
const values = [
  337.9, 338.34, 340.07, 340.93, 341.45, 341.36, 339.45, 337.67, 336.25, 336.14,
  337.3, 338.29,
];
const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const ink = "#17333d",
  muted = "#506b73";
// Explicit authored palettes; no claim of perceptual uniformity.
const sequential = ["#e5f0ed", "#12575a"] as const,
  diverging = ["#245c88", "#f5f1dd", "#b64c32"] as const,
  threshold = ["#245c88", "#e7bd66", "#b64c32"] as const;
function Label({
  x,
  y,
  text,
  color = ink,
  size = 10,
}: {
  x: number;
  y: number;
  text: string;
  color?: string;
  size?: number;
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
function textColor(color: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(color.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? "#000000" : "#ffffff";
}
type GridProps = {
  width: number;
  height: number;
  selected: number | null;
  select: (index: number | null) => void;
};
function Grid({
  width,
  height,
  selected,
  select,
  map,
}: { map: (value: number) => string } & GridProps) {
  const focused = useSignal(false),
    left = 14,
    top = 103,
    gap = 4,
    cellWidth = (width - 28 - 5 * gap) / 6,
    cellHeight = (height - 190) / 2;
  const choose = (event: PibblPointerEvent) => {
    const col = Math.min(
        5,
        Math.max(0, Math.floor((event.x - left) / (cellWidth + gap))),
      ),
      row = Math.min(
        1,
        Math.max(0, Math.floor((event.y - top) / (cellHeight + gap))),
      );
    select(row * 6 + col);
  };
  return (
    <>
      {values.map((value, index) => {
        const color = map(value),
          x = left + (index % 6) * (cellWidth + gap),
          y = top + Math.floor(index / 6) * (cellHeight + gap);
        return (
          <>
            <Rectangle
              key={`cell-${index}`}
              pointerEvents="none"
              style={{
                left: x,
                top: y,
                width: cellWidth,
                height: cellHeight,
                fill: color,
                stroke: selected === index ? ink : color,
                strokeWidth: selected === index ? 2 : 0,
              }}
            />
            <Label
              x={x + 3}
              y={y + 13}
              text={months[index]}
              color={textColor(color)}
            />
            <Label
              x={x + 3}
              y={y + 26}
              text={value.toFixed(2)}
              size={9}
              color={textColor(color)}
            />
          </>
        );
      })}
      <Rectangle
        keyboardFocusable
        onFocus={() => focused.set(true)}
        onBlur={() => focused.set(false)}
        onPointerMove={choose}
        onPointerDown={choose}
        onKeyDown={(event) => {
          const key = event.key;
          if (
            ![
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
              "Home",
              "End",
              "Escape",
            ].includes(key)
          )
            return;
          event.preventDefault();
          select(
            key === "Escape"
              ? null
              : key === "Home"
                ? 0
                : key === "End"
                  ? 11
                  : Math.max(
                      0,
                      Math.min(
                        11,
                        (selected ?? 0) +
                          (key === "ArrowLeft"
                            ? -1
                            : key === "ArrowRight"
                              ? 1
                              : key === "ArrowUp"
                                ? -6
                                : 6),
                      ),
                    ),
          );
        }}
        style={{
          left,
          top,
          width: width - 28,
          height: 2 * cellHeight + gap,
          fill: "transparent",
          stroke: focused.get() ? ink : "transparent",
          strokeWidth: 2,
          cursor: "crosshair",
        }}
      />
    </>
  );
}
function Ramp({
  width,
  height,
  map,
  stops,
}: {
  width: number;
  height: number;
  map: (v: number) => string;
  stops: readonly { value: number; color: string }[];
}) {
  const left = 14,
    w = width - 28,
    first = stops[0].value,
    last = stops[stops.length - 1].value;
  return (
    <>
      {Array.from({ length: 48 }, (_, i) => (
        <Rectangle
          key={i}
          pointerEvents="none"
          style={{
            left: left + (i * w) / 48,
            top: height - 65,
            width: w / 48 + 0.5,
            height: 9,
            fill: map(first + ((last - first) * i) / 47),
          }}
        />
      ))}
      {stops.map((stop, index) => (
        <Label
          x={left + ((w - 23) * index) / (stops.length - 1)}
          y={height - 43}
          text={String(stop.value)}
        />
      ))}
    </>
  );
}
function SequentialView(props: GridProps) {
  const scale = useSequentialColorScale("color").get();
  return (
    <>
      <Grid width={props.width} height={props.height} selected={props.selected} select={props.select} map={scale.map} />
      <Ramp width={props.width} height={props.height} map={scale.map} stops={scale.stops} />
      <Label
        x={14}
        y={props.height - 28}
        text="Color key · ppm · clamped endpoints"
      />
    </>
  );
}
function DivergingView(props: GridProps) {
  const scale = useDivergingColorScale("color").get();
  return (
    <>
      <Grid width={props.width} height={props.height} selected={props.selected} select={props.select} map={scale.map} />
      <Ramp width={props.width} height={props.height} map={scale.map} stops={scale.stops} />
      <Label
        x={14}
        y={props.height - 28}
        text="Center: 340 ppm (authored reference)"
      />
    </>
  );
}
function ThresholdView(props: GridProps) {
  const scale = useThresholdColorScale("color").get(),
    w = (props.width - 28) / scale.bands.length;
  return (
    <>
      <Grid width={props.width} height={props.height} selected={props.selected} select={props.select} map={scale.map} />
      {scale.bands.map((band, index) => (
        <>
          <Rectangle
            key={`band-${index}`}
            pointerEvents="none"
            style={{
              left: 14 + index * w,
              top: props.height - 65,
              width: w - 3,
              height: 9,
              fill: band.color,
            }}
          />
          <Label
            x={14 + index * w}
            y={props.height - 43}
            text={
              band.lower === undefined
                ? `<${band.upper}`
                : band.upper === undefined
                  ? `≥${band.lower}`
                  : `${band.lower}–<${band.upper}`
            }
          />
        </>
      ))}
      <Label
        x={14}
        y={props.height - 28}
        text="Authored buckets · equality enters upper band"
      />
    </>
  );
}
function Scene() {
  const { width, height } = useLayoutBox(),
    family = useSignal(0),
    wide = useSignal(false),
    selected = useSignal<number | null>(0),
    focus = useSignal<number | null>(null);
  const props = {
    width,
    height,
    selected: selected.get(),
    select: (i: number | null) => selected.set(i),
  };
  return (
    <>
      <Rectangle style={{ width, height, fill: "#f7faf9" }} />
      <Text
        pointerEvents="none"
        style={{
          left: 14,
          top: 24,
          font: "600 21px sans-serif",
          fill: ink,
          textBaseline: "alphabetic",
          when: [
            {
              query: { maxWidth: 400 },
              style: { font: "600 18px sans-serif" },
            },
            {
              query: { maxHeight: 350 },
              style: { font: "600 18px sans-serif" },
            },
          ],
        }}
      >
        Monthly CO₂ in color
      </Text>
      {[
        "Sequential",
        "Diverging",
        "Threshold",
        wide.get() ? "Narrow" : "Widen",
      ].map((label, index) => {
        const activate = () =>
          index === 3 ? wide.set(!wide.get()) : family.set(index);
        return (
          <>
            <Rectangle
              key={`control-${index}`}
              keyboardFocusable
              onFocus={() => focus.set(index)}
              onBlur={() => focus.set(null)}
              onClick={activate}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  activate();
                }
              }}
              style={{
                left: 14 + index * 75,
                top: 35,
                width: 69,
                height: 44,
                fill: index === family.get() ? "#d5e8e5" : "white",
                stroke: focus.get() === index ? ink : "#b7cdd0",
                strokeWidth: focus.get() === index ? 2 : 1,
                cornerRadius: 4,
                cursor: "pointer",
              }}
            />
            <Label x={18 + index * 75} y={62} text={label} />
          </>
        );
      })}
      <Label
        x={14}
        y={94}
        text={
          selected.get() === null
            ? "Select a month · exact observed ppm"
            : `${months[selected.get()!]} 1980 · ${values[selected.get()!].toFixed(2)} ppm`
        }
      />
      {family.get() === 0 ? (
        <SequentialColorScale
          id="color"
          domain={wide.get() ? [330, 345] : [336, 342]}
          colors={sequential}
        >
          <SequentialView width={props.width} height={props.height} selected={props.selected} select={props.select} />
        </SequentialColorScale>
      ) : family.get() === 1 ? (
        <DivergingColorScale
          id="color"
          domain={wide.get() ? [330, 340, 345] : [336, 340, 342]}
          colors={diverging}
        >
          <DivergingView width={props.width} height={props.height} selected={props.selected} select={props.select} />
        </DivergingColorScale>
      ) : (
        <ThresholdColorScale
          id="color"
          thresholds={wide.get() ? [337, 341] : [338, 340]}
          colors={threshold}
        >
          <ThresholdView width={props.width} height={props.height} selected={props.selected} select={props.select} />
        </ThresholdColorScale>
      )}
      <Label
        x={14}
        y={height - 11}
        text="NOAA / Scripps · Mauna Loa · 1980 · ppm"
        color={muted}
      />
    </>
  );
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(
    canvas,
    <FocusManagement>
      <Scene />
    </FocusManagement>,
    { viewport: "responsive" },
  );
}
