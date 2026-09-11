/**
 * Unsupported, version-coupled friend API for official CRC sibling packages.
 * Applications should use the stable exports from `@crc/core` instead.
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
export type {
  CRCHitTestOutput,
} from './lib/events/paint-entry.js';

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
  NO_PENDING_ROOT,
} from './lib/global-state.js';
import {
  requireHookContext,
  useInternalHookSlot,
} from './lib/hooks/hook-slot.js';
import { getCurrentWorldTransform } from './lib/render-target.js';
import { getSurfaceSnapshot } from './lib/surface/transform.js';
import type { Canvas, CRCNode } from './lib/types.js';
import type { CRCInteractionLayer } from './lib/types.js';
import { update } from './lib/update.js';
import { runTeardown } from './lib/teardowns.js';

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

/** Returns the active surface's independent effective backing densities. */
export function getCurrentSurfaceDensity(): Readonly<{ x: number; y: number }> {
  const surface = getSurfaceSnapshot(getCurrentCRCInstance());
  return Object.freeze({
    x: surface.backingPixelsPerLogicalUnitX,
    y: surface.backingPixelsPerLogicalUnitY,
  });
}

/** Requests a coalesced frame for the current private backend instance. */
export function requestCurrentInstanceFrame(updateParents: boolean): void {
  const { canvas } = getCurrentCRCInstance();
  if (updateParents) {
    update(canvas, undefined, true);
  } else {
    update(canvas);
  }
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
  const frameId = instance.animationFrameId;
  instance.animationFrameId = undefined;
  instance.pendingRoot = NO_PENDING_ROOT;
  instance.pendingUpdateParents = false;
  if (frameId !== undefined) {
    runTeardown(() => cancelAnimationFrame(frameId));
  }
}

/** Retains a private backend's latest root without scheduling or traversing it. */
export function retainBackendMountRoot(
  mount: CRCBackendMount,
  root: CRCNode,
): void {
  backendMountInstance(mount).pendingRoot = root;
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
