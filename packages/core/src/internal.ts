import type { CRCInternalFrame, crcInternalOnRenderFinish, crcInternalRequestRender } from './lib/scheduler/renderer-participant.js';
import type { CRCConfig, CRCPixelRatio } from './lib/surface/types.js';
/**
 * @packageDocumentation
 * Reserved for official CRC packages that are released in lockstep with
 * `@crc/core`. This version-coupled module is not a stable third-party plugin
 * API and intentionally does not re-export the public root module.
 */

export { createBackendToken } from "./lib/backend/types.js";
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
} from "./lib/backend/types.js";
export type { SignalProgramProps, SignalStyle } from "./lib/types.js";
export {
  crcInternalRunPurePrimitiveResolver,
  defineBackendPrimitive,
  derivePrimitive,
} from "./lib/define-primitive.js";
export { mountBackendCRC } from "./lib/mount-crc.js";
export {
  useInternalHookSlot,
  withHooksForbidden,
} from "./lib/hooks/hook-slot.js";
export { useValueMemoSlot as useInternalValueMemoSlot } from "./lib/hooks/use-value-memo-slot.js";
export {
  haveSameLayerNodeTree,
  materializeRetainedLayerChildren,
  snapshotLayerNodeTree,
} from "./lib/components/layer-node-equality.js";
export type { LayerNodeSnapshot } from "./lib/components/layer-node-equality.js";
export type { CRCEventTargetRegistration } from "./lib/events/registrations.js";
export type { CRCElementSource } from "./lib/element/metadata.js";
export { crcInternalCreatePropAttachment } from "./lib/element-enhancers.js";
export type {
  CRCInternalMountedPropAttachment,
  CRCInternalPrimitiveAttachmentInput,
} from "./lib/element-enhancers.js";
export type { CRCHitTestOutput } from "./lib/events/paint-entry.js";
export { hasCRCEventHandler } from "./lib/events/event-definitions.js";
export {
  crcInternalCurrentSimulationOwner,
  crcInternalOnSimulationRenderTransactionFinish,
  crcInternalQueueSimulationBegin,
  crcInternalQueueSimulationCommitAcknowledgement,
  crcInternalQueueSimulationComplete,
  crcInternalRegisterSimulationAdvance,
  crcInternalRequestSimulationRender,
} from "./lib/scheduler/simulation-participant.js";
export type {
  CRCInternalAdvanceLane,
  CRCInternalSimulationOwner,
} from "./lib/scheduler/simulation-participant.js";

import type {
  CRCBackendEventTargetOptions,
  CRCBackendMount,
  CRCBackendToken,
  CRCNestedResolverInput,
} from "./lib/backend/types.js";
import {
  createTarget,
  releaseTarget,
  updateTarget,
  type CRCEventTargetRegistration,
} from "./lib/events/registrations.js";
import { CRCPaintEntryKind } from "./lib/events/paint-entry.js";
import type { CRCEventHandlers, CRCPointerEvents } from "./lib/events/types.js";
import { getCurrentCRCInstance, GLOBAL_STATE } from "./lib/global-state.js";
import {
  requireHookContext,
  useInternalHookSlot,
} from "./lib/hooks/hook-slot.js";
import { getCurrentWorldTransform } from "./lib/render-target.js";
import {
  getElementSource,
  type CRCElementSource,
} from "./lib/element/metadata.js";
import { getSurfaceSnapshot } from "./lib/surface/transform.js";
import type {
  Canvas,
  CRCComponentRefs,
  CRCInstance,
} from "./lib/types.js";
import type { CRCInteractionLayer } from "./lib/types.js";
import { update } from "./lib/update.js";
import { queueBeginCommand } from "./lib/scheduler/realm-scheduler.js";
import type { CRCBeginCommandHandle } from "./lib/scheduler/types.js";

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
/**
 * Reads the selected official backend's current frame environment.
 *
 * @param token - Backend identity required by the caller. See {@link CRCBackendToken}.
 * @returns The active environment for that backend.
 *
 * @see {@link CRCBackendToken}
 */
export function getBackendEnvironment<E>(token: CRCBackendToken): E {
  const driver = GLOBAL_STATE.backendDriver;
  const frame = GLOBAL_STATE.backendFrame;
  if (!driver || !frame || driver.token !== token) {
    throw new Error("The requested CRC backend environment is not active.");
  }
  return frame.environment as E;
}

