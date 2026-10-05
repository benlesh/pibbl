import type { ArcProps } from '../components/arc.js';
import type { CircleProps } from '../components/circle.js';
import type { EllipseProps } from '../components/ellipse.js';
import type { useEventTarget } from '../hooks/use-event-target.js';
import type { CRCRenderLayerTarget } from '../render-layer/types.js';
import type { LayoutBox } from '../layout/types.js';
import type { PathGeometry } from '../geometry/path-geometry.js';

/**
 * Base CRC event with logical targeting, propagation, and native-event access.
 *
 * @see {@link CRCEventTarget}
 * @see {@link CRCEventPhase}
 * @see {@link CRCClipboardEvent}
 * @see {@link CRCCompositionEvent}
 * @see {@link CRCEventMap}
 */
export interface CRCEvent<TOriginal extends Event = Event> {
  /** Native-style name identifying the event being dispatched. See {@link CRCEvent}. */
  readonly type: string;
  /** The selected logical target or target configuration. See {@link CRCEventTarget}. */
  readonly target: CRCEventTarget;
  /** The logical target whose handler is currently being dispatched. See {@link CRCEventTarget}. */
  readonly currentTarget: CRCEventTarget;
  /**
   * The other logical target involved in a focus or boundary transition. See
   * {@link CRCEventTarget}.
   */
  readonly relatedTarget: CRCEventTarget | null;
  /** Current capture, target, or bubble phase of event propagation. See {@link CRCEventPhase}. */
  readonly eventPhase: CRCEventPhase;
  /** Whether the event propagates through bubble handlers. See {@link CRCEvent}. */
  readonly bubbles: boolean;
  /**
   * Whether the originating event permits cancellation of its default action. See {@link CRCEvent}
   * .
   */
  readonly cancelable: boolean;
  /** Whether the default action has been prevented. See {@link CRCEvent}. */
  readonly defaultPrevented: boolean;
  /** Timestamp of the event in the browser event time coordinate system. See {@link CRCEvent}. */
  readonly timeStamp: number;
  /** The originating browser event. See {@link CRCEvent}. */
  readonly originalEvent: TOriginal;
  /** The native event retained as the source of this logical event. See {@link CRCEvent}. */
  readonly sourceEvent?: Event;
  /**
   * Returns the logical propagation path of the event. See {@link CRCEventTarget}.
   * @returns The logical event propagation path. See {@link CRCEventTarget}.
   */
  composedPath(): readonly CRCEventTarget[];
  /**
   * Prevents the originating event's default action when cancellation is supported. See
   * {@link CRCEvent}.
   */
  preventDefault(): void;
  /** Stops propagation to subsequent logical ancestors. See {@link CRCEvent}. */
  stopPropagation(): void;
  /** Stops remaining handlers at this target and further propagation. See {@link CRCEvent}. */
  stopImmediatePropagation(): void;
}

/**
 * The capture, target, or bubble phase of CRC event dispatch.
 *
 * @see {@link CRCEvent}
 */
export type CRCEventPhase = 1 | 2 | 3;

/**
 * A logical target identity used by CRC event dispatch and focus management.
 *
 * @see {@link CRCEvent}
 */
export interface CRCEventTarget {
  /**
   * Captures the pointer for this logical target until release or cancellation. See
   * {@link CRCEventTarget}.
   * @param pointerId - Pointer identifier from the routed pointer event.
   */
  setPointerCapture(pointerId: number): void;
  /**
   * Reports whether this target currently owns capture of the identified pointer. See
   * {@link CRCEventTarget}.
   * @param pointerId - Pointer identifier to check.
   * @returns Whether this target currently owns capture for that pointer.
   */
  hasPointerCapture(pointerId: number): boolean;
  /**
   * Releases this target's capture of the identified pointer. See {@link CRCEventTarget}.
   * @param pointerId - Pointer identifier from the routed pointer event.
   */
  releasePointerCapture(pointerId: number): void;
}

/**
 * Current interaction and focus state returned for a registered target.
 *
 * @see {@link useEventTarget}
 */
