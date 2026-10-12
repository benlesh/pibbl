import { Clip, Group, Rectangle, type PibblLogicalMouseEvent } from "@pibbl/core";
import {
  CandlestickSeries,
  LinearScale,
  TradingTimeScale,
  VolumeSeries,
} from "@pibbl/core/viz";
import {
  nearestRecordedCandleX,
  nearestRecordedVolumeX,
  useCandleInspection,
  useVolumeInspection,
  withInspection,
} from "@pibbl/core/viz/inspection";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";

let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it("snaps transformed clipped trading-time input to one exact candle without substituting volume", () => {
  runtime = testRuntime();
  const candles = [
    { time: 1_000, open: 30, high: 45, low: 20, close: 35 },
    { time: 2_000, open: 35, high: 55, low: 30, close: 40 },
    { time: 3_000, open: 40, high: 60, low: 35, close: 50 },
  ];
  const volumes = [
    { time: 1_000, volume: 10 },
    { time: 3_000, volume: 30 },
  ];
  let selectedTime: number | undefined;
  let nearestVolumeTime: number | undefined;
  let exactVolume: number | undefined;
  const clip = new Path2D();
  clip.rect(0, 0, 100, 160);

  function Chart() {
    const candleRef = useCandleInspection({
      data: candles, time: "time", open: "open", high: "high", low: "low", close: "close",
    });
    const volumeRef = useVolumeInspection({ data: volumes, time: "time", volume: "volume" });
    const inspect = withInspection((event: PibblLogicalMouseEvent, context) => {
      const renderedCandles = context.rendered(candleRef);
      const renderedVolumes = context.rendered(volumeRef);
      if (!renderedCandles || !renderedVolumes) return;
      const time = renderedCandles.timeAtRoot({ x: event.x, y: event.y });
      if (time === undefined) return;
      const candle = context.request(nearestRecordedCandleX, renderedCandles, { time });
      if (!candle) return;
      selectedTime = candle.time;
      const volume = context.request(nearestRecordedVolumeX, renderedVolumes, { time: candle.time });
      nearestVolumeTime = volume?.time;
      exactVolume = volume?.time === candle.time ? volume.volume : undefined;
    });
    return (
      <Group style={{ translateX: 30, translateY: 20, scaleX: 2 }}>
        <Clip style={{ d: clip }}>
          <CandlestickSeries
            data={candles}
            time="time"
            open="open"
            high="high"
            low="low"
            close="close"
            xScale="session"
            yScale="price"
            inspection={candleRef}
          />
          <VolumeSeries
            data={volumes}
            time="time"
            volume="volume"
            xScale="session"
            yScale="volume"
            inspection={volumeRef}
          />
          <Rectangle onClick={inspect} style={{ width: 100, height: 160, fill: "transparent" }} />
        </Clip>
      </Group>
    );
  }

  const canvas = runtime.mount(
    <TradingTimeScale id="session" timestamps={candles.map((candle) => candle.time)} range={[0, 100]}>
      <LinearScale id="price" domain={[0, 100]} range={[100, 0]}>
        <LinearScale id="volume" domain={[0, 40]} range={[150, 110]}>
          <Chart />
        </LinearScale>
      </LinearScale>
    </TradingTimeScale>,
  );
  runtime.flush();

  const bounds = canvas.getBoundingClientRect();
  for (const type of ["mousedown", "mouseup", "click"])
    canvas.dispatchEvent(new MouseEvent(type, {
      clientX: bounds.left + 130,
      clientY: bounds.top + 80,
      bubbles: true,
    }));

  expect(selectedTime).toBe(2_000);
  expect(nearestVolumeTime).toBe(1_000);
  expect(exactVolume).toBeUndefined();
});
