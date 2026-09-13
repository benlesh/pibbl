import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { parse } from '@babel/parser';
import { crcRuntimeSource } from './crc-runtime-source.ts';

const repositoryRoot = resolve(import.meta.dirname, '..');
const declarationBundle = await readFile(
  join(repositoryRoot, 'playground/src/crc-editor-types.txt'),
  'utf8',
);
const directory = await mkdtemp(join(tmpdir(), 'crc-studio-types-'));
const require = createRequire(import.meta.url);
const tsc = join(dirname(require.resolve('typescript')), 'tsc.js');

const modulePaths = new Map([
  ['@crc/core', 'node_modules/@crc/core/index.d.ts'],
  ['@crc/core/jsx-runtime', 'node_modules/@crc/core/jsx-runtime.d.ts'],
  ['@crc/core/jsx-dev-runtime', 'node_modules/@crc/core/jsx-dev-runtime.d.ts'],
  ['@crc/webgl', 'node_modules/@crc/webgl/index.d.ts'],
]);

function readDeclarationModules(bundle) {
  const markers = [...bundle.matchAll(/^\/\* @crc-studio-module (.+) \*\/$/gmu)];
  const modules = markers.map((marker, index) => ({
    moduleName: marker[1],
    content: bundle.slice(
      marker.index + marker[0].length,
      markers[index + 1]?.index ?? bundle.length,
    ).trimStart(),
  }));
  if (
    modules.length !== modulePaths.size ||
    new Set(modules.map(({ moduleName }) => moduleName)).size !== modulePaths.size ||
    modules.some(({ moduleName }) => !modulePaths.has(moduleName))
  ) {
    throw new Error('CRC Studio declarations must define the four package entry points exactly once.');
  }
  return modules;
}

const declarationModules = readDeclarationModules(declarationBundle);

const removedAuthoringImports = [
  [['define', 'Comp'], 'RemovedDefinitionWrapper'],
  [['r', 'ect'], 'RemovedRectangleFactory'],
  [['p', 'ath'], 'RemovedPathFactory'],
  [['svg', 'Path'], 'RemovedSvgPathFactory'],
  [['l', 'ine'], 'RemovedLineFactory'],
  [['horizontal', 'Line'], 'RemovedHorizontalLineFactory'],
  [['vertical', 'Line'], 'RemovedVerticalLineFactory'],
  [['t', 'ext'], 'RemovedTextFactory'],
  [['i', 'mg'], 'RemovedImageFactory'],
  [['g'], 'RemovedGroupFactory'],
  [['c', 'lip'], 'RemovedClipFactory'],
  [['l', 'ayer'], 'RemovedLayerFactory'],
  [['a', 'bsolute'], 'RemovedAbsoluteFactory'],
  [['o', 'verlay'], 'RemovedOverlayFactory'],
  [['f', 'low'], 'RemovedFlowFactory'],
  [['f', 'lex'], 'RemovedFlexFactory'],
  [['g', 'rid'], 'RemovedGridFactory'],
  [['with', 'Focus', 'Management'], 'RemovedFocusEnhancer'],
  [['with', 'Keyboard', 'Navigation'], 'RemovedKeyboardEnhancer'],
  [['Comp', 'El'], 'RemovedElementType'],
  [['Comp', 'Fn'], 'RemovedRenderType'],
  [['Component', 'Input'], 'RemovedInputType'],
  [['Component', 'Capabilities'], 'RemovedCapabilityType'],
  [['Falsy', 'Nodes'], 'RemovedEmptyNodeType'],
  [['Rect', 'Props'], 'RemovedRectangleFactoryProps'],
  [['Img', 'Props'], 'RemovedImageFactoryProps'],
  [['G', 'Props'], 'RemovedGroupFactoryProps'],
  [['Comp', 'Refs'], 'RemovedComponentRefsType'],
].map(([parts, alias]) =>
  '// @ts-expect-error removed authoring export\n' +
  `import type { ${parts.join('')} as ${alias} } from '@crc/core';`,
).join('\n');

function explicitExportNames(source, surfaceLabel) {
  const sourceFile = parse(source, {
    sourceType: 'module',
    plugins: [['typescript', { dts: true }]],
  });
  const names = new Set();

  for (const statement of sourceFile.program.body) {
    if (statement.type === 'TSModuleDeclaration' && statement.kind === 'global') {
      throw new Error(`CRC ${surfaceLabel} declaration rejects global augmentation.`);
    }

    if (
      statement.type === 'TSModuleDeclaration' &&
      statement.kind === 'module' &&
      statement.id.type === 'StringLiteral'
    ) {
      throw new Error(
        `CRC ${surfaceLabel} declaration rejects ambient external module: ${statement.id.value}.`,
      );
    }

    if (statement.type === 'TSNamespaceExportDeclaration') {
      throw new Error(
        `CRC ${surfaceLabel} declaration rejects global namespace export: ${statement.id.name}.`,
      );
    }

    if (statement.type !== 'ExportNamedDeclaration') {
      if (
        statement.type === 'ExportAllDeclaration' ||
        statement.type === 'ExportDefaultDeclaration' ||
        statement.type === 'TSExportAssignment'
      ) {
        throw new Error(
          `CRC Studio surface verifier found an unsupported export syntax: ${statement.type}`,
        );
      }
      continue;
    }

    if (statement.declaration === null) {
      for (const specifier of statement.specifiers) {
        if (specifier.type !== 'ExportSpecifier' || specifier.exported.type !== 'Identifier') {
          throw new Error('CRC Studio surface verifier found an unsupported re-export.');
        }
        names.add(specifier.exported.name);
      }
      continue;
    }

    if (statement.declaration.type === 'VariableDeclaration') {
      for (const declaration of statement.declaration.declarations) {
        if (declaration.id.type !== 'Identifier') {
          throw new Error('CRC Studio surface verifier does not support binding exports.');
        }
        names.add(declaration.id.name);
      }
      continue;
    }

    if ('id' in statement.declaration && statement.declaration.id?.type === 'Identifier') {
      names.add(statement.declaration.id.name);
      continue;
    }

    throw new Error(
      `CRC Studio surface verifier found an unsupported export syntax: ${statement.declaration.type}`,
    );
  }

  return [...names].sort();
}

function assertExactDeclarationSurface(
  moduleName,
  expectedLabel,
  expectedSource,
  actualLabel,
  actualSource,
) {
  const expectedNames = explicitExportNames(expectedSource, `${expectedLabel} ${moduleName}`);
  const actualNames = explicitExportNames(actualSource, `${actualLabel} ${moduleName}`);
  if (expectedNames.join('\n') === actualNames.join('\n')) return;

  const expectedNameSet = new Set(expectedNames);
  const actualNameSet = new Set(actualNames);
  const missing = expectedNames.filter((name) => !actualNameSet.has(name));
  const extra = actualNames.filter((name) => !expectedNameSet.has(name));
  throw new Error(
    `CRC ${actualLabel} declaration surface differs from ${expectedLabel} for ${moduleName}.\n` +
    `Missing: ${missing.join(', ') || '(none)'}.\n` +
    `Extra: ${extra.join(', ') || '(none)'}.`,
  );
}

