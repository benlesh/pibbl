import type { SignalNode } from './graph.js';

export interface ReactiveEdge {
  source: SignalNode<unknown> | undefined;
  consumer: SignalDependencyConsumer;
  sourcePrevious: ReactiveEdge | undefined;
  sourceNext: ReactiveEdge | undefined;
  consumerPrevious: ReactiveEdge | undefined;
  consumerNext: ReactiveEdge | undefined;
  freeNext: ReactiveEdge | undefined;
  collectionGeneration: number;
  observedVersion: number;
  everPublished: boolean;
  sourceLinked: boolean;
  collectionKind: 'new' | 'reused' | undefined;
  releaseObservation: (() => void) | undefined;
}

export interface ReactiveNotificationCursor {
  next: ReactiveEdge | undefined;
  previous: ReactiveNotificationCursor | undefined;
}

export interface SignalDependencyConsumer {
  dependencyHead: ReactiveEdge | undefined;
  dependencyTail: ReactiveEdge | undefined;
  dependencyFreeHead: ReactiveEdge | undefined;
  dependencyFreeCount: number;
  dependencyCount: number;
  dependencyHighWater: number;
  collectionCursor: ReactiveEdge | undefined;
  collectionGeneration: number;
  addDependency(node: SignalNode<unknown>): void;
  notify(node: SignalNode<unknown>): void;
  propagateInvalidation?: boolean;
  renderInvalidation?: boolean;
}

export function beginReactiveCollection(
  consumer: SignalDependencyConsumer,
): number {
  consumer.collectionGeneration++;
  consumer.collectionCursor = consumer.dependencyHead;
  return consumer.collectionGeneration;
}

export function collectReactiveDependency(
  consumer: SignalDependencyConsumer,
  source: SignalNode<unknown>,
): ReactiveEdge {
  const generation = consumer.collectionGeneration;
  let edge = consumer.collectionCursor;
  if (
    edge?.source === source &&
    edge.collectionGeneration !== generation
  ) {
    edge.collectionGeneration = generation;
    edge.collectionKind = 'reused';
    consumer.collectionCursor = edge.consumerNext;
    return edge;
  }

  for (edge = consumer.dependencyHead; edge !== undefined; edge = edge.consumerNext) {
    if (edge.source !== source) continue;
    if (edge.collectionGeneration !== generation) {
      edge.collectionGeneration = generation;
      edge.collectionKind = 'reused';
      consumer.collectionCursor = edge.consumerNext;
    }
    return edge;
  }

  edge = takeFreeReactiveEdge(consumer) ?? createReactiveEdge(consumer);
  edge.source = source;
  edge.collectionGeneration = generation;
  edge.collectionKind = edge.everPublished ? 'reused' : 'new';
  edge.observedVersion = source.version;
  linkReactiveEdgeToConsumer(edge);
  consumer.collectionCursor = edge.consumerNext;
  return edge;
}

export function finishReactiveCollection(
  consumer: SignalDependencyConsumer,
  publish: (edge: ReactiveEdge) => void,
  release: (edge: ReactiveEdge) => void,
): void {
  let edge = consumer.dependencyHead;
  while (edge !== undefined) {
    const next = edge.consumerNext;
    if (edge.collectionGeneration === consumer.collectionGeneration) {
      publish(edge);
    } else {
      release(edge);
      unlinkReactiveEdgeFromConsumer(edge);
      poolReactiveEdge(consumer, edge);
    }
    edge = next;
  }
  consumer.dependencyHighWater = Math.max(
    consumer.dependencyHighWater,
    consumer.dependencyCount,
  );
  trimReactiveEdgePool(consumer);
  consumer.collectionCursor = undefined;
}

export function rollbackReactiveCollection(
  consumer: SignalDependencyConsumer,
): void {
  let edge = consumer.dependencyHead;
  while (edge !== undefined) {
    const next = edge.consumerNext;
    if (
      edge.collectionGeneration === consumer.collectionGeneration &&
      !edge.sourceLinked
    ) {
      unlinkReactiveEdgeFromConsumer(edge);
      poolReactiveEdge(consumer, edge);
    }
    edge = next;
  }
  trimReactiveEdgePool(consumer);
  consumer.collectionCursor = undefined;
}

export function linkReactiveEdgeToSource(
  edge: ReactiveEdge,
  releaseObservation?: () => void,
): void {
  if (edge.sourceLinked) return;
  const source = edge.source;
  if (source === undefined) {
    throw new Error('Cannot link a reactive edge without a source.');
  }
  edge.sourcePrevious = source.observerTail;
  edge.sourceNext = undefined;
  if (source.observerTail === undefined) {
    source.observerHead = edge;
  } else {
    source.observerTail.sourceNext = edge;
  }
  source.observerTail = edge;
  source.observerCount++;
  edge.sourceLinked = true;
  edge.releaseObservation = releaseObservation;
}

