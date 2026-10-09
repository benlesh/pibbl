import { Group, signal } from "@pibbl/core";
import { CandlestickSeries, LinearScale, UTCScale } from "@pibbl/core/viz";
import {
  useCandleInspection,
  nearestRecordedCandleX,
  paintedCandleAt,
  type CandleInspectionRef,
} from "@pibbl/core/viz/inspection";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
it("paints body/wick geometry and preserves typed captured OHLC on shared inspection", () => {
  runtime = testRuntime();
  const datum = {
    time: 1000,
    open: 4,
    high: 7,
    low: 2,
    close: 5,
    desk: "Alpha",
  };
  let ref: CandleInspectionRef<typeof datum>;
  const data = signal([datum]);
  const inputs = {
    data,
    time: "time" as const,
    open: "open" as const,
    high: "high" as const,
    low: "low" as const,
    close: "close" as const,
  };
  function Marks() {
    ref = useCandleInspection(inputs);
    return (
      <Group style={{ translateX: 20, translateY: 10 }}>
        <CandlestickSeries
          data={inputs.data}
          time="time"
          open="open"
          high="high"
          low="low"
          close="close"
          xScale="t"
          yScale="p"
          inspection={ref}
          style={{
            bandwidth: 10,
            body: { fill: "#087f8c" },
            wick: { stroke: "#173a35", strokeWidth: 2 },
          }}
        />
      </Group>
    );
  }
  runtime.mount(
    <UTCScale id="t" domain={[0, 2000]} range={[0, 60]}>
      <LinearScale id="p" domain={[0, 10]} range={[100, 0]}>
        <Marks />
      </LinearScale>
    </UTCScale>,
  );
  runtime.flush();
  const rendered = ref!.rendered()!,
    hit = nearestRecordedCandleX(rendered, { time: 1200 });
  expect(hit?.datum).toBe(datum);
  expect(hit).toMatchObject({
    sourceIndex: 0,
    time: 1000,
    open: 4,
    high: 7,
    low: 2,
    close: 5,
    timeDelta: 200,
    bodyBoundsLocal: { x: 25, y: 50, width: 10, height: 10 },
    wickLocal: { x: 30, lowY: 80, highY: 30 },
    anchorRoot: { x: 50, y: 60 },
  });
  expect(paintedCandleAt(rendered, { rootPoint: { x: 50, y: 65 } })?.part).toBe(
    "body",
  );
  expect(paintedCandleAt(rendered, { rootPoint: { x: 50, y: 45 } })?.part).toBe(
    "wick",
  );
  expect(
    paintedCandleAt(rendered, { rootPoint: { x: 70, y: 45 } }),
  ).toBeUndefined();
  datum.close = 999;
  expect(nearestRecordedCandleX(rendered, { time: 1000 })?.close).toBe(5);
  data.set([{ time: 1000, open: 4, high: 7, low: 2, close: 6, desk: "Beta" }]);
  runtime.flush();
  expect(() => nearestRecordedCandleX(rendered, { time: 1000 })).toThrow(
    /stale/,
  );
  expect(
    nearestRecordedCandleX(ref!.rendered()!, { time: 1000 }),
  ).toMatchObject({
    close: 6,
    bodyBoundsLocal: { height: 20 },
    datum: { desk: "Beta" },
  });
  runtime.dispose();
  expect(ref!.rendered()).toBeUndefined();
  expect(runtime.pending).toBe(0);
});
it("rejects malformed finite OHLC rather than silently drawing it", () => {
  runtime = testRuntime();
  runtime.mount(
    <UTCScale id="t" domain={[0, 2000]} range={[0, 60]}>
      <LinearScale id="p" domain={[0, 10]} range={[100, 0]}>
        <CandlestickSeries
          data={[{ time: 1000, open: 5, close: 6, low: 2, high: 4 }]}
          time="time"
          open="open"
          high="high"
          low="low"
          close="close"
          xScale="t"
          yScale="p"
        />
      </LinearScale>
    </UTCScale>,
  );
  expect(() => runtime.flush()).toThrow(/OHLC.*source index 0/);
});
