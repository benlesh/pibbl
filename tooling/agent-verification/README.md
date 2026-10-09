# Agent verification tooling

Repository-local, development-only inspection tooling; no stable public runtime
API. The targeting, signal, browser-point and visualization slices are integrated
locally with the current checkout. The fixture stays in the internal testing catalog, outside
public learning examples and search. Production and built-runtime Studio
report inspection as unsupported and omit the source inspector.

## Integrated reference workflow

Use one entry point to connect a requirement to its curated reproducer, run the
native browser checks with a 60-second parent watchdog, and retrieve a compact
machine-readable handoff:

```sh
node tooling/agent-verification/workflow.mjs plan TXT-08 http://127.0.0.1:5199 /tmp/pibbl-text-run-1
node tooling/agent-verification/workflow.mjs run TXT-08 http://127.0.0.1:5199 /tmp/pibbl-text-run-1
```

`plan` is read-only. `run` requires a running source Studio and a fresh output
directory. It creates `workflow.json`, `watchdog.json`, and `replay/report.json`.
The handoff joins requirement ID, source paths, independent acceptance criteria,
remaining scope, replay run ID, action/check summaries and an exact next query.
Use the returned `next` argument vector for paginated action retrieval; the
existing reader also supports check selection and bounded field projection.

Supported runners cover targeting, visualization, text and signal mutation.
Examples: HIT-12, DAT-07, TXT-08 and SIG-14. Layout's distinct smoke protocol and
unmapped requirements return explicit unsupported/unmapped errors before launch.
Only fixed repository runners execute, with argument arrays rather than shell
interpolation. A timeout, nonzero exit, missing report or unconfirmed browser
termination cannot produce a passing workflow. A checkpoint cannot pass as a
final report. Existing evidence directories are never reused.

Failure handoffs prefer the recorded first failed check, then a recorded failed
action, for the next evidence query. Each targeted selector is validated through
the bounded reader before it is offered. Missing, ambiguous or oversized detail
records are listed in `next.unavailableSelections`; fallback does not silently
claim that those records were inspected. Failed actions beyond the first summary
page remain directly retrievable. Truncated identifiers are not used as exact
check locators. Without a final report, the runner attempts the sibling checkpoint
and retains the original read failure. A corrupt or invalid final report does not
fall back to a checkpoint. Checkpoint evidence remains partial; if neither file
is usable, `next` is null and both read failures remain explicit. Failure stages
and check IDs are recorded context, not proof of an underlying cause.

A pass means the controlled reference replay passed; `requirementCompletion`
remains `not-established`. This does not run an arbitrary application, implement a
repair, certify every linked requirement or refresh closure fingerprints.

## Explicit check outcomes

Replay reports may carry up to 256 `checks`, each with a unique nonempty
`checkId` (maximum 128 characters), `status`, explicit Boolean `required`, and a
nonempty `reason` for every non-pass (maximum 1,024 characters). Supported statuses
are `pass`, `fail`, `blocked`, `inconclusive`, `skipped`, and `not-applicable`.

An executed `fail` fails the run even for an optional check. Required blocked
evidence blocks a provisionally passing run; other required non-passes make it
inconclusive. Optional omissions preserve their statuses and reasons without
becoming passes. Earlier operation failures remain failures. Missing reasons,
unknown enums, duplicate IDs or invalid records fail finalization. Existing
required-action ordering and completion checks still apply independently.

The targeting replay explicitly records physical hardware input as skipped and
protected-action permission checks as not applicable to its controlled fixture.
This does not imply those checks are optional in an application that needs them.
The evidence reader shows the first 16 checks with bounded reasons and omission
counts; comparison detects changed check evidence and contradictory pass claims.
Old reports without a `checks` field remain readable as legacy evidence, not proof
that unrecorded checks ran. Most existing assertions still need migration to this
identified check protocol; observation availability remains a separate concept.

## Aggregation conservation evidence

The existing weighted-data fixture publishes `pipeline.aggregation`: its intended
exact-x grouping and ordering policy, included totals, displayed point count and
represented row/weight totals, included/displayed value ranges, and per-group
weighted-sum reconstruction. The policy requires represented counts, weights and
weighted sums per group; it explicitly does not preserve extrema. This controlled
aggregation input contains no gaps. The declarations are application assertions,
not guarantees that a buggy implementation satisfies them.

Independent fixture arithmetic establishes four included rows with total weight 8
and weighted sum 160, displayed as two points. Correct means 10 and 30 reconstruct
per-group weighted sums 40 and 120. The intentional unweighted-mean bug displays
20 and 20 and reconstructs 80 and 80: the grand total still equals 160, so a totals-
only check would miss the error. Repair restores per-group equality. Included
extrema [0,40] become [10,30] after correct averaging, as the declared policy allows.
Both the manual lab and native replay consume the same public application.

This evidence is bounded to five controlled fixture rows. It does not introduce a
Pibbl aggregation API, a decimator, an extrema-preserving algorithm or a generic
lineage inspector. Other transformations must supply their own actual policy and
independent invariants.

## Required checks are declared before execution

`required-checks.mjs` defines the targeting and visualization check/action pairs
independently of runtime observations. Both reports include `requiredChecks` from
initial setup, and verifier fingerprints include the declaration. A report cannot
pass merely because every recorded check passed: missing expected IDs, required
checks relabeled optional, wrong action links and unexpected required IDs reject
completion. Duplicate or malformed manifests are invalid. This complements the
existing ordered required-action manifest; it does not replace it.

The reader summary distinguishes `requiredCheckCount` from `checkCount`, and
`--manifest` includes the declared pairs. Comparisons refuse inconsistent pass
claims and differing check manifests. Legacy reports without a check manifest
remain readable but do not establish this completeness guarantee. Current manifests
cover the 21 targeting and 74 visualization checks already migrated; they do not
claim every remaining raw assertion or inventory requirement is represented.

## Retrieve one recorded assertion

`recordAssertion(report, { checkId, actionId }, assertion)` wraps a trusted
harness-owned assertion, not application callbacks discovered by inspection. It
requires a unique bounded check ID and one existing action, and rejects exhausted
capacity before executing the assertion. Pending async work is recorded as blocked;
only successful settlement replaces that record with pass. Failure retains bounded
expected/actual/operator evidence using the existing error encoder, records the
first failed check ID, and rethrows the original value. It does not serialize
arbitrary return values. Snapshot/assertion semantics still come from the fixture's
independent oracle.

The targeting replay records seven checks per seed/repair/intentional-block action:
pixels, input provenance, selected entity, selection count, delivery generation,
delivery target and selection intent. Other assertions remain in their original
replay locations and still fail the run normally.

```sh
node tooling/agent-verification/evidence-reader.mjs REPORT.json --check repair.selected-entity
```

The visualization replay also records every existing numerical tolerance check
and both weighted-aggregation pipeline comparisons. IDs include the action,
series or pointer sample where needed (for example,
`weighted-data.aggregate-interpolation`). Failed numerical checks retain actual,
expected, exclusive tolerance, difference and units through the bounded error
encoder. Initial interpolation observations are attached before assertions so a
failed check still has its action's recorded data. A complete current replay
contains 74 required checks; structural/setup assertions remain outside that count.

Check detail uses the existing 64 KiB limit. Summary records include action links
and the first failed check, without loading assertion operands into the summary.
`--check`, `--action` and `--manifest` are mutually exclusive. The reader reports
saved evidence; it never executes recorded commands or repeats an assertion.

## Requirement closure contract

The ledger supports reviewed `complete` records as well as open `partial`, `gap`
and `unassessed` records. Completion is version-bound: it means the **full exact
inventory requirement** has been reviewed against the current supported surface,
not that a selected scenario or convenient subset passed. Conditional clauses
need a justified applicability review; unsupported future product features are
not permission to manufacture new APIs or silently drop present obligations.

A complete row must have empty `remaining` and a `closure` object containing:

- `schema: "pibbl-requirement-closure/1"`, the current `inventorySha256`, and
  `requirementText` copied from the full inventory bullet with whitespace normalized.
- `reviewedAt` and a substantive `review` explaining coverage of every clause,
  conditional applicability, independent expectations and material limitations.
- Nonempty `acceptance` entries linking each `criterion` to declared
  `evidencePaths` and `checkIds`.
- Passing `checks` with unique `id`, exact rerun `command`, `environment`, `result`
  and retained `artifact` path. Commands are inert data and are never executed
  by accounting validation.
- `files`: unique repository-relative paths and SHA-256 fingerprints for every
  cited evidence file and check artifact. Include all relevant implementation,
  test, configuration and dependency inputs needed to invalidate stale conclusions;
  the tool cannot infer an omitted dependency.

The gate rejects incomplete records, changed inventory wording, missing linked
checks/artifacts, changed or deleted evidence, files larger than 8 MiB, and paths
or symlinks escaping the repository. It does not rewrite stale closures as passing.
Re-review changed work or reopen the requirement with explicit remaining work.
Maximum closure sizes are 64 acceptance entries, 64 checks and 256 fingerprinted
files. Retain evidence in a durable repository location before making a closure;
ignored temporary replay directories are unsuitable as the only durable record.

The `certifiedComplete` count is the count of reviewed closure claims whose
structure and files passed validation. It is **not an automated proof that prose,
test selection, recorded results or coverage claims are true**. Review must inspect
actual outcomes and match their scope to the requirement. No current row has been
promoted merely because this mechanism exists. Partial counts remain assessment
coverage, never a completion percentage.

## Find a focused workflow

```sh
node tooling/agent-verification/discover.mjs HIT-12
node tooling/agent-verification/discover.mjs DAT-06
```

The data-only response links a requirement to scenario routes, prerequisites,
actions, independent acceptance expectations, source files and exact focused-check
arguments. It does not execute those commands or certify the requirement. Supply
your running Studio origin before the route for manual use. Known requirements
without a curated workflow return `unmapped` with their remaining work; unknown IDs
reject with a typed code. The initial catalog covers targeting interception and
weighted aggregation only. Current ledger status remains separate from discovery.

## Trace explicit application handlers

`createEventTrace({ capacity: 128, pathLimit: 32 })` from `events.ts` supplies
`wrap(label, handler)`, `snapshot()`, `stop()` and `dispose()`. Wrap the particular
public Pibbl event handlers you want observed. The helper installs no listeners or
runtime hooks. Labels are explicit fixture text limited to 64 characters.
Capacity is 1–256 records and pathLimit is 1–64 target IDs per record.

Records distinguish handler entry, synchronous return and throw, with event and
invocation IDs, event type/phase, target/currentTarget, root-to-target path and
original/source event trust. Return values and thrown objects pass through
unchanged and are not serialized. Nor are text, clipboard, keyboard payloads or
arbitrary target objects. Event and target IDs use weak identity maps and are
local to the trace, not interchangeable with inspector IDs.

Coverage is `wrapped-handlers-only`. Dropped history and truncated paths are
explicit; a retained history is not a complete-dispatch guarantee. Unwrapped
handlers, propagation-stop reasons and asynchronous completion are unobserved.
A `return` record for an async handler only means it returned its promise. Stopping
within a handler can leave its entry without an exit. Stopped/disposed wrappers
still call the original handler; disposal clears retained evidence. Earlier
immutable snapshots remain historical.

In the shared targeting scenario, **Trace start** enables both scheduler history
and a 32-record event trace. Click the Canvas, then inspect `state.eventTrace`.
Seed and intentionally blocked modes trace delivery to the decoration; repair
traces delivery to the action. **Trace stop** retains the last event history while
ordinary selection continues. Native replay verifies the capture/target/bubble
sequence in those three modes with independent selection and pixel checks.

## Find a sampled interaction point

`inspector.findInteractionPoint(generation, targetId, { x, y, width, height })`
uses finite positive root-logical search bounds supplied by the caller. Bounds
are a search region, not inferred paint or hit bounds. It probes the center first,
then the other eight cell centers of a 3×3 grid. Each probe retains the existing
64-record, 16-depth, 128-clip-reference and 128-native-call limits; the whole search
uses at most nine probes and 1,152 native geometry calls. It installs no callbacks
or resources and retains no candidate history.

`verified-geometry` supplies a frozen point whose topmost committed geometry
winner was the requested handle. Generation and pending-realm-work metadata remain
explicit. `no-verified-point` means the nine samples failed; thin or irregular
regions may contain valid unsampled points. Invalid bounds, unknown handles,
stale generations, unavailable state, unsupported geometry and truncation remain
separate outcomes. Searches do not invoke external renderer resolvers.

`hostOcclusion: "not-observed"` and `routing: "geometry-only"` are deliberate:
check current browser host geometry/occlusion and capture routing, then correlate
actual delivery before claiming success. The shared scenario's inspect action
exposes `state.pointSearch` for the observed winner; that winner can be the
intercepting decoration and is not assumed to be the intended application action.

## Delivered input provenance

The targeting fixture's `state.delivery.input` is null until delivery (and after
reset). It records original event type/trust and the optional source event
separately. Pibbl keyboard activation creates an untrusted click whose source may
be a trusted keyboard event. A browser-dispatched trusted event does not prove
physical human input; a script-dispatched untrusted event can still change the
application's selection.

`userActivation` is a synchronous snapshot of the canvas owning window during
delivery. Its transient/sticky flags can reflect earlier input, so they do not
establish this event's trust. An unavailable API is reported as unavailable, not
false. `permissions: "not-observed"` makes no permission grant or clipboard,
fullscreen, popup, or other protected-action success claim. Consumers must verify
the particular capability separately. These fields are copied into fixture state
and its JSON evidence; reading them later does not refresh activation.

The native replay checks original/source provenance for its seed, repair,
intentional-block clicks and keyboard activation. It rejects missing or malformed
evidence and incorrect trust/source attribution. It accepts explicit unavailable
activation without inventing a false value; it does not require transient
activation to remain active after asynchronous replay work. Drag/capture event
provenance and protected-action permission outcomes remain outside these checks.

## Debugging task and independent oracle

The blue **Select item A** control occupies x=80..208, y=64..160 in a fixed
480×240 logical viewport. A native click at (144,112) must select `item-a`
exactly once. A zero-alpha decoration shares the rectangle and appears later
in source paint order. The seed omits its targeting opt-out; the repair sets
`pointerEvents="none"`. Both states must keep pixel (144,112) at
[37,99,235,255]. The intentionally blocking mode independently requires no
selection. Matching geometry alone does not establish these requirements.

An agent can inspect the candidate hits, observe that both overlap and the
higher target wins, click through the browser, correlate the actual target
and generation, and check the selected application entity. It can then verify
the one-prop repair using the same point and application. No diagnosis is
hardcoded into the geometry inspector. The scenario supplies semantic labels
only for the event it actually receives.

## Run it

From the repository checkout, with Node 24.15.0 and pnpm 11.21.0:

```sh
corepack pnpm@11.21.0 -C playground run playground:dev --host 127.0.0.1 --port 5193 --strictPort
```

