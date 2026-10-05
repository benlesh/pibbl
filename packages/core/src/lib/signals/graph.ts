import type {
  Signal,
  SignalEquals,
  SignalOptions,
  WritableSignal,
} from './types.js';
import type { CRCRenderTransaction } from '../types.js';
import {
  beginReactiveCollection,
  collectReactiveDependency,
  finishReactiveCollection,
  linkReactiveEdgeToSource,
  notifyReactiveEdges,
  unlinkReactiveEdgeFromSource,
  type ReactiveEdge,
  type ReactiveNotificationCursor,
  type SignalDependencyConsumer,
} from './edge.js';

const signalNodes = new WeakMap<object, SignalNode<unknown>>();
const signalValues = new WeakSet<object>();

type ComputedState = 'clean' | 'check' | 'evaluating';

interface ComputedSignalNode<T>
  extends SignalNode<T>, SignalDependencyConsumer {
  readonly kind: 'computed';
  compute(): T;
  state: ComputedState;
  hasValue: boolean;
  hasError: boolean;
  error: unknown;
  invalidate(): void;
  validate(): void;
  observedCount: number;
  pendingValidation: boolean;
  observe(): () => void;
  adoptCandidate(
    candidate: ComputedSignalNode<T>,
    compute: () => T,
    changed: boolean,
    readers: ReadonlySet<SignalDependencyCollector>,
  ): void;
  replaceCompute(compute: () => T, invalidate: boolean): void;
}

/** @internal One isolated formula generation owned by a render transaction. */
export interface ComputedFormulaCandidate<T> {
  readonly signal: Signal<T>;
  readonly readers: Set<SignalDependencyCollector>;
  changed: boolean;
  evaluated: boolean;
  value: T | undefined;
}

export interface SignalNode<T> {
  value: T;
  equals: SignalEquals<T>;
  debugName: string | undefined;
  version: number;
  observerHead: ReactiveEdge | undefined;
  observerTail: ReactiveEdge | undefined;
  observerCount: number;
  activeObserverCursor: ReactiveNotificationCursor | undefined;
  observe?(): () => void;
  validate?(): void;
}

type SignalRenderProvisionStatus = 'pending' | 'success' | 'failure';

interface SignalRenderProvisionEntry {
  readonly transaction: CRCRenderTransaction;
  value: unknown;
  status: SignalRenderProvisionStatus;
}

interface SignalRenderProvisionState {
  baseValue: unknown;
  readonly entries: SignalRenderProvisionEntry[];
  readonly entriesByTransaction: Map<
    CRCRenderTransaction,
    SignalRenderProvisionEntry
  >;
}

export interface SignalDependencyCollector {
  addDependency(node: SignalNode<unknown>): void;
}

export type SignalWriteOperation = 'direct' | 'staged';

export type SignalWritePolicy = (
  node: SignalNode<unknown>,
  operation: SignalWriteOperation,
) => void;

/** @internal Authorization seam owned by the animation writer-lease registry. */
export interface SignalWriterLeasePolicy {
  assertDirectWriteAllowed(node: SignalNode<unknown>): void;
  captureStagedWrite(
    node: SignalNode<unknown>,
    writer: object,
  ): unknown;
  assertStagedWriteAllowed(
    node: SignalNode<unknown>,
    writer: object,
    authorization: unknown,
  ): void;
}

let activeSignalDependencyCollector: SignalDependencyCollector | undefined;
const writePolicyStack: SignalWritePolicy[] = [];
const computedStack: ComputedSignalNode<unknown>[] = [];
function createSignalNodeState<T>(
  value: T,
  equals: SignalEquals<T>,
  debugName: string | undefined,
): SignalNode<T> {
  return {
    value,
    equals,
    debugName,
    version: 0,
    observerHead: undefined,
    observerTail: undefined,
    observerCount: 0,
    activeObserverCursor: undefined,
  };
}

const commandAssertionNode = createSignalNodeState<unknown>(
  undefined,
  Object.is,
  undefined,
);
const activeSignalRenderProvisions = new WeakMap<
  SignalNode<unknown>,
  SignalRenderProvisionState
>();
const pendingComputedValidations = new Set<ComputedSignalNode<unknown>>();
let flushingPendingComputedValidations = false;
let rendererConsumers = 0;
let rendererEdges = 0;
let createdRendererConsumers = 0;
let releasedRendererConsumers = 0;
let createdRendererEdges = 0;
let releasedRendererEdges = 0;
let signalCommitNotifications = 0;
let planComputedValidations = 0;
let computedSourceEdges = 0;
let createdComputedSourceEdges = 0;
let releasedComputedSourceEdges = 0;
let lazyRendererConsumers = 0;
let reusedRendererEdges = 0;
let plainInputResolutions = 0;
let signalInputResolutions = 0;
let shallowInputCopies = 0;
let receiverInputProvisions = 0;
let adoptedReceiverInputProvisions = 0;
let rolledBackReceiverInputProvisions = 0;
let batchedObserverInvalidations = 0;
let reactionConsumers = 0;
let reactionEdges = 0;
let reactionRuns = 0;
let reactionCleanups = 0;
let reactionFailures = 0;
let signalGraphPlanWorkNotifier: (() => void) | undefined;
let signalWriterLeasePolicy: SignalWriterLeasePolicy | undefined;

interface PublicSignalBatchEntry {
  readonly value: unknown;
  readonly computedHasError: boolean | undefined;
  readonly computedError: unknown;
}

interface PublicSignalBatchState {
  readonly entries: Map<SignalNode<unknown>, PublicSignalBatchEntry>;
  readonly failures: unknown[];
}