export interface CRCEventTargetSnapshot {
  /** Whether this target currently holds logical focus. See {@link CRCEventTargetSnapshot}. */
  readonly isFocused: boolean;
  /** Whether focus should be presented as keyboard-visible. See {@link CRCEventTargetSnapshot}. */
  readonly isFocusVisible: boolean;
}

/**
 * Whether paint participates in coordinate targeting or is skipped as decoration.
 *
 * @see {@link CRCEventParticipationOptions}
 * @see {@link CRCRenderLayerTarget}
 */
export type CRCPointerEvents = 'auto' | 'none';

/**
 * Controls whether a primitive participates in pointer targeting.
 *
 * @see {@link CRCPointerEvents}
 * @see {@link ArcProps}
 * @see {@link CircleProps}
 * @see {@link EllipseProps}
 */
export interface CRCEventParticipationOptions {
  /** Whether this content participates in pointer targeting. See {@link CRCPointerEvents}. */
  readonly pointerEvents?: CRCPointerEvents;
}

/**
 * Keyboard focus and directional-navigation geometry shared by interactive components.
 *
 * @see {@link CRCEventTargetOptions}
 * @see {@link LayoutBox}
 */
export interface CRCEventFocusOptions {
  /** Whether the target may receive keyboard focus. See {@link CRCEventFocusOptions}. */
  readonly keyboardFocusable?: boolean;
  /** Logical rectangle used for directional keyboard navigation. See {@link LayoutBox}. */
  readonly keyboardNavigationBounds?: Readonly<LayoutBox>;
}

/**
 * Geometry, hit testing, and focus configuration used to register an event target.
 *
 * @see {@link PathGeometry}
 * @see {@link useEventTarget}
 */
export interface CRCEventTargetOptions extends CRCEventFocusOptions {
  /** Path geometry used by this operation. See {@link PathGeometry}. */
  readonly path: Path2D | PathGeometry;
  /**
   * Whether the path's filled interior participates in hit testing. See
   * {@link CRCEventTargetOptions}.
   */
  readonly fill?: boolean;
  /**
   * Width used for line hit testing independently of the visible stroke width. See
   * {@link CRCEventTargetOptions}.
   */
  readonly lineInteractionWidth?: number;
  /**
   * Cursor shown while this target owns pointer presentation. See {@link CRCEventTargetOptions}.
   */
  readonly cursor?: string;
}

/**
 * Keyboard modifier state shared by mouse, pointer, wheel, and keyboard events.
 *
 * @see {@link CRCKeyboardEvent}
 * @see {@link CRCLogicalMouseEvent}
 */
interface CRCModifierEvent<TOriginal extends Event> extends CRCEvent<TOriginal> {
  /** Whether Alt was held when the event occurred. See {@link CRCModifierEvent}. */
  readonly altKey: boolean;
  /** Whether Control was held when the event occurred. See {@link CRCModifierEvent}. */
  readonly ctrlKey: boolean;
  /**
   * Whether the platform Meta key was held when the event occurred. See {@link CRCModifierEvent}.
   */
  readonly metaKey: boolean;
  /** Whether Shift was held when the event occurred. See {@link CRCModifierEvent}. */
  readonly shiftKey: boolean;
}

/**
 * Mouse event coordinates and buttons expressed in CRC's logical coordinate system.
 *
 * @see {@link CRCDragEvent}
 * @see {@link CRCEventMap}
 * @see {@link CRCPointerEvent}
 */
export interface CRCLogicalMouseEvent<
  TOriginal extends MouseEvent = MouseEvent,
