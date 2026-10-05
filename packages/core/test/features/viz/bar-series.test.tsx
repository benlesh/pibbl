import { Absolute, Group, signal } from "@pibbl/core";
import * as Viz from "@pibbl/core/viz";
import { afterEach, expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it("maps ordered reactive bands and targets signed bars, not padding or missing rows", () => {
  expect(Viz).toHaveProperty("BarSeries");
  runtime = testRuntime();
  const domain = signal<readonly string[]>(["gain", "loss", "missing"]);
  const style = signal({ width: 300, height: 200 });
  const snapshots: Viz.ResolvedBandScale[] = [];
  const identities: unknown[] = [];
  let clicks = 0;
  function Probe() {
    const scale = Viz.useScale("category", "band");
    identities.push(scale);
    snapshots.push(scale.get());
  }
  const canvas = runtime.mount(
    <Absolute>
      <Viz.Scale
        id="category"
        type="band"
        domain={domain}
        range="width"
        paddingInner={0.2}
        paddingOuter={0.1}
        style={style}
      >
        <Viz.Scale
          id="value"
          type="linear"
          domain={[-10, 10]}
          range="height"
          reverse
        >
          <Probe />
          <Viz.BarSeries
            data={[
              { category: "gain", value: 8 },
              { category: "loss", value: -6 },
              { category: "missing", value: null },
              { category: "unknown", value: 9 },
            ]}
            category="category"
            value="value"
            categoryScale="category"
            valueScale="value"
            style={{ fill: "#ff0000" }}
            onPointerDown={() => clicks++}
          />
        </Viz.Scale>
      </Viz.Scale>
    </Absolute>,
  );
  runtime.flush();
  const first = snapshots.at(-1)!;
  expect(first.domain).toEqual(["gain", "loss", "missing"]);
  expect(first.map("gain")).toBeCloseTo(10);
  expect(first.bandwidth).toBeCloseTo(80);
  expect(first.map("unknown")).toBeUndefined();
  const ctx = canvas.getContext("2d")!;
  const alpha = (x: number, y: number) => ctx.getImageData(x, y, 1, 1).data[3];
  expect(alpha(50, 50)).toBe(255);
  expect(alpha(150, 130)).toBe(255);
  expect(alpha(100, 50)).toBe(0);
  expect(alpha(250, 50)).toBe(0);
  const click = (x: number, y: number) => {
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: rect.left + x,
        clientY: rect.top + y,
        bubbles: true,
      }),
    );
  };
  click(50, 50);
  click(150, 130);
  click(100, 50);
  click(250, 50);
  expect(clicks).toBe(2);
  domain.set(["loss", "gain", "missing"]);
  style.set({ width: 600, height: 200 });
  runtime.flush();
  expect(snapshots.at(-1)!.map("gain")).toBeCloseTo(220);
  expect(snapshots.at(-1)!.bandwidth).toBeCloseTo(160);
  expect(identities.at(-1)).toBe(identities[0]);
});

it("maps semantic horizontal values across a categorical left axis", () => {
  runtime = testRuntime();
  const labels: Array<[string, number, number]> = [];
  const fillText = CanvasRenderingContext2D.prototype.fillText;
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(
    function (this: CanvasRenderingContext2D, text, x, y, maxWidth) {
      const point = this.getTransform().transformPoint({ x, y });
      labels.push([String(text), point.x, point.y]);
      if (maxWidth === undefined) fillText.call(this, text, x, y);
      else fillText.call(this, text, x, y, maxWidth);
    },
  );
  const canvas = runtime.mount(
    <Absolute>
      <Viz.Scale
        id="category"
        type="band"
        domain={["gain", "loss"]}
        range="height"
        style={{ width: 300, height: 200 }}
      >
        <Viz.Scale id="value" type="linear" domain={[-10, 10]} range="width">
          <Viz.Axis scale="category" position="left" />
          <Viz.Axis scale="value" position="top" tickCount={3} />
          <Viz.BarSeries
            orientation="horizontal"
            data={[
              { category: "gain", value: 8 },
              { category: "loss", value: -6 },
            ]}
            category="category"
            value="value"
            categoryScale="category"
            valueScale="value"
            style={{ fill: "#ff0000" }}
          />
        </Viz.Scale>
      </Viz.Scale>
    </Absolute>,
  );
  runtime.flush();
  const context = canvas.getContext("2d")!;
  const alpha = (x: number, y: number) =>
    context.getImageData(x, y, 1, 1).data[3];
  expect(alpha(210, 50)).toBe(255);
  expect(alpha(60, 150)).toBe(255);
  expect(alpha(100, 50)).toBe(0);
  expect(labels).toContainEqual(["gain", -10, 50]);
  expect(labels).toContainEqual(["loss", -10, 150]);
  expect(labels).toContainEqual(["-10", 0, -10]);
  expect(labels).toContainEqual(["0", 150, -10]);
  expect(labels).toContainEqual(["10", 300, -10]);
});

