import { point, type ElectricPoint } from "./electric-shared.js";

/** One simple closed polygon, supplied in texture coordinates. */
export function boundary(
  input?: readonly ElectricPoint[],
): ElectricPoint[] | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input) || input.length < 3 || input.length > 256)
    throw new RangeError("Tendril boundary requires 3..256 points.");
  return input.map(point);
}
