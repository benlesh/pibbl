import type { PibblEventType } from '../types.js';

export const PIBBL_NATIVE_KEYBOARD_FOCUS_EVENT_TYPES = Object.freeze([
  'keydown',
  'keyup',
  'focus',
  'blur',
  'focusin',
  'focusout',
] as const satisfies readonly PibblEventType[]);

export type PibblNativeKeyboardFocusEventType =
  (typeof PIBBL_NATIVE_KEYBOARD_FOCUS_EVENT_TYPES)[number];

const nativeKeyboardFocusEventTypes = new Set<PibblEventType>(
  PIBBL_NATIVE_KEYBOARD_FOCUS_EVENT_TYPES,
);

export type PibblAdaptedKeyboardFocusEvent =
  | {
    readonly type: 'keydown' | 'keyup';
    readonly originalEvent: KeyboardEvent;
  }
  | {
    readonly type: 'blur' | 'focus' | 'focusin' | 'focusout';
    readonly originalEvent: FocusEvent;
  };

export function isNativeKeyboardFocusEventType(
  type: PibblEventType,
): type is PibblNativeKeyboardFocusEventType {
  return nativeKeyboardFocusEventTypes.has(type);
}

export function adaptKeyboardFocusEvent(
  type: PibblNativeKeyboardFocusEventType,
  event: Event,
): PibblAdaptedKeyboardFocusEvent | undefined {
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
