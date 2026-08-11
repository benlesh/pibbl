import { GLOBAL_STATE } from '../global-state.js';

export interface CRCRef<T> {
  current: T | undefined;
}

/**
 * Hook: Creates a reference object, similar to React's useRef.
 * @param init The initial reference value
 * @returns A reference with a `current` property containing the value
 */
export function crcRef<T>(init?: T): CRCRef<T> {
  if (GLOBAL_STATE.componentIsMounting) {
    GLOBAL_STATE.componentRefs!.refs.push({
      type: 'ref',
      current: init,
    });
  }

  return GLOBAL_STATE.componentRefs!.refs[GLOBAL_STATE.componentHookIndex++];
}
