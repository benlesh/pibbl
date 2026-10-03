# Current-main performance and memory audit — 2026-10-03

This fresh audit finds reproducible reaction-diffusion initialization and stale-texture ownership bugs, retained physics handle caches, expensive overload handling, and substantial transient Canvas memory pressure. Normal diffusion teardown passed 1,000 cycles on each of two public paths. This does **not** establish that CRC is leak-free.

This is an audit, not a completed remediation. No production code was changed; every open finding below still needs its own regression, implementation, review, and release verification. The user's request for a fresh audit superseded execution of the old remediation queue.

## Exact baseline and environment

- Production baseline: `690bb10a99246b6f5f57df9b0341774209905827`, current `origin/main` at start and rechecked after the measurements. Origin: `https://github.com/benlesh/crc.git`.
- Local main was fast-forwarded to that commit in the clean managed `perf-verification` worktree. The original dirty `codex/physics-2d-quality` checkout, including package consolidation and HtmlBox work, was preserved. Its uncommitted changes are **not** part of this audit. Paths below describe the committed package layout at the audited SHA.
- Audit branch: `codex/perf-audit-2026-10-03`, managed `perf-implementation` worktree. Corrected diffusion harness commit: `5d2887dab4da1a2a0a2f80302802188fa2d3d69b`; its production tree matches baseline.
- Node 24.15.0, pnpm 11.21.0, Playwright Chromium 151.0.7922.34; macOS 26.6.2, arm64, Apple M5 Max, 128 GiB RAM.
- Source-mode browser measurements, package builds completed first. Timing workloads were serialized with our other tests/builds. This is a developer machine, not a calibrated dedicated performance host; unrelated preexisting user processes were preserved.
- Browser timings below measure CPU scheduler flush duration, not compositor latency or displayed FPS. They are descriptive local observations, not release thresholds. No old timing is used as a current baseline.

## Prioritized findings and dispositions

| ID  | Priority         | Finding                                                                         | Fresh evidence and disposition                                                                                                                                                                                                                                                                            |
| --- | ---------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 | P1               | Initial diffusion publication failure leaves scheduled work alive               | Confirmed. Inject the first `putImageData` failure in the actual public reaction-diffusion recipe: root count becomes zero after disposal, but one advance participant and pending host frame survive eight more flushes; `InkSimulation.dispose` count remains zero. Open.                               |
| A02 | P1               | Physics public handle caches grow with removed bodies/colliders                 | Confirmed. 1,000 public mount/query/remove cycles grow both maps from 0 to 1,000; both remain 1,000 after disposal. Public removed handles correctly report disabled. Open.                                                                                                                               |
| A03 | P1               | Accepted diffusion message bursts can monopolize a frame                        | Confirmed. 656 resets drain in 281.4 ms; 8,192 large-radius stir messages drain in 936.5 ms. Queue capacity rejects message 8,193 but does not bound work in one frame. Open performance issue.                                                                                                           |
| A04 | P1 investigation | Maximum-area diffusion produces large transient browser memory pressure         | Confirmed pressure, **not proven permanent leakage**. Natural 512² soak peaks at 1,035.8 MiB process-tree RSS, then falls to 384.1 MiB without forced GC. Controlled pause reduces 992.2 to 340.7 MiB within 15 seconds. Open allocation investigation.                                                   |
| A05 | P2               | Resize drops incompatible texture publication surfaces without explicit zeroing | Confirmed release-policy gap. 600 frames with 29 resolution changes allocate 61 canvases, zero 3, and leave 58 additional nonzero observed retired surfaces. Strong observer references deliberately prevent collection; this is not proof of retained native bytes. Open.                                |
| A06 | P2               | Legacy render-layer surface disposal relies on collection                       | Confirmed contract gap. Each successful legacy diffusion cycle observes two new canvases: raster surface zeroed; controller-owned 256×160 surface remains sized. ImageBitmap transfer may already release/reset its backing store, so unreclaimed bytes are unproven. Open.                               |
| A07 | P2               | Heavy ordinary rendering and physics have high local flush cost                 | Measured: 10k changing positioned rectangles 118.8 ms median; 1k moving bodies 30.5 ms; 50k particles 33.8 ms; 4×512² diffusion 33.8 ms. Separate physics counter pass observes ~387 kB of typed-array slices/frame. Open optimization work, not a claim that these arbitrary loads are promised budgets. |
| A08 | P2               | Three picking generation snapshots copy unique geometry                         | Confirmed structural cost and fresh benchmark: 128 unique spheres copy 11,833,344 geometry bytes/snapshot, 5.65 ms median; sharing one sphere geometry reduces this to 92,448 bytes and 0.77 ms. Preserve generation isolation in any optimization. Open.                                                 |
| A09 | P3               | Particle dynamic-color cache can accumulate distinct colors                     | Source-supported risk: packed RGB keys are kept until executor disposal. No fresh adversarial dynamic-color growth experiment, so not classified as a reproduced normal-path leak. Follow-up.                                                                                                             |
| A10 | P3               | Recipe palette LUT rebuilt per raster                                           | Source-supported bounded allocation opportunity (1 KiB LUT), unlike cached legacy LUT. Not a leak; prioritize after lifecycle and large costs.                                                                                                                                                            |
| A11 | P1               | A stale public Texture retains its disposed root and canvas                     | Confirmed JS reachability. Both survive forced GC with only the stale Texture retained, then collect after that handle is dropped. Normal disposal removes scheduler work but leaves the owner graph reachable. Open.                                                                                     |

