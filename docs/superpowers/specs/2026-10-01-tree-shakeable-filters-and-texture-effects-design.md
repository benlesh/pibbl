# Draft design for tree shakeable filters and texture effects

> **Historical status: Design or implementation record; current behavior is defined by runtime contracts.**

Status: proposed design for review, 2026-10-01. Not an implemented contract or
approval to change public APIs. This proposal covers optional filter architecture,
texture consumption, animated underwater displacement, migration, and evidence.

CRC should ship a small integration protocol in its base renderer and load each
optional feature through explicit application imports. Filters continue to own
appearance-only processing of a primitive and its descendants. Textures produce
the pixels a filter can use as input. An animated water texture feeding a
displacement filter is the first new effect; it uses the existing texture owner
and CRC scheduler rather than introducing another animation system.

## Decisions

1. Replace string-tagged filter descriptors with immutable opaque values returned
   by imported factories from `@crc/core/filters`.
2. Move capture, surface pools, native filter validation, and effect execution
   behind those values. Core keeps recognition and invocation, not an effect registry.
3. Split texture consumption from texture production. Built-in drawing components
   depend on a small resource protocol, not `useTexture` or its implementation.
4. Keep existing texture authoring exports and ownership. Add internal synchronous
   borrowing for filters; do not expose a backing canvas on public handles.
5. Add `displacement` as an optional GPU filter and `waterWaves` as an independently
   removable recipe in `@crc/textures`. Native filters never import the GPU path.
6. Preserve logical geometry, source paint order, event targeting, physics, focus,
   scheduler phases, and explicit Layer caching.
7. Prove removability using built, packed consumer bundles, including transitive
   imports and top-level initialization. Do not infer it from package metadata.
8. Deliver native-filter isolation first, then animated water. Interactive ripple
   simulation is a later extension through the same texture messaging contract.

## Evidence from the current repository

The following are observations from this checkout, not bundle measurements:

| Current boundary              | Evidence                                                                                                          | Consequence                                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Core mounting                 | `packages/core/src/lib/mount-crc.ts` imports and constructs `FilterSurfacePool`                                   | A plain mount reaches filter resource machinery, although backing surfaces are lazy                       |
| Canvas rendering              | `packages/core/src/lib/backend/canvas-2d-backend.ts` imports `renderFilterBoundary`                               | The renderer reaches filter capture and execution                                                         |
| Style resolution              | `packages/core/src/lib/style/resolve-dispatch.ts` imports `resolveFilterList`                                     | Every primitive can reach the complete descriptor validator                                               |
| Filter compilation and bounds | `packages/core/src/lib/style/filter.ts` and `packages/core/src/lib/filter/filter-region.ts` branch on filter type | Factory syntax alone cannot isolate individual implementations                                            |
| Texture consumption           | Text, Path, and Image import `resolveTexturePaint` from `textures/texture.ts`                                     | Consumption and production currently share a module and state; exact retained bytes require a bundle test |
| Texture recipes               | `packages/textures/src/lib/definitions.ts` creates multiple recipes at module scope                               | Unused factory calls and shared tables must be checked for retained work                                  |
| Package output                | Core uses bundled split ESM and declares `sideEffects: false`                                                     | Existing configuration does not remove code still reachable from mounting/rendering                       |

The [style contract](../../design/style-system-contract.md) specifies the closed
string descriptor vocabulary, one native operation per filter chain, and
appearance-only geometry. The [surface contract](../../design/canvas-surface-contract.md)
and [ownership contract](../../design/runtime-resource-ownership.md) specify local
capture density, transient pools, teardown, and failure cleanup.

There is material documentation drift: the
[texture contract](../../design/textures-contract.md) describes the original
render-layer components and says shared live sources do not exist. Current
`defineTexture`, `useTexture`, and `TexturePaint` code and the
[texture resource reference](../../site/api/types/texture-resources.md) support
mount-owned shared sources. Implementation must reconcile that contract while
preserving the older components' own behavior. This proposal does not replace
those components or absorb concurrent texture recipe work.

## Goals and boundaries

An application using a plain Canvas scene must not ship filter engines, procedural
texture producers, simulation recipes, or GPU displacement code. Using one native
filter must not ship other filters' specific validators or a GPU backend. Shared
capture, ordinary signal infrastructure, and small recognition protocols are
legitimate common costs, reported separately.

A texture used only as paint must not bring filter processing. A displacement
filter must not bring water, ink, electrical textures, Three.js, or physics. A
water recipe must not bring displacement unless the application uses that filter.

