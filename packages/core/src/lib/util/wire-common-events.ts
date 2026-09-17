import type {
  CRCEventFocusOptions,
  CRCEventHandlers,
  CRCEventParticipationOptions,
} from '../events/types.js';
import { usePaintTarget } from '../hooks/use-paint-target.js';

export function wireCommonEvents(
  props: CRCEventHandlers & CRCEventFocusOptions & CRCEventParticipationOptions,
  path: Path2D | undefined,
  fill: boolean,
  lineInteractionWidth: number,
  cursor: string | undefined,
  keyboardNavigationBounds?: CRCEventFocusOptions['keyboardNavigationBounds'],
): void {
  usePaintTarget(props, {
    path: path ?? new Path2D(),
    cursor,
    fill,
    lineInteractionWidth,
    keyboardFocusable: props.keyboardFocusable,
    keyboardNavigationBounds:
      props.keyboardNavigationBounds ?? keyboardNavigationBounds,
  }, props.pointerEvents);
}
