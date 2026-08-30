import {
  defineComp,
  withFocusManagement,
  withKeyboardNavigation,
  type CRCKeyboardNavigationOptions,
  type SystemStyle,
} from '@crc/core';
import { describe, expect, it } from 'vitest';

describe('public focus API', () => {
  it('exports identity-transparent focus and keyboard-navigation enhancers', () => {
    interface ProbeStyle extends SystemStyle {
      width: number;
    }
    const Probe = defineComp<{}, ProbeStyle>(() => undefined);
    const style = { width: 24 };
    const element = Probe({ key: 'stable', style });
    const options: CRCKeyboardNavigationOptions = { mode: 'directional' };

    const enhanced = withFocusManagement(
      withKeyboardNavigation(element, options),
    );

    expect(enhanced.type).toBe(element.type);
    expect(enhanced.props).toBe(element.props);
    expect(enhanced.style).toBe(style);
    expect(enhanced.key).toBe('stable');
  });
});
