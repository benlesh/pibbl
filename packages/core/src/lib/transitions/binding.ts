import type { PibblVisibilityTransition } from '../hooks/use-visibility-transition.js';
import { GLOBAL_STATE } from '../global-state.js';
import { requireHookContext } from '../hooks/hook-slot.js';
import type { PibblComponentRefs, PibblEventRoot, PibblInstance } from '../types.js';
import type { PibblFilter } from '../style/filter-types.js';

declare const bindingBrand: unique symbol;
/**
 * An opaque connection between one transition controller and its painted subject.
 *
 * @see {@link PibblVisibilityTransition}
 */
export interface PibblTransitionBinding { readonly [bindingBrand]: true }
interface BindingRecord {
  readonly resolve: () => readonly PibblFilter[];
  readonly root: PibblEventRoot;
  readonly owner: PibblComponentRefs<any>;
  receiver?: PibblComponentRefs<any>;
  receiverInstance?: PibblInstance;
}
const bindings = new WeakMap<PibblTransitionBinding, BindingRecord>();
export function createTransitionBinding(resolve: () => readonly PibblFilter[]): PibblTransitionBinding {
  const binding = Object.freeze({}) as PibblTransitionBinding;
  const { componentRefs, pibblInstance } = requireHookContext();
  bindings.set(binding, { resolve, owner: componentRefs, root: pibblInstance.eventRoot });
  return binding;
}
export function resolveTransitionBinding(binding: PibblTransitionBinding): readonly PibblFilter[] {
  const record = bindings.get(binding);
  if (!record) throw new TypeError('style.transition requires a binding from useVisibilityTransition in the same Pibbl runtime.');
  const receiver = GLOBAL_STATE.componentRefs;
  if (GLOBAL_STATE.currentPibblInstance?.eventRoot !== record.root) throw new Error('A transition binding must stay within its owning Pibbl root.');
  if (record.owner.teardowns.closed) throw new Error('Cannot use a disposed transition binding.');
  if (!receiver) throw new Error('Transition bindings require a mounted receiver.');
  const instance = GLOBAL_STATE.currentPibblInstance!;
  // Keyed replacements are visited before the old receiver is torn down. Only
  // retire an unseen receiver in this same render instance; cached Layers own
  // independent generations and must not silently lose their binding.
  if (record.receiver && record.receiver !== receiver && record.receiverInstance === instance && record.receiver.renderGeneration !== instance.renderGeneration) {
    record.receiver = undefined;
  }
  if (record.receiver && record.receiver !== receiver) throw new Error('A transition binding supports one mounted receiver. Wrap shared content in a Group.');
  if (!record.receiver) {
    record.receiver = receiver;
    record.receiverInstance = instance;
    receiver.teardowns.add(() => { if (record.receiver === receiver) record.receiver = undefined; });
  }
  return record.resolve();
}
