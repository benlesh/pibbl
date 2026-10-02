# Texture WASM spike

Experimental reaction-diffusion solver, batched painting, and palette rasterization, kept outside
package exports. Production texture behavior is unchanged. The comparison page
mounts both implementations through public `crc`, `createElement`, and
`defineRenderLayer`. A private manual scheduler driver is used only to measure
repeatable complete frames headlessly.

## Run

From the repository root, with the existing dependencies installed:

```sh
node --import tsx --test tooling/texture-wasm-spike/parity.check.mjs tooling/texture-wasm-spike/interaction.check.mjs
node tooling/texture-wasm-spike/serve.mjs
```

Open <http://127.0.0.1:4381>, select **Start / reset painting**, and drag on the
texture. Switch engines and workload sizes to compare; each switch resets the
same seed and only one backend runs. Brush radius and pause controls allow
inspecting strokes. Live metrics retain the most recent 600 samples.

The **Original throughput experiment** section preserves the noninteractive
side-by-side preview and manual-scheduler benchmark. Both experiments use fixed
steps per frame to compare equal work; neither reproduces the production
component's elapsed-time admission.

In another terminal:

```sh
node tooling/texture-wasm-spike/measure.mjs /tmp/crc-texture-wasm-results.json
# Fast browser check without repeating the benchmark:
node tooling/texture-wasm-spike/measure.mjs --verify-only
```

The runner checks exact nonempty live Canvas pixel equality, captures a preview
in `/private/tmp/crc-texture-wasm-preview.png`, and rejects page errors.

The 1,743-byte WASM module can be rebuilt with AssemblyScript 0.28.20:

```sh
npm install --prefix /private/tmp/crc-texture-wasm-compiler --no-audit --no-fund --ignore-scripts --save-exact assemblyscript@0.28.20
node tooling/texture-wasm-spike/build.mjs
```

Set `CRC_ASC` to the compiler's `bin/asc.js` on other installations. Compiler
packages stay outside workspace dependencies. `kernel.asc` is AssemblyScript;
the build temporarily supplies the `.ts` extension required by its compiler.

## Memory and arithmetic

Each instance owns one fixed-size imported `WebAssembly.Memory`: four Float32
fields, RGBA output, alpha output, a 1 KiB palette, and a 256 KiB brush queue. JavaScript views that
memory directly. A single initialization copy seeds the two live fields. Each
frame makes one solver call for the whole step batch and one colorization call.
Field buffers swap by offsets; pixel storage never moves or grows. `ImageData`
borrows the pixel view, with a runtime assertion that its buffer is identical.
There is no per-frame field serialization or WASM-to-JavaScript pixel copy.
Canvas upload and CRC bitmap composition still have their normal costs.

Painting writes four f64 values directly into WASM memory per interpolated stamp,
then one `paintBatch` call applies every queued stamp before advancing the solver.
The JS control uses the same typed queue and the existing `InkSimulation.paint`.
Both queues are bounded at 8,192 stamps and use the production component's primary
pointer capture, coordinate mapping, interpolation spacing, clipping, and release
policy. The input glue is spike-local; no production package is changed.

The module uses f64 intermediates and f32 stores to match JavaScript arithmetic.
No relaxed math, explicit SIMD, worker, SharedArrayBuffer, second animation loop,
or per-cell bridge calls are involved. One memory per instance avoids allocator
and ownership complexity in this first slice. Disposal drops owned references;
it does not promise synchronous operating-system memory reclamation.

## Measurement design

Seven workloads from 32×32/one step through 512×512/24 steps; fixed 832×400
presentation at density 1; three rounds; 30 warmup frames and 80 measured frames
per case per round. Mode order rotates each round. All modes use the same
render-layer wrapper and display composition. Timings separate solver,
raster/upload, and total synchronous CRC frame work. They exclude asynchronous
GPU completion, display scanout, and scheduling delay.

Four modes distinguish the causes of any gain:

- Current JavaScript solver and `TextureRaster` from the working checkout.
- JavaScript control replacing periodic modulo operations with conditional
  wraparound, generated from the same solver source when starting the server.
- WASM solver/colorization with direct pixel memory.
- Identical WASM plus an explicit pixel copy before Canvas upload.

JSON records all samples, startup timing, environment, and source hashes. This
is evidence for the tested machine, not a portable timing assertion. The browser
clock's roughly 0.1 ms resolution limits conclusions about very light solver
work. Compare pooled medians/p95 and individual rounds; do not interpret a small
copy-path difference as proof of a transport speedup.

## First measured result

