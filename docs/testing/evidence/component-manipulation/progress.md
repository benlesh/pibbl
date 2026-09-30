# Component manipulation execution record

> **Historical status: Execution evidence record; it does not define current shipped behavior.**

Status: feature complete and verified on the current-main integration base.
The dated sections below preserve the earlier slice milestones and failures;
the final verification sections supersede their outstanding-work notes.

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
- Approved resolution: placement handoff is value-based without a new public API. A returned style that spreads the placed component's `style` keeps matching resolved `left`/`top` consumed once, including same-value reassignment; different values are local offsets. A fresh non-forwarded style remains local even when its values match. The paired public positioning regression protects both cases without promising style-object identity.
- Full browser audit remains required for final aggregate evidence; the placement handoff ambiguity is no longer an expected failure.

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

## Completion audit by plan task

| Plan task                    | Current evidence and remaining work                                                                                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Unified placement        | Standalone paint/hit and forwarding cases pass. Independent child offsets are a proven failure; public handoff decision is pending. Not complete.                                                         |
| 2 — Runtime diagnostics      | Public Flex/Flow/Grid development diagnostics and explicit source/built/packed production-ignore probes passed. Keep these probes in the final integrated gate.                                           |
| 3 — Pure move/resize         | Solver cases cover snapping, tie-breaking, origins, opposite anchors, dimensions and constraints; full source audit passed this suite.                                                                    |
| 4 — Controller/handles       | Native capture, threshold, commit, cancellation and ownership cases pass. Shared-source concurrency now has public Canvas event evidence; see the follow-up below.                                        |
| 5 — Runnable slice           | Live Studio example and private lab exist, use the public API, and have native-browser evidence. Earlier progress records contain the verified URL and inspection.                                        |
| 6 — Rotation/constraints     | Public rotation/transformed resize and pure solver evidence pass, including bounds, aspect ratio and grid distinctions.                                                                                   |
| 7 — Layout/transforms        | Flex/Flow/Grid reflow, keyed state, CSS-sized chrome and transformed/clipped targets pass. Cross-component placement still depends on Task 1.                                                             |
| 8 — Ownership/performance    | Standard lifecycle/performance gate passed. Newly integrated callback-write cases pass 15 tests across ownership/terminal suites; shared-source concurrency evidence now passes; see the follow-up below. |
| 9 — Migration/docs/consumers | Static gate and earlier packed/environment probes pass. Tutorial/viz migration behavior is blocked by Task 1, and the physics example timestamp regression is fixed and verified below.                   |
| 10 — Final verification      | Built manipulation checks, static and lifecycle gates pass. Full browser audit fails on recorded cases; final aggregate trust and visual acceptance are not complete.                                     |

The unchecked procedural steps in the dated plan are not evidence of successful historical red runs. This table records current behavior evidence without inferring unobserved execution history or declaring the feature complete.

## Focused audit follow-ups completed

- Integrated `onStart` and `onChange` external-write precedence tests plus a shared-box concurrency test. The first controller starts/releases through native input; a distinct public Canvas pointer event proves the second controller is rejected before acquiring capture and cannot disturb the first owner. No runtime change was necessary.
- Fixed the physics learning example dropping distinct captured move/release positions with equal timestamps. The fallback considers only equal-timestamp distinct predecessors; the existing window and speed limit remain. A native CDP timestamp regression failed with the old algorithm (`centerY = 108`, expected above 130) and passed with the fix. Test timestamps are monotonic relative to the native initial press.
- Fresh integrated normal-config command covering the complete learning catalog and manipulation ownership/terminal suites passed three files / 243 tests. Node 24.15.0, pnpm 11.21.0, Chromium. Focused ESLint and diff checks passed. Log: `/tmp/crc-ownership-learning-current.log`.
- The unresolved custom-component placement decision remains the next runtime change. After it is resolved, rerun the affected positioning/viz/tutorial oracles and the aggregate gate. Do not infer a green full browser result from these focused follow-ups.

## 2026-09-29 child-defined drag handles and position readouts

Approved scope replaces DragHandle's implicit rectangle with ordinary child hit
areas and adds move-position readouts. DragHandle uses Group-like presentation,
structural event propagation and listener-owned capture. Focus belongs to child
targets; focused Escape and readout styles follow that ancestry. A private
session source distinguishes multiple grips sharing a controller.

Fresh evidence on Node 24.15.0, pnpm 11.21.0, Playwright Chromium:

