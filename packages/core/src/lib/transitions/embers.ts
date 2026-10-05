import { emberSimulation, resolveEmbersPhysics, type CRCEmbersPhysicsOptions } from './embers-physics.js';
import { lazyTransitionKernel } from './wasm/kernel.js';
import { bytes } from './wasm/embers-bytes.js';
const createKernel = lazyTransitionKernel(bytes, 2);
const createPhysicsKernel = lazyTransitionKernel(bytes, 4);
import { opacity } from '../../filters/native.js';
import { filterBoundaryExecutor, type CustomPreparedFilter } from '../../filters/filter-executor.js';
import { GLOBAL_STATE } from '../global-state.js';
import { getOptionalService } from '../optional-services.js';
import { CRC_FILTER_EXECUTOR, type CRCFilterExecutor } from '../style/filter-types.js';
import type { CRCInstance } from '../types.js';
import { defineTransitionEffect, type CRCTransitionEffect } from './fade.js';

/**
 * Appearance, motion, and timing controls for an ember visibility transition.
 *
 * @see {@link CRCEmbersPhysicsOptions}
 * @see {@link embers}
 */
export interface CRCEmbersOptions {
  /** Local coordinates enclosing the subject; the burn travels upward through this area. */
  readonly region: Readonly<{
    /**
     * Horizontal coordinate or displacement in the containing coordinate system. See
     * {@link CRCEmbersOptions}.
     */
    x: number;
    /**
     * Vertical coordinate or displacement in the containing coordinate system. See
     * {@link CRCEmbersOptions}.
     */
    y: number;
    /**
     * Horizontal extent in the units of the containing geometry or surface. See
     * {@link CRCEmbersOptions}.
     */
    width: number;
    /**
     * Vertical extent in the units of the containing geometry or surface. See
     * {@link CRCEmbersOptions}.
     */
    height: number;
  }>;
  /**
   * Depth of the darkened char region along the ember transition boundary. See
   * {@link CRCEmbersOptions}.
   */
  readonly charDepth?: number;
  /**
   * Width of the glowing burn region along the transition boundary. See {@link CRCEmbersOptions}.
   */
  readonly burnWidth?: number;
  /** Horizontal drift in local units; negative blows left. */
  readonly wind?: number;
  /**
   * Seed used for deterministic sampling or simulation initialization. See
   * {@link CRCEmbersOptions}.
   */
  readonly seed?: number;
  /**
   * Maximum airborne particle lifetime in milliseconds; completion includes this tail. Default
   * 700.
   */
  readonly linger?: number;
  /** Opt-in local force simulation and collision. Requires a positive linger. */
  readonly physics?: CRCEmbersPhysicsOptions;
}
const SCRATCH = Symbol('crc.transition.embers');
class EmberSurfaces {
  private surfaces: OffscreenCanvas[] = [];
  used = false;
  private committed = false;
  constructor(private readonly instance: CRCInstance) {}
  beginRender(): void { this.used = false; }
  endRender(success: boolean): void {
    if (success && this.used) { this.committed = true; return; }
    if (success || !this.committed) this.dispose();
  }
  context(index: number, width: number, height: number): OffscreenCanvasRenderingContext2D {
    const canvas = this.surfaces[index] ??= new OffscreenCanvas(width, height);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Embers requires a Canvas 2D surface.');
    context.reset();
    return context;
  }
  dispose(): void {
    for (const surface of this.surfaces) { surface.width = 0; surface.height = 0; }
    this.surfaces = [];
    this.instance.optionalServices.delete(SCRATCH);
  }
}
const clamp = (value: number) => Math.max(0, Math.min(1, value));

/**
 * A seeded burn/char front over one captured subtree, with outward drifting fragments.
 *
 * @param options - Ember emission, motion, appearance, and optional collision settings. See
 * {@link CRCEmbersOptions} .
 * @returns An ember transition effect. See {@link CRCTransitionEffect}.
 *
 * @see {@link CRCEmbersOptions}
 * @see {@link CRCTransitionEffect}
 */
