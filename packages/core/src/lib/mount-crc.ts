import {
  cleanupCRCInstance,
  GLOBAL_STATE,
  NO_PENDING_ROOT,
} from './global-state.js';
import { CRC_EVENT_TYPES } from './events/event-definitions.js';
import {
  dispatchNativeEvent,
  refreshInteractionCursor,
  releaseEventNodeState,
} from './events/dispatch.js';
import { createNativeListenerHub } from './events/native-listener-hub.js';
import type { CRCEventType as DOMCRCEventType } from './events/types.js';
import { Teardowns } from './teardowns.js';
import {
  Canvas,
  CRCController,
  CRCEventRoot,
  CRCInstance,
  CRCNativeObserver,
  type CRCNode,
} from './types.js';
import type { CRCConfig, CRCSurfaceSnapshot } from './surface/types.js';
import {
  createLegacyLayerSurfaceState,
  createRootSurfaceState,
  mountRootSurface,
} from './surface/root-surface.js';
import { FilterSurfacePool } from './filter/filter-surface-pool.js';
import { CANVAS_2D_BACKEND } from './backend/canvas-2d-backend.js';
import type {
  CRCBackendDriver,
  CRCBackendMount,
  CRCBackendMountOptions,
} from './backend/types.js';
import { createLayerSurface } from './surface/resolve-surface.js';
import { executeRender } from './execute-render.js';
import { update } from './update.js';
import {
  queueBeginCommand,
  registerRootInstance,
} from './scheduler/realm-scheduler.js';
import type { CRCBeginCommandHandle } from './scheduler/types.js';

type MountCRCConfig = CRCConfig & {
  parent?: Canvas;
  surface?: CRCSurfaceSnapshot;
  driver?: CRCBackendDriver<unknown>;
};

export function mountCRC(
  canvas: Canvas,
  element: CRCNode,
  config?: MountCRCConfig,
): CRCController {
  if (GLOBAL_STATE.crcInstances.has(canvas)) {
    throw new Error('CRC is already mounted on this element.');
  }
  const mainTeardowns = new Teardowns();
  const filterSurfacePool = new FilterSurfacePool();
  const signal = config?.signal;
  let ownedInstance: CRCInstance | undefined;
  const controller: CRCController = {
    dispose(): void {
      const instance = ownedInstance;
      if (!instance) {
        return;
      }
      cleanupCRCInstance(instance);
      ownedInstance = undefined;
    },
  };
  const parent = config?.parent;
  const rootCanvas = isHTMLCanvas(canvas) ? canvas : undefined;
  const surface = parent || !rootCanvas ?
    config?.surface ?
      { kind: 'layer' as const, managed: true, snapshot: config.surface } :
      createLegacyLayerSurfaceState(canvas.width, canvas.height) :
    createRootSurfaceState(rootCanvas, config);

  const parentInstance = parent ? GLOBAL_STATE.crcInstances.get(parent) : undefined;
  if (parent && !parentInstance) {
    throw new Error('Parent CRC interaction root not found');
  }

  let crcInstance: CRCInstance;
  const eventRoot: CRCEventRoot = parentInstance?.eventRoot ?? createEventRoot(
    rootCanvas,
    mainTeardowns,
    (type, event) => {
      dispatchNativeEvent(crcInstance, type, event);
    },
  );

  crcInstance = {
    canvas,
    controller,
    root: element,
    pendingRoot: NO_PENDING_ROOT,
    pendingUpdateParents: false,
    refs: new Map(),
    requestedRenderRevision: 0,
    completedRenderRevision: 0,
    renderTimestamp: 0,
    mainTeardowns,
    eventRoot,
    regions: new Set(),
    paintEntries: new Set(),
    cursorDefaults: new Set(),
    interaction: {
      hoveredRegion: undefined,
      primaryDown: undefined,
      primaryUp: undefined,
      auxiliaryDown: new Map(),
      auxiliaryUp: new Map(),
      clickStreakTarget: undefined,
      clickStreak: 0,
      cursorRegion: undefined,
      cursorDefault: undefined,
      pointerCanvas: undefined,
      cursorCanvas: undefined,
      cursorStyle: undefined,
    },
    interactionRoot: undefined,
    parent,
    eventParent: undefined,
    focusParentBridge: undefined,
    rootLayoutBox: Object.freeze({
      x: 0,
      y: 0,
      width: surface.snapshot?.logicalWidth ??
        (surface.kind === 'root' && surface.config.mode === 'fixed' ?
          surface.config.width :
          surface.kind === 'root' ? surface.display.width : canvas.width),
      height: surface.snapshot?.logicalHeight ??
        (surface.kind === 'root' && surface.config.mode === 'fixed' ?
          surface.config.height :
          surface.kind === 'root' ? surface.display.height : canvas.height),
    }),
    surface,
    filterSurfacePool,
    backendDriver: config?.driver ?? CANVAS_2D_BACKEND,
  };
  crcInstance.interactionRoot = parent ?
      GLOBAL_STATE.crcInstances.get(parent)?.interactionRoot :
    crcInstance;
  if (!crcInstance.interactionRoot) throw new Error('Parent CRC interaction root not found');
  if (!parent) {
    eventRoot.rootInstance = crcInstance;
    eventRoot.onNodeRelease = node => releaseEventNodeState(crcInstance, node);
    eventRoot.onTargetUpdate = target =>
      refreshInteractionCursor(crcInstance, target);
  }
  ownedInstance = crcInstance;
  GLOBAL_STATE.crcInstances.set(canvas, crcInstance);

  try {
    if (!parent && rootCanvas) {
      mountRootSurface(crcInstance, rootCanvas);
    }
    if (signal) {
      const abortHandler = () => controller.dispose();
      signal.addEventListener('abort', abortHandler, { once: true });
      mainTeardowns.add(() => {
        signal.removeEventListener('abort', abortHandler);
      });
    }

    if (signal?.aborted) {
      controller.dispose();
    }
  } catch (error) {
    controller.dispose();
    throw error;
  }

  if (!parent && GLOBAL_STATE.crcInstances.get(canvas) === crcInstance) {
    registerRootInstance(crcInstance);
  }

  return controller;
}

