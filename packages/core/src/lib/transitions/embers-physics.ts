import { finite } from './capture.js';
import type { lazyTransitionKernel } from './wasm/kernel.js';
export interface CRCEmberCollision {
  /** Fraction of the swept segment at impact, from zero to one. */
  readonly fraction: number;
  /** Outward surface normal in the receiving primitive's local coordinates. */
  readonly normal: readonly [number, number];
}
export interface CRCEmbersPhysicsOptions {
  /** Local units/second². Default [0, -60]. */
  readonly gravity?: readonly [number, number];
  /** Target air velocity in local units/second. Default [0, -45]. */
  readonly wind?: readonly [number, number];
  /** Velocity damping per second. Default 4. */
  readonly drag?: number;
  /** Bounce coefficient, zero to one. Default 0.5. */
  readonly restitution?: number;
  /** Synchronous point sweep, called in Advance. Return the closest hit, if any. */
  readonly collide?: (from: readonly [number, number], to: readonly [number, number]) => CRCEmberCollision | undefined;
}
export function resolveEmbersPhysics(options: CRCEmbersPhysicsOptions) {
  const vector = (value: readonly [number, number], name: string) => Object.freeze([finite(value[0], `${name}.x`), finite(value[1], `${name}.y`)] as const);
  const restitution = finite(options.restitution ?? .5, 'physics.restitution', 0);
  if (restitution > 1) throw new RangeError('physics.restitution must be between zero and one.');
  if (options.collide !== undefined && typeof options.collide !== 'function') throw new TypeError('physics.collide must be a synchronous function.');
  return Object.freeze({ gravity: vector(options.gravity ?? [0,-60], 'physics.gravity'), wind: vector(options.wind ?? [0,-45], 'physics.wind'), drag: finite(options.drag ?? 4,'physics.drag',0), restitution, collide: options.collide });
}
type Kernel = ReturnType<ReturnType<typeof lazyTransitionKernel>>;
export function emberSimulation(kernel: Kernel, options: ReturnType<typeof resolveEmbersPhysics>, region: Readonly<{x:number;y:number;width:number;height:number}>, linger: number, burnWidth: number) {
  let previous = 0, remainder = 0, needsReset = true, disposed = false;
  const step = 1000 / 60;
  return {
    reset() { previous = 0; remainder = 0; needsReset = true; },
    get disposed() { return disposed; },
    dispose() { disposed = true; kernel.dispose(); },
    advance(elapsed: number, progressAt: (time: number) => number) {
      if (disposed || elapsed <= previous) return;
      const { exports, values } = kernel();
      if (needsReset) { exports.resetPhysics!(); needsReset = false; }
      remainder += Math.min(elapsed - previous, step * 4); previous = elapsed;
      while (remainder + 1e-8 >= step) {
        const time = elapsed - remainder + step;
        remainder = Math.max(0, remainder - step);
        const q = progressAt(time);
        exports.births!(time, linger);
        for (let i=0;i<1200;i++) values[11166+i] = progressAt(values[12366+i]!);
        exports.sample!(q, 1, time, linger, 0, burnWidth, region.x, region.y, region.width, region.height, Math.min(512,Math.max(1,Math.ceil(region.width/2))));
        exports.stepPhysics!(time, step/1000, ...options.gravity, ...options.wind, options.drag, linger);
        if (options.collide) for (let i=0;i<1200;i++) {
          const s=14000+i*7;
          if (values[s+4]! < 0) continue;
          const from = [values[s+5]!,values[s+6]!] as const, to = [values[s]!,values[s+1]!] as const;
          if (from[0]===to[0] && from[1]===to[1]) continue;
          const hit = options.collide(from,to);
          if (!hit) continue;
          const fraction = finite(hit.fraction,'collision.fraction',0);
          const nx = finite(hit.normal?.[0], 'collision.normal.x'), ny = finite(hit.normal?.[1], 'collision.normal.y'), length = Math.hypot(nx,ny);
          if (fraction>1 || length<1e-8) throw new RangeError('Ember collision requires a fraction in [0, 1] and a nonzero normal.');
          exports.collidePhysics!(i,fraction,nx/length,ny/length,options.restitution);
        }
      }
    },
    present() { if (!needsReset && !disposed) kernel().exports.presentPhysics!(); else { const {values}=kernel(); for(let i=0;i<1200;i++)values[1566+i*8+5]=-1; } },
  };
}
