import { Group, Rectangle, signal, useSignal } from "@pibbl/core";
import { defineSeries, LinearScale, PointSeries } from "@pibbl/core/viz";
import {
  nearestRecordedX,
  usePointInspection,
  withInspection,
  type InspectionContext,
} from "@pibbl/core/viz/inspection";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it("keeps ordinary/background events lazy and memoizes equal requests including misses across propagation", () => {
  runtime = testRuntime();
  let searches = 0;
  let retained: InspectionContext;
  const data = signal([{ x: 5, y: 5 }]);
  const series = defineSeries({ data, x: "x", y: "y" });
  const query: typeof nearestRecordedX = (rendered, options) => {
    searches++;
    return nearestRecordedX(rendered, options);
  };
  function Chart() {
    const ref = usePointInspection(series);
    const read = withInspection((_, context) => {
      retained = context;
      const rendered = context.rendered(ref)!;
      const a = context.request(query, rendered, {
        domainX: 100,
        maxDomainDelta: 1,
      });
      const b = context.request(query, rendered, {
        domainX: 100,
        maxDomainDelta: 1,
      });
      expect(a).toBeUndefined();
      expect(b).toBeUndefined();
      data.set([{ x: 99, y: 5 }]);
      expect(
        context.request(nearestRecordedX, rendered, { domainX: 5 })?.domainX,
      ).toBe(5);
    });
    return (
      <Group onClick={read}>
        <Rectangle
          onClick={read}
          style={{ width: 100, height: 100, fill: "transparent" }}
        />
        <PointSeries {...series} xScale="x" yScale="y" inspection={ref} />
      </Group>
    );
  }
  const canvas = runtime.mount(
    <LinearScale id="x" domain={[0, 10]} range={[0, 100]}>
      <LinearScale id="y" domain={[0, 10]} range={[100, 0]}>
        <Chart />
      </LinearScale>
    </LinearScale>,
  );
  runtime.flush();
  expect(searches).toBe(0);
  const bounds = canvas.getBoundingClientRect();
  for (const type of ["mousedown", "mouseup", "click"])
    canvas.dispatchEvent(
      new MouseEvent(type, {
        clientX: bounds.left + 20,
        clientY: bounds.top + 20,
        bubbles: true,
      }),
    );
  expect(searches).toBe(1);
  expect(() => retained!.request(query, {} as never, { domainX: 5 })).toThrow(
    /expired|dispatch/i,
  );
});

it("memoizes copied option values only for one dispatch and rejects asynchronous queries", () => {
  runtime = testRuntime();
  let calls = 0;
  const query = (_rendered: object, options: { domainX: number }) => {
    calls++;
    return options.domainX;
  };
  const rendered = {};
  const read = withInspection((_, context) => {
    const callsBefore = calls;
    expect(context.request(query, rendered, { domainX: 4 })).toBe(4);
    expect(context.request(query, rendered, { domainX: 4 })).toBe(4);
    expect(calls).toBe(callsBefore + 1);
    expect(() =>
      context.request(
        () => Promise.resolve("later"),
        rendered,
        { domainX: 4 },
      ),
    ).toThrow(/synchronous/i);
    expect(() =>
      context.request(
        () => useSignal(0),
        rendered,
        { domainX: 4 },
      ),
    ).toThrow(/pure synchronous|hook/i);
  });
  const canvas = runtime.mount(
    <Rectangle onClick={read} style={{ width: 100, height: 100, fill: "#fff" }} />,
  );
  runtime.flush();
  const bounds = canvas.getBoundingClientRect();
  for (const type of ["mousedown", "mouseup", "click", "mousedown", "mouseup", "click"])
    canvas.dispatchEvent(
      new MouseEvent(type, {
        clientX: bounds.left + 20,
        clientY: bounds.top + 20,
        bubbles: true,
      }),
    );
  expect(calls).toBe(2);
});
