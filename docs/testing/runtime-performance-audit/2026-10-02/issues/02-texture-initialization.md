# Texture initialization failure leaves orphaned scheduled work

> **Historical status: Dated audit evidence and remediation proposals; current behavior is defined by runtime contracts.**

Issue: Pibbl-PERF-02  
Priority: P1  
Status: Open  
Evidence date: 2026-10-02  
Classification: Confirmed lifecycle bug

## Problem

Resource catches definition.create failures, but publishInitial runs outside that catch. useTexture registers its teardown only after the Resource constructor returns. An initial raster failure after requestFrame can leave both state and an Advance registration without a teardown owner.

## Evidence and limits

A public custom texture requested frames, threw once during its initial rasterization, and then could advance normally. After root disposal the probe observed zero roots, one Advance participant, one pending host frame, five further advances, and zero calls to definition.dispose.

See the [audit evidence](../evidence/heavy-results.json) and [shared environment and limitations](../README.md). Findings describe the reviewed working tree, not necessarily current main. Revalidate against the integration baseline before changing code.

## Relevant code

- [packages/core/src/lib/textures/texture.ts](../../../../../packages/core/src/lib/textures/texture.ts)
- [packages/core/src/lib/hooks/hook-slot.ts](../../../../../packages/core/src/lib/hooks/hook-slot.ts)

## Reproduction

Mount a defineTexture/useTexture component whose create requests a frame and whose first rasterize throws. Catch the scheduled render error, dispose the root, and advance the test driver. Track disposal calls and scheduler/resource ownership.

## Implementation direction

- Make create and initial publication one exception-safe acquisition sequence.
- On failure, cancel scheduling, dispose successfully returned state exactly once, and release owned surfaces.
- Keep the original failure observable even if cleanup also fails, following existing error-reporting contracts.

## Acceptance criteria

- [ ] The regression returns roots, participants, pending frames, and owned surfaces to baseline immediately after failure/disposal.
- [ ] Definition disposal runs exactly once for successfully created state.
- [ ] Failures in create, rasterize, publication, and cleanup cannot strand scheduler work.
- [ ] Successful texture creation and transaction commit/rollback behavior remain unchanged.

## Dependencies and boundaries

No prerequisite. Shares texture.ts with issues 06 and 08; serialize edits or integrate and rebase before overlapping work.

## Completion record

Record the baseline and final commit, focused failing and passing checks, exact commands and environment, scenario URL and manual observations where applicable, independent review findings and their dispositions, reconciliation results, integration tests, merge commit, and verified remote main SHA. A code change alone does not close this issue.
