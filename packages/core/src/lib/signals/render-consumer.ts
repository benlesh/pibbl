import {
  recordRendererConsumerCreated,
  recordRendererConsumerReleased,
  recordRendererEdgeCreated,
  recordRendererEdgeReleased,
  recordRendererEdgeReused,
  recordLazyRendererConsumerCreated,
  type SignalDependencyCollector,
  type SignalNode,
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

export interface ComponentSignalRenderOwner {
  signalConsumer: SignalRenderConsumer | undefined;
}

export interface ComponentSignalReadOptions extends SignalRenderConsumerOptions {
  onMaterialize(): void;
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
      if (!state.collecting) return;
      const cursor = state.collectionCursor;
      if (
        cursor?.source === node &&
        cursor.collectionGeneration !== state.collectionGeneration
      ) {
        cursor.collectionGeneration = state.collectionGeneration;
        cursor.collectionKind = 'reused';
        state.collectionCursor = cursor.consumerNext;
        return;
      }
      collectReactiveDependency(state, node);
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

export function collectComponentSignalReads<T>(
  owner: ComponentSignalRenderOwner,
  createOptions: () => ComponentSignalReadOptions,
  callback: (commit: () => void) => T,
): T {
  let consumer = owner.signalConsumer;
  let state = consumer === undefined ? undefined : getConsumerState(consumer);
  let provisional = false;
  let committed = false;
  let onMaterialize: (() => void) | undefined;

  let collector: SignalDependencyCollector;
  if (state === undefined) {
    collector = {
      addDependency(node: SignalNode<unknown>): void {
        if (committed) return;
        if (state === undefined) {
          const options = createOptions();
          onMaterialize = options.onMaterialize;
          consumer = createSignalRenderConsumer(options);
          state = getConsumerState(consumer);
          provisional = true;
          recordLazyRendererConsumerCreated();
          beginConsumerCollection(state);
        }
        state.addDependency(node);
      },
    };
  } else {
    beginConsumerCollection(state);
    collector = state;
  }
  const commit = (): void => {
    if (committed) return;
    committed = true;
    if (state === undefined || consumer === undefined) return;
    state.collecting = false;
    commitCollectedDependencies(state);
    if (state.dependencyCount === 0) {
      if (owner.signalConsumer === consumer) owner.signalConsumer = undefined;
      disposeSignalRenderConsumer(consumer);
    } else if (provisional) {
      owner.signalConsumer = consumer;
      onMaterialize!();
    }
  };

  try {
    const result = withSignalTracking(collector, () => callback(commit));
    commit();
    return result;
  } catch (error) {
    if (!committed && state !== undefined) {
      rollbackReactiveCollection(state);
      if (provisional && consumer !== undefined) {
        disposeSignalRenderConsumer(consumer);
      }
    }
    throw error;
  } finally {
    if (state !== undefined) state.collecting = false;
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

function beginConsumerCollection(state: ConsumerState): void {
  beginReactiveCollection(state);
  state.collecting = true;
}

function commitCollectedDependencies(state: ConsumerState): void {
  const onlyEdge = state.dependencyHead;
  if (
    onlyEdge !== undefined &&
    onlyEdge.consumerNext === undefined &&
    onlyEdge.collectionGeneration === state.collectionGeneration &&
    onlyEdge.sourceLinked &&
    onlyEdge.collectionKind === 'reused'
  ) {
    recordRendererEdgeReused();
    onlyEdge.observedVersion = onlyEdge.source!.version;
    onlyEdge.collectionKind = undefined;
    state.collectionCursor = undefined;
    return;
  }
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
