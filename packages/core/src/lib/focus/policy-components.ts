import {
  appendElementEnhancer,
  hasElementEnhancer,
  type PibblElementEnhancerDescriptor,
} from '../element-enhancers.js';
import {
  setElementPolicyDefinition,
  type ElementPolicyDefinition,
} from '../element/metadata.js';
import type {
  PibblComponent,
  PibblElement,
  PibblEmptyNode,
} from '../element/types.js';
import type { PibblKeyboardNavigationOptions } from './types.js';
import {
  createDirectionalBoundary,
  createFocusManager,
  requireFocusManager,
  type PibblFocusManager,
} from './focus-manager.js';

const FOCUS_MANAGEMENT_ENHANCER_KEY = Symbol('Pibbl focus management');
const FOCUS_IMPLEMENTATION_MARKER = 'PIBBL_FOCUS_MANAGEMENT_V1';
const KEYBOARD_NAVIGATION_ENHANCER_KEY = Symbol('Pibbl keyboard navigation');

const focusManagementDescriptor: PibblElementEnhancerDescriptor = {
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

const keyboardNavigationDescriptor: PibblElementEnhancerDescriptor = {
  key: KEYBOARD_NAVIGATION_ENHANCER_KEY,
  mount: ({ instance }) => {
    const boundary = createDirectionalBoundary(instance);
    let manager: PibblFocusManager | undefined;
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

type PibblPolicyChild =
  | PibblElement<any>
  | PibblEmptyNode
  | readonly PibblPolicyChild[]
  | (Iterable<PibblPolicyChild> & { readonly charAt?: never });

/**
 * Authored inputs for FocusManagement, including the declared data and presentation options.
 *
 * @see {@link FocusManagement}
 */
export interface FocusManagementProps {
  /** The single child receiving a logical focus manager. See {@link PibblPolicyChild}. */
  readonly children: PibblPolicyChild;
}

/**
 * Authored inputs for KeyboardNavigation, including the declared data and presentation options.
 *
 * @see {@link PibblKeyboardNavigationOptions}
 * @see {@link KeyboardNavigation}
 */
export interface KeyboardNavigationProps extends PibblKeyboardNavigationOptions {
  /** The single child receiving a directional keyboard-navigation boundary. See {@link PibblPolicyChild}. */
  readonly children: PibblPolicyChild;
}

/**
 * Adds one logical focus manager to exactly one child without adding identity.
 *
 * @param props - Authored component inputs, supplied through JSX or createElement. See the linked
 * props and style types.
 * @throws When called directly; Pibbl mounts this component through JSX or createElement.
 *
 * @see {@link FocusManagementProps}
 */
export const FocusManagement = /* @__PURE__ */ definePolicyComponent<FocusManagementProps>(
  'FocusManagement',
  (_policy, child) => {
    if (hasElementEnhancer(child, FOCUS_MANAGEMENT_ENHANCER_KEY)) {
      throw new Error(
        `${FOCUS_IMPLEMENTATION_MARKER}: FocusManagement cannot be applied ` +
        'more than once to the same Pibbl element.',
      );
    }
    return appendElementEnhancer(child, focusManagementDescriptor);
  },
);

/**
 * Adds one directional-navigation boundary without adding identity.
 *
 * @param props - Authored component inputs, supplied through JSX or createElement. See the linked
 * props and style types.
 * @throws When called directly; Pibbl mounts this component through JSX or createElement.
 *
 * @see {@link KeyboardNavigationProps}
 */
export const KeyboardNavigation = /* @__PURE__ */ definePolicyComponent<KeyboardNavigationProps>(
  'KeyboardNavigation',
  (policy, child) => {
    const options = policy.props as KeyboardNavigationProps;
    if (options.mode !== 'directional') {
      throw new Error('KeyboardNavigation mode must be "directional".');
    }
    if (hasElementEnhancer(child, KEYBOARD_NAVIGATION_ENHANCER_KEY)) {
      throw new Error(
        'KeyboardNavigation cannot be applied more than once to the same Pibbl element.',
      );
    }
    return appendElementEnhancer(child, keyboardNavigationDescriptor);
  },
);

function definePolicyComponent<P>(
  name: string,
  prepare: ElementPolicyDefinition['prepare'],
): PibblComponent<P> {
  const component = function PibblPolicyComponent(): never {
    throw new Error(
      `${name} is a Pibbl component and was invoked outside the Pibbl renderer.\n` +
      `Use <${name} ... /> in a Pibbl JSX file or ` +
      `createElement(${name}, props).`,
    );
  } as PibblComponent<P>;
  Object.defineProperty(component, 'name', {
    configurable: true,
    value: name,
  });
  setElementPolicyDefinition(component, { prepare });
  return component;
}
