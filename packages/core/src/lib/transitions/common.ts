import { blur, opacity } from '../../filters/native.js';
import { defineTransitionEffect, type CRCTransitionEffect } from './fade.js';
import { captureTransition, finite, regionSnapshot, seededNoise, type CaptureFrame, type TransitionRegion } from './capture.js';

export interface CRCSlideOptions { readonly x?: number; readonly y?: number }
export interface CRCZoomOptions { readonly origin: Readonly<{ x: number; y: number }>; readonly from?: number }
export interface CRCWipeOptions { readonly region: TransitionRegion; readonly direction?: 'left' | 'right' | 'top' | 'bottom' }
export interface CRCBlurRevealOptions { readonly radius?: number }
export interface CRCDissolveOptions { readonly region: TransitionRegion; readonly cellSize?: number; readonly seed?: number }
const captured = (draw: (frame: CaptureFrame, progress: number) => void) => defineTransitionEffect(q => q === 1 ? [] : q === 0 ? [opacity({ amount: 0 })] : [captureTransition(frame => draw(frame, q))]);
/** Translate from an offset while fading; exit follows the same path backward. */
export function slide(options: CRCSlideOptions = {}): CRCTransitionEffect {
  const x = finite(options.x ?? 0, 'x'), y = finite(options.y ?? 24, 'y');
  return captured(({ context, drawSource }, q) => { context.translate(x * (1 - q), y * (1 - q)); context.globalAlpha = q; drawSource(); });
}
/** Scale around an explicit local origin while fading. */
export function zoom(options: CRCZoomOptions): CRCTransitionEffect {
  const x = finite(options.origin.x, 'origin.x'), y = finite(options.origin.y, 'origin.y'), from = finite(options.from ?? .8, 'from', 0);
  return captured(({ context: c, drawSource }, q) => { const scale = from + (1 - from) * q; c.translate(x, y); c.scale(scale, scale); c.translate(-x, -y); c.globalAlpha = q; drawSource(); });
}
/** Reveal from one side of an explicit local region. */
export function wipe(options: CRCWipeOptions): CRCTransitionEffect {
  const r = regionSnapshot(options.region), direction = options.direction ?? 'left';
  if (!['left', 'right', 'top', 'bottom'].includes(direction)) throw new TypeError('Unknown wipe direction.');
  return captured(({ context: c, drawSource }, q) => {
    const vertical = direction === 'top' || direction === 'bottom';
    const width = vertical ? r.width : r.width * q, height = vertical ? r.height * q : r.height;
    c.beginPath(); c.rect(r.x + (direction === 'right' ? r.width - width : 0), r.y + (direction === 'bottom' ? r.height - height : 0), width, height); c.clip(); drawSource();
  });
}
/** Resolve from a soft transparent image into crisp content using native filters. */
export function blurReveal(options: CRCBlurRevealOptions = {}): CRCTransitionEffect {
  const radius = finite(options.radius ?? 16, 'radius', 0);
  return defineTransitionEffect(q => q === 1 ? [] : [blur({ radius: radius * (1 - q) }), opacity({ amount: q })]);
}
/** A deterministic scattered reveal. Cell size is a minimum; the grid is capped at 128×128. */
export function dissolve(options: CRCDissolveOptions): CRCTransitionEffect {
  const r = regionSnapshot(options.region), size = finite(options.cellSize ?? 5, 'cellSize', 1), noise = seededNoise(finite(options.seed ?? 0, 'seed'));
  const columns = Math.min(128, Math.ceil(r.width / size)), rows = Math.min(128, Math.ceil(r.height / size));
  return captured(({ context: c, drawSource }, q) => {
    c.beginPath();
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) if (noise(row * columns + col) < q) c.rect(r.x + col * r.width / columns, r.y + row * r.height / rows, r.width / columns, r.height / rows);
    c.clip(); drawSource();
  });
}
