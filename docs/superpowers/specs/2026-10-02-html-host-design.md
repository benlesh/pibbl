# HtmlBox design

> **Historical status: Implemented HtmlBox record; current behavior is defined by runtime contracts.**
> Status: finalized design, 2026-10-02. The user accepted the component name
> `HtmlBox` and requested finalization followed by implementation design. This is
> the implementation target, not shipped behavior. See the
> [implementation design](../plans/2026-10-02-html-box-implementation.md).

The public name is `HtmlBox`; “HTML host” describes its architectural role and
“overlay” describes its DOM placement. Neither `Html`, `HtmlHost`, nor
`HtmlOverlay` is a compatibility alias. This document does not authorize
publishing, committing, or implementing unrelated work.

## Purpose

Add `HtmlBox` to `@crc/core`: a CRC component with a logical rectangle and a
persistent HTML content DIV. CRC owns allocation, placement, clipping, stacking,
and mount lifetime. The browser owns HTML layout, semantics, editing, and native
input. Applications can mount ordinary DOM or another UI framework into the DIV.

HTML always appears above the root canvas, including Three render layers.
Canvas paint cannot cover HTML. Among HTML hosts, later CRC source order wins.
The rectangle is a layout and navigation boundary, not an automatically painted
or independently clickable Canvas `Rectangle`.

This is an opt-in DOM boundary. It does not add lowercase HTML intrinsics to CRC
JSX, reconcile DOM children, rasterize HTML, or create accessibility semantics for
the rest of the canvas.

## Current implementation findings

- `render-target.ts` distinguishes world geometry from the active drawing target.
  `useCanvasContext().getTransform()` alone is insufficient inside Layers and
  filters. DOM placement must use world geometry and the root surface projection.
- `Clip` accepts `PathGeometry | Path2D`, but currently resolves both to native
  `Path2D` before publishing clipping metadata. Preserve portable geometry as
  additional metadata rather than trying to recover it afterward.
- `PathGeometry` has revisions and `toSvgPathData()`. Reuse that conversion;
  do not introduce another path language or approximate every curve by polygons.
- Layer caches replay interaction/focus metadata. HTML registrations likewise
  need replayable placement metadata even when their content does not rerender.
- The focus contract currently assumes the canvas is the only native focus owner.
  It clears logical focus on native canvas blur and explicitly has no sentinels.
  HTML support deliberately extends these rules only for opted-in roots.

Relevant current contracts:

- [Canvas surface](../../design/canvas-surface-contract.md)
- [Focus and keyboard navigation](../../design/focus-and-keyboard-navigation-contract.md)
- [User events](../../design/user-events-contract.md)
- [Runtime hooks](../../design/runtime-hooks-contract.md)
- [Resource ownership](../../design/runtime-resource-ownership.md)
- [Style](../../design/style-system-contract.md)
- [Layout](../../design/layout-system-contract.md)

## Public authoring surface

Extend both root `CRCConfig` variants with an optional `htmlOverlay: HTMLElement`.
It identifies an application-owned, dedicated overlay container. `HtmlBox` without
this configuration throws a descriptive error. A root `OffscreenCanvas` cannot
host HTML; managed offscreen Layers beneath an HTML canvas can.

Expose `HtmlBox`, `HtmlBoxProps<T>`, `HtmlBoxStyle`, `HtmlMountCallback<Props>`,
`HtmlUpdateFunction<Props>`, and `HtmlBoxFocusState` from `@crc/core`. The following describes
the public contract; the component uses CRC's existing branded component and
signal-aware style types rather than a React component signature.

```ts
interface HtmlBoxProps<T> {
  data: T;
  pointerEvents?: "auto" | "none";
  mount: HtmlMountCallback<T>;
  onFocusChange?: (state: Readonly<HtmlBoxFocusState>) => void;
}

type HtmlUpdateFunction<Props> = (props: Props) => void;

type HtmlMountCallback<Props> = (
  element: HTMLDivElement,
  initialProps: Props,
  signal: AbortSignal,
) => HtmlUpdateFunction<Props>;

interface HtmlBoxFocusState {
  readonly isFocusWithin: boolean;
  readonly isFocusVisible: boolean;
}
```

