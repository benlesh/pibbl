# Public frame recording and GIF export

The private comparison now demonstrates the public API on a running Pibbl
application. It does not rely on the loader's onFrame callback for capture.
The same API works on any live Pibbl root Canvas 2D bitmap, including composed
Layers and external-renderer bitmaps.

Preview: <http://127.0.0.1:8766/canvas-comparison.html>

Use **Record 11 seconds**, **Stop and make GIF**, or **Discard recording / cancel
export**. White, dark, and transparent GIF export backgrounds are available. The export panel also exposes frame rate,
width/height, maximum colors, dithering, quantization sample factor, palette
pixel sampling budget, and an optional exact CSS palette.
The page releases the retained worker immediately after exporting, and revokes
the displayed GIF URL on discard, a new recording, or page teardown.

```ts
import { recordFrames, exportGif } from "@pibbl/core";

const capture = recordFrames(canvas, { duration: 11_000, frameRate: 60 });
await capture.ready;
// capture.stop() keeps the portion captured so far.
// capture.cancel() discards active capture and releases its resources.
const recording = await capture.finished;
const abort = new AbortController();
try {
  const gif = await exportGif(recording, {
    frameRate: 25,
    width: 320, // height follows aspect ratio unless explicitly supplied
    maxColors: 64,
    dithering: false,
    quantizationSampleFactor: 1, // highest training effort; default 10
    paletteSampleCount: 262144,
    // palette: ["#FF735E", "#159447", "#8B5CCB", "white"],
    repeatCount: 0,
    background: "white",
    signal: abort.signal,
  });
  // Aborting conversion preserves recording for another export.
  // Applications own gif and any URL.createObjectURL(gif) URL.
} finally {
  recording.dispose(); // cancels pending reads/exports and releases WASM/worker
}
```

Capture observes successful root render completion, coalesces renders within
its rate limit without advancing the app, and preserves static spans through
timestamps and actual duration. Captured pixels remain in a worker-owned WASM
arena until explicit disposal. GIF conversion uses pinned Rust gif 0.14.1,
color_quant 1.1.0, and weezl 0.1.12, with one sampled palette, cumulative 10ms
timing, and correct transparent disposal. GIF palette and alpha losses are
explicit; opaque export backgrounds preserve antialiased edges better.

## Fresh verification, 2026-10-09

Environment: Node 26.9.0, pnpm 11.21.0, TypeScript 7.0.2, Playwright Chromium
151.0.7922.34 on macOS. The documented Node 24 LTS line was not exercised.
Rust 1.99.0 built the 38,281-byte self-contained WASM module; the worker script
is 2,484 bytes. Package builds validate source and binary fingerprints and
regenerate/check the worker without requiring a Rust installation.

- Source and built public API suites: 25 tests in each mode, including initial
  pending mounts, backing DPR, composed Layers, static coalescing, early stop,
  initial/capture/export abort, progress failure, independent roots, pending
  reads, duplicate export rejection, resize/readback/CSP/queue/allocation errors,
  and repeat-cycle teardown.
- In source mode, twenty capture/export/discard cycles returned worker, blob URL, observer,
  timer, abort-listener, pending-request, and export counters to zero. The root
  teardown collection returned to its original size each cycle. Native Worker
  instrumentation in both modes additionally verified exactly one termination per owner.
- Existing runtime, animation, scheduler, cleanup-stress, and external-layer
  ownership regressions: 24 tests passed across five files.
- Full comparison-app capture: 608 bitmaps, 275 encoded GIF frames, independently
  decoded duration **11,000ms**, GIF size 890,308 bytes. Actual browser events
  reported **13 workers opened, 13 closed, zero remaining**, including repeated
  discard, disposal during conversion, and root disposal. Zero browser errors.
  See [the raw report](./recording-api-results.json).
- Core build, full repository typecheck, changed-code lint, public JSDoc, packed
  NodeNext/Bundler consumers, normal-app tree shaking, and Studio source/built/
  editor export parity passed. Worker and WASM artifact checks passed.
- `corepack pnpm@11.21.0 docs:check` remains blocked by existing undeclared names
  in `docs/site/api/functions/rendered-series-inspection.md`; the new recording
  snippet passes the extracted-snippet typecheck. Aggregate trust was not run.
  Firefox and Safari were not tested.

Run the public suites:

```sh
VITE_CONFIG_NATIVE_IGNORE_WARNING=true corepack pnpm@11.21.0 exec vitest run packages/core/test/frame-recording.test.ts --browser.headless --browser.ui=false
VITE_CONFIG_NATIVE_IGNORE_WARNING=true corepack pnpm@11.21.0 exec vitest run packages/core/test/frame-recording.test.ts --mode built --browser.headless --browser.ui=false
node tooling/verify-packed-recording.mjs
node output/brand/pibbl-big-bubbles/animation/loader/recording-api-browser-check.mjs
```

The browser check expects the source preview on port 8766 and saves its report
and screenshot under /tmp. Browser workers, render subscriptions, timers, and
listeners are deterministic ownership checks; heap size or GC timing is not the
cleanup oracle. Retained recordings intentionally keep raw memory alive until
disposal. Export scratch allocations are freed between jobs; WASM linear memory
can retain its high-water size until the owning worker is terminated.

## GIF quality controls — fresh verification, 2026-10-09

The extended suite passes 30 tests in source mode and 30 in built mode. New
public-API evidence covers exact palettes, two-color dithering, automatic color
limits, both palette sampling controls, resize dimensions/aspect ratio,
premultiplied-alpha edge sampling, invalid options and untouched retained pixels.
Mid-encoding abort now exercises resizing, an exact palette and dithering before
retry; source ownership counters return to zero after each test.

The live comparison exported 125 captured frames using 320×225 output, 64 colors,
dithering, quantization sample factor 1 and 8192 palette samples: 142079 bytes.
Independent GIF decoding confirmed the dimensions; one worker opened and closed,
with zero live workers and no page errors. These numbers describe this short
manual-control run, not the earlier full 11-second benchmark.

Fresh commands: `corepack pnpm@11.21.0 exec vitest run packages/core/test/frame-recording.test.ts`
and the same command with `--mode built`; core build; packed recording verification;
TypeScript checking and changed-file ESLint. Node 26.9.0 / pnpm 11.21.0 /
Playwright Chromium; the documented Node 24 environment was not exercised.
