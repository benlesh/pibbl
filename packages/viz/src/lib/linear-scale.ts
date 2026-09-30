import type {
  LinearDomain,
  ResolvedLinearScale,
  ResolvedScale,
  ScaleRange,
} from "./types.js";
function finite(value: number, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new RangeError(`Scale ${field} must be finite.`);
  return value;
}
function pair(
  value: readonly number[],
  field: string,
): readonly [number, number] {
  if (!Array.isArray(value) || value.length !== 2)
    throw new RangeError(`Scale ${field} requires two finite endpoints.`);
  return Object.freeze([finite(value[0], field), finite(value[1], field)]);
}
export function resolveLinearScale(
  domainInput: LinearDomain,
  rangeInput: ScaleRange,
  reverse: boolean,
  width: number,
  height: number,
): ResolvedLinearScale {
  finite(width, "frame.width");
  finite(height, "frame.height");
  if (width < 0 || height < 0)
    throw new RangeError("Scale allocation must be nonnegative.");
  if (typeof reverse !== "boolean")
    throw new TypeError("Scale reverse must be boolean.");
  const domain = pair(domainInput, "domain");
  if (domain[0] === domain[1])
    throw new RangeError("Scale domain endpoints must differ.");
  const original = pair(
    rangeInput === "width"
      ? [0, width]
      : rangeInput === "height"
        ? [0, height]
        : (rangeInput as readonly number[]),
    "range",
  );
  const range = reverse ? pair([original[1], original[0]], "range") : original;
  const domainSpan = finite(domain[1] - domain[0], "domain span");
  const rangeSpan = finite(range[1] - range[0], "range span");
  return Object.freeze({
    type: "linear",
    domain,
    range,
    frame: Object.freeze({ x: 0, y: 0, width, height }),
    map(value: number) {
      return finite(
        range[0] +
          ((finite(value, "map input") - domain[0]) / domainSpan) * rangeSpan,
        "mapped output",
      );
    },
    invert(pixel: number) {
      if (rangeSpan === 0)
        throw new RangeError(
          "Scale cannot invert a collapsed range; supply a nonzero extent.",
        );
      return finite(
        domain[0] +
          ((finite(pixel, "invert input") - range[0]) / rangeSpan) * domainSpan,
        "inverted output",
      );
    },
    ticks(count = 5) {
      if (!Number.isInteger(count) || count < 2 || count > 100)
        throw new RangeError(
          "Scale ticks count must be an integer from 2 to 100.",
        );
      return Object.freeze(
        Array.from({ length: count }, (_, i) =>
          i === count - 1
            ? domain[1]
            : finite(domain[0] + (domainSpan * i) / (count - 1), "tick"),
        ),
      );
    },
  });
}
export function equalScale(a: ResolvedScale, b: ResolvedScale): boolean {
  return (
    a.type === b.type &&
    a.domain.length === b.domain.length &&
    a.domain.every((value, index) => Object.is(value, b.domain[index])) &&
    (a.type !== "band" ||
      (b.type === "band" &&
        a.bandwidth === b.bandwidth &&
        a.step === b.step)) &&
    Object.is(a.range[0], b.range[0]) &&
    Object.is(a.range[1], b.range[1]) &&
    Object.is(a.frame.width, b.frame.width) &&
    Object.is(a.frame.height, b.frame.height)
  );
}
