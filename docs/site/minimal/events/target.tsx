import {
  Rectangle,
  Text,
  crc,
  useCursor,
  useEventListener,
  useEventTarget,
  useRectPath,
  type CRCClipboardEvent,
  type CRCCompositionEvent,
  type CRCDragEvent,
  type CRCEvent,
  type CRCEventCapturePropName,
  type CRCEventHandler,
  type CRCEventHandlers,
  type CRCEventMap,
  type CRCEventParticipationOptions,
  type CRCEventPhase,
  type CRCEventPropName,
  type CRCEventTarget,
  type CRCEventTargetOptions,
  type CRCEventTargetSnapshot,
  type CRCEventType,
  type CRCFocusEvent,
  type CRCInputEvent,
  type CRCKeyboardEvent,
  type CRCLogicalMouseEvent,
  type CRCPointerEvent,
  type CRCPointerEvents,
  type CRCTouchEvent,
  type CRCWheelEvent,
  type PixelGridAlignment,
} from '@crc/core';

const canvas = document.createElement('canvas');
canvas.width = 320;
canvas.height = 150;
const status = document.createElement('p');
status.setAttribute('role', 'status');
document.body.append(canvas, status);

function report(event: CRCEvent, detail: string) {
  const phase: CRCEventPhase = event.eventPhase;
  status.textContent = `${event.type} phase ${phase}: ${detail}`;
}

function capturePointer(target: CRCEventTarget, event: CRCPointerEvent) {
  target.setPointerCapture(event.pointerId);
  report(event, `pointer ${event.pointerId} at ${event.x.toFixed(0)}, ${event.y.toFixed(0)}`);
}

const eventType: CRCEventType = 'click';
const eventProp: CRCEventPropName = 'onClick';
const captureProp: CRCEventCapturePropName = 'onClickCapture';
const click: CRCEventHandler<typeof eventType> = (event: CRCLogicalMouseEvent) => {
  report(event, `button ${event.button}`);
};
const pointerType: keyof CRCEventMap = 'pointerdown';
const pointerDown: CRCEventHandler<typeof pointerType> = (event) => {
  capturePointer(event.currentTarget, event);
};
const pointerEvents: CRCPointerEvents = 'none';
const decoration: CRCEventParticipationOptions = { pointerEvents };

function Target() {
  const alignment: PixelGridAlignment = 'round';
  const path = useRectPath(24, 24, 272, 96, { alignToPixelGrid: alignment });
  const options: CRCEventTargetOptions = {
    path,
    fill: true,
    keyboardFocusable: true,
    cursor: 'pointer',
  };
  const handlers: CRCEventHandlers = {
    [eventProp]: click,
    [captureProp]: (event: CRCLogicalMouseEvent) => report(event, 'capture'),
    onPointerDown: pointerDown,
    onPointerUp: (event: CRCPointerEvent) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    onTouchStart: (event: CRCTouchEvent) => report(event, `touch ${event.x.toFixed(0)}`),
    onWheel: (event: CRCWheelEvent) => report(event, `wheel ${event.deltaY}`),
    onKeyDown: (event: CRCKeyboardEvent) => report(event, `key ${event.key}`),
    onFocus: (event: CRCFocusEvent) => report(event, 'focused'),
    onBeforeInput: (event: CRCInputEvent) => report(event, `input ${event.inputType}`),
    onCompositionUpdate: (event: CRCCompositionEvent) => report(event, `composition ${event.data}`),
    onPaste: (event: CRCClipboardEvent) => report(event, `paste ${event.clipboardData?.types.length ?? 0} formats`),
    onDrop: (event: CRCDragEvent) => report(event, `drop ${event.dataTransfer?.files.length ?? 0} files`),
  };
  const focus: CRCEventTargetSnapshot = useEventTarget(handlers, options);
  useCursor({ path, fill: true, style: 'pointer' });
  return <>
    <Rectangle {...decoration} style={{ left: 24, top: 24, width: 272, height: 96, fill: focus.isFocusVisible ? '#0f766e' : '#2563eb' }} />
    <Text {...decoration} style={{ left: 42, top: 58, font: '18px sans-serif', fill: '#fff' }}>Click or touch this target</Text>
  </>;
}

function Scene() {
  useEventListener({ onClick: (event: CRCLogicalMouseEvent) => report(event, 'heard by ancestor') });
  return <Target />;
}

const controller = crc(canvas, <Scene />);
window.addEventListener('pagehide', () => controller.dispose(), { once: true });
