import {
  resolveSignalValue,
  type PibblNode,
  type Signal,
  type SignalValue,
} from "@pibbl/core";
import { provideColor, useColor } from "./color-context.js";
import { finiteColorValue, hexColor } from "./color-math.js";
import type { ScaleId } from "./types.js";

/** One lower-inclusive, upper-exclusive threshold color bucket. @see {@link ResolvedThresholdColorScale} */
export interface ThresholdColorBand {
  /** Lower inclusive boundary, omitted for the first bucket. */
  readonly lower: number | undefined;
  /** Upper exclusive boundary, omitted for the last bucket. */
  readonly upper: number | undefined;
  /** Validated #RRGGBB paint for this bucket. */
  readonly color: string;
}

/** Immutable resolved threshold mapping shared with descendant marks. @see {@link ThresholdColorScaleProps} */
export interface ResolvedThresholdColorScale {
  /** Strictly ascending finite authored bucket boundaries. */
  readonly thresholds: readonly number[];
  /** One validated color for every bucket. */
  readonly colors: readonly string[];
  /** Readable bucket descriptions in authored order. */
  readonly bands: readonly ThresholdColorBand[];
  /** Maps a finite numeric value to its containing bucket paint.
   * @param value - Finite input.
   * @returns Canonical lowercase #rrggbb color. */
  readonly map: (value: number) => string;
}

/** Authored threshold boundaries, bucket colors, identity, and descendant content. @see {@link ResolvedThresholdColorScale} */
export interface ThresholdColorScaleProps {
  /** Stable provider identity. */
  readonly id: ScaleId;
  /** Strictly ascending finite boundaries; each equality belongs to the upper bucket. */
  readonly thresholds: SignalValue<readonly number[]>;
  /** Exactly one #RRGGBB color per bucket. */
  readonly colors: SignalValue<readonly string[]>;
  /** Descendant content using this dedicated color context. */
  readonly children?: PibblNode;
}

function resolve(props: ThresholdColorScaleProps): ResolvedThresholdColorScale {
  const input = resolveSignalValue(props.thresholds);
  const paint = resolveSignalValue(props.colors);
  if (!Array.isArray(input) || !Array.isArray(paint))
    throw new TypeError(
      "Threshold color scales require threshold and color arrays.",
    );
  const thresholds = Object.freeze(Array.from(input, finiteColorValue));
  for (let index = 1; index < thresholds.length; index++)
    if (!(thresholds[index - 1] < thresholds[index]))
      throw new RangeError(
        "Threshold color boundaries must be strictly ascending.",
      );
  if (paint.length !== thresholds.length + 1)
    throw new RangeError(
      "Threshold color scales require one more color than thresholds.",
    );
  const colors = Object.freeze(Array.from(paint, hexColor));
  const bands = Object.freeze(
    colors.map((color, index) =>
      Object.freeze({
        lower: index === 0 ? undefined : thresholds[index - 1],
        upper: index === thresholds.length ? undefined : thresholds[index],
        color,
      }),
    ),
  );
  return Object.freeze({
    thresholds,
    colors,
    bands,
    map(value: number) {
      finiteColorValue(value);
      let index = 0;
      while (index < thresholds.length && value >= thresholds[index]) index++;
      return colors[index];
    },
  });
}

/** Provides a lazy, discrete threshold-to-color mapping for descendants.
 * @param props - Boundaries, colors, identity and descendants. See {@link ThresholdColorScaleProps}.
 * @returns Descendant content. */
export function ThresholdColorScale(props: ThresholdColorScaleProps) {
  provideColor(props.id, "threshold", () => resolve(props), [
    props.thresholds,
    props.colors,
  ]);
  return props.children;
}

/** Reads the matching ancestor threshold color mapping.
 * @param id - Provider identity. See {@link ScaleId}.
 * @returns Shared readonly mapping signal. See {@link ResolvedThresholdColorScale}. */
export function useThresholdColorScale(
  id: ScaleId,
): Signal<ResolvedThresholdColorScale> {
  return useColor(id, "threshold");
}