This proposal does not make every line of core optional. Mounting, immediate-mode
traversal, Canvas composition, and supported baseline interaction are the base
runtime. Optional animation evaluators, layout algorithms, external renderer
adapters, visualization, particles, and physics must be audited under the same
rule, but unrelated public API redesigns are separate work. Their current
removability is not assumed.

No public shader API, arbitrary custom-filter ABI, retained scene graph, second
scheduler, automatic pointer distortion, worker pipeline, or CPU full-scene pixel
processing is introduced. GPU support here is private image processing, not a
return of the removed CRC WebGL scene runtime.

## Public authoring

Existing native operations become named factories. Factory option fields retain
the current meanings, defaults, ranges, clamping, and concrete-color requirements.

```tsx
import { Group, Rectangle } from "@crc/core";
import { blur, dropShadow } from "@crc/core/filters";

<Group
  style={{
    filter: [
      blur({ radius: 2 }),
      dropShadow({ offsetX: 0, offsetY: 4, blurRadius: 3, color: "#0008" }),
    ],
  }}
>
  <Rectangle style={{ width: 120, height: 80, fill: "coral" }} />
</Group>;
```

The complete initial native exports are `blur`, `brightness`, `contrast`,
`dropShadow`, `grayscale`, `hueRotate`, `invert`, `opacity`, `saturate`, and `sepia`.
`displacement` is exported independently from the same subpath. A re-export barrel
must remain inert and consumer tests must prove individual export elimination.
Per-effect deep imports are unnecessary for the initial public surface.

`CRCFilter` becomes an opaque readonly value. Its type remains importable from
core and is also exported from the filter subpath. `SystemStyle.filter` remains
`CRCFilter | readonly CRCFilter[]`, with the existing shallow signal wrapper.
One value is a one-item list; an empty list is a direct-path no-op. Lists preserve
order and nested boundaries execute inside out.

Factories copy option records, freeze ordinary nested configuration, and preserve
signal/resource references. They allocate no canvas, subscribe to nothing, start
no clocks, and inspect no browser capabilities. Calling a factory during a
component evaluation is normal. Descriptor object identity never defines a
mounted resource lifetime.

Numeric factory fields explicitly accept `SignalValue<number>`; drop-shadow
color accepts `SignalValue<string>`. Displacement's `map` explicitly accepts
`SignalValue<TexturePaint>`. Other configuration records are ordinary immutable
values. This is an explicit descriptor schema extension, not recursive signal
unwrapping. Signals are read and inputs validated during receiving-primitive
preparation, with dependency edges owned by that receiver generation. A whole
filter/list signal continues to work. Passing `.get()` keeps its existing
component-consumer meaning.

Invalid ordinary options are diagnosed at receiver preparation so diagnostics
can name the component, filter index, field, and value. Signals are never read by
the factory. Custom style normalizers and resolvers still cannot reinterpret or
remove the framework-owned filter. Pure measurement ignores the effect and does
not acquire resources or check browser support.

## Runtime dependency direction

The dependency graph must have these directions:

```text
application -> core mounting -> small filter protocol
application -> blur factory -> native operation + shared capture executor
application -> displacement factory -> displacement operation + shared capture executor
                                             -> GPU processor
application -> useTexture -> texture resource producer -> small texture protocol
application -> waterWaves -> defineTexture + water generator
core drawing -> small texture protocol -> callbacks on a supplied texture value
filter displacement -> small texture protocol -> callbacks on a supplied texture value
```

Core must have no runtime import back into the implementations on the right.
Type-only references are allowed. Protocol modules must not import barrels that
re-export their implementations.

A factory returns an opaque, privately branded value carrying access to its
implementation through a private capability record. Core recognizes a genuine
value, prepares it, and invokes its supplied boundary executor. No type-name
lookup, global installer, mutable default registry, or `enableFilters()` is used.
Private branding is an API integrity check, not a security boundary against
hostile JavaScript in the same realm. Foreign runtime values receive a diagnostic.

The internal filter protocol consists of three responsibilities:

- `prepare`: resolve declared inputs and validate them without raster allocation;
  return an immutable operation plus its executor identity.
- `requiredInput`: map a required output window to conservative input bounds;
  supplied by the operation, never a central switch over all filter names.
- `executeBoundary`: process the prepared ordered list around exactly one
  invocation of the primitive subtree using the receiver's transaction context.

All official filters share one capture executor identity. It understands native
segments and opaque custom-pass callbacks; it does not import any custom pass.
Native operations carry their compiler and extent rules. Only drop shadow brings
its specialized color validation. Unknown or incompatible executor values fail
before subtree invocation. This protocol stays internal until real extension
requirements justify a public contract.

