# Experimental WASM Flex/Text — 2026-10-21

First feedback delivery, not feature completion. [Plan 010](../../project-plans/010-layout-engine-rework.md)
contains exactly one next slice. Unrelated working-tree changes were preserved.

## Run and inspect

```sh
corepack pnpm@11.21.0 -C playground exec vite --mode layout-wasm --host 127.0.0.1 --port 5187 --strictPort
```

Open http://127.0.0.1:5187/#/examples/layout/wasm-flex-text. Toggle width: the two
paragraph columns narrow and acquire more lines. Paint only: their ink changes
without a solve or measurement. Inspector reads do not schedule Pibbl frames.
Studio remains running for feedback.

Actual Studio/Chromium counters on one fresh mount:

| Action       | Solves | Measured leaves | Node creations | Node reuse observations | Flex-observed root frames |
| ------------ | ------ | --------------- | -------------- | ----------------------- | ------------------------- |
| Mount        | 2      | 4               | 3              | 0                       | 1                         |
| Toggle width | 3      | 8               | 3              | 3                       | 2                         |
| Paint only   | 3      | 8               | 3              | 6                       | 3                         |

Active ownership: three numeric nodes and two region arenas; focused tests assert
return to baseline on disposal and node release when a mounted Flex becomes empty.
Counters are structural observations, not timing or speed claims.

Browser plugin unavailable; used the existing Playwright 1.62.1 Chromium install.
Confirmed page identity/title, meaningful Canvas output, no framework overlay,
no page errors, and both visible controls. Screenshots inspected outside the repo:
`/tmp/pibbl-layout-studio.png`, `/tmp/pibbl-layout-narrow.png`,
`/tmp/pibbl-layout-painted.png`. Studio contains/fits the logical viewport; automated
click coordinates must include letterboxing as well as scaling. Public headless
scenario tests send native mouse down/up/click, matching Pibbl's press targeting.

## Verification

Environment: host Node 26.9.0, pnpm 11.21.0, Rust 1.99.0, Chromium, macOS arm64.
The documented Node 24 installation had missing executable files; these are not
Node 24 trust-gate receipts.

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/test/layout-wasm-slice.test.tsx --mode layout-wasm --browser.headless --browser.ui=false
corepack pnpm@11.21.0 exec vitest run packages/core/test/layout-wasm-slice.test.tsx packages/core/src/lib/layout/flex.test.ts packages/core/test/flex-css-compatibility.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 exec tsc --noEmit
corepack pnpm@11.21.0 -C packages/core build
node tooling/build-layout-wasm.mjs --check
```

WASM lane: 6 passed after focused review fixes. Final production checkpoint:
45 passed, three experimental-only tests skipped. Core build, typecheck,
targeted ESLint, native Rust test and built Node core import passed. No aggregate
trust run or broad browser matrix. Browser commands required sandbox escalation
for local listening/Chromium; permission was granted. No denied action remains.

## Decisions and limits

- Pinned Taffy 0.15.0 source inspected; its geometry/Flex arithmetic use f32.
  Small owned f64 allocator chosen for this experiment. A complete Taffy bridge
  comparison and final solver-provenance decision remain open before full parity.
- Private kernel artifact is 49,803 bytes, embedded as base64, source/binary hashes
  checked by the build script. Module compilation is lazy. No cold/warm timing,
  bundle superiority, or Yoga performance claim yet.
- This slice uses mounted Flex-region arenas under existing component teardown,
  not the eventual unified root graph. Rust owns main-axis numeric allocation;
  the host still normalizes styles, measures Text, and computes cross placement.
- Existing explicit minimum/definite nested sizing restrictions remain. Flex line
  wrapping is explicitly rejected in the experimental lane. Grid and other layout
  families remain unchanged; no silent within-solve algorithm fallback.
- Measurement caching is limited to static Text with generic CSS fonts. Dynamic
  text and custom font configurations use uncached measurement; there is no
  font revision protocol or new reactive subscription system in this slice.
- One reviewer reproduced memory-growth detachment, stale retry results, empty
  region retention, and a paint test that could pass without paint. Fresh output
  views, failure reset, empty reconciliation, and frame/color assertions fix them.
- Remaining hardening: prepared nested intrinsic structures, staged root graph
  transactions, font revisions, Layer allocation ordering, full migration/Yoga
  conformance, packed experimental build support, and controlled timings. No
  standalone package or new public operation was introduced.

## Second feedback delivery: reactive text and computed width

Same Studio URL, now with four additional controls. Slice 1's width/paint controls
remain available. No new public API or graph/scheduler change was needed.

The minimum failing regression used public signal-valued Text and showed a
paint-only update increasing measured leaves from 14 to 16. Text content is now
prepared through its existing transaction-local receiver provision, including on
measurement cache hits; this retains the exact Text's source edges. The bounded
measurement key uses the materialized string. Signal writes and hooks are forbidden
during this preparation. Generic-font restrictions remain; font revisions and custom
font caching remain deferred. This supersedes the earlier static-Text-only limit.

Fresh Chromium Studio interaction evidence:

| Action                                    | Solves | Measurements | Frames |
| ----------------------------------------- | ------ | ------------ | ------ |
| Mount                                     | 2      | 4            | 1      |
| Nudge A: 560 -> 561, used width stays 560 | 2      | 4            | 1      |
| Switch to equal-width B                   | 2      | 4            | 1      |
| Bump inactive A by 40                     | 2      | 4            | 1      |
| Switch back to changed A, used width 600  | 3      | 8            | 2      |
| Long -> short text                        | 3      | 12           | 3      |
| Different text, same one-line height      | 3      | 16           | 4      |
| Paint only                                | 3      | 16           | 5      |

Node creations stayed at three throughout. Page identity/title and sandbox content
were correct; no browser errors were observed. Complete final Canvas screenshot:
`/tmp/pibbl-layout-reactive-canvas.png`. Existing Playwright used because the Browser
plugin is unavailable. Automated public-scenario coverage asserts drawn text,
unchanged work counters on equality/inactive updates, node reuse, actual paint
output, and no response from disposed handlers. Experimental lane: eight tests pass.
One focused review of the changed text preparation path is recorded in the plan.

Slice 2 final proportional verification: production `text.test.ts`,
`text-layout.test.ts`, and `layout-wasm-slice.test.tsx` passed 40 tests with five
experimental-only skips. Root typecheck, targeted ESLint, core build and catalog
validation passed. Same reviewer reused for changed Text cache/ownership code:
no material findings. Its suggested assertion now directly checks a text signal
update after a paint-only cache hit, including actual `UPDATED` Canvas text output.

## Third feedback delivery: keyed lifecycle

Same live URL; existing width, paint, text and computed-source controls preserved.
Private ordinary `Paragraphs` composition maps signal-owned keys onto public Text
leaves. No new runtime API or solver change was required. B has independent content.

The minimum failing public-scenario test first showed that Reverse keys did not
cause the requested update. After the example extension, nine experimental tests
pass. They check reordered paint calls, the same coordinate targeting B before
reorder and A afterward, node reuse, removal subscription cleanup, current-content
restore and disposal ownership. Live Studio evidence:

| Action                     | Solves | Measurements | Created nodes | Active nodes | Frames |
| -------------------------- | ------ | ------------ | ------------- | ------------ | ------ |
| Mount                      | 2      | 4            | 3             | 3            | 1      |
| Shorten A                  | 2      | 6            | 3             | 3            | 2      |
| Reverse A,B -> B,A         | 3      | 6            | 3             | 3            | 3      |
| Remove B                   | 4      | 7            | 3             | 2            | 4      |
| Update absent B            | 4      | 7            | 3             | 2            | 4      |
| Restore B with latest text | 5      | 11           | 4             | 3            | 5      |

Clicking the second column selected B before reverse and A afterward without
requesting a Pibbl paint. Inspector reads occur outside renderer dependency
collection. No browser errors observed. Final Canvas screenshot inspected at
`/tmp/pibbl-layout-keyed-canvas.png`. Generic fonts, nowrap, explicit minimums and
fixed nested sizing remain the experimental bounds.

Three-slice consolidation is now required before capability expansion. It covers
combined control behavior, exact receiver/node ownership, cache/geometry agreement,
one scheduler/public API preservation, focused review, introduced duplication,
records/contracts and proportional combined tests. This is not release hardening
or feature-completion evidence.

## Bounded consolidation of the first three slices

Completed before further capability expansion. The same focused reviewer inspected
the composed identity/provision/measurement/lifecycle path and reported no new
material issue. No additional reviewers or broad verification were launched.

The combined public-scenario test then found an interaction: after removing B,
A's final width changed while its initial measurement remained reusable. Whole-cache
clearing on the new final width discarded that useful initial entry, so Paint only
made one avoidable measurement (50 -> 51 in the failing test run). The cache now
uses least-recently-used eviction with the same strict two-entry per-node bound.
Both current basis/final-width measurements survive; the combined test passes.

Removed introduced duplication: one private application Button component replaces
repeated button paint/event JSX; the single test file shares mount, mouse-click,
and next-frame helpers. No new infrastructure or public operation was introduced.
The shared helpers preserve the exact manually runnable scenario and native mouse
press/release/click convention. Assertions explicitly require both paragraphs in
paint order, moved key selection, and current content after restoration.

Final combined validation in the recorded environment:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/test/layout-wasm-slice.test.tsx --mode layout-wasm --browser.headless --browser.ui=false
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/layout/flex.test.ts packages/core/test/flex-css-compatibility.test.ts packages/core/src/lib/components/text.test.ts packages/core/src/lib/components/text-layout.test.ts packages/core/test/layout-wasm-slice.test.tsx --browser.headless --browser.ui=false
corepack pnpm@11.21.0 exec tsc --noEmit
corepack pnpm@11.21.0 -C packages/core build
node --import tsx tooling/scenario-source-discovery.check.ts
node --import tsx tooling/scenario-catalog.ts
```

