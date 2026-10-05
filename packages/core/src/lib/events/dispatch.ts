import { getInteractionRoot } from '../global-state.js';
import { batch } from '../signals/graph.js';
import type {
  PibblCursorDefault,
  PibblEventRoot,
  PibblFocusPressDefaultInput,
  PibblFocusTouchDefaultContact,
  PibblFocusTouchDefaultInput,
  PibblInstance,
  PibblInteractionActivation,
  PibblInteractionRegion,
} from '../types.js';
import {
  adaptClipboardEvent,
  isNativeClipboardEventType,
  type PibblAdaptedClipboardEvent,
} from './adapters/clipboard.js';
import {
  adaptDragEvent,
  isNativeDragEventType,
  type PibblAdaptedDragEvent,
} from './adapters/drag.js';
import {
  adaptEditingEvent,
  isNativeEditingEventType,
  type PibblAdaptedEditingEvent,
} from './adapters/editing.js';
import {
  adaptKeyboardFocusEvent,
  isNativeKeyboardFocusEventType,
  type PibblAdaptedKeyboardFocusEvent,
} from './adapters/keyboard-focus.js';
import {
  adaptMouseEvent,
  isNativeMouseEventType,
  type PibblAdaptedMouseEvent,
} from './adapters/mouse.js';
import {
  adaptPointerEvent,
  isNativePointerEventType,
  type PibblAdaptedPointerEvent,
} from './adapters/pointer.js';
import {
  adaptTouchEvent,
  isNativeTouchEventType,
  type PibblAdaptedTouchContact,
  type PibblAdaptedTouchEvent,
} from './adapters/touch.js';
import {
  adaptWheelEvent,
  isNativeWheelEventType,
  type PibblAdaptedWheelEvent,
} from './adapters/wheel.js';
import { planBoundaryTransitions } from './boundary-transitions.js';
import type { PibblOriginalEvent } from './event-facade.js';
import { buildEventPath } from './event-path.js';
import {
  resolveCoordinateOutput,
  resolveCoordinateTarget,
} from './hit-test.js';
import { PibblHitDisposition } from "./paint-entry.js";
import {
  dispatchCapturedResolverInput,
  dispatchResolvedInput,
  getResolverPointerCapture,
  type PibblResolverInputType,
} from "./resolver-input.js";
import { dispatchEventPath } from './propagation.js';
import {
  activateLogicalPointerCapture,
  cancelLogicalPointerCapture,
  consumeLogicalPointerCaptureLoss,
  getLogicalPointerCapture,
  processPendingLogicalPointerCapture,
} from './pointer-capture.js';
import {
  releaseTarget,
  type PibblEventNode,
  type PibblEventTargetRegistration,
} from './registrations.js';
import type { PibblEvent, PibblEventMap, PibblEventType } from './types.js';

interface CursorDefaultOwnership {
  readonly root: PibblInstance;
  readonly releases: readonly (() => void)[];
}

const cursorDefaultOwnership = new WeakMap<
  PibblCursorDefault,
  CursorDefaultOwnership
>();
const pointerHoverTargets = new WeakMap<
  PibblEventRoot,
  Map<number, PibblEventNode>
>();
const touchTargets = new WeakMap<
  PibblEventRoot,
  Map<number, PibblEventNode>
>();
const dragHoverTargets = new WeakMap<PibblEventRoot, PibblEventNode>();

interface ManipulationPointerPress {
  readonly path: readonly PibblEventNode[] | undefined;
}

interface PendingManipulationActivation {
  readonly pointerPress: ManipulationPointerPress | undefined;
  readonly mouseDown: PibblInteractionActivation | undefined;
}

const manipulationPointerPresses = new WeakMap<
  PibblInstance,
  Map<number, ManipulationPointerPress>
>();
const pendingManipulationActivations = new WeakMap<
  PibblInstance,
  Map<number, PendingManipulationActivation>
>();
const manipulationActivationRoots = new WeakSet<PibblInstance>();

/**
 * Prevents a manipulation gesture from becoming a Canvas activation. This is
 * deliberately an internal controller seam: applications continue to receive
 * ordinary pointer and mouse events through the public event surface.
 */
export function suppressManipulationActivation(
  instance: PibblInstance,
  pointerId: number,
): void {
  const root = getInteractionRoot(instance);
  retainManipulationActivationState(root);
  let pending = pendingManipulationActivations.get(root);
  if (!pending) {
    pending = new Map();
    pendingManipulationActivations.set(root, pending);
  }
  pending.set(pointerId, Object.freeze({
    pointerPress: manipulationPointerPresses.get(root)?.get(pointerId),
    mouseDown: root.interaction.primaryDown,
  }));
}

export type PibblNativeEventRoute =
  | 'clipboard'
  | 'drag'
  | 'editing'
  | 'keyboard-focus'
  | 'mouse'
  | 'pointer'
  | 'touch'
  | 'wheel';

export function dispatchNativeEvent(
  instance: PibblInstance,
  type: PibblEventType,
  nativeEvent: Event,
): void {
  const root = getInteractionRoot(instance);
  batch(() => {
    dispatchClassifiedNativeEvent(root, type, nativeEvent);
    dispatchObservers(root.eventRoot.observers.get(type), nativeEvent);
  });
}

export function dispatchToLogicalTarget<K extends PibblEventType>(
  type: K,
  target: PibblEventNode,
  originalEvent: PibblOriginalEvent<K>,
  relatedTarget: PibblEventNode | null = null,
  sourceEvent?: Event,
): PibblEventMap[K] | undefined {
  if (!target.live) return undefined;
  return batch(() =>
    dispatchEventPath({
      type,
      target,
      relatedTarget,
      originalEvent,
      sourceEvent,
    })
  );
}

