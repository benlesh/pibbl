export function requireFiniteNumber(value: number, path: string): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(
      `${path} must be a finite number; received ${String(value)}.`,
    );
  }
  return value;
}

export function requirePositiveNumber(value: number, path: string): number {
  requireFiniteNumber(value, path);
  if (value <= 0) {
    throw new RangeError(
      `${path} must be greater than zero; received ${String(value)}.`,
    );
  }
  return value;
}

export function requireNonnegativeNumber(value: number, path: string): number {
  requireFiniteNumber(value, path);
  if (value < 0) {
    throw new RangeError(
      `${path} must be nonnegative; received ${String(value)}.`,
    );
  }
  return value;
}

export function requireSafeIntegerInRange(
  value: number,
  minimum: number,
  maximum: number,
  path: string,
): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(
      `${path} must be a safe integer from ${minimum} through ${maximum}; ` +
      `received ${String(value)}.`,
    );
  }
  return value;
}

export function copyFiniteVector2(
  value: readonly [x: number, y: number],
  path: string,
): readonly [x: number, y: number] {
  return Object.freeze([
    requireFiniteNumber(value[0], `${path}[0]`),
    requireFiniteNumber(value[1], `${path}[1]`),
  ] as const);
}