let activePublicSignalBatch: PublicSignalBatchState | undefined;

export interface SignalGraphSnapshot {
  readonly rendererConsumers: number;
  readonly rendererEdges: number;
  readonly computedSourceEdges: number;
  readonly pendingComputedValidations: number;
  readonly createdRendererConsumers: number;
  readonly releasedRendererConsumers: number;
  readonly createdRendererEdges: number;
  readonly releasedRendererEdges: number;
  readonly signalCommitNotifications: number;
  readonly planComputedValidations: number;
  readonly createdComputedSourceEdges: number;
  readonly releasedComputedSourceEdges: number;
  readonly lazyRendererConsumers: number;
  readonly reusedRendererEdges: number;
  readonly plainInputResolutions: number;
  readonly signalInputResolutions: number;
  readonly shallowInputCopies: number;
  readonly receiverInputProvisions: number;
  readonly adoptedReceiverInputProvisions: number;
  readonly rolledBackReceiverInputProvisions: number;
  readonly batchedObserverInvalidations: number;
  readonly reactionConsumers: number;
  readonly reactionEdges: number;
  readonly reactionRuns: number;
  readonly reactionCleanups: number;
  readonly reactionFailures: number;
}

/** @internal Deterministic ownership and structural evidence for tests. */
export function signalGraphSnapshot(): SignalGraphSnapshot {
  return Object.freeze({
    rendererConsumers,
    rendererEdges,
    computedSourceEdges,
    pendingComputedValidations: pendingComputedValidations.size,
    createdRendererConsumers,
    releasedRendererConsumers,
    createdRendererEdges,
    releasedRendererEdges,
    signalCommitNotifications,
    planComputedValidations,
    createdComputedSourceEdges,
    releasedComputedSourceEdges,
    lazyRendererConsumers,
    reusedRendererEdges,
    plainInputResolutions,
    signalInputResolutions,
    shallowInputCopies,
    receiverInputProvisions,
    adoptedReceiverInputProvisions,
    rolledBackReceiverInputProvisions,
    batchedObserverInvalidations,
    reactionConsumers,
    reactionEdges,
    reactionRuns,
    reactionCleanups,
    reactionFailures,
  });
}

/** @internal Records one component consumer materialized by its first read. */
export function recordLazyRendererConsumerCreated(): void {
  lazyRendererConsumers++;
}

/** @internal Records one render edge reused by recollection or restoration. */
export function recordRendererEdgeReused(restored = false): void {
  if (restored) rendererEdges++;
  reusedRendererEdges++;
}

/** @internal Records one declared plain input that took the identity path. */
export function recordPlainInputResolution(): void {
  plainInputResolutions++;
}

/** @internal Records one declared signal-valued input read. */
export function recordSignalInputResolution(): void {
  signalInputResolutions++;
}

/** @internal Records one copy-on-signal props or style object. */
export function recordShallowInputCopy(): void {
  shallowInputCopies++;
}

/** @internal Records one pre-evaluation receiver input provision. */
export function recordReceiverInputProvisionCreated(): void {
  receiverInputProvisions++;
}

/** @internal Records one provision adopted by its receiver generation. */
export function recordReceiverInputProvisionAdopted(): void {
  receiverInputProvisions--;
  adoptedReceiverInputProvisions++;
}

/** @internal Records one provision discarded without publication. */
export function recordReceiverInputProvisionRolledBack(): void {
  receiverInputProvisions--;
  rolledBackReceiverInputProvisions++;
}

/** @internal Adds one already-read source to the active dependency collector. */
export function trackSignalDependency(node: SignalNode<unknown>): void {
  activeSignalDependencyCollector?.addDependency(node);
}

/** @internal Records one observer invalidation deduplicated by a public batch. */
export function recordBatchedObserverInvalidation(): void {
  batchedObserverInvalidations++;
}

/** @internal Records one live component-owned reaction consumer. */
export function recordReactionConsumerCreated(): void {
  reactionConsumers++;
}

/** @internal Records final release of one reaction consumer. */
export function recordReactionConsumerReleased(): void {
  reactionConsumers--;
}

/** @internal Records one live reaction source edge. */
export function recordReactionEdgeCreated(): void {
  reactionEdges++;
}

/** @internal Records release of one reaction source edge. */
export function recordReactionEdgeReleased(): void {
  reactionEdges--;
}

/** @internal Records one reaction setup attempt. */
export function recordReactionRun(): void {
  reactionRuns++;
}

/** @internal Records one exact cleanup generation execution. */
export function recordReactionCleanup(): void {
  reactionCleanups++;
}

/** @internal Records one setup or cleanup failure. */
export function recordReactionFailure(): void {
  reactionFailures++;
}

/** @internal Records one live renderer consumer for test diagnostics. */
export function recordRendererConsumerCreated(): void {
  rendererConsumers++;
  createdRendererConsumers++;
}

/** @internal Records release of one renderer consumer for test diagnostics. */
export function recordRendererConsumerReleased(): void {
  rendererConsumers--;
  releasedRendererConsumers++;
}

/** @internal Records one live renderer dependency edge for test diagnostics. */
export function recordRendererEdgeCreated(): void {
  rendererEdges++;
  createdRendererEdges++;
}

/** @internal Records release of one renderer dependency edge for tests. */
export function recordRendererEdgeReleased(): void {
  rendererEdges--;
  releasedRendererEdges++;
}

/**
 * Runs a synchronous callback while coalescing signal notifications until the outer batch
 * completes.
 *
 * @param callback - Synchronous work whose signal notifications are grouped.
 * @returns The callback's return value.
 *
 * @see {@link signal}
 * @see {@link computed}
 * @see {@link WritableSignal}
 */
