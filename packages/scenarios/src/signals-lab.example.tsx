import {
  computed,
  Group,
  Layer,
  Rectangle,
  Text,
  type Signal,
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
  | 'reset';

export interface SignalsLabState {
  direct: number;
  derivedSource: number;
  selectedSource: 'left' | 'right';
  computed: number;
  computedEvaluations: number;
  rootRenders: Readonly<{ a: number; b: number }>;
  layerChildRenders: Readonly<{ a: number; b: number }>;
  layerComposites: Readonly<{ a: number; b: number }>;
  consumerCount: number;
  lastAction: 'mount' | SignalsLabAction;
}

export interface SignalsLabMetrics {
  computedEvaluations: number;
  rootRenders: { a: number; b: number };
  layerChildRenders: { a: number; b: number };
  layerComposites: { a: number; b: number };
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
  derived: Signal<number>;
  consumerVisible: boolean;
}

interface RootProps {
  model: SignalsLabModel;
  metrics: SignalsLabMetrics;
}

function LayerA({ model, metrics }: RootProps) {
  metrics.layerChildRenders.a += 1;
  metrics.layerComposites.a += 1;
  const value = model.layerA.get();
  return <Rectangle style={{ x: 0, y: 0, width: 80, height: 42, fill: value % 2 ? '#2563eb' : '#7c3aed' }} />;
}

function LayerB({ model, metrics }: RootProps) {
  metrics.layerChildRenders.b += 1;
  metrics.layerComposites.b += 1;
  const value = model.layerB.get();
  return <Rectangle style={{ x: 0, y: 0, width: 80, height: 42, fill: value % 2 ? '#f59e0b' : '#10b981' }} />;
}

function RetainedConsumer({ model }: RootProps) {
  const retained = model.retained.get();
  return <Text style={{ x: 240, y: 198, fill: '#475569', font: '600 11px monospace' }}>{`retained ${retained}`}</Text>;
}

export function SignalsLabRootA({ model, metrics }: RootProps) {
  metrics.rootRenders.a += 1;
  const direct = model.direct.get();
  const derived = model.derived.get();
  const selectedSource = model.selectLeft.get() ? 'left' : 'right';
  const shared = model.shared.get();
  return <Group>
    <Rectangle style={{ width: 480, height: 240, fill: '#f8fafc' }} />
    <Rectangle style={{ x: 24 + direct * 8, y: 32, width: 76, height: 54, fill: '#2563eb' }} />
    <Text style={{ x: 24, y: 126, fill: '#0f172a', font: '700 13px monospace' }}>{`direct ${direct} · computed ${derived} · ${selectedSource} · shared ${shared}`}</Text>
    <Group style={{ translateX: 24, translateY: 150 }}>
      <Layer style={{ width: 80, height: 42 }}><LayerA model={model} metrics={metrics} /></Layer>
    </Group>
    <Group style={{ translateX: 124, translateY: 150 }}>
      <Layer style={{ width: 80, height: 42 }}><LayerB model={model} metrics={metrics} /></Layer>
    </Group>
    {model.consumerVisible ? <RetainedConsumer model={model} metrics={metrics} /> : null}
  </Group>;
}

export function SignalsLabRootB({ model, metrics }: RootProps) {
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
    derived: computed(() => {
      metrics.computedEvaluations += 1;
      return derivedSource.get() % 2 + (selectLeft.get() ? left.get() : right.get());
    }, { debugName: 'laboratory computed value' }),
    consumerVisible: true,
  };
}