### A01: initial publication ownership hole

`packages/core/src/lib/textures/texture.ts:188-198` catches failure in `definition.create`, but calls `publishInitial()` outside that cleanup catch. The `useTexture` hook adds its teardown only after construction succeeds (`397-410`). The diffusion recipe requests a frame during creation, before the first publication. A raster failure therefore loses the resource before hook ownership is registered while its scheduler participant remains live.

The invalid one-color palette also leaves one participant immediately after failure/disposal. Only the injected upload case was followed for eight frames; do not infer identical indefinite behavior for the invalid palette. The isolated probe's failed scheduler-driver restore is diagnostic fallout from outstanding work, not a separate production defect. Fix initialization transaction ownership first, then prove all failure stages release scheduling, simulation, and canvas resources.

### A11: stale public Texture retains the disposed owner

The corrected WeakRef probe observes the actual root element and detached canvas, verifies both are reachable before disposal, and verifies that the component ran and retained the expected Texture. With the handle dropped, both collect after disposal/forced GC. With the public Texture retained, both remain reachable; clearing that handle and collecting again releases both. This isolates a public handle → Resource → owner CRCInstance ownership path. Scheduler counters are zero in both cases: idle scheduling does not imply release of the old object graph.

Evidence: `results/weak-retention-2026-10-03T19-36-06.413Z.json`; final weak harness commit `82cb7b75`. Do not infer native/GPU bytes from WeakRef reachability. Preserve the documented behavior of stale capabilities while severing unnecessary owner/root/canvas references on disposal. Earlier negative weak results lacked sufficient render/handle/reachability controls and are rejected.

### A02: physics retention

`packages/physics/src/lib/2d/runtime/controller.ts:194-201,565-584,1317-1341` stores materialized handles by generation. Disposal unbinds them but does not clear the maps. Keeping a public world/handle alive can retain the controller and its historical caches. The probe deliberately holds the controller for structural inspection; it proves map growth and disposal behavior, not native Rapier memory retention. Eviction/clearing must preserve stale-handle semantics.

### A03: work-based backpressure

The burst probe uses the public 128×80 recipe and a fixed input queue. 1,024 radius-128 paint messages cost 18.3 ms to drain; the larger stir burst costs nearly a second. Enqueuing is cheap (0.6 and 5.6 ms respectively); synchronous drain work is the problem. Reset coalescing, bounded input work, or safe incremental processing need an explicit ordering/semantics contract, not silent dropped input.

### A04–A06: distinguish retention from allocation pressure

The natural soak does not hold canvases for inspection and performs no forced GC while active. In a separate scalar-counter probe, active 512² diffusion holds construction counts fixed at **three OffscreenCanvases, one ImageData, one 6,684,672-byte WASM memory** while creating roughly 120 CanvasPatterns/second. RSS still swings sharply. This points toward rendering/allocation pressure rather than continuous simulation-field allocation; it does not identify one responsible browser allocation.

A CRC-free Canvas control also shows a large sawtooth RSS trajectory on a pattern-rendering path (2,126.9 → 3,992.6 → 798.4 → 2,661.0 MiB at 15-second intervals). It is exploratory: pattern and drawImage ran sequentially in the same browser, without independent startup baselines or randomized order. Do not use their absolute RSS difference as a causal comparison. See the raw control and limitations below.

A05 (`texture.ts:270-277,317-324`) and A06 (`render-layer/controller.ts`, owned canvas allocation and disposal) violate the intended deterministic release approach independently of this steady-state pressure. A single unchanged-resolution mount cannot be explained by a resize-only defect. Fix explicit ownership without pretending it proves all browser pressure resolved.

