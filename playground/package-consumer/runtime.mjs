import * as core from '@crc/core';
import * as internal from '@crc/core/internal';
import {
  Fragment as ProductionFragment,
  jsx,
  jsxs,
} from '@crc/core/jsx-runtime';
import {
  Fragment as DevelopmentFragment,
  jsxDEV,
} from '@crc/core/jsx-dev-runtime';

const expected = [
  'Absolute',
  'Arc',
  'Circle',
  'Clip',
  'Ellipse',
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
  'Polygon',
  'Rectangle',
  'RegularPolygon',
  'Star',
  'SvgPath',
  'Text',
  'VerticalLine',
  'Wedge',
  'computed',
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
  'crcSignal',
  'crcState',
  'crcSvgPath',
  'crcWhenChanged',
  'createArcPath',
  'createCirclePath',
  'createElement',
  'createEllipsePath',
  'createLinePath',
  'createPolygonPath',
  'createRectanglePath',
  'createRegularPolygonPath',
  'createStarPath',
  'createSvgPath',
  'createWedgePath',
  'definePrimitive',
  'isSignal',
  'layoutDiagnostic',
  'measureElement',
  'normalizeEdges',
  'resolveBox',
  'resolveLength',
  'signal',
  'untracked',
];

const actual = Object.keys(core).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`Unexpected @crc/core exports: ${actual.join(', ')}`);
}

const expectedInternal = [
  'crcInternalCreateSignalConsumer',
  'crcInternalCurrentFrame',
  'crcInternalCurrentRenderOwner',
  'crcInternalQueueComplete',
  'crcInternalRequestRendererWork',
];
const actualInternal = Object.keys(internal).sort();
if (JSON.stringify(actualInternal) !== JSON.stringify(expectedInternal)) {
  throw new Error(
    `Unexpected @crc/core/internal exports: ${actualInternal.join(', ')}`,
  );
}
for (const exportName of expectedInternal) {
  if (typeof internal[exportName] !== 'function') {
    throw new Error(`Expected @crc/core/internal ${exportName} to be callable.`);
  }
  if (exportName in core) {
    throw new Error(`Internal renderer function leaked from @crc/core: ${exportName}.`);
  }
}
for (const exportName of expected) {
  if (exportName in internal) {
    throw new Error(`@crc/core/internal re-exported public root value ${exportName}.`);
  }
}
if (actual.length !== 63) {
  throw new Error(`Expected 63 @crc/core runtime exports, received ${actual.length}.`);
}

for (const [exportName, value] of Object.entries({
  jsx,
  jsxs,
  jsxDEV,
})) {
  if (typeof value !== 'function') {
    throw new Error(`Expected @crc/core compiler export ${exportName}.`);
  }
}
if (
  ProductionFragment !== core.Fragment ||
  DevelopmentFragment !== core.Fragment
) {
  throw new Error('Compiler subpaths did not share the public Fragment value.');
}
for (const exportName of expected) {
  if (typeof core[exportName] !== 'function') {
    throw new Error(`Expected @crc/core ${exportName} to be a runtime function.`);
  }
}
for (const creatorName of [
  'createArcPath',
  'createCirclePath',
  'createEllipsePath',
  'createLinePath',
  'createPolygonPath',
  'createRectanglePath',
  'createRegularPolygonPath',
  'createStarPath',
  'createSvgPath',
  'createWedgePath',
]) {
  if (typeof core[creatorName] !== 'function') {
    throw new Error(`Expected @crc/core ${creatorName} to be callable.`);
  }
}

const style = { width: 1, height: 1 };
const element = core.createElement(core.Rectangle, {
  key: 'runtime-focus-probe',
  style,
});
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
