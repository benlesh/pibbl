import { GLOBAL_STATE } from '../../lib/global-state.js';
import type { PibblComponentRefs, PibblInstance } from '../../lib/types.js';
import { requireHookContext, useHookSlot } from '../../lib/hooks/hook-slot.js';
import { createMachine } from './runtime.js';
import type {
  MachineActor,
  MachineDefinition,
  MachineEvent,
} from './types.js';

interface MachineHookSlot<Context, Event extends MachineEvent, Input, State extends string> {
  readonly actor: MachineActor<Context, Event, Input, State>;
  readonly componentRefs: PibblComponentRefs<unknown>;
  readonly pibblInstance: PibblInstance;
  started: boolean;
}

function isCurrentSlot<Context, Event extends MachineEvent, Input, State extends string>(
  slot: MachineHookSlot<Context, Event, Input, State>,
): boolean {
  return !slot.componentRefs.teardowns.closed &&
    !slot.pibblInstance.mainTeardowns.closed &&
    GLOBAL_STATE.pibblInstances.get(slot.pibblInstance.canvas) === slot.pibblInstance &&
    slot.pibblInstance.refs.get(slot.componentRefs.id) === slot.componentRefs;
}

/**
 * Creates one component-owned state-machine actor for a hook slot.
 *
 * The actor starts only after its mounting render commits successfully and stops
 * when the component unmounts. Its input is captured on the initial mount;
 * changing an input object on a later render does not recreate or restart the
 * actor. Use machine events for application state changes.
 *
 * @typeParam Context - Immutable machine context carried by each snapshot.
 * @typeParam Event - Events accepted by the machine actor.
 * @typeParam Input - Immutable input captured when this hook slot mounts.
 * @param definition - Immutable machine behavior shared by all actor instances.
 * @param options - Input used to initialize this mounted actor.
 * @returns A stable actor with a readonly reactive snapshot.
 *
 * @example
 * ```tsx
 * const actor = useMachine(menuMachine, { input: { initialOpen: false } });
 * const open = () => actor.send({ type: 'OPEN' });
 * return <Text>{actor.snapshot.get().value}</Text>;
 * ```
 *
 * @see {@link createMachine}
 * @see {@link MachineActor}
 */
export function useMachine<Context, Event extends MachineEvent, Input, State extends string>(
  definition: MachineDefinition<Context, Event, Input, State>,
  options: { readonly input: Input },
): MachineActor<Context, Event, Input, State> {
  const { componentRefs, pibblInstance } = requireHookContext();

  const slot = useHookSlot<MachineHookSlot<Context, Event, Input, State>>(
    'machine',
    teardowns => {
      const actor = createMachine(definition, options);
      const value: MachineHookSlot<Context, Event, Input, State> = {
        actor,
        componentRefs,
        pibblInstance,
        started: false,
      };
      teardowns.add(() => actor.stop());
      return value;
    },
  ).value;

  const transaction = GLOBAL_STATE.renderTransaction;
  if (!transaction) {
    throw new Error('useMachine requires an active Pibbl render transaction.');
  }
  transaction.onFinish(success => {
    if (!success || slot.started || !isCurrentSlot(slot)) return;
    slot.started = true;
    slot.actor.start();
  });
  return slot.actor;
}