Core supplies generic occurrence state, successful-generation adoption, teardown
registration, local/world transforms, and signal dependency ownership. Those
facilities do not construct filter pools. The supplied executor lazily attaches
its service to the owning CRC instance on first active use. Last active boundary
removal releases that service; root disposal remains the final idempotent backstop.
An unsuccessful candidate cannot leak a service registration.

## Capture and ordered execution

One receiving primitive and all descendants form one source image. Its subtree
executes once. Preserve the existing distinction between the capture paint
transform and root-logical world geometry. Apply parent-facing placement,
transforms, alpha, clips, and compositing at the same stages as today, exactly once.

The executor builds an ordered pass plan without traversing children. Consecutive
native operations compile into one Canvas filter chain. A custom pass splits the
chain; operations are never reordered across it. A chain such as blur,
displacement, brightness is three segments. Nested effects complete before their
parent captures the resulting pixels.

Determine the visible output window from the parent target and transforms using
existing conservative projection rules. Walk each operation's `requiredInput`
backward, retaining the needed intermediate windows. Raster density remains the
largest singular scale of the local-to-parent-backing transform. All pixel windows
use finite, overflow-checked, outward rounding. Displacement adds its maximum
logical excursion plus the sampling footprint; native blur/shadow retain their
current conservative influence rules.

For a native-only chain preserve the current source/result pair, two bitmap draws
per boundary excluding subtree work, and no pixel readback. Mixed chains use
bounded sequential scratch leases, releasing each input after its last use. The
native two-draw guarantee does not apply to a mixed chain. Record pass counts,
transfer counts, surface count, and live bytes explicitly rather than hiding them
behind a single filter count.

A singular or discarded output still evaluates the subtree once to preserve
lifecycle and logical behavior using a discard target. It does not upload a map
or execute GPU passes. Malformed options still reject; an unused GPU capability
need not be created just to discard pixels. This refines the existing blanket
nonempty-filter capability rule.

The output is the affected subtree, not a backdrop snapshot. Siblings and content
behind a transparent subtree are not refracted. To submerge a whole scene, place
its background and contents inside the filtered boundary.

## Texture consumption and borrowing

Split the current texture module into a small recognition/consumption protocol,
producer lifecycle implementation, and placement utilities. Public `defineTexture`
and `useTexture` remain available from `@crc/core`; the existing convenience
re-export from `@crc/textures` remains. Inert root exports alone do not justify
moving established APIs to another subpath.

A live texture handle or paint view supplies private operations to resolve Canvas
paint and synchronously borrow a raster. The small core protocol dispatches through
the supplied value. It must not hold a global table of producers or import their
constructors. Preserve native strings, gradients, and patterns on the fast path.

Borrowing provides the committed source, dimensions, revision, resource identity,
and placement for the duration of a synchronous callback. The consumer may upload
or draw those pixels but may not mutate, resize, transfer, retain, or dispose the
canvas. Consumers may retain their own derived GPU upload, keyed by resource
identity and committed revision, and release it with their own occurrence.
No raw source accessor is added to the public texture handle.

Reading a texture for a filter establishes the same receiver-owned revision
relationship as reading it for paint. Multiple consumers see one resource
revision; they do not each advance or rasterize the producer. Successful dependency
replacement detaches an old map. Removal, failed generation, and disposal release
provisional and committed consumer edges appropriately.

Preserve current ownership restrictions: sharing is within one owning CRC tree,
including its managed Layers. The hook owns and disposes the producer; consumers
borrow it and never extend its lifetime. A retained handle cannot be rendered
after its owner is disposed. Later sends remain inert as documented. Definition
changes require a new keyed owner; display changes do not reset source state;
texture-resolution changes keep their existing reset meaning.

## Displacement semantics

Proposed public shape:

```ts
interface DisplacementOptions {
  map: SignalValue<TexturePaint>;
  strength: SignalValue<number>; // maximum excursion per axis in logical units
  region: Readonly<{ x: number; y: number; width: number; height: number }>;
}
```

`strength` is finite and nonnegative. `region` has finite coordinates and positive
finite dimensions. It defines map placement in the receiving primitive's local
coordinate system, not a clipping rectangle or a layout box. It is required so
transparent Groups and arbitrary drawing primitives never require retained
subtree bounds or an implicit measurement pass. This makes explicit a coordinate
decision omitted from the earlier conversational API sketch.

Map placement uses the texture view's existing repeat/stretch, tile dimensions,
offsets, and rotation, with `region` supplying the same bounds that paint
resolution would receive. Repeat wraps both axes. Stretch maps the source to the
region and clamps map samples outside it. Placement changes where the map is
sampled; its channels continue to represent offsets on the receiving local X/Y
axes. Moving/clipping the capture window never moves the map origin.

