# 010 — Experimental layout engine rework

## Current checkpoint and single next slice — 2026-10-23

Latest delivery is slice114 (definite nested percentage cross maxima).
Slice113 is `b78d69ec` (decorated reversed nested cross minima).
Slice112 is `3453bbe3` (nested wrapped percentage cross minima).
Consolidation37 is `7dd05604` for109–111.
Slice111 is `e014ac02` (real-root loading cancellation/failure cleanup).
Slice110 is `642941bc` (unrounded logical geometry policy and evidence).
Slice109 is `f99a7cdd` (source-order Canvas composition evidence).
Slice108 is `35eef93b` (wrapped-row measured Text cross-auto sizing).
Consolidation36 is `ac070c0c` for106–108.
Slice107 is `7b599250` (automatic-width Text cross-auto sizing).
Slice106 is `33832012` (measured built-in Flex owner cross-auto sizing).
Slice105 is `931ecc2f` (measured custom primitive cross-auto sizing).
Consolidation35 for103–105 passes, recorded below.
Slice104 is `9c974fe1` (measured Text cross-auto sizing).
Slice103 is `d8e5bf09` (opposing auto-margin bounds evidence).
Slice102 is `dc0565a6` (auto shorthand and edge precedence).
Slice101 is `e2418916` (finite cross-auto direction coverage).
Slice100 is `26613e70` (bounded finite row cross auto margins).
Slice99 is `57a74243` (wrapped per-line main auto margins).
Slice98 is `aced729e` (finite nowrap main auto directions).
Slice97 is `a47dd931` (finite physical main-axis auto margins).
Slice96 is `3548157d`; consolidation32 is `2cd27a12`.
Slice95 is `69b187a6` (combined direction evidence).
Slice94 is `196e8275` (final-width custom measurement).
Slice93 is `a7c36733` (finite wrapped-row intrinsic height).
Slice92 is `02f21ea3` (custom intrinsic providers).
Slice91 is `3f943f70` (logical layout borders).
Slice90 is `c997f41e` (logical padding).
Slice89 is `f8f7e76d` (logical Flex margins).
Slice88 is `14386781` (inherited Flex layoutDirection).
Previous delivery is slice87 `aac241f6` (wrap-reverse percentage physical margins).
Slice86 is `cd55cff0` (wrapped percentage physical margins).
Slice85 is `e4ea5c0d` (finite nested percentage wrapping evidence).
Slice84 is `86030541` (allocated-nowrap percentage physical margins).
Slice83 is `43f8c34d` (fixed-width direct Text in wrapped columns).
Slice82 is `3dc71e11` (wrapped stretched cross sizing and percentage bounds).
Slice81 is `732ef064` (finite allocated-child percentage padding).
Slice80 is `fe6d6bc1` (finite allocated-owner percentage gaps).
Slice79 is `dbffc7c1` (settled-column percentage cross constraints).
Slice78 is `a96ee4a2` (finite wrapped aspect-ratio participation).
Slice77 is `239df577` (definite percentage bounds and worktree catalog isolation).
Slice76 is `c787d7d9` (safe overflow and finite distribution evidence).
Slice75 is `bcf4f02e` (direction-independent start/end alignment).
Slice74 is `e6175c94` (finite allocation evidence and initial-freeze correction).
Slice73 is `27b18dde` (finite numeric-gap capability evidence complete).
Slice72 is `dc4b7d42` (finite Flex outer-box aspect ratios).
Slice71 is `ac38f518` (pinned asymmetric layout-border conformance).
Slice70 is `b7d5dc68` (explicit layout border widths).
Slice69 is `9b530832` (Studio runtime dependency invalidation).
Slice68 is `df3d0974` (pinned border-box bounds and percentage conformance).
Slice67 is `16fe904e` (coherent content-box/border-box sizing).
Slice66 is `6648bf66` (pinned Yoga wrap/cross-reversal conformance).
Slice65 is `fcfea332` (pinned Yoga reverse-axis conformance).
Slice64 is `f5639a2e` (pinned Yoga column conformance).
Slice63 is `440f7c32` (fixed-row intrinsic Grid in Flex columns).
Slice62 is `4f358f70` (settled-width intrinsic Flow in Flex columns).
Slice61 is `a3ef3378` (pure described Layer children).
Slice60 is `c90df382` (direct-entry Layer child preparation).
Slice59 is `d7649a75`, corrected by `ab2adb72` (known-family Layer children).
Slice58 is `edcf60a6` (prepared Absolute-root planning/adoption).
Slice57 is `bf03d14f` (prepared Overlay-root planning/adoption).
Slice56 is `cf2c7bc5` (prepared Flow-root planning/adoption).
Slice55 is `1510efe3` (prepared Grid-root planning/adoption).
Slice54 `773da7b9`,53 `aaa7ddcb`,52 `b5381e0d` are consolidated in `f322a709`.
Every slice has its own commit. The fixed33-capability/seven-gate denominator is
unchanged; all seven gates remain open. Consolidation26 is `2cd357d4`; consolidation27 is `abbaf209`; consolidation28 is `dfd16c8f`; consolidation29 is `f2e38dc6`; consolidation30 is recorded below; slices91–93 are delivered below; consolidation31 passed below; slices95–96 direction evidence passed below; consolidation32 for94–96 passed below; slices97–99 are delivered below; consolidation33 passed below; consolidation34 of100–102 passed below; consolidation37 for109–111 passes below; the single next checkpoint is consolidation38 for112–114. Source5192/built5193, `#/testing/layout-preflight`:
Source5192/built5193 `#/examples/layout/wasm-yoga-migration`: Next case + resize
cycles314 records:220matches/94classified differences; click A/B/C targets.
Canonical built comparison: http://127.0.0.1:5193/#/examples/layout/wasm-yoga-migration.
Native Grid tracks/spans and Flow wrap controls remain available.

The loading/named-component integration is ready for source feedback on branch
`codex/layout-integration-20261022`. It combines the saved loading checkpoint with
allocation-discipline commit 8466d093 (integrated as 147208d1), the newer cancellable
async catalog host, shared sync/async example ownership and sandbox cleanup. There
is one compiled-module cache and one pending-mount registry. Superseded private
loading files were removed; the previous public loading suite remains as a
separate checkpoint regression suite. Original checkouts and backups are retained.

### Consolidation 9 completed for delivery slices 25–27

This is the bounded consolidation after three delivered slices: portable packed
consumer (25), receiver input roles (26), and external loading/explicit sync mounts
(27). Reconciliation commits are 147208d1 and 1485beb6, not additional feature
slices. One focused read-only review of 1485beb6 against 147208d1 found no material
loading/mount arbitration, named-host ownership, asset-base or jump-startup issues.
No additional reviewer or broad aggregate gate was launched.

Stable source and built nested browser replays both passed after explicitly
revealing the iframe: footer 320→360→280, moved hits, keyed detach/restore, receiver
roles and zero owned layout resources after disposal. The built receipt contains
463 private built inputs. Logs are
`/tmp/pibbl-integration-clean-source-nested-20261022.log` and
`/tmp/pibbl-integration-clean-built-nested-20261022.log`. Final early-jump visual
inspection shows the actual Canvas and controls, width 320 and no errors:
`/tmp/pibbl-integration-final-jump-20261022.png`. These fresh receipts supersede the
in-flight HMR footer mismatch and offscreen blank probes described below. The
navigation test also verifies the control is disabled during asynchronous startup
and scrolls the preview panel once ready. No scheduler fix was needed.

### Finite accepted exit checklist (reconciled after slice 36)

Earlier numerical slice forecasts are historical estimates, not remaining-work
counts or new scope. Completion is measured against the accepted proposal and its
33-capability manifest, rather than by adding controls or exhausting a slice count.
The fixed denominator is the manifest's 33 capabilities and seven release-gate
groups. The summary below groups work for readability; it does not add exits.
Exactly one implementation slice is queued.

| Exit                                               | Required completion evidence                                                                                                                                                                                                                                                                             | Current dependency or blocker                                                                                                                                                                                                        |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Flex and native sizing                             | Implement and classify the accepted matrix: reverse/wrap-reverse, margins/auto margins, percentages/gaps, box sizing/borders, aspect ratio, baselines, RTL/logical edges, containing blocks and hidden/contents participation; positive/negative/interaction geometry fixtures for every supported entry | Current experimental subset is bounded; unresolved native minimum/provider and precedence policies require exact designs before those paths broaden                                                                                  |
| Grid and other layout families                     | Preserve Absolute/Overlay/Flow and complete the declared Grid track/placement/implicit/intrinsic target, with mixed nested examples and semantic geometry tests                                                                                                                                          | General nested preparation and intrinsic constraints must be available first; current Grid subset is not completion                                                                                                                  |
| Prepared transactional geometry and reactive reuse | One root-wide prepared ownership model; stable identity, changed-geometry publication, rollback/failure isolation, receiver roles and bounded invalidation; public nested component/Layer/external-renderer tests with deterministic cleanup                                                             | Shared root instances, bounded known Flex plans, pure Card/known columns and frozen allocation caches are foundations, not a full graph or atomic publication                                                                        |
| Migration and conformance                          | Version/commit/configuration-bound Yoga corpus with explicit Pibbl conversions/divergences; supported public Pibbl migration app and documented framework-author path using the same semantics; all unsupported entries visible                                                                          | Twelve exact pinned Yoga fixtures exist, including finite row/column/reverse/wrap and the Rectangle conversion cases; the broad classified corpus remains incomplete. Standalone API details must follow the public design agreement |
| Reproducible performance                           | Comparable kernel, JS integration and whole Canvas workloads, structural work/allocation counts and reproducible timing receipts under documented environments                                                                                                                                           | Correct broad graph/algorithms precede timing claims; current counters demonstrate only their bounded paths                                                                                                                          |
| Final integration and release                      | Accepted behavior migrated across consumers/docs/editor/types/packed output, source/built browser and lifecycle evidence, documented Node24/pnpm11.21 trust gate, then the requested separate hyper-critical whole-codebase review                                                                       | Full supported behavior and prior exits must land before final aggregate verification/review; Node26 receipts are not Node24 release evidence                                                                                        |

The exact seven manifest gates remain open as follows:

| Gate ID                       | Status                    | Completion evidence                                                                                                                                                         | Predecessor                                      |
| ----------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `flex-core`                   | Partial/experimental      | All enumerated Flex cases, values/defaults and interactions classified against pinned fixtures                                                                              | None                                             |
| `box-and-direction`           | Partial                   | Box sizing, borders/padding, margins, direction/logical edges and aspect-ratio fixtures                                                                                     | `flex-core`                                      |
| `measurement-and-intrinsic`   | Partial/experimental      | Supported constraints, baseline/providers and nested prepared-tree intrinsic contributions with failure/callback evidence                                                   | `flex-core`                                      |
| `placement-and-participation` | Partial                   | Containing-block, relative/static/absolute, hidden/contents identity, geometry and input evidence                                                                           | Box/direction and measurement/intrinsic          |
| `reactivity-and-publication`  | Partial foundations       | Root-wide shared WASM prepared graph, rollback and fail-closed atomic geometry, work-admission/caching/ownership counters                                                   | Measurement/intrinsic                            |
| `migration-and-conformance`   | Partial rehearsal         | Standalone `@pibbl/layout`, both framework-host and Pibbl application migration rehearsals, classified versioned Yoga differential, source/built/packed deployment evidence | Prior five gates                                 |
| `grid-beyond-yoga`            | Missing target completion | Declared explicit/implicit Grid and intrinsic vocabulary matrix with nested Flex interaction evidence                                                                       | Measurement/intrinsic and reactivity/publication |

Performance and final release verification are cross-cutting evidence requirements,
not extra capabilities. Adoption requires the same shared WASM across supported
layout families, with no hidden legacy fallback. Published exclusions remain fixed.

This preserves the proposal's explicit exclusions: full CSS, vertical writing and
subgrid are outside the first release; overflow sizing does not promise a scrolling
widget, semantic DOM, editing or a retained rendering scene graph. Optional standalone
layout distribution follows stabilized integration; no second scheduler is authorized.
Loading and named-component migration are delivered but do not close these exits.
The capability manifest and proposal linked below remain the exact scope ledger.

### Slice 28 — bounded paint-only Flex allocation reuse

The accepted scope is an internal fast path for explicitly frozen direct Rectangle
and Text descriptors, props, styles and child arrays. Mutable authoring, accessors,
opaque components, responsive/custom styles and custom fonts stay conservative.
Text eligibility uses generic font families only. No public API or immutable
ordinary-JSX contract was introduced.

The public regression failed before production changes: paint changed pixels but
allocationPasses rose from 1 to 2. The paired mutable-width characterization passed
and continues to pass. The implementation checks identity and scalar settings
before child preparation, caches scalar geometry with weak input ownership, and
rebinds raw children so current paint and interaction inputs resolve normally.
Every non-paint signal notification invalidates the conservative realm revision,
including a notification after paint has already dirtied the consumer. Successful
transactions publish the cache; mounted-region disposal clears it.

Fresh focused experimental checks passed: 5 files / 77 tests, covering actual
allocation/item visits, changed pixels, mixed paint/width batches, text metric
changes, mutable/accessor fallbacks and owned-resource cleanup. Repository
TypeScript and targeted ESLint passed. One reused independent reviewer found no
material findings. Node 26.9.0, installed pnpm 11.21.0 dependencies and Playwright
Chromium were used; no aggregate trust or Node 24 result is claimed.

Independent source and built browser checks passed through the public example:
after entering frozen mode allocationPasses=5, allocationItemVisits=8, cacheHits=0;
Paint leaves passes/items unchanged and raises hits to 1. Width 320 recomputes
passes=6/items=10. The old paragraph position misses and the moved visible text
selects frozenB. No page errors. Logs:
`/tmp/pibbl-slice28-source-counters.log` and
`/tmp/pibbl-slice28-built-counters.log`; inspected screenshot:
`/tmp/pibbl-slice28-source-visible.png`.

Slice ready for feedback: source
`http://127.0.0.1:5192/#/examples/layout/wasm-flex-text` and built port 5193.
Choose **Toggle frozen proof**, then Paint, Toggle width and Change Text. This is
bounded allocation reuse, not general zero-visit layout or full feature completion.

### Slice 29 — bounded direct Text automatic minimum

Second delivery in group 10 (slices 28–30). The experimental mounted nowrap row
accepts omitted minWidth only for direct wrapped Text with generic px font,
default/visible fit, positive shrink and numeric basis (or auto basis plus numeric
width). No query, percentage width/maxWidth or other layout/fitting path is added.
The minimum is its longest literal-space-delimited run measured with the existing
Canvas service, capped by numeric width/maxWidth. Flex basis does not cap it.
Explicit zero retains deliberate shrinking; insufficient row space overflows
through existing visible/clip container composition. The normal JS path and all
public signatures are unchanged. This selects the bounded native policy only;
general intrinsic/provider and Yoga conversion rules remain open.

A new public regression first failed with the existing explicit-minimum diagnostic
(`/tmp/pibbl-slice29-red.txt`). After fixing a new fixture's top coordinate, the
public scene passed. Comparison controls were established with a separate failing
regression; a later failed-then-passed text update connects Change text to both
comparison rows. Public and supplemental evidence covers actual pixels, explicit
zero, declared width/maxWidth caps, flexBasis not being a cap, and excluded clip.
The helper uses Text's existing ASCII-space break contract and receiver-owned
content preparation; each uncached minimum query increments measuredLeaves.
No query cache, complete Canvas-call counter or performance gain is claimed.

Fresh focused evidence: four files / 79 tests passed before the added boundary
matrix; the final six-case minimum suite passed including text input updates.
Normal JS focused evidence: 36 passed / 5 experimental cases skipped before the
supplemental matrix. Direct repository typecheck and scoped lint passed. The reused focused reviewer
found no material findings in the minimum helper, eligibility/caps or receiver
ownership; no extra reviewer was launched. Environment:
Node 26.9.0, installed pnpm 11.21.0 dependencies, Playwright Chromium. No aggregate
trust/Node 24/full Yoga parity claim.

Independent source and built browsers passed width320, old/moved sibling hit
positions for both rows, no page errors and zero nodes/arenas/measurement entries
after disposal. Logs `/tmp/pibbl-slice29-source-browser.log` and
`/tmp/pibbl-slice29-built-browser.log`; inspected screenshot
`/tmp/pibbl-slice29-source-visible.png`. These checks preceded the small Change text
wiring, whose public headless regression passes. Source and built runtime artifacts
contain the minimum helper and measurement accounting (verified in the private
package dist and the built-lane resolver); the WASM binary remains
56793 bytes. Browser feedback URL remains ports 5192/5193, example
`#/examples/layout/wasm-flex-text`: choose Compare Text minimum, Toggle width and
Change text; click green siblings. This is slice ready for feedback, not feature
completion.

### Slice 30 — natural direct Text automatic basis

Third delivery in group 10 (28–30). In the same experimental direct generic Text
nowrap-row subset, omitted/auto width and basis use the natural pre-wrap width.
Numeric width remains the specified-basis path. Numeric minWidth, including zero,
retains precedence; omitted minWidth uses slice 29's word floor when shrinking.
The final allocated width still determines wrapped height. Normal JS behavior and
public signatures are unchanged. Leading empty ASCII-space words and all-space
content follow the current wrapped Text implementation rather than a new CSS
whitespace model.

The first public regression failed with the existing missing-minimum diagnostic
and wrong sibling pixels (`/tmp/pibbl-slice30-red.txt`). A demo regression failed
before wiring Toggle auto basis. A whitespace regression then failed because
natural measurement counted leading spaces that rendering drops; the helper was
corrected and all three public basis cases pass.

The adjacent contract suite found an actual paint-only measurement regression:
71 measuredLeaves instead of 70 in the column/row switching example. Preserve that
assertion. One lazily owned current content/font/natural-width entry per numeric
item fixes it; current receiver content is prepared before lookup, changed text or
font replaces it, and node removal/disposal clears it. It is separate from the two
final-size measurement entries to prevent eviction thrash. Word-minimum queries
remain uncached and explicitly counted. No complete Canvas-call/performance claim.

Final focused experimental evidence: five files / 86 tests passed, including the
previous failing paint-only assertion and slices 28–30 public demos. Normal JS:
36 passed / 12 experimental cases skipped. Repository typecheck, targeted lint,
private built package (unchanged validated 56793-byte WASM), public JSDoc and
scenario-discovery checks passed. Node 26.9.0 / installed pnpm 11.21.0 dependencies /
Playwright Chromium; no aggregate trust or Node 24 claim. Runtime source and built
previews were restarted after the cache fix at ports 5192 and 5193. Public example:
`#/examples/layout/wasm-flex-text`, Compare Text minimum → Toggle auto basis →
Change text / Toggle width. Final source and built browser checks passed through
`tooling/test-wasm-text-intrinsics.mjs`: frozen paint allocation reuse, natural
basis/text changes, old-position misses/current-position hits, and zero
nodes/arenas/measurement entries after disposal. Built provenance is 465 inputs,
all from the private package dist. Logs are
`/tmp/pibbl-group10-source-browser.log` and
`/tmp/pibbl-group10-built-browser.log`. No page errors.

### Consolidation 10 completed for delivery slices 28–30

Separate delivery commits: 3ad6be75, 217d6ec5 and 98cc8bd7. The focused 86-test
experimental run, normal 36-test lane, typecheck/lint, private build, JSDoc and
scenario checks are recorded above; the final reproducible source/built browser
probe closes the pending runtime receipt. No unchanged broad trust gate or extra
reviewer was launched. Per the maintainer's latest instruction, continue through
accepted work without per-slice feedback waits; the requested whole-codebase
hypercritical architecture/performance review belongs at the end of all work.
This consolidation does not turn the experimental subset into full feature
completion or Yoga parity.

### Slice 31 — pure structural Card prototype

Adds the proposal's `defineLayoutComponent<P>(describe: (props: Readonly<P>) =>
PibblNodeInput): PibblComponent<P>` operation. A description exposes one known
primitive root and forwards style explicitly. It retains the Card's ordinary
identity boundary and the returned root's own identity, rather than flattening
away their lifecycle distinction. Existing transaction/receiver provisions share
one root across style inspection, measurement and paint; no cross-frame cache or
immutable-props promise. Hooks/Canvas/allocation reads and signal writes are
forbidden. Ordinary components below declared boxes execute only after allocation.

Public failing import/API and scenario regressions preceded production changes.
The direct-mount root-key test then exposed lost structural signal ownership;
collecting through a receiver provision during isolation and adopting after owner
restoration fixes it. Root key changes now remount and clean descendants exactly.
Initial support uses an explicit finite width on the described column; automatic
width and general nested structural contributions remain later work. Card aggregate
measurement is not cached between transactions.

Fresh checks: 9 focused public Card/guard/lifecycle tests passed; adjacent Flex,
WASM-layout and provision suite totals 4 files / 87 tests. Repository typecheck,
targeted lint, public JSDoc and exact source/built/editor export parity passed.
The initially missing editor declaration prevented iframe creation; adding the
exact maintained signature resolves it. Private and normal package outputs were
built. Installed offline tarball consumer passed strict Bundler/NodeNext, public
structural scenario, exact cleanup and 227 installed dist inputs. Its explicit-sync
entry requires zero external layout downloads; Studio async lanes still require
an actual fetched asset. No broad aggregate trust or Node 24 claim.

Source and built browser runs passed footer320→360→280, old/current hit targets,
keyed remove/restore, ordinary-only probes, one description per width transaction,
and zero nodes/arenas/measurement entries after disposal. Built provenance is466
private dist inputs. Logs `/tmp/pibbl-slice31-{source,built}-browser.log`,
`/tmp/pibbl-slice31-packed.txt`, `/tmp/pibbl-slice31-focused.txt` and
`/tmp/pibbl-slice31-studio-parity.txt`. One reused focused reviewer found no material
issues; direct-mount ownership was additionally established by the later red/green
regression. Environment Node26.9.0/pnpm11.21.0 dependencies/Chromium.

Runnable source/built ports5192/5193: `#/examples/layout/wasm-flex-nested-intrinsic`;
choose Toggle pure Card, then width/Text/key controls and the green footer. This is
group11's first delivery; consolidate after31–33. End-of-all-work whole-codebase
review remains deferred as requested.

### Slice 32 — settled width through a structural Card

A direct Card with a proven nowrap-column Flex root now uses the existing finite
stretched cross-allocation path. Parent bounds and root padding determine content
width before Text determines height. The wrapper retains numeric/identity ownership;
measurement clones carry the root's receiver token so preparation and paint share
one description. No new API, cache, scheduler or generic component discovery.
The public example no longer calculates root width from the workspace signal.

The focused public regression failed with unsupported automatic height before the
change (`/tmp/pibbl-slice32-red.txt`) and passed afterward. Three files / 83 focused
experimental checks passed. Normal public Card/guard/lifecycle checks: 7 passed /
3 experimental cases skipped. Repository typecheck, scoped lint and matching private
package build passed. Node26.9.0/pnpm11.21.0 dependencies/Chromium; no aggregate gate
or Node24 claim.

Coherent source and built `--structural` browser probes passed footer320→360→280,
one description per width transaction, ordinary-only probe evaluation, moved hits,
keyed detach/restore and zero disposal resources. Built provenance466 private dist
inputs. Logs `/tmp/pibbl-slice32-{source,built}-browser.log`. Same runnable ports5192/
5193 and `#/examples/layout/wasm-flex-nested-intrinsic`, Toggle pure Card.
This is group11's second delivery; consolidate31–33 after the next slice.

### Slice 33 — nested structural Card intrinsic columns

Nested pure Cards now contribute automatic height through their prepared nowrap
Flex column roots after finite width settles. Canonical receiver tokens preserve
one description per receiver/transaction and ordinary wrapper identity. Returned
source metadata preserves cycle detection across preparation clones. The public
example contains both outer and paragraph Cards without manual width arithmetic.

The public nested regression failed before runtime edits; a shared cyclic root
also failed with stack overflow before the source-metadata correction. Fresh checks
on Node 26.9.0, pnpm 11.21.0 dependencies and Chromium: 85 experimental tests passed;
normal lane 16 passed / 5 experimental cases skipped. Typecheck, scoped lint and
private package build passed. Source and built structural browser probes passed
footer 320→360→280, both descriptions once per width transaction, moved hits,
keyed removal/restoration and zero disposal ownership; built provenance 466 inputs.
Logs: `/tmp/pibbl-slice33-{focused,normal,typecheck,lint,build}.txt` and
`/tmp/pibbl-slice33-{source,built}-browser.log`. Focused review found no material issue.

Runnable ports 5192/5193: `#/examples/layout/wasm-flex-nested-intrinsic`, choose
Toggle pure Card. Nested aggregate heights still remeasure each transaction;
this does not establish a general prepared graph or arbitrary callback termination.

### Slice 34 — empty Rectangle automatic minimum

Selected native policy: experimental direct empty Rectangle items with no authored
children property or responsive query and finite nonnegative numeric width/height
use zero automatic main minimum. Explicit minima, padding floors and shrink factors
still win. Text and custom providers retain their bounded rules. Intrinsic Flex
measurement still requires explicit minima; this slice changes direct allocation.
Normal JavaScript behavior is unchanged.

The public mount regression failed with the expected explicit-minWidth diagnostic
before production changes. Semantic allocations prove 50/50 shrink; Canvas pixels
and clicks establish the same boundary. Additional cases prove explicit 70/30,
no-shrink 80/20 and column 50/50. Fresh experimental checks: 87 passed across three
files; normal lane 39 passed / 36 experimental skips. After the diagnostic fixture
was moved to unsupported Text, its focused 35 checks passed. Logs
`/tmp/pibbl-slice34-{red,focused,normal,boundary,typecheck,lint}.txt`.
Environment Node 26.9.0 / pnpm 11.21.0 dependencies / Chromium.

Slice 34 public Studio follow-up: Minimum comparison includes two 80px empty
Rectangles in a 100px row, omitting minima. Source and built browser probes click
both sides of the 50px boundary and the right interior, alongside existing Text,
frozen allocation reuse and exact cleanup assertions. Scaled Studio clicks use
interior coordinates; the mounted public test checks exact adjacent pixels/hits.
Both pass with no page errors, built provenance 466 inputs. Logs
`/tmp/pibbl-slice34-{source,built}-browser.log`. Inspect
http://127.0.0.1:5192/#/examples/layout/wasm-flex-text, Compare Text minimum,
then the boxes on the right. Built equivalent on port 5193.

### Slice 35 — matching intrinsic empty Rectangle contributions

A public measureElement regression failed at the explicit-minHeight guard for a
finite-width automatic-height Flex column containing two empty fixed Rectangles.
The shared private eligibility predicate now waives that guard consistently in
measurement and allocation. Existing zero content minimum, bounds, padding,
percentage rejection and known-container measurement rules remain responsible for
the result; no generic provider execution or duplicate policy was added.

Fresh checks: 88 experimental tests across three files, normal 39 passed / 37
experimental skips, repository typecheck and scoped lint. Matching private build
passes and the source/built public Rectangle/Text/frozen Studio checks pass with
466 built inputs and zero cleanup resources. Logs
`/tmp/pibbl-slice35-{red,focused,normal,typecheck,lint,build}.txt` and the slice34
browser follow-up logs above. Node 26.9.0 / pnpm 11.21.0 dependencies / Chromium.

### Slice 36 — percentage-sized empty Rectangle automatic minima

The public finite-row percentage regression failed with the explicit-minWidth
diagnostic before changes. Direct allocation now accepts authored percentage width
and height for the same empty Rectangle policy; existing finite parent resolution
validates lengths and computes the basis. Intrinsic measurement remains numeric
and keeps its percentage rejection. Explicit bounds, row/column shrink and zero
content minimum with outer padding floors are covered without provider discovery.

Fresh checks: 90 experimental tests across three files; default JavaScript lane
39 passed / 39 experimental skips; root typecheck, scoped lint and private package
build pass. The Studio proof now authors both boxes with 80% width. Source/built
browser probes pass both targets, existing frozen reuse/Text controls, zero errors
and zero teardown resources; built provenance466 inputs. Logs
`/tmp/pibbl-slice36-{red,focused,normal,typecheck,lint,build}.txt` and
`/tmp/pibbl-slice36-{source,built}-browser.log`. Node26.9.0 / pnpm11.21.0
installed dependencies / Chromium. Same ports5192/5193 and wasm-flex-text route.

### Slice 37 — pinned empty Rectangle conversion evidence

The native probe freshly reproduced Yoga3.2.1 commit
`042f5013152eb81c1552dec945b88f7b95ca350f` from a checkout at that exact revision.
Two added fixtures prove numeric empty shrink50/50 and percentage basis with
explicit content-box sizing/padding/minimum110/90. Probe and license hashes bind
the generated record; no Yoga implementation is shipped. Existing three fixtures
remain unchanged. This is bounded conversion evidence, not broad parity.

A public example regression failed before direct Rectangle migration rendering
was added. All43 focused public checks now pass, including semantic allocations
against recorded boxes, pixels and A/B target clicks. Source and built five-case
Studio probes pass with no errors, cleanup0/0/0 and466built inputs. Root typecheck,
scoped lint and recorded provenance validation pass. Logs
`/tmp/pibbl-slice37-{oracle,recorded,red,focused,typecheck,lint}.txt` and
`/tmp/pibbl-slice37-{source,built}-browser.log`. Environment remains Node26.9.0,
pnpm11.21.0 dependencies, Chromium; native compiler used by the pinned generator.
Hands-on ports5192/5193, `#/examples/layout/wasm-yoga-migration`, Next case + resize
cycles five fixtures; click the right-side boxes.

### Slice 38 — numeric physical margins through shared WASM

Presented public additions are numeric `margin`, `marginTop`, `marginRight`,
`marginBottom` and `marginLeft` on LayoutItemStyle/FlexItemStyle. Logical Canvas
units, finite negatives, specific edges over shorthand, default zero; margins are
outside padding/paint/hit bounds. This first slice supports experimental direct
nowrap rows/columns and rejects margins under wrapped Flex, other layout families
and normal JavaScript Flex. Percentage/auto/logical values are not silently ignored.

A public mounted regression failed before implementation. Separate signed margin
slots extend private main/cross records from8 to10f64; nonnegative padding/bounds
remain distinct and validated. The same WASM kernel owns allocation and placement.
Margin signals use layout roles. Review found signed intrinsic accumulation could
produce negative auto dimensions: a new public test failed, then final accumulation
was clamped at zero without clamping individual margins.

Fresh evidence:93 focused experimental tests; after semantic/role/unsupported-family
additions,47 public WASM checks pass. Normal focused lane42pass/5skip. Typecheck,
scoped lint, exact editor/source/built export parity, public JSDoc and catalog pass.
Packed installation proves margin field declarations under strict Bundler/NodeNext,
227 installed dist inputs and structural lifecycle. Source/built public controls
prove margin-space misses, negative-margin shifted hits, prior Text/percentage/
frozen reuse and cleanup0/0/0, no errors; built466inputs. The matching artifact is
57358bytes, compiled with the repository-pinned Rust1.99.0/wasm32 target installed
only under `/tmp/pibbl-layout-{cargo,rustup}`. Official installer checksum verified;
no global toolchain or shell configuration change. Node26.9.0/pnpm11.21.0 deps/
Chromium; no Node24 trust or performance claim. Logs `/tmp/pibbl-slice38-*`.

Hands-on ports5192/5193, wasm-flex-text, Compare Text minimum: lower-right margin
row toggles5/-5 by clicking its left box. Margins preserve source paint order.

### Slice 39 — physical margins in finite wrapped Flex

The public wrapped regression failed at the explicit margin diagnostic before
changes. Existing main records already include signed margins in line formation;
WASM line cross extents now include the signed cross margins, check finite results
and floor the resulting line extent at zero. Main allocation/placement and child
border boxes keep the shared kernel contract. Wrapped intrinsic sizing remains
unsupported; normal JavaScript and other layout families retain diagnostics.

Fresh95 experimental tests pass, including positive wrapped row/column geometry
and negative overlap within/between lines. Pixels and clicks prove later source
items remain topmost. Normal42pass/5skip; root typecheck, scoped lint and matching
57438-byte artifact/private package build pass. Actual source/built Studio probes
pass right-box wrap/nowrap toggles and the moved target, previous negative-margin,
Text/percentage/frozen proofs, no errors and cleanup0/0/0. Built466inputs. The
five pinned migration cases also pass on this combined built artifact. Logs
`/tmp/pibbl-slice39-*` and `/tmp/pibbl-consolidation13-yoga-browser.log`.
Node26.9.0/pnpm11.21.0 deps/Chromium; pinned Rust1.99.0 isolated under/tmp.
Same ports5192/5193 and wasm-flex-text route, Compare Text minimum, lower-right
margin row: left toggles signed margin, right toggles wrapping then moves below.

### Slice 40 — reverse main-axis placement with unchanged source order

Presented public direction union adds row-reverse/column-reverse in the experimental
build; normal JavaScript retains its diagnostic. Axis detection and intrinsic
column eligibility remain row/column aware, same-axis measurement snapshots
normalize direction, physical main margins map to the selected leading/trailing
edges, and main placement cache keys include direction. Both nowrap/wrapped WASM
main exports mirror each solved border-box offset within its source-formed line.
No descriptor array, text, identity, source paint/hit priority or tab order reverses.

The focused public test failed before runtime edits. Fresh97experimental checks
pass/1normal-onlyskip; normal43pass/5experimental skips. Coverage includes physical
margins, both axes, per-line wrap, direction-relative alignment and overlapping
pixel/hit priority. Typecheck/lint, public/editor parity and catalog pass. Installed
strict Bundler/NodeNext consumers accept the reverse direction and margin fields;
227installed dist inputs and structural lifecycle pass. Matching57590-byte artifact
uses pinned Rust1.99.0; no public ABI export changes beyond existing style values.

Source/built keyed collection probes pass separate Flip axes and source-key reorder
controls. Keys, stamps and nodes remain stable on direction flip; solve and measured
leaf counters stay flat while main placement runs. Old positions hit the newly
occupying child, moved positions hit the expected child; remove/restore, paint reuse
and cleanup0/0/0 remain correct, no errors; built466inputs. Logs
`/tmp/pibbl-slice40-*`. Node26.9.0/pnpm11.21.0 deps/Chromium; no Node24/full trust claim.
Hands-on ports5192/5193, `#/examples/layout/wasm-flex-keyed-wrap`, Flip axes.

### Slice 41 — reversed cross lines and cross alignment

Presented experimental wrap union adds wrap-reverse. Source line membership stays
unchanged; WASM reflects line placement and each border box's cross alignment,
including combined reverse main axes and asymmetric physical margins. Main and
cross placement caches carry independent direction flags. Normal JavaScript keeps
its wrap diagnostic, RTL stays unsupported, and source paint/hit/tab order remains.

The public regression failed before production edits. Fresh98experimental checks
pass/1normal-onlyskip; normal43pass/5experimental skips. Native unit fixtures were
found stale against the prior8→10slot and main-direction ABI: an actual native
compile failed, fixtures were updated to exact current records/expectations, and
four native tests now pass (bounds/overflow, distribution, huge factors, signed
margin reverse positions). Artifact compilation now runs those native tests before
writing a binary; --check stays compiler-free. Matching57666-byte artifact and
private package build pass with pinned isolated Rust1.99.0.

Typecheck/lint, exact public/editor parity and catalog pass. Installed strict
Bundler/NodeNext consumers accept wrap-reverse/row-reverse and margin fields;
227installed dist structural lifecycle passes. Source/built keyed collection
probes pass collection-heading cross-line flips, stable keys/stamps, unchanged
solves/measurements/main placements, cross-placement work only, old misses/new
hits, existing source reorder/remove/restore and cleanup0/0/0. No errors;
built466inputs. Read-only focused review found no material issue. Logs
`/tmp/pibbl-slice41-*`. Node26.9.0/pnpm11.21.0 deps/Chromium; no Node24/full trust claim.
Hands-on ports5192/5193, keyed-wrap route: click a collection heading to flip cross
lines, Flip axes for main placement, Reverse order for source key order.

### Slice 42 — root-owned shared WASM instance and isolated region handles

One lazy mutable native instance now belongs to the top-level Canvas root,
including managed Layers. Generational region handles own independent node/cross/
line vectors; JS identity, results and measurement caches stay region-owned.
Different roots and pure helpers remain isolated. Region removal releases handles;
an empty live root retains its instance until root disposal. Trap poisoning drops
an instance without native re-entry and invalidates peer cache admission. Stale
handles fail closed; exhausted generations retire slots instead of wrapping.

