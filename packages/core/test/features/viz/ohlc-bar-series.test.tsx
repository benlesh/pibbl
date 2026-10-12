import { Clip, Group, signal } from "@pibbl/core";
import { LinearScale, OhlcBarSeries, UTCScale } from "@pibbl/core/viz";
import {
  nearestRecordedOhlcBarX,
  paintedOhlcBarAt,
  useOhlcBarInspection,
  type OhlcBarInspectionRef,
} from "@pibbl/core/viz/inspection";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";

let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it("paints and inspects source OHLC bars with separate open, stem, and close parts", () => {
  runtime = testRuntime();
  const datum = {
    time: 1000,
    open: 4,
    high: 7,
    low: 2,
    close: 5,
    desk: "Alpha",
  };
  const data = signal([datum]);
  const inputs = {
    data,
    time: "time" as const,
    open: "open" as const,
    high: "high" as const,
    low: "low" as const,
    close: "close" as const,
  };
  let inspection: OhlcBarInspectionRef<typeof datum>;
  function Marks() {
    inspection = useOhlcBarInspection(inputs);
    return (
      <Group style={{ translateX: 20, translateY: 10 }}>
        <OhlcBarSeries
          {...inputs}
          xScale="t"
          yScale="p"
          inspection={inspection}
          style={{ bandwidth: 10, stroke: "#087f8c", strokeWidth: 2 }}
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
  const rendered = inspection!.rendered()!;
  expect(nearestRecordedOhlcBarX(rendered, { time: 1200 })).toMatchObject({
    datum,
    sourceIndex: 0,
    timeDelta: 200,
    anchorRoot: { x: 50, y: 60 },
    stemLocal: { x: 30, highY: 30, lowY: 80 },
    openTickLocal: { x1: 25, x2: 30, y: 60 },
    closeTickLocal: { x1: 30, x2: 35, y: 50 },
  });
  expect(
    paintedOhlcBarAt(rendered, { rootPoint: { x: 50, y: 45 } })?.part,
  ).toBe("stem");
  expect(
    paintedOhlcBarAt(rendered, { rootPoint: { x: 46, y: 70 } })?.part,
  ).toBe("openTick");
  expect(
    paintedOhlcBarAt(rendered, { rootPoint: { x: 54, y: 60 } })?.part,
  ).toBe("closeTick");
  datum.close = 999;
  expect(nearestRecordedOhlcBarX(rendered, { time: 1000 })?.close).toBe(5);
  data.set([{ time: 1000, open: 4, high: 7, low: 2, close: 6, desk: "Beta" }]);
  runtime.flush();
  expect(() => nearestRecordedOhlcBarX(rendered, { time: 1000 })).toThrow(
    /stale/,
  );
  runtime.dispose();
  expect(inspection!.rendered()).toBeUndefined();
});

it("skips missing values and rejects malformed finite OHLC bars", () => {
  runtime = testRuntime();
  runtime.mount(
    <UTCScale id="t" domain={[0, 2000]} range={[0, 60]}>
      <LinearScale id="p" domain={[0, 10]} range={[100, 0]}>
        <OhlcBarSeries
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

it("keeps zero-opacity and doji records queryable while painted queries honor transforms, clips, and source overlap", () => {
  runtime = testRuntime();
  const data = [
    { id: "back", time: 1000, open: 5, high: 8, low: 2, close: 5 },
    { id: "front", time: 1000, open: 5, high: 8, low: 2, close: 5 },
    { id: "hidden", time: 2000, open: 4, high: 7, low: 1, close: 6 },
  ];
  const clip = new Path2D();
  clip.rect(0, 0, 22, 100);
  let inspection: OhlcBarInspectionRef<(typeof data)[number]>;
  function Marks() {
    inspection = useOhlcBarInspection({
      data,
      time: "time",
      open: "open",
      high: "high",
      low: "low",
      close: "close",
    });
    return (
      <Group style={{ translateX: 20, scaleX: 2 }}>
        <Clip style={{ d: clip }}>
          <OhlcBarSeries
            data={data}
            time="time"
            open="open"
            high="high"
            low="low"
            close="close"
            xScale="t"
            yScale="p"
            inspection={inspection}
            style={(row) => ({
              bandwidth: 10,
              strokeWidth: 2,
              opacity: row.id === "hidden" ? 0 : 1,
            })}
          />
        </Clip>
      </Group>
    );
  }
  runtime.mount(
    <UTCScale id="t" domain={[0, 2000]} range={[0, 40]}>
      <LinearScale id="p" domain={[0, 10]} range={[100, 0]}>
        <Marks />
      </LinearScale>
    </UTCScale>,
  );
  runtime.flush();
  const rendered = inspection!.rendered()!;
  expect(rendered.timeAtRoot({ x: 80, y: 50 })).toBe(1000);
  expect(nearestRecordedOhlcBarX(rendered, { time: 2000 })).toMatchObject({
    datum: data[2],
    timeDelta: 0,
  });
  expect(
    paintedOhlcBarAt(rendered, { rootPoint: { x: 80, y: 50 } }),
  ).toMatchObject({ datum: data[1], part: "closeTick" });
  expect(
    paintedOhlcBarAt(rendered, { rootPoint: { x: 90, y: 50 } }),
  ).toBeUndefined();
  expect(
    paintedOhlcBarAt(rendered, { rootPoint: { x: 120, y: 40 } }),
  ).toBeUndefined();
  expect(
    nearestRecordedOhlcBarX(rendered, {
      time: 1000,
      filter: (candidate) => candidate.anchorInsideClips(),
    })?.datum,
  ).toBe(data[0]);
});
