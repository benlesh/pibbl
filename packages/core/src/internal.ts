import type { PibblInternalFrame, pibblInternalOnRenderFinish, pibblInternalRequestRender } from './lib/scheduler/renderer-participant.js';
import type { PibblConfig, PibblPixelRatio } from './lib/surface/types.js';
/**
 * @packageDocumentation
 * Reserved for official Pibbl packages that are released in lockstep with
 * `@pibbl/core`. This version-coupled module is not a stable third-party plugin
 * API and intentionally does not re-export the public root module.
 */

export { createBackendToken } from "./lib/backend/types.js";
export type {
  PibblBackendDriver,
  PibblBackendEventTargetOptions,
  PibblBackendFrame,
  PibblBackendFrameInput,
  PibblBackendMount,
  PibblBackendMountOptions,
  PibblBackendPrimitiveDefinition,
  PibblBackendPrimitiveInput,
  PibblBackendPrimitiveProgram,
  PibblBackendToken,
  PibblNestedResolverInput,
} from "./lib/backend/types.js";
export type { SignalProgramProps, SignalStyle } from "./lib/types.js";
export {
  pibblInternalRunPurePrimitiveResolver,
  defineBackendPrimitive,
  derivePrimitive,
} from "./lib/define-primitive.js";
export { mountBackendPibbl } from "./lib/mount-pibbl.js";
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
export type { PibblEventTargetRegistration } from "./lib/events/registrations.js";
export type { PibblElementSource } from "./lib/element/metadata.js";
export { pibblInternalCreatePropAttachment } from "./lib/element-enhancers.js";
export type {
  PibblInternalMountedPropAttachment,
  PibblInternalPrimitiveAttachmentInput,
} from "./lib/element-enhancers.js";
export type { PibblHitTestOutput } from "./lib/events/paint-entry.js";
export { hasPibblEventHandler } from "./lib/events/event-definitions.js";
export {
  pibblInternalCurrentSimulationOwner,
  pibblInternalOnSimulationRenderTransactionFinish,
  pibblInternalQueueSimulationBegin,
  pibblInternalQueueSimulationCommitAcknowledgement,
  pibblInternalQueueSimulationComplete,
  pibblInternalRegisterSimulationAdvance,
  pibblInternalRequestSimulationRender,
} from "./lib/scheduler/simulation-participant.js";
export type {
  PibblInternalAdvanceLane,
  PibblInternalSimulationOwner,
} from "./lib/scheduler/simulation-participant.js";

import type {
  PibblBackendEventTargetOptions,
  PibblBackendMount,
  PibblBackendToken,
  PibblNestedResolverInput,
} from "./lib/backend/types.js";
import {
  createTarget,
  releaseTarget,
  updateTarget,
  type PibblEventTargetRegistration,
} from "./lib/events/registrations.js";
import { PibblPaintEntryKind } from "./lib/events/paint-entry.js";
import type { PibblEventHandlers, PibblPointerEvents } from "./lib/events/types.js";
import { getCurrentPibblInstance, GLOBAL_STATE } from "./lib/global-state.js";
import {
  requireHookContext,
  useInternalHookSlot,
} from "./lib/hooks/hook-slot.js";
import { getCurrentWorldTransform } from "./lib/render-target.js";
import {
  getElementSource,
  type PibblElementSource,
} from "./lib/element/metadata.js";
import { getSurfaceSnapshot } from "./lib/surface/transform.js";
import type {
  Canvas,
  PibblComponentRefs,
  PibblInstance,
} from "./lib/types.js";
import type { PibblInteractionLayer } from "./lib/types.js";
import { update } from "./lib/update.js";
import { queueBeginCommand } from "./lib/scheduler/realm-scheduler.js";
import type { PibblBeginCommandHandle } from "./lib/scheduler/types.js";

interface CurrentInstanceFrameRequestState {
  readonly componentRefs: PibblComponentRefs<any>;
  readonly instance: PibblInstance;
  active: boolean;
  handle: PibblBeginCommandHandle | undefined;
  updateParents: boolean;
}

