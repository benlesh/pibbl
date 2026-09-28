import { untracked } from '../signals/graph.js';
import { useHookSlot, withHooksForbidden } from './hook-slot.js';

/** Creates one non-reactive value for the lifetime of a mounted hook slot. */
export function useConst<T>(create: () => T): T {
  return useHookSlot(
    'const',
    () => untracked(() => withHooksForbidden(
      'CRC hooks cannot be called inside a useConst factory.',
      create,
    )),
  ).value;
}
