# Agent verification tooling

Repository-local, development-only inspection tooling; no stable public runtime
API. The targeting, signal, browser-point and visualization slices are integrated
locally with the current checkout. The fixture stays in the internal testing catalog, outside
public learning examples and search. Production and built-runtime Studio
report inspection as unsupported and omit the source inspector.

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

Native replay reports now include `run` (`crc-replay-run/1`) with the same ID as
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

CRC owns its existing paint ledger, geometry, scheduler and event dispatch.
`targeting.ts` is optional repository tooling that reads that ledger; it changes
no runtime file or package export. Applications use only `@crc/core` for their
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
CRC's general resolver, app callbacks or signal getters. Canvas Layers are traversed
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
useReaction. Current `@crc/viz` exports Scale, useScale, Axis, LineSeries and
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

Run visualization replay with `CRC_VERIFY_DENSITY=2` to exercise the same native
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
renderer capture are unavailable in this facet. It reads CRC-owned fields without
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
Inspect to compare the CRC geometric target with the browser hit result, then
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
CRC logical target ID, focus-visible state, and up to 64 committed candidates with
source order and root bounds. It reads only the known CRC focus manager's committed
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

Targeting snapshots include `surface`, copied from CRC's committed root surface.
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
session-local consumer ID, computed/render/other classification, an already
registered computed signal ID when available, the edge's observed version, and
render dirtiness when represented by an own data field. Consumer IDs identify subscriptions within the inspection session. The optional
canvas ownership facet below correlates component consumers; dirtiness is not an
explanation of its cause.

A separate 128-edge budget bounds observer traversal across each snapshot.
Active notification traversal or computed evaluation makes observer evidence
unavailable. Legacy callback flag accessors are never invoked; classification
reads only own data descriptors of CRC-owned consumer records. Registration and
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
exact live CRC mount present at creation. Its `ownership` facet reports scope
`bound-canvas-components` and complete/truncated/unavailable traversal. Without a
canvas, or after disposal/replacement, ownership is unavailable; ordinary registered
signal observation remains separate.

Each observer's nullable `owner` contains session-local numeric component/surface
IDs, a bounded runtime path with an explicit truncation flag, a bounded debug name,
root/Layer surface kind, and current render/requested/completed revisions. Numeric
IDs are separate from truncated display paths. Snapshots are immutable; IDs are
not persistent across inspector sessions and are not source file locations.

Correlation reads CRC-owned component records and uses an internal opaque consumer
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

`observeScheduler()` returns schema `crc-scheduler-observation/1`, scoped to the
loaded runtime realm. Signal snapshots include the same record under `scheduler`.
It reports current phase, current frame ID/host/logical time (null outside a frame),
pending host frames and computed validations, registered/dirty roots, dirty
instances, registered advance participants, queued Begin commands and completion
counts. The copied record, work counts and frame are frozen. No callback, collector,
listener, frame request, formula evaluation or scheduler advancement is installed.

Advance participants are registration counts, not proof that every registration is
actively animating. Counts describe scheduler-owned work and are not all disjoint.
Application readiness is explicitly unknown and external tasks are unobserved.
Zero queued CRC work does not establish asset/fetch/browser-task completion or
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
value assertions use public CRC behavior and independent pixels.

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

Component records separately expose `componentParent` (CRC's recorded component
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
CRC's explicit closed teardown flag, while the original bound root remains live.
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
