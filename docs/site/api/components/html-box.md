---
id: api-component-html-box
title: HtmlBox
summary: Mounts persistent native HTML in a transformed, clipped Pibbl box.
kind: api
slug: html-box
apiCategory: component
symbols: [HtmlBox]
relatedTypes:
  [
    HtmlBoxProps,
    HtmlBoxStyle,
    HtmlMountCallback,
    HtmlUpdateFunction,
    HtmlBoxFocusState,
    HtmlBoxEventHandlers,
  ]
---

# HtmlBox

`HtmlBox` allocates a native HTML DIV above the canvas. Pibbl owns its placement,
affine transforms, inherited `PathGeometry` clips, and mounted identity. The
browser owns its content, editing, semantics, and native events.

```tsx
import { HtmlBox } from "@pibbl/core";

<HtmlBox
  data="Name"
  style={{ width: 240, height: 80 }}
  mount={(element, label, signal) => {
    const input = document.createElement("input");
    input.setAttribute("aria-label", label);
    element.append(input);
    input.addEventListener("input", () => console.log(input.value), { signal });
    return (nextLabel) => input.setAttribute("aria-label", nextLabel);
  }}
/>;
```

Mount runs once after attaching the DIV. The returned function receives subsequent
rendered data; the initial data is not delivered twice. The supplied AbortSignal
aborts once before removal, including mount/update failure. Use an abort listener
to disconnect observers or unmount an embedded framework. Mount and update must
be synchronous. Native input handlers can write Pibbl signals; lifecycle callbacks
cannot.

Configure the initial `pibbl` call with `htmlOverlay`, an empty HTML sibling
immediately after the canvas inside a shared positioned wrapper. Both must occupy
the same content rectangle with no border, padding, or independent CSS transform.
Apply page transforms to the wrapper. The runtime does not reparent the canvas.
See the [copyable HTML Box example](#/examples/composition/html-box) for setup and
cleanup.

`style` accepts Pibbl box sizing, padding, layout participation, Group transforms,
opacity, and overflow (default `clip`). HTML does not determine Pibbl intrinsic
sizes. `pointerEvents="none"` disables the host's pointer and focus participation.
A changed `key` replaces the mounted content; an inline mount callback changing
identity does not.

Native event props such as `onInput`, `onPointerMove`, and `onClickCapture` use the
existing Pibbl event names. Capture runs through Pibbl ancestors and the HtmlBox,
then native descendant handlers run, followed by HtmlBox and ancestor bubbling.
Cancellation remains native. `event.originalEvent.target` is the real DOM target;
`event.target` is the logical HtmlBox. Pointer capture on that target uses the
native HTML content host. Non-bubbling events do not bubble to Pibbl ancestors.

Coordinate events supply root-logical `x`/`y` plus `localX`/`localY` measured from
the HtmlBox border origin, before padding. They account for root fit, backing
density, Layers and shared CSS transforms. Handlers and coordinates adopt together
after successful HTML callbacks. Events fired during mount cannot activate the new
host; events fired during update still use the previous committed generation.

```tsx
<HtmlBox
  data="Name"
  mount={(host, label) => {
    const input = document.createElement("input");
    input.setAttribute("aria-label", label);
    host.append(input);
    return (next) => input.setAttribute("aria-label", next);
  }}
  style={{ width: 240, height: 80, padding: 8 }}
  onInput={(event) => console.log(event.originalEvent.target)}
  onPointerMove={(event) => console.log(event.localX, event.localY)}
/>
```

The [HTML Box example](#/examples/composition/html-box) combines native editing
with `Manipulable` dragging, resizing and rotation. Its native controls stop the
pointer-down event so editing does not start a drag; empty panel space bubbles
through the same Pibbl ancestor handlers.

With `FocusManagement`, native controls enter the source-order navigation between
Canvas targets. Native text editing and activation stay native. Without it, the
browser's DOM order applies. Use ordinary descendant `.focus()` for programmatic
focus and `onFocusChange` for region focus-within state.

HTML stays above all Canvas paint. Canvas filters and non-default compositing
cannot enclose HTML. Native `Path2D` ancestor clips must be replaced by
`PathGeometry`; curves and fill rules retain their geometry, with browser-specific
edge antialiasing. Clipping does not remove controls from keyboard navigation.
Managed focus initially supports ordinary light DOM with nonpositive tabindex;
shadow/iframe internals and top-layer portals are outside that guarantee. Canvas
screenshots do not include HTML. Keyed reorder preserves nodes but does not reorder
native accessibility reading order.

Type reference: [HtmlBoxProps](#/api/types/html-box#htmlboxprops),
[HtmlBoxStyle](#/api/types/html-box#htmlboxstyle),
[HtmlBoxEventHandlers](#/api/types/html-box#htmlboxeventhandlers),
[HtmlMountCallback](#/api/types/html-box#htmlmountcallback),
[HtmlUpdateFunction](#/api/types/html-box#htmlupdatefunction), and
[HtmlBoxFocusState](#/api/types/html-box#htmlboxfocusstate).
