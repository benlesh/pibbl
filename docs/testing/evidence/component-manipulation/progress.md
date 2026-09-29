# Component manipulation execution record

Status: first public drag/resize slice ready for feedback. Not feature complete.

## Workspace and baseline

- Main worktree is untouched by implementation.
- Integration: `/Users/benlesh/.codex/worktrees/component-manipulation/crc`, branch `codex/component-manipulation`.
- Baseline HEAD before snapshot: `4717dc9`; snapshot commit `3373ca3` includes the user's current uncommitted responsive-style work and approved plan/spec. Treat that commit as inherited work, not this feature's implementation diff.
- Positioning worker: `/Users/benlesh/.codex/worktrees/manipulation-positioning/crc`.
- Math/migration worker: `/Users/benlesh/.codex/worktrees/manipulation-math/crc`.
- Environment: Node 24.15.0 via `/Users/benlesh/.local/share/fnm/node-versions/v24.15.0/installation/bin`; pnpm 11.21.0; Chromium.
- Fresh isolated setup needed `pnpm install --offline --frozen-lockfile` and `pnpm build` before normal Vitest startup because Studio API coverage loads package declarations.
- Baseline focused layouts/responsive layouts: 6 files, 100 tests passed.

## Current implementation evidence

- Positioning and diagnostics commits integrated: `b16c1a06`, `3c01df55`, `47b6aca6`, `89270114`.
- Pure solver integrated: `97e5ae7f`, `5a043167`. Root corrected an unused parameter exposed by a fresh build. Advanced solver constraints require later adversarial review; 7 cases do not prove the whole math contract.
- Authored usage migration integrated: `55397988`, `d2b207df`, `67bbf66d`; root corrected mixed-runtime fixture Group import.
- Public native pointer test failed first for absent useManipulation; then passed after controller/frame/drag implementation. Resize test failed first for absent ResizeHandles; then passed after handle implementation.
- Nested-Flex learning example test exposed missing explicit Flex minimum heights; corrected the authored example and verified native resize updates the readout from 320×224 to 352×248.
- Fresh root typecheck passed after test import corrections.
- Focused interaction/example/positioning/diagnostic/solver run: 5 files, 17 tests passed. Temporary `/tmp/crc-manipulation-vitest.config.ts` omits only Studio documentation collector during the API coverage migration. It preserves runtime aliases and Playwright. This is supplemental evidence; rerun normal config once minimum API docs exist.
- Root core package build passed. No aggregate trust run claimed.

## Work allocation and next actions

- Root owns controller/frame/handles/public example and integration.
- Migration worker is adding minimum API docs and Studio declaration coverage needed for the normal source test/Studio startup.
- Environment worker is replacing the previous helper-only DEV probe with a real public browser fixture for source/built × development/production. The helper-only probe was rejected as insufficient and is not completion evidence.
- Next: start and visually inspect Studio; deliver exact `#/examples/events-and-interaction/manipulation` URL for feedback before broad hardening.
- Remaining scope: convenience Manipulable, rotation/rotated resize, complete constraint correctness, synchronous external-write observation, activation-scoped click suppression, generation-safe queued teardown rollback, transforms/layout matrix, migration regressions, docs/consumers, review and aggregate trust gate.

## Rulings

- Snapshot existing main changes into the isolated baseline to avoid implementing against stale layout code; main stays untouched. Cost if wrong: baseline reconciliation when integrating with later main changes.
- During migration, use a temporary focused browser config without the documentation collector, while retaining normal config as required final verification. Cost if wrong: normal-config integration failures must be resolved before the slice is claimed ready.
- Repository thin-slice guidance overrides repeated fresh reviewers and exhaustive pre-slice verification recommended by skills. Reuse workers and one later reviewer.

## First feedback milestone

