import type { signalsLabScenarioEntry } from './catalog.js';
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

/**
 * Actions supported by the signals lab scenario's public controller.
 *
 * @see {@link SignalsLabState}
 */
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

/**
 * Observable state exposed by the signals lab scenario for controls and assertions.
 *
 * @see {@link SignalsLabAction}
 * @see {@link signalsLabScenarioEntry}
 */
export interface SignalsLabState {
  /** Direct recorded or configured by this scenario. See {@link SignalsLabState}. */
  direct: number;
  /** Derived source recorded or configured by this scenario. See {@link SignalsLabState}. */
  derivedSource: number;
  /** Left recorded or configured by this scenario. See {@link SignalsLabState}. */
  left: number;
  /** Right recorded or configured by this scenario. See {@link SignalsLabState}. */
  right: number;
  /** Shared recorded or configured by this scenario. See {@link SignalsLabState}. */
  shared: number;
  /** Layer a recorded or configured by this scenario. See {@link SignalsLabState}. */
  layerA: number;
  /** Layer b recorded or configured by this scenario. See {@link SignalsLabState}. */
  layerB: number;
  /** Retained recorded or configured by this scenario. See {@link SignalsLabState}. */
  retained: number;
  /** Selected source recorded or configured by this scenario. See {@link SignalsLabState}. */
  selectedSource: 'left' | 'right';
  /** Computed recorded or configured by this scenario. See {@link SignalsLabState}. */
  computed: number;
  /** Computed evaluations recorded or configured by this scenario. See {@link SignalsLabState}. */
  computedEvaluations: number;
  /** Writes recorded or configured by this scenario. See {@link SignalsLabState}. */
  writes: number;
  /** Input resolutions recorded or configured by this scenario. See {@link SignalsLabState}. */
  inputResolutions: number;
  /** Receiver ids recorded or configured by this scenario. See {@link SignalsLabState}. */
  receiverIds: number;
  /** Provisions recorded or configured by this scenario. See {@link SignalsLabState}. */
  provisions: number;
  /** Adoptions recorded or configured by this scenario. See {@link SignalsLabState}. */
  adoptions: number;
  /** Shallow copies recorded or configured by this scenario. See {@link SignalsLabState}. */
  shallowCopies: number;
  /** Batch flushes recorded or configured by this scenario. See {@link SignalsLabState}. */
  batchFlushes: number;
  /** Computed validations recorded or configured by this scenario. See {@link SignalsLabState}. */
  computedValidations: number;
  /** Reaction runs recorded or configured by this scenario. See {@link SignalsLabState}. */
  reactionRuns: number;
  /** Reaction cleanups recorded or configured by this scenario. See {@link SignalsLabState}. */
  reactionCleanups: number;
  /** Component traversals recorded or configured by this scenario. See {@link SignalsLabState}. */
  componentTraversals: number;
  /** Layer repaints recorded or configured by this scenario. See {@link SignalsLabState}. */
  layerRepaints: number;
  /** Composites recorded or configured by this scenario. See {@link SignalsLabState}. */
  composites: number;
  /** Root renders recorded or configured by this scenario. See {@link SignalsLabState}. */
  rootRenders: Readonly<{
    /** A recorded or configured by this scenario. See {@link SignalsLabState}. */
    a: number;
    /** B recorded or configured by this scenario. See {@link SignalsLabState}. */
    b: number;
  }>;
  /** Layer child renders recorded or configured by this scenario. See {@link SignalsLabState}. */
  layerChildRenders: Readonly<{
    /** A recorded or configured by this scenario. See {@link SignalsLabState}. */
    a: number;
    /** B recorded or configured by this scenario. See {@link SignalsLabState}. */
    b: number;
  }>;
  /** Consumer count recorded or configured by this scenario. See {@link SignalsLabState}. */
  consumerCount: number;
  /** Last action recorded or configured by this scenario. See {@link SignalsLabAction}. */
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
  return <Rectangle style={{ left: 0, top: 0, width: 80, height: 42, fill: value % 2 ? '#2563eb' : '#7c3aed' }} />;
}

function LayerB({ model, metrics }: RootProps) {
  metrics.componentTraversals += 1;
  metrics.layerRepaints += 1;
  metrics.layerChildRenders.b += 1;
  const value = model.layerB.get();
  return <Rectangle style={{ left: 0, top: 0, width: 80, height: 42, fill: value % 2 ? '#f59e0b' : '#10b981' }} />;
}

function RetainedConsumer({ model, metrics }: RootProps) {
  metrics.componentTraversals += 1;
  const retained = model.retained.get();
  return <Text style={{ left: 240, top: 198, fill: '#475569', font: '600 11px monospace' }}>{`retained ${retained}`}</Text>;
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
  return <Rectangle style={{ ...style, left: x, width: 12, height: 12, fill: '#0ea5e9' }} />;
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
    <Rectangle style={{ left: 24 + direct * 8, top: 32, width: 76, height: 54, fill: '#2563eb' }} />
    <SignalInputProbe metrics={metrics} style={{ x: model.direct, y: 98 }} />
    <Text style={{ left: 24, top: 126, fill: '#0f172a', font: '700 13px monospace' }}>{`direct ${direct} · computed ${derived} · shared ${shared}`}</Text>
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
    <Text style={{ left: 24, top: 54, fill: '#1e3a8a', font: '800 16px monospace' }}>{`second root ${shared}`}</Text>
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
