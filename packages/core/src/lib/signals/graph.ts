import type {
  Signal,
  SignalEquals,
  SignalOptions,
  WritableSignal,
} from './types.js';
import type { CRCRenderTransaction } from '../types.js';

const signalNodes = new WeakMap<object, SignalNode<unknown>>();
const signalValues = new WeakSet<object>();

type ComputedState = 'clean' | 'check' | 'evaluating';

interface ComputedSignalNode<T> extends SignalNode<T> {
  readonly kind: 'computed';
  compute(): T;
  state: ComputedState;
  hasValue: boolean;
  hasError: boolean;
  error: unknown;
  dependencies: Map<SignalNode<unknown>, number>;
  dependencyObservations: Map<SignalNode<unknown>, () => void>;
  invalidate(): void;
  validate(): void;
  observedCount: number;
  pendingValidation: boolean;
  observe(): () => void;
}

export interface SignalNode<T> {
  value: T;
  equals: SignalEquals<T>;
  debugName: string | undefined;
  version: number;
  observers: Set<SignalObserver>;
  observe?(): () => void;
  validate?(): void;
}

export interface SignalObserver {
  (node: SignalNode<unknown>): void;
  propagateInvalidation?: boolean;
}

interface SignalRenderProvisionState {
  readonly baseValue: unknown;
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

const trackingStack: Array<SignalDependencyCollector | undefined> = [];
const writePolicyStack: SignalWritePolicy[] = [];
const computedStack: ComputedSignalNode<unknown>[] = [];
const activeSignalRenderProvisions = new WeakMap<
  SignalNode<unknown>,
  Map<CRCRenderTransaction, SignalRenderProvisionState>
>();
const pendingComputedValidations = new Set<ComputedSignalNode<unknown>>();
let flushingPendingComputedValidations = false;
let rendererConsumers = 0;
let rendererEdges = 0;
let createdRendererConsumers = 0;
let releasedRendererConsumers = 0;
let signalCommitNotifications = 0;
let planComputedValidations = 0;
let computedSourceEdges = 0;
let createdComputedSourceEdges = 0;
let releasedComputedSourceEdges = 0;
let signalGraphPlanWorkNotifier: (() => void) | undefined;
let signalWriterLeasePolicy: SignalWriterLeasePolicy | undefined;

export interface SignalGraphSnapshot {
  readonly rendererConsumers: number;
  readonly rendererEdges: number;
  readonly computedSourceEdges: number;
  readonly pendingComputedValidations: number;
  readonly createdRendererConsumers: number;
  readonly releasedRendererConsumers: number;
  readonly signalCommitNotifications: number;
  readonly planComputedValidations: number;
  readonly createdComputedSourceEdges: number;
  readonly releasedComputedSourceEdges: number;
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
    signalCommitNotifications,
    planComputedValidations,
    createdComputedSourceEdges,
    releasedComputedSourceEdges,
  });
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
}

/** @internal Records release of one renderer dependency edge for tests. */
export function recordRendererEdgeReleased(): void {
  rendererEdges--;
}

function computedWriteErrorLabel(node: SignalNode<unknown>): string {
  return node.debugName === undefined ?
    'Cannot write to a signal while evaluating a computed signal.' :
    `Cannot write to a signal while evaluating computed signal "${node.debugName}".`;
}

function notifySignalObservers(node: SignalNode<unknown>): unknown[] {
  signalCommitNotifications++;
  const failures: unknown[] = [];
  for (const observer of node.observers) {
    try {
      observer(node);
    } catch (error) {
      failures.push(error);
    }
  }
  return failures;
}

function notifyComputedInvalidationObservers(node: SignalNode<unknown>): unknown[] {
  const failures: unknown[] = [];
  for (const observer of node.observers) {
    if (observer.propagateInvalidation) {
      try {
        observer(node);
      } catch (error) {
        failures.push(error);
      }
    }
  }
  return failures;
}

function throwSignalObserverFailures(failures: readonly unknown[]): void {
  if (failures.length > 0) {
    throw new AggregateError(failures, 'CRC signal observer notifications failed.');
  }
}