Experimental suite: **10 passed**. Combined production suites: **82 passed / seven
experimental-only skips**. Root typecheck, targeted ESLint, core build (including
WASM source/hash checks), catalog/source discovery, built Node import and diff
checks passed. No aggregate trust, full browser matrix, migration or timing claim.

Live Studio combined sequence: narrow -> short A -> reverse -> remove B -> paint
-> update absent B -> equal-width nudge -> switch width source -> restore -> reverse.
Paint after removal kept solves/measurements at 5/11 while frames advanced 5 -> 6;
absent B and the equal nudge stayed at 5/11/6. Final restore/reorder retained three
active nodes, two arenas and four lifetime node creations (only B was recreated).
No browser errors. Screenshot: `/tmp/pibbl-layout-consolidated-canvas.png`.

The next selected slice is final-width column Text measurement with a constrained
cross width and auto main basis. It uses the existing public API. Larger intrinsic
preparation, root transaction integration, Layer ordering, custom-font revisions,
Yoga/migration conformance, package extraction and reproducible performance remain
explicit later milestones. The first group is consolidated experimental work,
not feature completion or release hardening.

## Fourth feedback delivery: column Text at final constrained width

URL: http://127.0.0.1:5187/#/examples/layout/wasm-flex-column-text. The earlier
row/reactivity/keyed composition and its controls remain available unchanged.

Smallest failing regression: deterministic Text `aaaa aaaa aaaa aaaa` in a 100-wide
nowrap column, `maxWidth: 50`, `minHeight: 0`, `flexShrink: 0`, wrap and 10-unit line
height. Text was placed at width 50 but retained height 20 measured at width 100;
the next 10-high Rectangle started at y=20. Expected Text height and sibling y are 40. The regression failed before the production edit and now passes in both lanes.

For nowrap column Text with automatic main basis, padding/min/max cross bounds now
resolve before that basis. The final cross width follows stretch or the declared/
measured width and its bounds. Text is measured at that used width through the same
receiver/cache path; measured height then supplies main basis before allocation.
No new public API, scheduler, intrinsic component protocol or arbitrary component
preparation. Explicit main minimums and existing unsupported cases remain intact.

The new public scenario uses `maxWidth: widthCap`, ordinary signal inputs and an
opaque following sibling with definite declared dimensions. Toggle width cap from
420 to 180: Text gains lines and the green sibling moves below it in one scheduled
frame. Clicking its old position leaves hits at zero; clicking its new position
increments hits. Paint only changes ink without solves or measurements.

Fresh Studio counters:

| Action                            | Solves | Measurements | Node creations | Active nodes | Frames |
| --------------------------------- | ------ | ------------ | -------------- | ------------ | ------ |
| Mount, cap 420                    | 1      | 2            | 2              | 2            | 1      |
| Cap 180                           | 2      | 4            | 2              | 2            | 2      |
| Click old footer position         | 2      | 4            | 2              | 2            | 2      |
| Click new footer position, hits=1 | 2      | 4            | 2              | 2            | 2      |
| Paint only                        | 2      | 4            | 2              | 2            | 3      |

Page identity/title, visible output, moved hit target and absence of browser errors
verified with existing Playwright because Browser plugin is unavailable. Screenshots:
`/tmp/pibbl-layout-column-wide.png`, `/tmp/pibbl-layout-column-narrow.png`. Pixel-space
footer positions include Studio fitting and are not reported as logical units.

Focused experimental suite: **12 passed**. Proportional production Flex/CSS-oracle/
slice suites: **46 passed / eight experimental-only skips**. Same reviewer reused
for the new width-resolution branch: no consequential finding. Root typecheck and
final build/static checks are recorded in Plan 010. No broad matrix or release claim.
This starts group two after consolidation: one of the next three delivered slices.

## Fifth feedback delivery: WASM nowrap cross-axis placement

Same column URL now includes **Cycle alignment** (stretch -> center -> end) and
both experimental inspectors include `crossPlacements`. Previous controls and the
row/keyed scenario remain available.

Minimum failing regression first asserted public center geometry
`{x:3,y:35,width:40,height:20}` in a 100×80 container and an actual WASM placement
operation. Geometry already matched; the operation/counter was absent. The same
private WASM instance now owns a cross-axis numeric buffer alongside main allocation.
Rust computes final stretch/min/max/padding size and start/center/end offsets.
JavaScript retains Text measurement and main-axis justification offsets for now.
This is a private experimental integration change, not a public API or ABI promise.

Cross input records include preferred outer size, padding, bounds, automatic-size
flag and effective alignment policy. Equivalent inputs reuse copied results without
WASM placement work. Views are renewed after calls; failure and disposal clear both
buffers and caches. The normal build retains its existing JavaScript path, with
no silent fallback inside an experimental solve.

Live Studio evidence at width cap 180:

| Action                        | Cross placements | Solves | Measurements | Frames | Footer hits |
| ----------------------------- | ---------------- | ------ | ------------ | ------ | ----------- |
| Narrow                        | 2                | 2      | 4            | 2      | 0           |
| Click moved bar               | 2                | 2      | 4            | 2      | 1           |
| Paint only                    | 2                | 2      | 4            | 3      | 1           |
| Cycle to center               | 3                | 2      | 4            | 4      | 1           |
| Click old horizontal position | 3                | 2      | 4            | 4      | 1           |
| Click new horizontal position | 3                | 2      | 4            | 4      | 2           |

Page identity/title, meaningful canvas, moved hit targets and no browser errors
verified with the existing Playwright installation. Screenshot inspected at
`/tmp/pibbl-layout-column-aligned.png`. Browser plugin remains unavailable.

Focused experimental checks: **13 passed**. Seven existing nowrap Flex geometry
cases passed through WASM (28 unrelated cases filtered); two native Rust tests
passed, including constrained stretch/padding and negative overflow alignment.
The same reviewer found no material arithmetic, caching or buffer-lifetime issue.
Checked embedded artifact is now **51,117 bytes**; the earlier 49,803-byte receipt
belongs to the earlier slice. No performance claim or broad verification gate.

This is the second delivery of group two. Next selected slice is WASM nowrap
main-axis offsets/distribution, followed immediately by bounded consolidation.

Final slice 5 checks: normal-build Flex/compatibility/slice suites **46 passed / nine
experimental-only skips**. Root typecheck, targeted ESLint, core build and artifact
validation, catalog validation (155 lessons), built Node import and diff check pass.
Environment remains Node 26.9.0, pnpm 11.21.0, Rust 1.99.0 and Chromium. No aggregate
trust gate or Node 24 result is claimed. Studio remains running on port 5187.

## Slice 6 and bounded consolidation of group two

