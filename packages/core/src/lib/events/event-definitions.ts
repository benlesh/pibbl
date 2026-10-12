import type {
  PibblEventCapturePropName,
  PibblEventHandlers,
  PibblEventPropName,
  PibblEventType,
} from './types.js';

export interface PibblEventDefinition {
  readonly type: PibblEventType;
  readonly prop: PibblEventPropName;
  readonly captureProp: PibblEventCapturePropName;
  readonly family:
    | 'pointer'
    | 'mouse'
    | 'touch'
    | 'wheel'
    | 'keyboard'
    | 'focus'
    | 'input'
    | 'composition'
    | 'clipboard'
    | 'drag';
  readonly bubbles: boolean;
  readonly cancelable: boolean;
  readonly coordinate: boolean;
}

export const PIBBL_EVENT_DEFINITIONS = Object.freeze([
  { type: 'pointerover', prop: 'onPointerOver', captureProp: 'onPointerOverCapture', family: 'pointer', bubbles: true, cancelable: true, coordinate: true },
  { type: 'pointerenter', prop: 'onPointerEnter', captureProp: 'onPointerEnterCapture', family: 'pointer', bubbles: false, cancelable: false, coordinate: true },
  { type: 'pointerdown', prop: 'onPointerDown', captureProp: 'onPointerDownCapture', family: 'pointer', bubbles: true, cancelable: true, coordinate: true },
  { type: 'pointermove', prop: 'onPointerMove', captureProp: 'onPointerMoveCapture', family: 'pointer', bubbles: true, cancelable: true, coordinate: true },
  { type: 'pointerrawupdate', prop: 'onPointerRawUpdate', captureProp: 'onPointerRawUpdateCapture', family: 'pointer', bubbles: true, cancelable: false, coordinate: true },
  { type: 'pointerup', prop: 'onPointerUp', captureProp: 'onPointerUpCapture', family: 'pointer', bubbles: true, cancelable: true, coordinate: true },
  { type: 'pointercancel', prop: 'onPointerCancel', captureProp: 'onPointerCancelCapture', family: 'pointer', bubbles: true, cancelable: false, coordinate: true },
  { type: 'pointerout', prop: 'onPointerOut', captureProp: 'onPointerOutCapture', family: 'pointer', bubbles: true, cancelable: true, coordinate: true },
  { type: 'pointerleave', prop: 'onPointerLeave', captureProp: 'onPointerLeaveCapture', family: 'pointer', bubbles: false, cancelable: false, coordinate: true },
  { type: 'gotpointercapture', prop: 'onGotPointerCapture', captureProp: 'onGotPointerCaptureCapture', family: 'pointer', bubbles: true, cancelable: false, coordinate: true },
  { type: 'lostpointercapture', prop: 'onLostPointerCapture', captureProp: 'onLostPointerCaptureCapture', family: 'pointer', bubbles: true, cancelable: false, coordinate: true },
  { type: 'click', prop: 'onClick', captureProp: 'onClickCapture', family: 'mouse', bubbles: true, cancelable: true, coordinate: true },
  { type: 'dblclick', prop: 'onDblClick', captureProp: 'onDblClickCapture', family: 'mouse', bubbles: true, cancelable: true, coordinate: true },
  { type: 'auxclick', prop: 'onAuxClick', captureProp: 'onAuxClickCapture', family: 'mouse', bubbles: true, cancelable: true, coordinate: true },
  { type: 'contextmenu', prop: 'onContextMenu', captureProp: 'onContextMenuCapture', family: 'mouse', bubbles: true, cancelable: true, coordinate: true },
  { type: 'mouseover', prop: 'onMouseOver', captureProp: 'onMouseOverCapture', family: 'mouse', bubbles: true, cancelable: true, coordinate: true },
  { type: 'mouseenter', prop: 'onMouseEnter', captureProp: 'onMouseEnterCapture', family: 'mouse', bubbles: false, cancelable: false, coordinate: true },
  { type: 'mousedown', prop: 'onMouseDown', captureProp: 'onMouseDownCapture', family: 'mouse', bubbles: true, cancelable: true, coordinate: true },
  { type: 'mousemove', prop: 'onMouseMove', captureProp: 'onMouseMoveCapture', family: 'mouse', bubbles: true, cancelable: true, coordinate: true },
  { type: 'mouseup', prop: 'onMouseUp', captureProp: 'onMouseUpCapture', family: 'mouse', bubbles: true, cancelable: true, coordinate: true },
  { type: 'mouseout', prop: 'onMouseOut', captureProp: 'onMouseOutCapture', family: 'mouse', bubbles: true, cancelable: true, coordinate: true },
  { type: 'mouseleave', prop: 'onMouseLeave', captureProp: 'onMouseLeaveCapture', family: 'mouse', bubbles: false, cancelable: false, coordinate: true },
  { type: 'touchstart', prop: 'onTouchStart', captureProp: 'onTouchStartCapture', family: 'touch', bubbles: true, cancelable: true, coordinate: true },
  { type: 'touchmove', prop: 'onTouchMove', captureProp: 'onTouchMoveCapture', family: 'touch', bubbles: true, cancelable: true, coordinate: true },
  { type: 'touchend', prop: 'onTouchEnd', captureProp: 'onTouchEndCapture', family: 'touch', bubbles: true, cancelable: true, coordinate: true },
  { type: 'touchcancel', prop: 'onTouchCancel', captureProp: 'onTouchCancelCapture', family: 'touch', bubbles: true, cancelable: false, coordinate: true },
  { type: 'wheel', prop: 'onWheel', captureProp: 'onWheelCapture', family: 'wheel', bubbles: true, cancelable: true, coordinate: true },
  { type: 'keydown', prop: 'onKeyDown', captureProp: 'onKeyDownCapture', family: 'keyboard', bubbles: true, cancelable: true, coordinate: false },
  { type: 'keyup', prop: 'onKeyUp', captureProp: 'onKeyUpCapture', family: 'keyboard', bubbles: true, cancelable: true, coordinate: false },
  { type: 'focus', prop: 'onFocus', captureProp: 'onFocusCapture', family: 'focus', bubbles: false, cancelable: false, coordinate: false },
  { type: 'blur', prop: 'onBlur', captureProp: 'onBlurCapture', family: 'focus', bubbles: false, cancelable: false, coordinate: false },
  { type: 'focusin', prop: 'onFocusIn', captureProp: 'onFocusInCapture', family: 'focus', bubbles: true, cancelable: false, coordinate: false },
  { type: 'focusout', prop: 'onFocusOut', captureProp: 'onFocusOutCapture', family: 'focus', bubbles: true, cancelable: false, coordinate: false },
  { type: 'beforeinput', prop: 'onBeforeInput', captureProp: 'onBeforeInputCapture', family: 'input', bubbles: true, cancelable: true, coordinate: false },
  { type: 'input', prop: 'onInput', captureProp: 'onInputCapture', family: 'input', bubbles: true, cancelable: false, coordinate: false },
  { type: 'change', prop: 'onChange', captureProp: 'onChangeCapture', family: 'input', bubbles: true, cancelable: false, coordinate: false },
  { type: 'compositionstart', prop: 'onCompositionStart', captureProp: 'onCompositionStartCapture', family: 'composition', bubbles: true, cancelable: true, coordinate: false },
  { type: 'compositionupdate', prop: 'onCompositionUpdate', captureProp: 'onCompositionUpdateCapture', family: 'composition', bubbles: true, cancelable: false, coordinate: false },
  { type: 'compositionend', prop: 'onCompositionEnd', captureProp: 'onCompositionEndCapture', family: 'composition', bubbles: true, cancelable: false, coordinate: false },
  { type: 'select', prop: 'onSelect', captureProp: 'onSelectCapture', family: 'input', bubbles: true, cancelable: false, coordinate: false },
  { type: 'selectionchange', prop: 'onSelectionChange', captureProp: 'onSelectionChangeCapture', family: 'input', bubbles: false, cancelable: false, coordinate: false },
  { type: 'copy', prop: 'onCopy', captureProp: 'onCopyCapture', family: 'clipboard', bubbles: true, cancelable: true, coordinate: false },
  { type: 'cut', prop: 'onCut', captureProp: 'onCutCapture', family: 'clipboard', bubbles: true, cancelable: true, coordinate: false },
  { type: 'paste', prop: 'onPaste', captureProp: 'onPasteCapture', family: 'clipboard', bubbles: true, cancelable: true, coordinate: false },
  { type: 'dragstart', prop: 'onDragStart', captureProp: 'onDragStartCapture', family: 'drag', bubbles: true, cancelable: true, coordinate: true },
  { type: 'drag', prop: 'onDrag', captureProp: 'onDragCapture', family: 'drag', bubbles: true, cancelable: true, coordinate: true },
  { type: 'dragend', prop: 'onDragEnd', captureProp: 'onDragEndCapture', family: 'drag', bubbles: true, cancelable: false, coordinate: true },
  { type: 'dragenter', prop: 'onDragEnter', captureProp: 'onDragEnterCapture', family: 'drag', bubbles: true, cancelable: true, coordinate: true },
  { type: 'dragleave', prop: 'onDragLeave', captureProp: 'onDragLeaveCapture', family: 'drag', bubbles: true, cancelable: false, coordinate: true },
  { type: 'dragover', prop: 'onDragOver', captureProp: 'onDragOverCapture', family: 'drag', bubbles: true, cancelable: true, coordinate: true },
  { type: 'drop', prop: 'onDrop', captureProp: 'onDropCapture', family: 'drag', bubbles: true, cancelable: true, coordinate: true },
]) as readonly PibblEventDefinition[];

export const PIBBL_EVENT_TYPES = Object.freeze(
  PIBBL_EVENT_DEFINITIONS.map(definition => definition.type),
);

/**
 * Returns whether an object supplies any supported Pibbl event callback.
 *
 * @param handlers - Object that may contain Pibbl event handler properties. See
 * {@link PibblEventHandlers} .
 * @returns Whether at least one Pibbl event handler is present.
 *
 * @see {@link PibblEventHandlers}
 */
export function hasPibblEventHandler(
  handlers: Readonly<Record<PropertyKey, unknown>> | PibblEventHandlers,
): boolean {
  return PIBBL_EVENT_DEFINITIONS.some(
    definition =>
      typeof handlers[definition.prop] === 'function' ||
      typeof handlers[definition.captureProp] === 'function',
  );
}

const definitionsByType = new Map<PibblEventType, PibblEventDefinition>(
  PIBBL_EVENT_DEFINITIONS.map(definition => [definition.type, definition]),
);

export function getPibblEventDefinition(
  type: PibblEventType,
): PibblEventDefinition | undefined {
  return definitionsByType.get(type);
}