`HtmlBoxStyle` uses existing box/layout participation and Group transform fields,
plus `opacity`. `pointerEvents` is a component prop, consistent with CRC's
existing interaction API. Its own `filter` accepts only
an empty filter value; a nonempty Canvas filter enclosing HTML is also rejected.
Signal inputs follow existing receiver-owned resolution rules. `data` is an
opaque application value: use `.get()` when its replacement should rerender the
CRC component; arbitrary objects or nested signals are not recursively unwrapped.

`mount` is captured once per component identity. New inline callback identities
do not remount content. The latest `data` goes to `update` after subsequent
successful renders, even if its object identity is unchanged. Initial data goes
only to `mount`. Use a new `key` to replace the mount implementation. `HtmlBox` has no
CRC `children` and no string-HTML convenience prop; the mount callback controls
the content, including any deliberate use of HTML templates.

Example of the designed API:

```tsx
function mountNameEditor(
  element: HTMLDivElement,
  label: string,
  signal: AbortSignal,
) {
  const field = document.createElement("label");
  const caption = document.createElement("span");
  const input = document.createElement("input");
  caption.textContent = label;
  field.append(caption, input);
  element.append(field);
  input.addEventListener(
    "input",
    () => {
      console.log(input.value);
    },
    { signal },
  );
  return (nextLabel: string) => {
    caption.textContent = nextLabel;
  };
}

const scene = (
  <FocusManagement>
    <Group style={{ rotationDegrees: 15, translateX: 80, translateY: 60 }}>
      <HtmlBox
        data="Name"
        mount={mountNameEditor}
        style={{ width: 240, height: 64 }}
      />
    </Group>
  </FocusManagement>
);

crc(canvas, scene, { viewport: "responsive", htmlOverlay: overlay });
```

Programmatic focus uses native `input.focus({ preventScroll: true })`; focus
within a live host synchronizes the manager through native focus events. There
is no mount context or separate CRC focus method.

The signal is a native `AbortSignal`, not a reactive CRC signal. Mount receives
one initially un-aborted signal for its identity, and returns an update function
(no-op if no updates are needed). The initial props are consumed by mount, not
immediately delivered again to update. For teardown beyond DOM event listeners,
register `signal.addEventListener("abort", cleanup, { once: true })`, for example
to unmount an embedded framework or disconnect an observer. CRC aborts once before
removing the connected subtree. Applications need not create an AbortController.

## Root DOM arrangement and ownership

Use explicit page structure rather than automatically reparenting the canvas:

```html
<div class="crc-surface">
  <canvas></canvas>
  <div class="crc-html-overlay"></div>
</div>
```

```css
.crc-surface {
  position: relative;
  isolation: isolate;
}
.crc-surface > canvas {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  padding: 0;
}
.crc-html-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}
```

The application supplies a definite surface size. The overlay and canvas must
be adjacent siblings in the same document and share the same untransformed
content rectangle. The overlay has no border or padding and contains no
application children. One live CRC root exclusively leases it. Validate the
structure and initial dimensions, and revalidate dimensions on surface resize.

Transforms on their common ancestors work naturally because both surfaces inherit
them. Independent CSS transforms on the canvas or overlay are outside this first
contract; apply transformations to the common wrapper instead. This avoids
bounding-client-rectangle approximations for rotated elements, document scroll
listeners, and a new animation loop. Canvas borders can be drawn on the wrapper.

CRC adds and removes its own viewport, host nodes, clipping definitions, and
focus sentinels. It does not change the application-owned canvas parentage or
overlay styles. Disposal leaves the overlay empty and reusable. Whole-wrapper
fullscreen works; canvas-only fullscreen cannot include its sibling overlay.

## Layout, transforms, and paint

`width` and `height` use existing finite box resolution. Omitted or `auto` sizes
use the parent's allocation; they do not measure DOM content. Padding creates an
inner content rectangle, while min/max constraints and layout participation use
CRC's existing rules. The application content DIV occupies the content rectangle
and has border-box sizing. CSS inside that DIV determines its own HTML layout.
Its own CSS padding/border must fit that assigned box.

