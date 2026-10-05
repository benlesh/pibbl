import { describe, expect, it } from 'vitest';
import type { PibblEventHandlers } from './types.js';
import { normalizeHandlers } from './registrations.js';

describe('event registration hot path', () => {
  it('reads only supplied handler props while normalizing callbacks', () => {
    const onMouseMove = () => undefined;
    const reads: PropertyKey[] = [];
    const handlers = new Proxy<PibblEventHandlers>({ onMouseMove }, {
      get(target, property, receiver) {
        reads.push(property);
        return Reflect.get(target, property, receiver);
      },
    });

    const normalized = normalizeHandlers(handlers);

    expect(normalized).toEqual({ mousemove: onMouseMove });
    expect(reads).toEqual(['onMouseMove']);
  });
});