export function batch<T>(callback: () => T): T {
  if (activePublicSignalBatch !== undefined) return callback();

  const state: PublicSignalBatchState = {
    entries: new Map(),
    failures: [],
  };
  activePublicSignalBatch = state;
  let result!: T;
  let callbackFailure: unknown;
  let callbackFailed = false;
  try {
    result = callback();
  } catch (error) {
    callbackFailed = true;
    callbackFailure = error;
  }

  const notificationFailures = flushPublicSignalBatch(state);
  if (callbackFailed) {
    if (notificationFailures.length === 0) throw callbackFailure;
    throw new AggregateError(
      [callbackFailure, ...notificationFailures],
      'CRC signal batch callback and observer notifications failed.',
    );
  }
  throwSignalObserverFailures(notificationFailures);
  return result;
}

function recordPublicBatchEntry(node: SignalNode<unknown>): void {
  const state = activePublicSignalBatch;
  if (state === undefined || state.entries.has(node)) return;
  const computedNode = isComputedSignalNode(node) ? node : undefined;
  state.entries.set(node, {
    value: node.value,
    computedHasError: computedNode?.hasError,
    computedError: computedNode?.error,
  });
}

function flushPublicSignalBatch(state: PublicSignalBatchState): unknown[] {
  try {
    flushPendingComputedValidations();
  } catch (error) {
    if (
      error instanceof AggregateError &&
      error.message === 'CRC signal observer notifications failed.'
    ) {
      state.failures.push(...error.errors);
    } else {
      state.failures.push(error);
    }
  }

  const seen = new Set<SignalDependencyConsumer>();
  const consumers: Array<{
    readonly consumer: SignalDependencyConsumer;
    readonly source: SignalNode<unknown>;
  }> = [];
  for (const [source, entry] of state.entries) {
    let unchanged = false;
    try {
      unchanged = publicBatchEntryEquals(source, entry);
    } catch (error) {
      state.failures.push(error);
    }
    if (unchanged) continue;
    signalCommitNotifications++;
    for (
      let edge = source.observerHead;
      edge !== undefined;
      edge = edge.sourceNext
    ) {
      const consumer = edge.consumer;
      if (consumer.propagateInvalidation === true) continue;
      if (seen.has(consumer)) {
        recordBatchedObserverInvalidation();
        continue;
      }
      seen.add(consumer);
      consumers.push({ consumer, source });
    }
  }

  activePublicSignalBatch = undefined;
  for (const { consumer, source } of consumers) {
    try {
      consumer.notify(source);
    } catch (error) {
      state.failures.push(error);
    }
  }
  return state.failures;
}

function publicBatchEntryEquals(
  node: SignalNode<unknown>,
  entry: PublicSignalBatchEntry,
): boolean {
  if (isComputedSignalNode(node)) {
    if (node.hasError !== entry.computedHasError) return false;
    if (node.hasError && node.error !== entry.computedError) return false;
  }
  return node.equals(entry.value, node.value);
}

function computedWriteErrorLabel(node: SignalNode<unknown>): string {
  return node.debugName === undefined ?
    'Cannot write to a signal while evaluating a computed signal.' :
    `Cannot write to a signal while evaluating computed signal "${node.debugName}".`;
}

function notifySignalObservers(node: SignalNode<unknown>): unknown[] {
  const batchState = activePublicSignalBatch;
  if (batchState !== undefined) {
    batchState.failures.push(...notifyComputedInvalidationObservers(node));
    return [];
  }
  signalCommitNotifications++;
  return notifyReactiveEdges(node);
}

function notifyComputedInvalidationObservers(node: SignalNode<unknown>): unknown[] {
  return notifyReactiveEdges(
    node,
    consumer => consumer.propagateInvalidation === true,
  );
}

function notifyRendererInvalidationObservers(node: SignalNode<unknown>): unknown[] {
  return notifyReactiveEdges(
    node,
    consumer => consumer.renderInvalidation === true,
  );
}

function throwSignalObserverFailures(failures: readonly unknown[]): void {
  if (failures.length > 0) {
    throw new AggregateError(failures, 'CRC signal observer notifications failed.');
  }
}

/**
 * Creates a synchronous writable signal with configurable equality and an optional diagnostic
 * name.
 *
 * @param initialValue - Value stored before the first write.
 * @param options - Equality comparison and optional diagnostic name. See {@link SignalOptions}.
 * @returns A writable signal holding the initial value. See {@link WritableSignal}.
 *
 * @see {@link SignalOptions}
 * @see {@link WritableSignal}
 */
export function signal<T>(
  initialValue: T,
  options: SignalOptions<T> = {},
): WritableSignal<T> {
  const equals = options.equals ?? Object.is;
  const debugName = options.debugName;
  const node = createSignalNodeState(initialValue, equals, debugName);

  let readonlySignal: Signal<T> | undefined;
  const read = (): T => {
    activeSignalDependencyCollector?.addDependency(node as SignalNode<unknown>);
    return node.value;
  };
  const assertWriteAllowed = (): void => {
    writePolicyStack[writePolicyStack.length - 1]?.(
      node as SignalNode<unknown>,
      'direct',
    );
    signalWriterLeasePolicy?.assertDirectWriteAllowed(node as SignalNode<unknown>);
  };
  const commit = (nextValue: T): void => {
    if (node.equals(node.value, nextValue)) {
      return;
    }

    recordPublicBatchEntry(node as SignalNode<unknown>);
    node.value = nextValue;
    node.version++;
    throwSignalObserverFailures(notifySignalObservers(node as SignalNode<unknown>));
  };
  const writable = {
    get: read,
    set(nextValue: T): void {
      assertWriteAllowed();
      commit(nextValue);
    },
    update(updateValue: (current: T) => T): void {
      assertWriteAllowed();
      commit(updateValue(node.value));
    },
    asReadonly(): Signal<T> {
      if (readonlySignal === undefined) {
        readonlySignal = { get: read } as Signal<T>;
        signalValues.add(readonlySignal);
        signalNodes.set(readonlySignal, node as SignalNode<unknown>);
      }
      return readonlySignal;
    },
  } as WritableSignal<T>;

  signalValues.add(writable);
  signalNodes.set(writable, node as SignalNode<unknown>);
  return writable;
}

