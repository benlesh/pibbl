import lazyMount from "../../../../scenarios/src/learning/composition/viz-lazy-inspection.example.js";
import paintedMount from "../../../../scenarios/src/learning/composition/viz-painted-inspection.example.js";
import { afterEach, expect, it, vi } from "vitest";

const cleanups: (() => void)[] = [];

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function mountLesson(
  mount: (canvas: HTMLCanvasElement) => { dispose(): void },
) {
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
    (callback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    },
  );
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    frames.delete(id);
  });
  const flush = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(performance.now()));
  };
  const canvas = document.createElement("canvas");
  canvas.width = 340;
  canvas.height = 280;
  document.body.append(canvas);
  const labels: string[] = [];
  const context = canvas.getContext("2d")!;
  const native = context.fillText.bind(context);
  vi.spyOn(context, "fillText").mockImplementation((text, ...args) => {
    labels.push(String(text));
    native(text, ...args);
  });
  const controller = mount(canvas);
  cleanups.push(() => controller.dispose());
  flush();
  return { canvas, controller, flush, labels, frames };
}

function click(canvas: HTMLCanvasElement, x: number, y: number) {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ["mousedown", "mouseup", "click"])
    canvas.dispatchEvent(
      new MouseEvent(type, {
        clientX: bounds.left + x,
        clientY: bounds.top + y,
        bubbles: true,
      }),
    );
}

it("teaches lazy repeated selection with two named simulated orders", () => {
  const lesson = mountLesson(lazyMount);
  expect(lesson.labels).toEqual(
    expect.arrayContaining([
      "LAZY INSPECTION",
      "SIMULATION · ORDERS AT TIME 0 / 10",
      "Click a point. Two equal requests execute once.",
      "Selected order: pending",
      "Memo: 0 requests",
      "A · t0 · $10",
      "B · t10 · $30",
    ]),
  );
  lesson.labels.length = 0;
  click(lesson.canvas, 80, 155);
  lesson.flush();
  expect(lesson.labels).toEqual(
    expect.arrayContaining([
      "Selected order: time 0 · price 10",
      "Memo: 2 equal requests · 1 execution",
    ]),
  );
  lesson.labels.length = 0;
  lesson.canvas.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  lesson.flush();
  expect(lesson.labels).toEqual(
    expect.arrayContaining([
      "Selected order: time 10 · price 30",
      "Memo: 2 equal requests · 1 execution",
    ]),
  );
  lesson.controller.dispose();
  expect(lesson.frames.size).toBe(0);
});

it("teaches painted coverage separately from nearest data by click and keyboard", () => {
  const lesson = mountLesson(paintedMount);
  expect(lesson.labels).toEqual(
    expect.arrayContaining([
      "PAINTED MARKS ≠ NEAREST DATA",
      "SIMULATION · ORDER A / ORDER B OVERLAP",
      "Click the overlap or press Enter. A teal · B coral.",
      "Nearest center: pending",
      "Painted top mark: pending",
      "A",
      "B",
    ]),
  );
  lesson.labels.length = 0;
  click(lesson.canvas, 100, 100);
  lesson.flush();
  expect(lesson.labels).toEqual(
    expect.arrayContaining([
      "Nearest center: Order A",
      "Painted top mark: Order B",
    ]),
  );
  lesson.labels.length = 0;
  lesson.canvas.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  lesson.flush();
  expect(lesson.labels).toEqual(
    expect.arrayContaining([
      "Nearest center: Order A",
      "Painted top mark: Order B",
      "Input: keyboard",
    ]),
  );
  lesson.controller.dispose();
  expect(lesson.frames.size).toBe(0);
});
