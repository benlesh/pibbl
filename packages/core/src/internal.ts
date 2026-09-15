/**
 * @packageDocumentation
 * Reserved for official CRC packages that are released in lockstep with
 * `@crc/core`. This version-coupled module is not a stable third-party plugin
 * API and intentionally does not re-export the public root module.
 */

export {
  createBackendToken,
} from './lib/backend/types.js';
export type {
  CRCBackendDriver,
  CRCBackendEventTargetOptions,
  CRCBackendFrame,
  CRCBackendFrameInput,
  CRCBackendMount,
  CRCBackendMountOptions,
  CRCBackendPrimitiveDefinition,
  CRCBackendPrimitiveInput,
  CRCBackendPrimitiveProgram,
  CRCBackendToken,
  CRCNestedResolverInput,
} from './lib/backend/types.js';
export { defineBackendPrimitive } from './lib/define-primitive.js';
export { executeBackendCRC } from './lib/execute-render.js';
export { mountBackendCRC } from './lib/mount-crc.js';
export { useInternalHookSlot } from './lib/hooks/hook-slot.js';
export {
  haveSameLayerNodeTree,
  materializeRetainedLayerChildren,
  snapshotLayerNodeTree,
} from './lib/components/layer-node-equality.js';
export type {
  LayerNodeSnapshot,
} from './lib/components/layer-node-equality.js';
export type {
  CRCEventTargetRegistration,
} from './lib/events/registrations.js';
export type { CRCElementSource } from './lib/element/metadata.js';
export type {
  CRCHitTestOutput,
} from './lib/events/paint-entry.js';
export { hasCRCEventHandler } from './lib/events/event-definitions.js';

import type {
  CRCBackendEventTargetOptions,
  CRCBackendMount,
  CRCBackendToken,
  CRCNestedResolverInput,
} from './lib/backend/types.js';
import {
  createTarget,
  releaseTarget,
  updateTarget,
  type CRCEventTargetRegistration,
} from './lib/events/registrations.js';
import { CRCPaintEntryKind } from './lib/events/paint-entry.js';
import type {
  CRCEventHandlers,
  CRCPointerEvents,
} from './lib/events/types.js';
import {
  getCurrentCRCInstance,
  GLOBAL_STATE,
} from './lib/global-state.js';
import {
  requireHookContext,
  useInternalHookSlot,
} from './lib/hooks/hook-slot.js';
import { getCurrentWorldTransform } from './lib/render-target.js';
import {
  getElementSource,
  type CRCElementSource,
} from './lib/element/metadata.js';
import { getSurfaceSnapshot } from './lib/surface/transform.js';
import type {
  Canvas,
  CRCComponentRefs,
  CRCInstance,
  CRCNode,
} from './lib/types.js';
import type { CRCInteractionLayer } from './lib/types.js';
import { update } from './lib/update.js';
import { queueBeginCommand } from './lib/scheduler/realm-scheduler.js';
import type { CRCBeginCommandHandle } from './lib/scheduler/types.js';

interface CurrentInstanceFrameRequestState {
  readonly componentRefs: CRCComponentRefs<any>;
  readonly instance: CRCInstance;
  active: boolean;
  handle: CRCBeginCommandHandle | undefined;
  updateParents: boolean;
}

const frameRequestsByComponent = new WeakMap<
  CRCComponentRefs<any>,
  CurrentInstanceFrameRequestState
>();
const frameRequestsByInstance = new WeakMap<
  CRCInstance,
  Set<CurrentInstanceFrameRequestState>
>();

/** Reads the selected official backend's current frame environment. */
export function getBackendEnvironment<E>(token: CRCBackendToken): E {
  const driver = GLOBAL_STATE.backendDriver;
  const frame = GLOBAL_STATE.backendFrame;
  if (!driver || !frame || driver.token !== token) {
    throw new Error('The requested CRC backend environment is not active.');
  }
  return frame.environment as E;
}

/** Returns the timestamp shared by the current CRC render transaction. */
export function getCurrentFrameTimestamp(): number {
  return getCurrentCRCInstance().renderTimestamp;
}

/** Returns the active instance's owning Canvas, never a transient filter target. */
export function getCurrentBackendHostCanvas(): Canvas {
  return getCurrentCRCInstance().canvas;
}

/** Returns development JSX source metadata for the current component. */
export function getCurrentElementSource(): CRCElementSource | undefined {
  const { componentRefs } = requireHookContext();
  return getElementSource(componentRefs.element);
}

