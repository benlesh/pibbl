import { createElement } from '../element/create-element.js';
import type {
  CRCNode,
} from '../element/types.js';
import {
  FocusManagement,
  KeyboardNavigation,
  type FocusManagementProps,
  type KeyboardNavigationProps,
} from './policy-components.js';
import type { CRCKeyboardNavigationOptions } from './types.js';
import type { CompEl } from '../types.js';

/** Test-only non-JSX construction of the public focus policy descriptor. */
export function focusManaged(child: CRCNode): CompEl<any, any> {
  return createElement(FocusManagement, {
    children: child as FocusManagementProps['children'],
  }) as unknown as CompEl<any, any>;
}

/** Test-only non-JSX construction of the public directional policy descriptor. */
export function directionalPolicy(
  child: CRCNode,
  options: CRCKeyboardNavigationOptions = { mode: 'directional' },
): CompEl<any, any> {
  return createElement(KeyboardNavigation, {
    ...options,
    children: child as KeyboardNavigationProps['children'],
  }) as unknown as CompEl<any, any>;
}
