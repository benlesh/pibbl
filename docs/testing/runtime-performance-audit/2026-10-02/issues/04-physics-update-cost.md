# Physics updates copy and rebuild whole world state

> **Historical status: Dated audit evidence and remediation proposals; current behavior is defined by runtime contracts.**

Issue: Pibbl-PERF-04  
Priority: P1  
Status: Open  
Evidence date: 2026-10-02  
Classification: Confirmed allocation pattern and measured scaling cost

## Problem

Each advance captures rollback state by cloning typed arrays and maps and serializing Rapier. Publication and sleep detection allocate additional whole-world snapshots. Rapier synchronization scans storage, constructs configuration arrays/strings, and rebuilds lookup structures even when topology is unchanged.

## Evidence and limits

With sleeping disabled, 1,000 moving bodies took median 25.9 ms and p95 29.3 ms over 180 frames. Instrumentation counted 31,860 typed-array slice calls and 68,875,888 copied bytes, excluding other allocation and Rapier serialization. This measures total update cost; it does not attribute all that time to checkpoints.

See the [audit evidence](../evidence/followup-results.json) and [shared environment and limitations](../README.md). Findings describe the reviewed working tree, not necessarily current main. Revalidate against the integration baseline before changing code.

## Relevant code

- [packages/core/src/features/physics/lib/2d/world/world.ts](../../../../../packages/core/src/features/physics/lib/2d/world/world.ts)
- [packages/core/src/features/physics/lib/2d/world/rapier.ts](../../../../../packages/core/src/features/physics/lib/2d/world/rapier.ts)
- [packages/core/src/features/physics/lib/2d/runtime/controller.ts](../../../../../packages/core/src/features/physics/lib/2d/runtime/controller.ts)

## Reproduction

Use public PhysicsWorld2D with separated circles moving at fixed velocity, zero gravity, and sleeping:false. Compare 32, 256, and 1,000 bodies. Separately measure checkpoint bytes, topology reconciliation, publication, and engine synchronization.

## Implementation direction

- First avoid full public snapshots for internal publication and sleep checks; use appropriate direct iteration.
- Use topology/configuration revisions or dirty sets to avoid rebuilding unchanged engine bindings.
- Investigate reusable checkpoint storage, copy-on-write, or mutation journals only while preserving atomic rollback, including Rapier state.
- Account for allocated capacity as well as live body count and avoid hidden historical-capacity costs.

## Acceptance criteria

- [ ] Fault-injection tests still restore pre-frame world state, commands, events, and public signals exactly.
- [ ] Steady-state allocation/copy counters improve against a freshly recorded baseline.
- [ ] Sustained scaling tests include dense contacts, sleeping/waking, topology churn, and rejected candidates.
- [ ] No new scheduler, automatic frame loop, or change to documented fixed-step behavior is introduced.

## Dependencies and boundaries

Prefer after 03. Coordinate with 12 for passive counters and with 11 for narrowly justified separation of responsibilities.

## Completion record

Record the baseline and final commit, focused failing and passing checks, exact commands and environment, scenario URL and manual observations where applicable, independent review findings and their dispositions, reconciliation results, integration tests, merge commit, and verified remote main SHA. A code change alone does not close this issue.
