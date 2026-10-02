import {
  Absolute,
  Rectangle,
  useCanvasContext,
  useLayoutBox,
  signal,
} from "@crc/core";
import * as Viz from "@crc/core/viz";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
it("keeps the outer card clear of protected anchors at edges, corners, and oversized bounds", () => {
  expect(Viz.HoverCard).toBeTypeOf("function");
  runtime = testRuntime();
  const anchor = signal({ x: 50, y: 50 });
  const size = signal({ width: 40, height: 24, padding: 0, strokeWidth: 2 });
  let box = { x: 0, y: 0, width: 0, height: 0 };
  function Probe() {
    const m = useCanvasContext().getTransform();
    const b = useLayoutBox();
    box = { x: m.e, y: m.f, width: b.width, height: b.height };
    return null;
  }
  runtime.mount(
    <Absolute style={{ width: 100, height: 100 }}>
      <Viz.HoverCard anchor={anchor} anchorRadius={6} gap={8} style={size}>
        <Probe />
      </Viz.HoverCard>
    </Absolute>,
  );
  for (const [width, height] of [
    [40, 24],
    [150, 120],
  ]) {
    size.set({ width, height, padding: 0, strokeWidth: 2 });
    for (const [x, y] of [
      [0, 0],
      [100, 0],
      [0, 100],
      [100, 100],
      [50, 50],
      [0, 50],
      [50, 0],
      [100, 50],
      [50, 100],
      [-20, 50],
    ]) {
      anchor.set({ x, y });
      runtime.flush();
      expect(box.width).toBe(width);
      expect(box.height).toBe(height);
      const nearX = Math.max(box.x - 1, Math.min(x, box.x + width + 1));
      const nearY = Math.max(box.y - 1, Math.min(y, box.y + height + 1));
      expect(Math.hypot(x - nearX, y - nearY)).toBeGreaterThanOrEqual(
        14 - 1e-9,
      );
    }
  }
});
it("lets pointer input pass through the rounded background and decorative children", () => {
  expect(Viz.HoverCard).toBeTypeOf("function");
  runtime = testRuntime();
  let clicks = 0;
  const canvas = runtime.mount(
    <>
      <Rectangle
        style={{ width: 600, height: 400, fill: "red" }}
        onPointerDown={() => clicks++}
      />
      <Viz.HoverCard
        anchor={{ x: 50, y: 100 }}
        style={{ width: 80, height: 40, padding: 0 }}
      >
        <Rectangle
          pointerEvents="none"
          style={{ width: 80, height: 40, fill: "rgba(255,255,255,0.1)" }}
        />
      </Viz.HoverCard>
    </>,
  );
  runtime.flush();
  const rect = canvas.getBoundingClientRect();
  canvas.dispatchEvent(
    new PointerEvent("pointerdown", {
      clientX: rect.left + 50,
      clientY: rect.top + 70,
      bubbles: true,
    }),
  );
  expect(clicks).toBe(1);
});
it("uses declared content sizing and keeps percentage children in its own padded allocation", () => {
  runtime = testRuntime();
  let box: { width: number; height: number } | undefined;
  function Probe() {
    box = useLayoutBox();
    return (
      <Rectangle
        pointerEvents="none"
        style={{ width: "100%", height: "100%", fill: "blue" }}
      />
    );
  }
  const canvas = runtime.mount(
    <Viz.HoverCard
      anchor={{ x: 300, y: 200 }}
      placement="below"
      style={{ width: "25%", height: 20, padding: 10 }}
    >
      <Probe />
    </Viz.HoverCard>,
  );
  runtime.flush();
  expect(box?.width).toBe(150);
  expect(box?.height).toBe(20);
  const rgba = canvas.getContext("2d")!.getImageData(230, 225, 1, 1).data;
  expect([...rgba]).toEqual([0, 0, 255, 255]);
});
it.each(["filter", "translateX", "unexpected"])(
  "rejects unsupported card style %s",
  (field) => {
    runtime = testRuntime();
    runtime.mount(
      <Viz.HoverCard
        anchor={{ x: 20, y: 20 }}
        style={{ width: 40, height: 20, [field]: 1 } as never}
      />,
    );
    expect(() => runtime.flush()).toThrow(/does not support/);
  },
);
it("allows explicitly interactive card content to receive pointer events", () => {
  runtime = testRuntime();
  let clicks = 0;
  const canvas = runtime.mount(
    <Viz.HoverCard
      anchor={{ x: 50, y: 100 }}
      style={{ width: 80, height: 40, padding: 0 }}
    >
      <Rectangle
        style={{ width: 80, height: 40, fill: "blue" }}
        onPointerDown={() => clicks++}
      />
    </Viz.HoverCard>,
  );
  runtime.flush();
  const rect = canvas.getBoundingClientRect();
  canvas.dispatchEvent(
    new PointerEvent("pointerdown", {
      clientX: rect.left + 50,
      clientY: rect.top + 70,
      bubbles: true,
    }),
  );
  expect(clicks).toBe(1);
});
it("updates clearance and preferred sides without sacrificing exclusion in tiny explicit bounds", () => {
  runtime = testRuntime();
  const placement = signal<Viz.HoverPlacement>("above");
  const radius = signal(6);
  const gap = signal(8);
  const bounds = signal({ x: 0, y: 0, width: 200, height: 200 });
  let box = { x: 0, y: 0 };
  function Probe() {
    const m = useCanvasContext().getTransform();
    box = { x: m.e, y: m.f };
    return null;
  }
  function Scene() {
    return (
      <Viz.HoverCard
        anchor={{ x: 100, y: 100 }}
        anchorRadius={radius}
        gap={gap}
        placement={placement.get()}
        bounds={bounds}
        style={{ width: 40, height: 20, padding: 0, strokeWidth: 2 }}
      >
        <Probe />
      </Viz.HoverCard>
    );
  }
  runtime.mount(<Scene />);
  for (const [side, expected] of [
    ["above", { x: 80, y: 65 }],
    ["below", { x: 80, y: 115 }],
    ["right", { x: 115, y: 90 }],
    ["left", { x: 45, y: 90 }],
  ] as const) {
    placement.set(side);
    runtime.flush();
    expect(box).toEqual(expected);
  }
  radius.set(10);
  gap.set(20);
  placement.set("above");
  runtime.flush();
  expect(box).toEqual({ x: 80, y: 49 });
  for (const size of [0, 1]) {
    bounds.set({ x: 100, y: 100, width: size, height: size });
    runtime.flush();
    const nearX = Math.max(box.x - 1, Math.min(100, box.x + 41));
    const nearY = Math.max(box.y - 1, Math.min(100, box.y + 21));
    expect(Math.hypot(100 - nearX, 100 - nearY)).toBeGreaterThanOrEqual(30);
  }
});