Let `W` map host-local coordinates into root logical coordinates, including
ancestor placement and the host's own Group-order transforms. Let `R` be the root
logical-to-backing matrix and `D` the effective backing-pixels-per-CSS-pixel scale
from the surface snapshot. The outer host matrix is:

```text
M = inverse(D) × R × W
```

Apply `matrix(a,b,c,d,e,f)` with `transform-origin: 0 0`. Do not round translation,
decompose rotation/scale, or include device pixel ratio twice. This covers fixed
viewport fitting, responsive layout, reflection, skew, and nested affine
transforms. The content padding offset composes after `W`.

Use a stable outer stacking shell per host. Give shells source-order z-indices so
application descendants cannot escape their host's relative stacking. The content
DIV stays attached under the same shell during keyed reorders; update stacking
and focus metadata without reparenting it. Newly mounted hosts append without
moving existing nodes.

The root viewport clips HTML to the canvas content rectangle. The default host
overflow is `clip`; explicit `overflow: 'visible'` allows overflow within ancestor
clips and the root viewport. A host paints no Canvas fill/stroke; compose a CRC
`Rectangle` for a background or focus treatment when desired.

Zero allocation, zero root display size, or a singular host matrix hides and
deactivates the host while retaining its mounted content. Nonfinite geometry
throws before DOM presentation. On becoming usable again, identity and content
survive; focus is not automatically restored.

Opacity applies as a CSS group opacity to the HTML host, multiplied by inherited
CRC alpha. This matches an isolated host's alpha, not combined Canvas/DOM group
compositing. Non-default Canvas composite operations and nonempty Canvas filters
enclosing HTML are unsupported and produce a descriptive error. Independent CSS
effects inside the content DIV are allowed. Raw Canvas API mutations cannot be
fully inspected: custom primitives must not surround HTML with unregistered
clips or composition state. Supported inherited clipping comes from CRC metadata.

## Clipping representation and DOM projection

Extend clip metadata with an immutable portable snapshot alongside the existing
`Path2D`: SVG path data, fill rule, and its coordinate-space transform. Preserve
the source `PathGeometry` identity/revision only as conversion-cache keys; never
retain a mutable path as the committed geometry. Snapshot before publication.
CRC-generated allocation and Layer bounds supply equivalent portable rectangles.

Cache SVG conversion by geometry identity and revision. Reuse `toSvgPathData()`
for curves, arcs, closed paths, and holes. Mutating a `PathGeometry` still does not
schedule a render automatically. CSS uses same-document SVG `<clipPath>`
definitions with `clipPathUnits="userSpaceOnUse"` and the matching `clip-rule`.

For host matrix `M` and clip-local-to-overlay matrix `C`, project the clip into
the host frame with `inverse(M) × C`, applied to the SVG path element. Each
`clipPath` definition itself remains in the common host frame. Chain definitions
by placing `clip-path` references on the `clipPath` elements themselves: the CSS
Masking specification defines this as intersection. Putting sibling paths in one
SVG clip would instead produce a union. An empty path clips everything.

The host shell references the head of this chain. Keep the content ancestry
stable: clip depth changes update only SVG definitions and references, never
wrap, detach, or reinsert the application DIV. Definitions have root-unique IDs,
are acyclic, and live in an owned zero-size SVG outside application content.
Release obsolete definitions after replacing references, and all definitions on
host disposal. Verify nested SVG clipping in the first browser slice; if a target
engine cannot support it, report the unsupported engine rather than silently
changing clip semantics.

Native `Path2D` has no path-command export. When an HTML host encounters an
ancestor clip without portable geometry, fail with a message identifying the
host and asking the caller to use `PathGeometry`. Canvas-only content continues
to accept `Path2D`. Do not silently ignore the clip, approximate it by its bounds,
or generate a per-frame raster mask.

