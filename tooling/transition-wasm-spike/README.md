# Bifrost WASM experiment

Run from the repository root:

```sh
node tooling/transition-wasm-spike/run.mjs
```

Uses the existing AssemblyScript compiler in core's dependencies and installed
Playwright Chromium. Compiled WASM and generated browser bundles live in a
fresh system temporary directory. `results.json` is overwritten with fresh output.
The experiment does not modify production code or exports. Production Bifrost now uses the measured WASM approach; this harness retains the pre-integration JS reference for comparison.

## Question and comparison

Does batching Bifrost's 56 color-patch descriptors into one WASM call improve
rendering compared with JavaScript? Three paths use identical Pibbl capture,
Canvas gradients, blur, tint, clipping, and compositing:

1. Current Bifrost implementation, including repeated seeded calculations.
2. A JavaScript descriptor sampler caching seed-dependent coefficients.
3. An AssemblyScript Float64 sampler with the same coefficient caching, one
   JS/WASM call per beam, and a persistent view of shared output memory.

The generated alternatives replace only the numerical part of Bifrost's patch
loop; the rest comes from `reference-bifrost.txt`, captured from commit `c042ad66` before WASM integration. The isolated
calculation benchmark includes descriptor writes for all variants; its original
JS sampler mirrors the production equations but is not the entire render loop.

Seed 8, one beam, 800×560 canvas, DPR 1, both enter and exit, 1,000 ms material
motion. Each run rotates variant order over six frame trials, discards the first
trial and first six frames of each subsequent trial, and measures 570 frames per
variant. Kernel measurements use seven rotated trials of 20,000 calls, discarding
the first trial. Results include medians and frame p95, not a correctness timing
threshold.

Submission time includes the Pibbl scheduler and Canvas command submission. The
synchronized measurement additionally reads the entire canvas to force drawing
completion. That readback is benchmark instrumentation, not production behavior;
these numbers are not display-refresh FPS or a mobile/GPU benchmark. Headless
Chromium's graphics path and readback can affect absolute timings.

Numerical parity checks cover 200 times/directions against both JS samplers.
One full rendered frame per variant is compared byte-for-byte. Other visual
states still rely on the existing transition regression suite. This experiment
is specific to Bifrost; it does not establish results for Embers or Hologram.

## Result: no useful whole-frame improvement

Two runs on macOS arm64, Node 26.9.0, Chromium 151.0.7922.34, October 4, 2026:

| Measurement                      | Current JS | Cached JS | Cached WASM |
| -------------------------------- | ---------: | --------: | ----------: |
| First run descriptor calculation |    7.81 μs |   5.64 μs |     1.01 μs |
| Repeat descriptor calculation    |    8.01 μs |   5.84 μs |     1.09 μs |
| First synchronized frame median  |    10.2 ms |   10.1 ms |     10.1 ms |
| Repeat synchronized frame median |    10.2 ms |   10.2 ms |     10.2 ms |
| Repeat synchronized frame p95    |    11.8 ms |   11.8 ms |     11.6 ms |

Latest raw values and environment are in `results.json`. Repeat-run WASM size is
4,696 bytes, with about 2 ms compilation/instantiation (coefficient initialization
excluded). Maximum descriptor difference was below 9e-9; the compared rendered
frames had zero differing channels. The first run used a different scratch-memory
layout; the repeat separates descriptor/coefficient buffers from compiler static
data, without changing equations.

WASM sped up this small numerical kernel about 7× versus uncached JS and 5× versus
cached JS, saving only about 7 μs within a 10,200 μs frame. Frame differences are
small and inconsistent; there is no demonstrated end-to-end gain. No memory,
power, or battery improvement was measured. The measured end-to-end result alone does not justify adopting WASM. The product decision is nevertheless to retain these calculations in WASM, reducing their cost independently of future Canvas platform improvements.
Profile capture/blur/gradient drawing next; consider WASM again for substantially
larger simulations or measured numerical bottlenecks.
