# Agent verification continuation audit

> **Delivery stopped at the user-requested cutoff (2026-10-01).** The four
> priority reference workflows and saved-evidence queries passed. Aggregate trust
> is not green: existing package-manifest changes invalidate ENV-03 closure
> evidence. The 373-item inventory below remains a deferred backlog. Do not
> automatically resume it. See “Final bounded delivery handoff” below.

- **Status:** Active execution context; not a completion declaration.
- **Audited:** 2026-09-29 against current checkout `e8a1cf29`.
- **Objective:** Continue addressing the rest of the agent verification requirements.
- **Inventory:** [Stable requirement inventory](./agent-verification-inventory.md).

## Current status checkpoint, 2026-09-30

The working result is a source-development verification prototype, not a finished
373-requirement implementation. The current ledger accounts for every ID:
**346 partial, 19 known gaps, 0 unassessed, 8 reviewed complete**. These
measure assessment coverage, not percentage complete. Later dated entries below
supersede earlier historical counts and verification results.

Working evidence includes targeting, coordinates, focus/capture, signals,
scheduler history, component identity/source/labels/diffs, visualization hover,
weighted aggregation, replay failure artifacts, Three committed picking, clip
ancestry and entry-local conversion. Each remains limited to its recorded scope.
Large gaps remain in general layout/paint/text/asset explanations, full causal
tracing, richer visualization workflows, application semantics/accessibility and
production-facing integration.

The latest full `trust` attempt stopped in static documentation classification,
after requirement accounting and scenario checks passed. It did not reach the
remaining gate stages. A stale generated scenario index was repaired first.
Seven new texture/path-bending documents still need classification by their
feature work. No aggregate trust pass, commit or PR is claimed. Individual slice
runs and their configuration limitations are recorded below and in the ledger.

## Requirement-level accounting, 2026-09-30

The [machine-readable ledger](./agent-verification-ledger.json) now contains all
**373 IDs exactly once**. Its initial audit has **37 partial assessments and 336
unassessed requirements**. No requirement is certified complete by this ledger.
These are audit-coverage counts, not an implementation percentage: unassessed
requirements may already have substantial runtime/test support.

Each entry retains the actual requirement text. Partially assessed entries link
to executable/source evidence, explain precisely what it supports, and identify
remaining scope. Unassessed entries explicitly require an evidence/ownership audit;
they are not automatically a backlog of new runtime APIs. The inventory includes
application responsibilities, ongoing constraints and conditional capabilities.

`corepack pnpm@11.21.0 test:agent-verification:requirements` tests the ledger
validator and discovery behavior, including rejection of invalid completion claims.
These executable regression tests remain in the static trust gate.

`corepack pnpm@11.21.0 audit:agent-verification:claims` separately checks the
strategy ledger's recorded file fingerprints and accounting. Run it when reviewing
or renewing those historical closure claims. Changed evidence invalidates the
recorded claim, but does not by itself establish a current runtime regression, so
this audit is not a merge gate. Never refresh fingerprints without renewed review.

Next consolidation work is to assess the remaining categories against existing
public tests and contracts, without adding duplicate capabilities, and organize
implementation around the inventory's complete agent reference tasks. The pending
semantic component-diff slice remains explicitly incomplete; broad layout/paint,
assets, animation, visualization and renderer work has not been displaced from the
objective by this ledger.

## Evidence and integration state

The targeting implementation and its uncommitted hardening have now been
integrated into the current `/Users/benlesh/GitHub/crc` checkout on
`codex/physics-2d-quality` (base `e8a1cf29`). Integration used the complete feature
diff against its common base, plus identity files, and preserved the current
inventory and unrelated path-geometry changes. Shared catalogs were merged and
the scenario index regenerated from the current catalog. No commit or PR has
been created for this combined local work.

The older implementation remains preserved in
`/Users/benlesh/.codex/worktrees/agent-verification/pibbl`, branch
`codex/agent-verification`, at `51821c12` plus uncommitted changes. Continue new
work in the current checkout; do not copy its older catalog/index over current
files. Earlier isolated-checkout evidence below is historical and superseded by
fresh integrated verification where stated.

Current signals, visualization, Three integration and physics observation/testing
supersede the inventory's old availability assumptions. The inventory was updated
without renumbering or dropping any requirement. A requirement about a removed
backend is now expressed at the applicable external-renderer boundary, rather
than treated as a reason to restore removed APIs.

## Exhaustive accounting, without false completion

Every one of the 373 IDs occurs in exactly one range below. Grouping is for
navigation; it does not establish that all members share implementation coverage.
All remain open or partial until exact requirement-level evidence is recorded.
Runtime behavior, internal regression tests and agent-consumable verification
capabilities are different kinds of evidence. An existing runtime export alone
cannot close an inspection requirement.

| Requirement IDs | Count | Audit status   | Existing evidence or remaining work                                                                                                                                                                                               |
| --------------- | ----- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RULE-01–RULE-09 | 9     | Open / partial | Constraints for every implementation; ongoing, never counted as a standalone shipped feature.                                                                                                                                     |
| ENV-01–ENV-11   | 11    | Open / partial | Fixture identity checks now have focused evidence below; general served-build provenance remains partial.                                                                                                                         |
| INT-01–INT-10   | 10    | Open / partial | Targeting fixture supplies an independent selection/color oracle; remaining application intents need individual scenarios.                                                                                                        |
| QRY-01–QRY-14   | 14    | Open / partial | Separate targeting prototype covers bounded immutable one-root snapshots and active probes; broader queries remain open.                                                                                                          |
| ID-01–ID-10     | 10    | Open / partial | Bounded component identity, ancestry, source capture, labels and sampled removals have focused evidence; durable entity mapping and complete lifecycle coverage remain open.                                                      |
| GEO-01–GEO-11   | 11    | Open / partial | Existing surface geometry underlies targeting; general observed coordinate conversion and geometry facets remain open.                                                                                                            |
| LAY-01–LAY-12   | 12    | Open / partial | Runtime layout and tests exist; no general allocation/provenance inspector audited.                                                                                                                                               |
| PNT-01–PNT-12   | 12    | Open / partial | Prototype compares narrow actual pixels; general paint attribution/visibility diagnosis remains open.                                                                                                                             |
| TXT-01–TXT-08   | 8     | Open / partial | Existing text behavior needs an observation facet and explicit fixture evidence.                                                                                                                                                  |
| AST-01–AST-08   | 8     | Open / partial | Existing image lifetime tests are candidate evidence; general asset readiness/generation reporting remains open.                                                                                                                  |
| HIT-01–HIT-13   | 13    | Open / partial | Prototype now traverses Canvas Layers with focused native-input evidence below; bounded logical capture observation is now available; owner-document DOM interception now has evidence below; cross-frame occlusion remains open. |
| EVT-01–EVT-11   | 11    | Open / partial | Prototype records one delivered fixture event; propagation/action causality remains open.                                                                                                                                         |
| FOC-01–FOC-08   | 8     | Open / partial | Bounded native/logical focus, committed candidates and visible-ring evidence exist; directional explanations and broader focus/semantics remain open.                                                                             |
| SIG-01–SIG-14   | 14    | Open / partial | Explicitly registered passive value/cache observation has focused evidence below; graph discovery and causal tracing remain open.                                                                                                 |
| SCH-01–SCH-11   | 11    | Open / partial | Prototype reports root revisions and pending realm work; general completion/phase cause facets remain open.                                                                                                                       |
| ANI-01–ANI-10   | 10    | Open / partial | Runtime playback and internal evidence exist; general animation inspection remains open.                                                                                                                                          |
| LYR-01–LYR-10   | 10    | Open / partial | Bounded Layer traversal and composed geometry have focused evidence below; dirty-cause and broader composition evidence remain open.                                                                                              |
| DAT-01–DAT-13   | 13    | Open / partial | Application data lineage and analytical oracles need concrete scenarios; do not infer business meaning.                                                                                                                           |
| VIZ-01–VIZ-15   | 15    | Open / partial | Generation-aware native interpolation, gaps, resize/density, duplicates and nearest-query evidence exist for one lab; general chart inspection remains open.                                                                      |
| VIN-01–VIN-12   | 12    | Open / partial | Native nearest-x and pixel-distance selection, provenance, cutoff and clearing have scoped evidence; linked views, brush/zoom and broader policies remain open.                                                                   |
| REN-01–REN-12   | 12    | Open / partial | Use public external layers and Three; removed Pibbl WebGL internals are out of scope. Adapter facets remain open.                                                                                                                 |
| SIM-01–SIM-09   | 9     | Open / partial | inspectPhysics2D, debug overlay and isolated testing entry exist; audit evidence against each remaining simulation obligation.                                                                                                    |
| APP-01–APP-12   | 12    | Open / partial | Application-owned semantic model, DOM integration and accessibility require scenario-specific evidence.                                                                                                                           |
| ERR-01–ERR-13   | 13    | Open / partial | Existing runtime diagnostics and failure tests are candidates; general structured causal reporting remains open.                                                                                                                  |
| OWN-01–OWN-10   | 10    | Open / partial | Internal lifecycle ledgers exist; external scope, history and inspector ownership evidence remain partial.                                                                                                                        |
| PER-01–PER-13   | 13    | Open / partial | Structural performance tests exist; bounded optional performance observation and comparative claims remain open.                                                                                                                  |
| BLD-01–BLD-10   | 10    | Open / partial | Fresh combined checks and Studio build confirm integration and production inspector exclusion; full package/build matrix and aggregate trust remain unproven.                                                                     |
| HAR-01–HAR-14   | 14    | Open / partial | Both replay identities, parent-owned browser watchdog, failure observations and partial checkpoints have focused evidence; full crash/interruption matrix remains partial.                                                        |
| TST-01–TST-13   | 13    | Open / partial | Existing test suites are evidence candidates, not blanket fulfillment; require non-vacuous independent assertions per slice.                                                                                                      |
| PIX-01–PIX-09   | 9     | Open / partial | Prototype captures three modes with pixel checks; general provenance/sequence/mask contracts remain partial.                                                                                                                      |
| EVD-01–EVD-14   | 14    | Open / partial | Loaded-fixture identity and atomic partial checkpoints are verified for both replays; general provenance, structured assertion diffs and cross-subsystem correlation remain open.                                                 |
| OBS-01–OBS-12   | 12    | Open / partial | Fresh combined passivity/browser/harness checks pass; broader observation facets and adversarial cases remain outstanding.                                                                                                        |
| AGT-01–AGT-06   | 6     | Open / partial | One accepted diagnosis/repair task exists separately; efficient general workflow needs additional proven tasks.                                                                                                                   |
| HUM-01–HUM-04   | 4     | Open / partial | Internal lab exists separately; general overlays and source-linked inspection remain optional open work.                                                                                                                          |

## Provenance slice: implemented in the isolated checkout, feedback pending

The original replay README explicitly said its served-checkout fingerprint was
unverified. A replay can hash checkout A and exercise a server from checkout B,
then produce misleading evidence. This is a concrete remaining ENV-07/09,
EVD-01/09 and HAR-01 failure mode in the existing accepted workflow.

Continue in a suitable isolated checkout based on the accepted implementation,
accounting for its uncommitted hardening and the newer runtime. Avoid duplicating
the inspector or beginning a public protocol design.

1. Read the existing replay, fixture and Studio development boundary. Identify
   what fingerprint the browser can attest to without exposing source paths or
   arbitrary application data. Distinguish server files, loaded module generation
   and application state; hashing current disk files does not prove what rendered.
2. Add one failing test: the replay targets a deliberately different fixture/build
   identity and must report blocked or incompatible evidence rather than pass.
3. Implement a minimal development-only identity exchange tied to the loaded
   fixture. Reuse the existing structured fixture record. Keep stale/hot-update
   state explicit and reject mismatched identities before success assertions.
4. Exercise the accepted seed, repair and intentional-block modes through actual
   native input with matching identities, and demonstrate mismatch rejection.
5. Record the actual URL, fresh evidence location and focused commands. Confirm
   production/built mode does not accidentally acquire a source inspector endpoint.
6. Add exact evidence references to the covered IDs, without marking the rest of
   their groups complete. Incorporate feedback before generalizing the mechanism.

Identity exchange is provenance, not cryptographic attestation against a malicious
application. Its guarantee must name the inputs it covers and the stale-bundle
cases it detects. Do not claim that an entire dependency graph or every external
asset was verified unless those inputs are actually included.

### Fresh slice evidence, 2026-09-29

Implemented in the existing agent-verification checkout while preserving its
uncommitted hardening. A source-development Vite transform embeds a fingerprint
into the loaded fixture module. Replay checks its schema/revision/hash/file count
on every structured evidence read and rechecks local files before success.
Missing/mismatched evidence blocks the run before success can be reported.

The source scope covers core runtime source, the fixture and inspector, identity
tooling, development configuration and lockfile. It does not prove installed
package bytes, external assets, or atomic loading of all imports during hot
updates. It is not malicious-server attestation. The fixed inputs and these
limitations are documented in the isolated tooling README.

Fresh commands in `/Users/benlesh/.codex/worktrees/agent-verification/pibbl`, using
Node 24.15.0 through `fnm exec --using=24.15.0`:

- `node --test tooling/agent-verification/identity.test.mjs`: 3 passed, including
  actual browser rejection of a mismatched served fixture with zero action steps.
- `corepack pnpm@11.21.0 exec vitest run packages/core/test/agent-targeting-verification.test.ts packages/core/test/agent-targeting-observation.test.tsx --browser.headless --browser.ui=false`:
  2 files, 8 tests passed.
- `corepack pnpm@11.21.0 exec tsc --noEmit`: passed.
- Targeted ESLint for changed tooling, Vite configuration and fixture: passed.
- `node tooling/agent-verification/replay.mjs 'http://127.0.0.1:5194/#/testing/agent-targeting-verification'`:
  seed, repair and intentional-block passed with matching identities.

Report: `packages/core/test/out/agent-targeting/2026-09-29T21-46-00.711Z/report.json`
in that isolated checkout. Development demo:
<http://127.0.0.1:5194/#/testing/agent-targeting-verification>.
The server must be checked again before relying on its availability later.

This is partial fulfillment of ENV-07/09, EVD-01/09 and HAR-01. General application
provenance, full dependency coverage and integration into the latest checkout
remain outstanding. No entire requirement group or the full goal is closed.

## Canvas Layer targeting slice: ready for feedback, 2026-09-29

The isolated checkout now traverses Canvas Layer interaction entries in paint
order. Snapshot records carry root-logical transforms, inherited clip counts and
immutable ancestor surface paths. Active probes include ancestor clips and Layer
bounds. The record budget applies across the tree (64 entries including surface
boundaries), depth is limited to 16 and native geometry calls to 128. Truncated
queries provide no predicted winner. External renderer resolvers and legacy
geometry remain unsupported and are not invoked.

The shared manual/headless public-API fixture now places the overlapping action
and decoration inside a translated Layer. Its independently specified click
point, expected color and selection outcome are unchanged. A focused browser
test separately exercises translated/scaled/clipped Layer content at pixel ratio
2, compares the prediction with real pointer delivery, checks clip exclusion,
and rejects old evidence after a child signal update. Another test proves the
record budget includes descendants and blocks native probing on truncation.

Fresh evidence in the isolated checkout, Node 24.15.0 / Chromium 151.0.7922.34:

- `corepack pnpm@11.21.0 exec vitest run packages/core/test/agent-targeting-observation.test.tsx packages/core/test/agent-targeting-verification.test.ts --browser.headless --browser.ui=false`: 2 files, 10 tests passed.
- `node --test tooling/agent-verification/identity.test.mjs`: 3 passed.
- `corepack pnpm@11.21.0 exec tsc --noEmit`: passed.
- Targeted ESLint for the changed inspector, example and two tests: passed.
- `node tooling/agent-verification/replay.mjs 'http://127.0.0.1:5194/#/testing/agent-targeting-verification'`: all three modes passed, including pixels, native delivery and matching served identity.

Report: `packages/core/test/out/agent-targeting/2026-09-29T21-54-17.464Z/report.json`
in `/Users/benlesh/.codex/worktrees/agent-verification/pibbl`. The demo was served at
<http://127.0.0.1:5194/#/testing/agent-targeting-verification> for feedback.

This advances HIT-01/02/11/12 and LYR-01/05; it does not close those complete
requirements. It establishes the bounded query and native delivery path through
Layers, not a general surface ownership inspector, arbitrary geometry serializer,
or full resize/transform matrix. Feedback, broader hardening and integration into
the latest checkout remain outstanding. The full goal remains active.

## Clip attribution slice: ready for feedback, 2026-09-29

Candidate evidence now attributes the first excluding clip to its committed
interaction record. It distinguishes an ordinary clip-stack entry from a Layer
surface boundary and includes the stack index, frozen root-logical transform and
fill rule. This does not claim a source component identity, global invisibility,
or that the candidate's geometry would hit if the clip were removed. Later clips
are not evaluated after exclusion, and no native paths or runtime objects escape.

The same public-API lab now provides **Inspect outside Layer**, querying the
independent point (300, 112). Both candidates report the Layer boundary exclusion;
a native click leaves selection and delivery empty. **Inspect target** returns
to (144, 112). The structured record stores the queried point. A separate focused
test distinguishes an explicit transformed clip from Layer bounds and verifies
immutable attribution and null exclusion on an actual hit.

Red evidence: two new tests failed on missing attribution and absent lab action.
After implementation, the two browser files passed all 11 tests. Typecheck and
targeted ESLint passed. The scenario index was regenerated for the registered
action. Node 24.15.0 / Chromium 151.0.7922.34 replay passed the original three
modes plus the new boundary-miss case, preserving served identity checks.

Report in the isolated checkout:
`packages/core/test/out/agent-targeting/2026-09-29T21-58-00.349Z/report.json`.
Run it with `node tooling/agent-verification/replay.mjs 'http://127.0.0.1:5194/#/testing/agent-targeting-verification'`.

This advances GEO-06/10 and HIT-02 without closing their complete scope. General
clip serialization, source mapping, layout diagnosis and global visibility remain
open. Changes remain in the existing isolated checkout, awaiting feedback and
integration; the full objective remains active.

## Layer hardening and bounded clip traversal, 2026-09-29

Additional native-input evidence covers two nested Layers, overlapping root
siblings, an outer Layer resize, removal of the front sibling and stale-token
rejection. A 17-Layer fixture proves excessive-depth refusal without native path
calls and verifies that disposal releases instances, listeners and scheduled work.

Review found a real boundedness gap: a single interaction record could contain an
arbitrarily large clip stack even though record count and native calls were capped.
A new 129-clip test first failed because the snapshot incorrectly claimed complete
coverage. Snapshot traversal now checks stack lengths before copying metadata and
caps cumulative clip references at 128, counting inherited clips for each record.
Excessive input is truncated with no predicted winner or native probe work.

Fresh focused evidence on Node 24.15.0: both targeting browser files passed all
14 tests, TypeScript passed, and targeted ESLint passed. This advances QRY/OBS
boundedness and LYR-05 evidence without closing those groups. The existing four
native replay cases were rerun after the budget change; see the latest report in
the isolated checkout's `packages/core/test/out/agent-targeting/` directory.

Outstanding: integration, broader runtime compatibility, signal/visualization
inspection and the rest of the full inventory. No aggregate completion is claimed.

## Integrated current-checkout verification, 2026-09-29

Fresh evidence in `/Users/benlesh/GitHub/crc`, Node 24.15.0 / Chromium
151.0.7922.34:

- Both targeting browser files: 14 tests passed.
- Identity Node suite: 3 tests passed, including mismatched-server rejection.
- TypeScript and targeted ESLint: passed.
- Scenario index regenerated against current catalog: 63 lessons, 12 tutorial
  snapshots and 27 labs (dated counts, not permanent assertions).
- `corepack pnpm@11.21.0 playground:build`: passed.
- `node tooling/verify-studio-production-output.mjs`: passed; production output
  excludes the development inspector marker as well as acceptance-only behavior.
- Native replay: all four cases passed at
  <http://127.0.0.1:5195/#/testing/agent-targeting-verification>.
  Report: `packages/core/test/out/agent-targeting/2026-09-29T22-02-19.389Z/report.json`.

The first sandboxed browser/catalog commands could not bind local sockets; the
same commands were rerun successfully with approved local execution. These startup
errors are not product-test failures.

The broader `node tooling/verify-docs.mjs` check currently fails because the
unrelated in-progress `docs/site/api/functions/path-geometry.md` page has not been
classified. That work was preserved; no full documentation or aggregate trust
success is claimed. Agent inventory/progress/tooling documentation is registered.

Integration is now accomplished locally. The overall inventory, signal and
visualization facets, and remaining verification obligations are still open.

## Passive signal observation slice, 2026-09-29

Implemented `tooling/agent-verification/signals.ts` in the current checkout and
exposed its snapshots through the existing manually runnable/native-replay lab.
This advances SIG-01/02 and OBS passivity requirements for explicitly registered
signals, without introducing a public package API or claiming general graph
inspection. Each inspect action captures the four application state signals and
the deliberately dormant computed; replay verifies actual selection counts and
that this computed remains unread.

The inspector reads cached runtime fields, never `get()`, validation, observers,
or user payload properties. It distinguishes unread, cached-value and cached-error
states; unobserved computeds are explicitly not claimed current. Scalar previews
and debug names are bounded, complex values and errors are opaque, registrations
are nominal and deduplicated, the 64-entry cap is explicit, records are immutable,
and weak references avoid retaining observed nodes. Cleared weak references are
not presented as owner teardown evidence. This is not an atomic publication or
full graph/owner inspection API.

Fresh evidence: 3 dedicated browser tests and 5 shared fixture tests passed;
targeted ESLint passed. The identity suite passed all 3 tests. Native replay
passed all four cases with signal evidence and unchanged dormant evaluation count:
`packages/core/test/out/agent-targeting/2026-09-29T22-07-04.622Z/report.json`.
Production Studio build and output exclusion check passed with both inspector
schema markers forbidden. Environment: Node 24.15.0 / Chromium 151.0.7922.34.

The aggregate TypeScript command reported errors only in concurrently changing
path-geometry tests. Those files were preserved; no whole-checkout typecheck
success is claimed for this turn. Signal snapshot files reported no type errors.

Manual feedback: <http://127.0.0.1:5195/#/testing/agent-targeting-verification>;
choose Inspect target before and after Repair plus a native button click. Signal
observation is historical until another inspect action. Dependency edges,
causality, runtime ownership and visualization evidence remain open.

## Recorded signal dependency slice, 2026-09-29

The source-only inspector now reports bounded recorded computed dependencies:
registered source ID (or null for an unregistered source), observed/source stored
versions and subscribed state. It traverses at most 128 edges per snapshot and
labels truncation per record and overall. Evaluating formula dependencies are
unavailable. It never evaluates, subscribes, discovers arbitrary nodes or invokes
callbacks. Readonly views share node identity; inspector sessions are distinct.

A conditional selection-label computed in the public-API lab demonstrates a real
branch change: seed/repair read mode and selected item; intentional-block reads
mode only. Native replay now asserts those exact dependencies and preserves the
never-read dormant computed. Historical snapshots stay immutable; tests verify
that changing an unobserved source does not rewrite dependencies until application
evaluation, and that unregistered sources stay undiscovered.

Evidence: two new focused tests first failed on missing dependency records/budget
reporting; the lab test failed until the new computed was exposed. The signal and
shared lab suites now pass all 10 tests. Targeted ESLint passed. Four native replay
cases passed with exact branch evidence:
`packages/core/test/out/agent-targeting/2026-09-29T22-10-13.915Z/report.json`.
Node 24.15.0 / Chromium 151.0.7922.34. The broad typecheck currently reports only
concurrent path-geometry-utilities test errors, which were preserved.

This advances SIG-01/03 and QRY/OBS boundedness. It does not establish write/render
causality, observer-to-surface ownership, untracked reads or full graph discovery.
Those and visualization verification remain open. No aggregate completion claim.

## Visualization value/geometry slice, 2026-09-29

Extended the existing public-API hover lab, avoiding a duplicate chart runtime.
It now exposes structured JSON, data generations, an Update first series action,
historical state copies and scoped readiness for rendered mode/inspection/data.
Fixed three-frame waits were replaced by that predicate and a five-second timeout;
disposal cancels pending work and removes evidence. Native hover also publishes
fresh state for manual and agent consumers.

The focused test independently calculates plot origin (55,175), dimensions
(917,375), domain x=5 and anchors. Initial interpolation yields y=20 for both
series; changing the first series yields y=30 at anchor (458.5,93.75), while the
second stays at y=20. Native pointer input exercises the actual interaction path.
The browser test first failed on absent generation evidence, then passed. The
existing hover-lab regression test also passed. TypeScript and targeted ESLint
passed on the latest current checkout (the earlier unrelated type errors were no
longer present in this run).

`tooling/agent-verification/viz-replay.mjs` checks the actual Studio controls and
native hover. It derives expected plot size from host dimensions and fixture
layout independently of the scale/query output. Both generations passed:
`packages/core/test/out/agent-viz/2026-09-29T22-14-58.675Z/report.json`.
Environment: Node 24.15.0 / Chromium, browser version recorded in the report.
Manual URL: <http://127.0.0.1:5195/#/testing/viz-hover-lab>.

This advances DAT/VIZ/VIN analytical evidence and SCH scoped readiness for this
fixture. It is not a general chart inspector or pixel-correctness proof. Served
source identity is explicitly unverified for this new replay; missing-data,
geometry/data edge cases, responsive changes and broader visualization requirements
remain open. The complete inventory remains the active objective.

## Visualization missing-data evidence, 2026-09-29

Added an Insert missing observation action to the same public-API hover lab.
The first series becomes (0,10), (5,null), (10,30). Native browser verification
checks x=2.5, 5 and 7.5 and requires no interpolation across either broken segment.
The unaffected second series must still return the independently calculated y;
empty results for both series would fail. Earlier snapshots retain both results.

The focused test first failed because the action did not exist. After adding it,
the new verification and existing hover-lab regression tests passed. Targeted
ESLint passed and the scenario index was regenerated. Native Studio replay now
checks three data generations (initial, changed values, missing observation),
including explicit series identities so stale results cannot pass by count alone.
Report: `packages/core/test/out/agent-viz/2026-09-29T22-16-55.186Z/report.json`.

This advances missing-data and gap semantics within VIZ/VIN requirements. It does
not verify general missing-data policies, extrapolation, duplicate x, or exact
pixel gaps. Served source identity for the visualization replay remains explicitly
unverified. The full inventory remains open.

## Visualization served identity, 2026-09-29

Closed the explicitly recorded provenance gap for the visualization fixture by
extending the existing development-only identity transform to its loaded lab
module. The visualization scope includes core and viz source, the lab and shared
example, identity tooling, development configuration and lockfile. Replay checks
the served marker before actions, with each evidence read, and against local bytes
again before success. Relevant source edits trigger reload. Production/built mode
still receives no transformed identity. Full dependency bytes, external assets,
atomic module loading and malicious-server attestation remain outside scope.

A native mismatched-server test first failed because visualization replay did not
reject identity or save the expected blocked report. It now rejects before any
action, preserves the received mismatched identity and writes a blocked report.
The identity suite passes all 4 tests, including loaded markers for both scopes,
source-only application and native rejection for each replay. Targeted lint passed.

