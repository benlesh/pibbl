---
id: api-function-closest-x
title: closestX
summary: Creates a query for the recorded observation nearest a domain x value.
kind: api
slug: closest-x
apiCategory: function
symbols: [closestX, ClosestXOptions, ClosestXHit]
---

# closestX

Import from `@crc/viz`. Creates a query for the recorded observation nearest a domain x value.

`closestX({series,x,xScale,yScale,maxDelta?})` returns a function for HoverData. The x input is a domain number or null, plain or signal. It ignores cursor y, accepts unsorted data, and returns the original datum/index, domain x/y, mapped anchor, and delta. Inclusive maxDelta is in domain units; earliest source row wins ties.
