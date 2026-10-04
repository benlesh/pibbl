# Physics retains handles for retired body generations

Issue: CRC-PERF-03  
Priority: P1  
Status: Open  
Evidence date: 2026-10-02  
Classification: Confirmed retained references

## Problem

Materialized body and collider handles are stored in strong maps by index and generation. Removed generations remain cached; disposal unbinds handles without clearing those maps.

## Evidence and limits

After 100 public mount/queryPoint2D/unmount cycles, both caches grew from zero to 100 entries. Both remained at 100 after world disposal. Pending frames were zero, distinguishing retention from a scheduler loop.

See the [audit evidence](../evidence/handle-retention-result.json) and [shared environment and limitations](../README.md). Findings describe the reviewed working tree, not necessarily current main. Revalidate against the integration baseline before changing code.

## Relevant code

- [packages/core/src/features/physics/lib/2d/runtime/controller.ts](../../../../../packages/core/src/features/physics/lib/2d/runtime/controller.ts)

## Reproduction

In a public PhysicsWorld2D scenario, repeatedly create a keyed static body, query its point, then remove it. Use the private inspection seam only to count cache entries and independently assert public stale-handle behavior.

## Implementation direction

- Evict cache entries after their body/collider generations retire and after pending delivery no longer requires them.
- Clear caches during disposal.
- Preserve identity for a live generation and keep externally retained stale handles inert.

## Acceptance criteria

- [ ] Repeated creation/query/removal leaves cache sizes proportional to live or explicitly pending generations, not historical generations.
- [ ] Final disposal leaves both maps empty.
- [ ] Collision events, queries, slot reuse, rollback, and retained external stale handles preserve documented behavior.
- [ ] No quadratic full-cache scan is introduced on every body removal.

## Dependencies and boundaries

No prerequisite. Shares controller.ts with issues 04 and 11; serialize overlapping edits.

## Completion record

Record the baseline and final commit, focused failing and passing checks, exact commands and environment, scenario URL and manual observations where applicable, independent review findings and their dispositions, reconciliation results, integration tests, merge commit, and verified remote main SHA. A code change alone does not close this issue.