## Performance matrix

Twenty warmup iterations preceded measured iterations; each case used a fresh page. All normal cases ended with zero roots, participants, callbacks, and pending host frames. The copy-counter case is excluded from timing comparisons.

| Workload                                          | Samples | Median ms | p95 ms | Worst ms |
| ------------------------------------------------- | ------: | --------: | -----: | -------: |
| rectangles 1000                                   |     120 |     10.80 |  12.10 |    13.40 |
| rectangles 10000                                  |     120 |    118.80 | 125.30 |   129.50 |
| rectangles 50000                                  |      30 |    680.10 | 750.70 |   784.60 |
| isolation 10000 static + moving sibling (Group)   |     120 |    123.90 | 129.20 |   131.00 |
| isolation 10000 static + moving sibling (Layer)   |     120 |      3.90 |   4.20 |     5.30 |
| diffusion 1 × 128²                                |     120 |      0.60 |   0.70 |     1.00 |
| diffusion 1 × 256²                                |     120 |      2.10 |   2.40 |     2.70 |
| diffusion 1 × 512²                                |     120 |      8.50 |   9.20 |    10.20 |
| diffusion 4 × 128²                                |     120 |      2.20 |   2.50 |     2.80 |
| diffusion 4 × 256²                                |     120 |      8.50 |   9.00 |    10.10 |
| diffusion 4 × 512²                                |     120 |     33.80 |  35.70 |    37.00 |
| particles 1000                                    |     120 |      0.40 |   0.50 |     0.60 |
| particles 10000                                   |     120 |      3.70 |   3.90 |     4.30 |
| particles 50000                                   |     120 |     33.80 |  35.50 |    37.00 |
| physics 32                                        |     180 |      1.10 |   1.60 |     3.00 |
| physics 256                                       |     180 |      7.80 |   9.60 |    10.70 |
| physics 1000                                      |     180 |     30.50 |  33.80 |    36.50 |
| physics 1000 sleeping enabled, active frames only |      14 |     29.40 |  32.00 |    32.00 |
| physics 256 initially overlapping                 |     180 |      8.40 |  11.50 |    15.20 |

The sleeping-physics case has 14 measured active frames and 226 idle iterations; its table entry is **not** the steady sleeping cost. The 10k static-content comparison demonstrates expected Layer isolation for this workload, not a universal speedup. Controlled same-value probe: a changed value first proves the component subscription schedules work; after flushing, 10,000 equal writes schedule zero frames (`results/same-value-controlled.json`).

Corrected active-root probe (20 warmups, 60 samples each, explicit component reads and supported `left` placement):

| Active roots | Median ms | p95 ms | Worst ms |
| ------------ | --------: | -----: | -------: |
| 1            |      0.00 |   0.10 |     0.30 |
| 32           |      0.70 |   1.00 |     1.10 |
| 128          |      3.10 |   3.60 |     5.30 |
| 512          |     12.40 |  14.90 |    19.70 |
| 1024         |     24.70 |  33.60 |    39.40 |

Every measured iteration asserts an actual flush, and disposal balances all root registrations. This includes component/render work and cannot isolate or prove scheduler algorithmic complexity.

The separate 1,000-body copy probe measured 10,681 typed-array `.slice()` calls and 23,220,256 bytes across 60 frames (~178 calls, 387,004 bytes/frame). This does not count every allocation or establish which caller dominates without further profiling.

Three picking uses the existing Node benchmark, five warmups and 30 samples; it measures snapshot construction, not a complete GPU frame:

| Scene              | Geometry bytes/snapshot | Median ms | p95 ms |
| ------------------ | ----------------------: | --------: | -----: |
| 1,024 shared boxes |                     840 |      6.52 |   9.14 |
| 1,024 unique boxes |                 860,160 |     11.68 |  14.84 |
| 128 shared spheres |                  92,448 |      0.77 |   1.19 |
| 128 unique spheres |              11,833,344 |      5.65 |   8.46 |

## Natural endurance and memory

Twenty minutes total, 144,716 scheduler frames including final interval/disposal accounting. No page errors; all three scenes reach zero scheduler ownership after disposal. Duration statistics are ranges across 30-second windows, using a bounded 4,096-entry ring (the raw metadata calls it a reservoir; it is a ring). Scene screenshot evidence is in `results/natural/`.

