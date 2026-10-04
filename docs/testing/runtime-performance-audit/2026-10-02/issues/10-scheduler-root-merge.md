# Scheduler job merging performs repeated root searches

Issue: CRC-PERF-10  
Priority: P2  
Status: Open  
Evidence date: 2026-10-02  
Classification: Code-supported algorithmic opportunity

## Problem

mergeRootJobs iterates registered roots and uses initial.find for each one. When many roots have initial jobs, lookup work is quadratic in root count. This was not established as a bottleneck in the single-root examples.

## Evidence and limits

Source inspection identifies the repeated linear search. The audit did not benchmark a many-root scaling curve; that measurement is part of this issue.

See the [audit evidence](../evidence/tests.log) and [shared environment and limitations](../README.md). Findings describe the reviewed working tree, not necessarily current main. Revalidate against the integration baseline before changing code.

## Relevant code

- [packages/core/src/lib/scheduler/realm-scheduler.ts](../../../../../packages/core/src/lib/scheduler/realm-scheduler.ts)

## Reproduction

Mount increasing numbers of public CRC roots, dirty them together through signals, and measure job-lookup counts and scheduled work. Also test many idle roots with a small dirty subset.

## Implementation direction

- Index initial jobs by root once and retain stable registration order.
- Avoid introducing new retained registries or changing frame admission/defer rules.
- Keep nested Layer ordering and failure isolation intact.

## Acceptance criteria

- [ ] Lookup work grows linearly in relevant roots/jobs rather than quadratically.
- [ ] Multiple roots still share at most one pending host frame and coalesce writes correctly.
- [ ] Root replacement, nested layers, teardown during a frame, and errors preserve existing ordering and semantics.

## Dependencies and boundaries

Independent of subsystem fixes, but serialize with scheduler instrumentation in 12 if touching the same functions.

## Completion record

Record the baseline and final commit, focused failing and passing checks, exact commands and environment, scenario URL and manual observations where applicable, independent review findings and their dispositions, reconciliation results, integration tests, merge commit, and verified remote main SHA. A code change alone does not close this issue.
