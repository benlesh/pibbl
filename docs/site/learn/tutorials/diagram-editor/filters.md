---
id: tutorial-diagram-editor-filters
title: Polish selection with filters
summary: Filter one selected card as a combined silhouette without enlarging its target.
kind: tutorial
slug: filters
tutorial: diagram-editor
order: 10
keywords: [diagram editor, tutorial, filter, drop shadow, composition]
exampleSlug: diagram-editor-filters
---

# Polish selection with filters

## What you will make

Give the selected card one coherent typed drop shadow while keeping every card’s original click and focus geometry.

## How it works

Put the filter value on the card’s outer `Group`, not on its individual rectangles or labels. A nonempty filter captures that Group and all of its recursive output as one combined silhouette, so the body, text, and ports share one shadow. Nested filter boundaries resolve inside out; an ordered filter list runs forward in the order you declare it.

An empty `[]` means the unselected card remains on CRC’s direct path. It needs no filter capability. A nonempty list needs browser `OffscreenCanvas` and native Canvas `filter` support. Filter output changes pixels only: it does not enlarge layout, measurement, cursor, hit testing, focus bounds, or navigation geometry.

## Build the change

Use one typed filter value at the card boundary and keep the direct path explicit for every other card.

```tsx
import { dropShadow } from "@crc/core/filters";

<Group
  style={{
    translateX: node.x,
    translateY: node.y,
    filter: selected
      ? dropShadow({
          offsetX: 6,
          offsetY: 8,
          blurRadius: 10,
          color: "rgb(23 33 29 / 35%)",
        })
      : [],
  }}
>
  {cardPaint}
</Group>;
```

The [filter type reference](#/api/types/filters) lists every supported typed filter value and its validation rules. [Style and draw](#/learn/guides/style-and-draw) explains the complete local composition model.

## Predict and try

Import `brightness` and `dropShadow` from `@crc/core/filters`, and `type CRCFilter`
from `@crc/core`. Use these filter values for the selected branch:

```tsx
const bright = brightness({ amount: 1.08 });
const shadow = dropShadow({
  offsetX: 6,
  offsetY: 8,
  blurRadius: 10,
  color: "rgb(23 33 29 / 35%)",
});
const selectedFilters: readonly CRCFilter[] = [bright, shadow];

<Group
  style={{
    translateX: node.x,
    translateY: node.y,
    filter: selected ? selectedFilters : [],
  }}
>
  {cardPaint}
</Group>;
```

Run it once, then reverse the array to `[shadow, bright]`. Predict the difference: the two operations receive different inputs, so brightness-before-shadow and shadow-before-brightness do not produce the same pixels.

## Check your result

Sketch begins selected and receives one shadow around its complete card. Click empty workspace and the next frame takes the unfiltered direct path. Select Idea, then click only in its visible right-hand shadow: the workspace clears selection because shadow-only pixels are not card geometry. Select Sketch again and its filter moves with the same unchanged card bounds.

## What you learned

Filters compose one receiver subtree, run ordered filters in a native Canvas operation, and remain strictly visual. `[]` is a useful capability-free direct-path declaration; nonempty filters require the browser features documented by [Filter types](#/api/types/filters).