Clipping controls visible pixels and native pointer hit testing. It does not
establish keyboard eligibility. Arbitrarily clipped descendants can remain
focusable, consistent with native DOM; authors must disable/hide controls that
should leave navigation. CRC suppresses focus for zero-size/singular/explicitly
inactive hosts, but does not claim exact shape-occlusion detection for every DOM
control. Pixel-identical Canvas/CSS antialiasing is not required.

## Mount lifetime and frame publication

Keep HTML integration lazy: roots with no configured HTML overlay allocate no
HTML manager, observers, sentinels, or geometry-conversion cache.

During Render, collect candidate registrations without changing connected DOM.
A registration contains component identity, resolved data, source order,
allocation, relative placement, portable clips, alpha, and focus membership.
Validate the full candidate before publishing it. Managed Layers retain these
registrations with their successful render generation; composing a clean Layer
reprojects its hosts through the current outer placement without rerendering
application content. Never freeze HTML positions in root coordinates in a cache.

Publish successful root DOM presentation in an internal Complete-phase step,
before application completion notifications and before the browser paints. This
is later than scheduler Commit, which precedes Render. No second scheduler or
`requestAnimationFrame` is introduced. All affected projections use one surface
snapshot. DOM publication is synchronous; mount must return a function, and
async mount/update returns are errors.

For a new host, attach its styled shell and call `mount` once with the connected
content DIV. Eligible content permits native focus during setup; reconcile that
focus only after publication and focus collection succeed. Synchronous publication
finishes before browser paint, and failure removes the candidate subtree. For an existing
host, apply the new allocation/presentation and call `update` once when that
component actually rendered; a placement-only cache replay never calls `update`.
Callbacks may read layout but CRC itself batches geometry reads before writes.
Mount/update callbacks and synchronous abort cleanup cannot write CRC signals, matching imperative
setup constraints; native input handlers can write signals normally. Notifications
such as `onFocusChange` run afterward and may schedule subsequent CRC work.

The application owns nodes/resources it creates inside the supplied DIV. It
must not replace, reparent, or restyle CRC-owned shells or clipping wrappers.
The returned function handles updates only. There is no returned instance object
or separate unmount/dispose callback. CRC aborts the supplied signal exactly once
before removing the content subtree, including after a later update failure.
This removes listeners registered with `{ signal }` and notifies application
abort handlers that release frameworks and other resources. Abort also runs if
mount throws or returns an invalid value; register cleanup as resources are
acquired so partial setup can be released. CRC then removes the subtree in a
`finally` path. Native abort-listener exceptions follow browser event error
reporting; they are not promised as scheduler-caught callback exceptions. Cleanup
handlers must release their own resources even when one cleanup operation fails.

A render failure follows CRC's existing fail-closed root cleanup, including all
HTML registrations. A mount/update publication failure also cleans that root's
HTML and reports the error through scheduler completion without stopping unrelated
roots. There is no claim of rollback for Canvas pixels or arbitrary application
DOM side effects. Teardown continues even when one cleanup throws.

## Native input and focus bridge

Native DOM owns pointer events, editing, composition, clipboard, selection,
scrolling, and control activation inside HTML. CRC does not clone DOM events into
Canvas events or dispatch a second synthetic click. The overlay background and
clip wrappers have `pointer-events: none`; active content explicitly opts back
in. `pointerEvents: 'none'` makes the host inert as well as pointer-transparent,
matching CRC's exclusion from interaction/focus enrollment. Application CSS must
not override this disabled boundary.

Browser pointer capture remains authoritative. Existing Canvas capture can
continue across an HTML region and vice versa; no parallel DOM/Canvas capture
manager is introduced. Hover transitions across the boundary must clear stale
Canvas hover/cursor state through the native canvas exit path.

Without `FocusManagement`, controls use native focus and native DOM Tab order;
CRC does not install a navigation bridge or reorder descendants. Stable keyed
reorders can consequently differ from native DOM order in this mode.

With `FocusManagement`, the committed source-order index contains Canvas targets
and HTML regions. A region expands to its current eligible native Tab stops when
navigated. CRC logical focus identifies the region while browser focus identifies
the exact descendant. Focus ownership is within the CRC surface when either the
canvas or one of its live registered hosts contains browser focus.

### Navigation rules