Public scenario: http://127.0.0.1:5187/#/examples/layout/wasm-flex-column-text.
Distribute cycles existing justifyContent policies start, space-between and center.
All public signatures remain unchanged; the experimental build privately calculates
nowrap main offsets in Rust, including padding/gaps and negative-space fallbacks.
The failing geometry/counter regression observed absent mainPlacements before code.

Main placement caches copied offsets by allocation revision, finite size, gap and
policy. Reuses the allocation buffer's frozen slot only after solving; the next
solve resets it. Cross-buffer growth cannot invalidate copied results. Failure
releases the region through existing exact ownership. No scheduler or reactive
ownership system was added. Main/cross JS arithmetic is bypassed only in the
experimental nowrap lane. Ordinary builds retain the existing solver.

Combined public test/live sequence exercises width, paint, alignment, distribution,
old/new hit locations and disposal. After wide restoration the inspector reads
mainPlacements=3, crossPlacements=4, solves=3, measuredLeaves=6. Distribute changes
only mainPlacements to 4. Old location keeps footer hits=2; new location increments
to 3. No browser errors. Screenshot inspected at /tmp/pibbl-layout-distributed.png.

Consolidation reviewed architecture, buffers/cache invalidation, measurement order,
reactivity/scheduler reuse, unchanged public API, cleanup and combined examples.
Same focused reviewer found no material issue. Fixed stale Recording wording in
layout artifact-check errors; no introduced obsolete path/duplicate owner found.

Fresh checks: 14 experimental tests, seven selected existing nowrap geometry cases,
three native Rust tests, 46 normal-path tests / ten experimental-only skips. Root
typecheck, targeted ESLint, core build/artifact checks, catalog validation (155
lessons), built Node import and diff check pass. Artifact now 52,063 bytes.
Node 26.9.0 / pnpm 11.21.0 / Rust 1.99.0 / Chromium. No full gate, Node24 result,
feature-complete, parity or speedup claim. Studio remains running. Next group has
exactly one selected slice: reactive nowrap row/column axis switching.

## Slice 7: reactive nowrap row/column switching

URL: http://127.0.0.1:5187/#/examples/layout/wasm-flex-column-text.
Top-right Switch row/column binds a public signal directly to Flex flexDirection.
Footer width is a public computed value (420 column / 200 row); its ordinary custom
component accepts public PibblResponsiveStyle. Explicit minimums keep both axes
within the existing finite subset. All earlier controls and column geometry remain.
The footer label is shortened to fit its narrower row box.

The new exact-example regression failed before the control existed (footer x=40
instead of >140). Existing runtime passed after public composition alone: no WASM,
reactivity, scheduling or public API changes. Fifteen focused tests pass; axis
switch moves Canvas text and hit geometry in one scheduled frame, retains node
identities, restores original column geometry and releases nodes/arena on disposal.
Paint-only changes no solves, placements or measurement counters. Typecheck and
targeted lint pass. No additional unchanged-code review or full gate was run.

Live browser: initial solves/mainPlacements/crossPlacements=1/1/1, measurements=2,
nodeCreates=2, activeNodes=2, activeArenas=1. Row switch changes the three work counts
to 2/2/2; measurements and ownership stay unchanged. Clicking old location keeps
hits=0; new location gives hits=1. Paint-only changes frames to 3 with no layout
work; return to column gives 3/3/3 and exact original footer y, measurements still 2.
No browser errors; inspected /tmp/pibbl-layout-axis-row.png. Studio stays running.
Environment unchanged: Node26.9.0/pnpm11.21.0/Chromium. This is group three delivery
one; next selected slice is a public signal-driven constrained grow/max example.

## Slice 8: signal-driven constrained flex allocation

URL: http://127.0.0.1:5187/#/examples/layout/wasm-flex-constraints.
Separate runnable public composition preserves all previous examples. Two panels
with flexBasis=100, grow=1, gap=16 share width680. Public signals control A maxWidth
and grow; ordinary custom panels show useLayoutBox width and wrap their own Text.
The focused regression first could not load the not-yet-created example; after
adding the baseline composition, its behavioral failure was unchanged332/332
instead of180/484 before wiring the cap action. No production engine fix needed.

Fresh focused experimental suite:16 passed. Assertions cover exact finite widths,
content line paint within capped A, redistribution while A stays frozen, 3:1 uncap,
changing hit boundary, stable node identities and deterministic arena/node cleanup.
Root typecheck, targeted ESLint, catalog validation (156 lessons) and diff check pass.
No unchanged engine rebuild/review or broad gate. Environment Node26.9.0/pnpm11.21.0/
Chromium. Restarted task-owned Vite server on5187 to refresh new-file source adapter;
all prior routes remain available; current server session33722 stays running.

Live sequence:initial332/332;cap180/484;grow3 while capped180/484;uncap448/216.
Solves/mainPlacements advance1/1->2/2->3/3->4/4;crossPlacements stays1. Active nodes2,
arena1, creates2 throughout. Same coordinate selects B capped, A uncapped. Paint-only
increments frames4->5 with other work counts unchanged. No browser errors. Inspected
/tmp/pibbl-layout-capped.png. measuredLeaves=0 because definite opaque panels paint
Text internally; this is not evidence of intrinsic custom-component support or a
new text-measurement optimization. Experimental finite nowrap only; no speed claim.

Group three now has two delivered slices. Exactly one next slice: reactive shrink
minimums in the constrained example, then bounded consolidation of the group.

## Slice 9 and group-three consolidation

Same constraint URL adds Toggle shortfall (width320,basis300) and Toggle A floor
(minWidth0/180). Growth controls preserved. Reactive Text description shortens in
shortfall; labels use12px font to fit the124px panel. Public signal/computed/styles
only, no engine edit. First behavioral regression failed448/216 vs152/152. Passing
sequence152/152->180/124->152/152 preserves finite sum+gap320, Text paint bounds,
same-coordinate A/B targeting, stable node identities, paint-only skip and disposal.
One test coordinate was corrected from the gap to x202, inside both successive
panel allocations; runtime did not need a fix.

Live growth->shrink sequence: solves/mainPlacements4/4->5/5 shortfall->6/6 floor
->7/7 released; crossPlacements1, measuredLeaves0,nodes2,arena1 unchanged. x202
selectsA with floor and B released. Final paint changes only frames8->9. No browser
errors; inspected /tmp/pibbl-layout-shrink.png. Definite panels still do not exercise
intrinsic custom-component measurement. Studio session33722 remains running.

Consolidation of slices7–9:16 experimental tests pass across all three exact public
examples; normal Flex/Text/compatibility/slice suites47 passed/12 experimental-only
skips. Root typecheck,targeted ESLint,catalog156,diff check pass. Node26.9.0/pnpm11.21.0/
Chromium. No engine changes, so no unchanged-code reviewer/native/build/full-gate
reruns. Self-review checked public responsive types, existing signal/receiver and
scheduler reuse, paint/hit geometry, identities, bounded measurement evidence,
disposal,timer/inspector ownership and self-contained editor imports. No introduced
obsolete paths or duplicate runtime systems. Existing local example helpers remain
self-contained rather than introducing an unnecessary shared runtime dependency.

Proposal reconciliation: finite nowrap allocation/placement is experimental;
reactivity stage is partial (no general role graph or geometry transaction),
prepared nested structure/Layer dependencies absent. Current measureFlex rejects
automatic Text child bases. Next selected meaningful engine gap is one-level
intrinsic built-in column Flex with direct wrapped Text at definite constrained
width, with public width/text interaction and following-sibling geometry. No general
structural component API or speculative ordinary-component execution is selected.
Yoga parity,Grid,migration package/profile,font revision support,cold/bridge timings,
full conformance and trust gate remain outstanding. No speedup or completeness claim.

## Slice 10: intrinsic built-in column and wrapped Text

URL:http://127.0.0.1:5187/#/examples/layout/wasm-flex-intrinsic-text.
Initial deterministic regression:width50 auto-height inner Flex containing four
wrapped words rejected automatic child basis. Experimental measureFlex now measures
direct built-in Text at known width for an auto-height nowrap column. Existing
explicit minimum/grow/percentage restrictions apply; automatic child width requires
stretch. This is pure built-in measurement, not speculative ordinary-component
execution. It adds no graph,public API,ABI or intrinsic fixed-point iteration.

