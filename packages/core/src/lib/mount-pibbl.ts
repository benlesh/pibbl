import { reserveHtmlOverlay } from './html/overlay-config.js';
import {
  cleanupPibblInstance,
  GLOBAL_STATE,
  NO_PENDING_ROOT,
} from './global-state.js';
import { PIBBL_EVENT_TYPES } from './events/event-definitions.js';
import {
  dispatchNativeEvent,
  refreshInteractionCursor,
  releaseEventNodeState,
} from './events/dispatch.js';
import { createNativeListenerHub } from './events/native-listener-hub.js';
import type { PibblEventType as DOMPibblEventType } from './events/types.js';
import { Teardowns } from './teardowns.js';
import {
  Canvas,
  PibblController,
  PibblEventRoot,
  PibblInstance,
  PibblNativeObserver,
  type PibblNode,
} from './types.js';
import type { PibblConfig, PibblSurfaceSnapshot } from './surface/types.js';
import {
  createLegacyLayerSurfaceState,
  createRootSurfaceState,
  mountRootSurface,
} from './surface/root-surface.js';
import { CANVAS_2D_BACKEND } from './backend/canvas-2d-backend.js';
import type {
  PibblBackendDriver,
  PibblBackendMount,
  PibblBackendMountOptions,
} from './backend/types.js';
import { createLayerSurface } from './surface/resolve-surface.js';
import { executeRender } from './execute-render.js';
import { update } from './update.js';
import {
  queueBeginCommand,
  registerRootInstance,
} from './scheduler/realm-scheduler.js';
import type { PibblBeginCommandHandle } from './scheduler/types.js';

type MountPibblConfig = PibblConfig & {
  parent?: Canvas;
  surface?: PibblSurfaceSnapshot;
  driver?: PibblBackendDriver<unknown>;
};

export function mountPibbl(
  canvas: Canvas,
  element: PibblNode,
  config?: MountPibblConfig,
): PibblController {
  if (GLOBAL_STATE.pibblInstances.has(canvas)) {
    throw new Error('Pibbl is already mounted on this element.');
  }
  const mainTeardowns = new Teardowns();
  const signal = config?.signal;
  let ownedInstance: PibblInstance | undefined;
  const controller: PibblController = {
    dispose(): void {
      const instance = ownedInstance;
      if (!instance) {
        return;
      }
      cleanupPibblInstance(instance);
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

  const parentInstance = parent ? GLOBAL_STATE.pibblInstances.get(parent) : undefined;
  if (parent && !parentInstance) {
    throw new Error('Parent Pibbl interaction root not found');
  }

  let pibblInstance: PibblInstance;
  const eventRoot: PibblEventRoot = parentInstance?.eventRoot ?? createEventRoot(
    rootCanvas,
    mainTeardowns,
    (type, event) => {
      dispatchNativeEvent(pibblInstance, type, event);
    },
  );

  pibblInstance = {
    canvas,
    controller,
    root: element,
    pendingRoot: NO_PENDING_ROOT,
    pendingUpdateParents: false,
    refs: new Map(),
    renderGeneration: 0,
    renderSeenIds: new Set(),
    renderSeenKeys: new Set(),
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
    optionalServices: new Map(),
    backendDriver: config?.driver ?? CANVAS_2D_BACKEND,
  };
  pibblInstance.interactionRoot = parent ?
      GLOBAL_STATE.pibblInstances.get(parent)?.interactionRoot :
    pibblInstance;
  if (!pibblInstance.interactionRoot) throw new Error('Parent Pibbl interaction root not found');
  if (!parent) {
    eventRoot.rootInstance = pibblInstance;
    eventRoot.onNodeRelease = node => releaseEventNodeState(pibblInstance, node);
    eventRoot.onTargetUpdate = target =>
      refreshInteractionCursor(pibblInstance, target);
  }
  ownedInstance = pibblInstance;
  GLOBAL_STATE.pibblInstances.set(canvas, pibblInstance);

  try {
    if (config?.htmlOverlay) reserveHtmlOverlay(pibblInstance, config.htmlOverlay);
    if (!parent && rootCanvas) {
      mountRootSurface(pibblInstance, rootCanvas);
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

  if (!parent && GLOBAL_STATE.pibblInstances.get(canvas) === pibblInstance) {
    registerRootInstance(pibblInstance);
  }

  return controller;
}

/**
 * Mounts a private official-backend Pibbl child under an existing Pibbl root.
 *
 * @param canvas - Host canvas for this backend mount. See {@link Canvas}.
 * @param root - Initial Pibbl node tree. See {@link PibblNode}.
 * @param options - Backend driver and mount configuration. See {@link PibblBackendMountOptions}.
 * @returns Mount controls for rendering, resizing, scheduling, and disposal. See
 * {@link PibblBackendMount} .
 *
 * @see {@link Canvas}
 * @see {@link PibblNode}
 * @see {@link PibblBackendMountOptions}
 * @see {@link PibblBackendMount}
 */
export function mountBackendPibbl<E>(
  canvas: Canvas,
  root: PibblNode,
  options: PibblBackendMountOptions<E>,
): PibblBackendMount {
  const { logicalWidth, logicalHeight } = options;
  const surface = createLayerSurface(
    logicalWidth,
    logicalHeight,
    canvas.width / logicalWidth,
    canvas.height / logicalHeight,
  );
  const controller = mountPibbl(canvas, root, {
    parent: options.parent,
    surface,
    driver: options.driver as PibblBackendDriver<unknown>,
  });
  const instance = GLOBAL_STATE.pibblInstances.get(canvas);
  if (!instance) {
    throw new Error('Pibbl backend mount did not retain its instance.');
  }
  const requireActiveInstance = () => {
    if (
      instance.mainTeardowns.closed ||
      GLOBAL_STATE.pibblInstances.get(canvas) !== instance
    ) {
      throw new Error('Pibbl backend mount is no longer active.');
    }
  };
  let pendingFrame: PibblBeginCommandHandle | undefined;
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
        throw new Error('Pibbl backend mount does not own a managed layer surface.');
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
    render(nextRoot: PibblNode, timestamp: number): void {
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
    dispose(): void {
      cancelFrame();
      controller.dispose();
    },
  });
}

function createEventRoot(
  canvas: HTMLCanvasElement | undefined,
  teardowns: Teardowns,
  dispatch: (type: DOMPibblEventType, event: Event) => void,
): PibblEventRoot {
  const nativeListeners = canvas ? createNativeListenerHub(
    canvas,
    (definition, event) => dispatch(definition.type, event),
    teardowns,
  ) : undefined;
  const observers = new Map<DOMPibblEventType, Set<PibblNativeObserver>>(
    PIBBL_EVENT_TYPES.map(type => [
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
  type: DOMPibblEventType,
  nativeListeners: PibblEventRoot['nativeListeners'],
): Set<PibblNativeObserver> {
  const observers = new Set<PibblNativeObserver>();
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
