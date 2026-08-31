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
} from '@crc/core';

function boxPath(x: number, y: number, width: number, height: number): Path2D {
  const path = new Path2D();
  path.rect(x, y, width, height);
  return path;
}

interface SquareProps {
  readonly label: string;
  readonly record: (message: string) => void;
  readonly x: number;
  readonly y: number;
}

const DirectionalSquare = defineComp<SquareProps>(function DirectionalSquare({ label, record, x, y }) {
  const width = 74;
  const height = 54;
  const snapshot = crcEventTarget({
    onClick: () => record(`${label}: click`),
    onFocus: () => record(`${label}: focused`),
  }, {
    path: boxPath(x, y, width, height), fill: true, cursor: 'pointer',
    keyboardNavigationBounds: { x, y, width, height },
  });
  return [
    rect({ style: { x, y, width, height, fill: '#2563eb', stroke: snapshot.isFocused ? '#111827' : '#1e3a8a', strokeWidth: snapshot.isFocused ? 4 : 2 } }),
    snapshot.isFocusVisible ? rect({ style: { x: x - 4, y: y - 4, width: width + 8, height: height + 8, stroke: '#facc15', strokeWidth: 3 } }) : undefined,
    text({ style: { x: x + width / 2, y: y + 33, text: label, textAlign: 'center', fill: '#ffffff', font: '800 17px Arial' } }),
  ];
});

const PlainButton = defineComp<SquareProps>(function PlainButton({ label, record, x, y }) {
  const snapshot = crcEventTarget({ onClick: () => record(`${label}: click`) }, {
    path: boxPath(x, y, 204, 38), fill: true, cursor: 'pointer',
  });
  return [
    rect({ style: { x, y, width: 204, height: 38, fill: '#0f766e', stroke: snapshot.isFocused ? '#111827' : '#115e59', strokeWidth: snapshot.isFocused ? 4 : 2 } }),
    text({ style: { x: x + 102, y: y + 25, text: label, textAlign: 'center', fill: '#ffffff', font: '700 13px Arial' } }),
  ];
});

const DirectionalGrid = defineComp<{ readonly record: (message: string) => void }>(
  function DirectionalGrid({ record }) {
    const squares = ['1', '2', '3', '4', '5', '6'];
    return squares.map((label, index) => DirectionalSquare({
      key: label,
      label,
      record,
      x: 230 + (index % 3) * 92,
      y: 112 + Math.floor(index / 3) * 72,
    }));
  },
);

const DirectionalNavigationLesson = defineComp(function DirectionalNavigationLesson() {
  const [events, setEvents] = crcState<readonly string[]>([]);
  const record = (message: string) => setEvents(current => [...current.slice(-2), message]);
  return [
    rect({ style: { width: 720, height: 420, fill: '#eff6ff' } }),
    text({ style: { x: 360, y: 30, text: 'DIRECTIONAL KEYBOARD NAVIGATION', textAlign: 'center', fill: '#172554', font: '800 21px Arial' } }),
    PlainButton({ label: 'Above the square boundary', record, x: 258, y: 50 }),
    withKeyboardNavigation(DirectionalGrid({ record }), { mode: 'directional' }),
    PlainButton({ label: 'Below the square boundary', record, x: 258, y: 278 }),
    text({ style: { x: 360, y: 334, text: 'Arrow keys use each custom target’s declared keyboardNavigationBounds.', textAlign: 'center', fill: '#1e3a8a', font: '13px Arial' } }),
    text({ style: { x: 360, y: 356, text: 'At an edge nothing wraps; with no candidate, focus and the browser default remain unchanged.', textAlign: 'center', fill: '#1e3a8a', font: '12px Arial' } }),
    text({ style: { x: 360, y: 378, text: 'Tab ignores geometry: Above → 1 → 2 → 3 → 4 → 5 → 6 → Below (row-major source order).', textAlign: 'center', fill: '#172554', font: '11px monospace' } }),
    text({ style: { x: 360, y: 406, text: events.length ? events.join('  ·  ') : 'Click or Tab into a square, then use the arrow keys.', textAlign: 'center', fill: '#334155', font: '12px monospace' } }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, withFocusManagement(DirectionalNavigationLesson({})));
}
