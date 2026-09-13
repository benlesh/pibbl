---
id: api-function-parallel
title: parallel
summary: Runs animation programs from one shared local-time origin.
kind: api
slug: parallel
apiCategory: function
symbols: [parallel]
relatedTypes: [CRCAnimationProgram]
---

# parallel

`parallel(...programs)` starts its immutable children at the same local origin
and completes when its finite children complete. Writer overlap is validated
before a run is accepted.

Related type: [`CRCAnimationProgram`](#/api/types/canvas-runtime#crcanimationprogram).
