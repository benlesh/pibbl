import * as core from '@crc/core';

const expected = [
  'Absolute',
  'Clip',
  'Flex',
  'Flow',
  'FocusManagement',
  'Fragment',
  'Grid',
  'Group',
  'HorizontalLine',
  'Image',
  'KeyboardNavigation',
  'Layer',
  'LayoutDiagnostic',
  'Line',
  'Overlay',
  'Path',
  'Rectangle',
  'SvgPath',
  'Text',
  'VerticalLine',
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
const enhanced = core.createElement(core.FocusManagement, {
  children: core.createElement(core.KeyboardNavigation, {
    mode: 'directional',
    children: element,
  }),
});
if (
  enhanced.type !== core.FocusManagement ||
  enhanced.props.children.type !== core.KeyboardNavigation ||
  enhanced.props.children.props.children !== element
) {
  throw new Error('Focus policy descriptors did not retain their exact child.');
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
