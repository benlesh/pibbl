import { Group, signal } from "@pibbl/core";
import { LinearScale, PointSeries, defineSeries } from "@pibbl/core/viz";
import {
  usePointInspection,
  nearestRecordedX,
  type PointInspectionRef,
} from "@pibbl/core/viz/inspection";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it("captures rendered values once, preserves original records, transforms and committed data", () => {
  runtime = testRuntime();
  const first = { time: 0, price: 10 },
    second = { time: 10, price: 30 };
  const data = signal([first, second]);
  let reads = 0;
  const series = defineSeries({
    data,
    x: "time",
    y: (d) => {
      reads++;
      return d.price;
    },
  });
  let ref: PointInspectionRef<typeof first>;
  function Chart() {
    ref = usePointInspection(series);
    return (
      <Group style={{ translateX: 20, translateY: 10 }}>
        <PointSeries {...series} xScale="x" yScale="y" inspection={ref} />
      </Group>
    );
  }
  runtime.mount(
    <LinearScale id="x" domain={[0, 10]} range={[0, 100]}>
      <LinearScale id="y" domain={[0, 40]} range={[200, 0]}>
        <Chart />
      </LinearScale>
    </LinearScale>,
  );
  runtime.flush();
  const rendered = ref!.rendered()!;
  expect(reads).toBe(2);
  const hit = nearestRecordedX(rendered, { domainX: 8 });
  expect(hit).toMatchObject({
    datum: second,
    sourceIndex: 1,
    domainX: 10,
    domainY: 30,
    domainDelta: 2,
    anchorLocal: { x: 100, y: 50 },
    anchorRoot: { x: 120, y: 60 },
  });
  expect(hit?.datum).toBe(second);
  expect(rendered.domainXAtRoot({ x: 100, y: 10 })).toBe(8);
  data.set([{ time: 0, price: 999 }]);
  expect(nearestRecordedX(rendered, { domainX: 8 })?.domainY).toBe(30);
  expect(reads).toBe(2);
  runtime.flush();
  expect(() => nearestRecordedX(rendered, { domainX: 8 })).toThrow(
    /stale|generation/i,
  );
  expect(nearestRecordedX(ref!.rendered()!, { domainX: 8 })?.domainY).toBe(999);
  runtime.dispose();
  expect(ref!.rendered()).toBeUndefined();
});
