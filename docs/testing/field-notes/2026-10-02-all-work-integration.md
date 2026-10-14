# All in-flight work integration — 2026-10-02

Status: verification in progress. This record describes integration evidence; it
is not a new runtime contract.

The user requested all in-flight CRC work on local `main` and a push to the
remote. Integration starts from remote `main` at `630b0f3a` and preserves original
working checkouts through separate snapshot branches.

Included work:

- Package consolidation from `codex/integration-snapshot-package-consolidation`
  (`298db495`), retaining current remote implementations when relocating
  particles, physics, visualization, and textures into core subpaths.
- Final HtmlBox from `codex/html-box-main` (`53581779`), including native event
  coordinates/focus, clipping, Manipulable, input-edge lightning, sparks,
  Canvas-downward gravity, randomized velocities, and centered button text.
- The independent child-offset positioning regression from
  `codex/integration-snapshot-manipulation-pending`.
- UTC scales and domain helpers from `codex/viz-semantic-bars`, and custom pie
  label composition from the final visualization branches.

The remaining older filter, texture, manipulation, and visualization snapshots
are predecessor or duplicated implementations. Their original checkout contents
remain recoverable. Current texture-fill support is retained during pie-label
integration. Native font outlines remain in the existing `@crc/text` package.

Verification receipts are retained locally under `/private/tmp/crc-integration-*`.
Agent-closure recertification receipts are checked in under
`docs/testing/integration-evidence/`; their stated scope distinguishes current
browser/Node checks from older native replay artifacts.

## Inspected Studio reference reconciliation

The examples-landing reference had drifted after the already-shipped positioning
merge. Expected, actual, and a generated difference image were inspected. All
5,612 changed pixels are confined to the two Canvas text strings `DRAW.` and
`MOVE. LEARN.` (image bounds x=870..1077, y=356..430); layout, shapes, DOM text,
and the rest of the image are identical. The unchanged remote-main checkout at
`630b0f3a` reproduces the same failure and byte-identical actual PNG
(SHA-256 `69aa1e097af60bb177fc82ff13e1846c15b98c41f28f54f3f8b30a5f0aa4f709`).
The single reference was refreshed to this confirmed current-main rendering;
no runtime behavior or tolerance was changed.

The filters lesson reference was also inspected against its expected, actual,
and difference images. Its 23,256 changed pixels are limited to the composition
lesson count (25 to 26 after the UTC lesson) and the displayed source editor.
The editor now includes the `SvgPath` import already present on remote main;
this shifts subsequent displayed source lines. The rendered filter gallery,
page layout, controls, and remaining pixels are unchanged. This reference was
updated for the intentional catalog/source presentation changes.

The finished diagram capture matched its existing reference when run alone,
both in the integration checkout and on unchanged remote main. In the full
route sequence, 7,754 pixels differed exclusively in Canvas text. The capture
now uses a fresh page, matching the existing filter capture isolation. Its
reference and exact-pixel comparison remain unchanged.

## Fresh verification

Node 24.15.0, pnpm 11.21.0, and Playwright Chromium were used. The complete
browser suite passed 3,673 tests with seven skips. Typecheck, lint, formatting,
catalog validation, verification-ledger requirements, packed consumers,
optional bundle matrices, texture WASM packaging, Studio declaration parity,
built smoke, lifecycle, structural performance, and native-text browser checks
passed. The aggregate trust gate remains incomplete pending explicit approval
of the texture documentation profile reconciliation; this record does not
claim a completed merge or remote push.