Reviewer found a real mismatch:declared nested width100/maxWidth50 measured Text at
100 and got20high although its rendered width50 required40. Added failing bounds
regression, then extended the existing final-width remeasurement order to experimental
Flex (column width clamp and row used-width cross sizing). Both axes now return40
and correct sibling geometry. Same reviewer rechecked original and padded case:
no further consequential width/padding/receiver issue.

Fresh19 experimental tests pass. Exact public example checks width/text reactive
height, old/new footer hit positions, no speculative opaque-footer paint, unchanged
node identity, bounded conservative paint work and exact disposal baseline. Normal
Flex/Text/compatibility/slice tests47 passed/15 experimental-only skips. Root
typecheck,targeted lint,core build/artifact checks,catalog157,built Node import and
diff check pass. Node26.9.0/pnpm11.21.0/Chromium; no broad gate or Node24 claim.

Live width420->180:solves2->4,main2->4,cross2->4,host-measure entries3->6;footer moves
down and only its new position receives input. Shorter Text gives solves6/main6,
cross4,measurements9;paint-only keeps numeric work but aggregate measurement adds1.
Nodes3/arenas2 stable. No browser errors; inspected /tmp/pibbl-layout-intrinsic.png.
The legacy measuredLeaves counter includes aggregate host requests here, not all
Canvas metric calls; no intrinsic cache optimization is claimed. Studio remains
running session86534. General intrinsic containers,ordinary structural components,
font revisions,Layer ordering,transactional root graph,parity and migration remain.

Group four delivery one. Exactly one next slice: parent-constrained intrinsic
column width from definite allocation, removing duplicated inner width. Bound it
to finite parent width/direct Text; do not silently invent intrinsic-cycle semantics.

## Slice 11: parent-constrained intrinsic width

URL unchanged:http://127.0.0.1:5187/#/examples/layout/wasm-flex-intrinsic-text.
Only outer Flex declares a width signal; inner auto-height column stretches to it.
The new regression first rejected automatic child basis. The runtime now defers
initial measurement of a stretched auto-width intrinsic built-in child in a finite
column, resolves padding/bounds, then injects final content width into pure measure.
No loop, speculative component execution, subscription system or public API added.
Unsupported deferred measurement fails with its reason instead of reusing a stale
result. A maximum constraint alone remains insufficient in standalone measurement.

Twenty experimental tests pass, including maxWidth50 with padding0/10 giving
outer50x40/70x60 and correct footer positions. Direct standalone measure remains
unsupported. Exact public scenario retains width/text/hit/identity/cleanup checks.
Reviewer found no material issue in the changed finite-width/ownership order.
Normal Flex/Text/compatibility/slice47 passed/16 experimental-only skips. Typecheck,
targeted ESLint,core build/artifact validation,catalog157,built Node import,diff check
pass. Node26.9.0/pnpm11.21.0/Chromium. No full gate,Node24,parity or speed claim.

Live initial nodes3/arenas2/solves2; parent420->180 moves footer down and changes
solves2->4; old footer location misses,new hits. Short text changes solves to6 and
moves footer up. Paint holds solves6/main6/cross4, aggregate host entries9->10.
No browser errors. The known paint-only intrinsic measurement remains explicit.
Studio session86534 stays running. Group four now has two deliveries. Selected
next: bounded intrinsic measurement reuse using validated direct Text input snapshots
and existing receiver ownership; consolidate the group immediately afterward.

## Slice 12 and consolidation of intrinsic group (10–12)

URL unchanged. Generic-font Paint only now leaves aggregate measurement unchanged.
Focused failing expectation was1extra versus0. Snapshot resolves direct Text content,
metric style,structure/order and constraints through existing receiver provisions
before each hit; excludes paint fields. Responsive queries and custom font families
stay uncached. Shared region two-entry LRU owns copied sizes and cachedMeasurements
counter; no transaction descriptor/provision retained. Node-removal and disposal
checks verify release/baseline and bounded<=2entries per active numeric node.

Cycle font exposes16px/24px generic style invalidation and unregistered custom-family
conservative path. Tests also verify equal-height punctuation change still paints,
width/text updates move sibling geometry and current signals remain observed after
cache hits. Automatic font-load/revision invalidation is not implemented or claimed.

Reviewer found iterable snapshot traversal borrowed outer render/layout context.
Shared existing measurement render-state isolation plus write guard around whole
snapshot fixes it; scheduled iterable regression proves outer allocation cannot be
read. Targeted reviewer verified state restoration and receiver provisioning. The
group's other width-clamp finding remains regression-covered. No overlapping review.

Live generic paint:solves6/main6/cross4/host-measurements9/cache4 unchanged. Generic
font24 gives solves8,measurements12;equal-height changed text paints at solves8 and
measurements15. Custom-family then paint gives18->21measurements,numeric8/8/4 stable.
No browser errors; inspected /tmp/pibbl-layout-intrinsic-cache.png. Structural work
counts only,not timing/speedup or total Canvas paint text-metric call counts.

Bounded consolidation:21 experimental tests across all exact public examples pass;
normal Flex/Text/measure/compatibility/slice56passed/17experimental-only skips. Root
typecheck,targeted lint,core build/artifact checks,catalog157,built Node import,diff
check pass. Node26.9.0/pnpm11.21.0/Chromium. No unchanged-native rerun,full matrix or
aggregate trust gate. Consolidated LRU in region,shared pure-state helper,reviewed
geometry/reactivity/scheduler/API/cleanup and updated examples/contracts/plan.
Studio86534 remains running. No general font invalidation,root transactions,role
metadata,arbitrary intrinsic component preparation,Layer dependencies,parity,Grid,
migration package/profile or timings claimed. Exactly one next material slice:
allocation-aware Layer raster in a public resizable Flex, with a failing size/callback
case first and narrow scheduling amendment only after observing the dependency.

## Slice 13: allocation-aware managed Canvas Layer

URL:http://127.0.0.1:5187/#/examples/layout/wasm-flex-layer.
The focused regression first rasterized a dirty allocated Layer at old240 then
final120 within one shared parent/content update. Experimental directly placed
Layers now register a weak parent allocation dependency. Eligible Canvas branch
jobs wait for parent inline Layer traversal; existing inline render completes the
revision. Teardown removes dependency/count, and no registered dependencies takes
an inexpensive no-scan path. No new public API or scheduler exists.

Branches with renderer-participant work, captured root payloads or next-frame work
retain established ordering. This is not general external-renderer integration.
Reviewer found no consequential scoped order/revision/ownership issue. No overlap
or broad unchanged-code review. Normal builds never register these dependencies.

Twenty-three experimental tests pass, including exact public scenario pixels/hits,
cleared former extent, clean sibling reuse, content/root-only raster counts and
node/arena disposal. Scheduler/Layer/signal ownership83pass in experimental mode;
normal slice/Layer49pass/19experimental-only skips. Typecheck,targeted ESLint,core
build/artifact check,catalog158,built Node import,diff check pass. Node26.9.0/
pnpm11.21.0/Chromium; no full gate,Node24,release or speed claim.

Live initial history0@544px; Resize+content gives1@284px and content rasters1->2,
clean stays1. Old bitmap pixel at500,230 is background[243,240,232,255]; old hit
misses,new hit increments. Content only gives raster3; Root paint adds none; solves
stay2,main2,cross1. No browser errors; inspected /tmp/pibbl-layout-layer.png.
Task-owned Studio restarted for new source adapter,session10013 stays running.
Group five delivery one. Exactly one next material gap: allocated Layer containing
public defineRenderLayer work, with a small failing stage/size callback scenario
before extending scheduling. General prepared components,transactions,font revisions,
parity,Grid,migration and performance evidence remain unfinished.

## Slice 14: public renderer inside an allocated Layer

URL:http://127.0.0.1:5187/#/examples/layout/wasm-flex-render-layer.
Correction to the selected plan assumption: public defineRenderLayer/controller
executes resource/update/resize/render/interaction inline in Canvas traversal and
requests instance work for invalidation. It does not enqueue friend-only renderer
participant stages. The prior Canvas allocation handoff already covers this public
path. No runtime scheduler change was necessary or made in this slice; friend-work
exclusions remain. This is a complete public integration/migration proving example,
not a claim that a missing friend-stage handoff was implemented.