Use red for horizontal displacement and green for vertical displacement. Blue is
ignored. Alpha weights the displacement, so transparent map pixels are neutral.
For an 8-bit channel `c`, define signed displacement as `(c - 128) / 128` below
128 and `(c - 128) / 127` at or above 128. Thus bytes 0, 128, and 255 mean exactly
−1, 0, and +1. Decode sampled channels after bilinear interpolation. This is an
explicit CRC encoding, not an assertion of SVG displacement equivalence.

For local output position `p`, let `v` be the decoded RG vector times map alpha:

```text
output(p) = source(p + strength * v(p))
```

Positive red samples to the right, so visible features move left. Document this
sampling sign. Source samples beyond the captured source window are transparent;
they do not clamp into edge streaks. The expanded source window must contain the
maximum displacement and interpolation footprint for every visible output pixel.
Map sampling and source sampling use bilinear interpolation. Scene interpolation
uses premultiplied alpha to avoid colored fringes; map data uses unpremultiplied
channels with alpha applied once.

Treat the map as numeric RGBA data in the supported sRGB 8-bit canvas path; disable
unwanted upload color conversion and test exact neutral, signed extremes, alpha,
and Y orientation in the supported browser. This does not add HDR or wide-gamut
data textures. Strength zero is an identity operation: validate options but do
not subscribe to map pixel revisions or acquire the GPU service. Other native
operations in the same list still execute normally.

## GPU processing and capabilities

The initial implementation targets an optional OffscreenCanvas WebGL2 processor.
It imports neither Three.js nor `@crc/three`. It uploads the captured source and
borrowed map, executes a full-screen displacement pass, and composites the result
back to Canvas2D synchronously before the scratch target is reused. Initial
correctness takes priority over speculative sharing with an application's GPU
context.

One root-tree filter service owns at most one GPU context while at least one
active displacement occurrence needs it. Nested filters run sequentially after
their descendants complete; their persistent outputs live in leased Canvas
surfaces, not the shared GPU drawing buffer. Reuse shader programs and bounded
scratch textures. Cache map uploads per live resource revision; release cache
entries when their final borrower is removed. Never keep an unbounded history of
revisions or output sizes.

Use capability probes at first effective use, not import or recipe creation.
Displacement requires OffscreenCanvas 2D plus WebGL2; a pure displacement chain
need not require native Canvas filter parsing. A native segment requires native
Canvas filters. Unsupported capabilities, tainted uploads, oversized targets,
allocation failure, and compilation failure report contextual errors. There is
no silent CPU fallback, reduced resolution, or substitution of unfiltered output.
Applications may explicitly choose another style for their supported environment.

Context loss invalidates cached GPU resources and aborts the current effect pass.
Do not composite an incomplete result. Report the failure through CRC's error
path without stopping unrelated roots. A restoration event requests one CRC
update and rebuilds lazily; there is no continuous retry loop. Dispose listeners
and all owned programs, textures, buffers, and framebuffer objects with the service.

No `getImageData` or `readPixels` of the captured scene is permitted. A procedural
texture may generate and upload its own small pixel array; this is not scene
readback. GPU upload/composition still has real copy and synchronization costs.
The browser accepts canvas sources for texture uploads, but that API does not
promise a zero-copy path. See [the texture upload API](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texImage2D).

The prototype must verify Canvas/GPU alpha, color, orientation, context recovery,
and complete-frame cost before this backend is considered accepted. If it cannot
meet those requirements, revisit the backend explicitly; do not silently change
the public semantics or claim a performance advantage from shader timing alone.

## Animated underwater recipe

`waterWaves` lives in its own module in `@crc/textures` and returns a normal
`TextureRecipe<WaterMessage>`. It imports no filter implementation. Its initial
options are `seed` (default 0, existing validated seed domain), `speed` (finite
nonnegative multiplier, default 1), `scale` (integer periods per tile, 1 through
32, default 4), and `paused` (default false). Use ordinary `TextureOptions` for
resolution. Palette options are rejected for this data recipe rather than
silently recoloring displacement channels.

The initial generator sums a small fixed set of seeded periodic wave modes and
encodes a bounded two-component offset field. Both tile axes wrap continuously.
The seed determines mode phases/directions; scale changes spatial frequency;
speed changes phase progression. Output amplitude is normalized to the encoding
range; the filter's strength controls the final logical excursion.

Advance with CRC's supplied millisecond delta, expressed internally in seconds.
The first frame establishes a baseline. Pause/resume discards elapsed debt. A
speed of zero produces a static field and stops continuing requests. Seed or scale
changes regenerate the field; speed changes preserve phase; display resize and
DPR changes preserve phase. Texture resolution changes retain the existing
producer reset semantics. Same seed, configuration, and admitted deltas produce
the same generated bytes in the tested runtime; no cross-engine floating-point
bit identity is promised.

