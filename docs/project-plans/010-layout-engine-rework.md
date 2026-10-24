# 010 — Experimental layout engine rework

## Current checkpoint and single next slice — 2026-10-24

Public lesson companion for142–144: physical percentage placement combines
natural-height wrapping Text, a toggled static/relative card and an absolute
badge. Source: `http://127.0.0.1:5192/#/examples/layout/wasm-flex-percent-placement`;
built: `http://127.0.0.1:5193/#/examples/layout/wasm-flex-percent-placement`.
Resize the cards, toggle the relative offset, and click the green card/red badge.
Fresh Node26.9.0/Chromium checks passed one focused browser test (414 skipped),
source and built geometry/pixels, Text reflow from11 to12 draw lines, both click
targets, and cleanup counters `[0,0,0]`; built proof used469 dist inputs.
Typecheck, changed-code lint, catalog (170 lessons/12 snapshots/33 labs), and
Studio documentation checks passed. This companion repairs missing Studio
positioning declarations and strict inline authoring for the older containing
owner. Layout type headings/frontmatter now follow the required alphabetical
order. The comparison driver checks the actual `grow` flow gap per fixture and
navigates the containing-direction section rather than the newer Latest proof.
No new runtime behavior, capability promotion, or aggregate Node24 trust claim.
Slice145 started with two public tests failing numeric-only admission before
production changes; its completed evidence is recorded below.

Latest delivery is slice182 (shared real Text measurement before auto-cross placement).
Slice181 is `f21ce9dd` (natural column widths across parent directions).
Slice180 is `767ad9e2` (resolved percentage/aspect cross size before auto margins).
Consolidation60 is `f5083bcb` for178–180; the next slice is183.
Slice179 is `8384334d` (wrapped-row Text natural basis and final-width sizing).
Slice178 is `1368b962` (wrapped column Text natural cross sizing).
Slice177 is `2173ccfb` (native normal-owner phases and staged zero/auto margins).
Consolidation59 is `750fb588` for175–177; consolidation60 covers178–180 before further production.
Slice176 is `3d4fcfee` (known-layout natural column widths).
Slice175 is `6adf0e2b` (paired column natural width with side auto margins).
Slice174 is `fabe4508` (uniform intrinsic auto-margin normalization).
Slice173 is `de0a5fe7` (intrinsic physical cross auto margins).
Slice172 is `20bb1bc8` (intrinsic physical main auto margins).
Slice171 is `e4fc8815` (native main contribution versus final content).
Slice170 is `7ea267ea`; slice169 is `f0d087a1`.
Slice168 is `de3945c1`; slice167 is `91470858`; slice166 is `fcc06741`.
Consolidation56 is `2fd34f0e` for166–168. Next is183: remaining finite paired/known measurement admission branches.
Slice177 repaired the bounds-specific counterexample and reverified the prior
owner/min-max closure matrix. Fixed33 is now10complete/12experimental/
5partial/5missing/1excluded. All seven release gates remain open; independent
intrinsic graphs, automatic minima and other measurement work remain outstanding.
Consolidation55 is `98bf8b8d` for163–165.
Slice165 is `cc334a0a` (empty-Rectangle aspect automatic minimum).
Slice164 is `ff72e0ab` (wrapped-leaf aggregate measurement reuse).
Slice163 is `1ca71af2` (nested described paired leaf measurement).
Slice162 is `dcae6348` (parent-owned prepared measurement reuse).
Consolidation54 is `56da579c` for160–162.
Slice161 is `b95d3412` (native final-width nested row measurement).
Slice160 is `f49be444` (prepared structural paired measurement).
Slice159 is `0b893348` (wrapped Text first/last baseline metrics).
Consolidation53 is `370015c4` for157–159.
Slice158 is `40965850` (single-line Text baselines from live Canvas metrics).
Slice157 is `72da2305`; its public Studio companion is `b725101c`.
Consolidation52 is `8f65cb34` for154–156.
Slice156 is `5e819d2f` (experimental first-baseline provider composition).
Slice155 is `7c60ab49` (public mixed-track spanning Grid evidence).
Slice154 is `a3d817fa` (column Text natural cross-width with auto side margin).
Slice153 is `4bd6ff9b` (exact caller-height column measurement).
Consolidation51 is `35ff8f3b` for151–153.
Slice152 is `5cb9ca57` (exact caller-width row measurement).
Slice151 is `58dc7783` (symmetric decorated reverse main bounds).
Slice150 is `f592b00c` (decorated reverse main percentage bounds).
Consolidation50 is `a88ea6c4` for148–150.
Slice149 is `bc74da58` (bounded column provider automatic minimum).
Slice148 is `91b36dca` (reverse composition capability evidence).
Slice147 is `f6e45350` (logical absolute insets).
Consolidation49 is `67428b3b` for145–147.
Slice146 is `3db077ea` (fixed direct wrapped containing owners).
Slice145 is `c70ac2fd` (finite percentage absolute dimensions/bounds).
Slice144 is `ced23362` (physical percentage static/relative insets).
The public lesson companion for142–144 is `4cbc1ea6`.
Consolidation48 is `70b2a85e` for142–144.
Slice143 is `f644de8c` (physical percentage absolute insets).
Slice142 is `357167b2` (wrapped absolute omitted-axis alignment).
Slice141 is `187bec28` (static/relative primitive leaves across wrapped Flex).
Consolidation47 is `4afb3c84` for139–141.
Slice140 is `a2308b97` (physically anchored absolute profiles across wrapped Flex).
Slice139 is `f79b258f` (unwrapped Text natural height and both-auto ink dimensions).
Slice138 is `b84f5322` (unwrapped Text natural absolute width).
Consolidation46 is `c72afa72` for136–138.
Slice137 is `3ad9598a` (wrapped Text automatic absolute height).
Slice136 is `6c30acfb` (fixed physical-inset absolute leaves in normal wrapped rows).
Slice135 is `65b8bb94` (fixed declarative containing chains across nowrap directions).
Consolidation45 is `bf71abc6` for133–135.
Slice134 is `4faba1f1` (paired absolute providers across main directions).
Slice133 is `f639bce8` (absolute aspect main directions).
Slice132 is `43f17fc1` (opposing-inset absolute size/bounds main directions).
Slice131 is `b0ab5061` (physical static/relative main directions).
Slice130 is `2bbe4181` (fixed absolute main directions).
Slice129 is `398dfa54` (bounded measured absolute natural height).
Slice128 is `2539ff32` (bounded measured absolute natural width).
Slice127 is `dfc5843c` (bounded absolute aspect-ratio derivation).
Consolidation44 is `2d372f72` for130–132; consolidation43 is `ce7f45a1` for127–129; consolidation42 is `99dfdf49` for124–126.
Slice126 is `0bda56ec` (numeric absolute size bounds).
Slice125 is `6603731e` (declarative static Flex containing-block ownership).
Slice124 is `77452150` (opposing-inset derived absolute dimensions).
Slice123 is `51bc20ad` (fixed absolute children with axis-wise alignment).
Consolidation41 for121–123 passes below.
Slice122 is `057873a3` (bounded direct-Flex absolute participation).
Slice121 is `f4605ef2` (decorated-parent static/relative evidence).
Slice120 is `a9d79df8` (bounded explicit direct-Flex static/relative positioning).
Consolidation40 is `d06c7fc6` for118–120 (one corrected sequential-walk selector).
Slice119 is `346bc95d` (concise public corpus and exhaustive private rehearsal).
Slice118 is `19bd8853` (measurement-only reactive column content evidence).
Slice117 is `dd7f292f` (finite column custom-provider exact-width measurement).
Consolidation39 passes for115–117 below.
Slice116 is `42e182cb` (definite nested column percentage cross minima).
Slice115 is `6e1e1d3e` (column caps and one-click Latest proof).
Slice114 is `4070b037` (definite nested percentage cross maxima).
Consolidation38 passes below for112–114.
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
unchanged; all seven gates remain open. Earlier checkpoints are recorded below.
Current corpus:721 records:530 unclassified geometry comparisons,183 preserved-semantic comparisons and8 classified native font-source comparisons. Nine recorded column-width queries deliberately differ (five custom providers, four Text).
The concise public lesson retains5 cases; the complete corpus is private testing
input. Current runnable source/built comparison:
`http://127.0.0.1:5192/#/testing/layout-yoga-migration` and port5193.
Click Latest for the four numeric baseline-provider cases; Text baseline lessons use live Canvas metrics separately and make no native font-parity claim.
The public lesson is `#/examples/layout/wasm-yoga-migration`.

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

| Exit                                               | Required completion evidence                                                                                                                                                                                                                                                                             | Current dependency or blocker                                                                                                                                                                                             |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flex and native sizing                             | Implement and classify the accepted matrix: reverse/wrap-reverse, margins/auto margins, percentages/gaps, box sizing/borders, aspect ratio, baselines, RTL/logical edges, containing blocks and hidden/contents participation; positive/negative/interaction geometry fixtures for every supported entry | Current experimental subset is bounded; unresolved native minimum/provider and precedence policies require exact designs before those paths broaden                                                                       |
| Grid and other layout families                     | Preserve Absolute/Overlay/Flow and complete the declared Grid track/placement/implicit/intrinsic target, with mixed nested examples and semantic geometry tests                                                                                                                                          | General nested preparation and intrinsic constraints must be available first; current Grid subset is not completion                                                                                                       |
| Prepared transactional geometry and reactive reuse | One root-wide prepared ownership model; stable identity, changed-geometry publication, rollback/failure isolation, receiver roles and bounded invalidation; public nested component/Layer/external-renderer tests with deterministic cleanup                                                             | Shared root instances, bounded known Flex plans, pure Card/known columns and frozen allocation caches are foundations, not a full graph or atomic publication                                                             |
| Migration and conformance                          | Version/commit/configuration-bound Yoga corpus with explicit Pibbl conversions/divergences; supported public Pibbl migration app and documented framework-author path using the same semantics; all unsupported entries visible                                                                          | The current373-record pinned corpus covers bounded row/column/reverse/wrap and conversion paths; broad supported-matrix classification remains incomplete. Standalone API details must follow the public design agreement |
| Reproducible performance                           | Comparable kernel, JS integration and whole Canvas workloads, structural work/allocation counts and reproducible timing receipts under documented environments                                                                                                                                           | Correct broad graph/algorithms precede timing claims; current counters demonstrate only their bounded paths                                                                                                               |
| Final integration and release                      | Accepted behavior migrated across consumers/docs/editor/types/packed output, source/built browser and lifecycle evidence, documented Node24/pnpm11.21 trust gate, then the requested separate hyper-critical whole-codebase review                                                                       | Full supported behavior and prior exits must land before final aggregate verification/review; Node26 receipts are not Node24 release evidence                                                                             |

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

## Consolidation 38 completed for112–114

Separate commits112 `3453bbe3`,113 `b78d69ec`,114 `4070b037`.
Fresh23-file matrix: experimental528pass/9skip537 (78.92s); ordinary190pass/
347skip537 (3.74s). Logs `/tmp/pibbl-consolidation38-focused.txt` and
`/tmp/pibbl-consolidation38-normal.txt`. Native314=220matches+94classified,
auto104/direction24 unchanged. Node26.9.0, Chromium; no Node24 aggregate trust or
controlled performance claim. Fixed33 remains8complete/11experimental/6partial/
7missing/1excluded; all7release gates remain open. No further overlapping review
or repeated broad gate is needed without a new change or concern.

Bounded readability assessment: the roughly250KB public comparison embeds the
entire pinned corpus. Extracting a sibling data import violates the sandbox's
public-package-only authoring boundary; public projection alone breaks full-family
source/built Next-case replay. Safe separation needs a concise self-contained
public projection plus a private full-corpus browser proving surface, preserving
one generated rendering body and all existing exhaustive receipts. The existing
catalog has no fixture-props injection. Defer extraction until that bounded test-
host seam is concrete; do not silently reduce coverage, duplicate hand-maintained
rendering, or add a public runtime API. This assessment is complete; readability
cleanup remains tracked work before feature completion.

## Delivered definite nested column percentage cross maxima (slice 115)

Two pinned scale0 cases rotate the decorated definite cap to column-reverse/wrap.
Border-box width144→204/height244 with paddingL20/R20/T10/B30 and border2 gives
content cross100→160/main200. A declared width60/maxWidth25% and its100%-width
leaves receive25→40. World leaves remain at22,132/172; C stays74,132. Point52,136
misses initially and targets A1 after expansion. Actual built-in A is used.

Fresh focused2pass/408skip410 includes the geometry case and a one-click public
navigation contract. The new Latest proof button failed its observable test before
implementation, then passed; it opens the last pair's initial record, Next case
reaches resized, and existing Next section remains usable. Source/private-built
2matches,469builtinputs, no errors/cleanup0; installed245distinput strict types,
world geometry, target expansion, stable keys/main solves/lines, zero paint
measurement and cleanup pass. Latest-proof screenshot was inspected. No core
runtime/API/ABI/binary change, invented production RED or baseline rewrite.

Native316=222matches+94classified, auto104/direction24 unchanged. Matching
v5/68649byte kernel and tarball
`6ccf53d136422d04d974fa7a34a4356f91298d4f77c6387c85f6b6b632417b4b` unchanged.
Types/lint/docs/catalog/discovery pass; scoped review found no material gap.
`flex.min-max` remains partial; fixed33/all7open gate statuses unchanged.
Node26.9.0/Chromium, no Node24 aggregate trust claim. Hands-on ports5192/5193,
`#/examples/layout/wasm-yoga-migration`: Latest proof then Next case. Legacy section
25 navigation also remains available.

## Delivered definite nested column percentage cross minima (slice 116)

The finite decorated column-reverse owner now has a pinned minimum pair too:
declared nested width20/minWidth60% produces60→96 as content cross grows100→160.
Its100%-width leaves retain y132/172 and grow60→96; C moves from94,132 to130,132.
Point100,136 transfers C→A1, then134,136 targets moved C. Direct built-in A,
exact nested/B/C world geometry and keyed identity are exercised throughout.

Fresh focused2pass/409skip411 includes Latest-proof navigation. Source/private-built
2matches with469builtinputs, no errors/disposal0; installed245distinput strict
Bundler/NodeNext geometry, target transfer, main/line/node reuse, zero paint
measurement and cleanup pass. Types/lint/docs/catalog/discovery pass. No core
runtime/API/ABI/binary change, fabricated production RED or baseline rewrite.
Native318=224matches+94classified; auto104/direction24 unchanged. v5/68649bytes
and tarball SHA
`6ccf53d136422d04d974fa7a34a4356f91298d4f77c6387c85f6b6b632417b4b` unchanged.

This completes the bounded both-axis decorated nested cross-min/max matrix,
not general min/max parity. Reversed main-axis percentage caps/floors and
indefinite-owner/measurement policy remain open; fixed33/all7gates unchanged.
Node26.9.0/Chromium, no Node24 aggregate trust claim. Hands-on source/built ports
5192/5193, `#/examples/layout/wasm-yoga-migration`: Latest proof then Next case;
section26 remains available. Inspect wider leaves, moved C and target transfer.

## Slice 117: finite-column custom-provider exact-width measurement

The public failing test reproduced a40px-wide eight-job custom queue measuring at
its120px parent availability and returning20px height instead of40px. The bounded
experimental forward LTR nowrap column now passes exact numeric content width
and unbounded natural height to the existing paired provider cache. With explicit
minHeight0/basisauto/grow0/shrink0, width40→60 gives height40→30 and moves the
following20px target y40→30. Existing public callbacks/signatures are unchanged.
Cross bounds, automatic width, reverse/RTL/wrap and general intrinsic graphs stay
outside this admission. `measurement.custom-leaf` remains partial; all7 release
gates remain open and the fixed33-capability denominator is unchanged.

Fresh public RED then GREEN:1passed/411skipped412; measurement/purity/cache
3files16passed. Source/built comparison replay matches both new pinned Yoga cases,
469private built inputs, stable keyed identity, old/new follower targets, paint-only
measurement/solve reuse and exact native cleanup. Screenshot inspected. Native
reproduction now contains320cases:226matches and94classified differences. Kernel
remains68649bytes, fingerprint unchanged. Types/changed-code lint pass. Environment
Node26.9.0/macOS Chromium; no Node24 aggregate trust claim.

Scoped review caught two proof/scope issues: the installed fixture recreated child
descriptors and therefore correctly lost conservative cache reuse; it now keeps
stable descriptors like the public test. The runtime admission was narrowed to
zero shrink, matching the delivered contract. Final installed-package rebuild passes245installed dist inputs, strict
Bundler/NodeNext consumers, the custom-column receipt,104auto-margin fixtures
and lifecycle cleanup; tarball SHA256
`ec98002ca94fb39b3e74edb100c2d446b11d9114c5b7041d7d2fa4cbcda05985`.
Documentation109compiler RED probes, public JSDoc, catalog/discovery and
source/built final replays pass. No Rust changes or fresh Rust test claim.

## Consolidation39 completed for slices115–117

Separate delivery commits115 `6e1e1d3e`,116 `42e182cb`,117 `dd7f292f`.
Fresh23-file experimental matrix:532passed/9skipped541 in79.64s. Normal matrix:
190passed/351skipped541 in3.76s. Expected negative-case diagnostic output appears;
no failures. Logs `/tmp/pibbl-consolidation39-focused.txt` and
`/tmp/pibbl-consolidation39-normal.txt`. Source/built/installed117 evidence above
remains current. Manifest now links the actual public/packed/native custom-leaf
proofs. No release gate/status promotion, Node24 trust claim or baseline rewrite.
The public learning corpus readability gap remains tracked: preserve exhaustive
headless proof coverage while introducing a concise copyable surface through the
existing private fixture-host seam; do not merely delete/project recorded cases.

## Slice118: measurement-only reactive column content evidence

A stable custom queue reads a jobs signal only during its existing constrained
`measure` callback. At fixed40px width, jobs8→12 produces height40→60 and moves
its follower y40→60. The focused public test passes unchanged production code:
1passed/412skipped413. This is evidence-only, not a new runtime capability or a
production RED. An initial test fixture incorrectly treated an automatically
resolved signal prop as a signal object; the corrected fixture reads the closure
signal in `measure`, exercising the intended dependency contract.

The contextual More jobs control uses a separate child component so changing
sections does not recreate provider descriptors. Its12-job state visibly paints
12tiles and explicitly labels the content mutation as Pibbl-only; the pinned
Yoga reference retains8jobs. Source/built replay first matches both native cases,
then verifies width60 content height30→40, follower target transfer and reset.
Both pass with no browser errors and exact disposal; private built469inputs.
Screenshot `/tmp/pibbl-slice118-content-mutation.png` inspected. Public/installed
proofs additionally require exactly one measurement for changed content, stable
native nodes and no measurement/solve on subsequent sibling paint.

Installed strict Bundler/NodeNext proof passes245distinputs,104auto-margin cases
and lifecycle checks. Tarball remains
`ec98002ca94fb39b3e74edb100c2d446b11d9114c5b7041d7d2fa4cbcda05985`.
Types/changed-code lint/docs109RED probes pass. No core/ABI/binary/native-corpus
change:320cases/226matches/94classified,68649byte kernel. No status promotion;
fixed33capabilities/all7gates remain open. Node26.9.0/macOS Chromium; no Node24
aggregate trust claim. Consolidation40 is due after118–120.

## Slice119 delivered: public lesson and private exhaustive rehearsal

The public comparison source shrinks268287→43693bytes by keeping five pinned
cases (grow/cap/shrink and the measured custom-column pair). The same exported
renderer accepts typed fixture props from a lazy private iframe host containing
all320records. No public runtime API, duplicate renderer, removed fixture or
classification change. The shared renderer remains substantial; this fixes the
embedded corpus/readability problem, not every presentation concern.

Actual focused RED: the private route had no rehearsal iframe. A second RED
exposed local More jobs mutation leaking across navigation (12 retained instead
of8); all case/section/latest navigation now restores the pinned input. Public
editor typing uses checked fixture fields; public source imports public core only.
The private bundle is dynamically imported only in its testing route. Existing
full browser family selectors now target that route; `--public` independently
runs the five-case catalog lesson. All existing public tests receive the full
recording through the same props. A standalone source-data check compares every default field against
the pinned record, preventing silent copy drift after generator changes.

Fresh focused3passed/410skipped413 (full fixture walks and navigation), plus
a standalone check that all five public defaults agree with the full recording.
TypeScript passes. Public source5matches; public source/built custom pair plus
content mutation/navigation reset pass, built469inputs, no errors/cleanup0.
Private source/built route proofs show320ordered cases, actual renderer count320,
exact provenance and227coreinputs in their respective source/dist lanes. Private
column interaction replay also passes. These private synchronous public-entry
hosts are distinct from the asynchronous public editor preview and installed
package lane. No Node24 trust or full program completion claim.

Hands-on source public `http://127.0.0.1:5192/#/examples/layout/wasm-yoga-migration`;
private `http://127.0.0.1:5192/#/testing/layout-yoga-migration`. Built equivalents
use5193. Focused readiness is available before proportional final verification.
Scoped boundary review found no remaining material issue after lazy import and
fresh reference-read corrections; only changed code was reviewed.
The first full source/built walk caught decorative footer Text blocking target D
in the tall nested-column case132; expected geometry already matched. Both notes
now use pointerEvents none. Focused nested percentage replay passes all8cases,
including the previously blocked target, with227source inputs/errors[]/cleanup0.
The added --nested-percentages selector preserves this exact regression proof.
Earlier interrupted/failed full walks are retained as diagnostic receipts, not
reported as passes. The final full walk uses the corrected source.

The next full walk passed312cases, then exposed a driver-only cross-family state
assumption: the initial maximum fixture was incorrectly compared as a resize of
the prior minimum fixture. Pair state now stores its name and is compared only
for the matching -resized fixture. Fresh `--nested-cross-matrix` source/built runs
pass all10cases, and final custom-provider source/built runs pass both tail cases
including content mutation and navigation reset. An explicit union check confirms
all320unique records were exercised in each lane:312sequential prefix +10repaired
matrix +2tail (four duplicates). This is **segmented evidence**, not an
uninterrupted full320pass. Receipts:
`/tmp/pibbl-slice119-full-{source,built}-complete.txt`,
`/tmp/pibbl-slice119-cross-matrix-{source,built}.txt`,
`/tmp/pibbl-slice119-tail-{source,built}.txt`, and
`/tmp/pibbl-slice119-segmented-coverage.txt`.

Public final source/built receipts independently require zero private corpus
requests, geometry/content/navigation and exact cleanup; built469inputs.
Private focused proofs use227source/dist inputs. Installed245inputs and strict
Bundler/NodeNext pass with unchanged tarball
`ec98002ca94fb39b3e74edb100c2d446b11d9114c5b7041d7d2fa4cbcda05985`.
Docs109RED probes, catalog/discovery, public JSDoc, TypeScript and changed-code
lint pass. The public-default coherence check is wired into scenarios:check.
No runtime/ABI/kernel change or status promotion:33capabilities remain8complete,
11experimental,6partial,7missing,1excluded; all7group gates open. Node26.9.0/macOS
Chromium, no Node24 aggregate trust claim. Full program review stays at the end.

## Slice120 delivered: explicit finite Flex static and relative positioning

Public `style.position: "static" | "relative"` plus numeric `right`/`bottom`
join legacy `left`/`top`. The admitted path is direct finite experimental
row-nowrap Flex children in LTR/RTL. Static ignores insets; relative moves final
paint/hit/focus geometry once while preserving sibling slots. Left wins LTR,
right wins RTL, top wins vertically. Left/top retain legacy Length types for
omitted mode; all explicit-mode insets must be finite numbers. Absolute,
containing blocks, columns, wrapping and other placement contexts remain open.
Unsupported contexts, unmoded opposite insets and modified forwarded position
styles reject explicitly. Exact style forwarding consumes placement once.

Test-first receipt `/tmp/pibbl-slice120-public-red.txt` records the initial
explicit-static rejection; `/tmp/pibbl-slice120-boundary-red-final.txt` records
six boundary failures before the fix (four missing rejections, two diagnostic
prefix mismatches), with six existing tests passing. Initial test-harness
cleanup faults are diagnostic receipts, not runtime regressions. Final focused
position tests pass17; normal-mode earlier12pass/4skip; legacy geometry/layout
regressions67pass; Latest-proof navigation1pass/412skip. Conservative component
invalidation is preserved: a component reading position/direction signals may
recreate props and solve; receiver-owned paint-only updates reuse layout.

Pinned Yoga3.2.1 native reproduction adds six isolated cases:326total,
232matches/94classified differences. No WASM ABI/kernel/Rust change:68649bytes,
SHA256 `029fd944e878b879a235461dcfac17219948569198795428caff12c4c388bfe9`.
Final source/built six-case replays pass with227core/dist inputs, no browser
errors, exact geometry/hits/keyed identity and cleanup[0,0,0]. Logs
`/tmp/pibbl-slice120-source-final.txt`, `...built-final.txt`. Public five-case
lesson remains separate from exhaustive private fixtures. Fresh installed
package proof passes245dist inputs, strict Bundler/NodeNext types, static→relative
LTR/RTL and sole right/bottom geometry/hits/focus/identity/paint reuse/cleanup;
tarball SHA256 `d3c231540ffe509de5960e66bce28dcaa6fd2af0fddf4063effab415cf96c893`.
Docs109RED probes, public JSDoc, TypeScript and changed-code lint pass. Scoped
boundary review found no remaining material issue; modified-forwarding regression
was added after review and passes. No baseline rewritten. Node26.9.0/macOS
Chromium; no Node24 aggregate trust claim. Fixed33capabilities now8complete,
12experimental,6partial,6missing,1excluded; all7group gates remain open.

## Consolidation40 completed for slices118–120

