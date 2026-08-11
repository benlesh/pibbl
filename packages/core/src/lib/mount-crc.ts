import {
  cleanupCRCInstance,
  getCRCInstance,
  GLOBAL_STATE,
} from './global-state.js';
import { dispatchCRCEvent } from './interaction-dispatch.js';
import { Teardowns } from './teardowns.js';
import {
  Canvas,
  CompEl,
  CRCController,
  CRCInstance,
} from './types.js';
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
    regions: new Set(),
    cursorDefaults: new Set(),
    interaction: {
      hoveredRegion: undefined,
      primaryDownRegion: undefined,
      primaryUpRegion: undefined,
      clickStreakRegion: undefined,
      clickStreak: 0,
      cursorRegion: undefined,
      cursorDefault: undefined,
      cursorCanvas: undefined,
      cursorStyle: undefined,
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

      for (const [type] of typedEntries(crcInstance.events)) {
        const bridgeHandler = (event: MouseEvent) => {
          dispatchCRCEvent(
            crcInstance,
            type,
            event,
            event.target as HTMLCanvasElement,
          );
        };

        parentCRCInstance.events[type].add(bridgeHandler);

        mainTeardowns.add(() => {
          parentCRCInstance.events[type].delete(bridgeHandler);
        });
      }
    } else {
      const rootCanvas = canvas as HTMLCanvasElement;
      for (const [type] of typedEntries(crcInstance.events)) {
        const nativeHandler = (event: MouseEvent) => {
          dispatchCRCEvent(crcInstance, type, event, rootCanvas);
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