export function classifyNativeEventType(
  type: PibblEventType,
): PibblNativeEventRoute {
  switch (type) {
    case 'pointerover':
    case 'pointerenter':
    case 'pointerdown':
    case 'pointermove':
    case 'pointerrawupdate':
    case 'pointerup':
    case 'pointercancel':
    case 'pointerout':
    case 'pointerleave':
    case 'gotpointercapture':
    case 'lostpointercapture':
      return 'pointer';
    case 'click':
    case 'dblclick':
    case 'auxclick':
    case 'contextmenu':
    case 'mouseover':
    case 'mouseenter':
    case 'mousedown':
    case 'mousemove':
    case 'mouseup':
    case 'mouseout':
    case 'mouseleave':
      return 'mouse';
    case 'touchstart':
    case 'touchmove':
    case 'touchend':
    case 'touchcancel':
      return 'touch';
    case 'wheel':
      return 'wheel';
    case 'keydown':
    case 'keyup':
    case 'focus':
    case 'blur':
    case 'focusin':
    case 'focusout':
      return 'keyboard-focus';
    case 'beforeinput':
    case 'input':
    case 'change':
    case 'compositionstart':
    case 'compositionupdate':
    case 'compositionend':
    case 'select':
    case 'selectionchange':
      return 'editing';
    case 'copy':
    case 'cut':
    case 'paste':
      return 'clipboard';
    case 'dragstart':
    case 'drag':
    case 'dragend':
    case 'dragenter':
    case 'dragleave':
    case 'dragover':
    case 'drop':
      return 'drag';
  }
  return assertNever(type);
}

function dispatchClassifiedNativeEvent(
  root: PibblInstance,
  type: PibblEventType,
  nativeEvent: Event,
): void {
  const route = classifyNativeEventType(type);
  switch (route) {
    case 'pointer': {
      if (!isNativePointerEventType(type)) {
        throw nativeRouteMismatch(type, route);
      }
      const input = adaptPointerEvent(root, type, nativeEvent);
      if (input) dispatchPointerEvent(root, input);
      return;
    }
    case 'mouse': {
      if (!isNativeMouseEventType(type)) {
        throw nativeRouteMismatch(type, route);
      }
      const input = adaptMouseEvent(root, type, nativeEvent);
      if (input) dispatchMouseEvent(root, input);
      return;
    }
    case 'touch': {
      if (!isNativeTouchEventType(type)) {
        throw nativeRouteMismatch(type, route);
      }
      const input = adaptTouchEvent(root, type, nativeEvent);
      if (input) dispatchTouchEvent(root, input);
      return;
    }
    case 'wheel': {
      if (!isNativeWheelEventType(type)) {
        throw nativeRouteMismatch(type, route);
      }
      const input = adaptWheelEvent(root, nativeEvent);
      if (input) dispatchWheelEvent(root, input);
      return;
    }
    case 'keyboard-focus': {
      if (!isNativeKeyboardFocusEventType(type)) {
        throw nativeRouteMismatch(type, route);
      }
      const input = adaptKeyboardFocusEvent(type, nativeEvent);
      if (input) dispatchFocusedNativeEvent(root, input);
      return;
    }
    case 'editing': {
      if (!isNativeEditingEventType(type)) {
        throw nativeRouteMismatch(type, route);
      }
      const input = adaptEditingEvent(type, nativeEvent);
      if (input) dispatchFocusedNativeEvent(root, input);
      return;
    }
    case 'clipboard': {
      if (!isNativeClipboardEventType(type)) {
        throw nativeRouteMismatch(type, route);
      }
      const input = adaptClipboardEvent(type, nativeEvent);
      if (input) dispatchFocusedNativeEvent(root, input);
      return;
    }
    case 'drag': {
      if (!isNativeDragEventType(type)) {
        throw nativeRouteMismatch(type, route);
      }
      const input = adaptDragEvent(root, type, nativeEvent);
      if (input) dispatchDragEvent(root, input);
      return;
    }
  }
  return assertNever(route);
}

type PibblAdaptedFocusedEvent =
  | PibblAdaptedClipboardEvent
  | PibblAdaptedEditingEvent
  | PibblAdaptedKeyboardFocusEvent;

function dispatchFocusedNativeEvent(
  root: PibblInstance,
  input: PibblAdaptedFocusedEvent,
): void {
  const installedPolicy = root.eventRoot.focusPolicy;
  const policy = installedPolicy?.beforeNativeDispatch ?
    installedPolicy.beforeNativeDispatch(input.type, input.originalEvent) :
    installedPolicy;
  const target = policy?.resolveKeyboardTarget();
  if (!policy || !target || !isLiveNode(root, target)) return;

  const event = dispatchToLogicalTarget(
    input.type,
    target,
    input.originalEvent as PibblOriginalEvent<typeof input.type>,
  );
  if (
    (input.type === 'keydown' || input.type === 'keyup') &&
    event &&
    isLiveNode(root, target) &&
    root.eventRoot.focusPolicy === policy &&
    policy.resolveKeyboardTarget() === target
  ) {
    policy.afterDispatch(event);
  }
}

function nativeRouteMismatch(
  type: PibblEventType,
  route: PibblNativeEventRoute,
): Error {
  return new Error(`Pibbl event ${type} is not valid for the ${route} route.`);
}

/** Clears dispatch-owned references before a logical node becomes dead. */
export function releaseEventNodeState(
  instance: PibblInstance,
  node: PibblEventNode,
): void {
  const root = getInteractionRoot(instance);
  releasePointerHoverTarget(root.eventRoot, node);
  releaseTouchTarget(root.eventRoot, node);
  releaseDragHoverTarget(root.eventRoot, node);
  const interaction = root.interaction;
  if (node.kind === 'target' && interaction.hoveredRegion === node) {
    const canvas = interaction.pointerCanvas;
    interaction.hoveredRegion = undefined;
    releaseCursor(root);
    if (canvas) applyCursor(root, undefined, canvas);
  }
  interaction.primaryDown = removeActivationNode(
    interaction.primaryDown,
    node,
  );
  interaction.primaryUp = removeActivationNode(interaction.primaryUp, node);
  removeActivationNodeFromMap(interaction.auxiliaryDown, node);
  removeActivationNodeFromMap(interaction.auxiliaryUp, node);
  if (interaction.clickStreakTarget === node) {
    interaction.clickStreakTarget = undefined;
    interaction.clickStreak = 0;
  }
}

