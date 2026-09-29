import { Group, Rectangle, Text, crc, type CRCController } from '@crc/core';
import {
  particleCurve,
  particleGradient,
  particleRange,
} from '@crc/particles';
import { Particles3D, defineParticleEffect3D } from '@crc/particles/webgl';
import { WebGLBackground, WebGLLayer } from '@crc/webgl';

const embers = defineParticleEffect3D({
  debugName: 'learning WebGL embers',
  emitters: [
    {
      name: 'embers',
      capacity: 900,
      overflow: 'recycle-oldest',
      emission: [{ type: 'rate', particlesPerSecond: 110 }],
      shape: { type: 'box', size: [2.8, 0.15, 1.4], sample: 'volume' },
      initial: {
        lifetimeMilliseconds: particleRange(1_800, 3_600),
        velocity: {
          type: 'cone',
          direction: [0, 1, 0],
          speed: particleRange(0.8, 2.4),
          spreadDegrees: particleRange(8, 24),
        },
        size: particleRange(3, 8),
        color: '#ff9a3d',
      },
      motion: [
        { type: 'acceleration', value: [0, 0.35, 0] },
        { type: 'drag', amount: 0.12 },
        {
          type: 'sway',
          direction: [1, 0, 0.35],
          amplitude: particleRange(0.08, 0.28),
          frequency: [0.35, 0.9],
        },
      ],
      appearance: {
        color: particleGradient([
          [0, '#fff3b0'],
          [0.28, '#ff9a3d'],
          [1, '#ef3b24'],
        ]),
        opacity: particleCurve([
          [0, 0],
          [0.08, 1],
          [0.7, 0.85],
          [1, 0],
        ]),
        size: particleCurve([
          [0, 0.35],
          [0.16, 1],
          [1, 0.18],
        ]),
      },
      renderer: {
        type: 'point',
        material: 'emissive',
        blend: 'additive',
        depthTest: true,
        depthWrite: false,
      },
      bounds: { min: [-4, -0.5, -3], max: [4, 6, 3] },
    },
  ],
});

function EmbersStudy() {
  return (
    <Group>
      <Rectangle style={{ width: 720, height: 420, fill: '#030712' }} />
      <WebGLLayer
        camera={{
          type: 'perspective',
          position: [0, 2.2, 8],
          lookAt: [0, 2, 0],
          up: [0, 1, 0],
          fieldOfViewDegrees: 46,
          near: 0.1,
          far: 40,
        }}
        style={{ width: 720, height: 420 }}
      >
        <WebGLBackground style={{ color: '#060814' }} />
        <Particles3D
          effect={embers}
          autoplay
          seed={73}
          pointerEvents="none"
          style={{ translateY: -1.4 }}
        />
      </WebGLLayer>
      <Text
        pointerEvents="none"
        style={{
          left: 30,
          top: 42,
          fill: '#fff3b0',
          font: '900 25px sans-serif',
        }}
      >
        GPU EMBERS
      </Text>
      <Text
        pointerEvents="none"
        style={{
          left: 30,
          top: 67,
          fill: '#fb923c',
          font: '700 12px monospace',
        }}
      >
        EMISSIVE · ADDITIVE · FIXED-CAPACITY INSTANCING
      </Text>
    </Group>
  );
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <EmbersStudy />, { pixelRatio: 1 });
}
