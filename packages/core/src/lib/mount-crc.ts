import {
  cleanupCRCInstance,
  getCRCInstance,
  GLOBAL_STATE,
} from './global-state.js';
import { Teardowns } from './teardowns.js';
import {
  Canvas,
  CompEl,
  CRCController,
  CRCInstance,
} from './types.js';
import { createMouseEventTransform } from './util/create-mouse-event-transform.js';
import { typedEntries } from './util/typed-entries.js';

export function mountCRC<P>(
  canvas: Canvas,
  element: CompEl<P>,
  config?: { signal?: AbortSignal; parent?: Canvas },
): CRCController {
  const mainTeardowns = new Teardowns();
  const signal = config?.signal;
  let ownedInstance: CRCInstance | undefined;
  const controller: CRCController = {
    dispose(): void {
      const instance = ownedInstance;
      if (!instance) {
        return;
      }
      ownedInstance = undefined;
      cleanupCRCInstance(instance);
    },
  };
  const parent = config?.parent;

  const crcInstance: CRCInstance = {
    canvas,
    controller,
    root: element,
    refs: new Map(),
    animationFrameId: undefined,
    renderTimestamp: 0,
    mainTeardowns,
    events: {
      click: new Set(),
      dblclick: new Set(),
      mousemove: new Set(),
      mouseover: new Set(),
      mouseout: new Set(),
      mousedown: new Set(),
      mouseup: new Set(),
      contextmenu: new Set(),
    },
    parent,
  };
  ownedInstance = crcInstance;
  GLOBAL_STATE.crcInstances.set(canvas, crcInstance);

  try {
    if (signal) {
      const abortHandler = () => controller.dispose();
      signal.addEventListener('abort', abortHandler, { once: true });
      mainTeardowns.add(() => {
        signal.removeEventListener('abort', abortHandler);
      });
    }

    if (parent) {
      const parentCRCInstance = getCRCInstance(parent);

      for (const [type, handlers] of typedEntries(crcInstance.events)) {
        const bridgeHandler = (event: MouseEvent) => {
          dispatchHandlers({
            canvas: event.target as HTMLCanvasElement,
            event,
            handlers,
          });
        };

        parentCRCInstance.events[type].add(bridgeHandler);

        mainTeardowns.add(() => {
          parentCRCInstance.events[type].delete(bridgeHandler);
        });
      }
    } else {
      const rootCanvas = canvas as HTMLCanvasElement;
      for (const [type, handlers] of typedEntries(crcInstance.events)) {
        const nativeHandler = (event: MouseEvent) => {
          dispatchHandlers({ canvas: rootCanvas, event, handlers });
        };

        rootCanvas.addEventListener(type, nativeHandler);
        mainTeardowns.add(() => {
          rootCanvas.removeEventListener(type, nativeHandler);
        });
      }
    }

    if (signal?.aborted) {
      controller.dispose();
    }
  } catch (error) {
    controller.dispose();
    throw error;
  }

  return controller;
}

function dispatchHandlers({
  canvas,
  event,
  handlers,
}: {
  canvas: HTMLCanvasElement;
  event: MouseEvent;
  handlers: Set<(event: MouseEvent) => void>;
}): void {
  const previousMouseTransform = GLOBAL_STATE.mouseTransform;
  try {
    GLOBAL_STATE.mouseTransform = createMouseEventTransform(canvas);
    const snapshot = Array.from(handlers);
    for (const handler of snapshot) {
      if (!handlers.has(handler)) {
        continue;
      }
      try {
        handler(event);
      } catch (error) {
        reportError(error);
      }
    }
  } finally {
    GLOBAL_STATE.mouseTransform = previousMouseTransform;
  }
}