Separate delivery commits118 `19bd8853`,119 `346bc95d`,120 `a9d79df8`.
Fresh25-file experimental matrix initially549passed/1failed/9skipped559 in79.12s.
The failure was a generic sequential rehearsal selector: it included the new
relative family after skipping intervening dedicated families, so navigation was
on a different fixture. The selector now leaves positioning to its dedicated
source/built/public/packed proofs. No runtime change was needed. The single
failed test was rerun after correction:1passed/412skipped in56.58s. Combined
experimental coverage is550passing/9skipped559; this is a corrected segmented
receipt, not an uninterrupted whole-matrix pass. Logs
`/tmp/pibbl-consolidation40-focused.txt` and
`/tmp/pibbl-consolidation40-walk-corrected.txt`.
Normal25-file matrix203passed/356skipped559 in3.85s, log
`/tmp/pibbl-consolidation40-normal.txt`. TypeScript and changed test lint pass.
No production/kernel/ABI change, status promotion, baseline rewrite or Node24
aggregate trust claim. Source/built/installed120 receipts remain current.

## Slice121 delivered: decorated-parent static and relative evidence

Evidence-only: existing runtime passes the focused public test before any
production edit. Parent204×104 border-box with border2 and asymmetric padding
L10/R30/T20/B20 has content origin12,22 and content160×60. Static LTR A/B
at12,22/72,22; static RTL122,22/62,22; relative LTR24,30/72,22;
relative RTL104,30/62,22. Native Yoga3.2.1 reproduction adds four matching
cases:330total,236matches/94classified. No runtime/ABI/kernel change.

Public test proves exact boxes, stable keyed stamps/native nodes, focus
continuity, former/new targets, source-order overlap, receiver-owned paint reuse
and all three teardown counters. Initial1pass; final focused5pass/413skip418,
including120 forwarding and latest navigation. Source/built each4matches,
227core/dist inputs, errors[]/cleanup[0,0,0]. Logs
`/tmp/pibbl-slice121-public-initial.txt`, `...focused.txt`, `...source.txt`,
`...built.txt`. Screenshot inspected without baseline changes. Installed
`decoratedRelativeStatic` receipt passes245dist inputs and strict Bundler/NodeNext
consumers using unchanged120artifact SHA256
`d3c231540ffe509de5960e66bce28dcaa6fd2af0fddf4063effab415cf96c893`;
log `/tmp/pibbl-slice121-packed.txt`. Types and changed-code lint pass; scoped
evidence review found no material issue. Positioning remains experimental:
8complete/12experimental/6partial/6missing/1excluded, all7gates open. No Node24
trust claim or full-program completion.

## Slice122 delivered: bounded direct-Flex absolute participation

Public `position: "absolute"` accepts finite explicitly sized, undecorated direct
children in experimental row-nowrap Flex with at least one numeric inset on each
axis. The child leaves line allocation and consumes no sibling slot or gap, but
retains authored paint/hit/focus order and keyed identity. Receiver tokens and
placements use source indices; only flowing items enter native allocation.
Explicit insets use the parent's inner border/padding-box edge, independently of
padding: decorated204×104/border2/padding10,30,20,20 gives absolute left12/top8
at14,10, while flowing slots begin12,22. LTRleft/RTLright/top precedence and
right/bottom-only anchoring match pinned Yoga. Automatic/intrinsic dimensions,
no-inset alignment, child decoration/margins/nonzero bounds/factors, direct layout
children, responsive queries and nested containing-block selection remain open.

Initial public RED `/tmp/pibbl-slice122-public-red.txt`: absolute rejected before
production. Scoped hardening RED `...layout-child-red.txt` then rejects direct
nested layout admission. Focused35pass; final selected5files33pass/417skip450;
additional Absolute-hosted known preflight and intrinsic exclusion3pass. Existing
percentage-gap focused20pass/393skip, legacy Flex/placement106pass/1skip107,
normal29pass/3skip32. The first installed retry caught a real unused-path
regression: raw parent style metadata was enumerable and recursively validated
percentage gaps as resolved data. The parent source is now a private per-resolved-
style Symbol; ordinary normalizers/validation are unchanged. No new cache or
resource owner. Scoped review found no remaining material issue.

Native reproduction adds7matches:337total/243matches/94classified differences.
Kernel/ABI unchanged68649bytes SHA256
`029fd944e878b879a235461dcfac17219948569198795428caff12c4c388bfe9`.
Final source/built7case replays prove exact boxes, exposed targets and overlap
paint order, stable stamps, paint reuse and cleanup[0,0,0];227core/dist inputs,
errors[]. The initial source driver selected an exact inclusive overlap edge;
it now chooses genuinely exposed geometry and separately asserts topmost overlap.
No arbitration assertion was removed. Screenshot inspected, no baseline rewrite.
Source/built public5case lesson also passes with zero private corpus requests;
built editor469dist inputs. Final installed proof:245dist inputs,
Bundler/NodeNext types, absoluteParticipation receipt, ordinary percentage gaps,
104auto-margin fixtures and exact cleanup. Tarball SHA256
`ea731ee7b3bd0dd62f699473a25b22c5d6d2abf18543f1d97d083286bae2b4a4`.
Logs `/tmp/pibbl-slice122-source-final.txt`, `...built-final.txt`,
`...packed-final-jsdoc.txt`, `...percentage-gap.txt`, `...legacy.txt`,
`...normal.txt`, `...final-focused.txt`. TypeScript, lint, catalog, JSDoc and
109documentation RED probes pass. Node26.9.0/macOS Chromium; no Node24 trust
claim. Status remains8complete/12experimental/6partial/6missing/1excluded;
all7release gates open, full-program review remains at the end.

## Slice123 delivered: axis-wise no-inset absolute alignment

No new API or ABI. Fixed direct absolute children now use the parent content box
on an axis without either inset, with existing `justifyContent`/`alignItems`.
Explicit axes retain122's padding-box origin. Main start/space-between use start,
end uses end, center/around/evenly center; RTL reverses main-start/end. Stretch
keeps the fixed cross size at start. `alignSelf` rejects explicitly. Automatic
sizes, opposite-inset-derived dimensions and nested containing blocks stay open.

Public RED `...slice123-public-red.txt` records missing-axis rejection with3old
passing tests. Self-alignment RED establishes the rejected override. Initial
implementation reused normal Flex distribution, which has a different safe
negative-free-space policy: the new public overflow test failed x12 vs expected-8
(`...slice123-overflow-red.txt`,1fail/32pass). The fix maps scalar alignment into
existing allocation-free `alignmentOffset`, preserving Yoga's centered negative
free space. Public final2files33pass. Selected3files30pass/416skip446;
normal28pass/5skip33. Pinned source plus independently compiled overflow probe
confirms x-8 for absolute200 in content160 with space-around (probe cross-start
y22; public cross-end fixture y62). Six corpus cases cover centered/end no-inset,
left-only, and default start/stretch in LTR/RTL:343total/249matches/94classified.
No kernel/Rust/ABI change;68649byte SHA256 remains
`029fd944e878b879a235461dcfac17219948569198795428caff12c4c388bfe9`.

Actual browser exposed-target failure was isolated rather than masked: intended
logical437,304 arrived via locator coordinates at436,303, the neighboring closed
edge. The driver now computes native page-mouse coordinates through the iframe
border and Canvas content origin; exact original exposed points and separate
source-order overlap assertions pass. Mouse diagnostics are retained on assertion
failure. Final source/built6matches,227core/dist inputs, errors[]/cleanup[0,0,0];
source also replays122's7explicit-axis cases, and source/built public5lessons pass
with zero private corpus requests (built editor469inputs). Screenshot inspected,
no baseline rewrite. Installed proof passes245dist inputs, strictBundler/NodeNext,
absoluteAlignment receipt, earlier placement/percentage/104auto-margin proofs,
identity/paint reuse/cleanup. Tarball SHA256
`c2bdef721f5262c1d219f75270e106248c9bf6cddcae52a0de1d47645e77130c`.
Source receipt `/tmp/pibbl-slice123-source-calibrated.txt`, built
`...slice123-built.txt`, installed `...slice123-packed.txt`, earlier failed click
receipt `...slice123-mouse-diagnostic.txt`. Types, changed-code lint, catalog,
JSDoc and109documentation RED probes pass. Scoped core review finds no material
issue; one duplicate installed assertion removed. EnvironmentNode26.9.0/macOS
Chromium; no Node24 trust claim. Counts remain8complete/12experimental/6partial/
6missing/1excluded and all7gates open. Full-program review remains at the end.

## Consolidation41 completed for slices121–123

Separate delivery commits121 `f4605ef2`,122 `057873a3`,123 `51bc20ad`.
Fresh27-file experimental matrix571passed/9skipped580 in79.38s; normal
matrix218passed/362skipped580 in4.31s. Both uninterrupted runs pass; expected
negative-case console diagnostics are included. Logs
`/tmp/pibbl-consolidation41-focused.txt` and `...consolidation41-normal.txt`.
Existing layout/loading, receiver ownership, pure measurement, geometry, styles
and new positioning tests compose successfully. No source/built/installed receipt
was replaced by a documentation claim. No kernel/ABI/baseline change, capability
promotion or Node24 trust claim. All7release gates remain open.

## Slice124 delivered: opposing-inset derived absolute dimensions

Direct experimental row-nowrap Flex absolute children admit an auto or omitted
axis only with both physical numeric insets. Finite padding-box subtraction
precedes clamping to zero; LTRleft/RTLright/top precedence is preserved. Public
204×104→244×124 owner produces170×82→210×102 at14,10. Explicit-size alignment
is unchanged. No intrinsic measurement, containing-block cascade or ABI change.

Public RED established unsupported auto dimensions; direct rendering then passed
while forwarded Rectangle failed. Private placement-owned axis bits now preserve
computed dimensions through exact object forwarding, after authored normalization
and before primitive resolution. Private markers are stripped before callbacks.
Final focused2files40pass; broader3files445pass/8skip453; normal30pass/10skip40.
Types and changed-code lint pass. Scoped core review has no material findings.
Pinned corpus347records/253matches/94classified, including4new initial/resized
LTR/RTL cases. Source/built4 match,227core/dist inputs, errors[] and cleanup[0,0,0].
RTL A is fully occluded by B: exact boxes and overlap targeting are asserted;
exposed-target selection partitions later rectangle edges rather than guessing.
Previous alignment6cases pass. Built public5case rerun passes469inputs and zero
private corpus requests; first concurrent run failed its existing custom-provider
click assertion, so this is a successful rerun, not an uninterrupted first pass.
Screenshot inspected; no baseline rewrite. Fresh installed package passes245dist
inputs, Bundler/NodeNext, absoluteDerivedSize and prior lifecycle proofs plus104
auto-margin fixtures. Tarball SHA256
`4304a9333ab4208050ffad0fb76f68e5621d1a8d699b35efb2add9a2427db11a`.
Documentation109RED probes and public JSDoc checks pass. Logs under
`/tmp/pibbl-slice124-{focused,normal,packed,built,alignment,public-built-rerun,docs}.txt`.
EnvironmentNode26.9.0/macOSChromium; no Node24 aggregate trust claim. Kernel
remains68649bytes with unchanged v5 SHA. Counts remain8complete/12experimental/
6partial/6missing/1excluded; all7release gates remain open.

## Slice125 delivered: declarative static Flex containing-block ownership

Explicit static direct nested Flex boxes inherit the nearest containing Flex's
padding box; relative boxes establish their own. Omitted position retains Pibbl
legacy local ownership. Root Flex is fallback. No public override or transformed,
opaque, boxless, Group/Clip/Layer, Flow/Grid ownership is inferred. Placement
metadata translates the ancestor box through settled child offsets and content
insets; source-order paint/hits/focus and keyed lifetimes are preserved. Inherited
contexts conservatively bypass allocation cache reads and writes.

Pinned native probe establishes static ABS world12,8 vs relative32,18 for an
inner80×60 box at20,10. Public RED fails at32,18 for static; initialGREEN1pass.
Hardening adds multi-static ancestry/relative reset, decorated ancestor paired-auto
resize and unavailable opaque context rejection. Existing cyclic-description test
caught clone identity loss during preflight; preserving original description source
restores the same cycle detector without another map or traversal. Latest targeted
3files6pass/441skip447, including cycle and direct latest navigation. Initial scoped
matrix46pass; final5file experimental49pass and normal31pass/18skip49.
The first normal diagnostic assertion required a mode-specific expectation; its
initial missing import was corrected before these fresh final reruns.
Native corpus351records/257matches/94classified with4static/relative LTR/RTL cases.
Omitted legacy ownership is tested separately and is not falsely labeled Yoga parity.
Source/built4match,227core/dist inputs, errors[]/cleanup[0,0,0]. Screenshot inspected.
Fresh package build245dist inputs, Bundler/NodeNext; first installed run exposed
an older percentage replay selecting all nestedBoxes. Narrowing it to its named
percentage family preserves that proof and admits the new containing fixture shape.
Rerun passes absoluteContainingBlock, prior placement proofs and104auto-margin cases.
Tarball SHA256 `2388358d87e733c1bcc4815002ccbbec27a0205154a16dbde233a4f95b0c310a`.
Documentation109RED probes and public JSDoc pass; scoped core review is clean.
Logs `/tmp/pibbl-slice125-{public-red,public-green,hardening,preflight-rerun,final-targeted,source-final,built,packed-rerun}.txt`.
No kernel/ABI change, baseline rewrite, capability promotion or Node24 trust claim.
Counts remain8complete/12experimental/6partial/6missing/1excluded; all7gates open.

## Slice126 delivered: numeric absolute size bounds

Existing finite numeric min/max width/height now clamp direct absolute fixed and
paired-inset-derived dimensions before physical inset precedence. Four direct
scalar validators admit only finite nonnegative numbers. Existing box resolution
owns clamping and min>max rejection; no duplicate bound algorithm, API or ABI.
Yoga minimum-wins contradictory bounds remain an intentional diagnostic difference.

Public RED fixed/auto tests establish prior rejection. Two-file final47pass;
normal35pass/15skip50. Selected4files36pass/427skip463 includes latest/cycle/
containing and absolute boundaries. New negatives cover percentage/negative/
nonfinite/contradictory bounds. Native probe and4new corpus cases confirm auto
maxWidth100/minHeight90 yields100×90 at14,10LTR /84,10RTL; fixed30×20 with
minWidth60/maxHeight10 yields60×10 at14,10LTR /124,10RTL. Full recorded corpus
355cases/261native matches/94classified. No full uninterrupted355-case browser
claim. Source/built4pass227core/dist inputs, errors[]/cleanup[0,0,0]; source also
replays125's4containing cases. Built public5cases pass469editor inputs with
zero private corpus requests. In RTL auto, B fully covers A: exposed-point search
proves full containment, records it and preserves exact geometry and overlap hits.
First replay's narrow124-only occlusion admission was updated for this exact
natively covered case; no target assertion was discarded. Screenshot inspected.
Fresh final installed package after JSDoc update245dist inputs, Bundler/NodeNext,
absoluteBounds and prior placement/104auto-margin proofs pass. Tarball SHA256
`d5054e64919bd41881e62b71eda59becba77553e7c392703f2e2cb7459988025`.
Types, changed-code lint, docs109RED probes/JSDoc and scoped core review pass.
Logs `/tmp/pibbl-slice126-{public-red,auto-red,public-green,normal,focused,source-rerun,built,containing,packed-final,docs}.txt`.
Node26.9.0/macOSChromium; kernel68649bytes/SHA unchanged. Counts remain
8complete/12experimental/6partial/6missing/1excluded; all7gates open.
Consolidation42 for124–126 follows as a separate evidence checkpoint.

## Consolidation42 completed for slices124–126

Separate deliveries124 `77452150`,125 `6603731e`,126 `0bda56ec`.
Fresh28-file experimental588passed/9skipped597 in79.11s; normal225passed/
372skipped597 in4.04s. Both uninterrupted aggregate runs pass. Logs
`/tmp/pibbl-consolidation42-focused.txt` and `...consolidation42-normal.txt`.
The standalone eight-case nested percentage replay also had the old broad
nestedBoxes selector and pre119 public route/proof marker. It now selects its
exact named family, uses the private corpus route and validates pinned provenance,
complete ordered fixture names and actual source/dist input paths. Exact existing
geometry, target, identity and cleanup assertions remain. Source and built8case
replays pass,227core/dist inputs, errors[]/cleanup[0,0,0]. The first built rerun
caught the obsolete proof marker after geometry had passed; final receipts
`...consolidation42-nested-source-final.txt` and
`...consolidation42-nested-built-rerun.txt` validate the new marker. Changed harness
syntax/lint passes; no runtime change after the combined matrices. No release
capability promotion or Node24 trust claim; all7gates remain open.

## Slice127 delivered: bounded absolute aspect-ratio derivation

Existing positive finite aspectRatio admits exactly one automatic dimension and
one explicit finite numeric dimension on direct absolute children. Opposing
insets on the automatic axis win; otherwise the declared opposite dimension
supplies ratio sizing before independent min/max clamps. Bounds do not recouple
the ratio. Both-auto and both-explicit ratio cases remain diagnosed; unpaired
automatic axes without a ratio remain unsupported. Absolute ratio items do not
trigger the flow-only aspect pass. No intrinsic measurement, ABI or new API.

Pinned probes establish80×40 from width80/ratio2,60×30 from height30/ratio2,
width80/minWidth100→100×40, and top8/bottom10→80×82. Two public RED tests
establish rejected ratio admission; an initial test fixture accidentally retained
opposing insets while expecting ratio sizing and was corrected to match the
native contract. Final2file53pass; normal39pass/17skip56; selected4file42pass/
427skip469 including latest/cycle/containing. Invalid ratio, nonfinite derived
arithmetic and out-of-scope ratio axis combinations reject. Six native corpus
records bring the total361/267matches/94classified. Source/built6pass227core/dist
inputs, errors[]/cleanup[0,0,0]. Screenshot inspected. Final packed245dist inputs,
Bundler/NodeNext, absoluteAspect forwarding/bounds/inset/paint/cleanup and prior
104auto-margin proofs pass; tarball SHA256
`bc442f186edfbeded3024e9acbcd3ca9ecc917402fcf9a05b3d509ed38b97d6c`.
Types, changed-code lint, docs109RED probes/JSDoc and scoped core review pass.
Logs `/tmp/pibbl-slice127-{public-red,public-green-rerun,focused,normal,source,built,packed,docs}.txt`.
Kernel68649bytes/SHA unchanged. No capability promotion, full361-case browser
claim, baseline rewrite or Node24 trust claim. Counts8complete/12experimental/
6partial/6missing/1excluded; all7release gates remain open.

## Slice128 delivered: bounded measured absolute natural width

Direct custom primitives with paired pure providers may resolve an unpaired auto
width at a declared finite numeric height. The query is horizontal[0,Infinity],
vertical[height,height], matching native undefined-width/exact-height callback
constraints. Numeric bounds clamp after measurement; left/right anchoring and
source-order A/B/C composition are preserved. Opposing inset/aspect paths keep
precedence; no builtin Text/font/image, opaque, both-auto or natural-height
admission. No new API/ABI or native absolute line nodes.

Public RED establishes missing provider admission. Initial integration cached by
receiver token; the paint rerun exposed an ephemeral-token miss at unchanged
allocation revision. The fix reuses stable absolute: keyed/occurrence identities
in existing region maps. Tagged absolute entries and identities prune on removal,
separately from normal/native flow identities; existing revision/input snapshot
rules remain conservative. Parent resize remeasures the same unbounded envelope;
sibling paint on stable inputs reuses it. No resize-cache-hit claim. An absolute-only
provider owns a region generation/cache but zero native nodes. Cold new identities
roll back through existing onFinish(false); committed ones remain. Focused rollback
RED/green proves retry replacement vs committed identity stability without adding
a registry or counter. No temporary diagnostic logging remains.

Public/lifecycle3files60pass, normal39pass/21skip60. Final selected4files47pass/
427skip474 includes absolute/containing/latest/cycle/identity and rollback. Evidence
covers jobs3→6 geometry, exact query, moved hit targets, measurement-owned signals,
keyed removal releasing cached entries with flow alive, detached signal inert,
restore, pure unsupported/throwing failure and exact disposal. Six pinned callback
fixtures (3jobs×20px, explicitly not font parity) bring corpus367/273matches/
94classified. Final source/built6pass227core/dist inputs, errors[]/cleanup[0,0,0];
screenshot inspected. Additional pinned cross-bound query probes confirm that
the exact declared height is queried before its own min/max clamp as well. No full uninterrupted367-case browser claim. Fresh final
packed245dist inputs, Bundler/NodeNext, absoluteMeasuredWidth lifecycle proof plus
previous placement and104auto-margin fixtures pass. Tarball SHA256
`0fcead4ce3865034c33d1273486f5772f8f191be7565f06d93ea19b5d5c94157`.
Types, changed-code lint, docs109RED probes/JSDoc and scoped ownership review pass.
Logs `/tmp/pibbl-slice128-{public-red,cache-diagnostic,public-green-stable,public-lifecycle,hardening,rollback-red,focused-final,normal,source-final,built-final,packed-final,docs}.txt`.
Kernel68649bytes/SHA unchanged; Node26.9.0/macOSChromium, no Node24 trust claim.
Counts8complete/12experimental/6partial/6missing/1excluded, all7gates open.

## Slice129 delivered: bounded measured absolute natural height

Paired pure providers now support the symmetric exact-declared-width/unbounded-height
query. The automatic dimension alone uses the returned size; numeric bounds clamp
both used axes afterward. Public tests establish width80→40 wrapping height20→40,
bottom anchoring, measurement-owned jobs, paint reuse, keyed removal/detached
signal/restore, and declared width80 queried before minWidth100/maxWidth60 clamps.
No both-auto, built-in Text/image, opaque-owner or wider positioning admission.

The existing absolute measurement cache uses `absolute-size:<axis>:<revision>:<fixed>`;
axis separation prevents collisions while the same region sweep/rollback/disposal
owns both profiles. No new persistent map, ABI or native absolute line nodes.
Scoped review found no material issue; cache conservatism remains unchanged.

Public RED failed at the missing admission, then focused positioning3files61pass;
with the bound-order test, absolute18pass and normal3files39pass/23skip62. Latest
navigation and cold-identity rollback2pass/412skip414. Six pinned native callback
fixtures bring373records=279matches+94classified. Source/built6pass,227source/dist
inputs, errors[] and cleanup[0,0,0]; screenshot inspected. The prior width family
source6 also passes. Fresh isolated installed consumer245dist inputs passes strict
Bundler/NodeNext, explicit absoluteMeasuredHeight lifecycle receipt, prior placement
receipts and104auto-margin fixtures. Tarball SHA256
`e34241a1953188d3b27af05c79dbd63dfff705b37d0627b2d183684defd54add`.
Types, changed-code lint, docs109RED probes and public JSDoc pass.
Logs `/tmp/pibbl-slice129-{public-red,public-green,focused,bounds,normal,latest-rollback,source,built,width-source,packed-final,types-final,lint-final,docs}.txt`.
Kernel68649bytes/SHA unchanged; Node26.9.0/macOSChromium, no Node24 trust claim.
Fixed33:8complete/12experimental/6partial/6missing/1excluded; all7gates open.

## Consolidation43 completed for slices127–129

Separate commits127 `dfc5843c`,128 `2539ff32`,129 `398dfa54`. Fresh combined
experimental28files601pass/9skip610 (80.14s); normal22pass-files/6skip-files,
229pass/381skip610 (4.87s). Logs `/tmp/pibbl-consolidation43-{focused,normal}.txt`.
Expected negative-provider diagnostics appear; no assertion failures. The combined
run covers public positioning, provider query/ownership, cold identity rollback,
measurement purity, known owner preparation, loading and Canvas behavior.
Segmented source/built129 and source128 replay receipts plus installed245-input
consumer evidence are recorded above; no uninterrupted373-case browser claim.
Docs109RED probes/JSDoc and public5/full373 boundary pass. Types/lint pass at129.
No baseline rewrite, capability promotion, new performance claim or Node24 trust.
Fixed33 remains8complete/12experimental/6partial/6missing/1excluded; all7gates open.

## Slice130 delivered: fixed absolute main directions

Fixed finite numeric direct absolute boxes now support all four nowrap Flex main
directions and LTR/RTL. Inset-free axes follow main/cross alignment; physical
insets retain their existing padding-box reference and precedence. Main reversal
is authored reverse XOR horizontal RTL. Logical start/end normalization rewrites
only those logical values; it does not pre-reverse flex-start/end. Fixed stretch
uses cross-start, including the right edge in RTL columns. No new API/ABI or
native absolute nodes, and no expansion of row-only auto/aspect/bounded/provider
sizing, nested containing ownership, wrapping, margins or child decoration.

Public RED failed at missing column admission; green checks direction transitions,
exact decorated geometry, overlapping clicks, authored focus order, stable keyed
identity, paint reuse and cleanup. Focused3files65pass/1normal-onlyskip66; normal
39pass/27skip66. Additional logical start/end × reverse/RTL, Latest navigation
and cold measurement identity rollback pass3/430skip433. Scoped review found no
material issue after correcting reversal and fixed-stretch semantics before
application. Ten pinned fixtures bring383records=289matches+94classified.
Source/built10pass227source/dist inputs, errors[]/cleanup[0,0,0]; screenshot
inspected. Previous measured-width built6pass. Public5/full383 boundary passes.
Fresh isolated package245dist inputs passes Bundler/NodeNext and explicit
absoluteMainDirections receipt, earlier measurement/placement receipts and
104auto-margin fixtures. Tarball SHA256
`9258f4194758e891f7fd8871a3a168d61d6992160c4146d7b82e99ecc4b0e833`.
Types, changed-code lint, docs109RED probes/JSDoc pass.
Logs `/tmp/pibbl-slice130-{public-red,public-green,focused,normal,hardening,native,source,built,width-built,packed,types-final,lint-final,docs}.txt`.
Kernel68649bytes/SHA unchanged. Node26.9.0/macOSChromium, no Node24 trust or full
uninterrupted383-case browser claim. Fixed33 counts and all7open gates unchanged.

