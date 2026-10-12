import type { PibblEventType } from '../types.js';

export const PIBBL_NATIVE_EDITING_EVENT_TYPES = Object.freeze([
  'beforeinput',
  'input',
  'change',
  'compositionstart',
  'compositionupdate',
  'compositionend',
  'select',
  'selectionchange',
] as const satisfies readonly PibblEventType[]);

export type PibblNativeEditingEventType =
  (typeof PIBBL_NATIVE_EDITING_EVENT_TYPES)[number];

const nativeEditingEventTypes = new Set<PibblEventType>(
  PIBBL_NATIVE_EDITING_EVENT_TYPES,
);

export type PibblAdaptedEditingEvent =
  | {
    readonly type: 'beforeinput' | 'input';
    readonly originalEvent: InputEvent;
  }
  | {
    readonly type:
      | 'compositionend'
      | 'compositionstart'
      | 'compositionupdate';
    readonly originalEvent: CompositionEvent;
  }
  | {
    readonly type: 'change' | 'select' | 'selectionchange';
    readonly originalEvent: Event;
  };

export function isNativeEditingEventType(
  type: PibblEventType,
): type is PibblNativeEditingEventType {
  return nativeEditingEventTypes.has(type);
}

export function adaptEditingEvent(
  type: PibblNativeEditingEventType,
  event: Event,
): PibblAdaptedEditingEvent | undefined {
  switch (type) {
    case 'beforeinput':
    case 'input':
      return typeof InputEvent !== 'undefined' && event instanceof InputEvent ?
          { type, originalEvent: event } : undefined;
    case 'compositionstart':
    case 'compositionupdate':
    case 'compositionend':
      return typeof CompositionEvent !== 'undefined' &&
        event instanceof CompositionEvent ?
          { type, originalEvent: event } : undefined;
    case 'change':
    case 'select':
    case 'selectionchange':
      return { type, originalEvent: event };
  }
  return assertNever(type);
}

function assertNever(value: never): never {
  throw new Error(`Unhandled editing event type: ${String(value)}`);
}