function verifyDeclarationSurfaceComparator() {
  const packageFixture = `
export namespace JSX {}
`;
  const studioGlobalMutationFixture = `
export namespace JSX {}
declare global {
  namespace CRCMutation {
    namespace Nested {}
  }
}
`;
  assert.throws(
    () =>
      assertExactDeclarationSurface(
        '@crc/core',
        'source package fixture',
        packageFixture,
        'Studio global-mutation fixture',
        studioGlobalMutationFixture,
      ),
    /rejects global augmentation/u,
    'The declaration surface comparator must reject declare global, including nested namespaces.',
  );

  const ambientModuleMutations = [
    ['@crc/core', '@crc/core'],
    ['@crc/core/jsx-runtime', '@crc/core/jsx-runtime'],
    ['@crc/core/jsx-dev-runtime', '@crc/core/jsx-dev-runtime'],
    ['@crc/core', '@third-party/runtime'],
  ];
  for (const [surfaceModuleName, ambientModuleName] of ambientModuleMutations) {
    const studioAmbientModuleMutationFixture = `
export namespace JSX {}
declare module "${ambientModuleName}" {
  export const UnexpectedAugmentedExport: unique symbol;
}
`;
    assert.throws(
      () =>
        assertExactDeclarationSurface(
          surfaceModuleName,
          'source package fixture',
          packageFixture,
          'Studio ambient-module mutation fixture',
          studioAmbientModuleMutationFixture,
        ),
      {
        message:
          `CRC Studio ambient-module mutation fixture ${surfaceModuleName} declaration ` +
          `rejects ambient external module: ${ambientModuleName}.`,
      },
      `The declaration surface comparator must reject ambient module "${ambientModuleName}" ` +
        `while verifying ${surfaceModuleName}.`,
    );
  }

  const studioInternalNamespaceFixture = `
declare namespace CRCInternal {
  namespace Nested {}
}
export namespace JSX {}
`;
  assert.doesNotThrow(
    () =>
      assertExactDeclarationSurface(
        '@crc/core',
        'source package fixture',
        packageFixture,
        'Studio internal-namespace fixture',
        studioInternalNamespaceFixture,
      ),
    'The declaration surface comparator must permit module-local namespaces.',
  );
}

verifyDeclarationSurfaceComparator();

const packageDeclarationSources = new Map([
  ['@crc/core', await readFile(join(repositoryRoot, 'packages/core/src/index.ts'), 'utf8')],
  [
    '@crc/core/jsx-runtime',
    await readFile(join(repositoryRoot, 'packages/core/src/jsx-runtime.ts'), 'utf8'),
  ],
  [
    '@crc/core/jsx-dev-runtime',
    await readFile(join(repositoryRoot, 'packages/core/src/jsx-dev-runtime.ts'), 'utf8'),
  ],
  ['@crc/webgl', await readFile(join(repositoryRoot, 'packages/webgl/src/index.ts'), 'utf8')],
]);

const builtPackageDeclarationSources = new Map([
  ['@crc/core', await readFile(join(repositoryRoot, 'packages/core/dist/index.d.ts'), 'utf8')],
  [
    '@crc/core/jsx-runtime',
    await readFile(join(repositoryRoot, 'packages/core/dist/jsx-runtime.d.ts'), 'utf8'),
  ],
  [
    '@crc/core/jsx-dev-runtime',
    await readFile(join(repositoryRoot, 'packages/core/dist/jsx-dev-runtime.d.ts'), 'utf8'),
  ],
  ['@crc/webgl', await readFile(join(repositoryRoot, 'packages/webgl/dist/index.d.ts'), 'utf8')],
]);

for (const { moduleName, content } of declarationModules) {
  const packageSource = packageDeclarationSources.get(moduleName);
  assertExactDeclarationSurface(
    moduleName,
    'source package',
    packageSource,
    'built package',
    builtPackageDeclarationSources.get(moduleName),
  );
  assertExactDeclarationSurface(
    moduleName,
    'source package',
    packageSource,
    'Studio',
    content,
  );
}

const publicTypeExports = [
  'AbsoluteProps',
  'AbsoluteStyle',
  'ArcProps',
  'ArcPathOptions',
  'ArcStyle',
  'BoxStyle',
  'Canvas',
  'CanvasMeasurementService',
  'CircleProps',
  'CirclePathOptions',
  'CircleStyle',
  'ClipProps',
  'ClipStyle',
  'Constraints',
  'CRCClipboardEvent',
  'CRCAnimationDefinition',
  'CRCAnimationOptions',
  'CRCAnimationProgram',
  'CRCAnimationRepeatDirection',
  'CRCAnimationRepeatOptions',
  'CRCAnimationSampleInput',
  'CRCBlurFilter',
  'CRCBrightnessFilter',
  'CRCComponent',
  'CRCCompositionEvent',
  'CRCConfig',
  'CRCContainerChild',
  'CRCContrastFilter',
  'CRCController',
  'CRCEasing',
  'CRCDragEvent',
  'CRCDropShadowFilter',
  'CRCElement',
  'CRCElementType',
  'CRCEmptyNode',
  'CRCEvent',
  'CRCEventCapturePropName',
  'CRCEventHandler',
  'CRCEventHandlers',
  'CRCEventMap',
  'CRCEventParticipationOptions',
  'CRCEventPhase',
  'CRCEventPropName',
  'CRCEventTarget',
  'CRCEventTargetOptions',
  'CRCEventTargetSnapshot',
  'CRCEventType',
  'CRCFilter',
  'CRCFit',
  'CRCFixedViewportConfig',
  'CRCFocusEvent',
  'CRCGrayscaleFilter',
  'CRCHueRotateFilter',
  'CRCInputEvent',
  'CRCInvertFilter',
  'CRCKeyboardEvent',
  'CRCKeyboardNavigationOptions',
  'CRCInterpolator',
  'CRCKeyframesOptions',
  'CRCKey',
  'CRCLogicalMouseEvent',
  'CRCMouseEvent',
  'CRCMouseEventListener',
  'CRCNode',
  'CRCOpacityFilter',
  'CRCPixelRatio',
  'CRCPointerEvent',
  'CRCPointerEvents',
  'CRCPlayback',
  'CRCPlaybackEvent',
  'CRCPlaybackOptions',
  'CRCPlaybackStatus',
  'CRCPrimitiveComponent',
  'CRCResponsiveViewportConfig',
  'CRCSpringOptions',
  'CRCSpringTransitionOptions',
  'CRCStepperOptions',
  'CRCSaturateFilter',
  'CRCSepiaFilter',
  'CRCRef',
  'CRCRenderResult',
  'CRCTextChild',
  'CRCTouchEvent',
  'CRCTweenOptions',
  'CRCTweenTransitionOptions',
  'CRCWheelEvent',
  'CursorStyle',
  'EdgeValues',
  'Edges',
  'EllipseProps',
  'EllipsePathOptions',
  'EllipseStyle',
  'FillStyle',
  'FlexItemStyle',
  'FlexProps',
  'FlexStyle',
  'FlowProps',
  'FlowStyle',
  'FocusManagementProps',
  'GStyle',
  'GridItemStyle',
  'GridProps',
  'GridStyle',
  'GridTrack',
  'GroupProps',
  'HorizontalLineProps',
  'HorizontalLineStyle',
  'ImageProps',
  'ImgStyle',
  'KeyboardNavigationProps',
  'LayerProps',
  'LayerStyle',
  'LayoutBox',
  'LayoutDiagnosticContext',
  'LayoutDiagnosticInput',
  'LayoutItemStyle',
  'Length',
  'LineProps',
  'LinePathOptions',
  'LineStyle',
  'MeasureInput',
  'MeasureResult',
  'NormalizedStyle',
  'OverlayProps',
  'OverlayStyle',
  'PaintStyle',
  'PathProps',
  'PathStyle',
  'Percentage',
  'PixelGridAlignment',
  'PolygonProps',
  'PolygonPathOptions',
  'PolygonStyle',
  'PrimitiveCapabilities',
  'PrimitiveInput',
  'PrimitiveInputOf',
  'PrimitiveProgramProps',
  'PrimitiveRender',
  'RectangleProps',
  'RectanglePathOptions',
  'RegularPolygonNumericSize',
  'RegularPolygonPathOptions',
  'RegularPolygonPathPosition',
  'RegularPolygonProps',
  'RegularPolygonStyle',
  'RectStyle',
  'RenderingContext2D',
  'ResolvedBoxStyle',
  'ResolvedStyle',
  'RoundedCornerPathOptions',
  'RoundedCornerStyle',
  'Signal',
  'SignalEquals',
  'SignalOptions',
  'Size',
  'SpecifiedStyle',
  'StateUpdater',
  'StrokeStyle',
  'StarPathOptions',
  'StarProps',
  'StarStyle',
  'StyleResolutionContext',
  'SvgPathProps',
  'SvgPathOptions',
  'SvgPathStyle',
  'SystemStyle',
  'TextFit',
  'TextProps',
  'TextStyle',
  'VerticalLineProps',
  'VerticalLineStyle',
  'WedgeProps',
  'WedgePathOptions',
  'WedgeStyle',
  'WritableSignal',
].sort();