Initial messages are `{ type: 'pause', paused: boolean }` and `{ type: 'reset' }`.
The authored `paused` option sets initial state and later value changes update
it; unchanged reevaluations do not undo a message-driven pause. Reset clears
phase to the seeded initial state and retains the current pause state. Paused
configuration changes can invalidate one frame without starting a loop.

```tsx
import { Group, Layer, useTexture } from "@crc/core";
import { displacement } from "@crc/core/filters";
import { waterWaves } from "@crc/textures";

function UnderwaterScene() {
  const water = useTexture(waterWaves({ seed: 7, speed: 0.4, scale: 4 }), {
    resolution: { width: 128, height: 128 },
  });

  return (
    <Group
      style={{
        filter: displacement({
          map: water.paint({ mode: "repeat", tileWidth: 160, tileHeight: 160 }),
          strength: 6,
          region: { x: 0, y: 0, width: 640, height: 360 },
        }),
      }}
    >
      <Layer>
        <Scene />
      </Layer>
    </Group>
  );
}
```

This is proposed authoring, with `Scene` supplied by the application. The example
uses an explicit Layer to retain its content under existing Layer rules. It does
not promise that the entire CRC root stops traversing or repainting.

A future ripple recipe can accept local disturbances through `send`. The
application will map ordinary event coordinates into map coordinates and forward
messages explicitly. The filter never registers pointer listeners, captures input,
or simulates CRC physics. Ripple equations, bounds, overload policy, and brush
semantics require their own design; this proposal establishes the extension path
without shipping speculative simulation infrastructure. Caustic light overlays,
color grading, and blur remain separate composable effects.

## Scheduling and successful generations

Use the existing Begin, Advance, Commit, Plan, Render, Complete sequence. Texture
messages and motion use their existing producer lifecycle; phase updates must not
write application state during rendering. A texture revision published at Commit
dirties its consuming receiver and the required ancestor composition path in Plan.
Paint and filters in one successful frame consume the same published raster revision.
No effect starts `requestAnimationFrame`, timers, or another rendering loop.

The current producer mutates its source canvas during Advance before the staged
revision commits. Adding a second consumer kind must not expose a candidate
raster under the old committed revision. Implementation must provide committed
raster publication: stage changed pixels into a candidate surface, associate it
with the staged revision, adopt both on successful Commit, and discard or retain
for explicit retry on rejected Commit. Initial rasterization follows the same
successful-render ownership rule. Private simulation-state rollback is not added;
a rejected publication leaves the last committed pixels visible until a later
successful update. This distinction requires dedicated failure evidence.

Filter occurrence identity is the receiving primitive identity plus its ordered
operation slots, not the factory value object. Recreated equal options preserve
reusable resources. A kind or map change prepares candidate state, then replaces
old state and its subscriptions only after successful adoption. Inserting or
reordering operations may replace affected slots; it never resets the separately
owned texture producer. Failures release provisional leases in `finally`.

Ordinary Canvas frames are not made globally atomic by this design. A filter
composites only after its own processing succeeds and does not commit a new filter
consumer generation on failure; it cannot undo unrelated pixels already drawn
by a root. Preserve existing root error handling and the stronger transactional
bitmap/interaction guarantee of external render layers.

## Caching and interaction invariants

Animated displacement reruns processing when its map changes. An ordinary subtree
is still immediate-mode and is recaptured during rendering. CRC does not retain
its draw commands or infer that it is static. An explicit child Layer can provide
a cached bitmap while the surrounding effect moves. A filter inside a Layer
invalidates that Layer and the necessary ancestors. A filter outside a clean Layer
must not make the Layer's own content dirty solely because its map changed.

Unfiltered semantic geometry is authoritative for hit testing, cursor regions,
focus, keyboard navigation, clipping of interaction, accessibility guidance,
physics bodies, animation values, and event coordinates. Displacement neither
inverts the map during targeting nor changes Three raycasting inputs. It changes
the displayed bitmap of an external render layer while preserving that layer's
committed logical interaction generation.

An apparently moved button therefore retains its original target area. This is
the requested appearance-only behavior and should be demonstrated explicitly in
the lab. Applications choose suitable strengths. A paused field can remain visually
distorted; pause is not equivalent to strength zero.

## Ownership and failure ledger

