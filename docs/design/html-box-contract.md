# HtmlBox contract

Status: implemented 2026-10-02; final verification and independent review are
recorded in [Plan 004](../project-plans/004-html-box.md).

`HtmlBox` is a native HTML boundary in a Pibbl allocation. It has no Canvas pixels
or synthetic click target. All HTML hosts are above Canvas paint; hosts stack in
Pibbl source order. Native semantics apply to mounted HTML, not to other Canvas
content. Supported authoring is JSX or `createElement` through `@pibbl/core`.

## Authoring and lifetime

The mount-only `PibblConfig.htmlOverlay` is a dedicated empty HTML element directly
after the canvas in the same connected parent/document. The application owns
this shared positioned wrapper and matching overlay/content rectangles. Canvas
and overlay have no border, padding, or independent CSS transforms. They inherit
common-ancestor page transforms. Pibbl owns only its inserted host/clip/focus nodes
and reserves the overlay for one live root. Offscreen roots cannot host HTML.

`HtmlMountCallback<Props>(element, initialProps, signal)` runs once with a connected
DIV and a fresh native AbortSignal; it returns `HtmlUpdateFunction<Props>`. It
must return synchronously. The updater receives subsequent successful component
renders; the initial props are not repeated. `data` is opaque, including a signal
passed directly. Use `.get()` to subscribe the component. An inline mount function
changing identity does not replace the host; change `key` to remount it.

Pibbl aborts the signal once before removing the DIV on removal, root disposal,
failed mount/invalid return, or later update failure. Register DOM listeners using
`{ signal }` and other resource cleanup with an abort event listener. Abort event
errors follow native browser reporting; cleanup continues and does not depend on
synchronously catching them through abort(). Lifecycle callbacks and synchronous
abort cleanup cannot write Pibbl signals. Native input and focus notification
handlers may schedule Pibbl work.

## Geometry and presentation

Layout uses existing box/layout fields and Group-order affine transforms.
Existing Pibbl box sizing applies: explicit content width/height plus padding form
the border box. The supplied DIV occupies the resolved content rectangle. DOM
content does not feed intrinsic sizes back into Pibbl. Overflow defaults to clip.

Projection is inverse effective backing density multiplied by root surface
projection and world geometry. CSS matrices retain fractional translation,
rotation, skew, reflection and nonuniform scale. Device pixel ratio is not a CSS
scale. Zero/singular geometry deactivates a persistent host rather than remounting
it. Root zero-size suspension retains content until a usable surface returns.

Each explicit PathGeometry clip retains an immutable revision-matched SVG snapshot
beside its Canvas path. Layout and Layer bounds provide portable rectangles.
SVG clipPath references intersect ancestor clips in host-local user-space
coordinates; changing clip depth does not reparent content. A raw Path2D ancestor
clip is rejected only when HTML requires projection. Mutations require a normal
Pibbl render request before refreshed geometry is published.

Opacity affects HTML as its own group. Canvas filters and non-default composition
enclosing HTML are rejected; CSS effects within HTML remain native. Raw custom
Canvas clips unregistered with Pibbl are unsupported. Canvas and HTML do not form a
shared filter/blend silhouette, and Canvas screenshots do not include HTML.

## Scheduling and caches

Render collects candidate registrations. Root publication precedes transaction
finish callbacks that commit focus metadata: in scheduled rendering this is the
start of Complete, while direct private renders finish synchronously. No extra
frame loop is created. Application callbacks cannot publish partially rendered
HTML focus candidates. Publication failure clears affected HTML, reports through
the scheduler, and leaves other roots able to finish.

Layers retain instance-local HTML records and compose their current outer
placement/clips/bounds. A clean cache hit reprojects the DOM without invoking its
mount or updater. Keyed reorders preserve DOM identity and source-order stacking.
DOM/accessibility reading order is intentionally not rearranged by keyed reorder.

## Native input and focus

The overlay background is pointer-transparent. Active content receives native
input. `pointerEvents="none"` makes that host inert and removes pointer/focus
participation. Native pointer capture and native editing/composition/clipboard
behavior are preserved; Pibbl does not synthesize duplicate HTML activation.

Without FocusManagement, native browser focus order applies. With the existing
single focus manager, HTML regions and Canvas targets share source-order
navigation. Tab enters the first eligible native control, reverse Tab the last;
internal native traversal stays native, and region boundaries transfer to the
next Pibbl candidate. Entry/exit sentinels provide one-key movement into/out of the
whole surface. Native descendants' focus() calls synchronize region ownership.

Directional navigation scores the host rectangle on entry. Inside HTML, arrows,
Enter, and Space retain native behavior. Region-level onFocusChange snapshots
report focus-within/modality; native controls retain their own browser focus
rings. Cancellation of boundary Tab by native handlers is respected.

Managed traversal supports ordinary light DOM, disabled fieldsets, radios,
details/summary, inert/hidden controls, contenteditable, and nonpositive tabindex.
Positive tabindex is incompatible with managed source order. Shadow/iframe
internals, top-layer portals and dialogs are outside the initial managed-focus
contract. Clipping alone does not remove descendants from keyboard navigation or
the accessibility tree. Authors must disable or hide ineligible controls.

## Evidence

- `packages/core/test/html-box.test.tsx`: public mounting, update identity, abort.
- `packages/core/test/html-box-layers.test.tsx`: projection, nested clipping, Layers,
  failure cleanup, public authoring, and the shared Studio lesson.
- `packages/core/test/html-box-focus.test.tsx`: mixed native/Canvas navigation,
  native editing/activation, dynamic eligibility and keyed/cached behavior.
- Existing focus, signal/scheduler, Layer, layout, package and Studio checks remain
  required regressions. See [field notes](../testing/field-notes/html-box.md) for
  fresh execution evidence rather than inferring success from this contract.
