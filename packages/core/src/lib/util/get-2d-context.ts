import { Canvas, RenderingContext2D } from '../types.js';

export function get2dContext(canvas: Canvas): RenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to get 2d context!');
  }
  return ctx as any;
}
