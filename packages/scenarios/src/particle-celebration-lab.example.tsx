import {
  Clip,
  Group,
  Layer,
  Rectangle,
  Text,
  type WritableSignal,
} from '@crc/core';
import {
  Particles2D,
  crcParticleSystem,
  defineParticleEffect2D,
  particle,
  type CRCParticleExecution,
  type CRCParticleSystem,
  type CRCParticleSystemEvent,
  type CRCParticleSystemStatus,
} from '@crc/particles';

export const PARTICLE_CELEBRATION_LAB_SOURCE_ID = 'first-class-particle-celebration-laboratory-example';

export type ParticleCelebrationLabAction =
  | 'burst'
  | 'pause'
  | 'resume'
  | 'restart'
  | 'drain'
  | 'clear'
  | 'toggle-filter'
  | 'remove-owner'
  | 'reset';

export interface ParticleCelebrationLabState {
  readonly status: CRCParticleSystemStatus;
  readonly execution: CRCParticleExecution;
  readonly acceptedBursts: number;
  readonly rejectedParticles: number;
  readonly lastEvent: CRCParticleSystemEvent['type'] | 'mount';
  readonly owner: 'mounted' | 'removed';
  readonly staleHandleInert: boolean;
}

export interface ParticleCelebrationLabModel {
  readonly filterEnabled: WritableSignal<boolean>;
  system: CRCParticleSystem | undefined;
  acceptedBursts: number;
  rejectedParticles: number;
  lastEvent: ParticleCelebrationLabState['lastEvent'];
  ownerVisible: boolean;
  staleHandleInert: boolean;
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
        lifetimeMilliseconds: particle.between(760, 1_050),
        velocity: [particle.between(-150, 150), particle.between(-215, -90)],
        size: particle.between(5, 11),
        color: particle.choice([
          { value: '#f7c948', weight: 3 },
          { value: '#7dd3fc', weight: 2 },
          { value: '#f472b6', weight: 2 },
          { value: '#ffffff', weight: 1 },
        ]),
      },
      motion: [{ type: 'acceleration', value: [0, 310] }],
      appearance: {
        opacity: particle.curve([
          [0, 1],
          [0.74, 1],
          [1, 0],
        ]),
        size: particle.curve([
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
        lifetimeMilliseconds: particle.between(900, 1_250),
        velocity: [particle.between(-125, 125), particle.between(-190, -70)],
        size: [particle.between(5, 9), particle.between(10, 18)],
        rotationDegrees: particle.between(0, 360),
        angularVelocityDegreesPerSecond: particle.between(-420, 420),
        color: particle.choice([
          { value: '#fb7185', weight: 2 },
          { value: '#a78bfa', weight: 2 },
          { value: '#34d399', weight: 2 },
          { value: '#f97316', weight: 1 },
        ]),
      },
      motion: [{ type: 'acceleration', value: [0, 245] }],
      appearance: {
        opacity: particle.curve([
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
  model.lastEvent = event.type;
  if (event.type === 'burst-accepted') model.acceptedBursts += 1;
  if (event.type === 'burst-rejected') {
    model.rejectedParticles += event.requested - event.accepted;
  }
  model.publish?.();
}

function celebrationClip(): Path2D {
  const path = new Path2D();
  path.roundRect(12, 52, 616, 292, 22);
  return path;
}

function ParticleCelebrationOwner({ model }: { readonly model: ParticleCelebrationLabModel }) {
  const system = crcParticleSystem(particleCelebrationEffect, {
    autoplay: false,
    seed: CELEBRATION_SEED,
    debugName: 'Canvas celebration system',
  });
  model.system = system;
  system.status.get();
  system.execution.get();
  const filterEnabled = model.filterEnabled.get();
  model.publish?.();

  return (
    <Layer
      style={{
        width: 640,
        height: 360,
        filter: filterEnabled
          ? { type: 'dropShadow', offsetX: 0, offsetY: 5, blurRadius: 5, color: '#38bdf888' }
          : [],
      }}
    >
      <Particles2D
        system={system}
        pointerEvents="auto"
        style={{ width: 640, height: 360, cursor: 'crosshair' }}
        onPointerDown={(event) => emitCelebrationBurst(system, event.x, event.y)}
        onEvent={(event) => recordEvent(model, event)}
      />
    </Layer>
  );
}

export function ParticleCelebrationLabRoot({
  model,
}: {
  readonly model: ParticleCelebrationLabModel;
}) {
  return (
    <Group>
      <Rectangle style={{ width: 640, height: 360, fill: '#07111f' }} />
      <Rectangle
        pointerEvents="none"
        style={{ x: 12, y: 52, width: 616, height: 292, fill: '#10233f' }}
      />
      <Clip style={{ d: celebrationClip() }}>
        {model.ownerVisible ? <ParticleCelebrationOwner model={model} /> : undefined}
      </Clip>
      <Text
        pointerEvents="none"
        style={{ x: 24, y: 20, fill: '#f8fafc', font: '800 18px sans-serif' }}
      >
        CANVAS PARTICLE CELEBRATION
      </Text>
      <Text
        pointerEvents="none"
        style={{ x: 616, y: 22, fill: '#7dd3fc', font: '700 11px monospace', textAlign: 'right' }}
      >
        CLICK ANYWHERE IN THE STAGE
      </Text>
    </Group>
  );
}