- Normal Vitest configuration now passes: `corepack pnpm@11.21.0 exec vitest run packages/core/test/manipulation-interaction.test.tsx packages/core/test/manipulation-example.test.ts packages/core/test/component-positioning.test.tsx packages/core/test/layout-positioning-diagnostics.test.tsx packages/core/src/lib/manipulation/solve.test.ts --browser.headless --browser.ui=false`: 5 files, 17 tests passed on Node 24.15.0 and pnpm 11.21.0.
- Fresh core build plus `node tooling/verify-positioning-environments.mjs` passed source/built × DEV true/false. Production tests compare rendered pixels, paint bounds, and hit targeting with supplied versus omitted offsets; development tests capture the actual layout error for Flex, Flow, and Grid.
- Environment probe exposed missing consumed-placement metadata in Flex/Grid; integrated fix `697541fb` uses the common used-size handoff.
- Studio is running at `http://127.0.0.1:5187/#/examples/events-and-interaction/manipulation` in the integration checkout. Visually confirmed the live card, four corner controls, nested Flex layout, geometry readout, and no editor TypeScript errors. Native pointer tests establish interaction behavior.
- Minimum documentation metadata, per-type headings, and related-type links now satisfy normal Studio startup. Comprehensive documentation migration remains Task 9.
- User has been invited to evaluate this slice before rotation and broad hardening. Development server is intentionally left running; do not archive its worktree.

## Integrated hardening progress (2026-09-28)

This section supersedes the earlier next-action list; the feature remains incomplete.

- Rotation, aspect-ratio locking, bounded resize/move solving, `Manipulable`, immutable snapshots, synchronous external-write observation, click suppression, and generation-checked teardown rollback are implemented in the integration branch.
- Strengthened the solver tests to assert actual opposite-anchor coordinates for all eight resize handles. Fixed ratio-driver snapping, rotated snap status, feasible bounds/minimum projection, and untouched edge dimensions.
- Added public cancellation evidence for live unsatisfiable constraints, reporting `constraints-unsatisfiable` and restoring the original box.
- Structural performance evidence passes: multiple pointer samples coalesce into one normal content traversal, matching a manually positioned scene, with bounded gesture observers and no pixel readback.
- Fresh normal-config source run: 13 files / 62 tests passed for manipulation, activation, positioning, and diagnostics. The later example reset/permanent-snap regression also passed. Node 24.15.0, pnpm 11.21.0, Chromium.
- Fresh integrated `typecheck` and core build passed. Full `test:package-consumer:packed` passed after updating the explicit runtime export manifest to 88 exports. The normal packed gate now also executes the environment probe against source, built output, and installed tarball output, each with DEV true/false; all six modes passed.
- Custom resize/rotation visuals now use CSS-pixel local dimensions; transform tests cover nonuniform Group transforms, density/contain scaling, Layer/filter composition, clipping, and custom child targeting.
- Integrated worker evidence for frame replacement and live CSS/ancestor coordinate mapping cancellation: four files / 21 tests passed on the worker branch. Recheck with final integration before completion.
- Updated the learning example with rotation, Alt ratio lock, reset, and permanent snapping. Visually checked the refreshed Studio preview and no TypeScript issues. Restarting the development server was necessary because its virtual runtime bundle was cached from the earlier API. Current server remains on port 5187.
- A reused independent worker reviewed controller/ownership/solver and reported no verified remaining defect. This is supplemental evidence, not completion of the requirement audit.
- Remaining: terminal/capture/animation-lease edge evidence, deterministic private lab, completed contract/docs registration, full migration/catalog checks, built-mode public browser evidence, and the aggregate trust gate. Do not mark the goal complete based on the focused counts above.

## Migration and final-scope audit follow-up

- Fresh integrated physics + complete learning catalog: `vitest run packages/physics/src/lib/2d packages/core/test/learning-examples.test.ts --browser.headless --browser.ui=false --maxWorkers=4` passed 26 files / 442 tests. The physics regression was real: local Rectangle/Text/Image inference and body/collider placement transforms required migration together. Commit `a8ab779d` restores alignment without changing tolerances.
- Integrated terminal and lab evidence passed eight tests across three files (public example, terminal paths, private lab). The example now installs `FocusManagement`, so native Escape restores the preview and does not add a commit. New private lab route: `#/testing/manipulation`.
- Integrated same-mounted-frame controller replacement fix `0386608f`; former controller releases/rolls back and the existing frame adopts its new controller. Worker focused evidence: 23 tests / four files.
- Documentation checks passed with 1028 mutation probes; Studio docs inventory/search checks passed. Lint and typecheck passed after formatting and callback error-cause fixes. Formatting changes in the docs manifest preserve its parsed semantics and reviewed hash.
- Finite `degrees()` conversion avoids intermediate multiplication overflow; public regression passes. Standard lifecycle/performance commands now include manipulation ownership/performance evidence.
- Pending user decision (asked asynchronously): a layout-placed ordinary component currently forwards a consumed-position marker to every returned child. A new public regression demonstrates that this wrongly suppresses independent local child offsets. Preserving both arbitrary JavaScript style spreads and independent child styles requires a clear handoff contract. Asked whether received component style should represent the already-placed local box (`left/top = 0`, recommended), replacing the plan's authored-props-retention clause, or retain authored style and introduce an explicit forwarding helper. Do not silently choose while that decision is pending. The failing regression remains in `component-positioning.test.tsx`.
- Full browser audit is now running to find other migration defects. This is not a completed aggregate trust run, and the known forwarding regression remains expected to fail until the decision above is implemented.

