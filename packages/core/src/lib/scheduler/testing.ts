import {
  installSchedulerDriverForTest as installDriver,
  installSchedulerTraceCollectorForTest,
  snapshotRealmScheduler,
} from './realm-scheduler.js';
import type { CRCSchedulerTraceRecord, SchedulerDriver } from './types.js';

/**
 * A host-frame driver controlled explicitly by tests.
 *
 * @see {@link installSchedulerDriverForTest}
 */
export class ManualSchedulerDriver implements SchedulerDriver {
  private readonly callbacks = new Map<number, FrameRequestCallback>();
  private nextFrameId = 0;
  /**
   * Number of host-frame requests observed by this test driver. See {@link ManualSchedulerDriver}
   * .
   */
  requestCount = 0;
  /**
   * Number of host-frame cancellations observed by this test driver. See
   * {@link ManualSchedulerDriver}.
   */
  cancelCount = 0;

  /**
   * Number of host-frame callbacks currently pending in the driver. See
   * {@link ManualSchedulerDriver}.
   * @returns The number of queued host-frame callbacks.
   */
  get pendingHostFrames(): number {
    return this.callbacks.size;
  }

  /**
   * Requests future work from the owning scheduler. See {@link ManualSchedulerDriver}.
   * @param callback - Callback to invoke on a manually flushed frame.
   * @returns An identifier usable to cancel the queued callback.
   */
  requestFrame(callback: FrameRequestCallback): number {
    const frameId = ++this.nextFrameId;
    this.requestCount++;
    this.callbacks.set(frameId, callback);
    return frameId;
  }

  /**
   * Cancels the identified pending host callback. See {@link ManualSchedulerDriver}.
   * @param frameId - Identifier returned by requestFrame.
   */
  cancelFrame(frameId: number): void {
    if (this.callbacks.delete(frameId)) {
      this.cancelCount++;
    }
  }

  /**
   * Delivers a pending host callback at the requested test time. See {@link ManualSchedulerDriver}
   * .
   * @param hostTime - Host timestamp in milliseconds supplied to pending callbacks.
   */
  flush(hostTime: number): void {
    const entry = this.callbacks.entries().next().value as
      | [number, FrameRequestCallback]
      | undefined;
    if (!entry) {
      throw new Error('No CRC host frame is pending.');
    }
    const [frameId, callback] = entry;
    this.callbacks.delete(frameId);
    callback(hostTime);
  }
}

/**
 * Installs a deterministic host-frame driver and returns the callback that restores the previous
 * driver.
 *
 * @param driver - Manual driver to install for deterministic scheduler tests. See
 * {@link ManualSchedulerDriver} .
 * @returns A function restoring the previous scheduler driver.
 *
 * @see {@link ManualSchedulerDriver}
 */
export function installSchedulerDriverForTest(
  driver: ManualSchedulerDriver,
): () => void {
  return installDriver(driver);
}

export {
  installSchedulerTraceCollectorForTest,
  snapshotRealmScheduler,
  type CRCSchedulerTraceRecord,
};
