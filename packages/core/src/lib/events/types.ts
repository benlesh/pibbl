import type { LayoutBox } from '../layout/types.js';

export interface CRCEvent<TOriginal extends Event = Event> {
  readonly type: string;
  readonly target: CRCEventTarget;
  readonly currentTarget: CRCEventTarget;
  readonly relatedTarget: CRCEventTarget | null;
  readonly eventPhase: 1 | 2 | 3;
  readonly bubbles: boolean;
  readonly cancelable: boolean;
  readonly defaultPrevented: boolean;
  readonly timeStamp: number;
  readonly originalEvent: TOriginal;
  readonly sourceEvent?: Event;
  composedPath(): readonly CRCEventTarget[];
  preventDefault(): void;
  stopPropagation(): void;
  stopImmediatePropagation(): void;
}

export interface CRCEventTarget {
  setPointerCapture(pointerId: number): void;
  hasPointerCapture(pointerId: number): boolean;
  releasePointerCapture(pointerId: number): void;
}

export interface CRCEventTargetSnapshot {
  readonly isFocused: boolean;
  readonly isFocusVisible: boolean;
}

export interface CRCEventTargetOptions {
  readonly path: Path2D;
  readonly fill?: boolean;
  readonly lineInteractionWidth?: number;
  readonly cursor?: string;
  readonly keyboardFocusable?: boolean;
  readonly keyboardNavigationBounds?: Readonly<LayoutBox>;
}

interface CRCModifierEvent<TOriginal extends Event> extends CRCEvent<TOriginal> {
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
}

export interface CRCMouseEvent<TOriginal extends MouseEvent = MouseEvent>
  extends CRCModifierEvent<TOriginal> {
  /** Root-logical canvas coordinates. */
  readonly x: number;
  /** Root-logical canvas coordinates. */
  readonly y: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly screenX: number;
  readonly screenY: number;
  readonly movementX: number;
  readonly movementY: number;
  readonly button: number;
  readonly buttons: number;
  readonly detail: number;
}

export interface CRCPointerEvent extends CRCMouseEvent<PointerEvent> {
  readonly pointerId: number;
  readonly width: number;
  readonly height: number;
  readonly pressure: number;
  readonly tangentialPressure: number;
  readonly tiltX: number;
  readonly tiltY: number;
  readonly twist: number;
  readonly pointerType: string;
  readonly isPrimary: boolean;
}

export interface CRCTouchEvent extends CRCModifierEvent<TouchEvent> {
  /** Root-logical coordinates from the first changed touch. */
  readonly x: number;
  /** Root-logical coordinates from the first changed touch. */
  readonly y: number;
  readonly touches: TouchList;
  readonly targetTouches: TouchList;
  readonly changedTouches: TouchList;
}

export interface CRCWheelEvent extends CRCMouseEvent<WheelEvent> {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly deltaZ: number;
  readonly deltaMode: number;
}

export interface CRCKeyboardEvent extends CRCModifierEvent<KeyboardEvent> {
  readonly key: string;
  readonly code: string;
  readonly location: number;
  readonly repeat: boolean;
  readonly isComposing: boolean;
}

export interface CRCFocusEvent extends CRCEvent<FocusEvent> {}

export interface CRCInputEvent extends CRCEvent<InputEvent> {
  readonly data: string | null;
  readonly dataTransfer: DataTransfer | null;
  readonly inputType: string;
  readonly isComposing: boolean;
}

export interface CRCCompositionEvent extends CRCEvent<CompositionEvent> {
  readonly data: string;
}

export interface CRCClipboardEvent extends CRCEvent<ClipboardEvent> {
  readonly clipboardData: DataTransfer | null;
}

export interface CRCDragEvent extends CRCMouseEvent<DragEvent> {
  readonly dataTransfer: DataTransfer | null;
}

