# HtmlBox implementation field notes

## 2026-10-02 — first public slice

Environment: Node 24.15.0 through fnm, pnpm 11.21.0, Playwright Chromium
151.0.7922.34 on macOS. Browser plugin not available; used the repository
Playwright/Vitest setup. Chromium requires sandbox escalation for its macOS
Mach port registration; the first sandboxed launch failed before executing tests.

Plan review questioned outgoing sentinel Tab and SVG clip definition intersection.
A real browser prototype proved both mechanisms: unprevented Tab from a keydown
that focuses the outgoing sentinel reaches the adjacent external control in one
key, forward and backward. A clipPath with its own clip-path reference restricts
hit testing to the intersection. Retain browser evidence for those mechanisms.

Initial public test failed because HtmlBox did not exist, before production code.
Parallel focus editing temporarily made the Studio documentation compile fail;
a temporary config outside the repository disabled only that docs plugin while
iterating. Final integrated checks below use the normal repository configuration.

`vitest run packages/core/test/html-box.test.tsx
packages/core/test/html-box-layers.test.tsx packages/core/test/html-box-focus.test.tsx
packages/core/src/lib/focus --browser.headless --browser.ui=false` passed 158 tests
in 15 files. This is first integrated evidence, not the final trust gate.

The copyable lesson runs at `#/examples/composition/html-box`. The local review
server is http://127.0.0.1:5176/. Desktop browser verification at 1440x1000 checked
page identity, meaningful content, no runtime/editor error overlay, zero page
errors, typed “Hello CRC”, clicked its native button, and rotated it through the
Canvas control. Text and click count survived. Screenshot evidence was inspected
at `/private/tmp/crc-html-box-working.png`, outside committed source.

Manual review: open the lesson; type in the labelled input; click the native
counter; press Rotate, Move and Scale; verify curved clipping and retained text.
Tab forward/backward across Canvas controls and both native controls. Native
arrows should edit text, not move CRC focus. Disposal restores the supplied canvas
and removes owned hosts/clips/listeners.

Tests initially exposed incorrect test assumptions: CRC explicit box dimensions
are content dimensions plus padding (100 + 10 yields a 110 border box), and blur
uses an options object. Those expectations were corrected to existing contracts.
The shared lesson is driven headlessly using an actual native click.

## Verification before the event extension — 2026-10-02

Verification used an isolated managed checkout at
`/Users/benlesh/.codex/worktrees/html-box-verification/crc`, based on
`1d1a2ec49f6bca52be99abf24bd34e1b3cb3f16e`. This excludes the unrelated texture edits
and concurrently developing package consolidation in the shared checkout.
All commands below used Node 24.15.0, pnpm 11.21.0 and Playwright Chromium
151.0.7922.34. `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` suppresses the Vite
configuration warning; it does not disable checks.

Independent implementation review found and verified fixes for empty/ineligible
regions, zero-display suspension, mount/update-time native focus reconciliation,
keyboard/pointer modality transitions, and listener ownership. Canvas-only roots
retain their prior document listener count. The final targeted reviewer found no
remaining focus issue. A trailing blank line was removed before commit.

Fresh results:

- `pnpm test:ci`: 3,419 passed, 5 skipped, 2 failed across 321 files. The only
  failures are the pre-existing `viz-hover-lab` and `agent-targeting-verification`
  generic scenario action-order tests. Both were reproduced from an unchanged
  HEAD source snapshot at `/private/tmp/crc-html-baseline` after building it.
- Focused final catalog, public HtmlBox smoke and focus suites: 233 passed.
  Earlier combined HtmlBox/focus/transaction checks passed 165 tests before the
  final modality and suspension regressions were added; this is dated evidence,
  not the final suite total.
- `pnpm trust:package`: passed packed consumers, optional-import inertness,
  source/packed bundle checks and package-entry tests. Bundler and NodeNext
  declarations include HtmlBox and its generic mount/update types.
- `pnpm trust:lifecycle`: 32 lifecycle tests passed; 48 structural performance
  tests passed, 4 optional timing guards skipped.
- `pnpm typecheck`, `pnpm lint:code`, `pnpm scenarios:check`, and
  `pnpm studio-docs:check`: passed in the isolated checkout.
- `pnpm test:studio-docs`, `pnpm test:visual-safeguard`, and
  `pnpm test:studio-visual`: passed. All eight Studio visual baselines and the
  diagram-editor teaser match; no visual baselines were rewritten.
- `pnpm test:studio-docs:production-boundary`, `pnpm playground:build:built`,
  `pnpm test:smoke:built`, `pnpm test:agent-verification:identity`, and
  `pnpm test:agent-verification:watchdog`: passed. The HtmlBox lesson also passed
  explicitly in built mode; it is now included in the permanent built smoke script.
