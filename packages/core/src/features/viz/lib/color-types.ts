import type { PibblNode, SignalValue } from "@pibbl/core";
import type { ScaleId } from "./types.js";
/** One authored domain/color association. @see {@link ResolvedSequentialColorScale} */
export interface ColorScaleStop {
  /** Numeric data value at the color stop. */ readonly value: number;
  /** Canonical lowercase six-digit hexadecimal sRGB color. */ readonly color: string;
}
/** Readonly continuous two-stop color mapping. @see {@link SequentialColorScaleProps} */
export interface ResolvedSequentialColorScale {
  /** Authored finite endpoints, preserving ascending or descending order. */ readonly domain: readonly [
    number,
    number,
  ];
  /** Canonical endpoint colors, in authored order. */ readonly colors: readonly [
    string,
    string,
  ];
  /** Frozen endpoint/value pairs for scale-derived annotations. */ readonly stops: readonly ColorScaleStop[];
  /** Maps finite data to a clamped color.
   * @param value - Numeric input.
   * @returns Canonical #rrggbb color. */ map(value: number): string;
}
/** Readonly continuous mapping with an explicit center. @see {@link DivergingColorScaleProps} */
export interface ResolvedDivergingColorScale {
  /** Strictly monotonic finite endpoints and center, in authored order. */ readonly domain: readonly [
    number,
    number,
    number,
  ];
  /** Canonical endpoint and center colors. */ readonly colors: readonly [
    string,
    string,
    string,
  ];
  /** Frozen endpoint/center pairs for scale-derived annotations. */ readonly stops: readonly ColorScaleStop[];
  /** Maps finite data through the authored center.
   * @param value - Numeric input.
   * @returns Canonical #rrggbb color. */ map(value: number): string;
}
/** Inputs for a dedicated sequential color provider. @see {@link ResolvedSequentialColorScale} */
export interface SequentialColorScaleProps {
  /** Identity in the color-scale namespace. See {@link ScaleId}. */ readonly id: ScaleId;
  /** Finite endpoints; equal endpoints map all finite inputs to the color midpoint. */ readonly domain: SignalValue<
    readonly [number, number]
  >;
  /** Required #RRGGBB endpoint colors. No default palette is chosen. */ readonly colors: SignalValue<
    readonly [string, string]
  >;
  /** Descendants consuming the mapping. See {@link PibblNode}. */ readonly children?: PibblNode;
}
/** Inputs for a dedicated diverging color provider. @see {@link ResolvedDivergingColorScale} */
export interface DivergingColorScaleProps {
  /** Identity in the color-scale namespace. See {@link ScaleId}. */ readonly id: ScaleId;
  /** Strictly increasing or decreasing finite endpoints and center. */ readonly domain: SignalValue<
    readonly [number, number, number]
  >;
  /** Required #RRGGBB endpoint and center colors. */ readonly colors: SignalValue<
    readonly [string, string, string]
  >;
  /** Descendants consuming the mapping. See {@link PibblNode}. */ readonly children?: PibblNode;
}