Test-first example initially still had only Canvas raster counters and failed the
expected external lifecycle evidence. Implemented public renderer resources, final
size rendering and committed outlined edge target.24focused tests pass. New exact
example verifies resize/render544->284 once, same-generation hit,last old extent
cleared,content-only one render,root paint zero,clean sibling1,one create/dispose
under repeated disposal,root nodes/arena baseline. Source/runtime behavior already
supported it; this test failure is not presented as an existing engine defect.

Live:renderer render1->2 onresize,history0@544,1@284;resize widths544,284;creates1
throughout. Right-edge click reports hit1/generation1;old extent misses. Content
only render3,root paint stays3,clean sibling raster1,no browser errors. Inspected
/tmp/pibbl-layout-renderer.png. Studio refreshed adapter,session95131 remains up.
Fresh public render-layer lifecycle/failure and surface ownership suites35pass;
typecheck,targeted lint,catalog159,diff check pass.Node26.9.0/pnpm11.21.0/Chromium.
No unchanged-engine rebuild/review or broad gate. Existing failure suites support
existing boundary behavior,not a new injected nested-failure public demonstration.

Group five delivery two. Exactly one next substantive public authoring gap:
allocation dependency through an ordinary opaque panel returning a Layer (direct
placement marker currently only on panel). No speculative execution/new structural
API. Capture callback/width failure first; after delivery consolidate the group.

## Slice 15 and consolidation of allocation group (13–15)

URL:http://127.0.0.1:5187/#/examples/layout/wasm-flex-panel.
Normal Panel accepts public style/children,reads useLayoutBox,returns Layer. Failing
regression rasterized240 then120 in one shared update. Internal Layer registration
now follows active pushed allocation context,not a direct placement marker. Ordinary
components remain opaque to intrinsic discovery and execute once in normal traversal;
Group/Clip do not erase inherited allocation. No public API or scheduler rewrite.

26experimental public slice tests pass. Direct/opaque renderer assertions shared
through parameterized cases; verify final size,current target generation,old pixels,
clean sibling caching,resource persistence/repeated dispose and node/arena baseline.
Live resize gives panel1->2/renderer1->2 at544->284,targetgeneration1;content gives
panel3/renderer3;root paint panel4/renderer3. Clean raster1/create1 throughout,no
browser errors; inspected /tmp/pibbl-layout-panel.png. New-file preview initially
needed a proper iframe mount wait; no runtime failure. Studio57865 stays running.

Bounded consolidation: scheduler/Layer/public-renderer/signal/surface ownership118pass;
normal slice/Layer49pass/22experimental-only skips. Typecheck,targeted lint,core build/
artifact check,catalog160,built Node import,diff check pass. Node26.9.0/pnpm11.21.0/
Chromium,no full gate or unchanged-native rerun. Same reviewer found no consequential
inherited-context issue. Reviewed architecture/admission/revisions,context ownership,
public bitmap/interaction commit,cleanup/API/types and examples. Removed obsolete
marker-only condition,shared test assertions,kept learning sources self-contained.
No unused friend-work handoff infrastructure was introduced. Public inline renderer
versus friend-only queue distinction remains explicit in updated contracts.

Credible migration remains blocked:experimental source-build lane/no packaged WASM
entry or loading policy;partial role/invalidation/geometry transaction integration;
limited known-width intrinsic Text shapes/no structural-component protocol;explicit
friend-work/payload exclusions;no custom-font revision contract;missing broader Flex
and Yoga default/box/geometry compatibility;no replacement multi-family Grid;no fresh
versioned Yoga conversion/oracle evidence;no timing/cold/bridge budgets,experimental
packed consumers,Node24 or aggregate integration gate. Focused success is not parity,
performance,release readiness or a standalone migration package.

Selected next is bounded migration evidence,not more arithmetic controls:one pinned
Yoga3.2.1 fixture (reference baseline,not latest) translated to public Pibbl,with at
most three numeric cases,explicit defaults/config/provenance/divergences and a runnable
resize example. No Yoga app runtime or frozen profile/API. Present any consequential
geometry contract choice with evidence before changing it. Group six starts only
after this completed consolidation; exactly one next slice in Plan010.

## Slice 16: pinned Yoga migration rehearsal

URL:http://127.0.0.1:5187/#/examples/layout/wasm-yoga-migration.
Exactly three integer fixtures against Yoga3.2.1 commit042f5013152eb81c1552dec945b88f7b95ca350f:
grow144/144,cap80/208,shrink120/88. Source manifest version3.2.1/MIT verified from
existing research Git objects; current development checkout and its untracked probe
left unchanged. No network/npm app dependency or Yoga runtime/implementation/binary
vendored. Full upstream MIT notice,license/probe SHA256 and explicit config retained.
Own native C++ probe archives pinned sources into temporary storage,compiles with
Apple clang21.0.0/-std=c++20/-O2,runs,compares and removes scratch;frees trees/configs.

Fresh command:node tooling/layout-yoga-rehearsal.mjs --source /tmp/pibbl-yoga-research-20261021.
Recorded-only command omits --source and explicitly says it did not reproduce Yoga.
README documents source/configuration,concrete before C++ and after public JSX,
row/shrink/minimum/default/rounding differences,scope and limitations. The checked
example embeds only reference geometry;after side uses actual public Flex sizing.
Initial incomplete translation failed the public geometry expectations; no existing
engine bug or runtime fix is claimed. Three exact matches are not general parity.

27experimental slice tests pass. New test imports pinnedJSON and compares real label
positions and widths from useLayoutBox,case resize,paint-only reuse and teardown.
Typecheck,targeted lint,catalog161,record/example consistency,diff check pass. Same
focused reviewer found no material provenance/config/license/claim issue. Node26.9.0/
pnpm11.21.0/Chromium. No unchanged-engine build/review or broad verification gate.
Live cases144/144->80/208->120/88,clicksA/B work;paint holds solves3/main3/cross1,
nodes2/arena1 stable. No errors;inspected /tmp/pibbl-layout-migration.png. Studio
new-file adapter refreshed;session54533 stays running. Prior routes retained.

Unsupported:padding/border box conversion,fractional precision equivalence,wrap/
reverse/RTL,margins/logical edges,auto minimums,baseline/participation,fonts,broad
intrinsic/Grid,versioned public profile or production migration. Normal built core
still chooses JS;source-mode experimental Studio works but does not solve packaged
WASM consumption. Recommended next single slice:unpublished built-WASM artifact
running the same public scenario,with coherent runtime identity and no default/API/
publication change. Group six delivery one;no performance/parity/readiness claim.

## Slice 17 — unpublished built consumer

Node26.9.0/pnpm11.21.0; no Node24 or full trust claim. Fresh commands:
`node tooling/build-layout-wasm-package.mjs` passes source/binary fingerprint
(52063bytes), declarations and separate module build. Initial test failed ENOENT;
first declaration attempt exposed mixed source/built JSX nominal types, corrected
with explicit source JSX mappings in the isolated generated tsconfig.
`node tooling/test-layout-wasm-package.mjs` passes private manifest, compile flag,
normal artifact isolation, nominal signals/JSX, unused imports compile0 WASM modules,
and an independent temp consumer resolving ordinary package exports to built core.
`node tooling/build-core.mjs` passes normal JS build after flag change.
`corepack pnpm@11.21.0 exec tsc --noEmit` and targeted ESLint pass.
Focused Vitest source experimental suite:27/27 pass,7.40s, Chromium.
Built Studio browser probe: grow144/144, cap80/208, shrink120/88, correct A/B hit,
paint solves3/main3/cross1 unchanged, activeNodes2/arena1, no browser errors.
Actual bundler metafile receipt contains460 core inputs, all under private built
dist, no source/normal dist core. Independent mode name is layout-wasm-built,
so source-mode detection cannot accidentally enable the kernel. Screenshot
/tmp/pibbl-layout-migration.png inspected in prior source slice; built checks
semantic geometry/counters. No new screenshot/parity/performance claim.
Studio5188 session12334 running; source5187 session54533 retained. Private generated
package ignored, no publication. Dedicated built lifecycle/type-consumer exercise
selected next, then consolidate group16–18. Existing source lifecycle regressions
pass; no new claim of independently measured built teardown yet. No blocker.

## Slice 18 and consolidation six — built declarations and lifecycle

