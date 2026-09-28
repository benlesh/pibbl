export function width(value: number, receiver: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw new RangeError(
      `${receiver}: stroke/interaction width must be finite and nonnegative.`,
    );
  return value;
}
export function opacity(value: number, receiver: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  )
    throw new RangeError(`${receiver}: opacity must be between 0 and 1.`);
  return value;
}