> extends CRCModifierEvent<TOriginal> {
  /** Root-logical canvas coordinates. */
  readonly x: number;
  /** Root-logical canvas coordinates. */
  readonly y: number;
  /** Browser client-space horizontal coordinate. See {@link CRCLogicalMouseEvent}. */
  readonly clientX: number;
  /** Browser client-space vertical coordinate. See {@link CRCLogicalMouseEvent}. */
  readonly clientY: number;
  /** Browser screen-space horizontal coordinate. See {@link CRCLogicalMouseEvent}. */
  readonly screenX: number;
  /** Browser screen-space vertical coordinate. See {@link CRCLogicalMouseEvent}. */
  readonly screenY: number;
  /**
   * Browser-reported horizontal motion since the previous event. See {@link CRCLogicalMouseEvent}
   * .
   */
  readonly movementX: number;
  /**
   * Browser-reported vertical motion since the previous event. See {@link CRCLogicalMouseEvent}.
   */
  readonly movementY: number;
  /**
   * The button that changed state for this mouse or pointer event. See
   * {@link CRCLogicalMouseEvent}.
   */
  readonly button: number;
  /**
   * Bit mask of buttons held during this mouse or pointer event. See {@link CRCLogicalMouseEvent}
   * .
   */
  readonly buttons: number;
  /** Browser mouse-event detail, such as the click count. See {@link CRCLogicalMouseEvent}. */
  readonly detail: number;
}

/**
 * CRC's logical pointer event, retaining the corresponding native event payload.
 *
 * @see {@link CRCLogicalMouseEvent}
 * @see {@link CRCEventMap}
 */
export interface CRCPointerEvent extends CRCLogicalMouseEvent<PointerEvent> {
  /** Browser identifier of the active pointer. See {@link CRCPointerEvent}. */
  readonly pointerId: number;
  /**
   * Horizontal extent in the units of the containing geometry or surface. See
   * {@link CRCPointerEvent}.
   */
  readonly width: number;
  /**
   * Vertical extent in the units of the containing geometry or surface. See
   * {@link CRCPointerEvent}.
   */
  readonly height: number;
  /** Normalized pressure reported by the pointer device. See {@link CRCPointerEvent}. */
  readonly pressure: number;
  /** Normalized tangential pressure reported by the pointer device. See {@link CRCPointerEvent}. */
  readonly tangentialPressure: number;
  /** Pointer tilt relative to the x axis, in degrees. See {@link CRCPointerEvent}. */
  readonly tiltX: number;
  /** Pointer tilt relative to the y axis, in degrees. See {@link CRCPointerEvent}. */
  readonly tiltY: number;
  /** Pointer rotation around its own axis, in degrees. See {@link CRCPointerEvent}. */
  readonly twist: number;
  /** Browser-reported pointer device category. See {@link CRCPointerEvent}. */
  readonly pointerType: string;
  /** Whether this is the primary pointer of its device category. See {@link CRCPointerEvent}. */
  readonly isPrimary: boolean;
}

/**
 * CRC's logical touch event, retaining the corresponding native event payload.
 *
 * @see {@link CRCEventMap}
 */
export interface CRCTouchEvent extends CRCModifierEvent<TouchEvent> {
  /** Root-logical coordinates from the first changed touch. */
  readonly x: number;
  /** Root-logical coordinates from the first changed touch. */
  readonly y: number;
  /** All active browser touch contacts. See {@link CRCTouchEvent}. */
  readonly touches: TouchList;
  /** Active browser touch contacts associated with the event target. See {@link CRCTouchEvent}. */
  readonly targetTouches: TouchList;
  /** Browser touch contacts changed by this event. See {@link CRCTouchEvent}. */
  readonly changedTouches: TouchList;
}

/**
 * CRC's logical wheel event, retaining the corresponding native event payload.
 *
 * @see {@link CRCLogicalMouseEvent}
 * @see {@link CRCEventMap}
 */
export interface CRCWheelEvent extends CRCLogicalMouseEvent<WheelEvent> {
  /**
   * Horizontal wheel displacement in the units identified by deltaMode. See {@link CRCWheelEvent}
   * .
   */
  readonly deltaX: number;
  /**
   * Vertical wheel displacement in the units identified by deltaMode. See {@link CRCWheelEvent}.
   */
  readonly deltaY: number;
  /** Depth wheel displacement in the units identified by deltaMode. See {@link CRCWheelEvent}. */
  readonly deltaZ: number;
  /** The browser unit convention for wheel deltas. See {@link CRCWheelEvent}. */
  readonly deltaMode: number;
}

