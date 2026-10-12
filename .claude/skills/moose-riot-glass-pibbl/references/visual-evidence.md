# Visual evidence

Moose Riot's premise is Observable Complexity: hidden structure is always there, and the
instrument reveals it. **Visualizations are brand material, not garnish.** A surface that
states a verdict without showing the shape it came from has not revealed anything — it has
asked to be trusted.

This is the reference that keeps the design language from becoming decoration. Read it for
any screen whose job is monitoring, comparison, diagnosis or a decision backed by data.

## Show the shape, not just the verdict

A decision anchor **organizes** evidence; it does not replace it. When the person's job
includes understanding _what is happening_, the picture that shows it is not supporting
material to be compressed away — it is the primary evidence, and it frequently earns focal
status over the headline.

The failure mode to watch for, because it is seductive: a beautifully composed card that
names a diagnosis in confident prose, with three summary numbers beneath it, and no view of
the data over time. It looks decisive and resolves nothing. The reader cannot tell whether
the problem is a spike or a sustained shift, when it started, whether it is recovering, or
whether the named cause actually lines up with the break.

Concretely, prefer to keep:

- **One view with a time axis** when anything changed, with the change annotated where it
  happened. "It broke at 14:16 and has not recovered" is a shape, not a sentence.
- **Per-item trend** when items are being compared — a small sparkline per row carries a
  surprising amount of signal for its footprint.
- **The causal metrics**, not just the outcome metrics. `cache hit 94% → 61%`,
  `replicas 6/8`, `queue depth 41 (was 3)` explain the verdict. `p99 1 840 ms` restates it.
- **System context** when a local decision could be wrong in a wider frame.

Compress repetition, chrome and padding before compressing evidence. If something has to
go, drop the third restatement of a total — never the only view of the shape.

## Question, then evidence shape, then chart

Choose from the question, not from the catalog. Each row names what the data must actually
contain; if you do not have it, the honest move is to show that you do not.

| Question                           | Useful direction                      | Evidence required                                                         |
| ---------------------------------- | ------------------------------------- | ------------------------------------------------------------------------- |
| What changed over time?            | Annotated line, with the event marked | Real ordered observations. Never generate history by scaling an endpoint. |
| How far from target?               | Bullet, waterfall                     | Actual and target; explicit additive steps for a waterfall                |
| Where is work stuck?               | Stage duration, heatmap               | Named cohorts with actual per-stage durations or counts                   |
| Which category deserves attention? | Bar, funnel, dumbbell                 | Same units and cohort; stage denominators, or comparable before/after     |
| Which pairing deserves action?     | Heatmap                               | Explicit aligned cell states, with unknown handled before render          |
| Which items are covered?           | Labelled coverage matrix              | Exact item and explicit state per cell                                    |
| How is it distributed?             | Histogram, band, dot strip            | The distribution itself, not a mean standing in for it                    |

Supporting views answer _different_ questions. A KPI, a donut and a line all restating one
total is three spends of attention for one fact. A chart's visual complexity has to be
justified by its evidence, not by a desire to fill the space.

## Building it with @pibbl/core/viz

`@pibbl/core/viz` is the official allocation-relative visualization package, and it is the right
default for charts in Pibbl. Public surface:

`LinearScale`, `useLinearScale`, `ScaleAdjust`, `Axis`, `LineSeries`, `BarSeries`, `PointSeries`,
`PlotSeries`, `defineSeries`, `PieLayout`, `pieSlices`, `AnchoredLayout`, `HoverCard`,
`HoverData`, `nearestDomainValue`.

`LinearScale` calls `useLayoutBox()`, so it sits under a layout parent such as `Absolute`. The
learn guide at `docs/site/learn/guides/data-visualization.md` covers records, custom marks,
function-based hover queries, cards that protect the inspected point, categorical
comparison and coordinated pie labels — read the relevant section before inventing marks by
hand.

Hand-drawn `Rectangle` bars are fine for a small track, a budget meter or a sparkline, and
they keep full control of role colour. Reach for `@pibbl/core/viz` as soon as you need axes,
scales, hover inspection or a shared coordinate space — reimplementing those by hand is how
a chart ends up subtly lying about its own scale.

## Colour in a chart

Role hue is the whole vocabulary: observation, healthy, uncertain, anomaly, model, inert.
Use the **fill** grades from `tokens.md` for marks and the **text** grades for labels, and
remember that the step is yours to choose per mode — full-chroma lime on a paper-white
field is nearly invisible, so a darker step of the same hue is correct, not a deviation.

Each visual channel gets one meaning. If colour names a scenario, it keeps naming that
scenario when the period changes. If it shows attainment, label that meaning explicitly.
Distinguishable categorical series that carry no health meaning live in the instrument hues
— observation, model, neutral — so lime, amber and coral stay reserved for state.

A threshold, budget or objective belongs _in_ the picture as a rule or a tick, not only in
a caption beside it. That is what turns a number into a judgement the reader can make.

## Unknown is a shape too

Missing evidence is the state most likely to be rendered as a lie. A gap is not a zero, a
stale read is not a current one, and an unsampled window is not healthy.

- For path latency, sum aligned per-request stage durations before calculating a
  percentile. Stage percentiles cannot be added to obtain a path percentile. Missing
  nonnegative stages yield per-request lower bounds; compare the same observed stages
  and request cohort in the baseline.
- Draw the gap as a gap. Break the line; do not interpolate across missing spans.
- Show uncertainty as a range, a band, a distribution or competing hypotheses — never as a
  falsely precise number. `310 – ? ms` with `no upper bound` is honest; `310 ms` is not.
- Withhold the claims that depend on missing evidence, state why in mono, and keep the
  independently supported facts available.
- When the missing evidence blocks the decision, the job of the screen changes: explaining
  and repairing the gap becomes the primary action.

Represent a degraded system as a trace you can no longer follow — gaps, forks, lost edges —
not as an emergency. No alarms, no pervasive red. Coral marks an anomaly; it does not shout.

## Before you call it done

- Does a reader learn _when_ it changed and whether it is still changing?
- Does any view restate a number already shown adjacent to it?
- Does every mark's colour mean what that colour means everywhere else in the system?
- Is the threshold visible in the picture?
- Is unknown distinguishable from zero, stale and busy?
- At narrow width, does the comparison still have a real common span, with labels above the
  track rather than squeezed beside it?
