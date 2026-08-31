import {
  crc,
  crcEventTarget,
  crcState,
  defineComp,
  rect,
  text,
  withFocusManagement,
  type CRCController,
  type CRCEventTargetSnapshot,
  type CRCKeyboardEvent,
  type CRCLogicalMouseEvent,
} from '@crc/core';

function boxPath(x: number, y: number, width: number, height: number): Path2D {
  const path = new Path2D();
  path.rect(x, y, width, height);
  return path;
}

const KeyboardActivationLesson = defineComp(function KeyboardActivationLesson() {
  const [events, setEvents] = crcState<readonly string[]>([]);
  const [activation, setActivation] = crcState('No activation yet');
  const record = (message: string) => setEvents(current => [...current.slice(-5), message]);
  const snapshot: CRCEventTargetSnapshot = crcEventTarget({
    onClick: (event: CRCLogicalMouseEvent) => {
      const source = event.sourceEvent ? `keyboard (${event.sourceEvent.type})` : 'native pointer click';
      setActivation(`click from ${source}; detail ${event.detail}`);
      record(`click → ${source}`);
    },
    onKeyDown: (event: CRCKeyboardEvent) => {
      record(`keydown key=${event.key} code=${event.code} repeat=${event.repeat} shift=${event.shiftKey}`);
      if (event.key === 'Escape') {
        event.preventDefault();
        record('Escape default prevented by the target');
      }
    },
    onKeyUp: (event: CRCKeyboardEvent) => {
      record(`keyup key=${event.key} ctrl=${event.ctrlKey} alt=${event.altKey} meta=${event.metaKey}`);
    },
  }, {
    path: boxPath(174, 94, 372, 154), fill: true, cursor: 'pointer',
  });

  return [
    rect({ style: { width: 720, height: 420, fill: '#fff7ed' } }),
    text({ style: { x: 360, y: 35, text: 'KEYBOARD EVENTS & BUTTON ACTIVATION', textAlign: 'center', fill: '#431407', font: '800 21px Arial' } }),
    rect({ style: {
      x: 174, y: 94, width: 372, height: 154, fill: '#ea580c',
      stroke: snapshot.isFocused ? '#111827' : '#9a3412', strokeWidth: snapshot.isFocused ? 5 : 2,
    } }),
    snapshot.isFocusVisible ? rect({ style: { x: 166, y: 86, width: 388, height: 170, stroke: '#0f172a', strokeWidth: 4 } }) : undefined,
    text({ style: { x: 360, y: 149, text: 'ACTIVATE ME', textAlign: 'center', fill: '#fff7ed', font: '900 30px Arial' } }),
    text({ style: { x: 360, y: 182, text: 'Tab here, then press Enter or Space', textAlign: 'center', fill: '#fff7ed', font: '14px Arial' } }),
    text({ style: { x: 360, y: 214, text: 'Escape is logged and prevents its later default policy.', textAlign: 'center', fill: '#ffedd5', font: '12px monospace' } }),
    text({ style: { x: 360, y: 278, text: activation, textAlign: 'center', fill: '#7c2d12', font: '700 13px monospace' } }),
    rect({ style: { x: 56, y: 300, width: 608, height: 90, fill: '#431407' } }),
    ...(events.length ? events : ['Key fields will appear here.']).map((entry, index) => text({ style: {
      x: 72, y: 324 + index * 13, text: entry, fill: '#ffedd5', font: '11px monospace',
    } })),
    text({ style: { x: 360, y: 410, text: 'Enter clicks on keydown. Space prevents scroll on keydown and clicks on matching keyup.', textAlign: 'center', fill: '#7c2d12', font: '11px Arial' } }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, withFocusManagement(KeyboardActivationLesson({})));
}
