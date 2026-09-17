import {
  type CRCGLTFDocument,
  checkedAdd,
  validateGLTFDocument,
} from './schema.js';

export interface CRCDecodedGLB {
  readonly json: CRCGLTFDocument;
  readonly binaryChunk: Uint8Array | undefined;
}

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;
const HEADER_LENGTH = 12;
const CHUNK_HEADER_LENGTH = 8;

export function readGLB(bytes: ArrayBuffer): CRCDecodedGLB {
  if (!(bytes instanceof ArrayBuffer)) {
    throw new TypeError('GLB input must be an ArrayBuffer.');
  }
  if (bytes.byteLength < HEADER_LENGTH) {
    throw new RangeError(
      `GLB header requires 12 bytes; received ${bytes.byteLength}.`,
    );
  }
  const view = new DataView(bytes);
  if (view.getUint32(0, true) !== GLB_MAGIC) {
    throw new TypeError('GLB header byte 0 has invalid magic; expected glTF.');
  }
  const version = view.getUint32(4, true);
  if (version !== 2) {
    throw new TypeError(`GLB header version must be 2; received ${version}.`);
  }
  const declaredLength = view.getUint32(8, true);
  if (declaredLength !== bytes.byteLength) {
    throw new RangeError(
      `GLB header declared length ${declaredLength} does not match actual ` +
      `length ${bytes.byteLength}.`,
    );
  }

  let offset = HEADER_LENGTH;
  let chunkIndex = 0;
  let jsonBytes: Uint8Array | undefined;
  let binaryChunk: Uint8Array | undefined;
  while (offset < declaredLength) {
    const headerEnd = checkedAdd(
      offset,
      CHUNK_HEADER_LENGTH,
      `GLB chunk ${chunkIndex} header at byte ${offset}`,
    );
    if (headerEnd > declaredLength) {
      throw new RangeError(
        `GLB chunk ${chunkIndex} header at byte ${offset} is truncated.`,
      );
    }
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    if (chunkLength % 4 !== 0) {
      throw new RangeError(
        `GLB chunk ${chunkIndex} byte ${offset} length ${chunkLength} must be a multiple of 4.`,
      );
    }
    const chunkEnd = checkedAdd(
      headerEnd,
      chunkLength,
      `GLB chunk ${chunkIndex} at byte ${offset}`,
    );
    if (chunkEnd > declaredLength) {
      throw new RangeError(
        `GLB chunk ${chunkIndex} byte ${offset} exceeds declared length ${declaredLength}.`,
      );
    }
    const chunk = new Uint8Array(bytes, headerEnd, chunkLength);
    if (chunkIndex === 0 && chunkType !== JSON_CHUNK_TYPE) {
      throw new TypeError(`GLB chunk 0 byte 12: JSON chunk must be first.`);
    }
    if (chunkType === JSON_CHUNK_TYPE) {
      if (jsonBytes !== undefined) {
        throw new TypeError(`GLB chunk ${chunkIndex} byte ${offset}: duplicate JSON chunk.`);
      }
      jsonBytes = chunk.slice();
    } else if (chunkType === BIN_CHUNK_TYPE) {
      if (binaryChunk !== undefined) {
        throw new TypeError(`GLB chunk ${chunkIndex} byte ${offset}: duplicate BIN chunk.`);
      }
      binaryChunk = chunk.slice();
    }
    offset = chunkEnd;
    chunkIndex += 1;
  }
  if (jsonBytes === undefined) {
    throw new TypeError('GLB is missing its required first JSON chunk.');
  }

  let jsonText: string;
  try {
    jsonText = new TextDecoder('utf-8', { fatal: true }).decode(jsonBytes);
  } catch {
    throw new TypeError('GLB JSON chunk must contain valid UTF-8.');
  }
  if (jsonText.includes('\0')) {
    throw new TypeError('GLB JSON chunk padding must use space bytes, not zero bytes.');
  }
  for (let index = jsonBytes.byteLength - 1; index >= 0; index -= 1) {
    const byte = jsonBytes[index]!;
    if (byte === 0x20) continue;
    if (byte === 0x09 || byte === 0x0a || byte === 0x0d) {
      throw new TypeError('GLB JSON chunk padding must use only space bytes.');
    }
    break;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new TypeError('GLB JSON chunk must contain valid JSON with space padding.');
  }
  return Object.freeze({
    json: validateGLTFDocument(parsed),
    binaryChunk,
  });
}