export function signal<T>(
  initialValue: T,
  options: SignalOptions<T> = {},
): WritableSignal<T> {
  const equals = options.equals ?? Object.is;
  const debugName = options.debugName;
  const node: SignalNode<T> = {
    value: initialValue,
    equals,
    debugName,
    version: 0,
    observers: new Set(),
  };

  let readonlySignal: Signal<T> | undefined;
  const read = (): T => {
    trackingStack.at(-1)?.addDependency(node as SignalNode<unknown>);
    return node.value;
  };
  const assertWriteAllowed = (): void => {
    writePolicyStack.at(-1)?.(node as SignalNode<unknown>, 'direct');
    signalWriterLeasePolicy?.assertDirectWriteAllowed(node as SignalNode<unknown>);
  };
  const commit = (nextValue: T): void => {
    if (node.equals(node.value, nextValue)) {
      return;
    }

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
      return readonlySignal ??= { get: read } as Signal<T>;
    },
  } as WritableSignal<T>;

  signalValues.add(writable);
  signalNodes.set(writable, node as SignalNode<unknown>);
  const readonly = writable.asReadonly();
  signalValues.add(readonly);
  signalNodes.set(readonly, node as SignalNode<unknown>);
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
  let transactionStates = activeSignalRenderProvisions.get(node);
  if (transactionStates === undefined) {
    transactionStates = new Map();
    activeSignalRenderProvisions.set(node, transactionStates);
  }
  let state = transactionStates.get(transaction);
  const publishComputedVersion = (next: unknown): void => {
    node.value = next;
    node.version++;
    throwSignalObserverFailures(
      notifyComputedInvalidationObservers(node),
    );
  };

  if (state === undefined) {
    state = { baseValue: node.value };
    transactionStates.set(transaction, state);
    const activeStates = transactionStates;
    const provisionState = state;
    transaction.onFinish(success => {
      if (!activeStates.delete(transaction)) return;
      if (activeStates.size === 0) {
        activeSignalRenderProvisions.delete(node);
      }
      if (!success) publishComputedVersion(provisionState.baseValue);
    });
  }
  publishComputedVersion(nextValue);
}

