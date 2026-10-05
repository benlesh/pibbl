---
id: api-component-hover-data
title: HoverData
summary: Evaluates an ordinary synchronous query and renders its typed result.
kind: api
slug: hover-data
apiCategory: component
symbols: [HoverData, HoverDataProps, HoverQuery, HoverQueryContext]
---

# HoverData

Import from `@pibbl/core/viz`. Evaluates an ordinary synchronous query and renders its typed result.

`query(context)` reads current signals and `context.scale(id)` snapshots. Its synchronous result (including undefined) goes to `children(result)`. Callbacks cannot call hooks or write signals; return components for hooks. Query function identity does not determine child identity. The context cannot be retained.