export interface CRCEventMap {
  pointerover: CRCPointerEvent;
  pointerenter: CRCPointerEvent;
  pointerdown: CRCPointerEvent;
  pointermove: CRCPointerEvent;
  pointerrawupdate: CRCPointerEvent;
  pointerup: CRCPointerEvent;
  pointercancel: CRCPointerEvent;
  pointerout: CRCPointerEvent;
  pointerleave: CRCPointerEvent;
  gotpointercapture: CRCPointerEvent;
  lostpointercapture: CRCPointerEvent;
  click: CRCMouseEvent;
  dblclick: CRCMouseEvent;
  auxclick: CRCMouseEvent;
  contextmenu: CRCMouseEvent;
  mouseover: CRCMouseEvent;
  mouseenter: CRCMouseEvent;
  mousedown: CRCMouseEvent;
  mousemove: CRCMouseEvent;
  mouseup: CRCMouseEvent;
  mouseout: CRCMouseEvent;
  mouseleave: CRCMouseEvent;
  touchstart: CRCTouchEvent;
  touchmove: CRCTouchEvent;
  touchend: CRCTouchEvent;
  touchcancel: CRCTouchEvent;
  wheel: CRCWheelEvent;
  keydown: CRCKeyboardEvent;
  keyup: CRCKeyboardEvent;
  focus: CRCFocusEvent;
  blur: CRCFocusEvent;
  focusin: CRCFocusEvent;
  focusout: CRCFocusEvent;
  beforeinput: CRCInputEvent;
  input: CRCInputEvent;
  change: CRCEvent;
  compositionstart: CRCCompositionEvent;
  compositionupdate: CRCCompositionEvent;
  compositionend: CRCCompositionEvent;
  select: CRCEvent;
  selectionchange: CRCEvent;
  copy: CRCClipboardEvent;
  cut: CRCClipboardEvent;
  paste: CRCClipboardEvent;
  dragstart: CRCDragEvent;
  drag: CRCDragEvent;
  dragend: CRCDragEvent;
  dragenter: CRCDragEvent;
  dragleave: CRCDragEvent;
  dragover: CRCDragEvent;
  drop: CRCDragEvent;
}

export type CRCEventType = keyof CRCEventMap;

interface CRCEventPropMap {
  pointerover: 'onPointerOver';
  pointerenter: 'onPointerEnter';
  pointerdown: 'onPointerDown';
  pointermove: 'onPointerMove';
  pointerrawupdate: 'onPointerRawUpdate';
  pointerup: 'onPointerUp';
  pointercancel: 'onPointerCancel';
  pointerout: 'onPointerOut';
  pointerleave: 'onPointerLeave';
  gotpointercapture: 'onGotPointerCapture';
  lostpointercapture: 'onLostPointerCapture';
  click: 'onClick';
  dblclick: 'onDblClick';
  auxclick: 'onAuxClick';
  contextmenu: 'onContextMenu';
  mouseover: 'onMouseOver';
  mouseenter: 'onMouseEnter';
  mousedown: 'onMouseDown';
  mousemove: 'onMouseMove';
  mouseup: 'onMouseUp';
  mouseout: 'onMouseOut';
  mouseleave: 'onMouseLeave';
  touchstart: 'onTouchStart';
  touchmove: 'onTouchMove';
  touchend: 'onTouchEnd';
  touchcancel: 'onTouchCancel';
  wheel: 'onWheel';
  keydown: 'onKeyDown';
  keyup: 'onKeyUp';
  focus: 'onFocus';
  blur: 'onBlur';
  focusin: 'onFocusIn';
  focusout: 'onFocusOut';
  beforeinput: 'onBeforeInput';
  input: 'onInput';
  change: 'onChange';
  compositionstart: 'onCompositionStart';
  compositionupdate: 'onCompositionUpdate';
  compositionend: 'onCompositionEnd';
  select: 'onSelect';
  selectionchange: 'onSelectionChange';
  copy: 'onCopy';
  cut: 'onCut';
  paste: 'onPaste';
  dragstart: 'onDragStart';
  drag: 'onDrag';
  dragend: 'onDragEnd';
  dragenter: 'onDragEnter';
  dragleave: 'onDragLeave';
  dragover: 'onDragOver';
  drop: 'onDrop';
}

export type CRCEventPropName = CRCEventPropMap[CRCEventType];
export type CRCEventCapturePropName = `${CRCEventPropName}Capture`;

export type CRCEventHandler<K extends CRCEventType> = (
  event: CRCEventMap[K],
) => void;

export type CRCEventHandlers = Partial<{
  [K in CRCEventType as CRCEventPropMap[K]]: CRCEventHandler<K>;
} & {
  [K in CRCEventType as `${CRCEventPropMap[K]}Capture`]: CRCEventHandler<K>;
}>;
