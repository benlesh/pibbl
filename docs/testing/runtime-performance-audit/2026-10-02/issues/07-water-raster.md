# Water wave rasterization allocates and recomputes avoidable work

> **Historical status: Dated audit evidence and remediation proposals; current behavior is defined by runtime contracts.**

Issue: Pibbl-PERF-07  
Priority: P2  
Status: Open  
Evidence date: 2026-10-02  
Classification: Confirmed allocation pattern with composite cost evidence

## Problem

Every rasterization creates a fresh ImageData and recomputes per-pixel invariant terms alongside trigonometric wave and ripple calculations. At the maximum texture area, the RGBA buffer alone is about 1 MiB per frame.

## Evidence and limits

The composed Underwater example measured median 8.7 ms, p95 9.2 ms, and maximum 90.8 ms over 60 seconds. This includes displacement and composition; the audit did not isolate water raster time or attribute the worst frame to allocation.

See the [audit evidence](../evidence/soak-results.json) and [shared environment and limitations](../README.md). Findings describe the reviewed working tree, not necessarily current main. Revalidate against the integration baseline before changing code.

## Relevant code

- [packages/core/src/features/textures/lib/water-waves.ts](../../../../../packages/core/src/features/textures/lib/water-waves.ts)
- [packages/scenarios/src/learning/composition/underwater.example.tsx](../../../../../packages/scenarios/src/learning/composition/underwater.example.tsx)

## Reproduction

Compare isolated waterWaves raster work with the full Underwater example across resolutions, ripple counts, pause, and speed zero. Count ImageData allocations and separately time wave evaluation and composition.

## Implementation direction

- Reuse ImageData at stable resolution and rebuild only when necessary.
- Precompute invariant coordinate/mode terms where that reduces total work without excessive retained storage.
- Profile before selecting recurrence, table, SIMD/WASM, or other numerical optimizations; preserve required output tolerances.

## Acceptance criteria

- [ ] No fresh full-size ImageData allocation per steady-state frame.
- [ ] Pause and speed-zero/ripple behavior remain correct and idle when appropriate.
- [ ] Stable ownership across resizing/disposal; bounded ripple state.
- [ ] Isolated and composite results identify which costs improved; visual differences are reviewed rather than blindly rebaselined.

## Dependencies and boundaries

Can proceed independently of texture.ts changes if it only changes the recipe implementation.

## Completion record

Record the baseline and final commit, focused failing and passing checks, exact commands and environment, scenario URL and manual observations where applicable, independent review findings and their dispositions, reconciliation results, integration tests, merge commit, and verified remote main SHA. A code change alone does not close this issue.