Open <http://127.0.0.1:5193/#/testing/agent-targeting-verification>. Choose
**Inspect target**, then click the blue control. The seed reports a failed
selection requirement and delivery to the decoration. Choose **Repair
decoration**, inspect again, and click the same point: item A is selected once.
**Show intentional block** demonstrates the benign lookalike.

The same page has a native Playwright counterpart:

```sh
node tooling/agent-verification/replay.mjs
```

Optional arguments are the full Studio URL and output directory. Default
artifacts use a new timestamped directory beneath
`packages/core/test/out/agent-targeting/` containing `report.json` and the captured
mode screenshots. The report distinguishes successful reproduction of the
seeded failure from successful application behavior. It records source revision,
fixture/tooling fingerprint, browser, Node, viewport, density, generations,
expected/actual fields and native input transport. It is a focused source-mode
manifest, not a fingerprint of every dependency or unrelated checkout change.
Artifacts remain on disk until explicitly removed. The default preserves prior
runs. Direct replays reserve their output directory before browser work and reject
nonempty or previously reserved directories. A lone `watchdog.json` is allowed
for parent preparation and is preserved. The persistent reservation is not a
liveness indicator; retain it with the evidence. This coordinates cooperating
replay writers, not arbitrary external filesystem mutations. Cleanup is explicit:
delete an entire run directory only when its evidence is no longer needed. Startup or
capability failures produce a blocked report, while failed assertions produce a
failure report with the completed and in-progress steps. Page errors and error
messages are bounded. The loaded fixture now embeds a development-only source identity. The replay
compares that marker on every evidence read and checks local source identity again
before success. Missing or mismatched identities produce a blocked report. The
fingerprint covers core source, fixture/inspector source, identity tooling,
development configuration and the dependency lockfile, plus Git revision. It is
not cryptographic attestation or proof of installed dependencies, external assets
or atomic loading of every module during concurrent hot updates. Relevant source
changes invalidate modules and request a full reload; a test spanning identity
changes must be rerun.

Native replay reports now include `run` (`pibbl-replay-run/1`) with the same ID as
their checkpoint writer, UTC start time, host runtime and the actual browser context
options. `run.rerun` contains an executable, argument array, working directory and
an allowlist of environment overrides. Pass arguments directly to process creation;
do not concatenate a shell command. Apply `unsetEnvironment` so a previous browser
connection endpoint is not reused. The recipe omits the output-directory argument
to create fresh evidence. It assumes the recorded local checkout is provisioned
and its source Studio is serving the recorded URL; it does not provision another
machine or replace source identity checks. `run.toolIdentity` separately fingerprints
the replay and its declared local helper dependencies; `toolIdentityAfter` must
match before success. Shutdown records this check after failed operations too;
`toolVerification` distinguishes matching files, unavailable initial identity and
verifier failure without replacing an earlier operation error. This covers verifier
changes independently of the served
fixture fingerprint. It observes files on disk, not an atomic snapshot of loaded
modules or the complete installed dependency tree.

Replay failures retain Node assertion operators and typed expected/actual details
alongside the error summary. `failure.actionId` names an incomplete action only;
`lastActionId` records the latest action without claiming it caused a later failure.
`failure.detail` declares output limits and omission reasons for truncated strings,
collections, depth, cycles, accessors and unsupported values. These diagnostics are
for the repository's controlled fixtures, not a secret-redaction system or sandbox
for arbitrary proxy objects. Boolean assertions do not automatically supply their
numeric operands or tolerance; those need explicit assertion evidence. The native
visualization replay now uses explicit numeric assertions for its final coordinate,
interpolation and distance checks. Failures retain units, difference and the original
exclusive absolute tolerance; browser wait predicates remain separate.

Inspect retained evidence without replaying or loading every observation:

```sh
node tooling/agent-verification/evidence-reader.mjs /absolute/path/to/report.json
node tooling/agent-verification/evidence-reader.mjs /absolute/path/to/report.json --action nearest-unsorted
node tooling/agent-verification/evidence-reader.mjs /absolute/path/to/report.json --manifest
```

The default summary includes action statuses and primary/secondary failure categories.
Checkpoint files are accepted and always labeled partial. Every view says
`saved-evidence-only`: reading a claimed pass does not revalidate it. The reader
accepts at most 4 MiB of input, emits at most 32 action summaries with explicit
omission counts, and rejects detail views above 64 KiB rather than silently cutting
JSON. Summary strings report truncation; unknown schemas and duplicate requested
action IDs reject. It never executes saved recipes or opens referenced artifacts.

Checkpoint `timestamp` is a wall-clock observation. `timing.elapsedMs` uses the
writer's Node monotonic clock and `clockId`; its initial wall/monotonic pair is
explicitly not synchronized. Do not sort browser timestamps, scheduler logical time
or simulation ticks against this value as if they shared a clock. Failed monotonic
samples preserve the prior checkpoint instead of writing misleading durations.

Compare saved runs conservatively:

```sh
node tooling/agent-verification/compare-evidence.mjs BEFORE.json AFTER.json
```

The result names both source files and run IDs. Comparisons require matching
fixture/verifier fingerprints, browser/environment, URL and action manifest, with
consistent initial/final provenance. Incompatible or missing provenance refuses
comparison with explicit reasons. Accepted results describe changed recorded action
data and failure evidence, not screenshot equality or a causal regression. Checkpoints
and failed runs lacking a final verifier fingerprint cannot establish this comparison.
Intentional build changes need a separate, explicitly scoped comparison workflow.

Combined focused checks (all agent browser tests, hover regression and identity rejection):

```sh
corepack pnpm@11.21.0 test:agent-verification
```

## Ownership and observation boundary

Pibbl owns its existing paint ledger, geometry, scheduler and event dispatch.
`targeting.ts` is optional repository tooling that reads that ledger; it changes
no runtime file or package export. Applications use only `@pibbl/core` for their
scene and own the semantic intent and outcome. The scenario harness binds the
prototype to one mounted Canvas and records one last event, snapshot and probe.
The browser harness owns native input, pixel readback, screenshots and deadlines.
The test-only manual driver and ownership counters remain internal test evidence.

A passive `snapshot()` copies at most 64 controlled records, never application
props, signal values, getters, proxies, component trees or native paths. Returned
records are frozen. IDs are local to one inspection session and correlate opaque
public event targets; they are not application IDs or private component paths.
The inspector retains only weak owner/target references and installs no observer,
listener, render callback, scheduler work or surface. Disposal clears its ID map.
No inspection code is added to the published core build.

Snapshots label unavailable/pending/disposed/replaced roots explicitly and do
not publish partially updated entries. Generation is session, render generation,
requested revision and completed revision. `pendingRealmWork` is separate:
computed validation may be pending before it requests a root render. A ready
snapshot means the last completed root geometry is available, not that all
application state is globally settled. Queries reject changed generation tokens
and never silently follow a replacement mount. Captured evidence stays historical;
it is not a live view. Delivery captures its own generation before application
signal writes, and tests compare it with the probe generation.

`probe()` is explicitly **active native geometry**, not a passive snapshot. It
uses at most 128 native path tests and restores Canvas state in `finally`.
Candidates appear in reverse paint order; the first hit wins. It does not call
Pibbl's general resolver, app callbacks or signal getters. Canvas Layers are traversed
in paint order with composed transforms, ancestor clips and surface bounds.
Records include a frozen surfacePath of ancestor boundary record indices. The
64-record budget includes boundaries and descendants; depth is capped at 16.
Snapshot traversal also caps cumulative clip references at 128, counting inherited
clips for every record. It checks stack lengths before copying clip metadata.
Renderer resolvers and legacy geometry return unsupported. Over-budget requests
return truncated with no predicted winner. This limits record count and native
call count; native Path2D command complexity and per-call duration are unavailable.
No extra surfaces, retained paths, historical scene or pixel provenance are built.
Pixels/visibility remain unavailable to this inspector. The browser's narrow
readback is separate evidence with separate cost.

## Inventory dispositions

| IDs                      | Disposition in this slice                                                                                                                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INT-01/03/05/08/10       | Application and harness: fixed fixture, independently specified center/color/selection, explicit mode setup and real clicks.                                                                                     |
| QRY-01/02/03/08/09/12/14 | Partial tooling: one root, bounded immutable records, explicit states, generation rejection and separate active probe. No pagination/history or general selectors.                                               |
| ID-01/09                 | Partial tooling: inspection-session target identity, exact mount binding and replacement rejection. No general source/entity labeling.                                                                           |
| HIT-01/02/08/09/12       | Partial tooling plus browser: root and Layer paths, hits/misses/clip exclusion, paint-order winner and native delivery agreement. Opted-out objects are absent, not reconstructed.                               |
| EVT-08/11, PNT-12        | Harness/application: native input, domain selection/count and independently sampled pixels.                                                                                                                      |
| HAR-07, EVD-04/05/12     | Same manual/headless application; protocol-neutral report and rerun recipe.                                                                                                                                      |
| OBS-01/02/03/04/09/10    | Focused tests: enabled/disabled behavior; repeated reads/probes preserve signal graph counters, evaluation counts, scheduler work, Canvas state and resource ledgers; stale/disposed states; native cross-check. |

Deferred: general layout and visibility diagnosis, semantic IDs/source mapping,
full candidate exclusion explanations, timeline/subscriptions, arbitrary signal
inspection, filter/backend diagnostics, visualization facets, public package
API, built/packed inspector support, MCP/transport and additional domain facets.

The inventory's dated audit is superseded for availability: current core exports
include receiver-owned signal inputs, batch, useConst, useComputed and
useReaction. Current `@pibbl/core/viz` exports LinearScale, BarScale, UTCScale, useLinearScale, useBarScale, useUTCScale, Axis, LineSeries and
ScaleAdjust. This slice needs neither new reactive machinery nor chart tooling.

## Focused evidence

The first test failed because the new scenario was absent, then passed with the
implemented application and tooling. An earlier startup failure was missing
package declarations in the fresh worktree, not acceptance evidence; the standard
package build supplied them. A focused observation test caught the distinction
between pending computed validation and completed root geometry, which is now
explicit in the schema. Tests cover immutable bounded snapshots, stale tokens,
root replacement, nested-surface transforms and clipping, lazy evaluation, ownership,
Canvas state restoration and real seeded/repaired/intentional-block input.

After acceptance, hardening added structured JSON fixture evidence (no UI-prose
parsing), scoped readiness with a five-second deadline, cancellation/disposal,
initial-mount failure cleanup, fresh sessions on re-enabling inspection, public
catalog exclusion evidence, and a real external-render-layer no-resolver-call
test. The production output gate rejects the source inspector schema marker.

Geometry candidates enumerate bounded overlaps; they are not a trace of entries
actually visited by dispatch. The probe models geometric targeting only, not
pointer capture, native DOM occlusion or event-specific routing. Target ID
correlation is scoped to synchronous events in this fixture and their recorded
generation; it is not a general target-handle API.

Run the repository aggregate with `corepack pnpm@11.21.0 trust`. Fresh verification
results are reported in the task handoff; historical results above describe the
first slice, not a current test total.

## Loaded fixture provenance slice (2026-09-29)

Requirements ENV-07/09, EVD-01/09 and HAR-01 are partially addressed by the
identity exchange. It applies to this development fixture, not every application.
The identity lives in the transformed fixture module, not an unrelated HTTP
endpoint. Source-development-only plugin activation is covered by tests.

```sh
node --test tooling/agent-verification/identity.test.mjs
```

The suite checks changed bytes under an unchanged revision, missing identity,
revision mismatch, development-only embedding and a native browser replay
against deliberately mismatched served evidence. The latter must block before
performing any scenario action. A matching real Studio replay remains required.

This addition is integrated locally into the main working checkout alongside the
other verification slices.

## Attributing clip exclusions

Choose **Inspect outside Layer** in the lab to query the independently specified
root-logical point (300, 112). Both action candidates are excluded by the Layer's
bounds and a native click selects nothing. Choose **Inspect target** to return
to (144, 112). Structured evidence includes the captured probe point.

A candidate's `exclusion` is null unless a clip test rejected it. Otherwise it
contains `kind` (`clip` or `surface-bounds`), `entryOrder`, `stackIndex`, a frozen
root-logical transform and the tested fill rule. `entryOrder` references the
record where that geometry entered the traversal; `stackIndex` is local to that
record's clip stack (null for Layer bounds). It is not a source component ID.
Only the first excluding boundary is reported; later boundaries are not tested.
This establishes point exclusion, not global invisibility or proof that the
candidate would hit if the clip were removed. No Path2D or live runtime object
is returned. The replay includes this boundary-miss case alongside capture and DOM-interception checks.

## Passive signal snapshots

The source-development lab's **Inspect target** and **Inspect outside Layer**
actions also capture explicitly registered state signals and the dormant computed.
The UI and structured `signalInspection` record show cache state, validation
state, version, observer count, bounded debug name and a safe value preview.
There is no application-wide signal discovery or causal event tracing in this slice.

The inspector never calls `get()`, validates a computed, subscribes, or reads a
payload property. Objects/functions/symbols/bigints/non-finite numbers are opaque;
strings are limited to 128 characters. Cached errors expose no thrown payload.
Never-read computeds are distinct from cached values and errors. An unobserved
computed's cached value may be stale even when its internal state is clean; the
snapshot reports `unobserved` rather than claiming freshness. Snapshots describe
cached runtime fields, not an atomic transaction-wide publication guarantee.

Registration is nominal, deduplicated by runtime node and limited to 64 entries
per inspector lifetime. Additional registrations make completeness `truncated`.
Records are immutable and retain no live values; weak references avoid retaining
registered nodes. `released` means a weak reference was cleared, not proof of
owner disposal. Disposal drops all registration references. The inspector is
repository-local and omitted from production and built mode.

### Recorded computed dependencies

Snapshots include up to 128 dependency edges total across registered computeds.
Each edge names a registered source ID (null when unregistered), the version last
recorded by the consumer, the source's current stored version and whether the edge
is subscribed. Sources are never registered or recursively explored implicitly.
Readonly aliases share a node ID; a session number distinguishes inspector runs.
Per-record edge completeness and snapshot completeness expose budget truncation.
Dependencies of a currently evaluating formula are unavailable rather than a
partially collected graph. No observer callbacks are invoked.

These are recorded reads, not proof of causality or current formula results.
Unobserved formulas retain prior dependencies until the application reads them;
source versions can differ without inspection validating anything. Untracked
reads are not reconstructable from these edges. Cached error dependencies describe
the last recorded attempt, not a successful value computation.

The lab's selection-label computed reads mode plus selected item in normal modes
and mode alone in intentional-block mode. Inspect those modes to see the edge
change. Browser tests also verify stale unobserved branches, alias identity,
unknown sources, immutable historical records and the 128-edge limit.

## Visualization numeric verification

The existing `/testing/viz-hover-lab` now provides structured JSON evidence at
`data-testid="agent-viz-evidence"`, immutable state copies, data-generation
markers and **Update first series**. Its scoped wait checks rendered mode,
inspection x and data generation with a five-second deadline; it no longer uses
three arbitrary frames as readiness. Disposal cancels waits and removes evidence.
Ordinary pointer changes also publish updated evidence after the render callback.

