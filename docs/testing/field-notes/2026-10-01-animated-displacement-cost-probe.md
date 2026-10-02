# Animated displacement cost probe — 2026-10-01

> **Historical status — 2026-10-01.** This opt-in measurement harness records
> machine-specific investigative evidence. It is not a performance promise or
> a default correctness gate.

Run the opt-in Chromium probe sequentially:

```sh
VITE_CRC_DISPLACEMENT_BENCH=1 corepack pnpm@11.21.0 exec vitest run packages/core/test/displacement-cost.bench.test.ts --browser=chromium --browser.headless
```

The probe mounts public `waterWaves` and `displacement` over 64 rectangles at
320 logical pixels/DPR 1 and 960 logical pixels/DPR 2. It explicitly sets the
CSS canvas size to the logical size and asserts the backing store is
`logical-size × DPR`. A `ManualSchedulerDriver` advances six warm-up frames and
then measures 30 synchronous `flush()` calls at 60 Hz logical time.

The emitted JSON records median and p95 CPU submission durations for the whole
CRC flush, water recipe rasterization (including generation), source-capture
Canvas drawing, final root Canvas composition, WebGL texture-upload submission,
WebGL draw submission, and image-bitmap transfer. The stage timings overlap the
whole flush and one another, so they must never be added together. GPU elapsed
time is unavailable: this probe deliberately does not use timer queries and
makes no FPS, zero-copy, or GPU-duration claim.

The report includes Node/browser identity and reported hardware concurrency.
Run output is the authoritative numeric record for a given machine; results are
host- and browser-dependent. The probe asserts that water rasterization, source
capture, and final root composition each occur, and its implementation performs
no scene `getImageData` or `readPixels`. Existing ownership tests cover bounded
GPU resources and map-cache release.

## Recorded run

On 2026-10-01, the command above passed in HeadlessChrome 151.0.7922.34 on the
local macOS host (reported `hardwareConcurrency: 18`; Node is executed by the
browser runner). With six warm-ups and 30 measured synchronous flushes:

| Logical size / DPR | Complete flush median / p95 | Water raster median / p95 | Root composition median / p95 | Upload median / p95 | Transfer median / p95 |
| ------------------ | --------------------------- | ------------------------- | ----------------------------- | ------------------- | --------------------- |
| 320 / 1            | 3.4 / 3.9 ms                | 1.6 / 1.7 ms              | 0.0 / 0.1 ms                  | 0.0 / 0.1 ms        | 1.1 / 1.2 ms          |
| 960 / 2            | 39.0 / 42.2 ms              | 1.6 / 1.7 ms              | 1.0 / 1.1 ms                  | 1.8 / 2.2 ms        | 30.7 / 33.3 ms        |

The per-stage samples are nested CPU submission spans. For example, the
960/DPR 2 transfer time is already part of the 39.0 ms whole-flush median; the
table must not be summed. Source-capture draws and GPU draw submission had
sub-millisecond medians at this timer's resolution. GPU elapsed time remains
unavailable.
