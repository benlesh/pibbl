import {
  crc,
  crcEventTarget,
  crcState,
  defineComp,
  rect,
  text,
  withFocusManagement,
  type CRCClipboardEvent,
  type CRCCompositionEvent,
  type CRCController,
  type CRCInputEvent,
} from '@crc/core';

function boxPath(x: number, y: number, width: number, height: number): Path2D {
  const path = new Path2D();
  path.rect(x, y, width, height);
  return path;
}

const EditingCompositionClipboardLesson = defineComp<{ readonly canvas: HTMLCanvasElement }>(
  function EditingCompositionClipboardLesson({ canvas }) {
    const [events, setEvents] = crcState<readonly string[]>([]);
    const record = (message: string) => setEvents(current => [...current.slice(-7), message]);
    const dispatchSyntheticEditingSample = () => {
      canvas.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, data: 'Δ', inputType: 'insertText' }));
      canvas.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'Δ', inputType: 'insertText' }));
      canvas.dispatchEvent(new Event('change', { bubbles: true }));
      canvas.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: 'あ' }));
      canvas.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles: true, data: 'あい' }));
      canvas.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '愛' }));
      canvas.dispatchEvent(new Event('select', { bubbles: true }));
      canvas.dispatchEvent(new Event('selectionchange'));
    };
    const snapshot = crcEventTarget({
      onBeforeInput: (event: CRCInputEvent) => record(`beforeinput ${event.inputType}: ${event.data ?? 'null'}`),
      onChange: () => record('change'),
      onCompositionEnd: (event: CRCCompositionEvent) => record(`compositionend: ${event.data}`),
      onCompositionStart: (event: CRCCompositionEvent) => record(`compositionstart: ${event.data}`),
      onCompositionUpdate: (event: CRCCompositionEvent) => record(`compositionupdate: ${event.data}`),
      onCopy: (event: CRCClipboardEvent) => record(`copy (${event.clipboardData ? 'clipboard data available' : 'no clipboard data'})`),
      onCut: (event: CRCClipboardEvent) => record(`cut (${event.clipboardData ? 'clipboard data available' : 'no clipboard data'})`),
      onInput: (event: CRCInputEvent) => record(`input ${event.inputType}: ${event.data ?? 'null'}`),
      onPaste: (event: CRCClipboardEvent) => record(`paste (${event.clipboardData?.getData('text/plain') || 'browser data'})`),
      onSelect: () => record('select'),
      onSelectionChange: () => record('selectionchange'),
      onClick: dispatchSyntheticEditingSample,
    }, { path: boxPath(88, 86, 544, 118), fill: true, cursor: 'pointer', keyboardFocusable: true });

    return [
      rect({ style: { width: 720, height: 420, fill: '#fdf4ff' } }),
      text({ style: { x: 360, y: 31, text: 'EDITING, COMPOSITION & CLIPBOARD TRANSPORT', textAlign: 'center', fill: '#4a044e', font: '800 20px Arial' } }),
      rect({ style: { x: 88, y: 86, width: 544, height: 118, fill: '#a21caf', stroke: snapshot.isFocused ? '#111827' : '#701a75', strokeWidth: snapshot.isFocused ? 5 : 2 } }),
      snapshot.isFocusVisible ? rect({ style: { x: 80, y: 78, width: 560, height: 134, stroke: '#facc15', strokeWidth: 4 } }) : undefined,
      text({ style: { x: 360, y: 132, text: 'CLICK TO DISPATCH A NATIVE SYNTHETIC EDITING SEQUENCE', textAlign: 'center', fill: '#ffffff', font: '700 15px Arial' } }),
      text({ style: { x: 360, y: 164, text: 'Then press ⌘/Ctrl-C, ⌘/Ctrl-X, or ⌘/Ctrl-V while this Canvas target is focused.', textAlign: 'center', fill: '#fce7f3', font: '12px Arial' } }),
      text({ style: { x: 360, y: 180, text: 'The trace records event transport; Canvas itself does not edit text.', textAlign: 'center', fill: '#fce7f3', font: '11px monospace' } }),
      text({ style: { x: 360, y: 193, text: 'Use semantic DOM controls for an accessible editing experience.', textAlign: 'center', fill: '#fce7f3', font: '11px monospace' } }),
      rect({ style: { x: 56, y: 234, width: 608, height: 142, fill: '#4a044e' } }),
      text({ style: { x: 76, y: 258, text: 'EVENT TRACE', fill: '#f5d0fe', font: '700 12px monospace' } }),
      ...(events.length ? events : ['beforeinput · input · change · compositionstart/update/end · select · selectionchange · copy/cut/paste']).map((entry, index) => text({ style: {
          x: 76, y: 278 + index * 12, text: entry, fill: '#fdf4ff', font: '10px monospace',
        } })),
      text({ style: { x: 360, y: 405, text: 'For real editing, selection, names, and assistive technology, pair Canvas state with application-owned semantic DOM controls.', textAlign: 'center', fill: '#701a75', font: '11px Arial' } }),
    ];
  },
);

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, withFocusManagement(EditingCompositionClipboardLesson({ canvas })));
}