| Scene         | Duration | Window median ms | Window p95 ms | Worst ms | Browser-tree RSS MiB first → peak → last |
| ------------- | -------: | ---------------: | ------------: | -------: | ---------------------------------------- |
| Living Ink    |    600 s |          1.1–1.5 |       1.4–1.9 |     25.4 | 395.0 → 409.5 → 409.5                    |
| Stirred Ink   |    300 s |          2.7–2.9 |       2.9–3.3 |     23.5 | 603.1 → 637.8 → 635.0                    |
| Isolated 512² |    300 s |          4.3–4.5 |       4.8–5.6 |     12.0 | 447.7 → 1,035.8 → 456.2                  |

512² falls naturally to 384.1 MiB at 270 seconds, after its 240-second peak. JS heap ranges are 7.29–15.46, 19.94–37.96, and 5.78–9.46 MiB respectively. Natural scheduling and synthetic 60 Hz flush timings are different workloads and should not be mixed into a before/after comparison.

Separate active/pause/resume probe: RSS peaks at 1,078.4 MiB; 992.2 MiB at 180 seconds active falls to 340.7 after 15 seconds paused without forced GC. A later explicit GC leaves ~340.8 MiB. Resuming brings back large swings; after disposal plus explicit GC RSS is ~330.8 MiB. Forced-GC observations are diagnostic and are not natural endurance evidence.

RSS is a sum over the owned Chromium process tree. Shared pages may be counted multiple times; it includes browser overhead, allocator reserves and renderer processes, and is **not** exact native/GPU or WASM-live-byte accounting. No t=0 RSS baseline was recorded for the natural/pressure probes. No claim about Safari, Firefox, low-memory devices, multi-hour behavior, or every failure path is made.

## Lifecycle and historical findings

- Corrected instrumentation runs 1,000 legacy and 1,000 recipe mount/dispose cycles. Legacy simulation/raster disposal counts each increase by 1,000. Recipe simulation disposals increase by 1,000; renderer consumers and signal edges are balanced. Normal paths leave no scheduler ownership.
- Recipe shared paint consumers and resize/reset churn use the supported public API. The observer deliberately retains canvases to inspect dimension-zero release. Its cumulative allocation totals and heap cannot be interpreted as leaked live memory.
- Old animation history cost does not reproduce: fresh deterministic probes at 1, 60, 300, and 600 seconds have medians below the timer's 0.1 ms resolution; p95 is 0–0.1 ms. Current main already contains the interval-history change. These are accelerated logical-age probes, not natural ten-minute playback tests.
- The old per-frame Water ImageData claim is superseded by current WaveField caching (source inspection only in this audit).
- Initial multi-root cases recorded zero frames and are invalid as timing/scaling evidence. They only demonstrate registration cleanup. An initial follow-up also recorded zero frames and is rejected. The final supported-positioning/component-read rerun asserts 60 active frames for every root count and is reported above. The intermediate `roots-active` probe still used obsolete positioning and is not authoritative.
- No runtime before/after fix comparison exists: this audit establishes the current baseline and workload contrasts. None of the open issues is marked fixed, merged, or pushed.

## Review reconciliation

One implementation subagent authored the diffusion probes; an independent reviewer examined source contracts, harnesses and results. The orchestrator independently ran the natural soak, pause/resume, broad matrix, and Three benchmark and adjudicated findings.

| Review finding                                                    | Resolution                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repeated mount calls are not a valid resize fixture               | Fixed harness to use signals and public updates.                                                                                                                                                                                                    |
| Timing idle iterations can manufacture cheap frame results        | Measure actual flushes after warmup; zero samples mean idle, not zero-cost frames.                                                                                                                                                                  |
| Double-slash Vite paths duplicate private modules                 | Fixed in `5d2887d`; reran with canonical imports and successful-disposal positive controls. Earlier results are invalid for private class/graph counters.                                                                                           |
| Strong canvas observer prevents collection                        | Explicitly restrict its claim to dimensions/counters; memory soaks are separate unretained runs.                                                                                                                                                    |
| Initial failure prevents driver restore                           | Capture the failure state and expected restore error; isolate the page and never forcibly clear scheduler state to hide it.                                                                                                                         |
| Concurrent result writes race                                     | Changed harness to incremental observations and awaited final write; only corrected complete runs are authoritative.                                                                                                                                |
| Multi-root timing measured no work                                | Reject original and first follow-up timings; final explicit component reads, supported positioning and active-frame assertions pass.                                                                                                                |
| Rectangle benchmarks used obsolete `x`/`y` style fields           | Orchestrator caught the unsupported geometry; changed to `left`/`top` and reran all rectangle/isolation/root cases. Earlier geometry/timing interpretation rejected. Final Group/Layer medians are 123.9/3.9 ms, replacing provisional 38.7/4.0 ms. |
| Physics churn might not actually remove objects                   | Bound idle flushing and assert public stale handle disabled before inspecting map counts.                                                                                                                                                           |
| Canvas control is not a randomized independent-browser comparison | Treat as exploratory within-path trajectory only.                                                                                                                                                                                                   |
| WeakRef sentinel lacked positive controls                         | Fixed with actual root/canvas WeakRefs, render/handle assertions, detached-canvas control, pre-disposal reachability, and collection after dropping the stale handle. Final probe confirms A11.                                                     |
| RSS does not prove allocation ownership                           | Report pressure, natural drops, construction counts, and attribution limitations separately.                                                                                                                                                        |