const frameRequestsByComponent = new WeakMap<
  PibblComponentRefs<any>,
  CurrentInstanceFrameRequestState
>();
/**
 * Reads the selected official backend's current frame environment.
 *
 * @param token - Backend identity required by the caller. See {@link PibblBackendToken}.
 * @returns The active environment for that backend.
 *
 * @see {@link PibblBackendToken}
 */
export function getBackendEnvironment<E>(token: PibblBackendToken): E {
  const driver = GLOBAL_STATE.backendDriver;
  const frame = GLOBAL_STATE.backendFrame;
  if (!driver || !frame || driver.token !== token) {
    throw new Error("The requested Pibbl backend environment is not active.");
  }
  return frame.environment as E;
}

/**
 * Returns the timestamp shared by the current Pibbl render transaction.
 *
 * @returns The active frame timestamp in milliseconds.
 *
 * @see {@link PibblInternalFrame}
 */
export function getCurrentFrameTimestamp(): number {
  return getCurrentPibblInstance().renderTimestamp;
}

/**
 * Returns the active instance's owning Canvas, never a transient filter target.
 *
 * @returns The host canvas of the active backend mount. See {@link Canvas}.
 *
 * @see {@link Canvas}
 */
export function getCurrentBackendHostCanvas(): Canvas {
  return getCurrentPibblInstance().canvas;
}

/**
 * Returns development JSX source metadata for the current component.
 *
 * @returns Source metadata for the current element, or undefined when unavailable. See
 * {@link PibblElementSource} .
 *
 * @see {@link PibblElementSource}
 */
export function getCurrentElementSource(): PibblElementSource | undefined {
  const { componentRefs } = requireHookContext();
  return getElementSource(componentRefs.element);
}

/**
 * Returns the active surface's independent effective backing densities.
 *
 * @returns Backing pixels per logical unit on each axis.
 *
 * @see {@link PibblPixelRatio}
 */
