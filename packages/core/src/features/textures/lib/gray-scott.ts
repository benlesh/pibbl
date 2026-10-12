import { validateSeed } from "./palette.js";
/** Curated immutable Gray–Scott feed/kill pairs. Appearance also depends on seed and elapsed steps. @see {@link ReactionDiffusionOptions} */
export const grayScottPresets = Object.freeze({
  /** Existing isolated spots. See {@link grayScottPresets}. */
  spots: Object.freeze({ feed: 0.0367, kill: 0.0649 }),
  /** Existing connected stripes. See {@link grayScottPresets}. */
  stripes: Object.freeze({ feed: 0.029, kill: 0.057 }),
  /** Branching coral-like fronts. See {@link grayScottPresets}. */
  coral: Object.freeze({ feed: 0.0545, kill: 0.062 }),
  /** Elongated worm-like structures. See {@link grayScottPresets}. */
  worms: Object.freeze({ feed: 0.078, kill: 0.061 }),
  /** Dense connected labyrinths. See {@link grayScottPresets}. */
  labyrinths: Object.freeze({ feed: 0.037, kill: 0.06 }),
  /** Growing and dividing spots in suitable seeded conditions. See {@link grayScottPresets}. */
  mitosis: Object.freeze({ feed: 0.028, kill: 0.062 }),
});
/** Named configurations of the same Gray–Scott solver and message contract. @see {@link grayScottPresets} */
export type ReactionDiffusionPreset = keyof typeof grayScottPresets;
/** Seed, chemistry, and initialization controls for Gray–Scott textures. @see {@link grayScottPresets} */
export interface ReactionDiffusionOptions {
  /** Unsigned 32-bit initialization seed; default 42. See {@link ReactionDiffusionOptions}. */
  readonly seed?: number;
  /** Curated feed/kill configuration; default spots. See {@link ReactionDiffusionPreset}. */
  readonly preset?: ReactionDiffusionPreset;
  /** Feed-rate override, finite 0–0.1. Changes reset the field. See {@link ReactionDiffusionOptions}. */
  readonly feed?: number;
  /** Kill-rate override, finite 0–0.1. Changes reset the field. See {@link ReactionDiffusionOptions}. */
  readonly kill?: number;
  /** Initial numerical steps, integer 0–4096; default 0. Runs once per initialization. See {@link ReactionDiffusionOptions}. */
  readonly warmupSteps?: number;
}
export function grayScottConfig(options: ReactionDiffusionOptions) {
  const preset = options.preset ?? "spots";
  if (!Object.hasOwn(grayScottPresets, preset))
    throw new TypeError("Unknown reaction-diffusion preset.");
  const feed = options.feed ?? grayScottPresets[preset].feed;
  const kill = options.kill ?? grayScottPresets[preset].kill;
  if (
    ![feed, kill].every(
      (value) => Number.isFinite(value) && value >= 0 && value <= 0.1,
    )
  )
    throw new RangeError(
      "Gray–Scott feed and kill must be finite values in [0, 0.1].",
    );
  const warmupSteps = options.warmupSteps ?? 0;
  if (!Number.isInteger(warmupSteps) || warmupSteps < 0 || warmupSteps > 4096)
    throw new RangeError(
      "Gray–Scott warmupSteps must be an integer in [0, 4096].",
    );
  return { seed: validateSeed(options.seed), preset, feed, kill, warmupSteps };
}