Node26.9.0/pnpm11.21.0, local Playwright Chromium; no Node24/full trust claim.
Focused browser test first failed waiting for the absent public lifecycle example;
consumer declaration test first failed ENOENT for that source. Typechecking then
rejected overly restrictive fixture renderer props (`Record<string, never>`),
corrected to `object`. Public type declarations were not changed. Browser revealed
child-local origin0 was an invalid diagnostic for the target's Layer-local offset;
useCanvasContext/getTransform now records that offset for this unrotated fixture.

Fresh commands/results:

- `node tooling/build-layout-wasm-package.mjs`: fingerprint52063bytes, private
  declarations/modules built; ordinary dist remains separate. Copy existing notices
  and remove temporary build tsconfig after success.
- `node tooling/test-layout-wasm-package.mjs`: real public exports from independent
  temp symlink consumer; exact learning source typechecks under Bundler and NodeNext,
  strict/no skipLibCheck/no workspace aliases. Unused imports compile0 modules,
  instantiate0 instances, schedule0frames and own0nodes/arenas. Inspector property
  installation is intentional; no claim of literally no property side effect.
- `node tooling/test-built-layout-lifecycle.mjs`: five renderer creates/five exact
  disposes including idempotence; active ownership4nodes/2arenas/2cacheentries to
  baseline0/0/0. Resize324→144px; Text moves renderer; old target misses/new target
  hits. Detached Text mutations leave every layout counter unchanged. Remounts
  retain stable active nodes/arenas and bounded caches. Actual460 core inputs all
  private built dist, enforced independent of URL port. No browser/console errors.
- Same focused lifecycle command with `http://127.0.0.1:5187 --source` exercises the
  public source lane. Both local servers remain available (5187session68707,
  5188session62107); former source session had ended and was restored.
- Built pinned migration probe again: grow144/144, cap80/208, shrink120/88; A/B
  target agreement; paint-only solves3/main3/cross1 stable;460 built core inputs,
  no browser errors. `node tooling/layout-yoga-rehearsal.mjs` verifies recorded
  fixture/license/example consistency; no new native Yoga algorithm change.
- Repository `tsc --noEmit`, targeted ESLint, catalog162lessons/12tutorials/33labs,
  source-discovery check and diff check pass. Slice17's27focused regressions remain
  the current unchanged-runtime suite receipt; no needless full-suite rerun here.

Same reviewer read only changed packaging/provenance/lifecycle material: no material
finding. Consolidation fixed omitted third-party notices, removed build-only config,
and made proof validation port-independent; docs/contracts/plan updated together.
Local symlink consumer is not packed-release evidence. No engine/scheduler/public
API change for this group, no publication, no performance/parity/completion claim.
Plan now records partial proposal milestones and exactly one next slice: finite
row-wrap with WASM line formation/allocation/placement. Remaining migration gaps
include wrap/reverse/RTL/baselines/margins/auto minima/box conversion, general
intrinsic structure/custom-font invalidation, production loading/distribution and
standalone adoption; these are not silently accepted public API designs. No blocker.

## Slice 19 — finite row-wrap through WASM

Node26.9.0/pnpm11.21.0/Rust1.99.0/Playwright Chromium. Initial focused test failed at
old nowrap-only guard (27passed/1failed). Public example import was also absent
before implementation. Final focused suite:29/29pass,8.01s; existing normal JS
Flex suite:35/35pass,1.80s. New direct-Text geometry has320px→three100px items;
210px→100/100px first line and210px second line, with final Text heights20/20/10
and y0/0/30. Default stretch yields heights50/50/40, y0/0/60. Huge finite shrink
factors with an overflowing explicit minimum terminate. Experimental column wrap
still rejects with an explicit diagnostic. No exhaustive alignment/conformance matrix.

Rust owns one bounded hypothetical-size line-formation pass, existing per-line
freeze allocation, main distribution, line cross sizing/distribution and item
placement. One region retains all records/caches across lines. Host copies output
views after possible memory growth. Wrap/allocation revision participates in cross
placement cache keys; disposal clears Rust line ranges. A cumulative private
lineFormations counter exposes solve reuse, not all layout visits or a speed claim.
Same reviewer checked only changed material: no material defect, no edits/broad gates.

Fresh reproducible commands:

- `CARGO_HOME=/tmp/pibbl-layout-cargo RUSTUP_HOME=/tmp/pibbl-layout-rustup PIBBL_CARGO=/tmp/pibbl-layout-cargo/bin/cargo node tooling/build-layout-wasm.mjs`:
  56793bytes, pinned locked release build. `node tooling/build-layout-wasm.mjs --check`
  passes source/binary fingerprint and self-contained WASM validation.
- `node tooling/build-layout-wasm-package.mjs`: private modules/declarations rebuilt;
  `node tooling/test-layout-wasm-package.mjs`: inert imports and independent public
  Bundler/NodeNext consumer pass, now including both lifecycle and row-wrap sources.
- Repository `tsc --noEmit`, targeted ESLint, source discovery and catalog validation
  pass (163lessons/12tutorials/33labs), diff check clean. Normal dist not replaced by
  opt-in build; normal source geometry verified separately. No full trust/Node24 claim.

Live source5187 and built5188 wrap probes:600px→three192px cards atx28/232/436;
400px→194/194px atx28/234 and400px C atx28,y296. Old C target misses, new target
selects C. Text/paint changes keep lineFormations/solves2, nodeCreates3; restore
width increments lineFormations/solves3 while nodeCreates stays3. Active nodes3/
arena1; public regression disposal restores baseline cache/nodes/arenas. Built
receipt460coreinputs exclusively private dist; no browser/console errors. Screenshot
/tmp/pibbl-layout-wrap.png inspected: usable card Canvas and second-line Text.
Existing built lifecycle still passes5creates/5disposes and ownership4/2/2→0/0/0.

Observed/fixed live issues: concurrent Vite lanes shared optimizer metadata,
producing504OutdatedOptimizeDep. Built lane now has a separate cacheDir. Diagnostic
HTML could squeeze Canvas height to22px; cap/wrap its height/width (also the prior
lifecycle example). Card positions initially included root letterbox translation;
remove the captured root Canvas matrix using public APIs, round display-only
coordinates to0.001px. Actual engine geometry unchanged by these presentation fixes.
No visual baselines rewritten. A catalog-order collision and Rectangle fixture's
missing required width were fixed locally, preserving existing lesson order.

Live URLs: http://127.0.0.1:5187/#/examples/layout/wasm-flex-wrap and built equivalent
on5188. Sessions95803(source)/17163(built) kept running. No publication/deployment.
Limits: finite row wrap only; declared opaque card heights and direct Text automatic
cross-size are demonstrated; no column wrap, reverse/RTL, baseline or intrinsic
wrapped-container support. No Yoga parity/performance/feature-complete claim.
Group seven has one slice. Exactly one next: finite column wrap with declared main
basis/height and cross width, rejecting intrinsic dependency cycles outside scope.
No blocker or consequential new public-contract decision.

## Slice 20 — finite column wrap with declared item sizes

Node26.9.0/pnpm11.21.0/Playwright Chromium. Focused failing test first hit the old
blanket column-wrap guard (1failed/29skipped). Replace that guard with per-item
eligibility: declared height/flexBasis plus declared width, before measurement.
Automatic measured main bases/cross widths reject with an actionable child/axis
message. Empty finite columns are valid. No Rust, ABI or allocator change needed:
reuse the axis-independent bounded line kernel reviewed in slice19.

Final focused suite31/31pass,8.66s: column geometry, explicit intrinsic exclusions,
large finite shrink factors with overflowing minimums, public height/target/reuse
and disposal, plus prior row/nowrap/scenario regressions. Pure geometry260px height
keeps three80px items in one column;170px moves the last into a second column and
grows it to170px. A40px column with50px minimum items overflows finitely, no loop.

Live source and actual built Studio agree:288→184px height moves C from
(28,348),192×88 to(232,148),192×184; A/B are192×86. Old C target misses/new target
selects C. Text/paint hold lineFormations/solves2; restore makes3 while nodeCreates
stays3. Active nodes3/arena1. Public regression disposal returns node/arena/cache
ownership to baseline. Built proof460coreinputs exclusively private dist; no
browser/console errors. Screenshot /tmp/pibbl-layout-column-wrap.png inspected;
Canvas remains usable with visible Text and both columns.