/**
 * @internal Presents a provisional value to reads and computed dependencies
 * during one render without publishing an ordinary signal notification.
 * This is reserved for a not-yet-successfully-mounted owner whose render
 * transaction owns acceptance or restoration of every overlapping preview.
 */
export function provisionSignalValueForRender<T>(
  value: WritableSignal<T>,
  nextValue: T,
  transaction: CRCRenderTransaction,
): void {
  const node = getSignalNode(value) as SignalNode<unknown>;
  const publishComputedVersion = (next: unknown): void => {
    node.value = next;
    node.version++;
    throwSignalObserverFailures(
      notifyComputedInvalidationObservers(node),
    );
  };
  let state = activeSignalRenderProvisions.get(node);
  if (state === undefined) {
    state = {
      baseValue: node.value,
      entries: [],
      entriesByTransaction: new Map(),
    };
    activeSignalRenderProvisions.set(node, state);
  }

  const effectiveEntry = (): SignalRenderProvisionEntry | undefined => {
    for (let index = state.entries.length - 1; index >= 0; index--) {
      const entry = state.entries[index];
      if (entry.status !== 'failure') return entry;
    }
    return undefined;
  };
  const publishEffectiveValue = (
    forceEntry?: SignalRenderProvisionEntry,
  ): boolean => {
    const entry = effectiveEntry();
    const effectiveValue = entry?.value ?? state.baseValue;
    if (
      (forceEntry !== undefined && entry === forceEntry) ||
      !Object.is(node.value, effectiveValue)
    ) {
      publishComputedVersion(effectiveValue);
      return true;
    }
    return false;
  };

  let entry = state.entriesByTransaction.get(transaction);
  if (entry === undefined) {
    entry = { transaction, value: nextValue, status: 'pending' };
    state.entries.push(entry);
    state.entriesByTransaction.set(transaction, entry);
    const provisionState = state;
    const provisionEntry = entry;
    transaction.onFinish(success => {
      if (provisionEntry.status !== 'pending') return;
      provisionEntry.status = success ? 'success' : 'failure';

      while (
        provisionState.entries[0]?.status !== 'pending' &&
        provisionState.entries.length > 0
      ) {
        const settled = provisionState.entries.shift()!;
        provisionState.entriesByTransaction.delete(settled.transaction);
        if (settled.status === 'success') {
          provisionState.baseValue = settled.value;
        }
      }

      const effectiveValueChanged = publishEffectiveValue();
      if (!success && effectiveValueChanged) {
        throwSignalObserverFailures(notifyRendererInvalidationObservers(node));
      }
      if (provisionState.entries.length === 0) {
        activeSignalRenderProvisions.delete(node);
      }
    });
  }
  entry.value = nextValue;
  publishEffectiveValue(entry);
}

/**
 * Creates a lazy, cached readonly signal whose dependencies are tracked during evaluation.
 *
 * @param compute - Synchronous calculation whose signal reads become dependencies.
 * @param options - Equality comparison and optional diagnostic name. See {@link SignalOptions}.
 * @returns A readonly, lazy, cached signal that recomputes when its dependencies change. See
 * {@link Signal} .
 *
 * @see {@link SignalOptions}
 * @see {@link Signal}
 */
