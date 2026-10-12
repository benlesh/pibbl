---
id: api-hook-use-machine
title: useMachine
summary: Own a state-machine actor for one mounted component and read its snapshot through signals.
kind: api
slug: use-machine
apiCategory: hook
symbols: [useMachine]
relatedTypes: [MachineDefinition, MachineActor, CreateMachineOptions]
---

# useMachine

`useMachine(definition, { input })` from `@pibbl/core/machines` creates one stable
actor per hook slot. It starts after a successful mounting render and stops on
unmount. An abandoned mounting render starts no tasks. Input and definition are
captured at initial mount; later input objects do not restart the actor.

Send events from handlers or owned work. Read `actor.snapshot.get()` in a component,
or select a field with `useComputed`. The initial render can observe `not-started`;
entry effects and tasks start only after the render succeeds.

```tsx
import { Text } from "@pibbl/core";
import { defineMachine, useMachine } from "@pibbl/core/machines";
const menu = defineMachine<undefined, { type: "TOGGLE" }>({
  initial: "closed",
  context: () => undefined,
  states: {
    closed: { on: { TOGGLE: "open" } },
    open: { on: { TOGGLE: "closed" } },
  },
});
function Menu() {
  const actor = useMachine(menu, { input: undefined });
  return (
    <Text onClick={() => actor.send({ type: "TOGGLE" })}>
      {actor.snapshot.get().value}
    </Text>
  );
}
```

See [machine authoring](#/learn/guides/state-machines) and
[machine types](#/api/types/machines).

Related types: [MachineDefinition](#/api/types/machines#machinedefinition), [MachineActor](#/api/types/machines#machineactor), [CreateMachineOptions](#/api/types/machines#createmachineoptions).
