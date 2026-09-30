/** Convert a finite degree angle to radians. */
export function degrees(value: number): number {
  if (!Number.isFinite(value))
    throw new Error("degrees requires a finite angle.");
  return value * (Math.PI / 180);
}
