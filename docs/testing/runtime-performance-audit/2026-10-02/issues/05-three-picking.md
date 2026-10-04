# Three picking clones static geometry every rendered generation

> **Historical status: Dated audit evidence and remediation proposals; current behavior is defined by runtime contracts.**

Issue: CRC-PERF-05  
Priority: P1  
Status: Open  
Evidence date: 2026-10-02  
Classification: Confirmed copying and isolated benchmark cost

## Problem

Default interaction settlement snapshots the complete scene and clones each unique geometry buffer for each render generation. Animated transforms repeat those copies even when geometry is unchanged. Pointer-disabled layers still construct the default picker.

## Evidence and limits

The existing Node snapshot benchmark measured median 11.0 ms for 1,024 unique boxes. A snapshot of 128 unique spheres copied 11,833,344 geometry bytes. These are CPU snapshot measurements, not browser/GPU frame times.

See the [audit evidence](../evidence/three-picking-report.json) and [shared environment and limitations](../README.md). Findings describe the reviewed working tree, not necessarily current main. Revalidate against the integration baseline before changing code.

## Relevant code

- [packages/three/src/lib/define-three-layer.ts](../../../../../packages/three/src/lib/define-three-layer.ts)
- [packages/three/src/lib/default-picker.ts](../../../../../packages/three/src/lib/default-picker.ts)
- [packages/three/src/lib/picking-snapshot.ts](../../../../../packages/three/src/lib/picking-snapshot.ts)
- [packages/core/src/lib/render-layer/controller.ts](../../../../../packages/core/src/lib/render-layer/controller.ts)

## Reproduction

Run tooling/agent-verification/benchmark-three-picking.mjs and a public animated defineThreeLayer scenario with static shared and unique geometries. Observe copy counts across successive generations, then mutate raycast-relevant geometry and verify committed-generation picking.

## Implementation direction

- Reuse immutable geometry snapshots only when a conservative mutation contract proves reuse is safe.
- Preserve old committed generations until retirement; never substitute live mutable scene resources for historical interaction state.
- Avoid unnecessary picker work for pointer-disabled content while preserving focus metadata and documented settle behavior.
- Bound snapshot caches and release entries when application resources/generations retire.

## Acceptance criteria

- [ ] Transform-only animation does not repeatedly copy unchanged geometry buffers.
- [ ] In-place mutations, attribute replacement, groups, draw ranges, morph/skinned/instanced data, visibility, and material-side changes cannot produce stale picking.
- [ ] Custom raycasts and application mutation without version increments are handled conservatively or explicitly bounded by an approved contract; no silent compatibility loss.
- [ ] Failure/rollback/disposal ownership and focus/input tests pass; CPU and retained-byte evidence improves.

## Dependencies and boundaries

Independent of texture and physics files unless core settlement changes. Audit raw array mutation semantics before choosing a cache fingerprint.

## Completion record

Record the baseline and final commit, focused failing and passing checks, exact commands and environment, scenario URL and manual observations where applicable, independent review findings and their dispositions, reconciliation results, integration tests, merge commit, and verified remote main SHA. A code change alone does not close this issue.