/**
 * CRC's logical keyboard event, retaining the corresponding native event payload.
 *
 * @see {@link CRCEventMap}
 */
export interface CRCKeyboardEvent extends CRCModifierEvent<KeyboardEvent> {
  /** Logical key value reported by the browser. See {@link CRCKeyboardEvent}. */
  readonly key: string;
  /** Physical key code reported by the browser. See {@link CRCKeyboardEvent}. */
  readonly code: string;
  /** Browser-reported location of the key on the keyboard. See {@link CRCKeyboardEvent}. */
  readonly location: number;
  /** Whether the browser reported an auto-repeated key press. See {@link CRCKeyboardEvent}. */
  readonly repeat: boolean;
  /**
   * Whether the event occurred during an active text-composition session. See
   * {@link CRCKeyboardEvent}.
   */
  readonly isComposing: boolean;
}

/**
 * CRC's logical focus event, retaining the corresponding native event payload.
 *
 * @see {@link CRCEvent}
 * @see {@link CRCEventMap}
 */
export interface CRCFocusEvent extends CRCEvent<FocusEvent> {}

/**
 * CRC's logical input event, retaining the corresponding native event payload.
 *
 * @see {@link CRCEvent}
 * @see {@link CRCEventMap}
 */
export interface CRCInputEvent extends CRCEvent<InputEvent> {
  /**
   * Application data supplied to the component or reported by the event. See {@link CRCInputEvent}
   * .
   */
  readonly data: string | null;
  /**
   * Drag-and-drop or input transfer payload from the originating browser event. See
   * {@link CRCInputEvent}.
   */
  readonly dataTransfer: DataTransfer | null;
  /** The editing operation reported by the browser input event. See {@link CRCInputEvent}. */
  readonly inputType: string;
  /**
   * Whether the event occurred during an active text-composition session. See
   * {@link CRCInputEvent}.
   */
  readonly isComposing: boolean;
}

/**
 * CRC's logical composition event, retaining the corresponding native event payload.
 *
 * @see {@link CRCEvent}
 * @see {@link CRCEventMap}
 */
export interface CRCCompositionEvent extends CRCEvent<CompositionEvent> {
  /**
   * Application data supplied to the component or reported by the event. See
   * {@link CRCCompositionEvent}.
   */
  readonly data: string;
}

/**
 * CRC's logical clipboard event, retaining the corresponding native event payload.
 *
 * @see {@link CRCEvent}
 * @see {@link CRCEventMap}
 */
export interface CRCClipboardEvent extends CRCEvent<ClipboardEvent> {
  /** Clipboard payload supplied by the originating browser event. See {@link CRCClipboardEvent}. */
  readonly clipboardData: DataTransfer | null;
}

/**
 * CRC's logical drag event, retaining the corresponding native event payload.
 *
 * @see {@link CRCLogicalMouseEvent}
 * @see {@link CRCEventMap}
 */
export interface CRCDragEvent extends CRCLogicalMouseEvent<DragEvent> {
  /**
   * Drag-and-drop or input transfer payload from the originating browser event. See
   * {@link CRCDragEvent}.
   */
  readonly dataTransfer: DataTransfer | null;
}

/**
 * Maps supported native-style event names to their CRC event payload types.
 *
 * @see {@link CRCPointerEvent}
 * @see {@link CRCLogicalMouseEvent}
 * @see {@link CRCTouchEvent}
 * @see {@link CRCWheelEvent}
 * @see {@link CRCKeyboardEvent}
 * @see {@link CRCFocusEvent}
 * @see {@link CRCInputEvent}
 * @see {@link CRCEvent}
 * @see {@link CRCCompositionEvent}
 * @see {@link CRCClipboardEvent}
 * @see {@link CRCDragEvent}
 */
