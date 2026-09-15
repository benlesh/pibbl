import { describe, expect, it } from 'vitest';
import {
  boxShape2D,
  contactBetweenShapes2D,
} from '../../../2d-geometry.js';

const identity = { position: [0, 0], rotationDegrees: 0 } as const;

describe('stable public 2D contact summaries', () => {
  it('emits two tangent-sorted points for parallel box faces', () => {
    const contact = contactBetweenShapes2D(
      boxShape2D({ width: 4, height: 4 }),
      identity,
      boxShape2D({ width: 4, height: 2 }),
      { position: [3, 0], rotationDegrees: 0 },
    );

    expect(contact).toEqual({
      normal: [-1, 0],
      points: [
        { pointOnFirst: [2, 1], pointOnSecond: [1, 1], separation: -1 },
        { pointOnFirst: [2, -1], pointOnSecond: [1, -1], separation: -1 },
      ],
    });
    expect(Object.isFrozen(contact)).toBe(true);
    expect(Object.isFrozen(contact?.points)).toBe(true);
    expect(Object.isFrozen(contact?.points[0]?.pointOnFirst)).toBe(true);
  });

  it('does not expose private leaf or feature identities', () => {
    const contact = contactBetweenShapes2D(
      boxShape2D({ width: 2, height: 2 }), identity,
      boxShape2D({ width: 2, height: 2 }), { position: [1, 0], rotationDegrees: 0 },
    );
    expect(Object.keys(contact ?? {})).toEqual(['normal', 'points']);
    expect(Object.keys(contact?.points[0] ?? {})).toEqual([
      'pointOnFirst', 'pointOnSecond', 'separation',
    ]);
  });
});