if (publicTypeExports.length !== 175) {
  throw new Error(`CRC Studio must declare exactly 175 core public types, received ${publicTypeExports.length}.`);
}

const publicWebGLTypeExports = [
  'CRCWebGLCameraSnapshot',
  'CRCWebGLContext',
  'CRCWebGLGeometry',
  'CRCWebGLGeometryInput',
  'CRCWebGLHitCapability',
  'CRCWebGLPerspectiveCamera',
  'CRCWebGLPrimitiveCapabilities',
  'CRCWebGLPrimitiveHitInput',
  'CRCWebGLPrimitiveInput',
  'CRCWebGLPrimitiveRender',
  'CRCWebGLProgramProps',
  'CRCWebGLTransformStyle',
  'CRCWebGLVector3',
  'CubeProps',
  'CubeStyle',
  'Group3DProps',
  'Group3DStyle',
  'MeshProps',
  'MeshStyle',
  'SphereProps',
  'SphereStyle',
  'WebGLLayerProps',
  'WebGLLayerStyle',
].sort();

if (publicWebGLTypeExports.length !== 23) {
  throw new Error(`CRC Studio must declare exactly 23 WebGL public types, received ${publicWebGLTypeExports.length}.`);
}

function explicitTypeExportNames(source) {
  const names = [];
  for (const match of source.matchAll(
    /export\s+(type\s+)?\{([\s\S]*?)\}\s+from\s+['"][^'"]+['"]/gu,
  )) {
    const wholeBlockIsTypes = match[1] !== undefined;
    for (const rawExport of match[2].split(',')) {
      const exported = rawExport.trim();
      if (!exported) continue;
      if (!wholeBlockIsTypes && !exported.startsWith('type ')) continue;
      names.push(exported.replace(/^type\s+/u, '').split(/\s+as\s+/u)[0]);
    }
  }
  return names.sort();
}

for (const [moduleName, publicTypes] of [
  ['@crc/core', publicTypeExports],
  ['@crc/webgl', publicWebGLTypeExports],
]) {
  const packageTypeExports = explicitTypeExportNames(
    packageDeclarationSources.get(moduleName),
  );
  if (packageTypeExports.join('\n') !== publicTypes.join('\n')) {
    throw new Error(
      `CRC Studio public type manifest differs from ${moduleName} source.\n` +
      `Package: ${packageTypeExports.join(', ')}.\n` +
      `Studio verifier: ${publicTypes.join(', ')}.`,
    );
  }
}

const publicTypeSurfaceConsumer = `
import type {
  ${publicTypeExports.join(',\n  ')}
} from '@crc/core';
import type {
  ${publicWebGLTypeExports.join(',\n  ')}
} from '@crc/webgl';
`;