The public sibling/root test failed first (two instances instead of one). Fresh
focused experimental checks:90passed/1normal-onlyskip; normal42passed/49experimental
skips. Public evidence covers cached A→B→A placement without solving, independent
width changes, remove/restore, cross-root isolation, managed-Layer sharing and
idempotent disposal. Five native tests pass, including stale generation/reuse,
exhaustion, isolated cached placement and terminal disposal. Old ABI publication
is rejected. Typecheck and changed-code lint pass. Matching59181-byte artifact
built with pinned Rust1.99.0; native tests run in the compiler-backed build.

Source/built public keyed collections share one instance/two handles, preserve
geometry/input/cache behavior and dispose to zero. Managed-Layer lifecycle probes
complete five remove/restore cycles:4nodes/2handles/2measurements/1instance becomes
0/0/0/1 while the root lives, then0/0/0/0 on root disposal. Detached inputs stay
inert; built466inputs. Packed consumer227installed inputs, strict Bundler/NodeNext
and structural lifecycle pass. Focused read-only native/host review found no
material issue. Logs `/tmp/pibbl-slice42-*`. Node26.9.0/pnpm11.21.0deps/Chromium;
no Node24 aggregate trust claim. Hands-on ports5192/5193, keyed-wrap and
wasm-built-lifecycle routes. No complete prepared graph/publication claim.

### Slice 43 — known sibling Flex input preflight

An experimental Absolute boundary now prepares direct known Flex siblings'
container options, direct-child position/participation syntax and grow/shrink
factors before visiting ordinary descendants. A root-transaction-local lookup
shares receiver-owned normalized styles with normal allocation and frozen-cache
paths. Existing transaction child materialization is reused, opaque components
are never speculatively evaluated, and geometry solves only during normal traversal.
Transaction completion drops pending snapshots; existing failure cleanup releases
provisional receiver subscriptions and mounted handles. No native ABI change.

The focused public regression failed first: the earlier opaque probe ran twice
when a later sibling became invalid. It now runs once until explicit recovery,
then receives the latest100px allocation. A separate focused public primitive/
iterable test proves one child-sequence traversal, one normalization and one render
per transaction. Source and built Studio labs both prove expected failure before
earlier evaluation, independent-root green pixels, absent failed targets, recovery
geometry and the new right-edge hit. Both use225public core inputs; the built
provenance contains only private built entries. Controls belong to the application
host outside the failed Canvas, not to a per-example mount wrapper.

Fresh focused experimental112passed/1normal-onlyskip, including the callback-once
check. Normal57passed/55experimental skips. Typecheck,
changed-code lint and source/built/editor exact export parity pass. Private package
still uses matching59181-byte binary. Packed228installed-input consumer passes
strict Bundler/NodeNext and structural lifecycle. Focused read-only runtime review
found no material issue in transaction tokens, snapshot adoption, cached placement
or failure cleanup. Logs `/tmp/pibbl-slice43-*`. Node26.9.0/pnpm11.21.0deps/Chromium;
no Node24/full trust claim. Limits: no complete known-tree solve/preflight, general
prepared graph, native topology transaction, atomic geometry/HTML/focus generation
or pixel rollback. All seven release gates remain open.

Hands-on Studio: `http://127.0.0.1:5192/#/testing/layout-preflight`, built on5193.
Fail later sibling, Recover, then click the red box's right edge. Independent green
Canvas updates through failure; host controls remain usable. Standalone equivalent
on5194/5195 is supplemental, not the sole hands-on delivery.

Slice43 public-lab follow-up: recovery explicitly retains the controller returned
by `pibblSync`; the live-root implementation returns its stable controller.
Fresh source/built Studio checks dispatch actual pagehide after recovery and
assert nodes/region handles/WASM instances/measurement entries all zero before
closing the browser. The virtual lab bundle now watches real source dependencies
(excluding synthetic esbuild definition records), so edits rebuild current code.
Logs `/tmp/pibbl-slice43-studio-*-cleanup.txt`. This correction is a separate
focused commit; the slice44 red sizing regression remains uncommitted work.

### Slice 44 — known sibling geometry preparation

Absolute→direct Flex preparation now runs the existing allocation and demanded
pure measurement path before sibling component traversal. Stable parent-owned
slots use placement type/key/occurrence identity, carry a clone-preserved private
annotation and retain one root-owned native region. Rendering claims its staged
child placements and adopts that same region into actual component teardown.
Unclaimed plans release on transaction completion; failed root cleanup also
releases acquired regions. Removed slots are deleted, stale teardown cannot remove
a replacement slot, and surviving keyed regions retain records across frames.
No native ABI, second solver or speculative ordinary component evaluation.

The public sizing regression failed before runtime edits: valid syntax with a
later minWidth90/maxWidth80 allowed an earlier probe to run. It now fails before
that evaluation, releases provisional handles/nodes and explicitly recovers at the
latest100px width. Successful width updates allocate exactly once per region,
solve only the changed region and create no numeric records. Keyed reorder keeps
component stamps/nodes, moved hit targets agree, removal releases one region and
restoration creates only that occurrence. Wrapped Text allocation uses one mounted
allocation pass, reuses numeric records, changes the paragraph hit height and
keeps its adjacent probe at the final location.

Fresh experimental115passed/1normal-onlyskip; normal57passed/59experimental skips.
Source and built Studio sizing-fault controls pass failure ordering, independent
root updates, explicit recovery pixels/right-edge hit and actual root
cleanup0/0/0/0;225public core inputs per lane. Packed228installed-input strict
Bundler/NodeNext and structural lifecycle pass. Final Typecheck, changed-code lint and source/built/editor exact public export
parity pass. Matching59181-byte native artifact is unchanged. Focused
read-only review found no material issue in plan/constraint matching, native region
adoption, transaction cleanup or persistent cache reuse. Logs
`/tmp/pibbl-slice44-*`. Node26.9.0/pnpm11.21.0deps/Chromium; no Node24/full trust
claim. All seven gates remain open: this does not prepare every descendant,
introduce a native topology transaction or guarantee atomic HTML/focus publication.

Hands-on source: `http://127.0.0.1:5192/#/testing/layout-preflight`, built5193.
Click Fail later sizing, Recover, then the red box's right edge. The green root
continues updating and the host controls remain usable through the failure.

### Slice 45 — hierarchical known Flex geometry preparation

A prepared Flex now inspects direct built-in Flex descendants after its own
allocation settles. Stable slots own child-slot maps by type/key/occurrence,
carry the same clone-preserved annotations and adopt already-computed child
plans during normal traversal. Final content allocations feed the same existing
solver/measurement path; there is no alternate solver or temporary native instance.
An active-path source guard rejects cycles before recursive region growth. Parent
teardown releases descendants; keyed removal drops only the removed subtree and
restoration creates its fresh records. Ordinary components remain opaque.

The public nested failure failed first: a later inner Flex's invalid grow value
allowed an earlier outer probe to run. It now fails before that evaluation and
recovers with the latest120px allocation. Successful changes use exactly one
allocation pass per outer/inner region, solve only changed numeric inputs and
retain records. Nested keyed reorder preserves component stamps/records and
moved targets; removing/restoring one child releases/recreates only that subtree.
Direct and nested wrapped Text tests prove final-width geometry and the changed
paragraph hit height without another mounted allocation pass. Cyclic known Flex
input stops after one direct child traversal and releases native handles/nodes.

Source and built Studio nested controls pass independent-root pixels, expected
failure before earlier evaluation, explicit100px recovery/right-edge hit and
actual root cleanup0/0/0/0. Both bundle225public core inputs, built provenance only
from private built output. Packed228installed-input strict Bundler/NodeNext and
structural lifecycle pass. Final types/lint and source/built/editor exact export
parity pass. Focused review found no material issue in hierarchical slot identity,
active-path cycle handling, final dimensions, plan claim or descendant cleanup.
Matching59181-byte artifact unchanged. Fresh focused experimental119passed/
1normal-onlyskip; normal57passed/63experimental skips. Logs `/tmp/pibbl-slice45-*`. Node26.9.0/pnpm11.21.0deps/Chromium;
no Node24/full trust claim. This is the known built-in Flex chain entered through
Absolute, not general root discovery, all layout families, a native topology
transaction or atomic HTML/focus adoption. Seven release gates remain open.

Hands-on: source `http://127.0.0.1:5192/#/testing/layout-preflight`, built5193.
Use nested layout, Fail later sibling (or sizing), Recover, then click the red
box's right edge. Host controls and the independent green root survive failure.

### Slice 46 — direct and opaque-boundary Flex entry preparation

A Flex without an inherited prepared plan now settles its own allocation and calls
the same known-descendant preparation before visiting children. Absolute-prepared
regions retain their existing claim path and do not prepare twice. Direct Flex
roots and Flex returned by ordinary components therefore use the same settled
nested plans, mounted regions and root-native instance. Ordinary functions still
execute once after receiving their final allocation; no universal root walk or
new public API is introduced.

Two focused public cases failed first: a direct entry and one returned by an
ordinary boundary both let the earlier probe run on a later nested failure. They
now stop before that child evaluation, explicitly recover with latest geometry,
allocate once per region, solve only the changed numeric region and retain records.
The ordinary boundary runs once per frame with the unchanged220px root allocation.
The existing Studio lab's Use direct root control reproduces that boundary; source
and built cases pass expected failure, independent-root pixels,100px recovery,
right-edge hit and actual cleanup0/0/0/0, with225public core inputs each.

Fresh focused experimental121passed/1normal-onlyskip; normal57passed/65experimental
skips. Types/lint and source/built/editor public export parity pass. Packed228-input
strict Bundler/NodeNext and structural lifecycle pass. Matching59181-byte native
artifact is unchanged. Logs `/tmp/pibbl-slice46-*`. Node26.9.0/pnpm11.21.0deps/
Chromium; no Node24/full trust claim. Pure layout-description wrappers, other layout
families, native topology transactions, minimal graph visits and matching atomic
HTML/focus publication remain later work; all seven gates stay open.

Hands-on source `http://127.0.0.1:5192/#/testing/layout-preflight`, built5193:
Use direct root, Fail later sibling or sizing, Recover, then the red right edge.
The independent green Canvas and host controls remain usable.

### Slice 47 — pure layout-description preparation

Known Flex roots returned by defineLayoutComponent now prepare before opaque child
traversal. Logical wrapper type/key/occurrence owns the slot; the described root
uses its distinct receiver. Descriptions run once per transaction. Placed clones
carry the prepared slot into actual rendering. A changed returned-root key replaces
region ownership; stale teardown cannot release the replacement. Ordinary
components remain opaque.

Public failure-ordering test first failed with three earlier evaluations instead
of two. A separate returned-root-key test exposed one live arena instead of two;
both now pass. Fresh experimental123passed/1normal-onlyskip, normal57passed/
67experimental skips; types/lint/export parity pass. Source and built Studio
`--described` probes pass failure isolation, independent green Canvas,100px recovery,
right-edge targeting and teardown0/0/0/0 with225public core inputs. Packed228-input
Bundler/NodeNext and structural lifecycle checks pass. Matching59181-byte native
artifact is unchanged. Focused read-only review found no material findings. Logs
`/tmp/pibbl-slice47-*`; Node26.9.0/pnpm11.21.0deps/Chromium, no Node24/full trust claim.

### Slice 48 — finite HTML projection preparation

All pending HtmlBox projections now settle numeric geometry before retiring hosts,
mutating DOM or invoking mount/update callbacks: CSS matrices, logical/CSS border
corners and extents, visibility and visible clip-local inverse transforms. A public
Absolute-allocated1e300px border with finite1e20scale reproduced the gap: unchanged
production did not throw. The fixed generation fails before the earlier updater,
cleans affected HTML, and explicitly recovers. Existing singular/hidden behavior
and failure cleanup remain; no Canvas rollback or complete matching publication
claim. Fixed-corner validation avoids temporary corner arrays.

Focused HTML geometry/ownership/focus23tests pass; types and targeted lint pass.
Source/built Studio `--html` each pass with225public inputs, no unexpected errors:
no earlier update, one abort, empty failed overlay, healthy independent Canvas,
recovered native button activation and pagehide cleanup. Packed228installed-input
Bundler/NodeNext and structural lifecycle pass; matching59181-byte kernel unchanged.
Focused read-only review found no material findings. Logs `/tmp/pibbl-slice48-*`.
Node26.9.0/pnpm11.21.0deps/Chromium; no Node24/full trust claim.

### Slice 49 — known Layer-to-Flex preparation and adoption

Known Layer boundaries prepare direct Flex roots using their settled allocation
and the same root transaction. No child OffscreenCanvas/instance is created by
preflight. Cloned descriptors preserve authored offsets and receiver identity;
child rendering claims the prepared plan/region. Clean Layer cache hits retain
mounted ownership without opaque child re-evaluation. Removal/restoration and
actual disposal release exact ownership, including one shared native instance.

Public RED showed earlier evaluations2instead of1 on later Layer factor failure.
Focused review caught consumed left/top in the first clone handoff; a positioned
pixel/hit RED reproduced it, and the corrected handoff preserves both coordinates.
Read-only follow-up confirmed the finding resolved. The expanded public test proves
cache reuse, one native instance/two regions, factor failure isolation, recovery,
offset pixels/hits, removal/restoration and zero resource ownership after disposal.

Fresh experimental136passed/1normal-onlyskip across five layout/HTML files;
normal57passed/68experimental skips. Types/targeted lint pass. Source/built Studio
`--layer` pass earlier failure isolation,100px recovery, retained blue Layer pixels
and target, independent root updates, teardown0/0/0/0;225public inputs each. Packed
228installed-input Bundler/NodeNext/lifecycle pass. Kernel59181bytes unchanged.
Logs `/tmp/pibbl-slice49-*`; Node26.9.0/pnpm11.21.0deps/Chromium, no Node24/full trust.

### Slice 50 — Grid-entry known Flex preparation

Grid reuses its existing explicit track/cell placement pass. The existing
all-placement-before-traversal callback prepares known Flex cell roots from the
exact clone/receiver/content allocation, then carries the prepared slot into normal
rendering. No additional Grid solve, native Grid region or topology handoff.
Outer earlier boundaries are not discovered; current Grid semantics stay intact.

Public RED showed an earlier opaque cell evaluating twice instead of once before
the later Flex factor failure. Recovery uses changed110px fractional tracks,
matching red/blue pixels and blue cell targets, and releases nodes/arenas/instance.
Experimental96tests pass across layout-WASM/Grid/structural Card; normal27pass/
69experimental skips. Types/lint pass. Source/built Studio `--grid` pass failure
isolation,100px recovery, both cell pixels/targets and cleanup0/0/0/0 with225public
inputs each. Packed228installed-input Bundler/NodeNext/lifecycle pass. Kernel59181
bytes unchanged. Logs `/tmp/pibbl-slice50-*`; Node26.9.0/pnpm11.21.0deps/Chromium,
no Node24/full trust claim. All seven gates remain open.

### Slice 51 — Flow-entry known Flex preparation

Flow finishes its existing measurement/sequential/wrap placement pass, then prepares
direct known Flex roots before opaque child traversal. Grid/Flow share one internal
placed-clone handoff with no added per-item wrapper allocation, extra placement
pass, native Flow solver or cache. The settled clone's source, receiver and content
allocation carry the same prepared Flex region into normal rendering.

Public RED showed an earlier opaque child evaluating twice instead of once before
a later factor failure. Recovery verifies the transparent10px gap, blue pixels,
matching target and zero nodes/arenas/native-instance ownership after disposal.
Focused experimental119tests pass across layout-WASM/Grid/Flow/structural Card;
normal49pass/70experimental skips. Types/lint pass. Source/built Studio `--flow`
each pass failure isolation, recovery pixels, red/blue targeting and cleanup0/0/0/0
with225public inputs. Kernel59181bytes unchanged. Logs `/tmp/pibbl-slice51-*`;
Node26.9.0/pnpm11.21.0deps/Chromium, no Node24/full trust claim.

### Slice 52 — native explicit Grid track resolution

Mounted experimental Grid resolves finite numeric/percentage/fraction tracks through
its own generational arena in the same root-owned WASM instance. Columns/rows cache
exact parsed values, bounds and gaps independently. No experimental runtime JS
fallback; ordinary builds and pure helpers retain JS. Grid child placement remains
JS. ABI validation now requires the Grid exports, and stale ABI candidates reject
before module publication. Native storage is isolated from Flex/peer Grid records.

Public RED passed mixed geometry/hit setup but reported zero native resolutions
instead of two. Green proves200px→260px tracks20/50/110→20/65/155, moved blue target,
two initial axes/one resized axis/zero paint-only resolutions and exact teardown.
Pinned compiler build passes6native tests, including sub-unit fractions, overflow,
invalid numeric records, peer/Flex isolation and stale handles; binary60781bytes.
Focused experimental89tests pass; normal23pass/66experimental skips. Types/lint
clean. Focused read-only review found no material findings. Source/built Studio
`--native-grid` each passes the same public proof and cleanup0/0/0/0 with225inputs.
Packed228installed-input Bundler/NodeNext/lifecycle pass. Logs `/tmp/pibbl-slice52-*`;
Node26.9.0/pnpm11.21.0deps/Chromium; no Node24/trust/parity/performance claim.

### Slice 53 — native explicit Grid cell-area placement

Both axes persist independently in the same root-owned arena. Validated explicit
start/span records resolve in one native batch to local cell boxes, while JS keeps
parsing/validation, measurement, used sizes and alignment. Native prefix offsets
preserve source-order sums; each span sums its own tracks rather than subtracting
large prefixes. Exact numeric-only cache snapshots release transaction descriptors
and avoid native placement on paint-only updates. Unresolved axes, invalid records
and stale handles reject without publication.

Public RED reported zero native placements instead of one. Green proves170×45→
230×45 spans, moved targets, one batch per geometry change/zero paint-only work,
and a1px span after a1e20px track. Review caught a native prefix allocation growing
WASM memory: forced-growth RED returned undefined track results; refreshing the
view after the native call passes. No allocating native call retains a stale view.

Pinned compiler/native gate passes7tests; binary62961bytes. Focused experimental92
pass; normal24pass/68experimental skips; types/lint clean. Source/built Studio
`--native-spans` each passes spanning pixels/hits, cache counters and cleanup0/0/0/0
with225public inputs. Packed228installed-input Bundler/NodeNext/lifecycle pass.
Logs `/tmp/pibbl-slice53-*`; Node26.9.0/pnpm11.21.0deps/Chromium, no Node24/trust/
parity/performance claim. Remaining JS child alignment and all-family topology are
not hidden by this native-area milestone.

### Slice 54 — native Flow sequential and wrap placement

JS keeps style validation/measurement and used-size child cloning. The shared native
arena now performs source-order lines/cursors, wrap, gaps/line gaps, and start/
center/end/stretch cross alignment. Horizontal/vertical mappings preserve current
semantics. Numeric-only caches include resolved sizes/alignment/options; no source
descriptor retention or experimental JS fallback. No extra intermediate box array
is created for ordinary zero-origin runtime placement.

Public RED reported zero native placements instead of one. Green proves short-item
centering, exact second-line gap, wrap→one-row moved targets in both directions,
paint-only reuse and exact teardown. Measured Text growth separately moves the
following target and invalidates native placement; fill-only changes do not.
Native8tests pass, including Flow/Grid/Flex storage isolation and stale handles;
binary65282bytes. Focused101checks passed before the final extra ABI rejection case;
final combined198pass/1normal-onlyskip across ten files includes that case. Normal
31pass/71experimental skips; types/lint clean. Read-only review no material findings.
Source/built Studio `--native-flow` each passes centered/wrapped geometry, widening,
moved hits, paint reuse, cleanup0/0/0/0 with225public inputs. Packed228installed-input
Bundler/NodeNext/lifecycle pass. Logs `/tmp/pibbl-slice54-*` and
`/tmp/pibbl-consolidation18-focused.txt`; Node26.9.0/pnpm11.21.0deps/Chromium,
no Node24/trust/parity/performance claim.

### Slice 55 — prepared Grid-root planning and adoption

Known Grid roots now resolve their native track/cell plan and settled descriptors
under their own receiver during outer preparation. Known placed descendants share
the parent slot hierarchy. Actual Grid rendering claims the same region/plan once
and skips duplicate child preparation. Common plan geometry is separate from
Flex-only cache/revision metadata; no dummy cache values for Grid. Layer retains
its existing direct-Flex discovery boundary as the known registry grows.

Public RED showed earlier opaque evaluations3instead of2 before a later Grid's
nested Flex failure. Green proves failure stops earlier evaluation and clears all
arenas/nodes; recovery paints/targets the new cell. A successful resize uses one
changed-axis resolution, one cell batch and one Flex solve with no node/region
creation. Focused151pass/1normal-onlyskip; normal63pass/77experimental skips.
Types/lint pass, focused read-only review no material findings. Source/built Studio
`--grid-root` each passes failure isolation, recovery pixels/red+blue targets,
exact2axes/1cell-batch/3arenas on recovery, cleanup0/0/0/0 with225public inputs.
Packed228installed-input Bundler/NodeNext/lifecycle pass. Kernel65282bytes unchanged.
Logs `/tmp/pibbl-slice55-*`; Node26.9.0/pnpm11.21.0deps/Chromium, no Node24/full trust.

### Slice 56 — prepared Flow-root planning and adoption

Known Flow roots prepare existing measurement/native placement under their receiver,
then recursively prepare known settled descendants before outer opaque traversal.
Rendering adopts that region/plan and skips duplicate placement/child preparation.
Grid/Flow share the known-descendant handoff; Flow allocation shares one measuring
path. Settled placements carry explicit used content dimensions.

Public RED showed earlier opaque evaluations3instead of2 on later nested Flex
failure. Green proves failure clears arenas, successful resizing uses one native
Flow placement/one Flex solve without node/region creation, and recovery paints/
targets the new width. A definite-root public custom leaf separately measures once
per transaction, using the required explicit auto-style resolver. Vertical wrap
and measured Text invalidation remain green. Focused127checks plus the leaf-count
proof pass; normal49pass/79experimental skips. Types/lint clean. Root focused
inspection found no material issue. Source/built Studio `--flow-root` each passes
failure isolation, recovery pixels/red+blue targets, one Flow placement/3arenas on
recovery, cleanup0/0/0/0 with225public inputs. Packed228installed-input Bundler/
NodeNext/lifecycle pass. Kernel65282bytes unchanged. Logs `/tmp/pibbl-slice56-*`;
Node26.9.0/pnpm11.21.0deps/Chromium, no Node24/full trust claim.

### Slice 57 — prepared Overlay-root planning and adoption

Overlay stages settled placements and recursively prepares known descendants before
outer opaque siblings. Rendering claims that structural plan without allocating a
native arena. Flex retains its stronger region/cache contract. Boundary teardown
checks the exact owner so stale cleanup cannot dispose a replacement slot.

Public RED reproduced earlier evaluations3instead of2. Green covers centered/end
alignment, nested Grid/Flex failure, resizing, pixels/hit recovery and exact cleanup;
Overlay adds no arena. Focused124tests across four files pass. Types/lint clean.
Read-only review found no material issue. Source/built Studio `--overlay-root`
passes failure isolation, aligned blue target, recovery2Gridaxes/1cellbatch/3arenas
(including earlier Flex), cleanup0/0/0/0 and225public inputs. Kernel65282bytes
unchanged. Logs `/tmp/pibbl-slice57-*`; Node26.9.0/pnpm11.21.0deps/Chromium.
No Node24/full trust or general transactional publication claim.

### Slice 58 — prepared Absolute-root planning and adoption

Known Absolute roots stage existing placements, recursively prepare known children,
and claim the exact plan during traversal. Child placement itself is now pure with
respect to known-layout preparation, avoiding unparented duplicate slots. The
ordinary experimental entry prepares each settled child before traversal; normal
builds retain their immediate placement path. Absolute adds no numeric arena.

Public RED reproduced earlier evaluations3instead of2 for later Overlay→Absolute→
Grid→Flex failure. Green covers one native child pass on resize, aligned geometry,
failure cleanup and recovered pixel/hit. Focused147tests across six files pass;
normal17tests pass. Types/lint clean. Root inspection found no material issue.
Source/built Studio `--absolute-root` proves failure isolation, recovery2Gridaxes/
1cellbatch/3arenas, red/blue targets and cleanup0/0/0/0 with225public inputs.
Packed228installed-input Bundler/NodeNext/lifecycle pass. Kernel65282bytes unchanged.
Logs `/tmp/pibbl-slice58-*`; Node26.9.0/pnpm11.21.0deps/Chromium, no Node24/full trust.
This is bounded known-root preparation, not arbitrary component pre-execution or
matching root-wide Canvas/hit/focus/HTML transactional publication.

### Slice 59 — known-family Layer child preparation

Layer's existing bridge admits direct registered Grid/Flow/Overlay/Absolute roots
alongside Flex, with per-type unkeyed identity. The original normalized descriptor
and receiver snapshot cross the private fragment; authored offsets are applied only
by normal rendering. Preparation still creates no child surface/instance and Layer
adds no numeric arena. Ordinary functions and unproven wrapper entries stay opaque.

Public RED reproduced earlier evaluations3instead of2 for Layer→Grid→Flex failure.
Green matrix covers all four added families, positioned pixels/hits, clean bitmap
reuse, removal/restoration and exact ownership. Focused141tests across three files
pass; normal57tests pass. Types/lint clean; root inspection found no material issue.
Source/built Studio `--layer-grid` each passes earlier-sibling failure isolation,
recovery2Gridaxes/1cellbatch/3arenas, positioned blue hit and cleanup0/0/0/0 with
225public inputs. Packed228installed-input Bundler/NodeNext/lifecycle pass.
Kernel65282bytes unchanged. Logs `/tmp/pibbl-slice59-*`; Node26.9.0/pnpm11.21.0deps/
Chromium, no Node24/full trust or atomic publication claim.

Slice59 review follow-up: direct registered Layer children exposed two defects.
Public RED showed a clean outer Layer releasing its inner boundary's prepared
subtree, and width100/maxWidth50/padding2 preparing a different allocation from
Layer's actual renderer. Retention now claims both numeric and boundary entries
recursively; nested Layer preparation uses `resolveLayerStyle` dimensions. The
six-case matrix (Grid/Flow/Overlay/Absolute and unconstrained/constrained nested
Layer) passes, types/lint clean. Logs `/tmp/pibbl-slice59-nested-*`. This is a
correctness follow-up to59, not a new capability or closed gate.

### Slice 60 — direct-entry Layer child preparation

Direct and opaque-entry Layers now prepare known children through their existing
boundary protocol before allocating/updating the child raster surface. A private
clone carries transaction metadata; application-owned reusable descriptors stay
untouched. Managed Layer invalidation routes through its owning parent in the
experimental lane, including direct entries, so child signal work cannot bypass
the prepared allocation boundary. Clean bitmap retention remains intact.

Public RED showed earlier evaluations3instead of2. The first implementation also
exposed allocation mismatch when child updates bypassed the owner; the scheduling
edge fixes that observable gap. Both direct and opaque-entry public cases pass
resize/native single-pass, failure isolation, pixel/hit recovery and exact cleanup.
Focused145tests across three files pass, including corrected59 nested sizing and
retention; normal57tests pass. Types/lint clean. Source/built `--direct-layer` and
rebuilt `--layer-grid` pass225public-input recovery/targets/cleanup. Packed228input
Bundler/NodeNext/lifecycle pass. Rebuilt artifact includes `ab2adb72`; kernel65282
bytes unchanged. Logs `/tmp/pibbl-slice60-*`; Node26.9.0/pnpm11.21.0deps/Chromium.
No Node24/full trust or general atomic publication claim.

### Slice 61 — pure described Layer children

Layer admits pure descriptions, resolves their cached primitive root and uses that
root's sizing policy/diagnostics. Original wrapper identity and receiver own the
prepared slot; the root receiver claims it during rendering. A description that
returns Layer uses actual Layer defaults/constraints rather than ordinary box
sizing. Unknown returned primitives remain outside known-layout preparation;
ordinary functions remain opaque. No new public API or ABI.

Public RED showed earlier evaluations3instead of2 for described Grid/Flow/Layer
nested failure. Green matrix covers actual nested Layer defaults and constraints,
one description per transaction, clean bitmap reuse, positioned pixels/hits,
removal/restoration and exact ownership. Focused162tests across four files pass;
types/lint clean. Root inspection found no material issue. Source/built Studio
`--described-layer` each passes225public-input failure/recovery/targets/cleanup;
packed228installed-input Bundler/NodeNext/lifecycle pass. Kernel65282bytes unchanged.
Logs `/tmp/pibbl-slice61-*`; Node26.9.0/pnpm11.21.0deps/Chromium. No Node24/full trust
or general atomic-publication claim.

### Slice 62 — settled-width intrinsic Flow in Flex columns

Known Flow roots now contribute automatic height to finite-width nowrap Flex
columns using Flow's existing pure wrap measurement. The same bounded eligibility
is used for recursive intrinsic measurement, deferring stretch width and measuring
at final clamped width. Explicit minimum, no intrinsic growth, percentage/bounds,
cycle detection and opaque-component rules remain unchanged. Pure measurement is
host work; mounted Flow still performs native numeric placement.

Public RED returned unsupported instead of100×40 for a three-item wrapping Flow.
Green public measurement/render proof moves footer40→25 as width100→160, checks
old/new pixels/targets and stable nodes/arenas. A maxWidth100 bound holds footer40
even when parent widens, then lifting it moves footer25. Focused163pass/1normal-only
skip across four files plus final clamped proof pass; normal58tests pass. Types/
lint clean. Source/built Studio `--intrinsic-flow` each proves footer40→25, moved
targets, one native Flow batch per resize, cleanup0/0/0/0 and225public inputs.
Packed228installed-input Bundler/NodeNext/lifecycle pass. Kernel65282bytes unchanged.
Logs `/tmp/pibbl-slice62-*`; Node26.9.0/pnpm11.21.0deps/Chromium. No broad intrinsic,
new automatic-minimum policy, Node24/full trust or Yoga parity claim.

### Slice 63 — fixed-row intrinsic Grid in Flex columns

Known Grid roots contribute automatic height through the same settled-width
nowrap column measurement seam. Grid's existing pure fixed-row sum/gap contract
is reused; mounted explicit tracks/cells retain their native kernel. Fraction rows
without definite height remain unsupported. No new track vocabulary/minimum policy.

Public RED returned unsupported instead of100×55. Green public measure/render
proof includes gap sums, live rows20/30→40/30 moving footer55→75, old/new pixels/
targets, stable nodes/arenas, one changed native track axis and one cell batch.
Indefinite fraction rows retain unsupported results. Focused158pass/1normal-only
skip across four files; normal52tests pass. Types/lint clean. Source/built Studio
`--intrinsic-grid` each proves footer30→45, moved targets, one native cell batch per
row change, cleanup0/0/0/0 and225public inputs. Packed228installed-input Bundler/
NodeNext/lifecycle pass. Kernel65282bytes unchanged. Logs `/tmp/pibbl-slice63-*`;
Node26.9.0/pnpm11.21.0deps/Chromium, no Node24/full trust or broad Grid parity.

### Slice 64 — pinned Yoga column conformance

Native Yoga3.2.1 at042f5013152eb81c1552dec945b88f7b95ca350f now generates eight
exact cases: previous five rows plus column grow/cap/shrink. Explicit100×100 parent,
80px cross width, gap12 and main minima yield heights44/44,30/58,60/28 with recorded
positions. Receipt output prints full width×height@x,y, avoiding width-only column
claims. Probe hash and embedded public reference are regenerated from native code.
Classification is exact finite explicit inputs, plus the pre-existing content-box
row conversion; there is no broad default, intrinsic, reverse/RTL or parity claim.

Public RED required missing column records. The public example then compares all
positions/dimensions, both targets, untargeted column gaps and paint-only reuse.
Focused2tests pass. Native generation and independent no-write reproduction agree;
record-only provenance/embedded check passes. Types/lint clean. Source/built Studio
replay all eight cases with zero errors and exact cleanup; built467private inputs.
Packed228installed-input Bundler/NodeNext/lifecycle pass. Runtime/kernel unchanged.
Logs `/tmp/pibbl-slice64-*`; Node26.9.0/pnpm11.21.0deps/Chromium/Apple C++20 compiler.
No Node24/full trust, performance or general Yoga parity result.

### Slice 65 — pinned Yoga reverse-axis conformance

Ten native-generated cases now include row-reverse-cap and column-reverse-cap.
Their unequal capped dimensions match the forward cap cases while main-axis
positions reverse: row A220,0/B0,0; column A0,70/B0,0. Full boxes and explicit
configuration remain bound to the pinned Yoga commit/probe hash. Source order,
A/B identity, dimensions/positions and untargeted gaps are compared publicly.
Classification is finite LTR main-axis reversal only, not RTL/wrap-reverse.

Public RED required missing reverse records. Focused3tests pass across all ten
reference cases, including public Canvas label geometry, pure numeric geometry,
A/B clicks and gap misses. Native generation plus independent no-write reproduction
and recorded/embedded provenance checks pass; types/lint clean. Source/built Studio
replay ten cases, zero errors, exact cleanup; built467inputs. Runtime/kernel and
package contents unchanged; last packed228receipt remains64, not a new65run.
Logs `/tmp/pibbl-slice65-*`; Node26.9.0/pnpm11.21.0deps/Chromium/Apple C++20.
No Node24/full trust, performance or broad Yoga parity claim.

### Slice 66 — pinned Yoga wrap/cross-reversal conformance

Twelve native-generated cases now include finite three-item row wrap and
wrap-reverse. Explicit150×100 parent, basis60/grow0/shrink1/minWidth0, height20,
gap12 and start line alignment form A/B then C. Normal y0/32 becomes reversed
cross y80/48. Receipts bind axes, wrap and line alignment to native source/hash;
classification is finite source-formed lines/cross reversal, not general wrapping,
RTL, intrinsic percentages or combined main/cross reversal.

Public RED required missing wrap records. Focused4tests compare all twelve cases,
including full numeric geometry, compact labels, A/B/C target identities, gap
misses and paint-only reuse. Native generation and independent no-write reproduction
plus recorded/embedded checks pass; types/lint clean. Source/built Studio replay
all twelve with zero errors and exact cleanup; built467inputs. Actual comparison
was visually inspected at `/tmp/pibbl-yoga-comparison.png`; labels fit, both sides
match and no baseline changed. Runtime/kernel/package unchanged; last packed228
receipt remains64. Logs `/tmp/pibbl-slice66-*`; Node26.9.0/pnpm11.21.0deps/Chromium/
Apple C++20. No Node24/full trust, performance or broad Yoga parity claim.

### Slice 67 — coherent content-box/border-box sizing

`BoxStyle.boxSizing` preserves content-box by default and adds explicit border-box
for dimensions, min/max and Flex basis together. Percentages resolve before
padding subtraction. Content and padding-floor metadata are carried once through
prepared/cached placements and measurement. Both JS and WASM allocators keep
content-valued records; ABI/kernel unchanged. Border-box width8/max8 with padding10
floors at outer20/content0, including parent overflow. Independent pinned Yoga3.2.1
probe confirmed that policy before implementation; rejection was not selected.
Default content-box constraints and painted-stroke semantics are unchanged.

Public type RED rejected the missing field; runtime RED showed old content sizing.
Green row/column proofs cover basis80/min100/max110/padding10, content80×10,
basis105→content85, content-box switch→105×30, moved target100→105→125, stable
identity and paint-only reuse. Padding-floor public overflow and percentage/outer
bound checks pass. Review reproduced a Grid stretch double subtraction; an analogous
Flow measurement test also failed. Both now canonicalize before assigning used
content dimensions; focused review verified the correction, no other material issue.

Focused200pass/1normal-onlyskip across six files; normal98pass/91experimental skips.
Types/changed-code lint clean. Source/built Studio `--box-sizing` passes226public
inputs, moved target/content sizes, paint reuse and cleanup0/0/0/0. Packed229input
Bundler/NodeNext explicitly authors boxSizing and rejects an invalid literal; Node
consumer checks public resolveBox geometry. Editor declaration bundle includes the
field and its consumer compiles a literal use, alongside export/runtime parity.
Public JSDoc and Studio docs metadata/coverage/rendering checks pass. Kernel65282
bytes unchanged. Logs `/tmp/pibbl-slice67-*`; Node26.9.0/pnpm11.21.0deps/Chromium.
This is a runnable first box-sizing slice, not full intrinsic/aspect/layout-border
conformance, Node24 trust or general Yoga parity. All seven release gates remain open.

### Slice 68 — pinned border-box bounds and percentage conformance

The independently reproduced Yoga3.2.1 corpus now contains14 cases. New explicit
border-box fixtures cover the padding floor against undersized basis/max bounds
(A20×60, B100×60) and percentage basis/cross size with opposing item constraints
(A110×60, B90×60). Per-case gap is recorded. Public normal/WASM evidence also
checks content90×40/70×40 and separate click targets, preserving defaults.

