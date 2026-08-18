import type { LayoutContext } from './layout/types.js';
import { Canvas, CompRefs, CRCClippingStackEntry, CRCInstance, RenderingContext2D } from './types.js';

export interface GlobalState {
  crcInstances: Map<Canvas, CRCInstance>;
  currentCRCInstance: CRCInstance | undefined;
  componentRefs: CompRefs<any> | undefined;
  canvas: Canvas | undefined;
  componentIsMounting: boolean;
  componentHookIndex: number;
  renderContext: RenderingContext2D | undefined;
  unseenIds: Set<string> | undefined;
  seenIds: Set<string> | undefined;
  seenKeys: Set<string> | undefined;
  clippingStack: CRCClippingStackEntry[];
  layoutStack: LayoutContext[] | undefined;
  anonElementNames: WeakMap<any, string>;
  anon: number;
}

export const GLOBAL_STATE: GlobalState = {
  crcInstances: new Map(),
  currentCRCInstance: undefined,
  componentRefs: undefined,
  canvas: undefined,
  componentIsMounting: false,
  componentHookIndex: 0,
  renderContext: undefined,
  unseenIds: undefined,
  seenIds: undefined,
  seenKeys: undefined,
  clippingStack: [],
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

export function getCurrentCRCInstance() {
  if (!GLOBAL_STATE.currentCRCInstance) {
    throw new Error('No CRC instance available');
  }
  return GLOBAL_STATE.currentCRCInstance;
}

export function getInteractionRoot(crcInstance: CRCInstance): CRCInstance {
  return crcInstance.interactionRoot ?? crcInstance;
}

export function getCRCInstance(canvas: Canvas) {
  const crcInstance = GLOBAL_STATE.crcInstances.get(canvas);
  if (!crcInstance) {
    throw new Error('CRC instance not found');
  }
  return crcInstance;
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
  for (const crcInstance of Array.from(GLOBAL_STATE.crcInstances.values())) {
    crcInstance.controller.dispose();
  }
  GLOBAL_STATE.crcInstances.clear();
  GLOBAL_STATE.clippingStack = [];
  GLOBAL_STATE.layoutStack = undefined;
  GLOBAL_STATE.anonElementNames = new WeakMap<any, string>();
  clearTempState();
}

export function cleanupCRCInstance(crcInstance: CRCInstance): void {
  const { canvas } = crcInstance;
  if (GLOBAL_STATE.crcInstances.get(canvas) !== crcInstance) {
    return;
  }

  if (crcInstance.animationFrameId !== undefined) {
    cancelAnimationFrame(crcInstance.animationFrameId);
    crcInstance.animationFrameId = undefined;
  }

  GLOBAL_STATE.crcInstances.delete(canvas);
  crcInstance.mainTeardowns.execute();
  for (const handlers of Object.values(crcInstance.events)) {
    handlers.clear();
  }
  crcInstance.regions?.clear();
  crcInstance.paintEntries?.clear();
  crcInstance.cursorDefaults?.clear();
  const interaction = crcInstance.interaction;
  if (interaction) {
    if (
      interaction.cursorCanvas &&
      interaction.cursorStyle &&
      interaction.cursorCanvas.style.cursor === interaction.cursorStyle
    ) {
      interaction.cursorCanvas.style.removeProperty('cursor');
    }
    interaction.hoveredRegion = undefined;
    interaction.primaryDownRegion = undefined;
    interaction.primaryUpRegion = undefined;
    interaction.clickStreakRegion = undefined;
    interaction.clickStreak = 0;
    interaction.cursorRegion = undefined;
    interaction.cursorDefault = undefined;
    interaction.pointerCanvas = undefined;
    interaction.cursorCanvas = undefined;
    interaction.cursorStyle = undefined;
  }
  crcInstance.refs.clear();
  crcInstance.pendingRoot = undefined;
  crcInstance.pendingUpdateParents = false;
}

export function clearTempState() {
  GLOBAL_STATE.unseenIds = undefined;
  GLOBAL_STATE.seenIds = undefined;
  GLOBAL_STATE.seenKeys = undefined;
  GLOBAL_STATE.canvas = undefined;
  GLOBAL_STATE.renderContext = undefined;
  GLOBAL_STATE.layoutStack = undefined;
  clearComponentState();
}

export function clearComponentState() {
  GLOBAL_STATE.componentRefs = undefined;
  GLOBAL_STATE.componentIsMounting = false;
  GLOBAL_STATE.componentHookIndex = 0;
}
