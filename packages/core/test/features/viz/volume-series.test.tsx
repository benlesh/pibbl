import { Group, signal } from "@pibbl/core";
import { LinearScale, UTCScale, VolumeSeries } from "@pibbl/core/viz";
import {
  useVolumeInspection,
  nearestRecordedVolumeX,
  paintedVolumeAt,
  type VolumeInspectionRef,
} from "@pibbl/core/viz/inspection";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
it("aligns typed volume by timestamps and exposes committed bounds through ordinary inspection", () => {
  runtime = testRuntime();
  const first = { time: 1000, volume: 20, desk: "Rates" },
    second = { time: 2000, volume: 60, desk: "Credit" };
  const data = signal([first, second]);
  let reads = 0;
  const inputs = {
    data,
    time: (d: typeof first) => d.time,
    volume: (d: typeof first) => {
      reads++;
      return d.volume;
    },
  };
  let ref: VolumeInspectionRef<typeof first>;
  function Marks() {
    ref = useVolumeInspection(inputs);
    return (
      <Group style={{ translateX: 10, translateY: 5 }}>
        <VolumeSeries
          data={inputs.data}
          time={inputs.time}
          volume={inputs.volume}
          xScale="t"
          yScale="v"
          inspection={ref}
          style={{ width: 12, fill: "#087f8c" }}
        />
      </Group>
    );
  }
  runtime.mount(
    <UTCScale id="t" domain={[1000, 2000]} range={[20, 120]}>
      <LinearScale id="v" domain={[0, 100]} range={[100, 0]}>
        <Marks />
      </LinearScale>
    </UTCScale>,
  );
  runtime.flush();
  const rendered = ref!.rendered()!;
  expect(reads).toBe(2);
  const hit = nearestRecordedVolumeX(rendered, { time: 1800 });
  expect(hit?.datum).toBe(second);
  expect(hit).toMatchObject({
    sourceIndex: 1,
    time: 2000,
    volume: 60,
    baseline: 0,
    timeDelta: 200,
    boundsLocal: { x: 114, y: 40, width: 12, height: 60 },
    anchorRoot: { x: 130, y: 45 },
  });
  expect(
    paintedVolumeAt(rendered, { rootPoint: { x: 130, y: 70 } })?.datum,
  ).toBe(second);
  expect(
    paintedVolumeAt(rendered, { rootPoint: { x: 80, y: 70 } }),
  ).toBeUndefined();
  expect(rendered.timeAtRoot({ x: 80, y: 70 })).toBe(1500);
  data.set([{ time: 2000, volume: 10, desk: "Credit" }]);
  expect(nearestRecordedVolumeX(rendered, { time: 2000 })?.volume).toBe(60);
  runtime.flush();
  expect(() => nearestRecordedVolumeX(rendered, { time: 2000 })).toThrow(
    /stale/,
  );
  expect(nearestRecordedVolumeX(ref!.rendered()!, { time: 2000 })?.volume).toBe(
    10,
  );
  runtime.dispose();
  expect(ref!.rendered()).toBeUndefined();
});
it("preserves source-over paint for duplicate translucent/stroked columns", () => {
  runtime = testRuntime();
  const rows = [
    { time: 1000, volume: 50, id: "first" },
    { time: 1000, volume: 50, id: "last" },
  ];
  let ref: VolumeInspectionRef<(typeof rows)[number]>;
  function Marks() {
    ref = useVolumeInspection({ data: rows, time: "time", volume: "volume" });
    return (
      <VolumeSeries
        data={rows}
        time="time"
        volume="volume"
        xScale="t"
        yScale="v"
        inspection={ref}
        style={{
          width: 20,
          fill: "#087f8c",
          stroke: "#173a35",
          strokeWidth: 2,
          opacity: 0.5,
        }}
      />
    );
  }
  const canvas = runtime.mount(
    <UTCScale id="t" domain={[0, 2000]} range={[0, 100]}>
      <LinearScale id="v" domain={[0, 100]} range={[100, 0]}>
        <Marks />
      </LinearScale>
    </UTCScale>,
  );
  runtime.flush();
  expect(
    canvas.getContext("2d")!.getImageData(50, 75, 1, 1).data[3],
  ).toBeGreaterThan(180);
  expect(
    paintedVolumeAt(ref!.rendered()!, { rootPoint: { x: 50, y: 75 } })?.datum,
  ).toBe(rows[1]);
  expect(nearestRecordedVolumeX(ref!.rendered()!, { time: 1000 })?.datum).toBe(
    rows[0],
  );
});
