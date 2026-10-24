# Bounded Yoga → Pibbl rehearsal

This is a numeric migration rehearsal, not Yoga parity, a compatibility profile,
performance evidence, or a production WASM migration. Run Studio in `layout-wasm`
mode. The concise public lesson is
http://127.0.0.1:5192/#/examples/layout/wasm-yoga-migration (five cases).
The exhaustive private rehearsal is
http://127.0.0.1:5192/#/testing/layout-yoga-migration (all recorded cases).
Both use one rendering body; only the private host imports the full JSON corpus.
The generator updates/checks the private recording. A public test verifies that
the five lesson fixtures still match their corresponding recorded fields.

The left side draws recorded Yoga geometry. The right side uses ordinary public
Pibbl `Flex`, direct `Rectangle` and `useLayoutBox`. **Next case + resize** cycles the recorded matching fixtures and explicitly labeled CSS divergences:

| Case   | Parent width | Basis per item | Grow per item | A bound        | A/B widths   |
| ------ | -----------: | -------------: | ------------: | -------------- | ------------ |
| grow   |       300 px |          60 px |             1 | minimum 0      | 144 / 144 px |
| cap    |       300 px |          60 px |             1 | maximum 80 px  | 80 / 208 px  |
| shrink |       220 px |         180 px |             0 | minimum 120 px | 120 / 88 px  |

The original grow/cap/shrink cases use height80px, shrink1, gap12px and explicit
minimum0 except shrink A. Two additional direct empty-Rectangle cases use gap0:

| Case                          | Parent | Authored child input                                                         | A/B outer widths |
| ----------------------------- | -----: | ---------------------------------------------------------------------------- | ---------------- |
| rectangle-shrink              |  100px | width80px, height80px, shrink1, omitted minima                               | 50 / 50px        |
| rectangle-percent-content-box |  200px | width80px, height80px, basis70%, padding10px, shrink1; A content minimum90px | 110 / 90px       |

The padded case explicitly selects Yoga content-box sizing, matching Pibbl's
content-box dimensions and minimum plus outer padding. Its outer height is100px;
other cases are80px. Root height100px, LTR/start, border0 and rounding0 are fixed.

Three numeric column cases use parent100×100px, child cross width80px, gap12px
and shrink1:

| Case          | Basis | Grow | A height bound  | A/B heights | A/B y  |
| ------------- | ----: | ---: | --------------- | ----------- | ------ |
| column-grow   |  20px |    1 | min0            | 44/44px     | 0/56px |
| column-cap    |  20px |    1 | max30px, min0   | 30/58px     | 0/42px |
| column-shrink |  80px |    0 | min60px; B min0 | 60/28px     | 0/72px |

Classification: exact geometry under explicit native inputs. Pibbl preserves its
row default; these cases explicitly select column, shrink1 and main-axis minima.
Yoga uses the same explicit values with no rounding. There is no inferred content
minimum or compatibility profile. Both x/y and width/height are recorded, public
labels compare dimensions, and source/built input replays hit both targets while
main-axis gaps miss. The original padded row case remains an explicit content-box
conversion. Two further capped cases reverse only the main axis: `row-reverse-cap` places
A80×80 at220,0 and B208×80 at0,0; `column-reverse-cap` places A80×30 at0,70 and
B80×58 at0,0. Inputs match the corresponding cap case except explicit reverse
direction. Source A/B order stays fixed, both target identities remain stable,
and the12px main-axis gap misses. Classification is exact explicit finite input
geometry, not RTL or cross-axis reversal. The finite `row-wrap` and `row-wrap-reverse` cases use a150×100px parent, three
60×20px items, numeric basis60, grow0/shrink1, minWidth0, gap12 and explicit
start line alignment. Normal lines place A/B at y0 and C at y32; wrap-reverse
places A/B at y80 and C at y48. Source A/B/C order remains fixed, all three
identities are targeted publicly, and gaps miss. Classification is exact finite
source-formed line/cross-reversal geometry.