| Resource                                                | Owner                                  | Release or replacement                                                  |
| ------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------- |
| Filter factory value                                    | Ordinary application value             | Garbage collection; no runtime teardown                                 |
| Prepared filter dependencies                            | Receiver generation                    | Successful replacement, abort, removal, or root disposal                |
| Native capture pool                                     | Lazily attached instance service       | Last active boundary removed or instance disposal                       |
| Scratch surface leases                                  | Current boundary invocation            | Every success or failure path in `finally`                              |
| Texture state, source rasters, messages, scheduler work | Existing texture hook slot             | Hook teardown; resolution reset where documented                        |
| Borrowed map                                            | Synchronous consumer callback          | Callback return; never transferred or retained                          |
| GPU service and context listeners                       | Root-tree optional service             | Last active displacement removed or root disposal                       |
| Map upload cache entry                                  | GPU service with live borrower count   | Revision replacement, final borrower removal, context loss, or disposal |
| Candidate raster publication                            | Exact producer publication transaction | Successful adoption or rejection cleanup                                |

Unmounting a filter does not dispose its texture. A texture owner may continue
animating while mounted even if currently unused; automatic visibility suspension
is outside this design. Pausing the producer or unmounting its owner stops it.
Tests must distinguish texture-owned continuing work from leaked filter work.

## Packaging and the wider optional feature audit

Add the `@crc/core/filters` ESM and declaration entry with Bundler and NodeNext
coverage. Keep `sideEffects: false` only while entries are genuinely inert.
Prefer declaration-style factories and modules with no observable top-level
initialization. Pure annotations are allowed only for reviewed calls whose unused
results can be discarded without losing required effects or validation.

Split recipe modules and aggregate lookup tables wherever a single selected
recipe otherwise retains unrelated generation code. Shared utilities must not
import their consumers. The same applies to native operation validators, region
expansion, and compiler helpers. Shipping a giant switch behind a factory fails
the requirement.

Current split ESM output can remain only if downstream tests prove the intended
elimination. If prebundling obscures boundaries or retains initialization, emit
preserved modules for the affected entries. This is a packaging choice backed by
consumer output, not a requirement to change every package build immediately.

Audit the following independently and report retained implementation families:

| Consumer                                    | Must not retain                                                                                                              |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Core mount and a plain Rectangle/Text scene | Filter execution/pools, texture producers, animation evaluators, external renderer implementations, sibling feature packages |
| Explicit Layer scene                        | Filters and texture producers merely because it uses a retained bitmap                                                       |
| Native blur                                 | Other native operation-specific implementations, GPU effects, texture producers                                              |
| Static marble paint                         | Ink/electric/water simulation, filters, GPU effects                                                                          |
| Water texture painted directly              | Displacement processor and native filters                                                                                    |
| Displacement with a user-defined texture    | Official texture recipes, native filter-specific validators, Three                                                           |
| Tween-only animation                        | Spring/stepper evaluators if structurally separable; report current coupling before proposing changes                        |
| One layout component                        | Unrelated layout algorithms; investigate shared dispatch coupling                                                            |
| Core render-layer usage                     | Three adapter and Three.js                                                                                                   |
| Physics geometry only                       | Runtime world, simulation scheduling, renderer adapters                                                                      |
| One visualization or particle entry         | Unrelated optional package families                                                                                          |

The first six rows and core-versus-sibling isolation are hard acceptance gates for
this feature. Other rows produce an evidence-backed audit and scoped follow-up
issues if fixing them would require unrelated contracts. Do not describe “most
features are tree shakeable” as verified until that audit supports it.

