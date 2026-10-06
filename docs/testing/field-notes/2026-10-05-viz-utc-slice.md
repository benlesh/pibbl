# UTC charting feedback slice — 2026-10-05

> **Historical status: Dated verification record; current code and fresh checks define the present state.**

Status: slice ready for feedback, not feature complete. Implements the first
step of [Plan 007](../../project-plans/007-visualization-charting.md).

## Public result

- `Scale type="utc"`, UTC/continuous `useScale` overloads, `extent`, `niceDomain`,
  and numeric series/inspection integration through `@pibbl/core/viz`.
- Full API reference: [UTC domains](../../site/api/functions/utc-domains.md).
- Minimal Studio example: http://127.0.0.1:5192/#/examples/composition/viz-utc-basics
- NOAA example: http://127.0.0.1:5192/#/examples/composition/viz-utc-climate
- Website minimal registry: `docs/site/minimal/viz/utc.tsx` and `registry.json`.
- Uses the existing attributed NOAA/Scripps monthly 1980–2021 snapshot: 504
  observations, April 1984 interpolated, no live requests or generated data.

## Manual procedure and expected observations

1. Open the NOAA example. The heading reports December 2021 at 416.67 ppm and
   +78.77 ppm relative to January 1980; date positions use epoch milliseconds.
2. Click the decade control. The domain changes to 2012–2021. Tap the plot's
   left edge to inspect January 2012 at 393.31 ppm and pin the reading.
3. Toggle adjusted trend. The series uses the supplied deseasonalized values;
   the headline remains explicitly the archived monthly mean.
4. Inspect desktop and phone allocations. Labels/furniture stay inside the
   canvas, the plot reflows, and crowded endpoint-adjacent year labels are
   omitted by an explicit example presentation policy. No geometry is moved.
5. Open UTC basics to inspect the compact example for every new API and edit
   the formatter/count. Studio should report no TypeScript issues.

## Fresh verification

Environment: Node 24.15.0, pnpm 11.21.0, Playwright Chromium through Vitest.
Browser inspection used the available in-app computer-use browser. The separate
Browser plugin/skill is not installed; automated checks use the repository's
existing Playwright-backed Vitest workflow.

- Failing-first public test: failed on absent `extent` export before production
  implementation. The sandbox initially denied the test server; rerun with
  approved local-server/Chromium escalation reached the intended failure.
- Focused browser command: `corepack pnpm@11.21.0 exec vitest run` with
  `--browser.headless --browser.ui=false` and these files under
  `packages/core/test/features/viz/`: `utc-example.test.tsx`,
  `utc-scale.test.tsx`, `scale.test.tsx`, `axis-runtime.test.tsx`,
  `studio.test.ts`, `hover-data.test.tsx`, `nearest.test.tsx`,
  `point-series.test.tsx`, `bar-series.test.tsx`, `plot-series.test.tsx`,
  `composition.test.tsx`. The combined run had 51 passing assertions/tests and
  one incorrect boundary expectation. Corrected that fixture to use the full
  Date range; reran `utc-scale.test.tsx`: 2/2 passed. All 52 tests have passing
  latest results, not a claim of a single all-green aggregate run.
- `corepack pnpm@11.21.0 exec tsc --noEmit`: passed.
- Focused ESLint over viz code, new tests, demos and website minimal source:
  passed. `git diff --check`: passed.
- `node tooling/verify-public-jsdoc.mjs`: passed (48 entries, 1,071 declarations,
  2,401 members, 5,572 resolved links; repository-wide snapshot).
- `validateExampleSource` for the UTC website registry entry: passed.
- Actual canonical NOAA example mounted headlessly at 360px and 1100px, including
  range-change/pin/readout assertions. Screenshots inspected at both sizes.
  Temporary evidence: `/tmp/pibbl-utc-360.png`, `/tmp/pibbl-utc-1100.png`.
- Studio browser: live preview and no TypeScript issues after updating its
  maintained declaration bundle. No observed error overlay on the final chart.

## Findings resolved and remaining work

Resolved explicit allocation requirements in the new fixtures, duplicate catalog
order, missing editor declarations, text-baseline overlap, crowded endpoint date
labels, and a mistyped expected NOAA reading (source is 393.31, not 393.12).
The first screenshot capture destination was rejected by Vite's file allowlist;
used the test runner's screenshot directory and moved temporary evidence to /tmp.
No visual regression baseline was rewritten.

Two-tick output uses endpoints only. When no cadence avoids an interior boundary
for a count-two nice domain, retain integral millisecond bounds; the full-Date-
range case is documented and tested. Broader calendar extremes, ownership,
keyboard/assistive-tech evaluation, matched competitor review, packed/built
consumers and aggregate trust remain post-feedback hardening work. Packed export
and consumer probes were updated but not executed. This is not full roadmap or
S-tier competitive acceptance. No changes were committed or pushed.

## Explicit scale API correction

User feedback replaced selector-based providers/hooks across all implemented
families with `LinearScale`/`useLinearScale`, `BarScale`/`useBarScale`, and
`UTCScale`/`useUTCScale`. Each hook has one fixed signal type. Generic exports were
removed without aliases. `niceUTCDomain` takes only optional count options.
Examples, minimal sources, declarations, catalogs and API references migrated.
Future variations follow this rule.

Fresh evidence on Node 24.15.0 / pnpm 11.21.0:

- `vitest run packages/core/test/features/viz --browser.headless --browser.ui=false`:
  161 passed, 2 skipped; 31 passing files and 2 skipped files.
- `tsc --noEmit`: passed, including negative hook/provider type assertions.
- Focused ESLint of visualization implementation, tests, demos, minimal sources,
  type consumers and verification tools: passed.
- Core package build: passed.
- `node tooling/verify-packed-viz.mjs`: packed Bundler/NodeNext consumers, runtime
  exports, core identity, private boundaries and installed-family tree shaking passed.
- `node tooling/verify-viz-scale-tree-shaking.mjs`: all 3 families isolated in
  source and built bundles. Linear imports exclude UTC calendar and band code.
- Public JSDoc and Studio documentation coverage/routes/search checks passed.
- In-app climate example: live preview and “No TypeScript issues.”

The broad website generator encountered an unrelated source allowlist failure for
`games/brick-climb/main.tsx`; the allowlist was not changed. Full repository trust
was not run. The API correction is runnable; visual acceptance and the remaining
visualization roadmap are still outstanding.
