import * as core from '@crc/core';
import * as internal from '@crc/core/internal';
import * as webgl from '@crc/webgl';
import * as gltf from '@crc/webgl/gltf';
import * as webglInternal from '@crc/webgl/internal';
import * as particles from '@crc/particles';
import * as particlesWebGL from '@crc/particles/webgl';
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
  'useCanvasContext',
  'useCursor',
  'useEvent',
  'useEventListener',
  'useEventTarget',
  'useLayoutBox',
  'useLinePath',
  'useMemo',
  'usePlayback',
  'useRectPath',
  'useRef',
  'useSignal',
  'useState',
  'useSvgPath',
  'useTransition',
  'useWhenChanged',
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
  'defineAnimation',
  'definePrimitive',
  'easing',
  'isSignal',
  'keyframes',
  'layoutDiagnostic',
  'marker',
  'measureElement',
  'normalizeEdges',
  'parallel',
  'repeat',
  'resolveBox',
  'resolveLength',
  'sequence',
  'signal',
  'spring',
  'stepper',
  'track',
  'tween',
  'untracked',
  'wait',
].sort();

const actual = Object.keys(core).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`Unexpected @crc/core exports: ${actual.join(', ')}`);
}

const expectedInternal = [
  'cancelBackendMountFrame',
  'crcInternalAssertCommandAllowed',
  'crcInternalCreateSignalConsumer',
  'crcInternalCurrentFrame',
  'crcInternalCurrentRenderOwner',
  'crcInternalOnRenderFinish',
  'crcInternalPaintTarget',
  'crcInternalQueueBegin',
  'crcInternalQueueComplete',
  'crcInternalQueueCurrentCommit',
  'crcInternalQueueCurrentComplete',
  'crcInternalRegisterAdvance',
  'crcInternalRequestRender',
  'crcInternalRequestRendererWork',
  'createBackendToken',
  'defineBackendPrimitive',
  'executeBackendCRC',
  'getBackendEnvironment',
  'getCurrentBackendHostCanvas',
  'getCurrentElementSource',
  'getCurrentFrameTimestamp',
  'getCurrentLogicalViewport',
  'getCurrentSurfaceDensity',
  'hasCRCEventHandler',
  'haveSameLayerNodeTree',
  'isBackendEventTargetLive',
  'materializeRetainedLayerChildren',
  'mountBackendCRC',
  'onCurrentRenderFinish',
  'registerNestedInteractionResolver',
  'releaseBackendEventTarget',
  'requestCurrentInstanceFrame',
  'retainBackendMountRoot',
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
if (actual.length !== 77) {
  throw new Error(`Expected 77 @crc/core runtime exports, received ${actual.length}.`);
}

const runtimeCount = core.signal(2, { debugName: 'runtime count' });
const runtimeReadonly = runtimeCount.asReadonly();
const runtimeComputed = core.computed(() => runtimeReadonly.get() * 3);
if (!core.isSignal(runtimeCount) || !core.isSignal(runtimeReadonly)) {
  throw new Error('Public signal values were not recognized by isSignal().');
}
if (core.untracked(() => runtimeComputed.get()) !== 6) {
  throw new Error('Public computed or untracked behavior was unavailable.');
}
runtimeCount.update(value => value + 1);
if (runtimeComputed.get() !== 9) {
  throw new Error('Public computed values did not update from their dependencies.');
}
const runtimeCallback = core.signal(() => 'ready');
runtimeCallback.set(() => 'updated');
if (runtimeCallback.get()() !== 'updated') {
  throw new Error('Function-valued signals were treated as updater callbacks.');
}
if (typeof internal.createBackendToken('consumer') !== 'object') {
  throw new Error('@crc/core/internal did not create an opaque backend token.');
}

const expectedWebGL = [
  'AmbientLight',
  'Cube',
  'DirectionalLight',
  'Group3D',
  'HemisphereLight',
  'Mesh',
  'Model',
  'PointLight',
  'Sphere',
  'SpotLight',
  'WebGLBackground',
  'WebGLLayer',
  'useAnimationFrame',
  'useOrbitCamera',
  'createWebGLGeometry',
].sort();
const actualWebGL = Object.keys(webgl).sort();
if (JSON.stringify(actualWebGL) !== JSON.stringify(expectedWebGL)) {
  throw new Error(`Unexpected @crc/webgl exports: ${actualWebGL.join(', ')}`);
}
if (actualWebGL.length !== 15) {
  throw new Error(
    `Expected 15 @crc/webgl runtime exports, received ${actualWebGL.length}.`,
  );
}
for (const exportName of expectedWebGL) {
  if (typeof webgl[exportName] !== 'function') {
    throw new Error(`Expected @crc/webgl ${exportName} to be a runtime function.`);
  }
}
const actualWebGLInternal = Object.keys(webglInternal).sort();
if (JSON.stringify(actualWebGLInternal) !== JSON.stringify([
  'submitWebGLInstanced',
])) {
  throw new Error(
    `Unexpected @crc/webgl/internal exports: ${actualWebGLInternal.join(', ')}`,
  );
}
if (typeof webglInternal.submitWebGLInstanced !== 'function') {
  throw new Error('Expected @crc/webgl/internal submission to be callable.');
}
if ('submitWebGLInstanced' in webgl) {
  throw new Error('The official instanced seam leaked from @crc/webgl.');
}
if (JSON.stringify(Object.keys(gltf).sort()) !== JSON.stringify(['useGLTF'])) {
  throw new Error(`Unexpected @crc/webgl/gltf exports: ${Object.keys(gltf).join(', ')}`);
}
if (typeof gltf.useGLTF !== 'function' || 'useGLTF' in webgl) {
  throw new Error('The optional GLB loader entry did not stay isolated from @crc/webgl.');
}

const expectedParticles = [
  'Particles2D',
  'useParticleSystem',
  'defineParticleEffect2D',
  'particleChoice',
  'particleCurve',
  'particleGradient',
  'particleInteger',
  'particleParameter',
  'particleRange',
].sort();
const actualParticles = Object.keys(particles).sort();
if (JSON.stringify(actualParticles) !== JSON.stringify(expectedParticles)) {
  throw new Error(`Unexpected @crc/particles exports: ${actualParticles.join(', ')}`);
}
for (const exportName of expectedParticles) {
  if (typeof particles[exportName] !== 'function') {
    throw new Error(`Expected @crc/particles ${exportName} to be callable.`);
  }
}
const expectedParticlesWebGL = ['Particles3D', 'defineParticleEffect3D'];
const actualParticlesWebGL = Object.keys(particlesWebGL).sort();
if (
  JSON.stringify(actualParticlesWebGL) !==
  JSON.stringify(expectedParticlesWebGL)
) {
  throw new Error(
    `Unexpected @crc/particles/webgl exports: ${actualParticlesWebGL.join(', ')}`,
  );
}
for (const exportName of expectedParticlesWebGL) {
  if (typeof particlesWebGL[exportName] !== 'function') {
    throw new Error(`Expected @crc/particles/webgl ${exportName} to be callable.`);
  }
}
const particleRange = particles.particleRange(1, 2);
if (
  particleRange.type !== 'between' ||
  particleRange.min !== 1 ||
  particleRange.max !== 2 ||
  !Object.isFrozen(particleRange)
) {
  throw new Error('Packed particle descriptors lost their immutable public shape.');
}
const particleEffect2D = particles.defineParticleEffect2D({
  emitters: [{
    name: 'spark',
    capacity: 4,
    emission: [{ type: 'rate', particlesPerSecond: 1 }],
    shape: { type: 'point' },
    initial: { lifetimeMilliseconds: 100 },
    renderer: { type: 'circle' },
  }],
});
const particleEffect3D = particlesWebGL.defineParticleEffect3D({
  emitters: [{
    name: 'ember',
    capacity: 4,
    emission: [{ type: 'rate', particlesPerSecond: 1 }],
    shape: { type: 'point' },
    initial: { lifetimeMilliseconds: 100 },
    renderer: { type: 'point', material: 'emissive', blend: 'additive' },
  }],
});
if (particleEffect2D.dimension !== 2 || particleEffect3D.dimension !== 3) {
  throw new Error('Packed particle definitions lost their dimensional identity.');
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
for (const exportName of expected.filter(exportName => exportName !== 'easing')) {
  if (typeof core[exportName] !== 'function') {
    throw new Error(`Expected @crc/core ${exportName} to be a runtime function.`);
  }
}
if (
  typeof core.easing !== 'object' ||
  Object.isFrozen(core.easing) !== true ||
  typeof core.easing.linear !== 'function'
) {
  throw new Error('Expected @crc/core easing to be a frozen function collection.');
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

const runtimeGeometry = webgl.createWebGLGeometry({
  positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
  normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
});
function RuntimeAnimatedMesh() {
  const timestamp = webgl.useAnimationFrame();
  return core.createElement(webgl.Mesh, {
    geometry: runtimeGeometry,
    pointerEvents: 'none',
    style: { rotationYDegrees: timestamp / 10 },
  });
}
const runtimeWebGLElement = core.createElement(webgl.WebGLLayer, {
  style: { width: 1, height: 1 },
  children: core.createElement(core.Fragment, {
    children: [
      core.createElement(RuntimeAnimatedMesh, {}),
    ],
  }),
});
const runtimeShadowQualities = [false, 'low', 'medium', 'high'];
function RuntimeOrbitScene() {
  const orbit = webgl.useOrbitCamera({
    orbitPoint: [0, 0, 0],
    initialPosition: [0, 2, 5],
    minDistance: 2,
    maxDistance: 12,
    rotateSpeed: 0.8,
    zoomSpeed: 1.2,
  });
  const camera = {
    type: 'perspective',
    position: orbit.position,
    lookAt: orbit.lookAt,
    up: [0, 1, 0],
    fieldOfViewDegrees: 45,
    near: 0.1,
    far: 100,
  };
  return core.createElement(core.Group, {
    ...orbit.handlers,
    children: [
      core.createElement(core.Rectangle, {
        style: { width: 320, height: 180, fill: 'transparent' },
      }),
      ...runtimeShadowQualities.map(shadows =>
        core.createElement(webgl.WebGLLayer, {
          camera,
          children: [
            core.createElement(webgl.WebGLBackground, {
              style: { color: '#08111fcc' },
            }),
            core.createElement(webgl.AmbientLight, {
              style: { color: '#ffffff', intensity: 0.1 },
            }),
            core.createElement(webgl.HemisphereLight, {
              style: {
                skyColor: '#b9dcff',
                groundColor: '#302418',
                intensity: 0.3,
              },
            }),
            core.createElement(webgl.DirectionalLight, {
              style: { color: '#ffffff', intensity: 1.2, castShadow: false },
            }),
            core.createElement(webgl.PointLight, {
              style: {
                color: '#ff8a4c',
                intensity: 4,
                range: 12,
                castShadow: true,
              },
            }),
            core.createElement(webgl.SpotLight, {
              style: {
                color: '#80c8ff',
                intensity: 5,
                range: 20,
                innerConeAngleDegrees: 15,
                outerConeAngleDegrees: 28,
                castShadow: true,
              },
            }),
            core.createElement(webgl.Group3D, {
              children: [
                core.createElement(webgl.Cube, {
                  style: {
                    color: '#74d3ae',
                    material: {
                      type: 'lambert',
                      emissiveColor: '#102040',
                      emissiveIntensity: 0.25,
                    },
                    castShadow: true,
                    receiveShadow: false,
                  },
                }),
                core.createElement(webgl.Sphere, {
                  style: {
                    lit: false,
                    castShadow: false,
                    receiveShadow: true,
                  },
                }),
                core.createElement(webgl.Mesh, {
                  geometry: runtimeGeometry,
                  style: { color: '#f7c948' },
                }),
              ],
            }),
          ],
          style: { width: 320, height: 180, shadows },
        }),
      ),
    ],
  });
}
const runtimeOrbitElement = core.createElement(RuntimeOrbitScene, {});
if (
  runtimeWebGLElement.type !== webgl.WebGLLayer ||
  runtimeWebGLElement.props.children.type !== core.Fragment ||
  runtimeWebGLElement.$$typeof !== Symbol.for('@crc/core.element') ||
  runtimeWebGLElement.props.children.$$typeof !== runtimeWebGLElement.$$typeof ||
  runtimeOrbitElement.$$typeof !== runtimeWebGLElement.$$typeof
) {
  throw new Error(
    '@crc/webgl did not share the @crc/core Fragment and element identity.',
  );
}

for (const specifier of [
  '@crc/core/lib/crc',
  '@crc/core/lib/types',
  '@crc/core/lib/global-state',
  '@crc/core/src/index',
  '@crc/webgl/lib/backend',
  '@crc/webgl/lib/types',
  '@crc/webgl/src/index',
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
