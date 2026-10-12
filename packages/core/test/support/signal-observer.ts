import {
  createDetachedReactiveEdge,
  linkReactiveEdgeToSource,
  unlinkReactiveEdgeFromConsumer,
  unlinkReactiveEdgeFromSource,
  type SignalDependencyConsumer,
} from "../../src/lib/signals/edge";
import type { SignalNode } from "../../src/lib/signals/graph";

export interface SignalObserverForTest {
  (node: SignalNode<unknown>): void;
  propagateInvalidation?: boolean;
  renderInvalidation?: boolean;
}

const releasesByNode = new WeakMap<object, Map<SignalObserverForTest, () => void>>();
const consumersByObserver = new WeakMap<SignalObserverForTest, SignalDependencyConsumer>();

/**
 * Attaches an observer through the graph's native edge machinery for a focused
 * test. This is deliberately test-only: production signals expose no
 * subscription API.
 */
export function observeSignalNodeForTest<T>(
  node: SignalNode<T>,
  observer: SignalObserverForTest,
): void {
  let releases = releasesByNode.get(node);
  if (releases?.has(observer)) return;
  if (releases === undefined) {
    releases = new Map();
    releasesByNode.set(node, releases);
  }

  const consumer = consumerForObserver(observer);
  const edge = createDetachedReactiveEdge(consumer, node as SignalNode<unknown>);
  linkReactiveEdgeToSource(edge);
  releases.set(observer, () => {
    unlinkReactiveEdgeFromSource(edge);
    unlinkReactiveEdgeFromConsumer(edge);
    releases!.delete(observer);
    if (releases!.size === 0) releasesByNode.delete(node);
  });
}

function consumerForObserver(observer: SignalObserverForTest): SignalDependencyConsumer {
  let consumer = consumersByObserver.get(observer);
  if (consumer !== undefined) return consumer;
  consumer = {
    dependencyHead: undefined,
    dependencyTail: undefined,
    dependencyFreeHead: undefined,
    dependencyFreeCount: 0,
    dependencyCount: 0,
    dependencyHighWater: 0,
    collectionCursor: undefined,
    collectionGeneration: 0,
    addDependency: () => {},
    notify: source => observer(source),
    get propagateInvalidation(): boolean {
      return observer.propagateInvalidation === true;
    },
    get renderInvalidation(): boolean {
      return observer.renderInvalidation === true;
    },
  };
  consumersByObserver.set(observer, consumer);
  return consumer;
}

export function unobserveSignalNodeForTest<T>(
  node: SignalNode<T>,
  observer: SignalObserverForTest,
): boolean {
  const release = releasesByNode.get(node)?.get(observer);
  if (release === undefined) return false;
  release();
  return true;
}

export function signalObserversForTest<T>(node: SignalNode<T>) {
  return {
    add(observer: SignalObserverForTest): void {
      observeSignalNodeForTest(node, observer);
    },
    delete(observer: SignalObserverForTest): boolean {
      return unobserveSignalNodeForTest(node, observer);
    },
  };
}
