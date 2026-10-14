import { GLOBAL_STATE } from "../global-state.js";
import { update } from "../update.js";
import type { Canvas, PibblInstance } from "../types.js";
import { workerSource } from "./worker-source.js";
import { bytes } from "./wasm-bytes.js";
import type {
  PibblFrameRecording,
  PibblFrameRecordingOptions,
  PibblFrameRecordingSession,
  PibblRecordedFrameInfo,
  PibblGifExportOptions,
  PibblRenderCompletion,
} from "./types.js";

/** Private deterministic ownership evidence; not a public diagnostics API. */
export const recordingResources = {
  workers: 0,
  urls: 0,
  observers: 0,
  timers: 0,
  abortListeners: 0,
  requests: 0,
  exports: 0,
};
const owners = /* @__PURE__ */ new WeakMap<
  PibblFrameRecording,
  RecordingClient
>();
function aborted(message = "Recording cancelled."): DOMException {
  return new DOMException(message, "AbortError");
}
function positive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError(`${name} must be finite and greater than zero.`);
}
function listen(
  signal: AbortSignal | undefined,
  callback: () => void,
): () => void {
  if (!signal) return () => {};
  let attached = true;
  signal.addEventListener("abort", callback, { once: true });
  recordingResources.abortListeners++;
  return () => {
    if (!attached) return;
    attached = false;
    signal.removeEventListener("abort", callback);
    recordingResources.abortListeners--;
  };
}
interface Request {
  gif: boolean;
  resolve: (bytes: ArrayBuffer) => void;
  reject: (error: unknown) => void;
  cleanup: () => void;
  progress?: (value: number) => void;
  result?: ArrayBuffer;
  error?: unknown;
}
class RecordingClient {
  worker?: Worker;
  closed = false;
  private url?: string;
  private nextId = 0;
  private pending = new Map<number, Request>();
  private exporting = false;
  onmessage: (data: any) => void = () => {};
  onerror: (error: unknown) => void = () => {};

  async initialize(frameBytes: number, estimatedBytes: number): Promise<void> {
    await Promise.resolve();
    if (this.closed) return;
    const source = workerSource;
    this.url = URL.createObjectURL(
      new Blob([source], { type: "text/javascript" }),
    );
    recordingResources.urls++;
    try {
      this.worker = new Worker(this.url, { name: "Pibbl frame recording" });
      recordingResources.workers++;
      this.worker.onmessage = ({ data }) => {
        if (this.closed) return;
        if (data.type === "ready") this.revoke();
        if (data.type === "fatal") {
          this.onerror(new Error(data.message));
          return;
        }
        const request = this.pending.get(data.id);
        if (request) {
          if (data.type === "progress" && !request.error) {
            try {
              request.progress?.(data.progress);
            } catch (error) {
              this.cancelExport(data.id, error);
            }
          } else if (data.type === "result") {
            if (request.gif) request.result = data.buffer;
            else this.settle(data.id, data.buffer);
          } else if (data.type === "error") {
            this.settle(data.id, undefined, new Error(data.message));
          } else if (data.type === "exportReleased") {
            this.settle(data.id, request.result, request.error);
          }
        }
        this.onmessage(data);
      };
      this.worker.onerror = (event) =>
        this.onerror(new Error(event.message || "Recording worker failed."));
      this.worker.onmessageerror = () =>
        this.onerror(
          new Error("Recording worker message could not be decoded."),
        );
      const buffer = Uint8Array.from(atob(bytes), (char) =>
        char.charCodeAt(0),
      ).buffer;
      this.send({ type: "start", bytes: buffer, frameBytes, estimatedBytes }, [
        buffer,
      ]);
    } catch (error) {
      this.revoke();
      throw error;
    }
  }
  send(data: unknown, transfer: Transferable[] = []): void {
    if (this.closed || !this.worker)
      throw aborted("Recording has been disposed.");
    this.worker.postMessage(data, transfer);
  }
  request(data: any, options?: PibblGifExportOptions): Promise<ArrayBuffer> {
    if (this.closed)
      return Promise.reject(aborted("Recording has been disposed."));
    if (options?.signal?.aborted)
      return Promise.reject(aborted("GIF export cancelled."));
    const gif = data.type === "gif";
    if (gif && this.exporting)
      return Promise.reject(
        new Error("A GIF export is already running for this recording."),
      );
    const id = ++this.nextId;
    if (gif) {
      this.exporting = true;
      recordingResources.exports++;
    }
    return new Promise((resolve, reject) => {
      const request: Request = {
        gif,
        resolve,
        reject,
        cleanup: () => {},
        progress: options?.onProgress,
      };
      this.pending.set(id, request);
      recordingResources.requests++;
      request.cleanup = listen(options?.signal, () =>
        this.cancelExport(id, aborted("GIF export cancelled.")),
      );
      try {
        this.send({ ...data, id });
      } catch (error) {
        this.settle(id, undefined, error);
      }
    });
  }
  private cancelExport(id: number, error: unknown): void {
    const request = this.pending.get(id);
    if (!request || request.error) return;
    request.error = error;
    request.cleanup();
    try {
      this.send({ type: "cancelExport", id });
    } catch {
      this.settle(id, undefined, error);
    }
  }
  private settle(id: number, result?: ArrayBuffer, error?: unknown): void {
    const request = this.pending.get(id);
    if (!request) return;
    this.pending.delete(id);
    request.cleanup();
    recordingResources.requests--;
    if (request.gif) {
      this.exporting = false;
      recordingResources.exports--;
    }
    if (error !== undefined) request.reject(error);
    else if (result) request.resolve(result);
    else request.reject(new Error("Recording worker returned no result."));
  }
  private revoke(): void {
    if (!this.url) return;
    URL.revokeObjectURL(this.url);
    this.url = undefined;
    recordingResources.urls--;
  }
  dispose(error: unknown = aborted("Recording has been disposed.")): void {
    if (this.closed) return;
    this.closed = true;
    if (this.worker) {
      this.worker.onmessage =
        this.worker.onerror =
        this.worker.onmessageerror =
          null;
      this.worker.terminate();
      this.worker = undefined;
      recordingResources.workers--;
    }
    this.revoke();
    for (const id of this.pending.keys()) this.settle(id, undefined, error);
    this.onmessage = this.onerror = () => {};
  }
}

