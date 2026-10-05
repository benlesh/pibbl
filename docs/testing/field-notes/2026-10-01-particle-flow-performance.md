# Particle sampling and Canvas cost, 2026-10-01

> **Historical status: WORK IN PROGRESS MEASUREMENT RECORD.** Results describe
> this dated implementation and environment, not a portable performance promise.

This is local diagnostic evidence, not a portable performance guarantee or a
completed feature acceptance record. The active particle/flow work remains in
progress. Measurements ran on Node 26.9.0 and Playwright Chromium 151.0.7922.34;
the repository's prescribed Node environment is the Node 24 LTS line.

## Reproduction and equivalent work

Run `node tooling/benchmark-particle-sampling.mjs` from the repository root.
The runner bundles the current sampler and executes in Chromium. It compares:

- Streaming JavaScript: sample one particle into reusable registers, then draw.
- Full batch JavaScript: sample all particles into a contiguous Float64 buffer,
  then consume that buffer in the same order.
- Chunked JavaScript: pack at most 256 particles, draw them, and reuse the buffer.
- Cached drawing: draw already sampled data to isolate Canvas submission cost.

All modes use the same seeded inputs, motion, lifetime curves, sprite, opacity,
transform arithmetic, and source paint order. The batch boundary is one emitter;
the 13-register output includes position, velocity, size, rotation, RGBA, liveness,
and the existing reserved atlas slot. Full-batch values are checked exactly
against the scalar sampler for every particle before timing. Input arrays and
mutable birth/register scratch are reused. This comparison measures packing of
the existing calculation, not a specialized SIMD implementation or a different
visual effect. It excludes scheduler, birth-ledger, parameter-epoch, and flow
solver costs; the running Studio profile covers those separately.

Sampling results are per-pass medians after warmup, with ten passes per timing
sample to reduce clock quantization. Sampling order alternates. Canvas tests use
contiguous windows with five warmup frames each and reverse mode order on the
second pass. Canvas submission time includes synchronous driver backpressure;
it is not isolated GPU/raster completion time. rAF intervals measure the whole
scheduled browser frame including rendering pressure.

Raw output: [measurement records](2026-10-01-particle-sampling.jsonl).

## Results

Times below are milliseconds. Small differences near the browser clock's
resolution should not be treated as wins.

| Live sprites | Streaming sample | Full batch + packing | Chunked + packing | Streaming sample + Canvas | Cached Canvas only |
| ------------ | ---------------: | -------------------: | ----------------: | ------------------------: | -----------------: |
| 100          |             0.02 |                 0.02 |              0.02 |                      0.10 |               0.10 |
| 1,000        |             0.16 |                 0.17 |              0.17 |                      0.60 |               0.40 |
| 10,000       |             1.64 |                 1.71 |              1.71 |                     31.40 |              29.50 |

At 10,000 sprites, median frame intervals were 34.7 ms streaming, 34.9 ms full
batch, and 34.5 ms chunked. All three recorded 120/120 intervals above 25 ms.
Even cached drawing recorded 59/60 intervals above 25 ms. At 100 and 1,000
sprites, each mode recorded zero intervals above 25 ms.

Shared input storage is 20 bytes per particle. Full output batching adds 104
bytes per particle (1,040,000 bytes at 10,000); 256-particle chunking caps the
extra output buffer at 26,624 bytes. Streaming uses one 104-byte register array.
Fixture setup, allocation, compilation, and equivalence checking took 2.4–5.0 ms;
this is not an isolated compiler startup measurement. Buffer sizes are exact;
they do not represent total browser heap or GPU memory.

The complete Fire and Flow Studio scene was separately profiled with
`node tooling/profile-particle-scene.mjs` before the combined-transform change.
Its 300-frame sample had an 8.4 ms median, 10.4 ms p95, and 13 ms p99, with no
intervals above 25 ms. Entire-page JS heap samples were approximately 128 MB
before and 127 MB after (including the Studio editor, not just particles).
These are two different workloads; their numbers must not be combined.

## Decisions supported by this evidence

Retain streaming analytical JavaScript for ordinary Canvas particles. Packing
alone did not improve this workload and increases memory traffic. Do not ship a
second rendering sampler merely because its interface is batched. Batching is
already useful at the shared flow-field boundary: integration samples reusable
position/velocity arrays in bounded chunks without particle rigid bodies.

Do not introduce WASM for this sampling path on this evidence. At 10,000 sprites,
eliminating the measured 1.64 ms sampling cost entirely would remove only about
5% of the 31.4 ms submission time, before accounting for boundary packing and
memory traffic. This is an upper-bound argument for this workload, not a claim
that WASM can never help. Reconsider it if a materially different numerical
workload dominates a representative profile.

The visible fire improvement comes from a coherent animated raster, soft smoke
sprites, and sparse embers, rather than attempting to assemble a flame from
thousands of repeated silhouettes. The artwork is generated locally. Ordinary
Canvas particles retain deterministic analytical appearance and motion; the
optional shared flow introduces explicitly stateful transport. Neither this
comparison nor the implementation promises volumetric lighting or depth-aware
occlusion.

A substantially higher sprite ceiling would need a separate external-renderer
experiment through Pibbl's existing render-layer boundary. It does not justify
restoring the removed custom WebGL particle API. At measurement time, flow transaction/lifecycle evidence, parameter semantics,
documentation, and full public-package verification were still pending. The
verification addendum below records their subsequent completion.

## Verification addendum, 2026-10-01

`corepack pnpm@11.21.0 trust` completed with exit code 0 after the new API pages
were added to the documentation inventory and learning-catalog expectations were
updated for Fire and Flow. Environment: Node 26.9.0, pnpm 11.21.0, Playwright
Chromium. This is not a Node 24 validation claim.

- Full browser suite: 3,452 passed, six existing skips, across 318 passing files
  and two skipped files.
- Lifecycle suite: 33 passed.
- Structural performance suite: 48 passed, four opt-in skips.
- The aggregate also passed source/built/editor export parity, packed consumers,
  Bundler and NodeNext declarations, Studio documentation and visual checks,
  built smoke, text browser checks, and native text tests.
- The dedicated public flow smoke test passed separately in both source and
  built modes. It verifies smoke movement, committed obstacle updates, and
  disposal through package entrypoints.
- Public hook tests cover failed obstacle reads without partial publication,
  source replacement at unchanged logical time, source transfer/disable cleanup,
  failed initial mount cleanup, and registration-order-independent physics
  coupling. A learning-example test drives the actual scene through selection,
  dragging, resizing, rotation, and deselection.

The final runtime retains analytical sampling and the shared scheduler, adds
optional stateful flow, removes the superseded box-only obstacle API, and leaves
fire recipes application-owned. The new general obstacle snapshot changes
revision only when geometry or motion changes, avoiding grid/stencil rebuilds
for stationary bodies. No separate WASM sampler or shared-module-memory contract
was introduced. No visual baselines were rewritten to obtain the passing gate.
