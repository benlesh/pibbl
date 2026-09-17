export interface CRCGLTFObject {
  readonly [key: string]: unknown;
}

export interface CRCGLTFDocument extends CRCGLTFObject {
  readonly asset: CRCGLTFObject;
}

export function validateGLTFDocument(value: unknown): CRCGLTFDocument {
  const document = requireObject(value, '$');
  const asset = requireObject(document.asset, '$.asset');
  if (asset.version !== '2.0') {
    throw new TypeError('GLB JSON $.asset.version must be "2.0".');
  }
  return document as CRCGLTFDocument;
}

export function requireObject(value: unknown, path: string): CRCGLTFObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`GLB JSON ${path} must be an object.`);
  }
  return value as CRCGLTFObject;
}

export function requireArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`GLB JSON ${path} must be an array.`);
  }
  return value;
}

export function optionalArray(
  object: CRCGLTFObject,
  field: string,
  path: string,
): readonly unknown[] | undefined {
  const value = object[field];
  return value === undefined ? undefined : requireArray(value, `${path}.${field}`);
}

export function requireIndex(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new TypeError(
      `GLB JSON ${path} must be a nonnegative safe integer index.`,
    );
  }
  return value as number;
}

export function requireNonnegativeInteger(
  value: unknown,
  path: string,
): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new TypeError(
      `GLB JSON ${path} must be a nonnegative safe integer.`,
    );
  }
  return value as number;
}

export function optionalNonnegativeInteger(
  value: unknown,
  path: string,
  fallback: number,
): number {
  return value === undefined ? fallback : requireNonnegativeInteger(value, path);
}

export function requireFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`GLB JSON ${path} must be finite.`);
  }
  return value;
}

export function requireFiniteTuple(
  value: unknown,
  length: number,
  path: string,
): readonly number[] {
  const values = requireArray(value, path);
  if (values.length !== length) {
    throw new TypeError(`GLB JSON ${path} must contain ${length} values.`);
  }
  return values.map((entry, index) =>
    requireFiniteNumber(entry, `${path}[${index}]`));
}

export function checkedAdd(left: number, right: number, context: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new RangeError(`${context} overflows safe integer arithmetic.`);
  }
  return result;
}

export function checkedMultiply(
  left: number,
  right: number,
  context: string,
): number {
  const result = left * right;
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new RangeError(`${context} overflows safe integer arithmetic.`);
  }
  return result;
}

export function validateBinaryChunkPadding(
  binaryChunk: Uint8Array,
  bufferByteLength: number,
): void {
  if (binaryChunk.byteLength < bufferByteLength ||
    binaryChunk.byteLength > checkedAdd(
      bufferByteLength,
      3,
      'GLB JSON $.buffers[0].byteLength',
    )) {
    throw new RangeError(
      `GLB BIN chunk length ${binaryChunk.byteLength} must match ` +
      `$.buffers[0].byteLength ${bufferByteLength} with at most 3 padding bytes.`,
    );
  }
  for (let index = bufferByteLength; index < binaryChunk.byteLength; index += 1) {
    if (binaryChunk[index] !== 0) {
      throw new TypeError(`GLB BIN chunk padding byte ${index} must be zero.`);
    }
  }
}

export function own(object: CRCGLTFObject, field: string): boolean {
  return Object.hasOwn(object, field);
}