Fresh private rebuild verifies unchanged56793byte WASM fingerprint. Public package
consumer now copies lifecycle, row and column learning sources and passes strict
Bundler/NodeNext declarations without workspace aliases/skipLibCheck; unused imports
compile/instantiate0WASM and schedule0frames. Repository types, targeted ESLint,
source discovery, catalog164lessons/12tutorials/33labs and diff check pass. No full
trust, Node24, normal-build replacement or publication claim; normal solver branch
unchanged. No repeated unchanged-kernel review or broad performance/edge matrix.

URLs: http://127.0.0.1:5187/#/examples/layout/wasm-flex-column-wrap and equivalent
on5188, servers97041(source)/37764(built) kept running. Previous lanes/examples
preserved; row example limits now refer to the separate declared-column subset.
Remaining hardening includes broader wrap bounds/alignments/lifecycle combinations
at consolidation; no intrinsic wrapped containers, automatic measured column items,
reverse/RTL, baseline or Yoga parity claim. Group seven has two slices. Exactly one
next: keyed wrapped collection reorder/removal/restore, then consolidate19–21.
No blocker or consequential new public-contract decision.

## Slice 21 and consolidation seven — keyed wrapped collections

Node26.9.0/pnpm11.21.0/Playwright Chromium. Initial public test failed fetching the
absent fixture (1failed/31skipped). Remove temporary variable-import scaffolding
once the standalone source exists. No engine/Rust/ABI/API changes in this slice.
New collection uses existing public Flex, signals, useConst stamps and Canvas
context/layout boxes; two independent owners share source key order.

Fresh evidence:

- Final combined layout suite33/33pass,9.87s. Keyed row/column reorder retains
  all surviving stamps/numeric nodes; remove B releases2records; restore creates2
  and only their mount stamps change. Hit counts independently verify stale target
  removal. Public regression disposal restores baseline.
- Added one focused consolidation regression for the new material wrapped-measurement
  risk: direct generic Text cache entries6→4→6→0 across reorder/remove/restore/dispose,
  surviving nodes reused, paint-only updates trigger no new measurement/solve.
  This is a separate one-owner Text fixture; the visible two-owner card fixture
  has no Flex measurement cache entries because its sizes are declared.
- `node tooling/test-wasm-wrapped-collections.mjs` and the same command with
  `http://127.0.0.1:5187 --source` pass: active nodes6→4→6→0, arenas2→0, no final
  measurement entries, final diagnostics unchanged after disposal. Studio pagehide
  invokes the example's returned public controller; this tests real built teardown
  without exposing a private engine operation to applications. All460built core
  inputs are private dist. No browser/console errors.
- `PIBBL_LAYOUT_SCREENSHOT=/tmp/pibbl-layout-keyed-wrap.png node tooling/test-wasm-wrapped-collections.mjs`
  passes; image inspected with readable controls, both orientations and fresh B
  stamps7/8. No baseline change.
- Public package consumer now typechecks four actual learning sources (lifecycle,
  row wrap, column wrap, keyed wrap) under strict Bundler/NodeNext resolution;
  import inactivity/public identity checks pass. Unchanged56793byte WASM fingerprint,
  repository types, targeted lint, source discovery, catalog165/12tutorials/33labs,
  diff checks pass. No unnecessary rebuild/native recompile of unchanged core.

Consolidation: same reviewer inspected only new column eligibility/keyed evidence
since the prior kernel review; no material finding, no edits/broad checks. Existing
normal JS solver is retained, experimental numeric lines remain Rust-owned, no
extra reactive/collection API or retained draw commands. Fixture copying uses one
small loop; examples stay self-contained for the editor. A local exec transport
failure stopped both servers mid-work; recovered, verified ports free and restored
both. No denial or uncertain write. Current sessions20172(source)/67654(built).

Runnable URLs: http://127.0.0.1:5187/#/examples/layout/wasm-flex-keyed-wrap and built
on5188. Group19–21 consolidation complete. No broad parity, production packaging,
performance or feature-complete claim. Remaining milestone gaps and exactly one
next slice recorded in Plan010: nested built-in intrinsic columns at definite width,
using existing pure measurement/descriptors before considering a new structural
component API. Ordinary JSX components remain opaque; general font/feedback/wrapped
intrinsic and root prepared-graph work remain incomplete. No blocker.

## Slice 22: nested intrinsic builtin columns

A focused failing geometry test reproduced unsupported nested auto basis before
production changes. Known builtin nowrap columns now recurse through the shared
measurement context at settled child widths; parent padding is added once. Cycles
reject and subsequent valid measurements succeed. No Rust/ABI/public API change.

Fresh evidence on Node26.9.0/pnpm11.21.0 (documented Node24 unavailable):

- Focused layout suite35/35pass,10.74s (`vitest run packages/core/test/layout-wasm-slice.test.tsx --mode layout-wasm --browser.headless --browser.ui=false`).
- `node tooling/build-layout-wasm-package.mjs` succeeds; unchanged56793-byte WASM
  fingerprint. `node tooling/test-layout-wasm-package.mjs` checks five actual
  examples under independent strict Bundler/NodeNext plus public identity and
  inert import checks. Repository `tsc --noEmit` and targeted eslint pass.
- `node tooling/test-wasm-nested-intrinsic.mjs` and source variant
  `http://127.0.0.1:5187 --source` pass: footer320→360→280, old target misses,
  current target hits, node reuse, normal-only probe and exact disposal cleanup.
  Built receipt has460private dist inputs. Paint solves stay unchanged while
  measuredLeaves rises, accurately exposing the uncached outer aggregate.
- Screenshot `/tmp/pibbl-layout-nested-intrinsic.png` inspected: nested wrapping,
  following sibling and controls readable. No baseline change. Source discovery
  and catalog166/12tutorials/33labs pass. Focused reviewer found no material issue.

Source http://127.0.0.1:5187/#/examples/layout/wasm-flex-nested-intrinsic and built
http://127.0.0.1:5188/#/examples/layout/wasm-flex-nested-intrinsic remain running
(sessions38349/82059). Group starts with this delivery. No full trust/Node24/parity
or performance claim. Exactly one next slice in Plan010: bounded nested aggregate
reuse with real Text/metric/constraint invalidation and cleanup. No blocker.

## Slice 23: nested aggregate reuse

The new paint assertion failed before production changes (one failed/34 skipped).
Recursive known-column scalar snapshots now resolve every receiver on hits,
including nested Text content/styles, while retaining no descriptors. Declared
finite opaque children are keyed by metric style without execution. Existing
per-token two-entry LRU and disposal own storage; cycle fallback preserves the
shared measurement rejection.

Fresh focused suite36/36 passes,11.04s. New regression switches a computed Text
source, verifies detached-source inactivity and active-source/font/width misses,
paint hits, bounded entries and zero ownership after disposal. Types and private
five-example Bundler/NodeNext consumer checks pass. Private package rebuild uses
unchanged56793-byte WASM. Source/built browser test checks nested geometry/input,
paint measurement reuse and actual built cleanup. No performance/parity claim.
Node26.9.0/pnpm11.21.0; documented Node24/full trust not run. Initial sandbox local
listen EPERM was resolved by approved escalation, with no denied action.
Servers restarted with rebuilt core; source session53288/built93245 remain live.
Next exactly one slice: keyed nested membership then group consolidation.

Source/built browser receipts both pass (460private built inputs). Targeted lint,
source discovery, catalog166/12/33 and diff checks pass. Reused focused reviewer:
no material finding in receiver provision refresh, descendant metric keys, cycle
fallback or per-node LRU cleanup; read-only, no broad checks. No remaining blocker.

## Slice 24 and consolidation 8 (22–24)

Public nested Card now supports keyed reverse/remove/restore. Focused failing test
first reproduced absent control/height behavior (1failed/36skipped). Existing
runtime sufficed; no core/Rust/API changes. Final combined suite37/37pass,11.76s.
Explicit source-order miss and exact restored latest Text height assertions were
added after focused review; keyed regression and both browser lanes pass these.
Survivors retain nodes; removed paragraph source is inert; restore creates one
node, latest geometry agrees with Card bottom, cache bounded, disposal0.

Types, targeted lint, strict independent five-example consumer, catalog166/12/33,
source discovery and diff checks pass. Both nested browser lanes show320→360→280,
keyed membership, detached-source inactivity, paint hits,460private built inputs
and zero ownership. Prior wrapped collection checks pass in both lanes6→4→6→0.
Screenshot `/tmp/pibbl-s24-nested.png` inspected; no baseline rewrite. Same reviewer
found no new material ownership issue; fixed its one assertion-strength concern.
No duplicate runtime/cache/scheduler or unused scaffolding introduced. Generic
fonts only; no font-load invalidation or broader ordinary-component discovery.