## Slice131 delivered: physical static/relative main directions

Direct/exact-forwarded primitive leaves now support static/relative placement in
all four finite nowrap directions and LTR/RTL. Static ignores insets; relative
preserves the allocated sibling slots and applies one physical final-world
translation. No relative offset changes sign merely because the main axis
reverses. Four native reverse-relative records deliberately differ; raw Yoga
boxes and classified `pibblBoxes` remain separate, with a visible Canvas label.
No CSS-equivalence claim. Known layout children retain the row-only admission.

The RED established missing leaf admission and exposed a row-parent/static-column
metadata path previously made reachable by fixed absolute direction support.
Containing metadata now requires both parent and static child row/nowrap before
preflight; column-parent/static-row and row-parent/static-column reject explicitly.
No invented owner fallback. Scoped review found no material issue in the final
boundary/forwarding/physical translation code. No new cache, graph, ABI or native
kernel change. RTL overlap intentionally targets later B; A's exposed edge is
used for its own hit assertion, with a per-case exact A/B interaction sequence.

Public2files49pass/2normal-onlyskip51, focused5files72pass/2skip74; normal41pass/
33skip74. Latest navigation passes. Sixteen native records bring399cases=
301matches+98classified. Source/built16pass:12native matches +4preserved physical
differences,227source/dist inputs, errors[]/cleanup[0,0,0]; final screenshot
inspected with the visible difference label. Public5/full399 boundary passes.
Isolated installed245dist inputs, Bundler/NodeNext, explicit relativeMainDirections
receipt, earlier placement/measurement and104auto-margin receipts pass. Tarball
SHA256 `d6da0e9a7e0c0e1b455ab53e36fd4fa62c419cf4177c6d63f8da956486f77da5`.
Types, changed-code lint, docs109RED probes/JSDoc pass.
Logs `/tmp/pibbl-slice131-{public-red,public-green-final,hits-diagnostic,focused,normal,latest,native,source,built,packed,types-final,lint,docs}.txt`.
Kernel68649bytes/SHA unchanged; Node26.9.0/macOSChromium, no Node24 trust or
uninterrupted399-case browser claim. Fixed33/all7open gates unchanged.

## Slice132 delivered: opposing-inset absolute sizing and numeric bounds across directions

All four finite nowrap main directions and LTR/RTL now support the existing
physical opposing-inset automatic axes and numeric bounds on fixed/derived boxes.
The same padding box, finite-before-clamp arithmetic, independent bounds and
physical precedence apply before placement. Relative and containing policies are
unchanged. Non-row aspect and natural provider profiles still reject; dedicated
negative tests prove both natural-axis callbacks remain uncalled. No new public
API, cache, owner, graph, ABI or native absolute line nodes.

Public RED establishes the missing non-row admission. Its green matrix covers
auto initial/resize and fixed clamps in all8 directionality combinations, unchanged
flow slots, stable keyed identity, targets, paint reuse and disposal. Focused
3files70pass/2normal-onlyskip72; normal41pass/31skip72. Latest navigation1pass/
413skip414. Twenty-four pinned records bring423cases=325matches+98classified.
Source/built24pass227source/dist inputs, errors[]/cleanup[0,0,0]; screenshot
inspected. Fully occluded A is permitted only for explicit fixture families with
actual covering geometry; overlap assertions still require the later paint winner.
Nine fully covered points are recorded, not silently omitted. Public5/full423
boundary passes. Scoped review found no material issue.

Fresh installed245dist inputs, Bundler/NodeNext, explicit absoluteMainBounds
receipt, prior measurement/placement and104auto-margin receipts pass. Harness
quoting and missing computed import were caught/fixed before its final green run;
no runtime workaround. Tarball SHA256
`2acf54a5e1ded6eb3b82d7b0f4004c107c6a4cbdeea3b7d798bd1d792ea98295`.
Types, changed-code lint, docs109RED probes/JSDoc pass.
Logs `/tmp/pibbl-slice132-{public-red,public-green,focused,normal,latest,native,source,built,packed,packed-final,types-final,lint,docs}.txt`.
Kernel68649bytes/SHA unchanged. Node26.9.0/macOSChromium, no Node24 trust or
uninterrupted423-case browser claim. Fixed33/all7open gates unchanged.

## Consolidation44 completed for slices130–132

Separate130 `2bbe4181`,131 `b0ab5061`,132 `43f17fc1`. Combined experimental
28files610pass/11normal-onlyskip621 (79.39s); normal22pass-files/6skip-files,
231pass/390skip621 (4.35s). Logs `/tmp/pibbl-consolidation44-{focused,normal}.txt`.
Expected negative-provider diagnostics appear; no assertion failures. The same
combined suite covers positioning/containing boundaries, known owner preparation,
measurement purity/cache ownership, loading, Canvas and prior layout contracts.
Source/built13224-case and prior direction-family receipts, installed245-input
package/104auto-margin receipts, types/lint and scoped reviews are recorded above.
No uninterrupted423-case browser claim or additional review of unchanged code.
Docs109RED/JSDoc and public5/full423 boundary pass. Summary API wording is
reconciled with all-direction paired sizing and row-only natural measurement;
physical inset precedence and nonzero-factor exclusions are stated precisely.

Fixed33:8complete/12experimental/6partial/6missing/1excluded. All7release gates
remain open. Direction coverage does not close the general positioning, intrinsic,
publication, migration, Grid, reproducible performance or release exits. No baseline
rewrite, performance/parity promotion or Node24 aggregate trust claim.

## Slice133 delivered: exactly-one-auto absolute aspect main directions

The existing declared-axis aspect path now supports every finite nowrap main
direction and LTR/RTL. Exactly one automatic axis, a positive finite ratio and
explicit finite opposite dimension remain required. Paired insets win; otherwise
derivation uses the declared opposite axis before independent numeric clamps.
Natural provider sizing remains row-only. No measurement, containing, wrapping,
child-decoration/margin or known-layout expansion; no API/ABI/cache/kernel change.

Public RED fails only at missing non-row admission (2older aspect tests pass).
Green covers3profiles across8 directionality combinations, unchanged flow slots,
stable keys, paired-height resize82→122, actual paint pixels, no-solve paint and
exact disposal. Focused3files71pass/2normal-onlyskip73; normal41pass/32skip73.
Latest1pass/413skip414. Eighteen pinned records bring441cases=343matches+
98classified. Source/built18pass227source/dist inputs, errors[]/cleanup[0,0,0];
screenshot inspected. Public5/full441 boundary passes. Scoped review found no
material issue. Fresh installed245dist inputs, strict Bundler/NodeNext, explicit
absoluteMainAspect receipt, previous placement/measurement and104auto-margin
receipts pass. Tarball SHA256
`88987902e230204d91dbd1afe3aaf281c618537cef9d88282eb19403712f1e76`.
Types, changed-code lint, docs109RED probes/JSDoc pass.
Logs `/tmp/pibbl-slice133-{public-red,public-green,focused,normal,latest,native,source,built,packed,types-final,lint,docs}.txt`.
Kernel68649bytes/SHA unchanged; Node26.9.0/macOSChromium, no Node24 trust or
uninterrupted441-case browser claim. Fixed33/all7open gates unchanged.

## Slice134 delivered: paired absolute providers across main directions

Exactly-one-auto paired custom providers now support every finite nowrap main
direction and LTR/RTL. Pibbl retains one declared exact and one unbounded axis,
query-before-bounds ordering and the existing revision/input snapshot cache.
Removing the admission guard adds no owner, cache, graph, ABI or kernel behavior.
Both-auto, built-in Text/image, wrapping, queries, margins, decoration, opaque
measurement and broader containing ownership remain outside this path.

Native discovery found a query difference: Yoga natural-width callbacks use
at-most padding-box width in columns, while Pibbl preserves unbounded width.
The oracle captures actual callback width/mode, including200→240 on resize;
five records carry explicit native-query metadata, visible labels and separate
receipt entries. Matching deterministic geometry is not callback parity. Corpus
459=361geometry matches+98classified geometry differences; query differences are
reported separately rather than disguised as geometry mismatches.

The public test keeps both stable providers mounted across directions, independently
owns width/height jobs signals, asserts exact envelopes and geometry, jobs3/8→6/12
moving width60→120/height20→30 and targets, sibling paint reuse, both-token removal,
detached source silence, restore+2calls and exact disposal. The initial prepared
test's height/remount assumptions were corrected before establishing missing
non-row RED. Green1pass/21skip22; focused3files72pass/2normal-onlyskip74; normal
41pass/33skip74. Latest1pass/413skip414. Source/built18geometry matches with5query
differences,227source/dist inputs, errors[]/cleanup[0,0,0]; screenshot inspected.
The first replay routed the new family through the generic top-left hit path;
adding its flag to the existing occlusion-aware branch fixed that harness error
without changing runtime target rules. Public5/full459 boundary passes.

Scoped review found no material issue. Installed245dist inputs, strict Bundler/
NodeNext, explicit absoluteMeasuredMain receipt, conservative column resize,
provider jobs/paint/removal/restore/cleanup and104auto-margin receipts pass.
Tarball SHA256 `f7eb8493a259b6427aadabf8668ef7cd16ed511c7d601e800469bf1a15fa39c9`.
Types, changed-code lint, docs109RED probes/JSDoc pass.
Logs `/tmp/pibbl-slice134-{public-red,public-green,focused,normal,latest,native-final,source-final,built,packed,types-final,lint,docs}.txt`.
Kernel68649bytes/SHA unchanged. Node26.9.0/macOSChromium, no Node24 trust or
uninterrupted459-case browser/query-parity claim. Fixed33/all7open gates unchanged.

## Slice135 delivered: fixed declarative containing chains across directions

Direct static/relative nested nowrap Flex owners now support all main directions
when the nested owner has finite numeric dimensions, zero grow/shrink and an
omitted/automatic basis. Existing row-to-row behavior remains. Static inherits the
ancestor padding box; relative and legacy omitted position own the local box.
Opaque/transformed, wrapped, automatic-sized and flexing owner expansion remains
outside this admission. Existing conservative containing-box cache bypass remains.

Public cross-direction test captured the missing admission before runtime edits:
`/tmp/pibbl-slice135-public-red-corrected.txt`; corrected green passes. The earlier
RED setup mistakenly positioned an opaque root and was corrected before valid RED.
Public matrix covers sixteen cross-paired direction/writing/position states,
resize, stable identity and exact nodes/arenas/measurement cleanup. Scoped review
identified the obsolete rejection test; it now rejects a nonzero-grow owner.

Pinned Yoga adds eighteen diagonal-direction/resize records:477 total,
379 geometry matches and98 classified geometry differences, with the existing
five provider query differences reported separately. Source/built replay18 each
uses227 source/dist inputs, exact owner/absolute/sibling geometry, clicks,
identity and cleanup[0,0,0], no browser errors. Screenshot inspected. The section
shortcut ordering regression has its own valid RED/green navigation regression.

Fresh Node26.9.0/macOS Chromium evidence: focused3files51pass/2skip53;
normal41pass/12skip53; Latest navigation1pass/413skip414. Typecheck, changed lint,
documentation109 mutation probes, public JSDoc and public5/private477 boundary
pass. Fresh build followed by corrected installed consumer passes245 installed
inputs, Bundler/NodeNext, containing-direction focus/hits/paint reuse/cleanup and
104 auto-margin fixtures. Its initial generated-test syntax typo was corrected;
final tarball SHA256 `5737b852855cf84b1462be2c67e15963a1b47f2f3c41fcf4fd47e989f5a27902`.
Logs `/tmp/pibbl-slice135-{focused,normal,navigation-green,source-final,built,packed-final,types,lint,docs}.txt`.
No kernel change, full477-case replay, speed, Node24 trust or release-completion
claim. Fixed33 capability denominator and seven open release gates unchanged.

## Consolidation45 completed for slices133–135

Fresh Node26.9.0/macOS Chromium regression:29 files,613passed/11skipped624
in79.61s experimental; normal231passed/393skipped624 in4.08s. Expected negative
measurement diagnostics were emitted; no assertions failed. Logs
`/tmp/pibbl-consolidation45-{focused,normal,docs}.txt`. Documentation109 mutation
probes pass. This is bounded consolidation, not the Node24 aggregate trust gate.

## Slice136 delivered: fixed absolute participation in wrapped rows

Normal LTR row/wrap now accepts direct absolute leaves with finite numeric
width/height/left/top, no right/bottom/aspect and no nonzero minimum or maximum.
All previous neutral-flex, no-query/margin/child-decoration validation remains.
The admission uses existing placement/source-order/ownership; it adds no native
ABI or measurement/cache layer. Other wrapped contexts remain explicit rejections.

Public failing test captured the finite-nowrap diagnostic before runtime edits:
`/tmp/pibbl-slice136-public-red.txt`. Green covers a padded/bordered owner164→124,
flow cards wrapping independently of the anchored absolute child, source focus,
absolute-over-flow clicks, stable keyed stamps/nodes, paint no-solve reuse and
exact node/arena/measurement cleanup. Native Yoga confirms both layouts before
admission. Corpus479=381geometry matches+98classified geometry differences;
five earlier native query differences remain separately reported.

Fresh Node26.9.0/macOS Chromium: focused2files57pass/2skip59; normal43pass/16skip59;
Latest1pass/413skip414. Scoped review found no material defect. Normal diagnostic expectations were corrected to account
for direction validation preceding placement in that lane. Source/built2each use
227source/dist inputs, exact boxes/hits/old-position miss/paint reuse/key identity,
cleanup[0,0,0] and no errors. Screenshot inspected. Types, changed lint, docs109
mutation probes, public JSDoc and concise5/full479 boundary pass. Fresh runtime
build and installed consumer pass245inputs, strict Bundler/NodeNext, source focus,
targets, resize, paint reuse, cleanup and104auto-margin cases. Tarball SHA256
`80f010af3cea49e743f7efeff49ac48759d2249be757d6c0c2dee394d81e6b44`.
Logs `/tmp/pibbl-slice136-{public-red,public-green,focused,normal-final,latest,source,built,packed,types-final,lint,docs}.txt`.
Fixed33/seven-open-gate denominator unchanged; no full479-case replay, Node24
trust, performance or release-completion claim.

## Slice137 delivered: direct wrapped Text absolute height

Direct built-in Text can measure automatic/omitted absolute height at finite
numeric width in every nowrap direction and LTR/RTL. Requires wrap enabled,
generic pixel font and visible/omitted fit/overflow; no new API. A measurement-only
copy omits automatic height for the existing Text callback. Original authored style
settles afterward, retaining paired-inset/aspect precedence and numeric bounds.
Existing absolute identity, revision keys, transactions and cleanup are reused.

Corrected public RED `/tmp/pibbl-slice137-public-red-corrected.txt` captured the
missing size admission before restoring the runtime patch. Initial helper test
contained unsupported function children; it now passes the signal directly. Real
Canvas tests also corrected a glyph-boundary click and a missing test-only fill.
Public tests cover all eight direction/writing states, flow slots, source focus,
actual glyph targets as content grows, width/font/line-height updates, stable nodes,
detached sources and keyed removal/restore/cleanup. Callback props deliberately
keep interactive Text conservative (one remeasure on paint, no solve/new nodes).
A separate stable plain descriptor proves measurement reuse without broadening
cache admission. Actual paint-origin tests cover pair/aspect/pair-over-aspect with
no measurement and numeric minimum/maximum after measurement.

Four native synthetic6px sizing probes (40/80 width ×3/6 words) are explicitly
not a Canvas-font parity claim. Source/built4each use227source/dist inputs and
assert actual Canvas line counts/world positions, flow slots, glyph hits, keyed
identity, conservative paint work and cleanup[0,0,0], no errors. Browser evidence
clears draw receipts per case rather than borrowing earlier lines. Screenshot
inspected and overlapping annotations moved inside their flow cards.
Corpus483=385geometry matches+98classified differences; five existing native
query differences remain separately reported. No full483-case replay claimed.

Fresh Node26.9.0/macOS Chromium: focused4files90pass/2skip92; normal43pass/49skip92;
Latest1pass/413skip414. Typecheck, changed lint, docs109 mutation probes, JSDoc and
public5/full483 boundary pass. Scoped review found no material runtime defect.
Fresh full build/pack succeeds with245installed inputs, strict Bundler/NodeNext,
actual Canvas Text lines/content/hits, owned measurement and cleanup, plus104
existing auto-margin cases. Tarball SHA256
`3d8e56bb0b9121ef24ba83e2aed56565044192d8703c09ef0396d0d088304e4c`.
Logs `/tmp/pibbl-slice137-{public-red-corrected,public-both,focused-final,normal-final,latest,source,built-final,packed,types-final,lint,docs}.txt`.
No kernel change, speed claim, Node24 trust or release completion. Fixed33 and
seven open release gates unchanged.

## Slice138 delivered: direct Text natural absolute width

Direct generic unwrapped Text now measures automatic/omitted absolute width at a
declared finite numeric height across every nowrap direction and LTR/RTL. Omitted
or visible fit/overflow required. Existing Text natural width means Canvas ink
bounds (`actualBoundingBoxLeft + actualBoundingBoxRight`), not advance width.
Only the measurement copy omits automatic width; original style retains numeric
bounds and physical anchoring. Paired insets/aspect win without measurement.
No public API, ABI, graph/cache namespace or conservative revision policy change.

Public RED captured the missing admission before runtime edits:
`/tmp/pibbl-slice138-public-red.txt`. Real Canvas tests cover eight flow states,
right-anchored miss-to-hit content growth, source focus, stable keys/native nodes,
interactive paint remeasurement versus stable plain cache reuse, font/height/content
changes, detached signals, keyed removal/restore and exact cleanup. Paint-origin
checks cover paired insets/aspect/pair precedence and min/max after measurement.
Negative coverage keeps wrapped, fitted/clipped/custom-font/both-auto and responsive
Text outside admission. A test-only responsive function was corrected to the
supported `style.when` query vocabulary before the final green run.

Four native6px source probes are classified `native-font-metric-source`, without
platform-specific Pibbl boxes. Source/built4each derive Text ink width from live
Canvas, assert exact physical draw origin, glyph hits, recorded A/C flow geometry,
identity, conservative paint work and cleanup[0,0,0], no errors. They report zero
font geometry matches and four source classifications; two column callbacks are
explicit native at-most200 versus Pibbl unbounded queries. Screenshot inspected.
Corpus487 comprises385 geometry matches,98 preserved-semantic comparisons and
four font-source comparisons; seven query differences are separately recorded.

Fresh Node26.9.0/macOS Chromium: focused3files75pass/2skip77; normal43pass/34skip77;
Latest1pass/413skip414. Types, changed lint, docs109 mutation probes, JSDoc and
public5/full487 boundary pass. Scoped review clean. Fresh package build followed
by isolated consumer succeeds245installed inputs, strict Bundler/NodeNext, actual
Canvas ink-width anchor/content/focus/targets/ownership, and104 auto-margin cases.
Tarball SHA256 `7ce71ee925c6784952dd98b7818e77dc106b29207982a082e93a67ded5722c05`.
Logs `/tmp/pibbl-slice138-{public-red,public-green,public-both,focused-final,normal,latest,source,built,packed,types-final,lint,docs}.txt`.
No kernel change, full487-case replay, font parity, speed or Node24 trust claim.
Fixed33 capabilities and all seven open release gates unchanged.

## Consolidation46 completed for slices136–138

Fresh Node26.9.0/macOS Chromium:32 files,642passed/11skipped653 experimental
in79.83s; normal233passed/420skipped653 in4.51s. Expected negative diagnostics
were emitted; no assertions failed. Logs
`/tmp/pibbl-consolidation46-{focused,normal,docs}.txt`. Documentation109 mutation
probes pass. This is bounded consolidation, not the Node24 aggregate trust gate.

## Slice139 delivered: natural unwrapped Text height and both-auto dimensions

Generic unwrapped visible Text now supports natural ink height at numeric width
and both automatic dimensions across finite nowrap directions. One unbounded-both
measurement omits both dimensions on its private copy, settles the existing Canvas
ink width/height, then independently clamps bounds and reuses ordinary placement.
The existing region identity/cache uses `absolute-size:both` with allocation revision;
no ABI, resource graph or cache-admission expansion. Fully paired derivation and
one-auto pair/aspect precedence remain; both-auto aspect and mixed pair/measurement
feedback reject explicitly. This is not available-width shrink-to-fit or CSS reflow.

Public RED `/tmp/pibbl-slice139-public-red.txt` captured missing admission before
production. Real Canvas tests distinguish allocation origin from glyph bearing/
baseline offsets. Two-to-three words move width; font10→16 changes both dimensions.
Focus precedes interaction, old/new bands miss/hit correctly, stable plain Text
reuses paint measurements, automatic→numeric width keeps natural height, both-auto
bounds clamp independently, empty content remeasures, and removal detaches sources
before keyed restore/exact cleanup. Obsolete unwrapped-height/both-auto rejection
cases were updated to actual remaining exclusions. Scoped core review clean.

Four classified native6px callback probes are query-source evidence, not platform
font boxes. The initial temp probe omitted right/bottom and was corrected before
normative corpus generation. Source/built4each use227source/dist inputs, derive live
Canvas ink dimensions/origin/glyph offsets, assert A/C flow slots and keys, targets,
conservative interactive paint work and cleanup[0,0,0], no errors. Two column
callbacks have explicit at-most200 width versus Pibbl unbounded width. Screenshot
inspected. Corpus491 comprises385matches/98preserved-semantic/8font-source cases;
nine query differences are separately recorded, not a full491-case replay.

Fresh Node26.9.0/macOS Chromium: focused4files81pass/2skip83; normal43pass/40skip83;
Latest1pass/413skip414. Types, changed lint, docs109 mutation probes, JSDoc and
public5/full491 boundary pass. Fresh build then isolated packed consumer succeeds
245installed inputs, strict Bundler/NodeNext, actual Canvas both-auto origins,
content/font ownership, stable paint cache reuse, removal/restore and exact cleanup,
plus104 auto-margin cases. Tarball SHA256
`bd8558745da14be7fc1e2c2b3c96a5b535f9f6eed4a052e1f71b9deb37185120`.
Logs `/tmp/pibbl-slice139-{public-red,public-green,focused,normal,latest,source,built,packed,types,lint,docs}.txt`.
No kernel change, font parity, full491-case replay, speed or Node24 trust claim.
Fixed33/all seven open release gates unchanged.

## Slice140 delivered: physically anchored absolute profiles across wrapped Flex

Existing fixed, bounded, opposing-inset, aspect, paired-provider and admitted Text
profiles now work across all four main directions, LTR/RTL and wrap/wrap-reverse,
provided each physical axis has a finite numeric anchor. Flow slots, source paint,
focus order, measurement envelopes and conservative cache rules are preserved.
Wrapped no-inset alignment and containing-chain expansion remain outside this slice.

Public RED failed on the old guard before production edits. Focused four-file WASM
verification passed75/2skip77; normal passed43/34skip77; Latest passed1/413skip414.
Independent two-flow unit placement and three-flow profile tests cover rewrapping,
bounds, paired sizing, aspect and provider/Text measurement. Native/source/built
replay passed34 geometry matches, keyed A/B/C/D identity, paint reuse and exact
cleanup. The final built screenshot was inspected. Corpus525 is419matches,
98preserved-semantic and8font-source comparisons; nine query differences remain
separate. This is not a full525-case replay or a font-parity claim.

Fresh package build and isolated packed consumer passed245 installed inputs,
strict Bundler/NodeNext, wrapped positioning and actual Canvas Text ink evidence,
plus104 auto-margin cases. Tarball SHA256
`fdc3be65a10707009ca0f017876164db9b66a5ac77a6c60d2bff65e4d1989e5c`.
Types, changed lint, docs109 mutation probes, JSDoc, public5/full525 boundary and
diff checks passed. Scoped review found no material issue. Evidence corrected an
initial packed click coordinate and extended generic keyed checks to include D.
Logs `/tmp/pibbl-slice140-{public-red,public-green,focused-final,normal,latest,source,built,packed,types-final,lint,docs}.txt`.
Environment remains Node26.9.0/macOS arm64/Chromium; no Node24 aggregate trust claim.
Kernel and fixed33 capability denominator/all seven open release gates unchanged.

## Slice141 delivered: wrapped static and relative primitive leaves

Finite direct or exactly-forwarded primitive leaves now accept static/relative
placement across all main directions, LTR/RTL and nowrap/wrap/wrap-reverse. Static
ignores physical insets and equals ordinary flow; relative applies physical offset
once after final line placement without changing sibling slots. Wrapped known
layout owners remain rejected, including static wrap-reverse owners. No new API,
ABI, kernel, containing-block or cache policy is introduced.

Public RED captured the old nowrap guard before production. Final focused3 files
passed79/2skip81; normal44/37skip81. The public matrix compares omitted positioning
to static before relative deltas, source focus/hits, stable keyed stamps, paint
reuse and exact cleanup. A duplicate negative using an unscheduled mount assertion
was removed in favor of existing scheduler-aware diagnostics.