Run `node tooling/agent-verification/viz-replay.mjs 'http://127.0.0.1:5195/#/testing/viz-hover-lab'`.
The native replay computes expected plot dimensions from browser host dimensions
and the fixture's declared layout, never from queried scales. For x=5, the initial
series interpolate to y=20. Updating the first series changes its y to 30 while
the second remains 20. Both data values and local pixel anchors are independently
asserted. This verifies analytical/query geometry, not exact painted pixels.

Reports are saved under `packages/core/test/out/agent-viz/`. This replay now checks a fingerprint embedded in the loaded development fixture
before any actions, on every evidence read, and against local source again before
success. It covers core/viz source, the lab/example, identity tooling, development
configuration and lockfile. Installed dependency bytes, external assets and atomic
loading of all imports are not attested. Missing or mismatched identity blocks the
run and leaves a report with no successful verification claim. The lab's closest-point action retains its
older synthetic setup behavior; this new replay uses actual native browser hover
in interpolation mode. Missing-data, duplicate-x, reversed input order, density,
responsive resize and failure-mode matrices remain follow-on work.

The hover lab also provides **Insert missing observation**. It places an explicit
null at x=5 in the first series. The browser test checks x=2.5, 5 and 7.5: the
first series returns no interpolation across either broken segment, while the
second series still returns independently calculated values. Native Studio replay
checks this third data generation and rejects a stale first-series result.

The visualization fixture now records its rendered viewport. Readiness also checks
that viewport against the lab's padding-free host client dimensions (rounded for
CSS fractional sizes), preventing acceptance of pre-resize geometry. The browser
test resizes from 1000 to 600 CSS pixels and independently verifies the narrower
plot and native hover coordinates. This is a scoped lab predicate, not a generic
readiness contract for arbitrary padded or transformed hosts.

Run visualization replay with `PIBBL_VERIFY_DENSITY=2` to exercise the same native
input and numeric oracles at double device density. Reports include that density
and assert rendered viewport agreement. Density checks do not imply exact pixel
antialiasing equivalence.

## Capture versus geometry

Choose **Capture drag**, press the blue control and drag right outside it. The
lab records delivered pointer ID/target/coordinates and a geometric probe at that
same point. A geometric miss can coexist with delivery to the capture owner.
Release and inspect again to see the ownership cleared. Native replay includes
this drag path and scrolls the Canvas into view before using raw pointer positions.

Snapshots separately report up to 32 `canvas-logical-owners`, with immutable
pointer ID, inspector target ID and liveness records. Capture changes independently
of render generation; capture records are historical observations, not geometry
generation promises. Native activation details, transfer timing and external
renderer capture are unavailable in this facet. It reads Pibbl-owned fields without
calling cleanup-capable lookup functions or native capture methods. Probes are
explicitly labeled `routing: geometry-only`; they do not predict captured delivery.

## Component layout entry context

Component records include `layout` with `status: entry-context`, `allocation`
and `percentageBasis`, or unavailable/null fields when no context exists.
These frozen numeric boxes capture traversal entry. Allocation agrees with the
receiver's public `useLayoutBox()` at entry; percentage basis is recorded
separately because it can be larger than the allocated child. They do not report
paint bounds, parent placement translation, successful completion, intrinsic
measurement, normalized style or the algorithm's reasoning. A component can
fail after entry. Treat its render generation as an evaluation association,
not a successful pixel-commit certificate.

The runtime retains only two numeric boxes on each existing component record;
passive inspection neither invokes layout nor reads application props. Prior
snapshots remain immutable. Semantic component comparison reports `layout` when
either box changes. The shared targeting lab exposes Layer allocation through
its existing Inspect action. Unchanged numeric boxes and their containing entry record are reused across
traversals; a changed allocation can still reuse its unchanged percentage basis.
This is structural allocation evidence, not a timing guarantee. A failed root
clears its live component entries; retained historical snapshots remain unchanged,
and explicit recovery creates fresh component lifetimes. Independent-root layout
and paint are tested across that failure. An empty component list alone is not
a success certificate: correlate scheduler error evidence. Direct child failure aborts later siblings; recovery restores their allocations.
A nested Layer recovery separately proves its percentage basis, with dirty Layer
evaluation preceding parent evaluation as required by the scheduler. Preparation-
phase failures, deeper nesting and broader overhead characterization remain open.

## Focus bounds are navigation metadata

`focus.boundsSemantics` qualifies every reported focus rectangle: root-logical
coordinates, an axis-aligned envelope of navigation metadata, and unknown
relationships to painted and hit geometry. A custom navigation rectangle or
renderer-supplied points need not describe the visible silhouette. Even a normal
rotated Rectangle has empty corners inside its navigation envelope. Do not use
this envelope as an exact hit region, a visibility oracle or evidence that a
component paints every enclosed pixel. Use a generation-checked geometry probe
and separate pixel/native-input evidence for those claims. Missing bounds remain
null rather than being replaced with a guessed zero-sized box.

## Interaction width is not painted width

Path targeting records expose `strokeInteractionWidth`, the band used for hit
testing. It replaces the misleading prototype field `strokeWidth`; this local
prototype has no stable external schema compatibility promise. It does not expose
painted stroke width, stroke bounds or conservative paint extents. A valid hit
can lie on a transparent pixel when the application deliberately expands its
interaction band. Native tests establish this with a two-pixel painted line and
a twenty-pixel interaction width, plus misses outside the band and endpoint.
Treat this as supported interaction behavior, not a rendering defect.

## Entry-local coordinate conversion

`inspector.convert(generation, from, to, value, kind, entryOrder)` accepts
`entry-local` alongside root-logical, backing and css-content spaces. Use the
entry order from that same complete snapshot; it is not a durable component ID.
Entry-local means the coordinate space of the recorded hit path, not a promise
that a shape's x/y properties are a separate origin. Nested Layer transforms
compose into root coordinates before root fitting and pixel density apply.

Points include translation; vectors do not. Negative scales are supported.
Singular transforms can map outward but inverse requests return unsupported
with an explicit reason. Missing entries are invalid, changed generations are
stale, and truncated entry snapshots are unavailable for this operation.
External resolver subtarget coordinates and client/page mappings remain
unsupported. Inversion uses floating-point arithmetic; compare with a tolerance
appropriate to the coordinate units instead of demanding exact round trips.

## Clip ancestry

Passive targeting records include a bounded `clips` array, in inherited-to-local
order, including Layer surface bounds. Each record identifies the capturing
`surfacePath` (ancestor paint-entry orders), its `localToSurface` matrix, and its
`transform` from clip-local to root-logical coordinates. Arrays use Canvas affine
order `[a,b,c,d,e,f]`: x maps to a*x+c*y+e and y to b*x+d*y+f.
The flattened root transform composes ancestor surface placement with the local
capture transform; it is not a backing-pixel or client-coordinate transform.

`entryOrder` identifies the observed paint entry carrying the constraint, not a
source component identity. Inherited constraints preserve their capture surface.
Native path objects never escape into snapshots; geometry is labeled opaque-path,
with no invented command stream or exact bounds. Snapshotting does not call native
hit tests. Explicit point probes remain separate. The existing 128-clip-reference,
64-entry and 16-surface-depth budgets bound ancestry reporting; truncated snapshots
cannot be used as complete probe evidence.

## Shape misses versus clip exclusion

Each tested candidate reports `geometry: hit | miss | not-tested` independently
of its clip outcome. This is an explicit native query of the unclipped hit path
at the requested point, not a visibility assertion, path-bounds estimate or
reconstruction of opaque Path2D commands. Inactive candidates remain not-tested.
A `clip-excluded` candidate with geometry `miss` would still miss if that clip
were removed. Geometry `hit` establishes that clipping excludes an otherwise
matching hit shape, but does not promise visible pixels or delivery through DOM
interceptors or capture. Queries retain the existing 128-native-call preflight
budget and restore the Canvas context afterward.

The shared lab's **Inspect outside Layer** action exposes both facts: the point
misses the two rectangles and also lies outside their Layer. Its native click
produces no selection. This is intentional scene geometry, not an application
error. The transformed Clip regression separately proves a geometry hit excluded
by a clip and a point missing both.

## Browser interception

**Add DOM overlay** puts a reversible HTML interceptor over the blue control.
Inspect to compare the Pibbl geometric target with the browser hit result, then
click it: only the overlay counter changes. **Remove DOM overlay** restores the
normal selection path. Replay checks both native outcomes. Disposal and mode
changes remove the overlay and restore any owned parent positioning style.

`probeHostPoint(canvas, clientX, clientY)` is an active owner-document hit query;
it can flush layout. Its immutable record includes the point, status and only the
hit element's tag name. It reads no element text, IDs, labels or arbitrary objects.
It explicitly reports disconnected hosts, nonfinite points, offscreen points and
unsupported shadow-root hosts. Ancestor-frame interception remains unavailable.
A Canvas hit does not prove pixel visibility or guarantee later event delivery.
The lab converts its fixed borderless axis-aligned Canvas coordinates; arbitrary
host-transform conversion is not promised. Native intercepted clicks capture
browser evidence again at the actual input point. The helper is source-only and
excluded from production bundles.

The combined command runs source-mode browser fixtures and both native mismatch
rejection tests without requiring a separately started Studio. The ordinary
`test:ci` already discovers the browser tests; `trust:browser` additionally runs
`test:agent-verification:identity` so the identity guard cannot silently fall out
of the aggregate gate. Full Studio replays still require a running source server
and remain separate commands. Passing the focused command is not full inventory
completion or an aggregate trust result.

## Native and logical focus

Choose **Keyboard focus**, click the blue control, then press Enter. The lab
records activation and refreshes focus evidence after the requested render settles.
This avoids requiring an Inspect-button click that would itself move native focus.
Async observation failures are bounded and explicit; disposal cancels pending waits.

The targeting snapshot has a separate focus facet: owner-document native focus,
Pibbl logical target ID, focus-visible state, and up to 64 committed candidates with
source order and root bounds. It reads only the known Pibbl focus manager's committed
fields/getters; it invokes no focus, navigation, resolution or subscription method.
Absent policy is `unconfigured`, unknown/pending policy is unavailable, and excess
candidates are truncated. Focus may change without repainting and is historical
independently of the geometry generation. These fields do not establish a semantic
DOM/accessibility tree, ancestor-frame focus, or a rendered focus indicator.

A native Tab test verifies entry from a preceding DOM button, logical traversal,
and exit to a following DOM button. Native Studio replay verifies a pointer
activation followed by exactly one Enter activation while logical focus matches
the delivered target.

The Keyboard focus control uses public `useEventTarget` state to render a magenta
focus-visible ring. Native pointer focus keeps the ring absent; Tab entry makes
it visible. Enter activation after pointer focus does not by itself promise a
modality change. The browser test independently samples root pixel (76,80):
background [248,250,252,255] before keyboard entry and after blur, ring
[255,0,255,255] after Tab. Native Studio replay also compares the pointer and
keyboard pixels. This narrow integer-aligned shape avoids text rasterization or
platform-wide screenshot baselines; it does not establish contrast compliance or
screen-reader semantics.

## External replay deadline

Use the parent watchdog when running either replay. The output directory must be
new; existing directories are rejected before starting a child.

```sh
node tooling/agent-verification/watchdog.mjs targeting 'http://127.0.0.1:5195/#/testing/agent-targeting-verification' packages/core/test/out/agent-watchdog/my-new-run 60000
node tooling/agent-verification/watchdog.mjs viz 'http://127.0.0.1:5195/#/testing/viz-hover-lab' packages/core/test/out/agent-watchdog/my-new-viz-run 60000
```

`watchdog.json` is separate from the child's `report.json`. The parent records
`running`, `exited`, `timeout`, or `launch-error`; `exited` is process evidence,
not a semantic pass. Require normal zero exit **and** the child's passing report.
A deadline remains a timeout even if termination produces exit code zero. CLI
exit code is 124 for timeout, 1 for other process failures, and 0 for normal zero
exit. The default deadline is 60 seconds, configurable from 1 ms to one hour.

On deadline, the parent writes timeout evidence, sends SIGTERM, allows one second
for graceful exit, then sends SIGKILL. It waits at most one further second for
confirmed child exit. Existing child artifacts are preserved. Captured stdout and
stderr each retain at most 16,384 UTF-16 code units, with explicit truncation.
The watchdog does not parse output prose or invent missing child assertions.

The CLI now launches a parent-owned Playwright browser server and gives its endpoint
to the replay. After every child outcome, it kills that browser through Playwright
and records `browserCleanup` separately. Cleanup waits at most five seconds; an
unconfirmed or failed cleanup prevents CLI success. The replay can still launch
its own browser when run directly without the watchdog.

The injected-hang test blocks both the page and replay, then confirms the browser
process and every observed member of its process group have exited. This process-
group evidence is POSIX-only and the test is skipped on Windows. Arbitrary escaped
descendants, parent interruption, browser crashes and filesystem-write failures
still need broader evidence; HAR-14 remains partial.
The deadline cannot compensate for a suspended parent or unavailable filesystem.
Run `corepack pnpm@11.21.0 test:agent-verification:watchdog` for focused tests; this
suite also participates in the combined agent check and `trust:browser`.

## Native browser failure observations

Both replays record `browserFailure` with `pageCrashed` and
`unexpectedDisconnect`. These are Playwright transport events, not classifications
inferred from error-message wording. Failure records include the category observed
when the operation failed (`page-crash`, `browser-disconnected`, or
`operation-error`). Final browser observations are recorded again after cleanup,
so later evidence need not imply the original operation's cause.

Expected shutdown is marked before closing the browser and does not count as
unexpected disconnection. Disconnection means loss of the browser connection;
it does not, by itself, prove an operating-system crash or identify its cause.
Snapshots are immutable, retain no page objects, and observer listeners are removed
at teardown. Existing completed steps and original bounded failure messages remain
in the replay report. A forced termination before report writing still relies on
the independent watchdog record.

Native tests crash an already-open Chromium renderer through the debugging
protocol and wait for the real crash event; separate tests distinguish unexpected
connection loss from expected shutdown. A navigation abort from `chrome://crash`
is not itself accepted as crash evidence. End-to-end crash injection between
completed application steps remains follow-on work.

## Partial checkpoints

Both replays atomically replace `checkpoint.json` before navigation, before each
scenario action group, after each completed group, and before browser cleanup.
Each checkpoint has a run ID, increasing sequence, stage, wall-clock timestamp,
and the last saved report. The final report carries the same `checkpointRunId`.
The checkpoint always says `partial`, and its embedded report always says
`incomplete`, regardless of completed step results. Only final replay and watchdog
records can establish full success.

Writes use a temporary file in the same directory followed by rename. An invalid
or oversized replacement leaves the preceding checkpoint intact. Evidence is
limited to 4 MiB per checkpoint; excess produces an explicit error rather than
silent truncation. Calls must be awaited sequentially. Saved checkpoints survive
replay termination and are not deleted by teardown. An interrupted temporary file
is not an accepted checkpoint. This is process-crash preservation, not an fsync or
power-loss durability guarantee, and it does not save every transient observation
between checkpoints. Use a new output directory through the watchdog to avoid
mixing runs.