- `corepack pnpm@11.21.0 exec vitest run packages/core/test/manipulation packages/core/test/manipulable-readout.test.tsx packages/core/src/lib/manipulation --browser.headless --browser.ui=false`: 18 files / 90 tests passed. Log `/tmp/crc-child-drag-all-final.log`.
- Built-mode child hit/geometry, move readout and public example: four files / 14 tests passed. Log `/tmp/crc-child-drag-built-final.log`.
- `tsc --noEmit`, core package build, focused ESLint and `git diff --check` passed.
- Studio declaration verification passed source/built exact export parity and 329-type structural coverage. Log `/tmp/crc-child-drag-editor-final.log`.
- `node tooling/verify-packed-consumer.mjs` passed installed Bundler/NodeNext consumers, runtime exports, deep-import boundaries, shared core identity and focus elimination. Log `/tmp/crc-child-drag-packed-final.log`.
- Native tests establish circle bounding-corner misses, transformed child hits,
  clipped-out misses, gaps, empty handles, pointer opt-out, child cancellation,
  focus/Escape with and without clips, capture beyond the child, per-grip active
  readouts, applied-position custom formatting and title-only public dragging.

The preview is http://127.0.0.1:5187/#/examples/events-and-interaction/manipulation.
Its visible title bar is now a child of DragHandle; body space does not initiate
movement. The pending unrelated component-positioning regression is preserved.

Documentation gate remains failing: the protected semantic inventory for the
manipulation contract is stale (14 vs 16 units); the earlier approved-design
checksum also needs updating. Automatic approval review rejected the baseline
update, and explicit user approval has been requested. No integrity check was
weakened or bypassed. Log `/tmp/crc-child-drag-docs-final.log`. The earlier full
feature's positioning/pivot integration and aggregate-gate limitations above
remain unresolved; these focused results are not a claim of whole-feature
completion.

## 2026-09-29 current-main integration

The user approved completing integration, reconciling the documentation baseline,
committing, merging to main, and pushing main. The integration checkout starts
from `2288868b` (the current CRC main with the optional Three adapter). Removed
WebGL packages and verifiers were not restored. The current packed and Studio
verifiers retain their Three boundary checks and now cover manipulation.

Fresh evidence from the integration checkout on Node 24.15.0 and pnpm 11.21.0:

- `corepack pnpm@11.21.0 build` and `typecheck` passed.
- Focused manipulation browser tests passed 18 files / 90 tests. Log:
  `/tmp/crc-current-manipulation.log`.
- `node tooling/verify-studio-pivot.mjs` passed exact source/built/editor export
  parity and the public child-defined DragHandle/readout TSX consumer.
- `node tooling/verify-packed-pivot.mjs` passed packed boundaries, Bundler and
  NodeNext consumers, runtime exports and identity checks. Its normal gate now
  also executes all six positioning probes (source/built/packed, DEV true/false),
  which passed. Log: `/tmp/crc-current-packed.log`.
- `studio-docs:check` and `test:studio-docs` passed, including browser navigation
  and search acceptance. The DragHandle API snippet was subsequently clarified
  to show its required ManipulationFrame wrapper.
- Full source browser audit passed 266 files and failed three: 3069 passed,
  four failed, four skipped tests. The four failures reproduce the known
  independent-child placement issue in component positioning, two tutorial
  interactions, and allocated axis labels. Log: `/tmp/crc-current-browser.log`.

The placement correction, final documentation preservation verification, and
aggregate trust run are still in progress. These results do not claim feature
completion or a merge/push.

## 2026-09-29 ordinary-component placement handoff

Parent layout placement remains a translation. A private provenance handoff now
marks only a component's intentionally forwarded `style`, so public style
fields and caller-owned objects remain unchanged. Object styles receive a
private copied symbol that survives `{ ...style }`; style signals retain their
original identity and use element-local metadata. The marker is removed before
primitive style callbacks run and has no public declaration surface.

The handoff records the parent-selected placement fields. A forwarded field is
consumed only when it still equals that parent field. A component may therefore
override `left` or `top` for a child, and an independently authored child
position remains relative to the parent placement. Responsive branches compare
against the parent's prepared snapshot, rather than re-evaluating the original
style in the child allocation.

The public `component-positioning` browser test first failed with an independent
child rectangle painting at `(30, 40)` instead of `(35, 47)`. After the fix it
passes eight cases: direct paint/hit, one-time forwarding, nested Flex/Absolute
placement, independent child offsets, forwarded overrides, signal identity,
responsive forwarding, and divergent parent/child responsive allocations.

Fresh Node 24.15.0 / pnpm 11.21.0 / Playwright Chromium evidence:

- `corepack pnpm@11.21.0 vitest run packages/core/test/component-positioning.test.tsx --browser.headless --browser.ui=false`: eight tests passed.
- `corepack pnpm@11.21.0 vitest run packages/core/test/learning-examples.test.ts packages/core/test/responsive-style-example.test.ts --browser.headless --browser.ui=false`: 210 tests passed.
- `corepack pnpm@11.21.0 scenarios:check` and `corepack pnpm@11.21.0 typecheck` passed.
- Root's fresh affected-oracle rerun passed 56/56 positioning, tutorial, and viz tests.

## 2026-09-29 reviewed Studio visual migration

