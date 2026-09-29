import {
  Absolute,
  Circle,
  Group,
  Line,
  Rectangle,
  Text,
  batch,
  crc,
  useLayoutBox,
  useSignal,
  type CRCController,
  type BoxStyle,
  type LayoutItemStyle,
  type WritableSignal,
} from "@crc/core";
import {
  Axis,
  LineSeries,
  PointSeries,
  PlotSeries,
  Scale,
  nearestPoint,
  useScale,
} from "@crc/viz";

type Row = {
  id: string;
  x: number;
  y: number | null;
  label: string;
  color: string;
};
type PanelSnapshot = {
  width: number;
  height: number;
  anchors: readonly { id: string; x: number; y: number }[];
};
interface Fixture {
  rows?: WritableSignal<readonly Row[]>;
  selected?: WritableSignal<string>;
  clicks?: WritableSignal<number>;
  onPanel?: (index: number, panel: PanelSnapshot) => void;
  onMark?: (id: string, count: number) => void;
  onReading?: (selected: string, clicks: number) => void;
}
const seed: readonly Row[] = [
  { id: "a", x: 8, y: 22, label: "ALPHA", color: "#3972e9" },
  { id: "b", x: 16, y: 40, label: "BETA", color: "#3972e9" },
  { id: "c", x: 28, y: 62, label: "GAMMA", color: "#e77939" },
  { id: "d", x: 41, y: 43, label: "DELTA", color: "#3972e9" },
  { id: "gap", x: 49, y: null, label: "GAP", color: "#3972e9" },
  { id: "e", x: 56, y: 71, label: "EPSILON", color: "#3972e9" },
  { id: "f", x: 58, y: 73, label: "ZETA", color: "#e77939" },
  { id: "g", x: 72, y: 54, label: "ETA", color: "#3972e9" },
  { id: "h", x: 86, y: 82, label: "THETA", color: "#3972e9" },
];
const ink = "#182c42",
  muted = "#62758b";
