import type { PibblEventType } from '../types.js';

export const PIBBL_NATIVE_CLIPBOARD_EVENT_TYPES = Object.freeze([
  'copy',
  'cut',
  'paste',
] as const satisfies readonly PibblEventType[]);

export type PibblNativeClipboardEventType =
  (typeof PIBBL_NATIVE_CLIPBOARD_EVENT_TYPES)[number];

const nativeClipboardEventTypes = new Set<PibblEventType>(
  PIBBL_NATIVE_CLIPBOARD_EVENT_TYPES,
);

export interface PibblAdaptedClipboardEvent {
  readonly type: PibblNativeClipboardEventType;
  readonly originalEvent: ClipboardEvent;
}

export function isNativeClipboardEventType(
  type: PibblEventType,
): type is PibblNativeClipboardEventType {
  return nativeClipboardEventTypes.has(type);
}

export function adaptClipboardEvent(
  type: PibblNativeClipboardEventType,
  event: Event,
): PibblAdaptedClipboardEvent | undefined {
  if (
    typeof ClipboardEvent === 'undefined' ||
    !(event instanceof ClipboardEvent)
  ) {
    return undefined;
  }
  return { type, originalEvent: event };
}