Pinned native probes use explicit relative root conversion and B positioned among
three flow items.32records comprise4matches and28 preserved-semantic comparisons:
16 static cases expose native cross-axis inset application;12 relative cases
expose main/cross reversal. Pibbl preserves static-ignore and physical-offset
contracts. Source replay passes all32 with227inputs and zero cleanup/errors.
Installed-package verification passes245inputs, strict Bundler/NodeNext, wrapped
geometry/input/identity/paint/cleanup, plus104 auto-margin cases. Tarball SHA256
`92a7c38012cdd3ab1a37a48f5d17e2c705941dd2924d85ca728085a3024072cd`.
Scoped review found no material issue. Types, changed lint, docs109 mutation probes,
JSDoc and public5/full557 boundary passed. Built replay passed all32 with227dist
inputs, zero cleanup/errors, and the final comparison screenshot was inspected.
Corpus557 is423matches/126preserved-semantic/8font-source; nine query differences
remain separate. This does not claim a full557-case replay, font parity, speed,
Node24 trust or completion of the fixed33 capability denominator/seven release gates.

## Consolidation47 completed for slices139–141

Separate139 `f79b258f`,140 `a2308b97`,141 `187bec28`. Fresh Node26.9.0,
macOS arm64 and Playwright Chromium:36 files passed651/11skip662 experimental
in80.20s; normal234/428skip662 in4.23s. Expected negative diagnostic logs do not
represent runtime failures. Final docs109 mutation probes and public JSDoc passed.
Logs `/tmp/pibbl-consolidation47-{focused,normal,docs}.txt`. No kernel, fixed33
capability status, release-gate or Node24 aggregate trust change is claimed.

## Slice142 delivered: wrapped absolute omitted-axis alignment

All previously admitted absolute sizing profiles now support omitted placement
axes in finite wrap/wrap-reverse Flex. Anchored axes use physical padding-box
insets and existing precedence; omitted axes align in the whole content box with
main justifyContent/cross alignItems. Main reversal/row RTL retain prior behavior;
wrap-reverse reverses only omitted cross alignment and combines with column RTL.
Flow lines/alignContent do not supply a source-slot static position. Existing
sizing, no-query/decorations/margins, containing-owner and cleanup boundaries hold.

Public RED failed on the former anchor guard before runtime edits. Focused5files
passed75/2skip77, including all directions/anchors, cross stretch/logical policies,
main distribution policies and exact bounds/pair/aspect/provider/Text omitted-axis
placement. Text origins use real Canvas ink metrics. Source and built each passed
64 native geometry matches with227inputs and zero cleanup/errors. Two proven
right-bottom fixtures fully cover absolute B with later-source C; exact geometry
and overlap targeting still verify their occlusion. The final screenshot was
inspected. Latest navigation passed1/413skip414. Scoped review found no material
issue. Fresh installed package passed245inputs, strict Bundler/NodeNext,64wrapped
alignment states, identity/paint reuse/input/cleanup and104 auto-margin cases.
Tarball SHA256 `73b9522bd3bd6d5cbcb4679a815c3737524f9264524ecc371e98e1965951cbe3`.
Docs109 mutation probes/JSDoc passed; final normal44/33skip77, types, changed
lint and public5/full621 boundary passed. Logs `/tmp/pibbl-slice142-{public-red,focused-final,normal-final,latest,source,built,packed,types-final,lint-final,docs,boundary}.txt`.
Corpus621 is487matches/126preserved-semantic/8font-source; nine query differences
remain separate. No full621-case replay, kernel/ABI change, font parity, speed,
Node24 aggregate trust or release-gate completion is claimed. Fixed33 unchanged.

## Slice143 delivered: physical percentage absolute insets

Physical absolute insets accept signed decimal percentages using the existing
Length surface; right/bottom types now match left/top. Resolve horizontal edges
against selected padding-box width and vertical edges against its height after
containing inheritance. Preserve authored percentages across exact forwarding;
scalar resolution precedes existing paired-auto/aspect/bounds/anchoring. Finite
negative/>100% offsets may overflow; malformed, automatic and nonfinite results
reject. Relative offsets remain numeric. No cache, kernel or ABI change.

Public RED captured numeric-only inset rejection before production. Focused4files
passed75/2skip77; normal44/33skip77; Latest1/413skip414. Public evidence covers
all directions/wraps, precedence after bounds, resize, aspect, overflow, signal
forwarding and static/relative containing references with exact cleanup. Types and
lint pass. The public consumer's two old number-only negative assertions migrated
to positive absolute percentages plus negative automatic inset assertions. Fresh
packed verification passes245inputs, strict Bundler/NodeNext with explicit typed
four-edge percentages, mounted geometry/input/identity/paint/cleanup and104auto
margin cases. Tarball SHA256
`ee575a3fd4552e5d37afee0f96a7df1be621fb701d66e92313601508783657b6`.
Docs109 mutation probes and JSDoc pass. Public API descriptions had stale nowrap,
containing-owner and Text boundaries from earlier slices; these were migrated
alongside the type change, preserving unrelated sizing deferrals.

Native38records preserve authored percentage strings.28whole-fixture geometry
matches and10preserved-content-box-reflection comparisons are classified. Absolute
B is native-exact in all38; asymmetric L10/R30 column wrap-reverse flow reflection
is native−20px in both writings. Initial comparison data incorrectly used +20RTL
from an unrelated logical-inset fixture; actual browser geometry corrected it.
Final source and built replays each passed all38 (28matches/10classified),
227source/dist inputs, exact cleanup and zero errors. The built screenshot was
inspected. The replay driver also excluded this absolute family from its unrelated
final ordinary-flow gap probe after all case-specific assertions had passed.
Logs `/tmp/pibbl-slice143-{public-red,focused-final,normal,latest,source,built,packed,types-final,lint,docs,boundary}.txt`.
Corpus659 is515matches/136preserved-semantic/8font-source; nine query differences
remain separate. No full659 replay, font parity, speed, Node24 trust, fixed33
capability-status or seven-release-gate completion claim.

## Slice144 delivered: content-box percentage static/relative insets

Finite direct-Flex static/relative insets accept signed decimal percentages:
horizontal edges use immediate parent content width and vertical edges its height.
Static validates then ignores insets; relative translates final geometry once
without changing its flow slot or siblings. Existing LTR/RTL physical precedence,
main/wrap reversal sign preservation, finite overflow, forwarding and admitted
known-owner boundaries remain. Absolute percentages still use the selected
padding box; sharing the scalar resolver does not share their reference box.
This is a new percentage-reference policy, not a claim of legacy percent parity.

The repaired test artifact produced a genuine RED on numeric-only relative inset
validation before runtime edits. Focused4files passed77/2skip79, normal44/35skip79,
Latest1/413skip414. Public proof covers all directions/wrapping, omitted/static
flow equality, relative leading/trailing deltas, negative/>100%, resize, stable
siblings/keys, focus/hits, malformed/auto/nonfinite rejection and exact teardown.
Signal-owned fixed direct Flex owners additionally prove content-relative owner
movement and descendant absolute padding/inherited containing references.
Independent Chromium151.0.7922.34 CSS geometry verifies content160x60 deltas
+16/+12 LTR, -24/+12 RTL and +20/+20 after resize. Receipt:
`/tmp/pibbl-slice144-css-basis.json`. Pinned single-child Yoga also substantiates
that scalar reference; wrapped Yoga static/cross/reverse placement differs and
is retained raw rather than adopted as Pibbl flow policy.

Source and built each passed50 comparisons (3exact/47classified),227inputs,
source-order exposed targets/overlap, paint reuse, zero errors and cleanup000.
Final screenshot inspected. Native expected Pibbl slots are derived independently
from physical content geometry; classification preserves Yoga boxes. Fresh packed
consumer passed245inputs, strict Bundler/NodeNext, content-axis/static/relative
geometry, resize, input/identity/paint/cleanup and104 auto-margin cases. Tarball
SHA256 `d1d90b45d9ca83a2a5cdca3438538d0577d230dd2a36380a8c9f40b586e3ee7c`.
The packed omitted baseline was corrected to omit insets along with position.
Types, changed lint, docs109 mutation probes/JSDoc and public5/full709 boundary
passed; scoped review found no material issue. Logs
`/tmp/pibbl-slice144-{public-red,focused-final,normal,latest,source,built,packed,types-final,lint,docs,boundary}.txt`.
Corpus709 is518matches/183preserved-semantic/8font-source; nine query differences
remain separate. No full709 replay, kernel/ABI/cache change, font parity, speed,
Node24 trust, fixed33 status or release-gate completion claim.

## Consolidation48 completed for slices142–144

Separate142 `357167b2`,143 `f644de8c`,144 `ced23362`. Fresh Node26.9.0,
macOS arm64 and Playwright Chromium:41 files passed658/11skip669 experimental
in79.95s; normal234/435skip669 in4.41s. Expected negative diagnostic output is
not a runtime failure. Final docs109 mutation probes/JSDoc passed with slice144;
logs `/tmp/pibbl-consolidation48-{focused,normal}.txt` and
`/tmp/pibbl-slice144-docs.txt`. Fixed33 statuses/seven open release gates and
Node24 aggregate trust remain unchanged. Public composition usability work is
independent of this completed correctness checkpoint.

## Completed slice145 — finite percentage absolute dimensions and bounds

Absolute width/height and min/max use the selected padding-box dimensions before
aspect derivation, paired-auto bounds and pure-provider fixed-axis queries.
Authored forwarding and signals consume the final allocated size once. Existing
allocation input revisions, measurement cache ownership, ABI, public exports and
Pibbl contradictory-bound rejection are preserved. Opaque component providers,
child decorations, logical insets and both-auto custom providers remain outside.
The initial provider test incorrectly hid a primitive behind an ordinary function;
the corrected test exercises the supported direct primitive boundary.

Fresh macOS/Chromium evidence under Node24.15.0, installed pnpm11.21 dependencies:
seven focused files86 passed/2 skipped (88), normal lane44 passed/44 skipped (88),
public lesson one passed/414 skipped (415). Source and built lesson geometry,
red/green pixels,11→12 Text reflow, hits and cleanup `[0,0,0]` pass; built uses469
dist inputs. Badge width changes125→100 and height remains34.8. Typecheck,
changed-code lint, docs109 RED probes, JSDoc6555 links and Studio docs pass.
Isolated installed tarball proof passed Bundler/NodeNext,245 installed dist
inputs, percentage-size geometry/hits/focus/paint reuse and exact cleanup.
Tarball SHA256: `1a09cb045e5dd109e001d1c38d4c0a65aa15f3f570a5dc5f66a4c0cc30462bba`.
Scoped review found no material issue. Native pinned Yoga sizing probe agrees
for percentage sizes, bounds, paired auto and aspect; contradictory min/max
remains an explicitly preserved Pibbl rejection rather than Yoga's clamping.
No full709-case replay or aggregate trust claim. Fixed33 statuses and seven
open release gates remain unchanged. Logs: `/tmp/pibbl-slice145-*`.

## Completed slice146 — fixed direct wrapped containing owners

A wrapped parent admits an explicit static/relative direct Flex owner only with
finite numeric width/height, zero grow/shrink, auto/omitted basis and internal
nowrap. Parent main/writing/wrap direction does not change the owner's logical
slot. Relative offsets move final geometry; static passes the selected ancestor
padding box through settled metadata. Unknown, opaque/transformed, intrinsic,
flexing and internally wrapped positioned owners retain their diagnostics. No
public API, native ABI or cache change. Existing inherited containing contexts
remain conservatively uncached.

The public lesson adds a gold pin: relative anchors it inside green, static uses
the outer box. Both source5192 and built5193 previews pass geometry, gold/red/
green pixels,11→12 Text reflow, clicks and exact `[0,0,0]` cleanup. Focused public
RED failed the old wrapped-owner gate before production changes. Fresh Node24.15/
Chromium evidence:4 files81 passed/2 skipped (83), normal44 passed/39 skipped;
lesson1 passed/414 skipped (415). The hardening covers16 parent direction/wrap/
writing combinations, each static and relative, plus owner resize and stable
identity. The initial resize assertion incorrectly added the relative offset a
second time; it was corrected to the already-translated owner plus child inset.
Installed proof initially omitted FocusManagement; the required public boundary
is now mounted and keyboard/source-order evidence passes.

Installed tarball passes Bundler/NodeNext with245 actual dist inputs, wrapped
owner geometry, focus, hits, paint reuse and cleanup. SHA256:
`6432316446f33ea2244469ff552a8d868f4e97f1678b13152dc101839c7bec59`.
Typecheck, changed-code lint, docs109 RED probes, JSDoc6555 links and Studio docs
pass; scoped review found no material defect. Source/built lesson469 dist inputs.
The API reference/JSDoc also reconcile145's percentage-size wording. Fixed33
statuses, seven open release gates,709-case native corpus and aggregate trust
remain unchanged. No full-corpus replay is claimed.

## Completed slice147 — logical absolute insets

Public `insetStart`/`insetEnd` accept finite numbers or signed decimal percentages
on existing experimental direct absolute Flex profiles. Receiving direction maps
start to left in LTR/right in RTL, end to the opposite. Logical values override
the corresponding physical edge including zero; percentages use the selected
padding-box width. Private reads preserve authored fields for exact object and
whole-style signal forwarding. Paired-auto, aspect and natural-provider admission
uses the same effective edges. Signals classify these inputs as layout work.
Unsupported modes/layouts diagnose rather than ignoring the fields. Studio's
editor declarations, JSDoc and public type evidence include both fields.

Two public tests failed before production changes. Invalid-input hardening found
`null` was treated as absent by nullish coalescing; two additional REDs pin that
failure, and only exact undefined now falls back to the physical edge. The whole
style signal proof changes edge, direction and owner width while retaining key
identity. An inherited-owner proof separates receiving RTL from an outer LTR
containing box. Scoped review found no other material issue; null rejection and
its final getter changes are covered by fresh checks.

Fresh Node24.15/Chromium evidence: six focused files98 passed/2 skipped (100),
plus the separately extended inherited-owner file3 passed; normal six-file lane
51 passed/50 skipped (101). Source5192 and built5193 lesson pass physical→logical
LTR→logical RTL→physical geometry, pixels/hits,12→13 Text reflow and `[0,0,0]`
cleanup; built uses469 actual dist inputs. Installed tarball passes Bundler/
NodeNext accepted and rejected type cases,245 actual dist inputs, logical edge
signals, zero precedence, paired percentages, resize, focus/hits, identity,
paint reuse and cleanup. Its initial following-card click was above the padded
flow box; the point was corrected without runtime changes. Tarball SHA256:
`b7f3d0ccdad961b2932bf72264dafcab894fd30bb228dc17b0ca1c6a8c95fe26`.
Pinned Yoga3.2.1 commit042f501 confirms logical precedence, zero, percentages and
inherited direction with pointScale0/useWebDefaultsfalse/noErrata. This does not
claim logical relative parity or add cases to the709-case corpus. Typecheck,
lint, docs/JSDoc/Studio checks pass. Fixed33 statuses and seven open release
gates remain unchanged; no aggregate trust claim. Logs: `/tmp/pibbl-slice147-*`.

## Consolidation49 — completed145–147 verification and gate audit

Fresh Node24.15.0/Chromium combined run:43 files,679 passed/11 skipped (690),
80.51s. Normal lane:43 files,241 passed/449 skipped (690),4.54s. The same targeted
ownership, measurement, loading, sizing and positioning set is extended only by
145 and147's new public files. Logs:
`/tmp/pibbl-consolidation49-{focused,normal}.txt`. Final147 installed proof uses
245 dist inputs; source/built lesson uses469 built inputs and exact cleanup.
Docs now compile110 API examples and315 snippets;109 mutation probes pass.
JSDoc resolves6557 links over3458 members. These are fresh bounded checks,
not the aggregate trust gate or a full709-case replay.

The fixed ledger remains33 entries:8 complete,12 experimental,6 partial,
6 missing,1 excluded; all seven release-gate groups remain open. 145–147 improve
finite positioning but do not complete general containing ownership, absolute
layout children/decoration, general intrinsic dimensions or both-auto providers,
logical relative/static policy, or hidden/contents identity and events. Wider
measurement, root-wide atomic publication, Grid, standalone/migration and release
integration remain their existing accepted exits. No new capability is invented
and no completed subset silently substitutes for those targets.

The audit identifies material stale text in `flex.reverse-and-wrap-reverse`:
its RTL-unsupported/RTL-missing statements contradict the already-complete
`direction.rtl-and-logical-edges` evidence. Existing24 direction fixtures already
include four combined reverse/wrap-reverse LTR/RTL cases with public/source/built/
installed geometry, targets, identity and cleanup. Do not add another native
matrix. One missing interaction receipt is real: the wrapped-collections example
turns line reversal off before its overlapping composition proof, so that proof
does not establish source-order overlap under wrap-reverse. The next item closes
that small proof gap and reconciles this capability's ledger. Even if it becomes
complete, `flex-core` still needs min/max and automatic-minimum exits; no single
next item honestly closes a release gate. That is the shortest supported route
toward the first gate, not a promise of a fixed remaining slice count.

## Slice148 complete: reverse/wrap-reverse capability evidence

The existing wrapped-collections composition mode now uses two overlapping
wrap-reverse lines when Flip lines is enabled. Group translation, a Layer and
opacity filter preserve later-source B paint/target priority, pointer-none A
fallback and A→B keyboard order through main reversal and RTL. Default nowrap
composition remains unchanged. No core runtime, public API or native fixture was
added. The public test failed on the original single-line geometry before the
scenario change. Driver focus entry now explicitly blurs/refocuses the Canvas.

Fresh evidence (2026-10-23): Node24.15/Chromium focused composition tests2 passed,
414 skipped; isolated packed Bundler/NodeNext types and installed runtime passed,
245 dist inputs, receipt `wrappedReverseComposition=true`, exact disposal. Tarball
SHA256 `b7f3d0ccdad961b2932bf72264dafcab894fd30bb228dc17b0ca1c6a8c95fe26`.
Node26.9/Chromium source and built wrapped drivers passed geometry, filter pixels
(RGB±1 quantization tolerance, exact alpha), focus, targets, identity and paint
reuse; built469 inputs. Existing24 direction fixtures passed source/built:
2 native matches and22 explicitly classified preserved differences. Pinned native
rehearsal reproduced709 reference cases; this is not a709 public-runtime replay.
Typecheck and changed-code lint passed. No aggregate trust claim.

The reverse capability is complete within its finite supported contract. The fixed
33-entry denominator now has9 complete,11 experimental,6 partial,6 missing and1
excluded; all7 group release gates remain open. This closes a capability proof
gap, not the whole Flex gate or default migration.

## Slice149 delivered: column custom-provider automatic minimum

The paired custom-provider API now supplies a bounded column automatic minimum
through its existing finite `measure` callback at exact declared content width.
No intrinsic-pair height was reinterpreted: those describe content at different
widths. The path is direct, finite LTR column/nowrap, numeric basis and width,
zero grow, positive shrink, no active cross bounds/aspect/query, numeric main
height/bounds only. Explicit `minHeight:0` avoids the minimum query. Existing
region cache, allocation revision and dependency/teardown ownership remain intact.

The public regression failed on the original explicit-minHeight diagnostic.
It uses deliberately different intrinsic heights90/10 but finite natural height
40→70; the following target moves y40→70, then y20 on explicit-zero escape.
Keys remain stable; sibling paint reuses the automatic floor snapshot and solves;
disposal detaches resources and measurement-only signals. The existing public
lesson adds the compact column at bottom left, sharing Minimum/Escape/Paint
controls. Source: `http://127.0.0.1:5192/#/examples/layout/wasm-flex-intrinsic-primitive`;
built: `http://127.0.0.1:5193/#/examples/layout/wasm-flex-intrinsic-primitive`.

Fresh Node24.15/Chromium focused provider/minimum tests11 passed (413 skipped),
plus the strengthened automatic-paint test1 passed (416 skipped). Normal Flex
unit tests40 passed; the selected experimental-only normal lane423 skipped.
Node26.9/Chromium source and built lesson drivers passed both column-minimum and
prior final-width checks,469 built inputs, cleanup `[0,0,0]`, no browser errors.
The Node24 installed tarball proof passed strict Bundler/NodeNext and runtime,
245 dist inputs, `columnAutomaticProviderMinimum=true`, tarball SHA256
`ff1748ef54ed7c0f8f41cd8aae028524be03a20038fb82b92830052168da2c7a`.
Typecheck, changed-code lint,170-lesson catalog and documentation checks passed
(109 RED mutation probes). Scoped review corrected percentage-main admission;
the boundary test passed (1 passed/417 skipped), covering explicit-zero no-query,
unpaired and percentage pre-query rejection, and numeric clamps. No native
parity, capability promotion, group release or aggregate trust claim.

## Slice150 delivered: decorated reverse main-axis percentage bounds

Four appended pinned Yoga records cover two resized decorated border-box pairs:
row-reverse grow maxWidth25% and column-reverse shrink minHeight70%. Outer
144→184 resolves content main100→140, origin12,22. Row A width25→35 and B63→93;
column A height70→98 and B18→30. Initial column bases160 plus gap12 exceed the
available main size, so the floor test actually exercises negative free space.
The exploratory244→284 setup was discarded because Yoga did not enter shrink.
No production solver or API changed; these are new evidence for existing behavior.

Fresh pinned Yoga3.2.1 (`042f5013152eb81c1552dec945b88f7b95ca350f`), point scale0,
no web defaults/errata: native write and independent regeneration reproduced713
records. The four new records match public mounted geometry exactly; the public
Node24.15/Chromium tests2 passed (418 skipped). Source/built Node26.9/Chromium
private lab replay passed4 native matches,227 inputs, eight A/B targets, prior-gap
points transferring to B on resize, stable keys/nodes, paint solve reuse and
cleanup `[0,0,0]`. Latest proof selects the appended family; older sections retain
source order. Hands-on: `http://127.0.0.1:5192/#/testing/layout-yoga-migration`;
built: `http://127.0.0.1:5193/#/testing/layout-yoga-migration`.

The Node24 installed proof passed Bundler/NodeNext/runtime,245 dist inputs,
`reverseDecoratedMainBounds=true`, tarball SHA256
`ff1748ef54ed7c0f8f41cd8aae028524be03a20038fb82b92830052168da2c7a`.
Public five-case corpus remains separate and agrees with the full713-record
source. Typecheck and changed-code lint passed. The capability ledger retains
other main-axis role combinations and indefinite-owner/measure-mode policy gaps;
no status or release gate was promoted. Native totals are522 unclassified records,
183 preserved semantic differences and8 font-source records; no713-case public
runtime replay or aggregate trust result is claimed.

## Consolidation50 completed for148–150

Separate delivery commits148 `91b36dca`,149 `bc74da58`,150 `f592b00c`.
Fresh macOS/Node24.15/Playwright Chromium combined proportional set:
experimental43 files,684 passed/11 skipped (695),82.59s; normal43 files,
241 passed/454 skipped (695),4.74s. Logs:
`/tmp/pibbl-consolidation50-focused.txt` and
`/tmp/pibbl-consolidation50-normal.txt`.

The first combined run exposed two harness-integration omissions from150. The
legacy contiguous original-family walk now excludes the separately verified
appended family, rather than incorrectly advancing one case across skipped
sections. Latest-proof navigation expects the first record of the appended
family. The corrected combined run passed; production runtime was unchanged.
The dedicated150 public/source/built/packed receipts remain independent evidence
for its new records. This is not a713-case public-runtime claim.

Documentation checks passed109 RED probes,110 compiler-checked API programs and
315 parsed snippets. Public JSDoc passed6557 resolved links/3458 members; Studio
metadata/rendering/API/manifest checks passed. Typecheck and changed-code lint
passed. Current installed proof has245 dist inputs, strict Bundler/NodeNext and
runtime receipts for148–150, SHA256
`ff1748ef54ed7c0f8f41cd8aae028524be03a20038fb82b92830052168da2c7a`.
No aggregate Node24 trust or release-gate closure is claimed.

The fixed33 capabilities remain9 complete,11 experimental,6 partial,6 missing
and1 excluded, with all7 release gates open. Accepted broad intrinsic, placement,
transactional publication, Grid, migration and release exits remain explicit.

## Slice151 delivered: symmetric decorated reverse main bounds

Four separately flagged, appended native records complete the finite role matrix:
row-reverse minWidth70% and column-reverse maxHeight25%, outer144→184/content
main100→140. Row A(42,22,70,10)→(54,22,98,10), B18→30 at12,22; column
A(12,97,10,25)→(12,127,10,35), B63→93 at12,22. No solver/API changed.
The native source was compiled from pinned Yoga3.2.1 with point scale0/no web
defaults/no errata, then regenerated independently. The corpus now has717
records:526 without divergence classification,183 preserved semantic differences
and8 native-font-source records. No full717-case public runtime claim is made.

Fresh Node24.15/Chromium focused checks5 passed (417 skipped): both new public
resize/hit/key/paint/disposal cases, both prior150 cases and Latest-proof
navigation. The public test agrees with the native record geometry. The Node24
installed proof passed strict Bundler/NodeNext and runtime245 inputs, separate
`reverseDecoratedMainSymmetricBounds=true` receipt, exact cleanup; tarball SHA256
`ff1748ef54ed7c0f8f41cd8aae028524be03a20038fb82b92830052168da2c7a`.

Node26.9/Chromium source and built private replays each passed4 native matches,
227 inputs, A/B targets and previously empty points transferring to B after
resize, stable keys/nodes, paint solve reuse, cleanup `[0,0,0]`, errors `[]`.
The prior150 four-case source replay also passed. Named section navigation now
reaches both families independently of which proof is newest; latest-navigation
and legacy-walk test coverage includes the new flag. Source:
`http://127.0.0.1:5192/#/testing/layout-yoga-migration`; built5193 same route.
Public default corpus remains5 cases and agrees with717-record source.
Typecheck/changed-code lint passed. Scoped review found no material issues; documentation checks passed109 RED
mutation probes. `flex.min-max` stays partial only for the separate indefinite-owner
and explicit-measure-mode policy. Fixed ledger9/11/6/6/1 and all7 release gates
remain unchanged; no aggregate trust claim.

