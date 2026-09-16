import { Group, Rectangle, Text, crc, type CRCController } from '@crc/core';
import {
  Particles2D,
  crcParticleSystem,
  defineParticleEffect2D,
  particleChoice,
  particleCurve,
  particleRange,
} from '@crc/particles';

const ambientDust = defineParticleEffect2D({
  debugName: 'learning ambient dust',
  emitters: [
    {
      name: 'dust',
      capacity: 90,
      overflow: 'recycle-oldest',
      emission: [{ type: 'rate', particlesPerSecond: 14 }],
      shape: { type: 'rectangle', width: 720, height: 330, sample: 'interior' },
      initial: {
        lifetimeMilliseconds: particleRange(2_800, 4_600),
        velocity: [particleRange(-5, 5), particleRange(-16, -7)],
        size: particleRange(2, 5),
        color: particleChoice([
          { value: '#7dd3fc', weight: 2 },
          { value: '#f7c948', weight: 1 },
          { value: '#ffffff', weight: 1 },
        ]),
      },
      motion: [{ type: 'sway', amplitude: 11, frequency: [0.2, 0.45] }],
      appearance: {
        opacity: particleCurve([
          [0, 0],
          [0.16, 0.7],
          [0.8, 0.7],
          [1, 0],
        ]),
      },
      renderer: { type: 'circle', blend: 'additive' },
      bounds: { min: [-380, -210], max: [380, 210] },
    },
  ],
});

const clickBurst = defineParticleEffect2D({
  debugName: 'learning click burst',
  emitters: [
    {
      name: 'impact',
      capacity: 120,
      overflow: 'recycle-oldest',
      emission: [{ type: 'manual', count: 40 }],
      shape: { type: 'circle', radius: 6, sample: 'interior' },
      initial: {
        lifetimeMilliseconds: particleRange(650, 950),
        velocity: [particleRange(-135, 135), particleRange(-180, -65)],
        size: particleRange(5, 10),
        color: particleChoice([
          { value: '#fb7185', weight: 2 },
          { value: '#a78bfa', weight: 2 },
          { value: '#34d399', weight: 2 },
          { value: '#f7c948', weight: 1 },
        ]),
      },
      // Acceleration here is particle-domain math applied independently to
      // every emitted mark. To move the Particles2D component itself, use an
      // ordinary CRC signal or animation and pass its resolved value to style.
      motion: [{ type: 'acceleration', value: [0, 260] }],
      appearance: {
        opacity: particleCurve([
          [0, 1],
          [0.72, 1],
          [1, 0],
        ]),
      },
      renderer: { type: 'circle', blend: 'additive' },
      bounds: { min: [-170, -210], max: [170, 170] },
    },
  ],
});

function ParticleEffectsStudy() {
  const impact = crcParticleSystem(clickBurst, {
    autoplay: false,
    seed: 42,
    debugName: 'learning click particle system',
  });

  return (
    <Group>
      <Rectangle style={{ width: 720, height: 420, fill: '#07111f' }} />
      <Rectangle
        pointerEvents="none"
        style={{ x: 36, y: 88, width: 648, height: 286, fill: '#10233f' }}
      />
      <Group style={{ translateX: 360, translateY: 225 }}>
        <Particles2D
          effect={ambientDust}
          autoplay
          seed={7}
          pointerEvents="none"
          style={{ width: 720, height: 420 }}
        />
      </Group>
      <Particles2D
        system={impact}
        pointerEvents="auto"
        style={{ width: 720, height: 420, cursor: 'crosshair' }}
        onPointerDown={(event) => {
          impact.emit('impact', {
            position: [event.x, event.y],
            count: 40,
          });
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          x: 360,
          y: 38,
          fill: '#f8fafc',
          font: '900 24px sans-serif',
          textAlign: 'center',
        }}
      >
        PARTICLE EFFECTS
      </Text>
      <Text
        pointerEvents="none"
        style={{
          x: 360,
          y: 64,
          fill: '#7dd3fc',
          font: '700 12px monospace',
          textAlign: 'center',
        }}
      >
        AMBIENT AUTOPLAY + EXPLICIT CLICK BURSTS
      </Text>
      <Text
        pointerEvents="none"
        style={{
          x: 360,
          y: 396,
          fill: '#cbd5e1',
          font: '600 12px monospace',
          textAlign: 'center',
        }}
      >
        CLICK THE STAGE · ONE SYSTEM REUSES FIXED STORAGE
      </Text>
    </Group>
  );
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <ParticleEffectsStudy />, { pixelRatio: 1 });
}
