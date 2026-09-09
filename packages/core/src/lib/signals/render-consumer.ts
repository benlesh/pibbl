import {
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
  return consumer;
}

const consumerInvalidations = new WeakMap<SignalRenderConsumer, () => void>();

export function collectSignalReads<T>(
  consumer: SignalRenderConsumer,
  callback: () => T,
): T {
  const state = getConsumerState(consumer);
  if (state.disposed) {
    return callback();
  }

  const nextDependencies = new Set<SignalNode<unknown>>();
  const result = withSignalTracking({
    addDependency: dependency => nextDependencies.add(dependency),
  }, callback);
  replaceDependencies(consumer, state, nextDependencies);
  return result;
}

export function disposeSignalRenderConsumer(consumer: SignalRenderConsumer): void {
  const state = getConsumerState(consumer);
  if (state.disposed) {
    return;
  }
  state.disposed = true;
  for (const [node, releaseObservation] of state.dependencies) {
    node.observers.delete(consumerInvalidations.get(consumer)!);
    releaseObservation();
  }
  state.dependencies.clear();
  state.releaseCount++;
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
    }
  }
  for (const node of nextDependencies) {
    if (!state.dependencies.has(node)) {
      node.observers.add(invalidate);
      state.dependencies.set(node, node.observe?.() ?? (() => {}));
    }
  }
}