export function computed<T>(
  compute: () => T,
  options: SignalOptions<T> = {},
): Signal<T> {
  const node = Object.assign(
    createSignalNodeState(
      undefined as T,
      options.equals ?? Object.is,
      options.debugName,
    ),
    {
    kind: 'computed',
    compute,
    state: 'check',
    hasValue: false,
    hasError: false,
    error: undefined,
    dependencyHead: undefined,
    dependencyTail: undefined,
    dependencyFreeHead: undefined,
    dependencyFreeCount: 0,
    dependencyCount: 0,
    dependencyHighWater: 0,
    collectionCursor: undefined,
    collectionGeneration: 0,
    observedCount: 0,
    pendingValidation: false,
    propagateInvalidation: true,
    addDependency(dependency: SignalNode<unknown>): void {
      if (
        !isComputedSignalNode(dependency) ||
        dependency.state !== 'evaluating'
      ) {
        collectReactiveDependency(node, dependency);
      }
    },
    notify: () => {},
    observe: () => () => {},
    invalidate: () => {},
    validate: () => {},
    adoptCandidate: () => {},
    replaceCompute: () => {},
    },
  ) as ComputedSignalNode<T>;

  const notifyObservers = (): unknown[] => {
    return notifySignalObservers(node as SignalNode<unknown>);
  };

  const enqueueValidation = (): void => {
    if (node.observedCount === 0 || node.pendingValidation) {
      return;
    }
    node.pendingValidation = true;
    const wasEmpty = pendingComputedValidations.size === 0;
    pendingComputedValidations.add(node as ComputedSignalNode<unknown>);
    if (wasEmpty) signalGraphPlanWorkNotifier?.();
  };

  const removePendingValidation = (): void => {
    if (!node.pendingValidation) return;
    node.pendingValidation = false;
    pendingComputedValidations.delete(node as ComputedSignalNode<unknown>);
    if (pendingComputedValidations.size === 0) signalGraphPlanWorkNotifier?.();
  };

  const invalidate = (): void => {
    if (node.state !== 'clean') {
      return;
    }
    node.state = 'check';
    enqueueValidation();
    throwSignalObserverFailures(
      notifyComputedInvalidationObservers(node as SignalNode<unknown>),
    );
  };
  node.notify = invalidate;

  const acquireDependency = (edge: ReactiveEdge): void => {
    if (edge.sourceLinked) return;
    const dependency = edge.source!;
    linkReactiveEdgeToSource(edge, dependency.observe?.());
    computedSourceEdges++;
    createdComputedSourceEdges++;
  };

  const releaseDependency = (edge: ReactiveEdge): void => {
    if (!edge.sourceLinked) return;
    unlinkReactiveEdgeFromSource(edge);
    computedSourceEdges--;
    releasedComputedSourceEdges++;
  };

  const acquireDependencies = (): void => {
    for (
      let edge = node.dependencyHead;
      edge !== undefined;
      edge = edge.consumerNext
    ) {
      acquireDependency(edge);
    }
  };

  const releaseDependencies = (): void => {
    for (
      let edge = node.dependencyHead;
      edge !== undefined;
      edge = edge.consumerNext
    ) {
      releaseDependency(edge);
    }
  };

  const finishDependencies = (): void => {
    finishReactiveCollection(
      node,
      edge => {
        if (node.observedCount > 0) acquireDependency(edge);
        edge.observedVersion = edge.source!.version;
        edge.collectionKind = undefined;
      },
      releaseDependency,
    );
  };

  const cycleError = (): Error => {
    const start = computedStack.indexOf(node as ComputedSignalNode<unknown>);
    const cycle = [...computedStack.slice(start), node as ComputedSignalNode<unknown>]
      .map(computedNode => computedNode.debugName ?? '<computed>')
      .join(' -> ');
    return new Error(`CRC computed cycle: ${cycle}`);
  };

  const evaluate = (): void => {
    if (node.state === 'evaluating') {
      throw cycleError();
    }

    beginReactiveCollection(node);
    node.state = 'evaluating';
    computedStack.push(node as ComputedSignalNode<unknown>);
    let changed: boolean;
    try {
      const result = withSignalWriteForbidden(
        computedWriteErrorLabel(node as SignalNode<unknown>),
        () => {
          const nextValue = withSignalTracking(node, node.compute);
          return {
            nextValue,
            changed: !node.hasValue || node.hasError ||
              !node.equals(node.value, nextValue),
          };
        },
      );

      changed = result.changed;
      if (changed) {
        recordPublicBatchEntry(node as SignalNode<unknown>);
        node.value = result.nextValue;
        node.version++;
      }
      node.hasValue = true;
      node.hasError = false;
      node.error = undefined;
    } catch (error) {
      changed = !node.hasError || node.error !== error;
      if (changed) recordPublicBatchEntry(node as SignalNode<unknown>);
      node.hasError = true;
      node.error = error;
    } finally {
      computedStack.pop();
      finishDependencies();
      node.state = 'clean';
    }
    if (changed) {
      if (node.hasError) node.version++;
      throwSignalObserverFailures(notifyObservers());
    }
  };

  const validate = (): void => {
    if (node.state === 'evaluating') {
      throw cycleError();
    }

    let dependencyChanged = false;
    if (node.state === 'clean' && node.observedCount > 0) return;
    for (
      let edge = node.dependencyHead;
      edge !== undefined;
      edge = edge.consumerNext
    ) {
      const dependency = edge.source!;
      dependency.validate?.();
      if (dependency.version !== edge.observedVersion) {
        dependencyChanged = true;
      }
    }
    if (node.state === 'clean' && !dependencyChanged) return;
    if (dependencyChanged || node.dependencyCount === 0 || !node.hasValue) {
      evaluate();
    } else {
      node.state = 'clean';
    }
  };

  const hasChangedDependencyVersion = (): boolean => {
    for (
      let edge = node.dependencyHead;
      edge !== undefined;
      edge = edge.consumerNext
    ) {
      if (edge.source!.version !== edge.observedVersion) return true;
    }
    return false;
  };

  node.invalidate = invalidate;
  node.validate = validate;

  node.replaceCompute = (nextCompute, shouldInvalidate): void => {
    node.compute = nextCompute;
    if (shouldInvalidate) invalidate();
  };

  node.adoptCandidate = (
    candidate,
    nextCompute,
    changed,
    readers,
  ): void => {
    if (!candidate.hasValue || candidate.hasError) {
      throw new Error('Cannot adopt an unevaluated computed formula candidate.');
    }
    node.compute = nextCompute;
    beginReactiveCollection(node);
    for (
      let edge = candidate.dependencyHead;
      edge !== undefined;
      edge = edge.consumerNext
    ) {
      collectReactiveDependency(node, edge.source!);
    }
    finishDependencies();
    removePendingValidation();
    node.state = 'clean';
    node.hasValue = true;
    node.hasError = false;
    node.error = undefined;
    if (!changed) return;

    recordPublicBatchEntry(node as SignalNode<unknown>);
    node.value = candidate.value;
    node.version++;
    signalCommitNotifications++;
    throwSignalObserverFailures(notifyReactiveEdges(
      node as SignalNode<unknown>,
      consumer => !readers.has(consumer),
    ));
  };

  node.observe = (): (() => void) => {
    node.observedCount++;
    if (node.observedCount === 1) {
      acquireDependencies();
      if (
        node.state === 'clean' &&
        hasChangedDependencyVersion()
      ) {
        node.state = 'check';
      }
    }
    if (node.state === 'check') {
      enqueueValidation();
    }

    let detached = false;
    return () => {
      if (detached) {
        return;
      }
      detached = true;
      node.observedCount--;
      if (node.observedCount === 0) {
        removePendingValidation();
        releaseDependencies();
      }
    };
  };

  const readonly: Signal<T> = {
    get(): T {
      activeSignalDependencyCollector?.addDependency(
        node as SignalNode<unknown>,
      );
      validate();
      removePendingValidation();
      if (node.hasError) {
        throw node.error;
      }
      return node.value;
    },
  } as Signal<T>;

  signalValues.add(readonly);
  signalNodes.set(readonly, node as SignalNode<unknown>);
  return readonly;
}