ESM named imports under a supported optimizing bundler are the guarantee. Dynamic
namespace indexing can retain every referenced export; an unbundled browser may
fetch re-exported modules. The promise is elimination of unused implementation in
consumer output, not that an npm tarball contains only one application's needs.
[esbuild's documentation](https://esbuild.github.io/api/#tree-shaking) explains the
relationship between ESM, reachability, and side-effect analysis.

## Consumer bundle evidence

Create minimal public-entry fixtures that perform an observable mount or export
an invoked scene factory. A fixture must not be removable wholesale. Test both
source aliases and installed packed packages; packed results are authoritative for
what developers receive. Cover named imports from the canonical barrels and the
new filter entry, minified and unminified production builds, and the repository's
esbuild and Vite consumer paths.

Collect attributed retained bytes, output chunks, source-map/module attribution,
raw/minified/gzip sizes, and a list of retained implementation families. Bundler
metafile input presence alone is not evidence that code survived elimination.
Confirm absent implementation through output attribution and independent sentinel
or AST checks; exercise positive fixtures so a broken detector cannot report a
false pass. Include associated emitted assets/chunks when calculating cost.

Add import-only smoke tests that prohibit resource allocation, capability probes,
listeners, scheduler registration, and recipe simulation at module evaluation.
Include an unused named import fixture as well as one with no import. Verify
that importing blur alone does not initialize every factory or a GPU context.

Use structural absence as the initial hard gate. Record measured byte baselines
with tool versions and review subsequent increases; establish numeric budgets
from actual implementation results instead of inventing an unsupported number.
A material base-runtime increase needs a concrete reason even if a size cap passes.

## Behavior and lifecycle verification

Before production changes, add focused failing public-API evidence for each slice.
After hands-on feedback, extend it to cover:

- All ten migrated native filters, ordered lists, custom primitives, empty lists,
  invalid descriptors, factory option signals, and receiver dependency replacement.
- Unchanged measurement, transforms, source paint order, Group/Clip/Layer semantics,
  density changes, nested effects, discarded output, and external layer composition.
- Constant neutral, positive/negative RG, transparent maps, channel sign, source
  edge transparency, seam wrapping, stretch/clamp, rotation, alpha, and pass ordering.
- Deterministic seeded water motion under controlled frame deltas, pause/resume,
  zero speed/strength, reset, configuration updates, and equal recipe recreation.
- One texture used by multiple paints and filters; no duplicate advance/rasterize;
  matching committed revisions; map replacement; failed Commit and failed rendering.
- Hit geometry, routed clicks, focus order, cursor regions, physics state, and
  animation samples before/after enabling distortion at identical logical times.
- Exact allocation/lease/subscription counters for removal, sibling reuse, nested
  use, errors, disposal, cross-root rejection, and GPU context loss/restoration.
- No scene pixel readback, no extra scheduler loop, bounded intermediate surfaces,
  no GPU resources for native-only/identity/discarded cases, and clean child Layer
  reuse under an animated outer filter.

Prefer semantic geometry and counters first. Use narrow visual fixtures for the
information those checks cannot establish, including refraction, alpha fringes,
map continuity, and native/custom ordering. Inspect expected, actual, and diff
before accepting baselines. GPU screenshots need documented tolerances; seeded
input alone does not make raster output identical across GPUs.

Measure capture, texture generation, upload, effect processing, final composition,
and complete-frame cost separately with hardware/browser/environment recorded.
Timing guards remain opt-in. Do not claim portable frame-rate guarantees.

## Migration and documentation

This is a deliberate source-breaking filter migration. Do not keep a default
legacy descriptor parser in core: it would preserve the dependency this work is
removing. Replace all repository call sites and documentation in the release that
changes `CRCFilter`. Runtime rejection of an old object should say to import a
factory from `@crc/core/filters`, without importing the legacy implementation.

| Existing form                                                    | Proposed form                                            |
| ---------------------------------------------------------------- | -------------------------------------------------------- |
| `{ type: 'blur', radius: 4 }`                                    | `blur({ radius: 4 })`                                    |
| `{ type: 'brightness', amount: 1.2 }`                            | `brightness({ amount: 1.2 })`                            |
| `{ type: 'contrast', amount: 1.2 }`                              | `contrast({ amount: 1.2 })`                              |
| `{ type: 'dropShadow', offsetX: 1, offsetY: 2, color: 'black' }` | `dropShadow({ offsetX: 1, offsetY: 2, color: 'black' })` |
| `{ type: 'grayscale', amount: 1 }`                               | `grayscale({ amount: 1 })`                               |
| `{ type: 'hueRotate', degrees: 90 }`                             | `hueRotate({ degrees: 90 })`                             |
| `{ type: 'invert', amount: 1 }`                                  | `invert({ amount: 1 })`                                  |
| `{ type: 'opacity', amount: 0.5 }`                               | `opacity({ amount: 0.5 })`                               |
| `{ type: 'saturate', amount: 1.5 }`                              | `saturate({ amount: 1.5 })`                              |
| `{ type: 'sepia', amount: 0.5 }`                                 | `sepia({ amount: 0.5 })`                                 |

Replace named descriptor interfaces with explicitly named option types such as
`CRCBlurFilterOptions`. Code reading `.type` or spreading descriptors must retain
its own application configuration and create a filter value from it. Opaque values
are not JSON configuration. Applications loading serialized effect choices must
write an explicit imported-factory mapping, paying for the factories they select.
A codemod may handle static object literals and flag dynamic constructions for
manual migration; it must not guess at application-owned objects named `filter`.

Update runtime exports, declaration entries, packed consumers, Studio import
allowlists and editor declarations, source/built execution, filter lessons,
tutorials, deterministic labs, API references, and migration guidance together.
Reconcile style, surface, texture, resource-ownership, and scheduling contracts
only as their implementation ships. Retain historical designs as dated evidence.
Public search continues to index only `docs/site` and approved example metadata.

## Delivery and acceptance

**Slice 1 — optional native filters.** Add one failing packed-consumer absence
check and one public blur behavior test. Implement the small protocol, lazy native
capture service, and blur factory through a runnable Studio example. Show the
exact running URL and inspect blur toggling, click geometry, and captured bundle
comparison. Do not build displacement infrastructure before this slice works.

After feedback, migrate the other native factories and call sites, isolate texture
consumption, and verify no-filter/no-producer bundle cases. This is an architectural
checkpoint, not a claim that the underwater feature is complete.

**Slice 2 — animated water.** Add a focused deterministic displacement test,
implement the GPU pass, committed texture borrowing, and the water recipe. Provide
a public Studio lesson with water enable/disable, pause, strength, speed, a map
preview, and an interactive scene. Include an explicit Layer example. Keep detailed
counters and exhaustive scenarios in the separate test lab. Show the actual URL
once running; this draft does not invent an available preview.

**Hardening after experiential feedback.** Complete the matrix above, ownership
fault injection, migration docs, public declaration parity, optional-feature audit,
and proportional review. Run the aggregate `corepack pnpm@11.21.0 trust` gate in
the documented Node 24.15+ / pnpm 11.21.0 / Playwright Chromium environment after
implementation. Report fresh commands and results, never historical test totals.

“Slice ready for feedback” means runnable public behavior and focused checks pass.
“Feature complete” means accepted appearance, all scoped bundle exclusions,
contract migration, behavior/lifecycle evidence, and final verification pass.
Interactive ripple simulation is explicitly outside that completion claim.

## Remaining empirical decisions

The public direction and semantic rules above are proposed decisions. The following
need implementation evidence rather than further speculative API design:

- Whether the current split ESM build preserves the required consumer boundaries
  or affected packages need module-preserving output.
- Whether WebGL2 upload and Canvas composition meet the measured full-frame cost
  and alpha/color requirements on supported browsers.
- Actual retained-byte baselines and practical scratch-memory costs at common DPRs.
- Visual tuning of the small wave recipe after users can inspect it.

If evidence contradicts a proposed backend choice, revise this draft and explain
the change. Do not weaken the appearance-only or optional-dependency guarantees to
make an implementation pass.

## Concurrent texture and WASM integration clarification

The ongoing plasma/lightning work and production WASM migration share the existing
`defineTexture` / `useTexture` resource lifecycle with this design. A texture
produces pixels; a filter consumes the committed texture publication to change
presentation. Generator implementation is private: JavaScript Canvas drawing and
WASM-backed rasterization must have identical ownership, invalidation, scheduling,
and consumer semantics. Neither the filter nor its consumer may borrow a raw WASM
memory view or depend on a particular generator's state layout.

Transparent frames replace the previous publication, including alpha. A reused
candidate surface must be cleared before copying the producer surface. Publishing
with source-over alone would accumulate stale plasma arcs and corrupt displacement
maps with transparent regions. Candidate preparation remains isolated from the
committed surface until the existing transaction adopts it.

WASM modules must remain independently removable per recipe. Importing marble
must not retain paper, cellular, ink, electric effects, or water. Importing water
must not acquire unrelated WASM kernels. Inert recipe construction may carry a
purity annotation after confirming that it allocates no host resource and performs
no external registration. Compilation and memory allocation belong to resource
creation, not module import. The source and packed esbuild/Vite bundle matrix must
check embedded kernel retention as well as ordinary JavaScript modules.

Animation and physics may provide parameters and typed messages through the
existing CRC phases. Sharing conceptual data does not imply sharing WebAssembly
memory: cross-module physics/texture integration uses explicit small value batches
and retains each resource's ownership. No second clock or framebuffer readback is
introduced. Water's current generator remains JavaScript; moving it to WASM is a
separate backend change that must preserve its observable output and timing.

## Integrated water and production-WASM amendment (2026-10-02)

This integration amendment records the shipped behavior merged from
`origin/main` (including water-heightfield work) and the package-consolidation
snapshot. It supersedes the preceding branch-qualified statement that water's
current generator remains JavaScript. `waterSurface()` is a bounded WASM height
field with reflective edges and normalized rectangular obstacles; `reflectedLight()`
is an optional appearance-only surface effect that can follow displacement. Both
retain the texture publication, scheduler, ownership, and no-readback boundaries
above.

Production marble, paper, cellular, reaction-diffusion, electric, wave, and water
generators use independently removable embedded WASM modules. Each resource owns
its bounded memory and compiles lazily at creation. Animation or physics exchanges
only validated value messages with those resources; raw memory, a second clock,
and cross-resource framebuffer readback remain outside the contract. The trust
gate preserves source/packed retention, reproducibility, and public lifecycle
evidence for these integrated implementations.
