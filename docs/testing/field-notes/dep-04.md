# DEP-04 field note — browser runner and freshness closure

> **Historical status: COMPLETED FIELD RECORD.** Results are dated evidence and are not current API guidance or current test totals.

Date: 2026-08-11

## Scenario and risk

DEP-04 upgraded the real-browser runner and closed the complete direct dependency graph. Risks included changed browser-provider APIs, changed filesystem path semantics, input coordinates inside the runner iframe, silent visual-artifact loss, and stale vulnerable transitives.

## Manual and headless method

- Vitest 4.1.10 uses `@vitest/browser-playwright` with an explicit Chromium instance and Playwright 1.62.1.
- Source and built `baseline-smoke` modes passed the shared headless driver.
- The full suite passed 71 tests with 4 pre-existing skips.
- Manual in-app Chromium source and built galleries passed mount, update, Canvas coordinate click, and reset.
- Ten independent focused source-mode runs passed without retries.

## Visual strategy and controls

Vitest's browser viewport is explicitly 800×600; Playwright context settings retain device scale, color scheme, locale, timezone, and reduced motion. The existing comparison writes named expected, actual, and diff artifacts. A deliberate `VITE_PIBBL_VISUAL_DRILL=1` run failed on 8,298 pixels with maximum channel delta 87; the diff was inspected, the committed baseline was not changed, and a normal rerun passed.

## Surprising findings and browser differences

- Vitest 4 file commands resolve paths from the project root, while screenshot paths remain relative to the test file. Artifact paths were updated accordingly.
- Vitest 4 renders tests in a scaled iframe. Raw CDP coordinates need both frame offset and frame-to-viewport scale; offset-only math turned intended Canvas `(40, 40)` into approximately `(62, 62)`.
- `contextOptions.viewport` does not control the headless tester iframe. `test.browser.viewport` preserves the intended 800×600 test surface.
- Replacing distinct down/up helpers with full clicks made old tests pass but destroyed ordering semantics. The helpers retain raw `mousePressed`/`mouseReleased`; legacy per-handler tables use complete provider-native clicks only where they observe one handler.

## Flakes and stabilization

- Browser runs are sequential locally; no retry or widened screenshot threshold was added.
- Mode-specific artifact directories prevent source/built overwrite.
- Pointer conversion reads the live frame and viewport sizes, so headed runner layout changes remain supported.

## Failed or rejected approaches

- Rejected weakening strict peer checks between Vite 8 and Vitest 2; the browser stack was migrated atomically.
- Rejected retaining `@vitest/browser`; imports now use `vitest/browser`, and the provider comes from the dedicated Playwright package.
- Rejected converting distinct `mouseDown` and `mouseUp` helpers into click aliases.
- Rejected accepting the default transitive `tsx` and vulnerable esbuild chain; a current peer pin removes it.
- Rejected a broad security override; only `defu` is constrained, within the upstream range, for a demonstrated advisory.

## Helper and tooling friction

- Runner APIs can disagree about whether paths are project-relative or test-relative.
- Browser input helpers need an explicit coordinate-space contract.
- Visual failure drills should be scripted and artifact paths should identify scenario, mode, and state.

Candidate tools:

1. a browser-coordinate utility that converts scenario-local points through Canvas CSS scale and runner-frame scale;
2. a visual-drill command that expects failure, verifies expected/actual/diff files, and then proves clean recovery;
3. a dependency-closure report that combines outdated, dedupe, peer, deprecation, audit, and approved override evidence.

## Decisions and follow-ups

- Chromium remains the reference browser for this plan.
- The visual baseline remains exact outside the documented glyph masks.
- CI uploads both custom comparison artifacts and Vitest-native attachments with the current artifact action.
- No direct dependency is outdated; no audit advisory or peer conflict remains.