export function removeInteractionRegion(
  _instance: PibblInstance,
  region: PibblInteractionRegion,
): void {
  releaseTarget(region);
}

export function refreshInteractionCursor(
  instance: PibblInstance,
  region: PibblInteractionRegion,
): void {
  const root = getInteractionRoot(instance);
  if (
    root.interaction.hoveredRegion === region &&
    root.interaction.pointerCanvas
  ) {
    applyCursor(root, region, root.interaction.pointerCanvas);
  }
}

export function updateCursorDefault(
  instance: PibblInstance,
  cursorDefault: PibblCursorDefault,
): void {
  const root = getInteractionRoot(instance);
  const existing = cursorDefaultOwnership.get(cursorDefault);
  if (existing?.root === root) return;
  releaseCursorDefaultOwnership(cursorDefault);
  const hub = root.eventRoot.nativeListeners;
  if (!hub) return;
  cursorDefaultOwnership.set(cursorDefault, {
    root,
    releases: [hub.acquire('mousemove'), hub.acquire('mouseout')],
  });
}

export function removeCursorDefault(
  instance: PibblInstance,
  cursorDefault: PibblCursorDefault,
): void {
  releaseCursorDefaultOwnership(cursorDefault);
  const root = getInteractionRoot(instance);
  root.cursorDefaults.delete(cursorDefault);
  if (root.interaction.cursorDefault === cursorDefault) {
    const canvas = root.interaction.pointerCanvas;
    releaseCursor(root);
    if (canvas) applyCursor(root, root.interaction.hoveredRegion, canvas);
  }
}

export function refreshCursorDefault(instance: PibblInstance): void {
  const root = getInteractionRoot(instance);
  const canvas = root.interaction.pointerCanvas;
  if (canvas) applyCursor(root, root.interaction.hoveredRegion, canvas);
}

function dispatchPointerEvent(
  root: PibblInstance,
  input: PibblAdaptedPointerEvent,
): void {
  if (
    input.type !== 'gotpointercapture' &&
    input.type !== 'lostpointercapture'
  ) {
    processPendingLogicalPointerCapture(
      root.eventRoot,
      input.originalEvent.pointerId,
      target => dispatchPointerNode('lostpointercapture', target, input),
      target => dispatchPointerNode('gotpointercapture', target, input),
    );
  }
  switch (input.type) {
    case 'pointerover':
      dispatchPointerBoundaryEntry(root, input);
      return;
    case 'pointermove':
      dispatchPointerMove(root, input);
      return;
    case 'pointerout':
      dispatchRootPointerOut(root, input);
      return;
    case 'pointerdown':
    case 'pointerrawupdate':
      dispatchPointerCoordinateEvent(root, input);
      return;
    case 'pointerup':
      dispatchPointerCoordinateEvent(root, input);
      deleteManipulationPointerPress(root, input.originalEvent.pointerId);
      return;
    case 'pointercancel':
      dispatchPointerCancel(root, input);
      deleteManipulationPointerPress(root, input.originalEvent.pointerId);
      return;
    case 'gotpointercapture':
      dispatchGotPointerCapture(root, input);
      return;
    case 'lostpointercapture':
      dispatchLostPointerCapture(root, input);
      return;
    case 'pointerenter':
    case 'pointerleave':
      // Logical boundary events are derived from pointer-specific paths.
      return;
  }
}

function dispatchPointerBoundaryEntry(
  root: PibblInstance,
  input: PibblAdaptedPointerEvent,
): void {
  const pointerId = input.originalEvent.pointerId;
  const previous = livePointerHover(root, pointerId);
  const next = resolvePointerTarget(root, input);
  if (previous === next) return;
  dispatchPointerTransition(root, previous, next, input, false);
}

function dispatchPointerMove(
  root: PibblInstance,
  input: PibblAdaptedPointerEvent,
): void {
  const pointerId = input.originalEvent.pointerId;
  const previous = livePointerHover(root, pointerId);
  const next = resolvePointerTarget(root, input, true);
  if (previous === next) {
    if (next) dispatchPointerNode('pointermove', next, input);
    return;
  }
  dispatchPointerTransition(root, previous, next, input, true);
}

function dispatchRootPointerOut(
  root: PibblInstance,
  input: PibblAdaptedPointerEvent,
): void {
  const pointerId = input.originalEvent.pointerId;
  const previous = livePointerHover(root, pointerId);
  dispatchPointerTransition(root, previous, undefined, input, false);
}

function dispatchPointerTransition(
  root: PibblInstance,
  previous: PibblEventNode | undefined,
  next: PibblEventNode | undefined,
  input: PibblAdaptedPointerEvent,
  dispatchMove: boolean,
): void {
  const pointerId = input.originalEvent.pointerId;
  const oldPath = previous ? buildEventPath(previous) : [];
  const newPath = next ? buildEventPath(next) : [];
  const plan = planBoundaryTransitions(oldPath, newPath);
  const oldLeaf = oldPath.at(-1);
  const newLeaf = newPath.at(-1);

  deletePointerHover(root.eventRoot, pointerId);
  if (oldLeaf?.live) {
    dispatchPointerNode('pointerout', oldLeaf, input, newLeaf ?? null);
  }
  for (const node of plan.exited) {
    if (node.live) {
      dispatchPointerNode('pointerleave', node, input, newLeaf ?? null);
    }
  }

  const liveNext = next && isLiveNode(root, next) ? next : undefined;
  if (!liveNext) return;

  setPointerHover(root.eventRoot, pointerId, liveNext);
  dispatchPointerNode('pointerover', liveNext, input, oldLeaf ?? null);
  if (!isLiveNode(root, liveNext)) return;
  for (const node of plan.entered) {
    if (!isLiveNode(root, liveNext)) return;
    if (node.live) {
      dispatchPointerNode('pointerenter', node, input, oldLeaf ?? null);
    }
  }
  if (dispatchMove && isLiveNode(root, liveNext)) {
    dispatchPointerNode('pointermove', liveNext, input);
  }
}

