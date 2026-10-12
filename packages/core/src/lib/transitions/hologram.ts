import { lazyTransitionKernel } from './wasm/kernel.js';
import { bytes } from './wasm/hologram-bytes.js';
const createKernel = lazyTransitionKernel(bytes);
import { opacity } from '../../filters/native.js';
import { defineTransitionEffect, type PibblTransitionEffect } from './fade.js';
import { captureTransition, clamp, finite, regionSnapshot, type TransitionRegion } from './capture.js';

/**
 * Color, scanning, and distortion controls for a hologram visibility transition.
 *
 * @see {@link hologram}
 */
export interface PibblHologramOptions {
  /** Logical region over which the effect is evaluated. See {@link TransitionRegion}. */
  readonly region: TransitionRegion;
  /** Entry location or direction used by the transition. See {@link PibblHologramOptions}. */
  readonly entry?: Readonly<{
    /**
     * Horizontal coordinate or displacement in the containing coordinate system. See
     * {@link PibblHologramOptions}.
     */
    x: number;
    /**
     * Vertical coordinate or displacement in the containing coordinate system. See
     * {@link PibblHologramOptions}.
     */
    y: number;
  }>;
  /** Hue control for the transition's emitted color. See {@link PibblHologramOptions}. */
  readonly hue?: number;
  /** Brightness control for the transition effect. See {@link PibblHologramOptions}. */
  readonly brightness?: number;
  /** Fog intensity used by the hologram effect. See {@link PibblHologramOptions}. */
  readonly fog?: number;
  /** Distortion intensity used by the hologram effect. See {@link PibblHologramOptions}. */
  readonly glitch?: number;
  /**
   * Seed used for deterministic sampling or simulation initialization. See
   * {@link PibblHologramOptions}.
   */
  readonly seed?: number;
}
/**
 * A diffuse scan reconstructs the captured subject while interference settles.
 *
 * @param options - Hologram appearance and animation settings. See {@link PibblHologramOptions}.
 * @returns A hologram transition effect. See {@link PibblTransitionEffect}.
 *
 * @see {@link PibblHologramOptions}
 * @see {@link PibblTransitionEffect}
 */
export function hologram(options: PibblHologramOptions): PibblTransitionEffect {
  const r = regionSnapshot(options.region);
  const entry = { x: finite(options.entry?.x ?? r.x + r.width / 2, 'entry.x'), y: finite(options.entry?.y ?? r.y + r.height, 'entry.y') };
  const hue = finite(options.hue ?? 183, 'hue'), brightness = finite(options.brightness ?? 1, 'brightness', 0);
  const fog = finite(options.fog ?? 1, 'fog', 0), glitch = finite(options.glitch ?? 1, 'glitch', 0);
  const kernel = createKernel(finite(options.seed ?? 0, 'seed'));
  return defineTransitionEffect(q => {
    if (q === 1) return [];
    if (q === 0) return [opacity({ amount: 0 })];
    return [captureTransition(({ context: c, windows, drawSource, drawTint }) => {
      const { exports, values } = kernel();
      exports.sample!(q, brightness, fog, glitch, r.x, r.y, r.width, r.height, entry.x, entry.y);
      const y = values[0]!, power = values[1]!;
      const color = (a: number, light = 75) => `hsla(${hue},100%,${light}%,${clamp(a)})`;
      const glow = (x: number, cy: number, rx: number, ry: number, a: number) => {
        c.save(); c.translate(x, cy); c.scale(rx, ry);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, color(a, 92)); g.addColorStop(.3, color(a * .5)); g.addColorStop(1, color(0));
        c.fillStyle = g; c.fillRect(-1, -1, 2, 2); c.restore();
      };
      c.save(); c.beginPath(); c.rect(r.x, y, r.width, r.height * q); c.clip();
      drawSource(); c.globalAlpha = clamp((1 - q) * 1.8); drawTint(color(1)); c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = color(power * .18);
      const lineCount = Math.min(512, Math.ceil(r.height / 5));
      for (let i = 0; i < lineCount; i++) c.fillRect(r.x, r.y + i * r.height / lineCount, r.width, 1);
      c.restore();
      // Transient strips copy only captured pixels, preserving gaps in the subject.
      c.save(); c.beginPath(); c.rect(r.x, y, r.width, r.height * q); c.clip();
      for (let i = 0; i < 9; i++) {
        const offset = 2 + i * 4, pulse = values[offset]!;
        if (pulse < .03) continue;
        c.save(); c.beginPath(); c.rect(r.x, values[offset + 1]!, r.width, values[offset + 2]!); c.clip();
        c.translate(values[offset + 3]!, 0); c.globalAlpha = clamp(pulse); drawTint(color(1, 92)); c.restore();
      }
      c.restore(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 25; i++) {
        c.strokeStyle = color(values[38 + i]!); c.lineWidth = 1;
        c.beginPath(); c.moveTo(entry.x, entry.y); c.lineTo(r.x + i / 24 * r.width, y); c.stroke();
      }
      for (let i = 0; i < 24; i++) {
        const offset = 63 + i * 5;
        glow(values[offset]!, values[offset + 1]!, values[offset + 2]!, values[offset + 3]!, values[offset + 4]!);
      }
      glow(r.x + r.width / 2, y, r.width * .6, 28, power * .5);
      c.save(); c.filter = `blur(${9 * windows.density}px)`; c.strokeStyle = color(power * .65, 87); c.lineWidth = 7;
      c.beginPath(); c.ellipse(r.x + r.width / 2, y, r.width * .5, 10, 0, 0, Math.PI * 2); c.stroke();
      c.filter = `blur(${3 * windows.density}px)`; c.lineWidth = 3; c.stroke(); c.restore();
    })];
  });
}
