import { afterEach, expect, it } from "vitest";
import {
  createElement,
  pibbl,
  Rectangle,
  recordFrames,
  signal,
  type PibblController,
} from "@pibbl/core";
const roots: PibblController[] = [];
afterEach(() => {
  roots.splice(0).forEach((root) => root.dispose());
  document.body.replaceChildren();
});
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
it("records public root pixels with timestamps and preserves the final still duration", async () => {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:32px;height:24px";
  document.body.append(canvas);
  const fill = signal("#ff0000");
  const root = pibbl(
    canvas,
    createElement(Rectangle, { style: { width: 32, height: 24, fill } }),
    { viewport: { width: 32, height: 24 }, pixelRatio: 1 },
  );
  roots.push(root);
  await wait(50);
  const session = recordFrames(canvas, { duration: 200, frameRate: 60 });
  await session.ready;
  await wait(50);
  fill.set("#00ff00");
  const recording = await session.finished;
  expect(recording.duration).toBe(200);
  expect(recording.frames[0].timestamp).toBe(0);
  expect(recording.frames.length).toBeGreaterThanOrEqual(2);
  expect(recording.frames.at(-1)!.timestamp).toBeLessThan(200);
  const first = await recording.readFrame(0),
    last = await recording.readFrame(recording.frames.length - 1);
  expect(Array.from(first.data.slice(0, 4))).toEqual([255, 0, 0, 255]);
  expect(Array.from(last.data.slice(0, 4))).toEqual([0, 255, 0, 255]);
  root.dispose();
  expect((await recording.readFrame(0)).data.length).toBe(32 * 24 * 4);
  recording.dispose();
});