/**
 * Returns the timestamp shared by the current CRC render transaction.
 *
 * @returns The active frame timestamp in milliseconds.
 *
 * @see {@link CRCInternalFrame}
 */
export function getCurrentFrameTimestamp(): number {
  return getCurrentCRCInstance().renderTimestamp;
}

/**
 * Returns the active instance's owning Canvas, never a transient filter target.
 *
 * @returns The host canvas of the active backend mount. See {@link Canvas}.
 *
 * @see {@link Canvas}
 */
export function getCurrentBackendHostCanvas(): Canvas {
  return getCurrentCRCInstance().canvas;
}

/**
 * Returns development JSX source metadata for the current component.
 *
 * @returns Source metadata for the current element, or undefined when unavailable. See
 * {@link CRCElementSource} .
 *
 * @see {@link CRCElementSource}
 */
export function getCurrentElementSource(): CRCElementSource | undefined {
  const { componentRefs } = requireHookContext();
  return getElementSource(componentRefs.element);
}

/**
 * Returns the active surface's independent effective backing densities.
 *
 * @returns Backing pixels per logical unit on each axis.
 *
 * @see {@link CRCPixelRatio}
 */
export function getCurrentSurfaceDensity(): Readonly<{ x: number; y: number }> {
  const surface = getSurfaceSnapshot(getCurrentCRCInstance());
  return Object.freeze({
    x: surface.backingPixelsPerLogicalUnitX,
    y: surface.backingPixelsPerLogicalUnitY,
  });
}

/**
 * Returns the active root-logical viewport for an official renderer hook.
 *
 * @returns The current logical viewport width and height.
 *
 * @see {@link CRCConfig}
 */
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

/**
 * Registers a callback on the root-wide transaction containing this render.
 *
 * @param callback - Callback receiving whether the current render transaction succeeded.
 *
 * @see {@link crcInternalOnRenderFinish}
 */
export function onCurrentRenderFinish(
  callback: (success: boolean) => void,
): void {
  requireHookContext();
  const transaction = GLOBAL_STATE.renderTransaction;
  if (!transaction) {
    throw new Error("No CRC render transaction is active.");
  }
  transaction.onFinish(callback);
}

/**
 * Requests a coalesced frame for the current private backend instance.
 *
 * @param updateParents - Whether ancestor compositions should also receive a frame request.
 *
 * @see {@link crcInternalRequestRender}
 */
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
    componentRefs.teardowns.add(() =>
      releaseCurrentInstanceFrameRequest(state!),
    );
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

/**
 * Retains one geometry-independent target for an official backend picker.
 *
 * @param handlers - Handlers for the backend target. See {@link CRCEventHandlers}.
 * @param options - Backend geometry and focus metadata. See {@link CRCBackendEventTargetOptions}.
 * @param pointerEvents - Pointer participation policy; defaults to auto. See
 * {@link CRCPointerEvents} .
 * @returns The live registration, or undefined when registration is unnecessary. See
 * {@link CRCEventTargetRegistration} .
 *
 * @see {@link CRCEventHandlers}
 * @see {@link CRCBackendEventTargetOptions}
 * @see {@link CRCPointerEvents}
 * @see {@link CRCEventTargetRegistration}
 */