/** @internal Creates a nominal alias that retains one computed graph identity. */
export function createComputedSignalAlias<T>(
  target: Signal<T>,
  read: () => T,
): Signal<T> {
  const node = requireComputedSignalNode(target);
  const alias = { get: read } as Signal<T>;
  signalValues.add(alias);
  signalNodes.set(alias, node as SignalNode<unknown>);
  return alias;
}

/** @internal Creates one unobserved formula generation for transactional render. */
export function createComputedFormulaCandidate<T>(
  target: Signal<T>,
  compute: () => T,
): ComputedFormulaCandidate<T> {
  const node = requireComputedSignalNode(target);
  return {
    signal: computed(compute, {
      equals: node.equals,
      debugName: node.debugName,
    }),
    readers: new Set(),
    changed: false,
    evaluated: false,
    value: undefined,
  };
}

/** @internal Reads a provisional formula while attributing the stable node. */
export function readComputedFormulaCandidate<T>(
  target: Signal<T>,
  candidate: ComputedFormulaCandidate<T>,
): T {
  const node = requireComputedSignalNode(target);
  const reader = activeSignalDependencyCollector;
  reader?.addDependency(node as SignalNode<unknown>);
  if (reader !== undefined) candidate.readers.add(reader);
  if (!candidate.evaluated) {
    const value = untracked(() => candidate.signal.get());
    candidate.changed = !node.hasValue || node.hasError ||
      !node.equals(node.value, value);
    candidate.value = value;
    candidate.evaluated = true;
  }
  return candidate.value as T;
}

/** @internal Publishes an evaluated formula generation after render success. */
export function adoptComputedFormulaCandidate<T>(
  target: Signal<T>,
  candidate: ComputedFormulaCandidate<T>,
  compute: () => T,
): void {
  const node = requireComputedSignalNode(target);
  const candidateNode = requireComputedSignalNode(candidate.signal);
  node.adoptCandidate(
    candidateNode,
    compute,
    candidate.changed,
    candidate.readers,
  );
}

/** @internal Refreshes a committed formula and optionally invalidates its cache. */
export function replaceComputedFormula<T>(
  target: Signal<T>,
  compute: () => T,
  invalidate: boolean,
): void {
  requireComputedSignalNode(target).replaceCompute(compute, invalidate);
}

function requireComputedSignalNode<T>(
  value: Signal<T>,
): ComputedSignalNode<T> {
  const node = getSignalNode(value);
  if (!isComputedSignalNode(node as SignalNode<unknown>)) {
    throw new TypeError('Expected a computed signal.');
  }
  return node as ComputedSignalNode<T>;
}

/** @internal Called during the scheduler Plan phase. */
export function flushPendingComputedValidations(): void {
  if (flushingPendingComputedValidations) {
    return;
  }

  flushingPendingComputedValidations = true;
  const attempted = new Set<ComputedSignalNode<unknown>>();
  const failures: unknown[] = [];
  try {
    while (pendingComputedValidations.size > 0) {
      const node = Array.from(pendingComputedValidations)
        .find(candidate => !attempted.has(candidate));
      if (node === undefined) {
        break;
      }
      attempted.add(node);
      node.pendingValidation = false;
      pendingComputedValidations.delete(node);
      if (pendingComputedValidations.size === 0) signalGraphPlanWorkNotifier?.();
      if (node.observedCount > 0) {
        planComputedValidations++;
        try {
          node.validate();
        } catch (error) {
          if (
            error instanceof AggregateError &&
            error.message === 'CRC signal observer notifications failed.'
          ) {
            failures.push(...error.errors);
          } else {
            failures.push(error);
          }
          if (node.state === 'check') enqueueComputedValidation(node);
        }
      }
    }
  } finally {
    flushingPendingComputedValidations = false;
  }
  throwSignalObserverFailures(failures);
}

/** @internal Whether the realm scheduler has graph Plan work to service. */
export function hasPendingComputedValidations(): boolean {
  return pendingComputedValidations.size > 0;
}

/** @internal Connects graph liveness to its host-agnostic scheduler owner. */
export function setSignalGraphPlanWorkNotifier(notifier: () => void): void {
  signalGraphPlanWorkNotifier = notifier;
  if (pendingComputedValidations.size > 0) notifier();
}

/**
 * Runs a callback without recording its signal reads as dependencies of the current consumer.
 *
 * @param callback - Synchronous work whose reads should not register dependencies.
 * @returns The callback's return value.
 *
 * @see {@link Signal}
 * @see {@link computed}
 */
export function untracked<T>(callback: () => T): T {
  const previous = activeSignalDependencyCollector;
  activeSignalDependencyCollector = undefined;
  try {
    return callback();
  } finally {
    activeSignalDependencyCollector = previous;
  }
}