/** Returns the active surface's independent effective backing densities. */
export function getCurrentSurfaceDensity(): Readonly<{ x: number; y: number }> {
  const surface = getSurfaceSnapshot(getCurrentCRCInstance());
  return Object.freeze({
    x: surface.backingPixelsPerLogicalUnitX,
    y: surface.backingPixelsPerLogicalUnitY,
  });
}

/** Returns the active root-logical viewport for an official renderer hook. */
export function getCurrentLogicalViewport(): Readonly<{
  width: number;
  height: number;
}> {
  const surface = getSurfaceSnapshot(getCurrentCRCInstance());
  return Object.freeze({
    width: surface.logicalWidth,
    height: surface.logicalHeight,
  });
}

/** Registers a callback on the root-wide transaction containing this render. */
export function onCurrentRenderFinish(
  callback: (success: boolean) => void,
): void {
  requireHookContext();
  const transaction = GLOBAL_STATE.renderTransaction;
  if (!transaction) {
    throw new Error('No CRC render transaction is active.');
  }
  transaction.onFinish(callback);
}

/** Requests a coalesced frame for the current private backend instance. */
export function requestCurrentInstanceFrame(updateParents: boolean): void {
  const { componentRefs, crcInstance } = requireHookContext();
  let state = frameRequestsByComponent.get(componentRefs);
  if (!state) {
    state = {
      componentRefs,
      instance: crcInstance,
      active: true,
      handle: undefined,
      updateParents: false,
    };
    frameRequestsByComponent.set(componentRefs, state);
    let instanceRequests = frameRequestsByInstance.get(crcInstance);
    if (!instanceRequests) {
      instanceRequests = new Set();
      frameRequestsByInstance.set(crcInstance, instanceRequests);
    }
    instanceRequests.add(state);
    componentRefs.teardowns.add(() => releaseCurrentInstanceFrameRequest(state!));
  }
  state.updateParents ||= updateParents;
  if (state.handle) return;
  state.handle = queueBeginCommand(() => {
    state!.handle = undefined;
    const updateParentsForFrame = state!.updateParents;
    state!.updateParents = false;
    if (!isCurrentInstanceFrameRequestActive(state!)) return;
    if (updateParentsForFrame) {
      update(state!.instance.canvas, undefined, true);
    } else {
      update(state!.instance.canvas);
    }
  });
}

/** Retains one geometry-independent target for an official backend picker. */
export function useBackendEventTarget(
  handlers: CRCEventHandlers,
  options: CRCBackendEventTargetOptions = {},
  pointerEvents: CRCPointerEvents = 'auto',
): CRCEventTargetRegistration | undefined {
  const { componentRefs, crcInstance } = requireHookContext();
  const hookIndex = GLOBAL_STATE.componentHookIndex;
  const slot = useInternalHookSlot(
    'backendEventTarget',
    teardowns => {
      const target = createTarget(crcInstance, componentRefs, hookIndex);
      teardowns.add(() => releaseTarget(target));
      return { target, emptyPath: new Path2D() };
    },
  );
  const { target, emptyPath } = slot.value;
  if (pointerEvents === 'none') {
    releaseTarget(target);
    return undefined;
  }
  updateTarget(
    target,
    handlers,
    { ...options, path: emptyPath },
    true,
    options.deferKeyboardNavigationGeometry ?? false,
  );
  if (target.paintEntry) {
    target.owner.paintEntries.delete(target.paintEntry);
    target.paintEntry = undefined;
  }
  return target;
}

/** Tests whether an official backend target can still win coordinate picking. */
export function isBackendEventTargetLive(
  target: CRCEventTargetRegistration,
): boolean {
  const { owner } = target;
  return target.live &&
    !owner.mainTeardowns.closed &&
    owner.eventRoot.targets.has(target);
}

/** Temporarily releases one backend target; its retained hook may enroll it again. */
export function releaseBackendEventTarget(
  target: CRCEventTargetRegistration,
): void {
  releaseTarget(target);
  target.keyboardNavigationBounds = undefined;
  target.keyboardNavigationPoints = undefined;
}

/** Cancels work owned by one private backend mount without disposing its state. */
export function cancelBackendMountFrame(mount: CRCBackendMount): void {
  const instance = backendMountInstance(mount);
  mount.cancelFrame();
  for (const request of frameRequestsByInstance.get(instance) ?? []) {
    cancelCurrentInstanceFrameRequest(request);
  }
}

/** Retains a private backend's latest root without scheduling or traversing it. */
export function retainBackendMountRoot(
  mount: CRCBackendMount,
  root: CRCNode,
): void {
  backendMountInstance(mount);
  mount.retainRoot(root);
}

