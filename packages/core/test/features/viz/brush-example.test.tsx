import { signal } from "@pibbl/core";
import { expect, it, vi } from "vitest";
import mount from "../../../../scenarios/src/learning/composition/viz-domain-exploration.example.js";
import { testRuntime } from "./support/runtime.js";
import {
  wheelLogicalPoint,
  pointerDownLogicalPoint,
  pointerMoveLogicalPoint,
  pointerUpLogicalPoint,
  tab,
  touchStartLogicalPoint,
} from "../../support/user-input.js";
import { cdp, userEvent } from "vitest/browser";
it("keeps a native captured brush draft separate until commit and cancels with Escape", async () => {
  const runtime = testRuntime(),
    canvas = document.createElement("canvas");
  canvas.style.cssText = "width:560px;height:300px";
  document.body.append(canvas);
  const domain = signal<readonly [number, number]>([
    Date.UTC(1980, 2, 1),
    Date.UTC(1980, 8, 1),
  ]);
  let snapshot:
    | {
        draft: readonly [number, number] | null;
        committed: readonly [number, number];
      }
    | undefined;
  const app = mount(canvas, {
    domain,
    onSnapshot: (s) => {
      snapshot = s;
    },
  });
  try {
    runtime.flush();
    const original = domain.get();
    await pointerDownLogicalPoint(canvas, { x: 280, y: 220 });
    runtime.flush();
    await pointerMoveLogicalPoint(canvas, { x: 320, y: 220 });
    runtime.flush();
    expect(domain.get()).toEqual(original);
    expect(snapshot!.draft).not.toBeNull();
    await pointerUpLogicalPoint(canvas, { x: 320, y: 220 });
    runtime.flush();
    expect(domain.get()).not.toEqual(original);
    const committed = domain.get();
    await pointerDownLogicalPoint(canvas, { x: 320, y: 220 });
    await pointerMoveLogicalPoint(canvas, { x: 350, y: 220 });
    runtime.flush();
    await userEvent.keyboard("{Escape}");
    runtime.flush();
    expect(domain.get()).toEqual(committed);
    expect(snapshot!.draft).toBeNull();
    await pointerUpLogicalPoint(canvas, { x: 350, y: 220 });
    runtime.flush();
    expect(domain.get()).toEqual(committed);
  } finally {
    app.dispose();
    expect(runtime.pending).toBe(0);
    runtime.dispose();
  }
});
it.each([
  [1000, 640],
  [560, 300],
  [360, 300],
  [320, 260],
  [360, 640],
])(
  "keeps brush labels and keyboard domain controls usable at %ix%i",
  async (width, height) => {
    const runtime = testRuntime(),
      canvas = document.createElement("canvas"),
      before = document.createElement("button");
    canvas.style.cssText = `width:${width}px;height:${height}px`;
    document.body.append(before, canvas);
    const domain = signal<readonly [number, number]>([
      Date.UTC(1980, 2, 1),
      Date.UTC(1980, 8, 1),
    ]);
    const labels: string[] = [];
    const native = CanvasRenderingContext2D.prototype.fillText;
    const spy = vi
      .spyOn(CanvasRenderingContext2D.prototype, "fillText")
      .mockImplementation(function (
        this: CanvasRenderingContext2D,
        ...args: Parameters<CanvasRenderingContext2D["fillText"]>
      ) {
        const [text, x, y] = args;
        if (this.globalAlpha > 0) {
          labels.push(text);
          const m = this.measureText(text),
            t = this.getTransform(),
            ratio = this.canvas.width / width,
            a = new DOMPoint(
              x - m.actualBoundingBoxLeft,
              y - m.actualBoundingBoxAscent,
            ).matrixTransform(t),
            b = new DOMPoint(
              x + m.actualBoundingBoxRight,
              y + m.actualBoundingBoxDescent,
            ).matrixTransform(t);
          expect(a.x / ratio, text).toBeGreaterThanOrEqual(0);
          expect(b.x / ratio, text).toBeLessThanOrEqual(width);
          expect(a.y / ratio, text).toBeGreaterThanOrEqual(0);
          expect(b.y / ratio, text).toBeLessThanOrEqual(height);
        }
        native.apply(this, args);
      });
    const app = mount(canvas, { domain });
    try {
      runtime.flush();
      expect(labels).toContain("Committed: 03-01 – 09-01 · CO₂ ppm · 1980");
      before.focus();
      for (let i = 0; i < 5; i++) await tab();
      runtime.flush();
      await userEvent.keyboard("{ArrowRight}");
      runtime.flush();
      expect(domain.get()).toEqual([
        Date.UTC(1980, 2, 31),
        Date.UTC(1980, 9, 1),
      ]);
      await userEvent.keyboard("{Home}");
      runtime.flush();
      expect(domain.get()).toEqual([
        Date.UTC(1980, 0, 1),
        Date.UTC(1980, 11, 1),
      ]);
    } finally {
      app.dispose();
      expect(canvas.style.touchAction).toBe("");
      expect(runtime.pending).toBe(0);
      runtime.dispose();
      spy.mockRestore();
    }
  },
);
it("continues a recentered drag from the tapped window and cancels after an external domain update", async () => {
  const runtime = testRuntime(),
    canvas = document.createElement("canvas");
  canvas.style.cssText = "width:560px;height:300px";
  document.body.append(canvas);
  const domain = signal<readonly [number, number]>([
    Date.UTC(1980, 4, 1),
    Date.UTC(1980, 6, 1),
  ]);
  let draft: readonly [number, number] | null = null;
  const app = mount(canvas, {
    domain,
    onSnapshot: (s) => {
      draft = s.draft;
    },
  });
  try {
    runtime.flush();
    await pointerDownLogicalPoint(canvas, { x: 440, y: 220 });
    runtime.flush();
    const recentered = draft!;
    expect(recentered[0]).toBeGreaterThan(Date.UTC(1980, 6, 1));
    await pointerMoveLogicalPoint(canvas, { x: 450, y: 220 });
    runtime.flush();
    expect(draft![0]).toBeGreaterThanOrEqual(recentered[0]);
    const external = [Date.UTC(1980, 1, 1), Date.UTC(1980, 5, 1)] as const;
    domain.set(external);
    runtime.flush();
    expect(draft).toBeNull();
    await pointerUpLogicalPoint(canvas, { x: 450, y: 220 });
    runtime.flush();
    expect(domain.get()).toBe(external);
  } finally {
    app.dispose();
    expect(runtime.pending).toBe(0);
    runtime.dispose();
  }
});
it("rejects invalid externally controlled windows without leaving scheduled work", () => {
  const runtime = testRuntime(),
    canvas = document.createElement("canvas");
  canvas.width = 560;
  canvas.height = 300;
  document.body.append(canvas);
  const domain = signal<readonly [number, number]>([
    Date.UTC(1979, 0, 1),
    Date.UTC(1980, 8, 1),
  ]);
  const app = mount(canvas, { domain });
  try {
    expect(() => runtime.flush()).toThrow(/Controlled window/);
    expect(runtime.pending).toBe(0);
  } finally {
    app.dispose();
    runtime.dispose();
  }
});
it("discards a native touch draft on touch cancellation", async () => {
  const runtime = testRuntime(),
    canvas = document.createElement("canvas");
  canvas.style.cssText = "width:560px;height:300px";
  document.body.append(canvas);
  const domain = signal<readonly [number, number]>([
    Date.UTC(1980, 2, 1),
    Date.UTC(1980, 8, 1),
  ]);
  let draft: readonly [number, number] | null = null;
  const app = mount(canvas, {
    domain,
    onSnapshot: (s) => {
      draft = s.draft;
    },
  });
  try {
    runtime.flush();
    const committed = domain.get();
    await touchStartLogicalPoint(canvas, { x: 280, y: 220 });
    runtime.flush();
    expect(draft).not.toBeNull();
    await cdp().send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    runtime.flush();
    expect(draft).toBeNull();
    expect(domain.get()).toEqual(committed);
  } finally {
    app.dispose();
    expect(runtime.pending).toBe(0);
    runtime.dispose();
  }
});
it("discards a draft when native pointer capture is lost", async () => {
  const runtime = testRuntime(),
    canvas = document.createElement("canvas");
  canvas.style.cssText = "width:560px;height:300px";
  document.body.append(canvas);
  const domain = signal<readonly [number, number]>([
    Date.UTC(1980, 2, 1),
    Date.UTC(1980, 8, 1),
  ]);
  let draft: readonly [number, number] | null = null,
    losses = 0;
  canvas.addEventListener("lostpointercapture", () => losses++);
  const app = mount(canvas, {
    domain,
    onSnapshot: (s) => {
      draft = s.draft;
    },
  });
  try {
    runtime.flush();
    const committed = domain.get();
    await pointerDownLogicalPoint(canvas, { x: 280, y: 220 });
    await pointerMoveLogicalPoint(canvas, { x: 300, y: 220 });
    runtime.flush();
    expect(draft).not.toBeNull();
    expect(canvas.hasPointerCapture(1)).toBe(true);
    canvas.releasePointerCapture(1);
    await pointerMoveLogicalPoint(canvas, { x: 320, y: 220 });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    runtime.flush();
    expect(losses).toBeGreaterThan(0);
    expect(draft).toBeNull();
    expect(domain.get()).toEqual(committed);
    await pointerUpLogicalPoint(canvas, { x: 320, y: 220 });
    runtime.flush();
    expect(domain.get()).toEqual(committed);
  } finally {
    app.dispose();
    expect(runtime.pending).toBe(0);
    runtime.dispose();
  }
});
it("discards a draft when the responsive overview resizes", async () => {
  const runtime = testRuntime(),
    canvas = document.createElement("canvas");
  canvas.style.cssText = "width:560px;height:300px";
  document.body.append(canvas);
  const domain = signal<readonly [number, number]>([
    Date.UTC(1980, 2, 1),
    Date.UTC(1980, 8, 1),
  ]);
  let draft: readonly [number, number] | null = null;
  const app = mount(canvas, {
    domain,
    onSnapshot: (s) => {
      draft = s.draft;
    },
  });
  try {
    runtime.flush();
    const committed = domain.get();
    await pointerDownLogicalPoint(canvas, { x: 280, y: 220 });
    await pointerMoveLogicalPoint(canvas, { x: 320, y: 220 });
    runtime.flush();
    expect(draft).not.toBeNull();
    canvas.style.width = "480px";
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    runtime.flush();
    expect(draft).toBeNull();
    expect(domain.get()).toEqual(committed);
    await pointerUpLogicalPoint(canvas, { x: 320, y: 220 });
    runtime.flush();
    expect(domain.get()).toEqual(committed);
  } finally {
    app.dispose();
    expect(runtime.pending).toBe(0);
    runtime.dispose();
  }
});
it("releases an active capture and restores the prior touch action on disposal", async () => {
  const runtime = testRuntime(),
    canvas = document.createElement("canvas");
  canvas.style.cssText = "width:560px;height:300px;touch-action:pan-y";
  document.body.append(canvas);
  const app = mount(canvas);
  try {
    runtime.flush();
    expect(canvas.style.touchAction).toBe("none");
    await pointerDownLogicalPoint(canvas, { x: 280, y: 220 });
    runtime.flush();
    expect(canvas.hasPointerCapture(1)).toBe(true);
    app.dispose();
    expect(canvas.hasPointerCapture(1)).toBe(false);
    expect(canvas.style.touchAction).toBe("pan-y");
    expect(runtime.pending).toBe(0);
  } finally {
    app.dispose();
    runtime.dispose();
  }
});
it("anchors native wheel zoom and reverses a normalized wheel gesture", async () => {
  const runtime = testRuntime(),
    canvas = document.createElement("canvas");
  canvas.style.cssText = "width:560px;height:300px";
  document.body.append(canvas);
  const initial = [Date.UTC(1980, 2, 1), Date.UTC(1980, 8, 1)] as const,
    domain = signal<readonly [number, number]>(initial);
  const app = mount(canvas, { domain });
  try {
    runtime.flush();
    await wheelLogicalPoint(canvas, { x: 166, y: 120 }, -100);
    await new Promise((resolve) => setTimeout(resolve, 20));
    runtime.flush();
    const next = domain.get();
    expect(next[1] - next[0]).toBeLessThan(initial[1] - initial[0]);
    const anchor = initial[0] + 0.25 * (initial[1] - initial[0]);
    expect(
      Math.abs(next[0] + 0.25 * (next[1] - next[0]) - anchor),
    ).toBeLessThanOrEqual(1);
    await wheelLogicalPoint(canvas, { x: 166, y: 120 }, 100);
    await new Promise((resolve) => setTimeout(resolve, 20));
    runtime.flush();
    expect(Math.abs(domain.get()[0] - initial[0])).toBeLessThanOrEqual(1);
    expect(Math.abs(domain.get()[1] - initial[1])).toBeLessThanOrEqual(1);
  } finally {
    app.dispose();
    runtime.dispose();
  }
});
