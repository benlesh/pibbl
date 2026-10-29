import { isSignal } from "../lib/signals/graph.js";
import type { SignalValue } from "../lib/signals/types.js";
import { layoutDiagnostic } from "../lib/style/diagnostics.js";
import {
  PIBBL_FILTER_EXECUTOR,
  type PibblFilter,
  type PibblFilterExecutor,
} from "../lib/style/filter-types.js";
import { concreteColor } from "./native-color.js";
import {
  filterBoundaryExecutor,
  type CustomPreparedFilter,
} from "./filter-executor.js";
import { processBackdropContrast } from "./render-backdrop-contrast-boundary.js";

/** Two foreground colors selected per backdrop pixel. See {@link backdropContrast}. */
export interface PibblBackdropContrastFilterOptions {
  /** Color drawn over dark backdrop pixels; defaults to white. See {@link SignalValue}. */
  readonly light?: SignalValue<string>;
  /** Color drawn over light backdrop pixels; defaults to black. See {@link SignalValue}. */
  readonly dark?: SignalValue<string>;
}
const definitions = new WeakMap<
  PibblFilter,
  Readonly<PibblBackdropContrastFilterOptions>
>();
const executor: PibblFilterExecutor = {
  prepare(value, property, context) {
    const options = definitions.get(value);
    if (!options)
      throw new Error(
        "A backdropContrast filter was created by an incompatible Pibbl runtime.",
      );
    const color = (key: "light" | "dark", fallback: string) => {
      const input = options[key];
      const value =
        input === undefined ? fallback : isSignal(input) ? input.get() : input;
      const result = concreteColor(value, `${property}.${key}`, context);
      if (typeof CSS === "undefined" || !CSS.supports("color", result))
        throw layoutDiagnostic({
          component: context.component,
          property: `${property}.${key}`,
          value,
          algorithm: context.algorithm,
          constraints: context.constraints,
          reason: "must be a supported concrete CSS color",
        });
      return result;
    };
    const light = color("light", "white"),
      dark = color("dark", "black");
    return Object.freeze({
      executor: filterBoundaryExecutor,
      needsBackdrop: true,
      reverseInfluence: (output) => ({ ...output }),
      process: (source, windows, backdrop) => {
        if (!backdrop)
          throw new Error(
            "backdropContrast requires the current Canvas backdrop.",
          );
        return processBackdropContrast(source, windows, backdrop, {
          light,
          dark,
        });
      },
    } satisfies CustomPreparedFilter);
  },
  render: filterBoundaryExecutor.render,
};
/**
 * Recolors a receiving primitive and its descendants per pixel, using their combined alpha
 * as a mask. Chooses light below relative backdrop luminance 0.179129 and dark otherwise.
 * Samples already-painted content in the current Canvas target; transparent backdrop is
 * evaluated over white. Isolated/cached layers see their own local backdrop, not outer paint.
 * Requires OffscreenCanvas and WebGL2; performs no scene pixel readback. Geometry is unchanged.
 *
 * @param options - Optional signal-capable foreground colors; white and black by default.
 * See {@link PibblBackdropContrastFilterOptions}.
 * @returns An immutable descriptor for style.filter. See {@link PibblFilter}.
 */
export function backdropContrast(
  options: PibblBackdropContrastFilterOptions = {},
): PibblFilter {
  const value = Object.freeze({ [PIBBL_FILTER_EXECUTOR]: executor });
  definitions.set(value, Object.freeze({ ...options }));
  return value;
}
