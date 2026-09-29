import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { parse } from '@babel/parser';
import { build } from 'esbuild';
import { crcRuntimeSource } from './crc-runtime-source.ts';

const repositoryRoot = resolve(import.meta.dirname, '..');
const declarationBundle = await readFile(
  join(repositoryRoot, 'playground/src/crc-editor-types.txt'),
  'utf8',
);
const physicsLessonSource = await readFile(
  join(repositoryRoot, 'packages/scenarios/src/learning/composition/physics-2d.example.tsx'),
  'utf8',
);
const physics3DLessonSource = await readFile(
  join(repositoryRoot, 'packages/scenarios/src/physics-3d.example.tsx'),
  'utf8',
);
const directory = await mkdtemp(join(tmpdir(), 'crc-studio-types-'));
const require = createRequire(import.meta.url);
const tsc = join(dirname(require.resolve('typescript')), 'tsc.js');

const modulePaths = new Map([
  ['@crc/viz', 'node_modules/@crc/viz/index.d.ts'],
  ['@crc/core', 'node_modules/@crc/core/index.d.ts'],
  ['@crc/core/jsx-runtime', 'node_modules/@crc/core/jsx-runtime.d.ts'],
  ['@crc/core/jsx-dev-runtime', 'node_modules/@crc/core/jsx-dev-runtime.d.ts'],
  ['@crc/particles', 'node_modules/@crc/particles/index.d.ts'],
  ['@crc/particles/webgl', 'node_modules/@crc/particles/webgl.d.ts'],
  ['@crc/three', 'node_modules/@crc/three/index.d.ts'],
  ['@crc/physics/2d', 'node_modules/@crc/physics/2d.d.ts'],
  ['@crc/physics/2d/geometry', 'node_modules/@crc/physics/2d/geometry.d.ts'],
  ['@crc/physics/3d', 'node_modules/@crc/physics/3d.d.ts'],
  ['@crc/physics/3d/geometry', 'node_modules/@crc/physics/3d/geometry.d.ts'],
  ['@crc/webgl', 'node_modules/@crc/webgl/index.d.ts'],
  ['@crc/webgl/gltf', 'node_modules/@crc/webgl/gltf.d.ts'],
]);