function dispatchPointerCoordinateEvent(
  root: PibblInstance,
  input: PibblAdaptedPointerEvent,
): void {
  const policy = root.eventRoot.focusPolicy;
  const logicalCapture = getLogicalPointerCapture(
    root.eventRoot,
    input.originalEvent.pointerId,
  );
  // Capture controls event routing, but a primary press still focuses the
  // target under the pointer. Avoid the extra hit test for captured moves.
  const coordinateTarget = !logicalCapture || input.press ?
    input.type === "pointerdown" || input.type === "pointerup" ||
        input.type === "pointercancel" ?
      resolvePointerInputTarget(root, input) :
      resolveCoordinateTarget(root.eventRoot, input) : undefined;
  const target = logicalCapture ?? coordinateTarget;
  if (input.type === 'pointerdown') {
    recordManipulationPointerPress(root, input.originalEvent.pointerId, coordinateTarget);
  }
  const event = target ? dispatchPointerNode(input.type, target, input) : undefined;
  if (input.press) {
    dispatchPressDefault(root, policy, {
      source: 'pointer',
      target: coordinateTarget,
      event,
      originalEvent: input.originalEvent,
      x: input.press.x,
      y: input.press.y,
      pointerId: input.press.pointerId,
      pointerType: input.press.pointerType,
    });
  }
}

function dispatchPointerCancel(
  root: PibblInstance,
  input: PibblAdaptedPointerEvent,
): void {
  dispatchPointerCoordinateEvent(root, input);
  cancelLogicalPointerCapture(
    root.eventRoot,
    input.originalEvent.pointerId,
  );
}

function dispatchGotPointerCapture(
  root: PibblInstance,
  input: PibblAdaptedPointerEvent,
): void {
  const target = activateLogicalPointerCapture(
    root.eventRoot,
    input.originalEvent.pointerId,
  );
  if (target) dispatchPointerNode('gotpointercapture', target, input);
}

function dispatchLostPointerCapture(
  root: PibblInstance,
  input: PibblAdaptedPointerEvent,
): void {
  const target = consumeLogicalPointerCaptureLoss(
    root.eventRoot,
    input.originalEvent.pointerId,
  );
  if (target) dispatchPointerNode('lostpointercapture', target, input);
}

function resolvePointerTarget(
  root: PibblInstance,
  input: PibblAdaptedPointerEvent,
  deliverInput = false,
): PibblEventNode | undefined {
  const logicalCapture = getLogicalPointerCapture(
    root.eventRoot,
    input.originalEvent.pointerId,
  );
  if (logicalCapture) return logicalCapture;
  const resolverCapture = getResolverPointerCapture(
    root.eventRoot,
    input.originalEvent.pointerId,
  );
  if (resolverCapture) {
    if (deliverInput && input.type === "pointermove") {
      dispatchCapturedResolverInput(
        resolverCapture,
        "pointermove",
        input,
        input.originalEvent,
      );
    }
    return undefined;
  }
  return deliverInput && input.type === "pointermove" ?
    resolveCoordinateInputTarget(root, input, "pointermove") :
    resolveCoordinateTarget(root.eventRoot, input);
}

function resolvePointerInputTarget(
  root: PibblInstance,
  input: PibblAdaptedPointerEvent,
): PibblEventTargetRegistration | undefined {
  const type = input.type as "pointerdown" | "pointerup" | "pointercancel";
  const captured = getResolverPointerCapture(
    root.eventRoot,
    input.originalEvent.pointerId,
  );
  if (captured && (type === "pointerup" || type === "pointercancel")) {
    dispatchCapturedResolverInput(captured, type, input, input.originalEvent);
    return undefined;
  }
  return resolveCoordinateInputTarget(root, input, type);
}

function dispatchPointerNode(
  type: PibblAdaptedPointerEvent['type'],
  target: PibblEventNode,
  input: PibblAdaptedPointerEvent,
  relatedTarget: PibblEventNode | null = null,
): PibblEvent | undefined {
  if (!target.live) return undefined;
  return dispatchEventPath({
    type,
    target,
    relatedTarget,
    originalEvent: input.originalEvent,
    x: input.x,
    y: input.y,
  });
}

function livePointerHover(
  root: PibblInstance,
  pointerId: number,
): PibblEventNode | undefined {
  const targets = pointerHoverTargets.get(root.eventRoot);
  const target = targets?.get(pointerId);
  if (!target || isLiveNode(root, target)) return target;
  targets?.delete(pointerId);
  if (targets?.size === 0) pointerHoverTargets.delete(root.eventRoot);
  return undefined;
}

function setPointerHover(
  eventRoot: PibblEventRoot,
  pointerId: number,
  target: PibblEventNode,
): void {
  let targets = pointerHoverTargets.get(eventRoot);
  if (!targets) {
    targets = new Map();
    pointerHoverTargets.set(eventRoot, targets);
  }
  targets.set(pointerId, target);
}

function deletePointerHover(
  eventRoot: PibblEventRoot,
  pointerId: number,
): void {
  const targets = pointerHoverTargets.get(eventRoot);
  targets?.delete(pointerId);
  if (targets?.size === 0) pointerHoverTargets.delete(eventRoot);
}

function releasePointerHoverTarget(
  eventRoot: PibblEventRoot,
  target: PibblEventNode,
): void {
  const targets = pointerHoverTargets.get(eventRoot);
  if (!targets) return;
  for (const [pointerId, hovered] of targets) {
    if (hovered === target) targets.delete(pointerId);
  }
  if (targets.size === 0) pointerHoverTargets.delete(eventRoot);
}

