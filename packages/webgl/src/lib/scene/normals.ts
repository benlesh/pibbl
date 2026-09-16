const NORMAL_MATRIX_COMPONENT_COUNT = 9;

/**
 * Extracts an affine model matrix's inverse transpose and removes its common
 * magnitude before the result crosses the Float32 renderer boundary.
 */
export function createSettledNormalMatrix(
  model: ArrayLike<number>,
): Float32Array {
  const a00 = model[0]!;
  const a01 = model[4]!;
  const a02 = model[8]!;
  const a10 = model[1]!;
  const a11 = model[5]!;
  const a12 = model[9]!;
  const a20 = model[2]!;
  const a21 = model[6]!;
  const a22 = model[10]!;
  const values = [a00, a01, a02, a10, a11, a12, a20, a21, a22];
  if (values.some(value => !Number.isFinite(value))) {
    throw new RangeError('lit normal matrix must be finite.');
  }

  // The cofactor matrix is the inverse transpose multiplied by determinant.
  // Compute it in row order so the determinant expansion remains explicit.
  const cofactors = [
    a11 * a22 - a12 * a21,
    a12 * a20 - a10 * a22,
    a10 * a21 - a11 * a20,
    a02 * a21 - a01 * a22,
    a00 * a22 - a02 * a20,
    a01 * a20 - a00 * a21,
    a01 * a12 - a02 * a11,
    a02 * a10 - a00 * a12,
    a00 * a11 - a01 * a10,
  ] as const;
  if (cofactors.some(value => !Number.isFinite(value))) {
    throw new RangeError('lit normal matrix must be finite.');
  }
  const determinant =
    a00 * cofactors[0] + a01 * cofactors[1] + a02 * cofactors[2];
  if (!Number.isFinite(determinant)) {
    throw new RangeError('lit normal matrix must be finite.');
  }
  if (determinant === 0) {
    throw new RangeError('lit normal matrix must be invertible.');
  }

  const maximumComponent = Math.max(...cofactors.map(Math.abs));
  if (!Number.isFinite(maximumComponent) || maximumComponent === 0) {
    throw new RangeError('lit normal matrix must be invertible.');
  }
  const determinantSign = Math.sign(determinant);
  const columnMajorOrder = [0, 3, 6, 1, 4, 7, 2, 5, 8] as const;
  const settled = new Float32Array(NORMAL_MATRIX_COMPONENT_COUNT);
  for (let index = 0; index < NORMAL_MATRIX_COMPONENT_COUNT; index += 1) {
    const value = Math.fround(
      cofactors[columnMajorOrder[index]!]! /
        maximumComponent * determinantSign,
    );
    if (!Number.isFinite(value)) {
      throw new RangeError(
        'lit normal matrix must be representable as finite Float32 values.',
      );
    }
    settled[index] = Object.is(value, -0) ? 0 : value;
  }
  return settled;
}

/**
 * Proves a settled matrix can transform every supplied normal using the same
 * ordered Float32 operations as the Lambert vertex shader.
 */
export function validateSettledNormalPair(
  normals: Readonly<Float32Array>,
  normalMatrix: Readonly<Float32Array>,
): void {
  for (let index = 0; index < normals.length; index += 3) {
    const normalized = safeNormalizeFloat32(
      normals[index]!,
      normals[index + 1]!,
      normals[index + 2]!,
    );
    if (normalized === undefined) {
      throwInvalidNormalTransform(index);
    }
    const transformedX = addFloat32(
      addFloat32(
        multiplyFloat32(normalMatrix[0]!, normalized![0]),
        multiplyFloat32(normalMatrix[3]!, normalized![1]),
      ),
      multiplyFloat32(normalMatrix[6]!, normalized![2]),
    );
    const transformedY = addFloat32(
      addFloat32(
        multiplyFloat32(normalMatrix[1]!, normalized![0]),
        multiplyFloat32(normalMatrix[4]!, normalized![1]),
      ),
      multiplyFloat32(normalMatrix[7]!, normalized![2]),
    );
    const transformedZ = addFloat32(
      addFloat32(
        multiplyFloat32(normalMatrix[2]!, normalized![0]),
        multiplyFloat32(normalMatrix[5]!, normalized![1]),
      ),
      multiplyFloat32(normalMatrix[8]!, normalized![2]),
    );
    if (safeNormalizeFloat32(
      transformedX,
      transformedY,
      transformedZ,
    ) === undefined) {
      throwInvalidNormalTransform(index);
    }
  }
}

function safeNormalizeFloat32(
  x: number,
  y: number,
  z: number,
): readonly [number, number, number] | undefined {
  const floatX = Math.fround(x);
  const floatY = Math.fround(y);
  const floatZ = Math.fround(z);
  if (!Number.isFinite(floatX) ||
    !Number.isFinite(floatY) ||
    !Number.isFinite(floatZ)) return undefined;
  const maximumComponent = Math.max(
    Math.abs(floatX),
    Math.abs(floatY),
    Math.abs(floatZ),
  );
  if (!Number.isFinite(maximumComponent) || maximumComponent === 0) {
    return undefined;
  }
  const scaledX = Math.fround(floatX / maximumComponent);
  const scaledY = Math.fround(floatY / maximumComponent);
  const scaledZ = Math.fround(floatZ / maximumComponent);
  const lengthSquared = addFloat32(
    addFloat32(
      multiplyFloat32(scaledX, scaledX),
      multiplyFloat32(scaledY, scaledY),
    ),
    multiplyFloat32(scaledZ, scaledZ),
  );
  if (!Number.isFinite(lengthSquared) || lengthSquared === 0) {
    return undefined;
  }
  const inverseLength = Math.fround(1 / Math.sqrt(lengthSquared));
  const normalized = [
    multiplyFloat32(scaledX, inverseLength),
    multiplyFloat32(scaledY, inverseLength),
    multiplyFloat32(scaledZ, inverseLength),
  ] as const;
  return normalized.every(Number.isFinite) &&
      normalized.some(value => value !== 0) ? normalized : undefined;
}

function addFloat32(left: number, right: number): number {
  return Math.fround(left + right);
}

function multiplyFloat32(left: number, right: number): number {
  return Math.fround(left * right);
}

function throwInvalidNormalTransform(index: number): never {
  throw new RangeError(
    'lit normal matrix must transform every geometry normal into a finite ' +
    `nonzero Float32 direction; normal ${index / 3} is not representable.`,
  );
}
