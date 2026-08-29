import { getCRCEventDefinition } from './event-definitions.js';
import type { CRCEventDefinition } from './event-definitions.js';
import type { CRCEventType } from './types.js';
import type { Teardowns } from '../teardowns.js';

interface NativeListenerRecord {
  count: number;
  listener: EventListener;
  options: AddEventListenerOptions | boolean;
}

export interface NativeListenerHub {
  acquire(type: CRCEventType): () => void;
  count(type: CRCEventType): number;
  dispose(): void;
}

export type NativeEventDispatch = (
  definition: CRCEventDefinition,
  event: Event,
) => void;

export function createNativeListenerHub(
  canvas: HTMLCanvasElement,
  dispatch: NativeEventDispatch,
  teardowns: Teardowns,
): NativeListenerHub {
  const records = new Map<CRCEventType, NativeListenerRecord>();
  let disposed = false;

  const hub: NativeListenerHub = {
    acquire(type) {
      if (disposed) {
        return () => undefined;
      }

      let record = records.get(type);
      if (!record) {
        const definition = getCRCEventDefinition(type);
        if (!definition) {
          throw new Error(`Unknown CRC event type: ${type}`);
        }
        const listener: EventListener = event => dispatch(definition, event);
        const options = listenerOptions(definition);
        record = { count: 0, listener, options };
        canvas.addEventListener(type, listener, options);
        records.set(type, record);
      }
      record.count++;

      let released = false;
      return () => {
        if (released) return;
        released = true;
        if (disposed) return;

        const current = records.get(type);
        if (current !== record) return;
        current.count--;
        if (current.count === 0) {
          records.delete(type);
          canvas.removeEventListener(
            type,
            current.listener,
            captureFrom(current.options),
          );
        }
      };
    },

    count(type) {
      return records.get(type)?.count ?? 0;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      for (const [type, record] of records) {
        canvas.removeEventListener(
          type,
          record.listener,
          captureFrom(record.options),
        );
      }
      records.clear();
    },
  };

  teardowns.add(hub.dispose);
  return hub;
}

function listenerOptions(
  definition: CRCEventDefinition,
): AddEventListenerOptions | boolean {
  if (
    definition.cancelable &&
    (definition.family === 'touch' || definition.family === 'wheel')
  ) {
    return { passive: false };
  }
  return false;
}

function captureFrom(options: AddEventListenerOptions | boolean): boolean {
  return typeof options === 'boolean' ? options : options.capture ?? false;
}
