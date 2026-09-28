# @crc/viz

Official composable Canvas visualization for CRC, with no visualization runtime
dependency. Use the matching `@crc/core` version and its JSX runtime.

- `Scale`: nested ID-based linear scales driven by core signals and local layout.
- `useScale`: read the nearest scale as a readonly core signal.
- `Axis`: bottom and left ticks/labels in the local frame.
- `LineSeries`: one batched path with key/function accessors and missing-data gaps.
- `ScaleAdjust`: translate ordinary CRC children by scale coordinates.

There is no monolithic Chart component. Applications compose layout, gutters,
clipping, markers, legends, and interaction using normal CRC components/events.

See the [guide](../../docs/site/learn/guides/data-visualization.md) and the
[interactive example](http://localhost:5173/#/examples/composition/viz-responsive-line).
Current scope is linear numeric scales and linear curves. Additional series,
calendar scales, curve families, and the example's mobile presentation are deferred.