const consumer = `
${removedAuthoringImports}
// @ts-expect-error ordinary Studio examples cannot import the version-coupled friend entry
import type { CRCInternalFrame } from '@crc/core/internal';
import * as CRC_CORE_ROOT from '@crc/core';
import * as CRC_WEBGL_ROOT from '@crc/webgl';
import {
  Absolute,
  computed,
  crc,
  crcCanvasContext,
  crcCursor,
  crcEvent,
  crcEventListener,
  crcEventTarget,
  crcLinePath,
  crcMemo,
  crcPlayback,
  crcRectPath,
  crcSignal,
  crcTransition,
  crcWhenChanged,
  createElement,
  defineAnimation,
  definePrimitive,
  easing,
  Flex,
  Flow,
  FocusManagement,
  Fragment,
  Grid,
  Group,
  HorizontalLine,
  Image,
  isSignal,
  keyframes,
  KeyboardNavigation,
  LayoutDiagnostic,
  Line,
  marker,
  normalizeEdges,
  Overlay,
  parallel,
  Path,
  Polygon,
  Rectangle,
  repeat,
  resolveBox,
  resolveLength,
  signal,
  sequence,
  spring,
  stepper,
  SvgPath,
  Text,
  track,
  tween,
  VerticalLine,
  wait,
  type CRCAnimationDefinition,
  type CRCAnimationProgram,
  type CRCConfig,
  type CRCComponent,
  type CRCController,
  type CRCInterpolator,
  type CRCClipboardEvent,
  type CRCCompositionEvent,
  type CRCDragEvent,
  type CRCEvent,
  type CRCEventHandlers,
  type CRCFocusEvent,
  type CRCFit,
  type CRCInputEvent,
  type CRCKeyboardEvent,
  type CRCKeyboardNavigationOptions,
  type CRCLogicalMouseEvent,
  type CRCMouseEvent,
  type CRCNode,
  type CRCPlayback,
  type CRCPixelRatio,
  type CRCPointerEvent,
  type CRCPointerEvents,
  type CRCEventParticipationOptions,
  type CRCEventTargetSnapshot,
  type CRCFilter,
  type CRCTouchEvent,
  type CRCWheelEvent,
  type EdgeValues,
  type Edges,
  type FocusManagementProps,
  type KeyboardNavigationProps,
  type LayoutBox,
  type LayoutDiagnosticContext,
  type LayoutDiagnosticInput,
  type Length,
  type LineStyle,
  type OverlayStyle,
  type Percentage,
  type PrimitiveCapabilities,
  type PrimitiveInput,
  type PrimitiveProgramProps,
  type PrimitiveRender,
  type PolygonStyle,
  type RenderingContext2D,
  type ResolvedBoxStyle,
  type Signal,
  type SignalEquals,
  type SignalOptions,
  type SystemStyle,
  type WritableSignal,
  untracked,
} from '@crc/core';
import { jsx, jsxs } from '@crc/core/jsx-runtime';
import { jsxDEV } from '@crc/core/jsx-dev-runtime';
import {
  crcAnimationFrame,
  crcWebGLContext,
  createWebGLGeometry,
  Cube,
  defineWebGLPrimitive,
  Group3D,
  Mesh,
  Sphere,
  WebGLLayer,
  type CRCWebGLContext,
  type CRCWebGLPerspectiveCamera,
  type CRCWebGLPrimitiveCapabilities,
  type CRCWebGLPrimitiveHitInput,
  type CRCWebGLPrimitiveInput,
  type CRCWebGLPrimitiveRender,
  type CRCWebGLProgramProps,
  type CubeProps,
  type CubeStyle,
  type Group3DProps,
  type Group3DStyle,
  type MeshProps,
  type MeshStyle,
  type SphereProps,
  type SphereStyle,
  type WebGLLayerProps,
  type WebGLLayerStyle,
} from '@crc/webgl';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;

type StudioSignatureParity = [
  Assert<Equal<typeof Fragment, (props: { children?: CRCNode }) => CRCNode>>,
  Assert<Equal<typeof FocusManagement, CRCComponent<FocusManagementProps>>>,
  Assert<Equal<typeof KeyboardNavigation, CRCComponent<KeyboardNavigationProps>>>,
  Assert<Equal<LineStyle['coords'], [number, number][]>>,
  Assert<
    Equal<
      SystemStyle['filter'],
      CRCFilter | readonly CRCFilter[] | undefined
    >
  >,
  Assert<Equal<PolygonStyle['cornerRadius'], Exclude<Length, 'auto'> | undefined>>,
  Assert<Equal<PolygonStyle['cornerRadii'], readonly (Exclude<Length, 'auto'> | null | undefined)[] | undefined>>,
  Assert<Equal<typeof crcMemo, <T>(create: () => T, deps: any[]) => T>>,
  Assert<Equal<
    typeof signal,
    <T>(initialValue: T, options?: SignalOptions<T>) => WritableSignal<T>
  >>,
  Assert<Equal<
    typeof computed,
    <T>(compute: () => T, options?: SignalOptions<T>) => Signal<T>
  >>,
  Assert<Equal<typeof untracked, <T>(callback: () => T) => T>>,
  Assert<Equal<typeof isSignal, (value: unknown) => value is Signal<unknown>>>,
  Assert<Equal<
    typeof crcSignal,
    <T>(initialValue: T, options?: SignalOptions<T>) => WritableSignal<T>
  >>,
  Assert<Equal<
    typeof crcWhenChanged,
    (callback: () => (() => void) | void, deps?: any[]) => void
  >>,
  Assert<Equal<
    typeof crcCursor,
    (options: {
      path?: Path2D;
      style?: string;
      fill?: boolean;
      lineInteractionWidth?: number;
    }) => void
  >>,
  Assert<Equal<
    typeof crcLinePath,
    (
      coords: [number, number][],
      config?: { closePath?: boolean },
    ) => Path2D
  >>,
  Assert<Equal<
    typeof crcRectPath,
    (
      x: number,
      y: number,
      width: number,
      height: number,
      config?: {
        alignToPixelGrid?: 'none' | 'round' | 'ceil' | 'floor';
        lineWidth?: number;
        cornerRadius?: number;
        cornerRadii?: readonly (number | null | undefined)[];
      },
    ) => Path2D
  >>,
  Assert<Equal<
    typeof resolveLength,
    (
      value: Length,
      reference: number | undefined,
      property: string,
      context?: Readonly<LayoutDiagnosticContext>,
    ) => number | undefined
  >>,
  Assert<Equal<
    typeof normalizeEdges,
    (
      value: EdgeValues | undefined,
      property: string,
      context?: Readonly<LayoutDiagnosticContext>,
    ) => Edges
  >>,
  Assert<Equal<
    typeof resolveBox,
    (
      style: Readonly<import('@crc/core').BoxStyle>,
      constraints: Readonly<import('@crc/core').Constraints>,
      context?: Readonly<LayoutDiagnosticContext>,
    ) => ResolvedBoxStyle
  >>,
];
void (null as unknown as StudioSignatureParity);

const studioCamera = {
  type: 'perspective',
  position: [0, 0, 5],
  lookAt: [0, 0, 0],
  up: [0, 1, 0],
  fieldOfViewDegrees: 45,
  near: 0.1,
  far: 100,
} as const satisfies CRCWebGLPerspectiveCamera;
const studioGeometry = createWebGLGeometry({
  positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
});
const webglScene = (
  <WebGLLayer style={{ width: 320, height: 180 }} camera={studioCamera}>
    <Group3D style={{ rotationYDegrees: 15 }}>
      <Cube style={{ size: 1, color: '#74d3ae' }} />
      <Sphere style={{ radius: 0.5, translateX: 1 }} />
      <Mesh geometry={studioGeometry} style={{ color: '#f7c948' }} />
    </Group3D>
  </WebGLLayer>
);
void webglScene;
// @ts-expect-error filters belong on WebGLLayer, never inner WebGL geometry
const filteredCube = <Cube style={{ filter: { type: 'blur', radius: 2 } }} />;
void filteredCube;
void CRC_WEBGL_ROOT.crcAnimationFrame;
void crcAnimationFrame;
void crcWebGLContext;
type StudioWebGLTypes = [
  CRCWebGLContext,
  CRCWebGLPrimitiveCapabilities<{}, CubeStyle, CubeStyle, CubeStyle>,
  CRCWebGLPrimitiveHitInput<CubeProps, CubeStyle>,
  CRCWebGLPrimitiveInput<CubeProps, CubeStyle, { readonly kind: 'none' }>,
  CRCWebGLPrimitiveRender<CubeProps, CubeStyle>,
  CRCWebGLProgramProps<CubeProps, { readonly kind: 'none' }>,
  Group3DProps,
  Group3DStyle,
  MeshProps,
  MeshStyle,
  SphereProps,
  SphereStyle,
  WebGLLayerProps,
  WebGLLayerStyle,
];
void (null as unknown as StudioWebGLTypes);
const StudioWebGLPrimitive = defineWebGLPrimitive<{}, SystemStyle>(
  () => undefined,
  { hit: { kind: 'none' } },
);
createElement(StudioWebGLPrimitive, { style: {} });

const fragmentResult: CRCNode = Fragment({ children: false });
void fragmentResult;
void (null as unknown as CRCInternalFrame);

const signalEquals: SignalEquals<number> = (previous, next) => previous === next;
const studioCount = signal(1, {
  debugName: 'Studio count',
  equals: signalEquals,
});
const studioReadonly: Signal<number> = studioCount.asReadonly();
const studioComputed: Signal<number> = computed(() => studioReadonly.get() * 2);
const studioUntracked: number = untracked(() => studioComputed.get());
const studioCallback = signal<() => string>(() => 'ready');
studioCallback.set(() => 'updated');
if (isSignal(studioReadonly)) void studioReadonly.get();
// @ts-expect-error readonly signals do not expose writes
studioReadonly.set(2);
// @ts-expect-error computed values are readonly
studioComputed.update(value => value + 1);
void studioUntracked;

function StudioSignalHook(): CRCNode {
  const value = crcSignal('hook value');
  return <Text>{value.get()}</Text>;
}
void <StudioSignalHook />;

function StudioAnimationHook(): CRCNode {
  const x = crcSignal(0);
  const alpha = crcTransition(1, {
    type: 'tween',
    duration: 120,
  });
  const sprung = crcTransition(20, { type: 'spring' });
  const tweened: CRCAnimationDefinition<number> = tween({
    to: 40,
    duration: 160,
    easing: easing.easeOut,
  });
  const program: CRCAnimationProgram = sequence(
    parallel(track(x, tweened), wait(20)),
    marker('arrived'),
    repeat(track(x, spring({ to: 0 })), { iterations: 2 }),
    track(x, keyframes({ values: [0, 10, 20], duration: 100 })),
    track(x, defineAnimation({
      duration: 10,
      sample: ({ progress }) => progress,
    })),
    track(x, stepper({
      stepMilliseconds: 10,
      initial: value => ({ value }),
      step: state => ({ value: state.value + 1 }),
      read: state => state.value,
    })),
  );
  const playback: CRCPlayback = crcPlayback(program);
  const interpolatePoint: CRCInterpolator<{ x: number }> = (from, to, progress) => ({
    x: from.x + (to.x - from.x) * progress,
  });
  void crcTransition({ x: 1 }, {
    type: 'tween',
    duration: 100,
    interpolate: interpolatePoint,
  });
  return <Rectangle
    style={{ x: x.get(), width: sprung.get(), height: 20, opacity: alpha.get() }}
    onClick={() => playback.play()}
  />;
}
void <StudioAnimationHook />;
// @ts-expect-error Studio keyframes require at least two values
void keyframes({ values: [0], duration: 100 });

// @ts-expect-error compiler constructors stay off the root package
void CRC_CORE_ROOT.jsx;
void jsx(Rectangle, { style: { width: 1, height: 1 } });
void jsxs(Text, { children: ['CRC ', 1] });
void jsxDEV(Rectangle, { style: { width: 1, height: 1 } }, undefined, false, {
  fileName: 'studio.crc.tsx', lineNumber: 1, columnNumber: 1,
}, undefined);

interface StudioCardProps {
  label: string;
  active: boolean;
}

function StudioCard({ label, active }: StudioCardProps): CRCNode {
  return (
    <>
      <Rectangle
        style={{
          x: 16,
          y: active ? 16 : 48,
          width: 180,
          height: 28,
          fill: active ? '#1f4bd8' : '#74d3ae',
        }}
        onClick={() => console.log(label)}
      />
      <Text style={{ x: 24, y: active ? 22 : 54, fill: '#fff' }}>
        {label} — {active ? 'active' : 'waiting'}
      </Text>
    </>
  );
}

function StudioLesson(): CRCNode {
  const labels = ['one', 'two'];
  const showFooter = true;
  return (
    <>
      {labels.map((label, index) => (
        <StudioCard key={label} label={label} active={index === 0} />
      ))}
      {showFooter && <Text style={{ x: 16, y: 92 }}>Ready: {labels.length}</Text>}
    </>
  );
}

const eventHandlers = {
  onPointerDown: (event: CRCPointerEvent) => {
    const pressure: number = event.pressure;
    void pressure;
  },
  onMouseDown: (event: CRCLogicalMouseEvent) => void event.detail,
  onTouchStart: (event: CRCTouchEvent) => void event.changedTouches,
  onWheel: (event: CRCWheelEvent) => void event.deltaMode,
  onKeyDownCapture: (event: CRCKeyboardEvent) => void event.key,
  onFocus: (event: CRCFocusEvent) => void event.originalEvent,
  onBeforeInput: (event: CRCInputEvent) => void event.inputType,
  onChange: (event: CRCEvent) => void event.originalEvent,
  onCompositionUpdate: (event: CRCCompositionEvent) => void event.data,
  onCopyCapture: (event: CRCClipboardEvent) => void event.clipboardData,
  onDragStart: (event: CRCDragEvent) => void event.dataTransfer,
} satisfies CRCEventHandlers;

function EventProbe(): CRCNode {
  const snapshot: CRCEventTargetSnapshot = crcEventTarget(eventHandlers, {
    path: new Path2D(),
    fill: true,
  });
  crcEventListener({ onPointerDownCapture: eventHandlers.onPointerDown });
  void snapshot.isFocused;
  const context: RenderingContext2D = crcCanvasContext();
  void context;
  return <Rectangle
    {...eventHandlers}
    style={{ width: 20, height: 20, fill: 'black' }}
  />;
}
createElement(EventProbe, {});

const navigationBounds = {
  x: 0,
  y: 0,
  width: 40,
  height: 20,
} satisfies LayoutBox;
const mutableLineCoordinates: [number, number][] = [[0, 0], [40, 20]];
const focusableBuiltIns = (
  <>
    <Rectangle pointerEvents="none" keyboardFocusable keyboardNavigationBounds={navigationBounds} style={{ width: 40, height: 20 }} />
    <Path keyboardFocusable keyboardNavigationBounds={navigationBounds} style={{ d: new Path2D() }} />
    <SvgPath keyboardFocusable keyboardNavigationBounds={navigationBounds} style={{ d: 'M 0 0 L 40 20' }} />
    <Line keyboardFocusable keyboardNavigationBounds={navigationBounds} style={{ coords: mutableLineCoordinates }} />
    <Polygon style={{ coords: [[0, 0], [40, 0], [20, 20]], cornerRadius: 2, cornerRadii: [2, null] }} />
    <HorizontalLine keyboardFocusable keyboardNavigationBounds={navigationBounds} style={{ y: 10 }} />
    <VerticalLine keyboardFocusable keyboardNavigationBounds={navigationBounds} style={{ x: 10 }} />
    <Text keyboardFocusable keyboardNavigationBounds={navigationBounds}>Focusable text</Text>
    <Image keyboardFocusable keyboardNavigationBounds={navigationBounds} style={{ src: 'focusable.png' }} />
  </>
);
void focusableBuiltIns;
const pointerEvents: CRCPointerEvents = 'auto';
const participation = { pointerEvents } satisfies CRCEventParticipationOptions;
void participation;

const automaticPolygonCorner: PolygonStyle = {
  coords: [[0, 0], [40, 0], [20, 20]],
  // @ts-expect-error Polygon rounded corners exclude auto
  cornerRadius: 'auto',
};
void automaticPolygonCorner;

const readonlyLineCoordinates = [[0, 0], [40, 20]] as const;
// @ts-expect-error LineStyle coordinates are mutable tuples in the package contract
const readonlyLineStyle: LineStyle = { coords: readonlyLineCoordinates };
void readonlyLineStyle;

crcWhenChanged(() => undefined);
crcCursor({});
crcLinePath(mutableLineCoordinates, { closePath: true });
// @ts-expect-error line-path configuration is an object, not a boolean flag
crcLinePath(mutableLineCoordinates, true);
crcRectPath(0, 0, 40, 20, {
  alignToPixelGrid: 'round',
  lineWidth: 2,
});
// @ts-expect-error rectangle alignment and line width belong to the config object
crcRectPath(0, 0, 40, 20, 'round', 2);

function ValidDirectComponent(props: { label: string }): CRCNode {
  return <Text>{props.label}</Text>;
}
createElement(ValidDirectComponent, { label: 'valid', key: 'descriptor-key' });

type DirectChild =
  | string
  | { readonly label: string }
  | readonly DirectChild[]
  | Iterable<DirectChild>;
function DirectChildComponent(_props: { children?: DirectChild }): CRCNode {
  return undefined;
}
function DirectScalarChild(
  _props: { children?: { readonly label: string } },
): CRCNode {
  return undefined;
}
const directChild = createElement(Rectangle, {
  style: { width: 10, height: 10 },
});
createElement(Text, null, 'Count: ', 1, [' / ', [2]], new Set([' total']));
createElement(Group, null, directChild, [directChild], new Set([directChild]));
createElement(
  DirectChildComponent,
  null,
  { label: 'custom' },
  ['nested'],
  new Set([{ label: 'iterable' }]),
);
const firstScalarChild = { label: 'first' };
createElement(DirectScalarChild, null, firstScalarChild);
// @ts-expect-error containers reject nonzero raw numbers
createElement(Group, null, 1);
// @ts-expect-error Text rejects CRC element children
createElement(Text, null, directChild);
// @ts-expect-error drawing leaves reject children
createElement(Rectangle, { style: { width: 10, height: 10 } }, directChild);
// @ts-expect-error custom components retain their declared child restriction
createElement(DirectChildComponent, null, 1);
// @ts-expect-error multiple children become an array that scalar child props reject
createElement(DirectScalarChild, null, firstScalarChild, { label: 'second' });

function ReservedKeyComponent(_props: { key: string }): CRCNode {
  return undefined;
}
// @ts-expect-error key is descriptor metadata and cannot be a component prop
createElement(ReservedKeyComponent, { key: 'program-key' });

const diagnosticContext = {
  component: 'StudioParityProbe',
  algorithm: 'declaration-parity',
} satisfies LayoutDiagnosticContext;
const diagnosticInput = {
  ...diagnosticContext,
  property: 'width',
  value: 'wide',
  reason: 'must be a supported length',
} satisfies LayoutDiagnosticInput;
const diagnostic: LayoutDiagnostic = new LayoutDiagnostic(diagnosticInput);
void diagnostic;

const resolvedLength: number | undefined = resolveLength(
  '50%',
  200,
  'width',
  diagnosticContext,
);
void resolvedLength;
// @ts-expect-error resolveLength requires a declared Length value
resolveLength(undefined, 200, 'width');
// @ts-expect-error diagnostic context must use the public context shape
resolveLength(20, 200, 'width', 'not-a-context');

const normalizedEdges = normalizeEdges(
  { top: 1, right: 2, bottom: 3, left: 4 },
  'padding',
  diagnosticContext,
);
normalizedEdges.top = 5;
// @ts-expect-error diagnostic context must use the public context shape
normalizeEdges(1, 'padding', 'not-a-context');

const resolvedBox: ResolvedBoxStyle = resolveBox(
  { width: 100, height: 50, padding: 2 },
  { minWidth: 0, maxWidth: 200, minHeight: 0, maxHeight: 100 },
  diagnosticContext,
);
resolvedBox.contentBox.x = 3;
// @ts-expect-error resolveBox requires finite allocation constraints
resolveBox({ width: 100 }, diagnosticContext);

const keyboardNavigationOptions = {
  mode: 'directional',
} satisfies CRCKeyboardNavigationOptions;
const policyTree = (
  <FocusManagement>
    <KeyboardNavigation {...keyboardNavigationOptions}>
      <EventProbe key="studio-focus-probe" />
    </KeyboardNavigation>
  </FocusManagement>
);
void policyTree;
// @ts-expect-error focus policies reject raw container text
const invalidFocusPolicy = { children: 'raw text' } satisfies FocusManagementProps;
void invalidFocusPolicy;

const logicalMouseHandler = (event: CRCLogicalMouseEvent) => {
  event.preventDefault();
};
crcEvent('click', logicalMouseHandler, new Path2D());
const canvasObserver = (event: CRCMouseEvent) => void event.x;
crcEvent('mousemove', canvasObserver);
crcEvent('mousemove', event => {
  // @ts-expect-error Canvas observers retain the shipped legacy payload
  event.preventDefault();
});

type UnionStyle =
  | (SystemStyle & { opacity?: number })
  | (SystemStyle & { width: number });
const UnionProbe = definePrimitive<{}, UnionStyle>(() => undefined);
createElement(UnionProbe, { style: { opacity: 0.5 } });
createElement(UnionProbe, { style: { width: 4 } });
// @ts-expect-error one union member makes style required
createElement(UnionProbe, {});

// @ts-expect-error key is reserved descriptor metadata
definePrimitive<{ key: string }, SystemStyle>(() => undefined);
// @ts-expect-error style is reserved descriptor metadata
definePrimitive<{ style: string }, SystemStyle>(() => undefined);

interface PercentageStyle extends SystemStyle { radius: Percentage }
interface ResolvedRadiusStyle extends SystemStyle { radius: number }
// @ts-expect-error allocation-dependent declared styles require a resolver
definePrimitive<{}, PercentageStyle>(() => undefined);
// @ts-expect-error resolved styles must be allocation-free
definePrimitive<{}, PercentageStyle, PercentageStyle, PercentageStyle>(() => undefined, { resolveStyle: (style: PercentageStyle) => style });
const RadiusProbe = definePrimitive<
  {},
  PercentageStyle,
  PercentageStyle,
  ResolvedRadiusStyle
>(
  (_props, style) => {
    const radius: number = style.radius;
    void radius;
  },
  {
    resolveStyle: (style, context) => ({
      radius: context.allocation.width * Number.parseFloat(style.radius) / 100,
    }),
  },
);
type StudioPrimitiveTypes = [
  PrimitiveProgramProps<{ label: string }>,
  PrimitiveInput<{ label: string }, PercentageStyle>,
  PrimitiveRender<{ label: string }, ResolvedRadiusStyle>,
  PrimitiveCapabilities<{ label: string }, PercentageStyle>,
];
void (null as unknown as StudioPrimitiveTypes);

const overlayStyle = {
  width: 240,
  height: 120,
  alignItems: 'center',
  justifyItems: 'end',
} satisfies OverlayStyle;
createElement(Overlay, { style: overlayStyle, children: [] });

const layoutPolicies = (
  <>
    <Absolute
      style={{
        left: 4, top: '10%', alignSelf: 'center', justifySelf: 'end',
        flexBasis: 24, flexGrow: 1, flexShrink: 0,
        gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 1,
      }}
    >{false}</Absolute>
    <Overlay
      style={{
        left: 4, top: '10%', alignSelf: 'center', justifySelf: 'end',
        flexBasis: 24, flexGrow: 1, flexShrink: 0,
        gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 1,
      }}
    >{false}</Overlay>
    <Flow
      style={{
        left: 4, top: '10%', alignSelf: 'center', justifySelf: 'end',
        flexBasis: 24, flexGrow: 1, flexShrink: 0,
        gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 1,
      }}
    >{false}</Flow>
    <Flex
      style={{
        left: 4, top: '10%', alignSelf: 'center', justifySelf: 'end',
        flexBasis: 24, flexGrow: 1, flexShrink: 0,
        gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 1,
      }}
    >{false}</Flex>
    <Grid
      style={{
        left: 4, top: '10%', alignSelf: 'center', justifySelf: 'end',
        flexBasis: 24, flexGrow: 1, flexShrink: 0,
        gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 1,
        gridTemplateColumns: [100], gridTemplateRows: [50],
      }}
    >{false}</Grid>
  </>
);
void layoutPolicies;

createElement(Absolute, {
  style: {
    left: 4, top: '10%', alignSelf: 'center', justifySelf: 'end',
    flexBasis: 24, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 1,
  },
  children: [],
});
createElement(Overlay, {
  style: {
    left: 4, top: '10%', alignSelf: 'center', justifySelf: 'end',
    flexBasis: 24, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 1,
  },
  children: [],
});
createElement(Flow, {
  style: {
    left: 4, top: '10%', alignSelf: 'center', justifySelf: 'end',
    flexBasis: 24, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 1,
  },
  children: [],
});
createElement(Flex, {
  style: {
    left: 4, top: '10%', alignSelf: 'center', justifySelf: 'end',
    flexBasis: 24, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 1,
  },
  children: [],
});
createElement(Grid, {
  style: {
    left: 4, top: '10%', alignSelf: 'center', justifySelf: 'end',
    flexBasis: 24, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 1,
    gridTemplateColumns: [100], gridTemplateRows: [50],
  },
  children: [],
});

declare const canvas: HTMLCanvasElement;
crc(canvas, createElement(RadiusProbe, { style: { radius: '50%' } }));
const fit: CRCFit = 'cover';
const pixelRatio: CRCPixelRatio = 2;
const fixedSurface: CRCConfig = {
  viewport: { width: 720, height: 420 },
  fit,
  pixelRatio,
};
crc(canvas, createElement(RadiusProbe, { style: { radius: '50%' } }), fixedSurface);
crc(canvas, createElement(RadiusProbe, { style: { radius: '50%' } }), {
  viewport: 'responsive',
  pixelRatio: 'device',
});
crc(canvas, createElement(RadiusProbe, { style: { radius: '50%' } }), {
  viewport: 'responsive',
  // @ts-expect-error responsive viewports do not accept fit
  fit: 'contain',
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <StudioLesson />);
}
`;

