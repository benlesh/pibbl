import type { TextureContext } from "@crc/core";
import { validateSeed } from "./palette.js";

/** Coordinates are normalized to the complete texture, including its halo padding. */
export interface ElectricPoint {
  readonly x: number;
  readonly y: number;
}
export interface ElectricOptions {
  readonly seed?: number;
  /** 0..1, controls the number of secondary branches. */
  readonly branching?: number;
  /** 0..2, scales the soft halo without widening the white core. */
  readonly glow?: number;
}
export type ElectricControl =
  | { readonly type: "pause"; readonly paused: boolean }
  | { readonly type: "reset"; readonly seed?: number };
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
/** Stable integer hash; never uses ambient Math.random. */
export function noise(seed: number, index: number) {
  let x = (seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}
export interface Filament {
  points: ElectricPoint[];
  intensity: number;
  hue: number;
  width: number;
}
export function mix(
  a: ElectricPoint,
  b: ElectricPoint,
  t: number,
): ElectricPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
/** One bounded path list, layered glow strokes followed by a sharp core. */
export function drawFilaments(
  context: TextureContext,
  lines: readonly Filament[],
  glow: number,
) {
  const ctx = context.canvas.getContext("2d")!;
  const w = context.canvas.width,
    h = context.canvas.height,
    scale = Math.min(w, h);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const pass of [0, 1, 2, 3]) {
    if (pass < 2 && glow === 0) continue;
    for (const line of lines) {
      if (line.intensity < 0.005) continue;
      ctx.beginPath();
      line.points.forEach((p, i) =>
        i ? ctx.lineTo(p.x * w, p.y * h) : ctx.moveTo(p.x * w, p.y * h),
      );
      const alpha = Math.min(
        1,
        line.intensity * [0.055 * glow, 0.16 * glow, 0.65, 0.95][pass],
      );
      ctx.strokeStyle =
        pass === 3
          ? `rgba(245,239,255,${alpha})`
          : `hsla(${line.hue},100%,${pass === 2 ? 72 : 58}%,${alpha})`;
      ctx.lineWidth = Math.max(
        0.45,
        scale * line.width * [16 * glow, 6 * glow, 2, 0.65][pass],
      );
      ctx.stroke();
    }
  }
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
