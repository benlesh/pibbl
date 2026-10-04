# Particle color string caching lacks an explicit size bound

> **Historical status: Dated audit evidence and remediation proposals; current behavior is defined by runtime contracts.**

Issue: CRC-PERF-09  
Priority: P2  
Status: Open  
Evidence date: 2026-10-02  
Classification: Code-supported retention risk under changing spawn colors

## Problem

The executor keeps a Map from packed RGB values to CSS strings without eviction. Continuously changing spawn-time color parameters can accumulate historical entries. Common compiled gradients are quantized to 257 samples, so ordinary gradient use is not itself unbounded.

## Evidence and limits

This was identified by source inspection. The audit did not reproduce unbounded growth in the bundled particle example. Its measured progressive slowdown was traced instead to issue 01.

See the [audit evidence](../evidence/soak-results.json) and [shared environment and limitations](../README.md). Findings describe the reviewed working tree, not necessarily current main. Revalidate against the integration baseline before changing code.

## Relevant code

- [packages/core/src/features/particles/lib/canvas/executor.ts](../../../../../packages/core/src/features/particles/lib/canvas/executor.ts)
- [packages/core/src/features/particles/lib/curve.ts](../../../../../packages/core/src/features/particles/lib/curve.ts)

## Reproduction

Use a long-lived public particle system with bounded live capacity and repeatedly vary supported spawn color parameters across epochs. Count color-cache entries independently of live particle count.

## Implementation direction

- Prefer precompiled strings for finite sampled palettes; use a bounded cache for dynamic colors if measurements justify caching.
- Preserve color/alpha/blend output and avoid moving allocations into a more expensive hot path.
- Release cache ownership at executor disposal.

## Acceptance criteria

- [ ] A changing-color stress test cannot grow retained cache entries with historical color count beyond the chosen bound.
- [ ] Common finite gradients retain efficient lookup and identical rendering.
- [ ] No retained parameter-epoch or particle-generation regression is introduced.

## Dependencies and boundaries

Independent. Do not present the animation slowdown as evidence for this cache risk.

## Completion record

Record the baseline and final commit, focused failing and passing checks, exact commands and environment, scenario URL and manual observations where applicable, independent review findings and their dispositions, reconciliation results, integration tests, merge commit, and verified remote main SHA. A code change alone does not close this issue.
