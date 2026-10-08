import { getPibblEventDefinition } from './event-definitions.js';
import {
  createPibblEvent,
  finishEventDispatch,
  isPibblImmediatePropagationStopped,
  isPibblPropagationStopped,
  setPibblEventInvocation,
  type CreatePibblEventInput,
} from './event-facade.js';
import { buildEventPath } from './event-path.js';
import type {
  PibblEventNode,
  PibblNormalizedHandlers,
} from './registrations.js';
import type {
  PibblEvent,
  PibblEventMap,
  PibblEventPhase,
  PibblEventType,
} from './types.js';

export interface DispatchEventPathInput<K extends PibblEventType>
  extends Omit<CreatePibblEventInput<K>, 'path'> {
  readonly target: PibblEventNode;
}

type PibblNormalizedCaptureKey = `${PibblEventType}Capture`;

export function dispatchEventPath<K extends PibblEventType>(
  input: DispatchEventPathInput<K>,
): PibblEventMap[K] {
  const definition = getPibblEventDefinition(input.type);
  if (!definition) {
    throw new Error(`Unsupported Pibbl event type: ${input.type}`);
  }
  const path = buildEventPath(input.target);
  const event = createPibblEvent({ ...input, path });
  const targetIndex = path.length - 1;
  try {
  for (let index = 0; index < targetIndex; index++) {
    if (isPibblPropagationStopped(event)) break;
    invoke(path[index], input.type, true, 1, event);
  }

  if (!isPibblPropagationStopped(event) && input.target.live) {
    invoke(input.target, input.type, true, 2, event);
    if (!isPibblImmediatePropagationStopped(event)) {
      invoke(input.target, input.type, false, 2, event);
    }
  }

  if (definition.bubbles && !isPibblPropagationStopped(event)) {
    for (let index = targetIndex - 1; index >= 0; index--) {
      if (isPibblPropagationStopped(event)) break;
      invoke(path[index], input.type, false, 3, event);
    }
  }

  return event;
  } finally { finishEventDispatch(event); }
}

function invoke(
  node: PibblEventNode,
  type: PibblEventType,
  capture: boolean,
  phase: PibblEventPhase,
  event: PibblEvent,
): void {
  if (!node.live) return;
  const key = capture ? `${type}Capture` as PibblNormalizedCaptureKey : type;
  const handler = node.handlers[key as keyof PibblNormalizedHandlers];
  if (!handler) return;
  setPibblEventInvocation(event, node.publicTarget, phase);
  try {
    (handler as (event: PibblEvent) => void)(event);
  } catch (error) {
    reportDispatchError(error);
  }
}

function reportDispatchError(error: unknown): void {
  try {
    globalThis.reportError(error);
  } catch {
    // Reporting cannot suppress unrelated handlers in this logical dispatch.
  }
}