## Duplicate x-values and source provenance

The hover lab offers **Duplicate x: first row**, **Duplicate x: last row**, and
**Reorder duplicate rows**. Use Interpolate and hover at x=5. The fixed first
series has rows `start` (0,10), `low` (5,10), `high` (5,30), and `end` (10,30).
First policy selects `low`; last selects `high`. Reordering the equal-x pair under
first policy selects `high` at its new source index. This deliberately demonstrates
order-sensitive policies; it does not promise order-invariant duplicate resolution.

Structured results now include source provenance: recorded/exact observations
carry source index and optional row ID; interpolation carries before/after indices,
optional row IDs and fraction. IDs are null for example rows without application
keys; indices are scoped to the reported data generation, not durable identities.
The lab also reports the duplicate policy. No arbitrary row payloads are copied.

The native test and replay verify x=5 and x=2.5, independent expected values and
anchors, original source IDs/indices, unaffected second-series values, and prior
snapshot stability. Replay now covers six generations. Nondecreasing x order is
still required for interpolation; arbitrary descending input, default duplicate
rejection and nearest-query tie behavior are separate verification obligations.

## Unsorted nearest observations and clearing

**Nearest: unsorted rows** switches to nearest-per-line mode with source order
`end` (10,30), `high` (5,30), `start` (0,10), `low` (5,10). At x=5 the earliest
duplicate is `high`; at x=2.5 an equal-distance tie selects `high` before `start`;
at x=7.5 the tie selects `end` before `high`. Tests and replay check IDs, original
indices, recorded coordinates and mapped anchors at two vertical pointer positions.
This follows source-order tie resolution, not a sort or lowest-x preference.

**Nearest: empty first series** replaces that dataset with an empty array. The
first series must disappear while the second still returns its expected recorded
observation. Moving from the plot to the surrounding Canvas clears inspection and
all hover results. Historical snapshots retain the previous selections. Replay
now includes eight data generations. These scenarios do not cover closest-point
pixel-distance ranking, maximum-distance boundaries, or invalid interpolation
input rejection.

## Closest-point distance evidence

Snapshots include the processed plot-local pointer and a distance descriptor on
recorded results. Closest-point reports `plot-pixels`; nearest-x reports
`domain-x`; interpolation reports null because it does not select by a nearest
distance. These units are explicit and must not be compared interchangeably.

Native verification checks the fixed 40-logical-pixel closest-point limit: 30 and
40 are included, 40.25 is excluded, and the previous result must disappear. It also
contrasts nearest-x with a distant pointer at the same x and selects a point from
the second series. The non-binary fractional input coordinate has a 0.0001 logical
pixel tolerance for browser input quantization; exact binary-coordinate cutoff
checks remain exact. The older closest-point setup action still issues its
synthetic initial pointer; every asserted point in this new verification is driven
by subsequent native input and checked against the processed pointer.

The original nine-case replay passed at densities 1 and 2. The later weighted
aggregation extension adds two cases; its recorded native run uses density 1. Device density does
not multiply the logical distance cutoff. Stroke/mark hit testing, closest-point
ties across series, and configurable domain-distance limits remain separate work.

## Committed root surface geometry

Targeting snapshots include `surface`, copied from Pibbl's committed root surface.
It reports logical viewport, cached CSS content size, backing size, fit/mode,
effective backing pixels per CSS pixel and per logical unit, and forward/inverse
logical-to-backing matrices. Matrices use `[a,b,c,d,e,f]`: x′=a·x+c·y+e and
y′=b·x+d·y+f. Negative zero is normalized for stable JSON round trips.

This is cached runtime geometry tied to the targeting generation, not a fresh
browser measurement or visibility assertion. Pending/unavailable/disposed/stale
snapshots provide no surface geometry. All nested values are frozen copies;
inspection neither measures DOM bounds nor changes the canvas context. Host client
position, scrolling, borders/padding and arbitrary CSS transforms remain explicitly
unavailable. Configured pixel-ratio policy and effective densities are distinguished; full
explicit-versus-default configuration provenance is not yet exposed.

A focused public-API test independently specifies a 300×100 logical viewport in a
600×400 CSS host at density 2 with contain fitting. It verifies a 1200×800 backing,
a `[4,0,0,4,0,200]` transform, its inverse, a red painted landmark at backing
(200,320), and native CSS input at (100,160) delivered as logical (50,30). DOM
measurement is made to throw during inspection. Disposal makes later geometry
unavailable while the saved snapshot remains unchanged. The Studio targeting replay
also asserts the fixed fixture's dimensions and identity transforms.

## Generation-checked coordinate conversion

`inspector.convert(generation, from, to, {x,y}, kind?)` maps committed root
coordinates among `root-logical`, `backing`, and `css-content`. `kind` defaults to
`point`; `vector` omits translation in both directions. CSS-content coordinates
start at the content-box origin and do not include page/client position, scrolling,
borders or CSS transforms. Those spaces are explicitly unsupported here.

Results contain `mapped`, `stale`, `unavailable`, `unsupported`, or `invalid`, the
observed generation, frozen mapped value or null, pending realm-work state, and a
bounded reason. Changed mount/render revisions reject the old token even when the
numeric transform happens to remain equal. Nonfinite inputs and arithmetic overflow
are invalid. Coordinates are not clamped to the viewport. Conversion uses cached
matrix arithmetic; it does not measure DOM, query native paths or touch canvas
state. Pending realm work remains distinct from the committed generation.

The targeting lab records point conversions to backing and CSS-content coordinates
alongside manual probes and captured pointer delivery. The native replay verifies
their generation and expected values. Tests independently check a contain-fitted
surface's point/vector differences, inverse mapping, stale refusal, unsupported
client coordinates, overflow, immutable history and disposal. Repeated conversions
also participate in the signal/scheduler/context/resource passivity check.

### Resize, hiding and density rounding

Surface geometry now includes `configuredPixelRatio` (a number or `device` for a
root; null when no root policy is available), distinct from the two effective
backing/CSS density ratios. This is resolved configuration, not proof that a user
explicitly supplied the field rather than accepting a default.

A native ResizeObserver test changes a responsive host from 600×400 to
300.25×100.5 CSS pixels at configured ratio 1.5. The backing becomes 450×151,
so effective x/y densities differ. Independent conversion, painted-landmark and
native-click checks use a 0.0001-pixel tolerance for fractional transform/input
rounding. Backing dimensions and configured/effective density assertions remain
exact. Predicate-based waits advance the controlled scheduler until the actual
native resize notification is committed; no fixed frame count is used.

Hiding the host yields unavailable geometry, conversion and targeting. Showing it
again produces a new generation, restores targeting and refuses tokens from before
hiding. Saved older snapshots remain intact. This does not claim detection before
the browser delivers resize notifications, nor cover every host transform or
operating-system device-density transition.

## Passive direct signal subscribers

Registered signal records include an immutable `observers` facet with scope
`direct-subscriptions`, completeness, and bounded records. Each record gives a
session-local consumer ID, computed/render/reaction/other classification, an already
registered computed signal ID when available, the edge's observed version, and
render dirtiness when represented by an own data field. Consumer IDs identify subscriptions within the inspection session. The optional
canvas ownership facet below correlates component consumers; dirtiness is not an
explanation of its cause.

A separate 128-edge budget bounds observer traversal across each snapshot.
Active notification traversal or computed evaluation makes observer evidence
unavailable. Legacy callback flag accessors are never invoked; classification
reads only own data descriptors of Pibbl-owned consumer records. Registration and
inspection add no subscriptions or computed evaluations. Saved snapshots survive
subsequent writes and disposal unchanged.

Focused tests distinguish immediate direct-consumer dirtiness from deferred
computed validation, verify removal on disposal, and exercise 129 subscribers
and a throwing legacy flag getter. The native targeting replay verifies computed
subscription removal when the fixture switches branches and clean render
consumers after settled delivery. Full causal histories, component/surface
ownership, and unregistered graph discovery remain outside this facet.

## Signal consumer ownership

`createSignalInspector(canvas)` optionally binds ownership observation to the
exact live Pibbl mount present at creation. Its `ownership` facet reports scope
`bound-canvas-components` and complete/truncated/unavailable traversal. Without a
canvas, or after disposal/replacement, ownership is unavailable; ordinary registered
signal observation remains separate.

Each observer's nullable `owner` contains session-local numeric component/surface
IDs, a bounded runtime path with an explicit truncation flag, a bounded debug name,
root/Layer surface kind, and current render/requested/completed revisions. Numeric
IDs are separate from truncated display paths. Snapshots are immutable; IDs are
not persistent across inspector sessions and are not source file locations.

Correlation reads Pibbl-owned component records and uses an internal opaque consumer
identity lookup. No production observer, retained diagnostic index, listener or
render hook is installed. Host/mount and identity keys are weakly held. Each scan
visits at most 64 surfaces, 256 component records and 256 paint entries, following
committed nested Canvas surfaces only. Unknown owners stay null, including official
external-renderer consumers and consumers outside the bound canvas. Completeness
describes this bounded traversal, not proof that every signal observer has an owner.

The public root/Layer test verifies distinct surfaces, stable identities, graph
passivity, immutable history and refusal to attach to a replacement mount. Native
Studio replay verifies ownership and settled revisions for fixture render consumers.
This is current ownership evidence, not a write-to-paint causal history; pending
revisions do not imply committed pixels. External renderer ownership, source
locations, exhaustive traversal-limit tests and causal tracing remain open.

### Ownership limits and pending work

Ownership evidence includes frozen `limits` and `visited` counts for components,
surfaces and paint entries. Completeness applies only to the bound canvas traversal.
A subscriber outside that canvas can have `owner: null` even when the traversal is
complete. A known subscriber after a traversal cutoff also remains present with an
unknown owner; it is never converted into an absent subscription.

Public-API tests cover 261 root components with the last consumer beyond the
256-component budget, 65 Layers with only 63 visited after the root consumes one
of 64 surface slots, and a signal shared across two independent canvases. Pending
write evidence preserves component identity and the old committed render generation
while requested revision advances. After scheduled rendering, revisions settle and
the consumer becomes clean; the earlier snapshot is unchanged. These are temporal
observations, not proof of a complete causal path or exact repaint coverage.

### Equality barriers and dynamic branches

The signal observation tests compare source/computed revisions, recorded dependency
versions, subscriber dirtiness, owning surface generation, explicit application
evaluation counters and independent Canvas pixels. With a fixed 100×100 viewport,
a source update that leaves computed color equal validates without component
evaluation or repaint; a later changed color advances rendering and changes a
known interior pixel from red to blue. An equal source write leaves the observed
snapshot unchanged.

A second public scene switches between two equal-valued branches. Dependency and
observer records move to the selected source despite the unchanged computed
revision and render generation. Updating the detached source schedules no frame;
updating the selected source changes computed revision, surface generation and
painted extent. Saved earlier dependencies remain intact.

These checks are controlled experiments with known writes and independent
application counters. An unchanged snapshot alone cannot prove that an equality
callback ran, distinguish no write from a suppressed write, or attribute a repaint
to one of several intervening writes. General causal/event history remains open.

## Passive scheduler observation

`observeScheduler()` returns schema `pibbl-scheduler-observation/1`, scoped to the
loaded runtime realm. Signal snapshots include the same record under `scheduler`.
It reports current phase, current frame ID/host/logical time (null outside a frame),
pending host frames and computed validations, registered/dirty roots, dirty
instances, registered advance participants, queued Begin commands and completion
counts. The copied record, work counts and frame are frozen. No callback, collector,
listener, frame request, formula evaluation or scheduler advancement is installed.

Advance participants are registration counts, not proof that every registration is
actively animating. Counts describe scheduler-owned work and are not all disjoint.
Application readiness is explicitly unknown and external tasks are unobserved.
Zero queued Pibbl work does not establish asset/fetch/browser-task completion or
whole-page readiness. Frame host time and logical time remain distinct.

The payload has fixed size, but the existing runtime counter implementation scans
queued instance work and walks root ancestry to deduplicate dirty roots. Observation
is not claimed constant-time or subject to a strict traversal budget. A bounded
phase history, per-request causes, participating-root identities, and broader
phase/failure evidence remain open.

A public scene test samples observation from computed validation and component
evaluation, correlating Plan and Render with the same frame. It checks queued
work before execution, pending computed validation, unchanged request counts after
repeated inspection, immutable saved records, idle completion and root cleanup.
The native targeting replay checks schema/scope/frame semantics on settled fixture
evidence without treating scheduler idleness as its readiness predicate.

## Explicit bounded scheduler phase recording

`createSchedulerHistory(capacity = 128)` installs an exclusive source-only
collector. Capacity must be an integer from 1 through 1024. It never requests a
frame. Ordinary `observeScheduler()` and signal inspection do not start recording.
The runtime emits phase-entry facts only while a collector is installed, retaining
no production history. Begin, Advance, Commit, Plan, Render, Complete and return
to idle share a frame ID and separate host/logical times.

The recorder stores immutable scalar records in a fixed-capacity circular buffer
with constant-time insertion. `snapshot()` copies them in sequence order and
reports overwritten entries as `dropped`; a truncated buffer may begin mid-frame.
`stop()` releases the collector and retains evidence; `dispose()` releases it and
clears history. Both are idempotent. Collector conflicts throw instead of silently
replacing existing diagnostics, and an exclusive recording also rejects later
collector replacement. No user signal value, error object or callback is retained.

These are phase-entry records, not durations or success assertions. Idle is
recorded before next-work promotion and aggregate error delivery; it does not prove
that a frame succeeded or that another frame is unnecessary. Recording can begin
mid-frame. Per-request causes, specific root participation, failure outcomes and
phase-to-surface generation correlation remain separate work.

In the targeting lab, choose Start phase recording, trigger a state change, and
Inspect target. Read `schedulerHistory`; Stop phase recording preserves it. Starting
again clears the previous recording, and fixture disposal releases the collector.
Recording is independent of the passive inspection enable/disable controls.
Native replay verifies complete phase sequences for the seeded, repaired and
intentional-block interactions, then explicitly stops the recorder.

### Collected scheduler errors

Idle records additionally expose `errorCount` and `outcome`: `errors-collected` or
`no-collected-errors`. Earlier phase entries use null for both, since the frame
has not completed collecting failures. The count is the number of entries in the
scheduler's error collection, not a recursive count of nested AggregateErrors.
No exception, message, stack or user payload is inspected or retained.

This summary is captured after Complete cleanup and before aggregate error
delivery. It describes scheduler-collected failures only; no collected errors is
not application correctness, browser presentation success, or whole-page readiness.
An abrupt failure that never reaches idle has no final summary and must not be
read as zero errors. Per-error phases, root identity and source correlation remain
open.

