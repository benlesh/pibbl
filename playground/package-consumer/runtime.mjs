import * as core from '@crc/core';

const expected = [
  'LayoutDiagnostic',
  'absolute',
  'clip',
  'crc',
  'crcCursor',
  'crcEvent',
  'crcEventListener',
  'crcEventTarget',
  'crcLayoutBox',
  'crcLinePath',
  'crcMemo',
  'crcRectPath',
  'crcRef',
  'crcState',
  'crcSvgPath',
  'crcWhenChanged',
  'defineComp',
  'flex',
  'flow',
  'g',
  'grid',
  'horizontalLine',
  'img',
  'layer',
  'layoutDiagnostic',
  'line',
  'measureElement',
  'normalizeEdges',
  'overlay',
  'path',
  'rect',
  'resolveBox',
  'resolveLength',
  'svgPath',
  'text',
  'verticalLine',
];

const actual = Object.keys(core).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`Unexpected @crc/core exports: ${actual.join(', ')}`);
}
for (const exportName of expected) {
  if (typeof core[exportName] !== 'function') {
    throw new Error(`Expected @crc/core ${exportName} to be a runtime function.`);
  }
}

for (const specifier of [
  '@crc/core/lib/crc',
  '@crc/core/src/index',
]) {
  try {
    await import(specifier);
    throw new Error(`Expected ${specifier} to be blocked by the export map`);
  } catch (error) {
    if (error?.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
      throw error;
    }
  }
}
