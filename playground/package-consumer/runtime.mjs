import * as core from '@crc/core';

const expected = [
  'Fragment',
  'Group',
  'LayoutDiagnostic',
  'Rectangle',
  'Text',
  'absolute',
  'clip',
  'crc',
  'crcCanvasContext',
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
  'createElement',
  'defineComp',
  'definePrimitive',
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
  'withFocusManagement',
  'withKeyboardNavigation',
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

const style = { width: 1, height: 1 };
const element = core.rect({ key: 'runtime-focus-probe', style });
const enhanced = core.withFocusManagement(
  core.withKeyboardNavigation(element, { mode: 'directional' }),
);
if (
  enhanced.type !== element.type ||
  enhanced.props !== element.props ||
  enhanced.style !== style ||
  enhanced.key !== element.key
) {
  throw new Error('Focus enhancers changed CRC element identity fields.');
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
