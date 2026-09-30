# Custom pie label proposal (unapproved)

Status: awaiting the explicit contract approval already requested. This is a
proposal, not shipped behavior and not authorization to implement it.

## Proposed composition

Supply `labelBox={slice => ({ width: 132, height: 42 })}` to PieLayout and render
ordinary CRC content as children of the existing PieLabel:

```tsx
<PieLabel slice={slice}>
  <ReadingCard datum={slice.datum} />
</PieLabel>
```

The intent is one label placement system and one receiving PieLabel component.
Do not add a second rendering component or automatic child-tree measurement.

## Sizing and placement

- `labelBox` and the existing string `label` callback are mutually exclusive.
- A returned box must have positive finite width and height. Returning null or
  undefined omits that label. Invalid dimensions reject before placement.
- The caller supplies content that fits the declared box. Arbitrary drawing
  outside that allocation does not enlarge the label's placement geometry.
- Apply the approved whole-box bounds, outer-circle, angular, and hole checks.
  An inside label that cannot fit hides; auto attempts the existing outside
  lane fallback and then hides if there is insufficient space.
- Preserve the existing coordinated bounded O(n log n) placement and stable
  datum keys. Hidden label children unmount; visible stable keys retain state
  across reordering.
- Box-accessor dependencies follow the approved safe-default/revision policy.
  Track signals read by stable callbacks; callback/data replacement, changed
  revision, and relevant bounds/radii/placement inputs invalidate placement.
- Mounted label content uses the existing CRC lifecycle, events, and scheduler.

## Alternative and first slice

Automatic measurement is convenient but adds traversal, measurement ownership,
and invalidation ambiguity for arbitrary content. Recommend explicit dimensions
for this first capability. The smallest feedback slice adds multiline card
labels to the existing editable donut example and demonstrates inside hiding,
automatic outside fallback, reordering, and content lifecycle.

Resolve the public discriminated label-layout declarations during the approved
implementation without silently changing the above behavior. Any material
contract change requires a new approval.
