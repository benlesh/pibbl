# Responsive styles execution record

> **Historical status: Approved implementation in progress; execution evidence follows.**
> User approved the written specification and explicitly
> requested immediate execution on 2026-09-28, superseding the separate plan gate.
> No worktree. Preserve unrelated checkout changes.

Specification: [allocation-relative responsive styles](../specs/2026-09-28-responsive-style-queries-design.md).

## Delivery sequence

1. Capture baseline; prove missing public behavior with a failing browser test.
2. Implement query selection, public types, and prepared-style dispatch. Expose
   the same reusable component in root/cell/phone contexts in Studio.
3. Add focused height, ownership, measurement rejection, and structural evidence;
   provide the running URL for feedback.
4. Harden validation, custom types, Layers, package/Studio surfaces, diagnostics,
   examples and public contracts; review changes independently.
5. Run controlled comparisons and the aggregate trust gate. Audit the spec before
   marking the feature complete.

## Evidence and rulings

- Initial public browser test failed at wide-toolbar geometry: expected `(124, 0)`,
  received `(0, 56)`. Existing performance suite passed 14 tests.
- Captured three untouched-runtime Node 24.15.0 performance runs under
  `/private/tmp/pibbl-responsive-baseline24-{1,2,3}.log`; archived original core source
  at `/private/tmp/pibbl-responsive-core-before.tgz`. Initial exploratory run used
  Node 26; final comparisons must use Node 24.15.0 and pnpm 11.21.0.
- Browser tests require sandbox escalation to bind localhost; initial sandbox run
  executed no tests. Successful failing-test evidence came from Chromium outside
  that restriction.
- Ruling: add the new type API reference during slice implementation because the
  Studio documentation plugin rejects undocumented exports before tests start.
  Broader documentation hardening remains after the runnable slice.

- Review fixes: reserved `when: undefined` callback leakage and stale token-history
  metadata each reproduced in failing tests, then fixed. Public queried → query-
  free intrinsic measurement already passed (tokens are transaction-local); the
  targeted internal regression prevents history lookups if a token is reused.
  Focused dispatch/layout/measurement/public tests: 52 passed.
- Public reserved-key type fixtures failed with four unused expect-error directives;
  the definition guard now produces the named framework-owned diagnostic, and
  TypeScript passes.
- Structural evidence: 1,000 plain/query receivers, 4,000 rule checks, one merge
  per query occurrence, inactive signal silence, coalescing, and exact disposal
  passed (2 tests).
- Ruling: standalone measurement with indefinite constraints requires one
  eligibility scan followed by selection only when supported. Otherwise a later
  height query can invalidate earlier width-only reads, violating the zero-read
  rejected-path contract. Mounted rendering retains one scan; this documented
  exception adds no match arrays or validation repeats and stays linear.

## Slice ready for feedback

- Running source Studio: http://127.0.0.1:5173/#/examples/layout/responsive-styles.
  Verified live rendering and zero editor TypeScript issues. Automated example
  interaction uses the existing mousedown/mouseup/click activation sequence and
  proves phone/root/cell controls and count retention. The in-app browser cannot
  click fractional iframe coordinates; executable Chromium interaction evidence
  supplies that check rather than claiming a manual click succeeded.
- Separate responsive-styles laboratory now drives bidirectional thresholds,
  signals, and stable identity; its browser test passed. Catalog generation passed.
- Source diagnostics now include source location, precise queried-axis path,
  unavailable basis, and repair text. This was a failing test before the fix.
- Plain-component placement metadata is consumed without changing raw props;
  the regression failed before adding consumption.
- Nested Layer checks passed with 99 clean sibling surfaces retained, branch
  changes observing current signals, and exact disposal. Both Canvas and
  OffscreenCanvas contexts must be observed to count nested surfaces.
- Package build passed under Node 24.15.0. Studio declaration verification passed
  against source and built packages, including the shared responsive authoring
  fixture and targeted reserved-key errors. Repository typecheck passed.
