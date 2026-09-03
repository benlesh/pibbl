import {
  appendElementEnhancer,
  hasElementEnhancer,
  type CRCElementEnhancerDescriptor,
} from '../element-enhancers.js';
import {
  setElementPolicyDefinition,
  type ElementPolicyDefinition,
} from '../element/metadata.js';
import type {
  CRCComponent,
  CRCElement,
  CRCEmptyNode,
} from '../element/types.js';
import type { CRCKeyboardNavigationOptions } from './types.js';
import {
  createDirectionalBoundary,
  createFocusManager,
  requireFocusManager,
  type CRCFocusManager,
} from './focus-manager.js';

const FOCUS_MANAGEMENT_ENHANCER_KEY = Symbol('CRC focus management');
const FOCUS_IMPLEMENTATION_MARKER = 'CRC_FOCUS_MANAGEMENT_V1';
const KEYBOARD_NAVIGATION_ENHANCER_KEY = Symbol('CRC keyboard navigation');

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

const keyboardNavigationDescriptor: CRCElementEnhancerDescriptor = {
  key: KEYBOARD_NAVIGATION_ENHANCER_KEY,
  mount: ({ instance }) => {
    const boundary = createDirectionalBoundary(instance);
    let manager: CRCFocusManager | undefined;
    return {
      update: () => undefined,
      enter: () => {
        manager = requireFocusManager(instance.eventRoot);
        manager.enterDirectionalBoundary(boundary);
      },
      exit: () => {
        try {
          manager?.exitDirectionalBoundary(boundary);
        } finally {
          manager = undefined;
        }
      },
      dispose: () => undefined,
    };
  },
};

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
  (_policy, child) => {
    if (hasElementEnhancer(child, FOCUS_MANAGEMENT_ENHANCER_KEY)) {
      throw new Error(
        `${FOCUS_IMPLEMENTATION_MARKER}: FocusManagement cannot be applied ` +
        'more than once to the same CRC element.',
      );
    }
    return appendElementEnhancer(child, focusManagementDescriptor);
  },
);

/** Adds one directional-navigation boundary without adding identity. */
export const KeyboardNavigation = /* @__PURE__ */ definePolicyComponent<KeyboardNavigationProps>(
  'KeyboardNavigation',
  (policy, child) => {
    const options = policy.props as KeyboardNavigationProps;
    if (options.mode !== 'directional') {
      throw new Error('KeyboardNavigation mode must be "directional".');
    }
    if (hasElementEnhancer(child, KEYBOARD_NAVIGATION_ENHANCER_KEY)) {
      throw new Error(
        'KeyboardNavigation cannot be applied more than once to the same CRC element.',
      );
    }
    return appendElementEnhancer(child, keyboardNavigationDescriptor);
  },
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
