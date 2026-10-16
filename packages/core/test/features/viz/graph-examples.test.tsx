import { expect, it, vi } from "vitest";
import mountDependency from "../../../../scenarios/src/learning/composition/viz-graph-dependency.example.js";
import mountForce from "../../../../scenarios/src/learning/composition/viz-graph-force.example.js";
import {
  clickLogicalPoint,
  pointerDownLogicalPoint,
  pointerMoveLogicalPoint,
  pointerUpLogicalPoint,
} from "../../support/user-input.js";
import { testRuntime } from "./support/runtime.js";
function click(canvas: HTMLCanvasElement, x: number, y: number) {
  const r = canvas.getBoundingClientRect();
  for (const type of ["mousedown", "mouseup", "click"])
    canvas.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        clientX: r.left + x,
        clientY: r.top + y,
      }),
    );
}
it("mounts the exact dependency showcase with readable stage labels and selection context", () => {
  const runtime = testRuntime(),
    labels: string[] = [];
  const draw = CanvasRenderingContext2D.prototype.fillText;
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(
    function (
      this: CanvasRenderingContext2D,
      ...args: Parameters<CanvasRenderingContext2D["fillText"]>
    ) {
      labels.push(args[0]);
      draw.apply(this, args);
    },
  );
  const canvas = document.createElement("canvas");
  canvas.width = 1100;
  canvas.height = 620;
  canvas.style.cssText = "width:1100px;height:620px";
  document.body.append(canvas);
  const app = mountDependency(canvas);
  try {
    runtime.flush();
    expect(labels).toContain("Global rollout");
    expect(labels).toContain("Canary release");
    click(canvas, 100, 280);
    runtime.flush();
    expect(
      labels.some(
        (label) =>
          label.includes("0 prerequisites") &&
          label.includes("3 downstream stages"),
      ),
    ).toBe(true);
    expect(labels.some((label) => label.includes("rebuild"))).toBe(false);
  } finally {
    app.dispose();
    runtime.dispose();
  }
});
it("drags a collaboration node with native pointer capture and keeps the pinned position while paused", async () => {
  const runtime = testRuntime(),
    labels: string[] = [];
  let now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const positions = new Map<string, { x: number; y: number }>();
  const draw = CanvasRenderingContext2D.prototype.fillText;
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(
    function (
      this: CanvasRenderingContext2D,
      ...args: Parameters<CanvasRenderingContext2D["fillText"]>
    ) {
      labels.push(args[0]);
      const point = this.getTransform().transformPoint({
        x: args[1],
        y: args[2],
      });
      positions.set(args[0], { x: point.x, y: point.y });
      draw.apply(this, args);
    },
  );
  const canvas = document.createElement("canvas");
  canvas.width = 1100;
  canvas.height = 620;
  canvas.style.cssText = "width:1100px;height:620px";
  document.body.append(canvas);
  const app = mountForce(canvas);
  const tick = () => {
    now += 17;
    runtime.flush();
  };
  try {
    for (let i = 0; i < 4; i++) tick();
    expect(labels).toContain("Checkout");
    click(canvas, 700, 552);
    for (let i = 0; i < 4; i++) tick();
    expect(labels).toContain("Resume layout");
    const label = positions.get("Checkout")!;
    const from = { x: label.x, y: label.y - 36 };
    await clickLogicalPoint(canvas, from);
    for (let i = 0; i < 4; i++) tick();
    expect(labels).not.toContain(
      "Pinned in place. Release it to rejoin the layout.",
    );
    const to = { x: from.x + 60, y: from.y + 20 };
    await pointerDownLogicalPoint(canvas, from);
    for (let i = 0; i < 4; i++) tick();
    await pointerMoveLogicalPoint(canvas, { x: from.x + 30, y: from.y + 10 });
    for (let i = 0; i < 4; i++) tick();
    await pointerMoveLogicalPoint(canvas, to);
    for (let i = 0; i < 4; i++) tick();
    await pointerUpLogicalPoint(canvas, to);
    for (let i = 0; i < 4; i++) tick();
    const moved = positions.get("Checkout")!;
    expect(moved.x - label.x).toBeCloseTo(60, 0);
    expect(moved.y - label.y).toBeCloseTo(20, 0);
    expect(labels).toContain(
      "Pinned in place. Release it to rejoin the layout.",
    );
    for (let i = 0; i < 4; i++) tick();
    expect(positions.get("Checkout")).toEqual(moved);
    labels.length = 0;
    click(canvas, 50, 150);
    for (let i = 0; i < 4; i++) tick();
    expect(labels).toContain("Select a team");
    expect(positions.get("Checkout")).toEqual(moved);
    await clickLogicalPoint(canvas, { x: moved.x, y: moved.y - 36 });
    for (let i = 0; i < 4; i++) tick();
    expect(labels).toContain(
      "Pinned in place. Release it to rejoin the layout.",
    );
    click(canvas, 840, 552);
    for (let i = 0; i < 4; i++) tick();
    expect(labels.at(-1)).not.toContain("rebuild");
    click(canvas, 700, 552);
    for (let i = 0; i < 400; i++) tick();
    const settledCheckout = positions.get("Checkout")!;
    const settledPayments = positions.get("Payments")!;
    const settledFrom = { x: settledCheckout.x, y: settledCheckout.y - 36 };
    await pointerDownLogicalPoint(canvas, settledFrom);
    await pointerMoveLogicalPoint(canvas, {
      x: settledFrom.x + 60,
      y: settledFrom.y - 30,
    });
    for (let i = 0; i < 6; i++) tick();
    await pointerUpLogicalPoint(canvas, {
      x: settledFrom.x + 60,
      y: settledFrom.y - 30,
    });
    for (let i = 0; i < 6; i++) tick();
    expect(positions.get("Payments")).not.toEqual(settledPayments);
  } finally {
    app.dispose();
    runtime.dispose();
  }
  expect(runtime.pending).toBe(0);
});
