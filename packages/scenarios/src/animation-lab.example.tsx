import {
  usePlayback,
  useAnimatedValue,
  Group,
  Layer,
  marker,
  parallel,
  Rectangle,
  repeat,
  sequence,
  signal,
  stepper,
  track,
  tween,
  wait,
  type CRCAnimationProgram,
  type CRCPlayback,
  type CRCPlaybackEvent,
  type CRCPlaybackStatus,
  type Signal,
  type WritableSignal,
} from '@crc/core';

export const ANIMATION_LAB_SOURCE_ID = 'first-class-animation-laboratory-example';

export type AnimationLabAction =
  | 'play'
  | 'pause'
  | 'step'
  | 'seek-start'
  | 'seek-middle'
  | 'seek-end'
  | 'reverse'
  | 'retarget'
  | 'repeat'
  | 'simulate'
  | 'show-layer'
  | 'show-shared-roots'
  | 'cancel'
  | 'remove-owner'
  | 'reset';

export interface AnimationLabState {
  readonly status: CRCPlaybackStatus;
  readonly currentTime: number;
  readonly x: number;
  readonly opacity: number;
  readonly targetScale: number;
  readonly presentedScale: number;
  readonly pulseScale: number;
  readonly iteration: number;
  readonly milestones: readonly string[];
  readonly stepper: Readonly<{ value: number; steps: number }>;
  readonly rootRenders: Readonly<{ primary: number; secondary: number }>;
  readonly layer: Readonly<{
    visible: boolean;
    childRenders: number;
    presentations: number;
  }>;
  readonly sharedRoots: Readonly<{
    visible: boolean;
    value: number;
    primaryRenders: number;
    secondaryRenders: number;
  }>;
  readonly owner: 'mounted' | 'removed';
  readonly staleStatus: CRCPlaybackStatus | 'none';
  readonly staleActionInert: boolean;
  readonly lastAction: 'mount' | AnimationLabAction;
}

export interface AnimationLabMetrics {
  rootRenders: { primary: number; secondary: number };
  layerChildRenders: number;
  layerPresentations: number;
  sharedRootRenders: { primary: number; secondary: number };
  milestones: string[];
  eventOrigin: number | undefined;
  iteration: number;
}

export interface AnimationLabStepperProjection {
  readonly value: number;
  readonly steps: number;
}

export type AnimationLabProgramMode = 'entrance' | 'repeat' | 'simulate';

export interface AnimationLabModel {
  readonly x: WritableSignal<number>;
  readonly opacity: WritableSignal<number>;
  readonly pulseScale: WritableSignal<number>;
  readonly transitionTarget: WritableSignal<number>;
  readonly shared: WritableSignal<number>;
  readonly showLayer: WritableSignal<boolean>;
  readonly layerOffset: WritableSignal<number>;
  readonly stepper: WritableSignal<AnimationLabStepperProjection>;
  readonly metrics: AnimationLabMetrics;
  ownerVisible: boolean;
  programMode: AnimationLabProgramMode;
  playback: CRCPlayback | undefined;
  presentedScale: Signal<number> | undefined;
  stalePlayback: CRCPlayback | undefined;
  staleActionInert: boolean;
  publish: (() => void) | undefined;
}

export function createAnimationLabModel(): AnimationLabModel {
  return {
    x: signal(0, { debugName: 'animation laboratory x' }),
    opacity: signal(1, { debugName: 'animation laboratory opacity' }),
    pulseScale: signal(1, { debugName: 'animation laboratory pulse scale' }),
    transitionTarget: signal(1, { debugName: 'animation laboratory transition target' }),
    shared: signal(0, { debugName: 'animation laboratory shared value' }),
    showLayer: signal(false, { debugName: 'animation laboratory Layer visibility' }),
    layerOffset: signal(0, { debugName: 'animation laboratory Layer offset' }),
    stepper: signal(Object.freeze({ value: 0, steps: 0 }), {
      debugName: 'animation laboratory stepper projection',
    }),
    metrics: {
      rootRenders: { primary: 0, secondary: 0 },
      layerChildRenders: 0,
      layerPresentations: 0,
      sharedRootRenders: { primary: 0, secondary: 0 },
      milestones: [],
      eventOrigin: undefined,
      iteration: 0,
    },
    ownerVisible: true,
    programMode: 'entrance',
    playback: undefined,
    presentedScale: undefined,
    stalePlayback: undefined,
    staleActionInert: false,
    publish: undefined,
  };
}

function entranceProgram(model: AnimationLabModel): CRCAnimationProgram {
  return sequence(
    parallel(
      track(model.x, tween({ from: 0, to: 180, duration: 200 })),
      track(model.opacity, tween({ from: 1, to: 0.4, duration: 200 })),
    ),
    marker('arrived'),
    track(model.pulseScale, tween({ from: 1, to: 1.25, duration: 100 })),
  );
}

