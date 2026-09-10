import type {
  Signal,
  SignalEquals,
  SignalOptions,
  WritableSignal,
} from './types.js';

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

export interface SignalDependencyCollector {
  addDependency(node: SignalNode<unknown>): void;
}

export type SignalWritePolicy = (node: SignalNode<unknown>) => void;

const trackingStack: Array<SignalDependencyCollector | undefined> = [];
const writePolicyStack: SignalWritePolicy[] = [];
const computedStack: ComputedSignalNode<unknown>[] = [];
const pendingComputedValidations = new Set<ComputedSignalNode<unknown>>();
let flushingPendingComputedValidations = false;

function computedWriteErrorLabel(node: SignalNode<unknown>): string {
  return node.debugName === undefined ?
    'Cannot write to a signal while evaluating a computed signal.' :
    `Cannot write to a signal while evaluating computed signal "${node.debugName}".`;
}

function notifySignalObservers(node: SignalNode<unknown>): unknown[] {
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
    writePolicyStack.at(-1)?.(node as SignalNode<unknown>);
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
    pendingComputedValidations.add(node as ComputedSignalNode<unknown>);
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

  const replaceDependencies = (dependencies: Set<SignalNode<unknown>>): void => {
    for (const dependency of node.dependencies.keys()) {
      if (!dependencies.has(dependency)) {
        dependency.observers.delete(invalidate);
      }
    }
    for (const dependency of dependencies) {
      if (!node.dependencies.has(dependency)) {
        dependency.observers.add(invalidate);
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
            addDependency: dependency => dependencies.add(dependency),
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
      throwSignalObserverFailures(notifyObservers());
    }
  };

  const validate = (): void => {
    if (node.state === 'clean') {
      if (node.hasError) {
        throw node.error;
      }
      return;
    }
    if (node.state === 'evaluating') {
      throw cycleError();
    }

    let dependencyChanged = false;
    for (const [dependency, version] of node.dependencies) {
      dependency.validate?.();
      if (dependency.version !== version) {
        dependencyChanged = true;
        break;
      }
    }
    if (dependencyChanged || node.dependencies.size === 0 || !node.hasValue) {
      evaluate();
    } else {
      node.state = 'clean';
    }
    if (node.hasError) {
      throw node.error;
    }
  };

  node.invalidate = () => invalidate(node as SignalNode<unknown>);
  node.validate = validate;

  node.observe = (): (() => void) => {
    node.observedCount++;
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
      if (node.observedCount === 0 && node.pendingValidation) {
        node.pendingValidation = false;
        pendingComputedValidations.delete(node as ComputedSignalNode<unknown>);
      }
    };
  };

  const readonly: Signal<T> = {
    get(): T {
      trackingStack.at(-1)?.addDependency(node as SignalNode<unknown>);
      validate();
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
  try {
    while (pendingComputedValidations.size > 0) {
      const node = pendingComputedValidations.values().next().value;
      if (node === undefined) {
        break;
      }
      pendingComputedValidations.delete(node);
      node.pendingValidation = false;
      if (node.observedCount > 0) {
        node.validate();
      }
    }
  } finally {
    flushingPendingComputedValidations = false;
  }
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
}

export interface SignalCommitBatch {
  read<T>(signal: WritableSignal<T>): T;
  stage<T>(signal: WritableSignal<T>, value: T, writer: object): void;
  discardWriter(writer: object): void;
  commit(): void;
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
      writePolicyStack.at(-1)?.(node as SignalNode<unknown>);
      staged.set(node as SignalNode<unknown>, {
        node: node as SignalNode<unknown>,
        value: nextValue,
        writer,
      });
    },
    discardWriter(writer: object): void {
      for (const [node, candidate] of staged) {
        if (candidate.writer === writer) {
          staged.delete(node);
        }
      }
    },
    commit(): void {
      const changed: StagedSignalValue[] = [];
      for (const candidate of staged.values()) {
        const node = candidate.node;
        if (!node.equals(node.value, candidate.value)) {
          changed.push(candidate);
        }
      }
      staged.clear();

      for (const candidate of changed) {
        const node = candidate.node;
        node.value = candidate.value;
        node.version++;
      }
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
