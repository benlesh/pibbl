import { GLOBAL_STATE } from './global-state.js';
import type {
  CRCEventType,
  CRCCursorDefault,
  CRCInstance,
  CRCInteractionRegion,
} from './types.js';
import { createMouseEventTransform } from './util/create-mouse-event-transform.js';
import { getMouseCoordinates } from './util/get-mouse-coordinates.js';
import { isHit } from './util/is-hit.js';

export function dispatchCRCEvent(
  instance: CRCInstance,
  type: CRCEventType,
  event: MouseEvent,
  canvas: HTMLCanvasElement,
): void {
  const previousMouseTransform = GLOBAL_STATE.mouseTransform;
  try {
    GLOBAL_STATE.mouseTransform = createMouseEventTransform(canvas);
    dispatchTargetEvent(instance, type, event, canvas);
    dispatchObservers(instance.events[type], event);
  } finally {
    GLOBAL_STATE.mouseTransform = previousMouseTransform;
  }
}

export function removeInteractionRegion(
  instance: CRCInstance,
  region: CRCInteractionRegion,
): void {
  if (!instance.regions.has(region)) {
    return;
  }
  instance.regions.delete(region);
  const interaction = instance.interaction;
  if (interaction.hoveredRegion === region) {
    interaction.hoveredRegion = undefined;
  }
  if (interaction.primaryDownRegion === region) {
    interaction.primaryDownRegion = undefined;
  }
  if (interaction.primaryUpRegion === region) {
    interaction.primaryUpRegion = undefined;
  }
  if (interaction.clickStreakRegion === region) {
    interaction.clickStreakRegion = undefined;
    interaction.clickStreak = 0;
  }
  if (interaction.cursorRegion === region) {
    const canvas = interaction.cursorCanvas;
    releaseCursor(instance);
    if (canvas) {
      applyCursor(instance, undefined, canvas);
    }
  }
}

export function refreshInteractionCursor(
  instance: CRCInstance,
  region: CRCInteractionRegion,
): void {
  if (
    instance.interaction.hoveredRegion === region &&
    instance.interaction.cursorCanvas
  ) {
    applyCursor(instance, region, instance.interaction.cursorCanvas);
  }
}

export function removeCursorDefault(
  instance: CRCInstance,
  cursorDefault: CRCCursorDefault,
): void {
  instance.cursorDefaults.delete(cursorDefault);
  if (instance.interaction.cursorDefault === cursorDefault) {
    const canvas = instance.interaction.cursorCanvas;
    releaseCursor(instance);
    if (canvas) {
      applyCursor(instance, instance.interaction.hoveredRegion, canvas);
    }
  }
}

export function refreshCursorDefault(
  instance: CRCInstance,
  cursorDefault: CRCCursorDefault,
): void {
  const canvas = instance.interaction.cursorCanvas;
  if (canvas && instance.interaction.cursorDefault === cursorDefault) {
    applyCursor(instance, instance.interaction.hoveredRegion, canvas);
  }
}

function dispatchTargetEvent(
  instance: CRCInstance,
  type: CRCEventType,
  event: MouseEvent,
  canvas: HTMLCanvasElement,
): void {
  switch (type) {
    case 'mousemove':
      dispatchMouseMove(instance, event, canvas);
      return;
    case 'mouseout':
      dispatchRootMouseOut(instance, event);
      return;
    case 'mousedown': {
      const target = resolveTarget(instance, event, canvas);
      if (event.button === 0) {
        instance.interaction.primaryDownRegion = target;
        instance.interaction.primaryUpRegion = undefined;
      }
      invokeRegion(instance, target, type, event);
      return;
    }
    case 'mouseup': {
      const target = resolveTarget(instance, event, canvas);
      if (event.button === 0) {
        instance.interaction.primaryUpRegion = target;
      }
      invokeRegion(instance, target, type, event);
      return;
    }
    case 'click':
      dispatchClick(instance, event, canvas);
      return;
    case 'dblclick':
      dispatchDoubleClick(instance, event, canvas);
      return;
    case 'contextmenu':
      invokeRegion(instance, resolveTarget(instance, event, canvas), type, event);
      return;
    case 'mouseover':
      // Logical entry is synthesized from the next movement target. The native
      // Canvas event remains available to Canvas-wide observers below.
      return;
  }
}