Fresh live visualization replay passed all 3 generations with matching identity:
`packages/core/test/out/agent-viz/2026-09-29T22-19-09.209Z/report.json`.
The original targeting replay also passed all 4 cases after the shared change:
`packages/core/test/out/agent-targeting/2026-09-29T22-19-26.766Z/report.json`.
This supersedes earlier notes labeling visualization source identity unverified.
It advances ENV/EVD/HAR provenance for these fixtures, not every application.

## Visualization resize and density evidence, 2026-09-29

Added rendered viewport metadata to the shared example snapshot and included it
in the lab readiness predicate. The previous mode/data/inspection-only predicate
could not distinguish geometry from a previous viewport. A new test first failed
on absent viewport evidence, then passed after resizing the host from 1000 to 600
CSS pixels. Independent expected plot geometry is (55,235,517,315); native input
at (313.5,392.5) must produce x=5,y=20 and local anchors (258.5,157.5).

The new visualization test plus existing hover-lab tests pass (3 tests across two
files). Typecheck and targeted lint pass. Native Studio replay at
`PIBBL_VERIFY_DENSITY=2` passed all three data generations and independently checks
rendered viewport agreement; source identity matched:
`packages/core/test/out/agent-viz/2026-09-29T22-21-42.108Z/report.json`.

This advances GEO/VIZ responsive-coordinate and SCH readiness evidence. The host
predicate is scoped to this padding-free fixture and rounds client dimensions;
it does not promise arbitrary CSS-transform/padding readiness or exact pixel
antialiasing equivalence. The remaining inventory is still active.

## Logical capture versus geometric targeting, 2026-09-29

Added a separate bounded capture facet to the targeting snapshot and labeled
probes `geometry-only`. The facet reads at most 32 Pibbl-owned logical capture
records without invoking native methods or cleanup-capable runtime lookups. It
reports liveness, target IDs and pointer IDs; native activation/transfer details
and external-renderer capture remain explicitly unavailable. Capture state may
change without a render generation change and is not a geometry-token guarantee.

A native drag test independently proves that the geometric winner differs from
the capture delivery owner. The same public lab now has Capture drag, records
actual pointer delivery outside the blue control, and shows the simultaneous
geometric miss. Release clears ownership. Tests first failed on absent capture
metadata/mode, then passed: 16 tests across the two targeting browser files.
Typecheck and targeted lint passed.

The initial Studio replay timed out because raw pointer coordinates targeted an
offscreen Canvas after clicking controls. Scrolling the Canvas into view before
measuring coordinates fixed that harness issue. All five replay cases then passed:
`packages/core/test/out/agent-targeting/2026-09-29T22-26-34.468Z/report.json`.
This advances HIT-10 and EVT evidence without claiming complete pointer capture,
transfer, multipointer or native activation inspection. Full inventory remains open.

## Browser interception evidence, 2026-09-29

Implemented an explicit active owner-document point query, separate from passive
runtime observation and geometric targeting. It uses client-CSS coordinates,
returns immutable status/point/tag evidence, and does not read arbitrary element
content. Shadow-root hosts and ancestor-frame interception are not claimed; the
query may flush layout and says nothing about pixel opacity or future delivery.

The shared lab's Add DOM overlay / Remove DOM overlay actions demonstrate a real
HTML interceptor over a valid Pibbl target. Native clicks first reach only the
overlay, then select item A after removal. Mode changes/disposal remove owned DOM
and restore parent positioning. The helper enters the targeting identity scope
and is forbidden in production output.

The browser-helper tests and shared lab suite pass all 9 tests; typecheck and
targeted lint pass. Studio build and production exclusion check pass. All six
native replay cases pass, including browser evidence captured at the intercepted
click point and successful selection after removal:
`packages/core/test/out/agent-targeting/2026-09-29T22-30-53.096Z/report.json`.
This advances HIT-13 and browser/application evidence. General host transforms,
shadow DOM, ancestor frames and visual occlusion remain open.

## Combined verification integration, 2026-09-29

Added `corepack pnpm@11.21.0 test:agent-verification` as the repeatable focused
entry point. It runs both native served-identity rejection paths plus all current
agent browser tests and the existing hover-lab regression. Fresh execution passed
27 browser tests across 6 files and all 4 identity tests. The browser tests are
already discovered by ordinary `test:ci`; the separate identity suite is now also
included in `trust:browser` so those guards participate in aggregate verification.

Catalog/source-discovery validation passed for the combined current checkout.
Updated stale isolated-checkout wording and follow-on tasks, and formatted the
inventory/progress/tooling documents and package manifest; focused Prettier check
passed. No unrelated work was reformatted.

The broad documentation checker currently fails on the unrelated
`docs/superpowers/plans/2026-09-28-component-manipulation-implementation.md` lacking
its required Historical status banner. That in-progress plan was left untouched.
This supersedes the earlier path-geometry-page documentation failure; it is not a
claim that the aggregate trust gate passed. Full inventory completion remains
unproven and the objective remains active.

## Native versus logical focus, 2026-09-29

Added a separate bounded focus facet to the targeting snapshot: native focus in
the owner document, logical target ID, focus-visible state and up to 64 committed
candidates with source order and root bounds. It reads the known Pibbl manager's
committed fields without invoking focus/navigation/subscription methods. Missing
policy is unconfigured; unknown or pending policy is unavailable. No accessibility
tree, native ancestor-frame focus or visible focus-indicator proof is implied.

The new native Tab test verifies entry from a DOM button, movement between two
logical targets and exit to the following DOM button. Historical focus snapshots
remain unchanged. The shared lab's Keyboard focus mode refreshes evidence after
native focus/key events settle, without forcing a focus-stealing Inspect click.
Async failures are explicit and pending work cancels on disposal.

Focused browser evidence: 19 tests passed across the two targeting files.
TypeScript and targeted ESLint passed. Native Studio replay now passes seven
cases, including one pointer activation plus exactly one Enter activation and
logical focus matching the actual delivery target:
`packages/core/test/out/agent-targeting/2026-09-29T22-38-04.609Z/report.json`.
This advances FOC-01/02/05; directional candidate explanations, broader removal
and modality cases, visible focus pixels and accessibility evidence remain open.

## Visible focus indicator evidence, 2026-09-29

The Keyboard focus demonstration now authors its interactive control with public
`useEventTarget` and draws a magenta ring only when the returned state is
focus-visible. A narrow independently specified pixel (76,80) is background under
pointer focus, magenta after native Tab entry, and background again after native
blur. Enter still produces exactly one additional activation.

The first test assumption—that Enter after a pointer click would force keyboard
modality—was contradicted by the runtime contract. The test was corrected to use
native Tab entry; no runtime modality behavior was changed to satisfy that wrong
assumption. The public lab test then passed all 8 tests, including the absence,
appearance and removal pixel checks. Typecheck and targeted lint passed.

Native Studio replay passed all seven cases and independently checked both pointer
and keyboard pixel values, separately from the focus-state snapshot:
`packages/core/test/out/agent-targeting/2026-09-29T22-40-55.510Z/report.json`.
This advances FOC-03 and focused PIX evidence. The exact sample is an integer-aligned
solid stroke, not a text/antialiasing baseline; contrast compliance and semantic
accessibility remain unverified. The complete inventory remains open.

## External replay watchdog slice, 2026-09-29

Added a parent-process deadline runner for targeting and visualization replay.
It reserves a fresh evidence directory, writes separate watchdog status, preserves
child artifacts, bounds captured diagnostics and escalates SIGTERM to SIGKILL.
It does not interpret normal process exit as semantic success. A timeout remains
a timeout even if the child responds to termination with exit code zero.

The initial focused test failed because the runner did not exist. Four tests now
pass: a deliberately infinite child loop with preserved partial report and confirmed
process exit, bounded diagnostics/nonzero and zero exits, directory/deadline guards,
and cooperative zero exit after timeout. Node 24.15.0 was used. Targeted lint passes.
The focused suite is wired into the combined agent check and `trust:browser`.

A watchdog-wrapped live Studio targeting replay completed normally with all seven
cases passing on Chromium 151.0.7922.34. Both process and semantic evidence are in
`packages/core/test/out/agent-watchdog/targeting-2026-09-29-1/` (`watchdog.json`
and `report.json`). The first sandboxed HTTP probe could not connect; the existing
server was confirmed listening and the authorized browser replay succeeded.

HAR-14 is advanced, not closed: direct-child termination is verified, but detached
browser descendant cleanup, browser crash/hang injection, parent interruption and
filesystem failure reporting remain outstanding. No aggregate trust or full
inventory completion is claimed.

## Parent-owned browser cleanup, 2026-09-29

Extended the watchdog CLI to own Chromium through Playwright's browser-server
API, supplying only the connection endpoint to the replay. Both replay scripts
support that connection while retaining their direct-launch mode. On every child
outcome the parent kills its browser with a bounded wait and records independent
cleanup status. Failed or unconfirmed cleanup cannot produce CLI success.

A failing test first showed that the existing runner did not provide an owned
browser. It now injects an infinite page loop and an infinite replay-process loop,
preserves the last application record, reaches timeout, forces child termination,
and verifies the browser PID plus every observed browser process-group member no
longer exists. This is real Chromium evidence, not a mocked cleanup callback.
The process-group test is POSIX-specific and explicitly skipped on Windows.

Fresh Node 24.15.0 evidence: all five watchdog tests passed. Native parent-owned
replays passed seven targeting cases and all three visualization generations;
both parent reports confirm browser termination. Artifacts:
`packages/core/test/out/agent-watchdog/owned-targeting-2026-09-29-1/` and
`packages/core/test/out/agent-watchdog/owned-viz-2026-09-29-1/`.
Targeted lint passed. The browser test joins the existing focused and aggregate
watchdog entry point. No aggregate trust gate was run this turn.

This supersedes the preceding slice's direct-child-only limitation for the CLI.
HAR-14 remains partial: parent interruption, browser crash handling, arbitrary
escaped descendants and filesystem failure evidence remain open. The inventory
and full objective remain active.

## Native browser failure classification, 2026-09-29

Added a shared observer for actual page-crash and unexpected browser-disconnection
events and integrated it into both replay reports. Error categories use observed
events rather than matching error prose. Expected teardown is explicitly marked;
final observations are separate from the category known when an operation failed.
Immutable snapshots and listener teardown avoid retaining live browser objects.

An initial attempted replay test used `chrome://crash`, but navigation aborted
before a crash event arrived. That was not valid crash evidence. Replaced it with
a real already-open renderer crash through Chromium's debugging protocol, waiting
for its native crash event. Two native tests now pass for crash observation,
historical snapshot immutability, unexpected disconnect and expected cleanup.
All four existing identity tests also passed. Node 24.15.0 was used; targeted lint
passed. These tests join the watchdog test entry point.

Normal parent-owned Studio replays still pass all seven targeting cases and three
visualization generations, report neither crash nor unexpected disconnect, and
confirm browser cleanup. Reports are under
`packages/core/test/out/agent-watchdog/crash-observation-targeting-1/` and
`packages/core/test/out/agent-watchdog/crash-observation-viz-1/`.

This advances ERR-01/02 and HAR-14 without claiming full crash recovery or cause
analysis. Crash injection between completed application steps, durable checkpoints
before forced termination, parent interruption and filesystem failure handling
remain open. The complete requirements objective remains active.

## Partial replay checkpoints, 2026-09-29

Both replays now save a separate atomic checkpoint before navigation, before and
after each scenario action group, and before cleanup. Run IDs link checkpoint and
final report. Checkpoints always remain partial, including when every saved step
passed; the embedded report is explicitly incomplete. Sequential writes replace
one same-directory temporary file by rename and enforce a 4 MiB evidence budget.
A failed replacement preserves the prior checkpoint and first failure.

The initial test failed on the missing writer. Two focused tests now pass for
partial status, immutable serialized evidence, increasing sequence/run identity,
invalid and oversized replacement preservation, and forced termination after one
completed check and one unfinished action. The latter confirms no final report
exists while completed evidence and the active stage survive. Node 24.15.0 and
targeted lint both passed.

Fresh parent-owned Studio replays passed seven targeting cases and three
visualization generations. Their saved checkpoints match the final step arrays,
share run IDs, and remain partial. Evidence is under
`packages/core/test/out/agent-watchdog/checkpoint-targeting-1/` (17 checkpoints)
and `packages/core/test/out/agent-watchdog/checkpoint-viz-1/` (9 checkpoints).
These tests join the existing watchdog/aggregate test entry point.

This advances EVD-10/14 and HAR-14. Preservation is across process termination,
not power failure; no fsync guarantee is claimed. Observations between checkpoints,
real application-step crash injection, interrupted-parent cleanup and broader
filesystem failure handling remain open. The full inventory remains active.

## Visualization duplicate policy and source provenance, 2026-09-29

Extended the existing public-API hover example/lab with first/last duplicate
policies and an equal-x row reorder. Structured results carry recorded source
index/optional row ID, or interpolation before/after indices/IDs and fraction.
The fixture also records its duplicate policy and existing data generation.
Rows lacking application IDs report null; index is not a stable entity identity.
No runtime query semantics or learning-example defaults changed.

The new browser test first failed on missing actions. Four tests across the agent
visualization and existing hover-lab suites now pass. They verify exact x=5 values
and source identities, x=2.5 interpolation endpoints/fraction/values, independent
mapped anchors, unaffected second-series values and retained earlier snapshots.
Typecheck and targeted lint pass. The catalog/index was regenerated against the
current checkout without replacing unrelated catalog changes.

Native Studio replay now passes six generations under the parent watchdog,
including all three duplicate cases and two inspected x-values per case. Saved
identity matches and browser cleanup is confirmed. Evidence:
`packages/core/test/out/agent-watchdog/viz-duplicate-1/`. Environment: Node 24.15.0,
Chromium 151.0.7922.34. Manual URL:
<http://127.0.0.1:5195/#/testing/viz-hover-lab>.

This advances DAT-01/02/05 and VIN-03/04 for the fixture. Reordering equal-x rows
changes first/last selection deliberately; it is not order-invariant resolution.
Arbitrary descending interpolation data is unsupported and must be rejected.
Native default-duplicate/order rejection, unsorted nearest-query evidence and
broader visualization requirements remain open. No full inventory completion.

## Unsorted nearest-query and clearing evidence, 2026-09-29

Added two manual actions to the existing hover lab: unsorted nearest observations
and an empty first series. The native test verifies earliest-source duplicate and
equal-distance tie resolution at x=5, 2.5 and 7.5, original row IDs/indices,
recorded coordinates and independent anchors. Repeating at two pointer heights
checks nearest-x independence from pointer y. Emptying the first series must
preserve the unaffected second-series result; native pointer leave clears all
hover results. Earlier snapshots retain their previous selections.

The new test first failed on the absent action. Five tests across the agent viz
and existing hover-lab suites now pass. A subsequent typecheck caught a possibly
undefined saved test snapshot; the assertion was corrected and fresh typecheck
passed. Targeted lint passed and the scenario index was regenerated.

Native Studio replay passes all eight data generations with matching identity,
partial checkpoints and confirmed parent-owned browser cleanup. Evidence:
`packages/core/test/out/agent-watchdog/viz-nearest-1/`. Node 24.15.0 and Chromium
151.0.7922.34. Manual URL:
<http://127.0.0.1:5195/#/testing/viz-hover-lab>.

This advances VIN-01/02/03/06 and DAT empty-data evidence for the fixture. Nearest
accepts unsorted input; interpolation's nondecreasing-order contract is unchanged.
Closest-point pixel-distance ranking, threshold boundaries and invalid-input
rejection remain outstanding. The full requirements goal remains active.

## Native closest-point distance and cutoff, 2026-09-29

Added processed plot-local pointer evidence and explicit distance units to the
shared hover example snapshots. Closest-point results carry plot-pixel distance;
nearest-x results carry domain-x distance; interpolation reports null. Public
query behavior and the existing 40-logical-pixel cutoff remain unchanged.

The new browser test first failed on missing pointer evidence. After adding the
facets, it verified native distances 30, 40 and 40.25, inclusion at the exact
cutoff, absence beyond it, distinct nearest-x behavior at the same x with a distant
y, and selection from the second series. A non-binary fractional native input
showed approximately 0.0000061 logical-pixel quantization; its zero-distance check
now documents a 0.0001-pixel tolerance. Exact binary cutoff assertions were not
relaxed. Six focused browser tests across two files pass; fresh typecheck and
targeted lint pass.

Both normal and double-density parent-owned Studio replays pass nine cases,
including the new native cutoff checks. Evidence:
`packages/core/test/out/agent-watchdog/viz-point-distance-1/` and
`packages/core/test/out/agent-watchdog/viz-point-distance-density2-1/`.
Node 24.15.0 / Chromium 151.0.7922.34. The asserted native pointer positions replace
the action's older synthetic setup position before acceptance.

This advances VIN-01/02 and GEO/VIZ density evidence. Closest-point cross-series
ties, actual mark/stroke hit testing, domain-distance limits and broader input
rejection remain open. The full requirements goal remains active.

## Combined integration and production audit, 2026-09-29

Fresh `corepack pnpm@11.21.0 test:agent-verification` passed all 32 browser tests
across six files, four identity tests and nine watchdog/browser-failure/checkpoint
tests. This supersedes earlier combined totals for the currently implemented
slices. Environment: Node 24.15.0, pnpm 11.21.0 and Playwright Chromium. No tests
were skipped in this macOS run.

`corepack pnpm@11.21.0 playground:build` also passed, including source/built/editor
public export-name parity checks. A fresh
`node tooling/verify-studio-production-output.mjs` inspected 270 generated browser
bundles and passed the forbidden inspector/acceptance marker checks. This verifies
the current source-only boundary after the additional fixture and harness work.
Build output includes existing Vite configuration and large-chunk warnings; no
bundle-size or build-warning elimination claim is made.

`node tooling/verify-docs.mjs` still fails on the unrelated in-progress
`docs/superpowers/plans/2026-09-28-component-manipulation-implementation.md` missing
its required Historical status banner. That concurrent plan was preserved.
The aggregate trust gate is not passing by inference from the focused checks,
and was not claimed complete. Updated the group accounting descriptions to reflect
implemented facets while preserving every requirement's open/partial status.

The next priorities remain substantive observability gaps, including layout/paint
explanations, signal-to-render causality, animation and external-renderer evidence,
alongside remaining failure and visualization cases. The objective is unchanged.

## Committed root surface inspection, 2026-09-29

The existing source-only targeting inspector now exposes immutable committed root
surface geometry: logical viewport, cached CSS content size, backing dimensions,
effective density in both CSS/logical units, fit/mode and forward/inverse
logical-to-backing matrices. It performs no DOM measurement and returns unavailable
geometry for pending, unavailable, disposed or stale roots. Host client geometry
and visibility are explicitly not inferred from the cached surface.

A new public-API browser test first failed on the missing facet. It independently
verifies a contain-fitted 300×100 logical scene in a 600×400 CSS host at density 2:
backing 1200×800, transform [4,0,0,4,0,200], inverse conversion, a painted red pixel
at (200,320), and native CSS click (100,160) delivered at logical (50,30). DOM
measurement throws during the inspection call; immutable history and disposal are
also checked. The fixture's JSON test then exposed negative-zero matrix entries;
normalizing zeros fixed the data-only evidence discrepancy without changing math.

Fresh verification: 20 targeting browser tests across two files passed, including
existing passivity/ownership checks. Typecheck and targeted lint passed. All seven
native Studio targeting replay cases passed with surface assertions:
`packages/core/test/out/agent-watchdog/targeting-surface-1/`.
Node 24.15.0 / Chromium 151.0.7922.34. Manual evidence is available via Inspect target
at <http://127.0.0.1:5195/#/testing/agent-targeting-verification>.

This advances GEO-01/02/07 and OBS passivity for one committed root surface.
Declared-vs-effective configuration, nested surface facets, client-space mapping,
resize/zero-size transitions and full geometry diagnosis remain open. The full
requirements objective remains active.

## Generation-checked point/vector conversion, 2026-09-29

Added `convert` to the source-only inspector, supporting root-logical, backing and
CSS-content points/vectors from a matching committed generation. Points include
fit translation; vectors omit it. Results explicitly refuse stale/unavailable
geometry, unsupported client spaces, nonfinite inputs and overflow. Frozen values
are normalized for JSON and never clamp outside-viewport coordinates.

The new focused test first failed because the method was absent. The two targeting
browser suites then passed all 21 tests. Adding repeated conversions to the existing
passivity test also passed all 13 observation tests, preserving graph, scheduler,
canvas state and resource evidence. Typecheck and targeted lint passed.

Manual and captured-pointer fixture evidence now includes backing and CSS-content
mappings. All seven parent-owned Studio targeting replay cases pass with mapping
values and generation checks:
`packages/core/test/out/agent-watchdog/targeting-conversion-1/`.
Node 24.15.0 / Chromium 151.0.7922.34. Use Inspect target in the existing lab to
capture the new data; no extra browser measurement is performed by conversion.

This advances GEO-03 and OBS. Client/page space, arbitrary CSS transforms, nested
local-space mapping and singular custom transforms remain unsupported here.
Pending realm work does not invalidate otherwise-current committed geometry; it is
reported separately, without claiming application-wide readiness. The full goal
remains active.

## Responsive resize, hidden hosts and density policy, 2026-09-29

Added configured pixel-ratio policy to the committed surface facet, separately
from effective x/y density after backing rounding. A new native ResizeObserver
scenario verifies responsive dimensions changing from 600×400 to 300.25×100.5 at
ratio 1.5, independently expecting a 450×151 backing and unequal effective ratios.
It verifies stale-token refusal, a painted landmark and native click coordinates,
then hides/shows the host and checks unavailable geometry followed by a new usable
generation. Earlier snapshots remain unchanged. Predicate polling drives the manual
scheduler while waiting for real browser resize notifications.

The test exposed fractional native-transform rounding around 0.0000001 pixel;
conversion/input assertions use an explicit 0.0001-pixel tolerance while sizes and
density ratios remain exact. It also first failed on absent configured-ratio data
before the new field was implemented. Fresh verification passed 22 targeting
browser tests, typecheck and targeted lint. Native Studio replay passed all seven
cases with the configured-ratio assertion:
`packages/core/test/out/agent-watchdog/targeting-density-policy-1/`.
Environment: Node 24.15.0 / Chromium 151.0.7922.34.

This advances GEO-01/07/08 for responsive resize, fractional dimensions and hidden
hosts. Configuration is resolved policy, not explicit-input provenance. Device
ratio changes, arbitrary CSS transforms and all fitting modes still need broader
matrix evidence. The full requirements goal remains active.

## Passive signal consumer evidence, 2026-09-30

The source-only signal inspector now reports bounded direct subscriptions with
stable session-local consumer IDs, computed/render/other classification, registered
computed IDs, observed versions and available render dirtiness. It inspects only
own data descriptors for consumer flags, avoiding legacy callback getters. Active
notification/evaluation yields unavailable evidence; a separate 128-edge budget
reports truncation. It neither evaluates computed values nor adds subscriptions.

The focused test first failed on missing observer evidence. Fresh browser
verification then passed 15 tests across signal observation and targeting fixture
suites, including the 129-observer budget and throwing-getter check. Typecheck and
targeted ESLint passed under Node 24.15.0 / pnpm 11.21.0.
All seven native targeting replay cases passed under Chromium 151.0.7922.34,
including dynamic computed subscription removal and settled render dirtiness:
`packages/core/test/out/agent-watchdog/targeting-observers-2026-09-30-2/`.
The preceding run used the Studio home URL accidentally and stopped at navigation;
its failed report is preserved in the sibling `-1/` directory. Both runs confirmed
owned browser cleanup.

Verification commands: `vitest run packages/core/test/agent-signal-observation.test.tsx
packages/core/test/agent-targeting-verification.test.ts --browser.headless
--browser.ui=false`, `tsc --noEmit`, targeted ESLint, and the parent-owned
`watchdog.mjs targeting` replay at the targeting fixture URL.

Inspect target in <http://127.0.0.1:5195/#/testing/agent-targeting-verification>
exposes the new observer records in signal evidence. This advances signal graph
observation and passivity only. Consumer IDs do not yet map to named components or
surfaces; dirtiness alone does not establish cause, and no full causal trace is
claimed. The full 373-requirement objective remains active and incomplete.

## Signal consumer component/surface ownership, 2026-09-30

Added optional exact-canvas binding to source-only signal inspection. Direct
component subscribers now correlate to stable session-local numeric component and
surface IDs, bounded display paths/names, root/Layer classification and render
revisions. The scanner traverses Pibbl-owned records with limits of 64 surfaces,
256 component records and 256 paint entries. Unknown owners remain null. A small
internal opaque identity accessor connects existing consumer state to component
records without installing production tracking or changing signal behavior.

A new public-API root-plus-Layer test failed first on missing ownership evidence,
then passed with independent expected surface kinds and identity separation. It
checks repeated inspection leaves graph counters unchanged, saved snapshots remain
immutable, and disposal/replacement never silently rebinds the old inspector.
The shared Studio fixture exposes the same evidence through Inspect target.

Fresh verification under Node 24.15.0 / pnpm 11.21.0 / Chromium 151.0.7922.34:
`vitest run packages/core/test/agent-signal-observation.test.tsx
packages/core/test/agent-targeting-verification.test.ts
packages/core/src/lib/signals/render-consumer.test.ts --browser.headless
--browser.ui=false` passed 23 tests in three files. Typecheck and targeted ESLint
passed. All seven native targeting replay cases passed with ownership and settled
revision assertions in
`packages/core/test/out/agent-watchdog/targeting-signal-owners-2026-09-30-3/`.
An earlier replay encountered connection refusal during development configuration
reload; the existing server listener was confirmed live before retrying, and its
failed report was retained.

This advances SIG-05 ownership correlation and SIG-13 disposal evidence. It does
not explain a causal path from an individual write through computed equality to
pixels. Official external-renderer ownership, source locations and exhaustive
traversal-limit tests remain open. This is a feedback-ready slice; the complete
373-requirement objective remains active.

## Ownership limits and pending revisions, 2026-09-30

Ownership snapshots now expose frozen visit counts and configured limits. A focused
large-scene test first failed on absent count/limit evidence, then passed after
implementation. It retains the known subscriber with null ownership after the
256-component cutoff. Additional public scenes verify the 64-surface cutoff
(root plus 63 of 65 Layers), two canvases sharing a signal with only the bound
canvas attributed, and pending writes advancing requested revisions without
claiming a new committed render generation. Consumer identity and historical
snapshots remain stable through settling.

Fresh `corepack pnpm@11.21.0 test:agent-verification` passed all 42 browser tests
in six files, four identity tests and nine watchdog/crash/checkpoint tests.
`tsc --noEmit` and targeted ESLint passed. Node 24.15.0, pnpm 11.21.0 and
Playwright Chromium 151.0.7922.34 were used. The native targeting replay passed
all seven cases and confirmed owned-browser cleanup:
`packages/core/test/out/agent-watchdog/targeting-ownership-limits-2026-09-30-1/`.
The fixture evidence includes visit counts and limits through Inspect target.

This advances bounded observation, SIG-05 ownership scope and SIG-06 temporal
distinctions. Independent paint-entry-budget exhaustion, observations during
active render failure/rollback, full write causality and external-renderer
ownership remain open. No full repository trust gate or requirement-wide
completion is claimed; the full objective remains active.

## Computed equality and dependency replacement evidence, 2026-09-30

Added two public-API signal observation scenarios that independently compare
source/computed versions, dependency edges, subscriber dirtiness, component/formula
evaluation counters, owning surface generation and Canvas pixels. A changed source
with equal computed color validates without repainting; a later changed result
advances rendering and changes a solid interior pixel from red to blue. An equal
source write leaves the snapshot unchanged.

