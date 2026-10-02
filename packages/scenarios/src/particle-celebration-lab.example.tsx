import { dropShadow } from '@crc/core/filters';
import {
  Circle,
  Clip,
  Group,
  Layer,
  Rectangle,
  Text,
  type WritableSignal,
} from '@crc/core';
import {
  Particles2D,
  useParticleSystem,
  defineParticleEffect2D,
  particleChoice,
  particleCurve,
  particleRange,
  type CRCParticleSystem,
  type CRCParticleSystemEvent,
} from '@crc/particles';

// prettier-ignore
export const PARTICLE_CELEBRATION_LAB_SOURCE_ID = 'first-class-particle-celebration-laboratory-example';

export type ParticleCelebrationLabAction =
  'launch' | 'pause' | 'resume' | 'replay' | 'clear' | 'toggle-glow';

export type CelebrationPoint = readonly [x: number, y: number];

export interface ParticleCelebrationLabState {
  readonly animation: 'ready' | 'playing' | 'paused';
  readonly selectedPoints: number;
  readonly celebrations: number;
  readonly lastAction: string;
  readonly glow: boolean;
}

export interface ParticleCelebrationLabModel {
  readonly glowEnabled: WritableSignal<boolean>;
  readonly selectedPoints: WritableSignal<readonly CelebrationPoint[]>;
  system: CRCParticleSystem | undefined;
  celebrations: number;
  lastAction: string;
  lastLaunchPoints: readonly CelebrationPoint[];
  pendingLaunchPoints: number;
  acceptedLaunchPoints: number;
  publish: (() => void) | undefined;
}

export const CELEBRATION_SEED = 42;
export const CELEBRATION_BURST_COUNTS = Object.freeze({
  impact: 36,
  confetti: 24,
});

export const particleCelebrationEffect = defineParticleEffect2D({
  debugName: 'Canvas celebration',
  emitters: [
    {
      name: 'impact',
      capacity: 180,
      overflow: 'reject-newest',
      space: 'local',
      emission: [{ type: 'manual', count: CELEBRATION_BURST_COUNTS.impact }],
      shape: { type: 'circle', radius: 8, sample: 'interior' },
      initial: {
        lifetimeMilliseconds: particleRange(760, 1_050),
        velocity: [particleRange(-150, 150), particleRange(-215, -90)],
        size: particleRange(5, 11),
        color: particleChoice([
          { value: '#f7c948', weight: 3 },
          { value: '#7dd3fc', weight: 2 },
          { value: '#f472b6', weight: 2 },
          { value: '#ffffff', weight: 1 },
        ]),
      },
      motion: [{ type: 'acceleration', value: [0, 310] }],
      appearance: {
        opacity: particleCurve([
          [0, 1],
          [0.74, 1],
          [1, 0],
        ]),
        size: particleCurve([
          [0, 0.55],
          [0.12, 1],
          [1, 0.35],
        ]),
      },
      renderer: { type: 'circle', blend: 'additive' },
      bounds: { min: [-190, -250], max: [190, 190] },
    },
    {
      name: 'confetti',
      capacity: 120,
      overflow: 'reject-newest',
      space: 'local',
      emission: [{ type: 'manual', count: CELEBRATION_BURST_COUNTS.confetti }],
      shape: { type: 'circle', radius: 12, sample: 'interior' },
      initial: {
        lifetimeMilliseconds: particleRange(900, 1_250),
        velocity: [particleRange(-125, 125), particleRange(-190, -70)],
        size: [particleRange(5, 9), particleRange(10, 18)],
        rotationDegrees: particleRange(0, 360),
        angularVelocityDegreesPerSecond: particleRange(-420, 420),
        color: particleChoice([
          { value: '#fb7185', weight: 2 },
          { value: '#a78bfa', weight: 2 },
          { value: '#34d399', weight: 2 },
          { value: '#f97316', weight: 1 },
        ]),
      },
      motion: [{ type: 'acceleration', value: [0, 245] }],
      appearance: {
        opacity: particleCurve([
          [0, 1],
          [0.8, 1],
          [1, 0],
        ]),
      },
      renderer: { type: 'rectangle', aspectRatio: 0.55 },
      bounds: { min: [-165, -230], max: [165, 210] },
    },
  ],
});

export function emitCelebrationBurst(
  system: CRCParticleSystem,
  x: number,
  y: number,
): void {
  system.emit('impact', {
    position: [x, y],
    count: CELEBRATION_BURST_COUNTS.impact,
  });
  system.emit('confetti', {
    position: [x, y],
    count: CELEBRATION_BURST_COUNTS.confetti,
  });
}

