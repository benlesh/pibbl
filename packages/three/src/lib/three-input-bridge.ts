import type { PibblRenderLayerContext, PibblRenderLayerInput } from "@pibbl/core";
import type { Object3D } from "three";
import type { PibblThreeInputBridge } from "./types.js";

interface ListenerRecord {
  readonly type: string;
  readonly listener: EventListenerOrEventListenerObject;
  readonly options: boolean | AddEventListenerOptions | undefined;
}

class CompatibilityEventTarget extends EventTarget {
  private readonly records: ListenerRecord[] = [];

  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (!listener) return;
    super.addEventListener(type, listener, options);
    const capture = captureOf(options);
    if (
      !this.records.some(
        (record) =>
          record.type === type &&
          record.listener === listener &&
          captureOf(record.options) === capture,
      )
    ) {
      this.records.push({ type, listener, options });
    }
  }

  override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void {
    if (!listener) return;
    super.removeEventListener(type, listener, options);
    const capture = captureOf(options);
    const index = this.records.findIndex(
      (record) =>
        record.type === type &&
        record.listener === listener &&
        captureOf(record.options) === capture,
    );
    if (index >= 0) this.records.splice(index, 1);
  }

  clearListeners(): void {
    for (const record of this.records.splice(0)) {
      super.removeEventListener(record.type, record.listener, record.options);
    }
  }
}

class CompatibilityDocumentTarget extends CompatibilityEventTarget {}

class CompatibilityElementTarget extends CompatibilityEventTarget {
  readonly style = { touchAction: "", cursor: "auto" };

  constructor(
    readonly ownerDocument: CompatibilityDocumentTarget,
    private readonly bridge: ThreeInputBridgeController,
    private readonly context: Readonly<PibblRenderLayerContext>,
  ) {
    super();
  }

  get clientWidth(): number {
    return this.context.size.width;
  }

  get clientHeight(): number {
    return this.context.size.height;
  }

  getBoundingClientRect(): DOMRect {
    return new DOMRect(0, 0, this.clientWidth, this.clientHeight);
  }

  getRootNode(): Node {
    return this.ownerDocument as unknown as Node;
  }

  setPointerCapture(pointerId: number): void {
    this.bridge.setPointerCapture(pointerId);
  }

  releasePointerCapture(pointerId: number): void {
    this.bridge.releasePointerCapture(pointerId);
  }

  hasPointerCapture(pointerId: number): boolean {
    return this.bridge.hasPointerCapture(pointerId);
  }
}

export interface ThreeInputBridgeController extends PibblThreeInputBridge {
  readonly connected: boolean;
  finishCreate(): void;
  deliver(input: Readonly<PibblRenderLayerInput<Object3D>>): void;
  dispose(): void;
  setPointerCapture(pointerId: number): void;
  releasePointerCapture(pointerId: number): void;
  hasPointerCapture(pointerId: number): boolean;
}

export function createThreeInputBridge(
  context: Readonly<PibblRenderLayerContext>,
): ThreeInputBridgeController {
  const documentTarget = new CompatibilityDocumentTarget();
  let creating = true;
  let disposed = false;
  let connected = false;
  let currentInput: Readonly<PibblRenderLayerInput<Object3D>> | undefined;
  const captures = new Map<number, () => void>();
  let element: CompatibilityElementTarget;

  const bridge: ThreeInputBridgeController = {
    get connected() {
      return connected;
    },
    connect(create) {
      if (!creating || disposed) {
        throw new Error(
          "Pibbl Three input controls may only connect during create().",
        );
      }
      connected = true;
      return create(element as unknown as HTMLElement);
    },
    finishCreate() {
      creating = false;
    },
    deliver(input) {
      if (disposed || !connected) return;
      const event = createCompatibilityEvent(input);
      const pointerId =
        event instanceof PointerEvent ? event.pointerId : undefined;
      const target =
        pointerId !== undefined &&
        captures.has(pointerId) &&
        (input.type === "pointermove" || input.type === "pointerup")
          ? documentTarget
          : element;
      currentInput = input;
      try {
        target.dispatchEvent(event);
        if (event.defaultPrevented && input.originalEvent.cancelable) {
          input.originalEvent.preventDefault();
        }
        if (event.cancelBubble) input.originalEvent.stopPropagation();
      } finally {
        currentInput = undefined;
        if (
          pointerId !== undefined &&
          (input.type === "pointerup" || input.type === "pointercancel")
        ) {
          release(pointerId);
        }
        if (
          input.type === "pointermove" ||
          input.type === "wheel" ||
          input.type === "contextmenu" ||
          input.type === "click"
        ) {
          context.invalidate();
        }
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      creating = false;
      for (const pointerId of Array.from(captures.keys())) release(pointerId);
      documentTarget.clearListeners();
      element.clearListeners();
    },
    setPointerCapture(pointerId) {
      if (!currentInput) {
        throw new Error(
          "Pibbl Three pointer capture is only available while handling input.",
        );
      }
      currentInput.setPointerCapture(pointerId);
      const releasePointerCapture = currentInput.releasePointerCapture;
      captures.set(pointerId, () => releasePointerCapture(pointerId));
    },
    releasePointerCapture(pointerId) {
      release(pointerId);
    },
    hasPointerCapture(pointerId) {
      return captures.has(pointerId);
    },
  };

  element = new CompatibilityElementTarget(documentTarget, bridge, context);
  return bridge;

  function release(pointerId: number): void {
    const releaseCapture = captures.get(pointerId);
    if (!releaseCapture) return;
    captures.delete(pointerId);
    releaseCapture();
  }
}

function createCompatibilityEvent(
  input: Readonly<PibblRenderLayerInput<Object3D>>,
): Event {
  const original = input.originalEvent;
  const common = {
    bubbles: false,
    cancelable: original.cancelable,
    clientX: input.point.x,
    clientY: input.point.y,
    screenX: original instanceof MouseEvent ? original.screenX : 0,
    screenY: original instanceof MouseEvent ? original.screenY : 0,
    altKey: original instanceof MouseEvent && original.altKey,
    ctrlKey: original instanceof MouseEvent && original.ctrlKey,
    metaKey: original instanceof MouseEvent && original.metaKey,
    shiftKey: original instanceof MouseEvent && original.shiftKey,
    button: original instanceof MouseEvent ? original.button : 0,
    buttons: original instanceof MouseEvent ? original.buttons : 0,
  };
  if (input.type.startsWith("pointer")) {
    const pointer = original as PointerEvent;
    return new PointerEvent(input.type, {
      ...common,
      pointerId: pointer.pointerId,
      width: pointer.width,
      height: pointer.height,
      pressure: pointer.pressure,
      tangentialPressure: pointer.tangentialPressure,
      tiltX: pointer.tiltX,
      tiltY: pointer.tiltY,
      twist: pointer.twist,
      pointerType: pointer.pointerType,
      isPrimary: pointer.isPrimary,
    });
  }
  if (input.type === "wheel") {
    const wheel = original as WheelEvent;
    return new WheelEvent(input.type, {
      ...common,
      deltaX: wheel.deltaX,
      deltaY: wheel.deltaY,
      deltaZ: wheel.deltaZ,
      deltaMode: wheel.deltaMode,
    });
  }
  return new MouseEvent(input.type, common);
}

function captureOf(
  options: boolean | AddEventListenerOptions | EventListenerOptions | undefined,
): boolean {
  return typeof options === "boolean" ? options : (options?.capture ?? false);
}
