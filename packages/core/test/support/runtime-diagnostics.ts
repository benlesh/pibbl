import type {
  Canvas,
  PibblInstance,
} from '../../src/lib/types';
import type {
  PibblEventListenerRegistration,
  PibblEventTargetRegistration,
} from '../../src/lib/events/registrations';
import { GLOBAL_STATE } from '../../src/lib/global-state';
import { PIBBL_EVENT_TYPES } from '../../src/lib/events/event-definitions';
import type { PibblEventType } from '../../src/lib/events/types';

type EventType = PibblEventType;
type EventHandler = (event: Event) => void;

export interface ResourceLedgerSnapshot {
  acquired: number;
  released: number;
  duplicateReleases: number;
  live: number;
}

export interface RuntimeDiagnosticLedgerSnapshot {
  nativeListeners: ResourceLedgerSnapshot;
  documentListeners: ResourceLedgerSnapshot;
  handlers: Record<EventType, ResourceLedgerSnapshot>;
  frames: {
    requested: number;
    canceled: number;
    completed: number;
    pending: number;
  };
}

export interface RuntimeDiagnosticSnapshot {
  documentListeners: number;
  enhancers: number;
  eventTargets: number;
  focusCandidates: number;
  focusManagers: number;
  focusedTarget: FocusTargetIdentity | null;
  focusedTargets: number;
  instances: number;
  nativeListeners: number;
  handlers: Record<EventType, number>;
  componentTeardowns: number;
  mainTeardowns: number;
  pointerCaptures: number;
  propagationListeners: number;
  navigationBoundaries: number;
  pendingActivations: number;
  scheduledFrames: number;
  tabIndex: {
    current: TabIndexSnapshot;
    original: TabIndexSnapshot;
    owned: boolean;
  };
}

export interface FocusTargetIdentity {
  componentId: string;
  slot: number;
}

interface TabIndexSnapshot {
  existed: boolean;
  value: string | null;
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

type DiagnosticRegistration =
  | PibblEventTargetRegistration
  | PibblEventListenerRegistration;

interface RegionRegistryRecord {
  regions: Set<DiagnosticRegistration>;
  originalAdd: Set<DiagnosticRegistration>['add'];
  originalDelete: Set<DiagnosticRegistration>['delete'];
  acquired: Record<EventType, number>;
  released: Record<EventType, number>;
  duplicateReleases: Record<EventType, number>;
}

const EVENT_TYPES: readonly EventType[] = PIBBL_EVENT_TYPES;

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
  private readonly documentListenerRecords = new Set<ListenerRecord>();
  private readonly registryRecords = new Map<Set<EventHandler>, RegistryRecord>();
  private readonly regionRegistryRecords = new Map<Set<DiagnosticRegistration>, RegionRegistryRecord>();
  private readonly scheduledFrameIds = new Set<number>();
  private readonly originalAddEventListener: HTMLCanvasElement['addEventListener'];
  private readonly originalRemoveEventListener: HTMLCanvasElement['removeEventListener'];
  private readonly originalDocumentAddEventListener: Document['addEventListener'];
  private readonly originalDocumentRemoveEventListener: Document['removeEventListener'];
  private readonly originalTabIndex: TabIndexSnapshot;
  private readonly originalRequestAnimationFrame = window.requestAnimationFrame;
  private readonly originalCancelAnimationFrame = window.cancelAnimationFrame;
  private nativeListenerAcquired = 0;
  private nativeListenerReleased = 0;
  private nativeListenerDuplicateReleases = 0;
  private documentListenerAcquired = 0;
  private documentListenerReleased = 0;
  private documentListenerDuplicateReleases = 0;
  private frameRequested = 0;
  private frameCanceled = 0;
  private frameCompleted = 0;
  private restored = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.originalAddEventListener = canvas.addEventListener;
    this.originalRemoveEventListener = canvas.removeEventListener;
    this.originalDocumentAddEventListener = canvas.ownerDocument.addEventListener;
    this.originalDocumentRemoveEventListener = canvas.ownerDocument.removeEventListener;
    this.originalTabIndex = tabIndexSnapshot(canvas);
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