- Ruling: the learning catalog requires inline style objects. Keep the rule list
  hoisted and typed, but write the small base style inline; nested rule identity
  (the Layer cache concern) remains stable without weakening the source checker.

## Remaining before feature completion

- Finish the edge matrix (surface/density/zero-size, filters, optional capability
  boundaries, malformed input/failure isolation) and final public examples/docs.
- Run packed Bundler/NodeNext consumers and source/built browser checks.
- Pin the controlled benchmark harness, calibrate baseline-only noise, run
  candidate comparisons, and optimize any reproducible regression. Existing
  timing logs are not evidence for the newly specified paired protocol.
- Run the aggregate trust gate, perform one implementation review, and audit
  every specification acceptance requirement. No performance-neutral or
  feature-complete claim has been made.

## Independent implementation review and remaining gates

The independent reviewer found a canonical authoring mismatch: a plain component's
outer style prop excluded whole-style signals. The package fixture reproduced
TS2559 for JSX and createElement, then passed after using
`SignalValue<PibblResponsiveStyle<BoxStyle & LayoutItemStyle> | undefined>`.
The guide, specification, and learning example now use that type. Studio's
source/built declarations passed again with 329-type coverage.

The reviewer also audited the new contract-preservation entries. Missing exact
approval citations were corrected, and the introductory closed-style statement
was narrowed to its preserved existing meaning. The reviewer confirmed the
revised mappings substantively complete. The preservation checker passes its
semantic and provenance checks; its later historical-banner check fails on the
unrelated, concurrently authored component-manipulation implementation plan.
That file was preserved. The aggregate trust gate therefore remains incomplete.

Under Node 24.15.0 and pnpm 11.21.0, the full browser run completed with 3,790
passed, four skipped, and two failures in explicit lesson inventory expectations.
Both failures were caused by adding the responsive lesson; all affected lists
were updated. A fresh focused run of all 224 learning-example tests then passed.
The surface suite passed all four tests. Packed consumer verification passed
Bundler, NodeNext, runtime exports, declarations, and package isolation.

### Controlled preparation timing: strict gate fails

Runnable harness: `tooling/benchmark-responsive-preparation.mjs`. Baseline sources
were archived before implementation, without a worktree, at
`/private/tmp/pibbl-responsive-core-before.tgz` (SHA-256
`cab31508006e2f947400a74db43b273526e8f2d29eaed332e98c0c75bce32eec`).
The checkout HEAD was `4717dc9862ffd57634c26cdd707ed677bd3da6f4`;
the archive and bundle hashes, rather than that commit alone, pin the artifacts.
Raw samples, hashes, and the frozen envelope are saved in
`docs/testing/evidence/responsive-preparation/`.

This first workload isolates 1,000 preparations with one matching width rule.
Both sides read base and overwritten matched signals, with identical checksums
and 8,200,000 counted reads across warmup and timed samples. Neither side owns a
render consumer in this preparation-only experiment. Production minified
bundles ran in one headless Chromium worker, fixed 1000×640 viewport and DPR 1,
100 warmups, 200 batches of 20 updates, no forced GC or outlier trimming.
A/B/B/A calibration preceded A/C/C/A candidate comparisons in three fresh
sessions per phase. No browser test suite ran during sampling; the idle Studio
server remained running. Host is arm64 macOS, Node 24.15.0; detailed CPU identity
was unavailable to the sandbox. Browser version is recorded per sample session.

The frozen envelope was 0.005000007 ms per batch-normalized update for both
median and p95. Candidate median deltas were approximately +0.095 ms per 1,000
preparations in all three sessions; p95 deltas were +0.0925, +0.095, and +0.095 ms.
This is about 95 ns additional preparation time per style. The independent
reviewer confirmed that this isolated workload fails the approved strict parity
gate. It does not establish a full-frame or general performance regression.
No performance-neutral claim is justified, and the gate has not been relaxed.
An explicit user decision on allowing measured opt-in overhead is pending;
ordinary-style nonregression and full-frame checks remain required either way.

