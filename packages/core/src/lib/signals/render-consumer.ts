import {
  recordRendererConsumerCreated,
  recordRendererConsumerReleased,
  recordRendererEdgeCreated,
  recordRendererEdgeReleased,
  recordRendererEdgeReused,
  withSignalTracking,
} from './graph.js';
import {
  beginReactiveCollection,
  collectReactiveDependency,
  disposeReactiveConsumer,
  finishReactiveCollection,
  linkReactiveEdgeToSource,
  rollbackReactiveCollection,
  unlinkReactiveEdgeFromSource,
  type ReactiveEdge,
  type SignalDependencyConsumer,
} from './edge.js';

export interface SignalRenderConsumer {
  readonly debugName: string;
  readonly releaseCount: number;
  markClean(): void;
}

export interface SignalRenderConsumerOptions {
  debugName: string;
  invalidate(): void;
}

interface ConsumerState extends SignalDependencyConsumer {
  collecting: boolean;
  dirty: boolean;
  disposed: boolean;
  releaseCount: number;
}

const consumerStates = new WeakMap<SignalRenderConsumer, ConsumerState>();

export function createSignalRenderConsumer(
  options: SignalRenderConsumerOptions,
): SignalRenderConsumer {
  const state: ConsumerState = {
    dependencyHead: undefined,
    dependencyTail: undefined,
    dependencyFreeHead: undefined,
    dependencyFreeCount: 0,
    dependencyCount: 0,
    dependencyHighWater: 0,
    collectionCursor: undefined,
    collectionGeneration: 0,
    collecting: false,
    dirty: true,
    disposed: false,
    releaseCount: 0,
    renderInvalidation: true,
    addDependency(node): void {
      if (state.collecting) collectReactiveDependency(state, node);
    },
    notify(): void {
      if (state.disposed || state.dirty) return;
      state.dirty = true;
      options.invalidate();
    },
  };

  const consumer: SignalRenderConsumer = {
    debugName: options.debugName,
    get releaseCount(): number {
      return state.releaseCount;
    },
    markClean(): void {
      if (!state.disposed) state.dirty = false;
    },
  };

  consumerStates.set(consumer, state);
  recordRendererConsumerCreated();
  return consumer;
}

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

  beginReactiveCollection(state);
  state.collecting = true;
  let committed = false;
  const commit = (): void => {
    if (committed) return;
    committed = true;
    state.collecting = false;
    if (!state.disposed) commitCollectedDependencies(state);
    else rollbackReactiveCollection(state);
  };
  try {
    const result = withSignalTracking(state, () => callback(commit));
    commit();
    return result;
  } catch (error) {
    if (!committed) rollbackReactiveCollection(state);
    throw error;
  } finally {
    state.collecting = false;
  }
}

export function disposeSignalRenderConsumer(consumer: SignalRenderConsumer): void {
  const state = getConsumerState(consumer);
  if (state.disposed) return;
  state.disposed = true;
  state.collectionGeneration++;
  state.collecting = false;
  disposeReactiveConsumer(state, releaseRendererEdge);
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

function commitCollectedDependencies(state: ConsumerState): void {
  finishReactiveCollection(
    state,
    edge => {
      const restored = !edge.sourceLinked;
      if (restored) {
        const source = edge.source!;
        linkReactiveEdgeToSource(edge, source.observe?.());
      }
      if (edge.collectionKind === 'new') {
        recordRendererEdgeCreated();
      } else {
        recordRendererEdgeReused(restored);
      }
      edge.everPublished = true;
      edge.observedVersion = edge.source!.version;
      edge.collectionKind = undefined;
    },
    releaseRendererEdge,
  );
}

function releaseRendererEdge(edge: ReactiveEdge): void {
  if (!edge.sourceLinked) return;
  unlinkReactiveEdgeFromSource(edge);
  recordRendererEdgeReleased();
}