/**
 * Checks the nominal CRC signal identity rather than accepting objects that merely have a get
 * method.
 *
 * @param value - Value to check for CRC's nominal signal brand.
 * @returns True if the value is a CRC signal, narrowing its type accordingly. See {@link Signal}.
 *
 * @see {@link Signal}
 */
export function isSignal(value: unknown): value is Signal<unknown> {
  return typeof value === 'object' && value !== null && signalValues.has(value);
}

export function getSignalNode<T>(value: Signal<T>): SignalNode<T> {
  const node =
    typeof value === 'object' && value !== null ? signalNodes.get(value) :
      undefined;
  if (node === undefined) {
    throw new TypeError('Expected a signal created by signal().');
  }
  return node as SignalNode<T>;
}

interface StagedSignalValue {
  readonly node: SignalNode<unknown>;
  value: unknown;
  writer: object;
  authorization: unknown;
  provenance: object | undefined;
  previous: StagedSignalValue | undefined;
}

interface SignalCommitBatchState {
  readonly staged: Map<SignalNode<unknown>, StagedSignalValue>;
  readonly lifecycles: Map<object, SignalCommitLifecycle>;
}

/** @internal Couples a non-signal resource publication to a staged writer. */
export interface SignalCommitLifecycle {
  /** Runs after all fallible commit validation and before signal observers. */
  apply(): void;
  /** Restores a completed apply if a later writer cannot publish. */
  rollback?(): void;
  /** Releases a candidate when its writer never reaches Commit. */
  abort(): void;
}

const signalCommitBatchStates = new WeakMap<
  SignalCommitBatch,
  SignalCommitBatchState
>();

export interface SignalCommitBatch {
  read<T>(signal: WritableSignal<T>): T;
  stage<T>(signal: WritableSignal<T>, value: T, writer: object): void;
  registerLifecycle(writer: object, lifecycle: SignalCommitLifecycle): void;
  discardWriter(writer: object): void;
  commit(onApplied?: () => void): void;
  clear(): void;
}

export function createSignalCommitBatch(): SignalCommitBatch {
  const staged = new Map<SignalNode<unknown>, StagedSignalValue>();

  const batch: SignalCommitBatch = {
    read<T>(value: WritableSignal<T>): T {
      const node = getSignalNode(value) as SignalNode<T>;
      const candidate = staged.get(node as SignalNode<unknown>);
      return candidate === undefined ? node.value : candidate.value as T;
    },
    stage<T>(value: WritableSignal<T>, nextValue: T, writer: object): void {
      stageSignalCommitBatchCandidate(
        staged,
        value,
        nextValue,
        writer,
        undefined,
      );
    },
    registerLifecycle(writer: object, lifecycle: SignalCommitLifecycle): void {
      const prior = state.lifecycles.get(writer);
      if (prior) abortLifecycle(prior);
      state.lifecycles.set(writer, lifecycle);
    },
    discardWriter(writer: object): void {
      for (const [node, candidate] of staged) {
        if (candidate.writer === writer) {
          staged.delete(node);
        }
      }
      const lifecycle = state.lifecycles.get(writer);
      state.lifecycles.delete(writer);
      if (lifecycle) abortLifecycle(lifecycle);
    },
    commit(onApplied?: () => void): void {
      const candidates = [...staged.values()];
      staged.clear();
      try {
        for (const candidate of candidates) {
          signalWriterLeasePolicy?.assertStagedWriteAllowed(
            candidate.node,
            candidate.writer,
            candidate.authorization,
          );
        }

        const changed: StagedSignalValue[] = [];
        for (const candidate of candidates) {
          const node = candidate.node;
          if (!node.equals(node.value, candidate.value)) {
            changed.push(candidate);
          }
        }

        const changedWriters = new Set(changed.map(candidate => candidate.writer));
        const applied: SignalCommitLifecycle[] = [];
        for (const candidate of candidates) {
          const lifecycle = state.lifecycles.get(candidate.writer);
          state.lifecycles.delete(candidate.writer);
          if (!lifecycle) continue;
          if (!changedWriters.has(candidate.writer)) {
            abortLifecycle(lifecycle);
            continue;
          }
          try {
            lifecycle.apply();
            applied.push(lifecycle);
          } catch (error) {
            abortLifecycle(lifecycle);
            for (const appliedLifecycle of applied.reverse()) {
              try { appliedLifecycle.rollback?.(); } catch {}
              abortLifecycle(appliedLifecycle);
            }
            throw error;
          }
        }
        for (const candidate of changed) {
          const node = candidate.node;
          recordPublicBatchEntry(node);
          node.value = candidate.value;
          node.version++;
        }
        onApplied?.();
        const failures: unknown[] = [];
        for (const candidate of changed) {
          failures.push(...notifySignalObservers(candidate.node));
        }
        for (const lifecycle of state.lifecycles.values()) abortLifecycle(lifecycle);
        state.lifecycles.clear();
        throwSignalObserverFailures(failures);
      } catch (error) {
        for (const lifecycle of state.lifecycles.values()) abortLifecycle(lifecycle);
        state.lifecycles.clear();
        throw error;
      }
    },
    clear(): void {
      staged.clear();
      for (const lifecycle of state.lifecycles.values()) abortLifecycle(lifecycle);
      state.lifecycles.clear();
    },
  };
  const state: SignalCommitBatchState = { staged, lifecycles: new Map() };
  signalCommitBatchStates.set(batch, state);
  return batch;
}

function abortLifecycle(lifecycle: SignalCommitLifecycle): void {
  try {
    lifecycle.abort();
  } catch {
    // Abort is cleanup for an already failing or discarded transaction. It must
    // not replace the originating scheduler/commit failure.
  }
}

