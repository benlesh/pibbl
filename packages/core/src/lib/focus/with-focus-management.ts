import {
  appendElementEnhancer,
  hasElementEnhancer,
  type CRCElementEnhancerDescriptor,
} from '../element-enhancers.js';
import type { CompEl, SystemStyle } from '../types.js';

const FOCUS_MANAGEMENT_ENHANCER_KEY = Symbol('CRC focus management');

const focusManagementDescriptor: CRCElementEnhancerDescriptor = {
  key: FOCUS_MANAGEMENT_ENHANCER_KEY,
  mount: () => ({
    update: () => undefined,
    enter: () => undefined,
    exit: () => undefined,
    dispose: () => undefined,
  }),
};

export function withFocusManagement<
  P,
  S extends SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
>(element: CompEl<P, S, N, R>): CompEl<P, S, N, R> {
  if (hasElementEnhancer(element, FOCUS_MANAGEMENT_ENHANCER_KEY)) {
    throw new Error(
      'withFocusManagement cannot be applied more than once to the same CRC element.',
    );
  }
  return appendElementEnhancer(element, focusManagementDescriptor);
}
