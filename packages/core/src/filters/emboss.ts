import { isSignal } from "../lib/signals/graph.js";
import type { SignalValue } from "../lib/signals/types.js";
import { layoutDiagnostic } from "../lib/style/diagnostics.js";
import {
  PIBBL_FILTER_EXECUTOR,
  type PibblFilter,
  type PibblFilterExecutor,
} from "../lib/style/filter-types.js";
import {
  borrowTextureRaster,
  validateTexturePaint,
  type TexturePaint,
} from "../lib/textures/texture-protocol.js";
import {
  filterBoundaryExecutor,
  type CustomPreparedFilter,
} from "./filter-executor.js";
import { processEmboss } from "./render-emboss-boundary.js";

/** Directional lighting of grayscale texture height. See {@link emboss}. */
export interface PibblEmbossFilterOptions {
  /** Local texture placement region with finite coordinates and positive dimensions. See {@link TexturePaint}. */
  readonly region: Readonly<{
    /** Horizontal origin in local logical coordinates. See {@link PibblEmbossFilterOptions}. */
    x: number;
    /** Vertical origin in local logical coordinates. See {@link PibblEmbossFilterOptions}. */
    y: number;
    /** Positive logical region width. See {@link PibblEmbossFilterOptions}. */
    width: number;
    /** Positive logical region height. See {@link PibblEmbossFilterOptions}. */
    height: number;
  }>;
  /** Height range in logical pixels, finite 0–32; default 3. See {@link emboss}. */
  readonly depth?: SignalValue<number>;
  /** Lighting strength, finite 0–1; default 1. Zero bypasses processing. See {@link emboss}. */
  readonly strength?: SignalValue<number>;
  /** Nonzero finite direction toward the light in local coordinates; default [-0.6, -0.8]. See {@link emboss}. */
  readonly direction?: readonly [number, number];
}
const definitions = new WeakMap<
  PibblFilter,
  {
    map: SignalValue<TexturePaint>;
    options: Readonly<PibblEmbossFilterOptions>;
  }
>();
const executor: PibblFilterExecutor = {
  prepare(value, property, context) {
    const definition = definitions.get(value);
    if (!definition)
      throw new Error(
        "An emboss filter was created by an incompatible Pibbl runtime.",
      );
    const { options } = definition;
    const fail = (key: string, value: unknown, reason: string) =>
      layoutDiagnostic({
        component: context.component,
        property: `${property}.${key}`,
        value,
        algorithm: context.algorithm,
        constraints: context.constraints,
        reason,
      });
    const numeric = (
      key: "depth" | "strength",
      fallback: number,
      maximum: number,
    ) => {
      const input = options[key];
      const value =
        input === undefined ? fallback : isSignal(input) ? input.get() : input;
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > maximum
      )
        throw fail(key, value, `must be finite within 0..${maximum}`);
      return value;
    };
    const depth = numeric("depth", 3, 32),
      strength = numeric("strength", 1, 1);
    const direction: unknown = options.direction ?? [-0.6, -0.8];
    if (
      !Array.isArray(direction) ||
      direction.length !== 2 ||
      !direction.every(
        (value) => typeof value === "number" && Number.isFinite(value),
      ) ||
      Math.hypot(...direction) === 0
    )
      throw fail(
        "direction",
        direction,
        "must contain two finite components with nonzero length",
      );
    const length = Math.hypot(...direction);
    const candidate: unknown = options.region;
    if (!candidate || typeof candidate !== "object")
      throw fail(
        "region",
        candidate,
        "must contain finite coordinates and positive dimensions",
      );
    const { x, y, width, height } = candidate as {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    if (
      ![x, y, width, height].every(
        (value) => typeof value === "number" && Number.isFinite(value),
      ) ||
      width <= 0 ||
      height <= 0
    )
      throw fail(
        "region",
        candidate,
        "must contain finite coordinates and positive dimensions",
      );
    const region = { x, y, width, height };
    const map = isSignal(definition.map)
      ? definition.map.get()
      : definition.map;
    try {
      validateTexturePaint(map);
      if (strength !== 0 && depth !== 0)
        borrowTextureRaster(map, () => undefined);
    } catch (error) {
      throw fail(
        "map",
        map,
        error instanceof Error ? error.message : String(error),
      );
    }
    const settings = {
      opacity: strength,
      depth,
      threshold: 0,
      softness: 1,
      direction: [direction[0] / length, direction[1] / length] as const,
    };
    return Object.freeze({
      executor: filterBoundaryExecutor,
      reverseInfluence: (output) => ({ ...output }),
      process:
        strength === 0 || depth === 0
          ? undefined
          : (source, windows) =>
              processEmboss(source, windows, map, settings, region),
    } satisfies CustomPreparedFilter);
  },
  render: filterBoundaryExecutor.render,
};
/**
 * Lights captured pixels using normals derived from a grayscale texture height map.
 * Flat heights are neutral; opposing slopes brighten and darken without changing alpha or geometry.
 * @param map - Mounted height texture, luminance times alpha; white is high. See {@link TexturePaint}.
 * @param options - Local placement, height depth, strength, and light direction. See {@link PibblEmbossFilterOptions}.
 * @returns A filter descriptor for style.filter. See {@link PibblFilter}.
 * @see {@link PibblEmbossFilterOptions}
 */
export function emboss(
  map: SignalValue<TexturePaint>,
  options: PibblEmbossFilterOptions,
): PibblFilter {
  const frozen = Object.freeze({
    ...options,
    region: Object.freeze({ ...options.region }),
    direction:
      options.direction &&
      (Object.freeze([...options.direction]) as readonly [number, number]),
  });
  const value = Object.freeze({ [PIBBL_FILTER_EXECUTOR]: executor });
  definitions.set(value, { map, options: frozen });
  return value;
}
