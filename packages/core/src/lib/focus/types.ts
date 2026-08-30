import type { CRCEventTargetRegistration } from '../events/registrations.js';
import type { LayoutBox } from '../layout/types.js';

export type CRCFocusModality = 'keyboard' | 'pointer';

export interface CRCKeyboardNavigationOptions {
  readonly mode: 'directional';
}

export interface CRCDirectionalBoundary {
  readonly candidates: readonly CRCFocusCandidate[];
}

export interface CRCFocusCandidate {
  readonly target: CRCEventTargetRegistration;
  readonly sourceIndex: number;
  readonly directionalBoundary: CRCDirectionalBoundary | undefined;
  readonly rootBounds: Readonly<LayoutBox> | undefined;
}
