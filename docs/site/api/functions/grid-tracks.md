---
id: api-function-grid-tracks
title: Grid track definitions
summary: Define bounded and repeated tracks for the native Grid layout engine.
kind: api
slug: grid-tracks
apiCategory: function
symbols: [minmax, repeatTracks, autoFillTracks, autoFitTracks]
relatedTypes:
  [GridTrack, GridTrackBreadth, GridMinMaxTrack, GridRepeatTrack, GridStyle]
---

# Grid track definitions

```ts
import {
  minmax,
  repeatTracks,
  autoFillTracks,
  autoFitTracks,
} from "@pibbl/core";

const bounded = minmax({ min: 40, max: "1fr" });
const repeated = repeatTracks([bounded], { count: 3 });
const filled = autoFillTracks(80);
const fitted = autoFitTracks(80);
```

Each constructor returns an immutable track definition. `minmax` names the
minimum and maximum breadth; `repeatTracks` repeats its input list a positive
integer number of times. `autoFillTracks` fits repetitions into the available
finite axis. `autoFitTracks` also collapses repetitions that have no participating
items. These definitions are consumed by the experimental native Grid engine.

Intrinsic tracks demand declared pure intrinsic measurements. Opaque component
programs are never evaluated to infer a contribution. Invalid, cyclic or
unresolvable definitions fail with a contextual layout diagnostic.

These definitions use [`GridTrack`](#/api/types/layout#gridtrack),
[`GridTrackBreadth`](#/api/types/layout#gridtrackbreadth),
[`GridMinMaxTrack`](#/api/types/layout#gridminmaxtrack),
[`GridRepeatTrack`](#/api/types/layout#gridrepeattrack), and
[`GridStyle`](#/api/types/layout#gridstyle).
