import {
  computed,
  Group,
  Layer,
  Rectangle,
  resolveSignalValue,
  Text,
  useConst,
  useReaction,
  type Signal,
  type SignalValue,
  type WritableSignal,
} from '@crc/core';

export const SIGNALS_LAB_SOURCE_ID = 'first-class-signals-laboratory-example';

export type SignalsLabAction =
  | 'direct-write'
  | 'equal-write'
  | 'computed-equal-write'
  | 'dependency-switch'
  | 'shared-roots'
  | 'layer-local-write'
  | 'remove-consumer'
  | 'batched-write'
  | 'reaction-only'
  | 'reset';

export interface SignalsLabState {
  direct: number;
  derivedSource: number;
  left: number;
  right: number;
  shared: number;
  layerA: number;
  layerB: number;
  retained: number;
  selectedSource: 'left' | 'right';
  computed: number;
  computedEvaluations: number;
  writes: number;
  inputResolutions: number;
  receiverIds: number;
  provisions: number;
  adoptions: number;
  shallowCopies: number;
  batchFlushes: number;
  computedValidations: number;
  reactionRuns: number;
  reactionCleanups: number;
  componentTraversals: number;
  layerRepaints: number;
  composites: number;
  rootRenders: Readonly<{ a: number; b: number }>;
  layerChildRenders: Readonly<{ a: number; b: number }>;
  consumerCount: number;
  lastAction: 'mount' | SignalsLabAction;
}

export interface SignalsLabMetrics {
  computedEvaluations: number;
  renderedComputed: number;
  writes: number;
  inputResolutions: number;
  receiverIds: number;
  provisions: number;
  adoptions: number;
  shallowCopies: number;
  batchFlushes: number;
  computedValidations: number;
  reactionRuns: number;
  reactionCleanups: number;
  componentTraversals: number;
  layerRepaints: number;
  composites: number;
  rootRenders: { a: number; b: number };
  layerChildRenders: { a: number; b: number };
}

export interface SignalsLabModel {
  direct: WritableSignal<number>;
  derivedSource: WritableSignal<number>;
  selectLeft: WritableSignal<boolean>;
  left: WritableSignal<number>;
  right: WritableSignal<number>;
  shared: WritableSignal<number>;
  layerA: WritableSignal<number>;
  layerB: WritableSignal<number>;
  retained: WritableSignal<number>;
  reactionOnly: WritableSignal<number>;
  derived: Signal<number>;
  consumerVisible: boolean;
}

interface RootProps {
  model: SignalsLabModel;
  metrics: SignalsLabMetrics;
}

function LayerA({ model, metrics }: RootProps) {
  metrics.componentTraversals += 1;
  metrics.layerRepaints += 1;
  metrics.layerChildRenders.a += 1;
  const value = model.layerA.get();
  return <Rectangle style={{ x: 0, y: 0, width: 80, height: 42, fill: value % 2 ? '#2563eb' : '#7c3aed' }} />;
}

function LayerB({ model, metrics }: RootProps) {
  metrics.componentTraversals += 1;
  metrics.layerRepaints += 1;
  metrics.layerChildRenders.b += 1;
  const value = model.layerB.get();
  return <Rectangle style={{ x: 0, y: 0, width: 80, height: 42, fill: value % 2 ? '#f59e0b' : '#10b981' }} />;
}

function RetainedConsumer({ model, metrics }: RootProps) {
  metrics.componentTraversals += 1;
  const retained = model.retained.get();
  return <Text style={{ x: 240, y: 198, fill: '#475569', font: '600 11px monospace' }}>{`retained ${retained}`}</Text>;
}

interface SignalInputProbeProps {
  readonly metrics: SignalsLabMetrics;
  readonly style: Readonly<{
    x: SignalValue<number>;
    y: number;
  }>;
}

function SignalInputProbe({ metrics, style }: SignalInputProbeProps) {
  metrics.componentTraversals += 1;
  useConst(() => {
    metrics.receiverIds += 1;
    return metrics.receiverIds;
  });
  const x = resolveSignalValue(style.x);
  metrics.inputResolutions += 1;
  metrics.adoptions += 1;
  metrics.shallowCopies += 1;
  return <Rectangle style={{ ...style, x, width: 12, height: 12, fill: '#0ea5e9' }} />;
}

function ReactionProbe({ model, metrics }: RootProps) {
  metrics.componentTraversals += 1;
  useReaction(() => {
    model.reactionOnly.get();
    metrics.reactionRuns += 1;
    return () => {
      metrics.reactionCleanups += 1;
    };
  });
  return null;
}

export function SignalsLabRootA({ model, metrics }: RootProps) {
  metrics.componentTraversals += 1;
  metrics.rootRenders.a += 1;
  metrics.provisions += 1;
  metrics.composites += 2;
  const direct = model.direct.get();
  const derived = model.derived.get();
  metrics.renderedComputed = derived;
  const shared = model.shared.get();
  return <Group>
    <Rectangle style={{ width: 480, height: 240, fill: '#f8fafc' }} />
    <Rectangle style={{ x: 24 + direct * 8, y: 32, width: 76, height: 54, fill: '#2563eb' }} />
    <SignalInputProbe metrics={metrics} style={{ x: model.direct, y: 98 }} />
    <Text style={{ x: 24, y: 126, fill: '#0f172a', font: '700 13px monospace' }}>{`direct ${direct} · computed ${derived} · shared ${shared}`}</Text>
    <Group style={{ translateX: 24, translateY: 150 }}>
      <Layer style={{ width: 80, height: 42 }}><LayerA model={model} metrics={metrics} /></Layer>
    </Group>
    <Group style={{ translateX: 124, translateY: 150 }}>
      <Layer style={{ width: 80, height: 42 }}><LayerB model={model} metrics={metrics} /></Layer>
    </Group>
    {model.consumerVisible ? <RetainedConsumer model={model} metrics={metrics} /> : null}
    <ReactionProbe model={model} metrics={metrics} />
  </Group>;
}

export function SignalsLabRootB({ model, metrics }: RootProps) {
  metrics.componentTraversals += 1;
  metrics.rootRenders.b += 1;
  const shared = model.shared.get();
  return <Group>
    <Rectangle style={{ width: 480, height: 120, fill: '#eff6ff' }} />
    <Text style={{ x: 24, y: 54, fill: '#1e3a8a', font: '800 16px monospace' }}>{`second root ${shared}`}</Text>
  </Group>;
}

export function createSignalsLabModel(
  createWritable: <T>(initial: T, debugName: string) => WritableSignal<T>,
  metrics: SignalsLabMetrics,
): SignalsLabModel {
  const derivedSource = createWritable(0, 'laboratory derived source');
  const selectLeft = createWritable(true, 'laboratory dependency selector');
  const left = createWritable(0, 'laboratory left source');
  const right = createWritable(20, 'laboratory right source');
  return {
    direct: createWritable(1, 'laboratory direct source'),
    derivedSource,
    selectLeft,
    left,
    right,
    shared: createWritable(0, 'laboratory shared source'),
    layerA: createWritable(1, 'laboratory layer A source'),
    layerB: createWritable(1, 'laboratory layer B source'),
    retained: createWritable(0, 'laboratory retained source'),
    reactionOnly: createWritable(0, 'laboratory reaction-only source'),
    derived: computed(() => {
      metrics.computedEvaluations += 1;
      metrics.computedValidations += 1;
      return derivedSource.get() % 2 + (selectLeft.get() ? left.get() : right.get());
    }, { debugName: 'laboratory computed value' }),
    consumerVisible: true,
  };
}