A public two-canvas test makes one component throw while the other changes a solid
rectangle from red to blue. The original error is delivered, the unrelated canvas
paints, and all seven phases end with one collected error. Earlier zero-error
history stays immutable and serialized evidence excludes the private message.
Native replay checks zero collected errors for its tested interactions.

### Error counts at phase boundaries

Every phase record includes `collectedErrors`, the cumulative number of scheduler
error entries at that boundary. For adjacent records in the same frame, an
increase from Render entry to Complete entry identifies errors collected during
Render; an increase from Complete entry to idle identifies Complete failures.
This is phase-interval evidence, not error identity or original throw location.
Deferred error delivery and nested aggregate counts keep their existing semantics.

Never subtract across frame IDs or infer a missing boundary after buffer
truncation. A new frame begins with its own zero count. The final idle `errorCount`
and outcome remain the completed collection summary; earlier outcomes remain null.
Public two-root evidence checks Render failure with continued unrelated painting.
An additional internal completion-queue test verifies Complete failure with
continued unrelated callbacks and an empty completion queue afterward.

### Complete and partial frame summaries

History snapshots include immutable `frames` summaries derived only from retained
records. Each summary exposes frame/time identity, first/last sequence,
complete/partial status, missing-start/end flags, final outcome/count if idle was
observed, and `phaseErrors` for Begin through Complete. Complete means all seven
phase entries are retained in order with contiguous recorder sequences. It does
not mean the application frame succeeded.

A phase error count is derived only from adjacent expected phase boundaries in
the same frame with consecutive sequences and nondecreasing cumulative counts.
Missing evidence yields null. An idle record can establish the final collected
count even when the frame's start was dropped; without idle, the final count and
outcome stay null. Summaries neither bridge frames nor manufacture missing phases.
They are computed on snapshot within the bounded retained-record capacity.

Tests exercise a circular buffer retaining the end of one frame and all of the
next, starting recording during Render, stopping during Render, and independent
Render/Complete failures. Native replay validates complete zero-error summaries.

### Transaction failure evidence

Controlled scheduler tests combine public signal-backed rectangles with internal
Begin/Advance admission seams. They stage one failing and one successful writer,
inspect during staging, and independently compare published values, revisions and
Canvas pixels after error delivery. Inspection shows the last published value;
failed writer stages disappear while unrelated successful stages commit. Phase
summaries identify Begin versus Advance collection, and no host frame remains.

A separate Commit validation case makes an equality callback throw after another
candidate has already been examined. Neither candidate publishes, signal/owner
snapshots stay unchanged and neither rectangle expands. Repeated inspection calls
do not invoke equality. This case is distinct from observer failure after values
have already published; the latter still needs dedicated diagnostic evidence.

These are controlled tests, not a general staged-value inspector or writer
provenance trace. Stage admission uses internal test seams; rendering and final
value assertions use public Pibbl behavior and independent pixels.

### Commit application versus notification failure

Phase records expose `commitApplied`: null through Commit entry, then the runtime's
known batch-application result from Plan onward. Frame summaries preserve the
latest available result, including partial frames with a retained post-Commit
boundary. True means the batch reached its application acknowledgement; empty or
equality-suppressed batches also report true. It does not prove any particular
signal changed, that rendering succeeded, or that pixels were presented.

A pre-publication equality failure reports false and leaves all values unchanged.
A notification failure after publication reports true plus a collected Commit
error. A controlled public-Canvas scene with an internal throwing observer verifies
both changed signal revisions and both independently sampled rectangles despite
that error. Observer errors preserve the runtime's AggregateError delivery, while
history retains only counts and booleans. General per-writer publication outcomes
and source/error identity remain outside this facet.

## Mounted component identities

Canvas-bound signal inspection includes `ownership.components`: a separate bounded
list of mounted component records, including components without subscriptions or
paint. Each record contains session-local lifetime `componentId`, function identity
`typeId`, owning surface ID/kind, bounded runtime path with truncation flag, observed
component render generation, and whether a signal consumer currently exists.
The list has its own 64-record limit and completeness flag; the existing ownership
scan limits still apply. It does not enumerate props or application payloads.

`inspector.identifyType(componentFunction)` returns the matching opaque type ID, or
null for non-functions/disposed inspection. Identification uses weak keys and never
reads function names or descriptors, invokes the function, or changes lifecycle
keys. A proxy component test makes property/descriptor traps throw after mounting
and verifies inspection invokes neither. Type IDs and lifetime IDs are distinct;
private runtime paths are display evidence, not supported application selectors.

A public keyed-reorder/removal/remount scene uses an independent `useConst` mount
counter to corroborate stable lifetime IDs across reorder and new IDs on remount.
An empty component appears even without paint. No claim is made that every listed
component paints, that a type ID names a source location, or that this flat list
represents logical/event/paint ancestry. Application labels, ancestry, source
correlation, broader identity transitions and historical tombstones remain open.

### Component parent and surface host relations

Component records separately expose `componentParent` (Pibbl's recorded component
parent) and `surfaceHost` (the Layer component hosting a nested Canvas instance).
Each is a frozen `{status, componentId}` relation: observed endpoints refer to
records in the same snapshot; absent links are `none`; endpoints outside the
returned record set are `outside-snapshot` with null ID. A second bounded pass
resolves links after collecting records, so resolution does not depend on scan
order or accidentally use an ID retained only from an earlier snapshot.

The root surface has no surface host. A Layer component belongs to its parent's
surface, while components in its nested surface point separately to that Layer as
host. These fields preserve the runtime boundary; they do not manufacture one
ancestry order from component, event, focus and paint relationships. They also do
not expose parent application props or invoke user functions.

A public Parent/Group/Layer/Leaf scene verifies direct component links and the
distinct cross-surface host, including frozen relations and endpoint membership.
Native replay validates returned links and a nested Layer host. Event ancestry,
focus order, source ancestry and broader reparenting behavior remain separate.

### Explicit source capture

`createSignalInspector(canvas).captureSource(element)` explicitly acquires the
source metadata supplied to `jsxDEV` for that descriptor. It may invoke source
getters or proxy traps; do not treat acquisition as passive inspection. No source
metadata is read automatically by `snapshot()`. Component records report
`source.status: "not-captured"` when metadata exists but has not been acquired,
and `"missing"` when the descriptor has no development source metadata (including
ordinary `createElement` and production JSX construction).

Successful capture copies only file name, line and column into a frozen record.
It reports `provenance: "jsx-development-callsite"` and `sourceMap: "unverified"`:
this is supplied callsite metadata, not proof of a component definition location,
file existence, source-map accuracy, or trusted input. No file is opened. File
names must contain 1–1024 UTF-16 code units; line and column must be positive safe
integers. Invalid metadata reports `invalid`; throwing reads report `unreadable`
without copying the thrown payload. Acquisition is limited to 64 distinct source
objects per inspector lifetime, including failures; excess requests return
`limit` without reading the object. Repeated capture returns the original saved
record and does not re-read mutable source objects. Disposal clears this weak
registry and subsequent capture returns `disposed`.

Source records are keyed weakly by metadata object. Descriptors sharing that
object share its capture; they still have separate component lifetime identities.
Passive mounted-component snapshots use that registry without invoking getters,
proxy traps, component functions, or source-map resolvers. The fixture offers an explicit **Capture source locations** action. Automatic
capture and source-map resolution remain open.

`captureComponentSource({session, componentId, renderGeneration})` acquires a
location without requiring the original descriptor. Use the session and component
record from the inspector's latest snapshot. At most 64 weak component/surface
handles are kept, replaced on each snapshot and cleared on disposal. Acquisition
rejects wrong sessions, omitted/unknown handles, removed components, changed
component render generations, disposed surfaces and replaced root mounts with
`stale`. It rechecks identity and generation after reading metadata, since active
acquisition may run application code. A disposed inspector returns `disposed`.
Stale means the handle cannot be used, not proof of why it became unusable.

At `http://127.0.0.1:5195/#/testing/agent-targeting-verification`, choose **Inspect
target**, then **Capture source locations**. The signal-inspection component
records show captured callsites; the direct-authored root correctly remains
`missing`. This is a source-runtime tool, not a production package export.

### Sampled component removal history

`ownership.components.removals` contains at most 64 frozen
`{componentId, reason: "component-disposed"}` records, with `limit`, `dropped`
(evicted confirmed records) and `scope: "previous-snapshot-handles"`. Before
replacing its latest weak handle set, the inspector checks the previous set for
Pibbl's explicit closed teardown flag, while the original bound root remains live.
Only that positive evidence adds a removal record. Snapshot omission, truncation,
unknown handles and unavailable weak references do not prove removal. Repeated
snapshots do not duplicate a removal. No descriptor, props, source object,
component function or component reference is stored in these historical records.
Disposal clears history and counters; previously returned frozen snapshots remain
independent evidence.

This is sampled evidence, not a complete mount/unmount event stream. A component
that becomes unobserved and is then removed, one created and removed between
snapshots, or one collected before its closed flag can be observed may leave no
record. Root disposal/replacement makes the bound observation unavailable; this
history does not infer per-component teardown from that transition. A zero
`dropped` count does not mean every removal was observed. This intentionally uses
no runtime lifecycle subscription and does not keep removed components alive.

### Deliberate component labels

`labelComponent({session, componentId, renderGeneration}, label)` assigns a
caller-provided inspection label to that mounted component lifetime. Pass `null`
to clear it. Labels are exact, case-sensitive strings of 1–128 UTF-16 code units;
invalid input is rejected rather than coerced or silently truncated. Each
inspector accepts at most 64 distinct labeled lifetimes. Relabeling or clearing a
previously labeled lifetime does not consume another slot, but clearing does not
refund the lifetime budget. Results distinguish `labeled`, `cleared`, `invalid`,
`limit`, `stale` and `disposed`. Labels use weak identity storage and disappear
with the component; they are never passed as JSX keys or written to application
props. They do not preserve identity across remounts.

`findComponents(label)` takes a fresh bounded component snapshot and returns all
matching component records, the inspector session, query status, completeness and
`scope: "inspector-component-labels"`. Each labeled record contains its value,
`matchesInSnapshot`, and `uniqueness`. Two observed matches prove `duplicate`;
one match is `unique` only when the component snapshot is complete, otherwise
`unknown`. An empty truncated result does not prove absence. Queries remain
passive, do not inspect arbitrary application props, and never pick a winner for
duplicate labels. They replace the latest weak component handle set just like a
normal snapshot. Duplicate scope is this inspector's explicitly assigned labels
within its bound Canvas and nested Canvas surfaces, not all application entities.

The targeting fixture deliberately labels its known root component
`targeting-scene` after mounting and after re-enabling inspection. This demonstrates
application-provided naming without private runtime-path selectors. Declarative
label authoring, entity-to-multiple-component mappings and cross-session label
persistence remain unimplemented.

### Semantic component comparison

`compareComponents(before, after)` accepts original frozen snapshots returned by
this inspector, in observation order. A private weak registry recognizes them
without reading foreign objects or invoking proxy traps. Cloned/deserialized or
other-inspector snapshots return `invalid-snapshot`; reversed observations return
`invalid-order`; disposed inspectors return `disposed`. Unavailable bound-root
observations return `unavailable` with no inferred removals. No application work is
performed during comparison.

The bounded result contains at most 128 changes, sorted by component lifetime ID.
It compares type, surface, parent/host relations, signal-consumer presence, label
facts and captured source facts. Runtime paths and render generations alone do not
produce changes. Shared IDs produce `changed` with explicit field names. Absent IDs
produce `added` or `removed` only when the opposite snapshot was complete;
otherwise they are `newly-observed` or `unobserved`. Overall completeness is partial
if either snapshot was truncated. This does not establish why a component remounted,
link replacement entities, compare application props/state, or assert paint/frame
success. It compares observed component facts, not arbitrary application meaning.

The targeting fixture publishes `componentChanges` on **Inspect target**, comparing
with its previous explicit inspection. The first inspection and the first after
re-enabling inspection return null. To see a structural change, inspect, choose
**Keyboard focus**, and inspect again. Returned differences identify added and
removed component lifetimes without relying on a screenshot comparison.

## Weighted aggregation diagnosis and repair

In the visualization test lab, **Inject wrong average** deliberately computes
unweighted means while the declared application intent remains weighted means.
Its group evidence exposes values 20/20 alongside weighted sums 40/120 and
weight sums 4/4. **Weighted aggregation** repairs the calculation to 10/30.
At x=2.5 the hover changes from 20 to 15 without changing plot allocation.

The native replay requires both actions and saves independent expected values,
observed evidence, generations and anchor coordinates. A passing injected-defect
step means the known defect was detected; it does not approve the wrong result.
This is a controlled application fixture using public signals and visualization
APIs, not a general aggregation API or automatic causal diagnosis system.

## Optional Three picking copy measurement

Run `node tooling/agent-verification/benchmark-three-picking.mjs` with Node 24.15
or newer to record CPU snapshot-copy durations for shared and unique synthetic
geometry. An optional first argument supplies a fresh output directory. Reports
retain raw samples, environment, snapshot source hash and geometry-byte counts.
This is excluded from correctness gates. It does not measure browser frame time,
GPU work, hit-test cost, total memory, or acceptable performance for your app.

## Structured layout error evidence

`describeReplayError` preserves a reported LayoutDiagnostic's component, property,
algorithm, suppliedValue and constraints under `layoutDiagnostic`. Ordinary errors
use null. This recognizes the reported own name field; it is not an authenticity
or class-identity guarantee. Fields use the same bounded descriptor-only encoder
as assertion values, including omission markers, nonfinite number tags and no
getter/toJSON invocation. Browser-transmitted errors that have already lost their
custom properties cannot be reconstructed by this serializer. Source/generation
correlation and end-to-end transport of those fields remain separate work.

## Failure classification without custom conversion

Both replay entry points use `recordReplayFailure` to encode a thrown value before
classifying it. Classification uses explicit identity-error codes and the execution stage; it does not call
custom toString or Symbol.toPrimitive. Known browser transport failure takes
precedence over blocked setup/navigation. Primary failure action IDs remain
separate from the last completed action. Cleanup and checkpoint summaries also
use descriptor-only error encoding rather than arbitrary string conversion.
Fixture identity failures carry `PIBBL_FIXTURE_IDENTITY_UNAVAILABLE` or
`PIBBL_FIXTURE_IDENTITY_MISMATCH`. Similar wording in an ordinary application error
does not classify it as blocked. These codes describe local harness failures,
not authenticated claims from arbitrary applications.

## Passive reaction classification

Direct subscribers identify Pibbl-owned reaction consumers using an own data
marker. Their session consumer identity persists when dynamic dependencies move
between registered signals. Inspection never runs setup or cleanup, and reaction
reads are not reported as render dependencies. `dirty` remains null: the render
dirtiness field is not a reaction scheduling claim. Reaction owners resolve through the existing bounded component traversal of the
bound Canvas, including managed Layers. Other roots and excluded components keep
null ownership; null does not establish that no owner exists. Owner debugName is
the bounded runtime path, not the reaction callback name. Component IDs join the
existing explicitly acquired source/label records. Pending generation and
setup/cleanup history remain unavailable in this facet.

