import type { CRCEventType } from '../types.js';

export const CRC_NATIVE_KEYBOARD_FOCUS_EVENT_TYPES = Object.freeze([
  'keydown',
  'keyup',
  'focus',
  'blur',
  'focusin',
  'focusout',
] as const satisfies readonly CRCEventType[]);

export type CRCNativeKeyboardFocusEventType =
  (typeof CRC_NATIVE_KEYBOARD_FOCUS_EVENT_TYPES)[number];

const nativeKeyboardFocusEventTypes = new Set<CRCEventType>(
  CRC_NATIVE_KEYBOARD_FOCUS_EVENT_TYPES,
);

export type CRCAdaptedKeyboardFocusEvent =
  | {
    readonly type: 'keydown' | 'keyup';
    readonly originalEvent: KeyboardEvent;
  }
  | {
    readonly type: 'blur' | 'focus' | 'focusin' | 'focusout';
    readonly originalEvent: FocusEvent;
  };

export function isNativeKeyboardFocusEventType(
  type: CRCEventType,
): type is CRCNativeKeyboardFocusEventType {
  return nativeKeyboardFocusEventTypes.has(type);
}

export function adaptKeyboardFocusEvent(
  type: CRCNativeKeyboardFocusEventType,
  event: Event,
): CRCAdaptedKeyboardFocusEvent | undefined {
  switch (type) {
    case 'keydown':
    case 'keyup':
      return typeof KeyboardEvent !== 'undefined' &&
        event instanceof KeyboardEvent ?
          { type, originalEvent: event } : undefined;
    case 'blur':
    case 'focus':
    case 'focusin':
    case 'focusout':
      return typeof FocusEvent !== 'undefined' && event instanceof FocusEvent ?
          { type, originalEvent: event } : undefined;
  }
  return assertNever(type);
}

function assertNever(value: never): never {
  throw new Error(`Unhandled keyboard/focus event type: ${String(value)}`);
}
