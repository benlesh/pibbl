import { checkedAdd, checkedMultiply } from './schema.js';

export const GLTF_DECODE_LIMITS = Object.freeze({
  glbBytes: 256 * 1024 * 1024,
  numericAttributeBytes: 512 * 1024 * 1024,
  selectedPrimitiveInstances: 100_000,
  uniqueDecodedVertices: 20_000_000,
  normalValidationVertices: 50_000_000,
  encodedImageBytes: 64 * 1024 * 1024,
  imageDimension: 16_384,
  decodedImagePixels: 64 * 1024 * 1024,
});

export function assertGLBByteLength(byteLength: number): void {
  if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
    throw new RangeError(`GLB byteLength ${byteLength} must be a nonnegative safe integer.`);
  }
  if (byteLength > GLTF_DECODE_LIMITS.glbBytes) {
    throw new RangeError(
      `GLB byteLength ${byteLength} exceeds limit ${GLTF_DECODE_LIMITS.glbBytes}.`,
    );
  }
}

export function assertEncodedImageByteLength(byteLength: number, path: string): void {
  if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
    throw new RangeError(`${path} encoded byteLength must be a nonnegative safe integer.`);
  }
  if (byteLength > GLTF_DECODE_LIMITS.encodedImageBytes) {
    throw new RangeError(
      `${path} encoded byteLength ${byteLength} exceeds limit ` +
      `${GLTF_DECODE_LIMITS.encodedImageBytes}.`,
    );
  }
}

export function assertImageDimensions(
  width: number,
  height: number,
  path: string,
  phase: 'encoded' | 'decoded',
): void {
  for (const [name, value] of [['width', width], ['height', height]] as const) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new RangeError(`${path} ${phase} ${name} must be a positive safe integer.`);
    }
    if (value > GLTF_DECODE_LIMITS.imageDimension) {
      throw new RangeError(
        `${path} ${phase} ${name} ${value} exceeds limit ` +
        `${GLTF_DECODE_LIMITS.imageDimension}.`,
      );
    }
  }
}

export class GLTFDecodeBudget {
  numericAttributeBytes = 0;
  selectedPrimitiveInstances = 0;
  uniqueDecodedVertices = 0;
  normalValidationVertices = 0;
  decodedImagePixels = 0;
  readonly #normalValidationVerticesLimit: number;

  constructor(options: Readonly<{
    normalValidationVertices?: number;
  }> = {}) {
    const limit = options.normalValidationVertices ??
      GLTF_DECODE_LIMITS.normalValidationVertices;
    if (!Number.isSafeInteger(limit) || limit < 0) {
      throw new RangeError(
        'normal validation vertex limit must be a nonnegative safe integer.',
      );
    }
    this.#normalValidationVerticesLimit = limit;
  }

  reserveNumericAttributeBytes(amount: number, path: string): void {
    this.numericAttributeBytes = reserve(
      this.numericAttributeBytes,
      amount,
      GLTF_DECODE_LIMITS.numericAttributeBytes,
      path,
      'numeric attribute bytes',
    );
  }

  reserveSelectedPrimitiveInstances(amount: number, path: string): void {
    this.selectedPrimitiveInstances = reserve(
      this.selectedPrimitiveInstances,
      amount,
      GLTF_DECODE_LIMITS.selectedPrimitiveInstances,
      path,
      'selected primitive instances',
    );
  }

  reserveUniqueDecodedVertices(amount: number, path: string): void {
    this.uniqueDecodedVertices = reserve(
      this.uniqueDecodedVertices,
      amount,
      GLTF_DECODE_LIMITS.uniqueDecodedVertices,
      path,
      'unique decoded vertices',
    );
  }

  reserveNormalValidationVertices(amount: number, path: string): void {
    this.normalValidationVertices = reserve(
      this.normalValidationVertices,
      amount,
      this.#normalValidationVerticesLimit,
      path,
      'normal validation vertices',
    );
  }

  reserveDecodedImagePixels(width: number, height: number, path: string): void {
    const amount = checkedMultiply(width, height, `${path} decoded image pixels`);
    this.decodedImagePixels = reserve(
      this.decodedImagePixels,
      amount,
      GLTF_DECODE_LIMITS.decodedImagePixels,
      path,
      'decoded image pixels',
    );
  }
}

function reserve(
  current: number,
  amount: number,
  limit: number,
  path: string,
  label: string,
): number {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new RangeError(`${path} ${label} reservation must be a nonnegative safe integer.`);
  }
  const next = checkedAdd(current, amount, `${path} cumulative ${label}`);
  if (next > limit) {
    throw new RangeError(`${path} cumulative ${label} ${next} exceeds limit ${limit}.`);
  }
  return next;
}