function dispatchTouchEvent(
  root: PibblInstance,
  input: PibblAdaptedTouchEvent,
): void {
  const policy = root.eventRoot.focusPolicy;
  const groups = new Map<PibblEventNode, PibblAdaptedTouchContact[]>();
  const defaultContacts: PibblFocusTouchDefaultContact[] = [];
  for (const contact of input.changedContacts) {
    const identifier = contact.touch.identifier;
    let target: PibblEventNode | undefined;
    if (input.type === 'touchstart') {
      target = resolveCoordinateTarget(root.eventRoot, contact);
      if (target) setTouchTarget(root.eventRoot, identifier, target);
      else deleteTouchTarget(root.eventRoot, identifier);
    } else {
      target = liveTouchTarget(root, identifier);
    }
    defaultContacts.push({
      identifier,
      target: target?.kind === 'target' ? target : undefined,
      x: contact.x,
      y: contact.y,
    });

    if (target) {
      const contacts = groups.get(target);
      if (contacts) contacts.push(contact);
      else groups.set(target, [contact]);
    }
    if (input.type === 'touchend' || input.type === 'touchcancel') {
      deleteTouchTarget(root.eventRoot, identifier);
    }
  }

  for (const [target, contacts] of groups) {
    if (!isLiveNode(root, target)) continue;
    const first = contacts[0];
    dispatchEventPath({
      type: input.type,
      target,
      originalEvent: input.originalEvent,
      x: first.x,
      y: first.y,
    });
  }

  dispatchTouchDefault(root, policy, {
    type: input.type,
    changedContacts: Object.freeze(defaultContacts),
    activeIdentifiers: Object.freeze(
      Array.from(input.originalEvent.touches, touch => touch.identifier),
    ),
    originalEvent: input.originalEvent,
  });
}

function liveTouchTarget(
  root: PibblInstance,
  identifier: number,
): PibblEventNode | undefined {
  const target = touchTargets.get(root.eventRoot)?.get(identifier);
  if (!target || isLiveNode(root, target)) return target;
  deleteTouchTarget(root.eventRoot, identifier);
  return undefined;
}

function setTouchTarget(
  eventRoot: PibblEventRoot,
  identifier: number,
  target: PibblEventNode,
): void {
  let targets = touchTargets.get(eventRoot);
  if (!targets) {
    targets = new Map();
    touchTargets.set(eventRoot, targets);
  }
  targets.set(identifier, target);
}

function deleteTouchTarget(
  eventRoot: PibblEventRoot,
  identifier: number,
): void {
  const targets = touchTargets.get(eventRoot);
  targets?.delete(identifier);
  if (targets?.size === 0) touchTargets.delete(eventRoot);
}

function releaseTouchTarget(
  eventRoot: PibblEventRoot,
  target: PibblEventNode,
): void {
  const targets = touchTargets.get(eventRoot);
  if (!targets) return;
  for (const [identifier, owner] of targets) {
    if (owner === target) targets.delete(identifier);
  }
  if (targets.size === 0) touchTargets.delete(eventRoot);
}

function dispatchWheelEvent(
  root: PibblInstance,
  input: PibblAdaptedWheelEvent,
): void {
  const target = resolveCoordinateInputTarget(root, input, "wheel");
  if (!target) return;
  dispatchEventPath({
    type: 'wheel',
    target,
    originalEvent: input.originalEvent,
    x: input.x,
    y: input.y,
  });
}

function dispatchDragEvent(
  root: PibblInstance,
  input: PibblAdaptedDragEvent,
): void {
  switch (input.type) {
    case 'dragenter':
      reconcileDragTarget(root, input);
      return;
    case 'dragover': {
      const target = reconcileDragTarget(root, input);
      if (target) dispatchDragNode('dragover', target, input);
      return;
    }
    case 'dragleave':
      dispatchDragTransition(
        root,
        liveDragHover(root),
        undefined,
        input,
      );
      return;
    case 'drop': {
      const target = reconcileDragTarget(root, input);
      if (target) dispatchDragNode('drop', target, input);
      dragHoverTargets.delete(root.eventRoot);
      return;
    }
    case 'dragend':
      dispatchDragCoordinateEvent(root, input);
      dragHoverTargets.delete(root.eventRoot);
      return;
    case 'dragstart':
    case 'drag':
      dispatchDragCoordinateEvent(root, input);
      return;
  }
  return assertNever(input.type);
}

function reconcileDragTarget(
  root: PibblInstance,
  input: PibblAdaptedDragEvent,
): PibblEventNode | undefined {
  const previous = liveDragHover(root);
  const next = resolveCoordinateTarget(root.eventRoot, input);
  if (previous === next) return next;
  return dispatchDragTransition(root, previous, next, input);
}

function dispatchDragTransition(
  root: PibblInstance,
  previous: PibblEventNode | undefined,
  next: PibblEventNode | undefined,
  input: PibblAdaptedDragEvent,
): PibblEventNode | undefined {
  const oldPath = previous ? buildEventPath(previous) : [];
  const newPath = next ? buildEventPath(next) : [];
  const plan = planBoundaryTransitions(oldPath, newPath);
  const oldLeaf = oldPath.at(-1);
  const newLeaf = newPath.at(-1);

  dragHoverTargets.delete(root.eventRoot);
  for (const node of plan.exited) {
    if (node.live) {
      dispatchDragNode('dragleave', node, input, newLeaf ?? null);
    }
  }

  const liveNext = next && isLiveNode(root, next) ? next : undefined;
  if (!liveNext) return undefined;
  dragHoverTargets.set(root.eventRoot, liveNext);
  for (const node of plan.entered) {
    if (!isLiveNode(root, liveNext)) {
      dragHoverTargets.delete(root.eventRoot);
      return undefined;
    }
    if (node.live) {
      dispatchDragNode('dragenter', node, input, oldLeaf ?? null);
    }
  }
  return isLiveNode(root, liveNext) ? liveNext : undefined;
}

function dispatchDragCoordinateEvent(
  root: PibblInstance,
  input: PibblAdaptedDragEvent,
): void {
  const target = resolveCoordinateTarget(root.eventRoot, input);
  if (target) dispatchDragNode(input.type, target, input);
}