The dynamic branch scene switches between equal-valued sources, verifies that
subscriptions change even though computed revision and render generation do not,
then proves the detached source schedules no host frame. The newly selected
source subsequently advances computed revision/render generation and expands the
painted rectangle. Historical dependency snapshots remain unchanged.

Test development caught two oracle/setup mistakes: the first pixel check assumed
an implicit logical viewport, now explicitly fixed at 100×100; the branch test
attempted to flush a frame after a detached-source write, now correctly asserting
zero pending frames. Neither required a runtime change.

Fresh `vitest run packages/core/test/agent-signal-observation.test.tsx
--browser.headless --browser.ui=false` passed all 14 tests under Node 24.15.0 /
pnpm 11.21.0 / Playwright Chromium. Typecheck and targeted ESLint passed. This
turn changed tests and documentation only; the previous combined-suite result
remains dated evidence, not a newly rerun aggregate result.

This advances SIG-03/05/06/13 controlled evidence. It does not implement general
write outcome tracing, callback/error attribution, or multi-write causal history.
The complete inventory goal remains active.

## Passive realm scheduler evidence, 2026-09-30

Added source-only `observeScheduler()` and embedded it in signal snapshots.
Evidence includes phase, frame identity and separate host/logical times, queued
host frames, pending computed validation, dirty/registered roots and instances,
advance registrations, Begin commands and completion counts. It preserves the
distinction between idle phase and pending work. Application readiness is unknown;
external assets, fetches and browser tasks are not observed.

The focused test initially could not resolve the new adapter; the pending-computed
assertion subsequently failed on the absent field before implementation. A public
scene now verifies repeated passive reads request no frame, Plan/Render correlate
to one frame, snapshots remain immutable, pending validations drain, and disposal
restores root registration counts.

Fresh `vitest run packages/core/test/agent-signal-observation.test.tsx
packages/core/test/agent-targeting-verification.test.ts --browser.headless
--browser.ui=false` passed 23 tests across two files under Node 24.15.0 / pnpm
11.21.0 / Playwright Chromium. Typecheck and targeted ESLint passed. Native replay
passed all seven cases with scheduler assertions and confirmed browser cleanup:
`packages/core/test/out/agent-watchdog/targeting-scheduler-2026-09-30-2/`.
Use Inspect target in the targeting lab and read `signalInspection.scheduler`.

This advances SCH-01/04/06 partial evidence. It is a current-state observation,
not a phase trace or per-request causal explanation. The payload is fixed-size;
underlying dirty-root counters scan queued work and ancestry, so strict bounded
observation cost remains open. Advance registration counts do not establish active
playback. Broader phase/failure coverage and participating-root identities remain
open. The full requirements objective remains active.

## Bounded explicit scheduler phase history, 2026-09-30

Added phase-entry facts to the existing source diagnostic seam and a bounded
circular-buffer recorder. It records Begin through Complete and return to idle
with frame identity, host/logical time and recorder sequence. Retention is explicit
and capped at 1–1024 entries; snapshots report dropped entries. Starting requests
no frame; stopping retains evidence and disposal releases/clears it. Exclusive
collector ownership prevents replacement in either direction. Ordinary inspection
still installs no collector.

The shared targeting lab now has Start/Stop phase recording controls and immutable
`schedulerHistory` evidence. The initial history test failed on the absent export;
the lab test failed on absent state before wiring. Catalog validation caught action
ordering drift, which was corrected before regenerating the scenario index.

Fresh verification: 114 tests passed across signal observation, targeting fixture,
scheduler and animation playback suites using `vitest run` with headless browser
flags, Node 24.15.0 and pnpm 11.21.0. Typecheck and targeted ESLint passed. Scenario
index generation validated the updated catalog. Native Studio replay passed all
seven cases with phase/frame assertions and explicit stopping:
`packages/core/test/out/agent-watchdog/targeting-phase-history-2026-09-30-1/`.

This advances SCH-03 bounded phase history. Records mark entry, not duration or
success: idle precedes next-work promotion and aggregate error delivery. Partial
frames, per-request causes, failure classification, individual root participation
and generation correlation remain open. The full requirements objective remains
active and incomplete.

## Scheduler collected-error summary and root isolation, 2026-09-30

Idle phase records now include a scalar count of scheduler-collected errors and
`errors-collected`/`no-collected-errors` outcome. Earlier entries have null outcome
and count. This prevents phase completion from being interpreted as success,
without retaining user exceptions or exposing their messages. Counts describe
scheduler error entries, not nested error trees.

A new public two-root test failed on missing summary fields before implementation.
It now proves that a failing component's original error reaches the caller while
an unrelated root paints its independently expected blue pixel. The phase sequence
reaches idle with one error; previous zero-error snapshots remain unchanged and
serialized history excludes the private error message.

Fresh `vitest run` of signal observation, realm scheduler and animation playback
suites passed 106 tests across three files with headless browser flags. Node
24.15.0 / pnpm 11.21.0; typecheck and targeted ESLint passed. All seven native
Studio replay cases passed, including explicit zero-error summary assertions:
`packages/core/test/out/agent-watchdog/targeting-frame-outcomes-2026-09-30-1/`.

This advances SCH-08 and failure-aware trace interpretation. No-collected-errors
does not establish application correctness, pixel correctness or readiness.
Abrupt termination without an idle record remains incomplete evidence. Per-error
phase/root/source attribution and the broader failure matrix remain open. The
full requirements goal remains active.

## Phase-boundary error localization, 2026-09-30

Added cumulative `collectedErrors` to every phase record. The public two-root
failure test first failed on missing fields, then verified counts
0/0/0/0/0/1/1 across Begin through idle, localizing collection to Render while
the other canvas still paints. A supplementary internal completion-queue test
verifies 0/0/0/0/0/0/1, continued unrelated callbacks, original error delivery and
completion cleanup. No error objects or messages enter the history.

Fresh headless `vitest run` passed 106 tests across signal observation, scheduler
and animation playback suites; after adding the completion case, the signal
observation file passed all 19 tests. Typecheck and targeted ESLint passed under
Node 24.15.0 / pnpm 11.21.0. Native targeting replay passed all seven cases with
zero cumulative-count assertions for its expected-success frames:
`packages/core/test/out/agent-watchdog/targeting-phase-errors-2026-09-30-1/`.

This advances SCH-03/08 phase-interval evidence. Deltas require adjacent boundaries
in the same frame; truncated/missing boundaries must remain unknown. Collection
phase does not identify an original throw location, component or root. Broader
failure-phase coverage and source attribution remain open. The complete goal
remains active.

## Explicit partial-frame summaries, 2026-09-30

Scheduler history now derives immutable `frames` summaries from retained records.
They distinguish missing starts/ends, complete versus partial phase sequences,
available final outcomes, and per-phase collected-error deltas. Deltas require
adjacent expected boundaries in one frame with contiguous sequences; unknown
counts are null. Final totals remain known when idle survives truncation, without
claiming complete earlier evidence.

New assertions first failed on missing summaries. Public-scene tests now cover
starting/stopping during Render and a bounded buffer holding a partial prior frame
plus one complete frame. Existing independent Render/Complete failure tests verify
summary attribution. Snapshot records and summaries are immutable.

Fresh headless `vitest run` of signal observation and targeting fixture passed
30 tests across two files under Node 24.15.0 / pnpm 11.21.0. Typecheck and targeted
ESLint passed. All seven native targeting replay cases passed with complete-frame
and zero phase-error assertions:
`packages/core/test/out/agent-watchdog/targeting-frame-completeness-2026-09-30-1/`.

This advances SCH-03 and trustworthy incomplete-evidence handling. Complete phase
coverage is not successful application behavior; frame/root causal attribution
and broader failure cases remain open. The full objective remains active.

## Combined verification and production boundary, 2026-09-30

After the signal ownership and scheduler history slices, fresh
`corepack pnpm@11.21.0 test:agent-verification` passed 52 browser tests across six
files, four identity tests and nine watchdog/crash/checkpoint tests. Node 24.15.0
and pnpm 11.21.0 were used.

`corepack pnpm@11.21.0 playground:build` passed, including source/built/editor
public export-name parity and Studio production bundling. Extended
`tooling/verify-studio-production-output.mjs` to explicitly reject both new
scheduler schema markers; running it against the fresh build passed all 270
inspected browser bundles. This proves exclusion of the checked diagnostic
markers, not absence of all scheduler runtime code or all development overhead.
The production verifier's targeted ESLint and `git diff --check` passed.

`corepack pnpm@11.21.0 docs:check` remains failed. Its ordinary checks and 974 RED
mutation probes passed before historical-banner verification rejected
`docs/superpowers/plans/2026-09-28-component-manipulation-implementation.md`.
The separate in-progress plan was preserved; no banner or status was invented.
This is the previously recorded documentation limitation, freshly reproduced,
not an overall implementation blocker. No aggregate trust success is claimed.

The full requirement inventory remains open/partial as accounted above. These
checks validate the implemented subset and production boundary; they do not
close unimplemented source correlation, renderer, layout, causal-history or
domain-verification requirements.

## Begin/Advance rollback and Commit validation evidence, 2026-09-30

Added controlled tests combining public signal-backed Canvas rectangles with
internal scheduler admission seams. Begin and Advance cases stage a failing
writer plus unrelated successful work. Inspection during staging retains published
values; afterward the failed value/revision/pixels stay unchanged, unrelated
values commit and paint, and the original error is delivered. Trace summaries
identify the correct phase and the driver retains no pending frame.

A Commit equality-callback failure verifies all candidates remain unpublished,
including an earlier candidate whose equality check succeeded. Signal/owner
snapshots remain unchanged, neither rectangle expands, and the error is attributed
to Commit. Repeated inspection invokes no equality callback. These tests required
no runtime change.

Fresh `vitest run packages/core/test/agent-signal-observation.test.tsx
--browser.headless --browser.ui=false` passed all 24 tests under Node 24.15.0 /
pnpm 11.21.0 / Playwright Chromium. Typecheck and targeted ESLint passed. No
aggregate or native replay was rerun for these test/documentation-only additions.

This advances SCH-09 and SIG-09 transactional evidence. It does not expose staged
values, writer provenance or general write outcomes. Commit observer errors after
publication, advanced renderer transaction failures and broader recovery coverage
remain open. The full requirements objective remains active.

## Commit applied-state and post-publication failure, 2026-09-30

Phase history and frame summaries now expose nullable `commitApplied`. The value
is unknown before Commit completion and reflects the runtime's existing batch
application acknowledgement from Plan onward. True includes empty and equality-
suppressed batches, and must not be interpreted as evidence of changed pixels.

The earlier pre-publication equality test first failed on absent false evidence.
A new observer-failure test uses public signal-backed rectangles and an internal
throwing observer: both values/revisions publish, both rectangles expand, the
Commit error is collected and `commitApplied` is true. The test initially expected
a bare error; inspection confirmed existing AggregateError notification delivery,
and the oracle now checks that wrapper and original error identity. No exception
objects are added to diagnostic history.

Fresh headless `vitest run` passed 113 tests across signal observation, scheduler
and animation playback suites. Typecheck and targeted ESLint passed under Node
24.15.0 / pnpm 11.21.0. All seven native Studio replay cases passed with applied-
state assertions in frame summaries:
`packages/core/test/out/agent-watchdog/targeting-commit-outcome-2026-09-30-1/`.

This advances SCH-09 and avoids confusing rollback with post-publication observer
failure. Per-writer outcomes, source attribution, renderer-specific transaction
results and recovery remain open. The full objective remains active.

## Mounted components without signal subscriptions, 2026-09-30

The bounded ownership scan now also returns up to 64 mounted component records,
independent of subscriptions. Each has distinct lifetime/type/surface IDs, bounded
path metadata, component generation and consumer presence. `identifyType` maps an
explicit known function to an opaque type ID without reading user function
properties. This avoids proxy traps during passive inspection. IDs use weak keys.

The public identity test first failed on missing records, then verified empty and
non-subscribing components, retained IDs across keyed reorder, and new lifetime ID
after removal/remount. An independent `useConst` counter corroborates mounts.
Additional checks verify the 64-record cap and a mounted proxy whose name/property
and descriptor traps throw if inspection touches them.

Fresh browser verification passed 35 tests across signal observation and targeting
fixture; after adding proxy/budget assertions, all 27 signal-observation tests
passed. Typecheck and targeted ESLint passed under Node 24.15.0 / pnpm 11.21.0.
All seven native replay cases passed with component identity uniqueness and
non-subscriber evidence:
`packages/core/test/out/agent-watchdog/targeting-components-2026-09-30-1/`.
Inspect target exposes `signalInspection.ownership.components` in the lab.

This advances ID-01/02/05/07/10 partial evidence. It does not classify paint output,
expose source locations, provide application selectors or build an ancestry tree.
Component IDs identify mount lifetimes, not application entities or event targets.
The full requirements objective remains active.

## Component ancestry versus Layer host, 2026-09-30

Mounted component records now expose separate `componentParent` and `surfaceHost`
relations. A bounded second pass resolves only endpoints included in the current
record list; absent and outside-snapshot endpoints are distinguished. Historical
IDs cannot create apparently current dangling links. All relation values are
frozen scalar copies, with no retained component references.

The new public Parent/Group/Layer/Leaf test first failed on absent fields. It now
verifies component parent links, the child surface's Layer host, distinct surface
IDs, immutable relations and in-snapshot observed endpoints. Fresh headless
`vitest run` passed 37 tests across signal observation and targeting fixture.
Typecheck and targeted ESLint passed under Node 24.15.0 / pnpm 11.21.0. All seven
native Studio replay cases passed with relation and Layer-host assertions:
`packages/core/test/out/agent-watchdog/targeting-ancestry-2026-09-30-1/`.

This advances ID-06 partial evidence. Recorded component ancestry and surface
ownership are not asserted to equal paint, event or focus ancestry. Broader
reparenting, omitted-endpoint transitions and source correlation remain open.
The complete requirements goal remains active.

## Explicit source-location acquisition, 2026-09-30

Added `captureSource(element)` to the source-only signal/component inspector.
Acquisition is explicit because JSX development source objects may contain
application getters or proxies. Component snapshots remain passive: they expose
only previously captured frozen scalar locations, or distinguish missing from
uncaptured metadata. Captures are weakly keyed, limited to 64 distinct source
objects per inspector lifetime, and validate bounded file names and positive safe
integer coordinates. Invalid and throwing metadata have explicit statuses;
error payloads are not retained. Repeated captures preserve the first observation.
Disposal releases the registry, including when triggered by a source getter.

The focused test first failed on the missing source field. After implementation,
Node 24.15.0 / pnpm 11.21.0 Chromium execution of
`vitest run packages/core/test/agent-signal-observation.test.tsx packages/core/test/agent-targeting-verification.test.ts --browser.headless --browser.ui=false`
passed **39 tests in two files**. Tests use the public `jsxDEV` and `createElement`
constructors, correlate a mounted component to captured metadata, arm a throwing
proxy after capture, and verify repeated snapshots do not access it. They also
cover missing metadata, invalid coordinates/oversized names, failed acquisition,
the 64-object budget and disposal during acquisition. Targeted ESLint passed.

This advances ID-08 only partially. Locations are supplied JSX callsites with
unverified source-map accuracy, not verified component definition locations.
Automatic compiler integration, mounted-handle acquisition, source-map resolution
and broader clone/placement coverage remain open. The complete 373-item objective
remains active; no aggregate trust result is claimed.

## Mounted source handles and Studio acquisition, 2026-09-30

Source capture now accepts `{session, componentId, renderGeneration}` from a
component observation. The inspector keeps at most 64 weak handles from its latest
snapshot, refuses cross-session, unknown, changed-generation and replaced-mount
handles, and revalidates after potentially active source reads. Disposal clears
handles. The compiler metadata and capture registry remain unchanged; snapshots
do not automatically execute source accessors.

Added **Capture source locations** to the shared Studio targeting fixture and
regenerated the scenario catalog. The fixture publishes captured locations through
its existing evidence JSON. Its browser test verifies an available compiler
location, unchanged render count and unchanged independently sampled blue pixel.
The native replay verifies the reported file ends in the actual fixture source
file name and has a positive line number before exercising its seven normal cases.

The tests first failed on the missing component-capture method and missing fixture
action. Node 24.15.0 / pnpm 11.21.0 subsequently passed the focused signal-observation
and targeting-verification Chromium suites: **40 tests in two files**. Typecheck
and targeted ESLint passed. The native watchdog replay passed all seven cases;
evidence is in
`packages/core/test/out/agent-watchdog/targeting-component-source-2026-09-30-1/`.
The feedback URL is
`http://127.0.0.1:5195/#/testing/agent-targeting-verification`; inspect the target,
then capture source locations and inspect the component evidence.

ID-08 and ID-09 have stronger partial evidence, not full completion. Source-map
resolution, definition-site mapping, automatic acquisition and broader placement
coverage remain open. The complete inventory objective remains active.

## Bounded sampled component removal evidence, 2026-09-30

Component observations now include a 64-record removal history. The inspector
checks its previous bounded weak handle set for Pibbl's closed teardown flag while
the original root is live. A confirmed removal retains only the numeric component
ID and `component-disposed` reason; oldest records are evicted with a dropped
counter. Snapshot omissions, scan truncation and unavailable weak references do
not generate removal claims. Disposal clears history, and old frozen snapshots
remain independent. No runtime lifecycle hooks or application-data retention were
added.

The focused test first failed on the absent removal history. It now proves that a
live Layer child pushed beyond the 64-record output limit is not reported removed,
that actual closed components produce records, that subsequent churn stays bounded
and reports eviction, and that historical snapshots survive later changes.
Node 24.15.0 / pnpm 11.21.0 Chromium execution of the signal-observation and
targeting-verification suites passed **41 tests in two files**; typecheck and
targeted ESLint passed.

The first native replay stopped on preexisting focus readiness: its predicate
accepted native/logical focus before the keyboard-visible flag was true. The
predicate now includes that independently required state. The second native replay
passed all seven cases and confirmed component removals after the keyboard scenario:
`packages/core/test/out/agent-watchdog/targeting-component-removals-2026-09-30-2/`.
The failed first report is preserved beside it. The Studio URL remains
`http://127.0.0.1:5195/#/testing/agent-targeting-verification`; switch to keyboard
focus and inspect the component removal evidence.

This advances ID-10 and QRY-10 partial evidence. It is explicitly a sampled history,
not a complete lifecycle stream: changes between snapshots, removed components
outside the prior handle set and root replacement are not inferred. A zero dropped
count does not establish exhaustive coverage. The complete inventory goal remains
active.

## Deliberate labels and duplicate-aware queries, 2026-09-30

Added `labelComponent(handle, label)` and `findComponents(label)` to the source
inspector. Explicit labels attach weakly to a component lifetime, accept exact
bounded strings, and never become runtime keys or mutate application props.
Session/generation validation uses the same live-handle checks as source capture.
Queries return all observed matches, with per-record duplicate counts and explicit
unique/duplicate/unknown status. A single match in a truncated snapshot is unknown,
not unique; an empty truncated result does not establish absence. Storage is
limited to 64 labeled lifetimes per inspector and 128 code units per label.

The focused test first failed on the missing label API; the fixture test then
failed on the missing deliberate root label. The targeting fixture now assigns
`targeting-scene` through its own setup, using the known component type rather than
private paths. Tests verify duplicate reporting, keyed reorder with an independent
mount counter, stale generations, clearing, immutable previous query output,
invalid labels, registration exhaustion and unknown uniqueness under truncation.

Node 24.15.0 / pnpm 11.21.0 passed **43 Chromium tests in two files**
(signal-observation and targeting-verification), typecheck and targeted ESLint.
All seven native targeting replay cases passed, including the fixture label
assertion in the initial three modes. Evidence:
`packages/core/test/out/agent-watchdog/targeting-component-labels-2026-09-30-1/`.
The fixture remains available at
`http://127.0.0.1:5195/#/testing/agent-targeting-verification`; choose Inspect target
and inspect the labeled component record.

This advances ID-03/04 and QRY partial evidence. Labels are deliberately scoped to
one inspector and component lifetime, not durable application entity IDs.
Declarative authoring, richer entity mappings, cross-session persistence and a
complete semantic snapshot diff remain open. The full inventory goal remains active.

## Layout and measurement requirement audit, 2026-09-30

Assessed LAY-01 through LAY-12 individually against current runtime code, contract
and executable tests. The ledger now has **49 partial assessments and 324
unassessed requirements**. These remain audit counts, not a completion percentage.
Each layout entry identifies exact supporting files, what they establish, and the
remaining agent-facing or coverage gap.

Existing evidence is substantial: all five layout algorithms have expected-box
checks; placement participates in native input and pixel tests; intrinsic
measurement avoids rendering and tested image/offscreen allocations; signals are
attributed to receiver-owned inputs; diagnostics carry receiver/algorithm/input
context. The missing general capability is recorded, queryable layout provenance,
not replacement implementations of those algorithms. Multi-panel responsiveness,
complete failure-scope isolation and standalone measurement signal-write policy
need stronger evidence before their respective guarantees can be claimed.

Fresh verification on Node 24.15.0 / pnpm 11.21.0 / Playwright Chromium:
`vitest run packages/core/src/lib/layout packages/core/test/layout-foundation.test.ts packages/core/test/responsive-style-layouts.test.tsx --browser.headless --browser.ui=false`
passed **160 tests in 11 files**. The exact invocation and scope are saved in the
ledger's `layout-audit-2026-09-30` verification record. No new production behavior
was introduced during this audit. Full inventory completion remains unproven.

## Measurement audit finding repaired, 2026-09-30

The LAY-08 audit identified a real purity gap: standalone `measureElement` allowed
signal writes during custom normalization, measurement callbacks and the supplied
text-measurement service. Three public-API regression cases failed before the fix.
The whole measurement operation now uses Pibbl's existing signal-write prohibition,
including recursive measurement. Rejected updates do not invoke the updater or
change the signal; the previous write policy restores after failure. No new public
API or inspection-triggered measurement was added.

The API guide now states this enforcement explicitly; the normative layout
contract already requires pure measurement and was left unchanged. On Node
24.15.0 / pnpm 11.21.0 / Playwright Chromium, the new public tests plus the layout,
layout foundation, responsive layout and signal graph suites passed **219 tests in
13 files**. Typecheck and targeted ESLint passed. The ledger records the exact
command and the narrower remaining LAY-08 scope; full inventory completion is not
claimed.

`node tooling/verify-docs.mjs` passed its documentation consistency and contract
preservation checks, then failed on the preexisting missing Historical banner in
`docs/superpowers/plans/2026-09-28-component-manipulation-implementation.md`.
That unrelated plan was not relabeled. No full documentation or trust pass is
claimed.

## Component comparison slice integrated, 2026-09-30

Finished the pending local semantic component comparison slice. Tests now cover
complete-to-truncated and truncated-to-complete observations: a live component
outside the output budget is unobserved/newly-observed, never falsely removed or
newly mounted. Foreign proxies and cloned snapshots are rejected without reading
them; reversed observations, unavailable roots and disposed inspectors have explicit
outcomes. Render generation changes alone do not produce semantic differences.

The shared targeting fixture publishes comparison evidence through its existing
Inspect target action and clears its baseline after inspector replacement. Switching
to Keyboard focus supplies a native end-to-end addition/removal case. The comparator
source is included in the served-fixture fingerprint. Tests first failed on the
missing fixture evidence field, then passed after integration.

Node 24.15.0 / pnpm 11.21.0 / Playwright Chromium passed **46 tests in two files**
(signal-observation and targeting-verification), plus typecheck and targeted lint.
The seven-case native replay passed with structural comparison assertions:
`packages/core/test/out/agent-watchdog/targeting-component-diff-2026-09-30-1/`.
Manual URL: `http://127.0.0.1:5195/#/testing/agent-targeting-verification`.
Inspect, choose Keyboard focus, then inspect again to examine `componentChanges`.

QRY-10 remains partial: these are component facts, not general application-state,
paint or renderer diffs, and replacement relationships are not guessed from labels.
The full inventory objective remains active.

## Image/asset audit and non-vacuous callback replay, 2026-09-30

Assessed AST-01 through AST-08 and the relevant TST-09 test-quality obligation.
Existing Image tests already prove current-source drawing, independent natural
size fallback, pending geometry, exact listener cleanup, and inert saved callbacks.
The shared cleanup laboratory supplies real deterministic image pixels and source
replacement/error behavior. Image screenshots captured by `takeScreenshot` are
artifacts, not automatically pixel assertions; the audit keeps that distinction.

Found and fixed a vacuous higher-level injector: ControlledImages previously looked
up the current `onload`/`onerror`, so forced completion after listener detachment
called nothing. It now captures callbacks at source assignment and replays those
saved functions. A direct injector regression failed with zero invocations before
the fix, then passed. Existing late-completion scenario checks now genuinely execute
the stale callbacks and still prove no state or ownership change. Runtime Image
behavior was not changed.

Node 24.15.0 / pnpm 11.21.0 / Playwright Chromium passed **41 tests in three files**
(img-async, img, runtime-cleanup-stress), plus typecheck and targeted ESLint. Exact
command and scope are stored as `image-audit-2026-09-30` in the ledger.
There are now **58 partially assessed and 315 unassessed requirements**; these are
audit counts, not implementation completion. General asset generation inspection,
error categorization, decode/taint cases and redacted asset provenance remain open.
The complete inventory goal remains active.

## Text audit and Unicode ellipsis correction, 2026-09-30

Audited TXT-01 through TXT-08. Existing tests assert line strings, baselines,
metric bounds, exact Canvas fitting calls and native clipped/squished interaction.
Found and repaired a real Unicode bug: ellipsis binary search used arbitrary
UTF-16 offsets, splitting surrogate pairs, combining sequences, flags and joined
emoji. Four regression cases failed; a whole-fitting-emoji control already passed.
Search now uses complete grapheme boundaries from a lazily initialized browser
`Intl.Segmenter`. Segmentation adds a linear boundary list for text that actually
needs truncation; fitting text retains the early return. The shared resolver keeps
measurement and paint consistent. The API guide states the behavior and browser
segmentation dependency.

Node 24.15.0 / pnpm 11.21.0 / Playwright Chromium passed **78 tests in five files**
(text, text-layout, measure, layout-jsx and measurement-purity), plus typecheck and
lint for the changed runtime/tests. The ledger stores the exact command as
`text-audit-2026-09-30`. No new visual baseline was generated or accepted.

The ledger now distinguishes an audited `gap` from unassessed and partially
supported requirements; a negative-first validator test covers that status.
There are **63 partial assessments, 3 audited gaps and 307 unassessed IDs**.
Font readiness/fallback evidence, late-font redraw scenarios and redacted text
inspection are explicit gaps at the audited boundary. Grapheme-safe truncation
is not a claim of full Unicode shaping, bidi layout or automatic font loading.
The complete inventory goal remains active.

## Animation requirement audit — 2026-09-30

Assessed ANI-01 through ANI-10 against current public controls, implementation,
and executable tests. Existing evidence covers intermediate values, atomic
publication, deferred commands, ordered milestones, control continuity, writer
replacement and exact cleanup. Spring fixtures include independent literal
values across three damping regimes; the spring-retarget integration test also
uses a production sampler, so it is not a fully independent continuity oracle.

The fresh animation run passed **261 tests in 14 files** with Node 24.15.0,
pnpm 11.21.0 and Playwright Chromium. The exact command and scope are stored in
`animation-audit-2026-09-30` in the ledger. No runtime change or visual baseline
update was needed for this audit.