## Slice152 delivered: exact caller-width row measurement

The existing public `measureElement(element, Constraints, service)` and nested
measurement callback now recognize a finite equal minWidth/maxWidth as a definite
content width for omitted/automatic-width LTR nowrap rows. Direct numeric-main,
declared-cross contributions may resolve percentage minWidth/maxWidth against it;
maximum-only and unbounded availability remain unsupported when those bounds need
a basis. Zero is exact; conflicting resolved bounds diagnose before callbacks.
No new signature, intrinsic-height interpretation, cache or fixed point was added.
Other intrinsic restrictions remain unchanged, including grow and percentage
main sizes/basis, gaps/padding/margins outside their separate admissions.

The public `layout-exact-row-measurement.test.tsx` imports supported package APIs
and failed before production edits on the old percentage-bounds rejection. The
completed exact/at-most/unbounded/contradictory/zero proof and existing Flex unit
suite passed under Node24.15/Chromium:41 passed/1 skipped across2 files (42).
Normal mode40 passed/2 skipped (42). Pure definite child geometry never invokes
its measure callback. No Node26 result is substituted for these focused tests.

The existing intrinsic-provider lesson now composes an exact-width finite column
provider with an omitted-width measured row. Owner80→40 caps A20→10 alongside a
fixed20px B; semantic geometry/stamps precede transformed pixel and moved-target
assertions. The geometry inspector and private component definitions belong to
one example mount. Source:
`http://127.0.0.1:5192/#/examples/layout/wasm-flex-intrinsic-primitive`;
built5193 same route. No new controls or public lesson were added.

Fresh Node26.9/Chromium source/built drivers passed exact-row plus prior column
minimum/final-width checks,469 built inputs, cleanup `[0,0,0]`, no errors. The
Node24 installed tarball passed strict Bundler/NodeNext/runtime,245 dist inputs,
`exactRowMeasurementBounds=true`, SHA256
`64f4f8c68b7b6f4c2af412a451dba4e4c5cab1d2c5f0eec4180af55f334fb8e2`.
Typecheck, changed-code lint,170-lesson catalog and documentation checks passed
(109 RED probes). Scoped review was clean and supplied the exact-zero boundary.
The native717-record corpus is unchanged; no new native parity or aggregate trust
claim. Fixed ledger9/11/6/6/1 and all7 release gates remain unchanged.

## [DONE] Slice153: exact caller-height column measurement

The existing public `measureElement(element, Constraints, service)` and nested
measurement callback now recognize a finite equal minHeight/maxHeight as a
definite content height for omitted/automatic-height LTR nowrap columns. Direct
numeric-main, declared-cross contributions may resolve percentage minHeight/maxHeight
against it. Maximum-only and unbounded availability remain unsupported when those
bounds need a basis; zero is exact; conflicting resolved bounds diagnose before
provider evaluation. This is the symmetric acyclic counterpart to slice152: it
does not reinterpret width-paired intrinsic heights, add a signature, cache,
keyword vocabulary, fixed point or general indefinite-owner rule.

`layout-exact-column-measurement.test.tsx` is a supported public-API proof for
exact, at-most, unbounded, contradictory and zero constraints. Its focused
experimental lane passed 43 tests/1 skip across three files; normal mode passed
40 tests/4 skips. The installed Node24 packed consumer passed strict
Bundler/NodeNext/runtime verification with `exactColumnMeasurementBounds=true`,
245 dist inputs and exact absolute-wrapper geometry, target transfer, paint reuse
and cleanup. The source Studio driver passed all four intrinsic flags, including
exact row and column, with no page errors and cleanup `[0,0,0]`.

The existing intrinsic-provider lesson now shows one shared exact-cap composition:
a finite row measures omitted width and a one-auto absolute paired provider
measures omitted height with unbounded width. In both cases owner80→40 caps
A20→10 beside fixed B20, with geometry, target and transformed-pixel evidence
before cache and cleanup assertions. It adds no controls or public API.

Fresh frozen-file source and built Studio replays passed all four flags; built
used469 dist inputs, both retained provider/measurement counts on paint, cleanup
was `[0,0,0]`, and browser errors were empty. Logs:
`/tmp/pibbl-slice153-source-final.txt` and
`/tmp/pibbl-slice153-built-final.txt`. The earlier built HMR counter reset is
superseded by this independent clean replay. Final packed proof passed245 inputs
with tarball SHA256
`a4a8f7b12d901bd6a21d0a2147abb18ec06e1929de6ada80ad8e4ede13194fdc`.
Typecheck, changed-code lint and170/12/33 catalog validation passed. No aggregate
trust claim. The native corpus remains717 records and no native parity claim is added.
`flex.min-max` remains partial only for the separate indefinite-owner and broader
measured-owner policy; fixed ledger9/11/6/6/1 and all7 release gates remain open.

## [DONE] Consolidation51 for slices151–153

Separate delivery commits151 `58dc7783`,152 `5cb9ca57`,153 `4bd6ff9b`.
Fresh macOS/Node24.15/Playwright Chromium bounded checks: experimental45 files,
690 passed/11 skipped (701),82.43s; normal45 files,241 passed/460 skipped
(701),5.36s. Commands used the consolidation50 selected file list plus
`layout-exact-row-measurement.test.tsx` and
`layout-exact-column-measurement.test.tsx`, with
`node node_modules/vitest/vitest.mjs run <selected files> --mode layout-wasm
--browser.headless --browser.ui=false` and the same command without `--mode`.
Logs `/tmp/pibbl-consolidation51-focused-final.txt` and
`/tmp/pibbl-consolidation51-normal.txt`.

The first combined run found one stale negative assertion expecting the former
broad percentage diagnostic. It now expects the exact-row requirement in the
experimental row case, preserving unsupported status and no-allocation checks;
normal and cross-axis cases retain the old diagnostic. No production behavior
changed during consolidation. Fresh frozen source/built and installed153 proofs
remain independent receipts. Final installed proof was rerun on Node24.15:
245 dist inputs, strict Bundler/NodeNext/runtime, SHA256
`a4a8f7b12d901bd6a21d0a2147abb18ec06e1929de6ada80ad8e4ede13194fdc`.

Documentation checks passed109 RED probes,110 API programs and315 snippets;
public JSDoc6557 links/3458 members and Studio metadata/rendering/API/manifest
checks passed. Slice153 typecheck, changed-code lint and catalog170/12/33 passed.
No aggregate trust or native717-case public-runtime replay is claimed.
Fixed33 capabilities remain9 complete/11 experimental/6 partial/6 missing/1
excluded; all7 release gates remain open. Exact row/column admission is bounded:
maximum-only availability never becomes a percentage owner, both-exact fast
paths are deferred, and intrinsic cycles require a specified policy rather than
zero substitution or convergence guesses. General intrinsic vocabulary and
measurement ownership remain separately tracked; finite profile permutations
are not new capabilities.

## [DONE] Slice154: column Text natural cross-width with auto side margin

A direct generic unwrapped Text in a finite LTR nowrap column now measures its
natural cross width with unbounded width and exact declared numeric height before
auto side-margin absorption. Automatic basis, zero grow/shrink, minHeight0 and no
bounds/query/aspect remain required. Existing caches/ABI/API are unchanged.
The focused public test first failed the existing margin diagnostic before the
production change. Stable descriptors and glyph-interior points preserve actual
Text hit semantics; no hit box is widened to the declared height.

Fresh Node24.15/Chromium public checks:2 passed/422 skipped (424), including a
six-profile boundary matrix rejecting before text measurement. Ordinary selected
checks:1 passed/463 skipped across two files. Supported proof verifies real Canvas
ink width, signal text shortening, paint/draw and glyph-target movement, source
focus order, stable native identities, zero isolated column measurement/solve on
sibling paint, and baseline resource counters after disposal. Scoped review clean.

The existing Flex/Text learning composition adds a stable right-aligned column
label. Source: `http://127.0.0.1:5192/#/examples/layout/wasm-flex-text`;
built5193 same route. Choose Compare auto margins, then Change column text.
Source/built focused drivers passed: ink width81.9873046875→51.982421875,
x518.0126953125→548.017578125, y280, moved glyph targets,469 built inputs,
cleanup `[0,0,0]`, no errors. The adjacent row intentionally retains one existing
automatic-minimum request on paint; the isolated column public test proves its own
zero measurement reuse. Existing full row/wrapped/minimum lesson drivers also
passed independently in source/built. Actual Canvas bitmap was visually inspected.

Node24 installed tarball passed Bundler/NodeNext/runtime,245 dist inputs,
`columnTextCrossAuto=true`, SHA256
`9f32240fab1fa79dd3c4ed56f207eedd379b6097dec0555fe8b4ac9863d593df`.
Types, changed-code lint, catalog170/12/33, docs109 RED probes/110 API programs/
315 snippets and formatting passed. Native717-record corpus unchanged; no font
parity, aggregate trust or release-gate closure is claimed. `flex.auto-margin`
remains partial for its broader owner/intrinsic paths; fixed9/11/6/6/1 ledger and
all7 gates unchanged. This slice extends an existing entry rather than closing it.

## [DONE] Slice155: public Grid mixed-track spanning resize evidence

Existing public GridStudy now demonstrates a border-box owner560→700, height320,
padding80, columns150/25%/1fr, rows100/1fr and gap14. Content is400→540 by160.
B spans two rows and columns: (244,80,236→376,160). Row-two C is
(80,194,264→299,46), D is(358→393,194,122→227,46). Later C and D independently
paint and receive clicks above B; source Tab order stays A/B/C/D. Keyed stamps
persist and paint-only fill changes reuse native track/cell placement.
No runtime algorithm, native ABI or public signature changed.

The new public GridStudy interaction test first failed because the prior lesson
had no resize/inspector contract. It passes after the runnable composition update.
The initial lesson implementation explicitly adopted border-box to express its
intended outer dimensions. Its inspector initially cached an obsolete Studio
transform at construction; a private transparent primitive now captures the actual
render basis before descendants. Only inverse-transformed x/y use1e-9 tolerance;
logical widths/heights and native results remain exact. Actual bitmap inspected.

Fresh macOS/Node24.15/Chromium receipts:

- Public lesson1 passed in experimental and ordinary modes, including both overlap
  targets, source focus, paint reuse and exact native/measurement/inspector cleanup.
- Selected existing Grid/native/public suite13 passed/412 skipped (425) in2 files;
  Grid contract suite16 passed, including invalid placement/span rejection.
- Source and built Studio semantic geometry/pixels/input/focus/cache/cleanup passed,
  469 built inputs, no errors. URL `http://127.0.0.1:5192/#/examples/layout/grid`;
  built5193 same route. Drivers use the actual Canvas basis for pixel mapping.
- Installed Node24 strict Bundler/NodeNext/runtime passed245 dist inputs,
  `gridExplicitSpans=true`, SHA256
  `9f32240fab1fa79dd3c4ed56f207eedd379b6097dec0555fe8b4ac9863d593df`.
  Typecheck, changed-code lint, catalog170/12/33 and docs109 RED probes/110 API
  programs/315 snippets passed. Scoped review findings for C overlap and focus
  were resolved; the render-basis correction was reviewed without material issue.

Relevant logs are `/tmp/pibbl-slice155-{public-ownership,normal-final,focused,
grid-contracts,source-second,built-final,packed-final,types-basis,docs-final}.txt`.
No Yoga Grid/font parity, aggregate trust or release-gate closure is claimed.

The manifest's missing spans/fr/percentages were stale and are corrected. The
original accepted Grid row also requires intrinsic/minmax tracks; this receipt
must not silently assign that obligation elsewhere and declare the entry done.
`grid.explicit-placement` remains partial for the full declared target. Fixed33
capabilities remain9 complete/11 experimental/6 partial/6 missing/1 excluded,
all7 gates open. This closes finite public evidence debt, not the broad capability.

## Slice156 ready for feedback: final-allocation baseline providers

The public `measureBaselines` operation receives resolved props, full normalized
style, a final local content allocation and measurement service. Its fixed result
contains finite ordered first/last offsets or an explicit unsupported reason.
Signed and out-of-box offsets are valid. Missing providers use the content bottom;
declared failure does not fall back. Experimental finite LTR nowrap rows admit
`alignItems: "first-baseline"` on direct fixed primitive leaves. WASM ABI v6 owns
the numeric cross placement after final main allocation; JavaScript does not
replace the resulting coordinates.

Installed offline tarball proof passed strict Bundler/NodeNext types and browser
lifecycle with245dist inputs, SHA256
`03616e652bdbf989577dc9030a7168b909309b7febe54aad97b123e80dfa2fd5`.
Detachment checks snapshot after required sibling reflow, then require the removed
provider signal to leave queries, solves, cross placement and node counts unchanged.
Ordinary mode passed14tests with4experimental cases skipped.

Public tests failed before production implementation. Fresh Node24.15/Chromium
focused tests passed17 with1 normal-only case skipped across2files. Coverage
includes final allocation, signal changes, source focus and moved hit targets,
invalid offsets, writes/render-hook purity, conservative own-style invalidation,
unrelated sibling paint reuse and exact cleanup. The pinned Rust1.99 kernel has
14 passing tests and a69,628-byte matching generated binary (SHA256
`119b451f28fcbbd7467692a7bd3316f89a4c0639def99fe842d87c8482234b90`).
Pinned Yoga3.2.1 source regeneration independently reproduced721 records:530
unclassified,183 preserved semantic differences and8 native-font-source records.
Four new numeric-provider cases replayed in source and built with final width60,
negative/out-of-box offsets, missing-provider fallback and cleanup `[0,0,0]`.
This is four-case runtime evidence, not a721-case replay or font-parity claim.

Hands-on: `http://127.0.0.1:5192/#/examples/layout/wasm-flex-baseline` (built5193
same path). Move B's supplied baseline, resize the owner, paint the separate
indicator, click the moved cards and Tab through A/B/C. Source and built drivers
passed geometry, final widths60→80, stable identity, hit/focus, paint reuse,
indicator pixels and teardown with no browser errors; built used469dist inputs.
The earlier paint-count failure combined focus settling with a provider's own
style change; the final example isolates unrelated sibling paint. The earlier
built startup failure was a stale Vite source glob, corrected by restarting its
existing dedicated server. No cache revision guard was weakened.

Typecheck, public JSDoc, documentation, Studio catalog/search and focused lint
passed; catalog171lessons/12snapshots/33labs. Read-only focused review found no
material issue. `flex.baselines` moves only missing→experimental: fixed33 now
9complete/12experimental/6partial/5missing/1excluded, all7gates open. Automatic
Text fonts, multiline, nested propagation, last-baseline alignment and broader
layout admission remain accepted obligations. No aggregate trust claim.

## Consolidation52: slices154–156

Fresh Node24.15/Playwright Chromium verification: experimental715passed/12skipped
across48files (727tests),83.09s; ordinary261passed/466skipped,4.76s. This extends
the prior lane with GridStudy evidence, first-baseline public behavior and Grid
unit contracts. The first experimental attempt was stopped after identifying
stale corpus navigation: appended baseline cases must not join the original
contiguous-family walk, and Latest must select the new baseline family. The final
run includes those explicit navigation corrections. No runtime fix was needed.

Source/built/editor export parity initially caught stale ordinary build output,
then an existing editor-only exported `PreservedSignalPropKey` helper. Refreshing
the ordinary build and keeping that helper private restored exact parity; runtime
and Three addon checks passed. Typecheck, changed-test lint and generated kernel
integrity passed. Concise public corpus remains5cases matching the full721record
reference. The156 source/built public lesson, four-case private replays and strict
installed-package proof remain separate fresh receipts, not a full corpus replay.
No aggregate trust or capability/gate promotion is claimed.

## Slice157: percentage validity before indefinite-owner rejection

A focused public test failed before production code: malformed/negative percentage
bounds returned a generic unsupported owner instead of diagnosing invalid input.
The shared percentage parser now validates its decimal coefficient independently
of a containing reference. Intrinsic Flex validates each bound before deciding
whether owner availability is usable. This performs no guessed-zero resolution,
provider call, native allocation, cache relaxation or iterative solve. Valid
non-exact/unbounded percentage bounds keep the accepted targeted diagnostic.

Fresh Node24.15/Chromium:60passed/1skipped experimental and56passed/5skipped
ordinary across6files, including exact row/column and existing Flex/measurement
contracts. The installed offline tarball passed strict Bundler/NodeNext and public
runtime validity/resource evidence with245dist inputs, SHA256
`73b5942d69ee1c8eae5d017345d236a61364d599def9b1f19c4ec7a21719c5dc`.
Typecheck, focused lint and read-only changed-code review passed.

Independent native policy probe is reproducible via
`node tooling/layout-yoga-rehearsal.mjs --source <pinned-Yoga-checkout> --percentage-owner-probe`.
Six cases each run twice on fresh trees; pinned3.2.1 commit remains
`042f5013152eb81c1552dec945b88f7b95ca350f`, probe SHA256
`b0e76329816bb367ff3109137b6dcf91c2d0c3e7465c15831143bed0bddd26c4`.
With80+80 leaves and a25% cap, maximum-only160 yields owner120/first40;
40is not25%of the final120. An unbounded owner also yields120/40. With20+80
and a50%floor, maximum-only160 yields160/80 but unbounded yields100/20.
Exact160 yields cap40/floor80. This is phase-sensitive Yoga availability behavior,
not a generic final-owner fixed point. The standalone probe leaves the721record
main corpus untouched and makes no six-case Pibbl parity claim.

The accepted style/layout design explicitly diagnoses intrinsic percentage
feedback; adopting Yoga's temporary FitContent reference would be a new policy.
`flex.min-max` therefore remains partial, including the broader supported
intrinsic-owner obligation. This fixes invalid-input semantics and supplies the
required policy evidence without silently redefining completion. Fixed33 and all7
open release gates remain unchanged.

### Slice157 public lesson companion

The existing intrinsic-provider lesson now exposes **Check bound inputs** at
`http://127.0.0.1:5192/#/examples/layout/wasm-flex-intrinsic-primitive`
(built5193same path). One click compares valid unresolved bounds with negative,
malformed and nonfinite bounds in both axes under maximum-only/unbounded
availability. Canvas status and the inspector show12invalid rejections,4valid
unresolved results,0provider calls and unchanged resources. Source and built
headless public-button drivers passed with cleanup `[0,0,0]`, no browser errors,
and469built inputs. The existing exact-row source and exact-column built drivers
also passed geometry, moved hits, identity, paint reuse and cleanup. Typecheck and
focused lint passed. No new runtime rule, capability or gate promotion.

## Slice158 ready for feedback: real Canvas Text first baselines

Optional `CanvasMeasurementService.measureTextAtBaseline(text, { font,
textBaseline })` returns ordinary `TextMetrics` at the explicitly requested font
and baseline. Existing `measureText(text, font)` remains unchanged. A shared
private service restores Canvas state in `finally`; method receivers remain
intact for application-provided implementations. Text's built-in provider uses
its paint line layout at final allocation and converts the actual alphabetic
coordinate from `line.y - metrics.alphabeticBaseline`. Missing service, nonfinite
metrics or empty text diagnose instead of taking the missing-provider fallback.
The admitted profile is one nonempty unwrapped visible line, generic finite
positive px font, top/default baseline and existing fixed direct LTR row-nowrap
Flex envelope. No new ABI, cache exception or font-size approximation.

The public test failed first at the existing Text prohibition. Fresh
Node24.15/Chromium checks passed94experimental/2skipped and91ordinary/5skipped
across7files (96tests), including Text layout, Flex/Grid/Flow, pure measurement,
Canvas state restoration on throw, optional-service failure and method receiver
identity. Expected Text alignment is derived independently from the difference
between real top/alphabetic ink-ascent measurements, not a repeated implementation
formula or fixed platform font constant. Font/content updates preserve native
identity and move actual glyph targets; conservative function-prop invalidation
is retained. Read-only changed-code review found no material issue.

Public source `http://127.0.0.1:5192/#/examples/layout/wasm-flex-baseline`
(built5193same path): toggle **Text**, click the small Ag label and change the
paint indicator. Source/built drivers preserve the numeric provider/fallback
proof, assert live Text baseline equality, moved draw origins and glyph hits,
source focus, zero extra measurement/solve/cross/node work on unrelated paint,
and cleanup `[0,0,0]` with no browser errors. Built uses470dist inputs. On this
host, both Text baseline coordinates are420.3125; small10→16px changes the draw
origin411.984375→407.875. These are dated host observations, not font parity.
The actual Canvas bitmap was inspected.

The installed offline package passed strict Bundler/NodeNext, mixed-font baseline,
font-driven sibling movement, true glyph-target bubbling/identity and paint reuse
with246installed inputs, SHA256
`f772fad17e9162db0cc92f47380cc4db397c9863d0362fb3f7099fb7f738c4a4`.
Earlier package failures were fixture errors: unsupported absolute decoration,
a click point outside ink bounds, and expecting the dominant-font leaf rather
than its sibling to move. The corrected proof uses supported sibling placement,
live ink bounds and correct baseline-group geometry.

The earlier Studio111→121provider work was an inspector layout feedback loop:
long unbroken JSON changed iframe min-content width and repeatedly resized the
Canvas. Wrapping/bounding the inspector fixes the host loop. A separate package
expectation overlooked the existing conservative rule that function props prevent
measurement caching. Structural Group click bubbling now keeps measured Text
props scalar while preserving genuine glyph targeting; no cache guard or
allocation revision was weakened. Failed receipts remain separately recorded.

Typecheck, ordinary core build, exact source/built/editor export parity, JSDoc,
documentation, catalog171/12/33, Studio metadata/search and changed-code lint pass.
`flex.baselines` remains experimental: multiline, nested propagation,
last-baseline placement and broader font lifecycle remain open. Fixed33 stays
9complete/12experimental/6partial/5missing/1excluded; all7release gates remain open.
No aggregate trust or native font-metric claim.

## Slice159 ready for feedback: wrapped Text baseline metrics

The public test first failed at the existing unwrapped-only admission. The runtime
change only allows boolean wrapping inside the same fixed generic-font,
top-baseline, visible-fit/overflow LTR row-nowrap profile. The Text provider already
uses the shared paint line layout and final allocation; no second wrapping
algorithm or sizing policy was added. First/last offsets come from the actual
first/last visible line, while a zero-visible-line allocation is unsupported.
Last-baseline alignment is not delivered by this slice.

Fresh Node24.15/Chromium checks:96passed/2skipped experimental and92passed/6skipped
ordinary across7files (98tests). The public test declares width100 but allocates
basis40→28, proving actual final-width wrapping. It compares first-line baselines
using independent live Canvas ascent measurements and clicks the changed last
line. A supplemental pure service fixture reports first4/last24 for three lines
and rejects a zero-line height; these synthetic values are not browser font data.
Typecheck, changed-code lint and focused read-only review passed.

Public source `http://127.0.0.1:5192/#/examples/layout/wasm-flex-baseline`
(built5193same path): click the Text panel heading to wrap at40px, then **Reflow**
to use28px, three words and14px line height. The heading resets the small font to
10px. Source and built drivers passed two→three visible lines, first-baseline
agreement, last-line movement/click, scalar-input Group bubbling, native identity,
zero added measurement/solve/cross/node work on unrelated paint and exact cleanup
`[0,0,0]` with no browser errors. Built used470dist inputs. Host observations:
first baseline420.3125; two-line last430.3125→three-line last448.3125. No fixed
host font values are used as runtime expectations.

Installed offline strict Bundler/NodeNext and runtime proof passed246dist inputs,
SHA256 `653bb1898560b34614df53ffa83d0bed264742a21df06a62ade00af658751425`.
The installed fixture also declares width100 and changes its actual basis40→28,
checks two→three lines, actual glyph bounds and logical target identity, paint
reuse and exact resource cleanup. Early fixture failures were a duplicate driver
variable, not recording the sibling's `S` glyph, and holding basis40 constant while
changing declared width; all are corrected without changing runtime guards.

The manifest now records the delivered baseline callback/visible multiline Text
rather than listing them as absent. `flex.baselines` remains experimental for
last-baseline alignment, nested propagation, broader directions/fitting and font
lifecycle; `measurement.custom-leaf` remains partial for broader constraint modes,
nested invalidation/feedback and consumer matrices. No fixed33 capability or gate
was promoted. Statuses remain9complete/12experimental/6partial/5missing/1excluded,
all7gates open. No aggregate trust or font-parity claim.

## Consolidation53: slices157–159

Fresh Node24.15/Playwright Chromium verification: experimental744passed/12skipped
across52files (756tests),82.54s; ordinary287passed/469skipped,5.74s. The bounded
lane includes percentage validity, Canvas measurement state, Text line layout,
Flow and baseline behavior. Both runs passed without a production correction.

Typecheck, refreshed ordinary declarations/build, exact source/built/editor export
parity and runtime/Three addons passed. Documentation and109RED mutation probes,
public JSDoc, catalog171lessons/12snapshots/33labs, Studio routes/search and kernel
integrity passed. The69628byte binary is unchanged; the concise5case public
comparison agrees with the721record reference. Slice159 source/built interaction,
wrapped screenshot and installed-package receipts remain separate evidence.
No aggregate trust, capability promotion or release-gate closure is claimed.

## Consolidation54: slices160–162

Fresh Node24.15/Playwright Chromium: experimental759passed/12skipped across54files
(771tests),83.76s; ordinary293passed/478skipped,4.99s. This adds structural
intrinsic public behavior and receiver receipt ownership to the previous bounded
lane. Both runs passed without another production correction.

Typecheck, changed-code lint, refreshed ordinary declarations/build and exact
source/built/editor export parity with runtime/Three addons passed. Docs and109
mutation probes, public JSDoc, catalog171lessons/12snapshots/33labs, Studio and
kernel integrity passed. Concise5case public comparison still agrees with the
721record reference. Source/built nested-row and246-input installed-package
paint-reuse/content-update receipts are recorded under162. The69628byte binary
is unchanged. No aggregate trust, capability promotion or gate closure claimed.
The remaining closure sequence below retains the full original denominator.

