import {
  type CRCGLTFDocument,
  checkedAdd,
  checkedMultiply,
  optionalNonnegativeInteger,
  requireArray,
  requireIndex,
  requireNonnegativeInteger,
  requireObject,
  validateBinaryChunkPadding,
} from './schema.js';

export type CRCGLTFAccessorUsage =
  | 'POSITION'
  | 'NORMAL'
  | 'TANGENT'
  | 'TEXCOORD_0'
  | 'indices';

interface ComponentInfo {
  readonly bytes: number;
  readonly read: (view: DataView, offset: number) => number;
  readonly normalize?: (value: number) => number;
  readonly integer: boolean;
  readonly unsigned: boolean;
}

const COMPONENTS: Readonly<Record<number, ComponentInfo>> = Object.freeze({
  5120: {
    bytes: 1,
    read: (view, offset) => view.getInt8(offset),
    normalize: value => Math.max(value / 127, -1),
    integer: true,
    unsigned: false,
  },
  5121: {
    bytes: 1,
    read: (view, offset) => view.getUint8(offset),
    normalize: value => value / 255,
    integer: true,
    unsigned: true,
  },
  5122: {
    bytes: 2,
    read: (view, offset) => view.getInt16(offset, true),
    normalize: value => Math.max(value / 32767, -1),
    integer: true,
    unsigned: false,
  },
  5123: {
    bytes: 2,
    read: (view, offset) => view.getUint16(offset, true),
    normalize: value => value / 65535,
    integer: true,
    unsigned: true,
  },
  5125: {
    bytes: 4,
    read: (view, offset) => view.getUint32(offset, true),
    normalize: value => value / 4294967295,
    integer: true,
    unsigned: true,
  },
  5126: {
    bytes: 4,
    read: (view, offset) => view.getFloat32(offset, true),
    integer: false,
    unsigned: false,
  },
});

const ARITIES: Readonly<Record<string, number>> = Object.freeze({
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
});

