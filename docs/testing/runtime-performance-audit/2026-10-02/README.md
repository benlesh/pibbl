# CRC runtime performance audit

This queue records the 2026-10-02 review and provides separately actionable issues for automated remediation. It is a review backlog, not a claim that all proposed optimizations are confirmed defects. No runtime fixes were made during the audit or while creating these documents.

The strongest confirmed progressive slowdown is repeated animation milestone reconstruction. Two separate probes confirmed orphaned texture scheduling after initialization failure and retained physics handles after body removal. Passive Living Ink did not crash during the three-minute test.

## Issue queue

| Issue       | Priority | Document                                                                                                     | Status |
| ----------- | -------- | ------------------------------------------------------------------------------------------------------------ | ------ |
| CRC-PERF-01 | P1       | [Repeating animation history grows with elapsed time](issues/01-animation-history.md)                        | Open   |
| CRC-PERF-02 | P1       | [Texture initialization failure leaves orphaned scheduled work](issues/02-texture-initialization.md)         | Open   |
| CRC-PERF-03 | P1       | [Physics retains handles for retired body generations](issues/03-physics-handles.md)                         | Open   |
| CRC-PERF-04 | P1       | [Physics updates copy and rebuild whole world state](issues/04-physics-update-cost.md)                       | Open   |
| CRC-PERF-05 | P1       | [Three picking clones static geometry every rendered generation](issues/05-three-picking.md)                 | Open   |
| CRC-PERF-06 | P2       | [Texture paint bursts block a frame or overflow the queue](issues/06-texture-backpressure.md)                | Open   |
| CRC-PERF-07 | P2       | [Water wave rasterization allocates and recomputes avoidable work](issues/07-water-raster.md)                | Open   |
| CRC-PERF-08 | P2       | [Texture resizing leaves obsolete publication surfaces to garbage collection](issues/08-texture-surfaces.md) | Open   |
| CRC-PERF-09 | P2       | [Particle color string caching lacks an explicit size bound](issues/09-particle-color-cache.md)              | Open   |
| CRC-PERF-10 | P2       | [Scheduler job merging performs repeated root searches](issues/10-scheduler-root-merge.md)                   | Open   |
| CRC-PERF-11 | P3       | [Separate runtime responsibilities around measured hot paths](issues/11-runtime-organization.md)             | Open   |
| CRC-PERF-12 | P2       | [Expose bounded explanations of runtime work and ownership](issues/12-agent-observability.md)                | Open   |
| CRC-PERF-13 | P2       | [Make long duration and overload regressions repeatable](issues/13-stress-regressions.md)                    | Open   |

## Automation entry point

Use [the orchestration prompt](AUTOMATION-PROMPT.md). It specifies isolated managed worktrees, implementation and independent review agents, reconciliation, exact-commit verification, serialized integration, and per-issue commits, merges, and pushes. The prompt is for a future execution run; creating it does not start that run.

This backlog does not replace the active HtmlBox plan. On execution, explicitly select this user-authorized remediation queue as the task scope, while preserving any unrelated active plan and its work.

## Baseline prerequisite

The reviewed checkout was on `codex/physics-2d-quality` with extensive existing tracked and untracked changes, including package consolidation and HTML integration. Some reviewed feature paths existed only in that working tree. The configured origin was `https://github.com/benlesh/crc.git`.

A worktree created from main does not inherit those changes. Before implementation, establish a committed baseline containing the applicable runtime and this issue queue. Do not sweep unrelated work into a commit, reset it, or silently test a different code layout. Coordinate with its owners or report a precise prerequisite if it has not yet been integrated. The evidence manifest records HEAD and file fingerprints but is not a reconstructable snapshot of the entire dirty checkout.

## Environment and interpretation

Measurements used macOS ARM64 on Apple M5 Max, 128 GiB RAM, Node 26.9.0, pnpm 11.21.0, and Playwright Chromium 151.0.7922.34 in source mode. Node differed from the repository requirement of Node 24.15 or newer on Node 24 LTS. Future verification should use the supported environment and record it.

The six-example real-time soak covered 49,327 scheduler frames over 8.5 minutes: Living Ink 180 seconds, Stirred Ink 90 seconds, and Physics 2D, Physics Panels, Particle Effects, and Underwater 60 seconds each. It reported no page errors. Normal disposal returned observed scheduler ownership to zero. The sampled root/hook-reference/paint-entry counts stayed stable; this does not establish a native or GPU-memory plateau. The soak forced GC every 15 seconds and collected coarse JS heap readings, so it is not an unforced-GC endurance test.

Synthetic public-API workloads covered same-value signal writes, 1,000 to 50,000 rectangles, Group versus Layer isolation, one/four diffusion textures, 1,000 to 50,000 particles, 32 to 1,000 physics bodies, native filters, paint bursts, and initialization failure. A later probe disabled physics sleeping to measure sustained work. The initial filter fixture used invalid blur syntax; the corrected fixture is in followup-results.json. Do not treat that initial fixture error as a CRC bug. At 300 simulated seconds, all 199 sampled successive diffusion images still changed; ongoing rendering was not demonstrated to be redundant.

Timings are descriptive local scheduler/evaluator costs, not end-to-end presentation latency or portable budgets. Three snapshot results are from Node and exclude rendering/GPU work. Browser screenshots were inspected during the audit but are not required regression baselines. Safari, Firefox, mobile, production bundles, and hours-long native-memory behavior were not audited. No aggregate trust pass was claimed.

Fresh test runs: 40 passed in the first focused group; 74 texture tests passed in a second group; 128 passed and four opt-in timing/profiling tests skipped in the final group. Groups overlap, so do not sum them as a unique test total. Baseline logs are archived where available; the texture run result was returned by the review agent and its raw log was not retained here.

## Evidence

[Evidence index](evidence/README.md) includes raw measurements, original probes, logs, and fingerprints. Reproduce findings before implementation; source line numbers and machine timings are historical clues, not immutable contracts.

## Completion policy

Each issue owns a focused public-API regression and its completion record. Issue 13 adds the integrated stress matrix, rather than postponing the earlier tests. Confirmed defects need failing-before and passing-after evidence. Risk/optimization issues may be closed as already resolved or not reproduced only with explicit evidence and reconciled independent review. Do not invent changes or passing results to satisfy a queue item.
