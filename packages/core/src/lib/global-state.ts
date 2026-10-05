import type { LayoutContext } from './layout/types.js';
import type { PibblNode } from './element/types.js';
import type { RenderTargetSnapshot } from './render-target.js';
import type { PibblFrameSnapshot } from './scheduler/types.js';
import { unregisterRootInstance } from './scheduler/realm-scheduler.js';
import type {
  PibblBackendDriver,
  PibblBackendFrame,
} from './backend/types.js';
import type {
  Canvas,
  PibblComponentRefs,
  PibblClippingStackEntry,
  PibblInstance,
  PibblRenderTransaction,
  RenderingContext2D,
} from './types.js';
import { runTeardown } from './teardowns.js';

export const NO_PENDING_ROOT = Symbol('PIBBL_NO_PENDING_ROOT');
export type PendingRoot = PibblNode | typeof NO_PENDING_ROOT;

/** @internal Exact Pibbl-owned presentation transforms for the active traversal. */
export interface PibblPresentationTransformLineage {
  readonly parent: PibblPresentationTransformLineage | undefined;
  readonly localTransform: DOMMatrix;
  /** Number of raw Canvas transform deltas absorbed before this Pibbl node. */
  readonly untrackedCanvasTransformCount: number;
}

export interface GlobalState {
  pibblInstances: Map<Canvas, PibblInstance>;
  currentPibblInstance: PibblInstance | undefined;
  componentRefs: PibblComponentRefs<any> | undefined;
  canvas: Canvas | undefined;
  componentIsMounting: boolean;
  componentHookIndex: number;
  backendDriver: PibblBackendDriver<unknown> | undefined;
  backendFrame: PibblBackendFrame<unknown> | undefined;
  backendEnvironment: unknown;
  renderContext: RenderingContext2D | undefined;
  renderTarget: RenderTargetSnapshot | undefined;
  worldBaseTransform: DOMMatrix | undefined;
  worldExactTransform: DOMMatrix | undefined;
  worldPaintAnchorTransform: DOMMatrix | undefined;
  presentationTransformLineage: PibblPresentationTransformLineage | undefined;
  presentationTransformLineageTrackingDepth: number;
  renderTransaction: PibblRenderTransaction | undefined;
  frameSnapshot: PibblFrameSnapshot | undefined;
  primitiveReceiverToken: object | undefined;
  seenIds: Set<string> | undefined;
  seenKeys: Set<string> | undefined;
  clippingStack: PibblClippingStackEntry[];
  htmlFilterDepth: number;
  layoutStack: LayoutContext[] | undefined;
  anonElementNames: WeakMap<any, string>;
  anon: number;
}

export const GLOBAL_STATE: GlobalState = {
  pibblInstances: new Map(),
  currentPibblInstance: undefined,
  componentRefs: undefined,
  canvas: undefined,
  componentIsMounting: false,
  componentHookIndex: 0,
  backendDriver: undefined,
  backendFrame: undefined,
  backendEnvironment: undefined,
  renderContext: undefined,
  renderTarget: undefined,
  worldBaseTransform: undefined,
  worldExactTransform: undefined,
  worldPaintAnchorTransform: undefined,
  presentationTransformLineage: undefined,
  presentationTransformLineageTrackingDepth: 0,
  renderTransaction: undefined,
  frameSnapshot: undefined,
  primitiveReceiverToken: undefined,
  seenIds: undefined,
  seenKeys: undefined,
  clippingStack: [],
  htmlFilterDepth: 0,
  layoutStack: undefined,
  anonElementNames: new WeakMap(),
  anon: 0,
};

export function getComponentRefs() {
  if (!GLOBAL_STATE.componentRefs) {
    throw new Error('No component refs available');
  }
  return GLOBAL_STATE.componentRefs;
}

export function getCanvas() {
  if (!GLOBAL_STATE.canvas) {
    throw new Error('No canvas available');
  }
  return GLOBAL_STATE.canvas;
}

export function getCurrentPibblInstance() {
  if (!GLOBAL_STATE.currentPibblInstance) {
    throw new Error('No Pibbl instance available');
  }
  return GLOBAL_STATE.currentPibblInstance;
}

export function getInteractionRoot(pibblInstance: PibblInstance): PibblInstance {
  return pibblInstance.interactionRoot ?? pibblInstance;
}

export function getPibblInstance(canvas: Canvas) {
  const pibblInstance = GLOBAL_STATE.pibblInstances.get(canvas);
  if (!pibblInstance) {
    throw new Error('Pibbl instance not found');
  }
  return pibblInstance;
}

/**
 * Used to get a name for an anonymous function.
 * @param fn The anonymous function to get a name for
 * @returns A name for the anonymous function
 */