Missing-fixture RED preceded additions. Focused experimental6pass/99skip and
normal6pass/99skip; typecheck/lint pass. Native reproduction and provenance checks
pass. Source5192 and fresh built5194 replay all14 with errors[] and exact zero
node/arena/measurement cleanup; built468 core inputs all from the private built
package. Existing5193 failed with old content-box geometry28×80/120×80 despite
current scenario inputs; fresh server success isolates cached virtual runtime.
Failure retained `/tmp/pibbl-slice68-built.txt`; fresh success
`/tmp/pibbl-slice68-fresh-built.txt`. Other receipts `/tmp/pibbl-slice68-*`.
Node26.9.0/pnpm11.21.0deps/Chromium. No parity, full trust or performance claim;
all seven gates remain open. Kernel unchanged65282bytes. No baseline rewritten.

### Slice 69 — Studio runtime dependency invalidation

The Studio runtime's opaque esbuild bundle now records repository input paths,
registers them with the dev watcher, and explicitly invalidates its virtual module
on matching edits. Unrelated file edits do not invalidate it. Runtime package
resolution and built provenance remain unchanged; no source fallback was added.

Focused RED found the missing watcher hook; source/built synthetic checks pass.
`node tooling/test-studio-runtime-invalidation.mjs --live` additionally starts an
ephemeral real Vite server, reversibly edits a private built input, proves the
served virtual string changes without restart, and restores the input in finally.
Typecheck and focused lint pass. Canonical built5193 was restarted for the plugin
change and replays all14 cases,468private core inputs, errors[] and cleanup0/0/0.
Diagnostic5194 retired. Logs `/tmp/pibbl-slice69-*`; Node26.9.0/Chromium.

### Slice 70 — explicit layout border widths

Public `BoxStyle.borderWidth?: EdgeValues` reserves finite nonnegative physical
numeric insets, default zero, independently from painted stroke. One internal
combined-inset helper preserves the existing padding-only path and feeds box
conversion/allocation, Flex main/cross and intrinsic records, Grid stretch and
Flow measurement. No native ABI change. Layer raster sizing stays separate.
Public asymmetric row/column RED preceded production; both sizing modes preserve
content40×30, origin5,13, outer54×62 and following target. Border signals update
allocation; paint-only changes retain solver reuse. Opposing finite arithmetic
and edge validation remain explicit. Existing numeric Flex margin docs corrected.

Focused experimental203pass/1normal-onlyskip in6files, normal3pass/117skip in2,
plus Layer raster exception1pass in each lane. Source/built Studio preflight
`--box-sizing` proves content80→85→79→105 and target100→105→131 with zero errors
and exact cleanup;227public core inputs. Packed230installed-dist inputs passes
Bundler/NodeNext literal border declarations, Node combined-inset geometry and
browser lifecycle. Editor declaration authoring, typecheck, lint, linked JSDoc
and Studio docs metadata/render/coverage pass. Scoped reused review: no material
findings; no duplicate review. Logs `/tmp/pibbl-slice70-*`.
Node26.9.0/pnpm11.21.0deps/Chromium. Kernel65282bytes unchanged. No parity, speed
or Node24 full-trust claim; all seven gates remain open.

### Slice 71 — pinned asymmetric layout-border conformance

The independent Yoga3.2.1 corpus now has16 cases. New row/column fixtures use
border-box sizing, padding left3/right5/top7/bottom11 and borders2/4/6/8. Both
outer54×62; B is atx66 in row and y74 in column. Native generation, independent
no-write reproduction, compiler/probe provenance and embedded public record agree.
Missing-record RED preceded additions. Public semantic loop checks all positions,
sizes, target identities and gap misses. Focused7pass/102skip, types/lint pass.
Source5192 and built5193 replay16cases with zero errors and cleanup0/0/0;469private
built core inputs. Visual inspection found the tall column caption overlap;
caption now sits below the boxes and final source/built replay passes again.
No baseline rewritten. Runtime/kernel unchanged from70; packed230 receipt remains70.
Logs `/tmp/pibbl-slice71-*`; Node26.9.0/Chromium/Apple C++20. This bounded corpus
does not establish broad border/intrinsic or CSS/Yoga parity. All seven gates open.

### Slice 72 — finite Flex outer-box aspect ratios

`LayoutItemStyle.aspectRatio?: number`, included in `FlexItemStyle`, is a positive
finite outer width/height ratio for finite nowrap Flex items. Final main allocation
(including shrink/grow/bounds) derives preferred cross size, overriding explicit
cross size and default stretch; combined insets floor content, then cross bounds
clamp independently and may break the ratio without recomputing main. Definite
main dimension/basis required. Intrinsic, wrapped, other-parent and root ratio
sizing remain deferred; pure intrinsic Flex measurement reports unsupported.
The no-ratio path skips the additional derivation traversal. No native ABI change.

Public row/column RED preceded runtime changes. Shrink/signal/hit/identity,
explicit cross, numeric basis, combined insets and cross bounds pass. Focused
experimental208pass/1normal-onlyskip in6files; normal3pass/109skip. Source/built
Studio `--aspect-ratio`: outer main100→105→131, ratio3 cross and inset signals,
moved targets,227public core inputs, exact cleanup and errors[]. Native probe
source is preserved with `--source /path/to/yoga --aspect-probe`, commit and hash;
outer semantics and surprising explicit-cross override were established before
production. It is independent discovery evidence, not an expansion of16cases.

Fresh full packed command passes230installed-dist inputs, explicit aspect
Bundler/NodeNext declarations, actual installed90×30 pixels and lifecycle cleanup.
The temporary Canvas probe initially failed because it was detached; final
fixture connects/sizes its host, waits the scheduled render and removes/disposes
it before the existing main scenario. Failure logs retained. Editor authoring,
types/lint, linked JSDoc and Studio metadata/render/search/coverage pass. Scoped
reused review: no material findings. Logs `/tmp/pibbl-slice72-*`.
Node26.9.0/pnpm11.21.0deps/Chromium/Apple C++20. Kernel65282bytes unchanged.
All seven release gates remain open; aspect remains experimental.

### Slice 73 — finite numeric-gap capability evidence complete

The fixed `flex.numeric-gap` preserve entry now has complete capability-level
positive, negative, interaction and provenance evidence. Existing runtime needed
no production correction. Empty/single/two-item count-minus-one main gaps, grow
45/45 at0/55, wrapped physical override axes and no trailing cross-line gap are
locked. Every gap/rowGap/columnGap rejects negative/nonfinite/percentage values,
even for empty input. Mounted one-empty-one owns1→0→1 numeric nodes; a numeric
gap signal moves target geometry without remount. All four physical main/cross
gap regions miss in the public row/column collection scenario.

Focused native-backed11pass/143skip in2files, normal8pass/32skip plus public
normal signal1pass/113skip. Nine native tests pass under pinned Rust1.99.0 build;
recompiled65282byte kernel hash unchanged (only source fingerprint regenerated).
Source5192/built5193 wrapped collections pass ownership6→4→6→0, stable keyed
identity/reorder, four explicit gap misses, correct targets, paint reuse and exact
cleanup;469private built inputs. Fresh packed command230installed inputs,
Bundler/NodeNext, installed geometry and lifecycle pass. Types/lint and native
integrity pass. Existing16-case pinned Yoga corpus supplies numeric gap records;
no new corpus or UI controls were needed. Logs `/tmp/pibbl-slice73-*`.
Node26.9.0/pnpm11.21.0deps/Chromium/Rust1.99.0. No Node24 full trust or speed claim.
No unchanged-runtime review repeated. Numeric gaps are complete for the finite
numeric contract; percentage gaps are a separate missing capability. The engine
remains opt-in and all seven group release gates remain open.

### Slice 74 — finite allocation evidence complete and initial-freeze correction

Closed the fixed finite `flex.grow-shrink-basis` numerical evidence exits:
fractional factors, zero bases, finite1e30/2e30 and grow/shrink freeze/release.
The independently reproduced25-case Yoga3.2.1 corpus has22geometry matches and3
explicit CSS partial-factor differences. Native `boxes` and expected `pibblBoxes`
remain separate; `comparisonLabel` visibly names each difference. Shared explicit
itemStyles drive the new public records. Unequal1e308/1 is separately tested as a
Pibbl f64 robustness extension, never passed to Yoga's float input API.

The matrix exposed an actual ordering bug: initial free space was measured before
initial freezing. Focused RED got B35 instead of37.5. Primary CSS9.7steps3–5 and
independent real Chromium confirm grow10/37.5 and shrink90/62.5. Both JS and Rust
now accumulate initially frozen target sizes before partial-factor free space;
no extra host traversal is added. Existing unconstrained partial-shrink65/65 is
preserved despite Yoga50/50. Pinned initially-frozen native outcomes are also
classified (Yoga B43.3333/B10 versus CSS/Pibbl37.5/62.5). Durable migration note and
`tooling/test-css-partial-flex.mjs` retain inputs, primary link and independent proof.
Scoped reused review of only this JS/Rust correction: no material findings.

Fresh native10pass; kernel65364bytes with new hash. Experimental218pass/1normal-
onlyskip in6files; normal41pass/117skip in2files. Source5192/built5193 replay25
with22matches/3explicit labels, correct targets/gap misses, errors[] and cleanup0;
469private built inputs. Visual inspection confirms readable differences/caption.
Fresh packed230installed inputs passes types, installed initial-freeze and aspect
pixels, and exact lifecycle. Native independent no-write reproduction and CSS
browser proof pass; types/lint clean. Logs `/tmp/pibbl-slice74-*`.
Node26.9.0/pnpm11.21.0deps/Chromium/Rust1.99.0/Apple C++20. Numeric gaps and finite
allocation now complete at capability-evidence level; broader intrinsic/minimum
contributions remain in their separate capabilities. Engine still opt-in, all
seven group gates open, no Node24 full trust/speed/general Yoga parity claim.

## Slice 75 delivered — direction-independent start/end alignment

Flex container justifyContent/alignItems/alignContent and FlexItemStyle.alignSelf
accept start/end. They keep physical LTR edges under experimental reversed main
axes and wrap-reverse; flex-start/flex-end remain direction-relative. Normalize
to existing placement tokens without changing the native ABI or allocation.
Normal forward axes accept both values; RTL remains separate.

Public RED: three reversed-axis tests rejected unsupported alignment values.
GREEN: reversed row/column geometry and moved hits, cross-line/self alignment,
component identity and placement-only counters; two forward-axis tests pass in
normal JavaScript. Source and built keyed collection replays pass final code,
including new logical-edge controls, unchanged stamps/nodes/solves/main placement,
advanced cross placement, gap misses, reorder/remove/restore and zero disposal
ownership. Built receipt has469 private inputs. Source/built URLs:
http://127.0.0.1:5192/#/examples/layout/wasm-flex-keyed-wrap and
http://127.0.0.1:5193/#/examples/layout/wasm-flex-keyed-wrap. Click a collection
heading to reverse lines, then Logical cross to compare flex-start/start/end.
The label uses a reactive component rather than a one-time resource read.

Fresh installed packed consumer passes230 dist inputs, Bundler/NodeNext and
reversed main/start pixels alongside initially frozen allocation/aspect geometry.
Tarball SHA256 ecea24b7ee0adea912f0555cd23d39bb853c23097c87ac416768d5b12cb9cfb7.
Editor source/built declarations, typecheck and changed-code lint pass. Reused
scoped read-only review found no material issues. Logs /tmp/pibbl-slice75-{source,
built,packed,editor,types,lint,normal,red,green}.txt. Native kernel65364bytes
unchanged. Remaining distribution gaps: pinned negative-free-space matrix,
one-item lines and automatic cross sizes. No capability/gate completion claim.

### Consolidation 25 completed for delivery slices 73–75

Separate commits:73 `27b18dde`,74 `e6175c94`,75 `bcf4f02e`. Numeric-gap and finite
numerical allocation capability evidence is complete; logical LTR alignment now
works under reversed axes. Fresh combined focused evidence passes197 tests with
1skip across8 files:153public/layout tests plus44allocator/loader tests. Logs
/tmp/pibbl-consolidation25-focused.txt and /tmp/pibbl-consolidation25-allocator.txt.
The final example-label-only correction was verified by source/built browser
replays and final type/lint checks. These reuse the bounded74 native10-test,
25-record oracle and installed receipts plus75 installed/reversed-alignment
receipt; no broader unchanged suite was rerun for consolidation alone. Source and
built keyed-wrap replay both pass all final assertions; built469 private inputs.
Packed75 passes230 installed dist inputs, Bundler/NodeNext and actual geometry.
Scoped75 read-only review reports no material findings. No baseline changes.

Fixed33 capabilities:2complete,11experimental,8partial,11missing,1excluded. All
seven release gates remain open; distribution remains partial until its negative
free-space, one-item-line and auto-cross evidence is complete. Engine opt-in;
Node26.9.0/pnpm11.21.0/Chromium, not a Node24 aggregate trust or performance claim.
Exactly one next finite exit is selected below.

## Slice 76 delivered — safe overflow and finite distribution evidence

Corrected around/evenly negative-space fallback in JavaScript and native WASM.
It now anchors physical LTR start, including reverse main axes and wrap-reverse;
explicit center stays centered and space-between remains direction-relative.
Public signatures and native ABI unchanged. Two original forward fallback tests
and four reversed public cases were RED before the corresponding production fix.
Independent DOM/Chromium tools preserve the primary executable evidence.

The pinned native corpus grows25→75:64matches and11classified CSS differences.
Fifty new records cover six main policies, seven cross/one-item policies,
automatic cross bounds, and eight reverse cases where Yoga3.2.1 differs from
Chromium/Pibbl safe fallback. Native geometry is preserved; expected Pibbl boxes
and explicit labels record those eight differences. No general Yoga parity claim.
A fresh no-write native reproduction passes. Kernel65383bytes, SHA256
5ad32dbae04f1a56a168c318dc2258f792b23bf64c64b6d2b4781ef1b23dd7b1;
Rust1.99 native10tests pass. Final affected browser-unit set167passed/1skip.
Normal forward fallback5passed/35skip. Type/lint/provenance/JSDoc pass.
The broader docs mutation check currently fails its repository-wide classification
gate for nine existing program Markdown files (log /tmp/pibbl-slice76-docs.txt);
that aggregate documentation debt remains open for consolidation/trust hardening.

Final source and built comparison runs actually completed with exit0, all75
cases/targets,64matches/11classifications, no errors and zero ownership after
pagehide; built469 private inputs. Both column Text replays pass: footer logical
x≈28→158, width420 and measured y stable; crossPlacements1→2 while solves,
measurements and nodeCreates stay fixed; old target misses/new target hits;
zero owned resources and no errors. Raster rounding is normalized through the
root background; text height is measured rather than assumed. Packed installed
consumer passes230 dist inputs, Bundler/NodeNext, safe-overflow pixels, measured
Text/following-sibling hit geometry and lifecycle. Tarball SHA256
f4bc305e118d4cb7319639764d3c23a99977ce646693e8569f132ebb8dad31d7.

Studio initially rejected duplicate alignment properties before making an iframe;
fixed by choosing fixture/default properties once, without raising a timeout or
source limit. The original startup failure is retained. Earlier empty-log tool
calls were not completed browser runs; duplicate task-owned processes were
stopped, then exactly one instrumented source and one built replay were followed
to actual exit0. Final logs /tmp/pibbl-slice76-{source,built,column-source,
column-built,packed,final-all,kernel,css,css-reverse,native-reproduce,types,lint}.txt.
Scoped solver and reverse-delta review reports no material findings; no unchanged
re-review. No screenshot baseline changed. Node26.9.0/pnpm11.21.0/Chromium; no
Node24 aggregate trust, general speed or release claim.

Fixed33:3complete,11experimental,7partial,11missing,1excluded. All seven group
release gates remain open. Consolidate76–78 after two further separate deliveries.

## Slice 77 delivered — definite percentage bounds and correct worktree metadata

Eight pinned native records cover percentage25% growth caps and70% shrink floors,
row/column, with owner200→240 and100→140 pairs. The corpus now has83 records:
72matches/11previous classified differences. Focused semantic/unit checks14pass,
including all83 public geometry records, two signal-driven cap resizes, invalid
percent inputs, conflicting bounds and explicit unsupported intrinsic percentage
owners; normal-path11pass/130skip. Node/mount identity and same-frame old-gap/new
hit evidence pass. The initial missing-fixture test was RED. The first new test
incorrectly treated useLayoutBox coordinates as world coordinates; it was fixed
to assert local dimensions and verify world positions through public hit targets.
No production percentage allocator change was needed. The min/max entry remains
partial: cross/wrapped percentages and indefinite-owner modes/policy stay open.

The new Percentage bounds button jumps directly to the eight relevant cases.
The surface is760×540 to show the larger columns without clipping, with caption
and footer moved below their boxes. Focused source and built replays include the
previous grow case, all eight new targets, resized old-target gaps, stable native
nodes and zero ownership/errors. Built469 private inputs. Installed consumer
passes230 dist inputs, Bundler/NodeNext and actual signal-driven cap/target checks;
core tarball/kernel unchanged from76. Types/lint/provenance pass. Logs
/tmp/pibbl-slice77-{final-focused,normal,source-final,source-metadata,
built-provenance,packed,types,lint,delivery-lint,native,provenance}.txt.

Initial built replay failed the prior grow target before new cases. Diagnosis
captured the actual served catalog from the primary checkout via a shared
node_modules symlink, while this worktree's new surface was540 high. Exact private
Studio scenario aliases now resolve to this worktree; public core/Three/text
remain on built resolution. The original checkout was not modified. The durable
driver requires an observed catalog URL, asserts its checkout path, and reads
actual served760×540 metadata; final built receipt confirms both and runtime
469 private dist inputs. Initial failure and diagnosis remain
/tmp/pibbl-slice77-built.txt and /tmp/pibbl-slice77-built-diagnosis.txt. A first
retry raced the normal Vite restart and received connection refused; server200
was confirmed before the successful focused replay. Scoped alias review found
no material source-fallback issue. No broad unchanged75-case browser replay.

Fixed33 counts unchanged:3complete,11experimental,7partial,11missing,1excluded;
all seven release gates open. Consolidation76–78 will include compact embedded
case records and the previously recorded documentation-classification debt.

## Slice 78 delivered — finite wrapped aspect ratios

Finite declared-main/basis Flex items now derive cross size from each line's final
main allocation in row/column wrap and wrap-reverse. No public signature or native
ABI change. Intrinsic-main ratio inference remains rejected, including wrapped
containers. Native pinned Yoga adds eight initial/resized fixtures: corpus91,
80matches/11preserved classified differences. Root200→172 derives94×47→80×40
on the first row and200×100→172×86 on the second; columns transpose the geometry.

Fresh focused experimental Chromium:147passed; final aspect subset passes after
adding explicit wrapped intrinsic rejection. Source5192/built5193 replay all eight
new cases plus prior grow targets, owner-resize old-target misses/new-target hits,
stable node ownership and exact disposal. Built proof469private dist inputs,
actual worktree catalog760×540, errors[], cleanup0/0/0. Logs
`/tmp/pibbl-slice78-{focused,final-aspect,source,built}.txt`.
Packed fresh offline consumer passes230installed dist inputs, Bundler/NodeNext,
wrapped ratio resize pixels and hit targets plus exact final ownership cleanup.
Tarball SHA256 `e17cf20f6efb6216a0b7c665de3a89a04783b4c39b94d0414f12aff3ceb994f3`.
Types/lint/provenance pass. Kernel65383bytes unchanged. Node26.9.0; no Node24
aggregate-trust claim. Independent scoped review found no production issue and
its requested wrapped intrinsic negative is included. No baseline rewritten.

### Consolidation 26 completed for delivery slices 76–78

Separate commits76 `c787d7d9`,77 `239df577`,78 `a96ee4a2`. Fresh combined
experimental Chromium:188passed in8layout files; ordinary JavaScript67passed,
121experimental skips. Logs `/tmp/pibbl-consolidation26-{focused,normal}.txt`.
Slice76 source/built75case replay,77percentage8case replay and78wrapped-ratio8case
replay retain their actual exit0 receipts. Latest packed78 fresh installed consumer
passes230dist inputs, editor/Bundler/NodeNext and exact cleanup; no repeated old
manual corpus loop. Native kernel65383bytes unchanged. No visual baselines rewritten.

Embedded91case records are now one case per line (public example426lines before
caption clarification), canonical pretty reference.json unchanged. Provenance and
full semantic comparison pass. Types/lint/JSDoc/changed Markdown formatting pass.
Documentation checks now pass, including109REDmutation probes and109compiled API
programs. Fixed classification for six operational proposal/rehearsal records,
three public API pages, the active execution plan, and a dated field-note banner.
Verifier recognizes logical start/end guarantees and Studio-owned example mounting;
separate mounted evidence remains required. Async mounting rejection probe targets
the actual awaited call. README awaits mount; Flex snippets have distinct variables;
self-contained title/line snippets use distinct import bindings. Fence compilation
rules remain unchanged. Logs `/tmp/pibbl-consolidation26-{docs,final-types,final-lint,final-format,provenance,jsdoc}.txt`.
Untracked dependency symlinks were preserved and excluded from staging. Environment
Node26.9.0/pnpm11.21.0deps/Chromium; no Node24aggregate trust or performance claim.

Fixed33 remains3complete,11experimental,7partial,11missing,1excluded; all seven
release gates open. This checkpoint does not close broad intrinsic ownership,
RTL/logical-edge policy, Grid, migration or release evidence.

## Slice 79 delivered — percentage cross constraints at a settled column width

Experimental intrinsic measurement now resolves known child width/minWidth/maxWidth
percentages once against an explicit numeric owner content width, before child
border-box conversion and dependent height measurement. This extends existing
Text/Flow/Grid/nowrap-column admission without a new public signature or native ABI.
Main percentages, percentage-dependent/indefinite owners and ordinary opaque
components remain unsupported; invalid/conflicting cross bounds throw.

Three focused public tests fail before the production change and pass afterward.
Final focused Chromium158passed; owner border-box200 with padding20/borders6
references174content width, child border-box50% resolves before insets, wrapped
Text and Flow resize semantics are exact. Normal boundary checks pass. Source5192
and built5193 nested example add50% paragraph cap; owner resize moves following
footer/target with stable node creates, old point misses/new point hits, exact
cleanup. Built structural Card proof469private dist inputs. Installed packed public
example uses the same percentage interaction driver;230installed dist inputs,
Bundler/NodeNext, zero ownership after disposal. Tarball SHA256
`f3978041a96c35d779f0e68606b277b330d03b51d46dcc392daad68e4bcfd8fb`.
Logs `/tmp/pibbl-slice79-{red,green,bounds,focused,source,built,packed,normal}.txt`.
Types/lint/JSDoc and documentation109REDmutation probes pass. Independent scoped
review found no material issue; requested box-conversion/rejection matrix included.
No native kernel or visual baseline change. Node26.9.0; no aggregate trust claim.
Fixed33 counts unchanged; this prerequisite does not complete the full min/max or
intrinsic owner graph. Next consolidation is after an appropriate3–4slice group.

## Slice 80 delivered — finite allocated-owner percentage gaps

Experimental Flex gap/rowGap/columnGap now accept number|Percentage. Column gap
uses actual content width, row gap actual content height in both Flex directions;
shorthand resolves independently before axis overrides. Native Yoga3.2.1 confirms
this with unequal dimensions and asymmetric padding. Intrinsic/max-only owners
remain explicitly unsupported; no zero fallback/fixed-point inference. Numeric
contract remains complete and ordinary JavaScript rejects percentage gaps.

Public TDD: five focused cases fail before the change. The mounted padded-owner
case also failed after the first change: resolveStyle had normalized against the
parent allocation. Corrected to resolveContainerBox's content allocation, then
exact pixels/targets pass. Native eight initial/resized row/column nowrap/wrap
records increase corpus99:88matches/11prior classified differences. Root300×200
padding L10/R30/T20/B40 means content260×140: column10%=26,row20%=28;
resized360×250 gives32/38. Source5192/built5193 replay eight new cases plus prior
grow targets; old target becomes gap, new target hits, nodes stable, errors[],
cleanup0/0/0, built469private dist inputs and actual worktree760×540catalog.
Source initial no-iframe failure was real stale editor number-only declarations;
updated public editor fields, then replay passes. Logs
`/tmp/pibbl-slice80-{red,padding,padding-green,source,source-fixed,built}.txt`.

Final focused Chromium178passed/1normal-onlyskip; ordinary gap boundary13passed.
Nested Grid cell actual allocation, shorthand/override and malformed/negative
inputs included. Packed fresh230installed dist inputs, Bundler/NodeNext percentage
acceptance and pixel-string type rejection, padded percentage gap resize/target
and exact disposal pass. Tarball SHA256
`f5d3064b249da902c459e5cfe80ed10498fea110d6e813bfb0ab22c16ced63fb`.
Logs `/tmp/pibbl-slice80-{final-focused,normal,final-packed}.txt`.
Types/lint/JSDoc/format/provenance and documentation109REDmutation probes pass.
Scoped reused review no material findings. Kernel65383bytes unchanged; no baseline
rewrite. Node26.9.0, no Node24 aggregate-trust claim. Accurate comparison catalog
metadata replaces stale five-case wording.

Fixed33 now3complete,12experimental,7partial,10missing,1excluded. Percentage-gap
entry is experimental; indefinite intrinsic cycles and broader nested owner graph
still missing. All seven release gates remain open.

## Slice 81 delivered — finite allocated-child percentage padding

Padding uses EdgeValues<number|Percentage>; generic EdgeValues defaults to numeric,
so borderWidth/normalizeEdges stay numeric. Experimental Flex resolves all physical
padding edges from containing content width before border-box/basis conversion.
Canonical numeric style is staged with original receiver/query ownership and used
for paint/hit geometry. Pure unallocated measureElement explicitly returns
unsupported; other-parent and normal raw percentage padding stay rejected. Frozen
percentage-padding inputs conservatively bypass the raw-input allocation snapshot;
numeric inputs retain eligibility. Numeric→percentage→numeric receiver transitions
and actual inner content geometry are verified without remount.

Five initial public cases fail before implementation and pass after. Additional
four ownerless Flex/Flow/Grid/Text pure measurement cases fail before the explicit
boundary check and pass after. Mounted fixture initially lacked its declared child
minimum; corrected fixture. An attempted numeric cache-hit assertion used a generic
component dependency that correctly invalidates allocation; replaced with explicit
eligibility evidence plus the existing public numeric cache-hit scenario, rather
than changing runtime invalidation semantics. Final focused Chromium199passed/
2normal-onlyskips in2files, including all107public comparison records and numeric
cache reuse. Ordinary boundary11passed. Logs
`/tmp/pibbl-slice81-{red,green,unallocated-red,hardening,final-focused,cache-final,normal}.txt`.

Pinned Yoga eight row/column content-box/border-box-basis resize records: corpus107,
96matches/11prior classified differences. Owner width200→300 yields L20/R30/T10/B20
→L30/R45/T15/B30, independent of owner height. Content80×60 becomes outer130×90
→155×105; border150×100 content100×70→75×55. Source5192/built5193 replay eight new
records plus prior grow targets, moved or stable targets per selected box model,
node identity, errors[], cleanup0/0/0, actual worktree catalog760×540. Built469private
dist inputs. Installed packed consumer proves real inner paint old-point miss/new
point hit,230installed dist inputs, positive percentage-padding and negative
percentage-border declarations in Bundler/NodeNext, exact final cleanup.
Tarball SHA256 `9f9d5ad9d8a819b79358c1540e0b3fa2078fe35ccf5b14d297de4d03d02e2d5a`.
Logs `/tmp/pibbl-slice81-{source,built,final-packed}.txt`.
Types/lint/JSDoc/format/provenance/documentation109REDmutation probes pass. Scoped
reused review no material findings. Kernel65383bytes unchanged; no visual baseline
rewrite. Node26.9.0, no Node24 aggregate-trust claim. Fixed33 remains3complete,
12experimental,7partial,10missing,1excluded; all seven release gates open.

### Consolidation 27 completed for delivery slices 79–81

Separate79 `dbffc7c1`,80 `fe6d6bc1`,81 `732ef064`. Fresh combined experimental
Chromium252passed/2normal-onlyskips in10layout, pure measurement and edge
normalization files. Ordinary JavaScript107passed/147experimental skips. Logs
`/tmp/pibbl-consolidation27-{focused,normal}.txt`. Existing source/built eight-case
percentage-gap and eight-case percentage-padding receipts include actual worktree
catalog, stable node ownership and exact cleanup; installed final81 consumer
230dist inputs/Bundler/NodeNext/inner geometry/cleanup pass. No unchanged old
manual corpus replay or native kernel rebuild. Kernel65383bytes unchanged.

Docs109REDmutation probes/JSDoc, canonical107case semantic equality and provenance,
scenario discovery, catalog, safe Markdown/API metadata/Studio manifests, types,
lint and changed Markdown format pass. Catalog initially rejected a containerStyle
spread in the comparison. Replaced it with the seven explicit supported style
fields, keeping authoring validation unchanged; rechecked the complete107case
public example1passed/196skips. Generated index refreshed for accurate comparison
metadata; generator introduction now reflects shipped descriptive named components
and Studio-owned mounting. Logs `/tmp/pibbl-consolidation27-{catalog,discovery,studio-docs,comparison-final,final-types,final-lint,final-provenance,index-format}.txt`.
Untracked dependency symlinks preserved, never staged. No screenshot baseline
rewrite. Node26.9.0/pnpm11.21.0deps/Chromium; no Node24 aggregate trust/speed claim.
Fixed33 remains3complete,12experimental,7partial,10missing,1excluded; all seven gates
open. No additional Flex core entry can honestly close from this evidence alone.

## Slice 82 delivered — wrapped stretched cross sizing and percentage bounds

Wrapped experimental columns now admit automatic cross width when stretched and
main height/basis is explicit. Cross percentage bounds use actual owner content
cross size, matching row behavior. Measured auto main and non-stretch automatic
cross cases remain rejected, including alignSelf overriding a stretched parent.
No public signature or native ABI change.

TDD initial2column failures/3passing controls become5passing. Four mounted signal
cases prove min/max behavior, old/new hit geometry, stable nodes, exact disposal,
and reuse of main solve/line formation on cross-only resize. Negative malformed,
negative, opposing cross limits and intrinsic boundaries included. Final focused
Chromium209passed/2normal-onlyskips in1file, including all115public oracle records;
normal focused9passed. Logs `/tmp/pibbl-slice82-{red,green,mounted,focused,normal}.txt`.
Pinned Yoga eight new row/column min/max cross-resize fixtures: corpus115,
104matches/11prior classified differences. At cross100→160, minimum60% produces
60→96 line cross and moves following line72→108; maximum25% produces25→40 item
cross while fixed sibling40 retains following line52.

Source5192/built5193 eight new-case replays plus prior grow targets pass, with
actual worktree catalog760×540,469private built dist inputs, errors[], cleanup0/0/0.
Initial source driver expected main solves to increase; actual correct cross-only
reuse exposed that assertion error. Revised proof requires equal main solves/line
formations and increased cross placement instead. Initial failure retained beside
successful `/tmp/pibbl-slice82-source-fixed.txt`; built receipt
`/tmp/pibbl-slice82-built.txt`. Packed actual column-wrap auto-width minimum moves
paint and following target,230installed dist inputs/Bundler/NodeNext/exact cleanup.
Tarball SHA256 `cbf73e070e11cbe6a995e46f868d66dd43dbc8d8794e76ac5f5e8c35829fb950`.
Types/lint/JSDoc/format/provenance and documentation109REDmutation probes pass.
Root reviewed the focused guard delta; no extra duplicate review. Kernel65383bytes
unchanged, no screenshot baseline rewrite. Node26.9.0; no aggregate trust claim.

Fixed33 remains3complete,12experimental,7partial,10missing,1excluded; all seven gates
open. This closes a finite wrapping/minmax prerequisite, not a complete entry.
Flex core still needs nested percentage/broader wrapping coverage, RTL and combined
reversal coverage, broader bound/indefinite owner policy, and automatic minima
outside current Text/empty Rectangle policy. No denominator narrowing.

## Slice 83 delivered — bounded direct Text main measurement in wrapped columns

Direct generic Text with finite numeric width, wrap true, visible fit/overflow,
automatic main size, explicit minHeight0 and zero grow/shrink is measured before
column line formation. No responsive query, positive cross minimum, cross/main
maximum, aspect ratio or unknown provider is admitted. Final fixed content width
and an unlimited main measurement constraint reuse the existing host measurement
cache when only owner height changes. No public signature or native ABI change.

Focused TDD: two public measurement failures before production, then wrap and
wrap-reverse geometry pass. Mounted content changes move a stable keyed following
target; paint-only work reuses measurement/solve/line formation; owner height
changes reuse Text measurement; disposal restores exact ownership. Ten unsupported
shape cases remain rejected. Fresh layout-wasm-slice:222pass/2normal-onlyskip,
`/tmp/pibbl-slice83-full.txt`. Source and built Studio replay checks short/long
Text, moved targets, stable A/B/C stamps, paint-only reuse, owner resize and exact
zero cleanup: `/tmp/pibbl-slice83-source-fixed.txt` and
`/tmp/pibbl-slice83-built.txt` (469private built inputs). Initial source receipt
preserves a failed expectation caused by assuming newline breaks in the existing
space-delimited Text wrapper; the example now uses ordinary space-delimited words.
No Text line-breaking behavior was changed.

Fresh packed install passes Bundler/NodeNext and actual public Text paint/hit/cache
proof,230installed dist inputs, tarSHA
`22f4b96abb806ce049ca6d99c386ba57173b53dd98f75109b3a4dfc7911695d9`:
`/tmp/pibbl-slice83-packed.txt`. Types/lint/JSDoc and109documentation REDprobes pass.
Focused read-only review reports no material findings. Kernel65383bytes unchanged;
Node26.9.0, no Node24 aggregate trust claim or Yoga font parity claim.

Fixed33 remains3complete,12experimental,7partial,10missing,1excluded; all seven gates
open. This adds a measured wrapping prerequisite, not a whole capability exit.

## Slice 84 delivered — finite allocated-nowrap percentage physical margins

Existing physical margin fields accept numeric values or percentage strings.
All four edges resolve against actual finite Flex content width; specific edges
override shorthand and finite negative values remain supported. Shared resolveLength
preserves decimal percentage grammar and division-before-multiplication arithmetic.
A focused regression failed for owner1e308/margin100% before replacing an unsafe
intermediate multiplication. Intrinsic measurement returns unsupported; wrapped
percentage margins and other layout families retain explicit rejection. No native
ABI change; normal JavaScript Flex remains unchanged.

TDD two row/column percentage cases fail before production, then pass. Mounted
asymmetric padding300→360 owner uses260→320content width and moves the following
blue target135→150 without new nodes; paint-only work reuses layout. Native pinned
Yoga3.2.1 adds four nowrap row/column resize fixtures. Combined corpus119records:
108matches/11preserved classified differences. Source and built four-case receipts
pass with zero ownership: `/tmp/pibbl-slice84-{source-fixed,built}.txt`,469private built
inputs. Fresh packed230installed inputs/Bundler/NodeNext and actual margin paint,
resize/hit/cache proof pass, tarSHA
`e2cb0f59da7ab62151bde3e6842221972c64330621317514b377fae7c047524f`:
`/tmp/pibbl-slice84-packed.txt`.

Fresh full layout file:226pass/2skip plus one failed oracle harness assertion;
the harness passed outer instead of content coordinates into the direct allocator.
After correcting that harness, the complete119-record public comparison passes
separately: `/tmp/pibbl-slice84-{full,comparison-fixed}.txt`. Twelve focused margin
checks pass, including finite arithmetic; types/lint/JSDoc pass. Initial Studio
receipt preserves rejected malformed fixture metadata; emitter corrected to flat
physical margin fields and explicit nowrap before successful browser replay.

Wrapped cross-margin mismatch stays outside84: at outer300×200,paddingL10/R30/T20/B40,
Yoga column-wrap A with L10%=26 startsx10, notx36; next line B startsx135. Numeric
L26/R39/T13/B52 gives the same geometry. The intended Pibbl behavior should preserve
its existing numeric physical-margin offset/paint contract rather than silently
copy this Yoga quirk; a later wrapped percentage slice needs explicit classified
native/public evidence. No wrapped percentage admission or parity claim here.

Fixed33 remains3complete,12experimental,7partial,10missing,1excluded; all seven gates
open. Kernel65383bytes unchanged, Node26.9.0; no aggregate trust claim.

### Consolidation 28 completed for delivery slices 82–84

