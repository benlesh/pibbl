# Make long duration and overload regressions repeatable

> **Historical status: Dated audit evidence and remediation proposals; current behavior is defined by runtime contracts.**

Issue: Pibbl-PERF-13  
Priority: P2  
Status: Open  
Evidence date: 2026-10-02  
Classification: Verification gap and automation hardening

## Problem

Existing performance and lifecycle tests passed while progressive animation work, orphaned texture scheduling, and historical physics handle retention remained reproducible. Short or capacity-only checks do not establish sustained bounded work.

## Evidence and limits

Fresh audit runs reported 40 passing tests, 74 texture tests, and 128 additional passing tests with four opt-in profiling/timing skips. Some suites overlap; these are run counts, not a unique aggregate test total. Six examples ran for 8.5 minutes; the longest natural-time example was only three minutes and periodic forced GC was used.

See the [audit evidence](../evidence/README.md) and [shared environment and limitations](../README.md). Findings describe the reviewed working tree, not necessarily current main. Revalidate against the integration baseline before changing code.

## Relevant code

- [packages/core/test/animation-performance.test.ts](../../../../../packages/core/test/animation-performance.test.ts)
- [packages/core/test/physics-2d-performance.test.tsx](../../../../../packages/core/test/physics-2d-performance.test.tsx)
- [packages/core/test/particle-performance.test.ts](../../../../../packages/core/test/particle-performance.test.ts)
- [packages/core/test/features/textures/performance.test.tsx](../../../../../packages/core/test/features/textures/performance.test.tsx)
- [tooling/agent-verification/benchmark-three-picking.mjs](../../../../../tooling/agent-verification/benchmark-three-picking.mjs)

## Reproduction

Turn the focused public reproducers from each issue into repeatable test-lab scenarios and a controlled stress runner. Include both deterministic accelerated time and separately labeled real-time browser soaks.

## Implementation direction

- Use semantic state/geometry, exact ownership, and structural operation counts as portable correctness gates.
- Keep wall-clock thresholds opt-in on a documented reference environment; record median, p95, worst frame, warmup, workload, and browser/runtime identity.
- Cover isolated features, composed examples, deliberate overload, pause/idle/wake, resize, mount/dispose churn, failures, and rollback.
- Use bounded instrumentation, parent timeouts, partial evidence on failure, and exact child-process cleanup. Keep stress fixtures out of public example search.

## Acceptance criteria

- [ ] Each confirmed issue has a regression that fails on its pre-fix baseline and passes after its fix.
- [ ] The repeatable matrix includes unforced-GC soaks as well as forced-GC retention probes; neither is mislabeled as native/GPU memory proof.
- [ ] Evidence records skips, unsupported configurations, and machine-sensitive results honestly.
- [ ] A final integrated trust run and stress matrix are tied to the exact candidate commit and environment.

## Dependencies and boundaries

Each issue owns its focused regression immediately; finish aggregate runner/matrix after subsystem integrations. Do not defer all tests until this issue.

## Completion record

Record the baseline and final commit, focused failing and passing checks, exact commands and environment, scenario URL and manual observations where applicable, independent review findings and their dispositions, reconciliation results, integration tests, merge commit, and verified remote main SHA. A code change alone does not close this issue.
