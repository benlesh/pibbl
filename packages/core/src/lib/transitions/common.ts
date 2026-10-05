import { blur, opacity } from '../../filters/native.js';
import { defineTransitionEffect, type CRCTransitionEffect } from './fade.js';
import { captureTransition, finite, regionSnapshot, seededNoise, type CaptureFrame, type TransitionRegion } from './capture.js';

/**
 * Direction and displacement controls for a sliding visibility transition.
 *
 * @see {@link slide}
 */
export interface CRCSlideOptions {
  /**
   * Horizontal coordinate or displacement in the containing coordinate system. See
   * {@link CRCSlideOptions}.
   */
  readonly x?: number;
  /**
   * Vertical coordinate or displacement in the containing coordinate system. See
   * {@link CRCSlideOptions}.
   */
  readonly y?: number;
}
/**
 * Scale controls for a zooming visibility transition.
 *
 * @see {@link zoom}
 */
export interface CRCZoomOptions {
  /** Origin of the transform or geometric query. See {@link CRCZoomOptions}. */
  readonly origin: Readonly<{
    /**
     * Horizontal coordinate or displacement in the containing coordinate system. See
     * {@link CRCZoomOptions}.
     */
    x: number;
    /**
     * Vertical coordinate or displacement in the containing coordinate system. See
     * {@link CRCZoomOptions}.
     */
    y: number;
  }>;
  /** Starting endpoint or value. See {@link CRCZoomOptions}. */
  readonly from?: number;
}
/**
 * Direction and clipping controls for a wiping visibility transition.
 *
 * @see {@link wipe}
 */
export interface CRCWipeOptions {
  /** Logical region over which the effect is evaluated. See {@link TransitionRegion}. */
  readonly region: TransitionRegion;
  /** Direction in which this operation proceeds. See {@link CRCWipeOptions}. */
  readonly direction?: 'left' | 'right' | 'top' | 'bottom';
}
/**
 * Blur controls for a visibility reveal transition.
 *
 * @see {@link blurReveal}
 */
export interface CRCBlurRevealOptions {
  /**
   * Radius in the coordinate system of this geometry or effect. See {@link CRCBlurRevealOptions}.
   */
  readonly radius?: number;
}
/**
 * Noise and threshold controls for a dissolving visibility transition.
 *
 * @see {@link dissolve}
 */
export interface CRCDissolveOptions {
  /** Logical region over which the effect is evaluated. See {@link TransitionRegion}. */
  readonly region: TransitionRegion;
  /** Size of the dissolve noise cells. See {@link CRCDissolveOptions}. */
  readonly cellSize?: number;
  /**
   * Seed used for deterministic sampling or simulation initialization. See
   * {@link CRCDissolveOptions}.
   */
  readonly seed?: number;
}
const captured = (draw: (frame: CaptureFrame, progress: number) => void) => defineTransitionEffect(q => q === 1 ? [] : q === 0 ? [opacity({ amount: 0 })] : [captureTransition(frame => draw(frame, q))]);
/**
 * Translate from an offset while fading; exit follows the same path backward.
 *
 * @param options - Slide direction and displacement settings; defaults apply when omitted. See
 * {@link CRCSlideOptions} .
 * @returns A slide transition effect. See {@link CRCTransitionEffect}.
 *
 * @see {@link CRCSlideOptions}
 * @see {@link CRCTransitionEffect}
 */
export function slide(options: CRCSlideOptions = {}): CRCTransitionEffect {
  const x = finite(options.x ?? 0, 'x'), y = finite(options.y ?? 24, 'y');
  return captured(({ context, drawSource }, q) => { context.translate(x * (1 - q), y * (1 - q)); context.globalAlpha = q; drawSource(); });
}
/**
 * Scale around an explicit local origin while fading.
 *
 * @param options - Zoom scale and origin settings. See {@link CRCZoomOptions}.
 * @returns A zoom transition effect. See {@link CRCTransitionEffect}.
 *
 * @see {@link CRCZoomOptions}
 * @see {@link CRCTransitionEffect}
 */
export function zoom(options: CRCZoomOptions): CRCTransitionEffect {
  const x = finite(options.origin.x, 'origin.x'), y = finite(options.origin.y, 'origin.y'), from = finite(options.from ?? .8, 'from', 0);
  return captured(({ context: c, drawSource }, q) => { const scale = from + (1 - from) * q; c.translate(x, y); c.scale(scale, scale); c.translate(-x, -y); c.globalAlpha = q; drawSource(); });
}
/**
 * Reveal from one side of an explicit local region.
 *
 * @param options - Wipe direction and shape settings. See {@link CRCWipeOptions}.
 * @returns A wipe transition effect. See {@link CRCTransitionEffect}.
 *
 * @see {@link CRCWipeOptions}
 * @see {@link CRCTransitionEffect}
 */
export function wipe(options: CRCWipeOptions): CRCTransitionEffect {
  const r = regionSnapshot(options.region), direction = options.direction ?? 'left';
  if (!['left', 'right', 'top', 'bottom'].includes(direction)) throw new TypeError('Unknown wipe direction.');
  return captured(({ context: c, drawSource }, q) => {
    const vertical = direction === 'top' || direction === 'bottom';
    const width = vertical ? r.width : r.width * q, height = vertical ? r.height * q : r.height;
    c.beginPath(); c.rect(r.x + (direction === 'right' ? r.width - width : 0), r.y + (direction === 'bottom' ? r.height - height : 0), width, height); c.clip(); drawSource();
  });
}
/**
 * Resolve from a soft transparent image into crisp content using native filters.
 *
 * @param options - Blur settings; defaults apply when omitted. See {@link CRCBlurRevealOptions}.
 * @returns A blur-reveal transition effect. See {@link CRCTransitionEffect}.
 *
 * @see {@link CRCBlurRevealOptions}
 * @see {@link CRCTransitionEffect}
 */
export function blurReveal(options: CRCBlurRevealOptions = {}): CRCTransitionEffect {
  const radius = finite(options.radius ?? 16, 'radius', 0);
  return defineTransitionEffect(q => q === 1 ? [] : [blur({ radius: radius * (1 - q) }), opacity({ amount: q })]);
}
/**
 * A deterministic scattered reveal. Cell size is a minimum; the grid is capped at 128×128.
 *
 * @param options - Dissolve sampling and appearance settings. See {@link CRCDissolveOptions}.
 * @returns A dissolve transition effect. See {@link CRCTransitionEffect}.
 *
 * @see {@link CRCDissolveOptions}
 * @see {@link CRCTransitionEffect}
 */
export function dissolve(options: CRCDissolveOptions): CRCTransitionEffect {
  const r = regionSnapshot(options.region), size = finite(options.cellSize ?? 5, 'cellSize', 1), noise = seededNoise(finite(options.seed ?? 0, 'seed'));
  const columns = Math.min(128, Math.ceil(r.width / size)), rows = Math.min(128, Math.ceil(r.height / size));
  return captured(({ context: c, drawSource }, q) => {
    c.beginPath();
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) if (noise(row * columns + col) < q) c.rect(r.x + col * r.width / columns, r.y + row * r.height / rows, r.width / columns, r.height / rows);
    c.clip(); drawSource();
  });
}
