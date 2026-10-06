---
id: api-function-series-curves
title: Series curve definitions
summary: Explicit connection geometry with one immutable definition contract.
kind: api
slug: series-curves
apiCategory: function
symbols: [SeriesCurve, stepBefore, stepAfter, stepMidpoint, monotoneX]
---

# Series curve definitions

Import from `@pibbl/core/viz`:

- `monotoneX(): SeriesCurve`: smooth cubic connections preserving each adjacent pair's extrema.
- `stepBefore(): SeriesCurve`: jump to the next y at the preceding x, then travel horizontally.
- `stepAfter(): SeriesCurve`: hold the preceding y until the next x, then jump.
- `stepMidpoint(): SeriesCurve`: hold until the midpoint between x positions, jump, then hold the next y.

Each returns one immutable opaque definition with the same fixed contract. It
accepts no options and owns no resources. No generic family selector or custom
curve implementation API is exposed. Pass a definition as `curve` on LineSeries,
AreaSeries, or IntervalBandSeries. Omission and `curve="linear"` preserve straight
segments. Definitions are ordinary values; read a signal in the component to
select a definition reactively. A signal is not itself a curve definition.
Forged objects and unknown strings throw TypeError, including for empty data.

Algorithms operate on mapped local coordinates and preserve source order,
observed endpoints, missing runs, transforms, and clipping. Step definitions also
preserve duplicate x values.
Before/after refer to traversal order even for descending x. Midpoint means
halfway in mapped coordinates (so it is a geometric midpoint on nonlinear scales).
An interval's two boundaries use the same jump positions; reversing its lower
outline does not reverse the chosen transition policy. Step strategies cannot
invent intermediate extrema or invert an ordered interval.

A vertical jump contains both adjacent y values geometrically. Inspection in
these demos selects an original observation (nearest x; ties follow source order),
not a value inferred from the jump. `interpolateX` remains a linear data estimate;
it does not silently acquire the displayed curve's semantics. No added point
is claimed to be a measurement. Use ordinary observed-data inspection unless
an application explicitly defines a different estimate.

The [policy-rate steps example](#/examples/composition/viz-policy-steps) uses real
Federal Reserve target ranges. Only stepAfter represents policy held until the
next effective date; other choices visibly demonstrate geometry, not historical
policy paths. Date positions have day precision, not intraday timing.

## Monotone x

`monotoneX()` requires strictly ascending or strictly descending mapped x within
each finite run. Duplicate x or a change in direction throws RangeError; data is
never sorted. A collapsed x range is therefore invalid for a multi-point run.
Flat y intervals stay flat and local extrema have zero slope. With nonlinear
scales, the smooth shape is defined in mapped coordinates. No smoothing crosses
a missing-value gap.

Interval bands validate the difference between generated cubic boundaries at
endpoints and all interior derivative roots. If smooth boundaries cross, the band
throws RangeError rather than silently drawing an inverted interval. Comparison
uses a 64-machine-epsilon tolerance relative to the segment's largest boundary
difference control, solely for floating-point tangency error; geometry is not adjusted. Use linear
or step connections for data whose independent smooth bounds cross.

The [monthly CO₂ example](#/examples/composition/viz-monotone-climate) compares
linear and monotone line/area geometry with observed-value inspection. Smoothing
does not create measurements, estimates of uncertainty, or new query semantics.