## JSON-safe exceptional values

Assertion details encode negative zero as `{ type: 'negative-zero' }`, nonfinite
numbers as `{ type: 'nonfinite', value: 'NaN' | 'Infinity' | '-Infinity' }`,
undefined as `{ type: 'undefined' }` and absent array entries as
`{ type: 'absent' }`. Null and ordinary finite numbers retain their values.
Array holes are observed through own descriptors, without inherited getters.
Objects are structurally wrapped, so application objects resembling these tags
are not confused with scalar tags. Existing cycle/unsupported omission markers
remain explicit; this is bounded diagnostic encoding, not object reconstruction.

Signal previews use `kind: 'special-number'` with the string `-0`, `NaN`,
`Infinity` or `-Infinity`; ordinary finite values retain `kind: 'scalar'`.
Consumers must branch on the tag rather than interpreting all previews as numbers.
This source-only prototype change does not establish a general schema migration
policy or guarantee special-value preservation in unrelated evidence producers.

## Focus policy and directional scope

A recognized committed Pibbl focus manager reports `policy.kind` as
`pibbl-focus-management`, Tab behavior as `source-order-exit`, and keyboard
activation as `enter-space`. These describe the available defaults; handlers can
prevent them, so this is not a prediction that an individual key will act.
Unconfigured or unavailable focus reports null policy with its distinct status.

Each bounded committed candidate has a session-local `directionalBoundaryId`, or
null when no directional boundary applies. Equal IDs identify the same boundary;
IDs are not source order, application IDs, or portable across inspection sessions.
The weak identity map does not retain boundaries after application teardown.
This reports membership, not candidate ranking, enrollment reasons, or the full
boundary hierarchy. Hidden or empty boundaries are not discovered from candidates.

## Requested versus observed page environment

Both replay entry points record `run.environment.observedPage` after navigation,
before scenario actions. It contains page-reported CSS viewport, device pixel
ratio, language, timezone, dark/reduced-motion preferences and visual viewport
scale. Requested Playwright settings remain separately in `browserContext`.
Browser version remains the report's browser field; Node platform is not a browser
OS attestation. Browser zoom is explicitly unavailable: visual viewport scale
cannot establish desktop browser zoom.

This is a single initial observation, not continuous monitoring. Page scripts may
alter these APIs, so its scope is `page-reported-at-capture`. A closed/unreadable
page produces unavailable evidence with a bounded failure, never invented values.
It is optional diagnostic evidence, not an additional application readiness gate.
The existing comparison requires equal recorded environment objects; no volatile
capture timestamp is inserted into the environment comparison keys.

## Ordinary Canvas partial-frame failure

A failed ordinary Canvas render does not restore the preceding bitmap. A controlled
public-API fixture first paints a blue canvas, then clears and paints a red prefix
before a later component throws. Native pixel reads prove the red prefix remains
and the rest is transparent. The targeting snapshot reports pending work with no
current surface geometry or targeting records; scheduler history records the
Render error. A saved earlier ready snapshot remains historical evidence, not a
claim that its pixels are still displayed. Explicit recovery repaints blue.

Use error history and raster evidence together. Pending alone cannot distinguish
failed work from ordinary queued work, and realm error counts do not identify a
particular root. The fixture does not generalize to filter/external-layer commit
boundaries or prove which pixels arbitrary application drawing changed.

Cross-run comparison validates any recorded `observedPage` before comparing it.
Equal unavailable records or malformed values are incomparable; matching error
messages cannot establish matching browser conditions. Reports without this facet
on both sides retain the explicit `declared-only` environment scope. With valid
observations, scope is `declared-and-initial-page-observation`; differences in any
recorded environment field still reject comparison. Neither scope attests browser
zoom or environment stability throughout the run.

### Page saved action and check summaries

Use `node tooling/agent-verification/evidence-reader.mjs REPORT.json --page checks`
(or `--page actions`) to enumerate records beyond the summary's initial window.
Pass the returned `nextCursor` as the final argument to continue. Each CLI page
contains at most 16 summaries; the imported API accepts `pageSize` from 1 to 32.
Exact action/check detail remains available through `--action` and `--check`.

Cursors bind the collection, page size, offset and SHA-256 of the complete saved
file. Changed bytes return `status: "cursor-expired"` with no records, requiring
an explicit restart. Invalid or mismatched cursors fail rather than restarting.
No server-side snapshot retention is allocated. A cursor is a continuation token,
not an authorization credential; this reader already requires access to the file.

Pages report total, remaining, field truncation and next cursor. Checkpoints label
history `checkpoint-prefix`; final reports label it `not-established` because a
saved report cannot prove that it captured all application history. Pagination
covers saved record summaries only, not omitted live scene nodes or nested oversized
observations. The existing 4 MiB input and 12 KiB summary/page output budgets apply.

### Page committed scene records in source development

`createTargetingInspector(canvas).page()` starts one bounded expansion of the
committed paint ledger; `.page(nextCursor)` continues it. Each page has at most
32 immutable records, retaining at most 256 records and 512 clip references with
the existing depth limit of 16. The ordinary `.snapshot()` budget stays at 64.
The inspector retains only copied observations, not runtime nodes or native paths.

Only one expansion is retained per inspector. Starting another, disposing the
inspector or mount, or changing/requesting a new render expires continuations.
Invalid cursors report `invalid`; expired cursors report `cursor-expired` without
returning another generation's records. Continue only while `nextCursor` exists.
`remaining` describes the retained prefix, not undiscovered scene entries: a final
page can still have `completeness: "truncated"`, `totalRecords: null` and a reason.
This is current committed geometry evidence, not retained application history.
Probes and coordinate conversion retain their existing 64-record observation
scope; an expanded record does not silently expand those operation budgets.

The shared Studio lab demonstrates this at
`http://127.0.0.1:5196/#/testing/agent-targeting-verification`: choose **Show 100
extra targets**, **Start scene query**, then **Next scene page**. Inspect the
`Scene page` state. The 103 committed entries occupy four pages (32/32/32/7).
To demonstrate expiration, start a query, choose **Repair**, then request the next
page. It reports `cursor-expired` with no records. The native targeting replay
retains these pages and the expiration outcome in its `scene-pagination` action.

### Compare explicit runtime identities

The source-only `runtime-identity.ts` helper exports `captureRuntimeBinding()`
and `compareRuntimeBindings(left, right)`. Capture once in each cooperating
participant's own runtime module graph, then compare the live bindings in process.
A helper bundled separately from the application describes that helper's runtime,
not automatically the application's runtime. This is not global runtime discovery.

Comparison distinguishes the same runtime, distinct runtimes in one realm,
separate realms with independent schedulers, inconsistent bindings and unavailable
identity evidence. It separately reports matching/mismatched declared core versions;
matching version strings do not prove API or build compatibility. No runtime or
scheduler function is called, and unknown signals are not treated as proof of a
second runtime. Output is frozen, serializable and contains no runtime references.

Bindings themselves contain live references and must not be serialized. Holding a
binding retains its realm; discard it after comparison. Cross-process/worker JSON
cannot establish reference identity. Inputs are explicit cooperating-runtime data,
not a security attestation or an arbitrary-object/Proxy sandbox. Descriptor reads
reject accessors without invoking getters. Peer-package compatibility policy and
automatic application/inspector handshake remain separate integration work.

Use `createRuntimeCheckedInspector(canvas, applicationBinding)` from
`runtime-inspection.ts` for an opt-in checked targeting session. A matching binding
returns `status: "accepted"` and an inspector; dispose that inspector when done.
Acceptance establishes module identity, not that a Canvas is mounted or ready;
query the inspector's snapshot for those states. Refusal returns `status: "blocked"`,
`inspector: null`, a serializable diagnostic and a repair direction. In particular,
separate realms require creating the inspector inside the application realm.
The function does not retain the supplied application binding or create a targeting
inspector on refusal. The targeting lab now uses this wrapper and publishes Runtime compatibility in its
state. Its binding includes the actual application pibbl function, so a different
application module resolution cannot silently compare inspector identity with itself.

### Audit official core peer requirements

`node tooling/agent-verification/core-peer-compatibility.mjs [REPOSITORY]` reads
core and the five official peer manifests (Three, viz, particles, physics and
textures), reports each declared core requirement against the observed core version,
and records SHA-256 provenance for all six files. It runs in
`test:agent-verification:identity` and exits nonzero for incompatibility or unavailable
compatibility evidence. It never installs or executes a package.

Current official core peer declarations are exact numeric release pins. Other
range forms report unavailable, rather than being treated as compatible by a
partial semver parser. A package's own version is not substituted for its peer
requirement. This audits the specified repository manifests only: installed graph
resolution, other peers (such as Three.js), and live runtime identity are separate
observations. Input is bounded to six 64 KiB manifest files; the direct audit helper
accepts 1–32 uniquely named peer manifests.

### Inspect resolved consumer peer dependencies

`node tooling/agent-verification/installed-peers.mjs [CONSUMER_PACKAGE_JSON ...]`
audits up to 16 explicit consumer manifests and 128 declared peer dependencies.
With no arguments it checks the five official Pibbl consumer packages. It resolves
from each consumer using Node's require/default conditions, reads the resolved
package manifest without importing its code, and checks the declared range with
`semver`. Reports retain consumer and resolved-manifest hashes and real paths.
This command also runs in the identity gate.

Missing required peers, incompatible versions, unsupported ranges and unavailable
resolution fail the command. Optional absence is accepted only after bounded lookup
confirms no installed package: a broken installed optional export is unavailable,
not absent. Physical core installations are deduplicated by real path and reported
separately. Multiple installations do not prove that multiple runtimes were loaded;
use the live binding check for that. Browser/import-condition resolution, loaders,
PnP and dynamically loaded dependencies are outside this Node-resolution receipt.

## Redacted text call evidence

`createTextRecorder(context, { capacity, fixtureText })` from `text.ts` is opt-in
source tooling that temporarily wraps one native context's fillText/strokeText.
The default history is 64 calls, with a maximum of 256. An explicit allowlist
contains at most 16 exact strings of at most 256 UTF-16 units each. Other inputs
are redacted without exporting their length, prefix, hash or coerced value.
Native conversion occurs only in the original drawing method.

Snapshots contain call positions and alignment/baseline, not glyph bounds or
visible pixels. Font attribution is unknown; clipping and other contexts,
including Layer/filter surfaces, are not observed. Complete refers only to the
retained call stream; truncation and observation failures are explicit. Native
drawing errors propagate; observation errors are counted without their messages
and do not turn successful drawing into a failure. Stop restores owned methods;
dispose clears retained evidence. This instrumentation changes method identity
while active and is not passive inspection or a security sandbox.

Focused check: `corepack pnpm@11.21.0 exec vitest run packages/core/test/agent-text-observation.test.ts --browser.headless --browser.ui=false`.
The shared Studio lab is `#/testing/agent-text-verification`. Seeded text says
Revenue: 24; its independent expectation is Revenue: 42. Repair changes the
assertion from fail to pass. Private fixture text stays redacted in the evidence
panel even though the application intentionally paints it. Overlapping actions
are rejected; pending/disposed captures cannot be reported as ready.

Run native verification with `node tooling/agent-verification/text-replay.mjs
http://127.0.0.1:5199/#/testing/agent-text-verification OUTPUT_DIRECTORY` after
starting the source Studio. The replay checks source identity, performs native
repair/seed clicks and requires all 12 declared checks. It validates the entire
bounded payload before retaining it; unexpected fields and private error strings
are excluded from reports and checkpoints. It takes no screenshots. This is a
text-specific evidence boundary, not a claim that screenshots elsewhere redact
Canvas pixels. Recorder snapshots are bounded below 512 KiB even at maximum
capacity with worst-case JSON-escaped allowlisted strings; this fixture's replay
accepts less than 8 KiB per envelope.

Retained browser, Node and native replay evidence lives under
`docs/strategy/agent-verification-evidence/txt-08-*`. TXT-08 is reviewed complete
for explicit fixture text assertions and redacted bounded text evidence. Text
layout, glyph visibility, font arrival and other surfaces remain separate open
requirements.

## Signal mutation diagnosis

The source Studio lab `#/testing/agent-signal-mutation` uses the actual default
Object.is signal equality. Equal no-op is intentional; mutating amount from 10 to
42 on the same object produces a stale display, and replacing the object repairs
it. The fixture records reference equality, before/after amount, signal revision,
component evaluations and an independently specified expected amount. It reads only
its explicit application-owned data; it does not inspect arbitrary object graphs.

Component evaluation is separate from pixel evidence. The focused browser test
independently checks the bar's pixels. The two-host-frame observation window is
finite and bounded by a five-second deadline; it cannot establish that another
action will never repaint the root. Native replay and lifecycle hardening have retained evidence in
`docs/strategy/agent-verification-evidence/sig-14-*`. SIG-14 is reviewed complete
for this declared application diagnosis. Repeated equal writes retain the stale
display; reset and immutable replacement have independently specified outcomes.
The fixture rejects unavailable 2D contexts before scheduling and cancels pending
observations on disposal.

Run `node tooling/agent-verification/signal-mutation-replay.mjs
http://127.0.0.1:5199/#/testing/agent-signal-mutation OUTPUT_DIRECTORY` against the
source Studio. Six native steps require thirty checks. Pixel sampling is an
explicit active readback using independently calculated offsets for the declared
480x180 contain viewport; reports retain logical and backing coordinates. This
separates source publication, component evaluation and pixels and avoids assuming
that CSS display dimensions equal logical coordinates.

## Bounded saved-field queries

The reader supports targeting, visualization, text and signal-mutation replay v1
reports and their checkpoints. `sourceSchema` identifies the saved report; the
view's `verification: saved-evidence-only` does not certify its claims. Comparison
is a separate operation and still refuses unsupported replay kinds.

For example, read only the repaired amount and its diagnosis:

```sh
node tooling/agent-verification/evidence-reader.mjs docs/strategy/agent-verification-evidence/sig-14-replay.json --action replacement --fields '["/state/sourceAmount","/state/evaluatedAmount","/state/diagnosis"]'
```

`--fields` accepts 1–16 unique JSON pointers under the selected action or check,
each up to 512 UTF-16 units and 16 segments. Standard `~0` and `~1` escaping is
supported. Traversal uses only own JSON fields; array segments select indices.
Absent fields remain distinct from null. Scalars are returned directly; strings
over 1,024 units carry explicit truncation and original length. Negative zero
and nonfinite parsed numbers use a `special-number` tag. Arrays return their
length; objects return counts and up to eight bounded key hints. Select a deeper
pointer to retrieve a particular member. No unrelated values are expanded.

Projection outputs stay within 64 KiB or reject with a budget code, including
JSON escape overhead. Source files still have a 4 MiB read/parse budget; this is
saved-file retrieval, not a streaming file index or a live application query.
The snapshot hash binds the view to exact source bytes. Cross-read changes must
be checked using that hash; paging continues to enforce cursor expiration.

