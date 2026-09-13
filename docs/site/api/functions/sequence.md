---
id: api-function-sequence
title: sequence
summary: Runs animation programs one after another in source order.
kind: api
slug: sequence
apiCategory: function
symbols: [sequence]
relatedTypes: [CRCAnimationProgram]
---

# sequence

`sequence(...programs)` returns one immutable program whose children run in
source order. Empty and zero-duration children preserve deterministic boundary
and milestone ordering.

Related type: [`CRCAnimationProgram`](#/api/types/canvas-runtime#crcanimationprogram).
