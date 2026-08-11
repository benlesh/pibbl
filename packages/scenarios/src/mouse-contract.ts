import type { TraceEventType } from './event-trace';

export interface MouseContractTraceEvent {
  type: TraceEventType;
  target: string;
  relatedTarget: string | null;
}

export interface MouseContractCase {
  id: string;
  title: string;
  gesture: string;
  nativeTrace: readonly MouseContractTraceEvent[] | null;
  crcTrace: readonly MouseContractTraceEvent[];
  rule: string;
  visualTarget: 'a' | 'b' | 'child' | 'layer' | 'none' | 'top';
}

function event(
  type: TraceEventType,
  target: string,
  relatedTarget: string | null = null,
): MouseContractTraceEvent {
  return { type, target, relatedTarget };
}

export const MOUSE_CONTRACT_CASES = [
  {
    id: 'enter-region',
    title: 'Enter a region',
    gesture: 'Move from outside into A.',
    nativeTrace: [event('mouseover', 'a', 'outside'), event('mousemove', 'a')],
    crcTrace: [event('mouseover', 'a', 'outside'), event('mousemove', 'a')],
    rule: 'Resolve the target once; report entry before movement.',
    visualTarget: 'a',
  },
  {
    id: 'move-within-region',
    title: 'Move within a region',
    gesture: 'Move from one point in A to another point in A.',
    nativeTrace: [event('mousemove', 'a')],
    crcTrace: [event('mousemove', 'a')],
    rule: 'A stable target receives movement without another boundary event.',
    visualTarget: 'a',
  },
  {
    id: 'switch-regions',
    title: 'Switch sibling regions',
    gesture: 'Move from A directly into B.',
    nativeTrace: [
      event('mouseout', 'a', 'b'),
      event('mouseover', 'b', 'a'),
      event('mousemove', 'b'),
    ],
    crcTrace: [
      event('mouseout', 'a', 'b'),
      event('mouseover', 'b', 'a'),
      event('mousemove', 'b'),
    ],
    rule: 'Exit precedes entry, and both transitions precede movement.',
    visualTarget: 'b',
  },
  {
    id: 'exit-canvas',
    title: 'Exit the Canvas',
    gesture: 'Move from A outside the root Canvas.',
    nativeTrace: [event('mouseout', 'a', 'outside')],
    crcTrace: [event('mouseout', 'a', 'outside')],
    rule: 'Clear the logical target and report one exit.',
    visualTarget: 'none',
  },
  {
    id: 'overlap-topmost',
    title: 'Overlapping siblings',
    gesture: 'Enter a point painted by A and later-painted B.',
    nativeTrace: [event('mouseover', 'top', 'outside'), event('mousemove', 'top')],
    crcTrace: [event('mouseover', 'top', 'outside'), event('mousemove', 'top')],
    rule: 'Only the topmost interactive hit in reverse paint order is the target.',
    visualTarget: 'top',
  },
  {
    id: 'nested-child',
    title: 'Nested group child',
    gesture: 'Enter an interactive child inside a transformed group.',
    nativeTrace: [event('mouseover', 'child', 'outside'), event('mousemove', 'child')],
    crcTrace: [event('mouseover', 'child', 'outside'), event('mousemove', 'child')],
    rule: 'Target the deepest painted child only; CRC does not synthesize DOM propagation.',
    visualTarget: 'child',
  },
  {
    id: 'clip-intersection-miss',
    title: 'Nested clip miss',
    gesture: 'Move inside the path but outside one active ancestor clip.',
    nativeTrace: null,
    crcTrace: [],
    rule: 'All active clips intersect; failing any clip excludes the target.',
    visualTarget: 'none',
  },
  {
    id: 'transformed-hit',
    title: 'Transformed geometry hit',
    gesture: 'Enter the visible location of a scaled and translated path.',
    nativeTrace: null,
    crcTrace: [event('mouseover', 'a', 'outside'), event('mousemove', 'a')],
    rule: 'Root coordinates stay in Canvas space while render transforms determine the hit.',
    visualTarget: 'a',
  },
  {
    id: 'later-layer-topmost',
    title: 'Later layer wins',
    gesture: 'Enter overlap between a root region and a later-painted layer region.',
    nativeTrace: null,
    crcTrace: [event('mouseover', 'layer', 'outside'), event('mousemove', 'layer')],
    rule: 'Layer composition participates in the same reverse-paint-order target selection.',
    visualTarget: 'layer',
  },
  {
    id: 'primary-click-same-target',
    title: 'Primary click on one target',
    gesture: 'Press and release primary button on A.',
    nativeTrace: [event('mousedown', 'a'), event('mouseup', 'a'), event('click', 'a')],
    crcTrace: [event('mousedown', 'a'), event('mouseup', 'a'), event('click', 'a')],
    rule: 'Activation requires the same still-live logical target for down and up.',
    visualTarget: 'a',
  },
  {
    id: 'primary-click-cross-target',
    title: 'Primary press and release on siblings',
    gesture: 'Press on A, move to B, and release on B.',
    nativeTrace: [
      event('mousedown', 'a'),
      event('mouseout', 'a', 'b'),
      event('mouseover', 'b', 'a'),
      event('mousemove', 'b'),
      event('mouseup', 'b'),
      event('click', 'common-ancestor'),
    ],
    crcTrace: [
      event('mousedown', 'a'),
      event('mouseout', 'a', 'b'),
      event('mouseover', 'b', 'a'),
      event('mousemove', 'b'),
      event('mouseup', 'b'),
    ],
    rule: 'CRC has no ancestor propagation target, so sibling down/up produces no region click.',
    visualTarget: 'b',
  },
  {
    id: 'double-click',
    title: 'Double click',
    gesture: 'Complete two primary clicks on A.',
    nativeTrace: [
      event('mousedown', 'a'),
      event('mouseup', 'a'),
      event('click', 'a'),
      event('mousedown', 'a'),
      event('mouseup', 'a'),
      event('click', 'a'),
      event('dblclick', 'a'),
    ],
    crcTrace: [
      event('mousedown', 'a'),
      event('mouseup', 'a'),
      event('click', 'a'),
      event('mousedown', 'a'),
      event('mouseup', 'a'),
      event('click', 'a'),
      event('dblclick', 'a'),
    ],
    rule: 'Double click requires two successful clicks on the same still-live target.',
    visualTarget: 'a',
  },
  {
    id: 'context-menu',
    title: 'Context menu',
    gesture: 'Press and release the secondary button on B in reference Chromium.',
    nativeTrace: [event('mousedown', 'b'), event('contextmenu', 'b'), event('mouseup', 'b')],
    crcTrace: [event('mousedown', 'b'), event('contextmenu', 'b'), event('mouseup', 'b')],
    rule: 'Target each native event independently; context-menu ordering remains browser-dependent.',
    visualTarget: 'b',
  },
] as const satisfies readonly MouseContractCase[];

export type MouseContractCaseId = (typeof MOUSE_CONTRACT_CASES)[number]['id'];

export function getMouseContractCase(id: string): MouseContractCase | undefined {
  return MOUSE_CONTRACT_CASES.find(contractCase => contractCase.id === id);
}

export function formatContractTrace(trace: readonly MouseContractTraceEvent[] | null): string {
  if (trace === null) {
    return 'Canvas-specific';
  }
  if (!trace.length) {
    return 'No region event';
  }
  return trace.map(({ type, target, relatedTarget }) =>
    `${type}(${target}${relatedTarget ? ` ← ${relatedTarget}` : ''})`,
  ).join(' → ');
}
