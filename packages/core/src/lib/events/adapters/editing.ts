import type { CRCEventType } from '../types.js';

export const CRC_NATIVE_EDITING_EVENT_TYPES = Object.freeze([
  'beforeinput',
  'input',
  'change',
  'compositionstart',
  'compositionupdate',
  'compositionend',
  'select',
  'selectionchange',
] as const satisfies readonly CRCEventType[]);

export type CRCNativeEditingEventType =
  (typeof CRC_NATIVE_EDITING_EVENT_TYPES)[number];

const nativeEditingEventTypes = new Set<CRCEventType>(
  CRC_NATIVE_EDITING_EVENT_TYPES,
);

export type CRCAdaptedEditingEvent =
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
  type: CRCEventType,
): type is CRCNativeEditingEventType {
  return nativeEditingEventTypes.has(type);
}

export function adaptEditingEvent(
  type: CRCNativeEditingEventType,
  event: Event,
): CRCAdaptedEditingEvent | undefined {
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
