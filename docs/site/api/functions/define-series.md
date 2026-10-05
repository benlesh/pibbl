---
id: api-function-define-series
title: defineSeries
summary: Describes a dataset without acquiring observers or resources.
kind: api
slug: define-series
apiCategory: function
symbols: [defineSeries, HoverSeries, HoverSeriesMap]
---

# defineSeries

Import from `@pibbl/core/viz`. Describes a dataset without acquiring observers or resources.

`data` accepts a readonly array or signal; `x`, `y`, and optional `defined` describe eligibility without invoking renderers. No subscription or scan occurs when constructing a descriptor or query.
