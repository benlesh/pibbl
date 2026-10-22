# 010 — Experimental layout engine rework

## Current checkpoint and single next slice — 2026-10-22

Latest delivery is slice49 (known Layer-to-Flex preparation/adoption).
Slice48 is `cb863bc2` (finite HTML projection preparation).
Slice47 `9a7b1b0a` prepares pure described Flex roots; slice46 `242cba11` handles
direct and opaque-boundary Flex entries. Every slice has its own commit.
Consolidation46–48 is recorded below. The fixed33-capability/seven-gate denominator
is unchanged; all seven gates remain open. The next prerequisite is selected in the single NEXT heading below. Source5192/built5193,
`#/testing/layout-preflight`: Fail HTML projection, Recover HTML, then Native HTML
host. Earlier layout failure/recovery controls remain available.

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

| Exit                                               | Required completion evidence                                                                                                                                                                                                                                                                             | Current dependency or blocker                                                                                                                                                                                |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Flex and native sizing                             | Implement and classify the accepted matrix: reverse/wrap-reverse, margins/auto margins, percentages/gaps, box sizing/borders, aspect ratio, baselines, RTL/logical edges, containing blocks and hidden/contents participation; positive/negative/interaction geometry fixtures for every supported entry | Current experimental subset is bounded; unresolved native minimum/provider and precedence policies require exact designs before those paths broaden                                                          |
| Grid and other layout families                     | Preserve Absolute/Overlay/Flow and complete the declared Grid track/placement/implicit/intrinsic target, with mixed nested examples and semantic geometry tests                                                                                                                                          | General nested preparation and intrinsic constraints must be available first; current Grid subset is not completion                                                                                          |
| Prepared transactional geometry and reactive reuse | One root-wide prepared ownership model; stable identity, changed-geometry publication, rollback/failure isolation, receiver roles and bounded invalidation; public nested component/Layer/external-renderer tests with deterministic cleanup                                                             | Shared root instances, bounded known Flex plans, pure Card/known columns and frozen allocation caches are foundations, not a full graph or atomic publication                                                |
| Migration and conformance                          | Version/commit/configuration-bound Yoga corpus with explicit Pibbl conversions/divergences; supported public Pibbl migration app and documented framework-author path using the same semantics; all unsupported entries visible                                                                          | Five exact pinned Yoga fixtures exist, including the Rectangle conversion cases from slice37; the broad classified corpus remains incomplete. Standalone API details must follow the public design agreement |
| Reproducible performance                           | Comparable kernel, JS integration and whole Canvas workloads, structural work/allocation counts and reproducible timing receipts under documented environments                                                                                                                                           | Correct broad graph/algorithms precede timing claims; current counters demonstrate only their bounded paths                                                                                                  |
| Final integration and release                      | Accepted behavior migrated across consumers/docs/editor/types/packed output, source/built browser and lifecycle evidence, documented Node24/pnpm11.21 trust gate, then the requested separate hyper-critical whole-codebase review                                                                       | Full supported behavior and prior exits must land before final aggregate verification/review; Node26 receipts are not Node24 release evidence                                                                |

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
