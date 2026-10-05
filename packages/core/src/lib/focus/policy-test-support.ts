import { createElement } from '../element/create-element.js';
import type {
  PibblElement,
  PibblNode,
} from '../element/types.js';
import {
  FocusManagement,
  KeyboardNavigation,
  type FocusManagementProps,
  type KeyboardNavigationProps,
} from './policy-components.js';
import type { PibblKeyboardNavigationOptions } from './types.js';

/** Test-only non-JSX construction of the public focus policy descriptor. */
export function focusManaged(child: PibblNode): PibblElement<any> {
  return createElement(FocusManagement, {
    children: child as FocusManagementProps['children'],
  });
}

/** Test-only non-JSX construction of the public directional policy descriptor. */
export function directionalPolicy(
  child: PibblNode,
  options: PibblKeyboardNavigationOptions = { mode: 'directional' },
): PibblElement<any> {
  return createElement(KeyboardNavigation, {
    ...options,
    children: child as KeyboardNavigationProps['children'],
  });
}
