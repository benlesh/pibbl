import {
  recordRendererConsumerCreated,
  recordRendererConsumerReleased,
  recordRendererEdgeCreated,
  recordRendererEdgeReleased,
  type SignalNode,
  withSignalTracking,
} from './graph.js';

export interface SignalRenderConsumer {
  readonly debugName: string;
  readonly releaseCount: number;
  markClean(): void;
}

export interface SignalRenderConsumerOptions {
  debugName: string;
  invalidate(): void;
}

interface ConsumerState {
  readonly dependencies: Map<SignalNode<unknown>, () => void>;
  collectionGeneration: number;
  dirty: boolean;
  disposed: boolean;
  releaseCount: number;
}

const consumerStates = new WeakMap<SignalRenderConsumer, ConsumerState>();

export function createSignalRenderConsumer(
  options: SignalRenderConsumerOptions,
): SignalRenderConsumer {
  const state: ConsumerState = {
    dependencies: new Map(),
    collectionGeneration: 0,
    dirty: true,
    disposed: false,
    releaseCount: 0,
  };

  const consumer: SignalRenderConsumer = {
    debugName: options.debugName,
    get releaseCount(): number {
      return state.releaseCount;
    },
    markClean(): void {
      if (!state.disposed) {
        state.dirty = false;
      }
    },
  };

  const invalidate = (): void => {
    if (state.disposed || state.dirty) {
      return;
    }
    state.dirty = true;
    options.invalidate();
  };
  consumerStates.set(consumer, state);
  consumerInvalidations.set(consumer, invalidate);
  recordRendererConsumerCreated();
  return consumer;
}

const consumerInvalidations = new WeakMap<SignalRenderConsumer, () => void>();

export function collectSignalReads<T>(
  consumer: SignalRenderConsumer,
  callback: (commit: () => void) => T,
): T {
  const state = getConsumerState(consumer);
  if (state.disposed) {
    return withSignalTracking(
      { addDependency: () => {} },
      () => callback(() => {}),
    );
  }

  const collectionGeneration = ++state.collectionGeneration;
  const nextDependencies = new Set<SignalNode<unknown>>();
  let committed = false;
  const commit = (): void => {
    if (committed) return;
    committed = true;
    if (!state.disposed && state.collectionGeneration === collectionGeneration) {
      replaceDependencies(consumer, state, nextDependencies);
    }
  };
  const result = withSignalTracking({
    addDependency: dependency => {
      if (!committed) nextDependencies.add(dependency);
    },
  }, () => callback(commit));
  commit();
  return result;
}

export function disposeSignalRenderConsumer(consumer: SignalRenderConsumer): void {
  const state = getConsumerState(consumer);
  if (state.disposed) {
    return;
  }
  state.disposed = true;
  state.collectionGeneration++;
  for (const [node, releaseObservation] of state.dependencies) {
    node.observers.delete(consumerInvalidations.get(consumer)!);
    releaseObservation();
    recordRendererEdgeReleased();
  }
  state.dependencies.clear();
  state.releaseCount++;
  recordRendererConsumerReleased();
}

function getConsumerState(consumer: SignalRenderConsumer): ConsumerState {
  const state = consumerStates.get(consumer);
  if (state === undefined) {
    throw new TypeError('Expected a signal render consumer created by CRC.');
  }
  return state;
}

function replaceDependencies(
  consumer: SignalRenderConsumer,
  state: ConsumerState,
  nextDependencies: Set<SignalNode<unknown>>,
): void {
  const invalidate = consumerInvalidations.get(consumer)!;
  for (const [node, releaseObservation] of state.dependencies) {
    if (!nextDependencies.has(node)) {
      node.observers.delete(invalidate);
      releaseObservation();
      state.dependencies.delete(node);
      recordRendererEdgeReleased();
    }
  }
  for (const node of nextDependencies) {
    if (!state.dependencies.has(node)) {
      node.observers.add(invalidate);
      state.dependencies.set(node, node.observe?.() ?? (() => {}));
      recordRendererEdgeCreated();
    }
  }
}
