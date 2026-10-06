import { resolveSignalValue, type Signal } from "@pibbl/core";
import type {
  SequentialColorScaleProps,
  ResolvedSequentialColorScale,
} from "./color-types.js";
import type { ScaleId } from "./types.js";
import { provideColor, useColor } from "./color-context.js";
import {
  colorMix,
  colorPosition,
  finiteColorValue,
  hexColor,
} from "./color-math.js";
function resolve(
  props: SequentialColorScaleProps,
): ResolvedSequentialColorScale {
  const input = resolveSignalValue(props.domain),
    paint = resolveSignalValue(props.colors);
  if (
    !Array.isArray(input) ||
    input.length !== 2 ||
    !Array.isArray(paint) ||
    paint.length !== 2
  )
    throw new RangeError(
      "Sequential color scales require two domain endpoints and two colors.",
    );
  const domain = Object.freeze(
      Array.from(input, finiteColorValue),
    ) as readonly [number, number],
    colors = Object.freeze(Array.from(paint, hexColor)) as readonly [
      string,
      string,
    ];
  const stops = Object.freeze(
    domain.map((value, i) => Object.freeze({ value, color: colors[i] })),
  );
  return Object.freeze({
    domain,
    colors,
    stops,
    map(value: number) {
      finiteColorValue(value);
      return colorMix(
        colors[0],
        colors[1],
        colorPosition(value, domain[0], domain[1]),
      );
    },
  });
}
/** Provides an allocation-independent sequential color mapping.
 * @param props - Explicit domain, colors, identity, and children. See {@link SequentialColorScaleProps}.
 * @returns Descendant content. */
export function SequentialColorScale(props: SequentialColorScaleProps) {
  provideColor(props.id, "sequential", () => resolve(props), [
    props.domain,
    props.colors,
  ]);
  return props.children;
}
/** Reads the dedicated ancestor sequential mapping.
 * @param id - Color-scale identity. See {@link ScaleId}.
 * @returns Shared readonly mapping signal. See {@link ResolvedSequentialColorScale}. */
export function useSequentialColorScale(
  id: ScaleId,
): Signal<ResolvedSequentialColorScale> {
  return useColor(id, "sequential");
}
