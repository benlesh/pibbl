import { LinearScale, UTCScale, CandlestickSeries } from "@pibbl/core/viz";
import {
  nearestRecordedCandleX,
  paintedCandleAt,
  useCandleInspection,
  type CandleInspectionRef,
} from "@pibbl/core/viz/inspection";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";

let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it("preserves captured OHLC records and distinguishes painted candle bodies from wicks", () => {
  runtime = testRuntime();
  const first = { time: 1000, open: 20, high: 80, low: 10, close: 40 };
  const second = { time: 2000, open: 40, high: 70, low: 20, close: 60 };
  let inspection: CandleInspectionRef<typeof first>;
  const inputs = {
    data: [first, second],
    time: "time" as const,
    open: "open" as const,
    high: "high" as const,
    low: "low" as const,
    close: "close" as const,
  };
  function Candles() {
    inspection = useCandleInspection(inputs);
    return (
      <CandlestickSeries
        data={inputs.data}
        time={inputs.time}
        open={inputs.open}
        high={inputs.high}
        low={inputs.low}
        close={inputs.close}
        xScale="time"
        yScale="price"
        inspection={inspection}
      />
    );
  }
  runtime.mount(
    <UTCScale id="time" domain={[1000, 2000]} range={[20, 120]}>
      <LinearScale id="price" domain={[0, 100]} range={[100, 0]}>
        <Candles />
      </LinearScale>
    </UTCScale>,
  );
  runtime.flush();
  const rendered = inspection!.rendered()!;
  expect(rendered.observations[0]).toMatchObject({
    datum: first,
    sourceIndex: 0,
    time: 1000,
    open: 20,
    high: 80,
    low: 10,
    close: 40,
    anchorLocal: { x: 20, y: 60 },
    bodyBoundsLocal: { y: 60, height: 20 },
    wickLocal: { x: 20, highY: 20, lowY: 90 },
  });
  expect(nearestRecordedCandleX(rendered, { time: 1800 })?.datum).toBe(second);
  expect(nearestRecordedCandleX(rendered, { time: 1800 })).toMatchObject({
    timeDelta: 200,
    close: 60,
  });
  expect(
    paintedCandleAt(rendered, { rootPoint: { x: 20, y: 70 } }),
  ).toMatchObject({ datum: first, part: "body" });
  expect(
    paintedCandleAt(rendered, { rootPoint: { x: 20, y: 30 } }),
  ).toMatchObject({ datum: first, part: "wick" });
  expect(
    paintedCandleAt(rendered, { rootPoint: { x: 70, y: 30 } }),
  ).toBeUndefined();
});
