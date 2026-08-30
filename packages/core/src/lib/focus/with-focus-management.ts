import {
  appendElementEnhancer,
  hasElementEnhancer,
  type CRCElementEnhancerDescriptor,
} from '../element-enhancers.js';
import type { CompEl, SystemStyle } from '../types.js';
import { createFocusManager } from './focus-manager.js';

const FOCUS_MANAGEMENT_ENHANCER_KEY = Symbol('CRC focus management');
const FOCUS_IMPLEMENTATION_MARKER = 'CRC_FOCUS_MANAGEMENT_V1';

const focusManagementDescriptor: CRCElementEnhancerDescriptor = {
  key: FOCUS_MANAGEMENT_ENHANCER_KEY,
  mount: ({ instance }) => {
    const manager = createFocusManager(instance.eventRoot, instance);
    return {
      update: () => undefined,
      enter: () => manager.beginCollection(),
      exit: success => manager.finishCollection(success),
      dispose: () => manager.dispose(),
    };
  },
};

export function withFocusManagement<
  P,
  S extends SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
>(element: CompEl<P, S, N, R>): CompEl<P, S, N, R> {
  if (hasElementEnhancer(element, FOCUS_MANAGEMENT_ENHANCER_KEY)) {
    throw new Error(
      `${FOCUS_IMPLEMENTATION_MARKER}: withFocusManagement cannot be applied more than once to the same CRC element.`,
    );
  }
  return appendElementEnhancer(element, focusManagementDescriptor);
}
