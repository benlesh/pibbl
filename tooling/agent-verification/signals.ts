import { compareComponentFacts } from './component-diff';
import { observeScheduler } from './scheduler';
import { createSignalOwnershipObserver, type SignalConsumerOwner } from './signal-ownership';
/** Source-development observation of explicitly registered signals. Not a public API. */
import type { ReactiveEdge, SignalDependencyConsumer } from '../../packages/core/src/lib/signals/edge';
import { getSignalNode, isSignal, type SignalNode } from '../../packages/core/src/lib/signals/graph';

<<<<<<< HEAD
type Preview = Readonly<{ kind: 'unavailable' } | { kind: 'special-number'; value: '-0' | 'NaN' | 'Infinity' | '-Infinity' } | { kind: 'opaque'; type: string } | { kind: 'scalar'; value: string | number | boolean | null; truncated?: boolean }>;
=======
type Preview = Readonly<{ kind: 'unavailable' } | { kind: 'opaque'; type: string } | { kind: 'scalar'; value: string | number | boolean | null; truncated?: boolean }>;
>>>>>>> origin/main
interface ComputedView extends SignalNode<unknown> {
  dependencyHead: ReactiveEdge | undefined; dependencyCount: number;
  kind: 'computed'; hasValue: boolean; hasError: boolean;
  state: 'clean' | 'check' | 'evaluating'; observedCount: number;
}
function preview(value: unknown): Preview {
  if (value === null || typeof value === 'boolean') return Object.freeze({ kind: 'scalar', value });
  if (typeof value === 'string') return Object.freeze({ kind: 'scalar', value: value.slice(0, 128), truncated: value.length > 128 });
<<<<<<< HEAD
  if (typeof value === 'number') {
    if (Object.is(value, -0)) return Object.freeze({ kind: 'special-number', value: '-0' });
    if (Number.isNaN(value)) return Object.freeze({ kind: 'special-number', value: 'NaN' });
    if (!Number.isFinite(value)) return Object.freeze({ kind: 'special-number', value: value > 0 ? 'Infinity' : '-Infinity' });
    return Object.freeze({ kind: 'scalar', value });
  }
=======
  if (typeof value === 'number' && Number.isFinite(value)) return Object.freeze({ kind: 'scalar', value });
>>>>>>> origin/main
  // No getters, serializers, iterators, constructors or error messages are read.
  return Object.freeze({ kind: 'opaque', type: typeof value });
}

let nextSession = 0;