Two explicit border-box fixtures add finite padding-floor/bounds and percentage
basis/cross-size evidence. `border-box-floor-bounds` uses padding10 and outer
height60: A basis8/max8 floors at20, B basis80/min100/max110 becomes100, gap12.
`border-box-percentage` uses parent200×100, basis70%, height60%, padding10,
shrink1, gap0; A min110/max60% and B min0 settle at110/90 outer widths.
Content widths are90/70 and content height40. Both target identities are replayed.

Two asymmetric-border fixtures add row basis54 and column basis62, each with
outer54×62 and combined content insets left5/right9/top13/bottom19. Row B starts
atx66; column B starts aty74. They select border-box, grow0/shrink0, physical
padding left3/right5/top7/bottom11 and layout borders left2/right4/top6/bottom8.
These borders reserve layout space; the comparison paints its own full footprint.

The original sixteen matching geometries and the allocation cases below do not prove general percentages, intrinsic box
sizing, automatic minima, text, fractional precision, general wrapping interactions, combined main/cross
reversal or RTL. No Yoga implementation is bundled in Studio.

## Version, source and reproduction

The reference is **Yoga 3.2.1**, exact commit
[`042f5013152eb81c1552dec945b88f7b95ca350f`](https://github.com/react/yoga/tree/042f5013152eb81c1552dec945b88f7b95ca350f),
not a claim of the latest release. The source manifest identifies `yoga-layout`
3.2.1 and MIT. `YOGA-LICENSE` preserves the complete upstream notice; its hash and
our probe hash are bound to the record. `reference.cpp` is Pibbl-authored probe code.
No Yoga implementation or binary is shipped in this repository or the app runtime.

Use an existing Yoga Git checkout containing that commit (its current HEAD and
unrelated files are left untouched):

```sh
node tooling/layout-yoga-rehearsal.mjs --source /path/to/yoga
```

The script archives only the pinned Yoga source, license and manifest into a fresh
temporary directory, compiles the probe plus Yoga C++ files with `c++ -std=c++20
-O2`, compares all records, and removes temporary sources/binary. It frees every
node tree and configuration in the probe. This needs Git, tar and a C++20 compiler.
The fresh receipt used Apple clang 21.0.0 on the recorded Node 26.9.0 host.

Configuration explicitly sets `useWebDefaults=false`, point scale 0 (no rounding),
no errata, per-case axes/wrap/reverse, LTR, start item/line alignment and gap. Default experiments remain disabled.
This probes the native implementation; it is not a Yoga JS/WASM loading or speed
comparison. All matching-case dimensions are exact integers in both engines. The classified
initial-freeze grow case serializes Yoga's fractional result with the C++ probe's default six significant digits; this is display precision, not pixel rounding.

Without `--source`, the command checks only recorded provenance and consistency
with the example's embedded data. It does **not** rerun Yoga:

```sh
node tooling/layout-yoga-rehearsal.mjs
```

To intentionally regenerate both the receipt and example reference block, add
`--write` to the source command and inspect the diff. The focused public test
imports `reference.json` and compares actual Pibbl label positions and widths
obtained from `useLayoutBox`, then verifies disposal. No new runtime API is involved.

## Concrete translation

The before layout is executable in `reference.cpp`: create a configuration and
root, set row/width/height/gap/alignment, set each child basis/grow/shrink/min/max,
insert children, calculate LTR layout, inspect boxes and release ownership.
The corresponding grow row uses existing public Pibbl authoring:

```tsx
<Flex
  style={{
    width: 300,
    height: 100,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  }}
>
  <Panel
    style={{
      flexBasis: 60,
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      height: 80,
    }}
  />
  <Panel
    style={{
      flexBasis: 60,
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      height: 80,
    }}
  />
</Flex>
```

`Panel` is an ordinary component using public `useLayoutBox`; Pibbl owns its layout
lifetime. There is no manually allocated Yoga node tree in the migrated app.

Make policies explicit instead of copying defaults:

- Native Yoga configuration defaults to column and shrink 0; this reference sets
  row and shrink 1 explicitly. Pibbl's native defaults are row and shrink 1.
- Ordinary Panel wrappers retain explicit minima. Direct empty Rectangles use
  the bounded native zero content minimum; the padded case retains A's explicit floor.
- The new padded case explicitly selects Yoga content-box. It proves that one
  conversion with numeric padding, not general border-box/border or percentage-padding parity.
- Point scale 0 avoids Yoga pixel rounding. Pibbl retains logical coordinates;
  there is no general rounding-policy equivalence claim.

## Unsupported and production boundary

The experiment does not cover wrap/reverse/RTL, margins/logical edges, general automatic minima,
baselines, absolute/hidden/contents participation, text/font measurement, broad
intrinsic sizing or Grid. It supplies no versioned public compatibility selector.

Normal core package builds still select the JavaScript solver. Experimental local
source and private built lanes are available below; neither establishes a
production migration or distribution policy.

## Unpublished built-WASM proof (slice 17)

From a provisioned checkout (normal core/three/text builds already present):

```sh
node tooling/build-layout-wasm-package.mjs
node tooling/test-layout-wasm-package.mjs
corepack pnpm@11.21.0 -C playground exec vite --mode layout-wasm-built --host 127.0.0.1 --port 5188 --strictPort
```

Open http://127.0.0.1:5188/#/examples/layout/wasm-yoga-migration . The same public
imports now resolve exclusively to `packages/core/.layout-wasm-package/dist`.
The Studio bundler rejects mixed source/built core inputs and exposes its actual
input list as `__PIBBL_BUILT_LAYOUT_PROOF__` in the sandbox for local inspection.
The compile-time opt-in activates WASM independently of Vite's source mode. The
local private package retains ordinary public export names and is never published.
Normal `dist` and normal build behavior remain separate. Imports compile no WASM
until a mounted layout uses it. The build checks the embedded WASM fingerprint;
Rust rebuilding remains the separate reproducible toolchain command.

This local unpublished proof does not establish production packaging policy, portable
installation, release support, Node24 compatibility, or Yoga parity. The normal
package still selects JavaScript. Source Studio remains available on port5187.

## Built consumer declarations and lifecycle (slice 18)

```sh
node tooling/test-layout-wasm-package.mjs
node tooling/test-built-layout-lifecycle.mjs
# Optional same focused scenario in the source lane:
node tooling/test-built-layout-lifecycle.mjs http://127.0.0.1:5187 --source
```

Open http://127.0.0.1:5188/#/examples/layout/wasm-built-lifecycle . Resize and change
Text, click the outlined edge, dispose, change Text while detached, and remount.
Four layout nodes/two arenas are active while mounted; active ownership returns to
the recorded baseline when disposed. Renderer creates/disposes match exactly.
Counters are developer evidence, not public API or a full memory profile.

The independent local consumer copies this exact learning source, resolves only
public package exports, and typechecks with both Bundler and NodeNext resolution
without workspace aliases or skipLibCheck. Unused imports compile/instantiate no
WASM and schedule no frames. The experimental inspector property is deliberately
installed at import; it owns no layout resources. Repeated browser cycles test real
built allocations, Text-dependent old/new edge targets, and detached signals.
Existing third-party notices accompany the private generated package. The temporary
build tsconfig is removed after success. This is a symlinked local package proof;
packed/installed release consumers and Node24 remain separate milestone evidence.

The experimental kernel also has a separate finite row-wrap demonstration at
`/#/examples/layout/wasm-flex-wrap` in both local lanes. It adds no Yoga reference
coverage to these three migration cases. Concurrent source/built Studio servers
use separate optimizer caches. The diagnostic panels are height-limited so the
Canvas remains usable inside Studio's sandbox.

A declared-size column variant is available at
`/#/examples/layout/wasm-flex-column-wrap`. Shrinking height moves C into a second
column; widths remain192px. The Measured Text switch also demonstrates bounded fixed-width generic Text
auto-height before line formation. Other automatic measured heights and
non-stretch automatic widths remain unsupported; this adds no intrinsic wrapped
container support or Yoga font parity.

## Keyed wrapped collection and combined evidence (slice 21)

Open `/#/examples/layout/wasm-flex-keyed-wrap` in either lane. Reverse order keeps
mount stamps; remove B releases one node in each owner; restore appends fresh B
instances. A/C survive. Targets follow the new positions; paint reuses numeric work.

```sh
node tooling/test-wasm-wrapped-collections.mjs
node tooling/test-wasm-wrapped-collections.mjs http://127.0.0.1:5187 --source
```

These focused browser checks cover ownership6→4→6→0, mount stamps, hit counts,
restore creates2, paint reuse and Studio's pagehide-to-returned-controller cleanup.
The default requires actual private built input provenance on any port. Optional
`PIBBL_LAYOUT_SCREENSHOT=/tmp/wrapped.png` captures the Canvas for inspection; no
baseline update is involved. A separate measured-Text regression in the focused
suite checks bounded cache ownership across wrapped keyed membership changes.
This is finite subset evidence, not expanded Yoga conformance or release readiness.

## Nested intrinsic composition (slice 22)

Open `/#/examples/layout/wasm-flex-nested-intrinsic` in either lane. Toggle width
and shorten Text: the following sibling moves y320→360→280 and its target follows.
The opaque probe executes only in normal traversal. Paint reuses WASM solves and bounded nested aggregate measurements (slice23). Only known builtin nowrap columns at
settled widths are supported; this adds no Yoga oracle coverage.

```sh
node tooling/test-wasm-nested-intrinsic.mjs
node tooling/test-wasm-nested-intrinsic.mjs http://127.0.0.1:5187 --source
```

These checks include built provenance, geometry/input agreement and disposal to
zero ownership. The private consumer also typechecks this actual example under
Bundler and NodeNext. No general intrinsic or production migration claim.

Slice24 adds Reverse paragraphs and Remove / restore main to that same example.
Membership updates intrinsic height and hit geometry; surviving numeric nodes
persist, restored main creates one node, and edits while removed remain inert.
The same browser command covers both controls and bounded cache cleanup. This
adds no Yoga oracle case or font-load invalidation claim.

## Portable unpublished tarball consumer (slice 25)

Run the reproducible check from a provisioned checkout:

```sh
node tooling/test-packed-layout-wasm.mjs
```

The check builds the opt-in package from current sources, packs it locally,
installs that archive offline into an isolated temporary application with install
scripts disabled, and runs the actual nested intrinsic example against installed
public exports. It verifies strict Bundler/NodeNext types, no symlink or repository
source fallback, inactive imports, real mounted WASM execution, geometry/input
agreement, keyed membership, measurement reuse and zero layout ownership after
disposal. Check mode chooses an ephemeral localhost port and removes its consumer
and server afterward. It requires the existing Playwright Chromium installation.

For hands-on feedback, build the package and keep the consumer running:

```sh
node tooling/build-layout-wasm-package.mjs
node tooling/packed-layout-consumer.mjs
```

Open http://127.0.0.1:5189/. The canvas is visible immediately. Toggle width moves
the following sibling 320→360; Change Text, Paint only, Reverse paragraphs, and
Remove / restore main exercise the same installed application. Stop the process
to remove the temporary consumer. The page and terminal expose the tarball SHA256
and actual installed bundle provenance. This establishes portable local package
installation, without publishing, changing the normal engine or extracting the
eventual standalone layout package. Node 24 and full release verification remain
separate gates.

## Independent aspect precedence probe

Run `node tooling/layout-yoga-rehearsal.mjs --source /path/to/yoga --aspect-probe`.
This compiles `aspect-probe.cpp` against the same pinned source/configuration,
prints the commit and probe hash plus raw dimensions, and releases its temporary
checkout. It does not rewrite or expand the16-case interactive corpus. Supported
finite Flex cases show outer ratio3 overriding explicit cross50 and default
stretch: width90→height30; minHeight40/maxHeight20 clamp afterward; two shrinkable
width90 items in100 settle50×16⅔. Insets distinguish outer from content ratio:
content-box width90 plus horizontal14 gives outer104, then outerheight104/3.
The probe also records height-driven row behavior as discovery input; that
intrinsic main inference is outside the initial Pibbl finite-main ratio slice.

## Independent percentage-owner policy probe

Run `node tooling/layout-yoga-rehearsal.mjs --source /path/to/yoga --percentage-owner-probe`.
This compiles `percentage-owner-probe.cpp` against the pinned source and prints its
commit, probe hash and six raw owner/child widths. It intentionally does not read,
rewrite or enlarge `reference.json`.

Each fresh configuration is a row with two fixed-height children. The first is
either an 80px basis with `minWidth: 0` and `maxWidth: 25%`, or a 20px basis with
`minWidth: 50%`; the second is an 80px fixed basis. The owner is respectively an
exact 160px width, a `maxWidth: 160px` FitContent owner, or unbounded. The program
runs every case twice with fresh Yoga configuration and node ownership, failing if
the raw results differ.

This is policy evidence, not a Pibbl parity corpus. In pinned Yoga the max-only
FitContent path supplies a temporary available-size reference before its final
content size is returned: for example, the capped case returns owner120/first40,
where 40 is not 25% of final owner120. The floor case is 20 under unbounded
availability but owner160/first80 under max-only160. Pibbl therefore keeps its
accepted diagnostic for intrinsic percentage feedback; the probe must not be read
as authorization to substitute a maximum, zero, or convergence guess.

## Allocation release corpus and classified CSS differences

The comparison now contains25 records:22 native geometry matches and3 classified
CSS differences. New records carry explicit `itemStyles`, used unchanged by the
public fixture and semantic tests. All use finite row geometry and explicit minima;
automatic-minimum/provider behavior is a separate capability.

| Case                      | Parent/gap | Inputs                      | A/B widths      |
| ------------------------- | ---------- | --------------------------- | --------------- |
| zero-fractional-grow      | 112/12     | basis0; grow0.5/1.5         | 25/75           |
| fractional-shrink         | 112/12     | basis80; shrink0.5/1.5      | 65/35           |
| grow-freeze-release       | 312/12     | basis100; grow1; A max110   | 110/190         |
| shrink-freeze-release     | 112/12     | basis80; shrink1/3; A min70 | 70/30           |
| large-finite-differential | 312/12     | basis0; grow1e30/2e30       | 100/200         |
| subunit-zero-grow         | 112/12     | basis0; grow0.25 each       | 25/25, unused50 |

Factors1e30/2e30 remain finite in Yoga's f32 input domain. Separate Pibbl JS/Rust
1e308:1 robustness assertions are f64 extension evidence, not a Yoga differential.

The [CSS flexible-length algorithm, steps3–5](https://www.w3.org/TR/2025/CRD-css-flexbox-1-20251014/#resolve-flexible-lengths)
first freezes constrained items, then computes initial free space using their
frozen target sizes. A factor total below one can consume only part of that free
space. Pibbl preserves this contract, which differs from pinned Yoga:

| Classified case              | Native Yoga A/B | Expected Pibbl A/B |
| ---------------------------- | --------------- | ------------------ |
| subunit-shrink-policy        | 50/50           | 65/65              |
| initial-freeze-grow-policy   | 10/43.3333      | 10/37.5            |
| initial-freeze-shrink-policy | 90/10           | 90/62.5            |

`boxes` always contains native probe output. `pibblBoxes` separately records the
classified Pibbl expectation, and `comparisonLabel` explicitly names the difference
in Canvas and text status. Browser assertions target the Pibbl boxes; these cases
are never counted as geometry matches. `node tooling/test-css-partial-flex.mjs`
independently checks the two initial-freeze expectations with real Chromium CSS.

Migration correction in slice74: constrained subunit growth changes B35→37.5,
and constrained subunit shrink changes B65→62.5, because initially frozen sizes
now participate in initial free space. Both JavaScript and Rust are corrected.
The unconstrained partial-shrink65/65 policy remains unchanged.

## Finite distribution evidence (slice 76)

The corpus now has75 cases:64 native matches and11 explicitly classified
Pibbl/CSS differences. Fifty distribution records cover both row and column:
negative main free space for six policies, negative wrapped cross space and one
item for seven policies, two bounded automatic cross-size cases, and eight
reversed safe-overflow cases. Every record retains native geometry unchanged.
The eight reversed records also include independent expected CSS/Pibbl geometry.

Independent browser commands are `node tooling/test-css-flex-distribution.mjs`
and `node tooling/test-css-flex-distribution-reverse.mjs`. With main100px,
gap12px and two nonshrinking80px items, around/evenly start at0/92px forward
and92/0px under main reversal. With cross30px and two20px lines, positions are
0/32px forward and32/0px under wrap-reverse. Yoga3.2.1 instead returns
20/-72px reversed main and10/-22px reversed cross; these eight differences
are labeled `css-safe-overflow-reverse`. Explicit center remains centered and
space-between remains direction-relative. This corrects the previous Pibbl
centered around/evenly overflow without changing authoring signatures or the ABI.

Empty native children are only an oracle for declared/empty automatic sizes.
Real measured Text evidence additionally uses the public column example through
`node tooling/test-wasm-column-text-cross.mjs <Studio URL> [--built]`, plus
installed-package Text/following-sibling geometry and hit checks. The browser
probe converts backing pixels using the known root background, allowing narrow
raster rounding tolerance; logical text height is measured, not hard-coded.

## Definite-owner percentage bounds (slice 77)

Eight further records bring the corpus to83 cases (72matches/11classified
prior differences).25% cap growth in a200→240 main owner gives50/138→60/168
with gap12.70% floor shrink in100→140 gives70/18→98/30. Column cases use
identical main-axis values. The public owner-resize checks preserve mounts/nodes
and move the former target into the new gap. Run
`node tooling/test-wasm-yoga-migration.mjs <Studio URL> --percentage-bounds`
(add `--built` for built mode); it also checks the prior grow case, actual catalog
checkout path,760×540 served metadata and exact disposal. Percentage-dependent
intrinsic owners remain explicitly unsupported; a max constraint is not silently
promoted to an exact owner. Indefinite native/CSS observations are not parity
fixtures for this bounded contract.

## Allocated nowrap percentage margins (slice 84)

Four `margin-percent-*` records pin row/column nowrap geometry and owner resize.
All physical edges, including vertical margins, use allocated content width.
The comparison surface's sixth Next section jump selects them. Source/built and
installed consumer checks cover actual targets and exact cleanup. Wrapped
percentage margins and intrinsic percentage feedback remain unsupported; existing
numeric wrapped margins are unchanged. The native numeric/percentage cross-margin
quirk is recorded in Plan010 and is not silently adopted as a Pibbl policy.

## Finite nested percentage owners (slice 85)

Eight `nested-percent-gap-*` records use one fixed nested Flex tree: three inner
owners and a following keyed item. Row/column × nowrap/wrap × owner resize pins
outer boxes and A's two inner boxes in root coordinates. Inner40% basis/dimensions
and10% gaps use final allocated inner sizes, not outer dimensions. `nestedBoxes`
marks only this fixed tree; it is not a recursive fixture language or public API.
The seventh Next section jump selects the cases. The dedicated source/built
replay verifies served worktree catalog and760×540surface, every semantic box,
moved leaf/footer targets, stable stamps/nodes, paint-only reuse and zero cleanup.
Fresh packed fixtures repeat all eight through installed public entries.

The finite LTR row/column nowrap/wrap preserve entry is evidence-complete for its
stated finite contract. RTL, reversal, automatic minima, intrinsic percentage
feedback, standalone migration and release trust retain their own explicit gates.

## Wrapped percentage physical margins (slice 86)

Four `margin-percent-*-wrap*` records preserve existing numeric Pibbl physical
cross offsets. Yoga3.2.1 drops those offsets in the same numeric and percentage
trees; native boxes remain recorded separately from explicit `pibblBoxes` under
`preserved-physical-margin-offset`. This is a classified placement difference,
not a percentage-resolution mismatch. The existing margin section now contains
eight records: four nowrap matches and four wrapped differences. Source/built and
installed pixels/targets/cache/identity/cleanup checks cover both row/column pairs.
Wrap-reverse percentages remain explicitly rejected until their own numeric
preservation proof; auto/logical margins and indefinite owners remain gaps.

## Wrap-reverse percentage margins (slice 87)

Four additional `margin-percent-*-wrap-reverse*` records lock existing Pibbl numeric
physical-offset geometry before percentage admission. Yoga native boxes remain
separate from the explicitly classified Pibbl boxes, including negative visible
coordinates and padded reversed-cross differences. The margin section now has12
records: four nowrap matches and eight wrapped/reversed classifications. Actual
source/built/installed pixels and targets, owner resize, paint reuse, identity and
cleanup are checked. Intrinsic/indefinite owners and logical/auto margins remain
explicit gaps; there is no new margin API or native ABI.

### Unrounded logical geometry (slice 110)

The `rounding-scale-zero-row` record retains exact binary fractions at the pinned
Yoga point scale zero: widths49.375, second origin51.875 and heights10.375/12.625.
The corpus is308 records (214matches/94classified); this record is separate from
the104auto-margin and24direction records. `--rounding` in
`tooling/test-wasm-yoga-migration.mjs` checks public source/private-built boxes and
targets. The installed consumer also checks densities1/1.5/2 and fractional
Group/Layer pointer/focus geometry. The selected policy preserves unrounded
logical coordinates; only Canvas backing dimensions round. This does not claim
positive Yoga point-scale pixel-grid snapping parity.

### Nested finite cross minimum (slice 112)

`nested-cross-min-row[-resized]` adds two independent tagged records: a direct
nested Flex with two40×20 leaves and minHeight60% follows outer height100→160.
Its line becomes60→96 and C moves y72→108. `--nested-cross-min` replays exact
nested leaf/B/C boxes, moved hits, keys and native reuse through public source and
private-built mounts. The installed consumer repeats the behavior. One pure
measurement per preparation remains; no new row snapshot cache is claimed.
The corpus is310=216matches+94classified; auto104/direction24 are unchanged.
Broader reverse/decorated bounds and indefinite-owner policy remain outstanding.

### Decorated reversed nested cross minimum (slice 113)

`nested-cross-min-decorated-row-reverse[-resized]` pins the content owner after
border/padding:244×144→204 border box gives200×100→160 content. A remains132,22
and grows60→96; C moves132,94→130. `--nested-decorated-cross-min` checks actual
public nested leaves, B/C world geometry, keys, targets, native reuse and cleanup.
The312-record corpus now has218matches/94classified differences. Surface height
must admit the204-high root; a180-high viewport changes the actual constraints.

### Definite nested cross maximum (slice 114)

`nested-cross-max-decorated-row-reverse[-resized]` caps declared height60 by25%
of the content owner100→160: A and its100%-height leaves become25→40. C stays
at132,74 while point136,52 becomes an A1 target. `--nested-decorated-cross-max`
checks source/private-built geometry, keys, input, native reuse and zero pure
measurements. The isolated installed consumer repeats it. Corpus314=220matches/
94classified; auto104/direction24 remain unchanged. Broader min/max scope is open.

### Definite nested column cross maximum (slice 115)

The column-reverse decorated cap uses width144→204/height244 and content cross
100→160. A declared width60/maxWidth25% gives its100%-width leaves25→40; C stays
74,132, while52,136 becomes an A1 target. `--nested-decorated-column-cross-max`
checks both records; add `--latest-proof` to use the new direct comparison control.
Next case and Next section retain their behavior. Corpus316=222matches/94classified;
auto104/direction24 and the native binary remain unchanged.

### Definite nested column cross minimum (slice 116)

The decorated column-reverse minWidth60% pair turns declared width20 into60→96,
with100%-width leaves matching the allocation and C moving x94→130 at y132.
Point100,136 transfers C→A1, then the new C target remains reachable. Use
`--nested-decorated-column-cross-min --latest-proof` for direct source/built replay.
Corpus318=224matches/94classified; auto104/direction24 remain unchanged.

Slice117 adds two isolated `customColumnMeasureFixture` cases. A finite forward
LTR nowrap column measures the8-job custom callback at exact width40→60, yielding
height40→30 and moving its20px follower y40→30. Both use explicit minHeight0,
automatic basis and zero grow/shrink. This is numeric callback geometry, not font
parity or a general intrinsic graph. Corpus:320cases,226matches/94classified.

Slice119 separates recorded data from the shared copyable renderer. The private
virtual iframe loads lazily and records exact fixture source/license/probe hashes,
ordered names and actual source or private-built core inputs. Existing
`test-wasm-yoga-migration.mjs` defaults to this full private route and preserves
all family selectors; `--public` selects the five-case lesson. Public checks also
require that no private corpus bundle was requested. The public custom-column
pair supports `--public --custom-column-measure --latest-proof`; navigation resets
local content mutations to the recorded eight-job input.

The combined `--nested-cross-matrix` selector exercises all five cross-min/max
resize pairs consecutively, checking pair-name isolation. Decorative bottom
notes opt out of hit testing so tall fixture targets remain reachable.

## Independent empty aspect minimum probe

Run `node tooling/layout-yoga-rehearsal.mjs --source /path/to/yoga --aspect-minimum-probe`.
It compiles `aspect-minimum-probe.cpp` from the archived pinned3.2.1 commit
`042f5013152eb81c1552dec945b88f7b95ca350f`, with non-web defaults, point scale0
and no errata. It prints source SHA256 and16 row/column × omitted/zero minimum ×
decoration × cross-cap records without changing the721-case corpus.

A90basis/shrink1/ratio3 item beside a fixed20 sibling in80main units uses
60main units under both omitted and zero minima. Row cross is20; column cross
is180, or150 under maxWidth150. Native `SizingMode.h` explicitly states that
this version lacks CSS automatic minimum sizing; `BoundAxis.h` applies authored
bounds, and `CalculateLayout.cpp` derives aspect cross after main flexing. These
records justify Pibbl's empty-content zero floor, not a CSS transferred-size
minimum or automatic-minimum parity for Text/images/custom content. The larger
aspect automatic-minimum category stays open.

### Static structural owner probe (slice 217)

`baseline-static-owner-probe.cpp` is a focused Yoga 3.2.1 control, not a
capability or release-gate promotion. It uses the pinned reference commit
`042f5013152eb81c1552dec945b88f7b95ca350f`, web defaults false, point scale zero,
and no errata. Compile it with the same Yoga sources as the other probes.
The 2026-10-24 raw output was:

```text
nested=0 absoluteFirst=0 step=0 A=18 B=0 badge=0
nested=0 absoluteFirst=0 step=1 A=8 B=0 badge=0
nested=0 absoluteFirst=0 step=2 A=10 B=2 badge=0
nested=0 absoluteFirst=1 step=0 A=18 B=0 badge=0
nested=0 absoluteFirst=1 step=1 A=8 B=0 badge=0
nested=0 absoluteFirst=1 step=2 A=10 B=2 badge=0
nested=1 absoluteFirst=0 step=0 A=18 B=0 badge=0
nested=1 absoluteFirst=0 step=1 A=8 B=0 badge=0
nested=1 absoluteFirst=0 step=2 A=10 B=2 badge=0
nested=1 absoluteFirst=1 step=0 A=18 B=0 badge=0
nested=1 absoluteFirst=1 step=1 A=8 B=0 badge=0
nested=1 absoluteFirst=1 step=2 A=10 B=2 badge=0
```

Steps 0 and 1 report first baselines 12 and 22. Step 2 keeps 22 and adds a
relative top of 10 to the selected child. The static badge remains at the
nearest non-static ancestor's origin for both direct and nested static owners,
regardless of the absolute child's source order.

Step 2 is a semantic difference: Yoga includes the selected child's relative
offset in the structural baseline contribution. Pibbl retains its existing
slice-214 contract: structural contributions use pre-relative layout placement,
while relative offsets move paint and hit geometry. Pibbl therefore expects
A=18, B=0, badge=0 at step 2. No CSS agreement is claimed by this probe.
