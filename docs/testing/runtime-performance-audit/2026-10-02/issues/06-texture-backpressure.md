# Texture paint bursts block a frame or overflow the queue

Issue: CRC-PERF-06  
Priority: P2  
Status: Open  
Evidence date: 2026-10-02  
Classification: Confirmed overload behavior

## Problem

The texture message queue accepts 8,192 cloned messages and drains all of them synchronously. Living Ink can enqueue up to 256 paint messages from one pointer event. The next send beyond capacity throws synchronously; there is no frame-work budget.

## Evidence and limits

256 radius-6 stamps drained in 0.5 ms; 8,192 radius-6 stamps in 2.7 ms; 8,192 maximum-radius-128 stamps in 332.5 ms. Overflow threw Texture message queue is full. The extreme workload is not evidence that ordinary brush input caused the reported crashes.

See the [audit evidence](../evidence/heavy-results.json) and [shared environment and limitations](../README.md). Findings describe the reviewed working tree, not necessarily current main. Revalidate against the integration baseline before changing code.

## Relevant code

- [packages/core/src/lib/textures/texture.ts](../../../../../packages/core/src/lib/textures/texture.ts)
- [packages/core/src/features/textures/lib/definitions.ts](../../../../../packages/core/src/features/textures/lib/definitions.ts)
- [packages/core/src/features/textures/lib/simulation.ts](../../../../../packages/core/src/features/textures/lib/simulation.ts)
- [packages/scenarios/src/learning/composition/living-ink.example.tsx](../../../../../packages/scenarios/src/learning/composition/living-ink.example.tsx)

## Reproduction

Mount a public reactionDiffusion texture, enqueue controlled paint/stir bursts, flush a scheduler frame, and observe timing, ordered output, and overflow. Include pointer-driven strokes in the same scenario.

## Implementation direction

- Batch stamp processing where semantics permit and reduce repeated JS/WASM crossings.
- Introduce a documented bounded-work policy with observable queued/deferred/coalesced/rejected counts.
- Preserve message ordering and pause/reset/control semantics. Do not silently discard user input or change send error behavior without resolving the public contract.
- Ensure remaining work schedules only necessary follow-up frames and disposal clears it.

## Acceptance criteria

- [ ] A structural budget bounds one frame of producer work under overload.
- [ ] Deferred work eventually completes in order and scheduling stops once drained or paused.
- [ ] Normal strokes preserve expected output and latency; overflow has explicit tested behavior.
- [ ] Queue storage, clones, and deferred resources remain bounded.

## Dependencies and boundaries

After 02; avoid overlapping texture.ts edits with 08. Public behavior decisions must be recorded before implementation.

## Completion record

Record the baseline and final commit, focused failing and passing checks, exact commands and environment, scenario URL and manual observations where applicable, independent review findings and their dispositions, reconciliation results, integration tests, merge commit, and verified remote main SHA. A code change alone does not close this issue.
