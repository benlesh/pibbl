import { getCRCEventDefinition } from './event-definitions.js';
import {
  createCRCEvent,
  isCRCImmediatePropagationStopped,
  isCRCPropagationStopped,
  setCRCEventInvocation,
  type CreateCRCEventInput,
} from './event-facade.js';
import { buildEventPath } from './event-path.js';
import type {
  CRCEventNode,
  CRCEventTargetRegistration,
  CRCNormalizedHandlers,
} from './registrations.js';
import type {
  CRCEvent,
  CRCEventMap,
  CRCEventPhase,
  CRCEventType,
} from './types.js';

export interface DispatchEventPathInput<K extends CRCEventType>
  extends Omit<CreateCRCEventInput<K>, 'path'> {
  readonly target: CRCEventTargetRegistration;
}

type CRCNormalizedCaptureKey = `${CRCEventType}Capture`;

export function dispatchEventPath<K extends CRCEventType>(
  input: DispatchEventPathInput<K>,
): CRCEventMap[K] {
  const definition = getCRCEventDefinition(input.type);
  if (!definition) {
    throw new Error(`Unsupported CRC event type: ${input.type}`);
  }
  const path = buildEventPath(input.target);
  const event = createCRCEvent({ ...input, path });
  const targetIndex = path.length - 1;

  for (let index = 0; index < targetIndex; index++) {
    if (isCRCPropagationStopped(event)) break;
    invoke(path[index], input.type, true, 1, event);
  }

  if (!isCRCPropagationStopped(event) && input.target.live) {
    invoke(input.target, input.type, true, 2, event);
    if (!isCRCImmediatePropagationStopped(event)) {
      invoke(input.target, input.type, false, 2, event);
    }
  }

  if (definition.bubbles && !isCRCPropagationStopped(event)) {
    for (let index = targetIndex - 1; index >= 0; index--) {
      if (isCRCPropagationStopped(event)) break;
      invoke(path[index], input.type, false, 3, event);
    }
  }

  return event;
}

function invoke(
  node: CRCEventNode,
  type: CRCEventType,
  capture: boolean,
  phase: CRCEventPhase,
  event: CRCEvent,
): void {
  if (!node.live) return;
  const key = capture ? `${type}Capture` as CRCNormalizedCaptureKey : type;
  const handler = node.handlers[key as keyof CRCNormalizedHandlers];
  if (!handler) return;
  setCRCEventInvocation(event, node.publicTarget, phase);
  try {
    (handler as (event: CRCEvent) => void)(event);
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
