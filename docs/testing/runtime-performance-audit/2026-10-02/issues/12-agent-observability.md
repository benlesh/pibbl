# Expose bounded explanations of runtime work and ownership

Issue: CRC-PERF-12  
Priority: P2  
Status: Open  
Evidence date: 2026-10-02  
Classification: Confirmed diagnostic coverage gap

## Problem

Existing source-only inspection reports scheduler state and bounded history, but does not explain per-owner invalidation causes, phase durations, historical work volume, or the resource caches implicated by this audit. A frame timestamp repeated across phases is not a phase-duration measurement.

## Evidence and limits

The audit required temporary private instrumentation to distinguish elapsed animation history, stale handle retention, bounded particle capacity, and normal continuous diffusion.

See the [audit evidence](../evidence/README.md) and [shared environment and limitations](../README.md). Findings describe the reviewed working tree, not necessarily current main. Revalidate against the integration baseline before changing code.

## Relevant code

- [tooling/agent-verification/scheduler.ts](../../../../../tooling/agent-verification/scheduler.ts)
- [tooling/agent-verification/runtime-inspection.ts](../../../../../tooling/agent-verification/runtime-inspection.ts)
- [packages/core/src/features/physics/lib/2d/runtime/trace.ts](../../../../../packages/core/src/features/physics/lib/2d/runtime/trace.ts)
- [packages/core/src/lib/scheduler/realm-scheduler.ts](../../../../../packages/core/src/lib/scheduler/realm-scheduler.ts)

## Reproduction

Use the same public scenarios as other issues and request a bounded machine-readable explanation of why work occurred, what was deferred, and what remains owned. Verify that merely observing an idle scene does not schedule work.

## Implementation direction

- Extend existing opt-in source-development tooling rather than assuming a new stable public runtime API.
- Report owner identity, invalidation reason, requests versus renders, monotonic phase durations, and an idle explanation.
- Include relevant bounded counters: milestone visits/deliveries, queue depth/deferred work, checkpoint bytes, geometry-copy bytes, cached handles/colors, and owned surface/bitmap bytes.
- Use bounded rings, dropped-record counts, stable schemas, and passive snapshots; avoid arbitrary user-object serialization.

## Acceptance criteria

- [ ] Agents can distinguish the reproduced defects from expected active simulation using supported development inspection.
- [ ] Instrumentation off has no trace retention and negligible verified overhead.
- [ ] Instrumentation on is bounded, failure-isolated, and never schedules frames.
- [ ] Built/production inspection remains explicitly unsupported unless a separately approved public contract changes that boundary.

## Dependencies and boundaries

Coordinate small counters with 01 through 10; own the integration/schema work separately. Serialize overlapping scheduler edits.

## Completion record

Record the baseline and final commit, focused failing and passing checks, exact commands and environment, scenario URL and manual observations where applicable, independent review findings and their dispositions, reconciliation results, integration tests, merge commit, and verified remote main SHA. A code change alone does not close this issue.