The animation lab installs a manual scheduler even when it sends native input.
It therefore does not prove real browser input-to-frame behavior. General
playback/track/lease inspection and an animation causal transcript remain gaps
within otherwise partially supported requirements. The lab has no explicit
application policy scenario for reduced motion or visibility/resume; ANI-10 is
recorded as a scoped gap, not a request for Pibbl to infer product policy.

Accounting now records **72 partial assessments, 4 audited gaps and 297
unassessed IDs**. These are audit counts, not implementation completion. The
full verification goal remains active.

## Layer and cache requirement audit — 2026-09-30

Assessed LYR-01 through LYR-10. Existing tests supply evidence for child-first
composition, clean sibling caches, retained-tree invalidation, logical density,
transformed targeting, focus repaint isolation, filter pool ownership and
visualization scale boundaries. The native focus sequence checks both pixels
and render counts, but it is not the requested crosshair/selection-overlay
visualization workload.

A fresh run passed **250 tests in 13 files** under Node 24.15.0, pnpm 11.21.0
and Playwright Chromium. Exact command and limits are recorded under
`layer-audit-2026-09-30`. No runtime or baseline changes were made.

Important remaining work: bounded surface-tree inspection, invalidation causes,
resource estimates with explicit assumptions, and a public visualization overlay
isolation scenario. The external-render test retains a bitmap after render
failure; it does not prove transfer/composite failure consistency. Those fault
injection cases remain explicitly open. Separate tests of filters and Layer
geometry also do not certify every combined nested composition.

Accounting now has **82 partial assessments, 4 audited gaps and 287 unassessed
IDs**. No requirement was certified complete by this audit.

## Visualization data requirement audit — 2026-09-30

Assessed DAT-01 through DAT-13 using the visualization testing skill, current
public exports, numeric scale/accessor implementation, row identity tests and
the native hover fixture. The analytical job is numerical correctness and
provenance for existing Canvas line/point/custom-series charts; this is a testing
and evidence audit, not a chart redesign or renderer selection exercise.

Fresh verification passed **97 tests in 18 files**, Node 24.15.0 / pnpm 11.21.0 /
Playwright Chromium. Exact command and scope are saved as
`viz-data-audit-2026-09-30`. Interpolation uses independent literal expected
values; recorded versus estimated values retain different provenance. Duplicate
policies, missing-data gaps, keyed reorder/removal and data generation changes
have scoped evidence. No production code or baseline changed.

Application pipeline stage counts, aggregate oracles, calendar/category policy,
decimation invariants and general redacted semantic queries lack the required
evidence at this boundary. These are conditional/application responsibilities,
not authorization to add joins, calendar scales or decimation to `@pibbl/viz`.
The ledger explicitly preserves those distinctions. Current numeric guards also
need a fuller public input-type matrix before claiming complete coverage.

Accounting is **90 partial assessments, 9 audited gaps and 274 unassessed IDs**.
These remain audit counts; no complete-inventory or full-gate claim is made.

## Scale, axis and mark audit — 2026-09-30

Assessed VIZ-01 through VIZ-15 against current linear scale, axis, series and
annotation behavior. Reused the preceding 97-test visualization run for unchanged
code; no duplicate broad run was necessary. Existing evidence includes exact
line run geometry, independent local panels, axis tick formatting/positions,
point compositing, keyed custom marks and constant batched target counts.

Added four public-API numerical cases to `packages/viz/test/scale.test.tsx`.
They assert independent expected positions plus map/invert round trips across
ascending/descending domains, reversed ranges, fractional values and extrapolation.
Explicit absolute tolerances are the corresponding span times 1e-12. The focused
scale suite passed **11 tests**, and focused ESLint plus `tsc --noEmit` passed
under Node 24.15.0 / pnpm 11.21.0. No production behavior changed. This is a
bounded numerical matrix, not a claim about all floating-point endpoints.

General scale/tick/mark inspection remains incomplete. Analytical color/size/
legend correctness needs explicit application expectations; style validity and
pixel agreement do not prove those semantics. Scale providers also do not create
implicit clipping or gutters. These limits are recorded per requirement rather
than requesting unsupported chart families.

Accounting is **104 partial assessments, 10 audited gaps and 259 unassessed
IDs**. The overall verification objective remains active.

## Visualization interaction audit — 2026-09-30

Assessed VIN-01 through VIN-12. The archive example already provides brush
resize and pan fixtures, so those are recorded as scoped evidence rather than
misclassified as missing features. Its tests dispatch synthetic pointer events;
they do not prove native capture, touch gestures or browser focus behavior.
Native hover evidence separately covers data revisions, resized coordinates,
unsorted lookup and duplicate policies.

Nearest helpers scan on demand and do not own a retained spatial index. Therefore
index invalidation is conditional on an application introducing such a cache.
Constructor laziness is tested, but does not prove unrequested expensive queries
remain inactive throughout pointer motion. Exact work-budget evidence remains
open. Local mapped Euclidean distance also must not be described as screen-space
distance after arbitrary nonuniform transforms.

Reused the recent **97-test / 18-file** visualization run because the audited
interaction files have not changed. No runtime, test or baseline mutation was
needed. Agent inspection, persistent selection semantics, loop-free linked-view
updates, native brush/touch and DOM tooltip behavior remain explicitly scoped
follow-up work. Canvas HoverCard evidence is not DOM-overlay evidence.

Accounting now records **116 partial assessments, 10 audited gaps and 247
unassessed IDs**. The complete objective remains active.

## Custom drawing and external renderer audit — 2026-09-30

Assessed REN-01 through REN-12. Focused suites passed **70 tests in four files**
under Node 24.15.0 / pnpm 11.21.0 / Playwright Chromium. Exact command and scope
are recorded as `renderer-audit-2026-09-30`. No production changes or baseline
updates were made.

The material finding is a committed-state limitation: `default-picker.ts`
retains mutable Three scene/camera references and reads them when picking occurs.
Pibbl committing the picker alongside the bitmap does not freeze those references.
Thus between-frame mutations or failed candidate updates require a controlled
reproduction and resolution before claiming bitmap/pick generation consistency.
REN-07 is recorded as a gap from source inspection, not as a newly executed
failure test. Initial projected-focus tests do not resolve this concern.

Other gaps include bounded custom evidence providers and renderer appearance
inspection. Existing lifecycle, pass-through/block/target arbitration, visibility,
resize and primitive transform tests remain useful scoped evidence. Context-loss
and transfer/composite fault recovery are not certified by those passing tests.

Accounting now has **124 partial assessments, 14 audited gaps and 235 unassessed
IDs**. Overall completion and the aggregate trust gate remain unproven.

## Physics and particle requirement audit — 2026-09-30

Assessed SIM-01 through SIM-09. Physics already supplies public read-only
inspection with IDs/generations, authoritative and presentation poses, tick,
revision and failure fields. It is stronger than merely inspecting internal
world storage, but its whole-world arrays still need explicit bounded access for
agent workflows and correlation with committed paint/pick generations.

Fresh verification passed **116 tests in 16 files**, Node 24.15.0 / pnpm 11.21.0 /
Playwright Chromium. Exact command and scope are recorded as
`simulation-audit-2026-09-30`. No runtime or baseline changes were made.

The ledger preserves two evidence distinctions: advancing a requested host frame
is not necessarily advancing one physics tick, and directly exercising ownership
counter helpers is not proof of actual backend teardown. Real particle-system
failure/ownership tests supplement those helpers. Analytical particle fixtures
assert numeric motion independently, while fuller public physics analytical and
aggregate scenarios remain open. These optional facets do not become
prerequisites for every ordinary 2D application.

Accounting is **133 partial assessments, 14 audited gaps and 226 unassessed IDs**.
No requirement or overall goal was certified complete.

## Application semantics and DOM audit — 2026-09-30

Assessed APP-01 through APP-12. The public scenario protocol and targeting fixture
provide application-owned state/operations and correlations, but no general
semantic DOM alternative. Native focus tests verify Tab entry/exit, activation,
modality and keyed removal; browser hit probes verify DOM interception. Neither
is evidence of accessible roles, names, announcements or semantic parity.

Fresh focused verification passed **18 tests in three files** under Node 24.15.0 /
pnpm 11.21.0 / Playwright Chromium, recorded as `application-audit-2026-09-30`.
No runtime, test or baseline changes were necessary.

The editing/composition/clipboard lesson deliberately dispatches synthetic events
to Canvas. It is transport evidence, not a real editor or IME test. Application
windowing, persistence, asynchronous response policy and browser accessibility
queries need dedicated evidence where those features are supplied. Guidance is
recorded as guidance, never as a passed human accessibility evaluation.

Accounting is **140 partial assessments, 19 audited gaps and 214 unassessed IDs**.
Conditional application responsibilities remain explicit; they do not authorize
inventing new product features or automatic semantic DOM in Pibbl.

## Diagnostic and controlled-failure audit — 2026-09-30

Assessed ERR-01 through ERR-13. Fresh checks passed **119 tests in four files**
under Node 24.15.0 / pnpm 11.21.0 / Playwright Chromium, recorded as
`diagnostics-audit-2026-09-30`. Tests preserve original scheduler Error objects,
continue independent work, assert layout context and restore filter leases/render
state after controlled failures. No production code or baseline changed.

The replay reporter has narrower evidence: page errors are bounded message
strings without per-step causes, and its final error assertion precedes final
asynchronous reads. That late-error window remains open. The original filter
error survives a scrub failure, but this alone does not prove both causes reach
an agent report. Phase history is chronology, not an asynchronous causal graph.
These limitations are recorded separately from existing successful runtime tests.

Accounting is **152 partial assessments, 20 audited gaps and 201 unassessed IDs**.
No overall completion or aggregate-gate claim is made.

## Replay late-error fix — 2026-09-30

Closed the late-error outcome window identified in ERR-04. Both native replay
runners now apply a shared final gate after browser shutdown and before writing
the final report. Recorded page errors, overflow or unexpected transport failure
invalidate provisional success. Original operation/cleanup failure records remain
separate. Visualization replay now counts dropped errors instead of silently
omitting overflow. The outcome tests join the existing watchdog verification gate.

The new test file initially failed because the required finalizer did not exist.
After implementation, **three outcome tests and three real Chromium failure tests
passed** under Node 24.15.0. The browser regression throws a real asynchronous page
error after provisional success, waits for its delivery, closes the browser and
checks the final failure. Focused ESLint passed.

Both complete native replays passed with zero recorded/dropped errors. Reports:

- `packages/core/test/out/agent-watchdog/targeting-final-outcome-2026-09-30-1/report.json`
- `packages/core/test/out/agent-watchdog/viz-final-outcome-2026-09-30-1/report.json`

The observation boundary is events received through shutdown. This is not a claim
about indefinitely delayed future work. Per-step console/error correlation and
asynchronous cause records remain open, so ERR-04 stays partial and overall audit
counts are unchanged. No application runtime or visual baseline changed.

## Ownership and disposal audit — 2026-09-30

Assessed OWN-01 through OWN-10. Fresh checks passed **26 tests in four files**
under Node 24.15.0 / pnpm 11.21.0 / Playwright Chromium. The run includes real
mounted ownership, 1000 reflows and 1000 mount/dispose cycles, saved image callbacks
after removal, and idempotent/reentrant teardown despite throwing callbacks.
Exact command and scope are saved as `ownership-audit-2026-09-30`.

Remaining evidence work centers on bounded per-owner attribution, unrelated-root
isolation, shared assets/backend ownership, and integrated inspector enable/
disable/dispose cycles. Pool capacity, active leases and live owners are separate
facts; a legitimate retained cache need not return to zero every frame. Shared
signal-reader coverage does not establish ownership rules for arbitrary assets.
No runtime/test/baseline changes were needed in this audit.

Accounting is **162 partial assessments, 20 audited gaps and 191 unassessed IDs**.
These counts do not certify implementation completion or absence of all leaks.

## Performance audit and windowing correction — 2026-09-30

Assessed PER-01 through PER-13. Fresh verification passed **35 tests with four
skipped across four files** under Node 24.15.0 / pnpm 11.21.0 / Playwright
Chromium. The skipped tests require opt-in timing/profile flags; no wall-clock
threshold or fresh speed comparison is claimed. Exact command and scope are
saved as `performance-audit-2026-09-30`.

Existing structural evidence covers signal/root work, targeting operations,
filter copies/composites and animation samples. CPU callback timings do not
measure GPU execution or browser presentation. Matched competitor benchmarks
and end-to-end application workload comparisons remain absent at this boundary.

Corrected APP-06 after discovering the existing windowing fixture inside
`event-performance.test.ts`: it uses 100000 records with 20 visible plus four
overscan rows and checks counts, clipping pixels and row targeting. APP-06 is now
partial rather than gap. Scrolling, navigation and recycling remain unverified;
this correction does not imply a public virtualization API.

Accounting is **175 partial assessments, 20 audited gaps and 178 unassessed IDs**.
No production code or baseline changed, and overall completion remains unproven.

## Package and documentation audit — 2026-09-30

Assessed BLD-01 through BLD-10. Fresh package builds and both external packed
consumer verifiers passed under Node 24.15.0 / pnpm 11.21.0. They verify tarball
boundaries, runtime exports, Bundler/NodeNext consumers, private imports and shared
core/Three identity. Commands and outcomes are saved as `package-audit-2026-09-30`.

The direct documentation verifier still exits with failure at
`docs/superpowers/plans/2026-09-28-component-manipulation-implementation.md` because
its required historical-status banner is missing. Earlier snippet/export/contract
checks in that invocation passed; the whole command did not. The plan was left
unchanged because its status must follow authoritative work evidence, not a
regex-driven invented completion claim. Mutation probes and the aggregate trust
gate remain unverified. This turn did not rerun built-browser or Studio production
checks, and the ledger explicitly records that limitation.

Accounting is **185 partial assessments, 20 audited gaps and 168 unassessed IDs**.
Package success does not certify the source-only inspector as a published API.

## Harness and reproducibility audit — 2026-09-30

Assessed all HAR-01 through HAR-14, including previously partial entries.
Fresh **13 watchdog/outcome/checkpoint/browser tests and four identity tests
passed** under Node 24.15.0 / pnpm 11.21.0 / Playwright Chromium. Evidence includes
real renderer crash, hung page plus hung replay, parent-owned process-group
termination, preserved partial checkpoints and mismatched served-build rejection.
Exact command/scope are recorded as `harness-audit-2026-09-30`.

Current recipes use fresh owned contexts, explicit input/readiness predicates,
source fingerprints and bounded outcomes. Remaining gaps include general actor
coordination, broader platform/input coverage, application storage/asset/clock
contracts and portable recipes. A clean mount, animation seek and replay are not
interchangeable, and no arbitrary heap restore is promised. Process-group testing
is macOS evidence; the relevant Windows test is explicitly unsupported/skipped
by its source condition, not silently certified.

Accounting is **195 partial assessments, 21 audited gaps and 157 unassessed IDs**.
No runtime or baseline changes were made in this audit.

## Assertion quality audit and action-completion guard — 2026-09-30

Assessed TST-01 through TST-13. Found and fixed a vacuous-success boundary in the
replay finalizer: a top-level pass label alone could pass without confirming the
required steps. Both replay callers now require their exact expected action count
(seven targeting, nine visualization) and passing status for every action.

The new negative test failed before implementation (`true` instead of `false`).
All **four outcome tests** and focused ESLint passed afterward under Node 24.15.0.
The new gate accepted both retained native reports from the preceding replay run
and rejected copies missing an action. No redundant browser replay was run;
these checks validate report finalization, not newly executed browser behavior.

Remaining coverage work includes semantic action-ID manifests, assertion-level
completion, zero-discovery/unawaited-async detection, seeded adversarial shrinking
and structured retry/evidence-kind records. Count/status guards alone cannot prove
all assertions ran or distinguish substituted duplicate actions. Existing public,
internal, native and raster evidence remains explicitly scoped per requirement.

Accounting is **206 partial assessments, 22 audited gaps and 145 unassessed IDs**.
No application runtime or baseline changed.

## Required action identity verification — 2026-09-30

Replaced count-only certification in both replay callers with ordered semantic
identity manifests. Reports retain the expected manifest and each actual action
ID; duplicated, substituted, missing-ID or reordered actions cannot satisfy the
final success gate. The manifest is declared independently of the collected
results. Count-only support remains for older internal finalizer callers, but
neither native replay uses it.

A new contract test failed before implementation. All six outcome tests and
focused ESLint passed afterward under Node 24.15.0. Fresh native Chromium
replays passed: seven targeting actions and nine visualization actions, with
zero recorded or dropped errors and watchdog exit 0. Reports are retained in
`packages/core/test/out/agent-watchdog/targeting-action-ids-2026-09-30-1/`
and `packages/core/test/out/agent-watchdog/viz-action-ids-2026-09-30-1/`.

This closes the duplicated/substituted-action hole for these workflows, not the
entire vacuous-success requirement. Assertions within an action still need their
own completion evidence. TST-13 remains partial; accounting stays at 206 partial,
22 gaps and 145 unassessed. No application runtime or visual baseline changed.

## Machine-readable visual evidence — 2026-09-30

The shared visual comparator now saves a `pibbl-visual-comparison/1` JSON sidecar
beside each diff. It includes match/mismatch/unavailable status, operation stage,
expected/actual dimensions, retained image references, exact changed-pixel count,
maximum channel delta, unmasked changed bounds, and compared/ignored pixel counts.
Coordinates are image pixels, not logical Canvas coordinates. Overlapping masks
count once. A fully masked image rejects instead of producing vacuous success.
Missing baselines and invalid PNG decoding produce unavailable evidence; a size
mismatch is explicitly a mismatch, without inventing pixel comparisons.

The initial contract suite failed before implementation. Seven focused Chromium
tests passed afterward. The visual safeguard proved clean match, deliberate
regression rejection with machine-readable bounds and resolvable image artifacts,
then clean recovery, preserving every preexisting baseline byte. Typecheck and
focused ESLint passed under Node 24.15.0 / pnpm 11.21.0.

PIX-03 and PIX-07 are partial: per-run retention, run/frame provenance and broader
capture/backend failure coverage remain. The current reusable test paths can be
overwritten by later runs. Counts are now 208 partial, 22 gaps and 143 unassessed;
no requirement is certified complete. No visual baseline was edited by this work.

## Visual evidence retained across reruns — 2026-09-30

Each shared visual comparison now retains its report and available image bytes in
`<diffPath>.runs/<comparisonId>/`. Fixed paths remain latest-result aliases, while
failure diagnostics point to the unique artifacts. A successful recovery no
longer destroys the previous mismatch evidence. Reports identify their own saved
path and comparison ID; this is not suite/run/frame provenance.

The new browser regression first failed on the missing retained report. After
implementation, all eight focused tests passed. The regression creates a known
one-pixel mismatch, recovers to a match, then checks that the earlier report and
all three images remain byte-identical. The real visual safeguard also passed,
including artifact resolution and unchanged baseline bytes. Typecheck and focused
ESLint passed under Node 24.15.0 / pnpm 11.21.0.

Retention and explicit cleanup semantics are documented in the trust-gate guide.
Other screenshot workflows and process-interruption evidence remain outside this
proof. PIX-03 stays partial; counts remain 208 partial, 22 gaps, 143 unassessed.

## Documented and validated visual masks — 2026-09-30

The shared comparator now requires each mask to have a nonempty reason and a
positive integer rectangle inside the image. Missing/blank reasons, nonfinite or
fractional coordinates, negative/empty sizes and out-of-image rectangles reject.
Reasons survive in the retained machine report. Existing smoke and drawing-gallery
mask bounds were preserved, with their text/SVG rationale made machine-readable.

The new invalid-mask test failed before implementation. After implementation,
16 tests in three Chromium files passed, including every existing masked caller.
Typecheck and focused ESLint passed. The deliberate visual safeguard still caught
the regression and recovered, preserving all baseline bytes.

PIX-04 is partial: a documented reason does not prove a mask is minimal or that
all excluded behavior has an independent oracle. Per-mask review remains open.
Counts are 209 partial, 22 gaps and 142 unassessed; no completion certification.

## Narrowed smoke masks expose a previously hidden regression — 2026-09-30

Inspected the expected and actual smoke screenshots against the scene source.
The original control-text mask covered the blank gap between its two text lines.
A new deliberate 12×6 red defect at (60,100) incorrectly passed under that mask;
the strengthened safeguard failed before the mask change.

Split the six broad smoke exclusions into twelve text-line regions. Ignored area
fell from 74440 to 22708 pixels: 51732 additional pixels now participate in exact
comparison. The new defect is rejected with exactly 72 changed pixels and bounds
(60,100,12,6). The original state-change drill still rejects and clean recovery
passes. The safeguard verified all baseline bytes unchanged. Typecheck and
focused ESLint passed under Node 24.15.0 / pnpm 11.21.0 / Chromium.

PIX-04 stays partial because drawing-gallery masks and cross-platform glyph
coverage still need separate evidence. This is a demonstrated reduction in a
verification blind spot, not a claim that every mask is minimal. Counts unchanged.

## Drawing-gallery masks narrowed and challenged — 2026-09-30

Inspected gallery source and rendered images. Both a wrapped-card background defect
and a scaled-image background defect passed incorrectly under the old masks.
Narrowed text exclusions from 49856 to 27812 pixels and image exclusions from
32616 to 7144 pixels, restoring exact comparison for 47516 additional pixels.
Added opaque SVG center-color evidence and an independent source-over calculation
for the translucent center, allowing one channel unit for alpha quantization.
An initially exact rounded blend expectation failed; the bounded allowance is
explicit and is not a copied observed color.

The aggregate visual safeguard now checks clean smoke/gallery runs, original smoke
mutation, inter-line smoke mutation and both gallery mutations, then clean recovery.
All three mask probes must report exactly 72 changed pixels and their known bounds.
The final safeguard passed and preserved every baseline byte. Typecheck and focused
ESLint passed under Node 24.15.0 / pnpm 11.21.0 / Chromium.

PIX-04 remains partial: center pixels do not establish complete curve geometry,
and text exclusions still need semantic content evidence. Counts unchanged.

## Independent semantic and raster evidence for masked text — 2026-09-30

Added a mounted public-scenario check that records Canvas text calls and compares
content, world origins, wrapped lines, line spacing, ellipsis fit and squish width
against independent expectations. It covers initial copy, update and reset. Six
separate bitmap regions must also contain visible glyph ink; command intent alone
cannot satisfy the test. Observers are per-Canvas and restored after the test.

All seven gallery tests passed. A deliberate omission skips native glyph painting
while still recording the calls; the expanded safeguard rejects it specifically
on the ink assertion. Earlier pixel mutations still reject, recovery passes, and
baseline bytes remain unchanged. Typecheck and focused lint passed on Node 24.15.0
/ pnpm 11.21.0 / Chromium.

This is test evidence, not a new published inspector or exact glyph-boundary proof.
PIX-05 is partial. Counts are 210 partial, 22 gaps and 141 unassessed; the broader
verification objective remains open.

## Visual capture context and readiness limits — 2026-09-30

Visual reports now include before/after owner-document viewport, scroll, density,
transformed element bounds, Canvas backing dimensions where applicable, observation
times and browser document-font-set status. The surface is explicitly browser
composition. Render generation and asset readiness remain unknown; matching
before/after observations do not claim atomicity or application settlement.

Five report-context tests failed before implementation. Ten focused evidence tests
and one mixed Canvas/DOM smoke test passed afterward. The smoke report records
800×600 viewport, 720×240 composed element bounds and density 1; its DOM host has
no own Canvas backing dimensions. Typecheck and focused lint passed on Node
24.15.0 / pnpm 11.21.0 / Chromium. No baseline changed.

PIX-01 and PIX-02 are partial; TXT-03 moves from gap to partial because document
font-set status is now observed. No per-glyph font or fallback attribution is
claimed. Counts are 213 partial, 21 gaps and 139 unassessed.

## Browser composition versus raw Canvas verified — 2026-09-30

Added two independent raster fixtures with solid-red Canvas output and a blue DOM
sibling overlay. Raw Canvas readback remains red, while the actual browser element
screenshot records the overlay. The plain case differs by exactly 100 pixels; the
2× CSS-scaled, ancestor-clipped case differs by exactly 200 pixels with known
bounds (70,20,10,20). Removing the overlay restores a clean match without changing
the Canvas backing pixels. Capture reports distinguish backing size 40×40 from
composed image size 80×80 in the scaled case.

All twelve visual evidence browser tests passed, along with typecheck and focused
ESLint, under Node 24.15.0 / pnpm 11.21.0 / Chromium. Expected solid-color images
are generated test fixtures; no committed visual baseline changed. PIX-02 remains
partial for other capture paths, arbitrary transforms and browser capabilities.
Counts unchanged.

## Preserve original verification failures and decoded-image ownership — 2026-09-30

Reproduced two helper defects: decoded bitmaps were not closed when drawing or
readback threw, and report storage failure replaced the original visual mismatch.
Bitmap lifetime now uses guaranteed cleanup. Comparison and persistence failures
are collected explicitly, with both error identities retained in an AggregateError
and the original comparison error retained as cause. A storage failure after a
visual match also rejects; missing evidence cannot become a successful test.

Three regression cases failed before implementation. The final sixteen-test
Chromium evidence suite passed, along with typecheck and focused ESLint, on Node
24.15.0 / pnpm 11.21.0. The readback tests inject SecurityErrors; they do not claim
to reproduce cross-origin taint. EVD-08 and PIX-07 remain partial because wider
run/retry causality and backend capability coverage are separate requirements.

## Native replay run manifests and tested rerun recipe — 2026-09-30

Both native replay reports/checkpoints now carry a shared data-only run manifest:
checkpoint-correlated ID, UTC start time, Node/platform/architecture and browser
context options. The runners use those recorded options, including fixed locale,
timezone, color scheme and reduced-motion settings. A recipe includes executable,
separate arguments, cwd, allowlisted density setting and browser-endpoint removal.
It omits the output-directory argument so reruns preserve earlier evidence.

The new module tests initially failed before implementation. Both tests and focused
lint passed. Fresh targeting and visualization replays passed seven/nine actions,
with matching checkpoint/run IDs. Executing the saved visualization recipe directly
also passed all nine actions and created a distinct run ID and fresh report at
`packages/core/test/out/agent-viz/2026-09-30T19-06-36.831Z/report.json`.

EVD-01/EVD-05 remain partial for other evidence producers and complete provenance.
The local recipe requires a provisioned checkout and source Studio; it does not
claim cross-machine reproducibility. Counts are 216 partial, 21 gaps, 136 unassessed.

## Structured, bounded replay assertion evidence — 2026-09-30

Native replay failures now retain assertion operator and typed expected/actual
values, with explicit omissions and node/depth/entry/string limits. Error summaries
have priority over large detail. The serializer does not invoke getters, toJSON or
custom string conversion. It is not a sandbox for proxy traps or a general secret
redactor. Action IDs distinguish a currently incomplete action from the last action,
avoiding attribution of later cleanup/verification failures to completed actions.

The initial tests failed on the absent module. Eight checks passed including a real
native controlled failure and existing targeting/viz identity rejections. The native
failure reports expected `source-runtime`, actual `unsupported-test-fixture` and
`strictEqual`. Final four serializer tests passed after adding deep/wide budget and
summary-preservation coverage. Focused ESLint passed on Node 24.15.0 / pnpm 11.21.0.