import { exportGif } from "@pibbl/core";
// Internal counters supplement public behavior only in source mode. Built mode
// verifies native workers directly and does not mix source diagnostics with built code.
import { recordingResources } from "../src/lib/recording/recording.js";
import { GLOBAL_STATE } from "../src/lib/global-state.js";
const diagnosticsEnabled = import.meta.env.MODE !== "built";
const recordings: Awaited<ReturnType<typeof recordFrames>["finished"]>[] = [];
afterEach(async () => {
  roots.splice(0).forEach((root) => root.dispose());
  recordings.splice(0).forEach((recording) => recording.dispose());
  await wait(10);
  if (diagnosticsEnabled)
    expect(recordingResources).toEqual({
      workers: 0,
      urls: 0,
      observers: 0,
      timers: 0,
      abortListeners: 0,
      requests: 0,
      exports: 0,
    });
});
async function mount(fill = signal("#ff0000"), width = 32, height = 24) {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = `width:${width}px;height:${height}px`;
  document.body.append(canvas);
  const root = pibbl(
    canvas,
    createElement(Rectangle, { style: { width, height, fill } }),
    { viewport: { width, height }, pixelRatio: 1 },
  );
  roots.push(root);
  await wait(35);
  return { canvas, root, fill };
}
async function retained(canvas: HTMLCanvasElement, duration = 100) {
  const session = recordFrames(canvas, { duration });
  const recording = await session.finished;
  recordings.push(recording);
  return recording;
}
it("stops early, keeps the elapsed still hold, and encodes a independently decodable GIF", async () => {
  const { canvas, fill } = await mount();
  const session = recordFrames(canvas, { duration: 1000 });
  await session.ready;
  await wait(40);
  fill.set("#00ff00");
  await wait(50);
  session.stop();
  session.stop();
  const recording = await session.finished;
  recordings.push(recording);
  expect(recording.duration).toBeGreaterThan(80);
  expect(recording.duration).toBeLessThan(500);
  expect(recording.frames.length).toBeGreaterThanOrEqual(2);
  const blob = await exportGif(recording, {
    repeatCount: 0,
    background: "white",
  });
  expect(blob.type).toBe("image/gif");
  expect(new TextDecoder().decode((await blob.arrayBuffer()).slice(0, 6))).toBe(
    "GIF89a",
  );
  const Decoder = (globalThis as any).ImageDecoder;
  const decoder = new Decoder({
    data: await blob.arrayBuffer(),
    type: "image/gif",
  });
  try {
    await decoder.tracks.ready;
    expect(decoder.tracks.selectedTrack.frameCount).toBeGreaterThanOrEqual(2);
    const output = new OffscreenCanvas(32, 24),
      ctx = output.getContext("2d")!;
    let duration = 0;
    for (let i = 0; i < decoder.tracks.selectedTrack.frameCount; i++) {
      const { image } = await decoder.decode({ frameIndex: i });
      try {
        duration += image.duration / 1000;
        ctx.clearRect(0, 0, 32, 24);
        ctx.drawImage(image, 0, 0);
        const pixel = ctx.getImageData(0, 0, 1, 1).data;
        const expected = i === 0 ? [255, 0, 0, 255] : [0, 255, 0, 255];
        expected.forEach((value, j) =>
          expect(Math.abs(pixel[j] - value)).toBeLessThanOrEqual(2),
        );
      } finally {
        image.close();
      }
    }
    expect(Math.abs(duration - recording.duration)).toBeLessThanOrEqual(5);
  } finally {
    decoder.close();
  }
});
it("discards before worker initialization, while capturing, and through AbortSignal", async () => {
  const { canvas } = await mount();
  for (let i = 0; i < 8; i++) {
    const session = recordFrames(canvas, { duration: 1000 });
    session.cancel();
    session.cancel();
    await expect(session.ready).rejects.toMatchObject({ name: "AbortError" });
    await expect(session.finished).rejects.toMatchObject({
      name: "AbortError",
    });
  }
  const controller = new AbortController();
  const session = recordFrames(canvas, {
    duration: 1000,
    signal: controller.signal,
  });
  await session.ready;
  controller.abort();
  await expect(session.finished).rejects.toMatchObject({ name: "AbortError" });
  const preaborted = new AbortController();
  preaborted.abort();
  const skipped = recordFrames(canvas, {
    duration: 1000,
    signal: preaborted.signal,
  });
  await expect(skipped.ready).rejects.toMatchObject({ name: "AbortError" });
  await expect(skipped.finished).rejects.toMatchObject({ name: "AbortError" });
});
it("cancels on root disposal, without affecting an independent mounted recording", async () => {
  const a = await mount(),
    b = await mount(signal("#0000ff"));
  const first = recordFrames(a.canvas, { duration: 1000 }),
    second = recordFrames(b.canvas, { duration: 1000 });
  await Promise.all([first.ready, second.ready]);
  a.root.dispose();
  await expect(first.finished).rejects.toMatchObject({ name: "AbortError" });
  second.stop();
  const recording = await second.finished;
  recordings.push(recording);
  expect(Array.from((await recording.readFrame(0)).data.slice(0, 4))).toEqual([
    0, 0, 255, 255,
  ]);
  b.root.dispose();
  expect((await exportGif(recording)).size).toBeGreaterThan(0);
});
it("allows graceful stop during initialization and returns caller-owned frame copies", async () => {
  const { canvas } = await mount();
  const session = recordFrames(canvas, { duration: 1000 });
  session.stop();
  await session.ready;
  const recording = await session.finished;
  recordings.push(recording);
  expect(recording.frames.length).toBe(1);
  expect(recording.frames[0].timestamp).toBe(0);
  const copy = await recording.readFrame(0);
  copy.data.fill(0);
  expect((await recording.readFrame(0)).data[0]).toBe(255);
  await expect(recording.readFrame(-1)).rejects.toBeInstanceOf(RangeError);
});
it("cancels encoding, retains frames for retry, and releases progress/abort ownership", async () => {
  const { canvas } = await mount();
  const recording = await retained(canvas);
  const controller = new AbortController();
  let progress = 0;
  const exporting = exportGif(recording, {
    signal: controller.signal,
    onProgress: () => progress++,
  });
  controller.abort();
  await expect(exporting).rejects.toMatchObject({ name: "AbortError" });
  expect(progress).toBe(0);
  if (diagnosticsEnabled) expect(recordingResources.exports).toBe(0);
  if (diagnosticsEnabled) expect(recordingResources.abortListeners).toBe(0);
  expect((await exportGif(recording)).size).toBeGreaterThan(0);
  expect((await recording.readFrame(0)).data[0]).toBe(255);
});
it("disposes pending reads and GIF exports immediately and idempotently", async () => {
  const { canvas } = await mount();
  const recording = await retained(canvas);
  const exporting = exportGif(recording),
    reading = recording.readFrame(0);
  recording.dispose();
  recording.dispose();
  await expect(exporting).rejects.toMatchObject({ name: "AbortError" });
  await expect(reading).rejects.toMatchObject({ name: "AbortError" });
  await expect(recording.readFrame(0)).rejects.toMatchObject({
    name: "AbortError",
  });
  await expect(exportGif(recording)).rejects.toMatchObject({
    name: "AbortError",
  });
});
it("releases every recording resource over repeated capture/export/discard cycles", async () => {
  const { canvas } = await mount();
  const teardowns = diagnosticsEnabled
    ? ((GLOBAL_STATE.pibblInstances.get(canvas)!.mainTeardowns as any)
        ._teardowns as Set<() => void>)
    : undefined;
  const baselineLinks = teardowns?.size;
  for (let i = 0; i < 20; i++) {
    const controller = new AbortController();
    const session = recordFrames(canvas, {
      duration: 500,
      signal: controller.signal,
    });
    await session.ready;
    if (diagnosticsEnabled) expect(recordingResources.workers).toBe(1);
    if (teardowns) expect(teardowns.size).toBe(baselineLinks! + 1);
    if (i % 3 === 0) {
      session.cancel();
      await expect(session.finished).rejects.toMatchObject({
        name: "AbortError",
      });
    } else {
      session.stop();
      const recording = await session.finished;
      await exportGif(recording);
      recording.dispose();
    }
    if (diagnosticsEnabled)
      expect(recordingResources).toEqual({
        workers: 0,
        urls: 0,
        observers: 0,
        timers: 0,
        abortListeners: 0,
        requests: 0,
        exports: 0,
      });
    if (teardowns) expect(teardowns.size).toBe(baselineLinks);
  }
});
it("rejects unmapped canvases and invalid options without acquiring resources", async () => {
  const canvas = document.createElement("canvas");
  expect(() => recordFrames(canvas, { duration: 100 })).toThrow(/live Pibbl/);
  const mounted = await mount();
  expect(() => recordFrames(mounted.canvas, { duration: 0 })).toThrow(
    RangeError,
  );
  expect(() =>
    recordFrames(mounted.canvas, { duration: 100, frameRate: NaN }),
  ).toThrow(RangeError);
  expect(() =>
    recordFrames(mounted.canvas, { duration: 100, memoryHeadroom: 0.5 }),
  ).toThrow(RangeError);
});
it("fails and releases capture when a backing resize changes the recorded dimensions", async () => {
  const { canvas, fill } = await mount();
  const session = recordFrames(canvas, { duration: 1000 });
  await session.ready;
  canvas.style.width = "64px";
  fill.set("#00ff00");
  await expect(session.finished).rejects.toThrow(/size changed/);
});
it("starts immediately after mounting and uses the first committed backing dimensions", async () => {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:19px;height:13px";
  document.body.append(canvas);
  roots.push(
    pibbl(
      canvas,
      createElement(Rectangle, {
        style: { width: 19, height: 13, fill: "red" },
      }),
      { viewport: { width: 19, height: 13 }, pixelRatio: 2 },
    ),
  );
  const session = recordFrames(canvas, { duration: 50 });
  const recording = await session.finished;
  recordings.push(recording);
  expect(recording.frames[0]).toMatchObject({
    width: 38,
    height: 26,
    timestamp: 0,
  });
});
it("rejects a suspended zero-display surface without hanging initialization", async () => {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:0px;height:0px";
  document.body.append(canvas);
  roots.push(
    pibbl(
      canvas,
      createElement(Rectangle, {
        style: { width: 19, height: 13, fill: "red" },
      }),
      { viewport: { width: 19, height: 13 }, pixelRatio: 1 },
    ),
  );
  const session = recordFrames(canvas, { duration: 50 });
  await expect(session.ready).rejects.toThrow(/visible|display|surface/);
  await expect(session.finished).rejects.toThrow(/visible|display|surface/);
});

