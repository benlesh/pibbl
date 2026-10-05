---
id: api-function-play-animation
title: playAnimation
summary: Adapt an animation program into a state-owned task with exact playback cancellation.
kind: api
slug: play-animation
apiCategory: function
symbols: [playAnimation]
relatedTypes:
  [MachineAnimationOptions, MachineAnimationProgramFactory, MachineTask]
---

# playAnimation

Import from `@pibbl/core/machines/animation` or `pibbl/machines/animation`.
`playAnimation(factory, options?)` returns a task for `invoke.task`. The factory
receives the entry's context, event, input, abort signal, and send function, and
returns an ordinary Pibbl animation program.

Finite playback resolves after the scheduler's finish event and can select
`invoke.onDone`. Infinite playback runs until cancellation. On state exit the
adapter disposes only its owned controller. Cancellation does not select completion
or error transitions. Animation sampling still uses Pibbl's shared scheduler.

Options provide an optional debug name and the existing animation writer-conflict
policy. The default rejects conflicts; simultaneous states/tasks do not silently
blend shared signal outputs or cancel unrelated writers.

See [machine animation](#/learn/guides/machine-animation) and
[machine types](#/api/types/machines).

Related types: [MachineAnimationOptions](#/api/types/machines#machineanimationoptions), [MachineAnimationProgramFactory](#/api/types/machines#machineanimationprogramfactory), [MachineTask](#/api/types/machines#machinetask).
