import { describe, expect, it } from 'vitest';
import { get2dContext } from './get-2d-context';

describe('get2dContext', () => {
  it('should return 2d context when available', () => {
    const mockCtx = {};
    const mockCanvas = {
      getContext: () => mockCtx,
    };

    const ctx = get2dContext(mockCanvas as any);
    expect(ctx).toBe(mockCtx);
  });

  it('should throw error when 2d context is not available', () => {
    const mockCanvas = {
      getContext: () => null,
    };

    expect(() => get2dContext(mockCanvas as any)).toThrow('Unable to get 2d context!');
  });
});
