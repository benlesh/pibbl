export function finiteColorValue(value: number): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new RangeError("Color scale values must be finite numbers.");
  return value;
}
export function hexColor(color: string): string {
  if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color))
    throw new TypeError("Color scales require #RRGGBB colors.");
  return color.toLowerCase();
}
export function colorMix(a: string, b: string, t: number): string {
  return (
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.round(
          parseInt(a.slice(i, i + 2), 16) * (1 - t) +
            parseInt(b.slice(i, i + 2), 16) * t,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export function colorPosition(value: number, a: number, b: number): number {
  if (a === b) return 0.5;
  if ((a < b && value <= a) || (a > b && value >= a)) return 0;
  if ((a < b && value >= b) || (a > b && value <= b)) return 1;
  const span = b - a;
  return Number.isFinite(span)
    ? (value - a) / span
    : (value / 2 - a / 2) / (b / 2 - a / 2);
}
