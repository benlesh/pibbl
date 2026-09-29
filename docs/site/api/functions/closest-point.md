---
id: api-function-closest-point
title: closestPoint
summary: Creates a function selecting the closest mapped observation across named series.
kind: api
slug: closest-point
apiCategory: function
symbols:
  [closestPoint, ClosestPointHit, ClosestPointOptions, HoverHit, HoverPoint]
---

# closestPoint

Import from `@crc/viz`. Creates a function selecting the closest mapped observation across named series.

`data` accepts a readonly array or signal; `x`, `y`, and optional `defined` describe eligibility without invoking renderers. No subscription or scan occurs when constructing a descriptor or query.
`position` is a local point or null (plain or signal), `xScale`/`yScale` name providers, and `series` is a record of descriptors. Optional inclusive `maxDistance` uses local pixels. Ties follow record key then source order. Result includes original datum/index, series key, domain x/y, mapped anchor, and distance. Empty/null inspection returns undefined.
