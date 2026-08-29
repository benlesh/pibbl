import type {
  Canvas,
  CRCInstance,
  CRCInteractionRegion,
} from '../../src/lib/types';
import { GLOBAL_STATE } from '../../src/lib/global-state';
import { CRC_EVENT_TYPES } from '../../src/lib/events/event-definitions';
import type { CRCEventType } from '../../src/lib/events/types';

type EventType = CRCEventType;
type EventHandler = (event: Event) => void;

export interface ResourceLedgerSnapshot {
  acquired: number;
  released: number;
  duplicateReleases: number;
  live: number;
}

export interface RuntimeDiagnosticLedgerSnapshot {
  nativeListeners: ResourceLedgerSnapshot;
  handlers: Record<EventType, ResourceLedgerSnapshot>;
  frames: {
    requested: number;
    canceled: number;
    completed: number;
    pending: number;
  };
}

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

interface RegistryRecord {
  handlers: Set<EventHandler>;
  originalAdd: Set<EventHandler>['add'];
  originalDelete: Set<EventHandler>['delete'];
  type: EventType;
  acquired: number;
  released: number;
  duplicateReleases: number;
}

interface RegionRegistryRecord {
  regions: Set<CRCInteractionRegion>;
  originalAdd: Set<CRCInteractionRegion>['add'];
  originalDelete: Set<CRCInteractionRegion>['delete'];
  acquired: Record<EventType, number>;
  released: Record<EventType, number>;
  duplicateReleases: Record<EventType, number>;
}

