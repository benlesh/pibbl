# DEP-01 field note — shared scenario spine

> **Historical status: COMPLETED FIELD RECORD.** Results are dated evidence and are not current API guidance or current test totals.

Date: 2026-08-11

## Scenario and risk

The baseline smoke scenario mounts a public-API CRC scene, renders rectangle and text output, performs a catalog-declared update, handles a real Canvas click, resets, and disposes. Its purpose is to catch behavior, packaging, runner, and visual drift while dependencies move through three compatibility batches.

The main risk was false parity: a gallery example, a test-only recreation, and copied source could all drift independently while still appearing healthy.

## Manual and headless method

- Manual adapter: the catalog-driven Vite gallery at <http://localhost:5173/#/scenarios/baseline-smoke>.
- Manual environment: Codex in-app Chromium on macOS. The control surface did not expose its version.
- Manual path completed: initial mount, **Update scene**, coordinate click at Canvas `(100, 100)`, and **Reset**. Live state and colors matched the catalog instructions. Browser logs contained no warnings/errors.
- Headless adapter: a separate test harness loads the same catalog entry and lazy scenario definition, validates the exact raw source marker, uses Playwright mouse input, asserts lifecycle state and Canvas pixels, and awaits the controller's render-settling boundary.
- Repeatability: ten independent focused Chromium runs passed. Retry semantics were deliberately not used.

## Visual strategy and controls

- Fixed 800×600 browser context, device scale factor 1, light mode, reduced motion, `en-US`, UTC, sRGB, and disabled font hinting.
- Fixed 720×240 comparison surface: 480×240 Canvas plus 240×240 live-state panel.
- Exact RGBA comparison outside small documented glyph rectangles; zero pixel/channel tolerance elsewhere.
- Targeted pixels assert background plus blue, purple, and orange rectangle states.
- Expected baseline is committed; actual and diff-capable artifacts are always written to ignored `test-screenshots/dep-01/`.
- The first candidate was visually rejected because “CRC smoke scenario” clipped at the rectangle boundary. The font size was corrected, the candidate regenerated, and the clean image inspected before adoption.
- A forced purple-vs-blue drill failed on 8,298 pixels with max channel delta 87. Expected, actual, and red-highlighted diff images were inspected; the normal run then recovered green.

## Surprising findings and browser differences

- Vitest Browser 2.1.8 can capture screenshots but has no image-snapshot matcher. Playwright Test's matcher cannot run inside Vitest because its `testInfo` lifecycle is absent.
- Arial rasterization is not a cross-platform pixel contract. The current comparator masks only glyph rectangles while semantic assertions protect content. A bundled open font is the preferred follow-up if glyph appearance becomes contract-critical.
- The existing screenshot helper timestamped files and overwrote a custom name but never compared output.
- Launching the Playwright browser inside the filesystem sandbox failed on macOS Mach-port permissions; the same suite passed when Chromium was launched through the approved browser execution boundary. This was environmental, not a CRC failure.
- `crc()` renders on `requestAnimationFrame`, but the initial scenario controller was synchronous. A fresh-context review caught that tests could race and that immediate abort could delete the CRC instance before a queued frame ran. Controller actions, reset, settling, and disposal are now asynchronous; disposal waits for pending render work before aborting.

## Flakes and stabilization

- No smoke flake occurred across ten independent runs.
- Actions wait on the exact scheduled frame instead of fixed sleeps.
- Input uses `userEvent.click` in the headless suite rather than the existing CDP helper's private Vitest iframe selector.
- Manual verification used one short post-click observation delay only to read the gallery state; the automated contract does not depend on it.

## Failed or rejected approaches

- Rejected timestamp-only screenshots because they cannot decide correctness.
- Rejected importing the gallery adapter from the headless suite; both remain peers over the catalog/scenario contract.
- Rejected an eager catalog import of the smoke implementation because metadata inspection should not load CRC or presentation code.
- Rejected a free-form `sourcePath` as drift protection. The catalog now owns a source ID/path, the loaded definition must match the ID, and the Vite adapter verifies the raw file marker and path.
- Rejected a mandatory `update()` controller method because later laboratories need different actions. Actions are catalog-declared and dispatched by stable IDs.
- Rejected auto-update behavior for baselines. Missing or changed images fail with an inspectable candidate/diff.

## Helper and tooling friction

- Visual comparison required a small in-browser PNG decoder/diff because the installed runner has capture only.
- Heterogeneous scenario catalogs need a deliberate loader boundary to keep metadata importable without erasing scenario-state types everywhere.
- Canvas text needs either a committed font fixture or explicit masks; relying on system fonts creates silent platform coupling.
- Native input helpers should not depend on Vitest's private iframe selector.

Candidate reusable tools, deferred until repetition proves value:

1. a CRC scenario-contract package generator/validator;
2. a runner-neutral Canvas visual matcher with pixel probes, masks, and artifact naming;
3. a bundled deterministic browser-test font fixture;
4. a public-boundary Canvas input driver that reports coordinates and waits for CRC settling.

## Decisions and follow-ups

- The private scenario catalog is the future documentation source of truth; gallery, tests, and docs remain independent adapters.
- The smoke scenario is a `documentation-candidate` at `baseline` maturity because its public example is small and readable without diagnostics.
- The raw `smoke.example.ts` file is the displayed and executed example; controller/lifecycle plumbing stays in `smoke.ts`.
- Root `playground:build` now targets the actual gallery package because the stale `docs` target prevented the required verification.
- The dependency inventory found 14 used-and-upgrade tools, one externally blocked latest TypeScript, 22 installed direct removals, and 19 catalog-only removals. DEP-02 must resolve the documented TypeScript exception before it can satisfy the freshness policy.