| Action                               | Result                                                          |
| ------------------------------------ | --------------------------------------------------------------- |
| Forward entry into a region          | Focus its first eligible control.                               |
| Reverse entry into a region          | Focus its last eligible control.                                |
| Tab inside a region                  | Use native traversal until the region edge.                     |
| Tab at a region edge                 | Transfer to the next CRC candidate, respecting direction.       |
| Empty region                         | Skip it; no implicit DIV Tab stop.                              |
| Pointer focus or `element.focus()`   | Adopt the actual native descendant and its region.              |
| CRC directional navigation into HTML | Use the host box for scoring; enter its first eligible control. |
| Arrow, Enter, or Space inside HTML   | Native behavior; no CRC directional/activation default.         |
| Tab at the complete surface edge     | Exit to surrounding page order without wrapping.                |

Managed traversal supports ordinary light-DOM controls with default or zero Tab
indices, disabled/hidden/inert states, radio-group tab behavior, contenteditable,
and negative indices for programmatic-only focus. Compute eligibility at the
navigation boundary rather than retaining stale lists. Use a dedicated tested
tabbability implementation; `querySelectorAll('[tabindex]')` is not sufficient.
Positive `tabindex` is rejected inside managed hosts because it can escape the
surface's source-order policy. Applications should use source order.

Open/closed shadow-tree internals, iframe documents, and top-layer portals are
not part of the initial managed traversal guarantee. They can be mounted, but
applications requiring their custom focus behavior must use a root without
`FocusManagement` until an explicit focus adapter contract exists. Arbitrary DOM
mounting does not imply introspection into every native focus scope.

### Entry, exit, and cancellation

For a root using both HTML and focus management, install leading and trailing
native focus sentinels around the adjacent canvas/overlay pair. They provide
forward/reverse entry into the first/last eligible committed candidate even
when the last candidate is painted on the canvas. While this bridge owns native
entry, the canvas is programmatically focusable and omitted as an extra native
Tab stop. Restore its previous tabindex under existing mutation-ownership rules.

At a surface edge, after application key handlers have had the opportunity to
cancel, focus the outgoing sentinel under an internal exit guard and allow that
same Tab's browser default to move outside the pair. Entry sentinels redirect
only for genuine incoming focus, not this guarded exit. This algorithm requires
browser evidence for both directions; do not emulate exit by selecting an
arbitrary document-wide next focusable element. Sentinels are unnamed navigation
plumbing, have no interactive role, and never become a lasting focus destination.

Run boundary handling after native descendant handlers, honor `defaultPrevented`,
and intercept only Tab transitions CRC must coordinate. A widget that stops
propagation owns its keyboard behavior; it must allow boundary Tab to bubble if
it wants managed exit. Native browser editing defaults need not call
`preventDefault()` to suppress CRC arrow navigation: HTML is already a native
keyboard region.

Canvas-to-HTML transfer changes browser focus without triggering the old
unconditional logical clear. Track related targets/transfer tokens and settle
external blur after native focus has resolved. HTML-to-Canvas transfer restores
canvas browser focus and selects the intended Canvas target as one transition.
Movement between descendants of one host does not emit region blur/refocus.
Do not synthesize native focus events; observe the ones produced by the browser.

`onFocusChange` reports only changed region-level snapshots. Keyboard entry sets
focus-visible; pointer entry does not. Programmatic native focus uses
the current CRC modality for the region snapshot. Native controls retain their
own browser focus rings. This region snapshot is for optional Canvas decoration.

If a focused host is removed or deactivated, clear its logical focus and pending
activation before cleanup. Move browser focus to the canvas with no selected
target only if it still belongs to that host; preserve focus the application has
already moved elsewhere. The next Tab selects the next surviving candidate after
the removed source position (or exits); reverse Tab selects the previous one.
Disposing the whole root does not steal focus back into the disposed surface.

## Accessibility and bounded behavior

Mounted HTML retains native semantics, labels, form behavior, and accessibility
tree entries. The supplied DIV carries no blanket ARIA role or `aria-hidden`.
Native semantics do not make Canvas targets accessible. Authors remain
responsible for the combined experience and visible focus indication.