    const document = canvas.ownerDocument;
    const documentRecords = this.documentListenerRecords;
    const originalDocumentAdd = this.originalDocumentAddEventListener;
    const originalDocumentRemove = this.originalDocumentRemoveEventListener;
    document.addEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      const capture = captureFrom(options);
      const duplicate = Array.from(documentRecords).some(record =>
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
        documentRecords.add(record);
        this.documentListenerAcquired++;
        if (typeof options === 'object' && options.signal) {
          options.signal.addEventListener('abort', () => {
            if (record.active) {
              record.active = false;
              this.documentListenerReleased++;
            }
          }, { once: true });
        }
      }
      originalDocumentAdd.call(document, type, listener, options);
    }) as typeof document.addEventListener;
    document.removeEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ) => {
      const capture = captureFrom(options);
      let released = false;
      for (const record of documentRecords) {
        if (
          record.active &&
          record.type === type &&
          record.listener === listener &&
          record.capture === capture
        ) {
          record.active = false;
          released = true;
          this.documentListenerReleased++;
        }
      }
      if (!released) this.documentListenerDuplicateReleases++;
      originalDocumentRemove.call(document, type, listener, options);
    }) as typeof document.removeEventListener;

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
    let eventTargets = 0;
    let mainTeardowns = 0;
    let pointerCaptures = 0;
    let propagationListeners = 0;
    let enhancers = 0;
    let focusCandidates = 0;
    let focusManagers = 0;
    let focusedTarget: FocusTargetIdentity | null = null;
    let navigationBoundaries = 0;
    let pendingActivations = 0;

    const eventRoots = new Set(instances.map(instance => instance.eventRoot));
    for (const eventRoot of eventRoots) {
      eventTargets += eventRoot.targets.size;
      pointerCaptures += eventRoot.pointerCaptures.size;
      for (const type of EVENT_TYPES) {
        handlers[type] += eventRoot.observers.get(type)?.size ?? 0;
        handlers[type] += Array.from(eventRoot.targets)
          .filter(region => regionHasHandler(region, type)).length;
        for (const listeners of eventRoot.listenersByComponent.values()) {
          handlers[type] += Array.from(listeners)
            .filter(listener => regionHasHandler(listener, type)).length;
        }
      }
      for (const listeners of eventRoot.listenersByComponent.values()) {
        propagationListeners += listeners.size;
      }
      const focus = focusDiagnosticState(eventRoot.focusPolicy);
      focusCandidates += focus.candidates;
      focusManagers += focus.managers;
      enhancers += focus.managers + focus.boundaries;
      navigationBoundaries += focus.boundaries;
      pendingActivations += focus.pendingActivations;
      focusedTarget ??= focus.focusedTarget;
    }
    for (const instance of instances) {
      mainTeardowns += teardownCount(instance.mainTeardowns);
      for (const refs of instance.refs.values()) {
        componentTeardowns += teardownCount(refs.teardowns);
      }
    }

    return {
      documentListeners: activeListenerCount(this.documentListenerRecords),
      enhancers,
      eventTargets,
      focusCandidates,
      focusManagers,
      focusedTarget,
      focusedTargets: focusedTarget ? 1 : 0,
      instances: instances.length,
      nativeListeners: Array.from(this.listenerRecords).filter(record => record.active).length,
      handlers,
      componentTeardowns,
      mainTeardowns,
      pointerCaptures,
      propagationListeners,
      navigationBoundaries,
      pendingActivations,
      scheduledFrames: this.scheduledFrameIds.size,
      tabIndex: {
        current: tabIndexSnapshot(this.canvas),
        original: this.originalTabIndex,
        owned: isOwnedTabIndex(this.canvas, this.originalTabIndex),
      },
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
      documentListeners: {
        acquired: this.documentListenerAcquired,
        released: this.documentListenerReleased,
        duplicateReleases: this.documentListenerDuplicateReleases,
        live: activeListenerCount(this.documentListenerRecords),
      },
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
    this.canvas.ownerDocument.addEventListener = this.originalDocumentAddEventListener;
    this.canvas.ownerDocument.removeEventListener = this.originalDocumentRemoveEventListener;
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

  private observeRegistries(instances: readonly PibblInstance[]): void {
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

      this.observeRegistrationSet(eventRoot.targets);
      for (const listeners of eventRoot.listenersByComponent.values()) {
        this.observeRegistrationSet(listeners);
      }
    }
  }

  private observeRegistrationSet(
    regions: Set<DiagnosticRegistration>,
  ): void {
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
      regions.add = ((region: DiagnosticRegistration) => {
        if (!regions.has(region)) {
          for (const type of EVENT_TYPES) {
            if (regionHasHandler(region, type)) {
              record.acquired[type]++;
            }
          }
        }
        return record.originalAdd.call(regions, region);
      }) as typeof regions.add;
      regions.delete = ((region: DiagnosticRegistration) => {
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

  private getOwnedInstances(): PibblInstance[] {
    const ownedCanvases = new Set<Canvas>([this.canvas]);
    let foundNewCanvas = true;
    while (foundNewCanvas) {
      foundNewCanvas = false;
      for (const [canvas, instance] of GLOBAL_STATE.pibblInstances) {
        if (instance.parent && ownedCanvases.has(instance.parent) && !ownedCanvases.has(canvas)) {
          ownedCanvases.add(canvas);
          foundNewCanvas = true;
        }
      }
    }
    return Array.from(ownedCanvases)
      .map(canvas => GLOBAL_STATE.pibblInstances.get(canvas))
      .filter((instance): instance is PibblInstance => Boolean(instance));
  }
}

function regionHasHandler(
  region: DiagnosticRegistration,
  type: EventType,
): boolean {
  const handlers = region.handlers as Partial<Record<string, unknown>>;
  return Boolean(handlers[type] || handlers[`${type}Capture`]);
}

function activeListenerCount(records: ReadonlySet<ListenerRecord>): number {
  return Array.from(records).filter(record => record.active).length;
}

function tabIndexSnapshot(canvas: HTMLCanvasElement): TabIndexSnapshot {
  return {
    existed: canvas.hasAttribute('tabindex'),
    value: canvas.getAttribute('tabindex'),
  };
}

function isOwnedTabIndex(
  canvas: HTMLCanvasElement,
  original: TabIndexSnapshot,
): boolean {
  const current = tabIndexSnapshot(canvas);
  return (
    current.existed !== original.existed ||
    current.value !== original.value
  ) && (current.value === '0' || current.value === '-1');
}

function focusDiagnosticState(policy: unknown): {
  boundaries: number;
  candidates: number;
  focusedTarget: FocusTargetIdentity | null;
  managers: number;
  pendingActivations: number;
} {
  if (!policy || typeof policy !== 'object') {
    return {
      boundaries: 0,
      candidates: 0,
      focusedTarget: null,
      managers: 0,
      pendingActivations: 0,
    };
  }
  const manager = policy as {
    candidates?: readonly { directionalBoundary?: unknown }[];
    committedBoundaries?: ReadonlySet<unknown>;
    coordinator?: { managers?: ReadonlySet<unknown> };
    logicalFocusTarget?: PibblEventTargetRegistration;
    pendingSpaceTarget?: PibblEventTargetRegistration;
  };
  const candidateBoundaries = new Set(
    manager.candidates
      ?.map(candidate => candidate.directionalBoundary)
      .filter(boundary => boundary !== undefined) ?? [],
  );
  return {
    boundaries: Math.max(
      manager.committedBoundaries?.size ?? 0,
      candidateBoundaries.size,
    ),
    candidates: manager.candidates?.length ?? 0,
    focusedTarget: manager.logicalFocusTarget ? {
      componentId: manager.logicalFocusTarget.component.id,
      slot: manager.logicalFocusTarget.slot,
    } : null,
    managers: manager.coordinator?.managers?.size ?? 1,
    pendingActivations: manager.pendingSpaceTarget ? 1 : 0,
  };
}
