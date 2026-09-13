---
id: api-function-untracked
title: untracked
summary: Reads signals without collecting dependency edges.
kind: api
slug: untracked
apiCategory: function
symbols: [untracked]
relatedTypes: [Signal]
---

# untracked

`untracked(read)` invokes a synchronous callback and returns its result without
recording signal dependencies for the current consumer. It does not disable
component, primitive-render, computed, or scheduler write guards.

Related type: [`Signal`](#/api/types/canvas-runtime#signal).
