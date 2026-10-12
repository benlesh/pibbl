import sessionMount from "../../../../scenarios/src/learning/composition/financial-market-session.example.js";
import tradingMount from "../../../../scenarios/src/learning/composition/financial-trading-time.example.js";
import candleMount from "../../../../scenarios/src/learning/composition/financial-candles.example.js";
import volumeMount from "../../../../scenarios/src/learning/composition/financial-volume.example.js";
import { afterEach, expect, it, vi } from "vitest";

const cleanups: (() => void)[] = [];
const frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  frames.clear();
  frameId = 0;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function mount(
  example: (canvas: HTMLCanvasElement) => { dispose(): void },
  width: number,
  height: number,
) {
  if (!vi.isMockFunction(globalThis.requestAnimationFrame))
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
      (callback) => {
        frames.set(++frameId, callback);
        return frameId;
      },
    );
  if (!vi.isMockFunction(globalThis.cancelAnimationFrame))
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((key) => {
      frames.delete(key);
    });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, width, height),
  );
  document.body.append(canvas);
  const labels: string[] = [];
  const context = canvas.getContext("2d")!;
  const native = context.fillText.bind(context);
  vi.spyOn(context, "fillText").mockImplementation((text, x, y, maxWidth) => {
    labels.push(String(text));
    const metrics = context.measureText(text);
    const transform = context.getTransform();
    const a = transform.transformPoint(
      new DOMPoint(
        x - metrics.actualBoundingBoxLeft,
        y - metrics.actualBoundingBoxAscent,
      ),
    );
    const b = transform.transformPoint(
      new DOMPoint(
        x + metrics.actualBoundingBoxRight,
        y + metrics.actualBoundingBoxDescent,
      ),
    );
    expect(a.x, String(text)).toBeGreaterThanOrEqual(-1);
    expect(b.x, String(text)).toBeLessThanOrEqual(width + 1);
    expect(a.y, String(text)).toBeGreaterThanOrEqual(-1);
    expect(b.y, String(text)).toBeLessThanOrEqual(height + 1);
    native(text, x, y, maxWidth);
  });
  const controller = example(canvas);
  cleanups.push(() => controller.dispose());
  const flush = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(performance.now()));
  };
  flush();
  return { canvas, context, labels, flush, frames };
}
function move(canvas: HTMLCanvasElement, x: number, y: number) {
  canvas.dispatchEvent(
    new PointerEvent("pointermove", {
      pointerId: 1,
      pointerType: "mouse",
      clientX: x,
      clientY: y,
      bubbles: true,
    }),
  );
}
it("uses responsive dark market surfaces with readable ticks and mouse-selected live readouts", () => {
  const desktop = mount(candleMount, 980, 567);
  const mobile = mount(volumeMount, 360, 208);
  const mobileCandle = mount(candleMount, 360, 208);
  expect([...desktop.context.getImageData(1, 1, 1, 1).data]).toEqual([
    13, 20, 34, 255,
  ]);
  expect([...mobile.context.getImageData(1, 1, 1, 1).data]).toEqual([
    13, 20, 34, 255,
  ]);
  expect(desktop.labels).toEqual(
    expect.arrayContaining([
      "Northstar Systems · OHLC",
      "Daily candles · deterministic simulation",
      "112.00",
      "100.00",
    ]),
  );
  expect(mobile.labels).toEqual(
    expect.arrayContaining([
      "Northstar Systems · Volume",
      "Daily shares · deterministic simulation",
      "0",
      "240",
    ]),
  );
  const desktopBefore = desktop.labels.length;
  const mobileBefore = mobile.labels.length;
  move(desktop.canvas, 500, 110);
  desktop.flush();
  move(mobile.canvas, 100, 110);
  mobile.flush();
  expect(
    desktop.labels.slice(desktopBefore).some((label) => label.includes("O ")),
  ).toBe(true);
  expect(
    mobile.labels.slice(mobileBefore).some((label) => label.includes("shares")),
  ).toBe(true);
  desktop.canvas.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
  );
  desktop.flush();
  expect(desktop.frames.size).toBe(0);
  const candleBefore = mobileCandle.labels.length;
  for (const type of ["mousedown", "mouseup", "click"])
    mobileCandle.canvas.dispatchEvent(
      new MouseEvent(type, { clientX: 25, clientY: 114, bubbles: true }),
    );
  mobileCandle.flush();
  expect(
    mobileCandle.labels
      .slice(candleBefore)
      .some(
        (label) =>
          label.includes("click body/wick · arrows · body") ||
          label.includes("click body/wick · arrows · wick"),
      ),
  ).toBe(true);
});

it("toggles every financial example palette with click and keyboard on a portrait canvas", () => {
  for (const example of [
    candleMount,
    volumeMount,
    sessionMount,
    tradingMount,
  ]) {
    const scene = mount(example, 360, 260);
    expect(scene.labels).toContain("Dark");
    for (const type of ["pointerdown", "pointerup"])
      scene.canvas.dispatchEvent(
        new PointerEvent(type, {
          clientX: 320,
          clientY: 22,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true,
          button: 0,
          bubbles: true,
        }),
      );
    for (const type of ["mousedown", "mouseup", "click"])
      scene.canvas.dispatchEvent(
        new MouseEvent(type, { clientX: 320, clientY: 22, bubbles: true }),
      );
    scene.flush();
    expect([...scene.context.getImageData(1, 1, 1, 1).data]).toEqual([
      246, 248, 251, 255,
    ]);
    expect(scene.labels).toContain("Light");
    scene.canvas.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    scene.flush();
    expect([...scene.context.getImageData(1, 1, 1, 1).data]).toEqual([
      13, 20, 34, 255,
    ]);
  }
});
