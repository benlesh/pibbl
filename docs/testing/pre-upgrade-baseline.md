# DEP-01 pre-upgrade baseline

Captured on 2026-08-11 before any third-party dependency upgrade.

## Environment

- Local host: macOS, Node.js 24.12.0, pnpm 9.13.2.
- CI declaration: Node.js 22 with an unpinned `latest` pnpm setup action.
- Headless reference: Playwright 1.49.0 Chromium 131.0.6778.33, revision 1148, fixed 800×600 viewport, device scale factor 1, light color scheme, reduced motion, `en-US`, UTC, and sRGB.
- Manual reference: Codex in-app Chromium on macOS at the local Vite route. Browser version was not exposed by the control surface.

## Results

| Check                      | Result                   | Observation                                                                                                                                |
| -------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Frozen install             | Pass                     | Existing lockfile installed with the declared pnpm.                                                                                        |
| Manual gallery             | Pass                     | Mount, update, Canvas click, and reset matched the written procedure; no console warnings/errors.                                          |
| Focused shared smoke       | Pass                     | Ten independent runs passed; one test drives the exact lazy-loaded public-API scenario.                                                    |
| Visual baseline            | Pass                     | Approved reset-state image compared exactly outside documented text masks.                                                                 |
| Failure-artifact drill     | Expected fail, then pass | Purple-vs-blue drill found 8,298 changed pixels, max channel delta 87, emitted expected/actual/diff, then normal run recovered green.      |
| Committed browser baseline | Pass                     | 9 files; 70 passed and 4 skipped before adding the shared smoke test.                                                                      |
| Typecheck                  | Pre-existing fail        | Two errors in `layer.test.ts`: unsupported `children` and `onRender` props on `rect`. New scenario/gallery/test files add no type errors.  |
| Lint                       | Pre-existing fail        | 9 errors and 1 warning in pre-existing README/core files. Targeted scenario, gallery, smoke-test, config, and documentation lint is green. |
| Package build              | Pass                     | `@crc/types` and `@crc/core` build successfully.                                                                                           |
| Direct playground build    | Pass                     | Gallery production build succeeds.                                                                                                         |
| Root playground build      | Fixed, pass              | The stale `docs` target was corrected to the active `playground` package.                                                                  |
| Dependency freshness       | Red by baseline          | 32 outdated direct development dependencies.                                                                                               |
| Development audit          | Red by baseline          | 115 findings: 4 critical, 56 high, 49 moderate, and 6 low.                                                                                 |
| Production audit           | Pass                     | Zero findings; no third-party production dependency.                                                                                       |

The exact dependency disposition, latest versions, engine constraints, CI-installed tools, audit chains, and upgrade clusters are recorded in [`dependency-inventory.md`](./dependency-inventory.md).

## Manual observations

The gallery opened at <http://localhost:5173/#/scenarios/baseline-smoke>. Navigation, tags, instructions, limitations, live state, controls, and the exact exercised TypeScript source were visible. Update changed revision `0 → 1` and blue `→` purple. A coordinate click at Canvas `(100, 100)` changed clicks `0 → 1` and purple `→` orange. Reset restored revision/clicks to `0` and blue. The browser console contained no warning or error entry.

## Known baseline debt

- Typecheck and lint are intentionally recorded red rather than attributed to DEP-01.
- Four committed tests remain skipped: nested clip interaction, two layer rerender cases, and multiple-layer events.
- Arial glyph rasterization is platform-dependent. DEP-01 compares non-text structure exactly, masks only known glyph rectangles, and asserts text/state semantically. A bundled font is a candidate if recurring visual work needs glyph-level portability.
- CRC currently has no public disposal method. The scenario controller waits for its scheduled frame before aborting so DEP-01 does not trigger the known pending-frame lifecycle hazard; TFC-07 owns the underlying runtime rule.