EVD-04/EVD-07 remain partial: Boolean assertions still need explicit numeric operand/
tolerance evidence, and full causal links/omission accounting are not generalized.
Counts are 218 partial, 21 gaps and 134 unassessed.

## Numeric visualization failures retain their oracle — 2026-09-30

Converted all twelve final approximate numeric checks in the native visualization
replay to retain actual/expected operands, absolute difference, tolerance, exclusive
boundary, quantity name and units. Existing thresholds remain unchanged. Invalid
oracle configuration and nonfinite actual values reject. Browser polling predicates
remain separate from final assertions.

The new test suite initially failed because the helper did not exist. Seven numeric
and serializer tests passed after implementation, including exact boundary and
invalid-value probes; focused ESLint passed. Native visualization replays passed all
nine actions at both pixel densities 1 and 2, with no recorded/dropped errors and
watchdog exit 0. Evidence is under `packages/core/test/out/agent-watchdog/` in
`viz-numeric-evidence-1-2026-09-30` and `viz-numeric-evidence-2-2026-09-30`.

EVD-04 stays partial for assertion identities/completion and causal links across
other producers. No tolerance was widened and no runtime or baseline changed.

## Compact saved-evidence reader — 2026-09-30

Added a data-only CLI/module for native report and checkpoint summaries, selected
action detail and rerun manifests. Input is capped at 4 MiB; summaries include at
most 32 actions and explicitly count omissions; detail above 64 KiB rejects.
Primary, observation, completion, checkpoint and cleanup failures stay distinct.
Checkpoint claims remain partial, and every view is marked saved-evidence-only.
The reader executes no recipes and opens no linked artifacts.

Tests initially failed on the absent module. Five tests and focused lint passed.
Actual retained density-2 visualization evidence produced a 1011-byte summary,
4068-byte action detail, 1336-byte manifest and 1052-byte partial-checkpoint summary.
These are reads of earlier evidence, not fresh browser verification.

EVD-06/EVD-12 remain partial for broader schemas and paged assertion/trace slices.
Counts are 220 partial, 21 gaps and 132 unassessed.

## Replay-tool provenance separate from fixture identity — 2026-09-30

Run manifests now fingerprint the replay script and its declared local dependencies,
separately from served runtime/fixture identity. Before success, both runners capture
and compare tool identity again. Targeting covers seven files; visualization covers
eight, including numeric assertions. A test changes an assertion helper without
changing the revision and observes a different hash; another checks coverage of all
current static local imports.

The new test initially failed on the missing capture API. Four fingerprint/manifest
tests and focused lint passed. Fresh native targeting and visualization runs passed
seven/nine actions with identical initial/final tool identities and watchdog exit 0.
Reports are under `packages/core/test/out/agent-watchdog/` in
`targeting-tool-identity-2026-09-30-1` and `viz-tool-identity-2026-09-30-1`.

This is on-disk provenance, not atomic loaded-module attestation. An actual mid-run
edit rejection still needs a controlled integration probe. EVD-01 remains partial;
cross-run comparison is not yet implemented. Counts unchanged.

## Conservative comparison of saved native evidence — 2026-09-30

Added a data-only comparison CLI/module using the bounded evidence reader. It
requires consistent fixture/tool provenance and matching environment, browser,
fixture URL and action manifest. Missing/differing provenance, duplicate actions,
unfinished claimed passes and checkpoints cannot silently become comparable.
Accepted output records source/run identity, action evidence changes, outcomes and
failure-evidence changes without claiming causal or screenshot equivalence.

Initial tests failed before implementation. Eight comparison/reader tests and lint
passed. A fresh native visualization replay passed; comparison against the earlier
matching-provenance run found all nine recorded actions unchanged. Comparison with
the older density-2 run rejected with environment and tool-provenance reasons.
Artifacts `comparison.json` and `incompatible-comparison.json` are retained under
`packages/core/test/out/agent-watchdog/viz-comparison-2026-09-30-1/`.

EVD-09 remains partial for intentional build changes, semantic difference slices,
and failed runs without final provenance. Counts are 221 partial, 21 gaps and
131 unassessed.

## Failed-run verifier provenance and error preservation — 2026-09-30

Moved final verifier capture into shutdown finalization for both native runners.
Failed operations now retain final on-disk identity too. Changed/unreadable verifier
files force failure in a separate `toolVerification` record while preserving the
original operation failure. Missing initial identity is explicitly unavailable.
The summary reader exposes verifier failures; comparison includes them separately.

Three native failure cases initially failed because final identity was absent.
Eight focused identity/finalization checks passed afterward, including controlled
helper changes and read failure without replacing the original error. The combined
harness gate passed all 36 tests. Fresh native targeting/viz replays passed seven/
nine actions with `matching-on-disk` verifier status. Focused lint passed on Node
24.15.0 / pnpm 11.21.0 / Chromium. Reports are retained in the agent-watchdog output
under `targeting-final-provenance-2026-09-30-1` and `viz-final-provenance-2026-09-30-1`.

Abrupt termination still cannot promise final identity; checkpoints remain partial.
No full trust-gate or overall requirement completion is claimed. Counts unchanged.

## Explicit checkpoint clocks — 2026-09-30

Checkpoints now separate wall timestamps from Node monotonic elapsed milliseconds,
identify the clock by run ID, and retain paired initial observations with an explicit
not-synchronized correlation label. Invalid/backward monotonic samples reject while
preserving the last valid file. Compact summaries expose the same clock semantics.

The new timing test initially failed on missing metadata. It now proves a one-day
wall-clock reversal does not alter monotonic elapsed progression from 25 to 50 ms,
and that a backward monotonic sample cannot replace valid evidence. Eleven focused
checks passed after implementation; final nine checkpoint/reader checks passed after
summary integration. A fresh native visualization replay passed nine actions, and
its saved checkpoint remained partial with explicit clock metadata. Focused lint
passed on Node 24.15.0 / pnpm 11.21.0 / Chromium.

EVD-13 remains partial for browser/scheduler/simulation correlation. Counts are
222 partial, 21 gaps and 130 unassessed.

## Direct replay evidence retention — 2026-09-30

Both native replay commands now reserve their output directory before browser work.
An exclusive persistent marker prevents concurrent cooperating writers from claiming
the same directory. Nonempty directories are rejected, including legacy reports;
a lone watchdog preparation file is preserved. The marker is not process-liveness
evidence. Documentation now specifies explicit cleanup rather than overwriting.
The helper is included in verifier fingerprints and its tests in the harness gate.

The previously failing missing-module tests now pass. Seven focused tests and lint
passed on Node 24.15.0 / pnpm 11.21.0. Tests exercise both actual CLI rejection paths,
preserved report bytes, concurrent reservation, and successful watchdog child exit
with retained evidence. The Studio server was unavailable; no fresh native browser
replay or aggregate trust pass is claimed.

EVD-10 is partial: disposable-environment publication and durable retention policy
remain open. Counts are 223 partial, 21 gaps and 129 unassessed, with none certified
complete. This closes the pending local retention implementation, not the full
verification objective.

## Weighted visualization pipeline slice — 2026-09-30

The hover lab now offers Weighted aggregation: five source rows filter to four,
then two weighted-mean groups. Agent evidence records stage counts, weighted sums,
denominators, score units and no-rounding policy, tied to rendered generation.
An unrelated data update removes that evidence rather than retaining stale claims.

A new browser test failed before implementation. All six visualization verification
tests now pass; independent arithmetic proves endpoint means 10 and 30 and the
interpolated value 15 at x=2.5, where an unweighted implementation would report 20.
The test also verifies plot coordinates and published JSON. Focused lint and full
TypeScript checking passed on Node 24.15.0 / pnpm 11.21.0; catalog index regenerated.
Studio is started at http://127.0.0.1:5196/#/testing/viz-hover-lab for feedback.

DAT-04 and DAT-06 move from gap to partial. Counts: 225 partial, 19 gaps,
129 unassessed; none certified complete. Wrong-result diagnosis/repair and broader
analytical policies remain open. This is a runnable slice, not feature completion.

## Weighted-result diagnosis and repair — 2026-09-30

Added an explicit Inject wrong average action. Its reported group values 20/20
contradict independently checked weighted totals and denominators yielding 10/30.
Weighted aggregation repairs the result; native hover at x=2.5 changes from 20 to
15 while plot allocation remains fixed. Both generations remain in saved evidence.
A passing injected-defect step explicitly means defect detected, not result correct.

The new browser test failed before implementation; all seven focused browser tests
now pass. The native replay now requires eleven actions and passed all eleven at
density 1 with matching final verifier identity and watchdog exit 0. Artifact:
`packages/core/test/out/agent-watchdog/viz-weighted-repair-2026-09-30-1/report.json`.
Focused lint and typecheck passed; scenario index regenerated. Environment: Node
24.15.0, pnpm 11.21.0, Chromium. No full trust-gate claim.

DAT-04/DAT-06 remain partial. Counts unchanged: 225 partial, 19 gaps,
129 unassessed, zero certified complete. This controlled fixture does not supply
a general causal inference engine, new aggregation API or broad analytical coverage.

## Confirmed Three picking generation mismatch — 2026-09-30

REN-07 now has a controlled browser reproduction rather than source suspicion.
A public Three layer renders a white box over a blue clickable Canvas rectangle.
The first click reaches Three. Mutating mesh.visible without another frame makes
the second click reach Canvas, while center pixels remain exactly white and the
render callback count remains one. The committed picker reads live scene state.

The 23-test Three adapter run passes, including a clearly labeled diagnostic that
asserts the known mismatch. This is evidence of a defect, not passing generation
conformance. Node 24.15.0 / pnpm 11.21.0 / Chromium. REN-07 remains a gap; counts
remain 225 partial, 19 gaps and 129 unassessed.

A repair must cover generation-owned picking state while preserving target identity,
not merely cache the last hit or suppress mutations. Snapshotting visibility alone
would leave camera, transforms, geometry, material groups and custom raycasts live.
Cloning a Three scene alone also shares geometry/material resources and does not
freeze arbitrary custom raycast closures. Next work must establish a supported
snapshot strategy and failed-candidate behavior, with explicit ownership and cost.
The current diagnostic should become a committed-target regression when repaired.

## Three picking repair constraints — 2026-09-30

Expanded the REN-07 diagnostic to four confirmed live mutations: visibility,
world matrix, camera matrix and vertex geometry. Each changes routing while the
committed white center pixel and one-render count remain unchanged. Ordinary
Three Mesh.copy (installed package source) shares geometry and materials, so a
scene.clone alone cannot isolate a generation. Custom raycast closures also cannot
be assumed snapshot-safe merely because their receiver is cloned.

A fifth probe initially disproved two assumptions: failed candidates neither pass
input through nor immediately dispose application resources. Current core
failCandidate gates input, draws the old bitmap and reports the error. The final
probe proves zero early disposals and restored targeting after a successful retry.
This existing behavior must be preserved by the repair.

All 27 Three adapter browser tests passed on Node 24.15.0 / pnpm 11.21.0 /
Chromium. The four mismatch assertions remain explicitly diagnostic, not desired
behavior. Focused lint and typecheck passed. REN-07 remains a gap; counts unchanged.

Repair direction: generation-owned CPU picking data for ordinary supported Three
objects, with original-object target mapping and camera/material eligibility
captured at settle. Geometry, instancing and skinning must be independently owned
or backed by an explicit immutable-resource guarantee; version flags alone cannot
detect arbitrary typed-array writes. Do not silently add full per-frame scene
copies without measuring allocation/copy cost. Custom pick closures need explicit
application responsibility for generation isolation. GPU ID picking is a distinct
alternative with readback, custom-material and postprocessing semantics to resolve,
not a drop-in preservation of ordinary Three raycasting. No new public contract or
snapshot implementation is approved or claimed by this investigation.

## First committed Three picking repair — 2026-09-30

Converted the four known-gap diagnostics to desired-behavior regressions; all four
failed before production changes. The default picker now captures a CPU-only scene
and camera with independent geometry/material copies per generation and maps hits
back to original target objects. Shared resources are deduplicated within each
snapshot. Skeleton bones/inverse matrices are remapped instead of deliberately
sharing live skeleton state, but specialized-object evidence remains outstanding.

All 27 adapter browser tests pass, including four unchanged white-pixel/target
checks and subsequent blue-pixel/Canvas-target adoption after the replacement frame.
Failed candidate gating and recovery remain green. Focused lint and typecheck pass
on Node 24.15.0 / pnpm 11.21.0 / Chromium. The earlier diagnostic mismatch claims
are historical and superseded for these four ordinary-box cases.

This is an initial repair, not feature completion. Full geometry copying each
render has an unmeasured cost. Custom clone/raycast semantics, userData cloning,
external parent relationships, instancing/skinning/morph behavior, lifetime and
focus-generation evidence still need work. Arbitrary custom closures cannot be
made immutable by cloning their receiver. No aggregate trust result is claimed.
REN-07 is partial: counts are 226 partial, 18 gaps and 129 unassessed, none certified.

## Picking snapshot metadata compatibility — 2026-09-30

Caught and repaired a regression introduced by the first snapshot implementation:
Three Object3D/Material cloning serializes userData. Cyclic application metadata or
a throwing toJSON could therefore prevent an otherwise valid scene from picking.
Copy preparation now uses metadata-free descriptor views without mutating source
objects, then restores the original opaque metadata descriptor on each copy.

Four public cases cover scene, camera, mesh and material metadata. A custom
raycast reading this.userData also remains functional; an intermediate omission
failed that test and was corrected. Final 31-test Three adapter run passed,
as did focused lint and typecheck on Node 24.15.0 / pnpm 11.21.0 / Chromium.
The first failing metadata run also exposed test-cleanup cascading failures after
a queued scheduler error; only the final complete successful run is claimed green.

Metadata stays application-owned, not deeply immutable. Arbitrary custom raycast
closures and mutable custom data still need explicit generation-safe handling.
Specialized objects, resource/copy cost and broader REN-07 remain open. Counts
unchanged: 226 partial, 18 gaps, 129 unassessed, none certified complete.

## Specialized picking and shared-resource cost evidence — 2026-09-30

Three additional public cases cover instance-matrix edits, one-bone deformation
and morph influence changes. Each proves old white pixels/target remain until
commit, followed by blue underlying pixels/Canvas target after replacement.
All 34 adapter tests pass without additional production changes.

A structural test with 1,024 meshes sharing one box geometry/material proves one
copied geometry and material per generation, 840 copied vertex/index bytes,
original target mapping and independence across subsequent snapshots. This does
not count the 1,024 object copies, matrices, metadata references or other CPU
allocations. Per-frame unique-geometry copying remains a cost; no timing or total
memory-performance claim is made. The separate structural test passes.

Environment: Node 24.15.0 / pnpm 11.21.0 / Chromium. Focused lint and typecheck
also pass. Full specialized-object coverage, custom picking semantics, external
parent state, resource lifetime and projected focus evidence remain open.
REN-07 remains partial; requirement counts are unchanged.

## Focus and pointer generation agreement — 2026-09-30

Added a public Three-layer scenario test with independent perspective arithmetic:
a translated box moves its projected horizontal bounds from [37.5,62.5] to
[50+50/6,50+150/4]. Bounds and pointer targeting remain on the old frame before
commit. A failed candidate retains the original bounds and gates pointer input;
a successful retry updates bounds, exact sampled pixels and targeting together,
while retaining the original focus registration identity.

The initial test fixture incorrectly gave FocusManagement two children; its
single-child contract rejected that setup. After correcting the fixture, all 35
adapter tests pass without production changes. Focused lint and typecheck pass
on Node 24.15.0 / pnpm 11.21.0 / Chromium. This evidence establishes the stated
perspective-box case, not every keyboard-navigation or renderer configuration.
REN-07 and the full goal remain partial; counts unchanged.

## Measured picking-copy cost and object preparation optimization — 2026-09-30

Added an opt-in descriptive Node benchmark (30 samples after five warmups) with
raw durations, CPU/runtime/Three version, source hash and geometry-byte counts.
It retains the previous snapshot while copying the next, excludes rendering and
hit testing, and makes no timing pass/fail judgment. The first invocation failed
on Three's CJS entry; successful records use the installed ESM entry.

The first run showed a material per-object cost. Replacing full property-descriptor
copies with a metadata-shadow input preserves nonserializing behavior while avoiding
one descriptor allocation per source property. Observed medians before/after:
1,024 shared boxes 12.28/5.44 ms; 1,024 unique boxes 17.01/11.66 ms;
128 shared spheres 1.59/0.69 ms; 128 unique spheres 5.82/5.90 ms.
Unique spheres still copy 11,833,344 geometry bytes per snapshot. These are two
local descriptive runs, not a general speedup guarantee or total frame timings.
Reports are under `packages/core/test/out/three-picking-cost/` in
`2026-09-30T20-05-16.091Z` and `2026-09-30T20-05-54.765Z`.

All 36 adapter/snapshot browser tests, focused lint and typecheck passed afterward
on Node 24.15.0 / pnpm 11.21.0 / Chromium. Unique-geometry copying remains costly;
this is not a claim that the default repair is ready for every complex scene.
REN-07 remains partial; counts unchanged.

## LOD child identity repair — 2026-09-30

Found a compatibility regression in the snapshot implementation: Three LOD.copy
recursively clones its level objects even when clone(false) is requested. The
snapshot traversal then added another set, producing four children for two levels
and allowing a hit on an unregistered duplicate to block the registered leaf.

Two tests failed before the repair: public click delivery and exact child count.
LOD copy preparation now suppresses its private recursive level copy, then maps
level entries onto the same generation-owned child objects used throughout the
snapshot. Distances/hysteresis and original target mapping are retained.

All 38 adapter/snapshot browser tests, focused lint and typecheck pass on Node
24.15.0 / pnpm 11.21.0 / Chromium. LOD geometry mutation remains isolated before
commit and is adopted afterward. Custom subclasses and other specialized cloning
remain open; this does not certify arbitrary Three objects. Counts unchanged.

## Batched transform storage repair — 2026-09-30

A new public BatchedMesh instance-transform case failed: saved picking followed
live matrix edits while the old white box remained visible. Three's texture clone
shares TextureSource; BatchedMesh.copy writes image.data through that shared image
container. Copy preparation now supplies detached image containers for its texture
fields, so the copy's typed-array writes cannot replace application storage or
leave transform data shared. A structural assertion preserves the original storage
identity and proves independent getMatrixAt results after a public mutation.

A full 40-test adapter/snapshot run passed after repair. The deprecated Source
alias was replaced with TextureSource; the final two batched checks passed afterward.
Three package typecheck and focused lint pass on Node 24.15.0 / pnpm 11.21.0 /
Chromium. Workspace typecheck was attempted and fails on unrelated in-progress
path-warp tests referencing an unavailable warpPath export. Those files were left
untouched. An initial browser startup failure in documentation preparation cleared
on retry; no aggregate verification claim is made.

Custom texture/object subclasses and broader ownership/copy-cost coverage remain
open. REN-07 stays partial; requirement counts are unchanged.

## Shared Three picking Studio lab — 2026-09-30

Added the public-API three-picking-generation lab with Mutate without frame and
Commit frame actions. Its live/displayed visibility, frame count and click counters
are visible in Studio and available as JSON evidence. Input counters deliberately
do not request another render, preserving the uncommitted interval for inspection.
The native-input test verifies exact center pixels, click routing, commit and reset.

The test failed on missing catalog entry, then passed in an isolated configuration
that omitted the unrelated documentation build. The normal gate was not changed:
concurrent public path work initially blocked documentation startup, and a later
normal attempt failed in dependency scanning. Workspace typechecking also reported
unrelated in-progress path-bending and texture-package failures. Focused lint passed;
scenario catalog/index was regenerated and the test added to agent verification.

The actual Studio recovered after its development-server restart. Browser-tool
interaction then confirmed frame 1 with liveVisible=false/displayedVisible=true
and threeClicks=1, followed by frame 2 with both false and canvasClicks=1.
URL: http://127.0.0.1:5196/#/testing/three-picking-generation . A screenshot of the
final state is saved at /tmp/pibbl-three-picking-lab.png. This is a runnable slice;
full trust and broader renderer requirements remain open. Counts unchanged.

## Three lab wait ownership — 2026-09-30

Fixed pending lab waits surviving disposal. Each wait now owns cancellable frame
callbacks and a five-second deadline. Disposal rejects all pending waits, cancels
their callbacks and removes the evidence node even if runtime disposal throws.
Saved stale callbacks cannot schedule another frame or publish evidence.

The new disposal test initially failed with zero completed promises. All three
isolated lab browser tests now pass, including controlled deadline delivery and
native mutate/commit/reset behavior. Focused lint and final workspace typecheck
pass on Node 24.15.0 / pnpm 11.21.0. Normal browser startup still encountered the
fsevents dependency-scanning error; the temporary component configuration omits
the docs plugin, with no changes to normal repository gates. No full trust claim.
Counts unchanged; the full verification goal remains open.

## Normal browser discovery repair — 2026-09-30

Reproduced the fsevents startup failure with normal configuration. Dependency-scan
logging identified our Node-runner agent harness tests as browser entry points;
browser-failure.test.mjs imports Playwright, whose Node dependencies cannot be
bundled into Chromium. The earlier attribution to the docs plugin was tentative
and incorrect for this failure. No documentation plugin bypass is now needed.

The browser configuration excludes tooling/agent-verification/**/*.test.mjs.
Those tests remain in their existing Node commands and trust-gate stages. Normal
Three/lab suites now pass all 43 tests. The complete test:agent-verification command
passes 3 requirement tests, 5 identity tests, 42 harness tests and 73 browser tests
across 7 files. Focused configuration lint passes. Environment: Node 24.15.0,
pnpm 11.21.0, Playwright Chromium. The failing normal invocation preceded the fix;
the same normal invocation passed afterward. Full repository trust remains unrun.

This repairs verification infrastructure without changing inventory dispositions.
The exhaustive objective remains active. Local diagnostic output is retained in
/tmp/pibbl-deps-debug.log and /tmp/pibbl-agent-verification-normal.log; these temporary
logs are not a durable CI evidence publication guarantee.

## Geometry versus clip diagnosis — 2026-09-30

The targeting probe previously reported clip exclusion without checking whether
the queried point matched the shape at all. It now reports unclipped hit geometry
independently as hit, miss or not-tested. This prevents an agent from inferring
that removing a clip necessarily repairs a miss. No paint visibility or exact
path bounds are inferred. Existing native-call budgets and context restoration
remain in place; runtime dispatch is unchanged.

Two regression assertions failed before implementation. All 24 targeting tests
pass afterward in normal Chromium configuration, including the shared lab's
Inspect outside Layer action and native click. Workspace typecheck was attempted
and fails in concurrent path-warp tests on PathSegment x/y access; those files
were not changed. Environment: Node 24.15.0 / pnpm 11.21.0.

GEO-10 advances from unassessed to partial with explicit remaining paint,
zero-area, invalid-input and no-drawing work. Counts are now 227 partial,
18 gap and 128 unassessed; none certified complete. The full goal stays active.

## Passive clip ancestry — 2026-09-30

Added bounded clip records to passive targeting snapshots. Each constraint now
names its capture surface, local-to-surface matrix, clip-local-to-root matrix,
fill rule and observed paint entry. Layer bounds and explicit clips remain
distinct; inherited constraints retain their originating surface. Opaque paths
are labeled explicitly and native path objects never escape into reports.

The new ancestry contract failed before implementation. All 24 targeting tests
passed after implementation, including nested transformed Layer native-input
checks and existing truncation cases. Focused lint passes. Workspace typecheck
still fails on concurrent path-warp test PathSegment x/y access. GEO-06 remains
partial: representable geometry and source-component attribution remain open.
Counts are unchanged; no overall completion claim is made.

## Entry-local point/vector conversion — 2026-09-30

Extended generation-checked conversion with entry-local space identified by an
observed paint-entry order. Nested transforms compose before root fit/density.
Points include translation and vectors exclude it. Negative scales invert;
singular transforms allow forward mapping but reject inverse requests explicitly.
Missing orders, truncated observations and external renderer subtargets do not
produce guessed coordinates. This remains a source-development inspector.

The focused assertion failed before implementation. Initial normal observation
run passed 14 tests. Final observation/shared-lab run passed 25 tests with the
temporary docs-plugin-free configuration: concurrent texture documentation now
fails its ProceduralTextureProps link check during normal startup. Workspace
typecheck separately reports concurrent path-bending export/type errors. Focused
lint passes. Node 24.15.0 / pnpm 11.21.0 / Chromium. No aggregate trust claim.
GEO-03 remains partial and counts are unchanged.

## Aggregate verification attempt — 2026-09-30

Ran `fnm exec --using=24.15.0 corepack pnpm@11.21.0 trust` against the combined
working tree. It first failed scenario-index freshness. Regenerated the index
from the current catalog: 68 lessons, 12 tutorial snapshots and 28 test labs.
After regeneration, requirement accounting and scenario checks passed; docs:check
failed classification for these concurrent feature documents:

- docs/design/textures-contract.md
- docs/site/api/components/procedural-texture.md
- docs/site/api/components/reaction-diffusion.md
- docs/site/api/functions/path-bending.md
- docs/site/api/types/textures.md
- docs/site/learn/guides/procedural-textures.md
- packages/textures/README.md

No classification or completion banner was invented for those documents. The
short-circuiting gate did not reach Studio documentation checks, typecheck, lint,
builds, packed consumers, browser or lifecycle stages. The source of this failure
is distinct from the repaired Node-test/browser-discovery bug. Local output is
/tmp/pibbl-trust-after-index.log; this is diagnostic evidence, not a retained CI run.
The goal and all remaining requirements stay open.

## Stroke interaction versus paint — 2026-09-30

Corrected misleading prototype metadata: strokeWidth held the hit-test band,
not the painted stroke width. It is now strokeInteractionWidth, explicitly
separate from unknown paint bounds. No runtime hit semantics changed.

A new public Line test failed on the metadata contract before repair. It now
proves exact red pixels on the two-pixel painted line, a transparent pixel eight
units away that receives a native click inside the twenty-pixel hit band, and
native misses outside the band and beyond the endpoint. All 26 targeting tests
pass under normal configuration; the concurrent docs startup issue has cleared
for this run. Focused lint passes. Node 24.15.0 / pnpm 11.21.0 / Chromium.

GEO-04 is partial with general bounds inspection still explicitly outstanding.
Counts: 228 partial, 18 gaps, 127 unassessed, no certified completion. Normal
verification also covers the prior local-conversion and clip-ancestry additions.
This is not an aggregate trust pass.

## Focus navigation-envelope semantics — 2026-09-30

Focus snapshots now qualify bounds as root-logical axis-aligned envelopes of
navigation metadata. Their relationship to exact hit geometry and painted
geometry is explicitly unknown; null bounds remain null. No focus/navigation
runtime behavior changed.

The new contract assertion failed before implementation. A rotated Rectangle
fixture independently checks its envelope dimensions, a transparent/non-hitting
corner inside the envelope and a successful native click inside the actual shape.
All 27 targeting tests pass in normal Chromium configuration. Focused lint and
workspace typecheck pass on Node 24.15.0 / pnpm 11.21.0. This supersedes the prior
workspace typecheck failure for this observed checkout, but is not a trust pass.

GEO-05 is partial; other bounds families still need explicit accuracy semantics.
Counts: 229 partial, 18 gaps, 126 unassessed, none certified complete.

## Layout entry observation slice — 2026-09-30