const packageConsumer = consumer.replace(
  '// @ts-expect-error ordinary Studio examples cannot import the version-coupled friend entry\n',
  '',
);

const foreignRuntimeDeclarations = `
declare const foreignElementBrand: unique symbol;
export interface ForeignElement { readonly [foreignElementBrand]: true }
export const Fragment: (props: { children?: unknown }) => ForeignElement;
export function jsx(type: unknown, props: unknown, key?: string | number): ForeignElement;
export const jsxs: typeof jsx;
export namespace JSX {
  export type Element = ForeignElement;
  export type ElementType = (props: any) => ForeignElement;
  export interface ElementChildrenAttribute { children: unknown }
  export interface IntrinsicAttributes { key?: string | number }
  export interface IntrinsicElements {}
}
`;

const foreignRuntimeConsumer = `
/** @jsxImportSource ./foreign-runtime */
import { crc } from '@crc/core';

function ForeignScene() {
  return <></>;
}

declare const canvas: HTMLCanvasElement;
crc(canvas, <ForeignScene />);
`;

async function studioRuntime(mode) {
  const plugin = crcRuntimeSource(mode);
  const resolvedId = plugin.resolveId('virtual:crc-runtime-source');
  const loaded = await plugin.load(resolvedId);
  const serializedRuntime = /^export default ([\s\S]+);$/u.exec(loaded)?.[1];
  if (!serializedRuntime) {
    throw new Error(`CRC Studio ${mode} runtime did not expose an IIFE module.`);
  }
  const context = {};
  runInNewContext(JSON.parse(serializedRuntime), context);
  const runtime = context.CRC_CORE;
  if (!runtime) throw new Error(`CRC Studio ${mode} runtime did not initialize.`);
  return runtime;
}