- HtmlBox's 19-unit approved-design preservation mapping validates directly.

Aggregate gate limitations are explicit, not silently bypassed:

- `pnpm trust` stops at the existing ENV-03 evidence fingerprint mismatch for
  `packages/core/package.json`. The baseline HEAD bytes already hash to
  `6ddeec7b40dcf7794a9988fee19dc8b52c6a87c92bc826d982b16f58a35c10dd`, unlike the
  recorded closure. HtmlBox's later smoke-script addition is another legitimate
  input change; no stale closure has been certified or refreshed.
- `pnpm docs:check` encounters the pre-existing missing post-baseline preservation
  entry for `weighted-electric-sources-contract.md`.
- `pnpm lint:format` reports 76 pre-existing strategy/evidence files. HtmlBox
  Markdown/JSON formatting is checked separately; unrelated evidence is unchanged.

The final Studio page was exercised through its preview iframe at 1440×1000 and
390×844. Desktop input retained “Hello CRC” across a native button click and
Canvas rotation; the counter reached one; no page errors were reported and the
editor showed no TypeScript issues. Fresh mobile navigation and lesson layout
were inspected. Screenshots are local evidence at
`/private/tmp/crc-html-box-final-desktop.png` and
`/private/tmp/crc-html-box-final-mobile.png`.

Review URL: http://127.0.0.1:5176/#/examples/composition/html-box.
The server runs from the isolated HtmlBox checkout to avoid concurrent package
migration changes. The HtmlBox commit is local only; nothing is pushed.

## Final native-event extension verification — 2026-10-02

The event contract was written and independently reviewed before implementation.
Five initial public browser regressions failed before the native bridge existed.
The reviewer caught inactive inverse geometry and missing signal batching; both
were fixed with focused regression evidence. Capture and bubble each batch their
CRC handlers, with native descendants between those phases. Final bounded review
found no remaining material issue.

The same Node 24.15.0, pnpm 11.21.0 and Chromium environment above was used:

- `pnpm test:ci`: **3,428 passed, 5 skipped, 2 failed** across 322 files. Only the
  two baseline scenario action-order failures described above remain. An earlier
  run also failed a particle spatial-similarity threshold (0.7303 versus 0.75);
  that unchanged test passed the focused rerun and this final full run.
- `vitest run packages/core/test/html-box-events.test.tsx
packages/core/test/html-box-smoke.test.ts
packages/core/test/particle-celebration-lab.test.ts --browser.headless
--browser.ui=false`: 14 passed, including the new real-click batching regression.
- Event/facade regression and authoring checks: 99 passed. Combined HtmlBox
  event/focus/Layer/root-surface checks passed 50 before the final batching test.
- `pnpm typecheck` and `pnpm lint:code`: passed after the batching fix.
- `pnpm trust:package`: passed with the exported HtmlBoxEventHandlers type,
  JSX inference, explicit generic createElement, packed runtime and both
  Bundler/NodeNext consumer declarations.
- `pnpm test:smoke:built`: build and all 3 browser smoke tests passed after the
  batching fix, including the pointer-driven public HtmlBox lesson.
- `pnpm studio-docs:check`: passed public routes, links, editor/API coverage and
  search. HtmlBox's complete 25-unit preservation mapping validates against the
  newly approved event extension, without altering unrelated approval records.

Native event coverage includes nested leaf targets, border-local padding origin,
root-logical coordinates, affine shared CSS ancestors, CRC rotation/scale,
viewport fitting, density, clean cached Layer replay, updated handlers without
remount, native checkbox single activation, real got/lost pointer capture,
propagation/default cancellation, and teardown. The public lesson retains its
input and counter while the pointer drives Canvas paint behind translucent HTML.

The aggregate gate limitations recorded above remain; no baseline was rewritten
or unrelated gate relaxed. Final logs are `/private/tmp/crc-html-events-final2-suite.log`,
`/private/tmp/crc-html-events-final-static.log`,
`/private/tmp/crc-html-events-package.log`, and
`/private/tmp/crc-html-events-final-built.log`.

Final event-demo visual QA passed at the review URL on desktop and a fresh mobile
page. The same input node, typed text and native button count survived Rotate,
Move and Scale. The yellow Canvas spark was visibly behind the translucent,
rotated HTML host. No browser page or console errors were observed. Both screenshots
were inspected: `/private/tmp/html-box-desktop.png` and
`/private/tmp/html-box-mobile.png`. No visual baseline was changed.
