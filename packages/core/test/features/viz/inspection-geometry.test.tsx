import { Clip, Group, Rectangle, resolveSignalValue } from "@pibbl/core";
import { defineSeries, LinearScale, PointSeries } from "@pibbl/core/viz";
import {
  paintedPointAt,
  usePointInspection,
  type PointInspectionRef,
} from "@pibbl/core/viz/inspection";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";

let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

function press(canvas: HTMLCanvasElement, x: number, y: number) {
  const bounds = canvas.getBoundingClientRect();
  canvas.dispatchEvent(
    new PointerEvent("pointerdown", {
      clientX: bounds.left + x,
      clientY: bounds.top + y,
      bubbles: true,
    }),
  );
}

it("uses the committed transformed clip when looking up a painted point", () => {
  runtime = testRuntime();
  const series = defineSeries({
    data: [{ id: "inside", x: 10, y: 10 }],
    x: "x",
    y: "y",
  });
  let ref: PointInspectionRef<{ id: string; x: number; y: number }>;
  const events: string[] = [];
  const clip = new Path2D();
  clip.rect(0, 0, 20, 20);
  function Chart() {
    ref = usePointInspection(series);
    return (
      <Group style={{ translateX: 30, translateY: 10, scaleX: 2 }}>
        <Clip style={{ d: clip }}>
          <PointSeries
            {...series}
            xScale="x"
            yScale="y"
            inspection={ref}
            style={{ radius: 4, fill: "#2563eb" }}
            onPointerDown={() => events.push("point")}
          />
        </Clip>
      </Group>
    );
  }
  const canvas = runtime.mount(
    <>
      <Rectangle
        style={{ width: 600, height: 400, fill: "white" }}
        onPointerDown={() => events.push("background")}
      />
      <LinearScale id="x" domain={[0, 100]} range={[0, 100]}>
        <LinearScale id="y" domain={[0, 100]} range={[0, 100]}>
          <Chart />
        </LinearScale>
      </LinearScale>
    </>,
  );
  runtime.flush();

  const rendered = ref!.rendered()!;
  expect(rendered.observations[0]?.anchorRoot).toEqual({ x: 80, y: 20 });
  press(canvas, 80, 20);
  press(canvas, 101, 20);
  expect(events).toEqual(["point", "background"]);
  expect(paintedPointAt(rendered, { rootPoint: { x: 80, y: 20 } })?.datum).toBe(
    resolveSignalValue(series.data)[0],
  );
  expect(
    paintedPointAt(rendered, { rootPoint: { x: 101, y: 20 } }),
  ).toBeUndefined();
});

it("keeps a singular committed transform queryable by domain while root inversion has no result", () => {
  runtime = testRuntime();
  const series = defineSeries({ data: [{ x: 10, y: 20 }], x: "x", y: "y" });
  let ref: PointInspectionRef<{ x: number; y: number }>;
  function Chart() {
    ref = usePointInspection(series);
    return (
      <Group style={{ scaleX: 0 }}>
        <PointSeries {...series} xScale="x" yScale="y" inspection={ref} />
      </Group>
    );
  }
  runtime.mount(
    <LinearScale id="x" domain={[0, 100]} range={[0, 100]}>
      <LinearScale id="y" domain={[0, 100]} range={[0, 100]}>
        <Chart />
      </LinearScale>
    </LinearScale>,
  );
  runtime.flush();

  const rendered = ref!.rendered();
  expect(rendered).toBeDefined();
  expect(rendered!.domainXAtRoot({ x: 0, y: 20 })).toBeUndefined();
  expect(
    paintedPointAt(rendered!, { rootPoint: { x: 0, y: 20 } }),
  ).toBeUndefined();
});
