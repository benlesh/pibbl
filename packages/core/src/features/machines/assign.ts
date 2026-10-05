import type { MachineAction, MachineActionContext, MachineEvent } from './types.js';

const assignments = new WeakMap<Function, (context: MachineActionContext<object, MachineEvent, unknown>) => object>();

/** @internal Returns the context patch represented by an assign action. */
export function assignmentOf(action: Function): ((context: MachineActionContext<object, MachineEvent, unknown>) => object) | undefined {
  return assignments.get(action);
}

/**
 * Creates an action that shallowly merges a context patch. Earlier assignments in the same
 * transition are visible to later actions. Context itself remains application-owned data.
 *
 * @example
 * ```ts
 * const collect = assign(({ context }) => ({ coins: context.coins + 1 }));
 * ```
 * @param update - Produces the shallow context patch for this transition.
 * @returns An action accepted by state entry, exit, and transition action lists.
 * @see {@link MachineAction}
 */
export function assign<Context extends object, Event extends MachineEvent, Input>(
  update: (context: MachineActionContext<Context, Event, Input>) => Partial<Context>,
): MachineAction<Context, Event, Input> {
  const action: MachineAction<Context, Event, Input> = () => {};
  assignments.set(action, update as unknown as (context: MachineActionContext<object, MachineEvent, unknown>) => object);
  return action;
}
