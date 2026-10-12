import mount from "../../../../scenarios/src/learning/composition/financial-trading-time.example.js";
import { afterEach, expect, it, vi } from "vitest";

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

it("teaches equal observation slots across the Friday-to-Monday UTC gap and pans by half a slot", () => {
  const frames = new Map<number, FrameRequestCallback>();
  let next = 0;
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
    (callback) => {
      frames.set(++next, callback);
      return next;
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
  canvas.width = 760;
  canvas.height = 440;
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
  expect(labels).toEqual(
    expect.arrayContaining([
      "Trading-time observations",
      "Equal slots · simulated quotes",
      "105.00",
      "Viewport slots: -0.5 to 2.5",
    ]),
  );
  const initialBounds = canvas.getBoundingClientRect();
  canvas.dispatchEvent(
    new MouseEvent("mousemove", {
      clientX: initialBounds.left + 362,
      clientY: initialBounds.top + 120,
      bubbles: true,
    }),
  );
  flush();
  expect(labels).toContain("Mon · 05 Oct 09:30 UTC · $104.00");
  labels.length = 0;
  const bounds = canvas.getBoundingClientRect();
  for (const type of ["mousedown", "mouseup", "click"])
    canvas.dispatchEvent(
      new MouseEvent(type, {
        clientX: bounds.left + 90,
        clientY: bounds.top + 408,
        bubbles: true,
      }),
    );
  flush();
  expect(labels).toContain("Viewport slots: 0 to 3");
  labels.length = 0;
  canvas.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
  );
  flush();
  expect(labels).toContain("Viewport slots: 0.5 to 3.5");
  controller.dispose();
  expect(frames.size).toBe(0);
});