/** Mounts a private official-backend CRC child under an existing CRC root. */
export function mountBackendCRC<E>(
  canvas: Canvas,
  root: CRCNode,
  options: CRCBackendMountOptions<E>,
): CRCBackendMount {
  const { logicalWidth, logicalHeight } = options;
  const surface = createLayerSurface(
    logicalWidth,
    logicalHeight,
    canvas.width / logicalWidth,
    canvas.height / logicalHeight,
  );
  const controller = mountCRC(canvas, root, {
    parent: options.parent,
    surface,
    driver: options.driver as CRCBackendDriver<unknown>,
  });
  const instance = GLOBAL_STATE.crcInstances.get(canvas);
  if (!instance) {
    throw new Error('CRC backend mount did not retain its instance.');
  }
  const requireActiveInstance = () => {
    if (
      instance.mainTeardowns.closed ||
      GLOBAL_STATE.crcInstances.get(canvas) !== instance
    ) {
      throw new Error('CRC backend mount is no longer active.');
    }
  };
  let pendingFrame: CRCBeginCommandHandle | undefined;
  let pendingUpdateParents = false;
  const cancelFrame = () => {
    pendingFrame?.cancel();
    pendingFrame = undefined;
    pendingUpdateParents = false;
  };
  return Object.freeze({
    canvas,
    resize(nextLogicalWidth: number, nextLogicalHeight: number): void {
      requireActiveInstance();
      const nextSurface = createLayerSurface(
        nextLogicalWidth,
        nextLogicalHeight,
        canvas.width / nextLogicalWidth,
        canvas.height / nextLogicalHeight,
      );
      if (instance.surface.kind !== 'layer') {
        throw new Error('CRC backend mount does not own a managed layer surface.');
      }
      instance.surface.snapshot = nextSurface;
      instance.surface.managed = true;
      instance.rootLayoutBox = Object.freeze({
        x: 0,
        y: 0,
        width: nextSurface.logicalWidth,
        height: nextSurface.logicalHeight,
      });
    },
    render(nextRoot: CRCNode, timestamp: number): void {
      requireActiveInstance();
      executeRender(canvas, timestamp, nextRoot, false);
    },
    requestFrame(updateParents: boolean): void {
      requireActiveInstance();
      pendingUpdateParents ||= updateParents;
      if (pendingFrame) return;
      pendingFrame = queueBeginCommand(() => {
        pendingFrame = undefined;
        const updateParentsForFrame = pendingUpdateParents;
        pendingUpdateParents = false;
        requireActiveInstance();
        if (updateParentsForFrame) {
          update(canvas, undefined, true);
        } else {
          update(canvas);
        }
      });
    },
    cancelFrame(): void {
      requireActiveInstance();
      cancelFrame();
    },
    retainRoot(nextRoot: CRCNode): void {
      requireActiveInstance();
      instance.root = nextRoot;
    },
    dispose(): void {
      cancelFrame();
      controller.dispose();
    },
  });
}

function createEventRoot(
  canvas: HTMLCanvasElement | undefined,
  teardowns: Teardowns,
  dispatch: (type: DOMCRCEventType, event: Event) => void,
): CRCEventRoot {
  const nativeListeners = canvas ? createNativeListenerHub(
    canvas,
    (definition, event) => dispatch(definition.type, event),
    teardowns,
  ) : undefined;
  const observers = new Map<DOMCRCEventType, Set<CRCNativeObserver>>(
    CRC_EVENT_TYPES.map(type => [
      type,
      createNativeObserverSet(type, nativeListeners),
    ]),
  );
  return {
    rootInstance: undefined,
    canvas,
    nativeListeners,
    targets: new Set(),
    listenersByComponent: new Map(),
    observers,
    pointerCaptures: new Map(),
    onNodeRelease: undefined,
    onTargetUpdate: undefined,
  };
}

function createNativeObserverSet(
  type: DOMCRCEventType,
  nativeListeners: CRCEventRoot['nativeListeners'],
): Set<CRCNativeObserver> {
  const observers = new Set<CRCNativeObserver>();
  const originalAdd = observers.add;
  const originalDelete = observers.delete;
  const originalClear = observers.clear;
  let release: (() => void) | undefined;

  observers.add = ((observer) => {
    const wasEmpty = observers.size === 0;
    originalAdd.call(observers, observer);
    if (wasEmpty) {
      release = nativeListeners?.acquire(type);
    }
    return observers;
  }) as typeof observers.add;
  observers.delete = ((observer) => {
    const deleted = originalDelete.call(observers, observer);
    if (deleted && observers.size === 0) {
      release?.();
      release = undefined;
    }
    return deleted;
  }) as typeof observers.delete;
  observers.clear = (() => {
    if (observers.size > 0) {
      originalClear.call(observers);
      release?.();
      release = undefined;
    }
  }) as typeof observers.clear;
  return observers;
}

function isHTMLCanvas(canvas: Canvas): canvas is HTMLCanvasElement {
  return typeof HTMLCanvasElement !== 'undefined' && canvas instanceof HTMLCanvasElement;
}
