import { getInteractionRoot } from '../global-state.js';
import type {
  CRCCursorDefault,
  CRCEventRoot,
  CRCInstance,
  CRCInteractionActivation,
  CRCInteractionRegion,
} from '../types.js';
import {
  adaptClipboardEvent,
  isNativeClipboardEventType,
} from './adapters/clipboard.js';
import {
  adaptDragEvent,
  isNativeDragEventType,
  type CRCAdaptedDragEvent,
} from './adapters/drag.js';
import {
  adaptEditingEvent,
  isNativeEditingEventType,
} from './adapters/editing.js';
import {
  adaptKeyboardFocusEvent,
  isNativeKeyboardFocusEventType,
} from './adapters/keyboard-focus.js';
import {
  adaptMouseEvent,
  isNativeMouseEventType,
  type CRCAdaptedMouseEvent,
} from './adapters/mouse.js';
import {
  adaptPointerEvent,
  isNativePointerEventType,
  type CRCAdaptedPointerEvent,
} from './adapters/pointer.js';
import {
  adaptTouchEvent,
  isNativeTouchEventType,
  type CRCAdaptedTouchContact,
  type CRCAdaptedTouchEvent,
} from './adapters/touch.js';
import {
  adaptWheelEvent,
  isNativeWheelEventType,
  type CRCAdaptedWheelEvent,
} from './adapters/wheel.js';
import { planBoundaryTransitions } from './boundary-transitions.js';
import type { CRCOriginalEvent } from './event-facade.js';
import { buildEventPath } from './event-path.js';
import { resolveCoordinateTarget } from './hit-test.js';
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
  type CRCEventNode,
  type CRCEventTargetRegistration,
} from './registrations.js';
import type { CRCEventMap, CRCEventType } from './types.js';

interface CursorDefaultOwnership {
  readonly root: CRCInstance;
  readonly releases: readonly (() => void)[];
}

const cursorDefaultOwnership = new WeakMap<
  CRCCursorDefault,
  CursorDefaultOwnership
>();
const pointerHoverTargets = new WeakMap<
  CRCEventRoot,
  Map<number, CRCEventNode>
>();
const touchTargets = new WeakMap<
  CRCEventRoot,
  Map<number, CRCEventNode>
>();
const dragHoverTargets = new WeakMap<CRCEventRoot, CRCEventNode>();

export type CRCNativeEventRoute =
  | 'clipboard'
  | 'drag'
  | 'editing'
  | 'keyboard-focus'
  | 'mouse'
  | 'pointer'
  | 'touch'
  | 'wheel';

export function dispatchNativeEvent(
  instance: CRCInstance,
  type: CRCEventType,
  nativeEvent: Event,
): void {
  const root = getInteractionRoot(instance);
  dispatchClassifiedNativeEvent(root, type, nativeEvent);
  dispatchObservers(root.eventRoot.observers.get(type), nativeEvent);
}

export function dispatchToLogicalTarget<K extends CRCEventType>(
  type: K,
  target: CRCEventNode,
  originalEvent: CRCOriginalEvent<K>,
  relatedTarget: CRCEventNode | null = null,
): CRCEventMap[K] | undefined {
  if (!target.live) return undefined;
  return dispatchEventPath({
    type,
    target,
    relatedTarget,
    originalEvent,
  });
}