export interface CRCEventMap {
  /** The typed CRC payload for the pointerover event. See {@link CRCPointerEvent}. */
  pointerover: CRCPointerEvent;
  /** The typed CRC payload for the pointerenter event. See {@link CRCPointerEvent}. */
  pointerenter: CRCPointerEvent;
  /** The typed CRC payload for the pointerdown event. See {@link CRCPointerEvent}. */
  pointerdown: CRCPointerEvent;
  /** The typed CRC payload for the pointermove event. See {@link CRCPointerEvent}. */
  pointermove: CRCPointerEvent;
  /** The typed CRC payload for the pointerrawupdate event. See {@link CRCPointerEvent}. */
  pointerrawupdate: CRCPointerEvent;
  /** The typed CRC payload for the pointerup event. See {@link CRCPointerEvent}. */
  pointerup: CRCPointerEvent;
  /** The typed CRC payload for the pointercancel event. See {@link CRCPointerEvent}. */
  pointercancel: CRCPointerEvent;
  /** The typed CRC payload for the pointerout event. See {@link CRCPointerEvent}. */
  pointerout: CRCPointerEvent;
  /** The typed CRC payload for the pointerleave event. See {@link CRCPointerEvent}. */
  pointerleave: CRCPointerEvent;
  /** The typed CRC payload for the gotpointercapture event. See {@link CRCPointerEvent}. */
  gotpointercapture: CRCPointerEvent;
  /** The typed CRC payload for the lostpointercapture event. See {@link CRCPointerEvent}. */
  lostpointercapture: CRCPointerEvent;
  /** The typed CRC payload for the click event. See {@link CRCLogicalMouseEvent}. */
  click: CRCLogicalMouseEvent;
  /** The typed CRC payload for the dblclick event. See {@link CRCLogicalMouseEvent}. */
  dblclick: CRCLogicalMouseEvent;
  /** The typed CRC payload for the auxclick event. See {@link CRCLogicalMouseEvent}. */
  auxclick: CRCLogicalMouseEvent;
  /** The typed CRC payload for the contextmenu event. See {@link CRCLogicalMouseEvent}. */
  contextmenu: CRCLogicalMouseEvent;
  /** The typed CRC payload for the mouseover event. See {@link CRCLogicalMouseEvent}. */
  mouseover: CRCLogicalMouseEvent;
  /** The typed CRC payload for the mouseenter event. See {@link CRCLogicalMouseEvent}. */
  mouseenter: CRCLogicalMouseEvent;
  /** The typed CRC payload for the mousedown event. See {@link CRCLogicalMouseEvent}. */
  mousedown: CRCLogicalMouseEvent;
  /** The typed CRC payload for the mousemove event. See {@link CRCLogicalMouseEvent}. */
  mousemove: CRCLogicalMouseEvent;
  /** The typed CRC payload for the mouseup event. See {@link CRCLogicalMouseEvent}. */
  mouseup: CRCLogicalMouseEvent;
  /** The typed CRC payload for the mouseout event. See {@link CRCLogicalMouseEvent}. */
  mouseout: CRCLogicalMouseEvent;
  /** The typed CRC payload for the mouseleave event. See {@link CRCLogicalMouseEvent}. */
  mouseleave: CRCLogicalMouseEvent;
  /** The typed CRC payload for the touchstart event. See {@link CRCTouchEvent}. */
  touchstart: CRCTouchEvent;
  /** The typed CRC payload for the touchmove event. See {@link CRCTouchEvent}. */
  touchmove: CRCTouchEvent;
  /** The typed CRC payload for the touchend event. See {@link CRCTouchEvent}. */
  touchend: CRCTouchEvent;
  /** The typed CRC payload for the touchcancel event. See {@link CRCTouchEvent}. */
  touchcancel: CRCTouchEvent;
  /** The typed CRC payload for the wheel event. See {@link CRCWheelEvent}. */
  wheel: CRCWheelEvent;
  /** The typed CRC payload for the keydown event. See {@link CRCKeyboardEvent}. */
  keydown: CRCKeyboardEvent;
  /** The typed CRC payload for the keyup event. See {@link CRCKeyboardEvent}. */
  keyup: CRCKeyboardEvent;
  /** The typed CRC payload for the focus event. See {@link CRCFocusEvent}. */
  focus: CRCFocusEvent;
  /** The typed CRC payload for the blur event. See {@link CRCFocusEvent}. */
  blur: CRCFocusEvent;
  /** The typed CRC payload for the focusin event. See {@link CRCFocusEvent}. */
  focusin: CRCFocusEvent;
  /** The typed CRC payload for the focusout event. See {@link CRCFocusEvent}. */
  focusout: CRCFocusEvent;
  /** The typed CRC payload for the beforeinput event. See {@link CRCInputEvent}. */
  beforeinput: CRCInputEvent;
  /** The typed CRC payload for the input event. See {@link CRCInputEvent}. */
  input: CRCInputEvent;
  /** The typed CRC payload for the change event. See {@link CRCEvent}. */
  change: CRCEvent;
  /** The typed CRC payload for the compositionstart event. See {@link CRCCompositionEvent}. */
  compositionstart: CRCCompositionEvent;
  /** The typed CRC payload for the compositionupdate event. See {@link CRCCompositionEvent}. */
  compositionupdate: CRCCompositionEvent;
  /** The typed CRC payload for the compositionend event. See {@link CRCCompositionEvent}. */
  compositionend: CRCCompositionEvent;
  /** The typed CRC payload for the select event. See {@link CRCEvent}. */
  select: CRCEvent;
  /** The typed CRC payload for the selectionchange event. See {@link CRCEvent}. */
  selectionchange: CRCEvent;
  /** The typed CRC payload for the copy event. See {@link CRCClipboardEvent}. */
  copy: CRCClipboardEvent;
  /** The typed CRC payload for the cut event. See {@link CRCClipboardEvent}. */
  cut: CRCClipboardEvent;
  /** The typed CRC payload for the paste event. See {@link CRCClipboardEvent}. */
  paste: CRCClipboardEvent;
  /** The typed CRC payload for the dragstart event. See {@link CRCDragEvent}. */
  dragstart: CRCDragEvent;
  /** The typed CRC payload for the drag event. See {@link CRCDragEvent}. */
  drag: CRCDragEvent;
  /** The typed CRC payload for the dragend event. See {@link CRCDragEvent}. */
  dragend: CRCDragEvent;
  /** The typed CRC payload for the dragenter event. See {@link CRCDragEvent}. */
  dragenter: CRCDragEvent;
  /** The typed CRC payload for the dragleave event. See {@link CRCDragEvent}. */
  dragleave: CRCDragEvent;
  /** The typed CRC payload for the dragover event. See {@link CRCDragEvent}. */
  dragover: CRCDragEvent;
  /** The typed CRC payload for the drop event. See {@link CRCDragEvent}. */
  drop: CRCDragEvent;
}

