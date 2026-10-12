import { Circle, signal } from "@pibbl/core";
import {
  Axis,
  LinearScale,
  LineSeries,
  PlotSeries,
  TradingTimeScale,
  useTradingTimeScale,
} from "@pibbl/core/viz";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
it("shares gapless UTC observation positions across lines, custom markers, axes and fractional navigation", () => {
  runtime = testRuntime();
  const friday = Date.UTC(2026, 0, 9),
    monday = Date.UTC(2026, 0, 12),
    tuesday = Date.UTC(2026, 0, 13);
  const timestamps = signal<readonly number[]>([friday, monday, tuesday]);
  const logicalRange = signal<readonly [number, number]>([0, 2]);
  const positions: number[][] = [];
  function Marks() {
    const scale = useTradingTimeScale("time").get();
    positions.push([scale.map(friday), scale.map(monday), scale.map(tuesday)]);
    expect(scale.slotAtTime(monday)).toBe(timestamps.get().length - 2);
    expect(scale.timeAtSlot(timestamps.get().length - 2)).toBe(monday);
    expect(
      scale.nearestTimeAtPosition((scale.map(friday) + scale.map(monday)) / 2),
    ).toBe(friday);
    return (
      <>
        <LineSeries
          data={[
            { time: friday, v: 1 },
            { time: monday, v: 2 },
            { time: tuesday, v: 1 },
          ]}
          x="time"
          y="v"
          xScale="time"
          yScale="price"
        />
        <PlotSeries
          data={[{ time: monday, v: 2 }]}
          x="time"
          y="v"
          xScale="time"
          yScale="price"
          render={() => <Circle style={{ radius: 3, fill: "#d9674c" }} />}
        />
        <Axis scale="time" position="bottom" tickCount={3} />
      </>
    );
  }
  runtime.mount(
    <TradingTimeScale
      id="time"
      timestamps={timestamps}
      logicalRange={logicalRange}
      range={[0, 200]}
    >
      <LinearScale id="price" domain={[0, 3]} range={[100, 0]}>
        <Marks />
      </LinearScale>
    </TradingTimeScale>,
  );
  runtime.flush();
  expect(positions[0]).toEqual([0, 100, 200]);
  logicalRange.set([0.5, 2.5]);
  runtime.flush();
  expect(positions.at(-1)).toEqual([-50, 50, 150]);
  logicalRange.set([0.5, 1.5]);
  runtime.flush();
  expect(positions.at(-1)).toEqual([-100, 100, 300]);
  timestamps.set([Date.UTC(2026, 0, 8), friday, monday, tuesday]);
  logicalRange.set([1.5, 2.5]);
  runtime.flush();
  expect(positions.at(-1)).toEqual([-100, 100, 300]);
});
