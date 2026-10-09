import { summarize, estimateRecording } from "./recording-metrics.mjs";
export function createRecordingBenchmark(
  canvas,
  { onResult = () => {}, onStatus = () => {} } = {},
) {
  let run,
    worker,
    sequence = 0,
    disposed = false;
  const pending = new Map();
  const recentIntervals = [];
  let previousRender;
  const finish = () => {
    if (!run || run.ended) return;
    run.ended = true;
    clearTimeout(run.timer);
    if (pending.size === 0) drained();
    else onStatus("Draining worker…");
  };
  const publish = (extra) => {
    const result = {
      mode: run.mode,
      budget: run.budget,
      allocationMs: run.allocationMs ?? 0,
      width: run.width,
      height: run.height,
      frameBytes: run.width * run.height * 4,
      requestedMs: run.duration,
      observedMs: run.end - run.start,
      renderedFrames: run.intervals.length + 1,
      captureAttempts: run.attempts,
      sentFrames: run.sent,
      dropped: run.dropped,
      storageFull: run.full,
      intervalMs: summarize(run.intervals),
      readbackMs: summarize(run.readback),
      dispatchMs: summarize(run.dispatch),
      roundTripMs: summarize(run.roundTrips),
      wasmInputCopyMs: summarize(run.copies),
      wasmStoreMs: summarize(run.stores),
      wasmAllocationMs: summarize(run.allocations),
      ...extra,
    };
    worker?.terminate();
    worker = undefined;
    run = undefined;
    onStatus("Finished");
    onResult(result);
  };
  const drained = () => {
    if (worker) worker.postMessage({ type: "finish" });
    else publish({ storedFrames: 0, storedBytes: 0, allocatedBytes: 0 });
  };
  return {
    get active() {
      return !!run;
    },
    async start({
      mode = "wasm",
      duration = 3000,
      maxFps = 0,
      headroom = 1.15,
    } = {}) {
      if (disposed || run)
        throw new Error("Benchmark unavailable or already running.");
      if (
        !["baseline", "readback", "transfer", "wasm"].includes(mode) ||
        !Number.isFinite(duration) ||
        duration <= 0 ||
        !Number.isFinite(maxFps) ||
        maxFps < 0
      )
        throw new Error("Invalid benchmark settings");
      const width = canvas.width,
        height = canvas.height;
      const measuredRate = recentIntervals.length
        ? 1000 / summarize(recentIntervals).median
        : 60;
      const budget = estimateRecording({
        width,
        height,
        duration,
        fps: maxFps ? Math.min(maxFps, measuredRate) : measuredRate,
        headroom,
      });
      run = {
        budget,
        mode,
        duration,
        maxFps,
        width,
        height,
        attempts: 0,
        sent: 0,
        dropped: 0,
        full: 0,
        intervals: [],
        readback: [],
        dispatch: [],
        roundTrips: [],
        copies: [],
        stores: [],
        allocations: [],
        lastCapture: -Infinity,
        start: undefined,
        ended: false,
      };
      onStatus(
        `Preparing ${budget.expectedFrames} expected frames; ${(budget.allocatedBytes / 1048576).toFixed(1)} MiB estimated allocation.`,
      );
      const current = run;
      if (mode === "transfer" || mode === "wasm") {
        worker = new Worker(
          new URL("./recording-worker.mjs", import.meta.url),
          { type: "module" },
        );
        await new Promise((resolve, reject) => {
          current.rejectStartup = reject;
          worker.onerror = (e) => {
            reject(new Error(e.message));
            this.cancel();
          };
          worker.onmessage = ({ data }) => {
            if (data.type === "ready") {
              current.allocationMs = data.allocationMs;
              resolve();
              return;
            }
            if (data.type === "error") {
              reject(new Error(data.message));
              this.cancel();
              onStatus(data.message);
              return;
            }
            if (run !== current) return;
            if (data.type === "ack") {
              const sent = pending.get(data.id);
              if (sent === undefined) return;
              pending.delete(data.id);
              run.roundTrips.push(performance.now() - sent);
              if (mode === "wasm") {
                if (data.stored) {
                  run.allocations.push(data.growMs);
                  run.copies.push(data.copyMs);
                  run.stores.push(data.storeMs);
                } else run.full++;
              }
              if (run.ended && pending.size === 0) drained();
            } else if (data.type === "finished") publish(data);
          };
          worker.postMessage({
            type: "start",
            frameBytes: width * height * 4,
            budget,
            store: mode === "wasm",
          });
        });
      }
      if (run !== current || disposed) return;
      current.rejectStartup = undefined;
      onStatus(
        `Recording… estimated ${budget.expectedFrames} frames, ${(budget.allocatedBytes / 1048576).toFixed(1)} MiB including ${Math.round((headroom - 1) * 100)}% headroom and input buffer.`,
      );
      run.start = performance.now();
      run.end = run.start;
      // This timeout stops recording; it does not drive animation or rendering.
      run.timer = setTimeout(() => {
        if (run) {
          run.end = performance.now();
          finish();
        }
      }, duration);
    },
    afterRender() {
      const now = performance.now();
      if (previousRender !== undefined && now > previousRender) {
        recentIntervals.push(now - previousRender);
        if (recentIntervals.length > 60) recentIntervals.shift();
      }
      previousRender = now;
      if (!run || run.start === undefined || run.ended) return;
      if (run.lastRender !== undefined)
        run.intervals.push(now - run.lastRender);
      run.lastRender = now;
      run.end = now;
      if (canvas.width !== run.width || canvas.height !== run.height) {
        this.cancel();
        onStatus("Canvas resized: rerun with stable dimensions.");
        return;
      }
      if (
        run.mode === "baseline" ||
        now - run.lastCapture < (run.maxFps ? 1000 / run.maxFps : 0)
      )
        return;
      run.lastCapture = now;
      run.attempts++;
      if (worker && pending.size >= 3) {
        run.dropped++;
        return;
      }
      const start = performance.now(),
        image = canvas
          .getContext("2d")
          .getImageData(0, 0, run.width, run.height);
      run.readback.push(performance.now() - start);
      if (worker) {
        const id = ++sequence,
          sendStart = performance.now();
        pending.set(id, sendStart);
        worker.postMessage(
          {
            type: "frame",
            id,
            buffer: image.data.buffer,
            timestamp: now - run.start,
            store: run.mode === "wasm",
          },
          [image.data.buffer],
        );
        run.dispatch.push(performance.now() - sendStart);
        run.sent++;
      }
    },
    cancel() {
      if (run) {
        clearTimeout(run.timer);
        run.rejectStartup?.(new Error("Recording stopped"));
      }
      worker?.terminate();
      worker = undefined;
      run = undefined;
      pending.clear();
      onStatus("Stopped");
    },
    dispose() {
      this.cancel();
      disposed = true;
    },
  };
}