function dispatchMouseMove(
  instance: CRCInstance,
  event: MouseEvent,
  canvas: HTMLCanvasElement,
): void {
  const interaction = instance.interaction;
  const previous = liveRegion(instance, interaction.hoveredRegion);
  const next = resolveTarget(instance, event, canvas);

  if (previous === next) {
    if (next) {
      applyCursor(instance, next, canvas);
      invokeRegion(instance, next, 'mousemove', event);
    } else {
      applyCursor(instance, undefined, canvas);
    }
    return;
  }

  interaction.hoveredRegion = undefined;
  releaseCursor(instance);
  invokeRegion(instance, previous, 'mouseout', event);

  const liveNext = liveRegion(instance, next);
  if (!liveNext) {
    applyCursor(instance, undefined, canvas);
    return;
  }

  interaction.hoveredRegion = liveNext;
  applyCursor(instance, liveNext, canvas);
  invokeRegion(instance, liveNext, 'mouseover', event);
  invokeRegion(instance, liveNext, 'mousemove', event);
}

function dispatchRootMouseOut(instance: CRCInstance, event: MouseEvent): void {
  const previous = liveRegion(instance, instance.interaction.hoveredRegion);
  instance.interaction.hoveredRegion = undefined;
  releaseCursor(instance);
  invokeRegion(instance, previous, 'mouseout', event);
}

function dispatchClick(
  instance: CRCInstance,
  event: MouseEvent,
  canvas: HTMLCanvasElement,
): void {
  const interaction = instance.interaction;
  const target = resolveTarget(instance, event, canvas);
  const eligible = event.button === 0 &&
    target !== undefined &&
    interaction.primaryDownRegion === target &&
    interaction.primaryUpRegion === target &&
    liveRegion(instance, target) === target;

  interaction.primaryDownRegion = undefined;
  interaction.primaryUpRegion = undefined;

  if (!eligible) {
    interaction.clickStreakRegion = undefined;
    interaction.clickStreak = 0;
    return;
  }

  invokeRegion(instance, target, 'click', event);
  if (!liveRegion(instance, target)) {
    interaction.clickStreakRegion = undefined;
    interaction.clickStreak = 0;
    return;
  }
  if (interaction.clickStreakRegion === target) {
    interaction.clickStreak++;
  } else {
    interaction.clickStreakRegion = target;
    interaction.clickStreak = 1;
  }
}

function dispatchDoubleClick(
  instance: CRCInstance,
  event: MouseEvent,
  canvas: HTMLCanvasElement,
): void {
  const target = resolveTarget(instance, event, canvas);
  if (
    target &&
    instance.interaction.clickStreakRegion === target &&
    instance.interaction.clickStreak >= 2
  ) {
    invokeRegion(instance, target, 'dblclick', event);
  }
}

function resolveTarget(
  instance: CRCInstance,
  event: MouseEvent,
  canvas: HTMLCanvasElement,
): CRCInteractionRegion | undefined {
  const [x, y] = getMouseCoordinates(event);
  const regions = Array.from(instance.regions);
  for (let index = regions.length - 1; index >= 0; index--) {
    const region = regions[index];
    if (!region.path) {
      return region;
    }
    if (isHit({
      canvas,
      path: region.path,
      transform: region.transform,
      x,
      y,
      fill: region.fill,
      lineInteractionWidth: region.lineInteractionWidth,
      currentClippingStack: region.clippingStack,
    })) {
      return region;
    }
  }
  return undefined;
}

function invokeRegion(
  instance: CRCInstance,
  region: CRCInteractionRegion | undefined,
  type: CRCEventType,
  event: MouseEvent,
): void {
  const live = liveRegion(instance, region);
  if (!live) {
    return;
  }
  const handler = live.handlers[type];
  if (!handler) {
    return;
  }
  const [x, y] = getMouseCoordinates(event);
  try {
    handler({ originalEvent: event, x, y });
  } catch (error) {
    reportError(error);
  }
}

function liveRegion(
  instance: CRCInstance,
  region: CRCInteractionRegion | undefined,
): CRCInteractionRegion | undefined {
  return region && instance.regions.has(region) ? region : undefined;
}

function dispatchObservers(
  handlers: Set<(event: MouseEvent) => void>,
  event: MouseEvent,
): void {
  for (const handler of Array.from(handlers)) {
    if (!handlers.has(handler)) {
      continue;
    }
    try {
      handler(event);
    } catch (error) {
      reportError(error);
    }
  }
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
  const cursorDefaults = Array.from(instance.cursorDefaults);
  return cursorDefaults.at(-1);
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
