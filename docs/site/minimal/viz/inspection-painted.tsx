import {
  Group,
  Rectangle,
  Text,
  pibbl,
  useSignal,
  type PibblLogicalMouseEvent,
} from "@pibbl/core";
import {
  BarScale,
  BarSeries,
  LinearScale,
  PointSeries,
  defineSeries,
} from "@pibbl/core/viz";
import {
  paintedBarAt,
  paintedPointAt,
  useBarInspection,
  usePointInspection,
  withInspection,
  type BarInspectionRef,
  type BarRenderedSeries,
  type PaintedBarHit,
  type PaintedPointHit,
} from "@pibbl/core/viz/inspection";

type Mark = { x: number; y: number; name: string };
type Range = { desk: string; low: number; high: number };
const marks = defineSeries({
  data: [{ x: 4, y: 5, name: "Later paint" }] as const,
  x: "x",
  y: "y",
});
const ranges: readonly Range[] = [{ desk: "Rates", low: -2, high: 5 }];
function Chart() {
  const point = usePointInspection(marks);
  const bar: BarInspectionRef<Range> = useBarInspection({
    data: ranges,
    category: "desk",
  });
  const text = useSignal("Click a mark or range.");
  const inspect = withInspection((event: PibblLogicalMouseEvent, context) => {
    const pointRendered = context.rendered(point);
    const barRendered: BarRenderedSeries<Range> | undefined =
      context.rendered(bar);
    const pointHit: PaintedPointHit<Mark> | undefined =
      pointRendered &&
      context.request(paintedPointAt, pointRendered, {
        rootPoint: { x: event.x, y: event.y },
      });
    const barHit: PaintedBarHit<Range> | undefined =
      barRendered &&
      context.request(paintedBarAt, barRendered, {
        rootPoint: { x: event.x, y: event.y },
      });
    text.set(
      `Painted point ${pointHit?.datum.name ?? "none"}; bar ${barHit?.datum.desk ?? "none"}.`,
    );
  });
  return (
    <>
      <Group onClick={inspect}>
        <Rectangle style={{ width: 300, height: 170, fill: "#f5f8f5" }} />
        <PointSeries
          {...marks}
          xScale="x"
          yScale="y"
          inspection={point}
          style={{ radius: 12, fill: "#cf6b4c" }}
        />
        <BarSeries
          data={ranges}
          category="desk"
          valueStart="low"
          valueEnd="high"
          categoryScale="desk"
          valueScale="risk"
          inspection={bar}
          style={{ fill: "#9ccfc0" }}
        />
      </Group>
      <Text
        pointerEvents="none"
        style={{ left: 8, top: 195, font: "12px sans-serif", fill: "#173a35" }}
      >
        {text.get()}
      </Text>
    </>
  );
}
const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 230;
document.body.append(canvas);
const controller = pibbl(
  canvas,
  <LinearScale id="x" domain={[0, 10]} range={[30, 280]}>
    <LinearScale id="y" domain={[0, 10]} range={[150, 20]}>
      <BarScale id="desk" domain={["Rates"]} range={[30, 280]}>
        <LinearScale id="risk" domain={[-4, 8]} range={[150, 20]}>
          <Chart />
        </LinearScale>
      </BarScale>
    </LinearScale>
  </LinearScale>,
);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
