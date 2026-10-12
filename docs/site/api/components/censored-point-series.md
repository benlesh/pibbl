---
id: api-component-censored-point-series
title: Censored point series
summary: Draw observed numeric points and supplied below/above reporting limits.
kind: api
slug: censored-point-series
apiCategory: component
symbols:
  [
    CensoredPointSeries,
    CensoredPointSeriesProps,
    CensoredPointSeriesStyle,
    CensoringStatus,
    CensoringAccessor,
  ]
---

# Censored point series

`CensoredPointSeries` draws supplied numerical observations as circles and
reporting limits as open directional markers. It is designed for assay and
laboratory datasets where a result may be reported as below an LLOQ or above a
ULOQ without inventing an exact measurement.

```tsx
import { Absolute } from "@pibbl/core";
import { CensoredPointSeries, LinearScale, LogScale } from "@pibbl/core/viz";

const samples = [
  { hour: 0.25, concentration: 0.5, reporting: "below" as const },
  { hour: 2, concentration: 12.8, reporting: "observed" as const },
  { hour: 24, concentration: 50, reporting: "above" as const },
];

<Absolute style={{ left: 64, top: 32, width: 600, height: 320 }}>
  <LinearScale id="time" domain={[0, 24]} range={[0, 600]}>
    <LogScale id="concentration" domain={[0.25, 100]} range={[320, 0]}>
      <CensoredPointSeries
        data={samples}
        x="hour"
        y="concentration"
        censoring="reporting"
        xScale="time"
        yScale="concentration"
      />
    </LogScale>
  </LinearScale>
</Absolute>;
```

Required inputs are `data`, `x`, `y`, `censoring`, `xScale`, and `yScale`.
`x` and `y` are numeric property keys or synchronous accessors. `censoring`
is a property key or callback returning one of `"observed"`, `"below"`, or
`"above"`. Both scales are ancestor continuous scales: linear, UTC, log, or
symlog.

For `below` and `above`, the supplied `y` is the laboratory reporting limit,
not a replacement observation. `below` points toward decreasing y-domain values;
`above` points toward increasing y-domain values. Direction stays semantically
correct for reversed ranges and reversed domains. The component performs no
imputation, substitution, model fitting, or inference.

Rows with a nullish/non-finite coordinate or status are omitted. Unknown
non-null statuses throw. A log scale rejects nonpositive reporting limits under
its normal scale contract. `defined` runs before the accessors and can exclude a
row. Accessors cannot call hooks or write signals during rendering.

`style` accepts a whole-object signal and shallow field signals. `radius`
defaults to 4 pixels, `fill` (observed circles only) and `stroke` default to
`#087f8c`, `strokeWidth` defaults to 1.5 pixels, and `opacity` defaults to 1.
The censor markers are always open. Zero radius hides all marks. Records retain
source paint order and use two ordinary batched `Path` targets. Series event
handlers receive ordinary bubbled mark events; they do not infer a datum.

The [censored concentration-time assay](#/examples/composition/viz-censored-assay)
shows synthetic LLOQ and ULOQ results with an application-owned accessible table.