CLI failures include machine codes for unsupported schema/query, malformed
evidence, invalid selectors/cursors, no match, ambiguous match and exceeded
budgets. Future schema versions are rejected; unknown check outcomes are not
converted into passes. Redacted failure reasons and stages remain visible.

`node tooling/agent-verification/discover.mjs TXT-08` and the equivalent SIG-14
query now return the shared lab, independent expectations, check/replay recipe
and field-query examples. Discovery does not execute a recipe or certify a result.

## Mixed-validity visualization fixture

In `#/testing/viz-hover-lab`, choose **Zero, missing and invalid values**. The
controlled first series retains zero at x=1 and breaks the line/interpolation
across null, undefined, NaN and positive/negative infinity. Its finite points
resume at x=8; interpolation at x=9 is 25. The second series remains independent.

Generation-bound `missingness` evidence records ten source rows as five finite
values (one zero), two missing and three invalid. Explicit category tags preserve
null/undefined/nonfinite distinctions through JSON. Replacing the dataset clears
this policy evidence; changing hover mode keeps it for the same generation.

The focused `agent-viz-missingness.test.ts` workflow tests 1000- and 375-pixel plots,
native hover, zero preservation, non-bridging gaps, subsequent interpolation and
two independent pixel regions. Actual tooltip-label evidence and a retained native
replay of this new mode remain before DAT-07 closure.

## Layout and mixed-value workflow discovery

`node tooling/agent-verification/discover.mjs LAY-02` (or `LAY-06`) returns the
layout lab, independent expected root coordinates, browser check command and
native smoke recipe. The smoke requires a new report file path and produces
`pibbl-layout-studio-smoke/1`. The shared evidence reader supports its summaries,
action details, content-bound pages and bounded field projections. Every view
reports `attestation: not-provided-by-schema`; missing action statuses remain null.
Its `steps[].before` and `steps[].after` are controlled local observations, not
verified build identity. Run/check manifests and checkpoint wrappers are rejected
for this smoke schema. A saved smoke error remains visible in the summary.

`node tooling/agent-verification/discover.mjs DAT-07` returns the mixed zero,
missing and nonfinite-value workflow. Its native recipe runs the complete
visualization replay. Its saved report supports the shared evidence reader's
`zero-missing-invalid` action and bounded scalar projections into
`/observations/0/state/missingness/counts/zero`, `/missing` and `/invalid` under
that same `counts` parent. Discovery reports ledger status; finding a recipe
never certifies that it ran or that a requirement is complete.

## Bounded application diagnosis and repair — 2026-10-08

The October 1 delivery remains historical. Its inventory stop rule still applies.
This exercise reuses the current `viz-hover-comparison` learning example, with a
small cooperating application in `chart-application.ts`. It adds no catalog lab,
public runtime API, inspector, schema family, or requirement closure.

From the repository root, use Node 24.15.0 and pnpm 11.21.0:

```sh
corepack pnpm@11.21.0 studio:dev --host 127.0.0.1 --port 5199
```

The original interactive example is at
<http://127.0.0.1:5199/#/examples/composition/viz-hover-comparison>.
In a second terminal, run the controlled application against that source Studio:

```sh
node tooling/agent-verification/chart-application-replay.mjs http://127.0.0.1:5199 /tmp/pibbl-chart-new
node tooling/agent-verification/chart-application-replay.mjs http://127.0.0.1:5199 /tmp/pibbl-chart-manual-new --headed
```

Use a fresh directory for every run. The headed command runs the assertions, then
keeps the browser open with the reused chart, application controls, and a state
panel. Keep the pointer in the plot; press **s** to seed, **r** to repair, **z** to
zoom, **p** to pan, and **h** to reset. Inspect the middle record's source value,
retained hover value, and line segment. Mouse clicks on the controls also work,
but leaving the plot can cause a repaint that masks the stale-publication bug.
The controls are temporary page content installed by this exercise, not a saved
Studio route. Reload restores the ordinary example. No learning-example or
runtime code is changed. Closing the browser ends the headed command.

The fixed dataset contains `(start,0,10)`, `(middle,5,20)`, `(end,10,30)` with
stable IDs. Its update intent is `middle.y = 30`. These expected values and the
independent arithmetic below are declared in the replay, not obtained from the
chart's mapping or query implementation:

- At 1000×620 CSS pixels and density 1, the plot is `(55,175,917,375)`.
  Initial x=5 maps to root x=513.5, y=20 to root y=362.5.
- Zoom halves `[0,10]` around its center to `[2.5,7.5]`; pan adds one to each
  endpoint, producing `[3.5,8.5]`. These are application domain controls using
  public signals, not a test of `zoomDomain`/`panDomain` algorithms.
- After pan, a native pointer at root x=514.5 maps to `6 + 5/917`.
  The nearest record remains `middle`; its local anchor is `917×1.5/5 = 275.1`.
- Initial and repaired line segments at data x=2.5 have y=15 and y=20.
  Two independent 7×7 pixel regions around `(284.25,409.375)` and
  `(284.25,362.5)` distinguish them. Blue-channel thresholds allow antialiasing;
  screenshots are not the oracle.

