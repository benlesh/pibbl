import { getInteractionRoot } from '../global-state.js';
import type {
  CRCCursorDefault,
  CRCInstance,
  CRCInteractionActivation,
  CRCInteractionRegion,
} from '../types.js';
import {
  adaptMouseEvent,
  isNativeMouseEventType,
  type CRCAdaptedMouseEvent,
} from './adapters/mouse.js';
import { planBoundaryTransitions } from './boundary-transitions.js';
import { buildEventPath } from './event-path.js';
import { resolveCoordinateTarget } from './hit-test.js';
import { dispatchEventPath } from './propagation.js';
import {
  releaseTarget,
  type CRCEventNode,
  type CRCEventTargetRegistration,
} from './registrations.js';
import type { CRCEventType } from './types.js';

interface CursorDefaultOwnership {
  readonly root: CRCInstance;
  readonly releases: readonly (() => void)[];
}

const cursorDefaultOwnership = new WeakMap<
  CRCCursorDefault,
  CursorDefaultOwnership
>();

export function dispatchNativeEvent(
  instance: CRCInstance,
  type: CRCEventType,
  nativeEvent: Event,
): void {
  const root = getInteractionRoot(instance);
  if (isNativeMouseEventType(type)) {
    const input = adaptMouseEvent(root, type, nativeEvent);
    if (input) dispatchMouseEvent(root, input);
  }
  dispatchObservers(root.eventRoot.observers.get(type), nativeEvent);
}

/** Clears dispatch-owned references before a logical node becomes dead. */
export function releaseEventNodeState(
  instance: CRCInstance,
  node: CRCEventNode,
): void {
  const root = getInteractionRoot(instance);
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
