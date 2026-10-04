# Texture resizing leaves obsolete publication surfaces to garbage collection

Issue: CRC-PERF-08  
Priority: P2  
Status: Open  
Evidence date: 2026-10-02  
Classification: Code-supported resource pressure risk rather than proven unbounded leak

## Problem

At stable dimensions, publication uses a bounded committed/spare pair. During resolution changes, an incompatible spare is ignored and replaced without explicitly releasing its backing storage. Old committed surfaces can follow the same path later.

## Evidence and limits

Source inspection supports GC-dependent release during resize churn. The audit did not demonstrate an unbounded native-memory slope. Stable-resolution diffusion resource counts remained bounded.

See the [audit evidence](../evidence/heavy-results.json) and [shared environment and limitations](../README.md). Findings describe the reviewed working tree, not necessarily current main. Revalidate against the integration baseline before changing code.

## Relevant code

- [packages/core/src/lib/textures/texture.ts](../../../../../packages/core/src/lib/textures/texture.ts)

## Reproduction

Repeatedly alternate valid texture resolutions through the public API while tracking publication surfaces, dimensions, transaction references, and explicit release. Exercise success, failure, rollback, and disposal.

## Implementation direction

- Release incompatible surfaces only after no committed/provisional transaction or borrower can use them.
- Retain bounded stable-size reuse and exact rollback behavior.
- Make ownership and backing-byte counts observable in test diagnostics.

## Acceptance criteria

- [ ] Obsolete unborrowed publication surfaces are explicitly released rather than merely dereferenced.
- [ ] Resize storms retain only the documented active/candidate/rollback surfaces.
- [ ] Rollback preserves usable committed pixels and every released surface is released exactly once.
- [ ] Stable-resolution rendering does not regress into per-frame allocation.

## Dependencies and boundaries

After 02. Serialize with 06 because both edit texture.ts. Do not conflate this with application-owned render-layer resources.

## Completion record

Record the baseline and final commit, focused failing and passing checks, exact commands and environment, scenario URL and manual observations where applicable, independent review findings and their dispositions, reconciliation results, integration tests, merge commit, and verified remote main SHA. A code change alone does not close this issue.