## Remaining gate closure order after162

The denominator stays33 capabilities and7release gates. Slices160/161 advance
`measurement.custom-leaf` and `flex.nested-intrinsic-containers`;162 advances
`integration.signal-aware-caching` and the same prepared-measurement foundation.
None closes those entries or a gate. The following order covers the original
scope, including intrinsic/minmax Grid tracks; it is not a finite slice estimate.
Current bounded diagnostics remain interim behavior, not permission to exclude
unfinished branches from the target.

| Order | Existing gate and entries                                                                                                                                     | Objective exit                                                                                                                                                                                                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `flex-core`: `flex.min-max`, `flex.automatic-minimum` (uses the foundational measurement subset; does not depend on completion of the measurement gate)       | Complete finite/indefinite owner and percentage-feedback policy, automatic Text/custom/known-container contributions and bounds, with pinned semantic geometry and public recursive measurement/failure evidence. Next implementation should extend the known prepared measurement tree rather than add another direction-only matrix. |
| 2     | `box-and-direction`: `flex.margin`, `flex.auto-margin`, `flex.percentage-gap`, `box.padding-and-layout-border`, `box.box-sizing`, `box.aspect-ratio`          | Complete sizing/percentage/physical-logical precedence and decoration ordering across the target matrix; classify intentional Yoga differences and prove paint/hit geometry stays coherent.                                                                                                                                            |
| 3     | `measurement-and-intrinsic`: `measurement.custom-leaf`, `flex.baselines`, `flex.nested-intrinsic-containers`, `overflow-sizing`                               | Deliver the full intrinsic vocabulary/constraint contract, recursive known-family providers, baseline composition and exact ownership. Retain real Canvas font-source classification. Unsupported interim profiles cannot count as complete.                                                                                           |
| 4     | `placement-and-participation`: `position.relative-static-absolute`, `position.containing-block`, `participation.hidden-and-contents`                          | Complete containing ancestry and hidden/contents participation, sizing, identity, hit/focus/source-order and measurement semantics through the same prepared tree. Bounded direct-Flex chains alone do not close it.                                                                                                                   |
| 5     | `reactivity-and-publication`: `reactivity.incremental-layout`, `geometry.transactional-publication`, `integration.signal-aware-caching` with complete cleanup | Root-wide role-aware prepared graph and publication across accepted layout families, bounded topology/cache invalidation and failure isolation. Preserve current general render-failure teardown unless an approved contract changes it; do not claim retained-screen rollback.                                                        |
| 6     | `grid-beyond-yoga`: `grid.explicit-placement`, `grid.implicit-tracks-and-auto-placement`, `intrinsic-size-vocabulary`                                         | Complete original spans, intrinsic/fr/minmax track sizing, implicit tracks and auto-placement target, plus nested Flex/Grid ownership and publication. Use the common measurement contract rather than a second measurement system.                                                                                                    |
| 7     | `migration-and-conformance`: `migration.owned-tree-snapshots`, `migration.versioned-yoga-conversion`                                                          | Deliver the planned public layout boundary, owned-tree snapshots and versioned conversion analysis only after semantics settle; classify the complete pinned corpus and prove source/built/packed consumers.                                                                                                                           |

Box and measurement work both depend on Flex foundations. Placement depends on
both; publication depends on measurement, and Grid depends on measurement plus
publication. Independent evidence preparation may run in parallel, while one
writer commits each runnable slice. Migration remains after the semantic exits.
Final completion additionally requires reproducible performance evidence, the
fresh documented Node24/pnpm trust gate, and the final independent whole-codebase
review. A bounded proof or documentation-only status change cannot satisfy it.

## Slice160 ready for feedback: prepared structural paired measurement

Existing `defineLayoutComponent` descriptions returning one paired custom primitive
now participate in finite forward LTR row-nowrap automatic minima and final-width
height measurement. No public API, WASM ABI, cache graph or retained drawing path
was added. Recursive measurement preserves intrinsic/provider-input mode, source
cycle tracking and receiver ownership. The description is shared within the
transaction, while the existing bounded successful-result cache can serve sibling
paint. Conservative mutable/function input rules and allocation revisions remain.

Public RED first rejected the wrapped automatic minimum. A second RED allocated
width40 but retained height20 instead of the required final-width height40. Both
passed after the bridge and final-width provider lookup changed. Scoped review
found structural reverse/aspect admission beyond this slice; two public RED cases
confirmed it. Only the new structural branch is now literal row/LTR/no-aspect;
direct intrinsic-only and paired provider behavior remains intact.

Fresh Node24.15/Playwright Chromium:65passed/1skipped across4files (66tests),
ordinary56passed/10skipped; four selected legacy direct-provider regressions also
passed. Focused failure evidence confirms no later opaque function evaluation,
failed-render resource cleanup, inert old targets, explicit public remount with
fresh hook identity and detached measurement inputs after removal. A proposed
last-successful-geometry rollback assertion was corrected to the documented
render-failure teardown contract after diagnostics returned all resources to zero.
General transactional rollback remains an open release prerequisite.

Source and built structural lessons passed existing Card behavior plus distinct
badge/follower target transfer, keyed identity, minimum60→70, measurement/solve
reuse on sibling paint and cleanup `[0,0,0]`. Built used470dist inputs. The final
badge screenshot was inspected and overlapping explanatory copy shortened.
Hands-on: `http://127.0.0.1:5192/#/examples/layout/wasm-flex-nested-intrinsic`
(and port5193 for built). Click Measured badge, Raise badge min, then Paint only;
the inspector identifies the clicked badge/follower target.

Isolated offline tarball: strict Bundler/NodeNext,246installed dist inputs,
SHA256 `cb8500e7af12dd6b50531a602f356bf99eaf240b9a0ed609c2624e879bd8cd23`.
The installed wrapper actually invokes both intrinsic and final-width finite
callbacks, moves its sibling target, retains its stamp, reuses sibling paint and
releases all owned diagnostics. Existing104auto-margin fixtures also passed.
Typecheck, changed-code lint, docs/JSDoc, catalog and Studio checks passed; scoped
post-fix review had no material finding. No aggregate trust claim or capability
promotion: fixed33 remain9complete/12experimental/6partial/5missing/1excluded,
all7release gates open.

## Slice161 ready for feedback: native final-width nested row measurement

A pure described Flex row with definite numeric width (or exact finite caller
width) can now derive automatic height from direct paired custom leaves. The
focused public RED failed before production with “requires a definite child
cross size.” Forward LTR nowrap rows validate numeric child bases/minima, zero
grow and fixed nonmeasured cross sizes, then batch the main query through the
existing native solver. Exact copied widths feed unbounded-height provider
queries; their heights determine the row and following sibling. There is no
invented finite cross size, JavaScript main-solver fallback, new ABI or retained
measurement graph.

A private synchronous owner scope survives measurement isolation. Raw temporary
arenas share the mounted root instance and release before callbacks; standalone
queries dispose their temporary instance before callbacks. The retained and raw
paths share the same numeric record writer. The paired-child continuation retains
the current cycle context, receiver provision and measurement role, including
normally resolved scalar signal inputs. No cache guard or allocation revision was
relaxed. Aggregate Card measurement still reruns during sibling paint;162 owns
that separate prepared-graph prerequisite.

Fresh Node24.15/Playwright Chromium:67passed/1skipped across4files (68tests),
ordinary56passed/12skipped. Public tests cover width60→40/height20→40→50,
following geometry and stable keys, released raw arenas at callback entry, one
mounted root instance, resolved signal updates, throwing-provider cleanup before
later painting and standalone no-Canvas cleanup after a failed measurement scope.
Source/built lesson checks use height20→60→70 and footer168→208→218, distinct
moved targets, stable identity, native instance/arena counts and disposal0000;
built470dist inputs. The rendered nested row was inspected.

Hands-on: `http://127.0.0.1:5192/#/examples/layout/wasm-flex-nested-intrinsic`
(or port5193 built). Click Nested row, Toggle width, then Raise badge min.
Isolated offline tarball passed strict Bundler/NodeNext,246installed inputs,
SHA256 `8e4b4f8e1c518eeec5c076904ac43b1e1d188a2f8301495770f33addd4bd0f48`.
Installed nested geometry, old/new targets, stamp retention, signal updates,
removal cleanup and prior104auto-margin fixtures passed. Typecheck, changed-code
lint, docs109mutation probes, public JSDoc, catalog/Studio and scoped final review
passed. Binary remains69628bytes. No aggregate trust or capability promotion:
fixed33 remain9complete/12experimental/6partial/5missing/1excluded; all7gates open.

## Slice162 ready for feedback: parent-owned prepared measurement reuse

The public footer-paint RED repeated aggregate paired measurement. The existing
parent region/layout-token cache now admits conservatively snapshotted described
forward LTR nowrap rows with direct paired leaves and fixed Rectangle siblings.
Descriptions still execute fresh. Entries retain scalar/nominal-signal program
inputs, full resolved styles and direct child identity/order. Existing revision,
function/mutable-input guards, bounded storage and success-only publication stay
intact. Captured measurement reads replay into current child receiver tokens,
never cached transaction tokens or wrapper subscriptions.

A second public RED proved that nested public `input.measureElement` queries
could otherwise escape the direct-child receipt path. Such callbacks now decline
aggregate reuse. Removal keeps the parent/footer mounted, detaches the removed
provider input and restores current content with fresh provider identity. Failure
cleans up before later paint. The public lesson keeps its leaf descriptors stable
so separate direct-provider caches can also reuse results.

Fresh Node24.15/Chromium:63passed/1skipped across4files (64tests), ordinary
55passed/9skipped. Receipt-unit coverage captures already-provisioned reads,
replays into fresh ownership, preserves role masks and detaches exactly.
Source/built nested-row proof checks unchanged provider/native solve counts on
paint, subsequent content-driven geometry/target movement, stable keyed identity,
one root native instance and disposal0000. Installed246-input strict Bundler and
NodeNext consumer includes the same paint-hit→content-update contract; tarball
SHA256 `056c03ff3f0184903c18b2d9986e7e11f70974117d947878ab7952b68a630a4e`.

Hands-on: `http://127.0.0.1:5192/#/examples/layout/wasm-flex-nested-intrinsic`
(or built port5193). Select Nested row, Toggle width, Paint only, then Raise
badge min. This is a bounded prepared-graph prerequisite, not full graph closure.
Fixed33 remain9complete/12experimental/6partial/5missing/1excluded; all7gates open.
Consolidation54 for160–162 follows as a separate evidence commit.

## Slice163 ready for feedback: nested described paired leaf

Public RED: a described row containing a Badge description with one paired leaf
failed “requires a definite child cross size.” The existing row candidate pass
now recognizes the prepared paired root under the same child receiver. Final
native widths query that root using its leaf receiver; the authored wrapper
remains the style handoff source and descriptor cycle metadata survives cloning.
No ordinary component executes during measurement. The162 snapshot still declines
wrapper children because it has no recursive receipt path; this slice makes no
aggregate-cache claim for that shape.

Fresh Node24.15/Chromium:59passed/1skipped across4files (60tests); ordinary
49passed/11skipped. Typecheck, changed-code lint, docs109mutation probes, public
JSDoc, catalog/Studio and scoped review passed. Public geometry
is60×20→40×40→40×50 with following footer20→40→50, keyed stamps and moved targets.
Provider signal writes after removal are inert. Standalone wrapper reentry throws
cyclic measurement dependency and restores all resource counters. Source/built
lesson uses height20→60→70/footer168→208→218; one root instance and teardown0000,
built470inputs. The wrapped render was inspected. Installed246-input consumer
also switches direct→wrapped leaf and verifies a later content signal updates
height while the footer keeps its identity; strict Bundler/NodeNext passed.
Tarball SHA256 `78ac517f568e964d680d758ca75b849e52e23756e49731c6f9cb51f5b679d751`.

Hands-on: `http://127.0.0.1:5192/#/examples/layout/wasm-flex-nested-intrinsic`
(or built5193): Nested row, Wrap row leaf, Toggle width, Raise badge min.
This closes the direct described-leaf composition hole inside the bounded measured
row, advancing `measurement.custom-leaf` and `flex.nested-intrinsic-containers`.
Their general recursive/intrinsic exits stay open. No capability/gate promotion.

## Slice164 ready for feedback: wrapped-leaf aggregate reuse

The source public RED repeated one native aggregate query on footer paint
(measurementSolves4 versus3). The existing parent-owned snapshot now admits one
direct pure wrapper returning one paired primitive. It records wrapper and leaf
program inputs and semantic identities plus the full normalized provider style;
`prepareDirectChildStyle` already resolves the described root style, so it does
not normalize a separate raw root under another basis. The receiver vector uses
the current prepared leaf root. Existing receipts then replay into that current
receiver after a cache hit. No old tokens, parallel graph or mutable/query guard
relaxation is involved.

Public tests split a callback-free sibling (aggregate query reused) from a
function-bearing sibling (conservative miss retained). Both still update content
geometry, preserve identity and detach removed inputs. Unknown nested public
`measureElement` queries decline reuse in both direct and wrapped cases; the
standalone cycle guard and exact cleanup continue to pass.

Fresh Node24.15/Chromium:61passed/1skipped across4files (62tests); ordinary
49passed/13skipped. Source/built wrapped-row interaction passes unchanged native
measurement solve counts on paint followed by content-driven footer movement,
with470built inputs and teardown0000. Installed246-input Bundler/NodeNext proof
now checks wrapped paint hit→content update too; SHA256
`a0d17599df74acf662fce5a9627e2ada9a743a39fbedd95e6e847031a0f8f6e2`.
Typecheck, changed-code lint and public JSDoc pass. No capability/gate promotion.
This closes the one-wrapper receiver-path cache hole for the163 shape only.

Hands-on: `http://127.0.0.1:5192/#/examples/layout/wasm-flex-nested-intrinsic`:
Nested row, Wrap row leaf, Toggle width, Paint only, Raise badge min.

## Slice165 ready for feedback: empty aspect Rectangle zero minimum

The focused public RED rejected an empty Rectangle with numeric main90, ratio3
and automatic cross size because its main minimum was omitted. Experimental
direct allocation now uses zero content minimum for a childless, query-free
Rectangle with numeric finite main/basis and automatic/omitted/numeric cross.
Existing native main solving still precedes outer aspect cross sizing; explicit
min/max and decoration ownership remain unchanged. This is not a transferred
cross-to-main content floor, intrinsic measurement, or a new cache/ABI path.

The pinned3.2.1 source explicitly lacks CSS automatic minimum sizing. The new
independent native probe records16 cases with absent/zero minima, axes,
decoration and cross caps, without changing the721-case corpus. Basis90 beside
fixed20 at main80 yields row60×20 or column180×60; maxWidth150 clamps only the
column cross. Omitted and zero agree. This closes the empty-Rectangle automatic
cross aspect profile, not the whole aspect automatic-minimum category: nonempty
Text/image/custom intrinsic content and broader compatibility remain open.

Public tests first assert semantic geometry, explicit floors and basis-only
admission, then mounted pixels, target movement, stable native nodes and cleanup.
Focused Node24.15/Chromium:9passed/416skipped in425tests. Source/built lesson
checks omitted=zero and floor240 at owner240→300→240 on both axes, actual painted
boundaries, transferred old targets, stable native nodes and disposal0000;
built470inputs. Initial browser blankness was the inspector taking all flex-host
height (canvas1018×18); capping its height restores1018×540. The root-fit pixel
mapping includes letterbox offsets. The rendered lesson was inspected.

Installed246-input Bundler/NodeNext proof covers basis-only omitted minimum,
row floor/target/identity and column derived-cross cap; SHA256
`10e2ee1cc55dffbaff0b2341793dd6cebfa4f3943decc09c46208c09b6291f78`.
Typecheck, changed-code lint and scoped review pass. No capability/gate promotion.

Hands-on: `http://127.0.0.1:5192/#/examples/layout/wasm-flex-aspect-minimum`
(or built5193). Owner toggles240/300; Minimum cycles omitted/0/240. The panel's
sizes are explicitly labeled expected, separate from actual runtime counters;
paint/hit verification and public numeric geometry establish actual behavior.
Consolidation55 for163–165 follows as a separate evidence commit.

## Consolidation55: slices163–165

Fresh Node24.15/Playwright Chromium: experimental764passed/12skipped across55files
(776tests),84.44s; ordinary293passed/483skipped,5.73s. This extends the prior
bounded lane with described paired-leaf recursion/replay, conservative nested
query and function-input misses, cycle/removal ownership and empty aspect minima.
Both runs passed without another production correction.

Refreshed ordinary declarations/build and exact source/built/editor exports with
runtime/Three addons pass. Slice165 typecheck, changed-code lint, docs109mutation
probes, public JSDoc,172lesson/12snapshot/33lab catalog and Studio checks pass.
The independent16-record pinned aspect probe, source/built lesson and246-input
installed-package receipts remain separate evidence. Kernel69628bytes is unchanged;
concise5public cases still agree with the721record reference. No aggregate trust,
capability promotion or release-gate closure is claimed. One NEXT remains below.

## Slice166 delivered: native staged percentage bounds for numeric owners

The sole `flex.min-max` missing row has two clauses: indefinite/cyclic owner
policy and the explicit measured-owner matrix beyond exact row/column availability.
The implementation direction preserves native staged references, never a final-size
fixed point. External owner reference, initial available inner size, later line
availability and final owner size are distinct quantities. Existing max-only
rejection stays until each new profile carries its native result into actual
prepared layout. This is a behavior extension, not a new public selector or
permission to reinterpret a maximum as an exact owner.

The finite acceptance matrix for this missing row is below. Each cap/floor pair
runs on row and column axes; reuse established exact-owner evidence. Opposing
limits retain Pibbl's contradiction rejection. Geometry and callbacks must be
classified separately where the existing natural-query contract differs from Yoga.

| Owner state                                                                                    | Bound inputs / expected policy                                                                   | Evidence and exit                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Declared numeric main; exact finite caller bounds                                              | Cap25%, floor50%, numeric opposing bounds                                                        | Existing exact-row/column public tests and pinned geometry; regression only.                                                                                                                                            |
| Own max160, no external main reference                                                         | Cap25% and floor50%; native initial available envelope differs from final owner                  | Full-precision pinned result plus standalone public query and exact teardown.                                                                                                                                           |
| Own max160 with external availability80,160,200                                                | Cap25% and floor50%; preserve external-reference, later max constraint and final geometry phases | Public measured known owner; query result and final child paint/targets must agree. Initial foothold is row/external200 cap: owner112.5/A32.5/B80, then external160:110/30/80. This alone does not complete the matrix. |
| No own main bound and unbounded availability                                                   | Cap25% and floor50%; missing references follow the specified native phase                        | Native/public query result, no invented final-owner reference.                                                                                                                                                          |
| Own min160 without maximum                                                                     | Cap25% and floor50%; final root floor is not exact child availability                            | Native/public query result and preserved final sizing.                                                                                                                                                                  |
| Own min160 plus max160                                                                         | Cap25% and floor50%; max participates before child sizing even when limits are equal             | Native/public query result; distinguish from merely labeling the final size definite.                                                                                                                                   |
| Numeric declared leaves; pure described known owners; paired measured-owner composition        | Same accepted constraint branches                                                                | Supported public measurement and normal render use the same staged result. Unknown opaque content is not discovered by executing components during measurement.                                                         |
| Invalid/opposing bounds, unresolved percentage owners, descriptor cycles and provider failures | Preserve documented diagnostics and purity, with finite termination                              | Public error before later paint, no partially published bindings, no leaked raw arena/instance/receipts.                                                                                                                |
| Resize, unrelated paint, reorder/removal and disposal                                          | Geometry and ownership hold across input changes                                                 | Stable keys/native nodes, correct old/new targets, fresh signal ownership, bounded successful publication; exact teardown.                                                                                              |

The native query must be a distinct fixed-contract numeric operation over existing
root ownership, with copied results and released temporary arena before callbacks.
Only the existing prepared plan/region may carry validated scalar results into
normal allocation. No second dependency graph, retained draw tree, JavaScript
solver or guessed fixed-point pass is authorized. A failed query publishes no
successful record. Complete the matrix before promoting the capability, rather
than numbering each cap/direction variant as a new capability.

Delivered2026-10-23 in one separately committed vertical slice. The numeric
row/column matrix above is now executable for direct empty Rectangles: max160
with no external reference or80/160/200; unbounded; min160; min160/max160. The
28public query cases transpose cap25% and floor50% exactly. Mounted row/column
resize, paint, hit transfer, stable native nodes, live percentage input, reorder,
removal and exact cleanup are covered. Described Flex owner queries and mounted
paint agree; a paired owner callback may delegate to the same described owner.
Direct measured **leaves** remain unsupported; owner delegation does not close
that callback/query matrix.

The native fixed-contract query returns copied targets/effective bounds from a
released temporary arena. The existing render transaction consumes a matching
root/descriptor-sequence/revision/final-main handoff once. Normal region solve
still owns placement. Root/child decoration, logical insets, responsive/whole-style
callbacks, nonzero factors/gaps and arbitrary measured leaves are conservatively
outside this new profile. Contradictions diagnose; unsupported cyclic owners
terminate before provider discovery; existing recursive provider cycle detection
still passes. No retained graph or JavaScript sizing loop was added.

Fresh evidence (Node24.15.0, Chromium): final five-file experimental regression
469passed/8skipped477tests; corresponding ordinary lane94passed/383skipped.
Subsequent final public composition file33passed, adding a described/paired owner
query and mounted described-owner paint to that prior batch. Typecheck, targeted
lint, catalog173lessons/12snapshots/33labs, Studio manifest,109documentation
mutation probes and public JSDoc pass. Source5192 and built5193 both prove exact
pixel boundaries, target transfer, node reuse and disposal0000; built470inputs.
The offline installed consumer passes Bundler/NodeNext and246dist inputs with
stagedPercentageOwner receipt; tarball SHA256
`1ebec2daa1e028d4d54841c4014cb690a842976e16074e4ff16d111478eeafa9`.

ABI7 native tests18pass. Matching external/embedded kernel73402bytes, SHA256
`c7aa80790db928be6dab5131ee72e152ce07642df28272018da587360d8e9212`.
The independent full-precision `--percentage-phase-probe` runs against pinned
Yoga3.2.1 commit042f5013152eb81c1552dec945b88f7b95ca350f; probe source SHA256
`0ac0dcfdae7ca8f3bf2dcf86185d7f2d752adf9b9ed3118c694f4b7e7a77d6a1`.
Its measured callback correctly transposes natural main80/cross20. The721case
conformance corpus is unchanged. No visual baseline was rewritten, capability
promoted, aggregate trust claim made, or release gate closed.

Runnable: `http://127.0.0.1:5192/#/examples/layout/wasm-flex-percentage-owner`.
Cycle200→160→80 and click at the red/green edge. Numeric phase references and
source paint order are visible; inspector counters are observed diagnostics,
while the prose sizes are explicitly expected values.

## Slice167 delivered: measured-leaf percentage-owner phase matrix

The remaining `flex.min-max` row still requires the direct measured-provider
callback/query clauses and supported described/provider composition across the
accepted owner states. Reuse the numeric phase evidence; do not reinterpret a
max-only envelope as exact or infer provider parity from equal final boxes.
First pin natural-main/cross callbacks and finite/exact/undefined query envelopes
on both axes, then implement the smallest native-authoritative continuation
through the existing paired measurement and prepared-root lifetime. Release
native temporary storage before callbacks and preserve cycle/failure/receipt
cleanup. No new public selector, JavaScript fixed point or persistent graph.
Promote only after the remaining agreed matrix is implemented and verified.

Delivered2026-10-23. The direct childless paired-provider branch now completes
all28row/column cap/floor owner cases above. Main callback maxima are copied from
a native preparation arena and that arena is released before application code.
A fresh native continuation clamps natural results, including returns above the
query maximum, before the existing external/initial/later/final phases. Private
request/ready metadata distinguishes a valid zero maximum from an unprepared
record. Current-transaction measured targets suppress duplicate intrinsic/finite
queries during normal region placement; numeric authored bases retain166behavior.

The first public test was RED before production; final mounted row/column tests
prove one callback per update, exact pixel boundaries, old-target transfer,
provider-only natural80→20 signals, native node reuse and exact disposal. A leaf
cross30 under root cross50 receives exact30, not root50. Thrown/unsupported/NaN/
cyclic callbacks leave no live temporary resources. Known resolved bound conflicts
are rejected before providers, including cross-unit point100/max25% at envelope160;
that native assertion was observed RED before its production fix. Active cross
bounds, query styles, known/Text/child-bearing leaves and nonzero factors remain
outside this bounded provider admission.

Fresh Node24.15.0/Chromium focused six-file run504passed/8skipped512tests81.76s;
ordinary lane96passed/416skipped. Native21tests pass. ABI8 matching assets75199bytes,
SHA256`f13e9bb62e79e26b082abe111ecdbc252fa2575bde85865f4ab6cbab76975419`.
Source5192 and built5193 measured-provider replay pass, built470inputs; installed
offline consumer passes246dist inputs, Bundler/NodeNext and
measuredStagedPercentageOwner receipt, tarball SHA256
`3bf955f11a32021e2fe553bb44856234d7f3a6b23ff4d9b503b00f572fb79a4e`.
Typecheck, changed-code lint,174lesson catalog/Studio,109documentation mutations
and public JSDoc pass. The expanded independent full-precision pinned phase probe
source SHA256`96fbf2070b11f12c3a9c6457ffc6da50865f28d4656620aa571ff2a0e848582d`
separates natural80 cap/floor from natural20 floor controls and records both
main/cross modes.721corpus unchanged, no visual baseline rewritten, no capability
promotion, full trust claim or release gate closure.

