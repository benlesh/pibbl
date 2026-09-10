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
  'layoutDiagnostic',
  'measureElement',
  'normalizeEdges',
  'resolveBox',
  'resolveLength',
];

const actual = Object.keys(core).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`Unexpected @crc/core exports: ${actual.join(', ')}`);
}
if (actual.length !== 58) {
  throw new Error(`Expected 58 @crc/core runtime exports, received ${actual.length}.`);
}

const expectedInternal = [
  'createBackendToken',
  'defineBackendPrimitive',
  'executeBackendCRC',
  'getBackendEnvironment',
  'getCurrentBackendHostCanvas',
  'getCurrentFrameTimestamp',
  'getCurrentSurfaceDensity',
  'haveSameLayerNodeTree',
  'mountBackendCRC',
  'registerNestedInteractionResolver',
  'requestCurrentInstanceFrame',
  'setCurrentComponentAfterRender',
  'snapshotLayerNodeTree',
  'useBackendEventTarget',
  'useInternalHookSlot',
];
const actualInternal = Object.keys(internal).sort();
if (JSON.stringify(actualInternal) !== JSON.stringify(expectedInternal)) {
  throw new Error(
    `Unexpected @crc/core/internal exports: ${actualInternal.join(', ')}`,
  );
}
if (typeof internal.createBackendToken('consumer') !== 'object') {
  throw new Error('@crc/core/internal did not create an opaque backend token.');
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
  '@crc/core/lib/types',
  '@crc/core/lib/global-state',
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
