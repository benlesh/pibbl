import { bifrostKernel } from './wasm/bifrost-kernel.js';
import { opacity } from '../../filters/native.js';
import { defineTransitionEffect, type PibblTransitionEffect } from './fade.js';
import { captureTransition, clamp, finite, regionSnapshot, type TransitionRegion } from './capture.js';

/**
 * Color and motion controls for a bifrost visibility transition.
 *
 * @see {@link bifrost}
 */
export interface PibblBifrostOptions {
  /** Logical region over which the effect is evaluated. See {@link TransitionRegion}. */
  readonly region: TransitionRegion;
  /** Entry location or direction used by the transition. See {@link PibblBifrostOptions}. */
  readonly entry?: Readonly<{
    /**
     * Horizontal coordinate or displacement in the containing coordinate system. See
     * {@link PibblBifrostOptions}.
     */
    x: number;
    /**
     * Vertical coordinate or displacement in the containing coordinate system. See
     * {@link PibblBifrostOptions}.
     */
    y: number;
  }>;
  /** Brightness control for the transition effect. See {@link PibblBifrostOptions}. */
  readonly brightness?: number;
  /** Hue control for the transition's emitted color. See {@link PibblBifrostOptions}. */
  readonly hue?: number;
  /** Amount of stretching applied by the transition. See {@link PibblBifrostOptions}. */
  readonly stretch?: number;
  /** Intensity of the electrical halo around the core. See {@link PibblBifrostOptions}. */
  readonly glow?: number;
  /**
   * Seed used for deterministic sampling or simulation initialization. See
   * {@link PibblBifrostOptions}.
   */
  readonly seed?: number;
}
/**
 * A prismatic beam stretches a white-hot captured subject toward its entry point.
 *
 * @param options - Bifrost appearance and animation settings. See {@link PibblBifrostOptions}.
 * @returns A bifrost transition effect. See {@link PibblTransitionEffect}.
 *
 * @see {@link PibblBifrostOptions}
 * @see {@link PibblTransitionEffect}
 */
export function bifrost(options: PibblBifrostOptions): PibblTransitionEffect {
  const r = regionSnapshot(options.region), ax = r.x + r.width / 2, ay = r.y + r.height;
  const ex = finite(options.entry?.x ?? ax, 'entry.x'), ey = finite(options.entry?.y ?? r.y - r.height * 2, 'entry.y');
  const brightness = finite(options.brightness ?? 1, 'brightness', 0), hue = finite(options.hue ?? 0, 'hue');
  const stretchAmount = finite(options.stretch ?? 7, 'stretch', 0), aura = finite(options.glow ?? 1, 'glow', 0);
  const samplePatches = bifrostKernel(finite(options.seed ?? 0, 'seed'));
  const distance = Math.hypot(ex - ax, ey - ay), ux = distance ? (ex - ax) / distance : 0, uy = distance ? (ey - ay) / distance : -1;
  return defineTransitionEffect((q, phase, frame) => {
    if (q === 1) return [];
    if (q === 0) return [opacity({ amount: 0 })];
    return [captureTransition(({ context: c, windows, drawSource, drawTint }) => {
      const power = Math.pow(Math.sin(Math.PI * q), .65) * brightness * Math.pow(clamp((1 - q) / .32), 2);
      const color = (h: number, a: number, light = 80) => `hsla(${h + hue},100%,${light}%,${clamp(a)})`;
      const glow = (x: number, y: number, rx: number, ry: number, a: number) => {
        c.save(); c.translate(x, y); c.scale(rx, ry);
        const gradient = c.createRadialGradient(0, 0, 0, 0, 0, 1); gradient.addColorStop(0, `rgba(255,255,255,${clamp(a)})`); gradient.addColorStop(.25, color(230, a * .5)); gradient.addColorStop(1, color(230, 0));
        c.fillStyle = gradient; c.fillRect(-1, -1, 2, 2); c.restore();
      };
      // Seeded, feathered clouds stretched along the transit axis. Unequal
      // lengths, widths, hues and velocities avoid a fixed rainbow comb.
      c.save(); c.globalCompositeOperation = 'lighter';
      const dx = ax - ex, dy = ay - ey;
      const angle = Math.atan2(dy, dx), seconds = frame.elapsed / 1000;
      const flow = phase === 'enter' ? 1 : -1;
      // End the beam at the impact plane, as the original ribbons did.
      c.translate(ex, ey); c.rotate(angle);
      c.beginPath(); c.rect(-Math.max(1, distance), -r.width * 2, Math.max(1, distance) * 2, r.width * 4); c.clip();
      c.rotate(-angle); c.translate(-ex, -ey);
      const patches = samplePatches(seconds, flow, power, r.width, distance, ex, ey, dx, dy);
      for (let i = 0; i < 56; i++) {
        const offset = i * 6;
        const length = patches[offset + 2]!, width = patches[offset + 3]!, h = patches[offset + 4]!, alpha = patches[offset + 5]!;
        c.save(); c.translate(patches[offset]!, patches[offset + 1]!);
        c.rotate(angle); c.scale(length, width);
        const patch = c.createRadialGradient(0, 0, 0, 0, 0, 1);
        patch.addColorStop(0, color(h, alpha, 78));
        patch.addColorStop(.25, color(h + 12, alpha * .8, 72));
        patch.addColorStop(.6, color(h - 8, alpha * .3, 68));
        patch.addColorStop(1, color(h, 0, 68));
        c.fillStyle = patch; c.fillRect(-1, -1, 2, 2); c.restore();
      }
      c.restore();
      const softness = 1 - clamp(q / .56), stretch = stretchAmount * softness * softness;
      const travel = r.height * .7 * Math.pow(1 - clamp(q / .5), 2);
      c.save(); c.translate(ax + ux * travel, ay + uy * travel);
      c.transform(1 + stretch * ux * ux, stretch * ux * uy, stretch * ux * uy, 1 + stretch * uy * uy, 0, 0); c.translate(-ax, -ay);
      c.globalAlpha = clamp(q / .075);
      if (softness > 0) {
        c.save(); c.globalAlpha *= clamp(brightness * .7); c.filter = `blur(${(22 + softness * 20) * aura * windows.density}px)`; drawTint('#e1e9ff'); c.restore();
        c.filter = `blur(${(4 + softness * 10) * windows.density}px)`; drawTint('#fff');
      } else {
        drawSource(); c.globalAlpha *= clamp(clamp((1 - q) / .28) * brightness * 1.5); drawTint('#fff');
      }
      c.restore(); c.globalCompositeOperation = 'lighter';
      const impact = Math.exp(-Math.pow((q - .56) / .085, 2));
      glow(ax, r.y + r.height / 2, r.width, r.height * .8, impact * brightness * aura);
      glow(ax, ay, r.width * .9, 24, power * aura);
    })];
  });
}