export function embers(options: CRCEmbersOptions): CRCTransitionEffect {
  const region = Object.freeze({ ...options.region });
  const charDepth = options.charDepth ?? 65, burnWidth = options.burnWidth ?? 12;
  const wind = options.wind ?? 110, seed = options.seed ?? 0, linger = options.linger ?? 700;
  for (const [name, value] of Object.entries({ ...region, charDepth, burnWidth, wind, seed, linger })) {
    if (!Number.isFinite(value)) throw new RangeError(`embers ${name} must be finite.`);
  }
  if (!(region.width > 0 && region.height > 0) || charDepth < 0 || burnWidth < 0 || linger < 0) throw new RangeError('embers requires a positive region and nonnegative charDepth/burnWidth/linger.');
  const physics = options.physics === undefined ? undefined : resolveEmbersPhysics(options.physics);
  if (physics && linger === 0) throw new RangeError('Ember physics requires a positive linger.');
  const sampler = (kernel: ReturnType<typeof createKernel>, simulation?: ReturnType<typeof emberSimulation>): import('./fade.js').TransitionSampler => (q, phase, frame) => {
    if (simulation?.disposed) return [opacity({ amount: 0 })];
    if ((!frame.active || !linger) && q === 1) return [];
    if ((!frame.active || !linger) && q === 0) return [opacity({ amount: 0 })];
    const executor: CRCFilterExecutor = {
      render: filterBoundaryExecutor.render,
      prepare(): CustomPreparedFilter {
        return {
          executor: filterBoundaryExecutor,
          reverseInfluence: output => ({ ...output }),
          process(source, windows) {
            const instance = GLOBAL_STATE.currentCRCInstance;
            if (!instance) throw new Error('Embers requires an active CRC instance.');
            const scratch = getOptionalService(instance, SCRATCH, () => new EmberSurfaces(instance));
            scratch.used = true;
            const c = scratch.context(0, source.width, source.height);
            const tint = scratch.context(1, source.width, source.height);
            const matrix = windows.source.renderTransform;
            const roughness = Math.min(5, region.height * .015);
            const front = region.y + region.height + roughness * 2 - q * (region.height + roughness * 4);
            const segments = Math.min(512, Math.max(1, Math.ceil(region.width / 2)));
            const { exports, values } = kernel();
            exports.births!(frame.elapsed, linger);
            // The controller remains the source of truth for reversal history.
            if (linger) for (let i = 0; i < 1200; i++) values[11166 + i] = frame.progressAt(values[12366 + i]!);
            exports.sample!(q, phase === 'enter' ? 1 : 0, frame.elapsed, linger, wind, burnWidth, region.x, region.y, region.width, region.height, segments);
            simulation?.present();
            const bandPath = (depth: number) => {
              c.beginPath();
              for (let i = 0; i <= segments; i++) c.lineTo(values[i * 2]!, values[i * 2 + 1]!);
              for (let i = segments; i >= 0; i--) c.lineTo(values[i * 2]!, values[i * 2 + 1]! + depth);
              c.closePath();
            };
            const path = (depth: number) => {
              c.beginPath(); c.moveTo(region.x, region.y + region.height + charDepth + 40);
              for (let i = 0; i <= segments; i++) c.lineTo(values[i * 2]!, values[i * 2 + 1]! + depth);
              c.lineTo(region.x + region.width, values[segments * 2 + 1]! + depth);
              c.lineTo(region.x + region.width, region.y + region.height + charDepth + 40); c.closePath();
            };
            if (q > 0) {
            c.save(); c.setTransform(matrix); path(0); c.clip();
            c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(source, 0, 0); c.restore();
            c.setTransform(matrix); c.globalCompositeOperation = 'source-atop';
            const strength = clamp((1 - q) / .12);
            // Continuous overlapping contour bands avoid vertical striping at the hot edge.
            for (let band = 48; band > 0 && charDepth > 0; band--) {
              const depth = charDepth * band / 48;
              c.save();
              bandPath(depth); c.clip();
              c.fillStyle = `rgba(27,16,12,${.12 * strength})`;
              c.fillRect(region.x, front - roughness * 2, region.width, depth + roughness * 4);
              c.restore();
            }
            // A connected thermal front carries the light; individual coals only
            // add texture. Source-atop preserves holes in the captured silhouette.
            if (burnWidth > 0) {
              c.save(); c.globalAlpha = strength;
              c.filter = `blur(${Math.min(3, burnWidth * .16) * windows.density}px)`;
              bandPath(burnWidth * 1.45); c.fillStyle = '#8d2a0c'; c.fill();
              c.filter = 'none';
              bandPath(burnWidth * .85); c.fillStyle = '#d9510c'; c.fill();
              bandPath(burnWidth * .48); c.fillStyle = '#ff942c'; c.fill();
              bandPath(burnWidth * .2); c.fillStyle = '#ffd27c'; c.fill();
              c.restore();
            }
            for (let i = 0; i < 180; i++) {
              const offset = 1026 + i * 3;
              const x = values[offset]!, y = values[offset + 1]!, r = values[offset + 2]!;
              const heat = c.createRadialGradient(x, y, 0, x, y, r);
              heat.addColorStop(0, `rgba(255,222,145,${strength * .5})`);
              heat.addColorStop(.3, `rgba(247,92,15,${strength * .4})`);
              heat.addColorStop(1, 'rgba(100,20,0,0)');
              c.fillStyle = heat; c.fillRect(x - r, y - r, r * 2, r * 2);
            }
            }
            c.setTransform(matrix);
            // Tint a copy of the subject once. Sampling small patches means transparent
            // gaps cannot emit particles, without reading pixels back from the canvas.
            tint.drawImage(source, 0, 0); tint.globalCompositeOperation = 'source-in';
            tint.fillStyle = '#fff4cf'; tint.fillRect(0, 0, source.width, source.height);
            const ash = scratch.context(2, source.width, source.height);
            ash.drawImage(source, 0, 0); ash.globalCompositeOperation = 'source-in';
            ash.fillStyle = '#766b60'; ash.fillRect(0, 0, source.width, source.height);
            c.globalCompositeOperation = 'source-over';
            for (let i = 0; i < 1200; i++) {
              const offset = 1566 + i * 8, alpha = values[offset + 5]!;
              if (alpha < 0) continue;
              const x = values[offset]!, y = values[offset + 1]!, size = values[offset + 2]!;
              const sample = new DOMPoint(x, y).matrixTransform(matrix);
              const dx = values[offset + 3]!, dy = values[offset + 4]!, age = values[offset + 7]!;
              c.save(); c.globalAlpha = alpha;
              c.translate(x + dx, y + dy); c.rotate(values[offset + 6]!);
              // Hot fragments cool continuously into dim ash rather than switching off.
              const cooling = clamp((age - .2) / .8);
              c.globalAlpha = alpha * (1 - cooling);
              c.drawImage(tint.canvas, sample.x, sample.y, size * windows.density, size * windows.density, -size / 2, -size / 2, size, size);
              if (cooling > 0) {
                c.globalAlpha = alpha * cooling;
                c.drawImage(ash.canvas, sample.x, sample.y, size * windows.density, size * windows.density, -size / 2, -size / 2, size, size);
              }
              c.restore();
            }
            return c.canvas.transferToImageBitmap();
          },
        };
      },
    };
    return [Object.freeze({ [CRC_FILTER_EXECUTOR]: executor })];
  };
  return defineTransitionEffect(sampler(createKernel(seed)), linger, physics ? () => {
    const kernel = createPhysicsKernel(seed);
    const simulation = emberSimulation(kernel, physics, region, linger, burnWidth);
    return { sample: sampler(kernel, simulation), advance: simulation.advance, reset: simulation.reset, dispose: simulation.dispose };
  } : undefined);
}
