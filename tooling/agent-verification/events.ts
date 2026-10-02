import type { CRCEvent, CRCEventTarget } from '@crc/core';

interface EventTraceRecord {
  readonly sequence: number;
  readonly eventId: number;
  readonly invocationId: number;
  readonly label: string;
  readonly stage: 'enter' | 'return' | 'throw';
  readonly type: string;
  readonly phase: 1 | 2 | 3;
  readonly targetId: number;
  readonly currentTargetId: number;
  readonly defaultPrevented: boolean;
  readonly original: Readonly<{ type: string; isTrusted: boolean }>;
  readonly source: Readonly<{ type: string; isTrusted: boolean }> | null;
  readonly path: Readonly<{ order: 'root-to-target'; completeness: 'complete' | 'truncated'; total: number; ids: readonly number[] }>;
}
let nextTraceId = 0;

/** Explicit application handler instrumentation; no runtime observer or listener is installed. */
export function createEventTrace({ capacity = 128, pathLimit = 32 }: { capacity?: number; pathLimit?: number } = {}) {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 256) throw new RangeError('Event trace capacity must be 1..256.');
  if (!Number.isInteger(pathLimit) || pathLimit < 1 || pathLimit > 64) throw new RangeError('Event path limit must be 1..64.');
  const traceId = ++nextTraceId;
  let status: 'recording' | 'stopped' | 'disposed' = 'recording';
  let targets = new WeakMap<CRCEventTarget, number>();
  let events = new WeakMap<CRCEvent, number>();
  let nextTarget = 0; let nextEvent = 0; let invocation = 0;
  let sequence = 0; let count = 0; let cursor = 0;
  const ring: EventTraceRecord[] = [];
  function identifyTarget(target: CRCEventTarget) {
    let id = targets.get(target);
    if (id === undefined) { id = ++nextTarget; targets.set(target, id); }
    return id;
  }
  function append(event: CRCEvent, label: string, invocationId: number, stage: EventTraceRecord['stage']) {
    if (status !== 'recording') return;
    let eventId = events.get(event);
    if (eventId === undefined) { eventId = ++nextEvent; events.set(event, eventId); }
    const path = event.composedPath();
    const record: EventTraceRecord = Object.freeze({
      sequence: ++sequence, eventId, invocationId, label, stage,
      type: event.type.slice(0, 64), phase: event.eventPhase,
      targetId: identifyTarget(event.target), currentTargetId: identifyTarget(event.currentTarget),
      defaultPrevented: event.defaultPrevented,
      original: Object.freeze({ type: event.originalEvent.type.slice(0, 64), isTrusted: event.originalEvent.isTrusted }),
      source: event.sourceEvent ? Object.freeze({ type: event.sourceEvent.type.slice(0, 64), isTrusted: event.sourceEvent.isTrusted }) : null,
      path: Object.freeze({ order: 'root-to-target', total: path.length,
        completeness: path.length > pathLimit ? 'truncated' : 'complete',
        ids: Object.freeze(path.slice(0, pathLimit).map(identifyTarget)) }),
    });
    ring[cursor] = record; cursor = (cursor + 1) % capacity; count = Math.min(capacity, count + 1);
  }
  return Object.freeze({
    wrap<E extends CRCEvent, R>(label: string, handler: (event: E) => R): (event: E) => R {
      if (typeof label !== 'string' || label.length === 0 || label.length > 64) throw new RangeError('Explicit handler label must contain 1..64 characters.');
      return event => {
        if (status !== 'recording') return handler(event);
        const invocationId = ++invocation;
        append(event, label, invocationId, 'enter');
        try {
          const returned = handler(event);
          append(event, label, invocationId, 'return');
          return returned;
        } catch (error) {
          append(event, label, invocationId, 'throw');
          throw error;
        }
      };
    },
    snapshot() {
      const records = Array.from({ length: count }, (_, index) => ring[(cursor - count + capacity + index) % capacity]);
      return Object.freeze({ schema: 'crc-event-trace/1', traceId, status, scope: 'wrapped-handlers-only',
        identityScope: 'trace-local', asyncCompletion: 'not-observed', propagationStopReason: 'not-observed',
        capacity, pathLimit, dropped: sequence - count,
        completeness: sequence > count ? 'truncated-history' : 'retained-history',
        records: Object.freeze(records) });
    },
    stop() { if (status === 'recording') status = 'stopped'; },
    dispose() { status = 'disposed'; ring.length = 0; count = 0; sequence = 0; cursor = 0; targets = new WeakMap(); events = new WeakMap(); },
  });
}