export function createSignalInspector(canvas?: HTMLCanvasElement) {
  const ownershipObserver = createSignalOwnershipObserver(canvas);
  const session = ++nextSession;
  let ids = new WeakMap<SignalNode<unknown>, number>();
  let consumerIds = new WeakMap<SignalDependencyConsumer, number>();
  let nextConsumerId = 0;
  const nodes: { id: number; ref: WeakRef<SignalNode<unknown>> }[] = [];
  let disposed = false;
  let snapshotOrdinal = 0;
  let componentSnapshots = new WeakMap<object, { ordinal: number; components: ReturnType<typeof ownershipObserver.snapshot>['components'] }>();
  let truncated = false;
  function register(value: unknown): number | null {
    if (disposed || !isSignal(value)) return null;
    const node = getSignalNode(value);
    const previous = ids.get(node);
    if (previous !== undefined) return previous;
    if (nodes.length >= 64) { truncated = true; return null; }
    const id = nodes.length + 1;
    ids.set(node, id); nodes.push({ id, ref: new WeakRef(node) });
    return id;
  }
  function snapshot() {
    const ownership = ownershipObserver.snapshot();
    let remainingEdges = 128;
    let remainingObservers = 128;
    let truncatedObservers = false;
    let unavailableObservers = false;
    let truncatedDependencies = false;
    let unavailableDependencies = false;
    const records = disposed ? [] : nodes.map(({ id, ref }) => {
      const node = ref.deref();
      if (!node) return Object.freeze({ id, status: 'released' as const });
      const computed = 'kind' in node && node.kind === 'computed' ? node as ComputedView : null;
      const edges: Readonly<{ sourceId: number | null; observedVersion: number; sourceVersion: number | null; subscribed: boolean }>[] = [];
      const unavailable = computed?.state === 'evaluating';
      let edge = unavailable ? undefined : computed?.dependencyHead;
      while (edge && remainingEdges > 0) {
        remainingEdges--;
        edges.push(Object.freeze({ sourceId: edge.source ? ids.get(edge.source) ?? null : null,
          observedVersion: edge.observedVersion, sourceVersion: edge.source?.version ?? null,
          subscribed: edge.sourceLinked }));
        edge = edge.consumerNext;
      }
      const dependencyCompleteness = unavailable ? 'unavailable' : edge ? 'truncated' : 'complete';
      truncatedDependencies ||= !!edge;
      unavailableDependencies ||= unavailable;
      const dependencies = Object.freeze({ count: unavailable ? null : computed?.dependencyCount ?? 0,
        completeness: dependencyCompleteness, edges: Object.freeze(edges) });
<<<<<<< HEAD
      const observerRecords: Readonly<{ owner: Readonly<SignalConsumerOwner> | null; consumerId: number; kind: 'computed' | 'render' | 'reaction' | 'other'; registeredSignalId: number | null; observedVersion: number; dirty: boolean | null }>[] = [];
=======
      const observerRecords: Readonly<{ owner: Readonly<SignalConsumerOwner> | null; consumerId: number; kind: 'computed' | 'render' | 'other'; registeredSignalId: number | null; observedVersion: number; dirty: boolean | null }>[] = [];
>>>>>>> origin/main
      const observersUnavailable = !!node.activeObserverCursor || computed?.state === 'evaluating';
      let observer = observersUnavailable ? undefined : node.observerHead;
      while (observer && remainingObservers > 0) {
        remainingObservers--;
        const consumer = observer.consumer;
        let consumerId = consumerIds.get(consumer);
        if (consumerId === undefined) consumerIds.set(consumer, consumerId = ++nextConsumerId);
        // Legacy consumer flags can be getters into user functions. Inspect only
        // own data descriptors on these CRC-owned records; never invoke accessors.
        const own = (key: string): unknown => Object.getOwnPropertyDescriptor(consumer, key)?.value;
<<<<<<< HEAD
        const kind = own('kind') === 'computed' ? 'computed' : own('kind') === 'reaction' ? 'reaction' : own('renderInvalidation') === true ? 'render' : 'other';
        const dirty = kind === 'render' ? own('dirty') : undefined;
        observerRecords.push(Object.freeze({ consumerId, kind, owner: ownership.records.get(consumer) ?? (kind === 'reaction' ? ownership.componentOwners.get(own('ownerComponent') as object) : undefined) ?? null,
=======
        const kind = own('kind') === 'computed' ? 'computed' : own('renderInvalidation') === true ? 'render' : 'other';
        const dirty = kind === 'render' ? own('dirty') : undefined;
        observerRecords.push(Object.freeze({ consumerId, kind, owner: ownership.records.get(consumer) ?? null,
>>>>>>> origin/main
          registeredSignalId: kind === 'computed' ? ids.get(consumer as unknown as SignalNode<unknown>) ?? null : null,
          observedVersion: observer.observedVersion, dirty: typeof dirty === 'boolean' ? dirty : null,
        }));
        observer = observer.sourceNext;
      }
      truncatedObservers ||= !!observer;
      unavailableObservers ||= observersUnavailable;
      const observers = Object.freeze({ scope: 'direct-subscriptions' as const,
        completeness: observersUnavailable ? 'unavailable' : observer ? 'truncated' : 'complete',
        records: Object.freeze(observerRecords) });
      const cache = !computed ? 'value' : computed.hasError ? 'error' : computed.hasValue ? 'value' : 'never-read';
      // Unobserved computeds may be clean while dependencies have changed. Do not
      // walk/validate those dependencies or falsely label their cache current.
      const validation = !computed ? 'source' : computed.state === 'evaluating' ? 'evaluating' : computed.observedCount === 0 ? 'unobserved' : computed.state;
      return Object.freeze({
        id, status: 'available' as const, kind: computed ? 'computed' : 'source',
        debugName: typeof node.debugName === 'string' ? node.debugName.slice(0, 128) : null,
        version: node.version, observerCount: node.observerCount, cache, validation, dependencies, observers,
        preview: cache === 'value' && validation !== 'evaluating' ? preview(node.value) : Object.freeze({ kind: 'unavailable' as const }),
      });
    });
    const result = Object.freeze({ schema: 'crc-signal-observation/1', scheduler: observeScheduler(), session, status: disposed ? 'disposed' : 'ready',
      completeness: truncated || truncatedDependencies || truncatedObservers ? 'truncated' : unavailableDependencies || unavailableObservers ? 'partial' : 'complete', scope: 'explicitly-registered', ownership: Object.freeze({ scope: 'bound-canvas-components', completeness: ownership.completeness, limits: ownership.limits, visited: ownership.visited, components: ownership.components }), records: Object.freeze(records) });
    componentSnapshots.set(result, { ordinal: ++snapshotOrdinal, components: ownership.components });
    return result;
  }
  return Object.freeze({ register, snapshot, identifyType: ownershipObserver.identifyType, captureSource: ownershipObserver.captureSource,
    compareComponents(before: unknown, after: unknown) {
      const left = before && typeof before === 'object' ? componentSnapshots.get(before) : undefined;
      const right = after && typeof after === 'object' ? componentSnapshots.get(after) : undefined;
      const status = disposed ? 'disposed' as const : !left || !right ? 'invalid-snapshot' as const : left.ordinal > right.ordinal ? 'invalid-order' as const : undefined;
      if (status) return Object.freeze({ status, completeness: 'unavailable' as const, limit: 128, changes: Object.freeze([]) });
      return compareComponentFacts(left!.components, right!.components);
    },
    labelComponent(handle: { readonly session: number; readonly componentId: number; readonly renderGeneration: number }, label: string | null) {
      if (disposed) return Object.freeze({ status: 'disposed' as const });
      if (handle.session !== session) return Object.freeze({ status: 'stale' as const });
      return ownershipObserver.labelComponent(handle.componentId, handle.renderGeneration, label);
    },
    findComponents(label: string) {
      const valid = typeof label === 'string' && label.length > 0 && label.length <= 128;
      const components = ownershipObserver.snapshot().components;
      return Object.freeze({ session, status: disposed ? 'disposed' as const : valid ? 'ready' as const : 'invalid' as const,
        scope: 'inspector-component-labels' as const, completeness: components.completeness,
        matches: Object.freeze(valid ? components.records.filter(record => record.label?.value === label) : []) });
    },
    captureComponentSource(handle: { readonly session: number; readonly componentId: number; readonly renderGeneration: number }) {
      if (disposed) return Object.freeze({ status: 'disposed' as const });
      if (handle.session !== session) return Object.freeze({ status: 'stale' as const });
      return ownershipObserver.captureComponentSource(handle.componentId, handle.renderGeneration);
    }, dispose() { disposed = true; componentSnapshots = new WeakMap(); ownershipObserver.dispose(); nodes.length = 0; ids = new WeakMap(); consumerIds = new WeakMap(); } });
}
