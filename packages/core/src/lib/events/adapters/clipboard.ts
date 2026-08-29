import type { CRCEventType } from '../types.js';

export const CRC_NATIVE_CLIPBOARD_EVENT_TYPES = Object.freeze([
  'copy',
  'cut',
  'paste',
] as const satisfies readonly CRCEventType[]);

export type CRCNativeClipboardEventType =
  (typeof CRC_NATIVE_CLIPBOARD_EVENT_TYPES)[number];

const nativeClipboardEventTypes = new Set<CRCEventType>(
  CRC_NATIVE_CLIPBOARD_EVENT_TYPES,
);

export interface CRCAdaptedClipboardEvent {
  readonly type: CRCNativeClipboardEventType;
  readonly originalEvent: ClipboardEvent;
}

export function isNativeClipboardEventType(
  type: CRCEventType,
): type is CRCNativeClipboardEventType {
  return nativeClipboardEventTypes.has(type);
}

export function adaptClipboardEvent(
  type: CRCNativeClipboardEventType,
  event: Event,
): CRCAdaptedClipboardEvent | undefined {
  if (
    typeof ClipboardEvent === 'undefined' ||
    !(event instanceof ClipboardEvent)
  ) {
    return undefined;
  }
  return { type, originalEvent: event };
}