it("encodes transparent moving pieces without leaving trails, and supports opaque backgrounds", async () => {
  const left = signal(0);
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:32px;height:24px";
  document.body.append(canvas);
  roots.push(
    pibbl(
      canvas,
      createElement(Rectangle, {
        style: { width: 8, height: 8, left, fill: "red" },
      }),
      { viewport: { width: 32, height: 24 }, pixelRatio: 1 },
    ),
  );
  const session = recordFrames(canvas, { duration: 1000 });
  await session.ready;
  await wait(50);
  left.set(16);
  await wait(70);
  session.stop();
  const recording = await session.finished;
  recordings.push(recording);
  const blob = await exportGif(recording, { frameRate: 25 });
  const decoder = new (globalThis as any).ImageDecoder({
    data: await blob.arrayBuffer(),
    type: "image/gif",
  });
  await decoder.tracks.ready;
  const ctx = new OffscreenCanvas(32, 24).getContext("2d")!;
  try {
    const { image } = await decoder.decode({
      frameIndex: decoder.tracks.selectedTrack.frameCount - 1,
    });
    try {
      ctx.drawImage(image, 0, 0);
      expect(ctx.getImageData(2, 2, 1, 1).data[3]).toBe(0);
      expect(ctx.getImageData(18, 2, 1, 1).data[3]).toBe(255);
      expect(ctx.getImageData(31, 23, 1, 1).data[3]).toBe(0);
    } finally {
      image.close();
    }
  } finally {
    decoder.close();
  }
  const opaque = await exportGif(recording, { background: "#123456" });
  const bitmap = await createImageBitmap(opaque);
  try {
    ctx.clearRect(0, 0, 32, 24);
    ctx.drawImage(bitmap, 0, 0);
    const pixel = ctx.getImageData(31, 23, 1, 1).data;
    [18, 52, 86, 255].forEach((v, i) =>
      expect(Math.abs(v - pixel[i])).toBeLessThanOrEqual(2),
    );
  } finally {
    bitmap.close();
  }
});
it("rejects an unreadable bitmap and releases startup resources", async () => {
  const { canvas } = await mount();
  const context = canvas.getContext("2d")!;
  const original = context.getImageData;
  context.getImageData = () => {
    throw new DOMException("Tainted canvas", "SecurityError");
  };
  try {
    const session = recordFrames(canvas, { duration: 1000 });
    await expect(session.ready).rejects.toMatchObject({
      name: "SecurityError",
    });
    await expect(session.finished).rejects.toMatchObject({
      name: "SecurityError",
    });
  } finally {
    context.getImageData = original;
  }
});
it("rejects unsupported worker creation and releases its blob URL and observer", async () => {
  const { canvas } = await mount();
  const NativeWorker = globalThis.Worker;
  globalThis.Worker = class {
    constructor() {
      throw new Error("Worker blocked by CSP");
    }
  } as any;
  try {
    const session = recordFrames(canvas, { duration: 1000 });
    await expect(session.ready).rejects.toThrow(/CSP/);
    await expect(session.finished).rejects.toThrow(/CSP/);
  } finally {
    globalThis.Worker = NativeWorker;
  }
});
it("does not create recording workers or read pixels for ordinary unrecorded renders", async () => {
  const { canvas, fill } = await mount();
  let reads = 0;
  const context = canvas.getContext("2d")!,
    original = context.getImageData;
  context.getImageData = function (...args: any[]) {
    reads++;
    return (original as any).apply(this, args);
  };
  try {
    fill.set("blue");
    await wait(40);
    expect(reads).toBe(0);
    if (diagnosticsEnabled) expect(recordingResources.workers).toBe(0);
  } finally {
    context.getImageData = original;
  }
});
it("retains one bitmap across a long static span and keeps its whole GIF delay", async () => {
  const { canvas } = await mount();
  const recording = await retained(canvas, 220);
  expect(recording.frames.length).toBe(1);
  const gif = await exportGif(recording);
  const decoder = new (globalThis as any).ImageDecoder({
    data: await gif.arrayBuffer(),
    type: "image/gif",
  });
  try {
    await decoder.tracks.ready;
    expect(decoder.tracks.selectedTrack.frameCount).toBe(1);
    const { image } = await decoder.decode({ frameIndex: 0 });
    try {
      expect(image.duration / 1000).toBe(220);
    } finally {
      image.close();
    }
  } finally {
    decoder.close();
  }
});