Existing component records now retain frozen numeric allocation and percentage
basis at traversal entry. The source inspector exposes them without re-running
components or reading application props, and semantic diffs detect changes in
either box. Entry context is expressly not successful-paint evidence. It does
not yet explain source style, measurement, placement translation or algorithms.

The new contract failed before implementation. Final 52 tests pass across signal
observation, shared targeting verification and layout foundation. Independent
public useLayoutBox values match captured allocation; 50%-to-25% changes preserve
old snapshots and produce a layout difference. The shared manual lab's Inspect
action exposes Layer allocation through the same component records. Workspace
typecheck and focused lint pass. Node 24.15.0 / pnpm 11.21.0 / Chromium.

Slice ready for feedback; allocation overhead, failed traversal semantics and
broader edge cases remain to harden. LAY-01/LAY-03 stay partial; counts unchanged.
The full objective remains active.

## Layout observation record reuse — 2026-09-30

The first layout recorder allocated three objects per component entry on every
render. It now compares the fixed numeric fields and reuses unchanged boxes and
their containing record. A changed allocation retains an unchanged percentage
basis. Captures copy only the four defined box fields, not arbitrary properties.

New identity assertions failed before repair. All 61 tests pass across signal
observation, targeting verification, layout foundation and runtime cleanup stress.
Unchanged renders produce no semantic layout difference; changed allocations do,
and old snapshots remain immutable. Workspace typecheck and focused lint pass.
Node 24.15.0 / pnpm 11.21.0 / Chromium. This is structural reuse evidence, not a
wall-clock performance claim or exhaustive failure-path certification. Counts
and the full goal remain unchanged.

## Layout failure isolation evidence — 2026-09-30

Added a public two-root fixture: a child throws after reading its layout box while
an independent root updates. Failed component observations disappear with positive
removal evidence; retained historical allocations remain unchanged. The independent
root still observes its expected allocation/percentage basis and paints blue.
Explicitly rendering the failed root again produces a new component lifetime and
corrected allocation. An empty post-failure component list does not prove success.

All 43 signal-observation/layout-foundation tests pass; typecheck and focused lint
pass. Node 24.15.0 / pnpm 11.21.0 / Chromium. The initial pixel assertion exposed a
fixture backing-size mismatch and was corrected; no runtime behavior was changed
or defect repair claimed. LAY-11 remains partial for same-root sibling and nested
surface failure cases. Requirement counts and the full goal remain unchanged.

## Sibling and nested Layer layout recovery — 2026-09-30

Added direct-child and nested-Layer failure cases through public components.
Direct failure aborts later siblings; explicit recovery restores the three
independently expected allocations. Nested recovery verifies its distinct
percentage basis and the scheduler's deepest-first dirty Layer evaluation.
Evaluation order is not conflated with source paint order.

All 45 signal-observation/layout-foundation tests pass. Initial recovery order
expectation was a fixture mistake corrected against the scheduler contract; no
runtime defect repair is claimed. Focused lint passes. A test style type was
corrected; final workspace typecheck now fails only on concurrent particle flow
test import ./field.js. Node 24.15.0 / pnpm 11.21.0 / Chromium. LAY-11 remains
partial for preparation-phase errors and deeper nesting. Counts unchanged.

## Structured layout diagnostic evidence — 2026-09-30

Replay error evidence now retains reported LayoutDiagnostic component, property,
algorithm, suppliedValue and constraints through the existing bounded descriptor
encoder. It does not invoke supplied-value accessors or custom serialization and
does not treat the reported name as class authentication. Browser transport can
still discard custom fields before this serializer receives them.

The new Node assertion failed before implementation. Five serializer tests and
five browser layout tests pass afterward; the browser checks use actual runtime
diagnostic objects. Workspace typecheck and focused lint pass. Node 24.15.0 /
pnpm 11.21.0 / Chromium. LAY-12 remains partial for transport and source/generation
attribution; counts unchanged. Integration chat requested this work finish and
hold edits for combined verification/commit; no independent commit or push made.

## Three application ownership integration repair — 2026-09-30

Combined browser verification found the instancing lifecycle test counting four
geometries instead of two. Its global Object3D.add spy included CPU picking
snapshots in the application-owned resource set. The test now collects identities
from scenes observed through Three's actual onBeforeRender callback. Snapshot
copies are never submitted to that renderer and therefore cannot enter this set.
The exact two-geometry/two-material, stable-resize-identity and exactly-once
disposal assertions remain intact; no expected resource count was loosened.

All eight instancing/snapshot tests pass; workspace typecheck and focused lint
pass on Node 24.15.0 / pnpm 11.21.0 / Chromium. Only test-support exports and the
lifecycle test changed for this repair. The integration coordinator owns combined
verification; this chat returns to holding edits and makes no independent commit.
The inventory remains open and counts unchanged.

## BatchedMesh child identity repair — 2026-09-30

Read-only review reproduced another built-in copy mismatch: Three BatchedMesh.copy
ignores recursive=false and copies children itself. Snapshot traversal then added
the mapped children again, creating an unmapped duplicate that blocked a registered
leaf click. Integration assigned this repair back to the verification chat.

Two tests failed before production changes: one original child became two snapshot
children, and the public registered child received zero clicks. Clone preparation
now shadows Object3D children with an empty list; only the snapshot identity walk
copies them. Original application child lists/parent identities remain intact.
The existing LOD-specific level handling remains necessary and covered.

All 50 tests pass across snapshot, adapter, instancing lifecycle and manual/headless
picking-lab suites. Workspace typecheck and focused lint pass on Node 24.15.0 /
pnpm 11.21.0 / Chromium. The integration coordinator owns the final aggregate gate;
this chat returns to holding edits after reporting the fix. No commit or push was
made here. REN-07 remains partial and inventory counts are unchanged.

## Post-checkpoint replay failure hardening — 2026-09-30

Integration released the shared-checkout hold after copying the completed work
through BatchedMesh repair into its separate worktree. Everything in this entry
is later work for a subsequent integration; this chat makes no commit/merge/push.

Both replay catch paths previously called String(error) before safe serialization,
allowing a custom conversion failure to replace the original failure. A shared
recordReplayFailure now uses bounded descriptor-only evidence first, retains
action IDs and prioritizes observed transport failure over blocked setup.
Checkpoint and cleanup summaries no longer call custom string conversion either.

Eight error-evidence tests and all 46 Node harness tests pass, along with focused
lint and CLI syntax checks. Node 24.15.0 / pnpm 11.21.0. New helper test import was
red before implementation. No fresh full targeting/viz native replay was run in
this slice; existing harness browser cases passed. Message-based fixture identity
classification and fuller cause chains remain open. Counts unchanged.

## Typed identity failures and evidence audit — 2026-09-30

Post-checkpoint work replaces fixture-identity message matching with explicit
unavailable/mismatch codes. A lookalike application message remains a failure;
localized identity diagnostics still classify as blocked. The regression failed
before implementation. All 14 error/identity tests and focused ESLint passed on
Node 24.15.0 / pnpm 11.21.0, including both replay CLI rejection paths.

Audited EVD-02, EVD-03 and EVD-11 against current producers. Action/run correlation,
conservative pass/fail/blocked handling and bounded opt-in signal observation exist.
Assertion-level correlation, a complete six-state outcome vocabulary and sensitive
scalar/artifact redaction do not. These are harness/application responsibilities;
this audit does not propose new Canvas runtime capabilities or certify completion.
Counts now: 232 partial, 18 gaps, 123 unassessed. No aggregate gate claimed.

## Signal category evidence audit — 2026-09-30

Audited SIG-01/02/04/05/06/09/11/12/13 against current inspection code and
functional fixtures. All 118 tests in five signal, owned-hook and lifecycle suites
passed in the normal Chromium configuration on Node 24.15.0 / pnpm 11.21.0.
The ledger now records existing support rather than treating these as missing
runtime features. No production code was changed by this audit.

The key implementation gaps are explanatory: explicit write-outcome history,
causal links across validation and redraw, candidate/rollback provenance for
owned computeds, and named reaction lifetimes/dependencies/cleanup outcomes.
Synchronous batching and staged Commit publication need separate evidence.
Runtime tests alone do not close those inspection requirements. Counts now:
241 partial, 18 gaps, 114 unassessed. No completion or aggregate pass claimed.

## Passive reaction subscriber classification — 2026-09-30

Added a Pibbl-owned reaction kind marker and descriptor-only inspector classification.
Public useReaction evidence verifies stable identity across dynamic branches,
subscription removal at disposal, immutable old snapshots and unchanged counters
under repeated inspection. Reaction dirtiness remains unknown rather than borrowing
render semantics. Owner links and setup/cleanup history remain open.

An initial detached-canvas fixture did not mount the reaction; attaching the host
corrected the fixture, then the expected other-versus-reaction regression failed.
After implementation all 51 tests in observation/reaction suites passed, along with
workspace typecheck and focused lint on Node 24.15.0 / pnpm 11.21.0 / Chromium.
SIG-12 remains partial. Counts unchanged; this is post-checkpoint integration work.

## Reaction owner correlation — 2026-09-30

Reaction consumers now retain their existing owning component identity explicitly.
The source inspector resolves it through its bounded component walk, without
scanning hook arrays or invoking callbacks. Root and Layer owners join component
IDs; unrelated Canvas inspectors report null ownership. Null remains unknown, not
proof of an ownerless reaction. Runtime-path debug names are not callback names.

The new owner assertion failed before implementation. All 52 observation/reaction
tests passed on Node 24.15.0 / pnpm 11.21.0 / Chromium. Typecheck caught a missing
Group child in the fixture; after correction typecheck and focused lint passed.
SIG-12 remains partial for pending-generation and setup/cleanup history. Counts
unchanged. This work follows the earlier integration checkpoint.

## Scheduler category audit — 2026-09-30

All eleven scheduler requirements now have scoped evidence and specific remaining
work. All 111 tests across scheduler realm/simulation/renderer, signal observation
and public targeting scenario suites passed in normal Chromium configuration on
Node 24.15.0 / pnpm 11.21.0. The Three focus/bitmap/picking fixture was inspected
but not rerun in this audit; its ledger entry says so explicitly.

Existing behavior covers ordered phases, staged publication, failure isolation,
deferral, lifecycle cleanup and bounded phase history. Agent-facing gaps remain
in per-root request causes, writer/transaction correlation, timeout explanations
and reusable selected-update readiness. Fixture-specific readiness is not generic
application readiness; idle state is not success or a presented-pixel guarantee.
Counts: 252 partial, 18 gaps, 103 unassessed. No new runtime feature or completion
claim follows from this audit.

## Exceptional values in saved evidence — 2026-09-30

JSON roundtrip regressions exposed negative-zero loss in assertion and signal
previews, plus conflation of sparse array holes with explicit undefined in error
details. Added explicit tags while preserving null and ordinary finite values.
Signal NaN/infinities are now distinguishable instead of opaque-number previews.
No getter invocation or lazy evaluation is added.

Both new tests failed before implementation. All 16 Node serializer/reader tests
and 43 browser observation tests passed; typecheck and focused lint passed on
Node 24.15.0 / pnpm 11.21.0 / Chromium. QRY-07 is partial: other producers and
schema compatibility remain open. Counts: 253 partial, 18 gaps, 102 unassessed.
This is post-checkpoint work; no aggregate gate or overall completion claimed.

## Focus and keyboard category audit — 2026-09-30

Audited all eight focus requirements against the bounded inspector, native input
fixtures and accessibility guidance. All 156 tests across thirteen focus/public
scenario suites passed on Node 24.15.0 / pnpm 11.21.0 / Chromium. Native Tab and
Shift+Tab cover entry and exit between surrounding DOM buttons and logical Canvas
targets. The shared agent lab independently checks indicator pixels and selection.

Remaining tooling work includes policy/enrollment reasons, directional candidate
ranking and native-action correlation. Application-defined disabled/clipped states,
restoration and semantic alternatives require explicit application contracts.
Keyboard operation never certifies screen-reader semantics. Counts: 261 partial,
18 gaps, 94 unassessed. This is evidence assessment, not feature completion.

## Focus policy observation and checkpoint delivery — 2026-09-30

Committed focus snapshots now identify Pibbl management, source-order Tab exit and
Enter/Space defaults. Candidates expose session-local directional boundary IDs;
null membership means no boundary for that candidate. IDs are weakly held and
bounded by existing candidate traversal. Handler prevention, ranking, eligibility
reasons and empty boundary discovery are not inferred.

The new assertion failed before implementation. All 27 targeting observation/lab
tests passed, including mixed directional/ordinary candidates and native Tab
behavior. Typecheck and focused lint passed on Node 24.15.0 / pnpm 11.21.0.
FOC-01/04 remain partial; accounting counts are unchanged. The final added-assertion
run terminated with a closed browser connection before executing tests; its
2026-10-01 retry passed all 27 tests.

The integration coordinator reports the earlier combined checkpoint passed the
full trust gate and was pushed to main at c6f35d02011bb997007982482a03065dc02e1c96.
The local origin/main ref and commit identity were verified here. This is a
coordinator-reported gate result, not a fresh gate run in this checkout. Later
post-checkpoint changes recorded above remain separate and are not covered by
that report. Future integration must account for the newer main.

## Environment category audit — 2026-10-01

Audited eight remaining environment requirements. Thirteen identity, manifest,
tool-provenance and real browser-failure tests passed on Node 24.15.0 / pnpm 11.21.0.
Existing source fingerprints, configured environment and crash/pageerror evidence
are partial support. Capability guards and packed-output verifiers were inspected,
not freshly executed or counted as successful environment-wide verification.

Explicit duplicate-runtime/version diagnostics are a known gap: module-local signal
recognition is not duplicate-runtime detection. Other remaining work includes
unified capability discovery, observed zoom/platform facts, host/backend discovery,
early console/network/worker capture and installed-version documentation linkage.
Counts: 268 partial, 19 gaps, 86 unassessed. No implementation completion inferred.

## Observed page environment — 2026-10-01

Both replays capture actual page-reported viewport, density, locale/timezone and
media preferences after navigation. Configured browser options remain separate.
Browser zoom remains unavailable; visual viewport scale is identified separately.
Unavailable capture retains bounded error evidence and does not fabricate values.
The capture is initial only, and page scripts can override browser-facing APIs.

New helper import was red before implementation. Fourteen manifest, identity,
tool-provenance and comparison tests passed, including changed browser settings,
closed-page capture and environment fields from both real replay CLIs. Focused
lint passed on Node 24.15.0 / pnpm 11.21.0. ENV-04 stays partial; counts unchanged.

## Query category source audit — 2026-10-01

Reviewed all eight remaining query requirements against current targeting,
signal, comparison and saved-evidence reader implementations. This is a source
and test-content audit; no new browser run is claimed. Prior focused executions
remain dated evidence under their existing entries.

Recorded support includes mount/generation checks, selected signal/action scopes,
bounded summaries, paint/source order and explicit active geometry probes. Gaps
remain in cross-facet atomic snapshots, projections and access to excluded records,
per-field redaction and schema compatibility. Snapshot-consistent pagination is
absent; its requirement does not mandate pagination for views already complete
within their bounds. A future expansion design must not mix generations or retain
unbounded snapshots. Counts: 275 partial, 20 gaps, 78 unassessed.

## Paint category audit — 2026-10-01

Audited twelve paint requirements. All 112 tests in Canvas state, filter rendering,
filter integration, structural performance and public filter lab suites passed on
Node 24.15.0 / pnpm 11.21.0 / Chromium. Other cited fixture sources were inspected,
not counted as fresh executions. No visual baseline was modified.

Confirmed general inspection gaps include emitted drawing per component, resolved
paint state and partial-frame pixel failure evidence. Targeting entries and
component evaluation are not paint proof. Existing controlled fixtures support
state isolation, filter order/alpha, geometry preservation, bitmap reuse and
semantic raster checks; they do not explain arbitrary invisibility. Counts:
284 partial, 23 gaps, 66 unassessed. Full objective remains incomplete.

## Ordinary Canvas partial-frame evidence — 2026-10-01

Added a public scene that paints blue successfully, then paints a red prefix and
throws from a later component. Independent pixel assertions prove the new red
prefix survives while cleared unpainted space is transparent. The inspector
refuses current geometry (pending status); history records a Render error.
Historical ready snapshots stay immutable but do not describe currently visible
pixels. Explicit successful rerender restores blue across the canvas.

All 44 observation tests, typecheck and focused lint passed on Node 24.15.0 /
pnpm 11.21.0 / Chromium. This is new behavior evidence, not a runtime fix.
PNT-11 moves from gap to partial; per-root failed-attempt attribution remains open.
Counts: 285 partial, 22 gaps, 66 unassessed. Overall objective remains incomplete.

## Targeting and event category audit — 2026-10-01

Assessed 22 remaining targeting/event requirements. All 127 tests across eleven
event and native-agent suites passed on Node 24.15.0 / pnpm 11.21.0 / Chromium.
The ledger distinguishes runtime propagation/facade tests from native transport
and final domain outcomes; one does not silently stand in for the other.

Known gaps include a reusable bounded event-path recorder, verified interaction
point search and trust/user-activation reporting. Other open work includes
cross-backend generation/input correlation, action-time races, boundary/cancel
reasons and explicit transport capabilities. No universal pass-through guarantee
is inferred from alpha or hit geometry. Counts: 304 partial, 25 gaps, 44 unassessed.

## Remaining geometry, signals and pixels audit — 2026-10-01

Inspected eleven remaining requirements against current conversion/query code,
primitive input tests, computed graph tests and visual evidence policy. This is
source/test-content assessment, not a new browser run. Existing dated executions
remain available in their earlier records.

Supported pieces include named coordinate conversion, opaque-path point queries,
receiver input attribution, opaque payload preservation and cycle recovery tests.
Outstanding work includes host geometry explanations, declared signal-position
metadata, passive cycle provenance and application mutation diagnostics. Bounded
frame-sequence capture is a known gap; action screenshots cannot exclude flicker.
Overlay rules are conditional on actual diagnostic overlays and do not authorize
building them by default. Counts: 314 partial, 26 gaps, 33 unassessed.

## Inspection safety and lifetime source audit — 2026-10-01

Assessed eight remaining observation requirements against active-probe separation,
source acquisition, weak ownership, bounded history and production gates. This is
source/test-content review, not a fresh browser or production build result.

Known support includes explicit probe effects, stale handle rejection, contained
source acquisition failures and native/pixel cross-checks. Remaining work includes
redaction policy, cross-realm coherence, extended retention stress and final packed
production evidence. General custom-facet compatibility is absent and remains a
conditional extension design gap, not an existing public promise. Counts:
321 partial, 27 gaps, 25 unassessed. None is certified complete.

## Intent, agent workflow and human support audit — 2026-10-01

Assessed sixteen remaining intent/workflow/human requirements using scenario
oracles, source capture, report readers and visual evidence. This is source and
test-content assessment, not a new runtime execution. The targeting invariant
and hand-computed weighted dataset are concrete support, not universal coverage.

Remaining work includes executable requirement-to-scenario discovery, complete
cross-report correlation and compact reproducible handoffs. Human diagnostic
overlays are absent and optional; they do not take priority over agent workflows.
Accessibility and product intent retain separate human/application acceptance
needs. Counts: 336 partial, 28 gaps, 9 unassessed (the cross-cutting rules).

## Initial full-inventory assessment complete — 2026-10-01

All 373 inventory IDs now have an explicit assessment, scoped evidence and
remaining work. The final nine cross-cutting rules were reviewed against current
state/provenance/passivity/bounds/oracle/contract/data-only safeguards. Counts:
345 partial, 28 known gaps, zero unassessed. This completes the initial assessment,
not the implementation objective or certification of any requirement.

The next implementation priority is a compact executable discovery/acceptance
manifest joining requirements to scenarios, supported queries and focused checks.
This should make the existing vertical workflows usable without reading this
chronological log, while retaining every remaining requirement and conditional
application responsibility. New capabilities still need public scenarios and
independent evidence; completing the audit is not permission to shrink scope.

## Executable workflow discovery slice — 2026-10-01

Added a data-only requirement lookup with two curated workflows: targeting
interception and weighted aggregation. Each provides route, prerequisites, actions,
independent oracle, source paths and focused-check argument arrays. Known unmapped
requirements explicitly remain unmapped; unknown IDs reject with a code. The tool
never executes recorded commands or promotes a requirement to complete.

Three discovery tests passed after the initial missing-module failure. Both exact
scenario selectors ran successfully: 17 Chromium tests passed. CLI and focused
lint passed on Node 24.15.0 / pnpm 11.21.0. Discovery tests now run in the existing
requirement gate. The README starts with the lookup commands. Inventory counts
remain 345 partial, 28 gaps, zero unassessed; broader task coverage remains open.

## Observed environment comparison guard — 2026-10-01

Saved report comparison now rejects equal unavailable or malformed observed-page
records. Matching failure text cannot establish matching browser conditions.
Older reports with no observations on either side explicitly compare declared
settings only. Valid initial observations are compared strictly and retain their
limited scope; desktop zoom and changes during the run remain unverified.

Two new tests failed before implementation. All 11 comparison/reader tests and
focused lint passed on Node 24.15.0 / pnpm 11.21.0. Counts unchanged; this repairs
an evidence acceptance gap without claiming an application or aggregate test run.

## Delivered event trust and activation evidence — 2026-10-01

The shared targeting scenario now records original and source event type/trust,
synchronous owning-window activation flags (or explicit unavailability), and
unobserved permission status. No delivery/reset remains null. Keyboard activation
preserves the distinction between a synthetic click and its trusted key source;
script-dispatched clicks can satisfy selection without becoming trusted. Sticky
window activation is not attributed to the current input. No runtime dispatch
behavior or permission checks changed.

Three focused assertions failed before implementation. After correcting an
intermediate canvas-reference error, all 11 Chromium scenario tests passed;
typecheck and focused ESLint passed on Node 24.15.0 / pnpm 11.21.0. General event
traces, other input families, unavailable-API browser evidence and capability
permission scenarios remain open. EVT-09 is partial: 346 partial, 27 known gaps,
zero unassessed, none certified complete. No aggregate gate claimed.

## Native replay provenance acceptance — 2026-10-01

The targeting replay now verifies original/source event trust and activation
observation shape for seed, repair, intentionally blocked pointer clicks and
keyboard activation. A new assertion helper rejects missing provenance, untrusted
pointer input, incorrect keyboard source attribution, malformed activation and
permission-grant claims. Unavailable activation remains explicit. Its file is
included in the replay tool fingerprint and its tests in the harness gate.

The initial helper test failed before implementation. Six provenance and tool
identity Node tests passed, as did focused lint. The full source-Studio replay
passed all seven actions with zero page errors and matching final tool identity;
the watchdog exited 0. Evidence: `packages/core/test/out/agent-watchdog/event-provenance-2026-10-01-1/report.json`.
Environment: Node 24.15.0 / pnpm 11.21.0 / Chromium. The scenario remains available
for this local session at `http://127.0.0.1:5196/#/testing/agent-targeting-verification`.
Capture/drag provenance and protected-action permissions are not certified by
these checks. EVT-09 remains partial; counts remain 346 partial and 27 gaps.

## Bounded interaction-point search — 2026-10-01

Added an opt-in nine-sample search over caller-supplied root-logical bounds. It
returns a frozen verified geometry point only when the requested target wins the
existing committed-generation probe. The center is followed by the remaining
3×3 cell centers. Failed samples return no verified point, not proof that the
target is unreachable. Bounds validation, unknown handles, stale/unavailable,
unsupported and truncated outcomes remain explicit. Work is bounded to nine
probes and at most 1,152 native geometry calls; Canvas state is restored.

A transformed clipped target with a covered center receives real browser input
at the returned off-center point. Tiny unsampled and fully covered targets remain
inconclusive. The shared scenario exposes pointSearch for its observed winner,
without confusing the intercepting decoration with application intent. DOM
occlusion, pointer capture and action-time generation must still be checked by
the caller.

31 tests across point search, targeting observation and shared scenario passed;
typecheck and focused lint passed on Node 24.15.0 / pnpm 11.21.0 / Chromium. Tests
failed before the method and scenario evidence were introduced. HIT-06 is partial;
counts are 347 partial, 26 gaps, zero unassessed, none certified complete.
The full source-Studio watchdog replay also passed all seven actions with zero
page errors. Saved `pointSearch` output was inspected in
`packages/core/test/out/agent-watchdog/interaction-point-2026-10-01-1/report.json`.
For manual feedback, open `http://127.0.0.1:5196/#/testing/agent-targeting-verification`,
use Inspect in seed/repair modes and inspect `state.pointSearch`.

## Explicit handler event-trace workflow — 2026-10-01

Added bounded opt-in wrapping for public application handlers, with ordered
enter/return/throw records, event/invocation identity, capture/target/bubble phases,
target/currentTarget and root-to-target path. Default prevention and original/source
trust are copied without retaining event/target objects or serializing payloads,
handler return values or exceptions. History and path limits, dropped records,
stop/dispose and immutable historical snapshots have executable evidence.

Integrated recording into the shared scenario's existing trace-start/trace-stop
controls. It records 32 entries for scene capture/bubble and action/decoration
clicks. The full native replay asserts propagation in seed, repair and intentionally
blocked modes while retaining independent application and pixel oracles.

The helper import failed before implementation and the scenario assertion failed
before integration. All 15 affected Chromium tests passed, as did typecheck and
focused ESLint. The full watchdog replay passed all seven actions with zero page
errors and matching final verifier identity; report:
`packages/core/test/out/agent-watchdog/event-trace-2026-10-01-1/report.json`.
Environment: Node 24.15.0 / pnpm 11.21.0 / Chromium. For manual inspection use
`http://127.0.0.1:5196/#/testing/agent-targeting-verification`, Trace start, click,
and inspect `state.eventTrace`.

EVT-01 is partial. Only wrapped handlers are observed; IDs are trace-local and
unwrapped listeners, stop reasons, async completion and causal action links are
not inferred. Counts: 348 partial, 25 gaps, zero unassessed, none certified complete.
No aggregate gate or completion of the full verification system is claimed.

## Reviewed closure mechanism and first full-wording check — 2026-10-01

The ledger previously rejected every completed status by construction. It now
supports version-bound reviewed closure records with the full exact inventory
bullet, substantive coverage review, acceptance criteria linked to passing checks,
retained result artifacts, and source/artifact fingerprints. Missing references,
remaining work, changed inventory, changed/deleted evidence and escaping symlinks
reject closure. Recorded commands stay data; validation does not execute them.
The ledger schema is now version 2. Structural/file integrity is separate from
substantive review, and no existing partial row is automatically promoted.

Eight Node accounting/discovery tests passed; all 373 IDs validated and focused
ESLint passed on Node 24.15.0 / pnpm 11.21.0. The reviewed-closure test failed before
implementation. Mutation/deletion and external-symlink checks validate stale
proof rejection. This is accounting verification, not an application test run.

Reviewed HAR-14 against its full watchdog wording and current implementation/tests.
The owned Chromium hang test records evidence before blocking both page and replay,
checks termination and retained output, but explicitly skips Windows. Ordinary
focused test recipes are also not uniformly watchdog-owned. HAR-14 remains partial
pending a justified supported recipe/platform coverage decision and evidence.
No fresh watchdog run or requirement closure is claimed by this source review.
Counts remain 348 partial, 25 gaps and zero complete. This removes a tracking
obstacle without substituting paperwork for the outstanding implementation.

## Explicit six-state check outcomes — 2026-10-01

