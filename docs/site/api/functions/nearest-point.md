---
id: api-function-nearest-point
title: nearestPoint
summary: Finds the nearest mapped data anchor in a local plot frame.
kind: api
slug: nearest-point
apiCategory: function
symbols: [nearestPoint, NearestPoint, NearestPointOptions]
---

# nearestPoint

Import from `@pibbl/core/viz`. Call `nearestPoint(data, {x,y}, options)` with numeric
x/y accessors, resolved `xScale`/`yScale` snapshots, optional `defined`, and an
optional inclusive nonnegative `maxDistance`. Returns `{datum,index,x,y,distance}`
or undefined. Returned coordinates are mapped local positions; datum is the
original reference and index is the original source index.

An unsorted O(n) scan minimizes Euclidean distance, choosing the earliest row
on exact ties. Invalid coordinates skip rows. It does not call a renderer or
inspect custom shapes, radius, opacity, or clips. A custom renderer returning
null does not exclude that datum. Invalid query values or arithmetic overflow
throw. The helper owns no signal observers, scheduler work, or retained index.

Pibbl events expose root-logical coordinates. Convert them to the shared local
scale frame first (subtract the plot origin for a translation-only plot).
Nonuniform transforms can make local nearest differ from screen-space nearest.
Use matching data/scale snapshots from the displayed render for inspection.