try {
  for (const { moduleName, content } of declarationModules) {
    const declarationPath = join(directory, modulePaths.get(moduleName));
    await mkdir(dirname(declarationPath), { recursive: true });
    await writeFile(declarationPath, content);
  }
  await writeFile(join(directory, 'consumer.tsx'), consumer);
  await writeFile(join(directory, 'package-consumer.tsx'), packageConsumer);
  await writeFile(
    join(directory, 'public-type-surface.ts'),
    publicTypeSurfaceConsumer,
  );
  await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      jsx: 'react-jsx',
      jsxImportSource: '@crc/core',
      lib: ['ESNext', 'DOM'],
      module: 'ESNext',
      moduleResolution: 'Bundler',
      noEmit: true,
      skipLibCheck: false,
      strict: true,
      target: 'ESNext',
    },
    files: ['consumer.tsx', 'public-type-surface.ts'],
  }));
  const packageEntrySets = [
    {
      label: 'source',
      root: join(repositoryRoot, 'packages/core/src/index.ts'),
      internal: join(repositoryRoot, 'packages/core/src/internal.ts'),
      jsxRuntime: join(repositoryRoot, 'packages/core/src/jsx-runtime.ts'),
      jsxDevRuntime: join(repositoryRoot, 'packages/core/src/jsx-dev-runtime.ts'),
      webgl: join(repositoryRoot, 'packages/webgl/src/index.ts'),
    },
    {
      label: 'built',
      root: join(repositoryRoot, 'packages/core/dist/index.d.ts'),
      internal: join(repositoryRoot, 'packages/core/dist/internal.d.ts'),
      jsxRuntime: join(repositoryRoot, 'packages/core/dist/jsx-runtime.d.ts'),
      jsxDevRuntime: join(repositoryRoot, 'packages/core/dist/jsx-dev-runtime.d.ts'),
      webgl: join(repositoryRoot, 'packages/webgl/dist/index.d.ts'),
    },
  ];
  for (const entries of packageEntrySets) {
    const packageTsconfigPath = join(
      directory,
      `tsconfig.package-${entries.label}.json`,
    );
    await writeFile(packageTsconfigPath, JSON.stringify({
      compilerOptions: {
        jsx: 'react-jsx',
        jsxImportSource: '@crc/core',
        lib: ['ESNext', 'DOM'],
        module: 'ESNext',
        moduleResolution: 'Bundler',
        noEmit: true,
        paths: {
          '@crc/core': [entries.root],
          '@crc/core/internal': [entries.internal],
          '@crc/core/jsx-runtime': [entries.jsxRuntime],
          '@crc/core/jsx-dev-runtime': [entries.jsxDevRuntime],
          '@crc/webgl': [entries.webgl],
        },
        skipLibCheck: false,
        strict: true,
        target: 'ESNext',
      },
      files: ['package-consumer.tsx', 'public-type-surface.ts'],
    }));
    const packageResult = spawnSync(
      process.execPath,
      [tsc, '-p', packageTsconfigPath],
      { encoding: 'utf8' },
    );
    if (packageResult.status !== 0) {
      process.stderr.write(packageResult.stdout);
      process.stderr.write(packageResult.stderr);
      throw new Error(
        `CRC ${entries.label} package declarations failed the Studio parity fixture.`,
      );
    }
  }
  const result = spawnSync(process.execPath, [tsc, '-p', directory], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error('CRC Studio declarations failed their strict consumer.');
  }
  const foreignRuntimeDirectory = join(directory, 'foreign-runtime');
  await mkdir(foreignRuntimeDirectory, { recursive: true });
  await writeFile(
    join(foreignRuntimeDirectory, 'jsx-runtime.d.ts'),
    foreignRuntimeDeclarations,
  );
  await writeFile(
    join(directory, 'foreign-runtime-consumer.tsx'),
    foreignRuntimeConsumer,
  );
  await writeFile(
    join(directory, 'tsconfig.foreign-runtime.json'),
    JSON.stringify({
      compilerOptions: {
        jsx: 'react-jsx',
        jsxImportSource: '@crc/core',
        lib: ['ESNext', 'DOM'],
        module: 'ESNext',
        moduleResolution: 'Bundler',
        noEmit: true,
        skipLibCheck: false,
        strict: true,
        target: 'ESNext',
      },
      files: ['foreign-runtime-consumer.tsx'],
    }),
  );
  const foreignRuntimeResult = spawnSync(
    process.execPath,
    [tsc, '-p', join(directory, 'tsconfig.foreign-runtime.json')],
    { encoding: 'utf8' },
  );
  const foreignRuntimeOutput =
    foreignRuntimeResult.stdout + foreignRuntimeResult.stderr;
  if (
    foreignRuntimeResult.status === 0 ||
    !foreignRuntimeOutput.includes("not assignable to parameter of type 'CRCNode'")
  ) {
    process.stderr.write(foreignRuntimeOutput);
    throw new Error(
      'CRC Studio declarations did not diagnose a foreign JSX runtime at crc().',
    );
  }
  const sourceRuntime = await studioRuntime('source');
  const builtRuntime = await studioRuntime('built');
  const sourceRuntimeExports = Object.keys(sourceRuntime).sort();
  const builtRuntimeExports = Object.keys(builtRuntime).sort();
  const expectedStudioRuntimeExports = [
    'Absolute',
    'Arc',
    'Circle',
    'Clip',
    'Cube',
    'Ellipse',
    'Flex',
    'Flow',
    'FocusManagement',
    'Fragment',
    'Grid',
    'Group',
    'Group3D',
    'HorizontalLine',
    'Image',
    'KeyboardNavigation',
    'Layer',
    'LayoutDiagnostic',
    'Line',
    'Mesh',
    'Overlay',
    'Path',
    'Polygon',
    'Rectangle',
    'RegularPolygon',
    'Star',
    'Sphere',
    'SvgPath',
    'Text',
    'VerticalLine',
    'Wedge',
    'WebGLLayer',
    'crcAnimationFrame',
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
    'crcPlayback',
    'crcRectPath',
    'crcRef',
    'crcSignal',
    'crcState',
    'crcSvgPath',
    'crcTransition',
    'crcWhenChanged',
    'crcWebGLContext',
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
    'createWebGLGeometry',
    'definePrimitive',
    'defineWebGLPrimitive',
    'defineAnimation',
    'easing',
    'isSignal',
    'keyframes',
    'jsx',
    'jsxDEV',
    'jsxs',
    'layoutDiagnostic',
    'marker',
    'measureElement',
    'normalizeEdges',
    'parallel',
    'repeat',
    'resolveBox',
    'resolveLength',
    'signal',
    'sequence',
    'spring',
    'stepper',
    'track',
    'tween',
    'untracked',
    'wait',
  ].sort();
  if (expectedStudioRuntimeExports.length !== 89) {
    throw new Error(`CRC Studio runtime must expose 77 core values, 9 WebGL values, and 3 compiler values, received ${expectedStudioRuntimeExports.length}.`);
  }
  if (sourceRuntimeExports.join('\n') !== expectedStudioRuntimeExports.join('\n')) {
    throw new Error(
      `CRC Studio source runtime has unexpected exports: ${sourceRuntimeExports.join(', ')}.`,
    );
  }
  if (sourceRuntimeExports.join('\n') !== builtRuntimeExports.join('\n')) {
    throw new Error('CRC Studio source and built runtime surfaces differ.');
  }
  process.stdout.write(
    'CRC Studio declarations passed exact export-name parity, 198-type structural ' +
    'coverage, selected signature parity, strict TSX, compiler-runtime, event-family, ' +
    'generic, and layout checks against source and built packages.\n',
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
