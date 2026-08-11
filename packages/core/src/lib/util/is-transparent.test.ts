import { describe, expect, it } from 'vitest';
import { isTransparent } from './is-transparent';

describe('isTransparent', () => {
  it('should return true for "transparent" string', () => {
    expect(isTransparent('transparent')).toBe(true);
  });

  it('should return true for rgba with 0 opacity', () => {
    expect(isTransparent('rgba(255, 0, 0, 0)')).toBe(true);
    expect(isTransparent('rgba(0, 255, 0, 0)')).toBe(true);
    expect(isTransparent('rgba(0, 0, 255, 0)')).toBe(true);
    expect(isTransparent('rgba(0,0,0,0)')).toBe(true);
  });

  it('should return true for hsla with 0 opacity', () => {
    expect(isTransparent('hsla(0, 100%, 50%, 0)')).toBe(true);
    expect(isTransparent('hsla(120, 100%, 50%, 0)')).toBe(true);
    expect(isTransparent('hsla(240, 100%, 50%, 0)')).toBe(true);
    expect(isTransparent('hsla(0,0%,0%,0)')).toBe(true);
  });

  it('should return false for non-transparent colors', () => {
    expect(isTransparent('red')).toBe(false);
    expect(isTransparent('rgba(255, 0, 0, 1)')).toBe(false);
    expect(isTransparent('rgba(255, 0, 0, 0.5)')).toBe(false);
    expect(isTransparent('hsla(0, 100%, 50%, 1)')).toBe(false);
    expect(isTransparent('hsla(0, 100%, 50%, 0.5)')).toBe(false);
  });

  it('should return false for CanvasGradient and CanvasPattern', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createLinearGradient(0, 0, 100, 100);
    expect(isTransparent(gradient)).toBe(false);

    const pattern = ctx.createPattern(canvas, 'repeat')!;
    expect(isTransparent(pattern)).toBe(false);
  });
});
