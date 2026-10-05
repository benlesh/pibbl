import type { PibblEmbersOptions } from './embers.js';
import { finite } from "./capture.js";
import type { lazyTransitionKernel } from "./wasm/kernel.js";
/**
 * Collision information produced by an ember's physical interaction.
 *
 * @see {@link PibblEmbersPhysicsOptions}
 */
export interface PibblEmberCollision {
  /** Fraction of the swept segment at impact, from zero to one. */
  readonly fraction: number;
  /** Outward surface normal in the receiving primitive's local coordinates. */
  readonly normal: readonly [number, number];
}
/**
 * Collision and physical motion options for transition embers.
 *
 * @see {@link PibblEmberCollision}
 * @see {@link PibblEmbersOptions}
 */
export interface PibblEmbersPhysicsOptions {
  /** Local units/second². Default [0, -60]. */
  readonly gravity?: readonly [number, number];
  /** Target air velocity in local units/second. Default [0, -45]. */
  readonly wind?: readonly [number, number];
  /** Velocity damping per second. Default 4. */
  readonly drag?: number;
  /** Bounce coefficient, zero to one. Default 0.5. */
  readonly restitution?: number;
  /** Packed committed solids in receiver-local coordinates (e.g. physicsObstacles2D).
   * Revision must change whenever data changes. Up to 8192 packed numbers.
   * Sweeps run as one WASM batch; mutually exclusive with collide.
   */
  readonly obstacles?: Readonly<{
    /**
     * Reads the current committed values required by this integration. See
     * {@link PibblEmbersPhysicsOptions}.
     * @returns The current obstacle revision and packed geometry arrays.
     */
    read(): Readonly<{
      /**
       * Revision used to detect changes to the underlying state or geometry. See
       * {@link PibblEmbersPhysicsOptions}.
       */
      revision: number;
      /** Packed box obstacle data consumed by the simulation. See {@link PibblEmbersPhysicsOptions}. */
      boxes: Float64Array;
      /**
       * Packed ellipse obstacle data consumed by the simulation. See
       * {@link PibblEmbersPhysicsOptions}.
       */
      ellipses: Float64Array;
      /**
       * Packed polygon obstacle data consumed by the simulation. See
       * {@link PibblEmbersPhysicsOptions}.
       */
      polygons: Float64Array;
    }>;
  }>;
  /**
   * Synchronous point sweep, called in Advance. Return the closest hit, if any.
   * @param from - Previous particle position.
   * @param to - Proposed particle position.
   * @returns Collision information, or undefined when motion is unobstructed. See
   * {@link PibblEmberCollision} .
   */
  readonly collide?: (
    from: readonly [number, number],
    to: readonly [number, number],
  ) => PibblEmberCollision | undefined;
}
export function resolveEmbersPhysics(options: PibblEmbersPhysicsOptions) {
  const vector = (value: readonly [number, number], name: string) =>
    Object.freeze([
      finite(value[0], `${name}.x`),
      finite(value[1], `${name}.y`),
    ] as const);
  const restitution = finite(
    options.restitution ?? 0.5,
    "physics.restitution",
    0,
  );
  if (restitution > 1)
    throw new RangeError("physics.restitution must be between zero and one.");
  if (options.collide !== undefined && typeof options.collide !== "function")
    throw new TypeError("physics.collide must be a synchronous function.");
  if (
    options.obstacles &&
    (typeof options.obstacles.read !== "function" || options.collide)
  )
    throw new TypeError(
      "physics.obstacles requires read() and cannot be combined with collide.",
    );
  return Object.freeze({
    obstacles: options.obstacles,
    gravity: vector(options.gravity ?? [0, -60], "physics.gravity"),
    wind: vector(options.wind ?? [0, -45], "physics.wind"),
    drag: finite(options.drag ?? 4, "physics.drag", 0),
    restitution,
    collide: options.collide,
  });
}
type Kernel = ReturnType<ReturnType<typeof lazyTransitionKernel>>;
export function emberSimulation(
  kernel: Kernel,
  options: ReturnType<typeof resolveEmbersPhysics>,
  region: Readonly<{ x: number; y: number; width: number; height: number }>,
  linger: number,
  burnWidth: number,
) {
  let previous = 0,
    remainder = 0,
    needsReset = true,
    disposed = false;
  const step = 1000 / 60;
  let obstacleRevision: number | undefined;
  let boxLength = 0,
    ellipseLength = 0,
    polygonLength = 0;
  return {
    reset() {
      previous = 0;
      remainder = 0;
      needsReset = true;
    },
    get disposed() {
      return disposed;
    },
    dispose() {
      disposed = true;
      kernel.dispose();
    },
    advance(elapsed: number, progressAt: (time: number) => number) {
      if (disposed || elapsed <= previous) return;
      const { exports, values } = kernel();
      if (needsReset) {
        exports.resetPhysics!();
        needsReset = false;
      }
      remainder += Math.min(elapsed - previous, step * 4);
      previous = elapsed;
      if (remainder + 1e-8 >= step && options.obstacles) {
        const batch = options.obstacles.read();
        if (batch.revision !== obstacleRevision) {
          const { boxes, ellipses, polygons } = batch;
          if (
            !Number.isFinite(batch.revision) ||
            boxes.length % 10 ||
            ellipses.length % 10 ||
            boxes.length + ellipses.length + polygons.length > 8192
          )
            throw new RangeError(
              "Invalid ember obstacle batch or capacity exceeded (8192 numbers).",
            );
          for (const packed of [boxes, ellipses, polygons])
            for (const value of packed)
              if (!Number.isFinite(value))
                throw new RangeError("Ember obstacles must be finite.");
          for (const packed of [boxes, ellipses])
            for (let i = 0; i < packed.length; i += 10)
              if (packed[i + 2]! <= 0 || packed[i + 3]! <= 0)
                throw new RangeError(
                  "Ember obstacle extents must be positive.",
                );
          for (let at = 0; at < polygons.length;) {
            const count = polygons[at]!;
            if (
              !Number.isInteger(count) ||
              count < 3 ||
              at + 6 + count * 2 > polygons.length
            )
              throw new RangeError("Invalid ember obstacle polygon.");
            at += 6 + count * 2;
          }
          values.set(boxes, 22400);
          values.set(ellipses, 22400 + boxes.length);
          values.set(polygons, 22400 + boxes.length + ellipses.length);
          boxLength = boxes.length;
          ellipseLength = ellipses.length;
          polygonLength = polygons.length;
          obstacleRevision = batch.revision;
        }
      }
      while (remainder + 1e-8 >= step) {
        const time = elapsed - remainder + step;
        remainder = Math.max(0, remainder - step);
        const q = progressAt(time);
        exports.births!(time, linger);
        for (let i = 0; i < 1200; i++)
          values[11166 + i] = progressAt(values[12366 + i]!);
        exports.sample!(
          q,
          1,
          time,
          linger,
          0,
          burnWidth,
          region.x,
          region.y,
          region.width,
          region.height,
          Math.min(512, Math.max(1, Math.ceil(region.width / 2))),
        );
        exports.stepPhysics!(
          time,
          step / 1000,
          ...options.gravity,
          ...options.wind,
          options.drag,
          linger,
        );
        if (options.obstacles)
          exports.collideObstacles!(
            boxLength,
            ellipseLength,
            polygonLength,
            options.restitution,
          );
        if (options.collide)
          for (let i = 0; i < 1200; i++) {
            const s = 14000 + i * 7;
            if (values[s + 4]! < 0) continue;
            const from = [values[s + 5]!, values[s + 6]!] as const,
              to = [values[s]!, values[s + 1]!] as const;
            if (from[0] === to[0] && from[1] === to[1]) continue;
            const hit = options.collide(from, to);
            if (!hit) continue;
            const fraction = finite(hit.fraction, "collision.fraction", 0);
            const nx = finite(hit.normal?.[0], "collision.normal.x"),
              ny = finite(hit.normal?.[1], "collision.normal.y"),
              length = Math.hypot(nx, ny);
            if (fraction > 1 || length < 1e-8)
              throw new RangeError(
                "Ember collision requires a fraction in [0, 1] and a nonzero normal.",
              );
            exports.collidePhysics!(
              i,
              fraction,
              nx / length,
              ny / length,
              options.restitution,
            );
          }
      }
    },
    present() {
      if (!needsReset && !disposed) kernel().exports.presentPhysics!();
      else {
        const { values } = kernel();
        for (let i = 0; i < 1200; i++) values[1566 + i * 8 + 5] = -1;
      }
    },
  };
}
