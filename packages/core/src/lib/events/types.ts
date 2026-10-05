import type { ArcProps } from '../components/arc.js';
import type { CircleProps } from '../components/circle.js';
import type { EllipseProps } from '../components/ellipse.js';
import type { useEventTarget } from '../hooks/use-event-target.js';
import type { PibblRenderLayerTarget } from '../render-layer/types.js';
import type { LayoutBox } from '../layout/types.js';
import type { PathGeometry } from '../geometry/path-geometry.js';

/**
 * Base Pibbl event with logical targeting, propagation, and native-event access.
 *
 * @see {@link PibblEventTarget}
 * @see {@link PibblEventPhase}
 * @see {@link PibblClipboardEvent}
 * @see {@link PibblCompositionEvent}
 * @see {@link PibblEventMap}
 */
export interface PibblEvent<TOriginal extends Event = Event> {
  /** Native-style name identifying the event being dispatched. See {@link PibblEvent}. */
  readonly type: string;
  /** The selected logical target or target configuration. See {@link PibblEventTarget}. */
  readonly target: PibblEventTarget;
  /** The logical target whose handler is currently being dispatched. See {@link PibblEventTarget}. */
  readonly currentTarget: PibblEventTarget;
  /**
   * The other logical target involved in a focus or boundary transition. See
   * {@link PibblEventTarget}.
   */
  readonly relatedTarget: PibblEventTarget | null;
  /** Current capture, target, or bubble phase of event propagation. See {@link PibblEventPhase}. */
  readonly eventPhase: PibblEventPhase;
  /** Whether the event propagates through bubble handlers. See {@link PibblEvent}. */
  readonly bubbles: boolean;
  /**
   * Whether the originating event permits cancellation of its default action. See {@link PibblEvent}
   * .
   */
  readonly cancelable: boolean;
  /** Whether the default action has been prevented. See {@link PibblEvent}. */
  readonly defaultPrevented: boolean;
  /** Timestamp of the event in the browser event time coordinate system. See {@link PibblEvent}. */
  readonly timeStamp: number;
  /** The originating browser event. See {@link PibblEvent}. */
  readonly originalEvent: TOriginal;
  /** The native event retained as the source of this logical event. See {@link PibblEvent}. */
  readonly sourceEvent?: Event;
  /**
   * Returns the logical propagation path of the event. See {@link PibblEventTarget}.
   * @returns The logical event propagation path. See {@link PibblEventTarget}.
   */
  composedPath(): readonly PibblEventTarget[];
  /**
   * Prevents the originating event's default action when cancellation is supported. See
   * {@link PibblEvent}.
   */
  preventDefault(): void;
  /** Stops propagation to subsequent logical ancestors. See {@link PibblEvent}. */
  stopPropagation(): void;
  /** Stops remaining handlers at this target and further propagation. See {@link PibblEvent}. */
  stopImmediatePropagation(): void;
}

/**
 * The capture, target, or bubble phase of Pibbl event dispatch.
 *
 * @see {@link PibblEvent}
 */
export type PibblEventPhase = 1 | 2 | 3;

/**
 * A logical target identity used by Pibbl event dispatch and focus management.
 *
 * @see {@link PibblEvent}
 */
export interface PibblEventTarget {
  /**
   * Captures the pointer for this logical target until release or cancellation. See
   * {@link PibblEventTarget}.
   * @param pointerId - Pointer identifier from the routed pointer event.
   */
  setPointerCapture(pointerId: number): void;
  /**
   * Reports whether this target currently owns capture of the identified pointer. See
   * {@link PibblEventTarget}.
   * @param pointerId - Pointer identifier to check.
   * @returns Whether this target currently owns capture for that pointer.
   */
  hasPointerCapture(pointerId: number): boolean;
  /**
   * Releases this target's capture of the identified pointer. See {@link PibblEventTarget}.
   * @param pointerId - Pointer identifier from the routed pointer event.
   */
  releasePointerCapture(pointerId: number): void;
}

/**
 * Current interaction and focus state returned for a registered target.
 *
 * @see {@link useEventTarget}
 */