// Completed recording methods capture only their worker and metadata, never
// the capture session's mount, signal, controls, or lifecycle callbacks.
function retainRecording(
  client: RecordingClient,
  frames: readonly PibblRecordedFrameInfo[],
  duration: number,
): PibblFrameRecording {
  const result: PibblFrameRecording = Object.freeze({
    duration,
    frames,
    async readFrame(index: number) {
      if (!Number.isInteger(index) || index < 0 || index >= frames.length)
        throw new RangeError("Frame index is out of range.");
      const buffer = await client.request({ type: "read", index });
      return { ...frames[index], data: new Uint8ClampedArray(buffer) };
    },
    dispose() {
      client.dispose();
    },
  });
  owners.set(result, client);
  client.onmessage = () => {};
  client.onerror = (error) => client.dispose(error);
  return result;
}

/**
 * Record committed bitmap frames from any live Pibbl root canvas.
 *
 * Capture uses the existing render lifecycle; it never starts a render loop.
 * Stop retains frames; cancel discards them. Dispose the completed recording
 * after reading or exporting it. Resizing, failed renders, unreadable pixels,
 * allocation failure, and capture queue overflow reject and release the session.
 *
 * @param canvas The canvas belonging to a live Pibbl root mount.
 * @param options Capture duration, maximum frame rate, allocation headroom, and cancellation.
 * @returns Stable controls and promises for one recording session.
 * @see {@link PibblFrameRecordingOptions}
 * @see {@link PibblFrameRecordingSession}
 */
