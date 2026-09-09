import type {
  Signal,
  SignalEquals,
  SignalOptions,
  WritableSignal,
} from './types.js';

const signalNodes = new WeakMap<object, SignalNode<unknown>>();
const signalValues = new WeakSet<object>();

export interface SignalNode<T> {
  value: T;
  equals: SignalEquals<T>;
  debugName: string | undefined;
  version: number;
  observers: Set<SignalObserver>;
}

export type SignalObserver = (node: SignalNode<unknown>) => void;

export interface SignalDependencyCollector {
  addDependency(node: SignalNode<unknown>): void;
}

export type SignalWritePolicy = (node: SignalNode<unknown>) => void;

const trackingStack: Array<SignalDependencyCollector | undefined> = [];
const writePolicyStack: SignalWritePolicy[] = [];

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
  const writable = {
    get: read,
    set(nextValue: T): void {
      writePolicyStack.at(-1)?.(node as SignalNode<unknown>);

      if (node.equals(node.value, nextValue)) {
        return;
      }

      node.value = nextValue;
      node.version++;
      for (const observer of node.observers) {
        observer(node as SignalNode<unknown>);
      }
    },
    update(updateValue: (current: T) => T): void {
      writable.set(updateValue(node.value));
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