Separate82 `3dc71e11`,83 `43f8c34d`,84 `86030541`. Fresh ten-file experimental
check:318pass/4skip with five stale percentage-gap rejection assertions in the
ordinary Flex test file. Those assertions predated slice80 percentage admission;
corrected them to validate the experimental/ordinary build contract, retaining
malformed/negative/nonfinite rejection. Focused rerun of that complete40-test file:
39pass/1normal-onlyskip. No production code change in this consolidation. Ordinary
same-ten-file run:148pass/179experimental skips. Logs
`/tmp/pibbl-consolidation28-{focused,flex-fixed,normal}.txt`. The full public119case
comparison was included in the passing nine files. Source/built82–84 and final84
installed consumer receipts above remain current; no unchanged broad manual replay
or native kernel rebuild.

Discovery, catalog and deterministic Studio documentation/search/API manifests pass.
Documentation109REDprobes/JSDoc/types/lint, formatted changed Markdown/JSON and
canonical119-case native provenance pass. Dependency symlinks preserved and never
staged; no visual baseline rewrite. Node26.9.0/pnpm11.21.0deps/Chromium, no Node24
aggregate trust or wall-clock speed claim. Fixed33 counts and all seven open gates
remain unchanged.

Finite route to a whole entry: the next eight-case nested-percentage allocation
slice supplies the last material owner gap in flex.row-column-nowrap-wrap. Its
explicit matrix below operationalizes the existing preserve entry rather than
adding new product scope. A complete status requires native outer/inner geometry,
public source/built/installed target movement, reuse/identity and cleanup, plus
retained negative intrinsic-owner evidence. Other flex-core entries remain open
where they genuinely require RTL/logical direction, broader minima/providers or
indefinite sizing policy; no whole flex-core gate claim follows from one entry.

## Slice 85 delivered — finite nested percentage wrapping preserve entry complete

One fixed nested public tree adds eight pinned Yoga row/column × nowrap/wrap ×
resize records. Three inner Flex owners and a following keyed item receive outer
allocations; inner40% dimensions/bases and10% gaps resolve from final content boxes.
Nowrap owner81→51 gives leaf32.4→20.4 and gap8.1→5.1; footer279→189. Wrap re-forms
three-plus-one into two-plus-two lines. No runtime/public signature/kernel change.

Focused public scenario test fails before adding the nested section/tree; then
passes geometry, target movement, stable stamps/nodes, paint reuse and cleanup.
Initial post-implementation hit assertion read the200ms inspector before refresh;
corrected it to poll the reported hit count. Native127-record public comparison
passes inside the fresh full file. That run has228pass/3skip and two failed negative
reason assertions: intrinsic/max-only rejection correctly occurs earlier at the
definite-child-basis boundary. Focused corrected three-test rerun passes, including
both exact negative reasons. Logs `/tmp/pibbl-slice85-{red,green,green-fixed,full,focused-final}.txt`.

Source/built all-eight replay checks semantic top/inner boxes, old footer/leaf
misses, current targets, identity and paint-only reuse, actual served worktree
catalog760×540surface and exact zero ownership. Built469private dist inputs:
`/tmp/pibbl-slice85-{source-catalog,built-catalog}.txt`. Fresh packed install repeats
all eight through installed public Flex/Rectangle, with actual leaf/footer pixels,
moved targets, stable nodes and paint reuse;230installed dist inputs/Bundler/NodeNext,
exact final cleanup: `/tmp/pibbl-slice85-packed.txt`. Unchanged runtime tarSHA
`e2cb0f59da7ab62151bde3e6842221972c64330621317514b377fae7c047524f`.
Native8 are independently preserved under `/tmp/pibbl-slice85-nested-percent-gap.*`;
canonical full127records freshly reproduced against pinned3.2.1. Corpus116matches,
11preserved classified differences. `nestedBoxes` marks one fixed tree, not a
recursive fixture framework. Native metadata now states nested shrink and explicit
percentage gap/padding policies. No screenshots/baselines rewritten.

The exact finite LTR preserve matrix written at consolidation28 is now satisfied:
direct/explicitly allocated nested Flex, row/column × nowrap/wrap, finite numeric/
percentage direct sizes/bases/gaps and bounds, source order, resize/hits, stable
identity, paint reuse and teardown. `flex.row-column-nowrap-wrap` moves to complete.
Fixed33 now4complete,11experimental,7partial,10missing,1excluded. All seven release
gates remain open. Reverse/RTL, broad automatic minima, indefinite percentage
feedback and standalone/release trust retain explicit separate entries. No general
CSS/Yoga parity or Node24 aggregate trust claim. Kernel65383bytes unchanged.

## Slice 86 delivered — wrapped percentage physical margins

Finite row/column wrap admits the existing percentage margin surface. Four focused
public allocation tests first prove the existing numeric geometry, then fail for
matching percentages before production. The shared width-based resolver is unchanged;
only wrap admission changes. Wrap-reverse, intrinsic/indefinite owners and auto/
logical margins retain explicit rejection/gaps. Numeric behavior is unchanged.
Mounted row/column resize moves blue following targets without new nodes; paint-only
updates reuse solves/line formation/measurement; exact disposal restores baseline.

Pinned native four wrapped records keep both Yoga boxes and explicit Pibbl boxes.
At outer300×200,paddingL10/R30/T20/B40, A60×30 with L10%/R15%/T5%/B20% starts36,33
in Pibbl, as with resolved numeric margins. Yoga starts36,20 in row wrap and10,33 in
column wrap; B geometry agrees. All four resize records are explicitly labeled
`preserved-physical-margin-offset`, with no numeric migration or parity claim.
Corpus131:116matches/15classified differences. Native function and independent
receipt preserved under `/tmp/pibbl-slice86-wrappedPercentageMarginCases*`.

Seven focused tests pass; fresh full layout file236pass/3normal-onlyskips,
`/tmp/pibbl-slice86-{red,green,mounted,full}.txt`. Source/built eight margin records
pass with served worktree catalog760×540, labeled four matches/four differences,
current targets and exact zero ownership: `/tmp/pibbl-slice86-{source,built}.txt`;
469private built inputs. Packed230installed inputs/Bundler/NodeNext actual wrap
pixels preserve physical offsets, old targets miss/new targets hit, paint reuse
and node identity pass; final cleanup0/0/0. TarSHA
`8ba96d144fcb0895dd6b2d9a0346faf683056a76f2ad77cc41458c2ab9d5b4b8`,
`/tmp/pibbl-slice86-packed.txt`. A fixture-import union widened after margin data;
the existing partial-shrink fixture needs the same RectStyle annotation used by
the main oracle harness. Types/lint pass after that test-only annotation.
Kernel65383bytes unchanged; no screenshot baseline rewrite. Node26.9.0, no Node24
aggregate trust claim. Fixed33 remains4complete,11experimental,7partial,10missing,
1excluded; all seven gates open.

## Slice 87 delivered — wrap-reverse percentage physical margins

Four numeric controls pass before production, while equivalent percentages fail
at the explicit wrap-reverse admission guard. Removing that guard admits the same
finite width-based resolution path; no geometry algorithm or native ABI change.
Expected numeric row initial/resized A36,78/B10,-16→A42,116/B150,129 and column
A171,33/B9,20→A222,36/B54,20 are retained exactly. Native Yoga3.2.1 reversed cross
positions differ materially and stay separately recorded/classified, never copied
into numeric Pibbl behavior. Corpus135:116matches/19classified differences.

Eight focused public tests pass: four numeric/percentage equivalences, mounted
row/column moved targets, stable nodes, paint/measurement/line reuse and cleanup,
plus signed percentage shorthand/explicit0/declaration-order precedence. Infinite
owner width rejects earlier at Flex width validation; one negative reason assertion
was corrected to that exact boundary. Normal JavaScript percentage-margin rejection
passes. Logs `/tmp/pibbl-slice87-{red,green,green-fixed,mounted,normal}.txt`.
Independent native draft/receipt `/tmp/pibbl-slice87-wrappedReversePercentageMarginCases*`;
Pibbl expectations are from pre-admission numeric controls, not a native parity claim.

Source and built12margin records pass, with actual worktree catalog760×540surface,
four matches/eight labeled differences, current targets, stable nodes and exact
zero ownership;469private built inputs: `/tmp/pibbl-slice87-{source,built}.txt`.
Fresh packed230installed inputs/Bundler/NodeNext verifies actual reversed-cross
pixels, former/new targets, paint reuse/identity and final0/0/0cleanup. TarSHA
`56ab7c6aee188e1f399b266fd3198d511c0b59468c2ed2766e5eaa0971d8870d`:
`/tmp/pibbl-slice87-packed.txt`. Types/lint pass. Full proportional combined check
belongs to consolidation85–87 immediately after this separate feature commit.
Kernel65383bytes unchanged; no visual baseline rewrite; Node26.9.0, no Node24
aggregate trust claim. Fixed33 remains4complete,11experimental,7partial,10missing,
1excluded; all seven release gates open.

### Consolidation 29 completed for delivery slices 85–87

Separate85 `e4ea5c0d`,86 `cd55cff0`,87 `aac241f6`. Fresh same-ten-file experimental
Chromium339pass/4normal-onlyskips, ordinary JavaScript148pass/195experimental skips:
`/tmp/pibbl-consolidation29-{focused,normal}.txt`. The full135-record public comparison
passes, including all new nested percentage owners and classified wrap/reverse
physical-margin geometry. Expected negative lifecycle diagnostic console output
contains no failed assertion. No production or test repair needed in consolidation.

Final87 source/built12margin records and installed consumer receipts remain current,
including nested owner fixtures from85,469private built/230installed inputs,
Bundler/NodeNext, exact geometry/targets/identity/cache and final zero ownership.
Corpus135:116matches/19classified preserved differences. Runtime kernel remains
65383bytes; no unchanged broad manual replay, native rebuild or screenshot baseline
rewrite. Fresh discovery/catalog/deterministic Studio docs/API/search checks pass:
`/tmp/pibbl-consolidation29-{discovery,catalog,studio-docs}.txt`. Documentation109RED
probes/JSDoc/types/lint/format and canonical native provenance pass. Untracked
dependency symlinks preserved, never staged. Node26.9.0/pnpm11.21.0deps/Chromium;
no Node24 aggregate trust or wall-clock speed claim.

The finite LTR row/column nowrap/wrap preserve entry is complete with the fixed
matrix recorded in85; physical percentage margins now cover all three wrap modes.
Logical/auto margins, broader minima/indefinite policies and the other fixed entries
remain explicit gaps. Fixed33 stays4complete,11experimental,7partial,10missing,
1excluded; all seven release gates open. The additive RTL contract below is now
authorized and is the next material capability, with no Flow.direction rename or
general style inheritance system. Final whole-codebase review remains deferred
until every accepted program exit is complete.

## Slice 88 delivered — inherited Flex layout direction

Adds experimental `FlexStyle.layoutDirection?: 'ltr'|'rtl'`, default LTR at a
root, inherited through ordinary components, Group, Clip and layout contexts,
with explicit LTR override and Layer forwarding. Main and cross placement use
axis-specific RTL reflection; logical alignment normalizes authored reversal.
Physical margins and source paint/hit/focus order remain physical/source ordered.
Direction is a receiver layout input, part of allocation-cache and component
entry snapshots, and a prepared-plan/boundary adoption guard. A retained Layer
redraws for direction changes and restores its child-root direction on failure.
The native nowrap cross call now accepts reversal; `layout_abi_v1` rejects older
compiled modules before publication without eagerly creating an instance.

Public RED: three row/inheritance tests failed before production changes, then
column cross x80 and retained-Layer target movement failed before those fixes.
The first Layer fixture needed the pre-existing explicit minimum/shrink contract;
its corrected RED then failed at the actual stale target. Five focused contracts
pass, with stable mounts/nodes, paint reuse, moved hits and exact disposal.

Fresh macOS/Node26.9.0/pnpm11.21.0 dependencies/Chromium evidence:

- Full experimental slice and loader lane:254pass/3skip (257total), including
  all143 public reference records. Ordinary focused direction/ABI rejection:
  6pass/252skip. Final focused direction/ABI lane after the negative guard test:
  11pass/247skip (258total). No Node24 aggregate-trust result is claimed.
- Pinned Yoga3.2.1 commit042f5013152eb81c1552dec945b88f7b95ca350f reproduces
  eight row/column/reverse × LTR/RTL cases with asymmetric physical margins.
  Corpus143 =124native matches +19preserved classified differences.
- Source5192 and built5193 RTL example replays passed; built proof469inputs,
  stable stamps, mirrored geometry, moved target, unchanged paint-only counters,
  cleanup0/0/0 and errors[]. The preview servers remained live; a sandboxed
  localhost check falsely suggested otherwise, and attempted restart correctly
  reported port-in-use. No duplicate server was created.
- Fresh offline installed tarball SHA256
  `154dbdae13ad871763e51a192b39b24402bbf7e66aead0f6ca872403a4f1e32d`,
  230installed-dist inputs, Bundler/NodeNext pass. Installed RTL signal moves
  a retained Layer's pixels and targets without native-node recreation.
- Generated kernel65432bytes,10native Rust tests pass. Typecheck and private
  package build pass. Focused consistency checks accompany this commit.

Hands-on: http://127.0.0.1:5192/#/examples/layout/wasm-flex-keyed-wrap;
click LTR ⇄ and inspect row/column mirroring, keyed mount stamps and targets.
This is a slice ready for feedback, not feature completion. Fixed33 now has
4complete/11experimental/8partial/9missing/1excluded; all7release gates stayopen.
Logical edge fields and precedence remain incomplete, as do the other recorded
whole-program exits. Review of the changed implementation found no material
findings; final whole-codebase review remains at program completion.

## Slice 89 delivered — receiver-aware logical Flex margins

Adds `marginStart?: number | Percentage` and `marginEnd?: number | Percentage`
to LayoutItemStyle/FlexItemStyle, consumed by experimental Flex. Logical edges
map the receiver’s inline direction, including a direct child Flex’s explicit
LTR/RTL override. They override physical edges and the uniform margin shorthand
independent of declaration order; explicit zero and signed percentages work.
Percentages use containing Flex content width. Winning numeric edges support
intrinsic measurement even when an overridden physical edge was a percentage.
Physical-only behavior, axis reversal, source traversal and resource ownership
remain unchanged. Normal JavaScript Flex and other layout families reject these
margins. Receiver classification, stripping, editor types, packed consumers and
public contracts are synchronized.

Public RED:7failed precedence/reactive tests before implementation. Two further
REDs pinned child-direction override and intrinsic shadowed-percentage behavior;
both failed at the expected geometry/status before their fixes. A converse child
RTL override and normal-build/other-family rejection supply bounded hardening.
Scoped review confirmed the child-direction finding fixed with no new material
findings. No extra overlapping or final whole-codebase review was run.

Fresh macOS/Node26.9.0/pnpm11.21.0 dependencies/Chromium evidence:

- Full public experimental slice suite:259pass/4skip (263total), all151reference
  records. Normal focused margin/direction rejection:3pass/260skip.
- Source5192/built5193 `test-wasm-layout-direction.mjs --logical-margins` pass,
  469private built inputs, percentage reference36/29.2px for row/column owners,
  RTL reflection, stable stamps, moved hit targets, unchanged paint-only work,
  cleanup0/0/0 and errors[]. Initial zero means omitted margin in the learning
  example, keeping its initial LTR state usable in the ordinary build.
- Fresh offline packed tarball SHA256
  `42ea4646528f3670ae198f253a182e5e609e6b0e6044c83bcf43d40f320b4f54`,
  230installed-dist inputs, strict Bundler/NodeNext pass. Logical percentage
  signal moves a retained Layer’s pixels/targets without native-node recreation.
- Eight native Yoga3.2.1 records pin logical-first/logical-last setter order,
  start0 and end-10% in LTR/RTL. Four LTR match; four RTL logical/physical
  conflicts explicitly preserve Pibbl width40 versus native widths28/52.
  Public corpus151 =128native matches +23classified differences. No parity claim.
- Typecheck, changed-code lint, scenario discovery/catalog, docs109RED mutations,
  public JSDoc and native receipt/embed reproduction pass. Kernel unchanged from
  slice88:65432bytes. No Node24 aggregate-trust or performance claim.

Hands-on: http://127.0.0.1:5192/#/examples/layout/wasm-flex-keyed-wrap;
click Logical start margin at the bottom, then LTR ⇄. This is a slice ready for
feedback. Fixed33 remains4complete/11experimental/8partial/9missing/1excluded;
all7release gates are open. Auto margins, logical padding/borders and the other
whole-program exits remain outstanding.

## Slice 90 delivered — canonical logical padding

Adds `BoxStyle.paddingStart?: number | Percentage` and `paddingEnd?: number | Percentage`.
Logical edges override mapped physical padding and shorthand, including zero,
independent of declaration order. Values are finite/nonnegative. Direction is
inherited or comes from a child Flex’s explicit direction. Allocated percentages
use actual containing Flex content width before box conversion. Consumed logical
fields are cleared so nested receivers retain numeric physical canonical padding
rather than resolving again against their own width. Numeric edge selection uses
direct scalar checks without temporary uniform edge objects. Raw logical padding
stays outside frozen-input allocation caching; native paint-only work is reused.

Four initial geometry/target REDs and one coincident physical-value control ran
before implementation. Intrinsic winning-edge RED and mirrored isolated RTL
measurement REDs exposed additional admission gaps; fixes inspect only active
edges using resolved owner direction. Explicit nested child LTR and invalid/
unallocated/normal-build checks pass. Layer keeps its previous own-raster rule,
ignoring physical/logical padding for its explicit dimensions and child origin.
No generalized cascade, second scheduler or retained layout graph is introduced.
Scoped review confirmed the measurement finding fixed; no broad final review.

Fresh macOS/Node26.9.0/pnpm11.21.0 dependencies/Chromium evidence:

- Full experimental public suite:285pass/5skip (290total) before adding four
  column-axis variants. Final focused row/column/RTL suite:16pass/278skip
  (294total). Final changed content-corpus branch:1pass/293skip. Normal focused
  box rejection/unallocated percentages/Layer boundary:6pass/284skip (290total).
- The older151-reference replay and the new8-case content replay have separate
  bounded tests; no timeout increase. The new fixtures use a direct nested Flex
  with one complete content rectangle. An inspected draft opaque wrapper would
  have forwarded raw props.style rather than canonical receiver metadata, so it
  was corrected before integration/testing. `contentBoxes` never replaces the
  existing two-leaf `nestedBoxes` contract.
- Eight pinned Yoga3.2.1 cases match100×60 border boxes and complete content
  geometry in LTR/RTL with both setter orders, start0 and end15%. Corpus159 =
  136native matches +23explicit preserved differences. Receipt/embed checks pass.
- Public source/built logical-padding example passes: initial contentx28,
  paddingx64, owner resizex82, RTLx314, explicit zerox368; stamp1 throughout,
  moved hits, unchanged paint-only work, cleanup0/0/0 and errors[]. Built proof
  469inputs. Both source/built native8-case browser replays pass with actual
  worktree catalog URLs and760×540 comparison surface.
- The built server’s old import.meta.glob inventory omitted the new example.
  Its exact worktree process31033 was verified and restarted once; the final
  standalone built replay passed. This was source-inventory startup, not layout
  geometry or WASM. No duplicate server or primary-checkout edit occurred.
- Fresh offline installed tarball SHA256
  `ba0fb16ec088abcc94ca8f9806a9517726fe8142434e3d514ffa9fc1ccd42bd5`,
  230installed-dist inputs, Bundler/NodeNext pass. Owner resize, explicit receiver
  direction, pixels/targets, stable native nodes and paint reuse pass.
- Typecheck, changed-code lint, docs109RED mutations/JSDoc, discovery/catalog and
  kernel/native provenance pass. Studio requires inline built-in styles; the
  comparison was corrected and its changed8-case branch replayed. Catalog now
  167lessons/12tutorial snapshots/33testlabs. Kernel unchanged:65432bytes,
  hash4469ea8647e72fbf9efa075f8df7174c2ce86a7090c06fd0037787ecde138d14.

Hands-on: http://127.0.0.1:5192/#/examples/layout/wasm-logical-padding;
click padding, resize, direction, moved content, then paint only. This is a slice
ready for feedback, not full feature completion. Fixed33 remains
4complete/11experimental/8partial/9missing/1excluded; all7release gates stayopen.
Logical borders and broader intrinsic/owner-graph interactions remain outstanding.

### Consolidation 30 completed for separately committed slices 88–90

Separate88 `14386781`,89 `f8f7e76d`,90 `c997f41e`. Fresh Node26.9.0/installed
pnpm11.21.0 dependencies/Chromium run across the same10files: layout-WASM slice,
Text auto-basis/minimum, measurement purity, structural card, paint reuse, Flex,
measure, box, resolve-length. Experimental385pass/6skip (391total), all10files
pass,72.13s. Ordinary155pass/236skip (391),8filespass/2skip,3.29s. Actual process
exits0. Logs `/tmp/pibbl-consolidation30-focused.txt` and `-normal.txt`.
No production fix was required. Reuse90’s fresh source/built/installed, kernel,
159-record native, types/lint/docs109RED/JSDoc/discovery/catalog evidence; no
unjustified repeat packaging or overlapping final review. Fixed manifest count
is33:4complete/11experimental/8partial/9missing/1excluded, all7gatesopen. No
Node24 aggregate trust, controlled wall-clock performance or feature-complete claim.

Concrete remaining direction/box exit matrix, without changing the denominator:

| Existing entry                                   | Required evidence still outstanding after90                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| direction.rtl-and-logical-edges                  | Numeric logical border vocabulary and precedence; bounded row/column × forward/reverse/wrap/wrap-reverse direction and min/max cases, inherited/explicit receiver direction, stable source paint/hit/focus order and teardown. Known mixed margin dimension differences stay attributed and labeled, never called full parity. |
| box.padding-and-layout-border                    | Logical borders combined with padding/content-box/border-box floors, zero and invalid values; direct/nested allocation ownership, explicit receiver overrides and unchanged Layer raster sizing. Broader intrinsic/percentage-owner feedback remains distinct pending work.                                                    |
| measurement.custom-leaf / flex.automatic-minimum | Settle existing intrinsic-provider query, invalidation, failure and baseline contracts before broadening automatic minima; do not imply a new measurement system by extending one Text exception at a time.                                                                                                                    |

91 supplies the missing border vocabulary and focused vertical proof. It does
not automatically close those entries or replace the remaining owner graph,
atomic geometry/interaction/HTML commit, standalone migration, Grid, corpus and
performance exits. After91, choose the intrinsic-provider contract prerequisite
as the next substantial gate step. Final whole-codebase review remains at full end.

## Slice 91 delivered — logical layout borders

Adds experimental numeric `BoxStyle.borderStartWidth` and `borderEndWidth`.
Receiver direction selects the physical edge; logical values, including zero,
override physical shorthand independently of setter order. Allocation canonicalizes
before box conversion and inset floors. Percentages and invalid numeric widths
are rejected; painted stroke and Layer raster behavior remain independent.
The cheap physical-only path is unchanged. Editor and installed declarations agree.

Focused public RED:10 failing tests before production. Fresh Chromium experimental
suite:311passed/6skipped (317); ordinary targeted rejection/Layer suite:2passed,
315skipped. Source and built controls preserve moved targets, stamp1, paint reuse
and zero disposal counters.18 native border cases match in both modes, including
content/border boxes, setter order, RTL and explicit child direction. Corpus now177
records:154 matches and23 previously classified differences. No baseline rewrite.
Packed consumer passes Bundler/NodeNext and installed pixels, targets, identity,
paint reuse and teardown:230 inputs; SHA256
`6e94a459b053b79ca1b67f5c0456bf360c6f42f0129062cf5ba47b1a2fc390bc`.
Built Studio uses469 inputs. Types, changed-TypeScript lint, documentation109 RED
mutation probes, public JSDoc, scenario discovery/catalog, native provenance and
whitespace pass. Node26.9.0/Chromium; this is not the Node24 aggregate trust gate.
A catalog HMR interrupted initial built replays; both passed after sources were
held stable. Scoped reviewer reported no material findings.

Inspect `http://127.0.0.1:5192/#/examples/layout/wasm-logical-padding`, Border edge.
Direction and box capabilities remain partial: broader combined direction,
intrinsic and owner-feedback exits are outstanding. Fixed33 capabilities and all
seven release gates remain open; whole-codebase review stays at full program end.

## Slice 92 delivered — custom intrinsic content providers

Adds distinct optional `measureIntrinsic` to `definePrimitive`, preserving
`measure`. Public input contains resolved props, normalized style, pure Canvas
measurement service and explicitly tagged bounded/unbounded axes. One result
returns min/max content sizes. First consumer: a direct custom primitive in a
finite nowrap Flex row. Parent applies insets once; automatic minimum and auto
basis consume the respective widths. Finite/nonnegative dimensions and width
ordering are checked; heights at different intrinsic widths need not be ordered.
Definite basis plus explicit minimum bypasses a provider. Unsupported explains the
missing contribution; thrown callbacks roll back, signal writes remain forbidden.

A public focused RED preceded production. Three initial provider/mutable-data
regressions pass. Fresh combined layout/measurement-purity run:320passed/6skipped
(326); subsequent cache adoption/own-style tests:2passed,322skipped; intrinsic
invalid-size matrix:4passed,324skipped. Ordinary suite:79passed/248skipped (327).
Public source/built interaction controls pass with stamp1, moved follower targets,
provider calls5 unchanged by sibling paint and zero disposal counters. Built uses
469 inputs. Source URL:
`http://127.0.0.1:5192/#/examples/layout/wasm-flex-intrinsic-primitive`.

Snapshots publish only on successful transaction completion and belong to the
existing layout region. Cache hits replay receiver dependencies; a post-hit
source update is tested. Conservative scalar/signal admission rejects mutable
nested inputs. Own style changes remeasure because providers can inspect full
style; sibling paint reuse is the demonstrated claim. Scoped review caught the
mutable-input and height-ordering issues; both have focused regression evidence.
Studio’s preexisting omitted preserveSignalProps declaration was synchronized
so the example compiles through the editor as well as runtime consumers.

Fresh packed consumer passes Bundler/NodeNext and installed finite rows, reactive
minimum, overflow, zero-minimum escape, target movement, reuse, identity and global
exact disposal:230 inputs, SHA256
`d05a09ff3cb535fb6aa10a39d69c3736e7cb8e9349cd0df4bc2ca89d6f848b32`.
Types, changed-TypeScript lint, scenario catalog/discovery, documentation109 RED
probes, public JSDoc and whitespace pass. Node26.9.0/Chromium; no Node24 aggregate
trust claim. Native kernel and corpus177/154matches/23classified are unchanged.
Custom measurement remains partial; broader intrinsic owners, constraints,
baselines and feedback still need evidence. Fixed33/seven gates remain open.

## Slice 93 delivered — finite wrapped-row intrinsic height

A finite numeric-width LTR row-wrap Flex with automatic height measures direct
empty numeric Rectangles with zero grow/shrink and automatic basis. Existing
normalization supplies bounds, numeric gaps/margins/insets and outer extents;
line cross maxima plus row gaps provide the content height. Parent adds own
insets once and places following targets before painting. Available maximum
height does not become definite. Other intrinsic shapes explicitly reject.

Public RED was the existing nowrap-only unsupported result. First pure and
mounted public scenario tests passed, followed by source Studio feedback. Width
160→90→160 yields inner height60→90→60 and footer y230→260→230; former target
misses/new target hits, identity remains stamp1, cleanup is0/0/0. Source and built
replays pass; built uses469 core inputs. URL:
`http://127.0.0.1:5192/#/examples/layout/wasm-flex-intrinsic-wrap`.
Two pinned Yoga cases independently match content/leaf geometry and footer
positions in source and built comparison. Corpus179:156matches/23classified.

Scoped review caught finite outer-extent overflow; a focused RED now rejects it.
Two additional REDs pinned native sequential edge arithmetic and preserved
separate lines when a transient positive candidate sum overflows. Final focused
run:6passed/328skipped; shape/inset boundary matrix:9passed/335skipped; ordinary
rejection:1passed/343skipped. Available-height, exact-fit inset, unsupported
provider/Text/percentage/reverse/RTL/column/flexible-child shapes are covered.
No native kernel or baseline change. Types/lint/docs109RED probes/JSDoc/catalog/
discovery/provenance/whitespace pass. A dead accumulator assignment was removed
by final lint cleanup without changing geometry.

Fresh installed package passes native-driven footer pixels/targets/return-width,
identity, paint and exact cleanup, Bundler/NodeNext:230inputs, SHA256
`ed20e0b095a9eaeece709d876f594b1b771238168f50f6f6db3a3b1be7ff0bb9`.
Node26.9.0/Chromium; no Node24 aggregate trust claim. General wrapped intrinsic
owners and feedback remain open. Fixed33 capabilities/seven release gates remain.

## Consolidation 31 completed for slices 91–93

Separate commits91 `3f943f70`,92 `02f21ea3`,93 `a7c36733`. The ten-file layout,
measurement, structural-description and reuse suite passed in both modes:
experimental433passed/8skipped (441),10files; ordinary157passed/284skipped (441),
8passed/2skipped files. Fresh logs `/tmp/pibbl-consolidation31-focused-final.txt`
and `/tmp/pibbl-consolidation31-normal-final.txt`; actual processes exited0.
The initial run’s one stale nowrap-only assertion was updated for the experimental
finite-width policy, while the ordinary build’s original diagnostic was restored.
No geometry correction or baseline rewrite was required by the consolidation.
Reuse fresh93 source/built/native/installed and static evidence above. Environment
Node26.9.0/pnpm11.21.0 dependencies/Chromium; Node24 aggregate trust remains open.

Fixed33 counts, parsed fresh from the manifest:4complete,11experimental,8partial,
9missing,1excluded. All seven release gates remain open. Current milestone map:

- Flex core: finite sizing/distribution/wrapping preserve entries complete;
  automatic minima, general intrinsic/font/image/aspect and overflow policy exits
  remain.94 next settles custom finite cross measurement at the allocated width.
- Box/direction: logical vocabulary is implemented. Nearest whole-entry exit is
  the bounded wrapped/reverse/min/max direction matrix with receiver inheritance,
  override, source paint/hit/focus order, teardown and explicit classified Yoga
  differences. Do not claim parity from vocabulary alone. Percentage/intrinsic
  owner feedback keeps the broader box entries partial.
- Measurement/intrinsic: direct paired providers and numeric row-wrap autoheight
  now run end to end. Final-width custom measurement, general nested Flex/Grid/
  Flow constraint graphs, unbounded/exact/at-most consumers, baselines and feedback
  still need concrete evidence.
- Placement/participation: remaining owner and positioning contracts must agree
  with automatic sizing; no opaque component discovery or speculative execution.
- Reactivity/publication: retain receiver edges and atomic Canvas, hit, focus and
  HTML publication; complete failure/cancellation ownership and efficiency exits.
- Migration/conformance: optional standalone layout packaging/public async loading,
  packed consumers, explicit corpus classifications, performance evidence and
  Node24 aggregate trust remain. Existing private package is evidence, not release.
- Grid beyond Yoga: complete the approved explicit placement/spans and intrinsic/
  fr/minmax/percentage track graph; no accidental CSS-compatibility promise.

Final whole-codebase review remains at full program end. Continue the fixed
program after this consolidation; do not create a new denominator or stop here.

## Slice 94 delivered — final-width custom finite measurement

No public API change. Direct primitives with both `measureIntrinsic` and existing
`measure` can compute automatic cross height after a finite nowrap row settles
content width. The finite callback receives exact horizontal bounds; intrinsic
contributions remain distinct. Real zero allocations query exact zero; declared
cross dimensions, aspect, query restrictions and intrinsic-only paths remain.
Unsupported finite results fail preparation instead of retaining stale height.

The focused public RED showed missing y30 paint/target after owner140→100 shrank
the leaf100→60. GREEN makes height20→40 and its click region grow together.
The existing intrinsic-leaf lesson now has Adaptive owner/paint controls at right,
while all original left controls continue to pass. Source/built replays preserve
stamp1, cache sibling-only paint, return to the short leaf, and dispose0/0/0.
Built uses469 core inputs. A canvas screenshot was inspected; no baseline changed.
URL `http://127.0.0.1:5192/#/examples/layout/wasm-flex-intrinsic-primitive`.

Successful intrinsic/finite snapshots share the existing region owner with
separate query keys and a three-entry per-occurrence bound. Publication remains
transaction-only; hits replay receiver dependencies. Conservative mutable-input
admission and full-style snapshots remain. Finite-only signal reads survive
cache hits and detach on dispose. Explicit cross-size bypass, intrinsic-only
fallback, actual zero width, border-box content width/insets once, unsupported
preflight before earlier paint, exact failed ownership cleanup and remount pass.

Fresh two-file layout/measurement suite:346passed/7skipped (353); ordinary:
80passed/273skipped (353). Actual processes exited0. Packed Bundler/NodeNext and
installed width/height/target movement, return-width, identity, paint reuse and
exact global disposal pass:230inputs, SHA256
`3e8042b107ec4948368c27c817bf3bc53f32203db171bd60694421e7c4ed1432`.
Types, changed-code lint, catalog/index, documentation109RED probes, JSDoc and
whitespace pass. Scoped review reports no material findings. Node26.9.0/Chromium;
no Node24 aggregate gate claim. Native kernel/corpus179/156matches/23classified
unchanged. Custom-leaf capability remains partial: broader exact/at-most/unbounded
consumers, nested owner feedback and baselines remain. Group94–96 consolidates
only after96. Final whole-codebase review stays at full program end.

## Delivered combined direction evidence (slice 95)

Sixteen pinned Yoga3.2.1 cases combine row/column, main reverse, wrap/wrap-reverse,
LTR/RTL, logical start margins/padding/borders and min/max bounds. Public ordinary
probes record complete world boxes before pixel and click checks. Keyed focus
survives RTL; Tab and Shift-Tab remain source ordered. Negative logical margin
overlap keeps later source paint and topmost hits. Native nodes, arenas and
measurement caches return to baseline. No runtime or public API change.

Exact coordinates caught a difference hidden by center-pixel samples: row center
with margins2/4 is−1 vertically; column logical margins6/3 give±1.5. In column
wrap-reverse, asymmetric root insets additionally differ because Pibbl reflects
inside its content box while Yoga reflects the inset position against the outer
box. Both are existing documented Pibbl policies, now explicitly classified as
`preserved-margin-and-content-reflection`. Independent isolate evidence remains;
the direction entry is deliberately still partial. Native corpus195 contains
156matches and39classified differences, not195parity cases.

Fresh Chromium: focused4pass, complete slice file346pass/7skip; ordinary
JavaScript77pass/276skip. Source5192 and built5193 replay all16 exact preserved
boxes, keyed stamps and A/B/C hits, with zero owned resources after disposal.
Built receipt469dist inputs. Installed packed proof replays all16 and checks each
controller cleanup, plus strict Bundler/NodeNext consumers and230installed inputs.
Kernel and tarball are unchanged from94: tarball SHA256
`3e8042b107ec4948368c27c817bf3bc53f32203db171bd60694421e7c4ed1432`.
Native provenance, types, changed-code lint, catalog, documentation109RED probes,
JSDoc and whitespace pass. No visual baselines changed. Node26.9.0/Chromium;
no Node24 aggregate trust claim. Fixed33 stays4complete/11experimental/8partial/
9missing/1excluded; all seven gates remain open.

## Delivered isolated direction policies (slice 96)

Eight pinned Yoga3.2.1/public fixtures separate the two existing rules exposed in95.
Four zero-margin columns isolate asymmetric parent insets: wrap matches native
in both directions, while wrap-reverse differs by−14px in LTR or+6px in RTL,
explicitly `preserved-content-box-reflection`. Four zero-root-inset logical-margin
columns isolate±1.5px margin-box centering under either wrapping direction,
explicitly `preserved-physical-cross-margin`. There is no runtime/API change.
The native corpus is203:158matches/45classified differences.

All24 direction fixtures pass complete public semantic world boxes, pixels and
A/B/C hits; source5192/built5193 retain keyed stamps and dispose to zero owned
resources with no browser errors. Fresh installed packed consumer passes all24
and each node/arena/measurement-cache cleanup, strict Bundler/NodeNext and230
installed inputs. Unchanged kernel/tarball SHA is the94/95 value recorded above.
Focused Chromium4pass/349skip; the new eight-case evidence guard first failed
against16records, then passed24. Native provenance, types/lint, catalog, docs109RED,
JSDoc and whitespace pass. No baseline rewrite or Node24 aggregate claim.

The direction entry is capability-complete for the stated finite experimental
Flex contract, including independently classified preserves. It does not promise
universal Yoga/CSS parity, complete margin/intrinsic behavior or enable the engine.
Fixed33 is now5complete/11experimental/7partial/9missing/1excluded; all seven
release gates remain open. Prior88–91 inheritance/receiver override, Layer,
normal-build/invalid-direction/ABI negatives and95keyed focus/source priority are
retained. Bounded consolidation32 of94–96 is next, then delivery97 below.

