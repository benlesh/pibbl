import {
  installSchedulerDriverForTest as installDriver,
  snapshotRealmScheduler,
} from './realm-scheduler.js';
import type { SchedulerDriver } from './types.js';

export class ManualSchedulerDriver implements SchedulerDriver {
  private readonly callbacks = new Map<number, FrameRequestCallback>();
  private nextFrameId = 0;
  requestCount = 0;
  cancelCount = 0;

  get pendingHostFrames(): number {
    return this.callbacks.size;
  }

  requestFrame(callback: FrameRequestCallback): number {
    const frameId = ++this.nextFrameId;
    this.requestCount++;
    this.callbacks.set(frameId, callback);
    return frameId;
  }

  cancelFrame(frameId: number): void {
    if (this.callbacks.delete(frameId)) {
      this.cancelCount++;
    }
  }

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

export function installSchedulerDriverForTest(
  driver: ManualSchedulerDriver,
): () => void {
  return installDriver(driver);
}

export { snapshotRealmScheduler };
