# Repeating animation history grows with elapsed time

> **Historical status: Dated audit evidence and remediation proposals; current behavior is defined by runtime contracts.**

Issue: CRC-PERF-01  
Priority: P1  
Status: Open  
Evidence date: 2026-10-02  
Classification: Confirmed progressive slowdown

## Problem

crossedMilestones collects timeline events from zero to the current horizon. Repeat traversal starts at iteration zero. Deduplication uses filter with findIndex over the accumulated timeline before selecting the newly crossed interval. Collection grows with history and deduplication is quadratic in collected events.

## Evidence and limits

The actual 160 ms particle emission program took median 0.1 ms at age 1 second, 6.6 ms at 60 seconds, 75.7 ms at 300 seconds, and 303.1 ms at 600 seconds in an isolated evaluator probe. The latter three evaluations delivered only two milestones. The live particle example also became progressively slower over 60 seconds. Stirred Ink uses a longer repeat and measured only about 0.3 ms at 600 seconds; this does not establish its reported crash cause.

See the [audit evidence](../evidence/followup-results.json) and [shared environment and limitations](../README.md). Findings describe the reviewed working tree, not necessarily current main. Revalidate against the integration baseline before changing code.

## Relevant code

- [packages/core/src/lib/animation/evaluate.ts](../../../../../packages/core/src/lib/animation/evaluate.ts)
- [packages/scenarios/src/learning/composition/particle-effects.example.tsx](../../../../../packages/scenarios/src/learning/composition/particle-effects.example.tsx)
- [packages/scenarios/src/learning/composition/stirred-ink.example.tsx](../../../../../packages/scenarios/src/learning/composition/stirred-ink.example.tsx)

## Reproduction

Evaluate the same repeating program over one approximately 16.667 ms interval at progressively later times. First reproduce through usePlayback and a public scenario; use the private evaluator probe only to isolate complexity.

## Implementation direction

- Traverse the newly crossed interval and calculate relevant repeat iteration bounds arithmetically where duration permits.
- Deduplicate while collecting with a collision-safe identity key; avoid nested historical scans.
- Preserve forward/reverse boundary rules, nested and alternate repeats, source order, zero-duration safeguards, seeks, and stepper semantics.

## Acceptance criteria

- [ ] A focused regression fails before the fix and shows bounded visits for equal-width intervals at late program ages.
- [ ] Public playback delivers the same exact markers and iteration events, including nested/reverse/boundary cases.
- [ ] A sustained particle example has no elapsed-history CPU growth attributable to milestone traversal.
- [ ] Retained activation state is bounded; no replacement cache merely retains all historical events.

## Dependencies and boundaries

No prerequisites. Review alongside animation contracts. Do not rewrite animation sampling wholesale.

## Completion record

Record the baseline and final commit, focused failing and passing checks, exact commands and environment, scenario URL and manual observations where applicable, independent review findings and their dispositions, reconciliation results, integration tests, merge commit, and verified remote main SHA. A code change alone does not close this issue.