The focused test was run failing before the repair. The original application
update mutated `rows[1].y` and called `data.set(rows)`. The repair maps to a fresh
array and replaces only the record with ID `middle`, using the public signal API.
The explicit seed command retains the buggy operation for reversible reproduction.

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/test/agent-chart-application.test.ts packages/core/test/agent-viz-verification.test.ts --browser.headless --browser.ui=false
node --test tooling/agent-verification/workflow.test.mjs tooling/agent-verification/evidence-reader.test.mjs tooling/agent-verification/discover.test.mjs
```

Diagnosis separates three kinds of evidence. Application-owned copied rows show
30 after seed. Registered signal inspection shows no version advance, and the
committed targeting generation remains unchanged after a bounded observation of
at least three host frames with a five-second deadline. The retained chart
snapshot still says 20, and pixels remain on the old segment. After immutable
replacement, signal version and completed generation advance, hover reports 30
with the same record ID, and the new segment paints. The chart snapshot callback
runs during evaluation; it is not itself a commit receipt. Settled generation
and independent pixels corroborate it. The source inspector is repository-local
prototype tooling; the application imports only supported public APIs.

Native pointer movement verifies actual hover responses. Target probes are
geometry predictions, not delivered event traces. Outside the plot, both the
probe and actual pointer-leave result indicate no plot inspection. This chart
has no `Clip`; the replay explicitly checks that fact. Its out-of-domain line
paint is not claimed to be clipped. Actual clipping is covered separately by
the existing layout smoke; it does not establish chart-specific clipping.

Saved evidence is under
`docs/strategy/agent-verification-evidence/application-2026-10-08/`:

- `chart-verified/failure.json`: expected application failure, including a
  failing source-versus-hover contract.
- `chart-verified/report.json`: repaired application, navigation, identity,
  pixels, outside targeting, and reset checks; 26 checks pass.
- `test-first-failure.txt` and `chart-application-before.txt`: failing test and
  the application source before repair. `focused-browser-final.txt`: 11 pass.
- `targeting-current`, `viz-current`, `signals-current`, `layout-current.json`:
  fresh existing paths pass (8/23, 22/127, 6/30 actions/checks, and five layout
  modes). Those initial runs used Node 26.9.0; the delivered chart and focused
  browser checks use the documented Node 24.15.0. Chromium is 151.0.7922.34,
  pnpm is 11.21.0. The source Studio server runs under Node 26.9.0.
- `tools-node.txt`: 31 workflow/reader/discovery tests pass; `typecheck.txt`:
  pass. Focused lint passes. Initial sandbox launch and connection failures,
  the mouse-leave masking mistake (`chart-before-repair`), the failing repair
  contract (`chart-failing-contract`), and premature post-pan input
  (`chart-repaired`) remain visible rather than being rewritten as successes.

These next queries have been executed successfully against the retained files:

```sh
node tooling/agent-verification/evidence-reader.mjs docs/strategy/agent-verification-evidence/application-2026-10-08/chart-verified/failure.json --check application.reading-agreement
node tooling/agent-verification/evidence-reader.mjs docs/strategy/agent-verification-evidence/application-2026-10-08/chart-verified/report.json --action immutable-repair --fields '["/state/application/source/1/y","/state/application/rendered/results/0/y","/state/signals/records/0/version","/state/committed/generation/completed","/state/pixels/repairedSegment"]'
```

The existing entry point helps discover and run known reference workflows; the
reader can navigate this saved application evidence using the existing viz report
schema. It neither attaches to arbitrary applications nor determines root cause.
The diagnosis here required explicit application state, source inspection, and
independent probes. Object previews are opaque; target IDs are session-local;
hover identity is a record ID, not a delivered target ID. A finite unchanged
render observation cannot prove that no later input will repaint the root.
A failed post-pan query alone could mean an old committed scale, wrong pointer
coordinates, or stale derived state. Waiting for committed rendering narrowed
that ambiguity here. The report records source hashes but has no fixed-replay
watchdog manifest, dependency/build attestation, or generalized replay guarantee.

The most valuable missing capability is generation-linked paint attribution:
which application series/record and scale produced the visible segment, including
its clip chain. That would reduce the need for application snapshots and bespoke
pixel regions without conflating declared data, committed geometry, and pixels.
No such inspector is built in this exercise.

One aggregate trust attempt outside the sandbox stops at documentation
classification for unrelated brand-output README files (see
`trust-delivered.txt`). The earlier sandbox attempt stopped at a local IPC
permission error (`trust-attempt.txt`). An attributable documentation anchor error in `trust-final.txt` was repaired;
the next aggregate attempt reaches the unrelated classification failure.
No aggregate-green or release-ready claim
is made; unrelated brand/project-plan changes were preserved. This bounded
exercise is complete to the stated scope. Stop here; do not resume the inventory.

## Development-build line attribution — 2026-10-08

The follow-on attribution slice lives entirely in `tooling/line-attribution/`.
Ordinary core and visualization source have no imports of this tooling. The
explicit development compiler plugin adds capture calls to three source modules;
it rejects missing or duplicate source anchors when those modules change.
Published package builds and ordinary Studio builds do not activate the plugin.

Start the dedicated development fixture with Node 24.15.0 and pnpm 11.21.0:

```sh
corepack pnpm@11.21.0 exec vite --config tooling/line-attribution/studio.config.ts --mode inspection --host 127.0.0.1 --port 5201 --strictPort
```

Open <http://127.0.0.1:5201/__pibbl/line-attribution>. Move over the blue line;
use **clip** to reveal its right half, **update** to replace the middle reading,
**zoom** to change the scale, and **fail** followed by **retry**. The fixture uses
public `LineSeries`, `LinearScale`, `Clip`, `Group`, `Overlay`, and signal APIs.
The inspector itself is source-development tooling, with no package export or
application compatibility promise. The dedicated page skips unrelated Studio
catalog/documentation generation and is served only by the explicit development
plugin; it is not an ordinary production Studio route or editor-runtime feature.

The current slice captures direct root Canvas strokes from straight lines with
linear scales, including decorative `pointerEvents="none"` content. It records
mapped points already evaluated by `LineSeries`; inspection never invokes data
accessors again. Captured domain coordinates, source indices, scale domains and
ranges, world transforms, cloned clip paths and fill rules, and stroke settings
belong to the successfully completed root render transaction. Replacement drops
the preceding payload. Failure keeps the previous successful generation as
historical evidence, reports `render-failed`, and refuses geometry queries until
an explicit successful retry. Root disposal clears captured lines, native query
context, pending publication and scale identity references.

`segmentAt(rootPoint)` queries geometric coverage within the captured root
surface, line stroke and clip intersection, using a separate native query
context. The query does not read pixels or change the application's context.
It reports `segment`, `ambiguous`, `clip-excluded`, `surface-excluded`, `miss`, or
`unavailable`. Multiple contributing segments at a shared vertex or stroke
overlap are explicit candidates; no arbitrary record is selected. Among captured
lines, reverse paint order wins. Later non-line paint, alpha, compositing,
filters and external renderer content are not final-pixel occlusion evidence.

A unique segment exposes copied `from`/`to` coordinates and source indices.
`fromSourceReference` and `toSourceReference` are original application objects,
explicitly labeled `live-application-references-not-captured-values`. Mutation
can change those live objects while captured coordinates stay fixed. Snapshots
omit the original objects; the cooperating fixture intentionally serializes its
known records. There is no automatic property walk or stable application-key
extraction. The retained reference count is bounded, but referenced application
object graphs are not copied or size-bounded.

Capture is bounded to 32 lines, 16 clips per line, 1024 combined run-point/segment
slots per line, 64 symbol-scale identities, and eight distinct refusal reasons.
Symbol scale IDs receive session-local serializable identities. Curved lines,
nonlinear scales, offscreen/filter surfaces and encountered managed Layers report
unsupported capture. Cached offscreen content is outside the root-line scope.
Dashed segment and unmatched join coverage report unavailable attribution.
This does not supply general scene discovery, a retained renderer, or automatic
attachment to a separately bundled Studio editor runtime.

Reproduce proportional checks with fresh native output paths:

```sh
corepack pnpm@11.21.0 exec vitest run --config tooling/line-attribution/vitest.config.ts --mode inspection --browser.headless --browser.ui=false
node tooling/line-attribution/replay.mjs http://127.0.0.1:5201/__pibbl/line-attribution /tmp/pibbl-line-new
node tooling/line-attribution/verify-isolation.mjs
corepack pnpm@11.21.0 exec eslint tooling/line-attribution
```

Independent native expectations use the 710×420 root, plot origin `(55,90)`,
600×240 plot, x domain `[0,10]`, y domain `[0,40]`, and the fixed records
`(a,0,10)`, `(b,5,20)`, `(c,10,30)`. Data x=2.5 initially maps to root
`(205,240)`; replacing b.y with 30 moves that segment to `(205,210)`.
Data x=7.5 maps to `(505,180)` and is initially excluded by a 300-unit-wide clip.
Native pixel regions independently confirm initial, replaced and revealed paint;
geometry queries and source numbers supply separate assertions. A failed render
may already have changed immediate-mode Canvas pixels, so the previous attribution
is deliberately unusable as current paint evidence.

The focused browser suite passes three tests: transactional capture/clipping and
repair, vertex ambiguity, and root-surface exclusion. The initial focused contract
and the surface exclusion regression were retained failing before implementation.
The native replay passes 24 checks; review found no remaining material issues in
this scope. Tests also distinguish immutable numeric evidence from mutable source
references and verify release on root disposal. Node 24.15.0, pnpm 11.21.0 and
Playwright Chromium 151.0.7922.34 were used.

The isolation command compares byte-identical ordinary consumer output with the
plugin absent and disabled, under esbuild and Vite, from both current source and
an actual core package tarball. All four comparisons have **zero byte delta**;
esbuild reports zero retained attribution inputs. The packed test uses current
`dist`, records its tarball hash, and does not claim a fresh complete package
build. A positive instrumented build retains the capture helper, demonstrating
that the detector is effective. Enabled instrumentation adds code, allocations
and capture work; the zero-cost claim applies to ordinary uninstrumented builds.
Because attribution changes no shipped renderer source, ordinary consumers run
identical compiled code for this feature. No timing benchmark is substituted for
that structural proof.

Evidence lives under
`docs/strategy/agent-verification-evidence/line-attribution-2026-10-08/`.
`native/report.json` retains all observations; `bundle-isolation.json` records
hashes, sizes and exclusion results; `browser-tests.txt` records focused checks;
`test-first-failure.txt`, `instrumentation-missing-failure.txt`, and
`surface-failure.txt` retain failed attempts. `lint.txt` records focused lint.
`typecheck.txt` records unrelated concurrent inspection-workbench Axis typing
errors; that other work was preserved and is not approved by this slice.
Concurrent core inspection changes are excluded from the attribution-only bundle
delta claim. No aggregate-green or whole-working-tree performance claim is made.

The saved failure query is executable and has been verified:

```sh
node tooling/agent-verification/evidence-reader.mjs docs/strategy/agent-verification-evidence/line-attribution-2026-10-08/native/report.json --action failed-render --fields '["/state/attribution/status","/state/attribution/generation","/state/query/status"]'
```

The focused attribution slice is complete to this scope. The inventory remains
deferred; wider renderer and curve coverage require a separate requested slice.

## Blind repair API research eval — 2026-10-08

This opt-in experiment compares ordinary public API/source/browser evidence with
that same evidence plus the development-only line-attribution prototype. It is
an API improvement exercise, not a release gate. Nothing is added to `trust`,
package scripts, or the inventory. Preserve the delivery cutoff above.

There are three seeded application mistakes and one correct control. The
coordinator-only `tooling/repair-eval/private-cases.mjs` contains their identities
and reference repairs. Do not give it, the judge, this runbook, repository
history, or this conversation to the agents. Reference repairs calibrate the
experiment; they are not evidence of model usefulness.

### Prepare and run one matched comparison

Use Node 24.15+ on Node 24 and the checkout's installed dependencies/Playwright
Chromium. From the repository root:

```sh
node tooling/repair-eval/prepare-pair.mjs case-01 /tmp/pibbl-repair-pair-01
```

Repeat with `case-02`, `case-03`, and `case-04`, using fresh parent directories.
Each pair has identical initial application source and matching hashes of the
actual core source bytes consumed while bundling. Preparation fails if source
changes between arms; discard that pair and prepare again. Runtime bundles are
frozen so later repository edits do not change a trial. `pair.json`,
`initial-app.tsx`, and each child's `trial.json` retain provenance and a source
review baseline. Keep the parent private.

Give a fresh agent **only one child capsule** (`ordinary` or `attribution`) as
its workspace and its `TASK.md` as the request. Start from a new context, not a
fork of this conversation. The capsule uses supported public application APIs;
the assisted harness adds the experimental inspection helper. No installation
is needed. For manual inspection inside either child:

```sh
node serve.mjs 5210
```

Open **http://127.0.0.1:5210/**. Update, Zoom, and Reset controls also accept U,
Z, and R. Reload after editing `app.tsx`. The agent task includes intended
geometry and interactions but no defect diagnosis or hidden scoring locations.
It asks the agent to leave a correct application unchanged and record evidence,
API confusion, missing capabilities, and uncertainties in `observations.json`.

After the agent finishes, from the repository root:

```sh
node tooling/repair-eval/judge.mjs /tmp/pibbl-repair-pair-01/ordinary /tmp/pibbl-repair-pair-01/ordinary-score.json
node tooling/repair-eval/judge.mjs /tmp/pibbl-repair-pair-01/attribution /tmp/pibbl-repair-pair-01/attribution-score.json
```

These are usable next-query commands: each score preserves individual failed
checks, application/evaluated state, actual pixel observations, interaction
identity, browser errors, and runtime integrity. Judge outputs stay outside
agent capsules. Its CLI prints the result without making a failing repair a
CI exit gate. A `blocked` result needs coordinator review (including application
compile errors); it must not be silently counted as a successful repair.

### Blindness and interpretation

This is procedural blinding, not a filesystem security boundary. For a real
comparison, provide isolated workspaces with no access to the repository,
parent directory, opposite arm, answer key, or prior trial context. A discovered
leak invalidates the trial. Capsule servers resolve the provisioned checkout's
esbuild installation; that dependency path is not an isolation mechanism.

Use the same model, settings, tool access, time allowance, and instructions in
both arms, apart from inspection availability. Balance arm order across cases;
randomize assignment and retain the assignment before running. Never let one
agent solve the same case twice. The first pilot is eight fresh agent runs
(four cases × two arms). Replicate before estimating an effect; this small,
synthetic pilot cannot establish general model improvement. Where practical,
have a reviewer assess diagnoses with arm labels removed.

Review both the source diff against the private initial source and the agent
trace. Passing geometry alone does not establish a sound general repair:
reject hardcoded probe answers, modified harnesses, unrelated changes, and
unsupported causal claims. Runtime integrity is checked automatically; other
harness integrity and contract quality require review. The correct control
measures unnecessary edits and invented diagnoses.

The fifteen hidden checks use declared values and independently calculated
linear geometry, exact small pixel regions, native hover input, update without
intervening pointer input, zoom, and reset. They never use attribution output
as the correctness oracle. Application source and evaluated state are
cooperative evidence, not proof of committed pixels; the pixel observations
and actual native interaction checks corroborate them. Screenshots are not the
sole oracle. These probes cover this chart, not arbitrary charts or all clips.

Compare repair correctness, time to first supported hypothesis, time to repair,
edit iterations, unsupported conclusions, unnecessary changes, and evidence
quality. Record timing/tool counts from coordinator logs or transcripts; keep
agent-reported measurements labeled as self-reported and leave unavailable
values missing. Count all browser queries and attribution queries separately.
Prioritize repeated API friction: facts agents could not obtain, confusing
coordinate units or generations, stale versus live data, ambiguous identity,
and the boilerplate needed to connect paint to its source. Preserve concrete
queries and the agent's interpretation alongside proposed API improvements.
A higher pass rate alone does not explain which API helped.

### Calibration and saved evidence

```sh
node tooling/repair-eval/smoke.mjs
corepack pnpm@11.21.0 exec eslint tooling/repair-eval
```

Smoke prepares both arms, observes seeded failures, applies private reference
repairs, and checks them again; it also verifies the clean control passes
unchanged. It removes temporary capsules. On October 8, 2026, all three seeded
cases failed before repair and passed all fifteen checks after repair in both
arms; the control passed before and after. Saved output is in
`docs/strategy/agent-verification-evidence/repair-eval-2026-10-08/`.
No blind agent comparison has been performed yet. This result establishes
fixture/oracle plumbing, not attribution's benefit to agents.

### Automated 80/20 scoring

The opt-in runner now prepares all four matched pairs, alternates arm order,
launches eight fresh ephemeral Codex repair turns, runs the deterministic
oracle, launches a separate structured reviewer for each valid trial, and saves
`results.json` plus per-trial source, traces, observations, reviews and reasons.
It requires the authenticated `codex` CLI and provisioned Chromium:

```sh
node tooling/repair-eval/run.mjs /tmp/pibbl-repair-automated-01
# Optional explicit models: NEW_DIRECTORY REPAIR_MODEL JUDGE_MODEL
node --test tooling/repair-eval/scoring.test.mjs tooling/repair-eval/run.test.mjs
```

The deterministic score is `80 × passing checks / 15`. Agent review supplies
four integer scores from zero to five: supported diagnosis, sound minimal
repair, evidence quality, and honest uncertainty/actionable API friction.
Each criterion requires a written evidence-based reason. Total score is their
sum, rounded to two decimals. `deterministicPassed` remains separate: a high
weighted score must not conceal a functional failure. No release threshold is
introduced.

Repair turns use automatic approval review within the workspace-write sandbox;
review turns use the read-only sandbox. Each turn has a ten-minute bound and
process-group cleanup. Auth, network, approval denial, timeout, invalid judge
JSON, changed harness files, or blocked browser verification produce a blocked,
unscored trial. Partial reports are persisted as work completes. Restart with
a fresh output directory; automatic retries/resumption are deliberately absent
so they cannot silently grant one arm extra attempts.

The reviewer sees initial/final application source, the intended contract,
deterministic observations and the repair trace, not the answer key. Explicit
arm/case labels are omitted from its evidence packet, but tools/paths in a trace
can reveal the arm; this is a separate-context review, not perfect reviewer
blinding. Source and trace content are marked untrusted in the review prompt.
The same model may review by default; pass a distinct judge model when desired.
Agentic scores remain subjective and can vary. Compare criterion reasons as
well as totals, and replicate batches before claiming an uplift.

The runner uses an injectable adapter for orchestration tests. Those tests
validate weighting, review dispatch, saved outputs and blocked handling; they
are not model repair trials. A full eight-trial batch spends authenticated model
usage and may take up to sixteen ten-minute turns. No scheduler or recurring
job is installed; this automation runs once per command.

### Feedback-driven follow-up runs — October 8, 2026

Fresh trials exposed an ambiguous reviewer instruction that forbade tools while
asking the reviewer to read evidence files. Its original low scores are invalid
review observations, not repair failures. The corrected prompt explicitly
permits reading the three supplied files and forbids executing application code,
editing, or reading other files. Review packets now include the agent's API
notes, marked self-reported, and explicitly separate coordinator checks from
verification the repair agent actually performed. The 80/20 weights, fifteen
checks, and four review criteria remain unchanged.

Re-review a completed batch without retrying any repair or overwriting its
original evidence:

```sh
node tooling/repair-eval/rejudge.mjs /tmp/pibbl-repair-batch-20261008-01 /tmp/pibbl-repair-batch-20261008-01-reviewed
```

The prototype's snapshot now labels root query coordinates, line-local captured
positions, local-to-root transforms, live source references, opaque clip paths,
and geometry's distinction from pixels and routed targets. It explicitly labels
the last successful render as potentially lagging application state. These are
query-time development-tooling labels; no published runtime source is changed.
Opaque paths still do not supply serialized clip bounds.

Later fresh trials found browser-import friction and inadequate independent
pixel evidence despite functional repairs. The runner now supplies the correct
CommonJS Playwright import shape. Both arms receive the same general evidence
requirement: derive expected geometry independently, corroborate painted-result
claims with Canvas pixels, use native pointer input for interaction identity,
and state missing evidence. This guidance contains no defect diagnosis, hidden
probe locations, or scoring answers. Capsules are explicitly described as
non-Git workspaces so a failed Git sanity command cannot be mistaken for repair
verification.

Results and original/revised review evidence are saved under
`docs/strategy/agent-verification-evidence/repair-eval-2026-10-08/automated/`.
The baseline and subsequent rounds are distinct experimental conditions, not
independent repetitions of one unchanged experiment. Focused later rounds are
not comparable as whole-suite means. Runtime source receipts and arm order are
retained. Wall-clock durations are observed repair-turn durations; concurrent
runs and tool retries make them unsuitable for controlled performance claims.
Self-reported elapsed time and query counts are not substituted for coordinator
measurements. Default CLI model identities/settings were not pinned explicitly,
so these results must not be presented as a reproducible model-version benchmark.

### Final results after stronger interaction verification

The source-diff audit found an unnecessary edit in the second batch's assisted
clean control. Its agent removed the root-to-plot offset and added reset
batching; its original reviewer praised both. Independent native probes showed
that removing the offset regressed hover. Public pointer x/y are root-logical,
while this chart's scale range is `[0,600]`; subtracting the plot's root origin
was correct. The reset-batching explanation did not establish a preexisting
contract failure. This was an agent/reviewer false positive, not a defective
clean-control fixture.

The first oracle sampled only representative center hover positions. The
strengthened oracle samples both sides of independently calculated nearest-ID
midpoints: root x=204/206 around 205 and x=504/506 around 505. It also samples
zoomed interior x=60/205/355/650, all of which must choose b. These probes live
inside the existing `hover.identity` and `zoom.hover` checks: fifteen equally
weighted deterministic checks and the 80/20 split remain unchanged. Original
center-only results are retained but superseded by rescoring every saved repair.
No repair got another attempt during rescoring. Valid reviews of unchanged
passing outcomes are retained; the newly exposed regression received a fresh
review using the counterevidence.

| Condition | Fresh trials | Ordinary mean | Attribution mean |
| --- | ---: | ---: | ---: |
| Baseline, corrected reviews | 8 | 99.50 | 99.00 |
| Evidence labels and corrected review | 8 | 98.75 | 94.08 |
| Focused clipping/control, browser-import guidance | 4 | 100.00 | 99.00 |
| Final signal pair, temporal labels and pixel guidance | 2 | 100.00 | 100.00 |

Of 22 fresh repairs, 21 pass the strengthened oracle; 328 of 330 checks pass.
Five of six clean controls remain unchanged. The assisted false repair fails
both interaction checks and scores 69.33 deterministic + 11 review = 80.33,
with `deterministicPassed: false`. An 80-point total therefore must never be
interpreted as a functional pass. The old review had scored that trial 99.

This small experiment provides no evidence of a repair-success uplift from
attribution. Both arms solved the three seeded problems; assisted agents used
captured scales, clips and generations, but sometimes substituted them for
pixel evidence or misinterpreted event coordinates. Explicit evidence labels
and pixel guidance improved the final pair's verification, without establishing
a causal or statistical improvement. All ordinary runtime bundles and actual
core source receipts were identical across rounds. No production performance
or bundle-size claim is inferred from trial duration; the separate disabled
bundle-isolation checks show zero byte delta for the tooling changes.

The most useful missing inspection capability is a reliable join between an
actual routed pointer event, its root-to-scale coordinate conversion, and the
committed series generation. Opaque clip geometry also still requires manual
source inspection plus inside/outside probes. The most valuable eval improvement
was independent boundary evidence that can contradict a plausible diagnosis.
No new inspector or public runtime API was built for this follow-up.

Saved `automated/results.json` includes per-trial failed checks, review reasons,
and self-reported API notes. Compressed archives preserve original capsules,
traces, reviews, corrected reviews and rescored evidence; `archives.sha256`
provides checksums. Calibration distinguishes all three seeded faults from the
clean control and rejects the false hover repair:

```sh
node tooling/repair-eval/oracle.check.mjs
node tooling/repair-eval/smoke.mjs
node tooling/repair-eval/rescore.mjs /tmp/pibbl-repair-batch-20261008-02 /tmp/pibbl-repair-new-rescore
node -e 'const r=require("./docs/strategy/agent-verification-evidence/repair-eval-2026-10-08/automated/results.json"); console.log(r.rounds.flatMap(x=>x.trials.filter(t=>!t.deterministicPassed).map(t=>({round:x.id,...t}))))'
```

The last command is the next query for the exposed regression and its reviewer
feedback. The earlier totals of 330/330 and “all six controls unchanged” were
provisional and are explicitly superseded by the source audit and stronger
oracle. The inventory stop rule and non-gating status remain unchanged.