function repeatProgram(model: AnimationLabModel): CRCAnimationProgram {
  return repeat(
    sequence(
      track(model.x, tween({ from: 0, to: 120, duration: 90 })),
      marker('turn'),
      wait(10),
    ),
    { iterations: 3, direction: 'alternate' },
  );
}

function simulationProgram(model: AnimationLabModel): CRCAnimationProgram {
  return track(model.stepper, stepper({
    stepMilliseconds: 10,
    maxElapsedMilliseconds: 30,
    initial: (): AnimationLabStepperProjection => Object.freeze({
      value: 0,
      steps: 0,
    }),
    step: current => Object.freeze({
      value: current.value + 2,
      steps: current.steps + 1,
    }),
    read: current => current,
    done: current => current.steps >= 8,
    debugName: 'animation laboratory fixed-step simulation',
  }));
}

function programFor(model: AnimationLabModel): CRCAnimationProgram {
  switch (model.programMode) {
    case 'entrance':
      return entranceProgram(model);
    case 'repeat':
      return repeatProgram(model);
    case 'simulate':
      return simulationProgram(model);
  }
}

function normalizedEvent(model: AnimationLabModel, event: CRCPlaybackEvent): string {
  if (event.type === 'start') model.metrics.eventOrigin = event.logicalTime;
  const origin = model.metrics.eventOrigin ?? event.logicalTime;
  const relativeTime = Number((event.logicalTime - origin).toFixed(10));
  const path = event.programPath.length ? event.programPath.join('.') : 'root';
  const name = event.marker ? `${event.type}(${event.marker})` : event.type;
  return `${name}@${relativeTime}:${path}:${event.iteration}`;
}

function AnimationOwner({ model }: { readonly model: AnimationLabModel }) {
  const playback = usePlayback(programFor(model), {
    debugName: 'animation laboratory playback',
    onEvent: (event) => {
      model.metrics.milestones.push(normalizedEvent(model, event));
      if (event.type === 'iteration' || event.type === 'marker') {
        model.metrics.iteration = event.iteration;
      }
      model.publish?.();
    },
  });
  const presentedScale = useAnimatedValue(model.transitionTarget.get(), {
    type: 'tween',
    duration: 120,
    initial: 1,
    debugName: 'animation laboratory transition',
  });
  model.playback = playback;
  model.presentedScale = presentedScale;

  const x = model.x.get();
  const opacity = model.opacity.get();
  const pulseScale = model.pulseScale.get();
  const scale = presentedScale.get() * pulseScale;
  const stepper = model.stepper.get();
  playback.status.get();
  playback.currentTime.get();

  return (
    <Group>
      <Rectangle
        style={{
          left: 24 + x,
          top: 30,
          width: 52,
          height: 52,
          fill: '#38bdf8',
          opacity,
        }}
      />
      <Rectangle
        style={{
          left: 24,
          top: 106,
          width: 48 * scale,
          height: 28,
          fill: '#f7c948',
        }}
      />
      <Rectangle
        style={{
          left: 24,
          top: 158,
          width: 12 + stepper.value * 4,
          height: 22,
          fill: '#f97316',
        }}
      />
    </Group>
  );
}

function LayerChild({ model }: { readonly model: AnimationLabModel }) {
  model.metrics.layerChildRenders += 1;
  return <Rectangle style={{ width: 60, height: 36, fill: '#a78bfa' }} />;
}

function LayerPresentation({ model }: { readonly model: AnimationLabModel }) {
  model.metrics.layerPresentations += 1;
  const offset = model.layerOffset.get();
  return (
    <Group style={{ translateX: 330 + offset, translateY: 154 }}>
      <Layer style={{ width: 60, height: 36 }}>
        <LayerChild model={model} />
      </Layer>
    </Group>
  );
}

export function AnimationLabRootA({ model }: { readonly model: AnimationLabModel }) {
  model.metrics.rootRenders.primary += 1;
  const shared = model.shared.get();
  model.metrics.sharedRootRenders.primary += 1;
  const showLayer = model.showLayer.get();
  const result = (
    <Group>
      <Rectangle style={{ width: 480, height: 240, fill: '#0f172a' }} />
      <Rectangle
        style={{
          left: 330,
          top: 30,
          width: 34 + shared * 18,
          height: 34,
          fill: '#22c55e',
        }}
      />
      {model.ownerVisible ? <AnimationOwner model={model} /> : undefined}
      {showLayer ? <LayerPresentation model={model} /> : undefined}
    </Group>
  );
  model.publish?.();
  return result;
}

export function AnimationLabRootB({ model }: { readonly model: AnimationLabModel }) {
  model.metrics.rootRenders.secondary += 1;
  const shared = model.shared.get();
  model.metrics.sharedRootRenders.secondary += 1;
  model.publish?.();
  return (
    <Group>
      <Rectangle style={{ width: 480, height: 96, fill: '#ecfeff' }} />
      <Rectangle
        style={{
          left: 24,
          top: 24,
          width: 42 + shared * 24,
          height: 42,
          fill: '#0891b2',
        }}
      />
    </Group>
  );
}
