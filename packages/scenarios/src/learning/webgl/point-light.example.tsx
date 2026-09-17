// Concept delta: start
import { Group, Rectangle, crc, type CRCController } from '@crc/core';
import {
  Cube,
  Mesh,
  PointLight,
  Sphere,
  WebGLBackground,
  WebGLLayer,
  createWebGLGeometry,
  useOrbitCamera,
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
  if (position === 'after') return null;
  return (
    <>
      <PointLight
        style={{
          color: '#ffb26b',
          intensity: 45,
          range: 9,
          translateX: -2.6,
          translateY: 2.8,
          translateZ: 2.2,
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
  const orbit = useOrbitCamera({
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
