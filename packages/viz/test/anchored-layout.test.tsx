import {
  Rectangle,
  signal,
  useCanvasContext,
  useConst,
  useLayoutBox,
} from "@crc/core";
import * as Viz from "@crc/viz";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it("separates nearby boxes while protecting every anchor, including at edges and in undersized bounds", () => {
  expect(Viz.AnchoredLayout).toBeTypeOf("function");
  runtime = testRuntime();
  const items = signal([
    {
      key: "a",
      anchor: { x: 100, y: 68 },
      anchorRadius: 6,
      width: 64,
      height: 32,
    },
    {
      key: "b",
      anchor: { x: 100, y: 70 },
      anchorRadius: 6,
      width: 64,
      height: 32,
    },
  ]);
  const bounds = signal({ x: 0, y: 0, width: 200, height: 140 });
  const boxes = new Map<
    string,
    { x: number; y: number; width: number; height: number }
  >();
  function Probe({ id }: { id: string }) {
    const matrix = useCanvasContext().getTransform();
    const size = useLayoutBox();
    boxes.set(id, {
      x: matrix.e,
      y: matrix.f,
      width: size.width,
      height: size.height,
    });
    return (
      <Rectangle
        pointerEvents="none"
        style={{ width: "100%", height: "100%", fill: "blue" }}
      />
    );
  }
  runtime.mount(
    <>
      <Viz.AnchoredLayout items={items} bounds={bounds} gap={8}>
        {(item) => <Probe id={String(item.key)} />}
      </Viz.AnchoredLayout>
    </>,
  );
  for (const [x, y, width, height] of [
    [100, 68, 200, 140],
    [194, 2, 200, 140],
    [2, 138, 200, 140],
    [15, 15, 30, 30],
  ]) {
    bounds.set({ x: 0, y: 0, width, height });
    items.set(
      items.get().map((item, i) => ({ ...item, anchor: { x, y: y + i * 2 } })),
    );
    runtime.flush();
    const [a, b] = [...boxes.values()];
    expect(a.width).toBe(64);
    expect(a.height).toBe(32);
    expect(a.y + a.height + 8).toBeLessThanOrEqual(b.y);
    for (const box of [a, b]) {
      for (const item of items.get()) {
        const nearX = Math.max(
          box.x,
          Math.min(item.anchor.x, box.x + box.width),
        );
        const nearY = Math.max(
          box.y,
          Math.min(item.anchor.y, box.y + box.height),
        );
        expect(
          Math.hypot(nearX - item.anchor.x, nearY - item.anchor.y),
        ).toBeGreaterThanOrEqual(14);
      }
      if (width === 200) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(height);
      }
    }
  }
});

it("preserves keyed content on reorder and gives horizontal rows their own allocations", () => {
  expect(Viz.AnchoredLayout).toBeTypeOf("function");
  runtime = testRuntime();
  const rows = signal([
    { key: "a", anchor: { x: 100, y: 50 }, width: 40, height: 20, label: "A" },
    { key: "b", anchor: { x: 102, y: 50 }, width: 40, height: 20, label: "B" },
  ]);
  const state = new Map<string, { id: object; x: number; y: number }>();
  function Probe({ label }: { label: string }) {
    const id = useConst(() => ({})),
      matrix = useCanvasContext().getTransform();
    state.set(label, { id, x: matrix.e, y: matrix.f });
    return null;
  }
  runtime.mount(
    <Viz.AnchoredLayout items={rows} direction="horizontal" gap={8}>
      {(item) => <Probe label={item.label} />}
    </Viz.AnchoredLayout>,
  );
  runtime.flush();
  const before = state.get("A")!;
  expect(before.x + 48).toBeLessThanOrEqual(state.get("B")!.x);
  rows.set([...rows.get()].reverse());
  runtime.flush();
  expect(state.get("A")).toEqual(before);
  runtime.dispose();
  rows.set([]);
  expect(runtime.pending).toBe(0);
});