Runnable: `http://127.0.0.1:5192/#/examples/layout/wasm-flex-measured-percentage-owner`.
Toggle natural80/20, cycle external200/160/80 and click the red/green edge.
Inspector maxima are actual callback records; shown sizes are labeled expected.

## Slice168 delivered: described measured-owner composition and native owner phases

The remaining min/max row needs the described known-owner and paired-provider
composition branches exercised through these phases with actual final paint,
not just a standalone query or160–164foundation evidence. First discriminate a
described Flex containing the measured leaf at max160/unbounded external
availability (root110/A30/B80), and an explicit paired owner delegating to that
known description while rendering its result. Establish current receiver/identity
handoff and reject arbitrary opaque discovery; no new wrapper API or persistent
query graph is authorized. Reuse the same finite owner matrix where it adds
material evidence, not a new numbered cap/direction variant.

Audit the remaining indefinite/cyclic-owner clause against the actual native
phase policy and supported public profile. State finite rejection/validation for
unresolved or recursive sources explicitly, with native and public evidence;
do not claim unsupported behavior as parity or invent a JavaScript fixed point.
Only promote min/max after its complete accepted missing row is evidenced.

The automatic-minimum ledger still has five categories (general Text/font rules,
images, remaining intrinsic aspect interactions, overflow/fitting, pinned-native
compatibility). Structural/cache work above is a foundation for particular
measurement cases; finishing the entire measurement gate is not a prerequisite
for Flex. No further wrapper/cache variants are prerequisites for the min/max row.

### Finite positioning exit matrix after134

This refines existing manifest entries; it adds no capability or release gate.

| Existing exit                             | Evidence still required before closing it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direct static/relative/absolute placement | All accepted main directions and wrapping contexts, inset precedence and no-inset alignment, logical/percentage policy, supported child box and size constraints; pinned semantic geometry plus public paint/hit/focus evidence. Static/relative leaves and fixed/opposing-inset absolute sizing/bounds cover nowrap directions; direct primitive static/relative and absolute fixed/derived/provider paths cover nowrap directions; fixed direct internally-nowrap Flex owners cover wrapped parents; absolute numeric/percentage sizes, physical/logical absolute insets and admitted automatic profiles compose across main/wrapping directions. General layout owners, child decoration, intrinsic dimensions and containing ancestry retain their open boundaries. |
| Absolute intrinsic dimensions             | Broader Text/font and image contributions beyond137–139 bounded generic Text profiles, both-auto sizing, nested described owners and supported constraint feedback. The paired-provider one-auto paths in128–129 do not supply these contracts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| General containing-block ownership        | Exact override, transformed/opaque/boxless ancestry policy and lifecycle evidence, retaining legacy omission only where specified. Direct static Flex chains alone do not close it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Hidden/contents participation             | Declared retention/disposal, boxless layout contribution, identity, source order, clips, events and visibility transitions; current implementation is missing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Transactional publication                 | Position, hit, focus, HTML and external-layer geometry must publish or roll back coherently through the accepted root-wide preparation/ownership model. Per-region measurement rollback is bounded evidence only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

Delivered material slice130: fixed finite numeric absolute boxes in all four
nowrap Flex main directions, LTR/RTL. No new public API. Explicit physical insets
retain padding-box reference/precedence; inset-free axes use main/cross alignment
with reverse and RTL applied once. Automatic/aspect/measured size and numeric
bounds in expanded directions remain outside that first admission. Broader exits
above stay open; their completion is not inferred from increasing fixture counts.

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

Delivered2026-10-23. The size-only opaque branch is preserved semantics, not a
native geometry claim: direct known Card A30/root110 versus opaque Owner's
normally allocated returned Card A27.5/root110. Two delegated size queries110
and100 prove discarded-query isolation. A matching structural description
retains the existing receiver-owned handoff; no new public association API.

The pinned probe found a real nested same-axis defect: at finite mainN,
outerN/inner2N/leaf4N with constrained provider maximaN then2N; undefined keeps
40/40/40 with one unbounded query. Public row measurement was unsupported and
column placement reused the earlier stage, yielding leaf2N and skipping the
second callback. The fix uses finite fit-content availability when there is no
own maximum, admits the bounded same-axis known Flex contribution, and performs
one native exact allocated-owner continuation through the current pure receiver
context before normal placement. The temporary transaction stage retains the
original normalized root style; receiver/source children/axis/content/revision
must match. The original cross-axis166/167 handoff and public exact fast path
remain intact. This is finite tree descent, not an iterative fixed point.

Fresh focused Node24.15/Chromium:72tests passed across the new composition file
and166/167 matrices. The seven composition tests also pass provider-only signal
updates, unchanged native node counts, both allocated-phase failure/remount
paths and exact teardown. Source/built lesson verifies query pairs40/80,
red overflow extent160, target outside the40px owner, existing cap interactions
and disposal0000. Built uses470inputs. Installed package passes246dist inputs,
Bundler/NodeNext and the same two-phase/update/overflow/target/cleanup receipt;
tarball SHA256 `bf544913dc76e5130f441a3172e62002b2481958d8a807ac64e887e5e0c1a708`.
The separate pinned percentage-phase probe source SHA256 is
`9718359e5874f915a7cdd78cceb7d467aa884ac852d7cb99175dffbb06636c77`.
Kernel ABI8/75199bytes is unchanged; the721corpus is unchanged. No min/max
promotion, fixed33 reclassification, release-gate closure or full trust claim.

## Consolidation56: slices166–168

Fresh Node24.15/Playwright Chromium: experimental841passed/12skipped across58files
(853tests),82.90s; ordinary298passed/555skipped,5.86s. The first experimental run
had839passes and two stale negative diagnostic expectations. Both cases still
reject percentage-gap feedback; known-owner descent now reaches the precise
percentage-gap diagnostic instead of stopping at the former missing child-basis
path. Only those expectations changed. The subsequent complete run passed.

This lane combines the staged numeric and paired percentage-owner matrices,
receiver-scoped Card/opaque distinction, same-axis native allocated-owner phases,
provider-only signal updates, failure cleanup/remount and earlier lifecycle,
positioning, measurement-purity and ownership evidence. Source/built/installed
receipts, pinned independent probe, typecheck, changed-code lint, catalog174,
Studio and docs109mutation/public-JSDoc checks pass. Visual inspection of the
updated measured-owner lesson confirms the160px lower strip and readable labels.
No unchanged broad release checks were repeated. Kernel ABI8/75199bytes and
721corpus remain unchanged; no aggregate trust or release-gate closure claim.
The fixed33 counts remain9complete/12experimental/6partial/5missing/1excluded.

## Slice169 delivered: known-owner matrix and finite structural phase audit

Reconcile each clause of166's accepted matrix with actual query, normal layout,
ownership and failure evidence. The bounded nested same-axis result closes its
specific known-owner counterexample, not arbitrary recursive intrinsic sizing.
Retain the opaque size-only distinction; identify unresolved percentage dimension
or basis references and recursive descriptor cases explicitly. Do not promote
`flex.min-max` while the indefinite-owner/measured-owner missing row still has
an unevidenced accepted branch. Consolidation56 for166–168 is recorded below as a separate evidence commit.

Delivered2026-10-23 as evidence hardening; no production change. The accepted
numeric/paired known-owner matrix now has56public queries (row/column × seven
owner states × cap/floor × numeric/paired), plus24finite normal-layout cases at
external80/160/200. Paired allocation is asserted before pixels; adjacent solid
pixels avoid fractional antialias edges, targets cross the same semantic boundary,
and every mounted case explicitly disposes to the resource baseline. A fixture
initially subtracted the fixed80 sibling from root160 for the external200 floor;
that inference was wrong. Native retains the earlier100 floor, so A100+B80
overflows a root capped at160. The corrected fixture preserves that behavior.

| Original166 exit                                           | Evidence/result                                                                                                                                                                                                            |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact caller main                                          | Existing exact row/column public paths retained.                                                                                                                                                                           |
| Own numeric max/min/min+max; finite or undefined reference | 166/167 direct matrix and169known-Card query matrix.                                                                                                                                                                       |
| Known descriptions and paired composition                  | 169finite normal-layout matrix;168opaque content-size semantics remain separate.                                                                                                                                           |
| Recursive known owners                                     | Both axes: finite100 single chain100/200/400/800 and two branches100/400/800/1600, with native callback envelopes. Undefined pure queries return root40/80 and one unbounded callback per leaf; no descendant paint claim. |
| Invalid/opposing bounds, cycles and providers              | 157/166/167validation plus168allocated-phase failure/remount and shared descriptor-cycle detection.                                                                                                                        |
| Input/lifecycle                                            | 166reorder/removal/live bound;167provider-only signal and targets;168known-chain signal, stable nodes, failure/remount and disposal.                                                                                       |

Fresh Node24.15/Chromium:91composition tests pass; the combined166–169 owner
lane passes156tests across3files,2.38s. Types/lint pass. The tracked pinned
percentage-phase probe preserves168's original cases and adds deeper/branching
known trees; source SHA256
`02ee98865c880b770980f216f2f4f6265e27e47d4aa644ce0ba4be39c73c1605`.
No new source/built/installed implementation was introduced;168's corresponding
receipts remain applicable. ABI8/75199bytes and721corpus are unchanged.

The original target is full numeric/percentage min/max with supported intrinsic
rules, not just numeric bounds on the receiving owner. A concrete remaining
cell uses own max-main75% on the auto owner, external200, natural80 leaf capped
at25%, and a fixed80 sibling. Pinned Yoga gives root109.375/A29.375/B80 and a
leaf query maximum37.5; undefined external gives120/40/80 and an unbounded query.
The current public path rejects this because the staged receiver's own bounds
must be numeric. This is a real remaining unit/reference branch, not a new
exclusion or a generic recursive-policy placeholder. `flex.min-max` remains
partial; its missing row now names this counterexample. Other intrinsic size,
percentage dimension/basis and tree capabilities keep their original targets.

## Slice170 delivered: percentage own-owner bounds against original references

Establish the public row/column percentage-own-maximum counterexample before
production code. Resolve the receiving owner's percentage min/max against its
actual external reference, preserving undefined references and the distinct
initial/later/final native phases. Reuse the current numeric native operation,
prepared receiver handoff and release-before-callback ownership. No implicit
size-query association, fixed point, new public selector or parallel solver.

Delivered2026-10-23 after four public row/column finite/unbounded cases failed
with unsupported measurement. Own percentage min/max now resolve to scalar bounds
against the original caller reference before native preparation. Valid undefined
references remain unresolved. The transaction stage retains the resolved scalars
for exact allocated continuation; authored styles still forward unchanged. Native
operations, ABI8/75199byte kernel and721reference corpus are unchanged.

The matched opposite-axis finite parent is important: standalone Yoga root
StretchFit would produce a different min-only owner. Under public at-most child
availability200, own min75% gives owner150/leaf37.5 and leaf maximum50; own
max75% or mixed min50/max75 gives109.375/29.375 and maximum37.5. Undefined
availability gives120/40/80 and an unbounded callback. Thirteen public tests cover
both axes/all three bound profiles, final allocation, exact cleanup and invalid
syntax/sign/overflow/resolved conflicts before provider evaluation.

Fresh Node24.15/Chromium focused7files:590passed/8skipped (598tests),82.41s;
ordinary78passed/520skipped,2.91s. Typecheck, changed-code lint and catalog174 pass;
scoped review found no material issue. Source/built lesson and installed-package
receipts pass the live160px→75% limit transition, moved boundary, unchanged native
nodes and disposal0000. Built uses470inputs; packed246dist inputs with strict
Bundler/NodeNext consumers, tarball SHA256
`25909a1718a523076cbf7b981e68d75b87e398953d12cb7e9db2c70c90fde9b8`.
The tracked pinned probe preserves earlier cases and uses matching parent modes;
source SHA256 `b8839b7b548e9d02b78e151d189586dccb19f248fc1a7383b5aff90f2866263a`.
Visual inspection confirms readable labels and the75% control. No aggregate
trust or release-gate closure is claimed; fixed33counts remain unchanged.

A separate native-matched same-axis case remains open: outer200, owner auto with
min100/max160, natural80 leaf capped25% and fixed80 sibling. Pure full query110
is correct, but the parent must use contribution120, then query at30 and paint
leaf30. With own max75%, pure full query109.375 differs from contribution117.5;
the second query/leaf is29.375. Current placement incorrectly uses final full-query
size as its parent-main basis. Four public row/column171tests reproduce this
before production. This is the remaining accepted bound-specific composition
cell; broader independent intrinsic/basis/gap work stays in its own capabilities.

## Slice171 delivered: native main contribution versus final content

Expose the native initial bound-adjusted line alongside final intrinsic main as
one fixed return contract. A receiver-scoped known-root main-contribution query
uses that value only where the parent needs a main basis; public pure full queries,
cross-axis sizing and opaque size-only queries retain final content size. The
existing exact allocated continuation then remeasures descendants at the correct
allocation. Preserve the query role in any cache identity and retain all resource,
cycle and source-order rules. No second solver, public selector, persistent graph
or implicit opaque query-to-render association. Consolidation57 covers169–171.

Delivered with a public failing four-case regression before production. Native ABI9
returns final main and contribution main together; both invalidate on failure and
are copied before arena release. Known same-axis parent measurement scopes the
contribution role to its receiver and axis; allocated preflight replaces that stage
before placement. Public full, cross-axis and opaque size-only queries retain their
contract. Contribution queries bypass only the relevant full-query cache.

Point max160 gives full110/contribution120 and leaf30; own max75% gives
full109.375/contribution117.5 and leaf29.375. Eight raw/described row/column cases
and a live role/provider transition verify geometry, query limits, stable nodes and
cleanup. The following blue target demonstrates the actual owner extent. Source
and built470-input checks pass; installed strict Bundler/NodeNext/no-alias consumer
passes with246inputs. Packed tarball SHA256
`a73c45d4c6a702986104a6b00f337b789bcdcca42d4217e228be53060aed674b`.
Kernel75558bytes SHA256
`70da201119e49227e202bb20527a533e9ac98867c261bbe5aa6d776698878701`;
22native tests pass. Pinned probe SHA256
`76f85d2c4005713d5b8e6b09f234aac35e2dbbec902f8e1342b10ed7d41b5cae`.
Visual inspection confirms readable contribution and full-query labels, the gap,
and the following blue target. Focused role/cache/loader31tests, typecheck, changed
lint and catalog174/12/33 pass. Consolidation57 records the broader fresh runs.

The original166 acceptance matrix is closed without changing its target:

| Frozen exit                                                                 | Delivered evidence                                                                            |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Exact declared/caller main bounds                                           | Existing exact-row and exact-column suites                                                    |
| Max160 with absent/80/160/200 external owner; unbounded; min160; min/max160 | 166 numeric and167 paired matrix;169 described-owner matrix                                   |
| Cap/floor, row/column, numeric/paired/known composition                     | 166–169 public queries, finite mounts, deeper and branching trees                             |
| Own numeric and percentage bounds and native parent contribution            | 170 original-reference resolution;171 dual native result and exact continuation               |
| Invalid/opposing/unresolved inputs, cycles, provider failures               | Existing validation and168/170 failure-before-publication evidence                            |
| Resize, paint, reorder/removal, disposal and resource ownership             | 166–169 interaction suites and171 live role/provider transition; source/built/packed receipts |

`flex.min-max` is complete for this supported contract and its missing list is
empty. General percentage-dependent intrinsic graphs remain explicitly unsupported
under their own open capabilities; the pure auto-parent percentage-bound rejection
is not recorded as Yoga parity. No aggregate trust or group-gate closure is claimed.

## Consolidation57 completed for separately committed slices169–171

Commits `f0d087a1`, `7ea267ea` and `e4fc8815` remain separate deliveries.
Fresh Node24.15.0/pnpm11.21.0/Playwright Chromium runs cover60files/960tests:
experimental948passed/12skipped in83.94s; ordinary299passed/661skipped in5.92s.
Both passed without another production correction. These are bounded consolidation
runs, not the aggregate trust command. Native22tests, source/built/installed-package
receipts, strict Bundler/NodeNext consumers, typecheck and changed-code lint pass.
Documentation109mutation probes, public JSDoc, catalog174/12/33 and Studio
metadata/routes/search pass. Scoped independent ledger review found no material
weakening of the frozen min/max exits. Corpus721 and its classifications remain
unchanged. Fixed33 is10complete/12experimental/5partial/5missing/1excluded;
all seven group/release gates remain open. Exactly one next slice follows.

## Slice172 delivered: intrinsic main auto margins

Treat main-axis auto margins as zero during supported pure Flex intrinsic
contribution. Existing native final placement distributes positive free space.
Start with LTR forward nowrap rows/columns, numeric children40+80, own min200
or max160/unbounded, and start-auto/both-auto edges. Preserve unsupported cross-axis
and percentage-margin diagnostics. Add public failing evidence before production,
then expose the behavior through the supported public surface.

Four public regressions failed at numeric-margin admission before production.
The implementation maps effective auto edges to zero during the supported
intrinsic sum and leaves normal native placement in charge of final free space.
Six public tests pass: both axes and start/both slots, max160 under finite200 or
unbounded availability, retained cross-auto rejection, and live min200 to120 with
point transfer A to B, stable native nodes and exact disposal. Pure content is120;
normal own-min200 geometry is200. This distinction is explicit, not a root-size
parity claim. The native probe emits24 matching contribution/final-geometry records
from pinned3.2.1; SHA256
`13fc8202529e1e8474020633cd58630e35938cde04ff61360a6ff07505b97e32`.
Run `node tooling/layout-yoga-rehearsal.mjs --source <pinned-checkout> --intrinsic-auto-margin-probe`.

The existing public lesson is
`http://127.0.0.1:5192/#/examples/layout/wasm-flex-text`: click Compare auto margins
and inspect the lower-left strip. Built companion uses5193. Visual inspection
confirmed a readable label, empty leading margin and A/B strip. The prior automatic
Text comparison remains intact. Installed strict Bundler/NodeNext/no-alias checks
pass with246dist inputs; tarball SHA256
`2848e59a1e4e99aa7f1c88979e73dd2f250e1c5e1e42cf752e116f48eca5e67d`.
Paint retains native solve/node reuse while each conservative intrinsic owner
repeats one content query; the test records that exact behavior rather than
claiming zero measurement. No ABI/kernel change. Focused four-file run143passed/
1skipped; final six new tests and typecheck pass. Final ordinary focused40passed/6skipped. Source/built470-input checks pass with
no browser errors and zero cleanup counters. Final types, changed lint,
docs109mutation probes, public JSDoc and Studio metadata/routes/search pass. All seven gates remain open;
fixed33counts remain10complete/12experimental/5partial/5missing/1excluded.

Auto-margin remains partial. The two original missing clauses remain visible:
other automatic/custom/layout cross sizing and broader wrapping/column Text;
and intrinsic auto owners beyond this direct numeric physical-main foothold.
The latter still needs cross-axis absorption, effective logical/shorthand edges
and composition over supported provider/known-container measurements. Independent
unsupported font/percentage/recursive graphs do not become margin parity evidence
or circular prerequisites. Consolidation58 will cover172–174 after delivery.

## Slice173 delivered: intrinsic cross-axis auto margins

Extend the same zero intrinsic contribution rule to physical cross auto edges
on the supported fixed numeric direct Rectangle profile. Pin row/column final
cross-owner absorption and overflow with native geometry, preserve actual
alignment precedence and source order, and add a public failing regression before
production. Keep the full auto-margin target and remaining composition cells.

Two public tests failed at the explicit cross-auto intrinsic rejection before
production. The existing physical direct numeric profile now normalizes either
axis's auto edges to zero. Final native cross placement remains authoritative.
Fourteen public auto-owner tests pass, including original172 evidence, row/column
leading cross auto with live200to160 target movement, both auto, overflow and
numeric opposite10. Pinned offsets are160/80/0/150 respectively. Four focused files
pass153tests/1skip on Node24.15.0/pnpm11.21.0/Chromium; ordinary40pass/14skip.
Typecheck and changed-code lint pass; scoped runtime review found no material issue.

Source and built470-input lesson checks pass with no browser errors and zero
cleanup counters; visual inspection confirms readable labels and the sunk red A.
Click Compare auto margins at
`http://127.0.0.1:5192/#/examples/layout/wasm-flex-text`, then click red A in the
lower-middle strip. Installed strict Bundler/NodeNext/no-alias checks pass with246
inputs, exact cross targets and cleanup, and three conservative owner content
measurements per paint while native solves/nodes are reused. Tarball SHA256
`69badc6610ea4c56c1dc22203946d1fc3e1d2ecb414d8185131c74a9889bd01d`.
The pinned probe preserves172's24records and appends8cross records; source SHA256
`dba02290d8dc097156e451e059743e5fa0bb0e64765d864f6b4a1d1e48994a07`.
Kernel/ABI unchanged. Auto-margin remains partial: effective logical/shorthand
edges and supported provider/known-container intrinsic composition are still open,
as is the original other automatic/custom/layout cross-sizing clause. Unsupported
independent measurement contexts do not count as parity. Fixed33counts and all
seven open gates are unchanged. Consolidation58 remains172–174.

## Slice174 delivered: intrinsic auto margins across supported composition

Apply the zero intrinsic-contribution rule consistently to effective shorthand,
physical and logical auto edges across already-supported Flex measurement paths.
Use existing provider/known-container measurement contracts and validation; do
not add another solver or broaden unrelated font, graph, direction or wrap sizing.
Freeze representative public/native composition exits, preserve numeric override
precedence, normal allocation, input receipts, cache conservatism and teardown.
Start with public failing evidence for the remaining margin-specific restrictions.

The focused shorthand query failed numeric validation before production. Effective
auto edges now normalize uniformly to zero; shorthand validates as zero in the
experimental lane and ordinary measurement retains rejection. The artificial
Rectangle/physical-only auto gate is removed. Every measurement path keeps its
existing independent sizing, provider, query, cycle and resource guards.
Sixteen auto-owner tests pass: zero/auto equivalence covers direct shorthand with
physical override, logical edges, paired provider cross queries, known Flex
children and wrapped numeric sizing. The live provider returns pure200x20to200x40;
normal200x80 A stays x80 and moves y60to40, admitting a formerly empty target with
one stable hook identity and no new native nodes. Disposal detaches signals.

The original intrinsic-auto missing clause is reconciled explicitly:

| Existing supported path                                               | Evidence / remaining outcome                                                                                                    |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Direct numeric physical main/cross margins                            | 172/173 row/column geometry, signals and ownership                                                                              |
| Effective shorthand, physical override and logical edges              | 174 public equivalence, native12record precedence matrix and Studio toggle                                                      |
| Paired provider with fixed-width/automatic-height query               | 174 live public and installed pure-query, final-placement, target and cleanup proof                                             |
| Known Flex child and layout description                               | 174 logical zero/auto140x20 content equivalence through the existing prepared context                                           |
| Wrapped direct numeric intrinsic profile                              | 174 shorthand zero contribution in existing160x20 profile                                                                       |
| Staged nonexact percentage-bound owner with authored zero/auto margin | Still excluded by the staged helper before normalization; generic exact-reference diagnostic remains. This is open, not parity. |

The other original clause (automatic/custom/layout cross sizing and broader
wrapping/column Text) is still open. The next concrete candidate is the normal
column paired-provider automatic-width admission; public provider queries and
margin-specific placement guards must be assessed separately. No font/unknown
graph exclusion is used to close a margin-specific defect. Fixed33counts remain
10complete/12experimental/5partial/5missing/1excluded, all seven gates open.

Source/built470-input checks pass with no browser errors and zero cleanup. The
existing lesson's Compare auto margins mode now includes Toggle shorthand +
logical; A's leading margin changes80to40 while B stays fixed. Visual inspection
confirms readable controls and geometry. Strict installed Bundler/NodeNext/no-alias
consumer passes246inputs including provider signal/hit/ownership checks; tarball
SHA256 `95b5d6d1ccd957cc77b6f60bf2bdd9e791dc859dcddad16dc0b57682c544e456`.
Pinned probe preserves172/173 cases and adds12shorthand/logical records; source
SHA256 `5599329b0ca534e8c367dde4554cc4a346ff8f17e3f24f2bb44202eb177e66ef`.
No kernel/ABI change. Final typecheck, changed-code lint, docs109mutation probes,
public JSDoc, catalog174/12/33 and Studio metadata/routes/search pass. Focused
independent review found no material issue. Consolidation58 records the fresh
broader final verification.

## Consolidation58 completed for separately committed slices172–174

Deliveries remain separate:172 `20bb1bc8`,173 `de0a5fe7`,174 `fabe4508`.
Fresh Node24.15.0/pnpm11.21.0/Playwright Chromium runs cover61files/976tests:
experimental964passed/12skipped in83.37s; ordinary299passed/677skipped in7.32s.
Both pass without another production correction. The subsequent test-only unused
parameter rename has no behavioral effect; final typecheck and lint pass.
Source and built470-input Studio runs, installed246-input Bundler/NodeNext/no-alias
consumers, pinned24+8+12auto-margin records, docs109mutation probes, public JSDoc,
catalog174/12/33 and Studio metadata/routes/search pass. Focused review found no
material issue. Native kernel/ABI9 and corpus721 remain unchanged. No aggregate
trust or release-gate closure is claimed. Fixed33 remains10complete/12experimental/
5partial/5missing/1excluded, all seven gates open. Exactly one next slice follows.

## Slice175 delivered: paired column automatic cross sizing with auto margins

Check a direct paired provider with numeric height40, automatic width and left
auto margin in a finite200x120 column beside a20x80 leaf. Establish its standalone
public measurement result independently of auto placement. If the provider query
is supported, remove the margin-specific admission obstacle with exact native
geometry, a failing public regression, live target movement and resource evidence.
Keep staged percentage-owner margins and other original cells explicitly open.