The same controlled preparation protocol then passed separately for ordinary
plain styles, field-signal styles, and whole-style signals. Each workload used
its own baseline-only calibration and three fresh candidate sessions. Every
median/p95 delta stayed within its frozen 0.005000007 ms envelope (or was faster).
Their artifacts and raw samples are in the `plain/`, `field/`, and `whole/`
subdirectories beside the query evidence. This establishes preparation-level
nonregression for these three ordinary-style fixtures, not full-frame timing.

The first full-frame ordinary-style workload (1,000 explicitly black rectangles)
passed all three comparisons before the subsequent placement-lookup optimization.
Median/p95 envelopes were 0.049999994/0.085000002 ms per update. Median deltas:
−0.0100, −0.0650, +0.0050 ms; p95: +0.0400, −0.0825, +0.0600 ms.
Every pixel was checked against the expected final geometry, and a position-
sensitive RGBA hash was equal across runs. Live signal ownership was exactly one
root consumer/edge, with zero edges/provisions/pending frames after disposal.
This evidence is retained under `frame-plain-before-lookup-fix/`; subsequent
candidate changes must be checked against the same frozen calibration.

The first frame harness draft omitted fill and failed its checksum before
calibration. The next draft counted alpha only; independent review correctly
identified that it could miss placement errors. That run was interrupted before
candidate interpretation. Only the restarted position-sensitive run above is
evidence. Identical independently built A/B hashes are now asserted before any
calibration. The harness supports reusing a frozen calibration only when baseline
artifact hashes, workload, Node version, and browser version match.

A final audit reproduced two diagnostics that omitted render/layout context and
one redundant lookup on the ordinary primitive path. The diagnostics failed two
focused tests before the error-path correction; 26 ownership/validation checks
then passed. The metadata test observed two lookups rather than one before
removing the resolver's fallback lookup (the renderer already consumed it).
Afterward 24 dispatch, geometry, and ownership tests passed; typecheck passed.

The optimized ordinary full-frame candidate was compared in three new sessions
against the **same frozen calibration**, with matching A/B hashes enforced.
It passed: median deltas +0.0250, +0.0400, −0.0100 ms; p95 +0.0300, +0.0850,
−0.0500 ms, all within the pre-existing envelopes. Full-precision values and
matching pixel/ownership evidence are saved under `frame-plain/`. This is a
nonregression result, not a claim that the lookup optimization made frames
measurably faster. Field/whole-style full-frame timings and the larger opt-in
matrix remain outstanding; the strict opt-in preparation gate remains failed.

The completed single-rule full-frame comparator also **fails the strict opt-in
performance gate**. It renders 1,000 receivers with one matching rule; the base
width is zero and the matching width is one, so exact final pixels establish
that query selection actually changes geometry. Both implementations read the
same base and matched signals in the receiving primitive. Both produce exactly
1,001 live consumers and 2,001 edges, and release every edge, provision, and
pending frame on disposal.

Across three candidate sessions, paired baseline/candidate median durations were
3.6025/3.8425, 3.8550/4.1025, and 3.5300/3.7250 ms per update. Median deltas
(+0.2400, +0.2475, +0.1950 ms) all exceed the independently frozen 0.0650 ms
envelope. Paired p95 durations were 3.8200/4.1625, 4.4250/4.7125, and
3.7225/4.0375 ms. Their deltas (+0.3425, +0.2875, +0.3150 ms) all exceed the
0.0375 ms envelope. These are approximately 5.5–6.7% median increases for this
specific fixture, not estimates for arbitrary applications. Raw evidence and
artifact hashes are saved under `frame-query/`.

An earlier harness draft used equal base/matched widths and was interrupted
after review identified that it did not prove selection affected geometry.
Only the distinct-width run above is acceptance evidence. The preparation-only
result is therefore corroborated by a complete-frame regression in this fixture.
The written gate remains unchanged: feature-complete status is blocked until
optimization meets it or the user explicitly approves a revised requirement.
No answer to the pending requirement-change question has been received.

