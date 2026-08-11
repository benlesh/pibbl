import type { Canvas, CRCEventRegistry, CRCInstance } from '../../src/lib/types';
import { GLOBAL_STATE } from '../../src/lib/global-state';

type EventType = keyof CRCEventRegistry;

export interface RuntimeDiagnosticSnapshot {
  instances: number;
  nativeListeners: number;
  handlers: Record<EventType, number>;
  componentTeardowns: number;
  mainTeardowns: number;
  scheduledFrames: number;
}

interface ListenerRecord {
  active: boolean;
  listener: EventListenerOrEventListenerObject;
  capture: boolean;
  type: string;
}

const EVENT_TYPES: readonly EventType[] = [
  'click',
  'contextmenu',
  'dblclick',
  'mousedown',
  'mousemove',
  'mouseout',
  'mouseover',
  'mouseup',
];

function captureFrom(options?: boolean | AddEventListenerOptions): boolean {
  return typeof options === 'boolean' ? options : options?.capture ?? false;
}

function teardownCount(teardowns: unknown): number {
  return (teardowns as { _teardowns: Set<() => void> })._teardowns.size;
}

/**
 * Test-only browser/runtime observer. This file is not reachable from a package
 * export or build entry, so the published runtime contains no diagnostic code.
 */
export class RuntimeDiagnostics {
  private readonly listenerRecords = new Set<ListenerRecord>();
  private readonly scheduledFrameIds = new Set<number>();
  private readonly originalAddEventListener: HTMLCanvasElement['addEventListener'];
  private readonly originalRemoveEventListener: HTMLCanvasElement['removeEventListener'];
  private readonly originalRequestAnimationFrame = window.requestAnimationFrame;
  private readonly originalCancelAnimationFrame = window.cancelAnimationFrame;
  private restored = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.originalAddEventListener = canvas.addEventListener;
    this.originalRemoveEventListener = canvas.removeEventListener;
    const records = this.listenerRecords;
    const originalAdd = this.originalAddEventListener;
    const originalRemove = this.originalRemoveEventListener;

    canvas.addEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      const capture = captureFrom(options);
      const duplicate = Array.from(records).some(record =>
        record.active &&
        record.type === type &&
        record.listener === listener &&
        record.capture === capture,
      );
      if (!duplicate) {
        const record: ListenerRecord = {
          active: true,
          listener,
          capture,
          type,
        };
        records.add(record);
        if (typeof options === 'object' && options.signal) {
          const onAbort = () => {
            record.active = false;
          };
          options.signal.addEventListener('abort', onAbort, { once: true });
        }
      }
      originalAdd.call(canvas, type, listener, options);
    }) as typeof canvas.addEventListener;

    canvas.removeEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ) => {
      const capture = captureFrom(options);
      for (const record of records) {
        if (record.active && record.type === type && record.listener === listener && record.capture === capture) {
          record.active = false;
        }
      }
      originalRemove.call(canvas, type, listener, options);
    }) as typeof canvas.removeEventListener;

    const scheduledFrameIds = this.scheduledFrameIds;
    window.requestAnimationFrame = (callback) => {
      let frameId = 0;
      frameId = this.originalRequestAnimationFrame.call(window, (timestamp) => {
        scheduledFrameIds.delete(frameId);
        callback(timestamp);
      });
      scheduledFrameIds.add(frameId);
      return frameId;
    };
    window.cancelAnimationFrame = (frameId) => {
      scheduledFrameIds.delete(frameId);
      this.originalCancelAnimationFrame.call(window, frameId);
    };
  }

  snapshot(): RuntimeDiagnosticSnapshot {
    const instances = this.getOwnedInstances();
    const handlers = Object.fromEntries(EVENT_TYPES.map(type => [type, 0])) as Record<EventType, number>;
    let componentTeardowns = 0;
    let mainTeardowns = 0;

    for (const instance of instances) {
      for (const type of EVENT_TYPES) {
        handlers[type] += instance.events[type].size;
      }
      mainTeardowns += teardownCount(instance.mainTeardowns);
      for (const refs of instance.refs.values()) {
        componentTeardowns += teardownCount(refs.teardowns);
      }
    }

    return {
      instances: instances.length,
      nativeListeners: Array.from(this.listenerRecords).filter(record => record.active).length,
      handlers,
      componentTeardowns,
      mainTeardowns,
      scheduledFrames: this.scheduledFrameIds.size,
    };
  }

  restore(): void {
    if (this.restored) {
      return;
    }
    this.restored = true;
    this.canvas.addEventListener = this.originalAddEventListener;
    this.canvas.removeEventListener = this.originalRemoveEventListener;
    window.requestAnimationFrame = this.originalRequestAnimationFrame;
    window.cancelAnimationFrame = this.originalCancelAnimationFrame;
  }

  private getOwnedInstances(): CRCInstance[] {
    const ownedCanvases = new Set<Canvas>([this.canvas]);
    let foundNewCanvas = true;
    while (foundNewCanvas) {
      foundNewCanvas = false;
      for (const [canvas, instance] of GLOBAL_STATE.crcInstances) {
        if (instance.parent && ownedCanvases.has(instance.parent) && !ownedCanvases.has(canvas)) {
          ownedCanvases.add(canvas);
          foundNewCanvas = true;
        }
      }
    }
    return Array.from(ownedCanvases)
      .map(canvas => GLOBAL_STATE.crcInstances.get(canvas))
      .filter((instance): instance is CRCInstance => Boolean(instance));
  }
}
