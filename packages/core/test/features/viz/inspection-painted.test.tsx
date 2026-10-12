import { Clip } from "@pibbl/core";
import {
  LinearScale,
  BarScale,
  BarSeries,
  PointSeries,
  defineSeries,
} from "@pibbl/core/viz";
import {
  usePointInspection,
  useBarInspection,
  paintedBarAt,
  paintedPointAt,
  nearestRecordedPoint,
  type PointInspectionRef,
  type BarInspectionRef,
} from "@pibbl/core/viz/inspection";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
it("selects the last painted overlapping point rather than the nearest center and respects rings and clips", () => {
  runtime = testRuntime();
  const series = defineSeries({
    data: [
      { id: "first", x: 20, y: 20 },
      { id: "last", x: 26, y: 20 },
      { id: "ring", x: 60, y: 20 },
    ],
    x: "x",
    y: "y",
  });
  let ref: PointInspectionRef<{ id: string; x: number; y: number }>;
  function Points() {
    ref = usePointInspection(series);
    return (
      <PointSeries
        {...series}
        xScale="x"
        yScale="y"
        inspection={ref}
        style={(d) =>
          d.id === "ring"
            ? { radius: 10, fill: "", stroke: "red", strokeWidth: 2 }
            : { radius: 10, fill: "blue" }
        }
      />
    );
  }
  const clip = new Path2D();
  clip.rect(0, 0, 65, 80);
  runtime.mount(
    <LinearScale id="x" domain={[0, 100]} range={[0, 100]}>
      <LinearScale id="y" domain={[0, 100]} range={[0, 100]}>
        <Clip style={{ d: clip }}>
          <Points />
        </Clip>
      </LinearScale>
    </LinearScale>,
  );
  runtime.flush();
  const rendered = ref!.rendered()!;
  expect(
    nearestRecordedPoint(rendered, { rootPoint: { x: 20, y: 20 } })?.datum.id,
  ).toBe("first");
  expect(
    paintedPointAt(rendered, { rootPoint: { x: 20, y: 20 } })?.datum.id,
  ).toBe("last");
  expect(
    paintedPointAt(rendered, { rootPoint: { x: 60, y: 20 } }),
  ).toBeUndefined();
  expect(
    paintedPointAt(rendered, { rootPoint: { x: 50, y: 20 } })?.datum.id,
  ).toBe("ring");
  expect(
    paintedPointAt(rendered, { rootPoint: { x: 70, y: 20 } }),
  ).toBeUndefined();
});

it("preserves original range-bar records and endpoints in reverse source paint order", () => {
  runtime = testRuntime();
  const data = [
    { desk: "Rates", low: 0, high: 10, id: "back" },
    { desk: "Rates", low: 2, high: 8, id: "front" },
  ];
  const inputs = {
    data,
    category: "desk",
    valueStart: "low",
    valueEnd: "high",
  } as const;
  let ref: BarInspectionRef<(typeof data)[number]>;
  function Bars() {
    ref = useBarInspection(inputs);
    return (
      <BarSeries
        {...inputs}
        categoryScale="desk"
        valueScale="value"
        inspection={ref}
      />
    );
  }
  runtime.mount(
    <BarScale id="desk" domain={["Rates"]} range={[0, 100]}>
      <LinearScale id="value" domain={[0, 10]} range={[100, 0]}>
        <Bars />
      </LinearScale>
    </BarScale>,
  );
  runtime.flush();
  const hit = paintedBarAt(ref!.rendered()!, { rootPoint: { x: 50, y: 50 } });
  expect(hit).toMatchObject({
    datum: data[1],
    sourceIndex: 1,
    category: "Rates",
    group: undefined,
    valueStart: 2,
    valueEnd: 8,
  });
  expect(hit?.datum).toBe(data[1]);
  expect(hit?.boundsLocal.height).toBe(60);
  expect(
    paintedBarAt(ref!.rendered()!, { rootPoint: { x: 50, y: 95 } })?.datum.id,
  ).toBe("back");
});

it("finds a grouped horizontal stroke-only bar at its painted outline", () => {
  runtime = testRuntime();
  const data = [{ desk: "Rates", plan: "Actual", value: 4 }];
  const inputs = { data, category: "desk", group: "plan", value: "value" } as const;
  let ref: BarInspectionRef<(typeof data)[number]>;
  function Bars() {
    ref = useBarInspection(inputs);
    return (
      <BarSeries
        {...inputs}
        categoryScale="desk"
        groupScale="plan"
        valueScale="value"
        orientation="horizontal"
        inspection={ref}
        style={{ fill: "", stroke: "#147b68", strokeWidth: 4 }}
      />
    );
  }
  runtime.mount(
    <BarScale id="desk" domain={["Rates"]} range={[0, 100]}>
      <BarScale id="plan" domain={["Actual"]} range={{ bandwidthOf: "desk" }}>
        <LinearScale id="value" domain={[0, 10]} range={[0, 100]}>
          <Bars />
        </LinearScale>
      </BarScale>
    </BarScale>,
  );
  runtime.flush();
  const rendered = ref!.rendered()!;
  expect(
    paintedBarAt(rendered, { rootPoint: { x: 20, y: 50 } }),
  ).toBeUndefined();
  expect(
    paintedBarAt(rendered, { rootPoint: { x: 41, y: 50 } }),
  ).toMatchObject({
    datum: data[0],
    sourceIndex: 0,
    category: "Rates",
    group: "Actual",
    valueStart: 0,
    valueEnd: 4,
  });
});