export function decodeGLTFAccessor(
  document: CRCGLTFDocument,
  binaryChunk: Uint8Array | undefined,
  accessorIndex: number,
  usage: CRCGLTFAccessorUsage,
): Float32Array | Uint32Array {
  const accessors = requireArray(document.accessors, '$.accessors');
  const accessorPath = `$.accessors[${accessorIndex}]`;
  if (!Number.isSafeInteger(accessorIndex) || accessorIndex < 0 ||
    accessorIndex >= accessors.length) {
    throw new RangeError(`${accessorPath} is out of bounds.`);
  }
  const accessor = requireObject(accessors[accessorIndex], accessorPath);
  if (accessor.sparse !== undefined) {
    throw new TypeError(`${accessorPath}.sparse is unsupported in static GLB assets.`);
  }
  const bufferViewIndex = requireIndex(
    accessor.bufferView,
    `${accessorPath}.bufferView`,
  );
  const views = requireArray(document.bufferViews, '$.bufferViews');
  const viewPath = `$.bufferViews[${bufferViewIndex}]`;
  if (bufferViewIndex >= views.length) {
    throw new RangeError(`${accessorPath}.bufferView references missing ${viewPath}.`);
  }
  const bufferView = requireObject(views[bufferViewIndex], viewPath);
  const bufferIndex = requireIndex(bufferView.buffer, `${viewPath}.buffer`);
  if (bufferIndex !== 0) {
    throw new TypeError(`${viewPath}.buffer must reference the only buffer 0.`);
  }

  const buffers = requireArray(document.buffers, '$.buffers');
  if (buffers.length === 0) {
    throw new RangeError('GLB JSON $.buffers[0] is required for accessor data.');
  }
  const buffer = requireObject(buffers[0], '$.buffers[0]');
  if (buffer.uri !== undefined) {
    throw new TypeError('GLB JSON $.buffers[0].uri external buffers are unsupported.');
  }
  const bufferByteLength = requireNonnegativeInteger(
    buffer.byteLength,
    '$.buffers[0].byteLength',
  );
  if (binaryChunk === undefined) {
    throw new TypeError('GLB JSON $.buffers[0] requires a GLB BIN chunk.');
  }
  validateBinaryChunkPadding(binaryChunk, bufferByteLength);

  const viewOffset = optionalNonnegativeInteger(
    bufferView.byteOffset,
    `${viewPath}.byteOffset`,
    0,
  );
  const viewLength = requireNonnegativeInteger(
    bufferView.byteLength,
    `${viewPath}.byteLength`,
  );
  const viewEnd = checkedAdd(viewOffset, viewLength, viewPath);
  if (viewEnd > bufferByteLength) {
    throw new RangeError(
      `GLB JSON ${viewPath} byte range ${viewOffset}..${viewEnd} exceeds ` +
      `$.buffers[0].byteLength ${bufferByteLength}.`,
    );
  }

  const componentType = requireNonnegativeInteger(
    accessor.componentType,
    `${accessorPath}.componentType`,
  );
  const component = COMPONENTS[componentType];
  if (component === undefined) {
    throw new TypeError(
      `GLB JSON ${accessorPath}.componentType ${componentType} is unsupported.`,
    );
  }
  const expectedType = expectedAccessorType(usage);
  if (accessor.type !== expectedType) {
    throw new TypeError(
      `GLB JSON ${accessorPath}.type must be ${expectedType} for ${usage}.`,
    );
  }
  const arity = ARITIES[expectedType]!;
  const normalized = validateComponentType(
    usage,
    componentType,
    component,
    accessor.normalized,
    accessorPath,
  );
  const count = requireNonnegativeInteger(accessor.count, `${accessorPath}.count`);
  if (count === 0) {
    throw new RangeError(`GLB JSON ${accessorPath}.count must be positive.`);
  }
  const accessorOffset = optionalNonnegativeInteger(
    accessor.byteOffset,
    `${accessorPath}.byteOffset`,
    0,
  );
  if (viewOffset % component.bytes !== 0) {
    throw new RangeError(
      `GLB JSON ${viewPath}.byteOffset must be aligned to ` +
      `${component.bytes}-byte components.`,
    );
  }
  if (accessorOffset % component.bytes !== 0) {
    throw new RangeError(
      `GLB JSON ${accessorPath}.byteOffset must keep the accessor aligned to ` +
      `${component.bytes}-byte components.`,
    );
  }
  const absoluteOffset = checkedAdd(
    viewOffset,
    accessorOffset,
    `${accessorPath}.byteOffset`,
  );
  const elementSize = checkedMultiply(
    component.bytes,
    arity,
    `${accessorPath} element size`,
  );
  const stride = bufferView.byteStride === undefined ? elementSize :
    requireNonnegativeInteger(bufferView.byteStride, `${viewPath}.byteStride`);
  if (bufferView.byteStride !== undefined) {
    if (usage === 'indices') {
      throw new TypeError(`${viewPath}.byteStride is unsupported for indices.`);
    }
    if (stride < 4 || stride > 252) {
      throw new RangeError(`${viewPath}.byteStride must be between 4 and 252.`);
    }
    if (stride % component.bytes !== 0) {
      throw new RangeError(
        `${viewPath}.byteStride must be a multiple of component size ${component.bytes}.`,
      );
    }
    if (stride % 4 !== 0) {
      throw new RangeError(`${viewPath}.byteStride must be a multiple of 4 bytes.`);
    }
    if (stride < elementSize) {
      throw new RangeError(
        `${viewPath}.byteStride must be at least element size ${elementSize}.`,
      );
    }
  }
  const occupiedLength = count === 0 ? 0 : checkedAdd(
    checkedMultiply(count - 1, stride, `${accessorPath}.count and byteStride`),
    elementSize,
    `${accessorPath} occupied byte length`,
  );
  const accessorEnd = checkedAdd(
    accessorOffset,
    occupiedLength,
    `${accessorPath} byte range`,
  );
  if (accessorEnd > viewLength) {
    throw new RangeError(
      `GLB JSON ${accessorPath} requires bytes ${accessorOffset}..${accessorEnd} ` +
      `inside ${viewPath} byteLength ${viewLength}.`,
    );
  }

  const outputLength = checkedMultiply(count, arity, `${accessorPath}.count`);
  const output = usage === 'indices' ?
    new Uint32Array(outputLength) : new Float32Array(outputLength);
  const data = new DataView(
    binaryChunk.buffer,
    binaryChunk.byteOffset,
    binaryChunk.byteLength,
  );
  let outputIndex = 0;
  for (let elementIndex = 0; elementIndex < count; elementIndex += 1) {
    const elementOffset = checkedAdd(
      absoluteOffset,
      checkedMultiply(elementIndex, stride, `${accessorPath}[${elementIndex}]`),
      `${accessorPath}[${elementIndex}]`,
    );
    for (let componentIndex = 0; componentIndex < arity; componentIndex += 1) {
      const byteOffset = checkedAdd(
        elementOffset,
        componentIndex * component.bytes,
        `${accessorPath}[${elementIndex}] component ${componentIndex}`,
      );
      const raw = component.read(data, byteOffset);
      const value = normalized ? component.normalize!(raw) : raw;
      if (!Number.isFinite(value)) {
        throw new TypeError(
          `GLB JSON ${accessorPath} element ${elementIndex} component ` +
          `${componentIndex} must decode to a finite value.`,
        );
      }
      output[outputIndex] = value;
      outputIndex += 1;
    }
  }
  return output;
}