Visual clipping does not remove controls from the accessibility tree. Native
reading order follows DOM order, which may differ from CRC's managed source order
after keyed reordering. Preserve stable DOM identity in this version and document
that limitation; do not claim complete reading-order equivalence.

No promise is made for dialogs/popovers promoted to the browser top layer,
portals outside the host, browser-native popup surfaces, Canvas screenshot/export
including HTML, cross-document overlays, DOM intrinsic-to-CRC sizing, or
Canvas/HTML filter/blend equivalence.

## Delivery sequence and evidence

This design does not start implementation. When implementation is requested,
deliver one runnable slice before broad hardening.

1. Add a focused failing public-API browser test for a persistent input under a
   transformed `HtmlBox`/Group and one `PathGeometry` clip. Include Canvas targets
   before/after it, two native controls inside it, and Tab/Shift+Tab transfer.
2. Implement the minimum root overlay, host lifetime, world projection, portable
   clip, and focus bridge needed for that end-to-end contract. Keep unsupported
   combinations explicit until later slices.
3. Add a public Studio lesson with translate/rotate/scale controls, a curved clip,
   editable text, and Canvas controls on both sides of the HTML region. Provide
   the exact running URL and inspection steps as soon as focused checks pass.
4. After experiential feedback, harden cached Layers, nested clips, dynamic
   content, lifecycle, failures, and the full input/focus matrix below.

Proportional final evidence must cover:

- Matrix/geometry assertions for fit modes, density, padding, nested transforms,
  reflection, skew, zero scale, resize, and shared-ancestor page transforms.
- Nested clip intersection, both fill rules, curves/arcs, mutable path revisions,
  Layer bounds, root edges, and clear native-Path2D rejection.
- Clean Layer movement/clip changes without content update or remount; keyed
  reorder preserves input value, selection, node identity, and active element.
- Public pointer tests inside/outside clips, overlapping hosts, transparent
  overlay space, pointer capture, and disabled/inert boundaries.
- Forward/reverse surface entry and exit, mixed Canvas/HTML source order,
  cancellation, empty regions, radio groups, dynamic controls, native input
  arrows/IME/Enter/Space, programmatic focus, external blur, and focused removal.
- Ownership counters for shells, SVG definitions, listeners, sentinels, aborts,
  cleanup, render/mount/update failure, policy removal, and repeated disposal.
- Semantic evidence before narrow visual comparisons; Chromium is the repository
  gate, with Firefox/WebKit checks for clipping and Tab relay before claiming
  those engines supported. Include a manual screen-reader/keyboard pass for the
  documented semantics and reading-order limits.
- Public exports/declarations, Bundler/NodeNext packed consumers, source/built
  browser modes, Studio editor declarations, learning/test catalogs, and updated
  contracts. Run the aggregate trust gate only after feedback and hardening, in
  the documented Node 24 environment.

“Slice ready for feedback” means the demonstrated subset runs and focused checks
pass. “Feature complete” means the accepted contract above is documented and
verified. Neither milestone is achieved by this design document alone.

## Platform references