function dispatchDragNode(
  type: PibblAdaptedDragEvent['type'],
  target: PibblEventNode,
  input: PibblAdaptedDragEvent,
  relatedTarget: PibblEventNode | null = null,
): void {
  if (!target.live) return;
  dispatchEventPath({
    type,
    target,
    relatedTarget,
    originalEvent: input.originalEvent,
    x: input.x,
    y: input.y,
  });
}

function liveDragHover(root: PibblInstance): PibblEventNode | undefined {
  const target = dragHoverTargets.get(root.eventRoot);
  if (!target || isLiveNode(root, target)) return target;
  dragHoverTargets.delete(root.eventRoot);
  return undefined;
}

function releaseDragHoverTarget(
  eventRoot: PibblEventRoot,
  target: PibblEventNode,
): void {
  if (dragHoverTargets.get(eventRoot) === target) {
    dragHoverTargets.delete(eventRoot);
  }
}

function dispatchMouseEvent(
  root: PibblInstance,
  input: PibblAdaptedMouseEvent,
): void {
  switch (input.type) {
    case 'mousemove':
      dispatchMouseMove(root, input);
      return;
    case 'mouseout':
      dispatchRootMouseOut(root, input);
      return;
    case 'mousedown':
    case 'mouseup':
      dispatchMouseButton(root, input);
      return;
    case 'click':
    case 'auxclick':
      dispatchActivation(root, input, input.type);
      return;
    case 'dblclick':
      dispatchDoubleClick(root, input);
      return;
    case 'contextmenu':
      dispatchCoordinateEvent(root, input);
      return;
    case 'mouseover':
    case 'mouseenter':
    case 'mouseleave':
      // Logical boundary events are synthesized from movement and root exit.
      return;
  }
}

function dispatchMouseMove(
  root: PibblInstance,
  input: PibblAdaptedMouseEvent,
): void {
  const canvas = root.eventRoot.canvas;
  if (!canvas) return;
  root.interaction.pointerCanvas = canvas;
  const previous = liveTarget(root, root.interaction.hoveredRegion);
  const next = resolveCoordinateTarget(root.eventRoot, input);
  if (previous === next) {
    applyCursor(root, next, canvas);
    if (next) dispatchMouseNode('mousemove', next, input);
    return;
  }
  dispatchMouseTransition(root, previous, next, input, canvas);
}

function dispatchRootMouseOut(
  root: PibblInstance,
  input: PibblAdaptedMouseEvent,
): void {
  const previous = liveTarget(root, root.interaction.hoveredRegion);
  root.interaction.pointerCanvas = undefined;
  dispatchMouseTransition(root, previous, undefined, input, undefined);
}

function dispatchMouseTransition(
  root: PibblInstance,
  previous: PibblEventTargetRegistration | undefined,
  next: PibblEventTargetRegistration | undefined,
  input: PibblAdaptedMouseEvent,
  pointerCanvas: HTMLCanvasElement | undefined,
): void {
  const oldPath = previous ? buildEventPath(previous) : [];
  const newPath = next ? buildEventPath(next) : [];
  const plan = planBoundaryTransitions(oldPath, newPath);
  const oldLeaf = oldPath.at(-1);
  const newLeaf = newPath.at(-1);

  root.interaction.hoveredRegion = undefined;
  releaseCursor(root);
  if (oldLeaf?.live) {
    dispatchMouseNode('mouseout', oldLeaf, input, newLeaf ?? null);
  }
  for (const node of plan.exited) {
    if (node.live) dispatchMouseNode('mouseleave', node, input, newLeaf ?? null);
  }

  const liveNext = liveTarget(root, next);
  if (!liveNext) {
    if (pointerCanvas) applyCursor(root, undefined, pointerCanvas);
    return;
  }

  root.interaction.hoveredRegion = liveNext;
  if (pointerCanvas) applyCursor(root, liveNext, pointerCanvas);
  dispatchMouseNode('mouseover', liveNext, input, oldLeaf ?? null);
  if (!liveTarget(root, liveNext)) return;
  for (const node of plan.entered) {
    if (!liveTarget(root, liveNext)) return;
    if (node.live) dispatchMouseNode('mouseenter', node, input, oldLeaf ?? null);
  }
  if (liveTarget(root, liveNext)) {
    dispatchMouseNode('mousemove', liveNext, input);
  }
}

function dispatchMouseButton(
  root: PibblInstance,
  input: PibblAdaptedMouseEvent,
): void {
  const policy = root.eventRoot.focusPolicy;
  const target = resolveCoordinateTarget(root.eventRoot, input);
  const path = target ? buildEventPath(target) : undefined;
  const activation = path ? Object.freeze({
    button: input.originalEvent.button,
    path,
  }) : undefined;
  const button = input.originalEvent.button;
  if (input.type === 'mousedown') {
    if (button === 0) {
      root.interaction.primaryDown = activation;
      root.interaction.primaryUp = undefined;
    } else {
      updateActivationMap(root.interaction.auxiliaryDown, button, activation);
      root.interaction.auxiliaryUp.delete(button);
    }
  } else {
    if (button === 0) {
      root.interaction.primaryUp = activation;
    } else {
      updateActivationMap(root.interaction.auxiliaryUp, button, activation);
    }
  }
  const event = target ? dispatchMouseNode(input.type, target, input) : undefined;
  if (input.press) {
    dispatchPressDefault(root, policy, {
      source: 'mouse',
      target,
      event,
      originalEvent: input.originalEvent,
      x: input.press.x,
      y: input.press.y,
    });
  }
}