/** @internal Stages a candidate with rollback provenance for one owner. */
export function stageSignalCommitBatchWithProvenance<T>(
  batch: SignalCommitBatch,
  provenance: object,
  signal: WritableSignal<T>,
  value: T,
  writer: object,
): void {
  stageSignalCommitBatchCandidate(
    requireSignalCommitBatchState(batch).staged,
    signal,
    value,
    writer,
    provenance,
  );
}

/** @internal Discards only candidates staged with one owner's provenance. */
export function discardSignalCommitBatchProvenance(
  batch: SignalCommitBatch,
  provenance: object,
): void {
  discardSignalCommitBatchCandidates(
    requireSignalCommitBatchState(batch).staged,
    candidate => candidate.provenance === provenance,
  );
}

/** @internal Applies friend discardWriter semantics inside one owner provenance. */
export function discardSignalCommitBatchWriterForProvenance(
  batch: SignalCommitBatch,
  provenance: object,
  writer: object,
): void {
  discardSignalCommitBatchCandidates(
    requireSignalCommitBatchState(batch).staged,
    candidate =>
      candidate.provenance === provenance && candidate.writer === writer,
  );
}

function stageSignalCommitBatchCandidate<T>(
  staged: Map<SignalNode<unknown>, StagedSignalValue>,
  value: WritableSignal<T>,
  nextValue: T,
  writer: object,
  provenance: object | undefined,
): void {
  const node = getSignalNode(value) as SignalNode<T>;
  const unknownNode = node as SignalNode<unknown>;
  writePolicyStack[writePolicyStack.length - 1]?.(unknownNode, 'staged');
  staged.set(unknownNode, {
    node: unknownNode,
    value: nextValue,
    writer,
    authorization: signalWriterLeasePolicy?.captureStagedWrite(
      unknownNode,
      writer,
    ),
    provenance,
    previous: staged.get(unknownNode),
  });
}

function requireSignalCommitBatchState(
  batch: SignalCommitBatch,
): SignalCommitBatchState {
  const state = signalCommitBatchStates.get(batch);
  if (!state) throw new TypeError('Expected a CRC signal Commit batch.');
  return state;
}

function discardSignalCommitBatchCandidates(
  staged: Map<SignalNode<unknown>, StagedSignalValue>,
  discard: (candidate: StagedSignalValue) => boolean,
): void {
  for (const [node, candidate] of staged) {
    const retained = discardStagedSignalCandidates(candidate, discard);
    if (retained === undefined) staged.delete(node);
    else staged.set(node, retained);
  }
}

function discardStagedSignalCandidates(
  candidate: StagedSignalValue | undefined,
  discard: (candidate: StagedSignalValue) => boolean,
): StagedSignalValue | undefined {
  const retained: StagedSignalValue[] = [];
  let current = candidate;
  while (current !== undefined) {
    if (!discard(current)) retained.push(current);
    current = current.previous;
  }
  let previous: StagedSignalValue | undefined;
  for (let index = retained.length - 1; index >= 0; index--) {
    retained[index].previous = previous;
    previous = retained[index];
  }
  return previous;
}

export function withSignalTracking<T>(
  collector: SignalDependencyCollector,
  callback: () => T,
): T {
  const previous = activeSignalDependencyCollector;
  activeSignalDependencyCollector = collector;
  try {
    return callback();
  } finally {
    activeSignalDependencyCollector = previous;
  }
}

export function withSignalWritePolicy<T>(
  policy: SignalWritePolicy,
  callback: () => T,
): T {
  writePolicyStack.push(policy);
  try {
    return callback();
  } finally {
    writePolicyStack.pop();
  }
}

export function withSignalWriteForbidden<T>(
  reason: string,
  callback: () => T,
): T {
  return withSignalWritePolicy(() => {
    throw new Error(reason);
  }, callback);
}

export function withDirectSignalWriteForbidden<T>(
  reason: string,
  callback: () => T,
): T {
  return withSignalWritePolicy((_node, operation) => {
    if (operation === 'direct') throw new Error(reason);
  }, callback);
}

/** @internal Checks the active direct-write policy without mutating a signal. */
export function assertSignalCommandAllowed(): void {
  writePolicyStack[writePolicyStack.length - 1]?.(
    commandAssertionNode,
    'direct',
  );
}

/** @internal Preflight a direct signal writer without changing values or versions. */
export function assertDirectSignalWriteAllowed(value: Signal<unknown>): void {
  const node = getSignalNode(value);
  writePolicyStack[writePolicyStack.length - 1]?.(node, 'direct');
  signalWriterLeasePolicy?.assertDirectWriteAllowed(node);
}

/** @internal Installs the singleton policy that validates active writer leases. */
export function installSignalWriterLeasePolicy(
  policy: SignalWriterLeasePolicy,
): void {
  if (signalWriterLeasePolicy !== undefined && signalWriterLeasePolicy !== policy) {
    throw new Error('CRC signal writer-lease policy is already installed.');
  }
  signalWriterLeasePolicy = policy;
}

function isComputedSignalNode(
  node: SignalNode<unknown>,
): node is ComputedSignalNode<unknown> {
  return 'kind' in node && node.kind === 'computed';
}

function enqueueComputedValidation(node: ComputedSignalNode<unknown>): void {
  if (node.observedCount === 0 || node.pendingValidation) return;
  node.pendingValidation = true;
  const wasEmpty = pendingComputedValidations.size === 0;
  pendingComputedValidations.add(node);
  if (wasEmpty) signalGraphPlanWorkNotifier?.();
}
