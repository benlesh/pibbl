import type { CRCEventHandlers } from '../events/types.js';
import { useEventListener } from '../hooks/use-event-listener.js';

/** Event props shared by child-bearing Canvas built-ins. */
export interface CRCStructuralEventProps extends CRCEventHandlers {}

/** Registers a structural ancestor without creating hit-test geometry. */
export function wireStructuralEvents(handlers: CRCEventHandlers): void {
  useEventListener(handlers);
}