export function recordFrames(
  canvas: Canvas,
  options: PibblFrameRecordingOptions,
): PibblFrameRecordingSession {
  positive(options.duration, "duration");
  const frameRate = options.frameRate ?? 60;
  const headroom = options.memoryHeadroom ?? 1.15;
  positive(frameRate, "frameRate");
  positive(headroom, "memoryHeadroom");
  if (headroom < 1)
    throw new RangeError("memoryHeadroom must be at least one.");
  if (options.duration > 2_147_483_647)
    throw new RangeError("duration exceeds the supported timer range.");
  let instance: PibblInstance | undefined =
    GLOBAL_STATE.pibblInstances.get(canvas);
  if (!instance || instance.parent || instance.mainTeardowns.closed)
    throw new Error("recordFrames requires a live Pibbl root canvas.");
  let target: Canvas | undefined = canvas;
  const client = new RecordingClient();
  const metadata: PibblRecordedFrameInfo[] = [];
  let phase: "starting" | "capturing" | "finishing" | "finished" | "cancelled" =
    "starting";
  let initializing = false;
  let workerReady = false,
    stopRequested = false;
  let started = 0,
    last = -Infinity,
    duration = 0,
    pendingFrames = 0;
  let width = 0,
    height = 0;
  let pendingRenderGeneration = 0;
  let lastNotifiedGeneration = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sampleTimer: ReturnType<typeof setTimeout> | undefined;
  let removeAbort = () => {};
  let resolveReady!: () => void, rejectReady!: (error: unknown) => void;
  let resolveFinished!: (recording: PibblFrameRecording) => void,
    rejectFinished!: (error: unknown) => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const finished = new Promise<PibblFrameRecording>((resolve, reject) => {
    resolveFinished = resolve;
    rejectFinished = reject;
  });
  // Cancellation is legitimate even when applications only await one of these promises.
  void ready.catch(() => {});
  void finished.catch(() => {});
  function clearSampleTimer(): void {
    if (sampleTimer === undefined) return;
    clearTimeout(sampleTimer);
    sampleTimer = undefined;
    recordingResources.timers--;
  }
  function detach(): void {
    clearSampleTimer();
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
      recordingResources.timers--;
    }
    removeAbort();
    removeAbort = () => {};
    if (instance) {
      instance.mainTeardowns.remove(rootDisposed);
      if (instance.rootFrameObservers?.delete(observe))
        recordingResources.observers--;
      if (!instance.rootFrameObservers?.size)
        instance.rootFrameObservers = undefined;
    }
    instance = undefined;
    target = undefined;
  }
  function fail(error: unknown): void {
    if (phase === "finished" || phase === "cancelled") return;
    phase = "cancelled";
    detach();
    client.dispose(error);
    metadata.length = 0;
    rejectReady(error);
    rejectFinished(error);
  }
  function rootDisposed(): void {
    fail(aborted("Pibbl mount disposed during recording."));
  }
  function stop(): void {
    if (phase === "starting") {
      stopRequested = true;
      return;
    }
    if (phase !== "capturing") return;
    duration = Math.min(options.duration, performance.now() - started);
    phase = "finishing";
    detach();
    try {
      client.send({ type: "finish" });
    } catch (error) {
      fail(error);
    }
  }
  function capture(renderGeneration: number): void {
    if (!target) return;
    if (!Number.isSafeInteger(renderGeneration) || renderGeneration <= 0)
      throw new Error("Recording requires a committed render generation.");
    if (target.width !== width || target.height !== height)
      throw new Error("Canvas backing size changed during recording.");
    const now = performance.now();
    const initial = phase === "starting";
    const timestamp = initial ? 0 : now - started;
    if (!initial && timestamp >= options.duration) {
      stop();
      return;
    }
    if (!initial && timestamp - last < 1000 / frameRate) {
      // One pending successful render may be sampled later; no rendering is scheduled.
      // This preserves its final static bitmap when no further renders occur.
      if (sampleTimer === undefined) {
        sampleTimer = setTimeout(
          () => {
            sampleTimer = undefined;
            recordingResources.timers--;
            if (phase !== "capturing") return;
            try {
            capture(pendingRenderGeneration);
            } catch (error) {
              fail(error);
            }
          },
          Math.ceil(1000 / frameRate - (timestamp - last)),
        );
        recordingResources.timers++;
      }
      return;
    }
    clearSampleTimer();
    if (pendingFrames >= 3)
      throw new Error(
        "Recording capture queue overflow; no frames were silently dropped.",
      );
    const context = target.getContext("2d") as
      CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!context)
      throw new Error("Recording requires a readable Canvas 2D surface.");
    const pixels = context.getImageData(0, 0, width, height);
    client.send({ type: "frame", timestamp, buffer: pixels.data.buffer }, [
      pixels.data.buffer,
    ]);
    pendingFrames++;
    const info = Object.freeze({ timestamp, width, height, renderGeneration });
    metadata.push(info);
    options.onFrameCaptured?.(info);
    last = timestamp;
    if (initial) {
      started = now;
      phase = "capturing";
      timer = setTimeout(stop, options.duration);
      recordingResources.timers++;
      resolveReady();
      if (stopRequested) stop();
    }
  }
  function observe(success: boolean, renderGeneration: number): void {
    if (phase === "finished" || phase === "cancelled") return;
    if (renderGeneration > lastNotifiedGeneration) {
      lastNotifiedGeneration = renderGeneration;
      const completion: PibblRenderCompletion = success
        ? { status: "committed", generation: renderGeneration }
        : { status: "failed", generation: renderGeneration };
      try {
        options.onRenderComplete?.(Object.freeze(completion));
      } catch (error) {
        fail(error);
        return;
      }
    }
    if (!success) {
      fail(new Error("Pibbl render failed during recording."));
      return;
    }
    if (phase !== "starting" && phase !== "capturing") return;
    pendingRenderGeneration = renderGeneration;
    if (!workerReady) {
      initialize();
      return;
    }
    try {
      capture(renderGeneration);
    } catch (error) {
      fail(error);
    }
  }
  client.onerror = (error) => {
    fail(error);
    client.dispose(error);
  };
  client.onmessage = (data) => {
    if (data.type === "ready") {
      workerReady = true;
      if (!instance || phase !== "starting") return;
      if (
        instance.committedRenderGeneration &&
        instance.committedRenderGeneration === instance.renderGeneration
      )
        observe(true, instance.committedRenderGeneration);
      else update(instance.canvas);
    } else if (data.type === "ack") pendingFrames--;
    else if (data.type === "finished" && phase === "finishing") {
      phase = "finished";
      const frames = Object.freeze(metadata.splice(0));
      const result = retainRecording(client, frames, duration);
      resolveFinished(result);
    }
  };
  const session = Object.freeze({
    ready,
    finished,
    stop,
    cancel: () => fail(aborted()),
  });
  if (options.signal?.aborted) {
    fail(aborted());
    return session;
  }
  instance.rootFrameObservers ??= new Set();
  instance.rootFrameObservers.add(observe);
  recordingResources.observers++;
  instance.mainTeardowns.add(rootDisposed);
  removeAbort = listen(options.signal, () => fail(aborted()));
  if (
    instance.surface.kind === "root" &&
    (instance.surface.display.width <= 0 ||
      instance.surface.display.height <= 0)
  ) {
    fail(new Error("Recording requires a nonzero display surface."));
  } else if (
    instance.committedRenderGeneration &&
    instance.committedRenderGeneration === instance.renderGeneration
  )
    initialize();
  else update(instance.canvas);
  function initialize(): void {
    if (initializing || phase !== "starting" || !target) return;
    initializing = true;
    width = target!.width;
    height = target!.height;
    const frameBytes = width * height * 4;
    const estimatedBytes = Math.ceil(
      frameBytes *
        Math.max(1, Math.ceil((options.duration * frameRate) / 1000)) *
        headroom,
    );
    if (
      !frameBytes ||
      !Number.isSafeInteger(estimatedBytes) ||
      estimatedBytes > 0xff000000
    ) {
      fail(
        new RangeError(
          "Estimated recording exceeds WASM32 addressable storage.",
        ),
      );
    } else void client.initialize(frameBytes, estimatedBytes).catch(fail);
  }
  return session;
}