function recordEvent(
  model: ParticleCelebrationLabModel,
  event: CRCParticleSystemEvent,
): void {
  if (
    event.type === 'burst-accepted' &&
    event.emitter === 'impact' &&
    event.accepted > 0
  ) {
    model.celebrations += 1;
    model.acceptedLaunchPoints += 1;
    if (model.acceptedLaunchPoints >= model.pendingLaunchPoints) {
      const suffix = model.pendingLaunchPoints === 1 ? 'point' : 'points';
      model.lastAction = `Celebration launched from ${model.pendingLaunchPoints} ${suffix}.`;
    }
  }
  model.publish?.();
}

function selectLaunchPoint(
  model: ParticleCelebrationLabModel,
  point: CelebrationPoint,
): void {
  model.selectedPoints.update((current) => {
    const next =
      current.length < 2 ? [...current, point] : [current[1]!, point];
    model.lastAction = `${next.length} launch ${next.length === 1 ? 'point' : 'points'} ready.`;
    return Object.freeze(next);
  });
  model.publish?.();
}

function celebrationClip(): Path2D {
  const path = new Path2D();
  path.roundRect(12, 52, 616, 292, 22);
  return path;
}

function ParticleCelebrationOwner({
  model,
}: {
  readonly model: ParticleCelebrationLabModel;
}) {
  const system = useParticleSystem(particleCelebrationEffect, {
    autoplay: false,
    seed: CELEBRATION_SEED,
    debugName: 'Canvas celebration system',
  });
  model.system = system;
  system.status.get();
  system.execution.get();
  const glowEnabled = model.glowEnabled.get();
  const selectedPoints = model.selectedPoints.get();

  return (
    <Layer
      style={{
        width: 640,
        height: 360,
        filter: glowEnabled
          ? dropShadow({
              
              offsetX: 0,
              offsetY: 5,
              blurRadius: 5,
              color: '#38bdf888',
            })
          : [],
      }}
    >
      <Particles2D
        system={system}
        pointerEvents="auto"
        style={{ width: 640, height: 360, cursor: 'crosshair' }}
        onPointerDown={(event) => selectLaunchPoint(model, [event.x, event.y])}
        onEvent={(event) => recordEvent(model, event)}
      />
      {selectedPoints.map(([x, y], index) => (
        <Group key={`launch-point-${index}`}>
          <Circle
            pointerEvents="none"
            style={{
              cx: x,
              cy: y,
              radius: 17,
              fill: '#ff6b57cc',
              stroke: '#ffffff',
              strokeWidth: 3,
            }}
          />
          <Text
            pointerEvents="none"
            style={{
              left: x,
              top: y - 8,
              fill: '#ffffff',
              font: '900 14px sans-serif',
              textAlign: 'center',
            }}
          >
            {index + 1}
          </Text>
        </Group>
      ))}
    </Layer>
  );
}

export function ParticleCelebrationLabRoot({
  model,
}: {
  readonly model: ParticleCelebrationLabModel;
}) {
  const selectedPointCount = model.selectedPoints.get().length;
  return (
    <Group>
      <Rectangle style={{ width: 640, height: 360, fill: '#07111f' }} />
      <Rectangle
        pointerEvents="none"
        style={{ left: 12, top: 52, width: 616, height: 292, fill: '#10233f' }}
      />
      <Clip style={{ d: celebrationClip() }}>
        <ParticleCelebrationOwner model={model} />
      </Clip>
      <Text
        pointerEvents="none"
        style={{ left: 24, top: 20, fill: '#f8fafc', font: '800 18px sans-serif' }}
      >
        CANVAS PARTICLE CELEBRATION
      </Text>
      <Text
        pointerEvents="none"
        style={{
          left: 616,
          top: 22,
          fill: '#7dd3fc',
          font: '700 11px monospace',
          textAlign: 'right',
        }}
      >
        CLICK TO PLACE UP TO 2 LAUNCH POINTS
      </Text>
      <Text
        pointerEvents="none"
        style={{ left: 24, top: 326, fill: '#cbd5e1', font: '700 12px monospace' }}
      >
        {selectedPointCount === 0
          ? 'PLACE POINTS, THEN LAUNCH'
          : `${selectedPointCount} ${selectedPointCount === 1 ? 'POINT' : 'POINTS'} READY`}
      </Text>
    </Group>
  );
}
