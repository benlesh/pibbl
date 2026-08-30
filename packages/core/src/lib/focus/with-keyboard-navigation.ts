import {
  appendElementEnhancer,
  hasElementEnhancer,
  type CRCElementEnhancerDescriptor,
} from '../element-enhancers.js';
import type { CompEl, SystemStyle } from '../types.js';
import type { CRCKeyboardNavigationOptions } from './types.js';
import {
  createDirectionalBoundary,
  requireFocusManager,
  type CRCFocusManager,
} from './focus-manager.js';

const KEYBOARD_NAVIGATION_ENHANCER_KEY = Symbol('CRC keyboard navigation');

const keyboardNavigationDescriptor: CRCElementEnhancerDescriptor = {
  key: KEYBOARD_NAVIGATION_ENHANCER_KEY,
  mount: ({ instance }) => {
    const boundary = createDirectionalBoundary();
    let manager: CRCFocusManager | undefined;
    return {
      update: () => undefined,
      enter: () => {
        manager = requireFocusManager(instance.eventRoot);
        manager.enterDirectionalBoundary(boundary);
      },
      exit: () => {
        manager?.exitDirectionalBoundary(boundary);
        manager = undefined;
      },
      dispose: () => undefined,
    };
  },
};

export function withKeyboardNavigation<
  P,
  S extends SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
>(
  element: CompEl<P, S, N, R>,
  options: CRCKeyboardNavigationOptions,
): CompEl<P, S, N, R> {
  if (options.mode !== 'directional') {
    throw new Error('withKeyboardNavigation mode must be "directional".');
  }
  if (hasElementEnhancer(element, KEYBOARD_NAVIGATION_ENHANCER_KEY)) {
    throw new Error(
      'withKeyboardNavigation cannot be applied more than once to the same CRC element.',
    );
  }
  return appendElementEnhancer(element, keyboardNavigationDescriptor);
}
