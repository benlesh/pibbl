import { Canvas, CompRefs, CRCInstance, RenderingContext2D } from './types';

export interface ClippingStackEntry {
  path: Path2D;
  fillRule: CanvasFillRule;
  transform: DOMMatrix;
}

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
  mouseTransform: DOMMatrix | undefined;
  clippingStack: ClippingStackEntry[];
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
  mouseTransform: undefined,
  clippingStack: [],
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
  for (const crcInstance of GLOBAL_STATE.crcInstances.values()) {
    cleanupCRCInstance(crcInstance);
  }
  GLOBAL_STATE.crcInstances.clear();
  GLOBAL_STATE.clippingStack = [];
  GLOBAL_STATE.anonElementNames = new WeakMap<any, string>();
  clearTempState();
}

export function cleanupCRCInstance(crcInstance: CRCInstance) {
  crcInstance.mainTeardowns.execute();
}

export function clearTempState() {
  GLOBAL_STATE.unseenIds = undefined;
  GLOBAL_STATE.seenIds = undefined;
  GLOBAL_STATE.canvas = undefined;
  GLOBAL_STATE.renderContext = undefined;
  clearComponentState();
}

export function clearComponentState() {
  GLOBAL_STATE.componentRefs = undefined;
  GLOBAL_STATE.componentIsMounting = false;
  GLOBAL_STATE.componentHookIndex = 0;
}