Independent re-review confirmed the full-frame strict-gate failure, found no
material comparator flaw, and reported no unresolved design or agentic-authoring
findings from the prior reviews. This resolves the review request; it does not
resolve the performance acceptance failure.

A follow-up optimization defers rule-path diagnostic string construction until
an error occurs. All 26 focused validation/ownership tests passed. Against the
original, unchanged A/B bundles and frozen preparation envelope, all three
candidate sessions still fail: median +0.0875 ms per 1,000 preparations; p95
approximately +0.0900 ms. Raw evidence is in `query-lazy-diagnostics/`. The
harness restored the original preparation workload identifier so its existing
hash/version checks can reuse that calibration; neither baseline code nor the
envelope changed. This reduces measured preparation overhead but does not satisfy
the strict gate or establish new full-frame results.

Ordinary field-signal full-frame timing passed three fresh candidate sessions
after its own baseline-only calibration: median deltas +0.0100, +0.0075,
−0.0125 ms; p95 −0.0700, −0.0025, −0.1575 ms. Every result was within or faster
than the frozen median/p95 envelopes (0.0425/0.1300 ms). Exact pixel output and
ownership/cleanup assertions passed. Evidence is saved under `frame-field/`.
Whole-style full-frame timing remains outstanding.

The expanded focused suite passed 27 tests, including a query-failure root
releasing its edges while an independent queried root completes the same frame
and remains reactive afterward. The public consumer now checks that a responsive
WebGL patch cannot accept a Canvas filter; Bundler consumer compilation and
focused lint passed. These checks do not resolve the opt-in timing failure.

Ordinary whole-style full-frame evidence was **inconclusive**, not passed. Its
frozen median/p95 envelopes were 0.0450/0.1450 ms. Median deltas +0.1175,
+0.0550, +0.0350 ms were outside the median envelope in two sessions and inside
in one; all p95 deltas (+0.1400, +0.0925, +0.0200 ms) were inside. Evidence is
saved under `frame-whole-before-value-fast-path/`.

A narrow independent feasibility review identified per-evaluation error/record
closures as one remaining small allocation optimization, while finding no
credible route to strict opt-in parity without changing the mutable-record
validation contract or acceptance requirement. The helpers are now non-capturing.
Additionally, normal primitive style resolution now requests the selected value
directly: query-wrapper unwrapping occurs only on the query branch, avoiding an
instance check for each ordinary style. Layout preparation retains its existing
occurrence-local metadata. The private resolver overload has no public API effect.
Forty-four focused tests, typecheck, targeted lint, and the Studio source/built
329-type consumer checks passed after these changes. Timings must be rerun
against the existing frozen baselines before drawing a performance conclusion.

Removing per-evaluation helper closures did not close the opt-in gate. Against
the original frozen preparation baseline, all three median and p95 deltas were
approximately +0.0850 ms per 1,000 styles, versus the unchanged 0.0050 ms
envelope. Evidence is in `query-helpers/`. The small difference from the preceding
+0.0875 ms result is not itself established as a statistically meaningful gain.
No contract, signal-read semantics, validation, or acceptance tolerance changed.

After moving wrapper unwrapping into the query branch, ordinary whole-style
full-frame timing passed all three comparisons against the **same frozen
calibration** (baseline hashes and environment enforced). Median deltas were
+0.0025, +0.0425, +0.0400 ms, within 0.0450 ms; p95 +0.0050, 0, +0.0150 ms,
within 0.1450 ms. Exact pixels, live ownership, and teardown assertions passed.
Evidence is saved under `frame-whole/`. Earlier ordinary plain/field frame
results predate this private fast-path change; no aggregate performance-neutral
claim is made for the current candidate.

The recurring opt-in strict-parity failure remains the delivery blocker. The
reviewed larger optimization would require an authoring/immutability contract
change to permit cached validation. No such change or relaxed opt-in timing
requirement has been approved. Broader performance and aggregate completion
verification remain unfinished; the feature is not complete.

