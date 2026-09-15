// Concept delta: start
import { Rectangle, crc, type CRCController } from '@crc/core';
import {
  Cube,
  Mesh,
  Sphere,
  WebGLBackground,
  WebGLLayer,
  createWebGLGeometry,
} from '@crc/webgl';

const cubeLit = false;
const sphereMaterial = { type: 'lambert' } as const;

function ConceptDelta({
  position,
}: {
  readonly position: 'before' | 'after';
}) {
  if (position === 'after') return null;
  // With no lights, lit geometry is black. The unlit cube keeps its base color.
  return <WebGLBackground style={{ color: '#07111f' }} />;
}
// Concept delta: end

// Shared base scene: start
const groundGeometry = createWebGLGeometry({
  positions: [-4, 0, -3, 4, 0, -3, 4, 0, 3, -4, 0, 3],
  normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
  indices: [0, 2, 1, 0, 3, 2],
});

function LightingLesson() {
  return (
    <>
      <Rectangle
        pointerEvents="none"
        style={{ width: 360, height: 420, fill: '#173047' }}
      />
      <Rectangle
        pointerEvents="none"
        style={{ x: 360, width: 360, height: 420, fill: '#44254f' }}
      />
      <WebGLLayer
        camera={{
          type: 'perspective',
          position: [5.8, 4.2, 7.8],
          lookAt: [0, -0.25, 0],
          up: [0, 1, 0],
          fieldOfViewDegrees: 48,
          near: 0.1,
          far: 100,
        }}
        style={{ width: 720, height: 420 }}
      >
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
    </>
  );
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <LightingLesson />, { pixelRatio: 1 });
}
// Shared base scene: end
