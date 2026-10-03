# Separate runtime responsibilities around measured hot paths

Issue: CRC-PERF-11  
Priority: P3  
Status: Open  
Evidence date: 2026-10-02  
Classification: Maintainability work supporting the confirmed fixes

## Problem

Animation sampling and historical milestone traversal are intertwined, while physics topology reconciliation, per-frame state publication, engine synchronization, and ownership live in large controllers. This makes complexity and resource budgets harder to review independently.

## Evidence and limits

The audit found distinct performance and ownership defects in these responsibilities. File size alone is not a defect, and a broad rewrite was not justified.

See the [audit evidence](../evidence/README.md) and [shared environment and limitations](../README.md). Findings describe the reviewed working tree, not necessarily current main. Revalidate against the integration baseline before changing code.

## Relevant code

- [packages/core/src/lib/animation/evaluate.ts](../../../../../packages/core/src/lib/animation/evaluate.ts)
- [packages/core/src/features/physics/lib/2d/runtime/controller.ts](../../../../../packages/core/src/features/physics/lib/2d/runtime/controller.ts)
- [packages/core/src/features/physics/lib/2d/world/rapier.ts](../../../../../packages/core/src/features/physics/lib/2d/world/rapier.ts)

## Reproduction

After the functional fixes, inspect the resulting dependency boundaries and identify only concrete remaining coupling that prevents focused tests or ownership reasoning.

## Implementation direction

- Separate milestone interval traversal from value sampling where issue 01 requires it.
- Separate topology/configuration changes from per-frame simulation/publication where issue 04 requires it.
- Prefer small coherent extractions and explicit ownership; avoid speculative abstractions or new public surface.

## Acceptance criteria

- [ ] Any refactor has a specific testability, ownership, or measured-performance rationale.
- [ ] Public behavior, module inertness, package boundaries, and hot-path allocation are unchanged or improved.
- [ ] If prior fixes already establish the needed boundaries, close this issue with evidence and references instead of a redundant refactor.

## Dependencies and boundaries

After 01 and 04. Do not independently refactor their files while fixes are in flight.

## Completion record

Record the baseline and final commit, focused failing and passing checks, exact commands and environment, scenario URL and manual observations where applicable, independent review findings and their dispositions, reconciliation results, integration tests, merge commit, and verified remote main SHA. A code change alone does not close this issue.
