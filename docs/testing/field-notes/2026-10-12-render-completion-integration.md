# Render completion integration — 2026-10-12

This dated record describes verification of the previously drafted public
recording completion slice. Current code and the
[frame recording contract](../../design/frame-recording-contract.md) define behavior.

`recordFrames` now reports committed/failed root attempts after render-owned
inspection state publishes. Captured frame metadata identifies the exact root
render generation; raw pixels can be joined to semantic inspection without using
wall-clock timestamps as render IDs. The public demo and replay exercise update,
zoom, pan, clipping, independently calculated coordinates and raw RGBA pixels.

Four focused tests failed before applying the existing implementation. Independent
read-only review found initial-frame callback cancellation could revive a released
session and allocate a timer. Three regression cases reproduced the leak; a phase
guard after the callback fixes cancel, abort and root-disposal paths. Initial stop
retains its first exact frame, and errors in either callback reject and release
capture. The reviewer rechecked the fix and reported no remaining scoped blockers.

Fresh checks on Node 24.15.0, pnpm 11.21.0 and Playwright Chromium:

- Source render transaction, recording and inspection rendering/ownership: 47 tests passed.
- Built recording and inspection rendering/ownership: 43 tests passed.
- Public demo replay: 10 checks passed; its unmodified report is readable with the evidence reader.
- TypeScript, documentation mutation/JSDoc checks, packed Bundler/NodeNext recording
  consumers, ordinary-app tree shaking, Studio declaration parity and focused lint passed.

Commands use `corepack pnpm@11.21.0`; replay instructions are in
[the agent verification README](../../../tooling/agent-verification/README.md#render-completion-and-committed-pixel-evidence).
Raw replay output is local verification evidence, not an npm or website publication.
This record does not claim an aggregate trust pass; combined integration verification
is recorded separately after its final run.