The public standalone primitive query already returned natural40to80 at exact
height40; normal column placement failed its auto-margin admission before
production. A distinct paired column cross-query profile now uses width0toInfinity
and exact normalized height through the existing constrained provider path, then
native placement. Effective logical/shorthand edges retain ordinary precedence.
A second focused RED caught unsupported required measurement silently falling back
under stretch alignment. That case now diagnoses before paint, releases ownership
and permits an explicit successful remount.

Eighteen auto-owner tests pass, including exact callbacks, A x160to120 while B
stays x0/y40, hit130 miss-to-A, stable hook/native identity, cleanup and detached
provider writes. Natural240 paints and targets through240 at x0 without new native
nodes. Four focused files and107targeted column/auto regressions pass; ordinary
40pass/18skip. Final types and changed lint pass.

Pinned native40/80/240 geometry matches. Yoga's callback is at-most200/exact40;
Pibbl deliberately requests natural width with unbounded width/exact40. This is an
explicit callback-envelope difference, not callback parity. The probe preserves
44earlier records and appends3; SHA256
`ec6314accd21aedae07cda0a0a24ed427ae38ff3a4ff63271b6adaa60573523c`.
Kernel/ABI unchanged. Installed strict Bundler/NodeNext/no-alias checks pass246
inputs with pure query, moved targets, removal/detached source and cleanup;
tarball SHA256 `7a80b2fa22be63813127ece019f57c1230dd2921d1cf3be486a253eeeb653a31`.

Source/built470-input checks pass without browser errors and with zero cleanup.
At `http://127.0.0.1:5192/#/examples/layout/wasm-flex-text`, click Compare auto
margins, then cycle Column provider through Text,40px,80px. A expands left while
its sibling stays fixed. Final visual inspection found and repaired a label overlap.
Auto-margin remains partial: known layout natural column widths, broader wrapped
column/row Text and staged nonexact percentage owners with authored margins remain
open. Fixed33counts and all seven open gates are unchanged. Consolidation59 will
cover175–177. Docs109mutation probes, public JSDoc, catalog174/12/33 and
Studio metadata/routes/search pass; focused final review found no material issue.

## Slice176 delivered: known-layout natural column cross sizing with auto margins

Compare public exact-height/natural-width measurement for a direct/described known
Flex row with normal column side-auto placement. Start with numeric height40 and
numeric descendants; preserve prepared receivers, inputs and exact resources.
The existing closure table also retains wrapped column Text and row-wrap Text
natural-width cells: the former needs a Canvas wrapping policy; the latter lacks
a main-basis/line-formation measurement contract even without auto margins. Do not
count independent unsupported measurement as parity. Staged owner margins stay open.

Two direct/described public cases failed the auto-cross admission before production.
The new path dispatches to existing known-layout measurement with exact numeric
height and unbounded natural width; it does not implement one sizing algorithm per
family. Authoritative prepared root styles, receiver ownership and required-query
failure semantics remain intact. Neutral cross minWidth0 is admitted.

Twenty-three auto-owner tests pass: direct/described Flex pure60x40, numeric0 to
auto placement x0to140, descendant width40to80 producing known100/x100 and hit130
miss-to-A, stable nodes and exact cleanup; overflow240 remains paintable/targetable
outside200. Fixed-track Grid60x40 succeeds through the same path. Fractional Grid
returns its real allocation-dependent error and fails before paint/cleans up under
stretch; it is not a made-up family exclusion. Four focused files162pass/1skip;
ordinary40pass/23skip. Final types and changed lint pass.

Source/built470-input checks and installed strict Bundler/NodeNext/no-alias246-input
consumers pass. Tarball SHA256
`4e24414d374aa86878977c3dd9ca19b98b308b84711bc03a686dc3f509419ee9`.
At `http://127.0.0.1:5192/#/examples/layout/wasm-flex-text`, click Compare auto
margins and cycle Column content through the provider and row60/100 modes.
Visual inspection confirms readable controls and the moved row. The native probe
preserves47earlier records and adds3known-row records, including overflow240;
SHA256 `f43d1ba5025573f347289e665479efa7de196ebfafd909d39cbafd3c5499863a`.
This proves Flex geometry; Grid evidence is a Pibbl composition contract. Kernel/ABI
unchanged. Auto-margin stays partial; wrapped column/row Text, other independently
unsupported measurement contexts and staged-owner authored margins stay explicit.

Final catalog174/12/33, Studio metadata/routes/search,109documentation mutation
probes and public JSDoc checks pass. Scoped review found no material issue in176.
Recorded2026-10-24;176 is committed separately from the177failing regression.

### Min/max reopened: a bounds-specific numeric contribution counterexample

While preparing177's staged-margin probe, pinned Yoga exposed a mismatch without
any authored margin. Outer main200, known auto owner min100/max160, numeric A80
with basis80/max25%, B80, and following C20 must yield owner/C160 and A40. The
current ABI9 numeric contribution is130. Four public row/column direct/described
bounded cases freshly fail at A39 (green instead of native red). Four otherwise
matched no-active-bound controls pass with pure160 and normal A80/B80/C160; this
is a bounds-specific integration defect, not an unsupported numeric-basis or
provider query. The bounded pure query112.5 remains a separate valid result.
The earlier171closure did not cover this phase distinction and is superseded.
`flex.min-max` is partial again, with this exact missing row; fixed33 is now
9complete/12experimental/6partial/5missing/1excluded. All seven gates stay open.
The177regression file is prepared separately from this independent176delivery.

## Slice177 delivered: native normal-owner phases and staged zero/auto margins

Delivered2026-10-24. Four permanent bounded direct/described row/column cases
first failed semantic click targets; four matched no-bound controls passed.
Eight additional numeric/paired zero-to-auto cases failed pure measurement before
production changes. A native compile-RED established the missing normal role.

ABI10 preserves standalone and recursive pure results while adding a private
finite direct-numeric normal-owner operation and native staged auto placement.
The normal result carries owner allocation, final targets and phase residual;
receiver/source/axis/revision staging retains them without an exact remeasurement
that would erase the original phase. Finite-envelope guards retain previous
undefined/unbounded continuation behavior. Paired providers retain their exact
native continuation. No public API, retained graph, JS solver or extra scheduler.

Native26tests cover the cap/floor × external80/160/200 × ownmax/min/minmax matrix,
shared placement, failure clearing and stale handles. The pinned independent
percentage probe preserves previous records and appends both authored-margin and
normal-owner matrix receipts;216records, source SHA256
`0ca6a827630939e9eac95253faea19f0bf810afb3b3317856d78636c84bae472`.
Kernel78814bytes, SHA256
`cac5fbeff2df01dd6d70d747c72eb54769f813b018883930edfdcfc95a604bc1`.

Public numeric owner160/A40/B80 keeps C at160; auto A moves0to30 rather than the
incorrect geometric remainder40. Paired owner120/A30/B80 keeps C120 and moves A
0to10. Pure queries remain112.5 and110. All16new public tests pass, including
signal transitions, paint/targets, stable native nodes, exact teardown and detached
signals. Nine focused prior/current files pass242tests. The complete final
owner/min-max suite is included in the62-file consolidation59 run.

Final source and built470-input checks pass with no browser errors and cleanup0000.
Installed strict Bundler/NodeNext/no-alias246-input consumers pass with the new
numeric/paired proof. Tarball SHA256
`c4a0007b221d0315b13580cd2151f6c9e9d0141d32d4e88b8ef7c495a59cb482`.
At `http://127.0.0.1:5192/#/examples/layout/wasm-flex-measured-percentage-owner`,
click Margins, then toggle Margin and click red/green/purple. Visual inspection
confirms readable controls and both stable continuations. Final types/lint and
scoped changed-code review pass after the finite-envelope guard. Catalog174/12/33,
Studio metadata/routes/search, public JSDoc and109documentation mutation probes
also pass.

The numeric min/max counterexample is closed and the prior closure matrix remains
green. Fixed33 returns to10complete/12experimental/5partial/5missing/1excluded.
Auto margins remain partial: broader wrapped Text/independent sizing profiles and
staged nonzero numeric margin contributions remain explicit. All7gates stay open.
Consolidation59 follows as a separate evidence commit before further production.

## Consolidation59: slices175–177 reverified

Recorded2026-10-24 after the final finite-envelope guard in177. Separate slice
commits are175 `6adf0e2b`,176 `3d4fcfee`,177 `2173ccfb`.

Fresh macOS/Playwright Chromium, Node24.15.0, installed pnpm11.21.0 dependency
entry points: the62-file owner/layout/measurement/loader matrix passed990tests,
12skipped of1002, in82.55s with `vitest run --mode layout-wasm`. The ordinary
lane passed302, skipped700 of1002, in7.52s. This includes the complete previous
owner/min-max closure matrix, undefined/unbounded queries, the new permanent
numeric regressions and matched no-bound controls. It is a scoped consolidation,
not the aggregate `corepack pnpm@11.21.0 trust` gate.

The final Rust1.99 rebuild passes26native tests, validates ABI10 and publishes
matching external/embedded78814-byte artifacts. Final source and built browser
checks (Node26.9.0/Chromium) pass the original measured-owner example and new
staged auto-margin mode, with470built inputs and cleanup0000. The final isolated
packed installation passes strict Bundler/NodeNext/no-alias246-input checks,
104existing auto-margin fixtures and the added numeric/paired stage composition;
its exact tarball identity is recorded in177. Types, changed lint, catalog174/12/33,
Studio metadata/routes/search, public JSDoc and109documentation mutation probes
pass. Scoped changed-production review has no unresolved material finding.

Min/max returns to capability-complete for its stated supported contract after
repairing177's counterexample and rerunning the full prior matrix. Auto-margin
stays partial. The fixed33denominator is10complete/12experimental/5partial/
5missing/1excluded; all7release gates remain open. The721-record corpus and its
530unclassified/183preserved/8native-font-source classifications are unchanged.
Concise divergences and separate column query receipts retain their own scope.
No production/default migration, release trust, performance or whole-program
completion claim is made. Whole-codebase review remains the final exit step.

## Slice178 delivered: wrapped column Text natural cross sizing

Delivered2026-10-24. The fixed-width wrapped-column case was already supported;
a corrected public automatic-width/fixed-height case freshly failed its side-auto
guard before production. Flex now composes the existing receiver-owned natural
advance cache with an exact chosen-width/declared-height Text query. The chosen
width is capped by finite content availability after padding and resolved margins.
Standalone public Text availability queries and non-auto stretch stay unchanged.

A100width column wraps the run into two10px lines;140fits one natural-width line
at x0. Changing margin0toauto shifts the same width. Content updates move paint/
hits without replacing native nodes; source focus order and exact teardown remain.
A second public RED caught padding before the fix:20horizontal padding requires
an80content width in100, yielding two lines instead of one. Matched physical and
logical10% versus numeric10 margins, resize and long-word outside-owner targeting
complete the focused seven-test check (five new, two existing). The changed-file/
regression seven-file run passed510/9skip in82.02s before the three additional
hardening cases, which then passed the final focused run in2.20s. The ordinary
seven-file snapshot passed131/388skip in2.69s. Node24.15.0/Chromium; no aggregate
trust claim. Permanent177regressions remain in the combined run.

The pinned auto-margin probe preserves50records and appends7; SHA256
`c24926ffb8953a7f7860e17fd4053cd809f7832777addb63fe87e0d8604ab85e`.
Breakable synthetic natural60/260 gives x140/0 under200 and x100/0 under160;
both-auto natural60 gives x70. Yoga's at-most callback and Pibbl's selected exact
query are distinguished. The synthetic unbroken-word260 callback records a260
Yoga box while Pibbl caps allocation and preserves visible glyph overflow; this
is an explicit provenance difference, not font parity. Kernel/ABI10 unchanged.

Source/built dedicated glyph/click proofs and the full existing Flex/Text replay
pass with no browser errors and cleanup000. Built proof uses470inputs. The
installed strict Bundler/NodeNext/no-alias246-input consumer passes wrapped Text
resize, moved targets, paint measurement reuse, identity and exact teardown;
tarball SHA256 `ae39226150edcf18c365adfadbba29ba64b11ef0abb768902dac71d1709f3477`.
The sixth Column content mode is wrapped Text in
`http://127.0.0.1:5192/#/examples/layout/wasm-flex-text`; click Compare auto margins,
cycle Column content, then Change column text. Visual inspection confirms readable
controls and aligned short versus wrapped long text. Review's percentage-margin
question is closed by the existing definite-width resolver and matched public
checks; no artificial rejection was added. Final types/lint, catalog174/12/33,
Studio metadata/routes/search, public JSDoc and109documentation mutation probes
pass; scoped review has no unresolved material finding.

Fixed33stays10complete/12experimental/5partial/5missing/1excluded; auto-margin
remains partial and all7gates stay open. Row-wrap natural Text basis, natural
column directions/wrapping and staged nonzero numeric margin contributions stay
explicit. Consolidation60 will cover178–180 before further capability production.

## Slice179 delivered: wrapped-row Text natural basis and final-width cross sizing

Delivered2026-10-24. A public direct Text fixture with omitted width minimum first
failed before paint at the explicit-main-minimum diagnostic. The narrow LTR
forward row/wrap path now composes the existing natural advance/longest-word floor,
native wrap membership and settled-width Text-height measurement. No API/ABI,
new solver/cache, re-line pass, ordinary-mode change or numeric-wrap migration.

Matched cross margin0toauto preserves main sizes and wrap membership. Text shares
a line with a40px peer, then reflows into two10px lines at70width; a below-word
owner retains the longest-word floor and outside-owner glyph targeting. Public
focus/hits, width updates, native identity, paint reuse and exact teardown pass.
The permanent177regressions and prior Text minimum/basis cases remain in the
8-file experimental run:98pass/1skip in3.11s underNode24.15.0/Chromium.
The same ordinary-mode files pass50/skip49 in2.44s.

The native probe preserves57earlier records and appends8, including width16 below
the explicit24minimum. Source SHA256
`87656ae6e5c7f3d1aa7cc8347ca591b372a9f729a5c95cc91c23ed4c75d72eb2`.
The synthetic84basis/24floor model records at-most callback envelopes, line
membership and final widths. It does not represent browser fonts. Yoga keeps
wrapped top-auto at0; Pibbl retains its already documented CSS line-local rule,
with a10px Text taking30px beside a40px peer. This difference is explicitly
classified and is not new full-geometry parity. Kernel/ABI10 remain unchanged.

Source/built full Flex/Text replay passes with no browser errors and cleanup000;
built470inputs. The installed strict Bundler/NodeNext/no-alias246-input consumer
passes natural-row reflow, targets, node/paint ownership and cleanup, with explicit
non-font-parity receipts. Tarball SHA256
`a199dd17032c18c51f0153fc7e1ce5fbd58f6895fb2e660ec0236301fe1d5db1`.
At `http://127.0.0.1:5192/#/examples/layout/wasm-flex-text`, click Compare auto
margins, then Natural row width and Toggle comparison width. The opt-in control
enables wrapping and starts at180before narrowing to70. Ordinary controls remain
unchanged. Visual inspection confirms readable copy and first-line placement.
Scoped changed-runtime review is clean and types/lint pass. Public JSDoc,
catalog174/12/33, Studio metadata/routes/search and109documentation mutation
probes pass.

Fixed33remains10complete/12experimental/5partial/5missing/1excluded; auto-margin
and all7gates remain open. Consolidation60 covers178–180 before further capability
production. The next slice must distinguish true auto-only failures from matched
numeric0 failures belonging to independent intrinsic sizing prerequisites.

## Slice180 delivered: settled percentage/aspect cross sizes before auto placement

Delivered2026-10-24. Actual public numeric0/auto pairs first reproduced two
margin-only failures: aspect-derived height and percentage height painted at0,
then rejectedauto. Percentage min-height already passed both. The shared admission
check now permits definite cross lengths and the existing aspect path; downstream
length validation, main sizing, ratio derivation/clamping and native auto placement
remain the sole owners. Omitted/auto cross sizes still require supported measurement.
No API/ABI, new solver/cache or ordinary-mode change.

Three public regressions pass underNode24.15.0/Chromium, including owner100to80,
exact pixels, moved hit targets, stable nodes and four teardown counters. Focused
compatibility run passes21/skips410 in2.23s. Old aspect-only negative expectations
were migrated to the now-supported existing aspect calculation. Scoped guard
review finds no material hole; invalid sizes retain downstream diagnostics.

Pinned Yoga preserves65records and adds12, total77. Probe source SHA256
`94c144ef230a91c0d1edb0bac4a90f1de583b6bbe9221b4d81bd6fee8cb883c6`.
At owner100to80, ratio2/width40 keeps height20 and auto y80to60;
height50% and height20/min-height50% yield height50to40 and auto y50to40.
All zero-margin pairs retain identical sizes at y0. Kernel/ABI10 unchanged.

Source/built aspect example passes old shrink/floor checks plus Sideauto toggle,
percentage pixels, moved click targets and exact cleanup0000; built470inputs.
The installed strict Bundler/NodeNext/no-alias246-input consumer passes all three
zero/auto pairs, ownership and104prior margin fixtures. Tarball SHA256
`a1e7afd12260dc5317b24f4de91a03b6e6cc21d2bf89ca632865721123ca3aea`.
Inspect `http://127.0.0.1:5192/#/examples/layout/wasm-flex-aspect-minimum` and
click Sideauto: the ratio boxes keep their dimensions and move to the side;
the50%height box moves down. Fixed33counts stay10complete/12experimental/
5partial/5missing/1excluded; auto margins and all7release gates stay open.
Visual inspection confirms readable controls and the moved ratio/percentage boxes.
Types/lint, public JSDoc, catalog174/12/33, Studio routes/search and109docs
mutation probes pass. Remaining direction/intrinsic cases require actual paired
baseline evidence.

## Consolidation60 delivered: slices178–180

Verified2026-10-24. Native kernel/ABI10 remain unchanged. Node24.15.0 with
Playwright Chromium ran64files/1009tests: experimental997pass/12skip in84.17s;
ordinary302pass/707skip in5.46s. This includes permanent prior phase/bounds,
undefined/unbounded, ownership, layout, intrinsic, percentage and positioning
coverage plus the new wrapped Text and resolved cross-auto regressions. Expected
negative diagnostic fixtures remain asserted failures, not unhandled regressions.

Fresh source5192/built5193 full Flex/Text replays pass, errors[] and cleanup000;
built470inputs. Slice180's source/built aspect companion and installed246-input
strict Bundler/NodeNext/no-alias consumer pass; tarball SHA256
`a1e7afd12260dc5317b24f4de91a03b6e6cc21d2bf89ca632865721123ca3aea`.
Pinned auto-margin probe77records, SHA256
`94c144ef230a91c0d1edb0bac4a90f1de583b6bbe9221b4d81bd6fee8cb883c6`.
Types/lint, public JSDoc, catalog174/12/33, Studio routes/search and109docs
mutation probes pass; scoped180review is clean. Aggregate Node24trust and
independent program-exit review remain outstanding. No capability promotion:
fixed33stays10complete/12experimental/5partial/5missing/1excluded; all7gatesopen.

The separate public numeric0/auto audit confirms unwrapped fixed-height Text
mounts in columnRTL and column-reverseLTR/RTL atzero, but auto alone diagnoses.
These are true margin-only direction gaps, unlike invalid companion fixtures
whose sizing prerequisites still need correction. Preserve original remaining
intrinsic/wrapping/staged numeric-margin targets and responsible gates.

## Slice181 delivered: natural column widths across parent directions

Delivered2026-10-24. Twelve actual public numeric0controls mounted first. Three
LTR auto controls passed; nine RTL/reverse Text, paired-provider and described
known-Flex auto transitions failed before paint. Three shared profile predicates
now admit either nowrap column main direction and either parent reading direction.
All child-specific measurement guards remain, including the known child's own
supported intrinsic direction. Wrapped-column Text is unchanged. No API/ABI,
new query/solver/cache or ordinary-mode change.

The permanent12case matrix asserts exact x for0/left/both/right margins, main y0
or80, provider40to80 and known owner60to100, browser Text metrics, explicit
provider width0toInfinity/exact40 pure query, old/new targets, stable hook/native
identities, paint measurement/solve reuse and exact four-counter teardown.
Node24.15.0/Chromium focused9files pass112/skip1 in3.38s; ordinary49/skip64
in2.86s. Five prior column-profile cases pass/skip423 in2.30s. Scoped review clean.

Pinned native probe preserves77records and adds8, total85, source SHA256
`af91a2815ae714ad50158b4240c7ce1b37b95d4c107ade84018e2cca027648df`.
Synthetic30x40 Text: physical left auto x170 in both directions; y0/80 follows
column/reverse; RTLzero already startsx170. Yoga's at-most200/exact40 query is
recorded separately from Pibbl's natural unbounded-width/exact-height query;
font/callback parity is not claimed. Kernel/ABI10 unchanged.

Source/built dedicated Text/provider/known direction replays check pixels and
transfer selection from the following sibling to each moved target; cleanup0000,
built470inputs. The installed strict Bundler/NodeNext/no-alias246-input consumer
passes paired direction geometry/targets/identity and104prior margin fixtures;
tarball SHA256 `eaa6c4a25692c10810eba3b496a03e1d8181d084d4c2ca41f8e3d01195cd547c`.
At `http://127.0.0.1:5192/#/examples/layout/wasm-flex-text`, click Compare auto
margins, then LTR/RTL and Reverse beside the column. Column content cycles Text,
provider40/80 and known rows60/100. Wrapped Text keeps its prior bounded direction.
Visual inspection confirms readable direction controls; the existing natural-row
button label now updates reactively. The complete source Flex/Text replay also
passes, errors[]/cleanup000. Types/lint, public JSDoc, catalog174/12/33, Studio
routes/search and109docs mutation probes pass. Fixed33stays10complete/12experimental/5partial/5missing/
1excluded; auto margins and all7release gates remain open.

## Slice182 delivered: shared measured Text cross-auto placement

Delivered2026-10-24. Actual matched public probes distinguish true auto-only
failures from missing-minimum failures already present atnumeric0. The normal
row Text path now uses its existing supported main allocation and real settled
width measurement before cross-auto placement, removing a separate factor/bounds
whitelist. Generic font, visible fit/overflow, no prepared query/aspect remain.
The independent wrapped natural-basis/minimum profile is unchanged. Required
initial/final Text measurements diagnose rather than silently retaining zero.

Unwrapped nowrap column Text now permits numeric/automatic basis and height under
the existing zero-factor/minHeight0 profile. Numeric height is queried exactly;
auto height is measured naturally under the finite owner. Main allocation stays
authoritative; auto margins suppress stretch in the final-width continuation too.
Wrapped fixed-height column Text reuses the capped natural advance in reverse/RTL
parents. This deliberately extends numeric0logical cross boxes there as well;
it preserves line membership but does not claim the former full-available zero
box was identical. It adds no bidi or intrinsic graph policy.

Fifteen permanent public cases cover grow/shrink/min0/min20/active min120/max60,
wrapped min controls, numeric flexible-width controls, column basis/auto-height
with public hooked follower allocation, and reverse/RTL short/long wrapped Text.
They assert paint/geometry, source targets, native/hook identity, measurement/solve
reuse and four-counter cleanup. Node24.15.0/Chromium10files pass127/skip1 in3.51s;
65prior auto/Text cases pass/skip363 in2.93s after migrating old rejection
expectations to supported geometry. Scoped runtime review has no material finding.

Pinned Yoga preserves85records and adds12, total97; source SHA256
`8ed2916a277da55a541b1fa5364418227f83e12a621d9cd1a568434ca095e05e`.
Synthetic callbacks honor settled exact widths: grow120/height20/top60;
shrink≈40/min70/max60 give height40/top40; column basis40/autoheight gives
width84/height40/left116. Callback and font provenance are explicit and separate
from actual Canvas geometry. Wrapped reverse/RTL records retain native zero-auto
observations alongside Pibbl's documented line-local policy. Kernel/ABI10 unchanged.

Source/built dedicated replay passes growing-row reflow, column basis/auto-height
allocations, wrapped reverse/RTL targets and cleanup0000; built470inputs. Visible
controls are Grow Text and Column sizing in the existing Flex/Text lesson; wrapped
column direction controls now apply the same natural-width policy. Visual review
confirms readable controls and the moved Text. Hit probes use actual font ink
bounds rather than assuming glyph ink begins at the line origin.

The installed strict Bundler/NodeNext/no-alias246-input consumer passes new row
factor/bounds and column numeric/automatic basis/height cases, native identity,
exact cleanup and104prior margin fixtures. Its canvas fixes CSS size explicitly
so backing-store resize is not mistaken for layout geometry. Tarball SHA256
`ff281a9e152403f745d4540f5985893a70d79dc2b46ff3bcd77f5e3400810e71`.
Full source/built Flex/Text replays also pass, errors[]/cleanup000. Types/lint,
public JSDoc, catalog174/12/33, Studio routes/search and109docs mutation probes
pass. Fixed33stays10complete/12experimental/5partial/5missing/1excluded; auto margins
and all7release gates remain open. No aggregate trust/program-exit review claim.

## [NEXT] Slice183: remaining finite measured-cross admission branches

Actual column probes identify zero-render/auto-reject cases for Text main factors
and cross bounds, paired providers and known Flex with numeric basis/auto authored
height or final growth. Verify exact final-main allocation and existing pure query
before a shared final-cross continuation; do not invent arbitrary intrinsic graph
support or fallback sizes. Row paired/known automatic-width candidates require the
same matched public evidence. Keep original targets and separate unsupported zero
queries from auto-only failures. Consolidate181–183 before further production.

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