## Broad browser audit remediation

- Initial full source browser audit completed with 306 passing and 23 failing files; 3800 passed, 77 failed, four skipped, and one unhandled error. This is failure discovery, not a successful trust gate.
- Fixed shared style dispatch adding unsolicited `left/top = 0` to closed custom primitive styles. Position resolution now only merges position fields that actually exist; absent positioning/filter work preserves the resolver result.
- Integrated default handle chrome fix: 8 CSS-pixel outer extent and 1 CSS-pixel border survive nonuniform/large transforms. The worker's public numeric regression and transform/rotation/interaction checks passed 15 tests.
- Migrated Text, Rectangle, Image, interaction-lab, JSX, responsive-example, filter-local-surface, public-export and signal-provision evidence. Geometric x/y models remain intact and map explicitly at the style boundary. World geometry, pixel assertions and hit coordinates are preserved; no visual baseline or tolerance was relaxed.
- Fresh consolidated source command covering style dispatch, primitive inputs/contracts, layout helpers, public exports, responsive styles/example, signal performance, JSX, and filters passed 13 files / 209 tests. A subsequent JSX check with explicit Image world-origin evidence passed 13 tests. Node 24.15.0, pnpm 11.21.0, Chromium. Focused ESLint and diff checks passed.
- Independent Text suite passed 31 tests; Rectangle/Image suites passed 49; interaction characterization/performance passed 28 with four preexisting skips. These focused totals overlap the broader audit and must not be added together as a unique count.
- Allocated viz axis labels and Chapters 8/9 tutorial reset failures share the known placement-marker propagation defect. Their original geometry/selection expectations remain enforced. Do not patch application fixtures to work around the pending custom-component contract decision.
- Remaining: settle and implement the pending ordinary-component placement handoff, rerun affected public geometry suites, investigate particle replay failure, run built-mode public evidence and the final aggregate trust gate. Feature remains incomplete.

- Fresh `corepack pnpm@11.21.0 build` succeeded, followed by the public manipulation interaction/example/terminal/transforms/rotation/ownership/performance and layout diagnostics suites with `--mode built --browser.headless --browser.ui=false --maxWorkers=4`: eight files / 35 tests passed. This confirms built-package behavior; explicit production environment evidence remains the separate six-mode probe described above.

- Repeat full source `corepack pnpm@11.21.0 test:ci` after the migration fixes: 325 passed / four failed files; 3873 passed / five failed / four skipped tests, no unhandled errors, 94.02 seconds. Four failures are the pending placement handoff (public positioning regression, allocated viz axis, two tutorial reset cases). One physics learning-example release case failed and is under independent timing investigation. The particle replay case passed this audit; it also passed six focused worker runs with no threshold or semantic changes. This remains a failing aggregate browser result, not completion.

## Independent final-gate progress

- `corepack pnpm@11.21.0 trust:static` passed (exit 0) on Node 24.15.0 / pnpm 11.21.0. This includes scenario/docs/Studio checks, production documentation boundary, typecheck, lint, all package builds, and source/built Studio builds. Log: `/tmp/crc-manipulation-static-current.log`.
- `corepack pnpm@11.21.0 trust:lifecycle` passed (exit 0): ownership 15 files / 64 tests; structural performance ten files / 65 passed / four skipped. Log: `/tmp/crc-manipulation-lifecycle-current.log`. These do not substitute for the still-failing full browser gate.
- Task 8 audit identified absent direct public evidence for external writes inside lifecycle callbacks. A reused worker is adding `onStart`/`onChange` write-precedence cases, independent of the pending positioning decision.
