// Concept delta: start
import { Group, Rectangle, crc, type CRCController } from '@crc/core';
import {
  AmbientLight,
  Cube,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  PointLight,
  Sphere,
  SpotLight,
  WebGLBackground,
  WebGLLayer,
  createWebGLGeometry,
  crcOrbitCamera,
  type CRCWebGLShadowQuality,
} from '@crc/webgl';

const cubeLit = true;
const sphereMaterial = { type: 'lambert' } as const;
const sceneBackground = '#07111f';
const layerShadows: CRCWebGLShadowQuality = 'medium';

function ConceptDelta({
  position,
}: {
  readonly position: 'before' | 'after';
}) {
  if (position === 'after') {
    // These late siblings still illuminate every earlier mesh in the scene.
    return (
      <>
        <PointLight
          style={{
            color: '#ff8a5b',
            intensity: 32,
            range: 8,
            translateX: 3,
            translateY: 2.2,
            translateZ: 1.5,
          }}
        />
        <SpotLight
          style={{
            color: '#7dd3fc',
            intensity: 60,
            range: 11,
            innerConeAngleDegrees: 12,
            outerConeAngleDegrees: 25,
            translateX: -3,
            translateY: 3.6,
            translateZ: 3.5,
            rotationXDegrees: -45,
            rotationYDegrees: -18,
          }}
        />
      </>
    );
  }
  return (
    <>
      <AmbientLight style={{ color: '#ffffff', intensity: 0.12 }} />
      <HemisphereLight
        style={{
          skyColor: '#b9dcff',
          groundColor: '#3b271c',
          intensity: 0.28,
        }}
      />
      <DirectionalLight
        style={{
          color: '#fff4de',
          intensity: 0.9,
          rotationXDegrees: -38,
          rotationYDegrees: 42,
        }}
      />
    </>
  );
}
// Concept delta: end

// Shared base scene: start
const groundGeometry = createWebGLGeometry({
  positions: [-4, 0, -3, 4, 0, -3, 4, 0, 3, -4, 0, 3],
  normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
  indices: [0, 2, 1, 0, 3, 2],
});

function LightingLesson() {
  const orbit = crcOrbitCamera({
    orbitPoint: [0, -0.25, 0],
    initialPosition: [5.8, 4.2, 7.8],
    minDistance: 3,
    maxDistance: 18,
  });
  return (
    <Group {...orbit.handlers}>
      <Rectangle
        pointerEvents="none"
        style={{ width: 360, height: 420, fill: '#173047' }}
      />
      <Rectangle
        pointerEvents="none"
        style={{ x: 360, width: 360, height: 420, fill: '#44254f' }}
      />
      <Rectangle style={{ width: 720, height: 420, fill: 'transparent' }} />
      <WebGLLayer
        camera={{
          type: 'perspective',
          position: orbit.position,
          lookAt: orbit.lookAt,
          up: [0, 1, 0],
          fieldOfViewDegrees: 48,
          near: 0.1,
          far: 100,
        }}
        style={{ width: 720, height: 420, shadows: layerShadows }}
      >
        <WebGLBackground style={{ color: sceneBackground }} />
        <ConceptDelta position="before" />
        <Cube
          pointerEvents="none"
          style={{
            size: 1.6,
            translateX: -1.45,
            translateY: -0.05,
            rotationXDegrees: 10,
            rotationYDegrees: -28,
            color: '#f472b6',
            opacity: 1,
            lit: cubeLit,
            material: { type: 'lambert' },
          }}
        />
        <Sphere
          pointerEvents="none"
          style={{
            radius: 0.9,
            translateX: 1.25,
            translateY: -0.1,
            color: '#38bdf8',
            opacity: 1,
            lit: true,
            material: sphereMaterial,
          }}
        />
        <Mesh
          geometry={groundGeometry}
          pointerEvents="none"
          style={{
            translateY: -1.08,
            color: '#64748b',
            opacity: 1,
            lit: true,
            material: { type: 'lambert' },
          }}
        />
        <ConceptDelta position="after" />
      </WebGLLayer>
    </Group>
  );
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <LightingLesson />, { pixelRatio: 1 });
}
// Shared base scene: end
