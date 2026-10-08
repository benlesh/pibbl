import mount from "../../../../scenarios/src/learning/composition/viz-inspection-workbench.example.js";
import { afterEach, expect, it, vi } from "vitest";

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

it("runs the public showcase through click and keyboard with semantic results and exact disposal", () => {
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
    (callback) => {
      frames.set(++id, callback);
      return id;
    },
  );
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((key) => {
    frames.delete(key);
  });
  const flush = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(performance.now()));
  };
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 640;
  document.body.append(canvas);
  const evidence: Parameters<
    NonNullable<NonNullable<Parameters<typeof mount>[1]>["onEvidence"]>
  >[0][] = [];
  const controller = mount(canvas, {
    onEvidence: (value) => evidence.push(value),
  });
  cleanups.push(() => controller.dispose());
  flush();
  expect(evidence).toEqual([]);
  const bounds = canvas.getBoundingClientRect();
  for (const type of ["mousedown", "mouseup", "click"])
    canvas.dispatchEvent(
      new MouseEvent(type, {
        clientX: bounds.left + 24 + 426,
        clientY: bounds.top + 125,
        bubbles: true,
      }),
    );
  expect(evidence.at(-1)).toMatchObject({ sourceIndex: 12, memoized: true });
  expect(evidence.at(-1)?.recorded).toBeCloseTo(
    100 + 12 * 0.22 + Math.sin(12 * 0.64) * 2.4,
  );
  flush();
  canvas.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
  );
  expect(evidence.at(-1)?.sourceIndex).toBe(13);
  expect(evidence.at(-1)).toMatchObject({nearestMark:null,paintedMark:null});
  flush();
  controller.dispose();
  controller.dispose();
  expect(frames.size).toBe(0);
});

it.each([
  [1000, 640],
  [560, 300],
  [360, 300],
  [320, 260],
  [320, 640],
])(
  "keeps essential text and risk inspection inside a %ix%i logical allocation",
  (width, height) => {
    const frames = new Map<number, FrameRequestCallback>();
    let id = 0;
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
      (callback) => {
        frames.set(++id, callback);
        return id;
      },
    );
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((key) => {
      frames.delete(key);
    });
    const flush = () => {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(performance.now()));
    };
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    document.body.append(canvas);
    const ctx = canvas.getContext("2d")!;
    const labels: {
      text: string;
      left: number;
      right: number;
      top: number;
      bottom: number;
    }[] = [];
    const original = ctx.fillText.bind(ctx);
    vi.spyOn(ctx, "fillText").mockImplementation((text, x, y, maxWidth) => {
      const metrics = ctx.measureText(text),
        transform = ctx.getTransform();
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
      labels.push({ text, left: a.x, right: b.x, top: a.y, bottom: b.y });
      original(text, x, y, maxWidth);
    });
    const evidence: Parameters<
      NonNullable<NonNullable<Parameters<typeof mount>[1]>["onEvidence"]>
    >[0][] = [];
    const controller = mount(canvas, {
      onEvidence: (value) => evidence.push(value),
    });
    cleanups.push(() => controller.dispose());
    flush();
    const assertLabels = () => {
      expect(labels.length).toBeGreaterThan(8);
      for (const label of labels) {
        expect(label.left, label.text).toBeGreaterThanOrEqual(-1);
        expect(label.right, label.text).toBeLessThanOrEqual(canvas.width + 1);
        expect(label.top, label.text).toBeGreaterThanOrEqual(-1);
        expect(label.bottom, label.text).toBeLessThanOrEqual(canvas.height + 1);
      }
    };
    assertLabels();
    const compact = height < 480,
      plotHeight = Math.max(compact ? 40 : 55, height - (compact ? 225 : 385)),
      riskTop = (compact ? 68 : 105) + plotHeight + (compact ? 75 : 115),
      riskHeight = compact ? 45 : 95;
    const bounds = canvas.getBoundingClientRect();
    for (const type of ["mousedown", "mouseup", "click"])
      canvas.dispatchEvent(
        new MouseEvent(type, {
          clientX: bounds.left + 24 + (width - 48) / 6,
          clientY: bounds.top + riskTop + riskHeight / 2,
          bubbles: true,
        }),
      );
    expect(evidence.at(-1)?.desk).toBe("Rates");
    labels.length = 0;
    flush();
    assertLabels();
    const pixel = ctx.getImageData(2, 2, 1, 1).data;
    expect([...pixel]).toEqual([243, 245, 237, 255]);
    controller.dispose();
    expect(frames.size).toBe(0);
  },
);