/**
 * The supported event names in the CRC event map.
 *
 * @see {@link CRCEventMap}
 * @see {@link CRCEventHandler}
 * @see {@link CRCEventHandlers}
 * @see {@link CRCEventPropName}
 */
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

/**
 * The bubble-handler prop name corresponding to a supported event type.
 *
 * @see {@link CRCEventType}
 * @see {@link CRCEventCapturePropName}
 */
export type CRCEventPropName = CRCEventPropMap[CRCEventType];
/**
 * The capture-handler prop name corresponding to a supported event type.
 *
 * @see {@link CRCEventPropName}
 */
export type CRCEventCapturePropName = `${CRCEventPropName}Capture`;

/**
 * A typed callback for a CRC event.
 *
 * @param event - Typed CRC event being dispatched to this handler. See {@link CRCEventMap}.
 *
 * @see {@link CRCEventType}
 * @see {@link CRCEventMap}
 * @see {@link CRCEventHandlers}
 */
export type CRCEventHandler<K extends CRCEventType> = (
  event: CRCEventMap[K],
) => void;

/**
 * Optional typed event props for capture and bubble dispatch.
 *
 * @see {@link CRCEventType}
 * @see {@link CRCEventHandler}
 * @see {@link ArcProps}
 * @see {@link CircleProps}
 */
export type CRCEventHandlers = Partial<{
  [K in CRCEventType as CRCEventPropMap[K]]: CRCEventHandler<K>;
} & {
  [K in CRCEventType as `${CRCEventPropMap[K]}Capture`]: CRCEventHandler<K>;
}>;