Added bounded, uniquely identified check records with pass/fail/blocked/
inconclusive/skipped/not-applicable statuses, required flags and reasons for every
non-pass. Executed failures fail a run; required blocked or missing evidence cannot
be certified by a provisional pass. Optional omissions remain visible in their
original state. Saved summaries expose bounded check reasons and omissions;
comparison rejects malformed or contradictory evidence and detects changed checks.

25 focused Node tests and ESLint passed after outcome, reader and comparison
regressions failed before implementation. The first real replay correctly blocked
before actions because the existing Studio served a stale identity. Restarted the
task-owned development server, then the fresh watchdog replay passed all seven
actions and the reader preserved explicit skipped/not-applicable reasons. Evidence:
`packages/core/test/out/agent-watchdog/check-outcomes-2026-10-01-2/report.json`;
the blocked attempt remains separately retained at `check-outcomes-2026-10-01-1`.
Environment: Node 24.15.0 / pnpm 11.21.0 / Chromium.

EVD-03 remains partial because most existing assertions/observation producers still
need migration to identified check outcomes. Counts remain 348 partial, 25 gaps,
zero complete. No aggregate trust pass or automatic requirement closure claimed.

## Identified targeting assertion records — 2026-10-01

Migrated seven independent assertions in each of seed/repair/intentional-block
modes to required identified checks: pixels, input provenance, selected entity,
selection count, delivery generation, delivery target and selection intent. Each
links to an existing action. The recorder keeps pending async assertions non-pass,
preserves bounded error operands and original thrown identity, and retains the
first failed check even if later work fails. Duplicate/invalid IDs and capacity
exhaustion reject before the assertion executes.

The evidence reader now offers `--check CHECK_ID` bounded detail alongside action
and manifest views. Summary output links checks to actions and the first failure.
The recorder is included in the verifier fingerprint and normal harness tests.

23 focused Node tests and ESLint passed. Recorder import and check-detail tests
failed before implementation. Full native replay passed all seven actions with
21 required passing assertion records plus two optional coverage records, no page
errors and matching final verifier identity. CLI lookup of `repair.selected-entity`
returned the exact action-linked record. Evidence:
`packages/core/test/out/agent-watchdog/recorded-checks-2026-10-01-1/report.json`.
Node 24.15.0 / pnpm 11.21.0 / Chromium. Other assertions/producers remain unmigrated;
counts remain 348 partial, 25 gaps, zero complete. No aggregate gate claimed.

## Identified visualization numeric and aggregation checks — 2026-10-01

Migrated every numerical tolerance assertion and both weighted-aggregation pipeline
comparisons in the native visualization replay to identified required checks.
IDs distinguish actions, series, duplicate-policy x positions, nearest-query x/y
samples and pixel-distance cutoffs. Existing independent oracles and tolerances
are unchanged. Initial interpolation observations are now retained before the
assertions, so failure cannot omit the data being checked. Verifier identity now
includes the recorder for visualization runs as well as targeting.

26 focused Node tests and ESLint passed. Full native watchdog replays at pixel
densities 1 and 2 each passed all 11 actions with 74 required passing checks and
matching final verifier identity. Direct CLI lookup of
`weighted-data.aggregate-interpolation` returned its action-linked record.
Evidence directories: `packages/core/test/out/agent-watchdog/viz-recorded-checks-d1-2026-10-01-1`
and `packages/core/test/out/agent-watchdog/viz-recorded-checks-d2-2026-10-01-1`.
Environment: Node 24.15.0 / pnpm 11.21.0 / Chromium. Structural/setup assertions
and other producers remain to migrate; counts stay 348 partial, 25 gaps and zero
complete. No aggregate trust gate claimed.

## Independent required-check manifests — 2026-10-01

Both native replays now declare immutable expected check/action identities before
execution. Finalization rejects missing IDs, substituted actions, required checks
relabeled optional and unexpected required records even if the recorded subset
passed. Manifests are not reconstructed from completed checks. Existing action
completion and observation-error checks remain independent gates. Reader summaries
expose declared versus recorded counts; manifest detail includes the declaration,
and comparisons reject contradictory pass claims or differing manifests.

31 focused Node tests passed after failing completion, manifest, comparison and
reader regressions. A missing-run-manifest edge case was also corrected with a
failing regression before the fix. Focused ESLint passed. Native replays passed
all seven targeting actions with 21/21 required checks and all eleven visualization
actions with 74/74 required checks, with matching final verifier identities.
Evidence: `packages/core/test/out/agent-watchdog/required-checks-targeting-2026-10-01-1`
and `packages/core/test/out/agent-watchdog/required-checks-viz-2026-10-01-1`.
Node 24.15.0 / pnpm 11.21.0 / Chromium. Manifests cover migrated assertions only;
counts remain 348 partial, 25 gaps, zero complete. No aggregate trust gate claimed.

## Aggregation conservation and original/displayed evidence — 2026-10-01

Extended the existing weighted-mean application fixture with explicit intended
aggregation policy, included/displayed counts, weight and weighted-value totals,
value ranges and per-group reconstruction. The policy names preserved quantities,
states that extrema are not preserved and scopes absent gaps to this fixed input.
No new public transform or decimator was introduced.

Independent expected arithmetic demonstrates an important negative case: broken
unweighted means reconstruct 80/80 instead of 40/120, while both grand totals remain 160. Per-group checks expose the error that a grand-total-only check would miss.
The repaired means reconstruct 40/120. The existing identified aggregation-pipeline
check now verifies these facts along with the independent chart/hover oracle.

Two assertions failed before implementation. Eight tests in the agent visualization
and hover suites passed, plus typecheck and focused ESLint. Full native replays at
pixel densities 1 and 2 passed all eleven actions and 74 required checks each;
saved reconstruction evidence was inspected. Reports live under
`packages/core/test/out/agent-watchdog/aggregation-invariants-d1-2026-10-01-1`
and `packages/core/test/out/agent-watchdog/aggregation-invariants-d2-2026-10-01-1`.
Node 24.15.0 / pnpm 11.21.0 / Chromium. Manual inspection:
`http://127.0.0.1:5196/#/testing/viz-hover-lab`, weighted-data-bug then weighted-data,
inspect `state.pipeline.aggregation`.

DAT-11 is partial: other aggregation/decimation and gap/streaming policies remain
application-specific obligations. Counts are 349 partial, 24 gaps and zero complete.
No aggregate trust pass claimed.

## Controlled asynchronous chart data — 2026-10-01

The hover lab now exposes older/newer request controls backed by promises, with
latest-request-wins policy, bounded pending transport slots, loading/error/retry
state and completion disposition. Request identity is separate from chart data
generation. Stale success/error cannot overwrite current request state or data;
current failure retains the chart, retry clears error, and reset cancels pending
work without reusing request IDs. No public Pibbl networking API was introduced.

A failing missing-action regression preceded implementation. All eight focused
browser tests and ESLint passed. The browser run used a temporary configuration
importing the normal config and removing only the documentation plugin, because
unrelated texture compiler errors blocked startup. Workspace typecheck subsequently
failed on missing `tooling/texture-wasm-spike/runtime.mjs`. Scenario index regeneration
was also blocked by an unrelated material-lab inline-props validation error.
Requirement accounting passed all eight tests and validated all 373 IDs.
No aggregate gate claim.
APP-11 is partial pending disposal-race hardening and retained replay evidence;
counts are 350 partial, 23 gaps, zero complete.

Hands-on: `http://127.0.0.1:5196/#/testing/viz-hover-lab` (server responded HTTP 200).
Select Interpolate, start older then newer requests, complete newer then older;
inspect Async data request and hover the chart. Fail a newer request, then start
newer/retry and complete it to inspect retained chart data and recovery.

## APP-11 reviewed closure — 2026-10-01

Closed the full APP-11 requirement against the supported asynchronous application
workflow. Native replay now retains ten additional request transitions with forty
independent required checks: loading, newer success, ignored stale success, ignored
stale error, current failure with retained chart data, retry and successful recovery.
The full replay passes 21 actions and 114 required checks. Cancellation tests cover
queued responses overtaken by reset and replacement, both success/error at disposal,
no publication after disposal, stable historical snapshots and remount isolation.
A failing disposal-observation regression exposed stale pending/loading evidence;
inspection now reports disposed with zero pending requests.

Normal-config Chromium passed all ten browser tests; four Node checks, typecheck
and focused lint also passed. Earlier texture startup/typecheck blockers cleared.
Catalog regeneration remains blocked by unrelated material-lab inline-props rules.
The first native attempt failed on missing numeric assertion metadata; its evidence
remains at async-data-2026-10-01-1. Corrected replay -2 passed. Durable browser and
replay results are under `docs/strategy/agent-verification-evidence/`; the ledger
binds exact inventory wording, acceptance criteria, commands and source/artifact
fingerprints. Closure is for this application-data contract, not generic network
interception or every possible application policy. No aggregate trust pass claimed.

Current accounting: 349 partial, 23 gaps, 1 reviewed complete. The full objective
remains active. Future changes to fingerprinted evidence require closure review.

## Snapshot-consistent saved evidence pagination — 2026-10-01

Added action/check summary pages with content-bound continuation cursors, fixed
page sizes, explicit remaining counts, field truncation and end-of-collection.
Changed file bytes expire the cursor; malformed or mismatched cursors fail without
silently restarting. Checkpoints identify incomplete prefix history. Final reports
do not assert completeness of application history merely because enumeration ends.
No retained server state, application execution or live-scene expansion is added.

Two new tests failed before implementation; all 22 focused reader/comparison/tool
identity tests and lint passed. The actual CLI enumerated the persisted APP-11
replay's 114 checks across eight pages, with all IDs unique and no omissions.
QRY-04 remains partial because live scene/nested observation expansion is not
implemented. Current counts: 350 partial, 22 gaps, 1 reviewed complete.

## Bounded committed-scene pagination — 2026-10-01

The source targeting inspector now pages one immutable expansion, up to 256 records
and 512 clip references at existing depth 16, returned in 32-record pages. Ordinary
snapshots retain their 64-record budget. The inspector retains copied observations
only. New expansion, disposal and generation changes revoke continuations. Pending
updates, including a nested Layer beyond the initial snapshot window, expire the
cursor before it can mix generations. Final pages preserve explicit truncation and
unknown total when the scene exceeds capture budgets; retained-prefix exhaustion
is not whole-scene completion or application-history coverage.

Two failing tests preceded implementation. Nineteen browser tests passed across
pagination and existing observation; an additional nested Layer regression then
passed with all three pagination tests. Typecheck and focused lint passed. The new
suite is included in test:agent-verification. QRY-04 remains partial pending broader
cursor adversarial checks and retained/manual workflow integration. Counts remain
350 partial, 22 gaps, one reviewed complete. No aggregate gate claim.

## Shared manual/native scene pagination workflow — 2026-10-01

The targeting lab now supplies 100 extra visible targets plus Start scene query
and Next scene page actions. The same actions run headlessly, publishing bounded
page evidence. Native replay independently expects 103 committed entries in four
pages, stable generation/render count, no dormant computed evaluation, and an
empty expired response after switching to Repair. It retains pages and expiration
under the scene-pagination action.

The new scenario regression failed before implementation; all sixteen browser
tests across the shared lab and pagination passed. Typecheck and lint passed.
Native scene-pagination-2026-10-01-1 passed eight actions with no page errors.
Studio URL: http://127.0.0.1:5196/#/testing/agent-targeting-verification.
Catalog regeneration is still blocked by unrelated material-lab inline-props
validation. QRY-04 remains partial pending adversarial cursor checks and final
review. Counts unchanged; no aggregate trust claim.

## QRY-04 reviewed closure — 2026-10-01

Reviewed complete wording against both scene and saved-record pagination. Added
adversarial checks for malformed/aliased/unsafe offsets, cross-inspector cursor
reuse, repeat reads, rejected-cursor noninterference and mount replacement. The
new test caught acceptance of a leading-zero scene cursor; exact canonical tokens
are now required. Existing update, nested Layer, replacement and disposal tests
cover expiration. Truncated capture remains explicit and saved checkpoints report
prefix history; ending a page sequence never implies complete application history.

Normal-config browser evidence reports 34 passing tests; the saved reader reports
13 passing Node tests. Typecheck and lint passed. Final native replay passed eight
actions with four scene pages and an empty expired response after Repair. Durable
artifacts under docs/strategy/agent-verification-evidence bind source fingerprints
and exact acceptance criteria in the ledger. QRY-04 is reviewed complete; this does
not promise unbounded traversal or historical scene retention. Counts are now
349 partial, 22 gaps, two reviewed complete. The full objective remains active;
no aggregate trust pass is claimed.

## Explicit runtime and realm identity — 2026-10-01

Added a source-only capture/comparison helper for cooperating participants. It
compares live runtime, scheduler and realm references, separately reporting declared
core version agreement. Same-realm duplicate runtimes are distinguished from
legitimate independent iframe realms. Unknown/serialized/accessor bindings produce
unavailable evidence; inconsistent references never become a coherent identity.
The comparison invokes no runtime or scheduler functions and returns no live
references. Captured bindings themselves retain their realm and must be discarded.

Two Node tests failed before implementation and passed after it. They bundle Pibbl's
actual runtime/scheduler graph, load two copies in one VM realm, then another copy
in a separate realm. A real Chromium iframe test passed and confirmed no change to
the inspecting scheduler. Initial helper typecheck and final focused lint passed.
Final workspace typecheck was blocked by concurrent electric-paint tests using
unknown termination/crackle configuration keys. ENV-03 is partial pending
application/inspector handshake and official peer compatibility policy, with no
claim of global runtime discovery. Counts: 350 partial, 21 gaps, two complete.

## Runtime-checked targeting entry — 2026-10-01

Added createRuntimeCheckedInspector as an opt-in source verification entry. It
compares the application-supplied runtime binding before creating an inspector.
Duplicate, foreign-realm, inconsistent, unknown or declared-version mismatches
return a serializable refusal with a repair direction and no inspector. Matching
identity allows ordinary targeting; mount readiness remains a separate snapshot
state. The function retains no supplied application binding.

A missing-module browser regression preceded implementation. Two browser tests
passed, covering a public Canvas mount and a real iframe; two bundled-runtime
Node tests verify same-realm duplicate refusal. Both accepted and refused paths
leave the scheduler unchanged. Focused lint and workspace typecheck passed.
ENV-03 stays partial pending existing-lab migration and official peer compatibility.
Counts remain 350 partial, 21 gaps, two complete; no aggregate gate claim.

## Official core peer requirement audit — 2026-10-01

Added a runnable bounded manifest audit and integrated it into the identity gate.
It checks each official peer's declared core requirement against the repository
core version, preserving all six manifest hashes. Current exact pins all match
0.0.1. Unsupported ranges remain unavailable; unrelated package-version differences
are not mistaken for peer incompatibility. The CLI exits nonzero for mismatched or
unavailable evidence, with structured per-package details.

The initial import regression failed before implementation. All nine identity/peer
tests passed, including a real CLI negative fixture; focused lint passed. The first
sandboxed run could not bind existing native-test servers; the permitted rerun
passed. ENV-03 remains partial for lab handshake migration, resolved installations
and other peer dependencies. Counts unchanged; no aggregate trust claim.

## Checked runtime identity in the shared lab — 2026-10-01

Migrated the targeting lab factory to the checked runtime entry and bound the
application's actual imported pibbl function. The serialized Runtime compatibility
state includes acceptance/refusal and its diagnostic. Signal inspection starts
only after the targeting binding is accepted; inspection re-enable runs the check
again. Source fingerprints now include both runtime helper files and core manifest.
Native replay retains and asserts the accepted matching-runtime/version diagnosis.

The shared-lab assertion failed before implementation. All 36 browser tests across
runtime identity, shared targeting, pagination and observation passed. Typecheck
and focused lint passed. Native runtime-handshake-2026-10-01-1 passed eight actions.
QRY-04's full browser/native evidence was re-reviewed after changing its lab/replay
files; fresh durable artifacts and source hashes preserve that closure. ENV-03
remains partial for resolved consumer installations and other peer dependencies.
Counts unchanged; no aggregate trust claim.

## Resolved consumer peer audit — 2026-10-01

Added bounded Node require/default resolution from explicit consumer manifests and
standard semver validation, retaining real paths and manifest hashes. All six peers
of the five official consumers resolve compatibly, including Three.js 0.186.0;
all share one physical core installation. Physical copies are distinguished from
actual loaded runtime copies. Missing, optional-missing, unsupported and incompatible
outcomes remain separate. Fixture modules throw if executed; audit only resolves
and reads them. A failing edge test exposed broken optional exports being mistaken
for absent peers; bounded lookup now refuses that false pass.

Five new tests and all fourteen integrated identity tests passed; lint passed.
The first integrated run exposed a stale controlled identity fixture missing the
new handshake precondition. Updating that fixture restored its intended
unsupported-build assertion; the full identity rerun passed.
Actual receipt saved as env-03-installed-peers.json. semver 7.8.5 was added directly
from the existing offline store with scripts disabled (three lockfile lines).
ENV-03 remains partial pending combined evidence review. Browser/custom-loader
resolution is outside the explicitly scoped Node receipt. Counts unchanged; no
aggregate trust claim.

## ENV-03 reviewed closure — 2026-10-01

Reviewed the full environment-identity requirement against real bundled duplicate
runtimes, a real iframe, checked public Canvas inspection, declared requirements,
and resolved installed peers. Version compatibility, physical installations and
loaded runtime identity remain distinct observations. Unknown or incoherent binding
and dependency evidence never becomes a compatible/empty-scene pass. Explicit
cooperating source runtimes and Node require/default consumer resolution are the
supported surfaces; no global discovery or unobserved custom-loader/worker claims.

Fresh retained evidence: sixteen Node tests, two browser tests, declared and
installed peer receipts, and a passing eight-action native replay. Typecheck passed.
The first live replay on 5196 correctly blocked stale served identity before actions.
Ownership of that listener could not be confirmed, so it was left running. A new
owned Studio server on http://127.0.0.1:5199/ (session 73966) supplied the matching
source replay. Both passed and blocked artifacts are retained under the strategy
evidence directory. ENV-03 is reviewed complete with exact requirement binding and
fingerprinted evidence. Counts: 349 partial, 21 gaps, three complete. Full objective
remains active; no aggregate trust pass claimed.

## Redacted text calls — 2026-10-01

Added bounded opt-in single-context native text recording. Private content stays
redacted; exact allowlisted fixture strings can support assertions. No repeated
materialization, measurement, pixel reads or scheduling are introduced. An
observation-error regression failed before repair; failed observation now reports
incompleteness without breaking drawing or retaining private error messages.

Four focused Chromium tests passed on Node 24.15.0 / pnpm 11.21.0, including
public Pibbl Text, history bounds, method restoration and native string conversion.
Typecheck and focused lint passed before the final conversion-only test addition.
TXT-08 advances to partial, not complete: shared manual/native workflow integration
and retained replay evidence remain. No glyph visibility, font attribution or
coverage of other Canvas contexts is claimed. Counts: 350 partial, 20 gaps, three
reviewed complete. No aggregate trust pass.

## Shared text assertion laboratory — 2026-10-01

Added the source-only agent-text-verification catalog lab with seeded wrong text,
repair, independent expected label and a redacted serialized evidence panel.
Manual Studio actions and the headless browser test mount the same public Pibbl
application. Production/built mode reports unavailable inspection. Each action
owns a fresh bounded recorder and stops it after the expected drawing calls.

The missing-scenario test failed before implementation. Five focused Chromium
text tests passed; focused lint passed after correcting a constant-loop warning.
Full typecheck is blocked by unrelated textures/type-tests/public.tsx errors
(attract command and misplaced ts-expect-error). Catalog discovery passes but
catalog validation stops on the pre-existing material-lab inline-style rule.
No aggregate validation claim. The owned Studio process 73966 is live on 5199
and observed the catalog reload. Feedback URL:
http://127.0.0.1:5199/#/testing/agent-text-verification

Choose Repair label: assertion should change fail to pass while private text
remains redacted in machine evidence. Native replay retention and lifecycle
hardening remain before TXT-08 closure. Counts stay 350 partial, 20 gaps, three
reviewed complete.

## TXT-08 reviewed closure — 2026-10-01

Closed the explicit fixture-text assertion/redaction requirement after shared
workflow and native evidence review. New failing tests exposed overlapping actions
sharing a capture and disposal leaving historical evidence looking current. The
lab now reserves each action, exposes pending state immediately, refuses overlap,
waits for the admitted action, cancels timers on disposal and clears current
observations. Public remount succeeds with restored method ownership.

Maximum escaped fixture strings remain below the 512 KiB recorder payload bound.
Native replay validates the complete fixture envelope before retaining state;
private unexpected fields and stale source identity fail controlled negative tests
without leaking into any report/checkpoint. No screenshots are taken by this
text-specific replay. The source identity plugin now binds the text lab; its
existing targeting/viz identity tests still pass.

Retained evidence: nine Chromium tests, fifteen Node tests and a three-step native
Studio replay with twelve declared passing checks. Full typecheck and focused
lint passed; earlier concurrent texture type errors have cleared. Catalog's
material-lab failure remains the last observed catalog result. No full trust pass
is claimed. Exact requirement text, acceptance checks and file hashes are in the
ledger. Counts: 349 partial, 20 gaps, four reviewed complete. The full 373-item
objective remains active; text metrics/fonts/visibility remain separate work.

## Signal mutation diagnostic slice — 2026-10-01

Added the shared agent-signal-mutation laboratory. An intentional equal no-op
passes; mutating the existing amount object from 10 to 42 and setting the same
reference leaves signal revision and component evaluation count unchanged. The
independent application expectation fails against the stale evaluated amount.
Replacing the object publishes a revision and evaluates 42. The browser test also
checks an independent bar pixel: transparent before repair and opaque blue after.
Evaluation evidence is explicitly named, not mislabeled as completed pixel paint.

No-redraw observations cover two host animation frames with a five-second timeout;
this is a finite window, not a future-event guarantee. Source-only signal revision
inspection returns unavailable in built mode. This is an explicit known mutation
sequence under actual default Object.is, not a deep mutation detector.

The missing-scenario test failed before implementation. The new public workflow
and nine text regressions passed (ten Chromium tests total). Typecheck and focused
lint passed. The shared catalog change was also verified through twelve native
text checks, and TXT-08 closure artifacts/hashes were refreshed after review.
SIG-14 stays partial pending native replay, lifecycle/repeat/reset hardening and
closure review. Counts remain 349 partial, 20 gaps, four reviewed complete.

Slice ready for feedback at:
http://127.0.0.1:5199/#/testing/agent-signal-mutation
Choose Equal no-op, Mutate in place, then Replace object; inspect the bar, source
amount, evaluated amount, signal revision and diagnosis together.

## SIG-14 reviewed closure — 2026-10-01

Closed the default-equality mutation diagnostic after full wording review. A new
failing repeat test exposed an incomplete diagnosis: subsequent equal writes now
say that they retain a stale display, rather than describing another mutation.
Reset, overlapping actions, active cancellation and remount are covered. A setup
failure test exposed asynchronous failure after mounting without a 2D context;
the fixture now preflights that capability before scheduling and owns cleanup.

The first native replay failed an independent pixel check because the verifier
omitted Studio's 30-pixel contain padding. Direct samples confirmed the blue bar
at the correctly translated position. The fixture now declares its 480x180
contain viewport explicitly; verifier math includes offsets and records logical,
display and backing coordinates. A second aspect-ratio regression protects this.
The initial failure remains in sig-14-initial-pixel-failure.json.

Final evidence: fourteen Chromium tests (five signal cases plus nine text
regressions), sixteen Node tests, and thirty required native signal checks across
six actions. Typecheck and focused lint pass. Twelve native text checks also pass;
TXT-08's shared plugin/manifest closure fingerprints were re-reviewed and refreshed.
SIG-14 is reviewed complete with exact requirement binding and durable evidence.
Counts: 348 partial, 20 gaps, five reviewed complete. No aggregate trust pass;
the full 373-item objective remains active.

## Shared saved-evidence retrieval — 2026-10-01

The shared reader previously rejected the completed text and signal-mutation
report schemas. It now reads all four replay v1 kinds and checkpoints, identifies
the source schema and preserves redacted failure reasons/stages. Added bounded
JSON-pointer field projection so an oversized action can still yield a selected
amount, diagnosis or nested record without dumping its other data. Missing/null,
negative zero, nonfinite parsed numbers, truncated strings and container summaries
remain distinct. Selector failures carry machine codes; unsupported future schemas
are rejected. Inputs remain capped at 4 MiB and projections at 64 KiB.

New failing tests established schema rejection, ignored projections, missing error
codes and lost redacted failure reasons before implementation. Thirty-one Node
tests now pass (twenty reader, seven comparator, four discovery), including real
CLI retrieval from the retained signal replay, pointer escaping, own-property
lookup, invalid selectors and worst-case escaped output bounds. Focused lint passes.
Actual bounded CLI output is saved as evidence-projection-cli.json. Discovery now
maps TXT-08 and SIG-14 to their shared applications, independent expectations and
runnable recipes. It still makes no claim that a discovered recipe has passed.

QRY-04 reader changes were re-reviewed against the unchanged snapshot pagination
and expiration tests; its closure fingerprints and retained Node evidence were
refreshed. Live scene projection, broader adapters and schema migration remain
open. Counts remain 348 partial, 20 gaps, five complete. No full trust pass.

## Zero, missing and invalid visualization values — 2026-10-01

Added Zero, missing and invalid values to the existing hover laboratory. Its ten
fixed rows contain five finite values including zero, null and undefined as two
missing observations, and NaN/+Infinity/-Infinity as three invalid observations.
The declared policy retains zero and breaks both line segments and interpolation
at missing or invalid rows. Serialized evidence uses explicit category tags rather
than allowing JSON to collapse invalid values into null. Metadata is bound to the
data generation and disappears when another dataset replaces it.

Following the data-visualization testing skill, the slice first checks analytical
semantics and native hover results, then two targeted raster regions: the segment
through zero must exist; a bridge across invalid rows must not. Both 1000-pixel
and 375-pixel plot widths pass. The wide test initially attempted native input
outside the test runner's default 800-pixel viewport; it now explicitly provisions
and restores a viewport containing every target. No application bug was inferred
from that harness failure.

Twenty-six focused Chromium tests passed, along with typecheck and focused lint.
Existing native visualization (114 checks), text replay (12 checks) and signal mutation
(30 checks) replays passed after the shared lab/catalog edits. Their existing
closures were re-reviewed and refreshed with retained evidence. DAT-07 remains
partial pending native new-mode replay, tooltip text evidence and final review.
Counts remain 348 partial, 20 gaps, five complete; no aggregate trust pass.

Slice ready for feedback: http://127.0.0.1:5199/#/testing/viz-hover-lab
Choose Zero, missing and invalid values. Inspect the zero value at x=1, the break
from x=2 to x=8, and the Missing-value policy evidence; interpolation at x=9 is 25.

## Mixed-validity tooltip text evidence — 2026-10-01

The existing wide/narrow visualization workflows now observe successful native
Canvas text calls through the bounded, redacted text recorder. Zero emits the
exact fixture label `0.00 ppm · recorded`; each of seven missing/invalid gap
positions removes that label; post-gap interpolation emits
`25.00 ppm · estimated`. A fresh recorder per hover prevents old text from
satisfying later assertions. Gap observations must be nonempty, untruncated and
free of observation failures, preventing absent instrumentation from passing.
This is emitted-text evidence, not a claim of unobscured glyph visibility.