### Consolidation 32 completed for delivery slices 94–96

Separate94 `196e8275`,95 `69b187a6`,96 `3548157d`. One fresh bounded10-file
Chromium run covers layout-WASM/public scenarios, Text auto basis/minima,
measurement purity, structural Cards, paint reuse, Flex/measurement/box/length
contracts:442passed/8skipped(450),76.86s. Ordinary JavaScript:157passed/
293experimental skips(450),8passedfiles/2skippedfiles,3.31s. Logs
`/tmp/pibbl-consolidation32-focused.txt` and
`/tmp/pibbl-consolidation32-normal.txt`; both exited0. Expected negative-case
layout diagnostics are not assertion failures. Reuse fresh96source/built24-case
receipts, installed package230inputs/Bundler/NodeNext,203-case pinned native
provenance and static checks. No runtime changes after96, no duplicate review or
baseline rewrite. Node26.9.0/pnpm11.21.0deps/Chromium, not Node24 aggregate trust.

Fixed33 remains5complete/11experimental/7partial/9missing/1excluded. All seven
gates remain open. The next97 starts the existing auto-margin gap; broader
intrinsic/baseline, prepared ownership/atomic publication, other participation,
packaging migration, corpus/performance and Grid exits remain in the manifest.
Final whole-codebase review stays at full program end.

## Delivered finite physical main-axis auto margins (slice 97)

Public `FlexMargin = number | Percentage | "auto"` widens existing physical
`marginLeft`/`marginRight`; no selector or alternate return contract. Supported
consumer: finite LTR row-nowrap experimental Flex. Auto slots are0during sizing,
then divide positive remaining free space before justification. Nonpositive free
space leaves them0and retains existing alignment. Other auto shapes reject.
The first public RED rejected `marginLeft:"auto"`; production then made both
focused public tests pass. Source comparison section12 is runnable and all seven
native cases match: left/right/both at200→260 and alignment precedence. Click
A/B after moving; keyed stamps remain stable.

A lazy Rust arena flag vector keeps allocation records/numeric margins immutable;
no second solve or post-solve margin rewrite. Optional flag revision invalidates
main placement only. Numeric0→auto→0 proves unchanged solves/cross placement/node
creates and one main-placement increment per change. Public growth-before-auto,
nonpositive space, owner resize, moved hits and paint reuse pass. Private module
marker isv2; oldv1/earlier modules reject before publishing, entries remain inert.
Native11tests pass, kernel67644bytes, SHA256
`c984959e10c694d0ee4cc552f980662edada3c4e8c47428a420764fb3131f79f`.

Fresh Chromium slice+loader:361pass/8skip(369); ordinary85pass/284skip(369).
Source5192/built5193 seven cases match exact semantic boxes, stable keys and hits,
cleanup0/errors[]; built469inputs. Fresh installed tarball strict Bundler/NodeNext,
left/right auto type evidence and rejected cross-auto type, seven public fixtures,
all24direction cases, target routing and per-controller cleanup pass with230inputs.
Tarball SHA256 `56a46b7d7713d631ab4869a537af9bdc0b8e6eaa514c848b6dd83ff2d3fb2fdb`.
Native corpus210=165matches+45classified. Types, changed-code lint, documentation
109RED probes, JSDoc, catalog and native provenance pass. No baseline rewrites,
Node24 aggregate trust or wall-clock performance claim.

`flex.auto-margin` advances missing→partial. Fixed33 is5complete/11experimental/
8partial/8missing/1excluded; all seven release gates remain open. Whole auto-margin
behavior is not complete. Final whole-codebase review remains at full program end.
Scoped review of the changed native flag storage, region cache/ownership, v2 ABI
and TypeScript precedence/admission found no material issue.
Group97–99 consolidates only after99.

## Delivered finite nowrap main auto directions (slice 98)

Existing `FlexMargin` widens physical top/bottom and logical start/end fields.
Finite nowrap rows/columns support all four main directions and LTR/RTL; inline
logical auto edges participate only when they map to the main axis. Cross-axis,
shorthand and wrapped auto margins still reject explicitly. Receiver precedence,
numeric/percentage geometry, sizing-before-absorption and nonpositive alignment
remain unchanged. No new kernel/ABI or return contract.

Three focused public tests first failed under97admission, then passed: eight
physical direction cases, four logical row cases and a mounted row→column→RTL
signal transition. Eight focused assertions/tests including revised negative
shapes pass; focus is captured before geometry changes, pointer-induced focus
changes are legitimate, keyed stamps/nodes persist, old points miss and new
points hit. Ten pinned Yoga cases extend the contiguous auto family to17; every
new native box matches public semantic geometry.

Source5192/built5193 all17 auto cases match native geometry, stable keys and A/B
hits, cleanup0/errors[]; built469inputs. Fresh installed17-case proof, all24
prior direction cases, column/logical type consumers plus rejected shorthand,
Bundler/NodeNext and per-controller cleanup pass with230inputs. Tarball SHA256
`7e4da8c16b3501fd51cb778347244ca9b69314f6f8cb074343d816b20b6906a7`.
Fresh full slice Chromium358pass/8skip(366), normal78pass/288skip(366).
Types, changed-code lint, docs109RED, JSDoc, catalog and pinned provenance pass.
Kernel67644bytes/v2/SHA and11Rust tests are reused unchanged from97, not claimed
as a new native-unit run. Native corpus220=175matches+45classified.

Fixed33 remains5complete/11experimental/8partial/8missing/1excluded; auto-margin
stays partial and all seven release gates remain open. No aggregate Node24 or
wall-clock performance claim. No baseline rewrite, extra writer or overlapping
review. Group97–99 consolidates only after99; whole-codebase review stays at end.

## Delivered wrapped per-line main-axis auto margins (slice 99)

Two focused public tests failed before the production change, then passed: each
source-formed line divides its own free space among its actual auto slots; a line
without slots retains justification. Width100→160 merges three40px items with10px
gaps while preserving keyed stamps/focus, moving paint/hits and retaining paint-only
reuse. Four cross-axis/shorthand unsupported shapes remain explicit negatives.
Finite row/column, forward/reverse, LTR/RTL and wrap/wrap-reverse are exercised.

Private ABIv3 adds wrapped-auto placement using line slices of existing immutable
allocation records and lazy flags; no second solve or margin rewrite. Older and
incomplete modules reject before publication, entries remain inert. Scoped review
of changed Rust/region/cache/module/admission code found no material issue.
Native12tests pass; kernel68589bytes SHA256
`1127fd1f990385b760d2d512a9b7de83d8650fdb166268c7976e3af0c78ed6a3`.

