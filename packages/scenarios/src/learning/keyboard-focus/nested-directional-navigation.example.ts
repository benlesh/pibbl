import {
  crc,
  crcEventTarget,
  crcState,
  defineComp,
  rect,
  text,
  withFocusManagement,
  withKeyboardNavigation,
  type CRCController,
  type CRCKeyboardEvent,
} from '@crc/core';

function boxPath(x: number, y: number, width: number, height: number): Path2D {
  const path = new Path2D();
  path.rect(x, y, width, height);
  return path;
}

interface CellProps {
  readonly color: string;
  readonly formLike?: boolean;
  readonly label: string;
  readonly record: (message: string) => void;
  readonly x: number;
  readonly y: number;
}

const Cell = defineComp<CellProps>(function Cell({ color, formLike = false, label, record, x, y }) {
  const width = 104;
  const height = 54;
  const snapshot = crcEventTarget({
    onClick: () => record(`${label}: click`),
    onFocus: () => record(`${label}: focus`),
    onKeyDown: formLike ? (event: CRCKeyboardEvent) => {
      if (event.key.startsWith('Arrow')) {
        event.preventDefault();
        record(`${label} owns ${event.key}`);
      }
    } : undefined,
  }, {
    path: boxPath(x, y, width, height), fill: true, cursor: 'pointer',
    keyboardNavigationBounds: { x, y, width, height },
  });
  return [
    rect({ style: { x, y, width, height, fill: color, stroke: snapshot.isFocused ? '#111827' : '#475569', strokeWidth: snapshot.isFocused ? 4 : 2 } }),
    snapshot.isFocusVisible ? rect({ style: { x: x - 4, y: y - 4, width: width + 8, height: height + 8, stroke: '#facc15', strokeWidth: 3 } }) : undefined,
    text({ style: { x: x + width / 2, y: y + 24, text: label, textAlign: 'center', fill: '#ffffff', font: '700 13px Arial' } }),
    formLike ? text({ style: { x: x + width / 2, y: y + 42, text: 'owns arrows', textAlign: 'center', fill: '#dbeafe', font: '10px monospace' } }) : undefined,
  ];
});

const InnerBoundary = defineComp<{ readonly record: (message: string) => void }>(
  function InnerBoundary({ record }) {
    return [
      Cell({ label: 'Inner 1', color: '#7c3aed', record, x: 310, y: 142 }),
      Cell({ label: 'Editor', color: '#9333ea', formLike: true, record, x: 426, y: 142 }),
      Cell({ label: 'Inner 3', color: '#7c3aed', record, x: 310, y: 208 }),
      Cell({ label: 'Inner 4', color: '#7c3aed', record, x: 426, y: 208 }),
    ];
  },
);

const OuterBoundary = defineComp<{ readonly record: (message: string) => void }>(
  function OuterBoundary({ record }) {
    return [
      Cell({ label: 'Outer left', color: '#0f766e', record, x: 66, y: 174 }),
      rect({ style: { x: 284, y: 116, width: 262, height: 172, fill: '#ede9fe', stroke: '#7c3aed', strokeWidth: 3 } }),
      withKeyboardNavigation(InnerBoundary({ record }), { mode: 'directional' }),
      Cell({ label: 'Outer right', color: '#0f766e', record, x: 550, y: 174 }),
    ];
  },
);

const NestedDirectionalNavigationLesson = defineComp(function NestedDirectionalNavigationLesson() {
  const [events, setEvents] = crcState<readonly string[]>([]);
  const record = (message: string) => setEvents(current => [...current.slice(-2), message]);
  return [
    rect({ style: { width: 720, height: 420, fill: '#f8fafc' } }),
    text({ style: { x: 360, y: 29, text: 'NESTED DIRECTIONAL BOUNDARIES', textAlign: 'center', fill: '#0f172a', font: '800 21px Arial' } }),
    withKeyboardNavigation(OuterBoundary({ record }), { mode: 'directional' }),
    text({ style: { x: 415, y: 132, text: 'nearest boundary', textAlign: 'center', fill: '#5b21b6', font: '700 12px monospace' } }),
    text({ style: { x: 360, y: 322, text: 'Inner arrows never escape to the outer cells, even at an inner edge.', textAlign: 'center', fill: '#334155', font: '13px Arial' } }),
    text({ style: { x: 360, y: 345, text: 'The Editor calls preventDefault() for arrows, so neither boundary moves focus.', textAlign: 'center', fill: '#334155', font: '12px Arial' } }),
    text({ style: { x: 360, y: 369, text: 'Tab remains global source order: Outer left → Inner 1 → Editor → Inner 3 → Inner 4 → Outer right.', textAlign: 'center', fill: '#0f172a', font: '11px monospace' } }),
    text({ style: { x: 360, y: 402, text: events.length ? events.join('  ·  ') : 'Click a cell or Tab in, then use arrows.', textAlign: 'center', fill: '#475569', font: '12px monospace' } }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, withFocusManagement(NestedDirectionalNavigationLesson({})));
}