export function getAnonElemName(fn: any) {
  if (!GLOBAL_STATE.anonElementNames.has(fn)) {
    GLOBAL_STATE.anonElementNames.set(fn, `Anon${GLOBAL_STATE.anon++}`);
  }
  return GLOBAL_STATE.anonElementNames.get(fn)!;
}

/**
 * Useful for testing and HMR.
 * DO NOT USE IN PROD
 */
export function clearSharedState() {
  for (const pibblInstance of Array.from(GLOBAL_STATE.pibblInstances.values())) {
    pibblInstance.controller.dispose();
  }
  GLOBAL_STATE.pibblInstances.clear();
  GLOBAL_STATE.clippingStack = [];
  GLOBAL_STATE.layoutStack = undefined;
  GLOBAL_STATE.anonElementNames = new WeakMap<any, string>();
  clearTempState();
}

export function cleanupPibblInstance(pibblInstance: PibblInstance): void {
  const { canvas } = pibblInstance;
  if (pibblInstance.mainTeardowns.closed) {
    return;
  }

  if (!pibblInstance.parent) {
    unregisterRootInstance(pibblInstance);
  }

  if (GLOBAL_STATE.pibblInstances.get(canvas) === pibblInstance) {
    GLOBAL_STATE.pibblInstances.delete(canvas);
  }
  pibblInstance.eventParent = undefined;
  pibblInstance.focusParentBridge = undefined;
  pibblInstance.mainTeardowns.execute();
  runTeardown(() => pibblInstance.backendDriver.dispose());
  runTeardown(() => {
    for (const service of pibblInstance.optionalServices.values()) service.dispose();
    pibblInstance.optionalServices.clear();
  });
  if (!pibblInstance.parent) {
    for (const observers of pibblInstance.eventRoot.observers.values()) {
      observers.clear();
    }
    pibblInstance.eventRoot.observers.clear();
    pibblInstance.eventRoot.targets.clear();
    for (const listeners of pibblInstance.eventRoot.listenersByComponent.values()) {
      listeners.clear();
    }
    pibblInstance.eventRoot.listenersByComponent.clear();
    pibblInstance.eventRoot.pointerCaptures.clear();
    pibblInstance.eventRoot.onNodeRelease = undefined;
    pibblInstance.eventRoot.onTargetUpdate = undefined;
    pibblInstance.eventRoot.focusPolicy = undefined;
    pibblInstance.eventRoot.renderTransaction = undefined;
    pibblInstance.eventRoot.rootInstance = undefined;
  }
  pibblInstance.regions?.clear();
  pibblInstance.paintEntries?.clear();
  pibblInstance.cursorDefaults?.clear();
  const interaction = pibblInstance.interaction;
  if (interaction) {
    if (
      interaction.cursorCanvas &&
      interaction.cursorStyle &&
      interaction.cursorCanvas.style.cursor === interaction.cursorStyle
    ) {
      interaction.cursorCanvas.style.removeProperty('cursor');
    }
    interaction.hoveredRegion = undefined;
    interaction.primaryDown = undefined;
    interaction.primaryUp = undefined;
    interaction.auxiliaryDown.clear();
    interaction.auxiliaryUp.clear();
    interaction.clickStreakTarget = undefined;
    interaction.clickStreak = 0;
    interaction.cursorRegion = undefined;
    interaction.cursorDefault = undefined;
    interaction.pointerCanvas = undefined;
    interaction.cursorCanvas = undefined;
    interaction.cursorStyle = undefined;
  }
  pibblInstance.refs.clear();
  pibblInstance.pendingRoot = NO_PENDING_ROOT;
  pibblInstance.pendingUpdateParents = false;
}

export function clearTempState() {
  GLOBAL_STATE.seenIds = undefined;
  GLOBAL_STATE.seenKeys = undefined;
  GLOBAL_STATE.canvas = undefined;
  GLOBAL_STATE.backendDriver = undefined;
  GLOBAL_STATE.backendFrame = undefined;
  GLOBAL_STATE.backendEnvironment = undefined;
  GLOBAL_STATE.renderContext = undefined;
  GLOBAL_STATE.renderTarget = undefined;
  GLOBAL_STATE.worldBaseTransform = undefined;
  GLOBAL_STATE.worldExactTransform = undefined;
  GLOBAL_STATE.worldPaintAnchorTransform = undefined;
  GLOBAL_STATE.presentationTransformLineage = undefined;
  GLOBAL_STATE.presentationTransformLineageTrackingDepth = 0;
  GLOBAL_STATE.renderTransaction = undefined;
  GLOBAL_STATE.frameSnapshot = undefined;
  GLOBAL_STATE.primitiveReceiverToken = undefined;
  GLOBAL_STATE.layoutStack = undefined;
  clearComponentState();
}

export function clearComponentState() {
  GLOBAL_STATE.componentRefs = undefined;
  GLOBAL_STATE.componentIsMounting = false;
  GLOBAL_STATE.componentHookIndex = 0;
}