export function computed<T>(
  compute: () => T,
  options: SignalOptions<T> = {},
): Signal<T> {
  const node: ComputedSignalNode<T> = {
    kind: 'computed',
    compute,
    value: undefined as T,
    equals: options.equals ?? Object.is,
    debugName: options.debugName,
    version: 0,
    observers: new Set(),
    state: 'check',
    hasValue: false,
    hasError: false,
    error: undefined,
    dependencies: new Map(),
    dependencyObservations: new Map(),
    observedCount: 0,
    pendingValidation: false,
    observe: () => () => {},
    invalidate: () => {},
    validate: () => {},
  };

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

  const invalidate: SignalObserver = (): void => {
    if (node.state !== 'clean') {
      return;
    }
    node.state = 'check';
    enqueueValidation();
    throwSignalObserverFailures(
      notifyComputedInvalidationObservers(node as SignalNode<unknown>),
    );
  };
  invalidate.propagateInvalidation = true;

  const acquireDependency = (dependency: SignalNode<unknown>): void => {
    if (node.dependencyObservations.has(dependency)) return;
    dependency.observers.add(invalidate);
    const releaseObservation = dependency.observe?.() ?? (() => {});
    node.dependencyObservations.set(dependency, releaseObservation);
    computedSourceEdges++;
    createdComputedSourceEdges++;
  };

  const releaseDependency = (dependency: SignalNode<unknown>): void => {
    const releaseObservation = node.dependencyObservations.get(dependency);
    if (releaseObservation === undefined) return;
    dependency.observers.delete(invalidate);
    node.dependencyObservations.delete(dependency);
    releaseObservation();
    computedSourceEdges--;
    releasedComputedSourceEdges++;
  };

  const acquireDependencies = (): void => {
    for (const dependency of node.dependencies.keys()) {
      acquireDependency(dependency);
    }
  };

  const releaseDependencies = (): void => {
    for (const dependency of Array.from(node.dependencyObservations.keys())) {
      releaseDependency(dependency);
    }
  };

  const replaceDependencies = (dependencies: Set<SignalNode<unknown>>): void => {
    if (node.observedCount > 0) {
      for (const dependency of node.dependencies.keys()) {
        if (!dependencies.has(dependency)) releaseDependency(dependency);
      }
      for (const dependency of dependencies) {
        if (!node.dependencies.has(dependency)) acquireDependency(dependency);
      }
    }
    node.dependencies = new Map(
      [...dependencies].map(dependency => [dependency, dependency.version]),
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

    const dependencies = new Set<SignalNode<unknown>>();
    node.state = 'evaluating';
    computedStack.push(node as ComputedSignalNode<unknown>);
    let changed: boolean;
    try {
      const result = withSignalWriteForbidden(
        computedWriteErrorLabel(node as SignalNode<unknown>),
        () => {
          const nextValue = withSignalTracking({
            addDependency: dependency => {
              if (
                !isComputedSignalNode(dependency) ||
                dependency.state !== 'evaluating'
              ) {
                dependencies.add(dependency);
              }
            },
          }, node.compute);
          return {
            nextValue,
            changed: !node.hasValue || node.hasError ||
              !node.equals(node.value, nextValue),
          };
        },
      );

      changed = result.changed;
      if (changed) {
        node.value = result.nextValue;
        node.version++;
      }
      node.hasValue = true;
      node.hasError = false;
      node.error = undefined;
    } catch (error) {
      changed = !node.hasError || node.error !== error;
      node.hasError = true;
      node.error = error;
    } finally {
      computedStack.pop();
      replaceDependencies(dependencies);
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
    for (const [dependency, version] of node.dependencies) {
      dependency.validate?.();
      if (dependency.version !== version) {
        dependencyChanged = true;
      }
    }
    if (node.state === 'clean' && !dependencyChanged) return;
    if (dependencyChanged || node.dependencies.size === 0 || !node.hasValue) {
      evaluate();
    } else {
      node.state = 'clean';
    }
  };

  node.invalidate = () => invalidate(node as SignalNode<unknown>);
  node.validate = validate;

  node.observe = (): (() => void) => {
    node.observedCount++;
    if (node.observedCount === 1) {
      acquireDependencies();
      if (
        node.state === 'clean' &&
        Array.from(node.dependencies).some(
          ([dependency, version]) => dependency.version !== version,
        )
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
      trackingStack.at(-1)?.addDependency(node as SignalNode<unknown>);
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

export function untracked<T>(callback: () => T): T {
  trackingStack.push(undefined);
  try {
    return callback();
  } finally {
    trackingStack.pop();
  }
}

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
}

export interface SignalCommitBatch {
  read<T>(signal: WritableSignal<T>): T;
  stage<T>(signal: WritableSignal<T>, value: T, writer: object): void;
  discardWriter(writer: object): void;
  commit(onApplied?: () => void): void;
  clear(): void;
}

export function createSignalCommitBatch(): SignalCommitBatch {
  const staged = new Map<SignalNode<unknown>, StagedSignalValue>();

  return {
    read<T>(value: WritableSignal<T>): T {
      const node = getSignalNode(value) as SignalNode<T>;
      const candidate = staged.get(node as SignalNode<unknown>);
      return candidate === undefined ? node.value : candidate.value as T;
    },
    stage<T>(value: WritableSignal<T>, nextValue: T, writer: object): void {
      const node = getSignalNode(value) as SignalNode<T>;
      writePolicyStack.at(-1)?.(node as SignalNode<unknown>, 'staged');
      staged.set(node as SignalNode<unknown>, {
        node: node as SignalNode<unknown>,
        value: nextValue,
        writer,
        authorization: signalWriterLeasePolicy?.captureStagedWrite(
          node as SignalNode<unknown>,
          writer,
        ),
      });
    },
    discardWriter(writer: object): void {
      for (const [node, candidate] of staged) {
        if (candidate.writer === writer) {
          staged.delete(node);
        }
      }
    },
    commit(onApplied?: () => void): void {
      const candidates = [...staged.values()];
      staged.clear();
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

      for (const candidate of changed) {
        const node = candidate.node;
        node.value = candidate.value;
        node.version++;
      }
      onApplied?.();
      const failures: unknown[] = [];
      for (const candidate of changed) {
        failures.push(...notifySignalObservers(candidate.node));
      }
      throwSignalObserverFailures(failures);
    },
    clear(): void {
      staged.clear();
    },
  };
}

export function withSignalTracking<T>(
  collector: SignalDependencyCollector,
  callback: () => T,
): T {
  trackingStack.push(collector);
  try {
    return callback();
  } finally {
    trackingStack.pop();
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