/**
 * Encode a retained recording to an image/gif Blob in its worker's WASM encoder.
 *
 * Pixels remain worker-owned. Cancellation stops encoding and preserves the
 * recording; disposing the recording cancels all pending reads and exports.
 * GIF timing is rounded cumulatively to 10ms units. Without an opaque background,
 * alpha below 128 is transparent and other pixels are opaque. Only one export
 * per recording may run at a time. Requires workers, WebAssembly, and blob-worker CSP permission.
 *
 * @param recording Retained frames returned by recordFrames.
 * @param options Output dimensions, palette, dithering, sampling, looping, background, progress, and cancellation.
 * @returns Encoded GIF bytes as a caller-owned Blob.
 * @see {@link PibblGifExportOptions}
 * @see {@link PibblFrameRecording}
 */
export async function exportGif(
  recording: PibblFrameRecording,
  options: PibblGifExportOptions = {},
): Promise<Blob> {
  const client = owners.get(recording);
  if (!client)
    throw new TypeError(
      "exportGif requires a recording returned by recordFrames.",
    );
  const frameRate = options.frameRate ?? 25;
  positive(frameRate, "frameRate");
  if (frameRate > 100)
    throw new RangeError("GIF frameRate must not exceed 100.");
  const repeat = options.repeatCount ?? -1;
  if (
    options.repeatCount !== undefined &&
    (!Number.isInteger(repeat) || repeat < 0 || repeat > 65535)
  )
    throw new RangeError("repeatCount must be an integer from zero to 65535.");
  const source = recording.frames[0];
  const integer = (
    value: number,
    name: string,
    maximum: number,
    minimum = 1,
  ) => {
    if (!Number.isInteger(value) || value < minimum || value > maximum)
      throw new RangeError(
        `${name} must be an integer from ${minimum} to ${maximum}.`,
      );
    return value;
  };
  const width = integer(
    options.width ??
      (options.height === undefined
        ? source.width
        : Math.max(
            1,
            Math.round((source.width * options.height) / source.height),
          )),
    "width",
    65535,
  );
  const height = integer(
    options.height ??
      (options.width === undefined
        ? source.height
        : Math.max(
            1,
            Math.round((source.height * options.width) / source.width),
          )),
    "height",
    65535,
  );
  if (width * height * 4 > 0xff000000)
    throw new RangeError("GIF bitmap exceeds WASM32 memory capacity.");
  const maxColors = integer(options.maxColors ?? 256, "maxColors", 256, 2);
  const quantizationSampleFactor = integer(
    options.quantizationSampleFactor ?? 10,
    "quantizationSampleFactor",
    30,
  );
  const paletteSampleCount = integer(
    options.paletteSampleCount ?? 262144,
    "paletteSampleCount",
    16777216,
  );
  if (options.dithering !== undefined && typeof options.dithering !== "boolean")
    throw new TypeError("dithering must be a boolean.");
  const opaqueColor = (color: string, name: string) => {
    if (typeof color !== "string")
      throw new TypeError(`${name} must be a valid opaque CSS color.`);
    const context = new OffscreenCanvas(1, 1).getContext("2d")!;
    context.fillStyle = "#010203";
    context.fillStyle = color;
    const first = context.fillStyle;
    context.fillStyle = "#040506";
    context.fillStyle = color;
    if (context.fillStyle !== first)
      throw new TypeError(`${name} must be a valid opaque CSS color.`);
    context.fillRect(0, 0, 1, 1);
    const pixel = context.getImageData(0, 0, 1, 1).data;
    if (pixel[3] !== 255) throw new TypeError(`${name} must be opaque.`);
    return [pixel[0], pixel[1], pixel[2]];
  };
  let background = -1;
  if (options.background !== undefined) {
    const [r, g, b] = opaqueColor(options.background, "background");
    background = (r << 16) | (g << 8) | b;
  }
  let palette: number[] = [];
  if (options.palette !== undefined) {
    if (
      !Array.isArray(options.palette) ||
      !options.palette.length ||
      options.palette.length > maxColors - (background < 0 ? 1 : 0)
    )
      throw new RangeError(
        "palette must contain opaque colors fitting maxColors (including transparency).",
      );
    palette = options.palette.flatMap((color) =>
      opaqueColor(color, "palette color"),
    );
  }
  const buffer = await client.request(
    {
      type: "gif",
      duration: recording.duration,
      width,
      height,
      sourceWidth: source.width,
      sourceHeight: source.height,
      maxColors,
      palette,
      dithering: options.dithering ?? false,
      quantizationSampleFactor,
      paletteSampleCount,
      frameRate,
      repeatCount: repeat,
      background,
    },
    options,
  );
  return new Blob([buffer], { type: "image/gif" });
}
