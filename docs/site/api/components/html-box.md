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
  ]
---

# HtmlBox

`HtmlBox` allocates a native HTML DIV above the canvas. CRC owns its placement,
affine transforms, inherited `PathGeometry` clips, and mounted identity. The
browser owns its content, editing, semantics, and native events.

```tsx
import { HtmlBox } from "@crc/core";

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
[HtmlBoxFocusState](#/api/types/html-box#htmlboxfocusstate).
