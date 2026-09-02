import {
  setElementPolicyDefinition,
  type ElementPolicyDefinition,
} from '../element/metadata.js';
import type {
  CRCComponent,
  CRCElement,
  CRCEmptyNode,
} from '../element/types.js';
import {
  prepareFocusManagementPolicy,
} from './with-focus-management.js';
import {
  prepareKeyboardNavigationPolicy,
} from './with-keyboard-navigation.js';
import type { CRCKeyboardNavigationOptions } from './types.js';

type CRCPolicyChild =
  | CRCElement<any>
  | CRCEmptyNode
  | readonly CRCPolicyChild[]
  | (Iterable<CRCPolicyChild> & { readonly charAt?: never });

export interface FocusManagementProps {
  readonly children: CRCPolicyChild;
}

export interface KeyboardNavigationProps extends CRCKeyboardNavigationOptions {
  readonly children: CRCPolicyChild;
}

/** Adds one logical focus manager to exactly one child without adding identity. */
export const FocusManagement = /* @__PURE__ */ definePolicyComponent<FocusManagementProps>(
  'FocusManagement',
  (_policy, child) => prepareFocusManagementPolicy(child),
);

/** Adds one directional-navigation boundary without adding identity. */
export const KeyboardNavigation = /* @__PURE__ */ definePolicyComponent<KeyboardNavigationProps>(
  'KeyboardNavigation',
  (policy, child) => prepareKeyboardNavigationPolicy(
    child,
    policy.props as KeyboardNavigationProps,
  ),
);

function definePolicyComponent<P>(
  name: string,
  prepare: ElementPolicyDefinition['prepare'],
): CRCComponent<P> {
  const component = function CRCPolicyComponent(): never {
    throw new Error(
      `${name} is a CRC component and was invoked outside the CRC renderer.\n` +
      `Use <${name} ... /> in a CRC JSX file or ` +
      `createElement(${name}, props).`,
    );
  } as CRCComponent<P>;
  Object.defineProperty(component, 'name', {
    configurable: true,
    value: name,
  });
  setElementPolicyDefinition(component, { prepare });
  return component;
}