Fresh packed-consumer verification passed after the helper/fast-path changes and
WebGL patch fixture: package builds, isolated packed Bundler/NodeNext consumers,
runtime/public boundaries, WebGL shared identity, and viz package checks. The
first attempt was stopped by pnpm cache access in the filesystem sandbox; the
authorized rerun with cache access completed successfully. `git diff --check`
also passed. Aggregate trust is still not claimed: the opt-in timing gate fails,
the broader matrix remains unfinished, and the unrelated component-manipulation
plan still lacks the Historical banner required by the documentation gate.

The same approval-dependent performance blocker has persisted across three
consecutive goal turns, despite the verified optimizations and additional
evidence above. No further credible contract-preserving route to strict parity
has been identified. The next viable step is a user decision between redesigning
rule authoring/immutability to allow cached validation and explicitly accepting
measured opt-in overhead. The current mutable-record contract and strict gate
remain unchanged while awaiting that decision.

## Performance acceptance resumed — 2026-09-28

The user reviewed the absolute and relative measurements and said, “I think this
is acceptable for now. We can try to optimize it more later.” This approves the
existing measured opt-in overhead and removes the recurring strict-parity
blocker. The specification's appended amendment retains the current authoring
contract, ordinary-style protection, and every correctness/ownership guarantee.
Additional opt-in timing exploration and optimization are deferred. Existing
failed measurements are retained without relabeling them as parity passes.

Independent review confirmed the amendment's scope and the final helper/value-
mode changes preserve ownership and layout preparation. Only the responsive
approval source hash and resulting manifest integrity hash were refreshed;
existing approval-unit references and contract mappings remain unchanged.

The final one-rule queried-frame comparison completed with median deltas
+0.0775, +0.0375, +0.0850 ms per 1,000 receivers; p95 +0.0900, −0.1100,
approximately 0 ms. Exact output, read ownership, and teardown checks passed.
This is below the previously accepted overhead. Under the old strict protocol
it is mixed/inconclusive, not a parity pass; the user-approved opt-in amendment
now governs acceptance. Evidence is saved under `frame-query-final/`.

## Final verification and deferred performance work — 2026-09-28

Further opt-in optimization is deferred as approved. Ordinary plain full-frame
comparisons passed the existing frozen envelope (`frame-plain-final/`): median
−0.0450, +0.0225, −0.0325 ms; p95 −0.0050, +0.0650, −0.0125 ms.
Ordinary field-signal reruns remained mixed: `frame-field-final/` and
`frame-field-confirm/` did not establish a pass or a reproducible regression.
Removing the extra resolver wrapper (`frame-field-direct/`) produced median
+0.0275, +0.0125, +0.0175 ms; p95 −0.0200, +0.2025, −0.0250 ms.
Restoring the original single-key style copy when no query key exists
(`frame-field-copy/`) produced median −0.0100, −0.0200, +0.0050 ms and
p95 +0.1950, +0.2100, +0.1025 ms per 1,000 receivers. All medians are within
the unchanged 0.0425 ms envelope, but two p95 comparisons exceed 0.1300 ms.
This is inconclusive under the predeclared three-session protocol. It is not
an ordinary-style parity pass, and the opt-in approval does not waive this
remaining verification limitation. No further timing retries or optimization
are undertaken in this delivery. Exact pixels, signal ownership, and cleanup
assertions passed throughout. Forty-six focused tests and targeted lint passed
after the last copy-path change.

Fresh aggregate components were run on Node 24.15.0, pnpm 11.21.0, and
Playwright Chromium. Scenario checks, production documentation boundary,
typecheck, lint, package builds, source/built Studio builds, packed consumers,
Studio documentation browser checks, visual safeguard, built smoke, lifecycle
(55 tests), and structural performance (64 passed, 4 skipped) passed.
The Studio documentation inventory and style-type ordering failures were fixed;
`studio-docs:check` then passed.

The aggregate gate remains unverified/failed for these recorded reasons:

- Documentation mutation checks reject four unrelated untracked September 28
  component-manipulation and points-and-inspection drafts for missing Historical
  status banners. Those files were preserved unchanged. Responsive contract
  provenance and semantic preservation checks passed.
