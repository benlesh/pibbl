import { Group, Rectangle, Text, crc, type CRCController } from '@crc/core';
import {
  particleCurve,
  particleGradient,
  particleRange,
} from '@crc/particles';
import { Particles3D, defineParticleEffect3D } from '@crc/particles/webgl';
import { WebGLBackground, WebGLLayer } from '@crc/webgl';

const fireflies = defineParticleEffect3D({
  debugName: 'learning WebGL fireflies',
  emitters: [
    {
      name: 'fireflies',
      capacity: 480,
      overflow: 'recycle-oldest',
      emission: [{ type: 'rate', particlesPerSecond: 55 }],
      shape: { type: 'box', size: [8, 4.2, 3], sample: 'volume' },
      initial: {
        lifetimeMilliseconds: particleRange(5_500, 8_000),
        velocity: [
          particleRange(-0.09, 0.09),
          particleRange(-0.03, 0.08),
          particleRange(-0.06, 0.06),
        ],
        size: particleRange(3, 6),
        color: '#d9ff74',
      },
      motion: [
        {
          type: 'sway',
          direction: [1, 0.35, 0.2],
          amplitude: particleRange(0.08, 0.42),
          frequency: [0.15, 0.55],
        },
        { type: 'drag', amount: 0.08 },
      ],
      appearance: {
        color: particleGradient([
          [0, '#fff7ae'],
          [0.5, '#d9ff74'],
          [1, '#7df9a4'],
        ]),
        opacity: particleCurve([
          [0, 0],
          [0.08, 0.95],
          [0.28, 0.2],
          [0.48, 1],
          [0.7, 0.25],
          [0.9, 0.9],
          [1, 0],
        ]),
      },
      renderer: {
        type: 'point',
        material: 'emissive',
        blend: 'additive',
        depthTest: true,
        depthWrite: false,
      },
      bounds: { min: [-5, -3, -3], max: [5, 3, 3] },
    },
  ],
});

function FirefliesStudy() {
  return (
    <Group>
      <Rectangle style={{ width: 720, height: 420, fill: '#04110d' }} />
      <WebGLLayer
        camera={{
          type: 'perspective',
          position: [0, 0.4, 9],
          lookAt: [0, 0, 0],
          up: [0, 1, 0],
          fieldOfViewDegrees: 48,
          near: 0.1,
          far: 40,
        }}
        style={{ width: 720, height: 420 }}
      >
        <WebGLBackground style={{ color: '#061811' }} />
        <Particles3D
          effect={fireflies}
          autoplay
          seed={2026}
          pointerEvents="none"
        />
      </WebGLLayer>
      <Text
        pointerEvents="none"
        style={{
          x: 30,
          y: 42,
          fill: '#eaffaa',
          font: '900 25px sans-serif',
        }}
      >
        FIREFLIES
      </Text>
      <Text
        pointerEvents="none"
        style={{
          x: 30,
          y: 67,
          fill: '#86efac',
          font: '700 12px monospace',
        }}
      >
        SEEDED VOLUME · SWAY · AGE-DRIVEN PULSE
      </Text>
    </Group>
  );
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <FirefliesStudy />, { pixelRatio: 1 });
}
