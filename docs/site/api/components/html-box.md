---
id: api-component-html-box
title: HtmlBox
summary: Mounts persistent native HTML in a transformed, clipped CRC box.
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

`HtmlBox` allocates a native HTML DIV above the canvas. CRC owns its placement,
affine transforms, inherited `PathGeometry` clips, and mounted identity. The
browser owns its content, editing, semantics, and native events.

```tsx
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
/>
```

Mount runs once after attaching the DIV. The returned function receives subsequent
rendered data; the initial data is not delivered twice. The supplied AbortSignal
aborts once before removal, including mount/update failure. Use an abort listener
to disconnect observers or unmount an embedded framework. Mount and update must
be synchronous. Native input handlers can write CRC signals; lifecycle callbacks
cannot.

Configure the initial `crc` call with `htmlOverlay`, an empty HTML sibling
immediately after the canvas inside a shared positioned wrapper. Both must occupy
the same content rectangle with no border, padding, or independent CSS transform.
Apply page transforms to the wrapper. The runtime does not reparent the canvas.
See the [copyable HTML Box example](#/examples/composition/html-box) for setup and
cleanup.

`style` accepts CRC box sizing, padding, layout participation, Group transforms,
opacity, and overflow (default `clip`). HTML does not determine CRC intrinsic
sizes. `pointerEvents="none"` disables the host's pointer and focus participation.
A changed `key` replaces the mounted content; an inline mount callback changing
identity does not.

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
[HtmlMountCallback](#/api/types/html-box#htmlmountcallback),
[HtmlUpdateFunction](#/api/types/html-box#htmlupdatefunction), and
[HtmlBoxFocusState](#/api/types/html-box#htmlboxfocusstate), and
[HtmlBoxEventHandlers](#/api/types/html-box#htmlboxeventhandlers).

## Native component events

Use the same event names as Canvas components:

```tsx
<HtmlBox
  mount={mountEditor}
  data={title}
  style={{ width: 340, height: 190, padding: 12, rotationDegrees: 15 }}
  onPointerMove={(event) => {
    effectPosition.set({ x: event.x, y: event.y });
    localPosition.set({ x: event.localX, y: event.localY });
  }}
/>
```

`onMouseMove` provides the same coordinate fields for the native mouse sequence.
Choose the pointer or mouse callback for your effect; installing both observes
both native streams. See [HtmlBoxEventHandlers](#/api/types/html-box).

The local origin is the untransformed border-box top-left, before padding. A point
10 units inside content with 12 units of left padding reports `localX = 22`.
`x/y` are root Canvas-logical, so a Canvas effect drawn at that position follows the
native pointer through rotation, scaling, Layers and viewport fitting. Browser
`offsetX/offsetY` remain native-target-relative and should not be used for this.

CRC ancestor capture handlers run before native descendants; host and ancestor
bubble handlers run after descendants. Native stopPropagation can prevent that
bubble phase. `preventDefault()` cancels the actual native event only when you
request it. HtmlBox does not synthesize Canvas clicks, suppress native selection,
or run Canvas keyboard activation for native controls. Nonbubbling events keep
ancestor capture and host handlers, with no ancestor bubble. Native event flags
are retained, including bubbling input/textarea selectionchange; document-only
selectionchange is not assigned to a host. Enter/leave observe the host boundary;
over/out still reflect native descendant transitions.

`event.target` identifies the HtmlBox in CRC's event path; the original native
leaf is `event.originalEvent.target`. Use `event.target.setPointerCapture(id)`
for the host's native capture, or capture directly on your own native control.
An ancestor `currentTarget` still represents the Canvas ancestor, so it cannot
request native host capture. Handlers refresh without remounting the HTML, and
listeners are removed with the host lifecycle.
