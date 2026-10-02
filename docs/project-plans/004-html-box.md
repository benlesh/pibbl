# Plan 004 — HtmlBox

Status: active, 2026-10-02. User authorizes complete implementation, reviewed plan,
implementation review and fixes, and a local commit for review. No push requested.

## Baseline and locked scope

Follow the [approved design](../superpowers/specs/2026-10-02-html-host-design.md)
and [reviewed implementation plan](../superpowers/plans/2026-10-02-html-box-implementation.md).
This is directly requested feature work. Preserve existing texture/scenario/editor
changes; stage only HtmlBox work and the HtmlBox portion of shared files.

## Status board

| Step                                   | State       |
| -------------------------------------- | ----------- |
| Public vertical slice                  | Done        |
| Full contract and ownership            | In progress |
| Review, aggregate verification, commit | Queued      |

## [DONE] Public vertical slice

Implement persistent HtmlBox, transformations, portable clips and native focus;
run focused public tests and provide a runnable Studio lesson. The exact lesson
must be driven headlessly. Record browser characterization, semantic geometry,
input/focus evidence and narrow visual evidence in the field note. User’s overnight
instruction supersedes pausing for feedback; continue after making the slice available.

## [IN PROGRESS] Full contract and ownership

Implement cached Layers, all approved layout/clip/focus/lifecycle behavior, public
API and editor/consumer coverage, guide and contracts. Done when focused suites
cover the full accepted behavior and failure/ownership rules.

## [NEXT] Review, aggregate verification, commit

Reuse the review subagent for an independent implementation review, fix findings,
run proportional final checks and aggregate trust under Node24, inspect actual
browser output, then commit all HtmlBox work and leave it ready for user review.
Done when the commit and verification evidence are recorded without unrelated edits.

## Decision log

- Latest mount API returns only an update function and uses AbortSignal for cleanup.
- Plan reviewer findings are resolved/assigned explicit implementation evidence in
  the implementation plan. Chromium prototypes prove sentinel exit and SVG intersection.
- Continuous overnight authorization replaces waiting for experiential feedback.

## Session log

- 2026-10-02: Activated execution after plan review. Node24.15.0 is available via
  fnm; pnpm11.21.0. Local Chromium requires sandbox escalation to launch.

- 2026-10-02: Public Studio slice is runnable at http://127.0.0.1:5176/#/examples/composition/html-box.
  Integrated public/focus suites pass 158 tests; input retention/rotation visually
  inspected. Full ownership/package/docs hardening underway, implementation review
  dispatched to the same reviewer. [Field notes](../testing/field-notes/html-box.md).