export function unlinkReactiveEdgeFromSource(edge: ReactiveEdge): void {
  if (!edge.sourceLinked) return;
  const source = edge.source!;
  for (
    let cursor = source.activeObserverCursor;
    cursor !== undefined;
    cursor = cursor.previous
  ) {
    if (cursor.next === edge) cursor.next = edge.sourceNext;
  }
  if (edge.sourcePrevious === undefined) {
    source.observerHead = edge.sourceNext;
  } else {
    edge.sourcePrevious.sourceNext = edge.sourceNext;
  }
  if (edge.sourceNext === undefined) {
    source.observerTail = edge.sourcePrevious;
  } else {
    edge.sourceNext.sourcePrevious = edge.sourcePrevious;
  }
  source.observerCount--;
  edge.sourceLinked = false;
  edge.sourcePrevious = undefined;
  edge.sourceNext = undefined;
  const releaseObservation = edge.releaseObservation;
  edge.releaseObservation = undefined;
  releaseObservation?.();
}

export function unlinkReactiveEdgeFromConsumer(edge: ReactiveEdge): void {
  const consumer = edge.consumer;
  if (edge.consumerPrevious === undefined) {
    if (consumer.dependencyHead !== edge) return;
    consumer.dependencyHead = edge.consumerNext;
  } else {
    edge.consumerPrevious.consumerNext = edge.consumerNext;
  }
  if (edge.consumerNext === undefined) {
    consumer.dependencyTail = edge.consumerPrevious;
  } else {
    edge.consumerNext.consumerPrevious = edge.consumerPrevious;
  }
  consumer.dependencyCount--;
  edge.consumerPrevious = undefined;
  edge.consumerNext = undefined;
}

export function disposeReactiveConsumer(
  consumer: SignalDependencyConsumer,
  release: (edge: ReactiveEdge) => void,
): void {
  let edge = consumer.dependencyHead;
  while (edge !== undefined) {
    const next = edge.consumerNext;
    release(edge);
    unlinkReactiveEdgeFromConsumer(edge);
    edge.source = undefined;
    edge.freeNext = undefined;
    edge = next;
  }
  consumer.dependencyFreeHead = undefined;
  consumer.dependencyFreeCount = 0;
  consumer.collectionCursor = undefined;
}

export function notifyReactiveEdges(
  source: SignalNode<unknown>,
  accepts: (consumer: SignalDependencyConsumer) => boolean = () => true,
): unknown[] {
  const failures: unknown[] = [];
  const cursor: ReactiveNotificationCursor = {
    next: source.observerHead,
    previous: source.activeObserverCursor,
  };
  source.activeObserverCursor = cursor;
  try {
    while (cursor.next !== undefined) {
      const edge = cursor.next;
      cursor.next = edge.sourceNext;
      if (!edge.sourceLinked || edge.source !== source) continue;
      if (!accepts(edge.consumer)) continue;
      try {
        edge.consumer.notify(source);
      } catch (error) {
        failures.push(error);
      }
    }
  } finally {
    source.activeObserverCursor = cursor.previous;
  }
  return failures;
}

export function createDetachedReactiveEdge(
  consumer: SignalDependencyConsumer,
  source: SignalNode<unknown>,
): ReactiveEdge {
  const edge = createReactiveEdge(consumer);
  edge.source = source;
  edge.collectionGeneration = consumer.collectionGeneration;
  edge.observedVersion = source.version;
  linkReactiveEdgeToConsumer(edge);
  return edge;
}

function createReactiveEdge(
  consumer: SignalDependencyConsumer,
): ReactiveEdge {
  return {
    source: undefined,
    consumer,
    sourcePrevious: undefined,
    sourceNext: undefined,
    consumerPrevious: undefined,
    consumerNext: undefined,
    freeNext: undefined,
    collectionGeneration: 0,
    observedVersion: -1,
    everPublished: false,
    sourceLinked: false,
    collectionKind: undefined,
    releaseObservation: undefined,
  };
}

function linkReactiveEdgeToConsumer(edge: ReactiveEdge): void {
  const consumer = edge.consumer;
  edge.consumerPrevious = consumer.dependencyTail;
  edge.consumerNext = undefined;
  if (consumer.dependencyTail === undefined) {
    consumer.dependencyHead = edge;
  } else {
    consumer.dependencyTail.consumerNext = edge;
  }
  consumer.dependencyTail = edge;
  consumer.dependencyCount++;
}

function takeFreeReactiveEdge(
  consumer: SignalDependencyConsumer,
): ReactiveEdge | undefined {
  const edge = consumer.dependencyFreeHead;
  if (edge === undefined) return undefined;
  consumer.dependencyFreeHead = edge.freeNext;
  consumer.dependencyFreeCount--;
  edge.freeNext = undefined;
  return edge;
}

function poolReactiveEdge(
  consumer: SignalDependencyConsumer,
  edge: ReactiveEdge,
): void {
  edge.source = undefined;
  edge.collectionKind = undefined;
  edge.observedVersion = Math.max(edge.observedVersion, 0);
  edge.freeNext = consumer.dependencyFreeHead;
  consumer.dependencyFreeHead = edge;
  consumer.dependencyFreeCount++;
}

function trimReactiveEdgePool(consumer: SignalDependencyConsumer): void {
  if (consumer.dependencyFreeCount <= consumer.dependencyHighWater) return;
  let retained = 0;
  let edge = consumer.dependencyFreeHead;
  let previous: ReactiveEdge | undefined;
  while (edge !== undefined) {
    retained++;
    if (retained > consumer.dependencyHighWater) {
      if (previous === undefined) consumer.dependencyFreeHead = undefined;
      else previous.freeNext = undefined;
      consumer.dependencyFreeCount = consumer.dependencyHighWater;
      return;
    }
    previous = edge;
    edge = edge.freeNext;
  }
}
