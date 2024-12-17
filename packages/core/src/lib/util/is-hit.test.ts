import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GLOBAL_STATE } from '../global-state';
import { isHit } from './is-hit';

describe('isHit', () => {
  const mockPath = new Path2D();
  const mockTransform = new DOMMatrix();

  const createMockContext = (config: {
    isPointInPath?: boolean;
    isPointInStroke?: boolean;
  }) => ({
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    isPointInPath: vi.fn().mockReturnValue(config.isPointInPath ?? false),
    isPointInStroke: vi.fn().mockReturnValue(config.isPointInStroke ?? false),
    lineWidth: 0,
  });

  const createMockCanvas = (ctx: any) => ({
    getContext: () => ctx,
  });

  beforeEach(() => {
    // @ts-expect-error I think "null" is the correct type, but it's not assignable to DOMMatrix
    GLOBAL_STATE.mouseTransform = null;
    GLOBAL_STATE.clippingStack = [];
  });

  it('should detect hit when point is inside filled path', () => {
    const ctx = createMockContext({ isPointInPath: true });
    const canvas = createMockCanvas(ctx);

    const result = isHit({
      canvas: canvas as any,
      transform: mockTransform,
      path: mockPath,
      x: 10,
      y: 10,
      fill: true,
      lineInteractionWidth: 0,
      currentClippingStack: [],
    });

    expect(result).toBe(true);
    expect(ctx.isPointInPath).toHaveBeenCalledWith(mockPath, 10, 10);
  });

  it('should detect hit when point is on stroke', () => {
    const ctx = createMockContext({ isPointInStroke: true });
    const canvas = createMockCanvas(ctx);

    const result = isHit({
      canvas: canvas as any,
      transform: mockTransform,
      path: mockPath,
      x: 10,
      y: 10,
      fill: false,
      lineInteractionWidth: 2,
      currentClippingStack: [],
    });

    expect(result).toBe(true);
    expect(ctx.isPointInStroke).toHaveBeenCalledWith(mockPath, 10, 10);
    expect(ctx.lineWidth).toBe(2);
  });

  it('should handle mouse transform', () => {
    const ctx = createMockContext({ isPointInPath: true });
    const canvas = createMockCanvas(ctx);

    GLOBAL_STATE.mouseTransform = {
      transformPoint: vi.fn().mockReturnValue({ x: 20, y: 20 }),
    } as any;

    const result = isHit({
      canvas: canvas as any,
      transform: mockTransform,
      path: mockPath,
      x: 10,
      y: 10,
      fill: true,
      lineInteractionWidth: 0,
      currentClippingStack: [],
    });

    expect(result).toBe(true);
    expect(ctx.isPointInPath).toHaveBeenCalledWith(mockPath, 20, 20);
  });

  it('should handle clipping paths', () => {
    const ctx = createMockContext({ isPointInPath: true });
    const canvas = createMockCanvas(ctx);

    const clippingStack = [{
      path: new Path2D(),
      fillRule: 'nonzero' as const,
      transform: new DOMMatrix(),
    }];

    const result = isHit({
      canvas: canvas as any,
      transform: mockTransform,
      path: mockPath,
      x: 10,
      y: 10,
      fill: true,
      lineInteractionWidth: 0,
      currentClippingStack: clippingStack,
    });

    expect(result).toBe(true);
    expect(ctx.isPointInPath).toHaveBeenCalledWith(
      clippingStack[0].path,
      10,
      10,
      'nonzero',
    );
  });

  it('should return false when point is not in any clipping path', () => {
    const ctx = createMockContext({ isPointInPath: false });
    const canvas = createMockCanvas(ctx);

    const clippingStack = [{
      path: new Path2D(),
      fillRule: 'nonzero' as const,
      transform: new DOMMatrix(),
    }];

    const result = isHit({
      canvas: canvas as any,
      transform: mockTransform,
      path: mockPath,
      x: 10,
      y: 10,
      fill: true,
      lineInteractionWidth: 0,
      currentClippingStack: clippingStack,
    });

    expect(result).toBe(false);
  });
});
