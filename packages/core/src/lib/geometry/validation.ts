export type GeometryErrorFactory = (
  property: string,
  value: unknown,
  reason: string,
) => Error;

export function pathRangeError(
  property: string,
  value: unknown,
  reason: string,
): RangeError {
  return new RangeError(`${property} ${reason}; received ${String(value)}`);
}

export function finiteNumber(
  value: unknown,
  property: string,
  errorFactory: GeometryErrorFactory = pathRangeError,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw errorFactory(property, value, 'must be a finite number');
  }
  return value;
}

export function nonnegativeNumber(
  value: unknown,
  property: string,
  errorFactory: GeometryErrorFactory = pathRangeError,
): number {
  const number = finiteNumber(value, property, errorFactory);
  if (number < 0) {
    throw errorFactory(property, value, 'must be nonnegative');
  }
  return number;
}

export function integerAtLeast(
  value: unknown,
  minimum: number,
  property: string,
  errorFactory: GeometryErrorFactory = pathRangeError,
): number {
  const number = finiteNumber(value, property, errorFactory);
  if (!Number.isInteger(number)) {
    throw errorFactory(property, value, 'must be an integer');
  }
  if (number < minimum) {
    throw errorFactory(property, value, `must be at least ${minimum}`);
  }
  return number;
}

export function validateCoordinates(
  coords: readonly (readonly [number, number])[],
  property = 'coords',
  errorFactory: GeometryErrorFactory = pathRangeError,
): readonly (readonly [number, number])[] {
  for (let index = 0; index < coords.length; index++) {
    const [x, y] = coords[index];
    finiteNumber(x, `${property}[${index}][0]`, errorFactory);
    finiteNumber(y, `${property}[${index}][1]`, errorFactory);
  }
  return coords;
}