const EVENT_TYPES: readonly EventType[] = CRC_EVENT_TYPES;

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
  private readonly registryRecords = new Map<Set<EventHandler>, RegistryRecord>();
  private readonly regionRegistryRecords = new Map<Set<CRCInteractionRegion>, RegionRegistryRecord>();
  private readonly scheduledFrameIds = new Set<number>();
  private readonly originalAddEventListener: HTMLCanvasElement['addEventListener'];
  private readonly originalRemoveEventListener: HTMLCanvasElement['removeEventListener'];
  private readonly originalRequestAnimationFrame = window.requestAnimationFrame;
  private readonly originalCancelAnimationFrame = window.cancelAnimationFrame;
  private nativeListenerAcquired = 0;
  private nativeListenerReleased = 0;
  private nativeListenerDuplicateReleases = 0;
  private frameRequested = 0;
  private frameCanceled = 0;
  private frameCompleted = 0;
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
        this.nativeListenerAcquired++;
        if (typeof options === 'object' && options.signal) {
          const onAbort = () => {
            if (record.active) {
              record.active = false;
              this.nativeListenerReleased++;
            }
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
      let released = false;
      for (const record of records) {
        if (record.active && record.type === type && record.listener === listener && record.capture === capture) {
          record.active = false;
          released = true;
          this.nativeListenerReleased++;
        }
      }
      if (!released) {
        this.nativeListenerDuplicateReleases++;
      }
      originalRemove.call(canvas, type, listener, options);
    }) as typeof canvas.removeEventListener;

    const scheduledFrameIds = this.scheduledFrameIds;
    window.requestAnimationFrame = (callback) => {
      let frameId = 0;
      frameId = this.originalRequestAnimationFrame.call(window, (timestamp) => {
        if (scheduledFrameIds.delete(frameId)) {
          this.frameCompleted++;
        }
        callback(timestamp);
      });
      this.frameRequested++;
      scheduledFrameIds.add(frameId);
      return frameId;
    };
    window.cancelAnimationFrame = (frameId) => {
      if (scheduledFrameIds.delete(frameId)) {
        this.frameCanceled++;
      }
      this.originalCancelAnimationFrame.call(window, frameId);
    };
  }

  snapshot(): RuntimeDiagnosticSnapshot {
    const instances = this.getOwnedInstances();
    this.observeRegistries(instances);
    const handlers = Object.fromEntries(EVENT_TYPES.map(type => [type, 0])) as Record<EventType, number>;
    let componentTeardowns = 0;
    let mainTeardowns = 0;

    const eventRoots = new Set(instances.map(instance => instance.eventRoot));
    for (const eventRoot of eventRoots) {
      for (const type of EVENT_TYPES) {
        handlers[type] += eventRoot.observers.get(type)?.size ?? 0;
        handlers[type] += Array.from(eventRoot.targets)
          .filter(region => regionHasHandler(region, type)).length;
      }
    }
    for (const instance of instances) {
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

  ledgerSnapshot(): RuntimeDiagnosticLedgerSnapshot {
    this.observeRegistries(this.getOwnedInstances());
    const handlers = Object.fromEntries(EVENT_TYPES.map(type => [
      type,
      { acquired: 0, released: 0, duplicateReleases: 0, live: 0 },
    ])) as Record<EventType, ResourceLedgerSnapshot>;

    for (const record of this.registryRecords.values()) {
      const ledger = handlers[record.type];
      ledger.acquired += record.acquired;
      ledger.released += record.released;
      ledger.duplicateReleases += record.duplicateReleases;
      ledger.live += record.handlers.size;
    }
    for (const record of this.regionRegistryRecords.values()) {
      for (const type of EVENT_TYPES) {
        const ledger = handlers[type];
        ledger.acquired += record.acquired[type];
        ledger.released += record.released[type];
        ledger.duplicateReleases += record.duplicateReleases[type];
        ledger.live += Array.from(record.regions)
          .filter(region => regionHasHandler(region, type)).length;
      }
    }

    return {
      nativeListeners: {
        acquired: this.nativeListenerAcquired,
        released: this.nativeListenerReleased,
        duplicateReleases: this.nativeListenerDuplicateReleases,
        live: Array.from(this.listenerRecords).filter(record => record.active).length,
      },
      handlers,
      frames: {
        requested: this.frameRequested,
        canceled: this.frameCanceled,
        completed: this.frameCompleted,
        pending: this.scheduledFrameIds.size,
      },
    };
  }

  restore(): void {
    if (this.restored) {
      return;
    }
    this.restored = true;
    this.canvas.addEventListener = this.originalAddEventListener;
    this.canvas.removeEventListener = this.originalRemoveEventListener;
    for (const record of this.registryRecords.values()) {
      record.handlers.add = record.originalAdd;
      record.handlers.delete = record.originalDelete;
    }
    this.registryRecords.clear();
    for (const record of this.regionRegistryRecords.values()) {
      record.regions.add = record.originalAdd;
      record.regions.delete = record.originalDelete;
    }
    this.regionRegistryRecords.clear();
    window.requestAnimationFrame = this.originalRequestAnimationFrame;
    window.cancelAnimationFrame = this.originalCancelAnimationFrame;
  }

  private observeRegistries(instances: readonly CRCInstance[]): void {
    const eventRoots = new Set(instances.map(instance => instance.eventRoot));
    for (const eventRoot of eventRoots) {
      for (const type of EVENT_TYPES) {
        const handlers = eventRoot.observers.get(type) as Set<EventHandler>;
        if (this.registryRecords.has(handlers)) {
          continue;
        }
        const record: RegistryRecord = {
          handlers,
          originalAdd: handlers.add,
          originalDelete: handlers.delete,
          type,
          acquired: handlers.size,
          released: 0,
          duplicateReleases: 0,
        };
        this.registryRecords.set(handlers, record);
        handlers.add = ((handler: EventHandler) => {
          if (!handlers.has(handler)) {
            record.acquired++;
          }
          return record.originalAdd.call(handlers, handler);
        }) as typeof handlers.add;
        handlers.delete = ((handler: EventHandler) => {
          if (handlers.has(handler)) {
            record.released++;
          } else {
            record.duplicateReleases++;
          }
          return record.originalDelete.call(handlers, handler);
        }) as typeof handlers.delete;
      }

      const regions = eventRoot.targets;
      if (!this.regionRegistryRecords.has(regions)) {
        const emptyCounts = () => Object.fromEntries(
          EVENT_TYPES.map(type => [type, 0]),
        ) as Record<EventType, number>;
        const record: RegionRegistryRecord = {
          regions,
          originalAdd: regions.add,
          originalDelete: regions.delete,
          acquired: emptyCounts(),
          released: emptyCounts(),
          duplicateReleases: emptyCounts(),
        };
        for (const region of regions) {
          for (const type of EVENT_TYPES) {
            if (regionHasHandler(region, type)) {
              record.acquired[type]++;
            }
          }
        }
        this.regionRegistryRecords.set(regions, record);
        regions.add = ((region: CRCInteractionRegion) => {
          if (!regions.has(region)) {
            for (const type of EVENT_TYPES) {
              if (regionHasHandler(region, type)) {
                record.acquired[type]++;
              }
            }
          }
          return record.originalAdd.call(regions, region);
        }) as typeof regions.add;
        regions.delete = ((region: CRCInteractionRegion) => {
          if (regions.has(region)) {
            for (const type of EVENT_TYPES) {
              if (regionHasHandler(region, type)) {
                record.released[type]++;
              }
            }
          } else {
            for (const type of EVENT_TYPES) {
              if (regionHasHandler(region, type)) {
                record.duplicateReleases[type]++;
              }
            }
          }
          return record.originalDelete.call(regions, region);
        }) as typeof regions.delete;
      }
    }
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

function regionHasHandler(
  region: CRCInteractionRegion,
  type: EventType,
): boolean {
  return Boolean((region.handlers as Partial<Record<EventType, unknown>>)[type]);
}
