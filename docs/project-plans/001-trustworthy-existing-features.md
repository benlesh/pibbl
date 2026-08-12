# Project plan 001: Trustworthy existing features

## Purpose

Build high confidence in CRC’s existing `main` API before expanding the framework. User interaction is the highest-risk area, followed by teardown and resource ownership. This phase will make behavior explicit, test it against observable contracts, fix proven correctness or lifecycle problems, and install regression gates.

This is intentionally a limited trust-building phase. It protects later design work from being built on ambiguous event semantics, hidden leaks, or unmeasured hot paths.

## Recommended continuation prompt

> Read `docs/project-plans/WORKFLOW.md` and the active plan named by `docs/project-plans/README.md`. Execute only the step carrying the active next-step marker, meet its completion bar, run its verification, update the markers and decision/session logs, and stop.

## Outcome

At the end of this plan:

- every existing public runtime feature has a documented behavioral contract and meaningful automated evidence;
- CRC’s mouse interaction model is deterministic, as web-compatible as the Canvas abstraction permits, and explicit where it differs;
- event dispatch has measured performance budgets and representative regression workloads;
- every native listener, registry entry, animation frame, hook teardown, offscreen instance, and asynchronous callback has a tested owner and release path;
- every plan step leaves behind a public-API browser scenario that is both manually runnable and exercised by the headless integration suite;
- the scenario catalog is organized as a documentation-ready source of truth that a later docs renderer can consume without rewriting examples;
- visual behavior is guarded by deterministic pixel/state assertions and reviewed expected/actual/diff artifacts rather than screenshot capture alone;
- all direct production and development dependencies are current as of the modernization step, with the lockfile and supported toolchain aligned;
- testing field notes preserve what was learned and identify repeated pain that may justify future CRC-specific test tools;
- the confidence suite, typecheck, lint, builds, and package/playground smoke checks are enforced in CI.

“Complete confidence” does not mean proving the absence of all bugs. It means the supported contract, risk boundaries, tests, performance limits, and cleanup invariants are clear enough that a regression becomes observable.

## Locked scope

### In scope

- The public exports currently present in `packages/core/src/index.ts`.
- Existing mouse events: `click`, `dblclick`, `contextmenu`, `mousemove`, `mouseover`, `mouseout`, `mousedown`, and `mouseup`.
- Hit testing across fills, strokes, transforms, clipping, CSS/canvas scaling, groups, and layers.
- Overlap and ordering semantics for CRC component regions.
- Event registry and listener lifecycle across rerender, subtree removal, abort/dispose, and nested layers.
- Hook/component teardown behavior, scheduled animation frames, image loading, and offscreen canvases.
- Performance behavior of the existing event architecture under representative scale.
- Missing confidence tests and proven fixes for already-shipped components and hooks.
- Direct production and development dependency modernization, including package-manager, language, lint, build, test, browser, utility, and release tooling.
- A focused browser scenario gallery used by both humans and headless integration tests.
- Documentation-ready scenario metadata and organization, without building or publishing the documentation experience in this phase.
- Deterministic visual-regression infrastructure and testing field notes.

### Out of scope

- Adding Pointer Events, touch, keyboard, focus, drag-and-drop, wheel, gesture, accessibility, or pointer capture APIs.
- JSX support, the richer general-purpose playground branch, new drawing primitives, or a new layout system. A focused test-scenario gallery is in scope.
- Public API redesign unrelated to evidence gathered in this phase.
- A spatial index, worker architecture, retained scene graph, or event-system rewrite unless benchmarks show the current approach cannot meet the agreed budget.
- Publication, marketing, a full documentation-site rebuild, or a polished docs renderer. This phase only preserves a clean path from scenario catalog to future documentation.

If evidence suggests an out-of-scope capability is required for correctness, record it as a follow-up rather than silently expanding this plan.

## Baseline

Evidence is summarized in [`../library-status.md`](../library-status.md).

- Committed browser baseline: 70 passed, 4 skipped.
- Full working tree: 85 passed, 4 failed, 4 skipped; all four failures are disputed `mousemove`/`mouseover` ordering expectations in the untracked `crc-event.test.ts`.
- Direct committed test coverage is concentrated in `clip`, `g`, `img`, `layer`, `line`, `rect`, and `text`, with a small direct `crcRef` suite.
- Typecheck and lint are red; package and direct playground builds pass.
- Screenshot capture does not currently compare pixels to approved output.
- Useful unmerged test work remains on the utility-test branch; line and `crcRef` tests were merged into `main` on 2026-08-11 along with lint/typecheck workflows.
- On 2026-08-11, `pnpm outdated -r --format json` reported 32 outdated direct third-party packages, all development dependencies. Major gaps include pnpm 9→11, TypeScript 5→7, Vite 5→8, Vitest 2→4, Playwright 1.49→1.62, ESLint 9→10, and `@antfu/eslint-config` 3→9.

## Operating principles

1. **Characterize before changing.** A disputed expectation becomes a trace and a design decision before it becomes a fix.
2. **Native where analogous.** Match web-platform ordering, transition behavior, coordinates, and lifecycle where CRC exposes an analogous concept.
3. **Explicit where synthetic.** Canvas has one DOM event target, while CRC invents interactive regions. Overlap, component ordering, synthetic propagation, and clipping therefore require documented CRC rules.
4. **Correctness before optimization.** Establish the contract and stable instrumentation before changing the hot path.
5. **Budgets from evidence.** Record baseline distributions on representative workloads, then set regression thresholds. Do not invent a performance number without measurement.
6. **Ownership is testable.** Every acquired resource must have a named owner, release trigger, and deterministic postcondition.
7. **No screenshot-only confidence.** Rendering tests need pixel/state assertions or approved visual comparisons when pixels are the contract.
8. **Fix only proven scope.** Avoid opportunistic rewrites and unrelated features during the trust phase.
9. **One scenario, two modes.** Manual and headless tests must mount and exercise the same public-API scenario implementation.
10. **Notes are a deliverable.** Testing discoveries, stabilization techniques, and repeated helper pain are recorded while context is fresh.
11. **Latest or removed.** Each direct dependency is upgraded to the latest release or removed if unused; retaining an older version requires an explicit blocker and user-approved exception.
12. **Documentation-ready, presentation-neutral.** Scenario content and executable examples must not depend on either the gallery UI, the headless runner, or a future docs renderer.

## Dependency freshness policy

- “Latest” means the current stable registry release at the time the relevant DEP step executes, not only the newest version allowed by the old semver range.
- Production dependencies, development dependencies, catalog entries, `packageManager`, CI-installed tools, and duplicated declarations across workspaces are all in scope.
- Direct packages are upgraded to latest or removed when unused. Major-version migrations are expected and handled by compatibility cluster.
- The lockfile is regenerated from the modernized direct graph so transitive packages resolve as freshly as upstream constraints permit, then deduplicated and checked for peer conflicts.
- Do not force every transitive package to an incompatible version with blanket overrides. If an upstream package constrains an older transitive release, record the chain, risk, and upstream unblocker; add a narrow override only for a demonstrated security/correctness need with integration evidence.
- Freshness, peer-dependency health, deprecations, and security-audit output are separate checks and are all recorded. “Latest” alone is not treated as “safe.”
- Version checks are rerun at the end of DEP-04 because registry state can change during the modernization sequence.

## Web-platform reference direction

The event contract should use executable browser behavior as its primary oracle and these specifications as design references:

