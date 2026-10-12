# Release verification · October 8, 2026

This is brand-asset verification, not a Pibbl runtime or aggregate trust-gate result. All changes for this delivery are under `output/brand/`; no product docs or catalogs were changed by this work.

- `node --test output/brand/pibbl-big-bubbles/animation/loader/*.test.mjs`: 10 passed, 0 failed, on Node 26.9.0. Covers approved-score hashes, exact identity, playback controls, completion hold, loop closure, gravity, contact, effort and sampled overlap/floor checks.
- `browser-check.html`: all 14 browser assertions passed in the Codex in-app browser. Checks initial pause, accessible label, independent shadows, resume, disconnect cancellation, complete hold/frame shutdown, single/idempotent event, exact final geometry, restart, independent commands, reduced-motion still and explicit readiness event.
- `demo.html`: visually inspected white/dark instances; paused/resumed, detached/reattached, completed with Ready, restarted. No browser console errors observed.
- Eight GIFs decoded with Pillow; dimensions and total duration checked (11 seconds loops / 15 seconds full finish). Same score and SVG renderer as component. Frames sampled every 40ms; identical frames may merge during GIF encoding without changing timing. Contact sheet reviewed, including ramp, flight, catch, return and final bloom.
- Updated brand guide page 5 rendered with Poppler and reviewed for layout and accurate packaging information.
- `source/verify.py`: passed all existing geometry, vector, raster, links, transparency, bubble and PDF checks with the bundled Python runtime.
- `source/pack.py`: regenerated the manifest/checksums/archive and verifies every archived file against its SHA-256 and ZIP integrity.

Future edits: rerun the focused tests and browser checks; preserve the approved score unless intentionally revising the acting. Render GIFs again after any score, identity or bubble changes. Refresh the archive last. The Pibbl renderer remains future work; this delivery supplies its specification and shared pure samplers.
