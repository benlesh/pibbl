# Private pixel-recording benchmark

Use the comparison preview at <http://127.0.0.1:8766/canvas-comparison.html> or
Canvas-only workload at <http://127.0.0.1:8766/canvas-comparison.html?isolation=1>.
The comparison workload continues SVG attribute updates and UI status work.
Isolation omits the SVG pane and its updates; neither mode fabricates extra load.
Both include lightweight measurement and benchmark UI overhead.

Choose a duration and capture rate, then run Baseline, Read pixels, Transfer to
worker, or Record in WASM. Keep the tab visible. Results accumulate in the table
and can be downloaded as JSON. Stop cancels the worker; loader controls cancel
recording before changing playback. Resizing invalidates a run instead of mixing
backing sizes. The benchmark runs from the loader's existing after-paint reaction;
Pibbl still owns animation scheduling. A timer only stops the measurement.

The pipeline is actual `getImageData()` → transferable RGBA buffer → module
worker → reusable WASM input allocation → WASM `memory.copy` into consecutive
frame storage. Transfer mode acknowledges bytes without storing them. Readback
mode discards bytes on the main thread. No GIF/ZIP encoding is implemented.
WASM storage checks sampled pixels during recording; a separate test verifies
two complete independent frames byte-for-byte through the real WASM module.

## Budgeting raw storage

The fixed cap was replaced with an estimate:

```js
frameBytes = canvas.width * canvas.height * 4;
expectedFrames = Math.ceil((durationMs / 1000) * captureFps);
frameCapacity = Math.ceil(expectedFrames * 1.15);
allocationBytes = roundUpToWasmPage(frameBytes * (frameCapacity + 1));
```

Backing dimensions include DPR. `captureFps` is the measured recent render rate,
limited by the selected maximum if one is specified. The extra frame is reusable
input staging. Fifteen percent is configurable headroom for the frame-rate
estimate; it is not a universal memory safety multiplier. Metadata, transient
transferred buffers and browser Canvas memory are additional costs.

For 640×450 at 120 fps for three seconds: 360 expected frames; 414 stored-frame
slots plus one input slot; about 456 MiB allocated after page rounding. Eleven
seconds at that rate is about 1.42 GiB of raw frame bytes before headroom.
If `256` means 256 expected frames, `width * height * 4 * 256 * headroom` is
valid. Palette size is unrelated to raw RGBA storage.

Storage is preallocated before recording, and allocation time is reported
separately. Input copy and WASM store timings cover two full copies. Worker
round-trip timing includes scheduling and validation; it is not pure transport
cost. A three-frame queue bounds incoming work. Queue drops and storage-estimate
misses are counted explicitly. WASM32 provides an address-space boundary, and
actual allocation can still fail below it; failure ends recording visibly.
The benchmark does not promise that a browser can allocate every calculated
budget. Each worker is terminated after its result, releasing its raw recording.

## Repeatable checks

With the preview server running:

```sh
node --test output/brand/pibbl-big-bubbles/animation/loader/*.test.mjs
node output/brand/pibbl-big-bubbles/animation/loader/recording-browser-check.mjs --fresh
```

The browser runner uses headless Playwright Chromium at a 1440×1000 viewport,
DPR 1, three repetitions per path and workload, alternating path order. Every
fresh condition reloads the page to create a new Canvas, warms animation for
500ms, then measures three seconds. Worker startup and preallocation precede the
measurement. It asserts no drops or storage misses, exact stored-frame byte
counts, successful WASM storage and no page errors. JSON goes to
`/tmp/pibbl-recording-results-fresh.json`; screenshots go to `/tmp`.
Without `--fresh`, conditions share a Canvas to model successive app use.

`recording-results-warm.json` records an earlier 24-run matrix with a fixed
512 MiB cap and incremental WASM growth. It is historical comparison evidence,
not the current allocation protocol. Repeated Canvas readbacks can affect the
browser's backing strategy; fresh-condition results are the primary evidence
for the final protocol. Timing quantization, headless execution, machine load,
GC, display refresh and browser implementation affect these numbers. This is a
local experiment, not a cross-device performance guarantee.

## Fresh results · October 8, 2026

Node 26.9.0 and Playwright 1.62.1 Chromium, local headless runs at 640×450
backing pixels / DPR 1. Each table value is the median of three runs' p95 values,
not a pooled percentile. Both workloads rendered at roughly 120 Hz.

| Workload   | Path         | Render interval p95 ms | Readback p95 ms | Worker round trip p95 ms |
| ---------- | ------------ | ---------------------: | --------------: | -----------------------: |
| Comparison | Baseline     |                    8.7 |               — |                        — |
| Comparison | Readback     |                    8.8 |             0.7 |                        — |
| Comparison | Transfer     |                    8.7 |             0.6 |                      0.6 |
| Comparison | WASM storage |                    8.8 |             0.7 |                      0.7 |
| Isolated   | Baseline     |                    8.9 |               — |                        — |
| Isolated   | Readback     |                    8.8 |             0.7 |                        — |
| Isolated   | Transfer     |                    8.9 |             0.7 |                      0.6 |
| Isolated   | WASM storage |                    8.8 |             0.7 |                      0.6 |

Dispatch p95 was 0.1ms. WASM input copy p95 was 0.1ms and its second copy into
stored frame memory was 0.3ms. Three-second recordings stored about 396 MiB.
All 24 fresh conditions completed without queue drops or storage misses.
`recording-results-fresh.json` contains full summaries and estimates.

A full 11-second comparison-workload recording retained **1,320 frames** and
**1,450.2 MiB** of raw pixels in an estimated **1,676.6 MiB** allocation. Readback
p95 was 0.8ms; render interval p95 was 9.0ms; no captures dropped or exceeded
storage. `recording-results-long.json` contains that run. Active-recording
cancellation released its worker and left the loader advancing.

Fifteen Node tests passed, including budget calculations and real WASM bitmap
copies. JavaScript lint and formatting passed. The existing Canvas comparison
browser regression suite also checks renderer fidelity, lifecycle and density.
These data suggest direct readback/transfer/storage is viable for this logo at
this resolution on this machine. Memory volume is a clearer limitation than
copy throughput here. No compression, GIF encoding, ZIP generation, GPU-heavy
composition, mobile device or cross-browser performance claim is established.

The original Canvas loader was already committed as `6903cd1e` before this
experiment. Benchmark changes are separate working-tree changes for review.
