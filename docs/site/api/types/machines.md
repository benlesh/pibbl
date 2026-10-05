---
id: api-types-machines
title: State machine types
summary: Definitions, actors, transitions, and cancelable work.
kind: api
slug: machines
apiCategory: types
typeDomain: machines
symbols:
  [
    MachineEvent,
    MachineEventRoutes,
    MachineStatus,
    MachineSnapshot,
    MachineTaskCleanup,
    MachineActionContext,
    MachineAction,
    MachineActions,
    MachineTaskContext,
    MachineTask,
    MachineTaskDoneEvent,
    MachineTaskErrorEvent,
    MachineInvocation,
    MachineTransitionConfig,
    MachineTransition,
    MachineState,
    MachineDefinition,
    CreateMachineOptions,
    MachineActor,
    MachineAnimationOptions,
    MachineAnimationProgramFactory,
  ]
---

# State machine types

## MachineEvent

Event object with a string `type` discriminator.

## MachineEventRoutes

Maps event discriminators to typed transition handlers. Each handler receives its narrowed event.

## MachineStatus

Actor lifecycle: `not-started`, `active`, `stopped`, or `error`. A game-over application state can remain active.

## MachineSnapshot

Readonly state value, context, lifecycle status, error, and `matches(state)` predicate, published as one signal value.

## MachineTaskCleanup

Synchronous cleanup function for callback work. Called once when its state exits or its actor stops.

## MachineActionContext

Context, initiating event, immutable actor input, and queued send function supplied to synchronous actions.

## MachineAction

Synchronous effect used in entry, exit, or a transition. Use `assign` for context updates.

## MachineActions

One action or a readonly array of actions executed in order.

## MachineTaskContext

Entry context, initiating event (undefined initially), actor input, abort signal, and send function supplied to owned work.

## MachineTask

Cancelable state-owned function returning a cleanup, a promise, or no result. Promises select completion/error routes; cleanup functions remain owned until exit.

## MachineTaskDoneEvent

Internal completion event carrying the task output. Observed by its invocation’s `onDone` handler.

## MachineTaskErrorEvent

Internal failure event carrying the task error. Observed by its invocation’s `onError` handler.

## MachineInvocation

Task with optional diagnostic id and `onDone`/`onError` transitions. A state may declare one or several invocations.

## MachineTransitionConfig

Optional target, guard, ordered actions, and explicit same-state reentry flag.

## MachineTransition

A destination name, configured transition, or ordered list of guarded alternatives.

## MachineState

Flat state with optional entry/exit actions, owned invocations, and local event routes.

## MachineDefinition

Reusable initial state, context factory/value, state table, and machine-level fallback routes.

## CreateMachineOptions

Input captured by the actor at creation. Use `{ input: undefined }` for machines without input.

## MachineActor

Execution handle with a readonly snapshot signal and `start`, `send`, and terminal idempotent `stop` methods.

## MachineAnimationOptions

Optional existing playback conflict policy and diagnostic name, imported from the animation adapter entry.

## MachineAnimationProgramFactory

Builds one animation program per state entry from task context, imported from the animation adapter entry.
