import {
  Rectangle,
  Text,
  pibbl,
  useCursor,
  useEventListener,
  useEventTarget,
  useRectPath,
  type PibblClipboardEvent,
  type PibblCompositionEvent,
  type PibblDragEvent,
  type PibblEvent,
  type PibblEventCapturePropName,
  type PibblEventHandler,
  type PibblEventHandlers,
  type PibblEventMap,
  type PibblEventParticipationOptions,
  type PibblEventPhase,
  type PibblEventPropName,
  type PibblEventTarget,
  type PibblEventTargetOptions,
  type PibblEventTargetSnapshot,
  type PibblEventType,
  type PibblFocusEvent,
  type PibblInputEvent,
  type PibblKeyboardEvent,
  type PibblLogicalMouseEvent,
  type PibblPointerEvent,
  type PibblPointerEvents,
  type PibblTouchEvent,
  type PibblWheelEvent,
  type PixelGridAlignment,
} from '@pibbl/core';

const canvas = document.createElement('canvas');
canvas.width = 320;
canvas.height = 150;
const status = document.createElement('p');
status.setAttribute('role', 'status');
document.body.append(canvas, status);

function report(event: PibblEvent, detail: string) {
  const phase: PibblEventPhase = event.eventPhase;
  status.textContent = `${event.type} phase ${phase}: ${detail}`;
}

function capturePointer(target: PibblEventTarget, event: PibblPointerEvent) {
  target.setPointerCapture(event.pointerId);
  report(event, `pointer ${event.pointerId} at ${event.x.toFixed(0)}, ${event.y.toFixed(0)}`);
}

const eventType: PibblEventType = 'click';
const eventProp: PibblEventPropName = 'onClick';
const captureProp: PibblEventCapturePropName = 'onClickCapture';
const click: PibblEventHandler<typeof eventType> = (event: PibblLogicalMouseEvent) => {
  report(event, `button ${event.button}`);
};
const pointerType: keyof PibblEventMap = 'pointerdown';
const pointerDown: PibblEventHandler<typeof pointerType> = (event) => {
  capturePointer(event.currentTarget, event);
};
const pointerEvents: PibblPointerEvents = 'none';
const decoration: PibblEventParticipationOptions = { pointerEvents };

function Target() {
  const alignment: PixelGridAlignment = 'round';
  const path = useRectPath(24, 24, 272, 96, { alignToPixelGrid: alignment });
  const options: PibblEventTargetOptions = {
    path,
    fill: true,
    keyboardFocusable: true,
    cursor: 'pointer',
  };
  const handlers: PibblEventHandlers = {
    [eventProp]: click,
    [captureProp]: (event: PibblLogicalMouseEvent) => report(event, 'capture'),
    onPointerDown: pointerDown,
    onPointerUp: (event: PibblPointerEvent) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    onTouchStart: (event: PibblTouchEvent) => report(event, `touch ${event.x.toFixed(0)}`),
    onWheel: (event: PibblWheelEvent) => report(event, `wheel ${event.deltaY}`),
    onKeyDown: (event: PibblKeyboardEvent) => report(event, `key ${event.key}`),
    onFocus: (event: PibblFocusEvent) => report(event, 'focused'),
    onBeforeInput: (event: PibblInputEvent) => report(event, `input ${event.inputType}`),
    onCompositionUpdate: (event: PibblCompositionEvent) => report(event, `composition ${event.data}`),
    onPaste: (event: PibblClipboardEvent) => report(event, `paste ${event.clipboardData?.types.length ?? 0} formats`),
    onDrop: (event: PibblDragEvent) => report(event, `drop ${event.dataTransfer?.files.length ?? 0} files`),
  };
  const focus: PibblEventTargetSnapshot = useEventTarget(handlers, options);
  useCursor({ path, fill: true, style: 'pointer' });
  return <>
    <Rectangle {...decoration} style={{ left: 24, top: 24, width: 272, height: 96, fill: focus.isFocusVisible ? '#0f766e' : '#2563eb' }} />
    <Text {...decoration} style={{ left: 42, top: 58, font: '18px sans-serif', fill: '#fff' }}>Click or touch this target</Text>
  </>;
}

function Scene() {
  useEventListener({ onClick: (event: PibblLogicalMouseEvent) => report(event, 'heard by ancestor') });
  return <Target />;
}

const controller = pibbl(canvas, <Scene />);
window.addEventListener('pagehide', () => controller.dispose(), { once: true });