- The full browser suite reports 3,797 passed, 2 failed, 4 skipped. Failures are
  physics learning-example pointer/velocity assertions; they pass in isolation
  and in the 270-test focused learning/responsive run. A full-suite rerun alone
  still failed two physics assertions. Load sensitivity is suspected, not proven
  against the baseline; these are not reported as passing.
- Studio visual verification finds the already documented 110-pixel WebGL
  lighting tag mismatch (`pibblOrbitCamera` versus `useOrbitCamera`). Expected and
  actual images were inspected; the unrelated baseline was not rewritten.

The implementation is available for hands-on feedback, but feature-complete and
aggregate-trust claims remain withheld. Optimization and the inconclusive
ordinary field-signal timing evidence remain visible follow-up work.

Final checks after the last runtime change: `pnpm typecheck`,
`pnpm test:smoke:built` (2 files, 4 tests), and `git diff --check` passed.
The local Studio server was restored at
`http://127.0.0.1:5173/#/examples/layout/responsive-styles`.

## Hands-on example revision — 2026-09-28

User feedback found the counter/control demonstration too abstract. Replaced it
with an illustrative store revenue card: three metrics, a sales trend, and
working 7/30-day selection. Dashboard, Sidebar, and Phone retain the same card
instance while local width rules change metric direction and chart placement.
The example configures ordinary host scrolling for short Studio previews and
restores its host/canvas styles on disposal; it adds no Pibbl scrolling API.
Updated the learning catalog and generated scenario index. No runtime changes.

A focused browser test failed before the replacement and now passes, checking
period updates, state retention, narrow allocation inside a wide root, phone
root resizing, both sides of the exact 600-unit card breakpoint, and host-style
cleanup. The canonical layout catalog test also passes (2 selected tests;
223 unrelated tests skipped). Typecheck, targeted lint, and diff whitespace
checks pass on Node 24.15.0. Inspected wide and narrow rendered layouts in the
Studio and verified the short preview has an 800-pixel canvas in a scrollable
438-pixel host. Earlier aggregate limitations above remain unchanged.

## Accepted-example hardening and final audit — 2026-09-28

The user accepted the revenue-card example ("much better") and requested that
work continue. A narrowed independent review found the refreshed example had
lost whole-style signal support in its copied component prop type, and its
interaction test could find stale text from earlier renders. Restored the public
`SignalValue<PibblResponsiveStyle<BoxStyle & LayoutItemStyle> | undefined>` form.
Every interaction/resize assertion now uses a fresh paint epoch and checks that
the unselected period's amount is absent. A failing synchronous surface-measurement
fixture demonstrated that host CSS was left modified after mount failure; the
wrapper now restores CSS in the mount catch and disposal finally paths. The
reviewer verified all three fixes with no remaining material finding in scope.
No responsive runtime or performance contract changed.

Fresh results on Node 24.15.0, pnpm 11.21.0, Playwright Chromium:

- All seven responsive browser files: **49 passed**.
- Full browser suite with `vitest run --browser.headless --maxWorkers=1`:
  **313 files passed; 3,800 tests passed, 4 skipped**, 180.59 seconds. This includes
  the previously failing physics assertions and supports load sensitivity; it
  does not convert the earlier default four-worker failures into a passing
  default aggregate run.
- Package builds and the accepted example against built exports: **2 passed**.
- Typecheck, targeted lint, public Studio documentation coverage/routes/search,
  and whitespace checks passed.
- `docs:check` still fails on the unrelated component-manipulation plan's missing
  Historical banner. Its authored content is preserved. The previously inspected
  WebGL lighting baseline mismatch was not changed or rerun.

The public behavior matrix, ownership checks, package evidence, and accepted
hands-on consumer are implemented and hardened. The repository aggregate remains
not green because of the recorded documentation/visual issues and the default
parallel browser-run failures. Ordinary field-signal wall-clock parity remains
inconclusive under the frozen protocol; accepted query overhead and further
optimization remain deferred. These limitations are retained explicitly rather
than declaring unconditional feature completion or weakening gates.