Both servers remain running, source80069/built4601. Node26.9.0/pnpm11.21.0;
full trust/Node24 not claimed. Plan010 maps incomplete proposal exit gates and
selects exactly one next slice: portable local packed opt-in consumer, without
publication or default change. No feature-complete/parity/performance claim and
no blocker.

## Delivery interruption: native-app links reported blank

Packing slice25 paused immediately on Ben's report. Both task-owned servers are
still alive on5187/5188. Opened exact source/built URLs through Mac Chrome browser
plugin, observed real pixels after scrolling below the oversized lesson header.
Clicked built Toggle width in actual Chrome: diagnostic width420→220 and footer
y320→360; visible Text reflowed. Source also visibly renders. No route/asset or
blank Canvas failure reproduced in Chrome; initial workbench loads asynchronously.
Actual Mac screenshot saved `/tmp/pibbl-mac-visible-demo.jpg`; built tab retained
as deliverable. No code/viewport/security change made to conceal the report.

Native-app inspection action `cua.getApp('com.openai.codex')` was denied by tool
safety policy; did not retry. In-app browser selection reported unavailable. Thus
Ben's native-app blank view remains unverified, not fixed. Working fallback is
the exact built URL in Chrome, scroll one viewport to Live Canvas. Need native-app
view evidence or user confirmation of Chrome fallback before claiming resolved.
Slice25 tools exist as unfinished local work; no packed slice delivery claimed.

## Resumed slice 25 — installed tarball consumer

The interrupted packaging slice is now delivered. Recovery preserved 71 modified
or untracked paths and a tracked binary patch outside the checkout, without
committing concurrent example-authoring changes. The original pause/blank-view
record above remains historical; no claim is made that the desktop bug was fixed.

Focused failure before changes: `node tooling/test-packed-layout-wasm.mjs` rejected
the temporary installed path because macOS aliases `/var` to `/private/var`.
Canonicalize the temporary root once. Also fix comparison of `import.meta.resolve`
file URLs against filesystem paths and replace synchronous browser subprocess
execution, which would prevent the parent HTTP server from responding. Check mode
now uses an ephemeral port. The wrapper rebuilds current source before packing,
so stale generated output cannot silently satisfy a fresh check.

Fresh `node tooling/test-packed-layout-wasm.mjs` passes: builds current source,
checks unchanged 56,793-byte WASM fingerprint, installs the private tarball offline
with scripts disabled, rejects symlink/repository fallback, passes strict Bundler
and NodeNext declarations and public root/JSX identity, and bundles 217 installed
core dist inputs. Receipt archive SHA256:
`b2f5d0f6507251fd2f24e27a015586763a5d51b134f6f92f67e4aedb362c0aa3`.

Browser receipt passes the existing nested intrinsic interaction against that
installed package: footer320→360→280, no speculative opaque probe execution,
old/new click targets, keyed reorder/remove/restore, detached-source inactivity,
bounded paint measurement reuse, actual WASM execution after inert imports, and
zero active nodes/arenas/cache entries after disposal. The temporary application
and HTTP server close after check completion. No page or console errors.

Manual consumer remains running at http://127.0.0.1:5189/ (session80483).
Desktop Chromium1100×820: page identity matches, heading and diagnostics render,
canvas bounds(8,113.875),760×460 fit in the first viewport, Toggle width moves
footer320→360. Screenshot `/tmp/pibbl-packed-layout-desktop.png` inspected.
Browser plugin not available; used repository Playwright. No mobile/other-browser
acceptance claim. The desktop preview request was queued by `open_in_codex`;
actual native-app display remains outside this Chromium proof.

Private consumer smoke, targeted packaging ESLint and diff checks pass.
Independent focused review found no blocker; its stale-build concern was fixed.
Whole-scheduler/timer leak instrumentation remains later hardening. Environment
Node26.9.0/pnpm11.21.0/Playwright Chromium. No new Rust algorithm, public API,
production default, publication, standalone package, Node24/full trust or
performance claim. This is delivery1 of group9; next is bounded receiver input
role classification before root-wide incremental layout.

## Slice 26 — receiver-owned input roles

Delivered private role classification through existing reactive edges, preserving
receiver provision ownership. Individual supported style reads tag paint,
measurement, layout or interaction; Text content tags measurement. Ordinary
application reads, whole-style signals, responsive/custom inputs without an
explicit classification, and Group transforms stay conservative unknown. There
is no new public API, scheduler or render traversal shortcut.

Edge collection stages replacement masks, successful collection publishes them,
failed recollection retains committed masks, and same-source roles union. Public
batch dedup now ORs roles before one consumer notification. Writable, computed
and formula-candidate reads forward declared roles. The reused reviewer found
the initial batch and computed propagation omissions; both were fixed and the
changed paths re-reviewed with no remaining blocker. Direct formula-candidate
role coverage remains a small verification gap.

Process miss: the agent started production role scaffolding before adding the
new public regression. A new unit regression caught missing writable role
forwarding (paint invalidations expected+1, observed+0); the fix passed. This is
not represented as strict test-first work. Afterward an independent recovered-
baseline replay established that the new public contract was absent before this
slice, without altering primary runtime files.

Baseline replay in `/Users/benlesh/.codex/worktrees/layout-conformance/crc`:
extract the pre-slice recovery archive into the baseline checkout, confirm no
role functions/masks/counters exist in its production inputs, copy only the
new public test file, and run:

```sh
node /Users/benlesh/GitHub/crc/node_modules/vitest/vitest.mjs run --project chromium --mode layout-wasm packages/core/test/layout-wasm-slice.test.tsx -t "classifies declared Flex/Text inputs"
```

Result:1failed/37skipped,2.05s. `paintInputInvalidations` was undefined in the
recovered inspector, so the new counter comparison failed. Baseline Vite dependency
discovery also warned about Monaco/lz-string from the isolated dependency links;
the selected Chromium test did execute and reach the intended assertion. This
replay establishes pre-slice failure, not a retroactive test-first sequence.
Subsequent slices must record the baseline failure before production edits.

Fresh primary commands/results:

```sh
corepack pnpm@11.21.0 exec vitest run --project chromium --mode layout-wasm packages/core/test/layout-wasm-slice.test.tsx packages/core/src/lib/signals/input-provision.test.ts
# 43 passed, 2 files, 11.62s
corepack pnpm@11.21.0 typecheck
# passed
VITE_CONFIG_NATIVE_IGNORE_WARNING=true corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/signals/graph.test.ts packages/core/src/lib/signals/render-consumer.test.ts packages/core/src/lib/signals/input-provision.test.ts --browser.headless --browser.ui=false
# 70 passed, 3 files, 1.86s
```

The suites overlap; do not sum their test counts. Targeted changed-runtime
ESLint and diff checks pass. Node26.9.0/pnpm11.21.0/Playwright Chromium; no full
trust, Node24, built-role consumer, comparative speed or zero-layout-visit claim.

Live source Studio session71013 remains on5187 at
`/#/examples/layout/wasm-flex-text`. Actual Chromium interaction receipt:

- Initial:frames1,solves2,measuredLeaves4,nodeCreates3; role counters0.
- Paint only:frames2,paint notifications2; solves2/measurements4/layout0/metric0.
- Change text:frames3,metric notifications1,measurements6; solves2.
- Toggle width:frames4,layout notifications1,solves3,measurements10; creates3.

No page or console errors. Canvas screenshot
`/tmp/pibbl-role-inspector-canvas.png` inspected. Browser plugin unavailable;
used repository Playwright. Studio keeps its existing lesson layout, so scroll
to Live Canvas if the header is above the preview. Slice25's direct installed
demo remains independently available on5189.

Parallel conformance support produced/imported a proposed33-capability ledger,
with validated unique IDs, dependencies, evidence file paths and only the three
actual pinned Yoga cases. It is not a conformance percentage or an extra slice.
Group9 now has two deliveries. Next: stable experimental Flex allocation reuse
for paint-only updates, then bounded consolidation. Root-wide preparation,
general intrinsic sizing, public API decisions and release gates stay open.