Pinned Yoga3.2.1 counts a deferred overflowing candidate's auto slot on the prior
line. Sixteen independent per-line expectations are explicitly classified
`css-line-local-auto-margin`; raw native boxes remain alongside them. The17th
line-without-auto case matches native. A separate Chromium CSS probe reproduces
A10/B60/C60 across two lines, consistent with
[Flexbox main-axis alignment](https://www.w3.org/TR/css-flexbox-1/#main-alignment).
This is a documented difference, not a native parity claim.

Fresh source5192 and built5193 replay all17 wrapped cases with exact semantic
boxes, stable live keys, A/B/C hits, cleanup0/errors[]; built469inputs. Installed
package passes all34auto cases plus prior24direction cases, strict Bundler/NodeNext,
per-controller cleanup and230dist inputs. Tarball SHA256
`ef06686286c7dd14b7fb583648170c80e4d3efc4723d44f059c79744c10fdfd3`.
Full slice+loader Chromium368pass/8skip(376), ordinary87pass/289skip(376).
Source URL: http://127.0.0.1:5192/#/examples/layout/wasm-yoga-migration;
Next section13times reaches wrapped autos. Corpus237=176matches+61classified.
Fixed33 stays5complete/11experimental/8partial/8missing/1excluded; all7gates open.
Auto-margin remains partial. Consolidate97–99 next; no Node24 aggregate or full
program completion claim. Final whole-codebase review stays at full program end.

### Consolidation 33 completed for delivery slices 97–99

Separate97 `a47dd931`,98 `aced729e`,99 `57a74243`. Fresh11-file Chromium
run covers public layout, Text basis/minima, pure measurement, structural Cards,
paint reuse, Flex/box/length and loader ABI contracts:464passed/9skipped(473),
77.13s. Ordinary lane167passed/306skipped(473),9passedfiles/2skippedfiles,2.85s.
Logs `/tmp/pibbl-consolidation33-focused.txt` and
`/tmp/pibbl-consolidation33-normal.txt`; both exited0. Reuse fresh99 native12,
source/built17wrapped cases, packed34auto+24direction cases/230inputs, strict
consumer types, 237-case provenance, types/lint/docs109RED/JSDoc/catalog checks.
No duplicate unchanged review, baseline rewrite or runtime edits after99.
Node26.9.0/pnpm11.21.0dependencies/Chromium; no Node24 aggregate trust claim.
Fixed33 stays5complete/11experimental/8partial/8missing/1excluded, all7gates open.
Next100 starts bounded cross-axis auto margins; final whole-codebase review stays
at full program end.

## Delivered bounded finite row cross-axis auto margins (slice 100)

Physical top/bottom cross auto now works in finite nowrap/wrapped rows, forward
or reverse main direction and LTR/RTL, with finite explicit numeric child height.
Automatic child cross size, aspect sizing, wrap-reverse, columns and shorthand
remain rejected. Existing FlexMargin fields/types suffice; no new public operation.
Auto cross edges divide each item's line free space before alignment. Nonpositive
space overrides alignment and overflows at start; numeric before margins remain.

The focused public mounted test failed on99admission, then passed: A40×20 beside
B40×40 in a100px wrapped row moves y10→20 for topauto→10 for both, C stays50.
Keyed focus/stamps/hits persist, old points miss, cross placement alone changes,
paint-only updates reuse it and all layout ownership returns to baseline.
Additional public nowrap positive/zero/negative, bottom/both and numeric-opposite
checks pass. Native cross records pack two flags with alignment in the v4 ABI;
flags participate in the existing cache key, margins remain unchanged. Older v3
and earlier modules reject; imports stay inert. Scoped changed-code review found
no material issue. Native13tests pass, binary68663bytes SHA256
`607009575bf39b1add23364e43c0cb8869bea7f1eed2e2843ed963604589ffd0`.

Pinned Yoga centers A in all12wrapped fixtures. Eight top/bottom cases explicitly
classify `css-cross-auto-precedence`; four opposing-auto cases match native.
Independent Chromium CSS top/bottom/both yields A20/0/10 and C50, agreeing with
[Flexbox cross alignment](https://www.w3.org/TR/css-flexbox-1/#cross-alignment).
Native boxes and independent expected boxes both remain recorded.
Source5192/built5193 all12 cases pass exact geometry/live keys/A-B-C hits,
cleanup0/errors[]; built469inputs. Fresh installed46auto+24direction cases,
strict Bundler/NodeNext and per-controller cleanup pass230inputs. Tarball SHA256
`cdec52fcf671f20a561728c8aa26350661400a9c3e4574c4461367eb70402f2c`.
Full slice+loader Chromium372pass/8skip(380), ordinary88pass/292skip(380).
Types/lint/docs109RED/JSDoc/catalog/native provenance pass. A test-only broad
replacement was caught by types and corrected before the final fresh suite.
Source http://127.0.0.1:5192/#/examples/layout/wasm-yoga-migration:
Next section14times selects cross autos. Corpus249=180matches+69classified.
Fixed33 stays5complete/11experimental/8partial/8missing/1excluded, all7gates open.
No baseline rewrite, Node24 aggregate or whole-program completion claim.
Consolidate100–102 after102; final whole-codebase review stays at full program end.

## Delivered finite cross-auto direction coverage (slice 101)

The finite explicit-child-cross-size contract now includes columns and cross
reversal. Physical flags normalize through effective cross reversal; logical
column edges retain receiver-direction precedence. Existing native reverse
conversion handles placement without another flag or layout path. Automatic
child cross size and aspect sizing still reject. ABI v5 rejects complete v4
kernels that lacked reverse-auto admission; imports stay inert.

A focused public mounted36-case matrix failed under100admission, then passed
exact layout boxes, A/B/C hits and per-controller cleanup. All36 independent
expected boxes also match Chromium CSS before runtime support was added.
Main row/column/reverse, wrap/wrap-reverse and LTR/RTL cases include physical
before/after/both auto. Twenty-four single-edge cases explicitly classify the
pinned Yoga cross-auto precedence difference; twelve both-auto cases match.
Additional public signal reversal and row→RTL-column checks preserve keyed
focus, old/new target correctness, nodes and reversal-only sizing reuse.
Logical column start/end/both and oversized120-in80 nowrap LTR0/RTL−40 pass.
Wrapped line overflow uses existing line placement; no receiver-direction bit
is introduced. Scoped actual changed-code review found no material issue.

Native13tests pass, binary68649bytes SHA256
`029fd944e878b879a235461dcfac17219948569198795428caff12c4c388bfe9`.
Source5192/built5193 all36cases pass boxes/live keys/hits, cleanup0/errors[];
built469inputs. Fresh installed82auto+24direction cases, strict Bundler/NodeNext
and per-controller cleanup pass230inputs; tarball SHA256
`b5e174539d45e47451dafd64113c7114849a9164a691879acd48e74458734e3d`.
Full slice+loader Chromium376pass/8skip(384), ordinary89pass/295skip(384).
Types/lint/docs109RED/JSDoc/catalog/native provenance pass. Source URL
http://127.0.0.1:5192/#/examples/layout/wasm-yoga-migration:
Next section15times selects cross-auto directions. Corpus285=192matches+93classified.
Fixed33 stays5complete/11experimental/8partial/8missing/1excluded, all7gates open.
No baseline rewrite, Node24 aggregate or whole-program completion claim.
Consolidate100–102 after102; final whole-codebase review stays at full program end.

## Delivered auto-margin shorthand and precedence (slice 102)

Existing `LayoutItemStyle.margin` now accepts `FlexMargin`, mirrored in the Studio
editor declaration. Uniform auto supplies all four edges before specific physical
and logical edge resolution. Explicit zero suppresses only its edge, preserving
existing receiver precedence and the main/cross auto allocators. No new public
operation or native protocol. Normal/non-Flex paths and pure intrinsic auto
measurement retain explicit diagnostics. Cross-auto finite-size/aspect admission
is unchanged after overrides.

The focused mounted public test failed before implementation, then passed:
A40×20/B40×40 in200×100 start at60,40 /160,30; explicit left/top0 moves A to0,0
while B stays. Keyed focus/stamps/hits persist, old points miss, sizing/nodes reuse,
placement updates and paint-only reuse pass; disposal restores all resources.
Six focused public/negative checks pass. Eight pinned native/source/built cases
cover all/left-zero/top-zero/start-zero × LTR/RTL; every box matches native.
Built469inputs, cleanup0/errors[]. Installed90auto+24direction cases pass with
230inputs and strict Bundler/NodeNext positive shorthand types; tarball SHA256
`453ca3110eb20251b64ecaffbf4fcc5548c894ce6da04422f87c5c7027358184`.
Types/lint/docs109RED/JSDoc/catalog/provenance pass. Unchanged native13tests,
68649byte/v5 binary and SHA from101 are reused, not a new native run. Scoped
actual shorthand/type/admission/measurement review found no material issue.
Source http://127.0.0.1:5192/#/examples/layout/wasm-yoga-migration:
Next section16times selects shorthand. Corpus293=200matches+93classified.
Fixed33 remains5complete/11experimental/8partial/8missing/1excluded, all7gates open.
Auto-margin remains partial. Consolidation34 of100–102 follows separately before
another implementation slice. No baseline rewrite or Node24 aggregate claim.
Final whole-codebase review remains at full program end.

### Consolidation 34 completed for delivery slices 100–102

Separate100 `26613e70`,101 `e2418916`,102 `dc0565a6`. Initial bounded11-file
run found one obsolete assertion that uniform auto must throw;472passed/9skipped.
The new102contract supports it. Remove only that obsolete invalid value; malformed,
nonfinite and null values still reject. The corrected old assertion plus public
shorthand test pass2/2; fresh full11-file Chromium run passes473/9skip(482),77.56s.
Ordinary lane169passed/313skipped(482),9passedfiles/2skippedfiles,2.90s. Logs
`/tmp/pibbl-consolidation34-focused.txt` (initial),
`/tmp/pibbl-consolidation34-obsolete-negative.txt`,
`/tmp/pibbl-consolidation34-focused-final.txt` and
`/tmp/pibbl-consolidation34-normal.txt`; final commands exit0.
Reuse fresh102source/built8native matches, installed90auto+24direction cases,
230inputs/strict consumer types,293-case provenance and static checks. Unchanged
v5/native13evidence comes from101; no duplicate review or baseline rewrite.
Node26.9.0/pnpm11.21.0dependencies/Chromium; no Node24 aggregate trust claim.
Fixed33 stays5complete/11experimental/8partial/8missing/1excluded, all7gates open.
Next103 hardens the existing opposing/minmax auto gap; automatic/intrinsic cross
sizing remains explicitly unfinished. Final whole-codebase review stays at end.

## Delivered opposing auto-margin bounds evidence (slice 103)

This is conformance hardening of existing runtime behavior, not a new operation
or production change. Eight pinned cases cover growth consuming free space,
max-width freeze before opposing auto sharing and resize, minimum-width shrink
freeze, numeric opposite margin, negative free space, and cross min/max before
opposing cross sharing. A capped100px item starts30→60 in200→260 beside40px.
Public mounted fixtures assert exact geometry, visible hit points and per-owner
cleanup;1focused test passes all8cases. Independent Chromium CSS matches all8.

Seven match native. With two40px items in60px, pinned Yoga starts0/40 while the
existing CSS/Pibbl rule sets auto slots0 then centers at−10/30. Raw native boxes
remain recorded with `css-nonpositive-auto-alignment` and separate expectations;
this is not a parity claim. Source5192/built5193 all8 cases pass boxes/live keys/
hits, cleanup0/errors[]; built469inputs. Installed98auto+24direction cases pass
230inputs/Bundler/NodeNext/per-controller cleanup; overflow hits choose visible
points instead of negative coordinates outside the Canvas. Fresh tarball SHA256
`453ca3110eb20251b64ecaffbf4fcc5548c894ce6da04422f87c5c7027358184`
is unchanged from102 because package code is unchanged. Types/lint/docs109RED/
JSDoc/catalog/301-case provenance pass. Reuse native13/v5/68649byte evidence from101
and passing consolidation34; no unchanged runtime re-review or broad rerun.
Source http://127.0.0.1:5192/#/examples/layout/wasm-yoga-migration:
Next section17times selects bounds. Corpus301=207matches+94classified.
Fixed33 remains5complete/11experimental/8partial/8missing/1excluded, all7gates open.
Auto-margin stays partial: automatic/intrinsic cross sizing is not implemented.
Consolidate103–105 after105; final whole-codebase review stays at program end.

## Delivered measured Text cross-auto sizing (slice 104)

Direct generic wrapped Text in a finite experimental nowrap row may have automatic
height and a cross-auto margin at declared finite numeric width. Visible/default
fit/overflow, no aspect sizing/query; other Text/custom/column/wrap shapes keep
explicit diagnostics. This is allocated Text sizing, not pure intrinsic owner
measurement. A narrow admission exception reuses the existing initial/final-width
measurement and native cross-auto flags; no new API, protocol, owner or scheduler.

The public mounted test failed before production changes, then passed with stretch
suppressed: width80→40 makes two→three10px lines, height20→30, top80→70 and sibling
x80→40. Actual Canvas draw positions, keyed focus, old/new hits, remeasurement/
solve with stable nodes, paint-only reuse and exact cleanup pass. Eight added Text
negative shapes pass; full slice+loader387passed/8skipped(395), ordinary89passed/
306skipped(395). Scoped changed-guard/measurement/cache review found no material
issue. Existing v5/68649byte/native13 evidence from101 is reused unchanged.

Two pinned Yoga cases use a deterministic6px-glyph word-wrap measurement callback,
with explicit provenance and no font-rendering parity claim. Native callback
allocation matches the two browser Text cases. Source5192/built5193 draw/line-count/
sibling-box/live-key/hit proofs pass, cleanup0/errors[]; built469inputs. The first
Studio draw probe compared physical Canvas positions with logical expected values;
normalizing through the actual root Canvas transform resolves that instrumentation
error. No runtime coordinate change or visual baseline rewrite was needed.
Fresh installed100auto+24direction cases include ordinary direct Text (not a custom
sizing wrapper), draw geometry, empty margin misses, strict consumer types and
230inputs. Tarball SHA256
`a5bb0c2a7efc7522d715f195a3e0ab19b2072231d6a126873c92325311dd9f3b`.
Types/lint/docs109RED/JSDoc/catalog/303-case provenance pass. Source URL
http://127.0.0.1:5192/#/examples/layout/wasm-yoga-migration:
Next section18times selects measured Text. Corpus303=209matches+94classified.
Fixed33 stays5complete/11experimental/8partial/8missing/1excluded, all7gates open.
Auto-margin remains partial. Consolidate103–105 after105; final whole-codebase
review stays at full program end. No Node24 aggregate trust claim.

## Delivered measured custom primitive cross-auto sizing (slice 105)

Direct primitives with both pure measurement providers now admit automatic height
and cross-auto margins in finite nowrap rows at declared numeric width, without
aspect/query sizing. The eight-job example changes width80→40, height20→40,
top80→60; sibling position, focus, hit targeting and native identity follow.
Stable descriptors retain paint-only reuse. Missing providers and unsupported
shapes retain diagnostics; final-width failure restores ownership before paint
and allows clean remount. Existing cache invalidation and native v5 are unchanged.

Source/built two-case replay passes, built469 inputs; installed102auto+24direction
cases pass with strict Bundler/NodeNext types and230 inputs. Tarball SHA256
`23c6cfb61f293b8dc0a4d52194fd57f9d5847ca5dfd8b87b0c3d2f32a50bcf33`.
Corpus305=211matches+94classified; custom callbacks explicitly model eight jobs.
Focused custom-provider checks pass3/384skipped, including six unsupported
shapes and required final-width failure/remount cleanup. Types/lint, docs109RED,
JSDoc, catalog and305-case native provenance pass. Scoped review found no material
issue. Source comparison URL:
http://127.0.0.1:5192/#/examples/layout/wasm-yoga-migration — Next section19times.
Auto-margin remains partial; fixed33 counts5complete/11experimental/8partial/
8missing/1excluded and all7gates open. No Node24 aggregate trust claim.

### Consolidation 35 completed for delivery slices 103–105

Separate103 `d8e5bf09`,104 `9c974fe1`,105 `931ecc2f`. Fresh combined11-file
Chromium verification passes486tests/9skips495 in77.74s. Ordinary mode passes
169tests/326skips495 in2.88s (9files pass/2skip). This covers public layout,
Text auto basis/minimum, measurement purity, structural card, paint reuse,
Flex/box/measurement/length internals and native loader. Expected negative-case
diagnostics are asserted; no test failures. Logs:
`/tmp/pibbl-consolidation35-focused.txt` and
`/tmp/pibbl-consolidation35-normal.txt`.

Reuse slice105 source/built2 custom cases, built469 inputs, installed102auto+
24direction cases/230inputs/strict types,305native records211matches94classified,
scoped no-material-finding review and fresh docs/JSDoc/catalog/types/lint receipts.
Native v5 remains68649bytes; no new native test or binary change claimed.
Node26.9.0/pnpm11.21.0deps/Chromium/macOSarm64; no Node24 aggregate trust or
controlled wall-clock performance claim. Fixed33 counts remain5complete,
11experimental,8partial,8missing,1excluded; all7gates remain open.

## Delivered measured built-in Flex owner cross-auto sizing (slice 106)

A direct finite numeric-width LTR wrapped-row Flex owner with automatic height
may absorb a cross-auto margin inside a finite nowrap row. Existing bounded
pure measurement of direct numeric Rectangles determines height; unsupported
intrinsic content fails even under stretch. Width160→90 changes height60→90,
top60→30 in a120px row; following40px target moves x160→90. No new API, native
protocol or measurement cache. Pure intrinsic auto-margin owners remain deferred.

Public RED fails at the expected admission guard; final focused13tests pass/
376skipped389, including required-measurement failure under stretch and prior
intrinsic/provider exclusions. Public pixels, focus preservation, old/new leaf
and sibling hits, native identity and exact cleanup pass. Sibling paint reuses
native solves and nodes but retains one pure owner measurement per preparation;
wrapped owner snapshot caching remains open rather than silently weakening input
invalidation. Source/built2 native matches, built469inputs, cleanup0/errors[].
Installed104auto+24direction cases pass with230distinputs/strict Bundler/NodeNext,
SHA256 `1db87522d93b2727c2a527546a5d9710d7819666d18bed9c4186769822d830d9`.
Native corpus307=213matches+94classified; both owner records contain actual
nested Yoga nodes/boxes. Fresh types/lint/docs109RED/JSDoc/catalog/provenance pass;
scoped review found no material issue. Native v5/68649bytes unchanged.

Source: http://127.0.0.1:5192/#/examples/layout/wasm-yoga-migration — Next section20times.
Fixed33 counts5complete/11experimental/8partial/8missing/1excluded; auto-margin
remains partial and all7gates open. Node26.9.0/pnpm11.21.0deps/Chromium; no Node24
aggregate trust or controlled wall-clock performance claim.

## Delivered automatic-width Text cross-auto sizing (slice 107)

Direct generic wrapped Text may omit width or use auto in a finite nowrap row
with automatic height/cross-auto margins, automatic basis, zero grow, positive
shrink and no main min/max/query/aspect. Existing natural basis and final-width
measurement determine placement. Row140→100 with40px sibling changes one line at
y90 to two at y80/90; actual Canvas font metrics define natural width.
No new API, cache, native protocol or font-parity fixture is added.

Public RED fails the intended admission guard; final18focused tests pass/
378skipped396, including explicit auto width and five excluded main-size forms.
Actual natural-basis pixels, draw lines, old/new hits, focus, native identity and
cleanup pass. Sibling paint reuses native solves/nodes and retains exactly one
existing automatic-minimum request per preparation; no zero-query promise.
Source/built Text controls replay passes (including earlier minimum/frozen modes),
built469inputs, cleanup0/errors[]. Studio draw/pixel instrumentation uses the
actual root transform; physical host scaling is not a layout difference.
Installed automatic-width Text receipt and104auto+24direction cases pass with
230distinputs, strict Bundler/NodeNext, SHA256
`df10892855c78fcd32c0a7aaa228f4b60f20b4e6d2bf3a874847f93e66be7a05`.
Fresh types/lint/docs109RED/JSDoc/catalog pass; scoped review no material finding.
Native corpus307=213matches+94classified and v5/68649bytes remain unchanged.

Source: http://127.0.0.1:5192/#/examples/layout/wasm-flex-text — Compare auto margins,
then Toggle comparison width. Fixed33 counts5complete/11experimental/8partial/
8missing/1excluded; auto-margin partial, all7gates open. Node26.9.0, no Node24
aggregate trust or controlled performance claim.

## Delivered wrapped-row measured Text cross-auto sizing (slice 108)

Direct generic wrapped Text at finite numeric declared width may use automatic
height/cross-auto margins in a finite LTR row/wrap container, with automatic basis
and zero grow/shrink. Existing final-width Text measurement precedes native
per-line cross placement. Query/aspect, automatic-width wrapped Text, reverse/RTL/
wrap-reverse, custom/provider/layout-owner and column variants retain diagnostics.
The150×120 public row with10gap, Text80→40 and60×40/60×30 siblings places Text at
y20→10 while B moves x90→50 and C stays at y50. No API, ABI, solver or cache added.

Public RED fails the expected admission guard; final25focused tests pass/
378skipped403. Actual draw lines, empty/old/new targets, focus/native identity,
sibling paint reuse and exact cleanup pass. Six new excluded direction/factor/
basis shapes are explicit. Source/built full Text controls replay passes,
built469inputs/cleanup0/errors[]; switching to the three-item wrapped mode creates
one expected new C node, while width and paint changes preserve those identities.
Installed wrapped Text receipt plus prior automatic-width receipt and104auto+
24direction cases pass,230distinputs and strict Bundler/NodeNext, SHA256
`6ccf53d136422d04d974fa7a34a4356f91298d4f77c6387c85f6b6b632417b4b`.
Fresh types/lint/docs109RED/JSDoc/catalog pass; source styles use the supported
inline object contract. Scoped review reports no material issue. Browser host
metrics define Text behavior; no Yoga font-parity fixture is added. Native
corpus307=213matches+94classified and v5/68649bytes are unchanged.

Source: http://127.0.0.1:5192/#/examples/layout/wasm-flex-text — Compare auto margins,
Toggle wrapping, then Toggle comparison width. Fixed33 counts5complete/
11experimental/8partial/8missing/1excluded; auto-margin partial, all7gates open.
Node26.9.0, no Node24 aggregate trust or controlled performance claim.

### Consolidation 36 completed for delivery slices 106–108

Separate106 `33832012`,107 `7b599250`,108 `35eef93b`. Fresh combined11-file
Chromium verification passes502tests/9skips511 in77.98s. Ordinary mode passes
169tests/342skips511 in2.88s (9files pass/2skip). This covers public layout,
Text auto basis/minimum, measurement purity, structural card, paint reuse,
Flex/box/measurement/length internals and native loader. Expected negative-case
diagnostics are asserted; no failures. Logs:
`/tmp/pibbl-consolidation36-focused.txt` and
`/tmp/pibbl-consolidation36-normal.txt`.

Reuse fresh108 source/built full Text controls proof (built469inputs), installed
wrapped/automatic-width Text receipts and104auto+24direction cases/230inputs/
strict types, scoped no-material-finding reviews and docs/JSDoc/catalog/types/lint.
Corpus307=213matches+94classified and native v5/68649bytes unchanged. No new
native unit run claimed. Node26.9.0/pnpm11.21.0deps/Chromium/macOSarm64; no Node24
aggregate trust or controlled performance claim. Fixed33 counts remain5complete/
11experimental/8partial/8missing/1excluded; all7release gates remain open.

## Delivered source-order Canvas composition evidence (slice 109)

Evidence-only: existing runtime preserves source paint, topmost coordinate target
and source keyboard traversal through finite reversed/RTL Flex, translated Group,
retained Layer and opacity filtering. No production code, public API, native ABI
or binary change. The public100×30 overlap changes keyed A/B world x2/42→42/2→2/42;
B paints last and remains the overlap target. B pointer opt-out preserves paint
while selecting A underneath. Tab/Shift-Tab order and focused keys survive
geometry changes; changed B paint reuses native solves and identities.

Fresh focused3tests pass/401skipped404, plus the normal-build filter ownership
stress test1pass. Reference Canvas direct-alpha composition allows only one RGB
byte for filtered intermediate premultiplication quantization; alpha/geometry/
targets remain exact. No baseline rewrites or manufactured production RED.
Source/built complete wrapped-collection plus composition controls replay passes,
built469inputs; pagehide releases node/arena/measurement/instance ownership to0
and remains inert. Installed composition receipt and prior104auto+24direction
cases pass with245distinputs/strict Bundler/NodeNext. Added public filters import
accounts for the consumer's additional used modules; tarball unchanged at
`6ccf53d136422d04d974fa7a34a4356f91298d4f77c6387c85f6b6b632417b4b`.
Filter-inside-Layer and filter-outside-Layer are independently exercised. Fresh
types/lint/docs109RED/JSDoc/catalog/discovery pass. Scoped audit found the entry's
stated reverse/RTL and Group/Layer/filter evidence complete, with no material gap.

`integration.source-order-canvas` is complete for this preservation contract.
Fixed33 now6complete/11experimental/7partial/8missing/1excluded; all7gates remain
open. Native corpus307=213matches+94classified and v5/68649bytes unchanged.
Node26.9.0; no Node24 aggregate trust or controlled performance claim.
Source: http://127.0.0.1:5192/#/examples/layout/wasm-flex-keyed-wrap — Composition
order, Flip axes, LTR/RTL and B target. The original checkout remains untouched.

## Delivered unrounded logical geometry policy and evidence (slice 110)

The approved design's unrounded logical policy is now explicit in the layout and
Canvas contracts. This is evidence and scenario work, with no production core,
API, native ABI or binary change. Exact native Yoga3.2.1 point scale0 fractions
produce A49.375×10.375 at0,0 and B49.375×12.625 at51.875,0. The corpus is now
308=214matches+94classified; auto104/direction24 families are unchanged.
Positive Yoga point-scale snapping parity is deliberately outside this policy.

Fresh public Flex test1pass/404skipped405; Canvas surface3pass in experimental
and ordinary modes. Fractional fixed viewport101.5×47.25 remains stable across
CSS201.25×100.5→240.75×120.25 and backing302×151→361×180 at ratio1.5. The source
lab preserves identity and reports fractional pointer coordinates. Density1/1.5/2
proof passes large cancelling/negative Group origins and retained Layer edges:
0.125-wide target receives logical1.1875 coordinates and logical focus. The16×
display projection accommodates Chromium's integer native MouseEvent client
coordinates; no antialiased pixel equality or baseline rewrite is used.

Source/private-built rounding comparison passes exact boxes and A/B targets,
469builtinputs, disposal ownership0 and no page errors. Installed245distinput
consumer passes scale0 geometry plus density/pointer/logical-focus and exact
cleanup, strict Bundler/NodeNext; unchanged tarball SHA
`6ccf53d136422d04d974fa7a34a4356f91298d4f77c6387c85f6b6b632417b4b`.
Private scenario test imports its local index because shared node_modules resolves
that private package to the original checkout; application runtime imports remain
public. An exact source marker changed by formatting was restored and replayed.
The lab's added action had a failing public scenario test before implementation;
existing core behavior required no manufactured RED. Scoped evidence review
strengthened logical focus and supports completion of this stated policy.

Fixed33 now7complete/11experimental/7partial/7missing/1excluded; all7gates remain
open. v5/68649byte kernel unchanged. Node26.9.0, pnpm11.21 dependencies, Chromium;
no Node24 aggregate trust or controlled performance claim.
Source: http://127.0.0.1:5192/#/testing/canvas-surface — Show fractional then Resize
fractional. Comparison: http://127.0.0.1:5192/#/examples/layout/wasm-yoga-migration —
Next section21 times for point-scale-zero fractional allocations.

## Delivered real-root loading cancellation/failure cleanup (slice 111)

Evidence-only: no core runtime, public API, native ABI or binary changes. Three
actual Flex→Layer→Flex→Rectangle roots share one held load: two are superseded and
one caller aborts, while an independent prewarm remains live. Before admission,
component/hooks/context/native ownership stay absent and caller listeners detach.
The same cold test walks503, invalid fingerprint and forced compile failure before
one valid retry. Exactly one leaf/hook lifetime mounts, click works, cleanup runs
once and late input stays inert. Nodes/arenas/root instances/measurement caches
return to their exact baseline in the experimental lane. Normal runtime passes the
same observable loading sequence without a native-ownership claim.

Fresh focused18tests/11files pass in both experimental and ordinary modes, including
existing sync winner/stale completion, pre-abort, canvas arbitration and disposed
controller coverage. Isolated installed normal-core pages under `/nested/pibbl`
hold an external asset and abort a real Flex/Layer root, or fail its first load503.
Both assert zero premature component calls, retry to one visible/clickable root,
and leave inert targets on disposal. Failure retry fetches twice; async/sync asset
and payload isolation plus strict Bundler/NodeNext remain checked. Browser errors
are asserted empty. A first fixture lacked normal Flex's required explicit
minimum; adding minWidth0/flexShrink0 corrected the fixture, not readiness timing.
One scheduled frame precedes the pixel observation; no sleep or readiness contract
change was introduced. No fabricated production RED or baseline rewrite.

Existing render/preflight failure and removal/reuse evidence complements this
cold-loading matrix. Scoped audit supports the stated deterministic layout cleanup
contract, not a general performance or GC claim. `integration.deterministic-cleanup`
is complete: fixed33 now8complete/11experimental/6partial/7missing/1excluded;
all7release gates remain open. Native308records/v5/68649bytes unchanged. Normal core
built fresh through generated-asset checks, declaration emission and build-core;
Node26.9.0/Chromium, no Node24 aggregate trust claim.

## Consolidation 37 completed for109–111

Separate slice commits109 `f99a7cdd`,110 `642941bc`,111 `e014ac02`.
Fresh23-file experimental matrix525pass/9skip534 (78.77s), ordinary matrix190pass/
344skip534 (3.72s), Node26.9.0/Chromium. The established11files now include Canvas
surface and all loading/checkpoint tests. Logs:
`/tmp/pibbl-consolidation37-focused-final.txt` and
`/tmp/pibbl-consolidation37-normal-final.txt`.

The first grouped run found a harness-selection failure: the legacy contiguous
Next-case walk included the newly appended rounding section despite excluding
intervening dedicated families. It now excludes that separately tested section;
its exact public Flex test and source/private-built/installed semantic rounding
proof remain intact. No runtime change or baseline rewrite. The corrected full
matrix passes; no further broad rerun is needed without another change or concern.
All7release gates remain open; fixed33 counts stay8complete/11experimental/
6partial/7missing/1excluded. No aggregate Node24 trust/performance claim.

## Delivered nested wrapped percentage cross minima (slice 112)

Evidence-only, with no core runtime/API/ABI/binary change. Two pinned native
Yoga3.2.1 scale0 records use an actual nested row Flex A with two fixed40×20
leaves. Outer200-wide row/wrap height100→160 resolves A minHeight60% to60→96;
C moves y72→108 while inner leaves keep exact geometry and keyed identities.
Source and installed proofs use the actual built-in A, not an opaque wrapper.
A has no painted/hit region of its own; C's geometry and old-point miss/new-point
hit provide public line-height evidence without inventing structural hit boxes.

Fresh focused3pass/403skip406 includes the positive public case and two existing
indefinite/max-only owner rejection boundaries. Height-only resizing reuses main
solves/line formation and updates cross placement. Paint-only native geometry is
reused while the inner automatic row height performs exactly one pure measurement
per preparation; no snapshot cache admission was added. Source/private-built
comparison2matches,469builtinputs, no errors, disposal0; installed245distinput
consumer passes exact leaf/B/C boxes, moved hits, keys, reuse and cleanup plus
strict Bundler/NodeNext. Tarball SHA remains
`6ccf53d136422d04d974fa7a34a4356f91298d4f77c6387c85f6b6b632417b4b`.

Native corpus310=216matches+94classified, auto104/direction24 unchanged. Reproduction,
types/lint/docs109RED/catalog/discovery pass. Scoped changed-evidence review found
no material gap. Initial proof mistakes (native minimum reset order, opaque test
wrapper, main-solve counter expectation and missing packed hook import) were fixed
in the proof before acceptance; no manufactured production RED or baseline rewrite.
The generic contiguous corpus walk excludes this dedicated later section.

`flex.min-max` remains partial: broader reverse/decorated/nested axes and indefinite
owner measurement policy remain open. Fixed33 counts stay8complete/11experimental/
6partial/7missing/1excluded, all7release gates open. Node26.9.0, Chromium; no Node24
aggregate trust claim. Source and built ports5192/5193,
`#/examples/layout/wasm-yoga-migration`: Next section22 times, then Next case. Inspect
fixed inner leaves, C's72→108 position, click old/new positions and Paint only.

## Delivered decorated reversed nested cross minima (slice 113)

Evidence-only: no runtime/API/ABI/binary change. Two pinned Yoga3.2.1 scale0
records use border-box244×144→204, paddingL10/R30/T20/B20 and border2. Content
200×100→160 is the cross-bound basis. In row-reverse/wrap, nested A remains at
132,22 and grows60→96; fixed inner leaves stay at132/172,22 with size40×20.
B stays40,22 and C moves132,94→130. Actual direct built-in A is used throughout.

Fresh focused1pass/406skip407; exact native reproduction, source/private-built
2matches with469builtinputs and no errors/disposal0, plus installed245distinput
strict Bundler/NodeNext proof pass. Old C coordinates miss after resize, new C
coordinates hit, leaves keep keys, height-only updates reuse main solves/lines and
replace cross placement; paint-only geometry reuses with one pure measure. Native
corpus312=218matches+94classified, auto104/direction24 unchanged. Types/lint/docs/
catalog/discovery pass. Matching v5/68649byte kernel and tarball SHA
`6ccf53d136422d04d974fa7a34a4356f91298d4f77c6387c85f6b6b632417b4b` unchanged.

The first packed fixture had a180-high Canvas that constrained the204-high root;
its resulting136-high content correctly produced C y115.6. Matching the240-high
source test surface restored identical constraints and agreement. No percentage
basis policy or runtime change, no Yoga divergence classification or baseline
rewrite was justified. Source/private-built use the same finite fixture geometry.
`flex.min-max` remains partial; all7gates and fixed33 statuses are unchanged.
Node26.9.0/Chromium; no Node24 aggregate trust or performance claim.
Hands-on source/built ports5192/5193, `#/examples/layout/wasm-yoga-migration`:
Next section23 times, then Next case. Inspect reversed world offsets, fixed leaves,
C's94→130 movement, targets and Paint only.

## Delivered definite nested percentage cross maxima (slice 114)

Two pinned scale0 records cap a definite nested height60 by maxHeight25% in the
same decorated row-reverse/wrap owner. Content height100→160 gives A/leaves25→40;
100%-height children consume the settled allocation once. B stays40 high and C
remains at132,74. A formerly empty point136,52 becomes an A1 target after resize.
Fresh focused1pass/407skip408; source/private-built2matches,469builtinputs, no
errors/cleanup0; installed245distinput strict Bundler/NodeNext geometry, keys,
expanded target, native reuse and cleanup pass. Height-only updates preserve main
solves/line formation; paint adds no pure measurement for this definite tree.

Evidence-only, no core/API/ABI/binary change, no fabricated production RED or
baseline rewrite. Native reproduction314=220matches+94classified; auto104 and
direction24 unchanged. Types/lint/docs/catalog/discovery pass. v5/68649bytes and
installed tarball SHA
`6ccf53d136422d04d974fa7a34a4356f91298d4f77c6387c85f6b6b632417b4b` unchanged.
`flex.min-max` remains partial; fixed33 statuses/all7open gates unchanged.
Node26.9.0/Chromium; no Node24 aggregate trust or controlled performance claim.
Hands-on ports5192/5193, `#/examples/layout/wasm-yoga-migration`: Next section24
times then Next case. Inspect taller inner leaves, unchanged C, and new A1 extent.

## [NEXT] Consolidation 38 for112–114

Run the established23-file matrix in experimental and ordinary modes, preserving
exact separate slice commits. Assess the oversized learning fixture corpus:
projection-only extraction would break full public-browser family replay. A
concise public projection plus a private full-corpus testing surface requires a
bounded test-host seam; do not silently drop coverage or relax public-only imports.
Record this assessment before choosing the next capability slice. The full
program's final whole-codebase review remains outstanding until program end.

### Consolidation 24 completed for delivery slices 70–72

Separate70 `b7d5dc68`,71 `ac38f518`,72 `dc4b7d42`. Explicit physical layout
borders,16-case pinned border geometry and finite Flex outer aspect ratios are
implemented with exact bounded contracts. Fresh combined Chromium run:
280passed/1normal-onlyskip in12 layout, native loader and HTML ownership files.
Log `/tmp/pibbl-consolidation24-focused.txt`. Negative-case diagnostic output is
expected; no assertion failures. Source/built border and aspect controls pass;
source/built16-case oracle replay passes with469private built inputs. Packed72
fresh full command passes230installed inputs, explicit editor/Bundler/NodeNext
fields, installed aspect pixels and exact lifecycle cleanup. Native border
reproduction71 and preserved aspect semantic probe72 are independent pinned
receipts. Types/lint/JSDoc/Studio metadata/render/search/coverage pass. Reused
scoped reviews70/72 report no material findings; no duplicate or unchanged review.
No screenshots/baselines rewritten. Kernel65282bytes unchanged. Environment
Node26.9.0/pnpm11.21.0deps/Chromium/Apple C++20; no Node24 full-trust or speed claim.

Fixed33 capabilities:12experimental,9partial,11missing,1deliberate exclusion;
no capability is yet marked complete and all seven release gates remain open.
The next73 specifically targets completion of the finite numeric-gap preserve
entry using its stated exit criteria. Larger Flex sizing/distribution/intrinsic/
direction, full prepared topology/minimal visits, atomic Canvas/hit/focus/HTML,
standalone/framework/Pibbl migrations, Grid, broad pinned corpus, reproducible
performance, Node24 trust and final separate critical review remain outstanding.

### Consolidation 23 completed for delivery slices 67–69

Separate67 `16fe904e`,68 `df3d0974`,69 `9b530832`. Public opt-in border-box
sizing,14-case pinned native corpus and live Studio dependency refresh are
implemented. Fresh bounded Chromium consolidation:272passed/1normal-onlyskip
across12 files: public WASM slice, box/Flex/Grid/Flow/Absolute/Overlay/measurement/
JSX layout, native loader, HTML Layer and focus ownership. This selected suite
is not the same file set as consolidation22; totals are fresh scoped receipts.
Log `/tmp/pibbl-consolidation23-focused.txt`.

Source14-case replay68 and canonical built14-case replay69 pass; built468inputs,
errors[] and exact zero ownership cleanup. Native independent reproduction68,
normal focused cases68, types/lint69 and durable real-server refresh69 pass.
Last packed receipt67:229installed-dist inputs, Bundler/NodeNext explicit
boxSizing declarations, Node geometry and browser lifecycle. No runtime/kernel
change68/69 requires repeating that receipt. Kernel65282bytes/eight native tests
unchanged; no baseline rewritten. Node26.9.0/pnpm11.21.0deps/Chromium, not Node24
full trust. Fixed33 capabilities/seven open gates unchanged. Full Flex/box/RTL/
aspect, intrinsic/providers, participation, prepared topology/minimal visits,
atomic Canvas/hit/focus/HTML publication, standalone/framework/Pibbl migrations,
broad pinned corpus, reproducible performance, Node24 trust and final separate
critical review remain outstanding. The single next slice70 is above.

### Consolidation 22 completed for delivery slices 64–66

Separate64 `f5639a2e`,65 `fcfea332`,66 `6648bf66`. The pinned native Yoga3.2.1
042f5013152eb81c1552dec945b88f7b95ca350f corpus grows from five to twelve classified
finite cases: numeric columns, capped main-axis reversals and three-item wrapped/
cross-reversed lines. Full dimensions/positions, explicit case axes/wrap, compiler
probe hash and the recorded public example agree. Yoga is not bundled at runtime.

Fresh combined Chromium run:273passed/1normal-onlyskip across12 layout, Layer,
ABI and HTML ownership files. Native generation plus independent no-write
reproduction and recorded/embedded checks pass. Final source/built Studio replays
all twelve fixtures with correct identities/gap misses, zero errors and cleanup;
built467private inputs. Visual inspection confirms readable matching panels; no
baseline changes. Types/lint clean. Runtime/kernel/package unchanged throughout
64–66, so the last packed228Bundler/NodeNext/lifecycle receipt is64, not repeated
unchanged65/66 evidence. Logs `/tmp/pibbl-consolidation22-focused.txt` and
`/tmp/pibbl-slice64-*` through66; Node26.9.0/pnpm11.21.0deps/Chromium/Apple C++20.
No Node24 trust, speed or broad parity claim.

The fixed33 capabilities and all seven open gates remain unchanged. Twelve exact
cases improve the corpus but do not close Flex/box/RTL/aspect, intrinsic providers/
feedback, participation, full prepared topology/minimal visits, matching atomic
Canvas/hit/focus/HTML publication, standalone/framework/Pibbl migrations, broad
Yoga matrix or implicit/intrinsic Grid. Reproducible kernel/host/full-app timing,
inert/tree-shaking evidence, Node24 trust and final separate critical review remain
cross-cutting exits. Exactly one next67 defines and implements coherent boxSizing;
current content-box default must remain stable and stroke is not a layout border.

### Consolidation 21 completed for delivery slices 61–63

Separate61 `a3ef3378`,62 `4f358f70`,63 `440f7c32`. Pure described Layer children
use the returned primitive receiver/sizing; known Flow and fixed-row Grid can
contribute automatic heights at settled nowrap-column widths. Intrinsic measure
uses existing host hooks; native mounted Flow/Grid placement is unchanged.

Fresh combined Chromium run:270passed/1normal-onlyskip across12 prepared layout,
Layer, ABI and HTML ownership files. It includes described default/constrained
Layers, Flow max-width wrapping and Grid fractional-row rejection. Source/built
225public-input replays and packed228installed-input Bundler/NodeNext/lifecycle
pass on the final artifact. Normal focused58Flex/Flow and52Flex/Grid tests pass;
types/lint clean. Kernel65282bytes/8native tests unchanged. Logs
`/tmp/pibbl-consolidation21-focused.txt` and `/tmp/pibbl-slice61-*` through63;
Node26.9.0/pnpm11.21.0deps/Chromium, no Node24 aggregate trust claim.

All seven gates remain open with the same33-capability denominator and complete
remaining-gates table above. Remaining intrinsic limits include indefinite Grid
fraction/percentage rows, intrinsic wrapped Flex, arbitrary opaque providers,
feedback and full graph/minimal-visit evidence. The new imports from Flex to Flow/
Grid require eventual dedicated inert-import/tree-shaking evidence; no bundle-size
claim is inferred from these correctness receipts. Box/RTL/aspect, participation,
matching transactional publication, standalone/framework/Pibbl migrations, broad
pinned Yoga corpus, implicit/intrinsic Grid, reproducible performance, Node24 trust
and final critical review remain. Exactly one next64 extends native pinned Yoga
column comparisons for already supported behavior; it closes no gate by itself.

### Consolidation 20 completed for delivery slices 58–60

Separate58 `edcf60a6`,59 `d7649a75`,60 `c90df382`; focused59 correctness follow-up
`ab2adb72`. Absolute adds a host structural plan; Layer admits registered known
roots across its raster boundary, retains nested boundary/numeric ownership, uses
actual nested raster dimensions and routes direct child invalidation through the
owning preparation boundary. Host structural planning adds no numeric arena.

Fresh combined Chromium run:263passed/1normal-onlyskip across12 layout, Layer, ABI
and HTML ownership files. It includes both nested59 regressions and direct/opaque60
cases. Source/built225public-input replays, rebuilt Layer/Grid replay, and packed228
installed-input Bundler/NodeNext/lifecycle pass on code containing both59 fixes.
Normal57Layer/HTML tests pass; types/lint clean. The65282byte/8native-test compiled
kernel is unchanged by58–60. Logs `/tmp/pibbl-consolidation20-focused.txt` and
`/tmp/pibbl-slice60-*`; Node26.9.0/pnpm11.21.0deps/Chromium, no Node24 trust claim.

The fixed33-capability/seven-gate ledger is reconciled but all gates remain open.
The complete remaining-gates table above still applies: Flex semantics, box/RTL/
aspect matrix, intrinsic providers/baselines, placement/participation, complete
prepared topology/minimal visits and matching Canvas/hit/focus/HTML publication,
standalone/framework/Pibbl migration and classified pinned Yoga corpus, plus Grid
implicit/intrinsic target. Reproducible kernel/host/full-app performance, Node24
trust and final separate critical review remain cross-cutting exits. Known-root
preparation is not arbitrary component pre-execution or broad Yoga parity.
Exactly one next outcome61 admits pure described Layer children using proven root
receiver/geometry, while ordinary functions remain opaque.

### Consolidation 19 completed for delivery slices 55–57

Separate commits55 `1510efe3`,56 `cf2c7bc5`,57 `bf03d14f`. Known Grid and Flow
roots adopt their existing native plans; Overlay stages aligned host placements
and owns a structural slot with no numeric arena. This distinction is recorded in
the fixed33-capability manifest. No gate closes: all seven remain open.

Fresh bounded Chromium combined run:209passed/1normal-onlyskip across11 layout,
ABI and HTML ownership files. Slice57 normal11passed/75experimental skips;
source/built225public inputs and packed228installed inputs pass. Types/lint clean.
The compiler-produced65282byte/8native-test kernel is unchanged by55–57; no fresh
native compilation was necessary. Node26.9.0/pnpm11.21.0deps/Chromium, no Node24
aggregate trust result. Logs `/tmp/pibbl-consolidation19-focused.txt` and
`/tmp/pibbl-slice57-*`.

The complete remaining seven-gate table at the top remains applicable: Flex and
box/direction matrices, intrinsic/provider constraints, placement/participation,
all-family prepared ownership and matching Canvas/hit/focus/HTML publication,
standalone/framework and Pibbl migration plus classified pinned Yoga corpus,
and Grid implicit/intrinsic target remain incomplete. Reproducible kernel/host/
whole-app performance, Node24 trust and final separate critical review remain
cross-cutting exits. Five pinned Yoga fixtures do not establish broad parity.
The single next outcome58 is arena-free nested Absolute preparation; ordinary
opaque components, Layer's broader family boundary and atomic publication remain
explicit subsequent gaps, not silently included in this slice.

### Consolidation 18 completed for delivery slices 52–54

Separate commits52 `b5381e0d`,53 `aaa7ddcb`,54 `773da7b9`. The native arena now
resolves explicit Grid tracks/areas and measured Flow line/wrap placement. It keeps
one root-owned instance, isolated generational storage, owned numeric-only caches
and exact teardown. Forced memory-growth RED→green caught and fixed a detached
track-result view before cached publication. No application API/scheduler change.

One bounded combined Chromium run passes198tests/1normal-onlyskip across ten
prepared/native layout, ABI and HTML ownership files. Native8tests pass; final
compiler-produced binary65282bytes. Types/lint pass. Normal focused31pass/
71experimental skips. Packed228installed-input Bundler/NodeNext/lifecycle pass.
All native Grid tracks/spans and Flow source/built Studio proofs pass against this
final artifact,225public inputs per lane, cache-work counts and cleanup0/0/0/0.
Logs `/tmp/pibbl-consolidation18-*` and `/tmp/pibbl-slice52-*` through54.
Node26.9.0/pnpm11.21.0deps/Chromium; no Node24/full trust/parity/performance claim.

The ledger credits these native numeric subsets. Still missing: Grid child
measurement/alignment adoption, native Absolute/Overlay, complete cross-family
prepared root graph and batched topology/minimal visits, matching staged Canvas/
hit/focus/HTML publication, the remaining33-capability semantics, classified Yoga
matrix, standalone package/two migrations, performance and final trust/review.
The seven-gate table in consolidation17 remains the explicit exit list; no gate
closes, no capability denominator changes, and the pinned Yoga corpus stays5cases.
Known Grid-root preflight/adoption is the single next prerequisite55.

### Consolidation 17 completed for delivery slices 49–51

Separate commits49 `d6f12813`,50 `c8b163aa`,51 `7ea95367`. One bounded combined
Chromium run passes187tests/1normal-onlyskip across nine layout/HTML files. Normal
Grid/Flow/structural checks49pass/70experimental skips, types/lint clean. Installed
packed228-input Bundler/NodeNext and structural lifecycle pass. Source/built Studio
Layer/Grid/Flow receipts each225public inputs verify failure isolation, recovery
pixels/targets and cleanup0/0/0/0. Matching59181-byte kernel unchanged. Logs
`/tmp/pibbl-consolidation17-*` and `/tmp/pibbl-slice49-*` through51. Node26.9.0/
pnpm11.21.0deps/Chromium; no Node24/full trust or broad parity/performance claim.

The ledger credits bounded Layer allocation-to-raster adoption and Grid/Flow entry
preparation, not native Grid/Flow solving or complete root topology. Remaining
publication blockers are concrete: all-family staged geometry before traversal;
nonthrowing matching Canvas paint/hit/focus/HTML adoption; fallible publication
preflight beyond known Flex and finite HTML projections. Ordinary opaque boundaries
and unprepared outer siblings are still outside these bounded preparations.

All seven release gates remain open:

| Gate                    | Concrete remaining work                                                                                                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flex core               | Complete pinned Yoga matrix for nested percentages, fractional/huge factors, distribution/negative free space, min/max, automatic minimum and wrapping.                                             |
| Box/direction           | Percentage/logical/auto margins and padding, layout border/box sizing, aspect ratio, horizontal RTL/edge precedence.                                                                                |
| Measurement/intrinsic   | Prepared cross-family constraint feedback, nested wrap, baselines, custom-leaf protocol/counts/errors and overflow sizing.                                                                          |
| Placement/participation | Relative/static/absolute/containing-block matrix and hidden/contents identity/event/clip behavior.                                                                                                  |
| Reactivity/publication  | Complete role-aware graph/batched topology/minimal visits, the three publication blockers above, cache equivalence and failure/cancellation stress.                                                 |
| Migration/conformance   | Standalone package/no Canvas import, both real migration rehearsals, classified pinned conversions, rounding/DPR matrix, reproducible kernel/JS/full-app performance and Node24 trust/final review. |
| Grid beyond Yoga        | Native explicit track foothold next; complete spans/intrinsic/fraction/minmax/percentage behavior, implicit/auto/dense/sparse tracks and intrinsic vocabulary remain.                               |

The fixed33-capability denominator and five pinned Yoga cases are unchanged.

### Consolidation 16 completed for delivery slices 46–48

Separate deliveries46 `242cba11`,47 `9a7b1b0a`,48 `cb863bc2`. One bounded combined
Chromium run passes146tests/1normal-onlyskip across prepared Flex, Absolute, normal
Flex, structural Card and HTML geometry/focus/ownership. Types/lint and packed228
installed-input Bundler/NodeNext/lifecycle checks pass. Source/built HTML Studio
replays each pass with225public inputs; existing described/direct/nested source
controls also pass recovery, targeting and shared cleanup0/0/0/0. Logs
`/tmp/pibbl-consolidation16-*` and `/tmp/pibbl-slice48-*`. Kernel59181bytes unchanged.
Node26.9.0/pnpm11.21.0deps/Chromium; no Node24/full trust claim.

The ledger credits described/direct Flex preparation and bounded root-wide HTML
numeric preflight. Complete all-family graph/topology/minimal visits and matching
Canvas/event/focus/HTML adoption remain missing. All seven gates stay open; five
pinned Yoga cases remain the only classified oracle cases. No baseline changes.

### Consolidation 15 completed for delivery slices 43–45

Separate commits:43 `6b8fffd0`, its focused public-lab cleanup/watching correction
`ae71a179`,44 `2c68833e`,45 `3e0d3a2b`. One root-owned native instance remains
the mutable boundary. Known Absolute→Flex and direct nested built-in Flex regions
now prepare receiver inputs and demanded geometry before opaque descendants, then
actual rendering adopts the same plans/regions. There is one existing solver,
transaction and scheduler; ordinary application components are not discovered by
speculative evaluation. No screenshot/baseline or public API change.

The fixed33-capability/seven-gate ledger now credits slice42's root instance and
generational region ownership, plus43–45's bounded input/geometry preparation and
independent-root failure evidence. Transactional publication moves from missing
to an explicitly experimental foundation. Full graph, minimal visits, all-family
staging and matching nonthrowing event/focus/HTML publication remain missing;
no gate closes. Five pinned Yoga fixtures remain the only classified oracle cases.

Fresh final focused119experimental pass/1normal-onlyskip; normal57pass/63skips.
Types/lint/public export parity pass. Source/built Studio fault/recovery/root
cleanup use225public inputs; packed228-input strict Bundler/NodeNext and structural
lifecycle pass. Binary stays59181bytes, unchanged from42; no fresh native rebuild
or performance claim is needed for these host-only slices. Focused read-only
reviews found no material issue in the changed runtime paths. Node26.9.0/pnpm11.21.0
deps/Chromium remains the verified environment; Node24/full trust and final
whole-codebase review are outstanding. At this dated consolidation checkpoint, the next slice was46; the current selected slice is listed in the top checkpoint and single [NEXT] heading.

### Consolidation 14 completed for delivery slices 40–42

Separate commits:40 `69fcb3a6`,41 `e868fafe`,42 `b56241f9`. Main-axis and
cross-line reversal now use the shared kernel while preserving source traversal,
identity, paint/hit priority and normal-lane diagnostics. Slice42 changes mutable
ownership from per-region instances to root-owned instances with independent
generational native regions; it does not merge their caches or line records.

The fixed denominator remains33capabilities/seven release gates, all seven open.
These deliveries strengthen flex-core, box/direction and reactivity foundations;
none completes a gate. Five pinned Yoga fixtures remain the only classified oracle
cases. Source/built geometry, hits, placement-only work and cleanup passed for the
reverse controls; five native tests and the source/built managed-Layer lifecycle
passed for shared ownership. Latest packed227-input consumer and strict Bundler/
NodeNext checks pass. No changed screenshots/baselines or performance-parity claims.

Node26.9.0 remains the local verification environment; Node24/full trust, full
prepared graph/atomic publication, remaining measurement/Flex/Grid semantics,
standalone package/default-engine migration, both full migration rehearsals and
reproducible performance gates remain outstanding. Continue within that accepted
scope; source/built ports5192/5193 remain available.

### Consolidation 13 completed for delivery slices 37–39

Separate slice commits:37 `2106fcc9`,38 `cc11a8dd`,39 `fb83e2b8`. The pinned
Yoga corpus expands3→5 cases, and the existing physical-margin capability moves
from absent to experimental numeric nowrap/wrapped support. No release-gate group
is complete, no exclusion changes, and no extra capability was invented.

One kernel remains responsible for allocation/line formation/main/cross placement.
The private10-f64 records separate signed margins from nonnegative padding/bounds;
JS prepares receiver-owned styles and publishes returned border boxes. Numeric
margin validation is shared; explicit per-side calls preserve allocation discipline.
The normal solver is retained intentionally until the accepted all-family adoption
gate; it rejects new margin behavior. There is no new scheduler, event system,
retained draw graph or duplicate subscriptions. Review's negative intrinsic-size
finding is fixed by its red/green public regression.

Fresh combined evidence reuses unchanged95experimental checks, normal42pass/5skip,
typecheck/lint, source/built margin/Text/cache/cleanup probes and matching57438-byte
artifact. A new built migration replay passes all5pinned cases with466private dist
inputs and cleanup0/0/0. Recorded oracle/probe hash and source fingerprint checks,
and catalog166lessons/12snapshots/33labs pass. Packed strict margin declarations/
227-input lifecycle evidence was obtained at slice38 with the same10-slot ABI;
slice39's changed wrap arithmetic is covered in current source/built public checks.
Do not misreport that earlier packed binary as a fresh39 tarball run.
Logs `/tmp/pibbl-consolidation13-*` plus slice38/39 receipts. Node26.9.0/pnpm11.21.0
dependencies/Chromium; compiler pinned Rust1.99.0, native Yoga Appleclang21.0.0.
No full trust, Node24, broad Yoga parity or comparative speed claim. Exactly one
next delivery remains40 in the existing reverse-direction capability.

### Consolidation 12 completed for delivery slices 34–36

Slices34 (`86e68112` plus public proof `0f8d17a3`),35 (`09d46791`) and36
(`818ecb6a`) remain separate commits. Catalog debt is separate `ce2ee87a`.
One private predicate shares empty-Rectangle eligibility; only finite direct
allocation admits percentages, while intrinsic measurement stays conservative.
There is no new subscription, geometry cache, graph, public selector or scheduler.
The policy is zero content minimum with outer padding floors, explicit minima and
existing shrink/overflow behavior preserved.

Combined fresh evidence is the unchanged 90 experimental checks, default39pass/
39skip, root typecheck/scoped lint/private build, and actual source/built public
percentage-target/Text/frozen-cache/cleanup probes. No duplicate broad rerun was
needed. Catalog validates166lessons/12snapshots/33labs after the prior authoring
repair. Logs use `/tmp/pibbl-slice36-*` and
`/tmp/pibbl-consolidation12-catalog.txt`. No Node24, full trust or comparative speed
claim is made. The finite exit checklist above replaces overlapping forecasts.
At this historical checkpoint, the next slice was37, pinned Yoga conversions, with original scope
and explicit deferrals preserved.

### Consolidation 11 completed for delivery slices 31–33

Slices 31, 32 and 33 remain separate commits (`2ff1a34f`, `ff0a267a`,
`84fec328`). The bounded preparation path shares the existing transaction cache,
receiver tokens, measurement cycle guard and wrapper lifecycle; no parallel graph,
scheduler or retained geometry system was introduced. Cycle-source metadata fixes
clone identity rather than adding a second recursion mechanism. Focused review
found no material issues; direct public regressions additionally established
receiver provision ownership and shared-root cycle rejection.

The unchanged combined checks are 85 experimental tests and 16 normal tests
(5 experimental skips), typecheck, scoped lint, source/built structural browser
receipts and cleanup. A fresh installed tarball structural run passes strict
Bundler/NodeNext consumers, 227 installed dist inputs, zero sync external downloads,
footer movement, both Card descriptions, keyed restore and exact teardown.
`/tmp/pibbl-consolidation11-packed.txt` records its digest and result. Exact
source/built/editor public export parity and public JSDoc checks pass. Source
fixture discovery passes. Full catalog validation currently fails on the earlier
`wasm-flex-text` frozen descriptor authoring rule (inline object props/styles);
this is recorded as an outstanding catalog gate, not a successful aggregate check.
Environment remains Node 26.9.0 / pnpm 11.21.0 dependencies / Chromium.

Catalog integration follow-up: normal inline style objects are frozen immediately
before their props/descriptors, preserving the same immutable authoring contract
without relaxing the catalog validator. The generated scenario index was refreshed.
Catalog validation passes for 166 lessons, 12 snapshots and 33 labs. Seven focused
public paint-reuse/Text-basis checks pass; root typecheck passes.
Logs `/tmp/pibbl-consolidation11-{catalog-fix,frozen-fix}.txt`.

The capability manifest records only bounded nested Card evidence. General graph,
transactional publication, provider/intrinsic rules, Flex/Grid coverage, pinned
Yoga conversion and release/performance gates remain open. At consolidation time, the selected next
slice was 34; no per-slice approval pause is required.

Current acceptance gaps remain broader than loading: general automatic minimum and
intrinsic sizing rules, structural component preparation, root-wide prepared graph
and transactional geometry, remaining Flex semantics, Grid/other layout families,
pinned Yoga conformance, and comparative performance/release gates. The proposal's
content-based automatic minimum is the target; the experimental explicit-minimum
subset is not equivalent. Implement specified min-content behavior with migration
examples before default adoption. Prototype a real reusable Card before freezing
`defineLayoutComponent` or an alternative structural capability; ordinary opaque
components must still execute once after allocation. Keep the normal JS solver
until conformance, migration and performance exits have evidence. None of these
future API choices blocks slice 28 or reopens the accepted async/sync mount contract.

Fresh focused receipts (macOS, Node 26.9.0, installed pnpm 11.21.0 dependencies,
Playwright Chromium, 2026-10-22): combined loading/host/sandbox/navigation/import
suite 15 files / 30 tests passed; WASM layout/roles/import suite 5 files / 86 tests
passed; normal catalog consumer suite 5 files / 344 tests passed; named component
contract tools 8 tests passed. Clean core build and isolated packed consumer passed,
including strict Bundler/NodeNext types, nested-base asset fetching and async-only
embedded-payload exclusion. Direct repository TypeScript check passed after linking the already-installed
website dependencies into the isolated checkout; no aggregate trust/Node 24 result
is claimed.

The coordinator independently used Chromium to inspect source pixels and interact
again after the final source reload, explicitly bringing the Canvas into view:
width 560→320, stable nodeCreates=3, paint changed text color while solves=3 and
measuredLeaves=8 remained unchanged, with no page errors. Screenshot:
`/tmp/pibbl-integration-clean-visible-20261022.png`. This is browser evidence, not a
Mac-native view claim. Source feedback URL:
`http://127.0.0.1:5192/#/examples/layout/wasm-flex-text`; built feedback URL uses
port 5193. The small heading control waits until workspace startup and jumps to the preview
panel. The first-frame browser probes explicitly reveal the iframe before waiting
for diagnostics; offscreen iframe animation throttling is not evidence of a mount
or scheduler failure. A built nested
interaction probe overlapped server/config updates and reported a footer-hit
mismatch; preserve its assertion and require a fresh stable-server replay before
calling that browser lane verified. Linked dependency asset 403s are addressed by
Vite allowing only this workspace's resolved dependency directory, retaining strict
filesystem checks. The base-aware exact asset allowlist has a failing-then-passing
regression; arbitrary suffix paths remain rejected.

Primary backup receipts live at `/tmp/pibbl-integration-*-20261022.*`; the additional
pre-reconciliation archive is `/tmp/pibbl-integration-before-reconcile-20261022.tar.gz`.
The primary checkout is untouched. This checkpoint excludes its unrelated website,
brand, broad documentation and private-harness formatting changes. Their originals
remain there and in the saved archive. This is a runnable integration checkpoint,
not completion of the full layout-engine proposal.

Authorized 2026-10-21. Starting points: [proposal](layout-engine-rework-proposal.md)
and its four linked research/design documents. This is experimental work, not a
replacement of current shipped layout contracts or a feature-complete engine.

## Scope and execution

Single implementation owner; preserve existing unrelated edits. Work stays in
this checkout because no repository instruction requires isolation and the local
proposal is untracked. No publication or external deployment.

Exactly one next slice is selected. Continue independent, reversible extensions
while gathering feedback; pause only dependent consequential choices. Consolidate
after three delivered slices, before five.

## [DONE] First feedback delivery: signal-driven WASM Flex/Text

Smallest observable outcome: ordinary public Flex and Text run in an explicit
experimental Studio build, width changes schedule normally, and wrapped Text gets
the height required at its final allocated width. Existing production lane stays
available separately; no per-component engine selector or hidden fallback.

Acceptance:

- Focused failing final-width geometry regression precedes production edits.
- Finite huge shrink factors terminate with finite geometry.
- A signal changes row width; nested definite Flex regions use WASM allocation.
- Numeric records survive updates; fill changes reuse solve/measurement results.
- Arena ownership ends deterministically at component/root teardown.
- Runnable Studio example has width/paint controls and diagnostic counters.
- Focused geometry/public scenario tests and type checking pass; Studio stays up.

Known initial bounds: row/column nowrap, existing finite box/minimum semantics;
no new intrinsic component protocol, Grid, Yoga parity, Layers ordering amendment,
or standalone package. No speed claim. Keep all unsupported experimental cases
visible. Broader conformance and release gates follow feedback.

## [DONE] Second feedback delivery: reactive paragraph content and computed width

Delivered independently of outstanding first-experience feedback. Extend this same public
example with signal-valued paragraph text and a computed width that can switch
source dependencies. Acceptance: changed text updates paint and measurement in the
normal scheduler; equal computed results schedule no layout/paint; removed dynamic
dependencies stop scheduling; existing numeric identities and teardown stay intact.
Resolve implementation from working evidence, without prebuilding a role-mask
framework or committing to the eventual prepared-tree API.

## [DONE] Third feedback delivery: keyed paragraph lifecycle and reorder

Delivered. Smallest outcome: one interactive public composition can reorder, remove, and
restore keyed paragraph leaves while retaining surviving numeric identities and
releasing removed ownership. Use ordinary public JSX/signals, not a new prepared
component API. Acceptance: reorder creates no replacement nodes; removal decrements
active nodes and detaches removed input dependencies; restore creates only the
removed node; paint/hit order follows source; root disposal returns counts to
baseline. Add one focused failing regression before a runtime fix if needed.

This will be the third delivered slice. Assess and perform bounded consolidation
of all three immediately afterward, before selecting a fourth related slice.

## [DONE] Bounded consolidation of slices 1–3

Completed before further capability expansion. Exercise width, text, computed
source switching, keyed lifecycle and paint together. Review changed integration
for scheduler/receiver ownership, cache validity, numeric lifecycle, public API and
cleanup. Remove introduced duplication/scaffolding, update contracts/examples and
records, then run proportional combined regressions. No new layout capabilities,
public API family, broad benchmark platform, or aggregate trust gate in this step.
Report findings/fixes and select one next slice only after this milestone passes.

## [DONE] Fourth feedback delivery: column Text measurement at final constrained width

Smallest outcome: a public nowrap column containing wrapped Text with an automatic
main-axis basis and constrained cross-axis width allocates the Text height required
by that final width. A signal-controlled width cap visibly reflows the following
sibling in the same scheduled frame. Keep the existing row and keyed controls.

Acceptance: add one focused failing semantic geometry regression first; measure at
the final used cross width before allocating main-axis auto basis; preserve explicit
minimums, finite bounds, node reuse, paint/hit agreement and teardown. No new public
API, general prepared-tree protocol or scheduler change. Provide the exact Studio
interaction and focused checks before broader edge cases. This is a closely related
fourth slice after the completed consolidation, not full Flex/Yoga parity.

## [DONE] Fifth feedback delivery: WASM nowrap cross-axis placement

Smallest outcome: the private WASM region also computes final nowrap item
cross-axis stretch/alignment and offsets, while public Flex geometry and all four
slice interactions remain unchanged. Expose a placement-work counter in the
existing experimental inspector, including zero new placement work on paint-only
updates. Preserve synchronous host Text measurement and final-width ordering.

Acceptance: one focused failing geometry/placement-counter test first; retain
source paint order, min/max/padding semantics, stable numeric identity, cache reuse,
finite results, and deterministic teardown in both row and column scenarios. Use
the same private region and public API, no general graph/ABI/package expansion.
Run focused geometry/parity and exact public-scenario checks; no speed claim.

Group two delivered column Text, WASM cross placement and WASM main placement.
Its bounded consolidation is recorded below.
The previous three-slice consolidation is complete; this is not a release gate.

## [DONE] Sixth feedback delivery: WASM nowrap main-axis placement offsets

Smallest outcome: extend the same private region to calculate nowrap main-axis
item offsets from allocated sizes, gap and existing `justifyContent`, completing
numeric nowrap placement without changing public Flex authoring. Provide a public
Studio distribution interaction and a main-placement work counter; paint-only
updates must skip both placement operations and measurements.

Acceptance: one focused failing geometry/counter regression first; preserve all
existing justification modes and their negative-free-space fallbacks, f64 logical
coordinates, source paint/input order, bounds, node reuse and teardown. Retain the
existing Text measurement ordering and exact row/column examples. No new public
selector/API, general graph or package extraction. Use focused native/Chromium and
normal-lane geometry evidence; no timing or full-parity claim.

This was the third slice of group two; bounded consolidation completed below.

## Decision log

- 2026-10-21: Inspect Taffy 0.15.0 before selecting first kernel. Its source uses
  f32 geometry and Flex arithmetic; use a small owned f64 allocator for the bounded
  slice. Full solver reuse remains open, rather than silently downcasting JS units.
- Preserve the existing public Flex signature; experimental lane is build-scoped.

## Evidence / session log

- Initial checkout inspected: unrelated edits in plan index, drag/drop example,
  sandbox runner/assets and website tooling/tests. Preserved.
- Rust absent from host PATH; pinned Rust 1.99.0 plus wasm32 installed under /tmp,
  leaving shell/user configuration unchanged.

- First feedback delivery: http://127.0.0.1:5187/#/examples/layout/wasm-flex-text
  (Studio left running, Vite process in the implementation session).
- Focused WASM Chromium suite: 6 passed. Production Flex + CSS oracle + slice
  suite: 45 passed, 3 experimental-only tests skipped.
- Core build, root typecheck, targeted ESLint, native Rust huge-factor test,
  artifact fingerprint validation, and built Node import passed on Node 26.9.0,
  pnpm 11.21.0, Rust 1.99.0, Chromium. The documented Node 24 executable was not
  present; no aggregate trust or release claim.
- One focused reviewer found detached views after WASM growth, failed-revision
  cache reuse, empty-region retention, and insufficient paint evidence. Fixed;
  added focused regressions and an actual color-pixel/frame assertion.
- See [field note](../testing/field-notes/2026-10-21-wasm-flex-text.md) for commands,
  limits, manual procedure, and browser interaction evidence.

- Second feedback delivery on the same live URL: signal-valued paragraphs,
  dynamically selected computed width, equality/inactive-source controls, and
  existing Slice 1 width/paint interactions. Eight experimental Chromium tests
  passed, including the exact public scenario.
- Minimal failing regression first showed paint-only updates remeasuring reactive
  Text (14 -> 16 requests). Fixed by resolving text through its existing exact
  receiver/transaction materialization and keying the bounded cache by that string.
  Hook/write guards apply during preparation. No new public API, graph, or scheduler.
- The user clarified to continue independent reversible work while gathering
  feedback; experiential feedback is not a blanket execution stop gate.

- Slice 2 proportional verification: eight WASM Chromium tests; production Text,
  Text-layout and slice suites: 40 passed / five experimental-only skips. Root
  typecheck, targeted lint, core build and catalog validation passed. Reused the
  same focused reviewer for changed Text ownership/cache code: no material findings.
  Added its suggested direct assertion that text updates still repaint after a
  paint-only measurement cache hit, proving retained source-edge adoption.

- Third feedback delivery: keyed paragraph reorder/removal/restore, independent B
  text and key-selection inspector. A focused failing public-scenario test first
  showed the missing reverse interaction. Existing public JSX/signals and numeric
  identity mapping were sufficient; no new runtime API or solver change needed.
- Nine experimental Chromium tests pass. Live Studio confirms reorder reuses all
  nodes/measurements; removal changes active nodes 3 -> 2; updating removed B leaves
  all work counters unchanged; restore creates exactly one node and shows its latest
  text. Same coordinate hits B before reorder and A afterward. No browser errors.
- Consolidation assessment: three related slices now share one public composition.
  Consolidate ownership/cache/input behavior and remove introduced duplication now;
  do not expand capability until the combined checks and focused review finish.

- Consolidation complete: composed width -> text -> keyed reorder/removal -> paint
  -> absent-input/equal-computed suppression -> width-source switch -> restore ->
  reorder in one public test and one live Studio session.
- Combined test first reproduced one avoidable measurement after removal widened
  surviving A. Replaced whole-cache clearing with two-entry LRU eviction; both
  current basis/final-width measurements now survive. The failing regression passes.
- Removed duplicated button JSX and repeated test mount/frame/click setup. Reused
  the same read-only reviewer: no further material keyed/reactive/ownership findings.
  No API, graph or scheduler expansion; earlier WASM failure/view/empty fixes remain.
- Final proportional combined production Flex/Text suites: 82 passed / seven
  experimental-only skips. Experimental suite: ten passed. Typecheck, targeted lint,
  core build, artifact/source checks, catalog validation and built Node import pass
  on the recorded Node 26.9.0 / pnpm 11.21.0 / Rust 1.99.0 / Chromium environment.
- Still experimental: no aggregate trust, Node 24 verification, full migration or
  performance evidence. Next group starts with final-width column Text correctness;
  prepared intrinsic regions, root transactions and Layer ordering remain later work.

- Fourth feedback delivery: http://127.0.0.1:5187/#/examples/layout/wasm-flex-column-text
  (same running Studio; row/keyed controls remain at their original URL).
- Minimal failing deterministic regression: column Text constrained to width 50
  retained height 20 from width 100 and placed the next sibling at y=20; expected
  height/y=40. Fixed by resolving nowrap column Text's used cross width and
  measuring before resolving automatic main-axis basis. No new API/scheduler.
- Twelve experimental Chromium checks and 46 production Flex checks passed
  (eight experimental-only skips in the latter). Live Studio: width cap 420 -> 180,
  footer moves below the longer paragraph, old location does not hit it, new location
  increments hits; paint-only keeps solves/measurements unchanged. No browser errors.
- Same focused reviewer checked the new column measurement branch: no consequential
  finding. This is the first slice of the next group after consolidation.
- Slice 4 final static/package checks passed: root typecheck, targeted ESLint,
  core build with artifact checks, source discovery/catalog validation (155 lessons),
  built Node root import and diff check. Verification environment remains the
  previously recorded Node 26.9.0 / pnpm 11.21.0 / Chromium; no release claim.

- Fifth feedback delivery: same column URL now has Cycle alignment and a
  crossPlacements inspector counter. The first failing test asserted unchanged
  center geometry plus an actual WASM placement operation; the counter was absent.
- Same WASM region now owns main allocation and cross-axis buffers. Cross sizing,
  stretch/min/max/padding and start/center/end offsets run in Rust for the experimental
  nowrap lane. Output views are renewed, outputs copied, cache keys include normalized
  geometry/policy, and disposal/failure clears both buffers/caches. Normal build
  retains its existing JS solver; no within-solve fallback or public API change.
- Live center transition: crossPlacements 2 -> 3, solves remain 2, measurements
  remain 4. Old horizontal bar position does not hit; new position increments hits.
  Paint-only skips cross placement, allocation and measurement. No browser errors.
- Thirteen focused experimental checks, seven existing nowrap geometry cases and
  two native Rust checks pass. Same focused reviewer found no material cross-axis
  arithmetic, cache or ownership issue. New checked artifact: 51,117 bytes; no
  startup, timing or comparative-performance claim.
- Slice 5 final checks passed: 46 normal-build tests / nine experimental-only skips,
  root typecheck, targeted ESLint, core build/artifact validation, catalog validation
  (155 lessons), built Node import and diff check. Screenshot inspected; Studio
  remains running. Group two has two deliveries; consolidate after the selected next
  delivery. Experimental limitations and recorded environment remain unchanged.

## [DONE] Bounded consolidation of slices 4–6

Column final-width Text, cross-axis placement and main-axis distribution exercised
in one public scenario. The combined sequence checks old/new hit targets, paint-only
reuse, alignment-only reuse, distribution-only reuse and disposal baseline counts.
The focused reviewer found no material main/cross cache, numeric or ownership issue.
Reviewed same-instance buffer lifetimes: cross allocation may grow memory, but all
results are copied; main offsets reuse slot seven only after allocation completes,
and the next allocation resets it. Removed stale Recording wording from the layout
artifact checker. No obsolete JS experimental placement path remains; the ordinary
build intentionally retains its existing solver. No API/declaration changes needed.

## [DONE] Seventh feedback delivery: reactive nowrap axis switching

Smallest outcome: switch an existing mounted public Flex between row and column
using a signal while retaining its children, controls and ownership. A public Studio
axis control must move text/sibling and hit geometry together. Acceptance: one
focused failing public-scenario test first; orientation changes invalidate the
necessary numeric/measurement inputs, paint-only skips work, and disposal returns
ownership counters to baseline. Preserve current public signatures and explicit
finite/minimum semantics. No wrapping, intrinsic component protocol or new graph.
This begins group three after completed consolidation; no release or speed claim.

- Sixth feedback delivery: http://127.0.0.1:5187/#/examples/layout/wasm-flex-column-text
  now includes Distribute (start / space-between / center). Existing controls remain.
  Main offsets use allocated f64 sizes, padding, gaps and all existing justification
  policies inside the same WASM owner. Offset cache keys include allocation revision.
- First regression failed because mainPlacements was absent; geometry was already
  correct. After implementation, 14 focused experimental tests pass, including exact
  public example combined width/alignment/distribution/paint/hit/disposal behavior.
- Live Studio: restoring wide width gives mainPlacements 3, crossPlacements 4,
  solves 3, measuredLeaves 6. Distribute changes only mainPlacements to 4. Old bar
  location retains hits 2; new location increments hits to 3. No browser errors.
- Consolidation checks: seven existing nowrap geometry cases, three native Rust
  tests, 46 normal-path tests (ten experimental-only skips), root typecheck, targeted
  ESLint, core build, catalog validation, built Node import and diff check pass.
  Embedded artifact 52,063 bytes. Screenshot inspected. Same reviewer: no material
  finding. Environment Node 26.9.0 / pnpm 11.21.0 / Rust 1.99.0 / Chromium.
- Studio remains running. No blocker, aggregate gate, Node 24 result, complete
  migration, Yoga parity or performance claim. Exactly one next slice selected.

- Delivered at the same running column Studio URL. Switch row/column is a signal
  receiver on public Flex; footer width derives through public computed and its
  custom component uses public PibblResponsiveStyle. Column sizes/controls remain.
- Added the exact public-scenario failing test first (footer x remained 40 instead
  of moving beside the text). Existing runtime already satisfies the axis contract;
  no runtime, WASM, scheduler, package or declaration change was necessary.
- Fifteen focused experimental tests pass. Test checks moved paint, old/new hit
  targets, stable creates/arenas, restored column geometry, paint-only work reuse
  and disposal returning nodes/arenas to baseline. Root typecheck and targeted lint
  pass. Live browser has no errors; screenshot inspected.
- Live axis switch increments solves/main/cross placement 1 -> 2, retains two
  measurements and two nodes/one arena. Paint changes only frames. Returning to
  column restores exact geometry, still reusing measurements. Studio stays running.
- Group three has one delivered slice. No new reviewer needed for this small
  public composition; previous runtime review remains scoped to its changed code.

## [DONE] Eighth feedback delivery: signal-driven constrained flex allocation

Smallest outcome: a public Studio row with adjustable grow and maximum size shows
one item freezing at its cap while remaining space flows to its sibling. Keep Text
wrapping and input targets synchronized with the allocation, using existing public
signals/style fields and the same WASM region. Acceptance: focused failing public
scenario evidence first, semantic finite size/sum assertions, stable ownership,
paint-only solve/measurement reuse and exact teardown. No new public selector,
intrinsic component protocol or general layout graph. This is the second slice of
group three; consolidate after the third delivery. Experimental, no speed claim.

- Delivered a separate public example without changing the earlier row/keyed or
  column/axis controls: http://127.0.0.1:5187/#/examples/layout/wasm-flex-constraints.
  Ordinary public Flex signals drive maxWidth and flexGrow; custom panels use
  useLayoutBox to show allocated width and wrap their own Text. No engine changes.
- Focused behavioral regression failed at unchanged 332/332 instead of 180/484
  before the cap action was wired. Sixteen experimental tests now pass, including
  exact widths summing with gap to 680, constrained Text paint bounds, changing
  growth while capped, 3:1 uncap, moving input boundary, paint-only work reuse and
  deterministic disposal. Typecheck, targeted lint, catalog (156 lessons) and diff
  checks pass. No additional unchanged-runtime review or broad gates needed.
- Live inspector: solves/mainPlacements 1/1 -> 2/2 capped -> 3/3 growth while capped
  -> 4/4 uncapped; crossPlacements remains 1, nodes remain 2, arena remains 1.
  Widths 332/332 -> 180/484 -> 180/484 -> 448/216. Boundary click changes B -> A.
  Paint increments only frames, no errors. Screenshot inspected. Studio restarted
  on the same port to refresh the new source adapter and remains running.
- measuredLeaves is zero here because panels declare definite size and paint their
  own Text from useLayoutBox; do not infer an intrinsic-custom-component cache or
  Text paint measurement optimization. Existing dedicated Text slices retain their
  separate cache evidence. Group three has two deliveries; consolidate after next.

## [DONE] Ninth feedback delivery: signal-driven shrink minimums

Smallest outcome: extend the constrained public example with an explicit shortfall
interaction that shrinks two finite panels and freezes one at a reactive minimum,
redistributing the remaining deficit. Preserve current growth/cap controls and
prior examples. Acceptance: focused failing public-scenario test, finite exact
width/gap/shortfall assertions, text and hit geometry follow the allocations,
paint-only layout reuse and exact teardown. Use existing public flexBasis,
flexShrink and minWidth; no new API or intrinsic component protocol. This is group
three delivery three: bounded consolidation immediately afterward, before expansion.

- Delivered at http://127.0.0.1:5187/#/examples/layout/wasm-flex-constraints.
  Toggle shortfall changes finite container width/basis to 320/300; Toggle A floor
  changes minWidth 0/180. Existing cap/growth controls remain. Text uses a shorter
  signal-valued explanation in shortfall so its paint stays inside the narrow box;
  width labels use 12px font to fit the 124px panel. No engine change.
- Focused pre-implementation failure: widths stayed 448/216 instead of 152/152.
  Passing sequence now includes 152/152 -> 180/124 -> 152/152, preserving sum+gap320,
  measured text paint bounds, same-coordinate input changing A -> B, stable nodes,
  paint-only skip and teardown. Corrected one test click from the gap into both
  successive panel bounds; no runtime geometry workaround.
- Live no errors: solves/mainPlacements 4/4 -> 5/5 shortfall -> 6/6 floor -> 7/7
  release; crossPlacements1, measuredLeaves0, nodes2/arena1 unchanged. Paint only
  adds a frame. Screenshot inspected. Studio remains running in session33722.

## [DONE] Bounded consolidation of slices 7–9

Exercised all three public scenarios through the combined experimental suite,
including axis switching, constrained growth and shrink floors. Sixteen tests pass;
normal Flex/Text/compatibility/slice suites:47 passed/12 experimental-only skips.
Typecheck, targeted ESLint, catalog validation156 and diff check pass on recorded
Node26.9.0/pnpm11.21.0/Chromium. No engine changes in this group, so no unchanged-code
review, rebuild, native rerun or broad trust gate. Earlier runtime reviews do not
claim to cover future code. Checked changed composition, responsive style types,
explicit minimums, computed receiver reuse, text bounds, scheduled geometry/input,
owner counts, timer/inspector cleanup and preserved controls. No obsolete path or
new duplicate runtime machinery found; self-contained example Button helpers stay
local so editor source can run through public imports. No scaffolding remains.

### Reconciliation with the original proposal

The experimental lane implements the first finite nowrap WASM allocation/placement
slice with direct Text remeasurement, persistent region identity and selected
reactive/cache/lifecycle evidence. Later controls primarily exposed existing
behavior; do not count them as completing later proposal stages. Stage2 is partial:
no general role-aware invalidation graph, transaction revision protocol or timing
evidence. Stage3 prepared nested structure and dependent Layer allocation ordering
are unimplemented. Current intrinsic measureFlex rejects automatic child bases and
cross sizes (flex.ts measureFlex); arbitrary components remain opaque. Yoga parity,
Grid, migration profile/package, custom-font revision support, broad conformance,
cold/bridge timings and full trust evidence remain outstanding. Initial Taffy/f64
investigation was sufficient only for the first slice, not a final provenance or
performance decision. No feature-complete, parity, migration-ready or speed claim.

## [DONE] Tenth feedback delivery: intrinsic built-in Flex column containing Text

Smallest meaningful engine advance: an auto-height built-in Flex column containing
a direct wrapped Text leaf can be measured at a known constrained width and place
a following sibling below it. Use existing public Flex/Text, width/text signals and
explicit minimums. Start with one level of built-in structure and finite definite
width; do not execute arbitrary components to discover children, add a general
pure-structural API, or claim root prepared-graph/Layer support. Acceptance: focused
failing semantic public geometry test before runtime changes; exact runnable Studio
composition where width/text changes update intrinsic height, following paint/hit
geometry agrees in the same frame, unchanged inputs reuse bounded work, callbacks
are not speculatively repeated, and ownership returns to baseline. Amend only the
experimental unsupported intrinsic subset supported by evidence; normal lane
behavior remains separately tested. Investigate descriptor preparation/measurement
ownership only enough for this one bounded slice. No consequential new public API
choice is required now; propose one explicitly if the slice cannot remain within
built-in descriptions. This starts group four after completed consolidation.

- Delivered http://127.0.0.1:5187/#/examples/layout/wasm-flex-intrinsic-text.
  A definite-width inner built-in Flex has no height; direct wrapped Text determines
  its height before outer-column sibling placement. Width/text controls move the
  green sibling and its hit geometry together. Earlier scenarios remain available.
- Initial focused deterministic test failed with unsupported automatic child basis.
  New experimental measureFlex branch measures only direct Text at a definite width,
  stretch/declared child width, explicit minimums and zero intrinsic grow. No arbitrary
  component evaluation, new public signature, graph, fixed-point loop or WASM ABI.
  Existing active measurement/cycle guards and source paint/teardown ownership apply.
- Reviewer reproduced a material final-width mismatch: width100/maxWidth50 measured
  height20 at width100 instead of40 at50. Added failing regression, extended final
  width ordering to built-in Flex in column and row parents, and reran. Reviewer
  verified the fix including padding, with no further consequential finding.
- Nineteen experimental tests pass, including exact public width/text/old-new hit
  behavior, one opaque footer paint per frame, stable nodes and disposal baseline.
  Normal Flex/Text/compatibility/slice suites47 passed/15 experimental-only skips;
  root typecheck, targeted ESLint, core build/artifact checks, catalog157, built Node
  import and diff check pass. Same Node26.9.0/pnpm11.21.0/Chromium environment.
- Live: width420->180 gives solves2->4 and measurements3->6; short Text gives
  solves6, measurements9; paint keeps solves6/main6/cross4 but measurements10.
  Numeric nodes3 and arenas2 remain stable. No browser errors; screenshot inspected.
  Conservative intrinsic aggregate host measurement repeats once on paint. Legacy
  measuredLeaves includes aggregate host requests and is not total Canvas metric
  calls. No caching/performance claim. Studio running session86534 on same port.
- This is group-four delivery one. Stage3 is now partially demonstrated for one
  built-in column/leaf shape; general prepared components, intrinsic feedback cycles,
  Layer/external allocation dependencies, migration/parity and font revisions remain.

## [DONE] Eleventh feedback delivery: parent-constrained intrinsic column width

Smallest outcome: the intrinsic built-in column can take its known stretched width
from a definite parent allocation rather than duplicating an explicit width on the
inner Flex. Preserve public Flex/Text signatures and the prior scenario. Acceptance:
focused failing public semantic geometry first; parent width/text signals update
intrinsic height and following sibling paint/hit geometry together, final width
bounds/padding agree, arbitrary components remain opaque, finite unsupported cyclic
size dependencies fail rather than iterate, unchanged numeric work reuses and
ownership returns to baseline. Keep this to a definite parent cross allocation,
auto-height built-in column and direct measured Text. No general structural API,
percentage feedback solver or root preparation graph. Discuss a consequential
contract choice only if this bounded existing authoring path cannot remain finite.
This is group-four slice two; consolidate after three deliveries in the group.

- Same running intrinsic URL now declares width only on the outer Flex. The inner
  built-in column has neither width nor height. Width/text controls retain the same
  sibling paint/hit behavior; other public scenarios remain unchanged.
- Focused deterministic failure captured unsupported automatic child basis. Runtime
  now defers the early intrinsic measure for a stretched auto-width Flex child in
  a finite parent column until cross min/max/padding settle, then supplies that
  known width to existing pure measurement. No fixed-point loop or new public API.
  Unsupported deferred measurement fails explicitly; ordinary components stay opaque.
- Twenty focused experimental tests pass. Added capped parent width and padding
  cases (content50/height40; padding10 gives outer70/height60), plus standalone
  measurement remains unsupported when only max constraints are known. Existing
  exact-example tests cover signals, moved hit targets, identity and teardown.
- Reviewer checked changed ordering: no material issue. Live width420->180 moves
  footer and hit target; nodes3/arenas2 stable; short Text moves it upward. Paint
  holds solves6/main6/cross4 and adds one aggregate host measurement (9->10).
  No browser errors. The limitation is retained, not described as optimized.
- Normal Flex/Text/compatibility/slice suites47 passed/16 experimental-only skips;
  typecheck, targeted ESLint, core build/artifact check, catalog157, built Node import
  and diff check pass. Node26.9.0/pnpm11.21.0/Chromium. Studio session86534 remains
  running. Group four has two delivered slices; consolidate after next delivery.

## [DONE] Twelfth feedback delivery: bounded intrinsic Text measurement reuse

Smallest outcome: Paint only in the parent-constrained intrinsic example causes
zero aggregate intrinsic measurement, while text/width/metric-style changes still
invalidate correctly and repaint. Use the existing receiver provisions and region
owner; no duplicate signal subscriptions, general dependency graph or public API.
Acceptance: focused failing public counter/semantic test first; cache keys include
resolved direct-leaf content, metric style, width constraints and structure;
cache hits adopt current input ownership, same-sized text changes repaint,
unsupported/custom-font cases remain conservative, bounded cache storage releases
on removal/disposal, changed text/width keeps sibling paint/hit geometry consistent.
Choose the narrowest safe built-in snapshot/cache shape from executable evidence,
not speculative future graph design. This is group four delivery three; perform
bounded consolidation immediately afterward. Do not infer timings or broader
custom-component/Layer support from this work reduction counter.

- Same intrinsic Studio URL now has Cycle font. Generic Paint only skips aggregate
  host measurement as well as numeric solves/placements. Width/text/generic font
  changes invalidate; a changed punctuation with equal measured height still paints.
  Custom-family step is deliberately uncached; no font-load/revision promise.
- Initial focused regression failed one extra aggregate measurement versus zero.
  Snapshot only direct built-in Text descriptors and resolved metric inputs; hits
  prepare receiver provisions before reusing results. No alternate reactive graph.
  Region now owns the shared two-entry per-node LRU and cachedMeasurements counter;
  entries release on removed nodes and teardown. No descriptors/provisions retained.
- Reviewer identified pre-cache iterable traversal borrowing outer render context.
  Shared existing measurement isolation around the whole snapshot, with signal-write
  guard, fixes it. Added scheduled public iterable regression; targeted reviewer
  rechecked state restoration and explicit receiver provisioning, no further finding.
- Live: generic paint holds solves6/main6/cross4/measurements9/cache4; font24 changes
  measurements12/solves8. Same-height text paints, measurements15/solves8. Custom
  family then paint increases measurements18->21 while numeric work stays8/8/4.
  No errors; screenshot inspected. These are structural counters, not timings.

## [DONE] Bounded consolidation of slices 10–12

Combined public examples cover intrinsic height, known parent width, width bounds
and padding, text/generic-font invalidation, same-height changed text, cache hit
ownership, custom-family conservative misses, moved hits and disposal. Twenty-one
experimental tests pass. Normal Flex/Text/measurement/compatibility/slice suites:
56 passed/17 experimental-only skips. Typecheck, targeted ESLint, core build/artifact
validation, catalog157, built Node import and diff check pass on recorded
Node26.9.0/pnpm11.21.0/Chromium. No broad matrix/native rerun/full gate or speed claim.

Reviewed changed measurement ordering, pure preparation, scheduler/reactivity reuse,
public types, cache boundaries and cleanup. Fixed material width-clamp and snapshot
purity findings during the group. Consolidated duplicate LRU operations into the
region owner; shared existing render-state isolation instead of adding a parallel
purity context. No obsolete uncached direct-generic intrinsic path remains. Examples,
contracts and plan now distinguish supported cache reuse from custom-font misses.
Studio session86534 stays running; prior routes/controls remain available.

Proposal status: Stage3 built-in intrinsic preparation is partial, limited to known
width/auto-height column/direct Text. A general pure structural component API,
root geometry transactions, role-aware dependency graph, arbitrary intrinsic nesting
and Layer/external allocation dependencies remain unimplemented. Yoga parity, Grid,
migration profile/package, font revisions, timings and release gates remain later
work. The next material integration risk is parent allocation versus deepest-first
Layer raster ordering, not another control for existing numeric behavior.

## [DONE] Thirteenth feedback delivery: allocation-aware managed Layer raster

Smallest outcome: a public resizable Flex composition containing a managed Layer
whose content and parent allocation change in one signal batch rasterizes once at
its final logical size, with paint/hit geometry consistent in the same frame. First
capture the existing behavior with a focused failing public semantic size/callback
regression, then change only the necessary allocation/raster ordering. Preserve
clean sibling bitmap reuse, source paint order, current independent nested work,
revision/error isolation and exact teardown. No second scheduler or general retained
render tree. Recommendation: express only the observed allocation dependency;
retain existing deepest-first behavior for work without that dependency. The
proposal explicitly identifies this scheduling amendment; determine concrete scope
from the failing scenario before selecting implementation. If it requires a new
public contract or broad scheduler rewrite, present that decision with evidence.
This begins group five after completed consolidation; no release/parity claim.

- Delivered http://127.0.0.1:5187/#/examples/layout/wasm-flex-layer with Resize +
  content, Content only and Root paint only. Existing public examples preserved.
- Focused regression first observed raster callbacks at240 and120 in the same
  revision after a resize; expected only120. Experimental directly placed Layers
  now register a weak parent allocation dependency. Eligible Canvas branch work
  waits for parent inline traversal; existing inline revision completion/teardown
  stays authoritative. No second scheduler or general preparation graph.
- Renderer-participant branches, captured root payloads and next-frame instance
  work are excluded from this deferral. Their existing ordering is retained, not
  claimed solved. Normal builds do not register dependencies and take a no-scan
  fast path when none exist. Registration count releases exactly on teardown.
- Twenty-three focused tests pass. Exact example checks raster history544->284
  with one callback, former bitmap pixels cleared, current pixels/hits, clean
  sibling bitmap moved with raster count1, content-only one callback, root paint
  zero callbacks, nodes/arenas return to baseline. Live same results/no errors;
  screenshot inspected. Studio session10013 remains running on5187.
- Reviewer found no consequential scoped ordering/revision/ownership issue.
  Experimental scheduler/Layer/signal-ownership suites83 passed; normal slice/Layer
  suites49 passed/19 experimental-only skips. Typecheck, targeted lint, core build,
  artifact check, catalog158, built Node import and diff check pass on recorded
  Node26.9.0/pnpm11.21.0/Chromium. No speed, general scheduler or release claim.
- Group five delivery one. Proposal Layer allocation integration is now partial
  for Canvas-only eligible branches; renderer participants remain the next concrete
  integration gap. General root transactions, preparation, parity and migration
  still remain beyond this slice.

## [DONE] Fourteenth feedback delivery: public renderer in allocated Layer

Smallest outcome: a resizable public Flex/Layer composition with a public
`defineRenderLayer` bitmap callback can settle its resource/draw/interaction size
at the final parent allocation in one frame. Begin with a focused failing public
size/callback regression using a lightweight Canvas renderer, not Three setup.
Observe exact current stages before choosing the handoff; extend the dependency
only as needed. Acceptance: shared parent/content update renders final size once,
paint/hit generations agree, clean siblings reuse, resource failures do not commit
stale generations or stop independent roots, revisions/cleanup remain exact. No
new public surface, second scheduler, broad renderer rewrite or blanket order flip.
If evidence demands an expensive scheduler/public-contract choice, present it with
recommendation. This is group-five slice two; consolidate after three deliveries.

- Delivered http://127.0.0.1:5187/#/examples/layout/wasm-flex-render-layer.
  It uses only public defineRenderLayer create/update/resize/render/interaction/
  dispose callbacks inside a Flex-allocated Layer, with the existing controls and
  an outlined committed right-edge target. Earlier examples remain available.
- Source evidence corrected the selected slice's terminology: public defineRenderLayer
  uses inline RenderLayerController lifecycle, not the scheduler friend-work queue.
  Its resize/invalidation requests use requestInstanceRender. The prior Canvas Layer
  handoff already supplies final allocation. No runtime scheduler defect or required
  engine change was found for this public composition. Do not invent a friend-queue
  extension or claim it is integrated because this example works.
- Test-first public example evidence initially lacked external lifecycle counters
  (it still used the Canvas-only composition), then the complete public renderer
  path passed. This was a missing public proving/migration example, not a claimed
  preexisting engine bug. Twenty-four focused tests pass; new scenario verifies
  final resize/render width, cleared old pixels, target generation, clean sibling
  cache, root-only reuse, one create and one dispose despite repeated disposal.
- Live resize544->284 has render history0@544,1@284 and resize history544,284; current
  target hit reports generation1, old extent misses. Content only gives render3;
  root paint adds none. Creates1/disposes0 while mounted, clean raster1 throughout.
  No browser errors; screenshot inspected. Task-owned Studio session95131 stays up.
- Fresh public renderer lifecycle/failure/resource ownership suites35 passed;
  typecheck, targeted ESLint, catalog159 and diff check pass on recorded Node26.9.0/
  pnpm11.21.0/Chromium. No unchanged-runtime build/review or broad gates were needed.
  Existing failure suites are supporting evidence, not a claim of injected nested
  renderer failure in the public example. General friend-queue allocation work is
  still excluded and has no current public user demonstrated by this investigation.
- Group five has two deliveries. Next material authoring gap is allocation through
  an opaque reusable panel returning a Layer, which lacks a direct placement marker.
  This is normal public component composition, not a prepared structural-component
  API. Consolidate immediately after that third delivery.

## [DONE] Fifteenth feedback delivery: allocation through an opaque reusable panel

Smallest outcome: a public ordinary panel component placed by Flex can return a
Layer containing Canvas/public renderer content and still rasterize once at final
parent allocation. Begin with a focused failing width/callback regression for this
opaque boundary; do not execute it speculatively to discover children. Preserve
hooks, source order, renderer resource lifetime, paint/hit geometry, clean sibling
reuse and teardown. Track only the inherited finite allocation dependency needed
for that public composition; no new structural API or broad retained graph. Keep
friend-only work/root payload exclusions explicit. If source evidence disproves
the expected gap, report it and choose a meaningful public integration test rather
than manufacture scheduler changes. This is group-five delivery three; perform
bounded consolidation before further expansion.

- Delivered http://127.0.0.1:5187/#/examples/layout/wasm-flex-panel. Panel is an
  ordinary function accepting public PibblResponsiveStyle/children, reading public
  useLayoutBox and returning Layer. Earlier direct Layer/renderer examples remain.
- Focused failing regression observed240 then120 raster callbacks after a shared
  update through Panel. Internal Layer registration now follows the active parent
  allocation context instead of a direct placement marker. No application internal
  access, speculative component execution, public structural API or scheduler rewrite.
- Twenty-six public slice tests pass. Direct/opaque renderer tests share semantic
  assertions for final widths, committed generation, cleared old pixels, clean
  sibling reuse, persistent resources and exact repeated disposal. Panel traverses
  once per root frame; content and root-only controls retain distinct raster counts.
- Live panel traversals1->2 onresize, renderer1->2 at544->284, current hitgeneration1;
  content gives panel3/renderer3; root paint panel4/renderer3; clean sibling1 and
  resource create1 throughout. No browser errors; screenshot inspected. Studio
  refreshed new-file adapter, session57865 remains running on5187.

## [DONE] Bounded consolidation of slices 13–15

Combined all public slice tests and changed allocation/Layer/renderer lifecycle paths.
Twenty-six experimental slice tests pass. Scheduler/Layer/public-renderer/signal and
surface ownership suites118 pass; normal slice/Layer suites49 pass/22 experimental-only
skips. Typecheck, targeted ESLint, core build/artifact checks, catalog160, built Node
import and diff check pass. Recorded Node26.9.0/pnpm11.21.0/Chromium; no aggregate
trust gate, broad browser matrix or unchanged native rerun.

Review covered allocation context across ordinary components/Group/Clip, weak
instance ownership, scheduler revisions/admission exclusions, public renderer bitmap
and interaction generation, cleanup, API/types and examples. Same focused reviewer:
no consequential inherited-context issue. Removed direct-marker-only registration;
shared parameterized direct/opaque public renderer assertions rather than duplicating
fixtures. Learning sources stay self-contained for the public Studio editor. The
friend-work/public-renderer distinction is corrected in contracts and plan; no
unused friend-queue infrastructure was added. No new public API/declaration contract.

### Remaining proposal milestones and migration blockers

- Experimental Studio/test build only: normal built core still uses JS layout.
  There is no validated production WASM loading/variant, prewarm contract or optional
  standalone layout package. Built Node import evidence is for ordinary core, not
  a released experimental consumer migration promise.
- Stage2 is partial: existing signal/receiver provisions, equality suppression and
  bounded measurement/placement caches work for demonstrated cases, but general
  role-aware graph/geometry revisions, minimal layout visits and root transactions
  are not implemented. Numeric nowrap allocation/placement is WASM; style resolution,
  descriptor traversal, intrinsic aggregation and host Text metrics remain JS.
- Stage3 is partial: known-width intrinsic column/direct Text and allocation-aware
  managed Layers/public inline renderers work in the demonstrated shapes. Arbitrary
  intrinsic components, a pure structural capability, full nested preparation and
  transactional geometry publication are not solved. Friend-work, root payload and
  next-frame admission exclusions remain explicit. No general font-load/revision
  invalidation; custom-family metrics remain conservative.
- Stage4 parity/migration lacks a fresh pinned Yoga differential characterization,
  versioned conversion recipe/profile and accepted divergence manifest. Experimental
  nowrap excludes wrap, reverse/RTL, margins/logical edges, automatic minimums,
  baseline/intrinsic contributions, broader box sizing/aspect ratio/participation
  and rounding policies. Native Pibbl defaults cannot be labeled Yoga-compatible.
- Stage5 coherent multi-family WASM/Grid work is absent. Existing Grid and other
  layout families are not proof of the proposed replacement capability target.
- Reliability/performance/release milestones are incomplete: no seeded conformance
  corpus, cold/bridge budget or reproducible timing comparison, packed experimental
  consumers, documented Node24 verification or full integration trust gate. Focused
  callback/counter/ownership evidence does not establish faster or migration-ready.

Recommendation: do not promote a compatibility profile/package or general prepared
component API now. First rehearse one concrete Yoga conversion with versioned,
reproducible geometry evidence. That is a bounded migration deliverable through
existing public authoring, not another control for already-supported arithmetic.
Public profile/loading/structural API choices remain consequential decisions to
present with exact signatures and evidence before freezing them.

## [DONE] Sixteenth feedback delivery: bounded versioned Yoga migration rehearsal

Smallest outcome: a runnable public Pibbl panel translated from one pinned Yoga
baseline fixture shows allocated geometry and the explicit default/style conversions
needed for the currently supported finite nowrap subset. Pin the baseline from the
research (Yoga3.2.1, not a claim of latest release), reproduce a tiny fixed numeric
reference (at most three cases: grow, cap freeze, shrink floor), and compare semantic
public Pibbl geometry. Classify every observed divergence rather than hiding it.
Acceptance: focused failing translation/geometry evidence before implementation,
exact Studio example with meaningful labels/units and a resize interaction, checked
reference provenance/configuration and a concise local conversion recipe. Keep Yoga
out of the application runtime; no public compatibility selector/profile, standalone
package, broad corpus or benchmark platform. This begins group six after completed
consolidation. If evidence requires a changed public geometry/default contract,
present the consequential choice and recommendation instead of silently changing it.

- Delivered http://127.0.0.1:5187/#/examples/layout/wasm-yoga-migration. Left draws
  explicitly recorded Yoga geometry; right uses public Pibbl Flex/ordinary panels.
  Next case + resize cycles grow/cap/shrink; paint-only reuses numeric work and
  current panel clicks report A/B. Prior public scenarios remain available.
- Reused existing read-only research checkout Git objects; exact Yoga3.2.1 commit
  042f5013152eb81c1552dec945b88f7b95ca350f, source manifest version/license checked.
  Temporary archive of pinned Yoga C++/manifest/license compiled with Apple clang
  21.0.0 (-std=c++20 -O2). No new app/npm dependency, copied implementation or
  binary. Complete upstream MIT notice and its SHA256 retained; own probe SHA256
  and explicit configuration recorded. Research checkout/unrelated probe unchanged.
- Exactly three native references reproduced:144/144,80/208,120/88. Row/LTR, gap12,
  explicit shrink1/minimums, no WebDefaults/errata, point scale0, padding/border0.
  Public test compares positions and sizes derived from useLayoutBox to the pinned
  JSON. Initial unfinished translation failed the expected public geometry; no
  engine defect was claimed or runtime change needed. No observed divergence in
  these integer cases; no inference about other styles, fonts, precision or parity.
- Twenty-seven focused tests pass. Fresh oracle reproduction and recorded/example
  consistency check, typecheck, targeted ESLint, catalog161 and diff check pass.
  Live matches all cases and targeting; paint keeps solves3/main3/cross1. Nodes2/
  arena1 stable; no browser errors; screenshot inspected. Same reviewer checked pin,
  license, independent reference/actual paths and claim scope: no material finding.
  Studio session54533 remains running on5187. No unchanged-runtime build/full gate.
- Reproducible command/configuration and concrete conversion recipe:
  tooling/layout-yoga-rehearsal/README.md. Default row/shrink/minimum and rounding
  differences explicit; padded box conversion, reverse/wrap/RTL, broader geometry,
  font/intrinsic/Grid support are outside the rehearsal. Left is not live Yoga.
- Production boundary remains material: Studio bundles experimental source through
  ordinary public imports, while normal core builds select JS. This does not block
  this supported local example; it blocks claiming a production WASM migration.
  No public profile, loading API, package/selector or default behavior was frozen.
  Group six has one delivered slice; selected next is built consumer evidence.

## Slice 17 — Unpublished built-WASM consumer and Studio proof

Smallest outcome: run this same public migration scenario from an explicitly
experimental built core artifact, rather than relying on Studio source bundling,
with a reproducible local build/run command and no ordinary package behavior change.
Acceptance: focused failing built-consumer evidence first; same public imports,
geometry and scheduler/signal identity across the artifact boundary, correct WASM
artifact provenance, inert unused imports and cleanup. Keep the normal build/exports
and supported wrap path intact; no publication, external deployment, per-component
engine selector, compatibility profile or new stable loading API. Prefer a local
unpublished build lane/artifact over freezing public package variants prematurely.
If nominal runtime identity or loader/bundle semantics require a consequential API
choice, present exact alternatives/recommendation with evidence before implementing.
This is group-six slice two; consolidate after three deliveries. A built proof is
still not a production-ready package or performance claim.

Delivered: private generated package, separate dist, compile-time WASM opt-in,
public exports and local independent consumer. Initial missing-artifact test failed;
declaration build then exposed mixed source/normal JSX types, fixed by explicit
single-source declaration mappings. Normal dist untouched by opt-in build; normal
build also rerun with false flag. Studio5188 runs the same migration scenario using
460 core inputs exclusively under the generated built directory; bundler rejects
mixed inputs. Browser grow/cap/shrink, targets A/B and paint-only solve reuse pass
without errors. Public imports/JSX/signal recognition and unused WASM compilation
count0 pass. Types, targeted lint, embedded fingerprint and focused regressions
recorded in field notes. No new stable API, release, publication or speed claim.

## Slice 18 — Built-WASM consumer lifecycle and declaration rehearsal

Smallest outcome: an independent local public consumer can typecheck and repeatedly
mount/dispose a constrained Text/Layer composition using the unpublished artifact,
with visible ownership counters returning to baseline. Acceptance: minimum failing
consumer lifecycle/declaration regression first; use public package entries only,
verify final paint/hit geometry and exact cleanup after remount; preserve both
Studio lanes and normal JS builds. Address only material portability/ownership
failures found. This is group-six slice three; perform bounded consolidation of
slices16–18 before further capability expansion. Production distribution policy,
wrap/reverse/RTL and broader Yoga migration remain unresolved scope, not claims.

Delivered: runnable public Text/Layer/renderer composition, with host-owned
mount/dispose controls and diagnostic counters. Focused browser test initially
failed waiting for the absent scenario; declaration fixture initially failed for
the same absence. The declaration check then caught/rejected the fixture's
incorrect `Record<string, never>` renderer props, corrected to `object` without
changing public types. Browser caught an incorrect child-local origin diagnostic;
public Canvas transform supplies this unrotated Layer-local offset instead.
Actual built artifact passes5creates/5disposes, idempotent dispose,4active nodes/
2arenas while mounted and0ownership delta after disposal. Text reflow moves its
following renderer; old and new targets are checked. Detached Text mutations
leave all layout counters unchanged. Both Studio lanes run the same application.
Unused built imports compile/instantiate0 WASM modules, schedule0frames and own0
arenas/nodes. Declaration tests copy the exact learning source into an independent
temporary package consumer, without workspace path aliases or skipLibCheck.

## Consolidation six — slices 16–18

- Exercised pinned migration geometry and reactive Text/Layer/renderer lifetime
  through the same private built runtime. Public app source has no internal imports.
  Source and built lanes remain5187/5188; generated private output is ignored.
- Reviewed changed build flags, module graph, typings, nominal signal/JSX identity,
  scheduler inactivity and ownership. Same focused reviewer found no material
  defect. No engine/scheduler API change was needed for this group.
- Fixed introduced packaging omission: copy existing third-party notices into the
  local package. Remove the temporary declaration tsconfig after a successful build.
  Built provenance assertion now applies on any port; explicit `--source` is the
  separate source test opt-in. Reconciled README/contract claims with current proof.
- Proportional evidence: private rebuild and fingerprint check; independent public
  Bundler/NodeNext declaration consumer; no-import-work checks; actual built and
  source lifecycle scenarios; built migration cases; repository types/targeted
  lint/catalog162/diff check. No unchanged-code review or aggregate trust gate.
- Remaining milestone scope: proposal step1 has a runnable private WASM slice and
  source/built lifecycle receipts, but no cold/warm budget or release packaging
  evidence. Step2 is partial: existing receivers/computed equality and bounded
  cache reuse work; root traversal and JS normalization remain, with no complete
  input-role graph or general incremental-layout claim. Step3 is partial: bounded
  direct-Text intrinsic columns and ordinary opaque allocation work; no general
  pure structural capability, root prepared tree, custom-font revision model,
  transactional cross-system preparation, or complete friend queue integration.
  Step4 remains a nowrap subset plus three pinned numeric migration cases; no Yoga
  parity set, margins, baseline, reverse/RTL, wrap, auto minimum or box-model
  conversion claim. Grid and optional standalone adoption remain later work.
- Milestone readiness: six groups are experimental local increments, not feature
  completion, production migration, default replacement, portable packed package,
  performance advantage, or release readiness. Local symlink consumer intentionally
  does not substitute for packed/installed consumers. Node26 evidence is not Node24.
  No publication/deployment and no new product-contract decision in this group.

## Slice 19 — Finite row-wrap through WASM

Smallest outcome: a finite public Flex row wraps cards onto a second line when a
signal narrows its width, using WASM line formation and per-line allocation/placement.
Acceptance: one focused failing public geometry test; a Studio width interaction
showing line positions, final-size Text and hit targets agreeing; unchanged nowrap
examples and ownership; explicit unsupported column/reverse/RTL/intrinsic-wrap
boundaries, no silent JS algorithm fallback. Reuse existing declared style and
measurement contracts, not a compatibility API or arbitrary component preparation.
This starts the next group after consolidation. Broader wrap conformance follows
working feedback; do not infer parity or speed from this bounded capability.

Delivered: finite row wrap with Rust line formation from hypothetical outer main
sizes, bounded existing allocation per line, and Rust line/item main/cross offsets.
All items remain in one region record map; line changes retain keyed identities and
measurement caches. Cross cache keys include allocation revision/line policy so a
changed topology cannot reuse old offsets. The ABI copies outputs after potential
memory growth, clears line ranges on disposal and invalidates failed revisions.
No public API, normal solver or measurement protocol change. Column wrap still
fails explicitly; arbitrary intrinsic wrapped containers remain unsupported.

Focused evidence began with the previous nowrap-only error (27passed/1failed),
then final-width direct Text/overflow-minimum/huge-factor/default-stretch geometry
passes. Public scenario checks finite card positions, old-target miss/new-target
hit, width restoration, Text/paint solve reuse, stable keyed nodes and exact cleanup.
Final29tests pass. Private rebuilt WASM56793bytes and declarations/import checks pass.
Both live source and built scenarios agree; built receipt460coreinputs exclusively
private dist. Same reviewer found no material kernel/region defect. No parity/speed
claim; generic Text and declared finite opaque cards are the demonstrated shapes.

Two live-experience fixes were needed: isolate the built Studio optimizer cache
from the concurrently running source lane after an observed504OutdatedOptimizeDep;
cap/wrap diagnostic HTML so it cannot collapse the Canvas, also fixing the prior
lifecycle example's panel. The card diagnostic removes the root backing/letterbox
transform through public Canvas matrices and rounds displayed coordinates to0.001px
without changing actual placement. Focused checks and screenshots distinguish these
application presentation issues from kernel geometry. Studio5187/5188 remain up.
Group seven has one delivered slice. No new product-contract decision or blocker.

## Slice 20 — Finite column wrap with declared item sizes

Smallest outcome: a finite public column moves cards into a second column when a
height signal shrinks, reusing WASM line formation/allocation/placement across axes.
Acceptance: minimum focused failing public geometry test and runnable Studio
interaction; declared definite main basis/height and cross width avoid intrinsic
width/height cycles. Reject automatic measured main bases or cross widths outside
this bounded path with an actionable diagnostic. Prove Text uses final declared
card widths, moved hit targets agree, keyed ownership survives wrap/restore, and
existing row/nowrap/source/built paths remain valid. No reverse/RTL, general
intrinsic columns, compatibility profile, speculative preparation or parity claim.
This is group-seven slice two; consolidate after three deliveries in this group.

Delivered: finite column wrapping through the same existing axis-independent WASM
line kernel, without Rust/ABI changes. Child normalization now allows columns only
when height/flexBasis and width are declared; automatic measured main bases or
cross widths reject before measurement with a size-specific diagnostic. Existing
minimum/bounds rules apply. Initial new test failed at the blanket column guard;
final31focused tests pass, including finite geometry, intrinsic rejection and huge
shrink factors with overflow minimums. Public source/built scenarios match moved
paint/targets, unchanged widths and Text/paint numeric reuse, with exact cleanup in
the public regression. No repeated unchanged-kernel review or broad trust gate.

Live288→184px height moves C from(28,348),192×88 to(232,148),192×184; A/B become
86px tall. Old C misses/new C selects; restore reuses the same3nodes/1arena.
Text/paint leave lineFormations/solves2; restore increments to3 with nodeCreates3.
Private rebuild retains56793byte kernel; all460coreinputs are private built dist.
Types, targeted lint, independent Bundler/NodeNext consumer (now3actual sources),
import inactivity, catalog164, source discovery and diff checks pass. Normal builds
remain JavaScript. Both Studio lanes kept running. Generic card Text uses the final
declared width, not intrinsic column feedback. No parity/performance/completion claim.
Group seven has two delivered slices; consolidate after the next. No blocker.

## Slice 21 — Keyed wrapped collection reorder/removal/restore

Smallest outcome: a public finite wrapped collection changes membership/order while
surviving cards keep numeric identity and moved hit targets agree in the same frame.
Acceptance: one focused failing public scenario test, visible reorder/remove/restore
controls and ownership counters; prove line topology updates on same-size order or
membership changes, removal releases its node, restore creates exactly that node,
paint-only work reuses allocations, disposal restores baseline. Exercise the source
and private built lanes without adding a collection API or speculative component
measurement. Use existing finite row/card contracts; no broader wrap parity claim.
This is group-seven slice three, followed by bounded consolidation of19–21 before
further capability expansion. Reconcile the next material proposal gap then.

Delivered: one public source/built scenario shows both wrapped owners with shared
key order, per-mounted-slot stamps and hit counts. Initial focused public test
failed to import the absent fixture (1failed/31skipped). Reorder retains stamps
and numeric records; removing B releases one record per owner; restore appends two
fresh Bs while surviving A/C stamps persist. Stale-slot hit counts and moved-target
selection are checked independently. Paint reuses solves/line formation. Source
and built browser probes both prove6→4→6→0active nodes,2→0arenas and final zero
measurement entries via Studio pagehide→returned public controller.dispose; no
frames/layout counters change afterward. No core/runtime/API changes for this slice.

## Consolidation seven — slices 19–21

- Exercised finite row wrap, declared-size column wrap, keyed topology changes,
  public Text/paint signals and cleanup together. Final focused suite33/33passes;
  one additional material-risk regression verifies measured Text cache entries
  stay bounded6→4→6→0 across wrapped keyed changes and paint reuses measurement.
  Earlier group receipt: normal JS Flex35/35passed at slice19; no claim of a new
  normal-build or unchanged-kernel review here.
- Same focused reviewer inspected only the new column eligibility and keyed
  evidence since the slice19 kernel review: no material finding. No overlapping
  review, full trust gate, broad browser matrix or benchmark run.
- Kept normal JS line solving for normal builds; the experimental wrapped path
  retains one flat source-order item list while Rust owns numeric line ranges.
  No duplicate reactive/scheduler/collection API or speculative rendering was
  introduced. Removed test-only dynamic-import scaffolding after the fixture
  existed; package-consumer source copies share a small four-fixture loop.
  Learning sources remain deliberately standalone for Studio editing.
- Reviewed ownership/cache invalidation, memory-view renewal, finite freeze and
  line passes, final-width row Text, declared column eligibility before measuring,
  source paint order, moved targets and exact cleanup. Kernel remains56793bytes;
  source/binary fingerprint check passes. Public Bundler/NodeNext consumers now
  typecheck all four lifecycle/row/column/keyed learning sources. Import inactivity,
  repository types, targeted lint, catalog165/source discovery/diff checks pass.
- Restored both servers after a local execution transport failure stopped them;
  no file loss or permission denial. Live source5187/built5188 remain available.
  Built receipt has460coreinputs exclusively private dist. Screenshots inspected;
  no visual baselines changed. No new public surface or consequential API decision.
- Milestone readiness: finite multi-line layout/collection receipts are available
  through the existing public Flex surface and an unpublished built consumer.
  They are not broad wrap conformance, a declared Yoga parity set, a production
  migration, default replacement, packed release, or performance evidence. The
  pinned Yoga receipt still covers only its three numeric nowrap cases.
- Concrete remaining scope: automatic column item dimensions and wrapped intrinsic
  containers; baseline/reverse/RTL/margins/auto minima/box-model conversion and other
  Flex details; general nested intrinsic composition/custom-font invalidation;
  root preparation/transactional geometry and friend-work integration beyond the
  bounded Layer handoff; WASM Grid/remaining layout families; standalone adoption,
  cold/bridge/bundle budgets, portable installed consumers and release policy.
  Current regions are per-Flex numeric buffers with JS normalization/identity maps,
  not the proposed root-owned prepared graph or full input-role invalidation system.
  Paint-only zero solves does not mean zero JS traversal or layout visits.
- Next meaningful milestone is intrinsic nested built-in composition: direct Text
  leaves currently work, but a nested auto-height Flex child still rejects. Use
  known built-in descriptors and existing pure measurement first. A reusable
  descriptor helper can demonstrate a Card without freezing the proposed
  defineLayoutComponent API or speculatively executing an ordinary JSX component.

## Slice 22 delivered: nested built-in intrinsic columns

Observable outcome: the public descriptor-based Card measures a nested nowrap
column of Text at its settled width. Width changes move the following sibling
from y320 to y360; shorter Text moves it to y280. Padding and maximum widths apply
before dependent height measurement. Ordinary components remain opaque: the
zero-size Boundary probe executes only during normal rendering. Shared measurement
context rejects cyclic descriptors and remains usable after rejection.

Evidence: focused failing geometry test reproduced the prior unsupported auto
basis; final focused suite35/35 passes. Repository types, targeted lint, catalog
166 lessons/12 tutorials/33 labs and source discovery pass. Private package rebuild
preserves the unchanged56793-byte WASM fingerprint; five actual learning sources
pass independent strict Bundler/NodeNext typing and import-inactivity checks.
Source/built browser receipts verify320→360→280, moved targets, node reuse and zero
owned resources after disposal. Built provenance includes460private dist inputs.
Focused reviewer found no material issue. Canvas screenshot inspected; no baseline
changed. Node26.9.0/pnpm11.21.0; Node24/full trust not claimed.

Runnable source: http://127.0.0.1:5187/#/examples/layout/wasm-flex-nested-intrinsic
and built: http://127.0.0.1:5188/#/examples/layout/wasm-flex-nested-intrinsic .
Both servers remain running. This is delivery1 of the new group, not consolidation.
No new public API, generalized component preparation or broader Yoga receipt.

Milestone map: nested known built-in composition now works for finite settled
cross widths. General intrinsic feedback, wrapped intrinsic sizing, ordinary
component discovery, custom-font revision invalidation, root transactional prepared
graph, remaining layout families and portable installed release consumers remain
open. Preserve ordinary component opacity and reject percentage/growth feedback
until a separate contract is justified. Outer mixed nested aggregate measurement
is currently uncached: paint reuses WASM solves but still performs host measurement.
This is recorded cost, not a performance or migration-readiness claim.

## Slice 23 delivered: bounded nested aggregate measurement reuse

Known nested nowrap columns now form scalar cache snapshots, resolving every
receiver input even on hits. Opaque declared-size children remain opaque. Existing
region ownership retains at most two measurements per child token; no descriptor
or transaction provision is retained. Paint no longer increases measuredLeaves in
the nested Card. Text, metric font and width changes still invalidate; switching a
computed Text source detaches the former source. Cycles fall back to the existing
measurement diagnostic. No Rust, ABI or public API changes.

Fresh focused suite36/36pass,11.04s; types and independent five-source consumer
checks pass. Source/built public browser checks retain footer320→360→280, current
hit targets, paint measurement reuse and exact teardown. Private build preserves
56793-byte kernel fingerprint. Node26.9.0/pnpm11.21.0; no full trust/Node24 claim.
Targeted lint, catalog166/12/33 and source discovery pass. The same focused
reviewer found no material issue in receiver adoption, scalar snapshots, cycle
fallback or LRU ownership. Both prior URLs remain available on5187/5188.
This is delivery2 of this group.
Milestone map remains as slice22: this closes an observed repeated-measurement
cost, not general intrinsic preparation, font invalidation or production migration.

## Slice 24 delivered: keyed nested membership

The same nested Card now reverses keyed paragraphs and removes/restores main.
Aggregate keys invalidate on order/membership changes. Surviving numeric nodes
persist; removal releases one node and its receiver; editing detached main causes
no measurement/probe render; restore creates one fresh node and uses the latest
Text height. Paint reuses measurements. Generic-font limitation remains explicit.
Source/built URLs are unchanged. Both servers remain running (80069/4601).

Focused failing public test reproduced absent membership behavior before example
changes. Combined suite37/37pass,11.76s; exact restored-height/source-order
assertions subsequently checked in the focused keyed regression and both public
browser lanes. Types, targeted lint, strict five-source consumer checks and
catalog166/12/33 pass. Screenshot inspected; no baseline changed. No core/Rust/API
change in this slice. Node26.9.0/pnpm11.21.0; no full trust/Node24 claim.

## Consolidation 8: slices 22–24

- Exercised nested final-width geometry/cycle recovery, dynamic source/metric/width
  invalidation, bounded reuse, keyed removal/restore and disposal in the combined
  37-test suite. Both actual source/built nested browser lanes pass, including
  exact restored long-text height, moved hits and zero resource ownership.
  Prior wrapped collection browser checks also pass in both lanes (6→4→6→0),
  preserving keyed identities, hit geometry and paint reuse. Built provenance is
  460private dist inputs; kernel unchanged56793bytes.
- Reused the focused reviewer for changed cache and scenario material. No runtime
  finding; tightened restore assertions to prevent stale short-height false
  positives. No overlapping review or broad unchanged-code checks.
- Architecture/reactivity/API/cleanup: one existing region LRU, scalar-only keys,
  shared measurement isolation/cycle detection, current receiver provision refresh,
  no speculative opaque execution, no second scheduler/reactive API. Existing
  helper/example/tool remain the single public scenario; no new scaffolding or
  obsolete runtime path to remove. Updated contract/catalog/README and evidence.
- Proposal milestones1–3 have bounded working receipts, not completed exit gates:
  regions remain per-Flex with JS normalization; no root-wide role-aware prepared
  graph, zero-layout-visit proof or staged geometry publication/preflight. Nested
  builtin composition and Layer allocation handoff work in documented subsets;
  general structural component capability, HtmlBox/focus/Three combined fallible
  preparation and friend-queue integration remain incomplete.
- Milestone4 remains partial finite Flex subset with three pinned Yoga numeric
  nowrap oracle cases; no broad parity or full migration. Milestone5 Grid/other
  layout families still use JS. Milestone6 only has a private symlink consumer,
  not portable installed package evidence. Milestone7 cold/bridge/bundle budgets,
  release policy and reproducible comparative performance remain open. No feature
  completeness, production migration or speedup claim.
- Next addresses a concrete migration blocker rather than another example-only
  control: make the existing opt-in build portable through a local tarball, without
  changing defaults or publishing. General intrinsic/feedback/custom-font semantics
  remain conservative and require separate evidence/contracts before expansion.

## Slice 25 delivered: portable unpublished packed opt-in consumer

Smallest outcome: a local consumer installs the opt-in WASM package from a generated
local tarball and runs the nested Card through public entries without repository
aliases or symlinks. Acceptance: strict Bundler/NodeNext declarations, actual packed
artifact provenance and inert imports; source/built scenarios remain available,
normal build unchanged, cleanup returns to baseline. Preserve notices and document
reproduction. No npm publication, external deployment or default engine change.
Keep this bounded packaging proof separate from production loading/release policy
and broad algorithm conformance. Exactly one next slice; no blocker.

## Resumed delivery estimate — 2026-10-21

Recovered the implementation through slice 24 and consolidation 8 from saved chat
history and this working tree. Slice 25's unfinished packaging tools are the active
slice. Preserve concurrent example-authoring and sandbox changes from other work.

Planning estimate: **36 additional delivery slices**, with a working range of
**30–45**, including slice 25. This is a scope estimate, not a completion promise;
integration findings and approved public contracts can change the count.

| Remaining area                                                    | Estimated slices |
| ----------------------------------------------------------------- | ---------------: |
| Portable packed opt-in consumer                                   |                1 |
| Reactive preparation, incremental work, and lifecycle integration |                8 |
| Remaining Flex semantics and pinned Yoga conformance              |               10 |
| Grid and other layout families on the shared engine               |                8 |
| Standalone adoption and migration tooling                         |                4 |
| Measured optimization and release hardening                       |                5 |

At resumption, only slice 25 was selected for implementation. These area totals are a forecast,
not simultaneous work queues or approval of unresolved API signatures. Consolidate
after three delivered slices, with a fourth allowed when closely related; these
bounded checkpoints are additional to the delivery count. Reassess the forecast at
each consolidation against the proposal's exit gates, not example count alone.

Recovery verification before resuming: experimental Chromium 37 passed; normal
Flex/Text suites 83 passed / 33 skipped; repository typecheck, private built-package
consumer declarations/import inactivity, WASM fingerprints and diff checks passed.
Environment Node 26.9.0 / pnpm 11.21.0; no Node 24 or full trust claim. Recovery
archive of changed/untracked files and a binary tracked patch saved outside the
checkout before new implementation edits; no unrelated changes were committed.

Slice 25 is delivered through `node tooling/packed-layout-consumer.mjs` at
http://127.0.0.1:5189/. It copies the actual nested intrinsic learning source into
an isolated temporary application, installs the generated private core tarball
offline with scripts disabled, and verifies real installed package paths without
symlinks, source aliases or workspace fallback. Strict Bundler/NodeNext consumers
and the public root/JSX nominal identity check pass. The bundled browser inputs
come exclusively from the isolated consumer (217 installed core dist inputs).

The first resumed regression failed on macOS's `/var` versus `/private/var` alias.
Canonicalize the temporary root, compare resolved file URLs as filesystem paths,
and run browser subprocesses asynchronously so the serving process remains live.
Check mode uses an ephemeral localhost port; the manual demo uses 5189. The test
wrapper builds current sources first, addressing the focused review's stale-output
concern. Temporary applications and servers are cleaned up on completion.

The browser checks real WASM execution after inert imports, width/Text changes,
paint measurement reuse, keyed order/membership, current hit geometry and exact
layout resource disposal. Desktop visual inspection confirms the canvas is fully
visible in the initial 1100×820 viewport and Toggle width moves the sibling
320→360. No page errors. Snapshot saved outside the repository. The review found
no blocking defect; whole-scheduler/timer leak stress remains later hardening.
This proves portable local installation, not npm publication, standalone engine
adoption, Node 24 support, broad Yoga conformance or speed superiority.

## Slice 26 delivered: receiver input roles for paint and layout invalidation

Selected slice 26: introduce a bounded private role-aware invalidation foundation
for the existing experimental Flex/Text composition, with one focused failing
public-API test first. Demonstrate that fill-only updates are classified as paint
work while width/text changes request their required layout/measurement work.
Unknown inputs remain conservative. Preserve current subscriptions, receiver
provision adoption, immediate-mode drawing, dynamic dependencies and teardown.
No public API or second reactive graph. Do not claim zero layout-node visits by
moving counters or by scanning every child before a cache hit; root-wide prepared
layout remains a later milestone. One implementation owner, independent migration
gap analysis in parallel, focused review of the changed runtime afterward.

Delivered: existing signal edges carry committed role masks and stage replacement
masks during recollection. Receiver provisions union roles for a shared source;
failed recollection retains the prior committed roles. Writable, readonly-computed
and formula-candidate reads propagate declared roles. Public batches OR each
consumer's masks and still schedule one invalidation. Unclassified application
reads, whole-style replacements and unsupported style categories stay unknown.
This is private classification infrastructure, not a new scheduler or skipped
layout traversal.

Live source Studio: http://127.0.0.1:5187/#/examples/layout/wasm-flex-text.
Paint only records two paint notifications while solves stay2 and measurements4;
Change text records one measurement notification; Toggle width records one layout
notification and preserves nodeCreates3. No page/console errors; canvas screenshot
inspected. Existing public imports/authoring remain unchanged. The independent
packed slice25 demo on5189 remains an isolated installed copy.

Verification: experimental public/receiver Chromium suites43 passed; normal signal
graph/consumer/provision suites70 passed; repository typecheck, targeted changed
runtime ESLint and diff checks passed. Focused review found lost batched masks and
missing computed-role forwarding; both fixed and re-reviewed. Direct formula-
candidate role assertion and broader transform classification remain later work.
Node26.9.0/pnpm11.21.0/Chromium; no aggregate trust/Node24/performance claim.

Process exception: the implementation agent began role infrastructure before the
new public regression. A focused failed-collection test then exposed missing
writable-read role forwarding and passed after that fix. This is useful failure
evidence, but not the required test-first sequence; do not describe it as such.
Require a recorded focused baseline failure before production edits in subsequent
slices. A recovered-baseline replay is recorded separately in the field notes.

Parallel support produced a proposed33-capability manifest in the isolated
conformance worktree. It is imported under
`docs/architecture/proposals/layout-engine/capability-manifest.json`, credits only
three pinned Yoga cases, and keeps unaccepted API signatures and missing release
gates explicit. It is support work, not an additional delivered capability slice.
Group9 has two deliveries; consolidate after the next closely related slice.

## Root-owned shared WASM arena (slice 42, delivered)

Independent mounted Flex regions should keep separate handles, records/caches and
lifecycle while sharing one mutable WASM instance per owning root. Different roots
remain isolated; standalone pure helpers keep isolated temporary owners. Establish
public two-region/two-root geometry, work-reuse and deterministic teardown evidence
before changing ownership. Do not claim a complete prepared graph or new public API.

Slice 26 delivery (2026-10-21): completed the in-progress private role foundation
before any loading migration. Existing receiver edges carry staged masks; successful
collection replaces them, rollback preserves committed masks, provisions adopt
combined roles, and batched changes retain all roles with one renderer invalidation.
Declared style inputs and Text content are classified; unknown inputs retain the
conservative redraw path. Removed an unused pending-role accumulator: actual
role-directed work admission remains later work. No second graph or scheduler.

Fresh focused verification on Node26.9.0/pnpm11.21.0/Playwright Chromium:
108 tests pass across layout-WASM, input provisions, signal graph and renderer
consumer suites. Source and built nested public checks prove width/layout,
Text/measurement and fill/paint roles plus geometry/hits, bounded measurement reuse,
detached-source inactivity and exact cleanup. Built receipt has460private dist
inputs; isolated tarball has217installed dist inputs, strict Bundler/NodeNext,
actual WASM and import inactivity. The browser check now asserts role diagnostics
in all three consumer lanes; these are receiver notifications, not counts of
layout-node visits or a performance claim. Unchanged56793-byte artifact.

Focused review found no material issue. Targeted lint, doc formatting and diff
checks pass. Root typecheck passed initially, then a final run failed during
concurrent example-authoring changes (missing default exports in energy-transitions,
chemical-explorer, fabric-explorer and other learning consumers, plus cascading
inference errors). Preserve that work; no final root typecheck or aggregate trust
claim. This does not establish the new loading API, full incremental layout,
Node24verification or feature completion.

Slice ready for feedback: source
http://127.0.0.1:5187/#/examples/layout/wasm-flex-nested-intrinsic and built
http://127.0.0.1:5188/#/examples/layout/wasm-flex-nested-intrinsic. Inspect Paint only,
Change Text and Toggle width: role counters distinguish inputs while existing
geometry/input/cleanup behavior remains. Built server restarted from playground
(session72528) after an initial wrong-directory launch timed out; final check passes.
Loading is the queued focused migration below; no loading production code started.

## Queued loading migration after slice 26

Accepted design amendment, 2026-10-21. Continue slice 26 (receiver input roles)
before starting loading implementation. This queue item does not change the
historical synchronous slice receipts or claim that the new exports exist today.
Loading is no longer an unresolved design choice; remaining release gates still
require executable evidence. Reassess slice numbering and forecasts after delivery.

Public contract presented before implementation:

```ts
// @pibbl/core
export function pibbl(
  canvas: HTMLCanvasElement,
  element: PibblNode,
  config?: PibblConfig,
): Promise<PibblController>;
export function prepareLayoutEngine(): Promise<void>;
// @pibbl/core/sync
export function pibblSync(
  canvas: HTMLCanvasElement,
  element: PibblNode,
  config?: PibblConfig,
): PibblController;
```

Use the [accepted architecture](../architecture/proposals/layout-engine/design.md#packaging-and-initialization)
and [migration examples](../architecture/proposals/layout-engine/migration-and-evidence.md#mount-loading-migration).

Focused first implementation slice:

1. Add a failing public mount regression before runtime edits: a delayed external
   asset prevents component execution/mount work, then `await pibbl()` returns a
   usable controller and ordinary Flex/Text geometry/hits/cleanup work. Pair with
   the synchronous equivalent through the separate sync entry.
2. Generate both forms from the same fingerprinted binary. Add inert external
   loader/shared compatible-module cache, separate embedded entry and mount-owned
   instances/memory. Preserve synchronous layout/measurement/signals/frame phases.
3. Implement shared attempts, evicted failures/retry, per-caller abort and
   same-canvas request arbitration exactly as specified. Focused controlled-load
   evidence covers concurrent waiters, sync winning an async race, cancellation,
   supersession, disposal, existing-controller updates and failure cleanup; count
   compilation/instances deterministically instead of relying on timing or GC.
4. Migrate all affected callers/types/exports, integrations, Studio launch/disposal
   and editor declarations, tests, learning examples, JSDoc and public docs
   together. Do not leave a controller/Promise union, old root sync alias or a
   default production solver replacement hidden in this packaging change.
5. Supply source and built public browser evidence plus an isolated packed
   installation with strict Bundler/NodeNext types, no workspace fallback, actual
   external-asset fetch/compilation, sync execution and teardown. Prove emitted
   assets resolve under deployment base paths, and offline sync succeeds while
   external loading fails explicitly. Record CSP/MIME/CORS requirements.
6. Bundle an async-only entry that actually mounts (not an unused import). Assert
   its metadata excludes embedded inputs and output excludes Base64 bytes; verify
   external asset reachability separately. Compare sync/external fingerprints and
   demonstrate shared compiled code with independent mutable mount state. Include
   inert-import evidence for both entries and no second scheduler.
7. Deliver the exact source/built/packed demo URLs and inspection steps as soon as
   focused checks pass. Broader failure matrix, packaging/release hardening and
   aggregate verification follow the slice feedback and proportional review.

These are future acceptance requirements, not fresh test results. Existing slice
25 source/built/packed evidence validates its synchronous experimental package
only. Preserve field notes and completed implementation records without rewriting
those results as evidence for the accepted loading API.

## Slice 27 ready for feedback: external loading and explicit sync mounting

Delivered 2026-10-21 in the isolated `codex/layout-loading-slice` checkout. The
accepted loading signatures above are implemented. Root mounting awaits a shared,
fingerprint-verified external binary; `prepareLayoutEngine` warms that code;
`@pibbl/core/sync` mounts synchronously from the matching embedded binary. Layout
and frame execution remain synchronous after preparation. This slice does not
replace the normal JavaScript solver with the experimental WASM solver.

A focused public test failed before production edits: `pibbl()` returned a
controller instead of the required Promise. The completed public suite covers
failed loading and retry before mount admission, shared preparation, caller abort,
same-canvas supersession including a sync winner, live-mount updates, original
lifetime/config preservation, disposal preventing resurrection, Flex/Text geometry,
input and teardown. Loader tests additionally cover fingerprint rejection, stale
completion and fresh import inertness with counters installed before import.

All affected synchronous test/lab hosts use the explicit sync entry. Application
hosts, public mounting guides, React cleanup, Studio preview startup/cancellation,
package exports, declarations and editor inventory use their respective fixed
contracts. The concurrent named-component migration was captured as prerequisite
commit `d4ef5325`; its diagnostic lifetime corrections are separate commit
`5855d4a8`. Neither is folded into the loading commit.

Fresh evidence on macOS, Node 26.9.0, pnpm 11.21.0 installed dependencies and
Playwright Chromium (2026-10-21):

- Public `layout-loading.test.tsx`: 8 passed in source `layout-wasm`, normal built,
  and private `layout-wasm-built` modes.
- Focused normal browser lane: 69 passed; focused WASM lane: 90 passed across
  layout slices, direct Flex/CSS compatibility, signal inputs and loader tests.
- `node tooling/build-layout-wasm.mjs --check`: 56,793-byte binary, matching source
  fingerprint and generated forms.
- Core declaration/build scripts and isolated packed loading consumer passed:
  offline tarball installation, strict Bundler/NodeNext types, real external fetch,
  synchronous zero-fetch mount and async-only embedded-payload exclusion.
- `node --import tsx tooling/verify-studio-pivot.mjs`: source/built/editor exact
  export parity and runtime/Three addons passed. Public JSDoc audit and Studio
  docs metadata/routes/links/search checks passed. Changed-code lint passed.
- Direct repository TypeScript check has no loading migration errors; it still
  reports three missing Astro/Starlight modules in this unprovisioned isolated
  website checkout. `pnpm` commands reject cross-checkout dependency symlinks, so
  focused verification invoked installed tool entry points directly. No Node 24
  aggregate trust result is claimed.

Hands-on source: `http://127.0.0.1:5192/#/examples/layout/wasm-flex-text`.
Private built: `http://127.0.0.1:5193/#/examples/layout/wasm-flex-text`.
Scroll the live Canvas into view, toggle width, change text and click paragraphs.
Both previews rendered the experimental diagnostics after async startup. Browser
checks caught and corrected the missing sync editor module and built-loader URL
rewrite. The broader default-solver migration, paint-only Flex allocation reuse,
release hardening and aggregate trust gate remain subsequent work; this is a slice
ready for feedback, not completion of the full layout-engine rework.
