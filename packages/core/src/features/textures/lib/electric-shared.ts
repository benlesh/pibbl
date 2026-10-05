import type { ElectricSource } from './electric-sources.js';
import type { LightningMessage, LightningOptions } from './lightning.js';
import type { TendrilsMessage, TendrilsOptions } from './tendrils.js';
import type { TextureContext } from "@crc/core";
import { validateSeed } from "./palette.js";

/**
 * Coordinates are normalized to the complete texture, including its halo padding.
 *
 * @see {@link ElectricSource}
 * @see {@link LightningOptions}
 * @see {@link TendrilsOptions}
 * @see {@link LightningMessage}
 */
export interface ElectricPoint {
  /**
   * Horizontal coordinate or displacement in the containing coordinate system. See
   * {@link ElectricPoint}.
   */
  readonly x: number;
  /**
   * Vertical coordinate or displacement in the containing coordinate system. See
   * {@link ElectricPoint}.
   */
  readonly y: number;
}
/**
 * Deterministic seed, branching, and glow shared by electrical texture recipes.
 *
 * @see {@link TendrilsOptions}
 * @see {@link LightningOptions}
 */
export interface ElectricOptions {
  /**
   * Seed used for deterministic sampling or simulation initialization. See {@link ElectricOptions}
   * .
   */
  readonly seed?: number;
  /** 0..1, controls the number of secondary branches. */
  readonly branching?: number;
  /** 0..2, scales the soft halo without widening the white core. */
  readonly glow?: number;
}
/**
 * Pause or reseed/reset commands shared by electrical textures.
 *
 * @see {@link TendrilsMessage}
 * @see {@link LightningMessage}
 */
export type ElectricControl =
  | {
      /** The literal "pause" identifying this variant. See {@link ElectricControl}. */
      readonly type: "pause";
      /** Whether simulation or playback advancement is suspended. See {@link ElectricControl}. */
      readonly paused: boolean;
    }
  | {
      /** The literal "reset" identifying this variant. See {@link ElectricControl}. */
      readonly type: "reset";
      /**
       * Seed used for deterministic sampling or simulation initialization. See
       * {@link ElectricControl}.
       */
      readonly seed?: number;
    };
export function range(value: number, min: number, max: number, name: string) {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new RangeError(`${name} must be ${min}..${max}.`);
  return value;
}
export function point(p: ElectricPoint): ElectricPoint {
  return { x: range(p.x, 0, 1, "Point x"), y: range(p.y, 0, 1, "Point y") };
}
export function electricOptions(o: ElectricOptions) {
  return {
    seed: validateSeed(o.seed),
    branching: range(o.branching ?? 0.6, 0, 1, "Branching"),
    glow: range(o.glow ?? 1, 0, 2, "Glow"),
  };
}
export function drawCore(
  context: TextureContext,
  p: ElectricPoint,
  strength: number,
  glow: number,
  radius = 0.038,
) {
  if (strength <= 0) return;
  const ctx = context.canvas.getContext("2d")!,
    scale = Math.min(context.canvas.width, context.canvas.height);
  const x = p.x * context.canvas.width,
    y = p.y * context.canvas.height;
  const r = scale * radius * (0.5 + glow);
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
  gradient.addColorStop(0, `rgba(255,249,255,${strength})`);
  gradient.addColorStop(0.1, `rgba(239,191,255,${strength * 0.95})`);
  gradient.addColorStop(
    0.35,
    `rgba(179,60,255,${(strength * 0.4 * glow) / 2})`,
  );
  gradient.addColorStop(1, "rgba(91,30,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.fillStyle = `rgba(255,250,255,${strength})`;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.65, scale * 0.004), 0, Math.PI * 2);
  ctx.fill();
}
