import {
  FocusManagement,
  KeyboardNavigation,
  createElement,
  defineComp,
  type CRCKeyboardNavigationOptions,
  type SystemStyle,
} from '@crc/core';
import { describe, expect, it } from 'vitest';
import { materializeContainerChildren } from '../element/children';

describe('public focus API', () => {
  it('exports identity-transparent focus and keyboard-navigation policies', () => {
    interface ProbeStyle extends SystemStyle {
      width: number;
    }
    const Probe = defineComp<{}, ProbeStyle>(() => undefined);
    const style = { width: 24 };
    const element = Probe({ key: 'stable', style });
    const options: CRCKeyboardNavigationOptions = { mode: 'directional' };

    const policyTree = createElement(FocusManagement, {
      children: createElement(KeyboardNavigation, {
        ...options,
        children: element,
      }),
    });
    const [enhanced] = materializeContainerChildren(policyTree, 'public test');

    expect(policyTree.type).toBe(FocusManagement);
    expect(enhanced.type).toBe(element.type);
    expect(enhanced.props).toBe(element.props);
    expect(enhanced.props.style).toBe(style);
    expect(enhanced.key).toBe('stable');
  });
});
