# Agent targeting verification: first slice

Repository-local, source-mode prototype; no stable public inspection API. Stop
at slice-ready feedback, not feature completion. Base: `4717dc98`; the unrelated
responsive-style work in the original checkout was not copied or modified.

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

From this isolated checkout, with Node 24.15.0 and pnpm 11.21.0:

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
artifacts are `packages/core/test/out/agent-targeting/report.json` and the three
mode screenshots. The report distinguishes successful reproduction of the
seeded failure from successful application behavior. It records source revision,
fixture/tooling fingerprint, browser, Node, viewport, density, generations,
expected/actual fields and native input transport. It is a focused source-mode
manifest, not a fingerprint of every dependency or unrelated checkout change.
Artifacts remain on disk until explicitly removed; reruns overwrite that output
directory, so pass a different directory to retain another run.

Focused public-application and observation checks:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/test/agent-targeting-verification.test.ts packages/core/test/agent-targeting-observation.test.tsx --browser.headless --browser.ui=false
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
CRC's general resolver, app callbacks or signal getters. Nested surfaces,
renderer resolvers and legacy geometry return unsupported. Over-budget requests
return truncated with no predicted winner. This limits record count and native
call count; native Path2D command complexity and per-call duration are unavailable.
No extra surfaces, retained paths, historical scene or pixel provenance are built.
Pixels/visibility remain unavailable to this inspector. The browser's narrow
readback is separate evidence with separate cost.

## Inventory dispositions

| IDs | Disposition in this slice |
| --- | --- |
| INT-01/03/05/08/10 | Application and harness: fixed fixture, independently specified center/color/selection, explicit mode setup and real clicks. |
| QRY-01/02/03/08/09/12/14 | Partial tooling: one root, bounded immutable records, explicit states, generation rejection and separate active probe. No pagination/history or general selectors. |
| ID-01/09 | Partial tooling: inspection-session target identity, exact mount binding and replacement rejection. No general source/entity labeling. |
| HIT-01/02/08/09/12 | Partial tooling plus browser: root paths, hits/misses/clip exclusion, paint-order winner and native delivery agreement. Opted-out objects are absent, not reconstructed. |
| EVT-08/11, PNT-12 | Harness/application: native input, domain selection/count and independently sampled pixels. |
| HAR-07, EVD-04/05/12 | Same manual/headless application; protocol-neutral report and rerun recipe. |
| OBS-01/02/03/04/09/10 | Focused tests: enabled/disabled behavior; repeated reads/probes preserve signal graph counters, evaluation counts, scheduler work, Canvas state and resource ledgers; stale/disposed states; native cross-check. |

Deferred: general layout and visibility diagnosis, semantic IDs/source mapping,
full candidate exclusion explanations, timeline/subscriptions, arbitrary signal
inspection, nested Layers/filters/backends, visualization facets, public package
API, built/packed integration, MCP/transport, broad matrices and aggregate gates.

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
root replacement, nested-surface refusal, clipping, lazy evaluation, ownership,
Canvas state restoration and real seeded/repaired/intentional-block input.

The implementation is ready for experiential feedback once those focused checks
and the Studio replay pass. Broader hardening and aggregate trust remain deferred.
