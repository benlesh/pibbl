import { resolveSignalValue, type Signal } from "@pibbl/core";
import type {
  DivergingColorScaleProps,
  ResolvedDivergingColorScale,
} from "./color-types.js";
import type { ScaleId } from "./types.js";
import { provideColor, useColor } from "./color-context.js";
import {
  colorMix,
  colorPosition,
  finiteColorValue,
  hexColor,
} from "./color-math.js";
function resolve(props: DivergingColorScaleProps): ResolvedDivergingColorScale {
  const input = resolveSignalValue(props.domain),
    paint = resolveSignalValue(props.colors);
  if (
    !Array.isArray(input) ||
    input.length !== 3 ||
    !Array.isArray(paint) ||
    paint.length !== 3
  )
    throw new RangeError(
      "Diverging color scales require three domain values and three colors.",
    );
  const domain = Object.freeze(
      Array.from(input, finiteColorValue),
    ) as readonly [number, number, number],
    colors = Object.freeze(Array.from(paint, hexColor)) as readonly [
      string,
      string,
      string,
    ];
  const [a, m, b] = domain;
  if (!((a < m && m < b) || (a > m && m > b)))
    throw new RangeError(
      "Diverging color domain must be strictly monotonic around its center.",
    );
  const stops = Object.freeze(
    domain.map((value, i) => Object.freeze({ value, color: colors[i] })),
  );
  return Object.freeze({
    domain,
    colors,
    stops,
    map(value: number) {
      finiteColorValue(value);
      if (value === m) return colors[1];
      return (a < m ? value < m : value > m)
        ? colorMix(colors[0], colors[1], colorPosition(value, a, m))
        : colorMix(colors[1], colors[2], colorPosition(value, m, b));
    },
  });
}
/** Provides an allocation-independent color mapping with an authored center.
 * @param props - Explicit domain, colors, identity, and children. See {@link DivergingColorScaleProps}.
 * @returns Descendant content. */
export function DivergingColorScale(props: DivergingColorScaleProps) {
  provideColor(props.id, "diverging", () => resolve(props), [
    props.domain,
    props.colors,
  ]);
  return props.children;
}
/** Reads the dedicated ancestor diverging mapping.
 * @param id - Color-scale identity. See {@link ScaleId}.
 * @returns Shared readonly mapping signal. See {@link ResolvedDivergingColorScale}. */
export function useDivergingColorScale(
  id: ScaleId,
): Signal<ResolvedDivergingColorScale> {
  return useColor(id, "diverging");
}
