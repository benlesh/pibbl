# Animated displacement cost probe — 2026-10-01

> **Historical status: Performance investigation record; current behavior is defined by runtime contracts.**

This opt-in measurement harness records machine-specific investigative evidence.
It is not a performance promise or a default correctness gate.

Run the opt-in Chromium probe sequentially:

```sh
VITE_PIBBL_DISPLACEMENT_BENCH=1 corepack pnpm@11.21.0 exec vitest run packages/core/test/displacement-cost.bench.test.ts --browser=chromium --browser.headless
```

The probe mounts public `waterWaves` and `displacement` over 64 rectangles at
320 logical pixels/DPR 1 and 960 logical pixels/DPR 2. It explicitly sets the
CSS canvas size to the logical size and asserts the backing store is
`logical-size × DPR`. A `ManualSchedulerDriver` advances six warm-up frames and
then measures 30 synchronous `flush()` calls at 60 Hz logical time.

The emitted JSON records median and p95 CPU submission durations for the whole
Pibbl flush, water recipe rasterization (including generation), source subtree traversal and drawing, offscreen Canvas copies, final root Canvas composition, WebGL texture-upload submission,
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

| CPU span per frame, median / p95 |  320 / DPR 1 |    960 / DPR 2 |
| -------------------------------- | -----------: | -------------: |
| Complete flush                   | 3.4 / 3.8 ms | 37.9 / 40.2 ms |
| Water rasterization              | 1.5 / 1.6 ms |   1.6 / 1.7 ms |
| Source subtree capture           | 0.3 / 0.5 ms |   0.3 / 0.5 ms |
| Offscreen composition            | 0.1 / 0.2 ms |   2.5 / 2.7 ms |
| Root composition                 | 0.0 / 0.1 ms |   1.0 / 1.1 ms |
| Texture upload submission        | 0.1 / 0.2 ms |   1.8 / 2.0 ms |
| Draw submission                  | 0.0 / 0.1 ms |   0.0 / 0.0 ms |
| Bitmap transfer                  | 1.1 / 1.3 ms | 29.9 / 31.3 ms |

This refreshed run used Node 24.15.0 and pnpm 11.21.0. Every metric contains
30 per-frame samples; multiple calls within a stage are summed within that frame.
Source capture wraps the existing executor's subtree callback, including traversal
and drawing. Offscreen composition separately observes offscreen bitmap copies,
including publication and effect intermediates. No production timing API is added.

Stage timings overlap the complete flush and must not be summed with it. The
high-density transfer cost dominates this measured pipeline; the result does not
establish a portable frame-rate guarantee. GPU elapsed time remains unavailable.
