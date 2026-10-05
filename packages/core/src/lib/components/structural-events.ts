import type { PibblEventHandlers } from '../events/types.js';
import { useEventListener } from '../hooks/use-event-listener.js';

/**
 * Event props shared by child-bearing Canvas built-ins.
 *
 * @see {@link PibblEventHandlers}
 */
export interface PibblStructuralEventProps extends PibblEventHandlers {}

/** Registers a structural ancestor without creating hit-test geometry. */
export function wireStructuralEvents(handlers: PibblEventHandlers): void {
  useEventListener(handlers);
}