function expectedAccessorType(usage: CRCGLTFAccessorUsage): string {
  switch (usage) {
    case 'POSITION':
    case 'NORMAL':
      return 'VEC3';
    case 'TANGENT':
      return 'VEC4';
    case 'TEXCOORD_0':
      return 'VEC2';
    case 'indices':
      return 'SCALAR';
  }
}

function validateComponentType(
  usage: CRCGLTFAccessorUsage,
  componentType: number,
  component: ComponentInfo,
  normalizedValue: unknown,
  accessorPath: string,
): boolean {
  if (normalizedValue !== undefined && typeof normalizedValue !== 'boolean') {
    throw new TypeError(`GLB JSON ${accessorPath}.normalized must be boolean.`);
  }
  const normalized = normalizedValue === true;
  if (usage === 'indices') {
    if (!component.integer || !component.unsigned ||
      ![5121, 5123, 5125].includes(componentType)) {
      throw new TypeError(
        `GLB JSON ${accessorPath}.componentType must be unsigned BYTE, ` +
        'UNSIGNED_SHORT, or UNSIGNED_INT for indices.',
      );
    }
    if (normalized) {
      throw new TypeError(`GLB JSON ${accessorPath}.normalized must be false for indices.`);
    }
    return false;
  }
  if (usage === 'POSITION') {
    if (componentType !== 5126) {
      throw new TypeError(
        `GLB JSON ${accessorPath}.componentType must be FLOAT for POSITION.`,
      );
    }
    if (normalized) {
      throw new TypeError(
        `GLB JSON ${accessorPath}.normalized is invalid for FLOAT POSITION data.`,
      );
    }
    return false;
  }
  const integerTypes = usage === 'TEXCOORD_0' ? [5121, 5123] : [5120, 5122];
  if (componentType === 5126) {
    if (normalized) {
      throw new TypeError(
        `GLB JSON ${accessorPath}.normalized is invalid for FLOAT ${usage} data.`,
      );
    }
    return false;
  }
  if (!integerTypes.includes(componentType)) {
    throw new TypeError(
      `GLB JSON ${accessorPath}.componentType is unsupported for ${usage}.`,
    );
  }
  if (!normalized) {
    throw new TypeError(
      `GLB JSON ${accessorPath}.normalized must be true for integer ${usage} data.`,
    );
  }
  return true;
}