import { Layer } from "@pibbl/core";
import { LinearScale, LineSeries, defineSeries } from "@pibbl/core/viz";
import {
  nearestRecordedX,
  useNumericInspection,
  type NumericInspectionRef,
} from "@pibbl/core/viz/inspection";
it("joins public inspection state and raw pixels by committed render generation", async () => {
  type Row = { id: string; x: number; y: number };
  const rows = signal<Row[]>([
    { id: "start", x: 0, y: 10 },
    { id: "middle", x: 5, y: 20 },
    { id: "end", x: 10, y: 30 },
  ]);
  const series = defineSeries({ data: rows, x: "x", y: "y" });
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:32px;height:24px";
  document.body.append(canvas);
  let inspection!: NumericInspectionRef<Row>;
  function Chart() {
    inspection = useNumericInspection(series);
    return createElement(LinearScale, {
      id: "x",
      domain: [0, 10] as const,
      range: [0, 32] as const,
      children: createElement(LinearScale, {
        id: "y",
        domain: [0, 40] as const,
        range: [24, 0] as const,
        children: createElement(LineSeries, {
          ...series,
          xScale: "x",
          yScale: "y",
          inspection,
          style: { stroke: "blue", strokeWidth: 2 },
        }),
      }),
    });
  }
  const root = pibbl(canvas, createElement(Chart, {}), {
    viewport: { width: 32, height: 24 },
    pixelRatio: 1,
  });
  roots.push(root);
  await wait(35);

  const observed = new Map<number, { domainY: number; id: string }>();
  const completionEvents: Array<{ status: string; generation: number }> = [];
  const capturedFrames: number[] = [];
  const options = {
    duration: 1000,
    frameRate: 60,
    onRenderComplete(completion: { status: string; generation: number }) {
      completionEvents.push(completion);
      if (completion.status !== "committed") return;
      const rendered = inspection!.rendered();
      const hit = rendered && nearestRecordedX(rendered, { domainX: 5 });
      if (hit)
        observed.set(completion.generation, {
          domainY: hit.domainY,
          id: hit.datum.id,
        });
    },
    onFrameCaptured(frame: { renderGeneration: number }) {
      capturedFrames.push(frame.renderGeneration);
    },
  };
  const session = recordFrames(canvas, options);
  await session.ready;
  rows.set([
    { id: "start", x: 0, y: 10 },
    { id: "middle", x: 5, y: 30 },
    { id: "end", x: 10, y: 30 },
  ]);
  await wait(40);
  session.stop();
  const recording = await session.finished;
  recordings.push(recording);

  expect(completionEvents.some((event) => event.status === "committed")).toBe(true);
  expect(completionEvents.some((event) => event.status === "failed")).toBe(false);
  expect(recording.frames.length).toBeGreaterThanOrEqual(2);
  expect(capturedFrames).toEqual(
    recording.frames.map((frame) => frame.renderGeneration),
  );
  for (const frame of recording.frames) {
    expect(frame.renderGeneration).toBeGreaterThan(0);
    expect(observed.has(frame.renderGeneration)).toBe(true);
  }
  const readFrames = await Promise.all(
    recording.frames.map((_, index) => recording.readFrame(index)),
  );
  const repaired = readFrames.find(
    (frame) => observed.get(frame.renderGeneration)?.domainY === 30,
  );
  expect(repaired).toBeDefined();
  expect(observed.get(repaired!.renderGeneration)).toEqual({
    domainY: 30,
    id: "middle",
  });
  const bluePixelsNear = (frame: Uint8ClampedArray, x: number, y: number) => {
    let count = 0;
    for (let py = y - 2; py <= y + 2; py++) {
      for (let px = x - 2; px <= x + 2; px++) {
        const offset = (py * 32 + px) * 4;
        if (frame[offset + 2] > frame[offset] + 40) count++;
      }
    }
    return count;
  };
  expect(bluePixelsNear(repaired!.data, 16, 6)).toBeGreaterThan(0);
  expect(bluePixelsNear(repaired!.data, 16, 12)).toBe(0);
});
it("reports failed attempts separately and rejects without retaining partial paint", async () => {
  const failed = signal(false);
  function ControlledFailure() {
    if (failed.get()) throw new Error("controlled render failure after paint");
    return null;
  }
  function App() {
    return [
      createElement(Rectangle, {
        style: { width: 32, height: 24, fill: "blue" },
      }),
      createElement(ControlledFailure, {}),
    ];
  }
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:32px;height:24px";
  document.body.append(canvas);
  const root = pibbl(
    canvas,
    createElement(App, {}),
    { viewport: { width: 32, height: 24 }, pixelRatio: 1 },
  );
  roots.push(root);
  await wait(35);
  const completions: Array<{ status: string; generation: number }> = [];
  const session = recordFrames(canvas, {
    duration: 1000,
    onRenderComplete: (completion: { status: string; generation: number }) =>
      completions.push(completion),
  });
  await session.ready;
  const lastCommitted = completions.findLast(
    (completion) => completion.status === "committed",
  );
  expect(lastCommitted).toBeDefined();
  const handleRenderError = (event: ErrorEvent) => {
    if (event.message.includes("controlled render failure after paint")) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  window.addEventListener("error", handleRenderError);
  failed.set(true);
  try {
    await expect(session.finished).rejects.toThrow(/render failed/);
  } finally {
    window.removeEventListener("error", handleRenderError);
  }
  const failure = completions.findLast(
    (completion) => completion.status === "failed",
  );
  expect(failure).toBeDefined();
  expect(failure!.generation).toBeGreaterThan(lastCommitted!.generation);
  expect(completions.some((completion) =>
    completion.status === "committed" &&
    completion.generation === failure!.generation,
  )).toBe(false);
});

it("records the fully composed root including a cached nested Layer", async () => {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:32px;height:24px";
  document.body.append(canvas);
  const fill = signal("green");
  roots.push(
    pibbl(
      canvas,
      [
        createElement(Rectangle, {
          style: { width: 32, height: 24, fill: "red" },
        }),
        createElement(Layer, {
          style: { left: 16, width: 8, height: 8 },
          children: createElement(Rectangle, {
            style: { width: 8, height: 8, fill },
          }),
        }),
      ],
      { viewport: { width: 32, height: 24 }, pixelRatio: 1 },
    ),
  );
  const session = recordFrames(canvas, { duration: 1000 });
  await session.ready;
  await wait(40);
  fill.set("blue");
  await wait(50);
  session.stop();
  const recording = await session.finished;
  recordings.push(recording);
  const first = await recording.readFrame(0),
    last = await recording.readFrame(recording.frames.length - 1);
  expect(
    Array.from(first.data.slice((2 * 32 + 18) * 4, (2 * 32 + 18) * 4 + 4)),
  ).toEqual([0, 128, 0, 255]);
  expect(
    Array.from(last.data.slice((2 * 32 + 18) * 4, (2 * 32 + 18) * 4 + 4)),
  ).toEqual([0, 0, 255, 255]);
  expect(Array.from(last.data.slice(0, 4))).toEqual([255, 0, 0, 255]);
});
it("actually calls Worker.terminate exactly once per discarded or disposed owner", async () => {
  const { canvas } = await mount();
  const NativeWorker = globalThis.Worker;
  let acquired = 0,
    released = 0;
  globalThis.Worker = class extends NativeWorker {
    private closed = false;
    constructor(url: URL | string, options?: WorkerOptions) {
      super(url, options);
      acquired++;
    }
    terminate() {
      expect(this.closed).toBe(false);
      this.closed = true;
      released++;
      super.terminate();
    }
  };
  try {
    for (let i = 0; i < 6; i++) {
      const session = recordFrames(canvas, { duration: 500 });
      await session.ready;
      if (i % 2 === 0) {
        session.cancel();
        session.cancel();
        await expect(session.finished).rejects.toMatchObject({
          name: "AbortError",
        });
      } else {
        session.stop();
        const recording = await session.finished;
        await exportGif(recording);
        recording.dispose();
        recording.dispose();
      }
    }
    expect(acquired).toBe(6);
    expect(released).toBe(acquired);
  } finally {
    globalThis.Worker = NativeWorker;
  }
});
it("rejects excessive memory estimates without creating a worker", async () => {
  const { canvas } = await mount();
  const session = recordFrames(canvas, {
    duration: 1_000_000,
    frameRate: 1_000_000,
  });
  await expect(session.ready).rejects.toThrow(/addressable/);
  await expect(session.finished).rejects.toThrow(/addressable/);
});
it("fails visibly and releases storage when the worker transfer queue cannot keep up", async () => {
  const { canvas, fill } = await mount();
  const NativeWorker = globalThis.Worker;
  globalThis.Worker = class extends NativeWorker {
    private receiver: ((this: Worker, event: MessageEvent) => any) | null =
      null;
    override get onmessage() {
      return this.receiver;
    }
    override set onmessage(
      callback: ((this: Worker, event: MessageEvent) => any) | null,
    ) {
      this.receiver = callback;
      super.onmessage = callback
        ? (event) => {
            if (event.data.type !== "ack") callback.call(this, event);
          }
        : null;
    }
  };
  try {
    const session = recordFrames(canvas, { duration: 1000 });
    await session.ready;
    void session.finished.then(
      (recording) => recording.dispose(),
      () => {},
    );
    for (const color of ["green", "blue", "white"]) {
      await wait(40);
      fill.set(color);
    }
    await expect(session.finished).rejects.toThrow(/queue overflow/);
  } finally {
    globalThis.Worker = NativeWorker;
  }
});
it("coalesces a rate-limited render and still captures its final static bitmap", async () => {
  const { canvas, fill } = await mount();
  const session = recordFrames(canvas, { duration: 350, frameRate: 10 });
  await session.ready;
  fill.set("blue");
  await wait(230);
  const recording = await session.finished;
  recordings.push(recording);
  expect(
    (await recording.readFrame(recording.frames.length - 1)).data.slice(0, 4),
  ).toEqual(new Uint8ClampedArray([0, 0, 255, 255]));
});
it("validates GIF policies without starting an export or destroying the recording", async () => {
  const { canvas } = await mount();
  const recording = await retained(canvas, 50);
  await expect(exportGif(recording, { repeatCount: -1 })).rejects.toThrow(
    /repeatCount/,
  );
  await expect(exportGif(recording, { frameRate: 101 })).rejects.toThrow(
    /frameRate/,
  );
  await expect(
    exportGif(recording, { background: "not-a-color" }),
  ).rejects.toThrow(/color/);
  await expect(
    exportGif(recording, { background: "rgba(0,0,0,.5)" }),
  ).rejects.toThrow(/opaque/);
  expect((await exportGif(recording)).size).toBeGreaterThan(0);
});
it("acknowledges mid-encoding abort after scratch cleanup and allows another export", async () => {
  const { canvas, fill } = await mount();
  const session = recordFrames(canvas, { duration: 1000 });
  await session.ready;
  await wait(50);
  fill.set("blue");
  await wait(70);
  session.stop();
  const recording = await session.finished;
  recordings.push(recording);
  const controller = new AbortController();
  let notifications = 0;
  const first = exportGif(recording, {
    width: 48,
    maxColors: 8,
    palette: ["red", "blue"],
    dithering: true,
    signal: controller.signal,
    onProgress: (value) => {
      notifications++;
      if (value > 0) controller.abort();
    },
  });
  await expect(exportGif(recording)).rejects.toThrow(/already running/);
  await expect(first).rejects.toMatchObject({ name: "AbortError" });
  expect(notifications).toBe(1);
  if (diagnosticsEnabled) expect(recordingResources.exports).toBe(0);
  if (diagnosticsEnabled) expect(recordingResources.requests).toBe(0);
  expect((await exportGif(recording)).size).toBeGreaterThan(0);
});
it("cleans up an export whose progress callback throws, retaining the original pixels", async () => {
  const { canvas } = await mount();
  const recording = await retained(canvas, 50);
  await expect(
    exportGif(recording, {
      onProgress() {
        throw new Error("progress failure");
      },
    }),
  ).rejects.toThrow(/progress failure/);
  if (diagnosticsEnabled) expect(recordingResources.exports).toBe(0);
  if (diagnosticsEnabled) expect(recordingResources.requests).toBe(0);
  expect((await recording.readFrame(0)).data[0]).toBe(255);
  expect((await exportGif(recording)).size).toBeGreaterThan(0);
});

it("exports resized GIFs with an exact supplied palette without changing retained pixels", async () => {
  const { canvas } = await mount();
  const recording = await retained(canvas);
  const before = await recording.readFrame(0);
  const gif = await exportGif(recording, {
    width: 16,
    palette: ["#ff0000", "#0000ff"],
    maxColors: 2,
    background: "white",
  });
  const decoder = new (globalThis as any).ImageDecoder({
    data: await gif.arrayBuffer(),
    type: "image/gif",
  });
  try {
    const { image } = await decoder.decode({ frameIndex: 0 });
    try {
      expect(image.displayWidth).toBe(16);
      expect(image.displayHeight).toBe(12);
      const pixels = new Uint8Array(image.allocationSize({ format: "RGBA" }));
      await image.copyTo(pixels, { format: "RGBA" });
      expect(Array.from(pixels.slice(0, 4))).toEqual([255, 0, 0, 255]);
    } finally {
      image.close();
    }
  } finally {
    decoder.close();
  }
  expect((await recording.readFrame(0)).data).toEqual(before.data);
});

async function decodedPixels(blob: Blob) {
  const decoder = new (globalThis as any).ImageDecoder({
    data: await blob.arrayBuffer(),
    type: "image/gif",
  });
  try {
    const { image } = await decoder.decode({ frameIndex: 0 });
    try {
      const data = new Uint8Array(image.allocationSize({ format: "RGBA" }));
      await image.copyTo(data, { format: "RGBA" });
      return { data, width: image.displayWidth, height: image.displayHeight };
    } finally {
      image.close();
    }
  } finally {
    decoder.close();
  }
}

it("dithers using the supplied palette and permits sequential exports with different dimensions", async () => {
  const { canvas } = await mount(signal("#808080"));
  const recording = await retained(canvas);
  const options = {
    palette: ["black", "white"],
    maxColors: 2,
    background: "white",
  };
  const plain = await decodedPixels(await exportGif(recording, options));
  const dithered = await decodedPixels(
    await exportGif(recording, { ...options, dithering: true, height: 12 }),
  );
  expect(dithered.width).toBe(16);
  expect(dithered.height).toBe(12);
  const plainColors = new Set(
    Array.from(plain.data).filter((_, i) => i % 4 === 0),
  );
  const colors = new Set(
    Array.from(dithered.data).filter((_, i) => i % 4 === 0),
  );
  expect(plainColors.size).toBe(1);
  expect(colors).toEqual(new Set([0, 255]));
  const average =
    Array.from(dithered.data)
      .filter((_, i) => i % 4 === 0)
      .reduce((a, b) => a + b, 0) /
    (16 * 12);
  expect(Math.abs(average - 128)).toBeLessThan(8);
  expect(Array.from((await recording.readFrame(0)).data.slice(0, 4))).toEqual([
    128, 128, 128, 255,
  ]);
});

it("bounds automatic palettes and exercises both sampling effort controls including transparency", async () => {
  const { canvas } = await mount();
  const recording = await retained(canvas);
  for (const maxColors of [2, 32, 64, 128, 256]) {
    const gif = await exportGif(recording, {
      maxColors,
      paletteSampleCount: 1,
      quantizationSampleFactor: 1,
      width: 17,
      height: 9,
      dithering: true,
    });
    const bytes = new Uint8Array(await gif.arrayBuffer());
    expect(2 ** ((bytes[10] & 7) + 1)).toBeLessThanOrEqual(maxColors);
    const decoded = await decodedPixels(gif);
    expect([decoded.width, decoded.height]).toEqual([17, 9]);
    expect(decoded.data[3]).toBe(255);
  }
  await decodedPixels(
    await exportGif(recording, {
      quantizationSampleFactor: 30,
      paletteSampleCount: 64,
      background: "white",
    }),
  );
});

it("rejects invalid quality controls without consuming the retained recording", async () => {
  const { canvas } = await mount();
  const recording = await retained(canvas);
  for (const options of [
    { width: 0 },
    { height: 1.5 },
    { width: 65536 },
    { height: Infinity },
    { width: 65535, height: 65535 },
    { maxColors: 1 },
    { maxColors: 257 },
    { maxColors: 2.5 },
    { quantizationSampleFactor: 0 },
    { quantizationSampleFactor: 31 },
    { paletteSampleCount: 0 },
    { paletteSampleCount: 16777217 },
    { palette: [] },
    { palette: ["invalid"] },
    { palette: ["transparent"] },
    { maxColors: 2, palette: ["red", "blue"] },
    { dithering: "yes" },
  ]) {
    await expect(exportGif(recording, options as any)).rejects.toThrow();
  }
  expect((await recording.readFrame(0)).data.length).toBe(32 * 24 * 4);
  await exportGif(recording, { palette: ["red"], dithering: true });
});

it("resizes transparent edges with premultiplied alpha and reserves transparency for exact palettes", async () => {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:4px;height:1px";
  document.body.append(canvas);
  roots.push(
    pibbl(
      canvas,
      createElement(Rectangle, { style: { width: 2, height: 1, fill: "red" } }),
      { viewport: { width: 4, height: 1 }, pixelRatio: 1 },
    ),
  );
  await wait(35);
  const recording = await retained(canvas);
  const transparent = await decodedPixels(
    await exportGif(recording, {
      width: 3,
      height: 1,
      palette: ["red"],
      maxColors: 2,
    }),
  );
  expect(Array.from(transparent.data)).toEqual([
    255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 0, 0,
  ]);
  const opaque = await decodedPixels(
    await exportGif(recording, {
      width: 3,
      height: 1,
      palette: ["red", "#ff7f7f", "white"],
      maxColors: 3,
      background: "white",
    }),
  );
  expect(Array.from(opaque.data)).toEqual([
    255, 0, 0, 255, 255, 127, 127, 255, 255, 255, 255, 255,
  ]);
});