export interface PibblEventTargetSnapshot {
  /** Whether this target currently holds logical focus. See {@link PibblEventTargetSnapshot}. */
  readonly isFocused: boolean;
  /** Whether focus should be presented as keyboard-visible. See {@link PibblEventTargetSnapshot}. */
  readonly isFocusVisible: boolean;
}

/**
 * Whether paint participates in coordinate targeting or is skipped as decoration.
 *
 * @see {@link PibblEventParticipationOptions}
 * @see {@link PibblRenderLayerTarget}
 */
export type PibblPointerEvents = 'auto' | 'none';

/**
 * Controls whether a primitive participates in pointer targeting.
 *
 * @see {@link PibblPointerEvents}
 * @see {@link ArcProps}
 * @see {@link CircleProps}
 * @see {@link EllipseProps}
 */
export interface PibblEventParticipationOptions {
  /** Whether this content participates in pointer targeting. See {@link PibblPointerEvents}. */
  readonly pointerEvents?: PibblPointerEvents;
}

/**
 * Keyboard focus and directional-navigation geometry shared by interactive components.
 *
 * @see {@link PibblEventTargetOptions}
 * @see {@link LayoutBox}
 */
export interface PibblEventFocusOptions {
  /** Whether the target may receive keyboard focus. See {@link PibblEventFocusOptions}. */
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
export interface PibblEventTargetOptions extends PibblEventFocusOptions {
  /** Path geometry used by this operation. See {@link PathGeometry}. */
  readonly path: Path2D | PathGeometry;
  /**
   * Whether the path's filled interior participates in hit testing. See
   * {@link PibblEventTargetOptions}.
   */
  readonly fill?: boolean;
  /**
   * Width used for line hit testing independently of the visible stroke width. See
   * {@link PibblEventTargetOptions}.
   */
  readonly lineInteractionWidth?: number;
  /**
   * Cursor shown while this target owns pointer presentation. See {@link PibblEventTargetOptions}.
   */
  readonly cursor?: string;
}

/**
 * Keyboard modifier state shared by mouse, pointer, wheel, and keyboard events.
 *
 * @see {@link PibblKeyboardEvent}
 * @see {@link PibblLogicalMouseEvent}
 */
interface PibblModifierEvent<TOriginal extends Event> extends PibblEvent<TOriginal> {
  /** Whether Alt was held when the event occurred. See {@link PibblModifierEvent}. */
  readonly altKey: boolean;
  /** Whether Control was held when the event occurred. See {@link PibblModifierEvent}. */
  readonly ctrlKey: boolean;
  /**
   * Whether the platform Meta key was held when the event occurred. See {@link PibblModifierEvent}.
   */
  readonly metaKey: boolean;
  /** Whether Shift was held when the event occurred. See {@link PibblModifierEvent}. */
  readonly shiftKey: boolean;
}

/**
 * Mouse event coordinates and buttons expressed in Pibbl's logical coordinate system.
 *
 * @see {@link PibblDragEvent}
 * @see {@link PibblEventMap}
 * @see {@link PibblPointerEvent}
 */
export interface PibblLogicalMouseEvent<
  TOriginal extends MouseEvent = MouseEvent,
> extends PibblModifierEvent<TOriginal> {
  /** Root-logical canvas coordinates. */
  readonly x: number;
  /** Root-logical canvas coordinates. */
  readonly y: number;
  /** Browser client-space horizontal coordinate. See {@link PibblLogicalMouseEvent}. */
  readonly clientX: number;
  /** Browser client-space vertical coordinate. See {@link PibblLogicalMouseEvent}. */
  readonly clientY: number;
  /** Browser screen-space horizontal coordinate. See {@link PibblLogicalMouseEvent}. */
  readonly screenX: number;
  /** Browser screen-space vertical coordinate. See {@link PibblLogicalMouseEvent}. */
  readonly screenY: number;
  /**
   * Browser-reported horizontal motion since the previous event. See {@link PibblLogicalMouseEvent}
   * .
   */
  readonly movementX: number;
  /**
   * Browser-reported vertical motion since the previous event. See {@link PibblLogicalMouseEvent}.
   */
  readonly movementY: number;
  /**
   * The button that changed state for this mouse or pointer event. See
   * {@link PibblLogicalMouseEvent}.
   */
  readonly button: number;
  /**
   * Bit mask of buttons held during this mouse or pointer event. See {@link PibblLogicalMouseEvent}
   * .
   */
  readonly buttons: number;
  /** Browser mouse-event detail, such as the click count. See {@link PibblLogicalMouseEvent}. */
  readonly detail: number;
}

/**
 * Pibbl's logical pointer event, retaining the corresponding native event payload.
 *
 * @see {@link PibblLogicalMouseEvent}
 * @see {@link PibblEventMap}
 */
export interface PibblPointerEvent extends PibblLogicalMouseEvent<PointerEvent> {
  /** Browser identifier of the active pointer. See {@link PibblPointerEvent}. */
  readonly pointerId: number;
  /**
   * Horizontal extent in the units of the containing geometry or surface. See
   * {@link PibblPointerEvent}.
   */
  readonly width: number;
  /**
   * Vertical extent in the units of the containing geometry or surface. See
   * {@link PibblPointerEvent}.
   */
  readonly height: number;
  /** Normalized pressure reported by the pointer device. See {@link PibblPointerEvent}. */
  readonly pressure: number;
  /** Normalized tangential pressure reported by the pointer device. See {@link PibblPointerEvent}. */
  readonly tangentialPressure: number;
  /** Pointer tilt relative to the x axis, in degrees. See {@link PibblPointerEvent}. */
  readonly tiltX: number;
  /** Pointer tilt relative to the y axis, in degrees. See {@link PibblPointerEvent}. */
  readonly tiltY: number;
  /** Pointer rotation around its own axis, in degrees. See {@link PibblPointerEvent}. */
  readonly twist: number;
  /** Browser-reported pointer device category. See {@link PibblPointerEvent}. */
  readonly pointerType: string;
  /** Whether this is the primary pointer of its device category. See {@link PibblPointerEvent}. */
  readonly isPrimary: boolean;
}

/**
 * Pibbl's logical touch event, retaining the corresponding native event payload.
 *
 * @see {@link PibblEventMap}
 */
export interface PibblTouchEvent extends PibblModifierEvent<TouchEvent> {
  /** Root-logical coordinates from the first changed touch. */
  readonly x: number;
  /** Root-logical coordinates from the first changed touch. */
  readonly y: number;
  /** All active browser touch contacts. See {@link PibblTouchEvent}. */
  readonly touches: TouchList;
  /** Active browser touch contacts associated with the event target. See {@link PibblTouchEvent}. */
  readonly targetTouches: TouchList;
  /** Browser touch contacts changed by this event. See {@link PibblTouchEvent}. */
  readonly changedTouches: TouchList;
}

/**
 * Pibbl's logical wheel event, retaining the corresponding native event payload.
 *
 * @see {@link PibblLogicalMouseEvent}
 * @see {@link PibblEventMap}
 */
export interface PibblWheelEvent extends PibblLogicalMouseEvent<WheelEvent> {
  /**
   * Horizontal wheel displacement in the units identified by deltaMode. See {@link PibblWheelEvent}
   * .
   */
  readonly deltaX: number;
  /**
   * Vertical wheel displacement in the units identified by deltaMode. See {@link PibblWheelEvent}.
   */
  readonly deltaY: number;
  /** Depth wheel displacement in the units identified by deltaMode. See {@link PibblWheelEvent}. */
  readonly deltaZ: number;
  /** The browser unit convention for wheel deltas. See {@link PibblWheelEvent}. */
  readonly deltaMode: number;
}

/**
 * Pibbl's logical keyboard event, retaining the corresponding native event payload.
 *
 * @see {@link PibblEventMap}
 */
export interface PibblKeyboardEvent extends PibblModifierEvent<KeyboardEvent> {
  /** Logical key value reported by the browser. See {@link PibblKeyboardEvent}. */
  readonly key: string;
  /** Physical key code reported by the browser. See {@link PibblKeyboardEvent}. */
  readonly code: string;
  /** Browser-reported location of the key on the keyboard. See {@link PibblKeyboardEvent}. */
  readonly location: number;
  /** Whether the browser reported an auto-repeated key press. See {@link PibblKeyboardEvent}. */
  readonly repeat: boolean;
  /**
   * Whether the event occurred during an active text-composition session. See
   * {@link PibblKeyboardEvent}.
   */
  readonly isComposing: boolean;
}

/**
 * Pibbl's logical focus event, retaining the corresponding native event payload.
 *
 * @see {@link PibblEvent}
 * @see {@link PibblEventMap}
 */
export interface PibblFocusEvent extends PibblEvent<FocusEvent> {}

/**
 * Pibbl's logical input event, retaining the corresponding native event payload.
 *
 * @see {@link PibblEvent}
 * @see {@link PibblEventMap}
 */
export interface PibblInputEvent extends PibblEvent<InputEvent> {
  /**
   * Application data supplied to the component or reported by the event. See {@link PibblInputEvent}
   * .
   */
  readonly data: string | null;
  /**
   * Drag-and-drop or input transfer payload from the originating browser event. See
   * {@link PibblInputEvent}.
   */
  readonly dataTransfer: DataTransfer | null;
  /** The editing operation reported by the browser input event. See {@link PibblInputEvent}. */
  readonly inputType: string;
  /**
   * Whether the event occurred during an active text-composition session. See
   * {@link PibblInputEvent}.
   */
  readonly isComposing: boolean;
}

/**
 * Pibbl's logical composition event, retaining the corresponding native event payload.
 *
 * @see {@link PibblEvent}
 * @see {@link PibblEventMap}
 */
export interface PibblCompositionEvent extends PibblEvent<CompositionEvent> {
  /**
   * Application data supplied to the component or reported by the event. See
   * {@link PibblCompositionEvent}.
   */
  readonly data: string;
}

/**
 * Pibbl's logical clipboard event, retaining the corresponding native event payload.
 *
 * @see {@link PibblEvent}
 * @see {@link PibblEventMap}
 */
export interface PibblClipboardEvent extends PibblEvent<ClipboardEvent> {
  /** Clipboard payload supplied by the originating browser event. See {@link PibblClipboardEvent}. */
  readonly clipboardData: DataTransfer | null;
}

/**
 * Pibbl's logical drag event, retaining the corresponding native event payload.
 *
 * @see {@link PibblLogicalMouseEvent}
 * @see {@link PibblEventMap}
 */
export interface PibblDragEvent extends PibblLogicalMouseEvent<DragEvent> {
  /**
   * Drag-and-drop or input transfer payload from the originating browser event. See
   * {@link PibblDragEvent}.
   */
  readonly dataTransfer: DataTransfer | null;
}

/**
 * Maps supported native-style event names to their Pibbl event payload types.
 *
 * @see {@link PibblPointerEvent}
 * @see {@link PibblLogicalMouseEvent}
 * @see {@link PibblTouchEvent}
 * @see {@link PibblWheelEvent}
 * @see {@link PibblKeyboardEvent}
 * @see {@link PibblFocusEvent}
 * @see {@link PibblInputEvent}
 * @see {@link PibblEvent}
 * @see {@link PibblCompositionEvent}
 * @see {@link PibblClipboardEvent}
 * @see {@link PibblDragEvent}
 */
export interface PibblEventMap {
  /** The typed Pibbl payload for the pointerover event. See {@link PibblPointerEvent}. */
  pointerover: PibblPointerEvent;
  /** The typed Pibbl payload for the pointerenter event. See {@link PibblPointerEvent}. */
  pointerenter: PibblPointerEvent;
  /** The typed Pibbl payload for the pointerdown event. See {@link PibblPointerEvent}. */
  pointerdown: PibblPointerEvent;
  /** The typed Pibbl payload for the pointermove event. See {@link PibblPointerEvent}. */
  pointermove: PibblPointerEvent;
  /** The typed Pibbl payload for the pointerrawupdate event. See {@link PibblPointerEvent}. */
  pointerrawupdate: PibblPointerEvent;
  /** The typed Pibbl payload for the pointerup event. See {@link PibblPointerEvent}. */
  pointerup: PibblPointerEvent;
  /** The typed Pibbl payload for the pointercancel event. See {@link PibblPointerEvent}. */
  pointercancel: PibblPointerEvent;
  /** The typed Pibbl payload for the pointerout event. See {@link PibblPointerEvent}. */
  pointerout: PibblPointerEvent;
  /** The typed Pibbl payload for the pointerleave event. See {@link PibblPointerEvent}. */
  pointerleave: PibblPointerEvent;
  /** The typed Pibbl payload for the gotpointercapture event. See {@link PibblPointerEvent}. */
  gotpointercapture: PibblPointerEvent;
  /** The typed Pibbl payload for the lostpointercapture event. See {@link PibblPointerEvent}. */
  lostpointercapture: PibblPointerEvent;
  /** The typed Pibbl payload for the click event. See {@link PibblLogicalMouseEvent}. */
  click: PibblLogicalMouseEvent;
  /** The typed Pibbl payload for the dblclick event. See {@link PibblLogicalMouseEvent}. */
  dblclick: PibblLogicalMouseEvent;
  /** The typed Pibbl payload for the auxclick event. See {@link PibblLogicalMouseEvent}. */
  auxclick: PibblLogicalMouseEvent;
  /** The typed Pibbl payload for the contextmenu event. See {@link PibblLogicalMouseEvent}. */
  contextmenu: PibblLogicalMouseEvent;
  /** The typed Pibbl payload for the mouseover event. See {@link PibblLogicalMouseEvent}. */
  mouseover: PibblLogicalMouseEvent;
  /** The typed Pibbl payload for the mouseenter event. See {@link PibblLogicalMouseEvent}. */
  mouseenter: PibblLogicalMouseEvent;
  /** The typed Pibbl payload for the mousedown event. See {@link PibblLogicalMouseEvent}. */
  mousedown: PibblLogicalMouseEvent;
  /** The typed Pibbl payload for the mousemove event. See {@link PibblLogicalMouseEvent}. */
  mousemove: PibblLogicalMouseEvent;
  /** The typed Pibbl payload for the mouseup event. See {@link PibblLogicalMouseEvent}. */
  mouseup: PibblLogicalMouseEvent;
  /** The typed Pibbl payload for the mouseout event. See {@link PibblLogicalMouseEvent}. */
  mouseout: PibblLogicalMouseEvent;
  /** The typed Pibbl payload for the mouseleave event. See {@link PibblLogicalMouseEvent}. */
  mouseleave: PibblLogicalMouseEvent;
  /** The typed Pibbl payload for the touchstart event. See {@link PibblTouchEvent}. */
  touchstart: PibblTouchEvent;
  /** The typed Pibbl payload for the touchmove event. See {@link PibblTouchEvent}. */
  touchmove: PibblTouchEvent;
  /** The typed Pibbl payload for the touchend event. See {@link PibblTouchEvent}. */
  touchend: PibblTouchEvent;
  /** The typed Pibbl payload for the touchcancel event. See {@link PibblTouchEvent}. */
  touchcancel: PibblTouchEvent;
  /** The typed Pibbl payload for the wheel event. See {@link PibblWheelEvent}. */
  wheel: PibblWheelEvent;
  /** The typed Pibbl payload for the keydown event. See {@link PibblKeyboardEvent}. */
  keydown: PibblKeyboardEvent;
  /** The typed Pibbl payload for the keyup event. See {@link PibblKeyboardEvent}. */
  keyup: PibblKeyboardEvent;
  /** The typed Pibbl payload for the focus event. See {@link PibblFocusEvent}. */
  focus: PibblFocusEvent;
  /** The typed Pibbl payload for the blur event. See {@link PibblFocusEvent}. */
  blur: PibblFocusEvent;
  /** The typed Pibbl payload for the focusin event. See {@link PibblFocusEvent}. */
  focusin: PibblFocusEvent;
  /** The typed Pibbl payload for the focusout event. See {@link PibblFocusEvent}. */
  focusout: PibblFocusEvent;
  /** The typed Pibbl payload for the beforeinput event. See {@link PibblInputEvent}. */
  beforeinput: PibblInputEvent;
  /** The typed Pibbl payload for the input event. See {@link PibblInputEvent}. */
  input: PibblInputEvent;
  /** The typed Pibbl payload for the change event. See {@link PibblEvent}. */
  change: PibblEvent;
  /** The typed Pibbl payload for the compositionstart event. See {@link PibblCompositionEvent}. */
  compositionstart: PibblCompositionEvent;
  /** The typed Pibbl payload for the compositionupdate event. See {@link PibblCompositionEvent}. */
  compositionupdate: PibblCompositionEvent;
  /** The typed Pibbl payload for the compositionend event. See {@link PibblCompositionEvent}. */
  compositionend: PibblCompositionEvent;
  /** The typed Pibbl payload for the select event. See {@link PibblEvent}. */
  select: PibblEvent;
  /** The typed Pibbl payload for the selectionchange event. See {@link PibblEvent}. */
  selectionchange: PibblEvent;
  /** The typed Pibbl payload for the copy event. See {@link PibblClipboardEvent}. */
  copy: PibblClipboardEvent;
  /** The typed Pibbl payload for the cut event. See {@link PibblClipboardEvent}. */
  cut: PibblClipboardEvent;
  /** The typed Pibbl payload for the paste event. See {@link PibblClipboardEvent}. */
  paste: PibblClipboardEvent;
  /** The typed Pibbl payload for the dragstart event. See {@link PibblDragEvent}. */
  dragstart: PibblDragEvent;
  /** The typed Pibbl payload for the drag event. See {@link PibblDragEvent}. */
  drag: PibblDragEvent;
  /** The typed Pibbl payload for the dragend event. See {@link PibblDragEvent}. */
  dragend: PibblDragEvent;
  /** The typed Pibbl payload for the dragenter event. See {@link PibblDragEvent}. */
  dragenter: PibblDragEvent;
  /** The typed Pibbl payload for the dragleave event. See {@link PibblDragEvent}. */
  dragleave: PibblDragEvent;
  /** The typed Pibbl payload for the dragover event. See {@link PibblDragEvent}. */
  dragover: PibblDragEvent;
  /** The typed Pibbl payload for the drop event. See {@link PibblDragEvent}. */
  drop: PibblDragEvent;
}

/**
 * The supported event names in the Pibbl event map.
 *
 * @see {@link PibblEventMap}
 * @see {@link PibblEventHandler}
 * @see {@link PibblEventHandlers}
 * @see {@link PibblEventPropName}
 */
export type PibblEventType = keyof PibblEventMap;

interface PibblEventPropMap {
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
 * @see {@link PibblEventType}
 * @see {@link PibblEventCapturePropName}
 */
export type PibblEventPropName = PibblEventPropMap[PibblEventType];
/**
 * The capture-handler prop name corresponding to a supported event type.
 *
 * @see {@link PibblEventPropName}
 */
export type PibblEventCapturePropName = `${PibblEventPropName}Capture`;

/**
 * A typed callback for a Pibbl event.
 *
 * @param event - Typed Pibbl event being dispatched to this handler. See {@link PibblEventMap}.
 *
 * @see {@link PibblEventType}
 * @see {@link PibblEventMap}
 * @see {@link PibblEventHandlers}
 */
export type PibblEventHandler<K extends PibblEventType> = (
  event: PibblEventMap[K],
) => void;

/**
 * Optional typed event props for capture and bubble dispatch.
 *
 * @see {@link PibblEventType}
 * @see {@link PibblEventHandler}
 * @see {@link ArcProps}
 * @see {@link CircleProps}
 */
export type PibblEventHandlers = Partial<{
  [K in PibblEventType as PibblEventPropMap[K]]: PibblEventHandler<K>;
} & {
  [K in PibblEventType as `${PibblEventPropMap[K]}Capture`]: PibblEventHandler<K>;
}>;