Both focused Chromium tests passed under Node 24.15.0 and pnpm 11.21.0;
retained output is `agent-verification-evidence/missingness-tooltip-browser.json`.
No production behavior changed. DAT-07 remains partial pending native Studio
new-mode replay and complete wording review. Counts remain 348 partial, 20 gaps
and five reviewed complete; the full objective remains active.

## DAT-07 reviewed closure — 2026-10-01

The native Studio replay now includes the mixed-validity mode: 22 actions and
127 required checks pass. Thirteen new independently declared checks cover input
policy, counts/categories, generation, zero, seven gap positions and post-gap
interpolation. Fourteen Node tests verify check accounting and false-pass rejection;
focused lint passes. Existing asynchronous-data checks remain unchanged and pass,
so APP-11 replay fingerprints were re-reviewed with this retained regression.

An initial native failure exposed verifier precision: requested x=3 arrived as
2.999999385036209. The retained failure explains the explicit 1e-5 data-x and
1e-4 data-y tolerances. The wait now requires delivered pointer state so an
application-seeded inspection cannot satisfy native-input evidence. Exact zero
and tooltip emission remain independently checked in the two browser workflows.

Reviewed the full DAT-07 wording against tagged data, query semantics, line pixels,
tooltip draw calls and generation replacement. DAT-07 is complete for the declared
supported workflow; arbitrary business-policy inference and unobscured glyph
visibility are not claimed. Evidence is retained in dat-07-replay.json,
dat-07-manifest-node.txt and dat-07-pointer-precision-failure.json alongside the
prior tooltip browser report. Counts: 347 partial, 20 gaps, six reviewed complete.
The full 373-item objective remains active; no aggregate trust pass is claimed.

## Layout placement and clipping scenario — 2026-10-01

Started the next public workflow for LAY-02 and LAY-06. One Absolute child has
parent placement left=30/top=20 and a local 20x20 allocation. Nested translation
(40,30) and scale 2 compose to the observed entry matrix [2,0,0,2,100,70]. A
shape-local x=90 moves the shape outside the parent clip; root point (300,90)
is geometrically inside the shape but clip-excluded and transparent. Explicit
visible overflow makes the same point blue and targetable. Repairing local x to
zero moves its center to (120,90), inside the clip, with unchanged allocation.

The public scene was added after its missing-module test failed. The focused
Chromium test now passes all three modes, checking actual allocation, observed
transform, point conversion, clip result and independent pixel expectations.
Focused lint passes. Retained evidence: layout-placement-slice-browser.json.
The scene is not yet registered in Studio and has no machine-readable explanation;
this is implementation progress, not a slice-ready or requirement-complete claim.
Next: expose the same scene through a source-only diagnostic lab, report declared
placement separately from observed geometry, and exercise native repair input.
Counts remain 347 partial, 20 gaps and six reviewed complete.

## Layout diagnostic slice ready for feedback — 2026-10-01

Registered the shared layout scene in Studio with clipped, overflow-visible and
repaired modes. Machine evidence separates controlled application inputs from
observed allocation, entry transform, root center and active clip probe. The
application expects a targetable center: clipped mode fails that expectation;
explicit visible overflow and repaired local offset pass. Native click counts
confirm delivery. Explanations do not equate allocation with painted bounds or
geometry probes with pixel visibility. Built mode reports unavailable inspection.

Sixteen focused Chromium tests passed, including shared workflow clicks, the
independent three-mode pixel/geometry oracle and text/signal regressions.
Typecheck and focused lint passed. Existing native text and signal replays pass;
their catalog closure fingerprints were refreshed after review. A repeatable
layout-smoke.mjs run passed three native Studio modes and click counts. Its
provenance explicitly lacks build attestation; it is not the general replay
protocol. The first Studio attempt failed because the live server's eager source
glob did not contain the newly added file; restarting only the task-owned server
resolved it. Both failure and successful reports are retained.

Slice ready at http://127.0.0.1:5199/#/testing/agent-layout-placement . Choose
Allow overflow, then Repair local offset; click the blue shape and compare the
unchanged allocation with the changing root center and clip evidence.

Feature completion still needs lifecycle/failure hardening and full wording review.
Scenario-index generation remains blocked by the pre-existing material-lab inline
props/spread validation error. No aggregate trust pass is claimed. Counts remain
347 partial, 20 gaps and six complete. Task-owned Studio session is now 93511.

## Layout workflow lifecycle hardening — 2026-10-01

A focused failing test found stale allocation in pending layout evidence: an
in-flight action combined new declared inputs with the prior allocation. Pending,
failed and disposed states now clear allocation and observed geometry; disposal
also reports a disposed diagnosis. Historical returned snapshots retain their
original allocation. Tests reject competing actions and unknown actions, cancel
an installed frame wait, check idempotent disposal and future-action refusal,
and verify clean remount/reset. A controlled publication callback failure clears
current evidence and permits successful recovery with a subsequent action.

Four focused Chromium tests pass, including the independent pixel/geometry case
and native workflow clicks. Typecheck and focused lint passed for the lifecycle
fix. Results are retained in layout-lifecycle-complete-browser.json. No additional
requirement is closed; counts remain 347 partial, 20 gaps and six complete.

## Discoverable layout and mixed-value workflows — 2026-10-01

Discovery now maps LAY-02/LAY-06 to the shared layout workflow and DAT-07 to the
mixed-value chart workflow. Recipes carry prerequisites, explicit initial state,
actions, independent expected values, browser/native commands and observation
limits. The layout recipe explicitly names its unattested smoke schema and lack
of shared-reader support, preventing agents from treating it as the general replay
protocol. Mixed-value retrieval names supported scalar projection paths.

The new discovery test failed on unmapped requirements before implementation;
all five discovery tests now pass and focused lint passes. Actual LAY-02 CLI
output is retained in layout-discovery.json. A real DAT-07 saved-report projection
was exercised successfully. These changes improve workflow reachability and do
not themselves certify any requirement. Counts remain 347 partial, 20 gaps and
six reviewed complete.

## LAY-02 reviewed closure — 2026-10-01

Reviewed the complete parent-placement versus primitive-local-coordinate wording.
The shared public scene, machine-readable explanation and independent tests cover
left/top, local x/y, local allocation, nested scale/translation, converted root
coordinates and resulting clipped/visible/repaired interaction. Browser evidence
also checks pixels independently of geometry probes. Four focused browser tests
cover normal behavior, cancellation/overlap/remount and publication failure.
A fresh native Studio run after lifecycle fixes passes all three modes and click
counts; output is retained in layout-lifecycle-native.json.

LAY-02 is reviewed complete with exact requirement binding and fingerprinted
source/evidence. This is not a closure of style provenance, all layout algorithms,
broad overlap diagnosis, or served-build attestation. LAY-06 remains partial.
Counts: 346 partial, 20 gaps and seven reviewed complete. No aggregate trust pass;
the complete 373-item objective remains active.

## Explicit box facts and application expectations — 2026-10-01

Added source-tooling analyzeBoxRelations for at most three declared axis-aligned
boxes in a caller-named common space. It reports overflow on each edge,
containment, and positive overlap/touching/disjoint/degenerate relationships.
Containment and separation pass/fail judgments require explicit application
expectations; otherwise assertions are not-requested. Missing peer geometry makes
a requested separation assertion unavailable. Invalid/nonfinite/unrepresentable
geometry and unsupported policies are rejected. Results are detached and frozen.
No transforms, clipping, painted visibility or application intent are inferred.

Four Node tests pass after a missing-module failure established the new contract.
A focused Chromium test relates live public useLayoutBox allocation and declared
shape offsets in the existing clipped, intentionally overflowing and repaired
modes. All three agree with observed targeting while allowed overflow remains
unjudged. Typecheck and focused lint pass. Evidence: layout-relations-browser.json
and layout-relations-node.txt. Studio presentation and a public overlap workflow
remain before complete LAY-06 review. Counts remain 346 partial, 20 gaps and seven
complete; no new completion claim.

## Native overlap policy slice — 2026-10-01

The existing Studio layout lab now exposes box relations and two overlap modes.
Both draw the same blue rectangle and later orange peer, with local overlap area 200. Allow overlap reports no separation assertion; Require separation reports a
failed explicit expectation. Their pixels and click routing stay identical:
root (130,90) is orange and delivers to the peer; (110,90) is blue and delivers
to the primary shape. The helper's declared common-space scope remains explicit.
Pending/error/disposal clear relation evidence alongside geometry and allocation.

The new workflow test first failed on its unsupported action. Twenty focused
Chromium tests now pass, including placement/lifecycle and text/signal regression.
Typecheck and focused lint pass. The extended native layout smoke passes all five
modes; fresh native text and signal replays also pass after the catalog change.
Affected completed-requirement fingerprints were re-reviewed and refreshed with
retained evidence. LAY-06 remains partial pending lifecycle coverage of the new
relation fields and full wording review. Counts remain 346 partial, 20 gaps and
seven complete. No aggregate trust pass.

Ready for feedback: http://127.0.0.1:5199/#/testing/agent-layout-placement . Compare
Allow overlap with Require separation: geometry remains identical while the
explicit application assertion changes.

## LAY-06 reviewed closure — 2026-10-01

Seven focused Chromium tests now pass, including new overlap lifecycle coverage.
Switching from prohibited to allowed overlap immediately withdraws old relations;
a controlled publication failure also clears serialized evidence. Recovery restores
the correct policy, repair removes the peer relationship, and disposal removes
current facts while previously returned snapshots preserve historical overlap.
Focused lint passes. Results are retained in layout-overlap-lifecycle-browser.json.

Reviewed the entire LAY-06 wording against allocation-relative overflow, declared
box overlap, independent pixels and native topmost delivery. The same geometry
is benign under an allowed-overlap policy and fails an explicit separation
expectation. Boundary touching/degeneracy and invalid arithmetic are separately
tested. LAY-06 is complete for this explicit axis-aligned common-space capability;
general path bounds, arbitrary transforms and painted visibility inference remain
outside its stated scope. Existing five-mode native evidence remains applicable
because this turn added tests without changing production code.

Counts: 345 partial, 20 gaps and eight reviewed complete. The full 373-item
objective remains active, and no aggregate trust pass is claimed.

## Catalog validation unblocked — 2026-10-01

Reproduced the existing Material Lab JSX spread rejection, then replaced its
MaterialSwatches spread with the same explicit kind, seed, scale, detail and
palette props. No state or rendering behavior changed. The repository catalog
now validates all 70 lessons, 12 tutorial snapshots and 31 test labs, and the
scenario index was regenerated through the supported generator. Source discovery,
typecheck and focused lint pass. Retained output: catalog-unblocked.txt.

A fresh docs:check now reports four unclassified documents from parallel texture
work: docs/design/weighted-electric-sources-contract.md,
docs/site/api/types/electric-textures.md, docs/site/api/types/texture-resources.md
and tooling/texture-wasm-spike/README.md. This is the currently observed static
integration blocker; the older Material Lab blocker is resolved. No full trust
pass is claimed. Requirement counts remain 345 partial, 20 gaps and eight complete.

## Documentation classification and provenance checkpoint — 2026-10-01

Classified the electric/texture-resource API pages as current public documentation,
the weighted-electric implementation contract as current normative documentation,
and the isolated WASM experiment README as operational documentation. The new
contract did not exist at the dated preservation commit; it is now correctly
listed as post-baseline rather than falsely read from that historical snapshot.

The documentation gate progressed past classification and exposed two vocabulary
collisions. Renamed the path-warp example's local label helper to labelText and
clarified progress prose so neither resembles a removed lowercase drawing API.
No rendering behavior or vocabulary validation rule changed. Typecheck, focused
lint and the complete 70-lesson/12-tutorial/31-lab catalog check pass.

The next real docs:check failure is the missing weighted-electric contract entry
in the reviewed post-baseline preservation manifest. No approval, semantic mapping
or historical provenance was fabricated to bypass it. Retained failure:
docs-contract-inventory-blocker.txt. Completing that mapping requires review of
the texture contract and its supporting implementation/evidence. The verification
work remains active with 345 partial, 20 gaps and eight complete requirements;
no full documentation or aggregate trust pass is claimed.

## Shared retrieval for layout smoke evidence — 2026-10-01

The bounded saved-evidence reader now accepts pibbl-layout-studio-smoke/1. It uses
the schema's action field for action selection, summaries and content-bound
pagination without modifying raw action details. All views explicitly report
attestation not provided by the schema. Unrecorded action statuses remain null;
manifest/check fields and checkpoint wrappers are rejected for this smoke format.
Errors retain a bounded summary. Unknown schema versions still reject.

The new test failed on unsupported schema before implementation. Thirty-three
reader/comparator/discovery tests now pass, including existing snapshot cursor
expiry. Actual CLI projection of the retained overlap report returns the failed
separation assertion, area 200 and delivered peer while retaining the provenance
limit; output is layout-reader-cli.json. Focused lint passes. QRY-04 affected
reader fingerprints were re-reviewed/refreshed against retained Node evidence.
Discovery and tooling guidance now expose the supported layout query. No broader
attestation, replay comparison compatibility or new requirement closure is claimed.
Counts remain 345 partial, 20 gaps and eight complete.

## Controlled late-font arrival and responsive update — 2026-10-01

Started TXT-06 with a public Text/useLayoutBox/signal scene. The test begins with
a nonempty fallback-font render, then loads an unmodified local Space Grotesk
font under a test family name. Actual measured width changes after readiness,
but scheduler requests, evaluation count and existing pixels do not change during
two host frames. An explicit application signal update schedules a repaint and
changes the pixels. Resizing the responsive Canvas from 400 to 200 pixels then
requests rendering and changes the declared text size from 24px to 16px.

The local asset comes from the already installed @fontsource-variable/space-grotesk
5.3.0 package; its SIL OFL license and source/hash record accompany the unmodified
font. No system-font availability or external service is required. The first
missing-scene test failed; the implemented workflow and nonempty-render guard pass
in Chromium. Typecheck and focused lint pass. Fresh browser evidence is retained
in late-font-verified-browser.json. Font readiness is not claimed to automatically
invalidate Pibbl, and the no-redraw observation is explicitly finite.

TXT-06 advances from gap to partial. Shared Studio controls/evidence and font-load
failure/disposal hardening remain; this is not yet a feedback-ready lab. Counts:
346 partial, 19 gaps and eight reviewed complete. The full objective remains active.

## Shared late-font Studio slice — 2026-10-01

Registered the public late-font scene and controller in the testing catalog.
The missing-entry browser test failed before registration. Catalog generation
then exposed a browser-only asset import; a URL-relative font asset reference
works in both Node catalog validation and the browser. Catalog validation now
covers 70 lessons, 12 tutorial snapshots and 32 labs.

Native Studio testing caught premature ready evidence during responsive resize:
a requested render was still pending after two host frames. Resize actions now
wait for the expected allocation and completed root revision with a five-second
bound. Font-arrival observations retain their explicit two-host-frame scope.
All five native controls pass, with no page/console errors. The first stale-source
glob failure and resize failure are retained alongside successful evidence.
The task-owned server was restarted and is now session 36647 on port 5199.

Focused font browser checks, typecheck and lint pass. Catalog-affected text and
signal native replays pass; reviewed closure fingerprints were refreshed only
for the catalog, with new regression artifacts retained. The state panel displays
compact counters and machine evidence wraps within its own block.

Slice ready: http://127.0.0.1:5199/#/testing/agent-late-font . Choose Load font,
Repaint, then Narrow canvas to compare readiness with completed rendering.
Failure/disposal/repeated readiness and reset settling remain for hardening.
TXT-06 remains partial; counts remain 346 partial, 19 gaps, eight complete.
No aggregate trust pass is claimed.

## Late-font failure and disposal evidence — 2026-10-01

Added failure-first lifecycle checks through the shared catalog workflow. A
controlled FontFace.load rejection exposed missing provenance in the error
envelope. Error evidence now retains its source-development/no-build-attestation
label while clearing current samples. The recovery path loads the real local
font, repeated loading adds no duplicate font registration or component
evaluation, and narrow/reset restores the original width, fallback font and
font-set ownership in the tested sequence.

A second test holds font loading pending, rejects a competing repaint, disposes
twice, then resolves the old load. No font is installed, current evidence remains
disposed, DOM evidence is removed, old snapshots remain historical and future
commands/settling reject. The test also checks the exact original font set rather
than relying on garbage collection.

Four focused Chromium tests pass in late-font-lifecycle-browser.json under Node
24.15.0, pnpm 11.21.0 and Playwright Chromium. Typecheck and focused lint pass.
The requirements/discovery unit tests pass, but closure integrity currently fails
on changes outside this slice: ENV-03 packages/core/package.json and package.json,
LAY-02 packages/core/src/lib/layout/absolute.test.ts, and SIG-14
packages/core/src/lib/signals/graph.ts. Their fingerprints were not refreshed:
these changes require separate proportional verification and review. Eight remains
the recorded closure count, not eight currently integrity-verified closures.

Timeout/delayed reset, failure-publication/remount and discovery coverage remain;
TXT-06 is not closed by these narrower lifecycle tests. Counts remain 346 partial,
19 gaps and eight complete. The full objective remains active.

## Integrated requirement-to-evidence entry point — 2026-10-01

Added workflow.mjs plan/run to connect existing discovery, fixed native replay
runners, parent-owned browser watchdog and the bounded evidence reader. Plans
include source paths and independent acceptance criteria; final handoffs include
remaining scope, replay run/action/check IDs, artifact paths and an executable
next-query argument vector. Only four known replay implementations are allowed;
unmapped requirements and unsupported layout smoke return explicit errors.

Three focused Node tests pass after a missing-module failure. Real native runs
pass for HIT-12 targeting, DAT-07 visualization, SIG-14 signal mutation and TXT-08
text. Each confirms browser-process cleanup. The initial text integration exposed
a status-field mismatch between reader and wrapper; corrected code consumes
claimedStatus and requires final-report kind. That incomplete integration report
is retained alongside successful reruns. Focused lint passes. Evidence artifacts
use the integrated-* prefix. Node 24.15.0, pnpm 11.21.0, Chromium, source Studio
http://127.0.0.1:5199 were used.

This integrates existing workflows rather than adding another isolated lab.
A successful reference replay is explicitly not full requirement completion or
an arbitrary-application repair. AGT-01/02/06 remain partial; counts do not change.
Earlier unrelated closure-fingerprint drift has not been approved or erased.

## Integrated failure and interrupted-run handoffs — 2026-10-01

The integrated workflow now attempts the saved checkpoint when a final report
is absent, retaining the original read failure and explicitly partial evidence.
Malformed final reports are never hidden by fallback. Missing/unusable evidence
produces no invented next query. Recorded first failed checks and failed actions
produce targeted reader queries; otherwise bounded action pagination remains.
Truncated check identifiers are not used as exact selectors.

Two focused tests failed before implementation. All 26 workflow/reader tests now
pass, and focused lint passes. A native run against the deliberately unusable
Studio origin http://127.0.0.1:1 produces a failed navigation handoff with confirmed
browser-process cleanup. The text replay preserves its redaction policy, so the
handoff reports the recorded stage without inventing a network or application
root cause. Evidence uses workflow-failure-routing-node.txt and
workflow-navigation-failure-* artifacts. Node 24.15.0 and Chromium were used.

This advances integrated agent continuation and interruption handling; it does not
close broad AGT/HAR requirements. No aggregate trust or refreshed unrelated
closure approvals are claimed. The complete inventory remains the objective.

## Validated targeted handoff queries — 2026-10-01

A saved-report regression exposed a dangling first-failed-check ID in the proposed
handoff query. The same fixture places the failed action at index 39, beyond the
summary's first 32 actions. Handoffs now validate each proposed check/action query
through the bounded reader, select the actual failed action even beyond that
summary page, and preserve missing/ambiguous selection errors. Duplicate failed
action IDs fall back to pagination without claiming a unique match. Valid failed
check IDs still receive the most direct query. This is evidence navigation, not
a causal diagnosis or a closure claim.

The new test failed before implementation. All 26 workflow/reader tests pass,
with output in workflow-query-validation-node.txt; focused lint passes. Existing
reader budgets remain unchanged. AGT-02/06 remain partial and the full inventory
objective remains active.

## Delivery cutoff — user reprioritization, 2026-10-01

This section supersedes the earlier instruction to implement all 373 requirements
before stopping. The user requested prioritizing the top items, finishing those,
and stopping. The inventory remains a backlog, not this delivery's completion
criterion. Do not automatically resume deferred work after the cutoff.

Finish only the following three priorities, in order:

1. **One usable agent entry point.** Verify the existing workflow plan/run path
   exposes prerequisites, sources, expected behavior, saved evidence and a usable
   next query. Keep failures/partial runs explicit. The implementation exists;
   finish acceptance and concise usage guidance rather than adding a new facade,
   protocol, runner or general inspector API.
2. **Prove the four highest-value existing diagnosis/repair paths.** Targeting
   interception, incorrect visualization data, stale signal-driven rendering and
   layout/clipping. Review existing independent assertions; reuse existing native
   workflows (layout may retain its separate smoke command). Preserve seeded
   failure and repair evidence. Run each applicable workflow once on the final
   state; fix defects discovered in these paths. Do not add new labs or expand
   this milestone to every variant. Font/text work already delivered remains
   available but receives no new feature expansion.
3. **Final integration and honest handoff.** Run proportional tool checks and one
   aggregate trust attempt on the final state. Fix attributable regressions in
   this delivery. Record unrelated/concurrent failures as unresolved integration
   limits, without inventing approvals or endlessly chasing other work. Deliver
   exact commands, verified scope, known limitations and artifact paths. Verify
   that the documented next-query command works against saved evidence.

**Stop rule:** Stop implementation after these acceptance items have been
attempted and verified to the available scope, with any unresolved blockers
explicitly reported. Do not claim feature-complete or aggregate-green if the
checks do not support it. End the active delivery instead of continuing through
the inventory. New feature work requires a new user request.

Deferred: general paint-call attribution, full signal/scheduler causal tracing,
font/asset edge-case expansion, renderer-specific facets, accessibility/IME,
temporal screenshots, generalized benchmarks, new lab/schema families, broad
closure-count cleanup, and exhaustive completion of partial requirements.
These remain legitimate backlog items, not mandatory prerequisites for this
bounded delivery. Existing evidence-integrity drift remains visible and must not
be relabeled approved merely to improve the completion count.

## Final bounded delivery handoff — 2026-10-01

The user's three-priority finishing pass is complete to the verified scope below.
Implementation stops here. The exhaustive inventory is deferred, not completed.

| Priority path                             | Fresh result                                                         | Retained evidence                        |
| ----------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------- |
| Targeting interception and repair         | Pass: 8 actions, 23 checks                                           | final-targeting-report.json              |
| Visualization data correctness and repair | Pass: 22 actions, 127 checks                                         | final-viz-report.json                    |
| Stale signal mutation and replacement     | Pass: 6 actions, 30 checks                                           | final-signals-report.json                |
| Layout/clipping and overlap policy        | Pass: 5 native modes, independent placement and click assertions     | final-layout-native.json                 |
| Exact handoff queries                     | All three generated commands execute and return saved-evidence pages | final-handoff-queries.json               |
| Workflow, reader and discovery tests      | 31 pass                                                              | final-tools-node.txt                     |
| Focused workflow lint                     | Pass                                                                 | Terminal verification in this final pass |
| Aggregate trust                           | Failed at ENV-03 manifest fingerprint; later stages not reached      | final-trust-attempt.txt                  |

All retained files above are under docs/strategy/agent-verification-evidence/.
Native runs used Node 24.15.0, pnpm 11.21.0, Playwright Chromium and source Studio
http://127.0.0.1:5199. The three integrated runs confirm browser-process cleanup.
The existing layout smoke has weaker provenance and is not the integrated replay
schema. No arbitrary application support, full inventory closure or complete
build/browser/package matrix is implied by these passes.

Reproduction from a provisioned checkout with the source Studio running:

```sh
node tooling/agent-verification/workflow.mjs plan HIT-12 http://127.0.0.1:5199 /tmp/pibbl-targeting-final-new
node tooling/agent-verification/workflow.mjs run HIT-12 http://127.0.0.1:5199 /tmp/pibbl-targeting-final-new
node tooling/agent-verification/workflow.mjs run DAT-07 http://127.0.0.1:5199 /tmp/pibbl-viz-final-new
node tooling/agent-verification/workflow.mjs run SIG-14 http://127.0.0.1:5199 /tmp/pibbl-signals-final-new
node tooling/agent-verification/layout-smoke.mjs 'http://127.0.0.1:5199/#/testing/agent-layout-placement' /tmp/pibbl-layout-final-new.json
corepack pnpm@11.21.0 trust
```

Use new output names on repeat runs. Every integrated handoff includes a `next`
executable and argument array; these were executed successfully, not just printed.
For the retained targeting report, a direct equivalent query is:

```sh
node tooling/agent-verification/evidence-reader.mjs docs/strategy/agent-verification-evidence/final-targeting-report.json --page actions
```

The aggregate failure is real: packages/core/package.json now contains the
separate filter subpath and new build command, which differ from the ENV-03
reviewed fingerprint. Those changes were not made by this finishing pass, and
its approval was not refreshed to hide the mismatch. Other previously identified
closure drift likewise remains subject to its own review. This delivery does not
claim the whole mixed working tree is release-ready. No commits or pushes were
performed, and the user's other Studio servers were left alone.

## Follow-on slices, preserving the full objective

These tasks are not a substitute for the remaining requirements; they identify
likely next useful end-to-end applications of them.

- Extend Layer failure/pending-generation evidence; nested transforms, resize,
  sibling ordering and traversal budgets already have focused coverage.
- Layout/clip diagnosis for a missing or untargetable component, using independent
  expected geometry and a benign intentionally clipped case.
- Explain a hover-triggered expensive redraw using signal/surface evidence, then
  verify isolation without stale plot mappings or incorrect tooltip selection.
- Reuse existing physics observations/testing as the first optional domain facet;
  preserve authoritative versus presentation state and host-frame versus tick time.
- Extend visualization beyond the verified interpolation/data-change/gap/resize
  paths: duplicate inputs, selection identity and exact paint evidence; then
  broader application/DOM semantics and temporal failures.

All other inventory areas remain visible in the accounting table. Prioritization
changes order, not success criteria. No requirement is closed because it is hard,
because a narrow test passes, or because another requirement appears similar.

## Verification of this audit

Content reconciliation used current public exports, manifests, current contracts
and the separate prototype source. Mechanical checks must verify unique IDs,
range coverage, relative link targets and Markdown formatting. These document
checks do not validate the prototype runtime or mark the overall goal complete.

## Bounded application exercise — 2026-10-08

A new user request validated the existing targeting, visualization, signal, and
layout paths against the current checkout, then reused one interactive chart
for a controlled same-reference dataset mutation and immutable repair. All four
existing paths pass; the application replay passes 26 independent checks. A
focused test failed before the repair, and 11 focused browser checks pass after.
No compatibility fix was needed in the existing paths. The exhaustive inventory
and October 1 closure accounting were not resumed or refreshed.

Commands, manual Studio URL, diagnosis, independent expectations, saved failure
and repair queries, and inspection limits are documented in the
[bounded application exercise](../../tooling/agent-verification/README.md).
Evidence is in `agent-verification-evidence/application-2026-10-08/`. A fresh
Node 24.15.0 aggregate attempt stops at unrelated brand-output documentation
classification; later gates are unverified. No aggregate-green claim is made.
The stop rule remains in force; this requested exercise ends here.
