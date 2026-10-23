# Bounded Yoga → Pibbl rehearsal

This is a numeric migration rehearsal, not Yoga parity, a compatibility profile,
performance evidence, or a production WASM migration. Run Studio in `layout-wasm`
mode and open http://127.0.0.1:5192/#/examples/layout/wasm-yoga-migration.

The left side draws recorded Yoga geometry. The right side uses ordinary public
Pibbl `Flex`, direct `Rectangle` and `useLayoutBox`. **Next case + resize** cycles these exact fixtures:

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

| Case | Basis | Grow | A height bound | A/B heights | A/B y |
| --- | ---: | ---: | --- | --- | --- |
| column-grow | 20px | 1 | min0 | 44/44px | 0/56px |
| column-cap | 20px | 1 | max30px, min0 | 30/58px | 0/42px |
| column-shrink | 80px | 0 | min60px; B min0 | 60/28px | 0/72px |

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

These fourteen exact geometries do not prove general percentages, intrinsic box
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
comparison. All recorded integer dimensions are exactly representable in both engines.

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
column; widths remain192px. It rejects automatic measured column item heights or
widths and does not establish intrinsic wrap support or additional Yoga parity.

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