## Verification, reproducibility, and evidence

Production files remain exactly at the baseline. Package builds passed. Fresh focused verification passed **6 files / 35 tests**: texture lifecycle, reaction diffusion, WASM runtime, core texture paint/publication, and animation performance. Command and complete output are in `results/focused-tests.txt`; these happy-path tests did not prevent the newly reproduced failure/retention defects. The pristine baseline aggregate `corepack pnpm@11.21.0 trust` is **blocked** in documentation classification by 12 existing `docs/website-rebuild/*.md` files; see `results/pristine-main-trust.log`. This is not a passed release gate. No unrelated documentation or visual baselines were rewritten.

From a provisioned checkout of the baseline, build packages and start source-mode playground Vite on the indicated port. Exact machine-local natural/control probes are archived as `.mjs.txt` under `probes/`; adjust their workspace paths when reproducing. Public smoke and source identity checks are part of the probes. Main commands (all under Node 24.15.0):

```sh
corepack pnpm@11.21.0 build
corepack pnpm@11.21.0 -C playground exec vite --host 127.0.0.1 --port 5203
# Run the following in another shell; use port 5204 for the author workspace.
node tooling/performance-audit/run-browser.mjs --base-url http://127.0.0.1:5204 --cycles 1000 --frames 600
node tooling/performance-audit/weak-retention.mjs http://127.0.0.1:5204
node tooling/performance-audit/broad.mjs
node --import tsx tooling/agent-verification/benchmark-three-picking.mjs /tmp/crc-three-audit
```

Authoritative ownership evidence: `results/2026-10-03T19-24-30.094Z.json`, supported by the shorter corrected run `19-24-05.678Z`. Natural and scalar-counter evidence: `results/natural/`. Uninstrumented diffusion/particle/physics matrix: `results/broad.json`. Its rectangle/isolation/root entries are superseded by `results/rendering-corrected.json`; old geometry was invalid. Same-value positive control: `results/same-value-controlled.json`. Three benchmark: `results/three/report.json`. `evidence-manifest.json` hashes archived evidence and exact probes.

Earlier `19-21-16.278Z` and `19-22-11.930Z` results use duplicated private modules and must not support disposal/graph claims. Partial JSONL files and startup failures are preserved as diagnostic history, not successful evidence. The first natural launch failed because package declarations were not built; it produced no usable performance measurements, then the build and fresh run succeeded.

The focused test command was:

```sh
corepack pnpm@11.21.0 exec vitest run packages/textures/test/lifecycle.test.tsx packages/textures/test/reaction-diffusion.test.tsx packages/textures/test/wasm-runtime.test.tsx packages/core/test/texture-paint.test.tsx packages/core/test/texture-transparent-publication.test.tsx packages/core/test/animation-performance.test.ts --browser.headless --browser.ui=false --maxWorkers=1
```

## Next implementation order

1. A01 initialization rollback and scheduler ownership, plus A11 stale-handle owner release, including real recipe faults before/after frame registration and publication.
2. A02 bounded handle-cache ownership with stale-handle semantic tests.
3. A05/A06 explicit surface release; profile A04 with independent browser baselines and allocation tracing, then verify natural low-memory endurance.
4. A03 bounded input processing with explicit ordering semantics.
5. Profile A07 end-to-end render/physics costs and A08 snapshot copies; retain public behavior and generation-safe picking. Re-measure each isolated optimization against this exact workload.
6. Add deterministic failure/ownership/work-count regression coverage; keep wall-clock guards opt-in on controlled hosts. Finish with a passing aggregate gate once the unrelated baseline classification blocker is resolved.
