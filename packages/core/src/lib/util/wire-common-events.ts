import type {
  CRCEventFocusOptions,
  CRCEventHandlers,
} from '../events/types.js';
import { crcEventTarget } from '../hooks/crc-event-target.js';

export function wireCommonEvents(
  props: CRCEventHandlers & CRCEventFocusOptions,
  path: Path2D | undefined,
  fill: boolean,
  lineInteractionWidth: number,
  cursor: string | undefined,
  keyboardNavigationBounds?: CRCEventFocusOptions['keyboardNavigationBounds'],
): void {
  crcEventTarget(props, {
    path: path ?? new Path2D(),
    cursor,
    fill,
    lineInteractionWidth,
    keyboardFocusable: props.keyboardFocusable,
    keyboardNavigationBounds:
      props.keyboardNavigationBounds ?? keyboardNavigationBounds,
  });
}