function dispatchActivation(
  root: PibblInstance,
  input: PibblAdaptedMouseEvent,
  type: 'click' | 'auxclick',
): void {
  const interaction = root.interaction;
  const button = input.originalEvent.button;
  const down = type === 'click' ?
    interaction.primaryDown :
    interaction.auxiliaryDown.get(button);
  const up = type === 'click' ?
    interaction.primaryUp :
    interaction.auxiliaryUp.get(button);
  const target = activationTarget(
    root,
    down,
    up,
    button,
    type,
  );
  if (type === 'click') {
    interaction.primaryDown = undefined;
    interaction.primaryUp = undefined;
  } else {
    interaction.auxiliaryDown.delete(button);
    interaction.auxiliaryUp.delete(button);
  }

  const coordinateTarget = type === "click" ?
    resolveCoordinateInputTarget(root, input, "click") :
    resolveCoordinateTarget(root.eventRoot, input);
  if (
    type === 'click' &&
    consumeManipulationActivation(root, down, up, coordinateTarget, input.originalEvent)
  ) {
    resetClickStreak(root);
    return;
  }
  if (
    !target ||
    !coordinateTarget ||
    !buildEventPath(coordinateTarget).includes(target)
  ) {
    if (type === 'click') resetClickStreak(root);
    return;
  }

  dispatchMouseNode(type, target, input);
  if (type !== 'click') return;
  if (!isLiveNode(root, target)) {
    resetClickStreak(root);
    return;
  }
  if (interaction.clickStreakTarget === target) {
    interaction.clickStreak++;
  } else {
    interaction.clickStreakTarget = target;
    interaction.clickStreak = 1;
  }
}

function dispatchDoubleClick(
  root: PibblInstance,
  input: PibblAdaptedMouseEvent,
): void {
  const target = root.interaction.clickStreakTarget;
  if (
    !target ||
    root.interaction.clickStreak < 2 ||
    !isLiveNode(root, target)
  ) {
    return;
  }
  if (!coordinatePathIncludes(root, input, target)) return;
  dispatchMouseNode('dblclick', target, input);
}

function coordinatePathIncludes(
  root: PibblInstance,
  input: PibblAdaptedMouseEvent,
  node: PibblEventNode,
): boolean {
  const coordinateTarget = resolveCoordinateTarget(root.eventRoot, input);
  return Boolean(
    coordinateTarget && buildEventPath(coordinateTarget).includes(node),
  );
}

function dispatchCoordinateEvent(
  root: PibblInstance,
  input: PibblAdaptedMouseEvent,
): void {
  const target = input.type === "contextmenu" ?
    resolveCoordinateInputTarget(root, input, "contextmenu") :
    resolveCoordinateTarget(root.eventRoot, input);
  if (target) dispatchMouseNode(input.type, target, input);
}

function resolveCoordinateInputTarget(
  root: PibblInstance,
  point: Readonly<{ x: number; y: number }> & {
    readonly originalEvent: PointerEvent | WheelEvent | MouseEvent;
  },
  type: PibblResolverInputType,
): PibblEventTargetRegistration | undefined {
  const output = resolveCoordinateOutput(root.eventRoot, point);
  dispatchResolvedInput(output, type, point, point.originalEvent);
  return output.disposition === PibblHitDisposition.Target ?
    output.target ?? undefined :
    undefined;
}

function dispatchMouseNode(
  type: PibblAdaptedMouseEvent['type'],
  target: PibblEventNode,
  input: PibblAdaptedMouseEvent,
  relatedTarget: PibblEventNode | null = null,
): PibblEvent | undefined {
  if (!target.live) return undefined;
  return dispatchEventPath({
    type,
    target,
    relatedTarget,
    originalEvent: input.originalEvent,
    x: input.x,
    y: input.y,
  });
}

function dispatchPressDefault(
  root: PibblInstance,
  policy: PibblEventRoot['focusPolicy'],
  input: PibblFocusPressDefaultInput,
): void {
  if (
    policy &&
    root.eventRoot.focusPolicy === policy &&
    policy.afterPressDispatch
  ) {
    policy.afterPressDispatch(input);
  }
}

function dispatchTouchDefault(
  root: PibblInstance,
  policy: PibblEventRoot['focusPolicy'],
  input: PibblFocusTouchDefaultInput,
): void {
  if (
    policy &&
    root.eventRoot.focusPolicy === policy &&
    policy.afterTouchDispatch
  ) {
    policy.afterTouchDispatch(input);
  }
}

function activationTarget(
  root: PibblInstance,
  down: PibblInteractionActivation | undefined,
  up: PibblInteractionActivation | undefined,
  button: number,
  type: 'click' | 'auxclick',
): PibblEventNode | undefined {
  if (
    !down ||
    !up ||
    down.button !== button ||
    up.button !== button ||
    (type === 'click' ? button !== 0 : button === 0)
  ) {
    return undefined;
  }
  const upNodes = new Set(up.path);
  for (let index = down.path.length - 1; index >= 0; index--) {
    const node = down.path[index];
    if (upNodes.has(node) && isLiveNode(root, node)) return node;
  }
  return undefined;
}

function isLiveNode(root: PibblInstance, node: PibblEventNode): boolean {
  if (!node.live || node.owner.eventRoot !== root.eventRoot) return false;
  if (node.kind === 'target') return root.eventRoot.targets.has(node);
  return root.eventRoot.listenersByComponent.get(node.component.id)?.has(node) ??
    false;
}

function liveTarget(
  root: PibblInstance,
  target: PibblEventTargetRegistration | undefined,
): PibblEventTargetRegistration | undefined {
  return target && isLiveNode(root, target) ? target : undefined;
}

function removeActivationNode(
  activation: PibblInteractionActivation | undefined,
  node: PibblEventNode,
): PibblInteractionActivation | undefined {
  if (!activation?.path.includes(node)) return activation;
  if (node.kind === 'target') return undefined;
  const path = activation.path.filter(candidate => candidate !== node);
  return path.length > 0 ? Object.freeze({ ...activation, path }) : undefined;
}

function removeActivationNodeFromMap(
  activations: Map<number, PibblInteractionActivation>,
  node: PibblEventNode,
): void {
  for (const [button, activation] of activations) {
    updateActivationMap(
      activations,
      button,
      removeActivationNode(activation, node),
    );
  }
}

function updateActivationMap(
  activations: Map<number, PibblInteractionActivation>,
  button: number,
  activation: PibblInteractionActivation | undefined,
): void {
  if (activation) activations.set(button, activation);
  else activations.delete(button);
}

