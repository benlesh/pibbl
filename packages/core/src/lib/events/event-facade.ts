import {
  getPibblEventDefinition,
  type PibblEventDefinition,
} from './event-definitions.js';
import type { PibblEventNode } from './registrations.js';
import type {
  PibblEvent,
  PibblEventMap,
  PibblEventPhase,
  PibblEventTarget,
  PibblEventType,
} from './types.js';

export type PibblOriginalEvent<K extends PibblEventType> =
  PibblEventMap[K] extends PibblEvent<infer TOriginal> ? TOriginal : Event;

export interface CreatePibblEventInput<K extends PibblEventType> {
  readonly type: K;
  readonly target: PibblEventNode;
  readonly path: readonly PibblEventNode[];
  readonly relatedTarget?: PibblEventNode | null;
  readonly originalEvent: PibblOriginalEvent<K>;
  readonly sourceEvent?: Event;
  /** Root-logical coordinate supplied by the family adapter. */
  readonly x?: number;
  /** Root-logical coordinate supplied by the family adapter. */
  readonly y?: number;
}

interface PibblEventFacadeState {
  dispatchFinished?: boolean;
  resources?: Map<object, { value: unknown; dispose: () => void }>;
  currentTarget: PibblEventTarget;
  eventPhase: PibblEventPhase;
  defaultPrevented: boolean;
  propagationStopped: boolean;
  immediatePropagationStopped: boolean;
}

const states = new WeakMap<object, PibblEventFacadeState>();

/** Private opt-in dispatch ownership; ordinary events allocate no resource map.
 * @param event - The currently dispatched logical event.
 * @param key - Identity of this optional integration resource.
 * @param create - Lazy initializer with an exact dispatch-end disposer.
 * @returns Shared resource for this logical dispatch.
 * @see {@link PibblEvent}
 */
export function borrowDispatchResource<T>(event: PibblEvent, key: object, create: () => {value:T;dispose:()=>void}): T {
  const state = requiredState(event);
  if (state.dispatchFinished) throw new Error('Inspection dispatch has expired.');
  const resources = state.resources ??= new Map();
  let resource = resources.get(key);
  if (!resource) { resource = create(); resources.set(key,resource); }
  return resource.value as T;
}

/** Releases optional synchronous resources even when a handler fails. */
export function finishEventDispatch(event: PibblEvent): void {
  const state = requiredState(event);
  state.dispatchFinished = true;
  const resources = state.resources;
  if (resources) {
    for (const resource of resources.values()) resource.dispose();
    resources.clear();
    state.resources = undefined;
  }
}

export function createPibblEvent<K extends PibblEventType>(
  input: CreatePibblEventInput<K>,
): PibblEventMap[K] {
  const definition = requiredDefinition(input.type);
  const originalEvent = input.originalEvent;
  const cancelable = definition.cancelable && originalEvent.cancelable;
  const publicPath = Object.freeze(
    input.path.map(node => node.publicTarget),
  );
  const state: PibblEventFacadeState = {
    currentTarget: input.target.publicTarget,
    eventPhase: 2,
    defaultPrevented: cancelable && originalEvent.defaultPrevented,
    propagationStopped: false,
    immediatePropagationStopped: false,
  };
  const facade = {
    type: input.type,
    target: input.target.publicTarget,
    relatedTarget: input.relatedTarget?.publicTarget ?? null,
    bubbles: definition.bubbles,
    cancelable,
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
      if (!cancelable) return;
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
  } as PibblEvent & Record<string, unknown>;
  states.set(facade, state);
  projectFamilyFields(facade, definition, input);
  return facade as unknown as PibblEventMap[K];
}

export function setPibblEventInvocation(
  event: PibblEvent,
  currentTarget: PibblEventTarget,
  eventPhase: PibblEventPhase,
): void {
  const state = requiredState(event);
  state.currentTarget = currentTarget;
  state.eventPhase = eventPhase;
}

export function isPibblPropagationStopped(event: PibblEvent): boolean {
  return requiredState(event).propagationStopped;
}

export function isPibblImmediatePropagationStopped(event: PibblEvent): boolean {
  return requiredState(event).immediatePropagationStopped;
}

function requiredState(event: PibblEvent): PibblEventFacadeState {
  const state = states.get(event);
  if (!state) throw new Error('Pibbl event facade state is unavailable.');
  return state;
}

function requiredDefinition(type: PibblEventType): PibblEventDefinition {
  const definition = getPibblEventDefinition(type);
  if (!definition) throw new Error(`Unsupported Pibbl event type: ${type}`);
  return definition;
}

function projectFamilyFields<K extends PibblEventType>(
  facade: PibblEvent & Record<string, unknown>,
  definition: PibblEventDefinition,
  input: CreatePibblEventInput<K>,
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
  facade: PibblEvent & Record<string, unknown>,
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
  facade: PibblEvent & Record<string, unknown>,
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
