import {
  Group,
  Rectangle,
  Text,
  crc,
  marker,
  repeat,
  sequence,
  usePlayback,
  useSignal,
  wait,
  type CRCController,
} from '@crc/core';
import {
  Particles2D,
  defineParticleEffect2D,
  particleChoice,
  particleCurve,
  particleRange,
  useParticleSystem,
} from '@crc/particles';

const burningSquareEffect = defineParticleEffect2D({
  debugName: 'learning burning square',
  emitters: [
    {
      name: 'flame',
      capacity: 180,
      overflow: 'recycle-oldest',
      emission: [{ type: 'manual', count: 5 }],
      shape: { type: 'line', from: [-34, 0], to: [34, 0] },
      initial: {
        lifetimeMilliseconds: particleRange(420, 820),
        velocity: [particleRange(-28, 28), particleRange(-145, -82)],
        color: particleChoice([
          { value: '#fff3a3', weight: 1 },
          { value: '#fbbf24', weight: 3 },
          { value: '#f97316', weight: 3 },
          { value: '#dc2626', weight: 1 },
        ]),
      },
      motion: [
        { type: 'sway', amplitude: 13, frequency: [1.1, 2.1] },
        { type: 'drag', amount: 0.45 },
      ],
      appearance: {
        size: particleCurve([
          [0, 5],
          [0.3, 17],
          [1, 2],
        ]),
        opacity: particleCurve([
          [0, 0],
          [0.08, 1],
          [0.76, 0.9],
          [1, 0],
        ]),
      },
      renderer: { type: 'circle', blend: 'additive' },
      bounds: { min: [-80, -150], max: [80, 24] },
    },
    {
      name: 'smoke',
      capacity: 100,
      overflow: 'recycle-oldest',
      emission: [{ type: 'manual', count: 2 }],
      shape: { type: 'line', from: [-24, -2], to: [24, -2] },
      initial: {
        lifetimeMilliseconds: particleRange(1_500, 2_700),
        velocity: [particleRange(-16, 16), particleRange(-62, -34)],
        color: particleChoice([
          { value: '#334155', weight: 2 },
          { value: '#475569', weight: 3 },
          { value: '#64748b', weight: 1 },
        ]),
      },
      motion: [
        { type: 'sway', amplitude: 25, frequency: [0.28, 0.58] },
        { type: 'drag', amount: 0.16 },
      ],
      appearance: {
        size: particleCurve([
          [0, 9],
          [0.35, 22],
          [1, 42],
        ]),
        opacity: particleCurve([
          [0, 0],
          [0.16, 0.52],
          [0.72, 0.3],
          [1, 0],
        ]),
      },
      renderer: { type: 'circle', blend: 'source-over' },
      bounds: { min: [-120, -190], max: [120, 32] },
    },
  ],
});

const emissionClock = repeat(
  sequence(
    wait(40),
    marker('flame'),
    wait(80),
    marker('flame'),
    wait(40),
    marker('smoke'),
  ),
  { iterations: Number.POSITIVE_INFINITY },
);

interface Point {
  readonly x: number;
  readonly y: number;
}

interface DragState {
  readonly pointerId: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

const SQUARE_SIZE = 88;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function ParticleEffectsStudy() {
  const position = useSignal<Point>({ x: 360, y: 300 });
  const drag = useSignal<DragState | null>(null);
  const fire = useParticleSystem(burningSquareEffect, {
    autoplay: false,
    seed: 42,
    debugName: 'learning burning square particle system',
  });

  usePlayback(emissionClock, {
    autoplay: true,
    debugName: 'learning burning square emission clock',
    onEvent: (event) => {
      if (event.type !== 'marker') return;
      const current = position.get();
      const emitterPosition = [
        current.x,
        current.y - SQUARE_SIZE / 2,
      ] as const;
      if (event.marker === 'flame') {
        fire.emit('flame', { position: emitterPosition, count: 5 });
      } else if (event.marker === 'smoke') {
        fire.emit('smoke', { position: emitterPosition, count: 2 });
      }
    },
  });

  const current = position.get();
  const isDragging = drag.get() !== null;

  return (
    <Group>
      <Rectangle style={{ width: 720, height: 420, fill: '#090b10' }} />
      <Rectangle
        pointerEvents="none"
        style={{ x: 28, y: 88, width: 664, height: 284, fill: '#111827' }}
      />
      <Particles2D
        system={fire}
        pointerEvents="none"
        style={{ width: 720, height: 420 }}
      />
      <Rectangle
        style={{
          x: current.x - SQUARE_SIZE / 2,
          y: current.y - SQUARE_SIZE / 2,
          width: SQUARE_SIZE,
          height: SQUARE_SIZE,
          fill: '#481b12',
          stroke: isDragging ? '#fde68a' : '#f97316',
          strokeWidth: isDragging ? 5 : 4,
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.set({
            pointerId: event.pointerId,
            offsetX: event.x - current.x,
            offsetY: event.y - current.y,
          });
        }}
        onPointerMove={(event) => {
          const active = drag.get();
          if (
            active?.pointerId !== event.pointerId ||
            !event.currentTarget.hasPointerCapture(event.pointerId)
          ) {
            return;
          }
          position.set({
            x: clamp(event.x - active.offsetX, 76, 644),
            y: clamp(event.y - active.offsetY, 184, 324),
          });
        }}
        onPointerUp={(event) => {
          if (drag.get()?.pointerId !== event.pointerId) return;
          event.currentTarget.releasePointerCapture(event.pointerId);
          drag.set(null);
        }}
        onPointerCancel={(event) => {
          if (drag.get()?.pointerId !== event.pointerId) return;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          drag.set(null);
        }}
      />
      <Rectangle
        pointerEvents="none"
        style={{
          x: current.x - 30,
          y: current.y - 30,
          width: 60,
          height: 60,
          fill: '#7c2d12',
          stroke: '#fb923c',
          strokeWidth: 2,
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          x: current.x,
          y: current.y + 5,
          fill: '#fed7aa',
          font: '900 12px monospace',
          textAlign: 'center',
        }}
      >
        DRAG
      </Text>
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
          fill: '#fb923c',
          font: '700 12px monospace',
          textAlign: 'center',
        }}
      >
        FIRE + SMOKE · WORLD-SPACE BIRTHS
      </Text>
      <Text
        pointerEvents="none"
        style={{
          x: 360,
          y: 398,
          fill: '#cbd5e1',
          font: '600 12px monospace',
          textAlign: 'center',
        }}
      >
        DRAG THE SQUARE · OLD PARTICLES STAY BEHIND
      </Text>
    </Group>
  );
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <ParticleEffectsStudy />, { pixelRatio: 1 });
}