function resetClickStreak(root: PibblInstance): void {
  root.interaction.clickStreakTarget = undefined;
  root.interaction.clickStreak = 0;
}

function recordManipulationPointerPress(
  root: PibblInstance,
  pointerId: number,
  target: PibblEventNode | undefined,
): void {
  retainManipulationActivationState(root);
  pendingManipulationActivations.get(root)?.delete(pointerId);
  const press = Object.freeze({
    path: target ? Object.freeze(buildEventPath(target)) : undefined,
  });
  let presses = manipulationPointerPresses.get(root);
  if (!presses) {
    presses = new Map();
    manipulationPointerPresses.set(root, presses);
  }
  presses.set(pointerId, press);
}

function deleteManipulationPointerPress(
  root: PibblInstance,
  pointerId: number,
): void {
  const presses = manipulationPointerPresses.get(root);
  if (!presses) return;
  presses.delete(pointerId);
  if (presses.size === 0) manipulationPointerPresses.delete(root);
}

function retainManipulationActivationState(root: PibblInstance): void {
  if (manipulationActivationRoots.has(root)) return;
  manipulationActivationRoots.add(root);
  root.mainTeardowns.add(() => {
    manipulationPointerPresses.delete(root);
    pendingManipulationActivations.delete(root);
    manipulationActivationRoots.delete(root);
  });
}

function consumeManipulationActivation(
  root: PibblInstance,
  down: PibblInteractionActivation | undefined,
  up: PibblInteractionActivation | undefined,
  coordinateTarget: PibblEventNode | undefined,
  nativeEvent: MouseEvent,
): boolean {
  const pending = pendingManipulationActivations.get(root);
  if (!pending) return false;
  const pointerId = clickPointerId(nativeEvent);
  if (pointerId !== undefined) {
    const activation = pending.get(pointerId);
    if (!activation || !matchesManipulationActivation(activation, down, up, coordinateTarget)) {
      return false;
    }
    deletePendingManipulationActivation(root, pending, pointerId);
    return true;
  }

  let match: number | undefined;
  for (const [candidatePointerId, activation] of pending) {
    if (!matchesManipulationActivation(activation, down, up, coordinateTarget)) continue;
    if (match !== undefined) return false;
    match = candidatePointerId;
  }
  if (match === undefined) return false;
  deletePendingManipulationActivation(root, pending, match);
  return true;
}

function clickPointerId(nativeEvent: MouseEvent): number | undefined {
  const pointerId = Reflect.get(nativeEvent, 'pointerId');
  return typeof pointerId === 'number' && Number.isFinite(pointerId) ?
    pointerId :
    undefined;
}

function deletePendingManipulationActivation(
  root: PibblInstance,
  pending: Map<number, PendingManipulationActivation>,
  pointerId: number,
): void {
  pending.delete(pointerId);
  if (pending.size === 0) pendingManipulationActivations.delete(root);
}

function matchesManipulationActivation(
  activation: PendingManipulationActivation,
  down: PibblInteractionActivation | undefined,
  up: PibblInteractionActivation | undefined,
  coordinateTarget: PibblEventNode | undefined,
): boolean {
  if (activation.mouseDown && activation.mouseDown === down) return true;
  const pointerPath = activation.pointerPress?.path;
  const pressTarget = pointerPath?.at(-1);
  if (!pressTarget || !coordinateTarget) return false;
  const coordinatePath = buildEventPath(coordinateTarget);
  if (!coordinatePath.includes(pressTarget)) return false;
  return (!down || down.path.includes(pressTarget)) &&
    (!up || up.path.includes(pressTarget));
}

function dispatchObservers(
  observers: Set<(event: Event) => void> | undefined,
  event: Event,
): void {
  if (!observers) return;
  for (const observer of Array.from(observers)) {
    if (!observers.has(observer)) continue;
    try {
      observer(event);
    } catch (error) {
      try {
        globalThis.reportError(error);
      } catch {
        // Reporting cannot suppress later Canvas observers.
      }
    }
  }
}

function releaseCursorDefaultOwnership(cursorDefault: PibblCursorDefault): void {
  const ownership = cursorDefaultOwnership.get(cursorDefault);
  if (!ownership) return;
  cursorDefaultOwnership.delete(cursorDefault);
  for (const release of ownership.releases) release();
}

function applyCursor(
  instance: PibblInstance,
  region: PibblInteractionRegion | undefined,
  canvas: HTMLCanvasElement,
): void {
  const interaction = instance.interaction;
  const cursorDefault = region?.cursor ? undefined : lastCursorDefault(instance);
  const style = region?.cursor ?? cursorDefault?.style;
  if (
    interaction.cursorRegion === region &&
    interaction.cursorDefault === cursorDefault &&
    interaction.cursorCanvas === canvas &&
    interaction.cursorStyle === canvas.style.cursor &&
    style === interaction.cursorStyle
  ) {
    return;
  }

  releaseCursor(instance);
  if (style && !canvas.style.cursor) {
    canvas.style.cursor = style;
    if (canvas.style.cursor) {
      interaction.cursorRegion = region;
      interaction.cursorDefault = cursorDefault;
      interaction.cursorCanvas = canvas;
      interaction.cursorStyle = canvas.style.cursor;
    }
  }
}

function lastCursorDefault(instance: PibblInstance): PibblCursorDefault | undefined {
  return Array.from(instance.cursorDefaults).at(-1);
}

function releaseCursor(instance: PibblInstance): void {
  const interaction = instance.interaction;
  const { cursorCanvas, cursorStyle } = interaction;
  if (cursorCanvas && cursorStyle && cursorCanvas.style.cursor === cursorStyle) {
    cursorCanvas.style.removeProperty('cursor');
  }
  interaction.cursorRegion = undefined;
  interaction.cursorDefault = undefined;
  interaction.cursorCanvas = undefined;
  interaction.cursorStyle = undefined;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Pibbl event route: ${String(value)}`);
}
