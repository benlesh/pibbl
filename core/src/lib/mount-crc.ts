import { GLOBAL_STATE, getCRCInstance } from './global-state';
import { Teardowns } from './teardowns';
import { Canvas, CompEl, CRCInstance } from './types';
import { createMouseEventTransform } from './util/create-mouse-event-transform';
import { typedEntries } from './util/typed-entries';

export function mountCRC<P>(
  canvas: Canvas,
  element: CompEl<P>,
  config?: { signal?: AbortSignal; parent?: Canvas }
) {
  const mainTeardowns = new Teardowns();

  const signal = config?.signal;

  const cleanup = () => {
    GLOBAL_STATE.crcInstances.delete(canvas);
    mainTeardowns.execute();
  };

  if (signal) {
    signal.addEventListener('abort', cleanup, {
      once: true,
    });
    mainTeardowns.add(() => {
      signal.removeEventListener('abort', cleanup);
    });
  }

  const parent = config?.parent;

  const crcInstance: CRCInstance = {
    root: element,
    refs: new Map(),
    animationFrameId: 0,
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

  if (parent) {
    const parentCRCInstance = getCRCInstance(parent);

    for (const [type, handlers] of typedEntries(crcInstance.events)) {
      const handler = (e: MouseEvent) => {
        GLOBAL_STATE.mouseTransform = createMouseEventTransform(
          e.target as HTMLCanvasElement
        );
        for (const handler of handlers) {
          try {
            handler(e);
          } catch (err) {
            reportError(err);
          }
        }
        GLOBAL_STATE.mouseTransform = undefined;
      };

      parentCRCInstance.events[type].add(handler);

      mainTeardowns.add(() => {
        parentCRCInstance.events[type].delete(handler);
      });
    }
  } else {
    // Only the parent canvas wires up events.
    for (const [type, handlers] of Object.entries(crcInstance.events)) {
      canvas.addEventListener(
        type,
        (e) => {
          GLOBAL_STATE.mouseTransform = createMouseEventTransform(
            canvas as HTMLCanvasElement
          );
          for (const handler of handlers) {
            try {
              handler(e);
            } catch (err) {
              reportError(err);
            }
          }
          GLOBAL_STATE.mouseTransform = undefined;
        },
        { signal }
      );
    }
  }

  GLOBAL_STATE.crcInstances.set(canvas, crcInstance);
}
