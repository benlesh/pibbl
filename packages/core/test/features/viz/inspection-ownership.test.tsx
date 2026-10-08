import { Clip, Group, Layer, signal } from "@pibbl/core";
import { LinearScale, PointSeries, defineSeries } from "@pibbl/core/viz";
import {
  anchorInsideClips,
  nearestRecordedX,
  paintedPointAt,
  usePointInspection,
  type PointInspectionRef,
} from "@pibbl/core/viz/inspection";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it("rebases a cached nested Layer generation without reevaluating data, including outer clips", () => {
  runtime = testRuntime();
  const offset = signal(20);
  const clipWidth = signal(100);
  let reads = 0;
  const series = defineSeries({
    data: [{ x: 10, y: 10 }],
    x: "x",
    y: (datum) => {
      reads++;
      return datum.y;
    },
  });
  let ref: PointInspectionRef<{ x: number; y: number }>;
  function Marks() {
    ref = usePointInspection(series);
    return (
      <PointSeries
        {...series}
        xScale="x"
        yScale="y"
        inspection={ref}
        style={{ radius: 4, fill: "teal" }}
      />
    );
  }
  const retained = (
    <Layer style={{ width: 100, height: 100 }}>
      <Group style={{ translateX: 5 }}>
        <Layer style={{ width: 80, height: 80 }}>
          <LinearScale id="x" domain={[0, 100]} range={[0, 100]}>
            <LinearScale id="y" domain={[0, 100]} range={[0, 100]}>
              <Marks />
            </LinearScale>
          </LinearScale>
        </Layer>
      </Group>
    </Layer>
  );
  function Chart() {
    const clip = new Path2D();
    clip.rect(0, 0, clipWidth.get(), 100);
    return (
      <Group style={{ translateX: offset.get() }}>
        <Clip style={{ d: clip }}>{retained}</Clip>
      </Group>
    );
  }

  runtime.mount(<Chart />);
  runtime.flush();
  runtime.flush();
  const original = ref!.rendered()!;
  expect(original.observations[0].anchorRoot).toEqual({ x: 35, y: 10 });
  expect(reads).toBe(1);
  offset.set(40);
  runtime.flush();
  runtime.flush();
  expect(reads).toBe(1);
  expect(() => nearestRecordedX(original, { domainX: 10 })).toThrow(/stale/);
  const rebased = ref!.rendered()!;
  expect(rebased.observations[0].anchorRoot).toEqual({ x: 55, y: 10 });
  expect(
    paintedPointAt(rebased, { rootPoint: { x: 55, y: 10 } })?.sourceIndex,
  ).toBe(0);
  clipWidth.set(12);
  runtime.flush();
  runtime.flush();
  const clipped = ref!.rendered()!;
  expect(reads).toBe(1);
  expect(nearestRecordedX(clipped, { domainX: 10 })?.sourceIndex).toBe(0);
  expect(
    nearestRecordedX(clipped, { domainX: 10, filter: anchorInsideClips }),
  ).toBeUndefined();
  expect(
    paintedPointAt(clipped, { rootPoint: { x: 55, y: 10 } }),
  ).toBeUndefined();
});

it("releases a removed receiver and permits the surviving hook to bind its replacement", () => {
  runtime = testRuntime();
  const visible = signal(true);
  const identity = signal("first");
  const series = defineSeries({ data: [{ x: 10, y: 10 }], x: "x", y: "y" });
  let ref: PointInspectionRef<{ x: number; y: number }>;
  function Chart() {
    ref = usePointInspection(series);
    return visible.get() ? (
      <PointSeries
        key={identity.get()}
        {...series}
        xScale="x"
        yScale="y"
        inspection={ref}
      />
    ) : null;
  }
  runtime.mount(
    <LinearScale id="x" domain={[0, 20]} range={[0, 20]}>
      <LinearScale id="y" domain={[0, 20]} range={[0, 20]}>
        <Chart />
      </LinearScale>
    </LinearScale>,
  );
  runtime.flush();
  runtime.flush();
  const old = ref!.rendered()!;
  visible.set(false);
  runtime.flush();
  runtime.flush();
  expect(ref!.rendered()).toBeUndefined();
  expect(() => nearestRecordedX(old, { domainX: 10 })).toThrow(/stale/);
  visible.set(true);
  identity.set("second");
  runtime.flush();
  runtime.flush();
  expect(ref!.rendered()?.observations).toHaveLength(1);
  const replaced = ref!.rendered()!;
  identity.set("third");
  runtime.flush();
  runtime.flush();
  expect(ref!.rendered()?.observations).toHaveLength(1);
  expect(() => nearestRecordedX(replaced, { domainX: 10 })).toThrow(/stale/);
  runtime.dispose();
  expect(ref!.rendered()).toBeUndefined();
  expect(runtime.pending).toBe(0);
});

it("discards candidate geometry and borrowed records when a containing render fails", () => {
  runtime = testRuntime();
  const fail = signal(false);
  let ref: PointInspectionRef<{ x: number; y: number }>;
  const series = defineSeries({ data: [{ x: 10, y: 10 }], x: "x", y: "y" });
  function Crash() {
    if (fail.get()) throw new Error("inspection failure fixture");
    return null;
  }
  function Chart() {
    ref = usePointInspection(series);
    return (
      <>
        <PointSeries {...series} xScale="x" yScale="y" inspection={ref} />
        <Crash />
      </>
    );
  }
  runtime.mount(
    <LinearScale id="x" domain={[0, 20]} range={[0, 20]}>
      <LinearScale id="y" domain={[0, 20]} range={[0, 20]}>
        <Chart />
      </LinearScale>
    </LinearScale>,
  );
  runtime.flush();
  runtime.flush();
  const old = ref!.rendered()!;
  fail.set(true);
  expect(() => runtime.flush()).toThrow("inspection failure fixture");
  expect(ref!.rendered()).toBeUndefined();
  expect(() => nearestRecordedX(old, { domainX: 10 })).toThrow(
    /stale|disposed/,
  );
});

it("rejects simultaneous receivers sharing one inspection ref", () => {
  runtime = testRuntime();
  const series = defineSeries({ data: [{ x: 1, y: 1 }], x: "x", y: "y" });
  function Chart() {
    const ref = usePointInspection(series);
    return (
      <>
        <PointSeries {...series} xScale="x" yScale="y" inspection={ref} />
        <PointSeries {...series} xScale="x" yScale="y" inspection={ref} />
      </>
    );
  }
  runtime.mount(
    <LinearScale id="x" domain={[0, 10]} range={[0, 10]}>
      <LinearScale id="y" domain={[0, 10]} range={[0, 10]}>
        <Chart />
      </LinearScale>
    </LinearScale>,
  );
  expect(() => runtime.flush()).toThrow(/one mounted series/);
});