export function useBackendEventTarget(
  handlers: CRCEventHandlers,
  options: CRCBackendEventTargetOptions = {},
  pointerEvents: CRCPointerEvents = "auto",
): CRCEventTargetRegistration | undefined {
  const { componentRefs, crcInstance } = requireHookContext();
  const hookIndex = GLOBAL_STATE.componentHookIndex;
  const slot = useInternalHookSlot("backendEventTarget", (teardowns) => {
    const target = createTarget(crcInstance, componentRefs, hookIndex);
    teardowns.add(() => releaseTarget(target));
    return { target, emptyPath: new Path2D() };
  });
  const { target, emptyPath } = slot.value;
  if (pointerEvents === "none") {
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

/**
 * Tests whether an official backend target can still win coordinate picking.
 *
 * @param target - Registration whose ownership is being checked. See
 * {@link CRCEventTargetRegistration} .
 * @returns Whether the target registration is still live.
 *
 * @see {@link CRCEventTargetRegistration}
 */
export function isBackendEventTargetLive(
  target: CRCEventTargetRegistration,
): boolean {
  const { owner } = target;
  return (
    target.live &&
    !owner.mainTeardowns.closed &&
    owner.eventRoot.targets.has(target)
  );
}

/**
 * Temporarily releases one backend target; its retained hook may enroll it again.
 *
 * @param target - Target registration to release. See {@link CRCEventTargetRegistration}.
 *
 * @see {@link CRCEventTargetRegistration}
 */
export function releaseBackendEventTarget(
  target: CRCEventTargetRegistration,
): void {
  releaseTarget(target);
  target.keyboardNavigationBounds = undefined;
  target.keyboardNavigationPoints = undefined;
}

/**
 * Registers work that runs after this component's rendered descendants.
 *
 * @param callback - Callback to execute after the current component renders.
 *
 * @see {@link crcInternalOnRenderFinish}
 */
export function setCurrentComponentAfterRender(callback: () => void): void {
  const { componentRefs } = requireHookContext();
  const previous = componentRefs.onAfterRender;
  componentRefs.onAfterRender = previous
    ? () => {
        try {
          previous();
        } finally {
          callback();
        }
      }
    : callback;
}

/**
 * Installs one stable nested backend resolver in the current Canvas paint order.
 *
 * @param input - Nested coordinate resolver and its target metadata. See
 * {@link CRCNestedResolverInput} .
 *
 * @see {@link CRCNestedResolverInput}
 */
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
      "A nested CRC backend mount must belong to the current instance and same event root.",
    );
  }
  const slot = useInternalHookSlot<{
    entry: CRCInteractionLayer;
    child: CRCBackendMount;
  }>("nestedInteractionResolver", (teardowns) => {
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
      "A nested CRC backend mount already belongs to another nested resolver.",
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
  if (input.pointerEvents === "auto") {
    crcInstance.paintEntries.add(entry);
  }
}

function backendMountInstance(mount: CRCBackendMount) {
  const instance = GLOBAL_STATE.crcInstances.get(mount.canvas);
  if (!instance) {
    throw new Error("Nested CRC backend mount is not active.");
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

}

function isCurrentInstanceFrameRequestActive(
  state: CurrentInstanceFrameRequestState,
): boolean {
  return (
    state.active &&
    !state.componentRefs.teardowns.closed &&
    !state.instance.mainTeardowns.closed &&
    GLOBAL_STATE.crcInstances.get(state.instance.canvas) === state.instance &&
    state.instance.refs.get(state.componentRefs.id) === state.componentRefs
  );
}
export {
  crcInternalAssertCommandAllowed,
  crcInternalCreateSignalConsumer,
  crcInternalCurrentFrame,
  crcInternalCurrentRenderOwner,
  crcInternalOnRenderFinish,
  crcInternalPaintTarget,
  crcInternalQueueBegin,
  crcInternalQueueComplete,
  crcInternalQueueCurrentCommit,
  crcInternalQueueCurrentComplete,
  crcInternalRegisterAdvance,
  crcInternalRequestRender,
  crcInternalRequestRendererWork,
} from "./lib/scheduler/renderer-participant.js";
export type {
  CRCInternalCommandHandle,
  CRCInternalFrame,
  CRCInternalRendererWorkKind,
  CRCInternalRenderOwner,
  CRCInternalSignalBatch,
  CRCInternalSignalConsumer,
} from "./lib/scheduler/renderer-participant.js";

export { pushLayoutBox } from "./lib/layout/context.js";

export {
  ManualSchedulerDriver as CRCInternalManualSchedulerDriver,
  installSchedulerDriverForTest as crcInternalInstallTestSchedulerDriver,
  snapshotRealmScheduler as crcInternalSnapshotRealmScheduler,
} from "./lib/scheduler/testing.js";

export { getCurrentWorldTransform as crcInternalCurrentWorldTransform } from "./lib/render-target.js";

export { borrowTextureRaster, resolveTexturePaint, validateTexturePaint } from './lib/textures/texture-protocol.js';
export type { BorrowedTextureRaster } from './lib/textures/texture-protocol.js';