it("lets decorative bars opt out of targeting", () => {
  runtime = testRuntime();
  let hits = 0;
  const canvas = runtime.mount(
    <Viz.Scale id="category" type="band" domain={["A"]} range={[0, 100]}>
      <Viz.Scale id="value" type="linear" domain={[0, 10]} range={[100, 0]}>
        <Viz.BarSeries
          data={[{ c: "A", v: 10 }]}
          category="c"
          value="v"
          categoryScale="category"
          valueScale="value"
          pointerEvents="none"
          onPointerDown={() => hits++}
        />
      </Viz.Scale>
    </Viz.Scale>,
  );
  runtime.flush();
  const rect = canvas.getBoundingClientRect();
  canvas.dispatchEvent(
    new PointerEvent("pointerdown", {
      clientX: rect.left + 50,
      clientY: rect.top + 50,
      bubbles: true,
    }),
  );
  expect(hits).toBe(0);
});

it("fills each bar by reactive domain thresholds without changing its border or target", () => {
  runtime = testRuntime();
  const fill = signal({
    type: "threshold" as const,
    thresholds: [0, 30],
    colors: ["#ff8000", "#008000", "#ff0000"],
  });
  let hits = 0;
  const canvas = runtime.mount(
    <Viz.Scale
      id="category"
      type="band"
      domain={["A", "B"]}
      range={[0, 200]}
      paddingInner={0.2}
      paddingOuter={0.1}
    >
      <Viz.Scale id="value" type="linear" domain={[-20, 60]} range={[320, 0]}>
        <Viz.BarSeries
          data={[
            { c: "A", v: 50 },
            { c: "B", v: -10 },
          ]}
          category="c"
          value="v"
          categoryScale="category"
          valueScale="value"
          style={{ fill, stroke: "#000000", strokeWidth: 2 }}
          onPointerDown={() => hits++}
        />
      </Viz.Scale>
    </Viz.Scale>,
  );
  runtime.flush();
  const ctx = canvas.getContext("2d")!;
  const pixel = (x: number, y: number) => [
    ...ctx.getImageData(x, y, 1, 1).data,
  ];
  expect(pixel(50, 60)).toEqual([255, 0, 0, 255]);
  expect(pixel(50, 160)).toEqual([0, 128, 0, 255]);
  expect(pixel(150, 260)).toEqual([255, 128, 0, 255]);
  // The color boundary is not an internal stroke.
  expect(pixel(50, 119)).toEqual([255, 0, 0, 255]);
  expect(pixel(50, 120)).toEqual([0, 128, 0, 255]);
  const rect = canvas.getBoundingClientRect();
  for (const y of [60, 120, 160])
    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: rect.left + 50,
        clientY: rect.top + y,
        bubbles: true,
      }),
    );
  expect(hits).toBe(3);
  fill.set({
    type: "threshold",
    thresholds: [0, 40],
    colors: ["#ff8000", "#008000", "#ff0000"],
  });
  runtime.flush();
  expect(pixel(50, 100)).toEqual([0, 128, 0, 255]);
});

it("follows the horizontal value axis for threshold fills in either range direction", () => {
  runtime = testRuntime();
  const rows = [{ c: "A", v: 50 }];
  const threshold = {
    type: "threshold" as const,
    thresholds: [0, 30],
    colors: ["#ff8000", "#008000", "#ff0000"],
  };
  const canvas = runtime.mount(
    <>
      <Viz.Scale id="normal-category" type="band" domain={["A"]} range={[0, 100]}>
        <Viz.Scale id="normal-value" type="linear" domain={[-20, 60]} range={[0, 320]}>
          <Viz.BarSeries
            orientation="horizontal"
            data={rows}
            category="c"
            value="v"
            categoryScale="normal-category"
            valueScale="normal-value"
            style={{ fill: threshold }}
          />
        </Viz.Scale>
      </Viz.Scale>
      <Group style={{ translateY: 120 }}>
        <Viz.Scale id="reversed-category" type="band" domain={["A"]} range={[0, 100]}>
          <Viz.Scale id="reversed-value" type="linear" domain={[-20, 60]} range={[320, 0]}>
            <Viz.BarSeries
              orientation="horizontal"
              data={rows}
              category="c"
              value="v"
              categoryScale="reversed-category"
              valueScale="reversed-value"
              style={{ fill: threshold }}
            />
          </Viz.Scale>
        </Viz.Scale>
      </Group>
    </>,
  );
  runtime.flush();
  const pixel = (x: number, y: number) => [
    ...canvas.getContext("2d")!.getImageData(x, y, 1, 1).data,
  ];
  expect(pixel(120, 50)).toEqual([0, 128, 0, 255]);
  expect(pixel(240, 50)).toEqual([255, 0, 0, 255]);
  expect(pixel(180, 170)).toEqual([0, 128, 0, 255]);
  expect(pixel(80, 170)).toEqual([255, 0, 0, 255]);
});
