---
id: api-numeric-ticks
title: Numeric ticks and formatting
summary: Readable linear ticks, explicit domain nicening, and number formatting without changing data geometry.
kind: api
slug: numeric-ticks
apiCategory: component
symbols:
  [
    linearTicks,
    niceLinearDomain,
    formatNumber,
    LinearTickOptions,
    NumberFormatOptions,
  ]
---

# Numeric ticks and formatting

Import these pure helpers from `@pibbl/core/viz`. They accept ordinary values,
not signals. Read a signal with `.get()` inside a component or computed value to
reactively recompute. They create no subscriptions or resources themselves.

## Readable ticks

`linearTicks(domain: NumericDomain, options?: LinearTickOptions): readonly number[]`
returns frozen ticks at 1, 2, or 5 times a power of ten. `count` defaults to 5
and requests approximate intervals, not an exact output length. Output is capped at 100 ticks by increasing the
readable step when necessary. Only aligned
values within the domain are emitted, in domain order. Negative zero becomes
zero. The domain and scale mapping are unchanged; endpoints need not be ticks.
Existing `useLinearScale(id).get().ticks(count)` retains its evenly spaced,
endpoint-inclusive contract.

`niceLinearDomain(domain: NumericDomain, options?: LinearTickOptions): NumericDomain`
returns frozen endpoints expanded outward to these readable boundaries,
preserving ascending or descending direction. Pass the result explicitly to
`LinearScale`; axes never silently expand a domain.

Both helpers require two distinct finite endpoints with a finite span and an
integer `count` from 2 to 100. Invalid input, unrepresentable tick spacing, or
non-finite expanded bounds throws `RangeError`. Neither mutates its input.

## Number and unit formatting

`formatNumber(value: number, options?: NumberFormatOptions): string` uses
`Intl.NumberFormat`. `locale` defaults to `"en-US"`. `prefix` and `suffix`
default to empty strings and are literal (include any desired space).
All other options are standard `Intl.NumberFormatOptions`, including fraction
precision, significant digits, currency, percent, compact notation, and units.
Default decimal precision is at most three fractional digits. Rounded negative
zero displays as positive zero. Non-finite values throw `RangeError`; invalid
locale or Intl options retain the native Intl error. Results follow the host's
Intl locale data. No locale or unit is inferred from the data.

## Minimal runnable composition

The editable [minimal numeric demo](#/examples/composition/viz-numeric-axis)
and [NOAA example](#/examples/composition/viz-utc-climate) uses these
helpers with height-dependent tick density and label collision handling.
This complete mount demonstrates every helper:

```tsx
import { Group, pibbl } from "@pibbl/core";
import {
  Axis,
  LinearScale,
  linearTicks,
  niceLinearDomain,
  formatNumber,
} from "@pibbl/core/viz";

export default function mount(canvas: HTMLCanvasElement) {
  const domain = niceLinearDomain([0.13, 0.97]);
  return pibbl(
    canvas,
    <Group style={{ translateX: 24, translateY: 24 }}>
      <LinearScale id="value" domain={domain} range={[0, 240]}>
        <Axis
          scale="value"
          position="top"
          tickValues={linearTicks(domain)}
          labelOverlap="skip"
          tickFormat={(value) =>
            formatNumber(Number(value), {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
              suffix: " ppm",
            })
          }
        />
      </LinearScale>
    </Group>,
  );
}
```

Layout belongs to the composition: leave gutters for labels and units. Use
`labelOverlap="skip"` to omit crowded labels while preserving every tick mark.
