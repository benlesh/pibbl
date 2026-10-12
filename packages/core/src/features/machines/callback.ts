import type { MachineEvent, MachineTask } from './types.js';

/**
 * Marks callback-style cancelable work as a machine task. The callback may return a cleanup;
 * its cleanup runs exactly once when the owning state exits or the actor stops.
 * @param callback - Callback task to retain as state-owned work.
 * @returns The same callback, typed for an invocation's `task` field.
 * @see {@link MachineTask}
 */
export function fromCallback<Context, Event extends MachineEvent, Input>(
  callback: MachineTask<Context, Event, Input>,
): MachineTask<Context, Event, Input> {
  return callback;
}