function readDeclarationModules(bundle) {
  const markers = [...bundle.matchAll(/^\/\* @crc-studio-module (.+) \*\/$/gmu)];
  const modules = markers.map((marker, index) => ({
    moduleName: marker[1],
    content: bundle
      .slice(marker.index + marker[0].length, markers[index + 1]?.index ?? bundle.length)
      .trimStart(),
  }));
  if (
    modules.length !== modulePaths.size ||
    new Set(modules.map(({ moduleName }) => moduleName)).size !== modulePaths.size ||
    modules.some(({ moduleName }) => !modulePaths.has(moduleName))
  ) {
    throw new Error(
      `CRC Studio declarations must define the ${modulePaths.size} package entry points exactly once.`,
    );
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
  [['use', 'State'], 'RemovedStateHook'],
  [['State', 'Updater'], 'RemovedStateUpdater'],
  [['use', 'Memo'], 'RemovedMemoHook'],
  [['use', 'When', 'Changed'], 'RemovedWhenChangedHook'],
]
  .map(
    ([parts, alias]) =>
      '// @ts-expect-error removed authoring export\n' +
      `import type { ${parts.join('')} as ${alias} } from '@crc/core';`,
  )
  .join('\n');

function explicitExportNames(
  source,
  surfaceLabel,
  allowedAmbientModuleNames = new Set(),
  declarationFile = true,
) {
  const sourceFile = parse(source, {
    sourceType: 'module',
    plugins: declarationFile ? [['typescript', { dts: true }]] : ['typescript'],
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
      if (allowedAmbientModuleNames.has(statement.id.value)) continue;
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
  expectedDeclarationFile = true,
  actualDeclarationFile = true,
) {
  const expectedNames = explicitExportNames(
    expectedSource,
    `${expectedLabel} ${moduleName}`,
    new Set(),
    expectedDeclarationFile,
  );
  const actualNames = explicitExportNames(
    actualSource,
    `${actualLabel} ${moduleName}`,
    new Set(),
    actualDeclarationFile,
  );
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
  ['@crc/viz', await readFile(join(repositoryRoot, 'packages/viz/src/index.ts'), 'utf8')],
  ['@crc/core', await readFile(join(repositoryRoot, 'packages/core/src/index.ts'), 'utf8')],
  [
    '@crc/core/jsx-runtime',
    await readFile(join(repositoryRoot, 'packages/core/src/jsx-runtime.ts'), 'utf8'),
  ],
  [
    '@crc/core/jsx-dev-runtime',
    await readFile(join(repositoryRoot, 'packages/core/src/jsx-dev-runtime.ts'), 'utf8'),
  ],
  ['@crc/particles', await readFile(join(repositoryRoot, 'packages/particles/src/index.ts'), 'utf8')],
  ['@crc/particles/webgl', await readFile(join(repositoryRoot, 'packages/particles/src/webgl.ts'), 'utf8')],
  ['@crc/three', await readFile(join(repositoryRoot, 'packages/three/src/index.ts'), 'utf8')],
  ['@crc/webgl', await readFile(join(repositoryRoot, 'packages/webgl/src/index.ts'), 'utf8')],
  [
    '@crc/physics/2d/geometry',
    await readFile(join(repositoryRoot, 'packages/physics/src/2d-geometry.ts'), 'utf8'),
  ],
  [
    '@crc/physics/3d/geometry',
    await readFile(join(repositoryRoot, 'packages/physics/src/3d-geometry.ts'), 'utf8'),
  ],
  ['@crc/webgl/gltf', await readFile(join(repositoryRoot, 'packages/webgl/src/gltf.ts'), 'utf8')],
]);

const builtPackageDeclarationSources = new Map([
  ['@crc/viz', await readFile(join(repositoryRoot, 'packages/viz/dist/index.d.ts'), 'utf8')],
  ['@crc/core', await readFile(join(repositoryRoot, 'packages/core/dist/index.d.ts'), 'utf8')],
  [
    '@crc/core/jsx-runtime',
    await readFile(join(repositoryRoot, 'packages/core/dist/jsx-runtime.d.ts'), 'utf8'),
  ],
  [
    '@crc/core/jsx-dev-runtime',
    await readFile(join(repositoryRoot, 'packages/core/dist/jsx-dev-runtime.d.ts'), 'utf8'),
  ],
  ['@crc/particles', await readFile(join(repositoryRoot, 'packages/particles/dist/index.d.ts'), 'utf8')],
  ['@crc/particles/webgl', await readFile(join(repositoryRoot, 'packages/particles/dist/webgl.d.ts'), 'utf8')],
  ['@crc/three', await readFile(join(repositoryRoot, 'packages/three/dist/index.d.ts'), 'utf8')],
  ['@crc/webgl', await readFile(join(repositoryRoot, 'packages/webgl/dist/index.d.ts'), 'utf8')],
  [
    '@crc/physics/2d/geometry',
    await readFile(join(repositoryRoot, 'packages/physics/dist/2d-geometry.d.ts'), 'utf8'),
  ],
  [
    '@crc/physics/3d/geometry',
    await readFile(join(repositoryRoot, 'packages/physics/dist/3d-geometry.d.ts'), 'utf8'),
  ],
  ['@crc/webgl/gltf', await readFile(join(repositoryRoot, 'packages/webgl/dist/gltf.d.ts'), 'utf8')],
]);

for (const { moduleName, content } of declarationModules) {
  if (moduleName === '@crc/physics/2d' || moduleName === '@crc/physics/3d') continue;
  const packageSource = packageDeclarationSources.get(moduleName);
  const sourceIsDeclarationFile =
    moduleName !== '@crc/physics/2d/geometry' &&
    moduleName !== '@crc/physics/3d/geometry';
  assertExactDeclarationSurface(
    moduleName,
    'source package',
    packageSource,
    'built package',
    builtPackageDeclarationSources.get(moduleName),
    sourceIsDeclarationFile,
  );
  assertExactDeclarationSurface(
    moduleName,
    'source package',
    packageSource,
    'Studio',
    content,
    sourceIsDeclarationFile,
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
  'CRCNodeInput',
  'CRCOpacityFilter',
  'CRCPixelRatio',
  'CRCPointerEvent',
  'CRCPointerEvents',
  'CRCPhysics2DPropExtension',
  'CRCPlayback',
  'CRCPlaybackEvent',
  'CRCPlaybackOptions',
  'CRCPlaybackStatus',
  'CRCPrimitiveComponent',
  'CRCReactionOptions',
  'CRCResponsiveViewportConfig',
  'CRCSpringOptions',
  'CRCSpringTransitionOptions',
  'CRCStepperOptions',
  'CRCSaturateFilter',
  'CRCSepiaFilter',
  'CRCRef',
  'CRCRenderLayerComponentProps',
  'CRCRenderLayerContext',
  'CRCRenderLayerDefinition',
  'CRCRenderLayerFrame',
  'CRCRenderLayerHit',
  'CRCRenderLayerInput',
  'CRCRenderLayerInteraction',
  'CRCRenderLayerInteractionSnapshot',
  'CRCRenderLayerProps',
  'CRCRenderLayerSize',
  'CRCRenderLayerStyle',
  'CRCRenderLayerTarget',
  'CRCRenderResult',
  'CRCTextChild',
  'CRCTextInput',
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
  'SignalValue',
  'Size',
  'SpecifiedStyle',
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
  'CRCSizeQuery',
  'CRCStyleRule',
  'CRCResponsiveStyle',
].sort();

if (publicTypeExports.length !== 194) {
  throw new Error(`CRC Studio must declare exactly 194 core public types, received ${publicTypeExports.length}.`);
}

const publicWebGLTypeExports = [
  'AmbientLightProps',
  'AmbientLightStyle',
  'CRCOrbitCameraHandlers',
  'CRCOrbitCameraOptions',
  'CRCOrbitCameraResult',
  'CRCPhysics3DPropExtension',
  'CRCWebGLAsset',
  'CRCWebGLGeometry',
  'CRCWebGLGeometryInput',
  'CRCWebGLLambertMaterial',
  'CRCWebGLMaterial',
  'CRCWebGLPerspectiveCamera',
  'CRCWebGLShadowQuality',
  'CRCWebGLTransformStyle',
  'CRCWebGLVector3',
  'CubeProps',
  'CubeStyle',
  'DirectionalLightProps',
  'DirectionalLightStyle',
  'Group3DProps',
  'Group3DStyle',
  'HemisphereLightProps',
  'HemisphereLightStyle',
  'MeshProps',
  'MeshStyle',
  'ModelProps',
  'ModelStyle',
  'PointLightProps',
  'PointLightStyle',
  'SphereProps',
  'SphereStyle',
  'SpotLightProps',
  'SpotLightStyle',
  'WebGLBackgroundProps',
  'WebGLBackgroundStyle',
  'WebGLLayerProps',
  'WebGLLayerStyle',
].sort();

if (publicWebGLTypeExports.length !== 37) {
  throw new Error(
    `CRC Studio must declare exactly 37 WebGL public types, received ${publicWebGLTypeExports.length}.`,
  );
}

const publicPhysics2DTypeExports = [
  'CRCPhysicsAabb2D',
  'CRCPhysicsAttachment2D',
  'CRCPhysicsBodyAttachment2D',
  'CRCPhysicsBodyHandle2D',
  'CRCPhysicsBodyStateEvent2D',
  'CRCPhysicsBodyStateHandler2D',
  'CRCPhysicsColliderAttachment2D',
  'CRCPhysicsColliderConfiguration2D',
  'CRCPhysicsColliderHandle2D',
  'CRCPhysicsCollisionEvent2D',
  'CRCPhysicsCollisionFilter',
  'CRCPhysicsCollisionHandler2D',
  'CRCPhysicsContactPoint2D',
  'CRCPhysicsDistance2D',
  'CRCPhysicsDynamicBody2DOptions',
  'CRCPhysicsHitHandler2D',
  'CRCPhysicsKinematicBody2DOptions',
  'CRCPhysicsKinematicTarget2D',
  'CRCPhysicsMassProperties2D',
  'CRCPhysicsOverlapEvent2D',
  'CRCPhysicsOverlapHandler2D',
  'CRCPhysicsPose2D',
  'CRCPhysicsPrimitiveProps2D',
  'CRCPhysicsQueryHit2D',
  'CRCPhysicsQueryMatch2D',
  'CRCPhysicsQueryMode',
  'CRCPhysicsQueryOptions2D',
  'CRCPhysicsQueryResult2D',
  'CRCPhysicsRay2D',
  'CRCPhysicsShape2D',
  'CRCPhysicsShapeContact2D',
  'CRCPhysicsShapeHit2D',
  'CRCPhysicsSolverOptions',
  'CRCPhysicsStaticBody2DOptions',
  'CRCPhysicsTransform2D',
  'CRCPhysicsVector2',
  'CRCPhysicsWorld2DProps',
  'CRCPhysicsWorldHandle2D',
  'Capsule2DProps',
  'Capsule2DStyle',
  'Chain2DProps',
  'Chain2DStyle',
  'PhysicsShape2DProps',
  'PhysicsShape2DStyle',
  'Segment2DProps',
  'Segment2DStyle',
].sort();

const publicPhysics2DValueExports = [
  'Capsule2D',
  'Chain2D',
  'PhysicsShape2D',
  'PhysicsWorld2D',
  'Segment2D',
  'applyForce2D',
  'applyImpulse2D',
  'applyTorque2D',
  'arcShape2D',
  'boundsOfShape2D',
  'boxShape2D',
  'capsuleShape2D',
  'chainShape2D',
  'circleShape2D',
  'collider2D',
  'contactBetweenShapes2D',
  'containsPoint2D',
  'crcPhysicsBody2D',
  'crcPhysicsWorld2D',
  'disableBody2D',
  'distanceBetweenShapes2D',
  'dynamicBody2D',
  'ellipseShape2D',
  'enableBody2D',
  'kinematicBody2D',
  'massProperties2D',
  'overlapShape2D',
  'overlapShapes2D',
  'polygonShape2D',
  'queryAabb2D',
  'queryPoint2D',
  'raycast2D',
  'raycastShape2D',
  'roundedBoxShape2D',
  'segmentShape2D',
  'setAngularVelocity2D',
  'setLinearVelocity2D',
  'shapeCast2D',
  'shapeCastAgainstShape2D',
  'sleepBody2D',
  'staticBody2D',
  'teleportBody2D',
  'transformShape2D',
  'wakeBody2D',
  'wedgeShape2D',
  'withPhysicsShape2D',
].sort();

if (publicPhysics2DTypeExports.length !== 46 || publicPhysics2DValueExports.length !== 46) {
  throw new Error('CRC Studio must declare exactly 46 physics 2D types and 46 physics 2D values.');
}

const physics2DStudioDeclaration = declarationModules.find(
  ({ moduleName }) => moduleName === '@crc/physics/2d',
)?.content;
const physics2DStudioExports = explicitExportNames(
  physics2DStudioDeclaration,
  'Studio @crc/physics/2d',
  new Set(['@crc/core']),
);
const expectedPhysics2DStudioExports = [
  ...publicPhysics2DTypeExports,
  ...publicPhysics2DValueExports,
].sort();
if (physics2DStudioExports.join('\n') !== expectedPhysics2DStudioExports.join('\n')) {
  throw new Error('CRC Studio @crc/physics/2d declaration differs from its fixed public manifest.');
}

const publicPhysics3DTypeExports = [
  'Box3DProps',
  'CRCPhysicsAabb3D',
  'CRCPhysicsAttachment3D',
  'CRCPhysicsAxisLocks3D',
  'CRCPhysicsBodyAttachment3D',
  'CRCPhysicsBodyHandle3D',
  'CRCPhysicsBodyStateEvent3D',
  'CRCPhysicsBodyStateHandler3D',
  'CRCPhysicsColliderAttachment3D',
  'CRCPhysicsColliderConfiguration3D',
  'CRCPhysicsColliderHandle3D',
  'CRCPhysicsCollisionEvent3D',
  'CRCPhysicsCollisionFilter',
  'CRCPhysicsCollisionHandler3D',
  'CRCPhysicsContactPoint3D',
  'CRCPhysicsDistance3D',
  'CRCPhysicsDynamicBody3DOptions',
  'CRCPhysicsHitHandler3D',
  'CRCPhysicsKinematicBody3DOptions',
  'CRCPhysicsKinematicTarget3D',
  'CRCPhysicsMassProperties3D',
  'CRCPhysicsMatrix3',
  'CRCPhysicsOverlapEvent3D',
  'CRCPhysicsOverlapHandler3D',
  'CRCPhysicsPose3D',
  'CRCPhysicsQuaternion',
  'CRCPhysicsQueryHit3D',
  'CRCPhysicsQueryMatch3D',
  'CRCPhysicsQueryMode',
  'CRCPhysicsQueryOptions3D',
  'CRCPhysicsQueryResult3D',
  'CRCPhysicsRay3D',
  'CRCPhysicsShape3D',
  'CRCPhysicsShapeContact3D',
  'CRCPhysicsShapeHit3D',
  'CRCPhysicsSolverOptions',
  'CRCPhysicsStaticBody3DOptions',
  'CRCPhysicsTransform3D',
  'CRCPhysicsVector3',
  'CRCPhysicsWorld3DProps',
  'CRCPhysicsWorldHandle3D',
  'Capsule3DProps',
  'Cone3DProps',
  'ConvexHull3DProps',
  'Cylinder3DProps',
  'Ellipsoid3DProps',
  'Heightfield3DProps',
  'PhysicsShape3DProps',
].sort();

const publicPhysics3DValueExports = [
  'Box3D', 'Capsule3D', 'Cone3D', 'ConvexHull3D', 'Cylinder3D',
  'Ellipsoid3D', 'Heightfield3D', 'PhysicsShape3D', 'PhysicsWorld3D',
  'applyForce3D', 'applyImpulse3D', 'applyTorque3D', 'boundsOfShape3D',
  'boxShape3D', 'capsuleShape3D', 'collider3D', 'coneShape3D',
  'contactBetweenShapes3D', 'containsPoint3D', 'convexHullShape3D',
  'crcPhysicsBody3D', 'crcPhysicsWorld3D', 'cylinderShape3D',
  'disableBody3D', 'distanceBetweenShapes3D', 'dynamicBody3D',
  'ellipsoidShape3D', 'enableBody3D', 'heightfieldShape3D',
  'kinematicBody3D', 'massProperties3D', 'overlapShape3D',
  'overlapShapes3D', 'queryAabb3D', 'queryPoint3D', 'raycast3D',
  'raycastShape3D', 'setAngularVelocity3D', 'setLinearVelocity3D',
  'shapeCast3D', 'shapeCastAgainstShape3D', 'sleepBody3D', 'sphereShape3D',
  'staticBody3D', 'teleportBody3D', 'transformShape3D',
  'triangleMeshShape3D', 'wakeBody3D',
].sort();

if (publicPhysics3DTypeExports.length !== 48 || publicPhysics3DValueExports.length !== 48) {
  throw new Error('CRC Studio must declare exactly 48 physics 3D types and 48 physics 3D values.');
}
const physics3DStudioDeclaration = declarationModules.find(
  ({ moduleName }) => moduleName === '@crc/physics/3d',
)?.content;
const physics3DStudioExports = explicitExportNames(
  physics3DStudioDeclaration,
  'Studio @crc/physics/3d',
  new Set(['@crc/core', '@crc/webgl']),
);
const expectedPhysics3DStudioExports = [
  ...publicPhysics3DTypeExports,
  ...publicPhysics3DValueExports,
].sort();
if (physics3DStudioExports.join('\n') !== expectedPhysics3DStudioExports.join('\n')) {
  throw new Error('CRC Studio @crc/physics/3d declaration differs from its fixed public manifest.');
}

const publicThreeTypeExports = [
  'CRCThreeInputBridge',
  'CRCThreeLayerContext',
  'CRCThreeLayerDefinition',
  'CRCThreeLayerResources',
  'CRCThreePicker',
  'CRCThreePickResult',
  'CRCThreeRendererOptions',
  'CRCThreeTarget',
].sort();

if (publicThreeTypeExports.length !== 8) {
  throw new Error(`CRC Studio must declare exactly 8 Three public types, received ${publicThreeTypeExports.length}.`);
}

const publicGLTFTypeExports = [
  'CRCGLTFSource',
  'CRCWebGLAssetLoadResult',
].sort();

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
  ['@crc/three', publicThreeTypeExports],
  ['@crc/webgl', publicWebGLTypeExports],
  ['@crc/webgl/gltf', publicGLTFTypeExports],
]) {
  const packageTypeExports = explicitTypeExportNames(packageDeclarationSources.get(moduleName));
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
  ${publicThreeTypeExports.join(',\n  ')}
} from '@crc/three';
import type {
  ${publicWebGLTypeExports.join(',\n  ')}
} from '@crc/webgl';
import type {
  ${publicPhysics2DTypeExports.join(',\n  ')}
} from '@crc/physics/2d';
import type {
  ${publicPhysics3DTypeExports.map((name) =>
    ['CRCPhysicsCollisionFilter', 'CRCPhysicsQueryMode', 'CRCPhysicsSolverOptions'].includes(name)
      ? `${name} as ${name}3D`
      : name,
  ).join(',\n  ')}
} from '@crc/physics/3d';
import type {
  ${publicGLTFTypeExports.join(',\n  ')}
} from '@crc/webgl/gltf';
`;

const consumer = `
${removedAuthoringImports}
// @ts-expect-error ordinary Studio examples cannot import the version-coupled friend entry
import type { CRCInternalFrame } from '@crc/core/internal';
import * as CRC_CORE_ROOT from '@crc/core';
import * as CRC_THREE_ROOT from '@crc/three';
import * as CRC_WEBGL_ROOT from '@crc/webgl';
import { useGLTF, type CRCGLTFSource, type CRCWebGLAssetLoadResult } from '@crc/webgl/gltf';
import {
  Absolute,
  batch,
  Clip,
  computed,
  crc,
  useCanvasContext,
  useComputed,
  useConst,
  useCursor,
  useEvent,
  useEventListener,
  useEventTarget,
  useLinePath,
  usePlayback,
  useReaction,
  useRectPath,
  useSignal,
  useTransition,
  createElement,
  defineAnimation,
  definePrimitive,
  defineRenderLayer,
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
  Layer,
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
  resolveSignalValue,
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
  type CRCNodeInput,
  type CRCPlayback,
  type CRCPixelRatio,
  type CRCPointerEvent,
  type CRCPointerEvents,
  type CRCReactionOptions,
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
  type SignalValue,
  type SystemStyle,
  type WritableSignal,
  untracked,
} from '@crc/core';
import {
  defineThreeLayer,
  type CRCThreeLayerResources,
} from '@crc/three';
import { PerspectiveCamera, Scene } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { jsx, jsxs } from '@crc/core/jsx-runtime';
import { jsxDEV } from '@crc/core/jsx-dev-runtime';
import {
  AmbientLight,
  useAnimationFrame,
  useOrbitCamera,
  createWebGLGeometry,
  Cube,
  DirectionalLight,
  Group3D,
  HemisphereLight,
  Mesh,
  Model,
  PointLight,
  Sphere,
  SpotLight,
  WebGLBackground,
  WebGLLayer,
  type AmbientLightProps,
  type AmbientLightStyle,
  type CRCOrbitCameraHandlers,
  type CRCOrbitCameraOptions,
  type CRCOrbitCameraResult,
  type CRCWebGLLambertMaterial,
  type CRCWebGLMaterial,
  type CRCWebGLPerspectiveCamera,
  type CRCWebGLShadowQuality,
  type CubeProps,
  type CubeStyle,
  type DirectionalLightProps,
  type DirectionalLightStyle,
  type Group3DProps,
  type Group3DStyle,
  type HemisphereLightProps,
  type HemisphereLightStyle,
  type MeshProps,
  type MeshStyle,
  type ModelProps,
  type ModelStyle,
  type PointLightProps,
  type PointLightStyle,
  type SphereProps,
  type SphereStyle,
  type SpotLightProps,
  type SpotLightStyle,
  type WebGLBackgroundProps,
  type WebGLBackgroundStyle,
  type WebGLLayerProps,
  type WebGLLayerStyle,
} from '@crc/webgl';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;

type StudioSignatureParity = [
  Assert<Equal<typeof Fragment, (props: { children?: CRCNodeInput }) => CRCNodeInput>>,
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
  Assert<Equal<typeof batch, <T>(callback: () => T) => T>>,
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
  Assert<Equal<typeof resolveSignalValue, <T>(value: SignalValue<T>) => T>>,
  Assert<Equal<typeof useConst, <T>(create: () => T) => T>>,
  Assert<Equal<
    typeof useComputed,
    <T>(compute: () => T, dependencies?: readonly unknown[], options?: SignalOptions<T>) => Signal<T>
  >>,
  Assert<Equal<
    typeof useSignal,
    <T>(initialValue: T, options?: SignalOptions<T>) => WritableSignal<T>
  >>,
  Assert<Equal<
    typeof useReaction,
    (setup: () => (() => void) | void, dependencies?: readonly unknown[], options?: CRCReactionOptions) => void
  >>,
  Assert<Equal<
    typeof useCursor,
    (options: {
      path?: Path2D;
      style?: string;
      fill?: boolean;
      lineInteractionWidth?: number;
    }) => void
  >>,
  Assert<Equal<
    typeof useLinePath,
    (
      coords: [number, number][],
      config?: { closePath?: boolean },
    ) => Path2D
  >>,
  Assert<Equal<
    typeof useRectPath,
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

const studioGeometry = createWebGLGeometry({
  positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
  normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
});
const studioShadowQualities = [false, 'low', 'medium', 'high'] as const satisfies
  readonly CRCWebGLShadowQuality[];
function StudioWebGLScene(): CRCNode {
  const orbitOptions: CRCOrbitCameraOptions = {
    orbitPoint: [0, 0, 0],
    initialPosition: [0, 2, 5],
    minDistance: 2,
    maxDistance: 12,
    rotateSpeed: 0.8,
    zoomSpeed: 1.2,
  };
  const orbit: CRCOrbitCameraResult = useOrbitCamera(orbitOptions);
  const handlers: CRCOrbitCameraHandlers = orbit.handlers;
  const camera: CRCWebGLPerspectiveCamera = {
    type: 'perspective',
    position: orbit.position,
    lookAt: orbit.lookAt,
    up: [0, 1, 0],
    fieldOfViewDegrees: 45,
    near: 0.1,
    far: 100,
  };
  const material: CRCWebGLMaterial = {
    type: 'lambert',
    emissiveColor: '#102040',
    emissiveIntensity: 0.25,
  } satisfies CRCWebGLLambertMaterial;
  return (
    <Group {...handlers}>
      <Rectangle style={{ width: 320, height: 180, fill: 'transparent' }} />
      <WebGLLayer
        style={{ width: 320, height: 180, shadows: studioShadowQualities[2] }}
        camera={camera}
      >
        <WebGLBackground style={{ color: '#08111fcc' }} />
        <AmbientLight style={{ color: '#ffffff', intensity: 0.1 }} />
        <HemisphereLight
          style={{
            skyColor: '#b9dcff',
            groundColor: '#302418',
            intensity: 0.3,
            rotationZDegrees: 5,
          }}
        />
        <DirectionalLight
          style={{
            color: '#ffffff',
            intensity: 1.2,
            rotationXDegrees: -35,
            rotationYDegrees: 45,
            castShadow: false,
          }}
        />
        <PointLight
          style={{
            color: '#ff8a4c',
            intensity: 4,
            range: 12,
            translateX: 3,
            translateY: 4,
            translateZ: 2,
            castShadow: true,
          }}
        />
        <SpotLight
          style={{
            color: '#80c8ff',
            intensity: 5,
            range: 20,
            innerConeAngleDegrees: 15,
            outerConeAngleDegrees: 28,
            translateX: -3,
            translateY: 5,
            translateZ: 4,
            rotationXDegrees: -40,
            castShadow: true,
          }}
        />
        <Group3D style={{ rotationYDegrees: 15 }}>
          <Cube
            style={{
              size: 1,
              color: '#74d3ae',
              material,
              castShadow: true,
              receiveShadow: false,
            }}
          />
          <Sphere
            style={{
              radius: 0.5,
              translateX: 1,
              lit: false,
              castShadow: false,
              receiveShadow: true,
            }}
          />
          <Mesh geometry={studioGeometry} style={{ color: '#f7c948' }} />
        </Group3D>
      </WebGLLayer>
    </Group>
  );
}
const webglScene = <StudioWebGLScene />;
void webglScene;
// @ts-expect-error light declarations reject arbitrary component props
const ambientLightWithChildren: AmbientLightProps = { children: [] };
// @ts-expect-error light declarations reject arbitrary component props
const hemisphereLightWithChildren: HemisphereLightProps = { children: [] };
// @ts-expect-error light declarations reject arbitrary component props
const directionalLightWithChildren: DirectionalLightProps = { children: [] };
// @ts-expect-error light declarations reject arbitrary component props
const pointLightWithChildren: PointLightProps = { children: [] };
// @ts-expect-error light declarations reject arbitrary component props
const spotLightWithChildren: SpotLightProps = { children: [] };
// @ts-expect-error background declarations reject arbitrary component props
const backgroundWithChildren: WebGLBackgroundProps = { children: [] };
void [
  ambientLightWithChildren,
  hemisphereLightWithChildren,
  directionalLightWithChildren,
  pointLightWithChildren,
  spotLightWithChildren,
  backgroundWithChildren,
];
// @ts-expect-error filters belong on WebGLLayer, never inner WebGL geometry
const filteredCube = <Cube style={{ filter: { type: 'blur', radius: 2 } }} />;
// @ts-expect-error filters belong on WebGLLayer, never light declarations
const filteredAmbientLight = <AmbientLight style={{ filter: { type: 'blur', radius: 2 } }} />;
// @ts-expect-error filters belong on WebGLLayer, never background declarations
const filteredWebGLBackground = <WebGLBackground style={{ color: '#08111f', filter: { type: 'blur', radius: 2 } }} />;
void [filteredCube, filteredAmbientLight, filteredWebGLBackground];
void CRC_WEBGL_ROOT.useAnimationFrame;
void CRC_WEBGL_ROOT.useOrbitCamera;
void useGLTF;
type StudioGLTFTypes = [CRCGLTFSource, CRCWebGLAssetLoadResult];
void (undefined as unknown as StudioGLTFTypes);
void useAnimationFrame;
type StudioWebGLTypes = [
  AmbientLightProps,
  AmbientLightStyle,
  CRCOrbitCameraHandlers,
  CRCOrbitCameraOptions,
  CRCOrbitCameraResult,
  CRCWebGLLambertMaterial,
  CRCWebGLMaterial,
  CRCWebGLPerspectiveCamera,
  CRCWebGLShadowQuality,
  CubeProps,
  CubeStyle,
  DirectionalLightProps,
  DirectionalLightStyle,
  Group3DProps,
  Group3DStyle,
  HemisphereLightProps,
  HemisphereLightStyle,
  MeshProps,
  MeshStyle,
  PointLightProps,
  PointLightStyle,
  SphereProps,
  SphereStyle,
  SpotLightProps,
  SpotLightStyle,
  WebGLBackgroundProps,
  WebGLBackgroundStyle,
  WebGLLayerProps,
  WebGLLayerStyle,
];
void (null as unknown as StudioWebGLTypes);

const fragmentResult: CRCNodeInput = Fragment({ children: false });
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
  const value = useSignal('hook value');
  return <Text>{value.get()}</Text>;
}
void <StudioSignalHook />;

function StudioAnimationHook(): CRCNode {
  const x = useSignal(0);
  const alpha = useTransition(1, {
    type: 'tween',
    duration: 120,
  });
  const sprung = useTransition(20, { type: 'spring' });
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
  const playback: CRCPlayback = usePlayback(program);
  const interpolatePoint: CRCInterpolator<{ x: number }> = (from, to, progress) => ({
    x: from.x + (to.x - from.x) * progress,
  });
  void useTransition({ x: 1 }, {
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

const structuralEventProps = (
  <>
    <Group onWheel={eventHandlers.onWheel}>
      <Rectangle style={{ width: 20, height: 20 }} />
    </Group>
    <Clip onWheelCapture={eventHandlers.onWheel} style={{ d: new Path2D() }}>
      <Rectangle style={{ width: 20, height: 20 }} />
    </Clip>
    <Layer onPointerDown={eventHandlers.onPointerDown} style={{ width: 20, height: 20 }}>
      <Rectangle style={{ width: 20, height: 20 }} />
    </Layer>
    <Absolute onMouseDown={eventHandlers.onMouseDown}>
      <Rectangle style={{ width: 20, height: 20 }} />
    </Absolute>
    <Overlay onTouchStart={eventHandlers.onTouchStart}>
      <Rectangle style={{ width: 20, height: 20 }} />
    </Overlay>
    <Flow onKeyDownCapture={eventHandlers.onKeyDownCapture}>
      <Rectangle style={{ width: 20, height: 20 }} />
    </Flow>
    <Flex onFocus={eventHandlers.onFocus}>
      <Rectangle style={{ width: 20, height: 20 }} />
    </Flex>
    <Grid
      onCopyCapture={eventHandlers.onCopyCapture}
      style={{ gridTemplateColumns: [20], gridTemplateRows: [20] }}
    >
      <Rectangle style={{ width: 20, height: 20 }} />
    </Grid>
  </>
);
void structuralEventProps;

function EventProbe(): CRCNode {
  const snapshot: CRCEventTargetSnapshot = useEventTarget(eventHandlers, {
    path: new Path2D(),
    fill: true,
  });
  useEventListener({ onPointerDownCapture: eventHandlers.onPointerDown });
  void snapshot.isFocused;
  const context: RenderingContext2D = useCanvasContext();
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

useReaction(() => undefined);
useCursor({});
useLinePath(mutableLineCoordinates, { closePath: true });
// @ts-expect-error line-path configuration is an object, not a boolean flag
useLinePath(mutableLineCoordinates, true);
useRectPath(0, 0, 40, 20, {
  alignToPixelGrid: 'round',
  lineWidth: 2,
});
// @ts-expect-error rectangle alignment and line width belong to the config object
useRectPath(0, 0, 40, 20, 'round', 2);

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
useEvent('click', logicalMouseHandler, new Path2D());
const canvasObserver = (event: CRCMouseEvent) => void event.x;
useEvent('mousemove', canvasObserver);
useEvent('mousemove', event => {
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

const StudioThreeLayer = defineThreeLayer<
  { exposure: number },
  CRCThreeLayerResources
>({
  create() {
    return { scene: new Scene(), camera: new PerspectiveCamera() };
  },
});
const studioThreeLayer = (
  <StudioThreeLayer
    exposure={1}
    missBehavior="block"
    style={{
      width: 80,
      height: 60,
      filter: { type: 'blur', radius: 1 },
    }}
  />
);
void CRC_THREE_ROOT;
void OrbitControls;
void studioThreeLayer;

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
  const context = { EventTarget };
  runInNewContext(JSON.parse(serializedRuntime), context);
  const runtime = context.CRC_CORE;
  if (!runtime) throw new Error(`CRC Studio ${mode} runtime did not initialize.`);
  return runtime;
}

function assertStudioRuntimeModules(runtime, mode) {
  const modules = runtime.__crcStudioModules;
  const expectedModuleNames = [
    '@crc/three',
    'three',
    'three/addons/controls/OrbitControls.js',
  ];
  if (
    !modules ||
    Object.keys(modules).sort().join('\n') !== expectedModuleNames.join('\n')
  ) {
    throw new Error(`CRC Studio ${mode} runtime has unexpected sandbox modules.`);
  }
  if (Object.keys(modules['@crc/three']).join('\n') !== 'defineThreeLayer') {
    throw new Error(`CRC Studio ${mode} @crc/three namespace must expose defineThreeLayer only.`);
  }
  const expectedThreeExports = [
    'Color',
    'HemisphereLight',
    'IcosahedronGeometry',
    'InstancedMesh',
    'Matrix4',
    'Mesh',
    'MeshPhongMaterial',
    'PerspectiveCamera',
    'Raycaster',
    'Scene',
    'Vector2',
  ];
  if (
    Object.keys(modules.three).sort().join('\n') !==
    expectedThreeExports.join('\n')
  ) {
    throw new Error(`CRC Studio ${mode} runtime has unexpected Three exports.`);
  }
  if (
    Object.keys(modules['three/addons/controls/OrbitControls.js']).join('\n') !==
    'OrbitControls'
  ) {
    throw new Error(`CRC Studio ${mode} runtime has unexpected OrbitControls exports.`);
  }
  if (modules['@crc/three'].defineThreeLayer !== runtime.defineThreeLayer) {
    throw new Error(`CRC Studio ${mode} runtime duplicated defineThreeLayer identity.`);
  }
}

async function assertBuiltCoreBundlesWithoutWarnings() {
  const result = await build({
    entryPoints: [join(repositoryRoot, 'packages/core/dist/index.mjs')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    write: false,
    logLevel: 'silent',
  });
  assert.deepEqual(
    result.warnings,
    [],
    'The built @crc/core entry point must remain warning-free when bundled for the Studio.',
  );
}

try {
  await assertBuiltCoreBundlesWithoutWarnings();
  for (const { moduleName, content } of declarationModules) {
    const declarationPath = join(directory, modulePaths.get(moduleName));
    await mkdir(dirname(declarationPath), { recursive: true });
    await writeFile(declarationPath, content);
  }
  await writeFile(join(directory, 'responsive-styles.tsx'), await readFile(join(repositoryRoot, 'playground/package-consumer/responsive-styles.tsx'), 'utf8'));
  await writeFile(join(directory, 'consumer.tsx'), consumer);
  await writeFile(join(directory, 'package-consumer.tsx'), packageConsumer);
  for (const [filename, slug] of [['viz-points.tsx', 'viz-points-and-inspection'], ['viz-hover.tsx', 'viz-hover-comparison']]) {
    await writeFile(join(directory, filename), await readFile(join(repositoryRoot, `packages/scenarios/src/learning/composition/${slug}.example.tsx`), 'utf8'));
  }
  await writeFile(join(directory, 'viz-lesson.tsx'), await readFile(join(repositoryRoot, 'packages/scenarios/src/learning/composition/viz-responsive-line.example.tsx'), 'utf8'));
  await writeFile(join(directory, 'physics-lesson.tsx'), physicsLessonSource);
  await writeFile(join(directory, 'physics-3d-lesson.tsx'), physics3DLessonSource);
  await writeFile(join(directory, 'public-type-surface.ts'), publicTypeSurfaceConsumer);
  await writeFile(
    join(directory, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        jsx: 'react-jsx',
        jsxImportSource: '@crc/core',
        lib: ['ESNext', 'DOM'],
        module: 'ESNext',
        moduleResolution: 'Bundler',
        noEmit: true,
        paths: {
          three: [join(repositoryRoot, 'packages/three/node_modules/@types/three/index.d.ts')],
          'three/addons/controls/OrbitControls.js': [join(repositoryRoot, 'packages/three/node_modules/@types/three/examples/jsm/controls/OrbitControls.d.ts')],
        },
        skipLibCheck: false,
        strict: true,
        target: 'ESNext',
      },
      files: ['responsive-styles.tsx', 'viz-lesson.tsx', 'viz-points.tsx', 'viz-hover.tsx', 'consumer.tsx', 'physics-lesson.tsx', 'physics-3d-lesson.tsx', 'public-type-surface.ts'],
    }),
  );
  const packageEntrySets = [
    {
      label: 'source',
      viz: join(repositoryRoot, 'packages/viz/src/index.ts'),
      root: join(repositoryRoot, 'packages/core/src/index.ts'),
      internal: join(repositoryRoot, 'packages/core/src/internal.ts'),
      jsxRuntime: join(repositoryRoot, 'packages/core/src/jsx-runtime.ts'),
      jsxDevRuntime: join(repositoryRoot, 'packages/core/src/jsx-dev-runtime.ts'),
      particles: join(repositoryRoot, 'packages/particles/src/index.ts'),
      particlesWebGL: join(repositoryRoot, 'packages/particles/src/webgl.ts'),
      three: join(repositoryRoot, 'packages/three/src/index.ts'),
      physics2d: join(repositoryRoot, 'packages/physics/src/2d.ts'),
      physicsGeometry: join(repositoryRoot, 'packages/physics/src/2d-geometry.ts'),
      physics3d: join(repositoryRoot, 'packages/physics/src/3d.ts'),
      physics3dGeometry: join(repositoryRoot, 'packages/physics/src/3d-geometry.ts'),
      webgl: join(repositoryRoot, 'packages/webgl/src/index.ts'),
      gltf: join(repositoryRoot, 'packages/webgl/src/gltf.ts'),
    },
    {
      label: 'built',
      viz: join(repositoryRoot, 'packages/viz/dist/index.d.ts'),
      root: join(repositoryRoot, 'packages/core/dist/index.d.ts'),
      internal: join(repositoryRoot, 'packages/core/dist/internal.d.ts'),
      jsxRuntime: join(repositoryRoot, 'packages/core/dist/jsx-runtime.d.ts'),
      jsxDevRuntime: join(repositoryRoot, 'packages/core/dist/jsx-dev-runtime.d.ts'),
      particles: join(repositoryRoot, 'packages/particles/dist/index.d.ts'),
      particlesWebGL: join(repositoryRoot, 'packages/particles/dist/webgl.d.ts'),
      three: join(repositoryRoot, 'packages/three/dist/index.d.ts'),
      physics2d: join(repositoryRoot, 'packages/physics/dist/2d.d.ts'),
      physicsGeometry: join(repositoryRoot, 'packages/physics/dist/2d-geometry.d.ts'),
      physics3d: join(repositoryRoot, 'packages/physics/dist/3d.d.ts'),
      physics3dGeometry: join(repositoryRoot, 'packages/physics/dist/3d-geometry.d.ts'),
      webgl: join(repositoryRoot, 'packages/webgl/dist/index.d.ts'),
      gltf: join(repositoryRoot, 'packages/webgl/dist/gltf.d.ts'),
    },
  ];
  for (const entries of packageEntrySets) {
    const packageTsconfigPath = join(
      directory,
      `tsconfig.package-${entries.label}.json`,
    );
    await writeFile(
      packageTsconfigPath,
      JSON.stringify({
        compilerOptions: {
          jsx: 'react-jsx',
          jsxImportSource: '@crc/core',
          lib: ['ESNext', 'DOM'],
          module: 'ESNext',
          moduleResolution: 'Bundler',
          noEmit: true,
          paths: {
            '@crc/core': [entries.root],
            '@crc/viz': [entries.viz],
            '@crc/core/internal': [entries.internal],
            '@crc/core/jsx-runtime': [entries.jsxRuntime],
            '@crc/core/jsx-dev-runtime': [entries.jsxDevRuntime],
            '@crc/particles': [entries.particles],
            '@crc/particles/webgl': [entries.particlesWebGL],
            '@crc/physics/2d': [entries.physics2d],
            '@crc/physics/2d/geometry': [entries.physicsGeometry],
            '@crc/physics/3d': [entries.physics3d],
            '@crc/physics/3d/geometry': [entries.physics3dGeometry],
            '@crc/three': [entries.three],
            '@crc/webgl': [entries.webgl],
            '@crc/webgl/gltf': [entries.gltf],
            three: [join(repositoryRoot, 'packages/three/node_modules/@types/three/index.d.ts')],
            'three/addons/controls/OrbitControls.js': [join(repositoryRoot, 'packages/three/node_modules/@types/three/examples/jsm/controls/OrbitControls.d.ts')],
          },
          skipLibCheck: false,
          strict: true,
          target: 'ESNext',
        },
        files: ['viz-lesson.tsx', 'viz-points.tsx', 'viz-hover.tsx', 'package-consumer.tsx', 'physics-lesson.tsx', 'physics-3d-lesson.tsx', 'public-type-surface.ts'],
      }),
    );
    const packageResult = spawnSync(process.execPath, [tsc, '-p', packageTsconfigPath], {
      encoding: 'utf8',
    });
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
  await writeFile(join(foreignRuntimeDirectory, 'jsx-runtime.d.ts'), foreignRuntimeDeclarations);
  await writeFile(join(directory, 'foreign-runtime-consumer.tsx'), foreignRuntimeConsumer);
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
  const foreignRuntimeOutput = foreignRuntimeResult.stdout + foreignRuntimeResult.stderr;
  if (
    foreignRuntimeResult.status === 0 ||
    !foreignRuntimeOutput.includes("not assignable to parameter of type 'CRCNode'")
  ) {
    process.stderr.write(foreignRuntimeOutput);
    throw new Error('CRC Studio declarations did not diagnose a foreign JSX runtime at crc().');
  }
  const sourceRuntime = await studioRuntime('source');
  const builtRuntime = await studioRuntime('built');
  assertStudioRuntimeModules(sourceRuntime, 'source');
  assertStudioRuntimeModules(builtRuntime, 'built');
  const sourceRuntimeExports = Object.keys(sourceRuntime).sort();
  const builtRuntimeExports = Object.keys(builtRuntime).sort();
  const expectedStudioRuntimeExports = [
    'Scale', 'Axis', 'LineSeries', 'ScaleAdjust', 'useScale',
    'PointSeries', 'PlotSeries', 'nearestPoint', 'nearestDomainValue',
    'HoverData', 'HoverCard', 'AnchoredLayout', 'defineSeries', 'closestPoint', 'closestX',
    'interpolateX', 'linearInterpolation',
    '__crcStudioModules',
    ...publicPhysics2DValueExports,
    ...publicPhysics3DValueExports,
    'Absolute',
    'AmbientLight',
    'Arc',
    'Circle',
    'Clip',
    'Cube',
    'DirectionalLight',
    'Ellipse',
    'Flex',
    'Flow',
    'FocusManagement',
    'Fragment',
    'Grid',
    'Group',
    'Group3D',
    'HemisphereLight',
    'HorizontalLine',
    'Image',
    'KeyboardNavigation',
    'Layer',
    'LayoutDiagnostic',
    'Line',
    'Mesh',
    'Model',
    'Overlay',
    'Path',
    'Polygon',
    'PointLight',
    'Rectangle',
    'RegularPolygon',
    'Star',
    'Sphere',
    'SpotLight',
    'SvgPath',
    'Text',
    'VerticalLine',
    'Wedge',
    'WebGLBackground',
    'WebGLLayer',
    'useAnimationFrame',
    'useOrbitCamera',
    'useGLTF',
    'batch',
    'computed',
    'crc',
    'useCanvasContext',
    'useComputed',
    'useConst',
    'useCursor',
    'useEvent',
    'useEventListener',
    'useEventTarget',
    'useLayoutBox',
    'useLinePath',
    'usePlayback',
    'useReaction',
    'useRectPath',
    'useRef',
    'useSignal',
    'useSvgPath',
    'useTransition',
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
    'defineThreeLayer',
    'definePrimitive',
    'defineAnimation',
    'defineRenderLayer',
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
    'Particles2D',
    'Particles3D',
    'useParticleSystem',
    'defineParticleEffect2D',
    'defineParticleEffect3D',
    'particleChoice',
    'particleCurve',
    'particleGradient',
    'particleInteger',
    'particleParameter',
    'particleRange',
    'repeat',
    'resolveBox',
    'resolveLength',
    'resolveSignalValue',
    'signal',
    'sequence',
    'spring',
    'stepper',
    'track',
    'tween',
    'untracked',
    'wait',
  ].sort();
  if (expectedStudioRuntimeExports.length !== 223) {
    throw new Error(
      `CRC Studio runtime must expose 80 core values, 46 physics 2D values, 48 physics 3D values, 1 Three adapter value, 1 sandbox module registry, 15 WebGL values, 1 GLB loader value, 11 particle values, 17 visualization values, and 3 compiler values, received ${expectedStudioRuntimeExports.length}.`,
    );
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
    'CRC Studio declarations passed exact export-name parity, 329-type structural ' +
      'coverage, selected signature parity, strict TSX, compiler-runtime, event-family, ' +
      'generic, and layout checks against source and built packages.\n',
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
