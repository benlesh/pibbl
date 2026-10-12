---
id: api-functions-machines
title: State machine functions
summary: Define flat machines, create signal-backed actors, update immutable context, and own cancelable tasks.
kind: api
slug: machines
apiCategory: function
symbols: [defineMachine, createMachine, assign, fromCallback]
relatedTypes: [MachineDefinition, MachineActor, MachineSnapshot, MachineTask]
keywords: [state machines, events, guards, context, actors]
---

# State machine functions

Import from `@pibbl/core/machines` or `pibbl/machines`. Standalone actors have no
renderer or animation dependency. See the [guide](#/learn/guides/state-machines)
and [types](#/api/types/machines).

## defineMachine

`defineMachine<Context, Event, Input>(definition)` validates and normalizes a
reusable flat machine. `Input` defaults to `undefined`. Supply `initial`, `context`
(an initial value or a per-actor input factory), and `states`. Optional machine-level
`on` handlers provide fallback behavior. Unknown state targets reject at definition
time. Creating a definition starts no tasks, timers, or animation.

## createMachine

`createMachine(definition, { input })` returns an actor with `snapshot`, `start`,
`send`, and `stop`. It begins as `not-started`. `start()` enters the initial state;
`send(event)` processes serially while active. Nested sends queue. `stop()` is
terminal and idempotent, canceling all state-owned tasks. Sends before start or
after stop do nothing. Retain the actor and stop it when its owner ends.

Snapshots carry state value, context, status, error, and `matches(state)`. Read
with `.get()` or derive a `computed` signal. Never send while rendering or computing.
Use [useMachine](#/api/hooks/use-machine) for component ownership.

## assign

`assign(({ context, event, input, send }) => patch)` creates an action which
shallowly merges a context patch. Earlier assignments are visible to later actions
in the same transition. Treat nested context objects as immutable. An event's
transition publishes state and context together; assignments do not individually
publish intermediate snapshots.

## fromCallback

`fromCallback(callback)` adapts subscription-style work for `invoke.task`. The
callback receives context, event, input, signal, and send. It can return a cleanup
function, called once on state exit or stop. Returning cleanup does not complete
an invocation. Use promise tasks for finite results and `onDone`/`onError`.

Cancellation aborts the task signal. Stale task results are ignored even if external
work failed to honor cancellation. Unexpected action/guard errors terminate the
actor; invocation errors may take their declared `onError` route.

Related types: [MachineDefinition](#/api/types/machines#machinedefinition), [MachineActor](#/api/types/machines#machineactor), [MachineSnapshot](#/api/types/machines#machinesnapshot), [MachineTask](#/api/types/machines#machinetask).
