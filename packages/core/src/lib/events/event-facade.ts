import {
  getCRCEventDefinition,
  type CRCEventDefinition,
} from './event-definitions.js';
import type { CRCEventNode } from './registrations.js';
import type {
  CRCEvent,
  CRCEventMap,
  CRCEventPhase,
  CRCEventTarget,
  CRCEventType,
} from './types.js';

export type CRCOriginalEvent<K extends CRCEventType> =
  CRCEventMap[K] extends CRCEvent<infer TOriginal> ? TOriginal : Event;

export interface CreateCRCEventInput<K extends CRCEventType> {
  readonly type: K;
  readonly target: CRCEventNode;
  readonly path: readonly CRCEventNode[];
  readonly relatedTarget?: CRCEventNode | null;
  readonly originalEvent: CRCOriginalEvent<K>;
  readonly sourceEvent?: Event;
  /** Root-logical coordinate supplied by the family adapter. */
  readonly x?: number;
  /** Root-logical coordinate supplied by the family adapter. */
  readonly y?: number;
}

interface CRCEventFacadeState {
  currentTarget: CRCEventTarget;
  eventPhase: CRCEventPhase;
  defaultPrevented: boolean;
  propagationStopped: boolean;
  immediatePropagationStopped: boolean;
}

const states = new WeakMap<object, CRCEventFacadeState>();

export function createCRCEvent<K extends CRCEventType>(
  input: CreateCRCEventInput<K>,
): CRCEventMap[K] {
  const definition = requiredDefinition(input.type);
  const originalEvent = input.originalEvent;
  const publicPath = Object.freeze(
    input.path.map(node => node.publicTarget),
  );
  const state: CRCEventFacadeState = {
    currentTarget: input.target.publicTarget,
    eventPhase: 2,
    defaultPrevented: originalEvent.defaultPrevented,
    propagationStopped: false,
    immediatePropagationStopped: false,
  };
  const facade = {
    type: input.type,
    target: input.target.publicTarget,
    relatedTarget: input.relatedTarget?.publicTarget ?? null,
    bubbles: definition.bubbles,
    cancelable: originalEvent.cancelable,
    timeStamp: originalEvent.timeStamp,
    originalEvent,
    sourceEvent: input.sourceEvent,
    get currentTarget() {
      return state.currentTarget;
    },
    get eventPhase() {
      return state.eventPhase;
    },
    get defaultPrevented() {
      return state.defaultPrevented;
    },
    composedPath() {
      return publicPath;
    },
    preventDefault() {
      if (!originalEvent.cancelable) return;
      state.defaultPrevented = true;
      originalEvent.preventDefault();
    },
    stopPropagation() {
      state.propagationStopped = true;
      originalEvent.stopPropagation();
    },
    stopImmediatePropagation() {
      state.propagationStopped = true;
      state.immediatePropagationStopped = true;
      originalEvent.stopImmediatePropagation();
    },
  } as CRCEvent & Record<string, unknown>;
  states.set(facade, state);
  projectFamilyFields(facade, definition, input);
  return facade as unknown as CRCEventMap[K];
}

export function setCRCEventInvocation(
  event: CRCEvent,
  currentTarget: CRCEventTarget,
  eventPhase: CRCEventPhase,
): void {
  const state = requiredState(event);
  state.currentTarget = currentTarget;
  state.eventPhase = eventPhase;
}

export function isCRCPropagationStopped(event: CRCEvent): boolean {
  return requiredState(event).propagationStopped;
}

export function isCRCImmediatePropagationStopped(event: CRCEvent): boolean {
  return requiredState(event).immediatePropagationStopped;
}

function requiredState(event: CRCEvent): CRCEventFacadeState {
  const state = states.get(event);
  if (!state) throw new Error('CRC event facade state is unavailable.');
  return state;
}

function requiredDefinition(type: CRCEventType): CRCEventDefinition {
  const definition = getCRCEventDefinition(type);
  if (!definition) throw new Error(`Unsupported CRC event type: ${type}`);
  return definition;
}

function projectFamilyFields<K extends CRCEventType>(
  facade: CRCEvent & Record<string, unknown>,
  definition: CRCEventDefinition,
  input: CreateCRCEventInput<K>,
): void {
  const original: unknown = input.originalEvent;
  if (definition.coordinate) {
    Object.assign(facade, { x: input.x ?? 0, y: input.y ?? 0 });
  }

  switch (definition.family) {
    case 'pointer':
      projectMouseFields(facade, original as PointerEvent);
      Object.assign(facade, pick(original as PointerEvent, [
        'pointerId',
        'width',
        'height',
        'pressure',
        'tangentialPressure',
        'tiltX',
        'tiltY',
        'twist',
        'pointerType',
        'isPrimary',
      ]));
      break;
    case 'mouse':
      projectMouseFields(facade, original as MouseEvent);
      break;
    case 'touch':
      projectModifierFields(facade, original as TouchEvent);
      Object.assign(facade, pick(original as TouchEvent, [
        'touches',
        'targetTouches',
        'changedTouches',
      ]));
      break;
    case 'wheel':
      projectMouseFields(facade, original as WheelEvent);
      Object.assign(facade, pick(original as WheelEvent, [
        'deltaX',
        'deltaY',
        'deltaZ',
        'deltaMode',
      ]));
      break;
    case 'keyboard':
      projectModifierFields(facade, original as KeyboardEvent);
      Object.assign(facade, pick(original as KeyboardEvent, [
        'key',
        'code',
        'location',
        'repeat',
        'isComposing',
      ]));
      break;
    case 'input':
      if (definition.type === 'beforeinput' || definition.type === 'input') {
        Object.assign(facade, pick(original as InputEvent, [
          'data',
          'dataTransfer',
          'inputType',
          'isComposing',
        ]));
      }
      break;
    case 'composition':
      Object.assign(facade, pick(original as CompositionEvent, ['data']));
      break;
    case 'clipboard':
      Object.assign(facade, pick(original as ClipboardEvent, ['clipboardData']));
      break;
    case 'drag':
      projectMouseFields(facade, original as DragEvent);
      Object.assign(facade, pick(original as DragEvent, ['dataTransfer']));
      break;
    case 'focus':
      break;
  }
}

function projectMouseFields(
  facade: CRCEvent & Record<string, unknown>,
  original: MouseEvent,
): void {
  projectModifierFields(facade, original);
  Object.assign(facade, pick(original, [
    'clientX',
    'clientY',
    'screenX',
    'screenY',
    'movementX',
    'movementY',
    'button',
    'buttons',
    'detail',
  ]));
}

function projectModifierFields(
  facade: CRCEvent & Record<string, unknown>,
  original: MouseEvent | TouchEvent | KeyboardEvent,
): void {
  Object.assign(facade, pick(original, [
    'altKey',
    'ctrlKey',
    'metaKey',
    'shiftKey',
  ]));
}

function pick<T extends object, K extends keyof T>(
  value: T,
  keys: readonly K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) result[key] = value[key];
  return result;
}
