import { signal } from "@crc/core";
import * as viz from "@crc/viz";
import { afterEach, expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
it("lays out explicit outside labels once and reuses geometry and measurements during selection", () => {
  expect(viz).toHaveProperty("PieLayout");
  runtime = testRuntime();
  const selected = signal(false);
  const rows = [
    { id: "a", value: 92 },
    { id: "b", value: 5 },
    { id: "c", value: 2 },
    { id: "d", value: 1 },
  ];
  const value = vi.fn((d: (typeof rows)[number]) => d.value);
  const label = vi.fn(
    (s: viz.PieSliceGeometry<(typeof rows)[number]>) =>
      `${s.datum.id}: ${s.value}`,
  );
  const measure = vi.spyOn(CanvasRenderingContext2D.prototype, "measureText");
  let resolved: viz.PieLayoutSlice<(typeof rows)[number]>[] = [];
  let renders = 0;
  function Scene() {
    const active = selected.get();
    resolved = [];
    return (
      <viz.PieLayout
        data={rows}
        value={value}
        keyBy="id"
        label={label}
        placement="outside"
        style={{ cx: 300, cy: 200, radius: 110 }}
      >
        {(slice) => {
          resolved.push(slice);
          renders++;
          return (
            <viz.PieSlice
              slice={slice}
              style={{ fill: active ? "blue" : "red" }}
            >
              <viz.PieLabel slice={slice} />
            </viz.PieSlice>
          );
        }}
      </viz.PieLayout>
    );
  }
  runtime.mount(<Scene />);
  runtime.flush();
  expect(value).toHaveBeenCalledTimes(4);
  expect(label).toHaveBeenCalledTimes(4);
  expect(renders).toBe(4);
  const before = [...resolved];
  for (const s of resolved) {
    expect(s.label?.status).toBe("placed");
    if (s.label?.status !== "placed") throw Error("expected placement");
    expect(s.label.x + s.label.width <= 190 || s.label.x >= 410).toBe(true);
  }
  measure.mockClear();
  selected.set(true);
  runtime.flush();
  expect(measure).not.toHaveBeenCalled();
  expect(value).toHaveBeenCalledTimes(4);
  expect(label).toHaveBeenCalledTimes(4);
  expect(renders).toBe(8);
  expect(resolved.every((s, i) => s === before[i])).toBe(true);
});
it("moves non-fitting labels outside in auto mode and exposes strict-inside and space omissions", () => {
  runtime = testRuntime();
  const placement = signal<viz.PieLabelPlacement>("auto");
  const bounds = signal({ x: 0, y: 0, width: 600, height: 400 });
  const data = [46, 2, 1, 48, 2, 1];
  const value = (n: number) => n;
  const label = (s: viz.PieSliceGeometry<number>) =>
    `Category ${s.index} · ${s.value}%`;
  let result: viz.PieLayoutSlice<number>[] = [];
  function Scene() {
    result = [];
    return (
      <viz.PieLayout
        data={data}
        value={value}
        label={label}
        placement={placement}
        bounds={bounds}
        style={{ cx: 300, cy: 200, radius: 90 }}
      >
        {(slice) => {
          result.push(slice);
          return (
            <viz.PieSlice slice={slice} style={{ fill: "red" }}>
              <viz.PieLabel slice={slice} />
            </viz.PieSlice>
          );
        }}
      </viz.PieLayout>
    );
  }
  runtime.mount(<Scene />);
  runtime.flush();
  expect(
    result
      .filter((s) => s.value <= 2)
      .every(
        (s) => s.label?.status === "placed" && s.label.placement === "outside",
      ),
  ).toBe(true);
  const boxes = result.flatMap((s) =>
    s.label?.status === "placed" ? [s.label] : [],
  );
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i],
        b = boxes[j];
      expect(
        a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y,
      ).toBe(true);
    }
  placement.set("inside");
  runtime.flush();
  expect(
    result
      .filter((s) => s.value <= 2)
      .every(
        (s) => s.label?.status === "hidden" && s.label.reason === "inside-fit",
      ),
  ).toBe(true);
  placement.set("outside");
  bounds.set({ x: 210, y: 110, width: 180, height: 180 });
  runtime.flush();
  expect(
    result.every(
      (s) => s.label?.status === "hidden" && s.label.reason === "space",
    ),
  ).toBe(true);
});
it("rejects invalid fonts instead of measuring with inherited Canvas state", () => {
  runtime = testRuntime();
  runtime.mount(
    <viz.PieLayout
      data={[1]}
      value={(v: number) => v}
      label={() => "One"}
      style={{ labelFont: "not a valid font" }}
    >
      {(slice) => <viz.PieLabel slice={slice} />}
    </viz.PieLayout>,
  );
  expect(() => runtime.flush()).toThrow(/labelFont/);
});
it("fans tiny-slice leaders apart immediately without crossing the pie", () => {
  runtime = testRuntime();
  const result: viz.PieLayoutSlice<number>[] = [];
  runtime.mount(
    <viz.PieLayout
      data={[46, 2, 1, 48, 2, 1]}
      value={(n: number) => n}
      label={(s) => `Category ${s.index}`}
      placement="outside"
      bounds={{ x: 0, y: 0, width: 600, height: 400 }}
      style={{ cx: 300, cy: 200, radius: 90 }}
    >
      {(slice) => {
        result.push(slice);
        return <viz.PieLabel slice={slice} />;
      }}
    </viz.PieLayout>,
  );
  runtime.flush();
  const leaders = result
    .filter((s) => s.value <= 2)
    .map((s) => {
      if (s.label?.status !== "placed" || !s.label.leader)
        throw Error("expected leader");
      return s.label.leader;
    });
  // At the midpoint of their long exits, neighboring tiny-slice leaders must
  // already be distinguishable instead of sharing almost the same horizontal.
  for (const pair of [
    [0, 1],
    [2, 3],
  ]) {
    const [a, b] = pair.map((i) => leaders[i]);
    const ay = (a[0][1] + a[1][1]) / 2;
    const by = (b[0][1] + b[1][1]) / 2;
    expect(Math.abs(ay - by)).toBeGreaterThan(5);
  }
  for (const leader of leaders) {
    const [a, b] = leader;
    // A nonnegative outward derivative proves a straight exit stays outside
    // the circle, including at its attachment point.
    expect(
      (a[0] - 300) * (b[0] - a[0]) + (a[1] - 200) * (b[1] - a[1]),
    ).toBeGreaterThanOrEqual(-1e-8);
  }
});
