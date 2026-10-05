---
id: guide-state-machines
title: Coordinate work with state machines
summary: Model events, context, loading flows, and cancelable work with signal-backed machine actors.
kind: guide
slug: state-machines
order: 63
keywords:
  [state machines, events, guards, context, signals, loading, cancellation]
exampleSlug: state-machines
---

# State machines

Machines coordinate application behavior: menus, loading and retry flows,
interaction modes, or game sessions. They are independent of animation. A
**definition** describes behavior; an **actor** executes it and exposes a readonly
snapshot signal. Definitions are shared; actors have independent state and tasks.

[Try the loading/retry example](#/examples/composition/state-machines). Its first
attempt deliberately fails, retry succeeds, and Cancel releases pending work.

## Define events and transitions

```ts
import { assign, defineMachine, createMachine } from "@pibbl/core/machines";

type Context = { count: number };
type Event = { type: "ADD"; amount: number } | { type: "RESET" };

const counter = defineMachine<Context, Event>({
  initial: "counting",
  context: () => ({ count: 0 }),
  states: {
    counting: {
      on: {
        ADD: {
          guard: ({ event }) => event.amount > 0,
          actions: assign(({ context, event }) => ({
            count: context.count + event.amount,
          })),
        },
        RESET: { actions: assign(() => ({ count: 0 })) },
      },
    },
  },
});

const actor = createMachine(counter, { input: undefined });
actor.start();
actor.send({ type: "ADD", amount: 3 });
console.log(actor.snapshot.get().context.count); // 3
actor.stop();
```

A string handler changes state. An object can add a guard, actions, target, and
`reenter`. An array selects the first passing guarded transition. Omitting the
target runs actions without exiting. A self-transition preserves active work
unless `reenter: true` explicitly requests cancellation and restart.

State-local event handlers shadow machine-level `on` handlers. An empty handler
consumes an event. If all local guards reject, the event remains unhandled there;
it does not fall back to the machine-level handler. Other unhandled events do
nothing.

## Read snapshots through signals

```tsx
import { Text, useComputed } from "@pibbl/core";
import { useMachine } from "@pibbl/core/machines";

function Counter() {
  const actor = useMachine(counter, { input: undefined });
  const label = useComputed(
    () => `Count: ${actor.snapshot.get().context.count}`,
  );
  return (
    <Text onClick={() => actor.send({ type: "ADD", amount: 1 })}>{label}</Text>
  );
}
```

`useMachine` keeps one actor per mounted hook slot. It starts after a successful
mount and stops on unmount. Definition and input are captured at initial mount;
send events to change behavior, rather than replacing the input on every render.
Never send events during component rendering or computed evaluation.

State and context publish together in one snapshot. Use `matches('state')` to
inspect the active state. Treat context as immutable and use `assign` for shallow
updates; replace nested values rather than mutating objects from an old snapshot.
Keep continuously changing positions or sprite frames in their own signals.

## Own asynchronous work

Each state's `invoke` accepts one task or an array of concurrent tasks. A promise
can select `onDone` or `onError`; a callback task returns a cleanup function.
Tasks receive entry context, the initiating event, actor input, an `AbortSignal`,
and `send`. The initial entry has no initiating event.

```ts
loading: {
  invoke: {
    task: async ({ input, signal }) => {
      const response = await fetch(input.url, { signal });
      if (!response.ok) throw new Error(`Load failed: ${response.status}`);
      return response.text();
    },
    onDone: {
      target: 'ready',
      actions: assign(({ event }) => ({ result: String(event.output) })),
    },
    onError: 'failed',
  },
  on: { CANCEL: 'idle' },
}
```

Leaving the state aborts the signal and calls callback cleanup. Tasks must honor
the signal to stop external activity. Even if a promise ignores cancellation,
its stale completion cannot affect a later state entry. Cancellation does not
select `onDone` or `onError`.

`fromCallback(({ send, signal }) => cleanup)` adapts event subscriptions. Unlike
a promise, returning a cleanup function does not complete the invocation. Input
resources stay owned by the application; the actor owns only invoked work.

## Ordering and failures

Events sent by actions queue until the current transition finishes. Guards inspect
the previous snapshot. A transition cancels exited work, executes exit actions,
transition actions, and entry actions, publishes its snapshot, then starts the
new tasks. Later actions see earlier `assign` patches. External effects are not
rolled back when an action throws.

Unexpected guard/action failures stop the actor with `status: 'error'` and release
its tasks. Task failures can instead take `onError`. `stop()` is terminal and
idempotent; it cancels work rather than completing it successfully. A game-over
state can remain active to accept Restart. Flat states do not currently declare
a separate final/done status.

## Scope and cost

Import machines from `@pibbl/core/machines` (also mirrored as `pibbl/machines`).
Standalone machines do not import animation or the renderer. Idle machines do
not subscribe to frames. Definitions normalize once and dispatch selects only the
current state's event handlers. Optional animation integration lives in a separate
entry. See [machine animation](#/learn/guides/machine-animation).

This initial API supports flat states and concurrent tasks, not hierarchical or
parallel state regions, history states, or persistence. It does not claim XState
API compatibility.