2026-10-02 UTC: Apple M5 Max, macOS arm64, Chromium 151.0.7922.34,
Node 26.9.0 (not the repository's documented Node 24 LTS environment).
Pooled synchronous CRC frame median/p95, milliseconds, 240 samples per cell:

| Workload          |  Current JS | Optimized JS | WASM direct |
| ----------------- | ----------: | -----------: | ----------: |
| 32×32, 1 step     |   0.7 / 0.8 |    0.7 / 0.8 |   0.7 / 0.9 |
| 128×128, 8 steps  |   1.6 / 1.8 |    1.4 / 1.5 |   1.2 / 1.4 |
| 256×144, 8 steps  |   2.5 / 2.7 |    2.3 / 2.6 |   1.8 / 2.2 |
| 512×512, 8 steps  | 13.6 / 15.1 |  12.2 / 13.3 |   8.7 / 9.6 |
| 512×512, 24 steps | 37.4 / 38.1 |  33.3 / 36.2 | 22.7 / 25.6 |

The heavy cases support continuing this experiment: about 36–39% lower median
frame time than current JS, and a gain remains against the optimized JS control.
Absolute p95 improves at heavier loads; relative jitter is not uniformly better.
The copy control was approximately tied with direct memory, sometimes slightly
faster, so this run does not establish a measurable transport advantage.
Measured module compilation was 0.2 ms; steady-state figures exclude startup.

These experiments are slices ready for feedback, not a production migration.
Static material generation is now covered below. Electric textures, masks,
resizing, loading/fallback API design, explicit SIMD, workers, and other
browsers/devices remain outside this spike.

## Interactive latency result

```sh
node tooling/texture-wasm-spike/measure-interaction.mjs --verify-only
node tooling/texture-wasm-spike/measure-interaction.mjs /tmp/crc-texture-interaction-results.json
```

The browser runner first proves identical painted fields and pixels with the
solver paused, including capture outside the surface and release. It also checks
engine/workload/brush/pause controls, desktop and mobile layout, and console health.
Screenshots are saved under `/private/tmp/crc-texture-interaction-*.png`.

Timing uses the real CRC browser scheduler, with a diagnostic trace collector
observing completion after the Complete phase. Node injects 120 mouse moves at
60 Hz through Chromium's input protocol per case, plus a press/release. Dispatches
are not awaited serially, so blocked page work does not artificially slow the
input source. Three rounds alternate backend order, after 30 warmup frames per
case. Only one backend runs and live metric DOM updates are disabled during timing.
The brush radius is 6 simulation cells, strength 0.8. Both backends use the same
seed and pointer path; different frame rates produce different simulation ages.

The measured endpoint is synchronous CRC frame completion, **not physical screen
presentation**. Event-to-frame uses the browser input timestamp. Separate metrics
record event age at brush-handler entry, brush-handler-to-frame, queue writes,
brush application, and CRC frame durations. The approximately 0.1 ms browser clock
cannot resolve nanosecond-scale bridge overhead. A sample rounding to zero does
not imply free work. The headless browser's unblocked frame interval was about
8.4 ms; the 60 Hz input cadence is not a forced 60 Hz display refresh rate.

Same M5 Max / Chromium 151 / Node 26.9.0 environment as above, 2026-10-02 UTC.
Pooled input-to-CRC-frame median/p95 in milliseconds:

| Workload          |  JavaScript |        WASM | Routed samples JS / WASM |
| ----------------- | ----------: | ----------: | -----------------------: |
| 32×32, 1 step     |  4.5 / 10.6 |   5.2 / 9.8 |                363 / 363 |
| 512×512, 8 steps  | 22.2 / 28.2 | 13.8 / 18.2 |                363 / 363 |
| 512×512, 24 steps | 47.0 / 55.0 | 32.8 / 41.3 |                162 / 255 |

Each backend received 363 injected pointer samples per workload across the three
rounds. At extreme load fewer samples reached the routed handler, consistent with
browser coalescing; this harness does not recover coalesced samples. Report latency
alongside delivery counts: it describes delivered samples only. All accepted
stamps were applied, none overflowed the brush queue, and capture was released.
The finite-path parity test is separate from this real-time timing experiment.

Both backends' queue-write p95 rounded to 0.0 ms; complete brush-handler p95 was at
most 0.1 ms. No meaningful marshalling penalty was detectable at this workload and
clock resolution. Heavy input-to-frame medians improved about 38% and 30%, with
lower absolute p95. Light workload timing does not establish a WASM benefit.
The extreme case still spends about 23 ms in a WASM frame, so moving to a worker
would be a separate possible experiment if that interaction budget is insufficient.

## Static material generation and richer recipes

Open <http://127.0.0.1:4381/materials> and select **Render comparison**. The current
and enhanced candidates use the same seed, raster size, and palette. Choose
marble, paper, or cellular, change the seed/scale/detail, switch WASM/JavaScript,
and enable **Show 2×2 tiles** to inspect repetition. The enhanced candidates are
visual proposals, not approved replacements for the shipped recipes.

```sh
node tooling/texture-wasm-spike/build.mjs
node --import tsx --test tooling/texture-wasm-spike/materials.check.mjs
node tooling/texture-wasm-spike/measure-materials.mjs --verify-only
node tooling/texture-wasm-spike/measure-materials.mjs /tmp/crc-materials-results.json
```

`materials.asc` contains f64 calculations with f32 output. The material runtime
owns a fixed memory allocation for one field, RGBA, alpha, and palette. Generation
receives scalar parameters; neither the field nor pixels are copied back to JS.
`ImageData` borrows the pixel view. The WASM module is separate from the earlier
reaction-diffusion experiment.

The baseline compares the shipped generators, a matched JavaScript control, and
WASM. The matched control is generated from the AssemblyScript source with numeric
casts preserved and 32-bit multiplication mapped to `Math.imul`. It reuses output
storage like WASM. This distinguishes runtime benefits from changes such as
hoisting wrapped lattice coordinates and removing per-sample closures. The
control is not automatically faster than the shipped JavaScript.

The richer recipes compare matched JS and WASM implementations of identical work:

- Marble adds two warp fields, six-octave detail, variable-width primary veins,
  secondary hairlines, and broad mineral shading. Four stratified samples per
  pixel filter thin detail; this is deliberately a more expensive candidate.
- Paper adds multiple fiber scales, pulp variation, subtle directional relief,
  and lower-amplitude grain. It is a more visibly fibrous interpretation.
- Cellular adds directional bevel shading from neighboring field samples and
  fine mottling. The original cells and periodic topology are retained.

Focused tests check reference field agreement within 1e-6, periodic edges,
persistent output memory, and enhanced JS/WASM parity. The browser additionally
checks raster agreement within one channel value; the tested 128-square baseline
and enhanced cases were exactly equal. These checks do not promise bit-identical
transcendental functions on every engine/platform.

The full benchmark uses three rotated-order rounds, 12 measured regenerations and
four warmups per case at 64, 256, and 512 square; 1024-square stress cases use six
measurements and two warmups. It changes seed and detail each generation, keeping
resolution and scale fixed. Results separate generation, coloring/upload, and
complete synchronous CRC regeneration/presentation at 832×400. Fresh-instance
first-generation timing is also recorded after module compilation; it is not a
fresh-browser cold-start measurement. Module compilation is reported separately.
The unchanged-props check confirms no additional generation or continuing frame.

The public resolution cap remains 262,144 cells. The 1024-square experiment
bypasses that cap only in this private harness. Static materials still do no
continuing generation work unless their parameters change, so these improvements
primarily affect setup, regeneration, and applications that animate parameters.

### Static material findings

2026-10-02 UTC, Apple M5 Max / macOS arm64 / Chromium 151.0.7922.34 /
Node 26.9.0. The full run recorded 180 cases. Because JS timings differed between
the short probe and mixed-recipe run, a focused 27-case check also ran one recipe
per fresh page, three rounds, eight warmups, and 12 measurements per case:

```sh
node tooling/texture-wasm-spike/measure-materials.mjs --isolate
```

Fresh-page baseline at 512×512, pooled median/p95 regeneration plus CRC
presentation in milliseconds (36 samples per cell):

| Recipe   |  Shipped JS |  Matched JS |        WASM |
| -------- | ----------: | ----------: | ----------: |
| Marble   | 21.7 / 22.3 | 23.8 / 24.4 | 13.5 / 13.7 |
| Paper    | 14.0 / 14.3 | 16.9 / 18.0 |   7.2 / 7.4 |
| Cellular | 36.5 / 38.0 | 41.9 / 42.4 | 15.8 / 16.1 |

Fresh-instance first-generation medians for shipped JS versus WASM were
22.6/14.0 ms, 14.2/7.7 ms, and 36.8/16.3 ms respectively. Module compilation is
excluded from those timings. The material module is 13,342 bytes; the full run
recorded approximately 0.1 ms compilation on this machine, not download latency.

Enhanced recipes at 512×512 from the mixed run, median/p95 milliseconds:

| Recipe                     |    Matched JS |          WASM |
| -------------------------- | ------------: | ------------: |
| Marble, four samples/pixel | 262.9 / 267.0 | 123.3 / 124.2 |
| Layered paper              |   71.0 / 76.7 |   28.7 / 31.0 |
| Beveled cellular           | 128.1 / 134.8 |   43.7 / 44.1 |

The faster backend does not make the richer recipes free: all three cost more
than their existing counterparts. Enhanced marble is especially suited to
cached generation, not synchronous regeneration every animation frame. At the
experimental 1024-square size its WASM median was 488.2 ms versus 1055.8 ms in
matched JS. A worker or deferred generation would be a separate experiment for
avoiding that main-thread stall.

At 64-square resolution the baseline mixed-run medians were only 1.0–1.5 ms
for JS versus 0.8–1.1 ms for WASM, so the absolute benefit is small. The full
mixed-recipe run produced higher JS baselines at larger sizes than the focused
fresh-page check; the experiment does not establish the exact cause. Keep the
more conservative isolated comparison when discussing expected benefit, and
retain both raw reports. WASM won in both runs, including against matched JS.

Browser checks observed exact field and raster equality for all six tested
baseline/enhanced recipe pairs, valid desktop/mobile controls and layout, and no
page errors. Focused numerical tests also preserve seams and memory identity.
Production exports and defaults are unchanged; visual preference for the richer
candidates remains a user judgment.
