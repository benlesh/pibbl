import {
  batch,
  getSignalNode,
  assertSignalCommandAllowed,
} from "../signals/graph.js";
import type { Signal, WritableSignal } from "../signals/types.js";
import {
  createDetachedReactiveEdge,
  linkReactiveEdgeToSource,
  unlinkReactiveEdgeFromSource,
  unlinkReactiveEdgeFromConsumer,
  type SignalDependencyConsumer,
} from "../signals/edge.js";
import { queueBeginCommand } from "../scheduler/realm-scheduler.js";
import type {
  CRCManipulationActive,
  CRCManipulationGeometry,
} from "./controller-types.js";
import type { CRCManipulationBox } from "./types.js";

/** A bounded subscription owned only by one armed pointer gesture. */
export function observeGestureInputs(
  values: readonly Signal<unknown>[],
  notify: () => void,
): () => void {
  const consumer: SignalDependencyConsumer = {
    dependencyHead: undefined,
    dependencyTail: undefined,
    dependencyFreeHead: undefined,
    dependencyFreeCount: 0,
    dependencyCount: 0,
    dependencyHighWater: 0,
    collectionCursor: undefined,
    collectionGeneration: 0,
    addDependency() {},
    notify,
  };
  const nodes = new Set(
    values.map((value) => {
      value.get();
      return getSignalNode(value);
    }),
  );
  const edges = [...nodes].map((node) => {
    const edge = createDetachedReactiveEdge(consumer, node);
    linkReactiveEdgeToSource(edge, node.observe?.());
    return edge;
  });
  return () => {
    for (const edge of edges) {
      unlinkReactiveEdgeFromSource(edge);
      unlinkReactiveEdgeFromConsumer(edge);
    }
  };
}

const generations = new WeakMap<object, number>();
export function claimGeometryGeneration(box: object, rotation?: object): void {
  generations.set(box, (generations.get(box) ?? 0) + 1);
  if (rotation) generations.set(rotation, (generations.get(rotation) ?? 0) + 1);
}
interface Rollback {
  box: WritableSignal<CRCManipulationBox>;
  rotation?: WritableSignal<number>;
  before: CRCManipulationGeometry;
  active: WritableSignal<CRCManipulationActive | null>;
}
/** This finite cleanup record contains signals and values, never a mounted tree. */
export function restoreReleasedGesture(record: Rollback): void {
  const priorActive = record.active.get();
  const boxNode = getSignalNode(record.box);
  const rotationNode = record.rotation && getSignalNode(record.rotation);
  const boxVersion = boxNode.version;
  const rotationVersion = rotationNode?.version;
  const boxGeneration = generations.get(record.box);
  const rotationGeneration =
    record.rotation && generations.get(record.rotation);
  const restore = () => {
    batch(() => {
      if (
        boxNode.version === boxVersion &&
        rotationNode?.version === rotationVersion &&
        generations.get(record.box) === boxGeneration &&
        (!record.rotation ||
          generations.get(record.rotation) === rotationGeneration)
      ) {
        record.box.set(record.before.box);
        record.rotation?.set(record.before.rotation);
      }
      if (record.active.get() === priorActive) record.active.set(null);
    });
  };
  try {
    assertSignalCommandAllowed();
  } catch {
    queueBeginCommand(restore);
    return;
  }
  restore();
}