/** Registers work that runs after this component's rendered descendants. */
export function setCurrentComponentAfterRender(callback: () => void): void {
  const { componentRefs } = requireHookContext();
  const previous = componentRefs.onAfterRender;
  componentRefs.onAfterRender = previous ? () => {
    try {
      previous();
    } finally {
      callback();
    }
  } : callback;
}

/** Installs one stable nested backend resolver in the current Canvas paint order. */
export function registerNestedInteractionResolver(
  input: CRCNestedResolverInput,
): void {
  const { componentRefs, crcInstance } = requireHookContext();
  const childInstance = backendMountInstance(input.child);
  if (
    childInstance.parent !== crcInstance.canvas ||
    childInstance.eventRoot !== crcInstance.eventRoot
  ) {
    throw new Error(
      'A nested CRC backend mount must belong to the current instance and same event root.',
    );
  }
  const slot = useInternalHookSlot<{
    entry: CRCInteractionLayer;
    child: CRCBackendMount;
  }>('nestedInteractionResolver', teardowns => {
    const entry: CRCInteractionLayer = {
      paintKind: CRCPaintEntryKind.Resolver,
      instance: childInstance,
      bounds: input.bounds,
      transform: new DOMMatrix(),
      clippingStack: [],
      resolveLocal: input.resolveLocal,
    };
    const value = { entry, child: input.child };
    teardowns.add(() => {
      crcInstance.paintEntries.delete(entry);
      if (entry.instance.focusParentBridge === entry) {
        entry.instance.focusParentBridge = undefined;
      }
      if (entry.instance.eventParent === componentRefs) {
        entry.instance.eventParent = undefined;
      }
    });
    return value;
  });
  const { entry } = slot.value;
  if (
    (childInstance.eventParent !== undefined &&
      childInstance.eventParent !== componentRefs) ||
    (childInstance.focusParentBridge !== undefined &&
      childInstance.focusParentBridge !== entry)
  ) {
    throw new Error(
      'A nested CRC backend mount already belongs to another nested resolver.',
    );
  }
  crcInstance.paintEntries.delete(entry);
  if (slot.value.child !== input.child) {
    if (entry.instance.focusParentBridge === entry) {
      entry.instance.focusParentBridge = undefined;
    }
    if (entry.instance.eventParent === componentRefs) {
      entry.instance.eventParent = undefined;
    }
    slot.value.child = input.child;
  }
  entry.instance = childInstance;
  entry.instance.eventParent = componentRefs;
  entry.bounds = input.bounds;
  entry.transform = getCurrentWorldTransform();
  entry.clippingStack = Array.from(GLOBAL_STATE.clippingStack);
  entry.resolveLocal = input.resolveLocal;
  entry.instance.focusParentBridge = entry;
  if (input.pointerEvents === 'auto') {
    crcInstance.paintEntries.add(entry);
  }
}

function backendMountInstance(mount: CRCBackendMount) {
  const instance = GLOBAL_STATE.crcInstances.get(mount.canvas);
  if (!instance) {
    throw new Error('Nested CRC backend mount is not active.');
  }
  return instance;
}

function cancelCurrentInstanceFrameRequest(
  state: CurrentInstanceFrameRequestState,
): void {
  state.handle?.cancel();
  state.handle = undefined;
  state.updateParents = false;
}

function releaseCurrentInstanceFrameRequest(
  state: CurrentInstanceFrameRequestState,
): void {
  if (!state.active) return;
  state.active = false;
  cancelCurrentInstanceFrameRequest(state);
  frameRequestsByComponent.delete(state.componentRefs);
  const instanceRequests = frameRequestsByInstance.get(state.instance);
  instanceRequests?.delete(state);
  if (instanceRequests?.size === 0) {
    frameRequestsByInstance.delete(state.instance);
  }
}

function isCurrentInstanceFrameRequestActive(
  state: CurrentInstanceFrameRequestState,
): boolean {
  return state.active &&
    !state.componentRefs.teardowns.closed &&
    !state.instance.mainTeardowns.closed &&
    GLOBAL_STATE.crcInstances.get(state.instance.canvas) === state.instance &&
    state.instance.refs.get(state.componentRefs.id) === state.componentRefs;
}
export {
  crcInternalCreateSignalConsumer,
  crcInternalCurrentFrame,
  crcInternalCurrentRenderOwner,
  crcInternalQueueComplete,
  crcInternalRequestRendererWork,
} from './lib/scheduler/renderer-participant.js';
export type {
  CRCInternalFrame,
  CRCInternalRendererWorkKind,
  CRCInternalRenderOwner,
  CRCInternalSignalConsumer,
} from './lib/scheduler/renderer-participant.js';