type Controls = {
  rows: WritableSignal<readonly Row[]>;
  selected: WritableSignal<string>;
  clicks: WritableSignal<number>;
  fixture: Fixture;
};
function step(controls: Controls, delta: number) {
  const rows = controls.rows.get().filter((d) => d.y !== null);
  if (!rows.length) return;
  const index = rows.findIndex((d) => d.id === controls.selected.get());
  controls.selected.set(rows[(index + delta + rows.length) % rows.length].id);
}
function Marker({ datum, controls }: { datum: Row; controls: Controls }) {
  const count = useSignal(0);
  const selected = controls.selected.get() === datum.id;
  controls.fixture.onMark?.(datum.id, count.get());
  return (
    <Group>
      <Rectangle
        style={{
          x: -6,
          y: -6,
          width: 12,
          height: 12,
          fill: selected ? "#e77939" : "#fff",
          stroke: datum.color,
          strokeWidth: 2,
          cursor: "pointer",
        }}
        onPointerDown={() =>
          batch(() => {
            count.update((v) => v + 1);
            controls.clicks.update((v) => v + 1);
            controls.selected.set(datum.id);
          })
        }
      />
      <Text
        pointerEvents="none"
        style={{
          x: 10,
          y: -12,
          fill: selected ? ink : muted,
          font: "10px sans-serif",
        }}
      >{`${datum.label} · ${count.get()}`}</Text>
    </Group>
  );
}
function Plot({
  controls,
  index,
  origin,
}: {
  controls: Controls;
  index: number;
  origin: { x: number; y: number };
}) {
  const xs = useScale("x").get(),
    ys = useScale("y").get();
  const data = controls.rows.get();
  const selected = controls.selected.get();
  const anchors = data
    .filter((d) => d.y !== null)
    .map((d) => ({
      id: d.id,
      x: origin.x + xs.map(d.x),
      y: origin.y + ys.map(d.y!),
    }));
  controls.fixture.onPanel?.(index, {
    width: xs.frame.width,
    height: ys.frame.height,
    anchors,
  });
  const inspect = (x: number, y: number) => {
    const found = nearestPoint(
      data,
      { x: x - origin.x, y: y - origin.y },
      { x: "x", y: "y", xScale: xs, yScale: ys, maxDistance: 40 },
    );
    if (found) controls.selected.set(found.datum.id);
  };
  return (
    <Group>
      <Rectangle
        style={{
          width: xs.frame.width,
          height: ys.frame.height,
          fill: "#fff",
          cursor: "crosshair",
        }}
        onPointerMove={(e) => {
          if (e.pointerType !== "touch") inspect(e.x, e.y);
        }}
        onPointerDown={(e) => inspect(e.x, e.y)}
      />
      {[20, 40, 60, 80].map((value) => (
        <Line
          key={value}
          pointerEvents="none"
          style={{
            coords: [
              [0, ys.map(value)],
              [xs.frame.width, ys.map(value)],
            ],
            stroke: "#e9eef4",
            strokeWidth: 1,
          }}
        />
      ))}
      <Axis
        scale="x"
        position="bottom"
        tickCount={6}
        style={{ stroke: "#b8c6d4", fill: muted, font: "10px sans-serif" }}
      />
      <Axis
        scale="y"
        position="left"
        tickCount={6}
        style={{ stroke: "#b8c6d4", fill: muted, font: "10px sans-serif" }}
      />
      {index === 1 && (
        <LineSeries
          data={data}
          x="x"
          y="y"
          xScale="x"
          yScale="y"
          pointerEvents="none"
          style={{ stroke: "#94aac4", strokeWidth: 2 }}
        />
      )}
      <PointSeries
        data={data}
        x="x"
        y="y"
        xScale="x"
        yScale="y"
        pointerEvents="none"
        style={
          index === 0
            ? (d) => ({
                radius: d.id === selected ? 10 : 8,
                fill: d.color,
                opacity: 0.55,
              })
            : { radius: 3, fill: "#3972e9" }
        }
      />
      {index === 0 ? (
        <PlotSeries
          data={data.filter((d) => d.id === selected)}
          x="x"
          y="y"
          xScale="x"
          yScale="y"
          keyBy="id"
          render={(d) => (
            <Group>
              <Circle
                pointerEvents="none"
                style={{ radius: 14, stroke: d.color, strokeWidth: 2 }}
              />
              <Text
                pointerEvents="none"
                style={{ x: 18, y: -12, font: "11px sans-serif", fill: ink }}
              >
                {d.label}
              </Text>
            </Group>
          )}
        />
      ) : (
        <PlotSeries
          data={data}
          x="x"
          y="y"
          xScale="x"
          yScale="y"
          keyBy="id"
          render={(d) => <Marker datum={d} controls={controls} />}
        />
      )}
    </Group>
  );
}
function Panel({
  controls,
  index,
  origin,
}: {
  controls: Controls;
  index: number;
  origin: { x: number; y: number };
  style?: BoxStyle & LayoutItemStyle;
}) {
  const box = useLayoutBox();
  const width = Math.max(1, box.width - 66),
    height = Math.max(1, box.height - 100);
  return (
    <Group>
      <Rectangle
        pointerEvents="none"
        style={{
          width: box.width,
          height: box.height,
          fill: "#fff",
          stroke: "#dbe3ec",
          strokeWidth: 1,
        }}
      />
      <Text style={{ x: 20, y: 18, fill: ink, font: "bold 16px sans-serif" }}>
        {index === 0 ? "01   Batched dots" : "02   Your own elements"}
      </Text>
      <Text style={{ x: 20, y: 42, fill: muted, font: "11px sans-serif" }}>
        {index === 0
          ? "Radius, color & transparent overlap"
          : "Click squares. Reorder keeps local counts."}
      </Text>
      <Absolute>
        <Scale
          id="x"
          type="linear"
          domain={[0, 100]}
          range="width"
          style={{ left: 44, top: 64, width, height }}
        >
          <Scale id="y" type="linear" domain={[0, 100]} range="height" reverse>
            <Plot
              controls={controls}
              index={index}
              origin={{ x: origin.x + 44, y: origin.y + 64 }}
            />
          </Scale>
        </Scale>
      </Absolute>
    </Group>
  );
}
function Button({
  text,
  action,
  left,
  top,
  width = 102,
}: {
  text: string;
  action: () => void;
  left: number;
  top: number;
  width?: number;
}) {
  return (
    <Group style={{ translateX: left, translateY: top }}>
      <Rectangle
        style={{ width, height: 38, fill: "#e6edf5", cursor: "pointer" }}
        onClick={action}
      />
      <Text
        pointerEvents="none"
        style={{
          x: width / 2,
          y: 19,
          textAlign: "center",
          textBaseline: "middle",
          font: "12px sans-serif",
          fill: ink,
        }}
      >
        {text}
      </Text>
    </Group>
  );
}
function Scene({ fixture }: { fixture: Fixture }) {
  const box = useLayoutBox();
  const ownRows = useSignal(seed),
    ownSelected = useSignal("c"),
    ownClicks = useSignal(0);
  const controls: Controls = {
    rows: fixture.rows ?? ownRows,
    selected: fixture.selected ?? ownSelected,
    clicks: fixture.clicks ?? ownClicks,
    fixture,
  };
  const current = controls.rows
    .get()
    .find((d) => d.id === controls.selected.get());
  fixture.onReading?.(controls.selected.get(), controls.clicks.get());
  const narrow = box.width < 740;
  const content = Math.max(280, box.width - 48);
  const gap = 18;
  const leftWidth = narrow ? content : (content - gap) * 0.56;
  const rightWidth = narrow ? content : content - gap - leftWidth;
  const columns = Math.max(1, Math.min(5, Math.floor((content + 8) / 110)));
  const buttonPosition = (i: number) => ({
    left: 24 + (i % columns) * 110,
    top: 86 + Math.floor(i / columns) * 46,
  });
  const top = 170 + (Math.ceil(5 / columns) - 1) * 46;
  const height = narrow
    ? Math.max(160, (box.height - top - 44 - gap) / 2)
    : Math.max(240, box.height - top - 60);
  const rightX = narrow ? 24 : 24 + leftWidth + gap;
  const rightY = narrow ? top + height + gap : top;
  return (
    <Group>
      <Rectangle
        pointerEvents="none"
        style={{ width: box.width, height: box.height, fill: "#f4f7fb" }}
      />
      <Text style={{ x: 24, y: 20, font: "bold 25px sans-serif", fill: ink }}>
        {box.width < 600
          ? "Dots & custom marks"
          : "Small marks. Open possibilities."}
      </Text>
      <Text style={{ x: 24, y: 58, font: "12px sans-serif", fill: muted }}>
        {box.width < 600
          ? "CRC marks, mapped to your data."
          : "Dots, custom components, and local-coordinate inspection."}
      </Text>
      <Button
        text="← Previous"
        left={buttonPosition(0).left}
        top={buttonPosition(0).top}
        action={() => step(controls, -1)}
      />
      <Button
        text="Next →"
        left={buttonPosition(1).left}
        top={buttonPosition(1).top}
        action={() => step(controls, 1)}
      />
      <Button
        text="Reorder"
        left={buttonPosition(2).left}
        top={buttonPosition(2).top}
        action={() => controls.rows.update((rows) => [...rows].reverse())}
      />
      <Button
        text="Remove"
        left={buttonPosition(3).left}
        top={buttonPosition(3).top}
        action={() =>
          controls.rows.update((rows) =>
            rows.filter((d) => d.id !== controls.selected.get()),
          )
        }
      />
      <Button
        text="Reset"
        left={buttonPosition(4).left}
        top={buttonPosition(4).top}
        action={() =>
          batch(() => {
            controls.rows.set(seed);
            controls.selected.set("c");
            controls.clicks.set(0);
          })
        }
      />
      <Text style={{ x: 24, y: top - 30, font: "12px monospace", fill: ink }}>
        {current
          ? box.width < 600
            ? `${current.label} · ${controls.clicks.get()} custom clicks`
            : `${current.label}  ·  x ${current.x} / y ${current.y}  ·  custom clicks ${controls.clicks.get()}`
          : "Select a point"}
      </Text>
      <Absolute>
        <Panel
          key="scatter"
          controls={controls}
          index={0}
          origin={{ x: 24, y: top }}
          style={{ left: 24, top, width: leftWidth, height }}
        />
        <Panel
          key="custom"
          controls={controls}
          index={1}
          origin={{ x: rightX, y: rightY }}
          style={{ left: rightX, top: rightY, width: rightWidth, height }}
        />
      </Absolute>
      <Text
        style={{
          x: 24,
          y: rightY + height + 18,
          font: "11px sans-serif",
          fill: muted,
        }}
      >
        {box.width < 600
          ? "Tap to inspect · Click squares to count"
          : "Hover or tap to inspect · Click custom squares · Missing values stay missing"}
      </Text>
    </Group>
  );
}
// VIZ_POINTS_SOURCE_ID = 'viz-points-example'
export default function mount(
  canvas: HTMLCanvasElement,
  fixture: Fixture = {},
): CRCController {
  const previousMinHeight = canvas.style.minHeight;
  const previousTouchAction = canvas.style.touchAction;
  canvas.style.minHeight = "720px";
  canvas.style.touchAction = "pan-y";
  // The Studio iframe is shorter than stacked plots on a phone. Scroll its
  // existing document; this is host presentation, not Canvas scrolling.
  const host = canvas.parentElement;
  const previousOverflow = host?.style.overflow;
  if (host) host.style.overflow = "auto";
  try {
    const controller = crc(canvas, <Scene fixture={fixture} />, {
      viewport: "responsive",
    });
    return {
      dispose() {
        controller.dispose();
        canvas.style.minHeight = previousMinHeight;
        canvas.style.touchAction = previousTouchAction;
        if (host) host.style.overflow = previousOverflow ?? "";
      },
    };
  } catch (error) {
    canvas.style.minHeight = previousMinHeight;
    canvas.style.touchAction = previousTouchAction;
    if (host) host.style.overflow = previousOverflow ?? "";
    throw error;
  }
}