export function classifyNativeEventType(
  type: CRCEventType,
): CRCNativeEventRoute {
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
  root: CRCInstance,
  type: CRCEventType,
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
    case 'keyboard-focus':
      if (!isNativeKeyboardFocusEventType(type)) {
        throw nativeRouteMismatch(type, route);
      }
      // A native Canvas event has no logical descendant until a focus policy
      // supplies one. Adapting here validates the family before observers run.
      adaptKeyboardFocusEvent(type, nativeEvent);
      return;
    case 'editing':
      if (!isNativeEditingEventType(type)) {
        throw nativeRouteMismatch(type, route);
      }
      // Editing transport remains targetless without an explicit input policy.
      adaptEditingEvent(type, nativeEvent);
      return;
    case 'clipboard':
      if (!isNativeClipboardEventType(type)) {
        throw nativeRouteMismatch(type, route);
      }
      adaptClipboardEvent(type, nativeEvent);
      return;
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

function nativeRouteMismatch(
  type: CRCEventType,
  route: CRCNativeEventRoute,
): Error {
  return new Error(`CRC event ${type} is not valid for the ${route} route.`);
}

/** Clears dispatch-owned references before a logical node becomes dead. */
export function releaseEventNodeState(
  instance: CRCInstance,
  node: CRCEventNode,
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
  _instance: CRCInstance,
  region: CRCInteractionRegion,
): void {
  releaseTarget(region);
}

export function refreshInteractionCursor(
  instance: CRCInstance,
  region: CRCInteractionRegion,
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
  instance: CRCInstance,
  cursorDefault: CRCCursorDefault,
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
  instance: CRCInstance,
  cursorDefault: CRCCursorDefault,
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

export function refreshCursorDefault(instance: CRCInstance): void {
  const root = getInteractionRoot(instance);
  const canvas = root.interaction.pointerCanvas;
  if (canvas) applyCursor(root, root.interaction.hoveredRegion, canvas);
}

function dispatchPointerEvent(
  root: CRCInstance,
  input: CRCAdaptedPointerEvent,
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
    case 'pointerup':
    case 'pointerrawupdate':
      dispatchPointerCoordinateEvent(root, input);
      return;
    case 'pointercancel':
      dispatchPointerCancel(root, input);
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
  root: CRCInstance,
  input: CRCAdaptedPointerEvent,
): void {
  const pointerId = input.originalEvent.pointerId;
  const previous = livePointerHover(root, pointerId);
  const next = resolvePointerTarget(root, input);
  if (previous === next) return;
  dispatchPointerTransition(root, previous, next, input, false);
}

function dispatchPointerMove(
  root: CRCInstance,
  input: CRCAdaptedPointerEvent,
): void {
  const pointerId = input.originalEvent.pointerId;
  const previous = livePointerHover(root, pointerId);
  const next = resolvePointerTarget(root, input);
  if (previous === next) {
    if (next) dispatchPointerNode('pointermove', next, input);
    return;
  }
  dispatchPointerTransition(root, previous, next, input, true);
}

function dispatchRootPointerOut(
  root: CRCInstance,
  input: CRCAdaptedPointerEvent,
): void {
  const pointerId = input.originalEvent.pointerId;
  const previous = livePointerHover(root, pointerId);
  dispatchPointerTransition(root, previous, undefined, input, false);
}

function dispatchPointerTransition(
  root: CRCInstance,
  previous: CRCEventNode | undefined,
  next: CRCEventNode | undefined,
  input: CRCAdaptedPointerEvent,
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
  root: CRCInstance,
  input: CRCAdaptedPointerEvent,
): void {
  const target = resolvePointerTarget(root, input);
  if (target) dispatchPointerNode(input.type, target, input);
}

function dispatchPointerCancel(
  root: CRCInstance,
  input: CRCAdaptedPointerEvent,
): void {
  dispatchPointerCoordinateEvent(root, input);
  cancelLogicalPointerCapture(
    root.eventRoot,
    input.originalEvent.pointerId,
  );
}

function dispatchGotPointerCapture(
  root: CRCInstance,
  input: CRCAdaptedPointerEvent,
): void {
  const target = activateLogicalPointerCapture(
    root.eventRoot,
    input.originalEvent.pointerId,
  );
  if (target) dispatchPointerNode('gotpointercapture', target, input);
}

function dispatchLostPointerCapture(
  root: CRCInstance,
  input: CRCAdaptedPointerEvent,
): void {
  const target = consumeLogicalPointerCaptureLoss(
    root.eventRoot,
    input.originalEvent.pointerId,
  );
  if (target) dispatchPointerNode('lostpointercapture', target, input);
}

function resolvePointerTarget(
  root: CRCInstance,
  input: CRCAdaptedPointerEvent,
): CRCEventNode | undefined {
  return getLogicalPointerCapture(
    root.eventRoot,
    input.originalEvent.pointerId,
  ) ?? resolveCoordinateTarget(root.eventRoot, input);
}

function dispatchPointerNode(
  type: CRCAdaptedPointerEvent['type'],
  target: CRCEventNode,
  input: CRCAdaptedPointerEvent,
  relatedTarget: CRCEventNode | null = null,
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

function livePointerHover(
  root: CRCInstance,
  pointerId: number,
): CRCEventNode | undefined {
  const targets = pointerHoverTargets.get(root.eventRoot);
  const target = targets?.get(pointerId);
  if (!target || isLiveNode(root, target)) return target;
  targets?.delete(pointerId);
  if (targets?.size === 0) pointerHoverTargets.delete(root.eventRoot);
  return undefined;
}

function setPointerHover(
  eventRoot: CRCEventRoot,
  pointerId: number,
  target: CRCEventNode,
): void {
  let targets = pointerHoverTargets.get(eventRoot);
  if (!targets) {
    targets = new Map();
    pointerHoverTargets.set(eventRoot, targets);
  }
  targets.set(pointerId, target);
}

function deletePointerHover(
  eventRoot: CRCEventRoot,
  pointerId: number,
): void {
  const targets = pointerHoverTargets.get(eventRoot);
  targets?.delete(pointerId);
  if (targets?.size === 0) pointerHoverTargets.delete(eventRoot);
}

function releasePointerHoverTarget(
  eventRoot: CRCEventRoot,
  target: CRCEventNode,
): void {
  const targets = pointerHoverTargets.get(eventRoot);
  if (!targets) return;
  for (const [pointerId, hovered] of targets) {
    if (hovered === target) targets.delete(pointerId);
  }
  if (targets.size === 0) pointerHoverTargets.delete(eventRoot);
}

function dispatchTouchEvent(
  root: CRCInstance,
  input: CRCAdaptedTouchEvent,
): void {
  const groups = new Map<CRCEventNode, CRCAdaptedTouchContact[]>();
  for (const contact of input.changedContacts) {
    const identifier = contact.touch.identifier;
    let target: CRCEventNode | undefined;
    if (input.type === 'touchstart') {
      target = resolveCoordinateTarget(root.eventRoot, contact);
      if (target) setTouchTarget(root.eventRoot, identifier, target);
      else deleteTouchTarget(root.eventRoot, identifier);
    } else {
      target = liveTouchTarget(root, identifier);
    }

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
}

function liveTouchTarget(
  root: CRCInstance,
  identifier: number,
): CRCEventNode | undefined {
  const target = touchTargets.get(root.eventRoot)?.get(identifier);
  if (!target || isLiveNode(root, target)) return target;
  deleteTouchTarget(root.eventRoot, identifier);
  return undefined;
}

function setTouchTarget(
  eventRoot: CRCEventRoot,
  identifier: number,
  target: CRCEventNode,
): void {
  let targets = touchTargets.get(eventRoot);
  if (!targets) {
    targets = new Map();
    touchTargets.set(eventRoot, targets);
  }
  targets.set(identifier, target);
}

function deleteTouchTarget(
  eventRoot: CRCEventRoot,
  identifier: number,
): void {
  const targets = touchTargets.get(eventRoot);
  targets?.delete(identifier);
  if (targets?.size === 0) touchTargets.delete(eventRoot);
}

function releaseTouchTarget(
  eventRoot: CRCEventRoot,
  target: CRCEventNode,
): void {
  const targets = touchTargets.get(eventRoot);
  if (!targets) return;
  for (const [identifier, owner] of targets) {
    if (owner === target) targets.delete(identifier);
  }
  if (targets.size === 0) touchTargets.delete(eventRoot);
}

function dispatchWheelEvent(
  root: CRCInstance,
  input: CRCAdaptedWheelEvent,
): void {
  const target = resolveCoordinateTarget(root.eventRoot, input);
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
  root: CRCInstance,
  input: CRCAdaptedDragEvent,
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
  root: CRCInstance,
  input: CRCAdaptedDragEvent,
): CRCEventNode | undefined {
  const previous = liveDragHover(root);
  const next = resolveCoordinateTarget(root.eventRoot, input);
  if (previous === next) return next;
  return dispatchDragTransition(root, previous, next, input);
}

function dispatchDragTransition(
  root: CRCInstance,
  previous: CRCEventNode | undefined,
  next: CRCEventNode | undefined,
  input: CRCAdaptedDragEvent,
): CRCEventNode | undefined {
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
  root: CRCInstance,
  input: CRCAdaptedDragEvent,
): void {
  const target = resolveCoordinateTarget(root.eventRoot, input);
  if (target) dispatchDragNode(input.type, target, input);
}

function dispatchDragNode(
  type: CRCAdaptedDragEvent['type'],
  target: CRCEventNode,
  input: CRCAdaptedDragEvent,
  relatedTarget: CRCEventNode | null = null,
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

function liveDragHover(root: CRCInstance): CRCEventNode | undefined {
  const target = dragHoverTargets.get(root.eventRoot);
  if (!target || isLiveNode(root, target)) return target;
  dragHoverTargets.delete(root.eventRoot);
  return undefined;
}

function releaseDragHoverTarget(
  eventRoot: CRCEventRoot,
  target: CRCEventNode,
): void {
  if (dragHoverTargets.get(eventRoot) === target) {
    dragHoverTargets.delete(eventRoot);
  }
}

function dispatchMouseEvent(
  root: CRCInstance,
  input: CRCAdaptedMouseEvent,
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
  root: CRCInstance,
  input: CRCAdaptedMouseEvent,
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
  root: CRCInstance,
  input: CRCAdaptedMouseEvent,
): void {
  const previous = liveTarget(root, root.interaction.hoveredRegion);
  root.interaction.pointerCanvas = undefined;
  dispatchMouseTransition(root, previous, undefined, input, undefined);
}

function dispatchMouseTransition(
  root: CRCInstance,
  previous: CRCEventTargetRegistration | undefined,
  next: CRCEventTargetRegistration | undefined,
  input: CRCAdaptedMouseEvent,
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
  root: CRCInstance,
  input: CRCAdaptedMouseEvent,
): void {
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
  if (target) dispatchMouseNode(input.type, target, input);
}

function dispatchActivation(
  root: CRCInstance,
  input: CRCAdaptedMouseEvent,
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

  if (!target || !coordinatePathIncludes(root, input, target)) {
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
  root: CRCInstance,
  input: CRCAdaptedMouseEvent,
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
  root: CRCInstance,
  input: CRCAdaptedMouseEvent,
  node: CRCEventNode,
): boolean {
  const coordinateTarget = resolveCoordinateTarget(root.eventRoot, input);
  return Boolean(
    coordinateTarget && buildEventPath(coordinateTarget).includes(node),
  );
}

function dispatchCoordinateEvent(
  root: CRCInstance,
  input: CRCAdaptedMouseEvent,
): void {
  const target = resolveCoordinateTarget(root.eventRoot, input);
  if (target) dispatchMouseNode(input.type, target, input);
}

function dispatchMouseNode(
  type: CRCAdaptedMouseEvent['type'],
  target: CRCEventNode,
  input: CRCAdaptedMouseEvent,
  relatedTarget: CRCEventNode | null = null,
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

function activationTarget(
  root: CRCInstance,
  down: CRCInteractionActivation | undefined,
  up: CRCInteractionActivation | undefined,
  button: number,
  type: 'click' | 'auxclick',
): CRCEventNode | undefined {
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

function isLiveNode(root: CRCInstance, node: CRCEventNode): boolean {
  if (!node.live || node.owner.eventRoot !== root.eventRoot) return false;
  if (node.kind === 'target') return root.eventRoot.targets.has(node);
  return root.eventRoot.listenersByComponent.get(node.component.id)?.has(node) ??
    false;
}

function liveTarget(
  root: CRCInstance,
  target: CRCEventTargetRegistration | undefined,
): CRCEventTargetRegistration | undefined {
  return target && isLiveNode(root, target) ? target : undefined;
}

function removeActivationNode(
  activation: CRCInteractionActivation | undefined,
  node: CRCEventNode,
): CRCInteractionActivation | undefined {
  if (!activation?.path.includes(node)) return activation;
  if (node.kind === 'target') return undefined;
  const path = activation.path.filter(candidate => candidate !== node);
  return path.length > 0 ? Object.freeze({ ...activation, path }) : undefined;
}

function removeActivationNodeFromMap(
  activations: Map<number, CRCInteractionActivation>,
  node: CRCEventNode,
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
  activations: Map<number, CRCInteractionActivation>,
  button: number,
  activation: CRCInteractionActivation | undefined,
): void {
  if (activation) activations.set(button, activation);
  else activations.delete(button);
}

function resetClickStreak(root: CRCInstance): void {
  root.interaction.clickStreakTarget = undefined;
  root.interaction.clickStreak = 0;
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

function releaseCursorDefaultOwnership(cursorDefault: CRCCursorDefault): void {
  const ownership = cursorDefaultOwnership.get(cursorDefault);
  if (!ownership) return;
  cursorDefaultOwnership.delete(cursorDefault);
  for (const release of ownership.releases) release();
}

function applyCursor(
  instance: CRCInstance,
  region: CRCInteractionRegion | undefined,
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

function lastCursorDefault(instance: CRCInstance): CRCCursorDefault | undefined {
  return Array.from(instance.cursorDefaults).at(-1);
}

function releaseCursor(instance: CRCInstance): void {
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
  throw new Error(`Unhandled CRC event route: ${String(value)}`);
}