- [CSS Masking Level 1](https://www.w3.org/TR/css-masking-1/): clipping geometry,
  SVG clip references, and pointer behavior.
- [Path2D API](https://developer.mozilla.org/en-US/docs/Web/API/Path2D): native
  path construction/replay without a command-export API.
- [HTML inert](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert):
  native suppression of interaction/focus for inactive host subtrees.

These platform capabilities support the designed architecture. Exact browser
behavior at focus and clipping boundaries still requires the executable evidence
listed above; no implementation or compatibility result is claimed here.

## Native component event extension — 2026-10-02

The user extends the approved scope to direct HtmlBox event props, including
`onMouseMove` and `onPointerMove`, to drive Canvas effects beneath native HTML.
HtmlBox accepts the existing `CRCEventHandlers` names and capture variants through
`HtmlBoxEventHandlers`, a type mapping over the existing event vocabulary. Payloads
reuse the existing CRC event types. Coordinate-bearing events additionally expose
readonly `localX` and `localY`; no alternate event names or native redispatch API
is introduced.

`x`/`y` retain root Canvas-logical meaning. `localX`/`localY` use the HtmlBox border
box's untransformed top-left as (0, 0), before padding. The content DIV begins at
its resolved padding offset, so a point ten units into content with left padding
six has localX sixteen. The original DOM target's geometry, scroll offset and
native offsetX/offsetY never define this origin. Values are not clamped; native
pointer capture may report points outside the box. Native keyboard-generated
activation uses the browser's reported coordinates rather than inventing a center.

Conversion uses the browser's SVG screen matrix for the root overlay origin,
the committed root CSS projection, and the committed host world matrix. Invert
these affine mappings to obtain root and host coordinates, respectively. This
reuses CRC's geometry across nested Layers, viewport fits, backing density,
rotation, reflection, nonuniform scale and translation. A shared transformed CSS
ancestor and page scrolling are included by the browser screen matrix. No
bounding-rectangle subtraction or offsetX/offsetY approximation is used. 3D CSS
perspective remains outside the affine host contract. Invalid/singular projection
or inactive/suspended hosts do not dispatch component events.

Each native event is observed once at the host boundary. The CRC logical target
is the stable HtmlBox event target; `originalEvent.target` remains the actual
native descendant. The CRC path includes the ordinary listener ancestors across
Groups/layout/Layers. `onXCapture` runs root-to-host during native capture; native
descendant handlers then run; `onX` runs host-to-root when native bubbling reaches
the host. Descendant stopPropagation therefore suppresses CRC bubbling, while
capture observers have already run. Nonbubbling focus/blur are observed in capture
and deliver their host handler there after ancestor capture; they do not bubble to CRC ancestors.
Native mouseenter/leave and pointerenter/leave are observed only for the host
boundary, not repeated for transitions among its descendants. Native over/out
retain native descendant transitions. Document-only events (such as document
selectionchange) are not converted into HtmlBox events; element-targeted events
in the existing vocabulary are observed normally.

The normal CRC facade exposes target/currentTarget/composedPath and eventPhase,
with HtmlBox as the logical target even though the DOM leaf may be nested.
Handlers share one facade per native event and retain native bubbling flags,
including bubbling input/textarea selectionchange. Native defaultPrevented stays live
between capture and bubble. preventDefault and propagation methods affect that
same native event; no default is canceled automatically. Pointer/mouse native
compatibility sequences remain independent. No Canvas hit testing, Canvas
activation synthesis, focus default action or duplicate native dispatch runs for
HTML events. Existing native editing, selection, scrolling, IME and control
activation remain browser-owned. Native handlers may intentionally cancel them.

HtmlBox's public event target capture methods delegate to its native host DIV.
Native descendants can continue using their own DOM pointer capture unchanged.
CRC ancestor currentTarget remains that ancestor's existing logical target;
request native capture through the HtmlBox event.target or original native target,
not a Canvas ancestor. Related targets resolve to a mounted HtmlBox in the same
root, or null when outside those hosts. Observing events does not manufacture
Canvas hover or focus candidates for the HTML.

Each CRC capture or bubble phase batches synchronous signal writes. The capture
batch flushes before native descendants run; the bubble phase has its own batch.
This differs from Canvas dispatch, which can batch its entire logical path, and
avoids keeping a transaction open across native propagation that may be stopped.
Handler maps and inverse projections publish with the host's committed geometry.
Renders update callback closures without replacing the DOM or its event target.
Clean Layer replay reprojects using current outer placement while retaining its
last committed inner handlers. Host-owned listeners reconcile required native
types from its current CRC path, including ancestors, and are removed on abort,
removal, failure and root disposal. Event callbacks may write signals under the
same rules as other native event handlers.

The extension requires focused public browser evidence for transformed root/local
coordinates over nested DOM targets, padding, nested cached Layers, viewport fit,
density, updated handler identity, capture/bubble/cancellation order, native
controls and capture, and listener cleanup. The public HtmlBox lesson demonstrates
a pointer-driven Canvas effect behind a transformed host and the equivalent
mouse-move handler usage. The reviewer examines both this contract and the change.