The Learn landing page and search backdrop gain the manipulation guide link,
adding one 28-pixel row. Their expected/actual captures were inspected before
updating those two baselines. The filter gallery initially exposed an unintended
gradient shift when its local rectangle x coordinate became a presentation
translation. The composite inset now uses a local SvgPath rectangle, preserving
its gradient coordinate system. The focused filter suite passed eight tests.

The normal full Studio route sequence then reproduced the original filter
canvas exactly: all 25,581 remaining different pixels were within the source
editor (x 398–999, y 1457–1966), reflecting the added SvgPath import and shifted
source lines. That artifact was inspected before updating the filter baseline.
No canvas rendering drift was accepted. An isolated-route capture had additional
font differences that did not reproduce in the normal route sequence; awaiting
iframe fonts in a diagnostic capture did not change its canvas pixels.

## 2026-09-29 completion coverage audit

The final audit maps the approved work to current public evidence:

| Plan scope                                | Current implementation and executable evidence                                                                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tasks 1–2: positioning and diagnostics    | `style/positioning.ts`, placement metadata, `component-positioning.test.tsx`, `layout-positioning-diagnostics.test.tsx`, and six source/built/packed DEV probes |
| Task 3: gesture math                      | `manipulation/solve.ts` and its move/resize/constraint/rotation tests                                                                                           |
| Tasks 4–5: controller and runnable slice  | controller/frame/handles, native `manipulation-interaction.test.tsx`, learning example and `manipulation-example.test.ts`                                       |
| Task 6: rotation and complete constraints | solver rotated-anchor/convex-projection tests and `manipulation-rotation.test.tsx`                                                                              |
| Task 7: composition                       | `manipulation-layout.test.tsx` and `manipulation-transforms.test.tsx` cover allocation, nonuniform transforms, fit/density, clips, Layers and filters           |
| Task 8: ownership and performance         | manipulation terminal, ownership, activation and structural performance suites                                                                                  |
| Task 9: migration and consumers           | public contract/guide/API pages, exact editor export parity, packed Bundler/NodeNext consumers, diagnostic environment probes and source migration              |
| Child-defined handles                     | child-hit and child-geometry suites cover painted-child starts, gaps, clips, opt-out, cancellation, capture, focus/Escape and readout ownership                 |
| Readouts                                  | readout, collection, move-readout and Manipulable-readout suites cover containment, states, gap, custom units and one collection label                          |

The current Three pivot renamed the old plan's verification entry points to
`verify-studio-pivot.mjs` and `verify-packed-pivot.mjs`. The manipulation consumer
is incorporated into the existing package-consumer fixtures rather than adding
the originally proposed separate file. Session ownership lives in the controller
rather than a separate `session.ts`. These are implementation organization
changes; removed WebGL packages were not reintroduced.

Fresh built-mode verification after the placement correction passed 19 files /
79 tests, covering public positioning, diagnostics, manipulation and readouts
(`/tmp/crc-built-final-delivery.log`). This is separate from the six explicit
DEV true/false probes; built mode alone is not production-environment evidence.

A subsequent aggregate run stopped at the pre-existing particle replay spatial
overlap assertion (0.7143 versus 0.75). The scenario change only migrates its
text/rectangle positioning fields. Its unchanged focused suite then passed all
four tests (`/tmp/crc-particle-replay-check.log`). The test itself notes possible
one-frame sampling differences under load; no threshold or oracle was weakened.
The aggregate gate must still pass before delivery.

## 2026-09-29 final aggregate verification

`corepack pnpm@11.21.0 trust` completed with exit status 0 on Node 24.15.0,
pnpm 11.21.0, and Playwright Chromium. Full log:
`/tmp/crc-trust-delivery-retry.log`.

- Static checks, documentation preservation (973 mutation probes), catalog,
  typecheck, lint/format, all package builds and source/built Studio builds passed.
- Packed package boundaries, Bundler/NodeNext consumers, runtime identity,
  editor declaration parity and all six positioning environment probes passed.
- Source browser suite: 269 files, 3,080 passed tests, four intentional skips.
- Public documentation navigation/search, visual safeguards, diagram teaser
  and all eight Studio visual baselines passed.
- Built smoke: one test passed.
- Lifecycle: ten files, 43 tests passed.
- Structural performance: seven files, 49 passed tests, four opt-in skips.

The final integration example rendered successfully at
`http://127.0.0.1:5191/#/examples/events-and-interaction/manipulation`.
The in-app browser's input tool rejected the attempted manual drag because of
fractional iframe coordinates, so that attempt is not claimed as gesture proof.
Actual native pointer gestures are verified by the public browser suites above.
The interactive example remains available for hands-on use.

The completion audit's decoration evidence gap is closed by
`manipulation-decoration.test.tsx`: three rendered-output tests verify the
24-CSS-pixel perpendicular connector under nonuniform rotation/scale, explicit
decoration opt-out, and symmetric blue arc fading. Both source and built modes
passed all three. This test-only addition followed aggregate test discovery;
it does not alter the 269-file aggregate count above. Final typecheck and the
new test's lint check were rerun after the addition.