- [W3C UI Events](https://www.w3.org/TR/uievents/)
- [W3C Pointer Events — compatibility mapping with mouse events](https://www.w3.org/TR/pointerevents/#compatibility-mapping-with-mouse-events)

The Pointer Events mapping for hover-capable devices dispatches compatibility transition events before the associated `mousemove`. That supports the current WIP expectation of `mouseover` before `mousemove`, but CRC must still characterize real browser traces and decide how its synthetic regions map to a single canvas target. The relative order of some higher-level events such as `contextmenu` is not fully uniform across user agents, so the plan must not claim cross-browser guarantees the platform itself does not provide.

## Confidence bar

A feature is trusted only when all applicable items are true:

- Its supported behavior and intentional non-behavior are written down.
- A public-API scenario can be opened and exercised manually with documented expected results.
- The headless browser suite imports and drives the same scenario.
- Happy paths, boundary cases, updates, errors, and teardown have deterministic assertions.
- Applicable visual output has stable pixel probes or reviewed image comparisons with useful failure diffs.
- Interaction behavior is covered across fill/stroke, transforms, clips, layers, and overlap where applicable.
- Resource counts return to baseline after rerender, removal, abort/dispose, and repeated mount/unmount cycles.
- Performance-sensitive behavior has a representative benchmark and regression threshold.
- Tests fail for a deliberately introduced representative regression.
- The step’s testing field note records lessons and candidate reusable helpers.
- The relevant checks run in CI and are green.

## Integration and visual test contract

This contract applies to **every step in this plan**, including dependency modernization and design-only steps. A step cannot be `[DONE]` unless its row in the evidence matrix is satisfied.

### Shared scenario rule

- Each scenario is authored once against CRC’s public API.
- The local browser gallery imports it and provides instructions, controls, live state/event output, and a reset action.
- The Vitest browser suite imports the same scenario module, mounts it in a real browser, drives it with browser input, and asserts its observable output.
- A small catalog entry organizes each scenario with a stable ID/slug, title, summary, category, API/concept tags, manual steps, expected results, known limitations, source/example reference, and visibility/maturity.
- Keep the executable example core independent from diagnostic chrome. The gallery may add controls and traces around it; a future docs renderer may add prose and navigation; the headless runner may add drivers and assertions.
- Use at least two visibility classes: documentation candidate and test laboratory. Performance/leak diagnostics are not automatically public teaching examples.
- Avoid hand-copying code into documentation metadata. DEP-01 must choose a maintainable source/snippet strategy so future docs show code that is actually exercised.
- A test-only recreation of a manual example does not count as the same scenario.
- Internal unit tests and diagnostic counters are welcome, but each step still needs the public-boundary scenario.

### Future documentation use

- The gallery is the internal complete catalog; future public documentation is a curated projection of documentation-candidate scenarios.
- Documentation pages should be able to group scenarios by component, hook, interaction concept, and learning progression using catalog metadata.
- The future renderer may add narrative guides, API prose, search, and navigation without moving or duplicating executable scenario logic.
- Scenario IDs and public example URLs should be stable once published, but DEP-01 may use provisional routes while the catalog is internal.
- TFC-09 makes component examples documentation-ready; TFC-10 validates catalog completeness and emits a documentation-ready index. Building the polished docs experience remains a later project phase.

### Visual evidence rule

- Stabilize viewport, canvas dimensions, device-pixel ratio, fonts, color profile, fixtures, time, animation, and random inputs before comparing images.
- Prefer targeted pixel/state assertions for small contracts and reviewed screenshot comparison for composed output. Use both when they catch different failures.
- Capture meaningful state transitions—not only the final frame—such as before interaction, hover/active, after update, and after removal. For cursor behavior that screenshots cannot show, assert computed style and expose it in the scenario diagnostics.
- Store or upload expected, actual, and diff images with a useful scenario/test name.
- Keep thresholds tight and justified. Do not use broad tolerances to hide nondeterminism.
- Baseline updates require manual inspection and a field-note explanation; CI must never rewrite baselines.
- Non-visible contracts such as listener counts still need a visible manual panel when that materially helps debugging, but their pass/fail gate remains a semantic assertion.

### Manual evidence rule

Every scenario supplies:

- setup and reset instructions;
- the exact gestures/actions to perform;
- expected event/state order and visual result;
- visible diagnostics useful for comparison;
- known environment limitations.

The completing session must actually run the manual path and record the browser/environment used. “It can be run manually” is not enough.

### Field-note rule

Each step creates or updates `docs/testing/field-notes/<step-id>.md` with:

- scenario and risk being tested;
- manual and headless method;
- visual strategy and stabilization controls;
- surprising failures or browser differences;
- flakes encountered and how they were removed;
- failed or rejected testing approaches;
- helper/tooling friction and recurring patterns;
- candidate test tools, without prematurely building them;
- decisions and follow-ups.

TFC-10 synthesizes repeated observations into a ranked test-tooling opportunity note. A one-off annoyance is not automatically a framework feature.

## Per-step integration evidence matrix

| Step   | Manually runnable scenario                                                                                                 | Headless integration proof using the same scenario                                                              | Visual proof                                                                                                | Primary field-note focus                                                                                              |
| ------ | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| DEP-01 | Organized baseline smoke gallery: mount, render, update, click, reset.                                                     | Public API smoke flow, scenario-loader contract, and catalog metadata validation.                               | Reference rectangle/text/event-panel image plus targeted pixels.                                            | Scenario architecture, documentation-ready metadata, determinism controls, and local/headless parity.                 |
| DEP-02 | Baseline smoke gallery under upgraded package manager, language, and lint stack.                                           | Same smoke flow plus type/build/lint checks.                                                                    | Pre/post-upgrade comparison must be intentionally unchanged.                                                | Migration breaks, type changes, lint-rule churn, and useful upgrade sequencing.                                       |
| DEP-03 | Serve and run the gallery from upgraded built packages.                                                                    | Built-package consumer mounts the same scenario and completes the smoke flow.                                   | Source-mode and built-package images match within the approved deterministic rule.                          | Bundler/plugin changes, package boundary issues, and visual-build differences.                                        |
| DEP-04 | Full smoke gallery under upgraded Vitest/Playwright and remaining tooling.                                                 | Upgraded browser runner drives the exact gallery scenarios and produces failure artifacts.                      | Snapshot/pixel failure is deliberately induced once to prove actual/diff output.                            | Browser-runner API changes, screenshot stability, and artifact ergonomics.                                            |
| TFC-01 | Interaction trace laboratory with native and CRC regions plus lifecycle counters.                                          | Browser-driven trace/counter characterization for the same selectable cases.                                    | Stable trace/counter panel and region rendering; pixels confirm the visible hit geometry.                   | Oracle design, input synthesis, observability seams, and flake sources.                                               |
| TFC-02 | Contract explorer showing approved native and CRC sequences side by side.                                                  | Expected-trace tables are loaded by the explorer and the contract tests.                                        | Sequence/target visualization matches approved contract states.                                             | Platform differences, ambiguous cases, and decision tradeoffs.                                                        |
| TFC-03 | Lifecycle laboratory with rerender, replace-handler, remove, abort/dispose, and reset controls.                            | Repeated browser lifecycle flows assert registry/listener/teardown counts and absence of ghost events.          | Removed regions/cursors disappear and visible counters return to baseline.                                  | Deterministic leak testing, ownership instrumentation, and exactly-once cleanup.                                      |
| TFC-04 | Ordering and overlap laboratory with movement paths and event log.                                                         | Browser gestures assert target, transition, and order traces from the same scene.                               | Overlap/target highlight and trace panel match the selected target model.                                   | Reliable mouse synthesis, ordering assertions, and overlap debugging.                                                 |
| TFC-05 | Geometry matrix for transforms, CSS scaling, clips, groups, and layers.                                                    | Headless pointer paths drive every matrix cell and assert hits/misses.                                          | Reviewed matrix screenshots plus boundary pixel probes and useful diffs.                                    | Canvas/browser coordinate differences and visual threshold discipline.                                                |
| TFC-06 | Performance laboratory with workload selector and live hit-test/latency counters.                                          | Controlled headless benchmark runs the same workloads and structural assertions.                                | A correctness image is checked before timing; metrics UI is manually inspectable but not the timing oracle. | Benchmark noise, warmup, machine metadata, and actionable regression thresholds.                                      |
| TFC-07 | Cleanup stress laboratory for frames, images, layers, hooks, and mount/unmount cycles.                                     | Browser stress controls are driven repeatedly while deterministic resource counts return to baseline.           | Removed content stays absent and lifecycle counters visibly settle at baseline.                             | Async cleanup races, heap-test limitations, and robust resource probes.                                               |
| TFC-08 | Runtime/hook laboratory with state, memo, ref, dependency, key, and removal controls.                                      | Headless interactions assert render counts, identity, values, errors, and cleanup.                              | Visible state/render counters and rendered outputs match contract transitions.                              | Testing hooks without private mocks and separating render from lifecycle evidence.                                    |
| TFC-09 | Complete, documentation-ready drawing-component gallery with supported property/edge-case controls.                        | Headless suite drives the same component cases and checks behavior.                                             | Reviewed baselines, tight diffs, and targeted pixels for every visual contract class.                       | Visual organization, example clarity, docs curation, fixture reuse, meaningful baselines, and false-positive control. |
| TFC-10 | One indexed gallery exposes every trusted scenario and its manual checklist; catalog filters identify future docs content. | CI discovers and runs every registered scenario; an omitted scenario or invalid catalog entry fails validation. | CI publishes named expected/actual/diff artifacts and proves baseline-update safeguards.                    | Repeated pain, candidate tool APIs, docs-readiness gaps, maintenance cost, and recommended next investment.           |

## Initial risk register

These are investigation leads from the current code, not pre-approved implementations:

| Risk                                                                                                              | Why it matters                                                                                                                             | Step that resolves it      |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| Thirty-two direct development dependencies are outdated, many across major versions.                              | Old runners/builders can hide already-fixed browser problems, while one giant upgrade would make compatibility failures hard to attribute. | DEP-01 through DEP-04      |
| Manual examples and headless tests can drift into separate implementations.                                       | A feature may appear correct by hand while automation exercises a simplified test-only path.                                               | DEP-01 and TFC-10          |
| Screenshot capture currently has no approved baseline comparison or deterministic environment contract.           | Tests can pass while pixels are wrong, or become noisy enough that real regressions are ignored.                                           | DEP-01, DEP-04, and TFC-09 |
| Non-hover event handlers are stored in registries but are not visibly attached to component teardown collections. | Removed components may retain closures or receive ghost events until another render happens to clean the slot.                             | TFC-03                     |
| Hover/out hooks add new teardown closures during rerenders.                                                       | Teardown collections may grow even when the visible handler count is stable.                                                               | TFC-03                     |
| Root native listeners rely on an optional `AbortSignal`, and there is no public dispose operation.                | A long-lived canvas can retain listeners and the CRC instance indefinitely.                                                                | TFC-03 and TFC-07          |
| Offscreen layer instances are held in the global instance map without an obvious parent-owned release path.       | Removing layers may retain canvases, component trees, handlers, and closures.                                                              | TFC-07                     |
| Image `onload` callbacks can outlive the component that initiated them.                                           | Late callbacks may retain state or schedule updates after removal.                                                                         | TFC-07                     |
| `crcWhenChanged` registers teardowns in both component and main collections.                                      | Changed dependencies or unmount may execute callbacks more than once or retain old callbacks.                                              | TFC-07                     |
| A mouse move may perform separate hit tests for move, over, out, and cursor behavior on the same path.            | Dense interactive scenes can multiply `getContext`, transform, clip, and path hit-test work.                                               | TFC-06                     |
| Dispatch scans handler sets linearly and fires every matching overlapping region.                                 | Cost is at least proportional to registered handlers, and behavior does not naturally match DOM topmost-target dispatch.                   | TFC-04 and TFC-06          |
| Nested clip hit testing currently succeeds if a point is in any active clip.                                      | Nested Canvas clips normally form an intersection, so input may escape inner clips.                                                        | TFC-05                     |
| Handler set insertion order currently influences `mousemove` versus synthetic `mouseover` order.                  | Rerender or wiring changes can alter observable semantics accidentally.                                                                    | TFC-02 and TFC-04          |

## Status board

| Step   | Queue state | Outcome                                                                                     |
| ------ | ----------- | ------------------------------------------------------------------------------------------- |
| DEP-01 | Done        | Established the shared manual/headless/visual scenario spine and pre-upgrade baseline.      |
| DEP-02 | Done        | Upgraded package manager, TypeScript 7, lint, and formatting without typescript-eslint.     |
| DEP-03 | Done        | Replaced unbuild/Rollup, upgraded Vite, and proved built-package parity.                    |
| DEP-04 | Done        | Upgraded the browser stack and closed dependency freshness, dedupe, peers, and audit.       |
| TFC-01 | Done        | Created shared native/CRC traces, deterministic lifecycle counters, and dispatch baselines. |
| TFC-02 | Done        | Approved a native-informed target, transition, activation, mutation, and geometry contract. |
| TFC-03 | Done        | Made event, listener, frame, cursor, and layer ownership deterministic and leak-safe.       |
| TFC-04 | Done        | Implemented and proved event ordering, transitions, and overlap target selection.           |
| TFC-05 | Done        | Proved intrinsic coordinates, transforms, clip intersections, and global layer paint order. |
| TFC-06 | Done        | Measured and hardened the event hot path with structural and timing budgets.                |
| TFC-07 | Done        | Proved whole-runtime teardown and asynchronous resource cleanup.                            |
| TFC-08 | In progress | Close confidence gaps in the runtime and existing public hooks.                             |
| TFC-09 | Next        | Close confidence gaps in the existing drawing components.                                   |
| TFC-10 | Queued      | Install the trust gate in CI and publish the supported-contract summary.                    |

## DEP-01 [DONE] — Shared scenario spine and pre-upgrade baseline

### Goal

Create the minimum trustworthy integration/visual test spine needed to modernize dependencies safely, then record the exact dependency and behavior baseline.

### Scope in

- Inventory every direct dependency, development dependency, catalog entry, workspace dependency, package-manager declaration, and CI-installed tool.
- Classify each third-party dependency as used-and-upgrade, unused-and-remove, or blocked-with-explicit-reason.
- Record current/latest versions and group upgrades into DEP-02 through DEP-04 compatibility clusters.
- Define the supported Node/toolchain baseline from the latest packages’ engine requirements and align local/CI expectations.
- Create a small scenario module contract against the public `@crc/core` API.
- Define the minimum presentation-neutral catalog metadata and a maintainable executable-source/snippet strategy for later documentation use.
- Create an organized local scenario gallery that mounts the exact scenario module and exposes category/tag navigation, instructions, reset, and live output.
- Create a headless browser smoke test that imports and drives that same module.
- Establish deterministic visual controls and one reviewed expected/actual/diff-capable baseline.
- Capture pre-upgrade results for install, gallery, headless smoke, visual comparison, current committed tests, typecheck, lint, package build, and direct playground build.

### Scope out

- Upgrading dependencies; this step creates the safety rail and exact batches first.
- Fixing pre-existing product behavior, event semantics, typecheck errors, or lint errors unless they prevent the smoke spine from running.
- Building a general-purpose example framework or CRC testing library.
- Building a polished documentation renderer, documentation site, search, or long-form guides.

### Dependencies

- Current locked dependency installation.
- Existing playground and Vitest browser configuration.

### Deliverables

- Dependency inventory with current/latest version, workspace consumer, purpose, compatibility cluster, and removal candidate status.
- Presentation-neutral scenario/catalog contract with visibility/maturity metadata and validation.
- Shared public-API smoke scenario mounted by both the manual gallery and headless test.
- Organized gallery index and a documented future docs-renderer seam; no docs UI is required yet.
- Deterministic visual baseline and actual/diff artifact proof.
- Pre-upgrade verification report.
- `docs/testing/field-notes/dep-01.md`.

### Done when

- Every direct third-party package and catalog entry has a disposition and assigned upgrade cluster.
- The manual gallery and headless test demonstrably import the same smoke scenario implementation.
- Catalog metadata can be imported and validated without importing gallery UI, Vitest, or a future docs framework.
- The smoke scenario is classified as a documentation candidate or test laboratory with a recorded reason, and its displayed code cannot silently drift from the executable example.
- A developer can follow the documented gestures and observe the expected render/update/click/reset behavior.
- The headless test asserts that behavior and a visual regression produces inspectable actual/diff artifacts.
- Pre-existing red checks are recorded without being confused with dependency-upgrade regressions.
- The DEP-01 row of the integration evidence matrix and its field note are complete.

### Verification

- Run the smoke scenario manually in the documented browser and record environment/version.
- Run the focused headless smoke and visual test repeatedly at least 10 times.
- Run and record `pnpm outdated -r --format json`.
- Run install, committed baseline tests, typecheck, lint, package build, and direct playground build.

## DEP-02 [DONE] — Package manager, language, types, lint, and formatting

### Goal

Upgrade the foundational developer toolchain to latest releases while keeping the shared scenario behavior and visual output stable.

### Scope in

- pnpm in `packageManager`, direct dependencies, lockfile metadata, local instructions, and CI setup.
- TypeScript, Node type declarations, and `vue-tsc` or its justified removal if Vue typechecking is not required.
- ESLint, `@antfu/eslint-config`, formatting plugins, and Prettier.
- Configuration/API migrations required by those latest versions.
- Removal of unused packages in this cluster rather than upgrading dead weight.

### Scope out

- Vite/Rollup/unbuild upgrades (DEP-03).
- Vitest/Playwright upgrades (DEP-04).
- Product behavior changes unrelated to compatibility.

### Dependencies

- DEP-01 baseline and shared scenario spine.

### Deliverables

- Latest compatible declarations/configuration for this cluster and regenerated lockfile.
- Upgrade notes with breaking changes and repository adaptations.
- Updated manual/headless/visual smoke evidence.
- `docs/testing/field-notes/dep-02.md`.

### Done when

- Each dependency in this cluster is at latest or removed as unused; no silent old-version exception remains.
- Package-manager declarations and CI setup agree.
- New tool errors are resolved; pre-existing product/test errors are either fixed narrowly or separately identified with evidence.
- The same manual and headless scenario passes with intentionally unchanged visual output.
- The DEP-02 evidence-matrix row and field note are complete.

### Verification

- Fresh frozen-lockfile install with the upgraded package manager.
- Manual smoke scenario.
- Focused headless/visual smoke.
- Typecheck, lint, committed browser suite, and package/playground builds.

## DEP-03 [DONE] — Build, bundling, and package tooling

### Goal

Upgrade the build and bundling stack to latest releases and prove both source-mode and built-package behavior through the same browser scenario.

### Scope in

- Vite and `vite-tsconfig-paths`.
- Rollup and all Rollup plugins.
- unbuild and declaration/package output.
- Build-only utilities directly coupled to these tools.
- Current package exports, declarations, source maps, and consumer loading under the new stack.
- Removal of redundant or unused build dependencies.

### Scope out

- Vitest/Playwright upgrades (DEP-04).
- Package API redesign, new output formats, or bundler rewrites without a compatibility requirement.

### Dependencies

- DEP-02 current foundational toolchain.

### Deliverables

- Latest build/bundling dependencies and migrated configuration.
- Built-package consumer fixture that imports and mounts the shared smoke scenario.
- Source-versus-built visual/behavior comparison.
- `docs/testing/field-notes/dep-03.md`.

### Done when

- Each dependency in this cluster is latest or removed as unused.
- Clean package builds produce importable ESM and declarations.
- The manual gallery can run against built output, and the headless consumer drives the same scenario successfully.
- Source-mode and built-package behavior/visuals match under the approved rule.
- The DEP-03 evidence-matrix row and field note are complete.

### Verification

- Fresh install and clean package build.
- Built-package consumer smoke.
- Manual source/built gallery comparison.
- Focused headless/visual smoke, full committed browser suite, typecheck, and lint.

## DEP-04 [DONE] — Browser-test stack and dependency freshness closure

### Goal

Upgrade the browser test stack and remaining direct tooling, prove the visual/integration workflow on the new APIs, and finish with no outdated direct dependency.

### Scope in

- Vitest, `@vitest/browser`, and `@vitest/ui` at one compatible latest version.
- Playwright and browser installation/configuration.
- Remaining direct utilities and release/developer tools not owned by DEP-02 or DEP-03.
- Current test API/config migrations and artifact paths.
- Visual comparison behavior, expected/actual/diff artifacts, retries, timeouts, and browser lifecycle.
- Direct dependency freshness verification, lockfile refresh, and audit review.
- Transitive deduplication, peer-dependency review, deprecation review, and documented upstream constraints that prevent a transitive latest release.

### Scope out

- Product event semantics and broad test-suite redesign; those begin at TFC-01.
- Adding browsers beyond the plan’s chosen reference browser unless required to validate the upgraded runner.

### Dependencies

- DEP-03 built-package scenario and current build stack.

### Deliverables

- Latest browser-test and remaining direct tooling dependencies, or removal of unused packages.
- Migrated headless/UI test configuration and reliable visual artifact pipeline.
- Dependency freshness report and any explicit blocked exception requiring user approval.
- `docs/testing/field-notes/dep-04.md`.

### Done when

- `pnpm outdated -r --format json` reports no outdated direct dependency, unless the user has explicitly accepted a documented external blocker.
- No direct dependency remains merely because migration was inconvenient; unused packages are removed.
- The regenerated lockfile is deduplicated, peer conflicts are resolved or explicitly blocked, and any older transitive package has a documented upstream constraint rather than a forgotten lockfile entry.
- The same public-API smoke scenario runs manually, headlessly, from built output, and through visual comparison.
- A deliberately introduced pixel regression fails and yields inspectable actual/diff artifacts; the baseline is then restored intentionally.
- Install, committed tests, typecheck, lint, builds, and audit status are recorded under the modernized stack.
- The DEP-04 evidence-matrix row and field note are complete.

### Verification

- Fresh frozen-lockfile install using the declared package manager.
- Manual gallery and built-package smoke.
- Focused and full headless browser suites.
- Visual-regression failure-artifact drill.
- Typecheck, lint, package/playground builds, `pnpm outdated -r --format json`, and dependency audit review.

## TFC-01 [DONE] — Characterization harness and frozen baseline

### Goal

Create reusable instrumentation that shows what the current implementation and a native browser actually do, without prematurely changing disputed semantics.

### Scope in

- Preserve and adapt the existing untracked `crc-event.test.ts`; establish ownership before editing it.
- Add an event-trace helper that records type, order, coordinates, target region, button, and transition state.
- Add native DOM reference fixtures for movement into, within, between, and out of regions, plus primary click sequences.
- Add deterministic diagnostic access for tests to count CRC instances, native listeners, registry handlers by event type, component teardown entries, and scheduled frames.
- Record baseline counts across initial render, 100 rerenders, handler replacement, subtree removal, abort, and nested layer creation/removal.
- Record baseline dispatch cost and hit-test call counts for 0, 100, 1,000, and 10,000 simple interactive regions. These are characterization workloads, not final budgets.

### Scope out

- Changing public semantics, optimizing the dispatcher, or fixing every leak found.
- Adding pointer/touch support.
- Making nondeterministic garbage collection a pass/fail requirement.

### Dependencies

- DEP-04 modernized toolchain and shared scenario spine.
- Current Chromium/Vitest browser harness.
- Agreement that the untracked event test can be incorporated or replaced without losing user work.

### Deliverables

- Reusable event trace/oracle fixture.
- Reusable deterministic lifecycle counters available only to tests.
- Interaction trace laboratory mounted from the same scenario modules used by the headless characterization suite.
- A baseline report committed near the tests or under `docs/design/`.
- Existing failing expectations labeled as characterization or linked to an open decision; no ambiguous red tests.
- `docs/testing/field-notes/tfc-01.md`.

### Done when

- The committed baseline and the new characterization suite run repeatably in headless Chromium.
- Native and CRC traces exist for enter/move/leave and click-family sequences.
- Registry/listener/teardown/instance counts are captured before and after each lifecycle transition.
- Performance baselines include median and tail observations plus hit-test counts for each workload.
- No supported behavior has been changed merely to make a characterization test green.
- The TFC-01 integration-evidence row is manually exercised, green headlessly, visually reviewed, and documented in its field note.

### Verification

- Run the focused characterization suite repeatedly (minimum 10 local iterations) without flakes.
- Run the interaction trace laboratory manually using its documented movement/click sequences.
- Run `pnpm test:ci`, recording pre-existing unrelated failures separately.
- Confirm test-only diagnostics are absent from production exports and built artifacts.

## TFC-02 [DONE] — Mouse interaction semantics decision

### Goal

Turn the traces into an explicit, reviewable interaction contract before implementation changes.

### Scope in

- Decide `mouseover`/`mousemove`/`mouseout` transition order.
- Define entering, moving within, moving between, and leaving interactive regions and the canvas.
- Define overlap target selection: topmost-only, all hits, or target-plus-ancestor propagation.
- Define paint order, group ancestry, clipping, layers, and `lineInteractionWidth` in target selection.
- Define handler replacement/removal during dispatch, component removal during dispatch, and thrown-handler behavior.
- Define click, double-click, right-click/context-menu, down/up, and canvas-exit expectations where the platform gives usable guidance.
- Define coordinate behavior under CSS scaling and Canvas transforms.
- Record which semantics intentionally differ from DOM and why.

### Scope out

- Pointer/touch APIs, capture/bubble phases, `stopPropagation`, `preventDefault`, or pointer capture unless the existing API cannot be coherent without a minimal equivalent.
- Implementation or performance optimization.

### Dependencies

- TFC-01 traces and native-browser fixtures.

### Deliverables

- `docs/design/mouse-interaction-contract.md` with decision table, examples, non-goals, and unresolved follow-ups.
- Approved expected traces consumed by later tests.
- Contract explorer that renders the same approved trace tables used by the headless contract suite.
- A decision on the four current event-order failures.
- `docs/testing/field-notes/tfc-02.md`.

### Done when

- Every current mouse event has a supported sequence and hit-target rule.
- Every canvas-specific behavior has either an explicit rule or an explicitly unsupported case.
- Contract examples cover overlap, nested groups, clips, transforms, layers, and canvas exit.
- The decision log records evidence and tradeoffs, not just conclusions.
- The TFC-02 integration-evidence row is manually exercised, green for its approved oracle assertions, visually reviewed, and documented in its field note.

### Verification

- Review each contract trace against TFC-01’s native fixture where analogous.
- Run the contract explorer manually and the native/CRC oracle scenarios headlessly from the same trace definitions.
- Convert disputed WIP expectations to approved expected traces, without yet requiring the current implementation to pass them.

## TFC-03 [DONE] — Event ownership and teardown safety

### Goal

Ensure every event-related resource has one owner and is released exactly once.

### Scope in

- Native canvas listeners.
- Root and layer event registries.
- Per-component handler closures and hover state.
- Handler replacement on rerender and removal when handler props disappear.
- Subtree removal, layer removal, abort, and an explicit internal/public disposal decision.
- Idempotent cleanup and error isolation.

### Scope out

- Final overlap/order implementation beyond what ownership requires.
- Hot-path optimization not necessary to eliminate unbounded growth.

### Dependencies

- TFC-01 lifecycle counters.
- Relevant ownership decisions from TFC-02.

### Deliverables

- One ownership table mapping resource → owner → acquisition → release trigger → postcondition.
- Implementation fixes for proven event lifecycle leaks.
- Focused rerender/removal/abort/repeated-cycle regression tests.
- Lifecycle laboratory using the same scenario modules as the headless lifecycle suite.
- `docs/testing/field-notes/tfc-03.md`.

### Done when

- Handler and teardown counts remain stable across 1,000 unchanged rerenders.
- Replacing/removing a handler leaves exactly the expected registry entry count and no ghost calls.
- Removing a subtree or layer returns registries and child instances to baseline.
- Abort/dispose removes native listeners and makes subsequent cleanup harmless.
- Every event teardown is observed to run once, including when a handler throws.
- The TFC-03 integration-evidence row is manually exercised, green headlessly, visually reviewed, and documented in its field note.

### Verification

- Focused lifecycle suite with deterministic counts.
- Manually run rerender, replace, remove, abort/dispose, and reset flows in the lifecycle laboratory.
- Repeated mount/update/remove/dispose stress loop.
- Full test suite, typecheck, and lint for touched files.

## TFC-04 [DONE] — Event ordering, transitions, and target selection

### Goal

Implement the approved interaction sequence and synthetic-target rules before adding geometry composition.

### Scope in

- Event order and region transitions.
- Overlapping siblings and nested component ancestry.
- Basic fill, stroke, combined fill+stroke, transparent/no-hit shapes, and interaction widths on an untransformed root canvas.
- Component reordering/removal and handler changes during or between events.
- Cursor behavior derived from the same target result as other interactions.

### Scope out

- Transforms, CSS scaling, clipping, and offscreen layers; those are isolated in TFC-05.
- Performance architecture beyond avoiding obvious duplicate work introduced by correctness changes.
- New event types.

### Dependencies

- TFC-02 approved contract.
- TFC-03 stable ownership model.

### Deliverables

- Contract-driven interaction tests, preferably table-based rather than duplicated per component.
- Implementation fixes for target resolution, transitions, overlap, and order on the root canvas.
- Ordering/overlap laboratory driven from the same scenarios as the headless trace suite.
- Deleted or rewritten assertions that encoded rejected semantics, with the decision referenced.
- `docs/testing/field-notes/tfc-04.md`.

### Done when

- All contract traces pass deterministically.
- The original four ordering failures are resolved by an explicit design decision and green test.
- Overlapping targets, movement between sibling/ancestor targets, canvas exit, and handler changes have positive and negative tests.
- Cursor and event targeting cannot disagree for the same point and render state.
- The TFC-04 integration-evidence row is manually exercised, green headlessly, visually reviewed, and documented in its field note.

### Verification

- Focused interaction suite repeated at least 20 times headlessly.
- Manually run every documented movement path in the ordering/overlap laboratory.
- Full browser suite.
- Cross-check the native oracle fixtures in current Chromium; record deliberate CRC differences.

## TFC-05 [DONE] — Event geometry and composition correctness

### Goal

Prove that the TFC-04 target and transition rules remain correct across the coordinate systems and composition features that make Canvas interaction difficult.

### Scope in

- Canvas CSS scaling and mouse-to-backing-store coordinate conversion.
- Nested group translation, rotation, scale, and skew.
- Nested clips as intersections, including `evenodd` holes.
- Groups inside clips and clips inside transformed groups.
- Offscreen layers, nested layers, layer dimensions, and parent event forwarding.
- Positive, boundary, and negative hit cases for fill and stroke interaction widths.

### Scope out

- Changing TFC-04’s approved target/overlap model.
- Hot-path optimization beyond removing accidental correctness defects.
- New geometry or layout features.

### Dependencies

- TFC-04 stable target and transition implementation.

### Deliverables

- Shared geometry-composition interaction matrix rather than one-off component cases.
- Correct transform/clip/layer hit-testing implementation.
- Manually navigable geometry matrix imported by the headless matrix suite.
- Enabled or replaced nested-clip and multi-layer interaction tests.
- `docs/testing/field-notes/tfc-05.md`.

### Done when

- The same interaction trace is produced for equivalent untransformed, transformed, CSS-scaled, clipped, grouped, and layered targets.
- Nested clips enforce intersection semantics, including negative tests outside any active clip and inside `evenodd` holes.
- Layered targets do not double-dispatch or lose canvas coordinates.
- Boundary and stroke-width cases are deterministic at device-pixel and CSS-pixel scales used by the suite.
- The TFC-05 integration-evidence row is manually exercised, green headlessly, visually reviewed, and documented in its field note.

### Verification

- Focused geometry interaction matrix repeated at least 20 times headlessly.
- Manually exercise representative positive, boundary, and negative cells in every geometry class.
- Full browser suite.
- Targeted pixel/state assertions confirm that tested geometry matches rendered geometry.

## TFC-06 [DONE] — Event hot-path performance

### Goal

Measure, simplify, and guard the interaction hot path without speculative architecture.

### Scope in

- Mousemove dispatch at 0, 100, 1,000, and 10,000 interactive regions.
- Sparse-hit, dense-overlap, clipped, transformed, layered, and cursor-enabled workloads.
- Registration/update cost across repeated renders.
- Hit-test count, `getContext`/save/restore/transform work, allocation pressure, and duplicate tests of the same path/point.
- Algorithmic complexity and degradation curves.
- A documented decision on whether linear scanning remains acceptable for the current scale.

### Scope out

- Spatial indexing or scene-graph rewrites unless evidence and the approved budget require one.
- Micro-optimizations without a measurable workload-level effect.

### Dependencies

- TFC-05 stable semantics and geometry-composition implementation.

### Deliverables

- Reproducible benchmark/stress harness with machine/environment metadata.
- Manually navigable performance laboratory using the same workload definitions as the headless benchmark.
- Baseline and post-change results with median, p95/p99 where meaningful, and hit-test counts.
- Explicit budgets and regression thresholds justified by measurements.
- Focused optimizations for proven bottlenecks.
- `docs/testing/field-notes/tfc-06.md`.

### Done when

- Complexity is documented for registration, rerender, click, and movement paths.
- No unchanged rerender causes unbounded registration or teardown growth.
- Each representative workload meets the agreed budget on the reference environment.
- A deliberate performance regression fails the benchmark guard or structural counter assertion.
- Any deferred spatial-index/rewrite work has a measured trigger, not a vague recommendation.
- The TFC-06 integration-evidence row is manually exercised, green headlessly, visually reviewed for correctness, and documented in its field note.

### Verification

- Run benchmarks in a controlled headless-browser configuration with warmup and repeated samples.
- Run each workload class manually and confirm visible correctness/counters before trusting timing output.
- Run correctness tests before and after optimization.
- Save a concise result table rather than committing volatile raw dumps.

## TFC-07 [DONE] — Whole-runtime teardown and resource cleanup

### Goal

Prove that the component runtime releases all non-event resources and cannot update dead instances.

### Scope in

- `Teardowns.follow/add/remove/execute` semantics and exactly-once behavior.
- Component removal, keyed replacement, root replacement, abort/dispose, and repeated mount/unmount.
- `crcWhenChanged` dependency changes and returned cleanup ownership.
- Pending `requestAnimationFrame` callbacks.
- Image loads, source changes/races, errors, and removal before completion.
- Offscreen layer instances, nested layers, parent removal, and event-forwarding cleanup.
- Global instance/ref/state maps returning to baseline.

### Scope out

- General-purpose effect APIs or new async abstractions.
- GC assertions as the sole proof of cleanup.

### Dependencies

- TFC-01 counters and TFC-03 ownership pattern.

### Deliverables

- Runtime-wide resource ownership table.
- Deterministic cleanup tests plus optional CDP heap/allocation diagnostics.
- Cleanup stress laboratory using the same scenario controls as the headless stress suite.
- Implementation fixes for double cleanup, missing cleanup, late callbacks, and retained child instances.
- `docs/testing/field-notes/tfc-07.md`.

### Done when

- Every resource named in scope has an acquisition/release test.
- Cleanup is idempotent and executes exactly once at the intended boundary.
- Repeated mount/unmount and layer add/remove cycles return deterministic counts to baseline.
- Late image/state callbacks cannot update a disposed or removed instance.
- Pending frames are canceled or become safe no-ops after disposal.
- The TFC-07 integration-evidence row is manually exercised, green headlessly, visually reviewed, and documented in its field note.

### Verification

- Focused lifecycle suite with at least 1,000 repeated cycles for deterministic counters.
- Manually run frame, image, layer, hook, and repeated mount/unmount cleanup cases.
- Optional heap comparison used as supporting evidence only.
- Full browser suite, typecheck, lint, and build.

## TFC-08 [IN PROGRESS] — Runtime and hook confidence sweep

### Goal

Apply the confidence bar to the component runtime and existing public hooks without adding features.

### Scope in

- Runtime/component identity: `crc`, `defineComp`, keys, tree updates, and removal.
- Hooks: state, memo, ref, change callback, and memoized path hooks.
- Falsy children, sibling identity, keyed insertion/reordering/removal, hook ordering, root updates, and misuse/error paths.
- The committed `crcRef` tests and existing utility-test branch as sources to review, strengthen, and selectively integrate.

### Scope out

- Drawing-component edge cases, which are isolated in TFC-09.
- JSX, pointer/touch, or a new runtime abstraction.
- Chasing raw coverage percentage without contract value.

### Dependencies

- TFC-04 interaction helper matrix.
- TFC-07 lifecycle rules.

### Deliverables

- Runtime and hook contract tables linked to contract-driven tests.
- Narrowly proven lifecycle/state/memo/ref/path-hook fixes.
- Public API type tests for runtime and hooks.
- Runtime/hook laboratory imported by the headless runtime/hook suite.
- `docs/testing/field-notes/tfc-08.md`.

### Done when

- `crc`, `defineComp`, and every current public hook have direct or deliberately shared contract coverage.
- Identity, update, removal, hook-order, and error paths have deterministic assertions.
- The committed ref coverage and utility branch work are reviewed so useful tests are strengthened or integrated without blindly merging stale changes.
- Focused runtime/hook tests, typecheck, and lint are green.
- The TFC-08 integration-evidence row is manually exercised, green headlessly, visually reviewed, and documented in its field note.

### Verification

- Full browser suite.
- Manually exercise state, memo, ref, dependency, key, update, and removal controls.
- Typecheck and lint.

## TFC-09 [NEXT] — Drawing-component confidence sweep

### Goal

Apply the confidence bar to every existing drawing component and its supported property combinations.

### Scope in

- `path`, `line`, horizontal/vertical lines, SVG paths, rect, text, image, group, clip, and layer.
- Alpha-zero, transparent styles, empty/negative geometry, property updates, pixel-grid modes, and malformed/boundary inputs.
- Text overflow/alignment/wrapping and interaction bounds.
- Image success, failure, source races, natural/explicit dimensions, and removal.
- The committed line tests and existing utility-test branch as sources to review, strengthen, and selectively integrate.
- Pixel assertions or approved visual comparisons where appearance is the contract.

### Scope out

- New primitives, layout features, JSX, or a documentation-site rebuild.
- Chasing raw coverage percentage without contract value.

### Dependencies

- TFC-05 interaction geometry matrix.
- TFC-07 lifecycle rules.
- TFC-08 runtime/hook contracts.

### Deliverables

- Updated feature inventory showing every drawing export at the confidence bar or explicitly unsupported.
- Contract-driven component tests and narrowly proven fixes.
- Complete component gallery imported by the headless component suite.
- Documentation-candidate metadata, learning order, and clear executable examples for every supported drawing component; diagnostic-only cases remain explicitly classified as test laboratories.
- Zero skipped tests for supported behavior; any skip requires a named platform limitation and follow-up.
- `docs/testing/field-notes/tfc-09.md`.

### Done when

- Every current drawing export has direct or deliberately shared contract coverage.
- Every supported drawing component has at least one documentation-candidate scenario whose public example is readable without test diagnostics.
- All four previously skipped committed tests are fixed/enabled or replaced by stronger contract tests.
- Rendering tests assert pixels/state instead of only writing screenshots.
- Alpha, styles, updates, geometry boundaries, text variants, image failure/races, clips, and layers have explicit supported behavior.
- Full browser suite, typecheck, lint, package build, and playground build are green.
- The TFC-09 integration-evidence row is manually exercised, green headlessly, visually reviewed, and documented in its field note.

### Verification

- Full browser suite.
- Manually review every component class and its documented visual/interaction edge cases in the gallery.
- Typecheck and lint.
- Package and direct playground builds.
- Built-package consumer smoke test.

## TFC-10 [TODO] — Trust gate and supported-contract handoff

### Goal

Make the achieved confidence durable for every future change.

### Scope in

- CI jobs for browser tests, lifecycle stress tests, typecheck, lint, builds, and consumer/playground smoke checks.
- Stable structural performance assertions on every PR and a documented cadence/environment for noisier timing benchmarks.
- Supported behavior, intentional differences from the web platform, performance envelope, disposal expectations, and known limitations.
- Final review of the feature inventory and risk register.

### Scope out

- Full end-user documentation site or release campaign.
- New product features.

### Dependencies

- DEP-01 through DEP-04 complete.
- TFC-01 through TFC-09 complete.

### Deliverables

- Green required CI trust gate.
- Indexed manual scenario gallery with manifest validation shared by CI.
- Documentation-ready catalog index grouped by API, concept, category, learning progression, and visibility/maturity.
- Final mouse interaction contract and runtime cleanup contract.
- Updated `library-status.md` with evidence and remaining known limitations.
- Follow-up backlog containing only measured or explicitly deferred work.
- `docs/testing/test-tooling-opportunities.md` synthesizing repeated field-note evidence.
- Documentation follow-up brief describing the future renderer/navigation work without duplicating scenario logic.
- `docs/testing/field-notes/tfc-10.md`.

### Done when

- A fresh checkout can install and run the documented trust gate.
- CI has no skipped supported-behavior tests and no ignored red checks.
- Performance thresholds and the environment/cadence for timing benchmarks are documented.
- The risk register is closed or each remaining item is explicitly accepted/deferred with evidence.
- Every trusted scenario has valid organization metadata; every documentation candidate has readable public-API source, manual instructions, expected behavior, and a stable intended URL/slug before publication.
- This plan is marked complete and ready for archive rollover.
- The TFC-10 integration-evidence row is manually exercised, green headlessly, visually reviewed, and documented in its field note.

### Verification

- Run the exact clean-checkout command sequence documented for contributors.
- Manually traverse the complete scenario index and verify every checklist remains usable.
- Confirm CI results on the plan’s final change.
- Review contract docs against public exports and tests one final time.

## Decision log

| Date       | Decision                                                                                                                 | Evidence / rationale                                                                                                                                                                                                                                                                                                                                                       | Revisit trigger                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-11 | Use native-browser traces first, current W3C specifications second, and explicit CRC rules for Canvas-only concepts.     | CRC regions are synthetic targets inside one DOM canvas, so specs guide but cannot completely determine overlap/propagation behavior.                                                                                                                                                                                                                                      | A new input model or public event API is proposed.                                                                                                                           |
| 2026-08-11 | Correctness and deterministic ownership precede event optimization.                                                      | Optimizing before the target/order contract is stable risks preserving or accelerating incorrect behavior.                                                                                                                                                                                                                                                                 | None within this phase.                                                                                                                                                      |
| 2026-08-11 | Do not make garbage collection timing a required test signal.                                                            | GC and finalization timing are nondeterministic; registry/listener/instance counters provide a reliable primary invariant.                                                                                                                                                                                                                                                 | A stable engine-specific memory harness becomes available.                                                                                                                   |
| 2026-08-11 | Defer pointer/touch expansion and large event-architecture rewrites.                                                     | The current goal is confidence in existing features; measurements in TFC-06 will provide a defensible trigger for larger architecture.                                                                                                                                                                                                                                     | Current mouse semantics cannot be made coherent, or measured workloads miss the agreed budget.                                                                               |
| 2026-08-11 | Every step must add or extend a scenario shared by the manual browser gallery and headless suite.                        | Separate examples and tests drift; one public-API scenario source makes manual evidence and automation directly comparable.                                                                                                                                                                                                                                                | The shared module contract materially prevents realistic browser interaction or isolation.                                                                                   |
| 2026-08-11 | Visual confidence requires deterministic comparisons and inspected diffs, not screenshot capture alone.                  | The current helper writes images without deciding whether rendered output is correct.                                                                                                                                                                                                                                                                                      | A non-image visual assertion proves a specific contract more directly; it may supplement or replace a screenshot with an explanation.                                        |
| 2026-08-11 | Record one testing field note per step and defer test-tool construction until patterns recur.                            | The testing process is itself discovery work; preserving friction and failed approaches will provide evidence for useful tools without prematurely designing them.                                                                                                                                                                                                         | TFC-10 synthesis finds no recurring opportunity worth maintaining.                                                                                                           |
| 2026-08-11 | Modernize every direct dependency before feature-confidence work, in four compatibility clusters.                        | The freshness audit found 32 outdated direct development dependencies with several major-version jumps. Clustered upgrades keep regressions attributable while shared scenarios protect behavior.                                                                                                                                                                          | A latest release is externally blocked or incompatible; retaining the older version requires an explicit user-approved exception.                                            |
| 2026-08-11 | Make the scenario catalog the future documentation source of truth, but keep scenario logic independent of presentation. | The same executable examples can serve manual testing, headless integration, and later documentation without three drifting copies. A curated visibility flag prevents diagnostic stress labs from becoming confusing public docs.                                                                                                                                         | A later docs phase demonstrates that the catalog cannot express a required teaching format without harming test isolation.                                                   |
| 2026-08-11 | Use a lazy, identity-checked scenario loader and display the exact executable example source.                            | Eager metadata imports and free-form source paths allow gallery, tests, and displayed code to drift. The loaded ID, action IDs, source ID/path, and raw source marker now agree before mounting.                                                                                                                                                                           | The catalog grows beyond what typed lazy entries and the Vite raw-source adapter can maintain clearly.                                                                       |
| 2026-08-11 | Target Node 24.15+ LTS and pnpm 11; treat TypeScript 7 as an explicit upstream compatibility blocker.                    | The resolved Antfu 9 graph raises the Node floor to 24.15; latest typescript-eslint and unbuild peer ranges do not support TypeScript 7.                                                                                                                                                                                                                                   | Upstream peer ranges add TypeScript 7 support, or the user approves TypeScript 5.9.3 as the documented temporary exception.                                                  |
| 2026-08-11 | Remove the typescript-eslint dependency chain and unbuild instead of retaining TypeScript 5.9.3.                         | The user explicitly rejected the temporary compiler exception. A lint parser and package build path that do not consume TypeScript's removed programmatic API can support registry-latest TypeScript 7 without forced peers.                                                                                                                                               | The replacement loses a required lint or package-output contract, or a supported TypeScript 7 programmatic tool becomes preferable.                                          |
| 2026-08-11 | Compare DEP-01 visuals exactly outside documented system-font glyph masks.                                               | Canvas/system Arial rasterization is platform-dependent; semantic text/state assertions plus tight glyph-only masks preserve structural pixel confidence without a broad tolerance.                                                                                                                                                                                        | A bundled deterministic font is added, or glyph appearance becomes a supported visual contract.                                                                              |
| 2026-08-11 | Let TypeScript own TypeScript semantics and use Babel only for ESLint syntax parsing.                                    | Babel 8 parses TypeScript 7 syntax without the removed compiler API, but its scope model produces type-space false positives. Compiler unused/undefined checks preserve correctness without a second TypeScript implementation.                                                                                                                                            | ESLint gains a TypeScript 7-native scope implementation with a material rule benefit.                                                                                        |
| 2026-08-11 | Build runtime ESM with esbuild and declarations with the TypeScript CLI; guard built mode against source leakage.        | The replacement preserves bundled `.mjs`, declarations, source maps, Node loading, Bundler/NodeNext types, and byte-identical source/built visuals without unbuild or the dead Rollup graph.                                                                                                                                                                               | Package output requirements expand beyond ESM/declarations, or a supported build tool gives stronger evidence with less custom wiring.                                       |
| 2026-08-11 | Keep strict peers and close security findings rather than weakening install policy.                                      | Atomic Vite/Vitest migration resolved the peer boundary; a current `tsx` peer pin and one in-range `defu` override removed the remaining audit findings. Outdated, dedupe, peer, deprecation, and audit checks are now clean.                                                                                                                                              | An upstream release removes the need for the `defu` override or Vite no longer needs the explicit `tsx` peer pin.                                                            |
| 2026-08-11 | Keep deterministic runtime diagnostics test-only and freeze defects as characterization before fixing them.              | A test-owned observer measures the selected Canvas graph without shipping diagnostic hooks; native/CRC traces and resource tables expose ordering, teardown growth, ghost handlers, retained layers, and frame state without changing semantics.                                                                                                                           | A supported runtime diagnostics API becomes a product requirement, or the owning TFC steps intentionally replace a frozen baseline.                                          |
| 2026-08-11 | Model one event-type-independent logical region target in reverse paint order, without synthetic DOM propagation.        | Native hit testing is topmost-first, while CRC lacks target/currentTarget, event phases, and propagation controls. Invoking all geometric hits would neither match user expectations nor form a coherent DOM subset.                                                                                                                                                       | CRC adds a public scene ancestry and propagation API.                                                                                                                        |
| 2026-08-11 | Dispatch logical boundary transitions before movement and snapshot handlers separately for each logical event.           | Executable native traces produce out → over → move; DOM clones listeners per dispatched event, honors removals, and reports thrown callbacks without ending iteration.                                                                                                                                                                                                     | Cross-browser evidence or a public cancellation model requires a deliberate ordering change.                                                                                 |
| 2026-08-11 | Preserve measured browser activation/context behavior instead of inventing one universal sequence.                       | Reference Chromium clicks after leave/re-entry when down, up, and click resolve to the same live target, and emits secondary down → contextmenu → up on macOS. Pointer Events leaves hysteresis and high-level context ordering browser-dependent.                                                                                                                         | Supported browsers demonstrate an incompatible behavior that CRC must normalize explicitly.                                                                                  |
| 2026-08-11 | Keep logical related targets diagnostic-only and treat pathless `crcEvent` hooks as Canvas-wide observers.               | `originalEvent.relatedTarget` describes DOM targets around the Canvas and cannot represent synthetic regions. A no-path hook is an existing whole-Canvas use case, not a geometric target or implicit bubbling phase.                                                                                                                                                      | The public event type gains target/relatedTarget or a formal root propagation contract.                                                                                      |
| 2026-08-11 | Give each CRC mount one identity-guarded controller and make every event resource follow exactly one teardown owner.     | A stable additive `CRCController`, mount-only signal, explicit native-listener/frame releases, replaceable event-slot bindings, owned cursor token, and layer-child cascade make exact acquisition/release ledgers deterministic.                                                                                                                                          | A future lifetime API needs signal replacement, or TFC-07 finds a resource that cannot follow the same ownership model.                                                      |
| 2026-08-11 | Keep one stable handler-and-cursor region per component path; keep Canvas cursor defaults outside hit testing.           | The shared root-Canvas lab proves reverse-paint-order targeting, stable rerender identity, transition-before-move, activation identity, cursor parity, and immediate fallback reconciliation without turning defaults into occluding targets.                                                                                                                              | TFC-05 composition evidence requires a different global region identity/order model across root and layer Canvases.                                                          |
| 2026-08-11 | Resolve root and layered targets through one root dispatcher over recursively composed owner-local paint entries.        | Stable leaf identity, root-owned hover/activation/cursor state, reverse global paint order, accumulated transforms and clip intersections, and layer bounds now agree with both rendered pixels and the approved event contract without target bridges.                                                                                                                    | TFC-06 measurements justify a different resolver that preserves the same observable contract, or a public propagation model is added.                                        |
| 2026-08-11 | Keep the linear reverse resolver and optimize only measured redundant identity composition.                              | Exact counters found avoidable matrix and clip-array work, while the focused fast path restored the 10,000-region p95 from 24.2 ms to 6.8 ms without changing targeting semantics. A spatial index is not justified while three controlled runs remain within the documented 6 ms median and 12 ms p95 trigger.                                                            | A real workload or the shared 10,000-region sparse/miss case exceeds either trigger in three controlled runs after environment and constant-factor regressions are excluded. |
| 2026-08-11 | Scope asynchronous capabilities to the exact component generation and give every cleanup one owner.                      | A state setter must match its live instance and component refs and stop when teardown begins; each `crcWhenChanged` generation belongs only to the component collection; each image source owns detachable load/error handlers and source-tagged loaded state. This makes saved late callbacks, races, removal, and remount deterministic without a new async abstraction. | A future public async/effect primitive needs cancellation semantics that cannot be represented by component-owned teardown.                                                  |

## Session log

- **2026-08-11 — Plan created.** Established the active-plan workflow and this first numbered plan from the feature inventory and direct inspection of event, hit-test, layer, teardown, and async-image code. Added a focused interaction/lifecycle risk register, platform-reference direction, ten dependency-ordered steps, and hard completion bars. No implementation behavior changed. Next: **TFC-01**.
- **2026-08-11 — Plan amended for integration, visual evidence, and dependency freshness.** Made shared public-API manual/headless scenarios, deterministic visual assertions, manual checklists, and per-step testing field notes mandatory for every step. Added four dependency-modernization prerequisites after a live audit found 32 outdated direct development dependencies. Preserved TFC-01 through TFC-10 as the feature-confidence sequence. No dependencies or implementation behavior changed. Next: **DEP-01**.
- **2026-08-11 — Gallery made documentation-ready by design.** Added a presentation-neutral scenario catalog with organization metadata, documentation-candidate versus test-laboratory classification, executable-source drift protection, and future docs-renderer boundaries. Expanded DEP-01, TFC-09, and TFC-10 completion bars while explicitly deferring the polished documentation experience. The active marker remains **DEP-01**.
- **2026-08-11 — Baseline refreshed after concurrent `main` updates.** Rebasing for publication brought in 7 direct `line` tests, 3 direct `crcRef` tests, and separate lint/typecheck workflows. Reverified the committed browser baseline at 70 passed and 4 skipped; typecheck remains at 2 errors and lint remains red. Updated the inventory and plan baseline without changing the active step. Next: **DEP-01**.
- **2026-08-11 — DEP-01 complete.** Added a private lazy scenario catalog, identity-checked source/loader contract, public-API smoke example, catalog-driven local gallery, independent headless driver, render-settling controller, targeted Canvas pixels, reviewed expected image, and exact expected/actual/diff comparison outside glyph-only masks. The manual in-app Chromium flow passed mount/update/click/reset with no browser warnings; ten independent focused runs passed; a forced visual regression failed on 8,298 pixels and produced useful artifacts before recovery. Full browser verification is 71 passed and 4 skipped; package/gallery builds pass. Pre-existing typecheck (2 errors) and lint (9 errors, 1 warning) remain separately recorded. Added the complete dependency/CI inventory, pre-upgrade report, gallery seam documentation, and `dep-01` field note. Next: **DEP-02**, with the TypeScript 7 peer-compatibility exception requiring resolution.
- **2026-08-11 — DEP-02 reached the external approval gate.** Upgraded to pnpm 11.21.0, Node 24.15+, ESLint 10.8.1, Antfu 9.3.0, eslint-plugin-format 2.0.1, and Node declarations 26.2.0; removed unused/redundant foundational packages; aligned local setup and CI; and recorded pnpm's trusted-build policy in the [DEP-02 field note](../testing/field-notes/dep-02.md). Under Node 24.19.0, frozen install, uncached lint, typecheck, package/gallery builds, ten focused smoke runs, the 71-pass/4-skip browser suite, unchanged visual comparison, and the manual gallery flow all pass. TypeScript 7.0.2 remains incompatible with current typescript-eslint and unbuild; DEP-02 remains **in progress** until the user explicitly approves temporary TypeScript 5.9.3, after which the full gate must be rerun. Next: **user approval for the documented TypeScript exception**.
- **2026-08-11 — DEP-02 resumed with a TypeScript 7 architecture change.** The user declined the TypeScript 5.9.3 exception and explicitly directed removal of typescript-eslint and unbuild. DEP-02 now owns the minimum lint-parser and package-build replacements needed to use TypeScript 7 without forced peers; DEP-03 will still validate and modernize the remaining build/bundler graph. Next: **replace the incompatible lint and build paths, then rerun the complete DEP-02 gate**.
- **2026-08-11 — DEP-02 complete on TypeScript 7.** Removed Antfu/typescript-eslint and unbuild; selected TypeScript 7.0.2, ESLint 10 with Babel 8 syntax parsing, compiler-owned semantic/unused checks, and direct Prettier for non-code files. Node 24.19/pnpm 11 frozen install, strict peers, lint, typecheck, builds, ten focused smoke runs, the 71-pass/4-skip suite, unchanged visuals, and manual source/built gallery flows pass. See the [DEP-02 field note](../testing/field-notes/dep-02.md). Next: **DEP-03 built-package proof**.
- **2026-08-11 — DEP-03 complete.** Replaced the live package build with esbuild runtime bundles/source maps plus TypeScript CLI declarations; removed unbuild and the entire dead Rollup graph; upgraded to Vite 8 native tsconfig paths; added a guarded built mode and strict Bundler/NodeNext/Node consumer. Source and built smoke images were byte-identical, and both manual gallery modes passed. See the [DEP-03 field note](../testing/field-notes/dep-03.md). Next: **DEP-04 browser runner and freshness closure**.
- **2026-08-11 — DEP-04 complete.** Upgraded to Vitest 4.1.10 and Playwright 1.62.1, migrated the provider/context API, preserved distinct down/up synthesis through scaled runner frames, moved artifacts to current path semantics, upgraded the artifact action, removed unused direct/catalog tools, deduplicated the lock, and closed audit findings. `pnpm outdated` returns `{}`, strict peers/dedupe/audit pass, the deliberate 8,298-pixel visual drill failed with inspectable artifacts and recovered, ten smoke runs passed, and the full suite remains 71 passed/4 skipped. See the [DEP-04 field note](../testing/field-notes/dep-04.md). Next: **TFC-01 characterization harness and frozen baseline**.
- **2026-08-11 — TFC-01 complete.** Added a cataloged interaction laboratory with shared native/CRC geometry, an ordered trace recorder, manual lifecycle controls, and exact Canvas pixel probes. Test-only diagnostics froze listener, registry, teardown, instance, layer, and frame counts; the performance lab recorded exact miss hit tests plus informational median/p95 observations through 10,000 regions. The baseline exposes hover teardown growth, removed-subtree ghost handlers, retained offscreen layers/bridges, and the queued-frame abort race without changing behavior. Ten final focused runs passed; the complete suite is 78 passed/4 skipped; lint, typecheck, build, gallery build, manual visual review, and artifact-boundary checks pass. See the [baseline report](../design/tfc-01-characterization-baseline.md) and [TFC-01 field note](../testing/field-notes/tfc-01.md). Next: **TFC-02 mouse interaction contract**.
- **2026-08-11 — TFC-02 complete.** Approved one topmost logical target, transition-before-move ordering, same-live-target activation, per-logical-event mutation semantics, Canvas-wide observer behavior, intrinsic-coordinate rules, and explicit Canvas geometry decisions. The shared oracle now separates Canvas background from root exit, labels logical related targets as diagnostic, treats context ordering as browser-dependent, and uses real public `g`/`clip`/`layer`/`line`/`crcEvent` diagrams. A fresh review initially disputed leave/re-entry activation; the executable CDP native fixture proved reference Chromium emits the click, so the contract follows measured platform behavior. Manual probes resolved `top`, `child`, transformed `a`, `layer`, stroke/interaction-width `a`, and the Canvas observer; browser output was clean. Independent oracle validation and focused native tests pass, as do lint, typecheck, gallery build, and the complete 80-pass/4-skip browser suite. See the [mouse contract](../design/mouse-interaction-contract.md) and [TFC-02 field note](../testing/field-notes/tfc-02.md). TFC-03 ownership audits selected disposable event-slot bindings, central identity-guarded disposal, explicit native-listener/RAF ownership, and cascading layer cleanup. Next active slice: **TFC-03 event ownership and teardown safety**.
- **2026-08-11 — TFC-03 complete.** Added an additive identity-guarded `CRCController`, mount-only signal semantics, explicit native listener and legal-frame-id ownership, replaceable component event bindings, error-isolated exactly-once teardown, owned cursor cleanup, and cascading persistent-layer disposal/update behavior. The shared lifecycle laboratory drove 1,000 real rerenders, replacement/removal, layer/subtree cleanup, abort/dispose/remount/stale cleanup, and deliberate handler failure; manual visual review passed with only the intentional error. Lint, typecheck, package/source/built gallery builds, strict package consumers, publish-boundary inspection, and the complete 92-pass/4-skip browser suite pass. See the [ownership contract](../design/event-resource-ownership.md) and [TFC-03 field note](../testing/field-notes/tfc-03.md). Next active slice: **TFC-04 event ordering, transitions, and target selection**.
- **2026-08-11 — TFC-04 complete.** Replaced all-hit per-event dispatch on the root Canvas with one stable event-type-independent region target in reverse paint order; implemented out → over → move transitions, same-live-target activation, removal/error-aware snapshots, cursor parity, and non-target pathless observers/defaults. The shared laboratory covers sibling routes, overlap/reorder/removal, component ancestry, fill/stroke/combined/transparent/interaction-width geometry, handler and observer mutation, activation, and deliberate errors. Manual Chromium review passed; the focused 23-test suite passed 20/20 independent runs (460 tests) without retries, and the complete suite passed 120/4 skipped. Lint, typecheck, package/consumer/source/built gallery gates pass. See the [mouse contract](../design/mouse-interaction-contract.md) and [TFC-04 field note](../testing/field-notes/tfc-04.md). Next active slice: **TFC-05 event geometry and composition correctness**.
- **2026-08-11 — TFC-05 complete.** Added one shared seven-case geometry matrix for root and CSS-scaled fills, compound transforms, intersecting and `evenodd` clips, global root/layer paint order, transformed cropped nested layers, and stroke interaction bounds. CRC now exposes intrinsic root coordinates and resolves one stable leaf target through recursively composed owner-local paint entries, transforms, every clip, and layer bounds under one root interaction state. Exact text-free visuals and pixel probes passed; a deliberate visual drill failed on the intended 3,000 pixels and recovered. Manual in-app Chromium review covered every positive/boundary/negative class and confirmed background-down/target-up does not click. The focused matrix passed 20 independent runs (160/160), the complete suite passed 148/2 skipped, and lint, typecheck, package/consumer/source/built gallery gates passed. See the [mouse contract](../design/mouse-interaction-contract.md), [ownership contract](../design/event-resource-ownership.md), and [TFC-05 field note](../testing/field-notes/tfc-05.md). Next active slice: **TFC-06 event hot-path performance**.
- **2026-08-11 — TFC-06 complete.** Added one shared performance laboratory covering zero, sparse, miss, dense, clipped, transformed, layered, cursor, and unchanged-rerender workloads through exact structural counters and opt-in 101-sample timing guards. Measurements isolated redundant identity matrix and clip-array composition; a narrow fast path reduced the sparse 10,000-region p95 from 24.2 ms to 6.8 ms without changing one semantic or hit-test count. A deliberate doubled-path-test drill failed exactly and recovered, three controlled budget runs passed, and the 1,000-region unchanged-render callback meets its 5/8 ms median/p95 budget with stable ownership across 25 rerenders. Manual Chromium review covered all workloads and counters. The complete suite passed 151/4 skipped; lint, typecheck, packages, strict consumers, and source/built gallery builds passed. See the [TFC-06 field note](../testing/field-notes/tfc-06.md). Next active slice: **TFC-07 whole-runtime teardown and resource cleanup**.
- **2026-08-11 — TFC-07 complete.** Assigned single owners to change-hook cleanups, made stale state setters inert at component/mount teardown and remount boundaries, and gave each image source detachable load/error handlers plus source-tagged loaded state. Added a shared cleanup laboratory for pending frames, image races/errors/removal, single/nested layers, dependency/key/component/root replacement, idempotent cleanup, and 1,000 fully rendered mount/dispose cycles. The stress ledger balanced 1,002 instances, 8,016 listeners, 2,004 frames, every component ref, hook generation, and temporary render-global slot; exact pixels proved that removed resources stop drawing. Manual review caught and fixed a stale-vs-live cleanup-lab controller bug, then the full flow passed with no console warnings. The complete suite passed 177/4 skipped; lint, typecheck, packages, strict consumers, and source/built gallery builds passed. See the [runtime ownership contract](../design/runtime-resource-ownership.md) and [TFC-07 field note](../testing/field-notes/tfc-07.md). Next active slice: **TFC-08 runtime and hook confidence sweep**.
