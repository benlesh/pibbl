import { expect, it } from "vitest";
import mount from "../../scenarios/src/learning/composition/physics-2d.example.js";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../src/lib/scheduler/testing.js";

// Drive the actual public lesson. Its painted blue silhouette is the observable
// drag position; no test-only body or alternate interaction implementation.
function ballCenter(canvas: HTMLCanvasElement) {
  const pixels = canvas
    .getContext("2d")!
    .getImageData(0, 0, canvas.width, canvas.height).data;
  let x = 0,
    y = 0,
    count = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] === 37 && pixels[i + 1] === 99 && pixels[i + 2] === 235) {
      x += (i / 4) % canvas.width;
      y += Math.floor(i / 4 / canvas.width);
      count++;
    }
  }
  expect(count).toBeGreaterThan(500);
  return { x: x / count + 0.5, y: y / count + 0.5 };
}

it("keeps the grabbed point under the pointer without jumping on drag or release", () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 420;
  canvas.style.width = "720px";
  canvas.style.height = "420px";
  document.body.append(canvas);
  const controller = mount(canvas);
  let now = 0;
  const flush = () => driver.flush(now);
  const pointer = (type: string, x: number, y: number) => {
    const box = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        buttons: type === "pointerup" ? 0 : 1,
        clientX: box.left + x,
        clientY: box.top + y,
      }),
    );
    flush();
  };
  try {
    flush();
    for (let i = 0; i < 120; i++) {
      now += 1000 / 60;
      flush();
    }
    const initial = ballCenter(canvas);
    pointer("pointerdown", initial.x + 8, initial.y - 5);
    const grabbed = ballCenter(canvas);
    expect(grabbed.x).toBeCloseTo(initial.x, 0);
    expect(grabbed.y).toBeCloseTo(initial.y, 0);
    pointer("pointermove", initial.x + 48, initial.y - 75);
    const moved = ballCenter(canvas);
    expect(moved.x).toBeCloseTo(initial.x + 40, 0);
    expect(moved.y).toBeCloseTo(initial.y - 70, 0);
    pointer("pointerup", initial.x + 48, initial.y - 75);
    const released = ballCenter(canvas);
    expect(released.x).toBeCloseTo(moved.x, 0);
    expect(released.y).toBeCloseTo(moved.y, 0);
  } finally {
    controller.dispose();
    restore();
    canvas.remove();
  }
});
