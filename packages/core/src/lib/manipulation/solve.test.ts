import { describe, expect, it } from 'vitest';
import { solveManipulation } from './solve';

describe('solveManipulation', () => {
  const box = { left: 32, top: 16, width: 100, height: 80 };

  it('snaps a move from its initial box only while Shift is held', () => {
    expect(solveManipulation({
      operation: 'move',
      initial: box,
      initialPoint: { x: 10, y: 10 },
      currentPoint: { x: 33, y: 10 },
      modifiers: { shift: true },
      move: { snap: { step: 16, when: 'shift' } },
    })).toMatchObject({
      proposed: { left: 55, top: 16, width: 100, height: 80 },
      applied: { left: 48, top: 16, width: 100, height: 80 },
      snapActive: true,
      snapSatisfied: true,
    });

    expect(solveManipulation({
      operation: 'move',
      initial: box,
      initialPoint: { x: 10, y: 10 },
      currentPoint: { x: 33, y: 10 },
      modifiers: {},
      move: { snap: { step: 16, when: 'shift' } },
    }).applied.left).toBe(55);
  });

  it('rounds negative halfway lattice points toward the larger index and honors origins', () => {
    expect(solveManipulation({
      operation: 'move',
      initial: { left: -24, top: 0, width: 20, height: 20 },
      initialPoint: { x: 0, y: 0 },
      currentPoint: { x: 4, y: 0 },
      modifiers: {},
      move: { snap: { step: 16, origin: { x: 4, y: 0 } } },
    }).applied.left).toBe(-12);
  });

  it('snaps a bottom-right resize while preserving the top-left anchor', () => {
    expect(solveManipulation({
      operation: 'resize',
      handle: 'bottom-right',
      initial: box,
      initialPoint: { x: 0, y: 0 },
      currentPoint: { x: 23, y: 11 },
      modifiers: {},
      resize: { snap: { target: 'size', step: 8 } },
    })).toMatchObject({
      applied: { left: 32, top: 16, width: 120, height: 88 },
      snapActive: true,
      snapSatisfied: true,
    });
  });

  it('preserves the opposite corner and gives minimum dimensions precedence over snapping', () => {
    expect(solveManipulation({
      operation: 'resize',
      handle: 'top-left',
      initial: box,
      initialPoint: { x: 0, y: 0 },
      currentPoint: { x: 91, y: 71 },
      modifiers: {},
      resize: { minWidth: 32, minHeight: 24, snap: { target: 'size', step: 16 } },
    }).applied).toEqual({ left: 100, top: 72, width: 32, height: 24 });
  });
});