export function getCurrentSurfaceDensity(): Readonly<{ x: number; y: number }> {
  const surface = getSurfaceSnapshot(getCurrentPibblInstance());
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
 * @see {@link PibblConfig}
 */
export function getCurrentLogicalViewport(): Readonly<{
  width: number;
  height: number;
}> {
  const surface = getSurfaceSnapshot(getCurrentPibblInstance());
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
 * @see {@link pibblInternalOnRenderFinish}
 */
export function onCurrentRenderFinish(
  callback: (success: boolean) => void,
): void {
  requireHookContext();
  const transaction = GLOBAL_STATE.renderTransaction;
  if (!transaction) {
    throw new Error("No Pibbl render transaction is active.");
  }
  transaction.onFinish(callback);
}

/**
 * Requests a coalesced frame for the current private backend instance.
 *
 * @param updateParents - Whether ancestor compositions should also receive a frame request.
 *
 * @see {@link pibblInternalRequestRender}
 */
export function requestCurrentInstanceFrame(updateParents: boolean): void {
  const { componentRefs, pibblInstance } = requireHookContext();
  let state = frameRequestsByComponent.get(componentRefs);
  if (!state) {
    state = {
      componentRefs,
      instance: pibblInstance,
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
 * @param handlers - Handlers for the backend target. See {@link PibblEventHandlers}.
 * @param options - Backend geometry and focus metadata. See {@link PibblBackendEventTargetOptions}.
 * @param pointerEvents - Pointer participation policy; defaults to auto. See
 * {@link PibblPointerEvents} .
 * @returns The live registration, or undefined when registration is unnecessary. See
 * {@link PibblEventTargetRegistration} .
 *
 * @see {@link PibblEventHandlers}
 * @see {@link PibblBackendEventTargetOptions}
 * @see {@link PibblPointerEvents}
 * @see {@link PibblEventTargetRegistration}
 */
export function useBackendEventTarget(
  handlers: PibblEventHandlers,
  options: PibblBackendEventTargetOptions = {},
  pointerEvents: PibblPointerEvents = "auto",
): PibblEventTargetRegistration | undefined {
  const { componentRefs, pibblInstance } = requireHookContext();
  const hookIndex = GLOBAL_STATE.componentHookIndex;
  const slot = useInternalHookSlot("backendEventTarget", (teardowns) => {
    const target = createTarget(pibblInstance, componentRefs, hookIndex);
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
 * {@link PibblEventTargetRegistration} .
 * @returns Whether the target registration is still live.
 *
 * @see {@link PibblEventTargetRegistration}
 */
export function isBackendEventTargetLive(
  target: PibblEventTargetRegistration,
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
 * @param target - Target registration to release. See {@link PibblEventTargetRegistration}.
 *
 * @see {@link PibblEventTargetRegistration}
 */
export function releaseBackendEventTarget(
  target: PibblEventTargetRegistration,
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
 * @see {@link pibblInternalOnRenderFinish}
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
 * {@link PibblNestedResolverInput} .
 *
 * @see {@link PibblNestedResolverInput}
 */
export function registerNestedInteractionResolver(
  input: PibblNestedResolverInput,
): void {
  const { componentRefs, pibblInstance } = requireHookContext();
  const childInstance = backendMountInstance(input.child);
  if (
    childInstance.parent !== pibblInstance.canvas ||
    childInstance.eventRoot !== pibblInstance.eventRoot
  ) {
    throw new Error(
      "A nested Pibbl backend mount must belong to the current instance and same event root.",
    );
  }
  const slot = useInternalHookSlot<{
    entry: PibblInteractionLayer;
    child: PibblBackendMount;
  }>("nestedInteractionResolver", (teardowns) => {
    const entry: PibblInteractionLayer = {
      paintKind: PibblPaintEntryKind.Resolver,
      instance: childInstance,
      bounds: input.bounds,
      transform: new DOMMatrix(),
      clippingStack: [],
      resolveLocal: input.resolveLocal,
    };
    const value = { entry, child: input.child };
    teardowns.add(() => {
      pibblInstance.paintEntries.delete(entry);
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
      "A nested Pibbl backend mount already belongs to another nested resolver.",
    );
  }
  pibblInstance.paintEntries.delete(entry);
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
    pibblInstance.paintEntries.add(entry);
  }
}

function backendMountInstance(mount: PibblBackendMount) {
  const instance = GLOBAL_STATE.pibblInstances.get(mount.canvas);
  if (!instance) {
    throw new Error("Nested Pibbl backend mount is not active.");
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
    GLOBAL_STATE.pibblInstances.get(state.instance.canvas) === state.instance &&
    state.instance.refs.get(state.componentRefs.id) === state.componentRefs
  );
}
export {
  pibblInternalAssertCommandAllowed,
  pibblInternalCreateSignalConsumer,
  pibblInternalCurrentFrame,
  pibblInternalCurrentRenderOwner,
  pibblInternalOnRenderFinish,
  pibblInternalPaintTarget,
  pibblInternalQueueBegin,
  pibblInternalQueueComplete,
  pibblInternalQueueCurrentCommit,
  pibblInternalQueueCurrentComplete,
  pibblInternalRegisterAdvance,
  pibblInternalRequestRender,
  pibblInternalRequestRendererWork,
} from "./lib/scheduler/renderer-participant.js";
export type {
  PibblInternalCommandHandle,
  PibblInternalFrame,
  PibblInternalRendererWorkKind,
  PibblInternalRenderOwner,
  PibblInternalSignalBatch,
  PibblInternalSignalConsumer,
} from "./lib/scheduler/renderer-participant.js";

export { pushLayoutBox } from "./lib/layout/context.js";

export {
  ManualSchedulerDriver as PibblInternalManualSchedulerDriver,
  installSchedulerDriverForTest as pibblInternalInstallTestSchedulerDriver,
  snapshotRealmScheduler as pibblInternalSnapshotRealmScheduler,
} from "./lib/scheduler/testing.js";

export { getCurrentWorldTransform as pibblInternalCurrentWorldTransform } from "./lib/render-target.js";

export { borrowTextureRaster, resolveTexturePaint, validateTexturePaint } from './lib/textures/texture-protocol.js';
export type { BorrowedTextureRaster } from './lib/textures/texture-protocol.js';
