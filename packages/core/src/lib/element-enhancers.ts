import { runTeardown } from './teardowns.js';
import type {
  CompEl,
  CompRefs,
  CRCInstance,
  SystemStyle,
} from './types.js';

export interface CRCElementEnhancerDescriptor {
  readonly key: symbol;
  mount(context: {
    readonly component: CompRefs<any>;
    readonly instance: CRCInstance;
  }): CRCMountedElementEnhancer;
}

export interface CRCMountedElementEnhancer {
  update(next: CRCElementEnhancerDescriptor): void;
  enter(): void;
  exit(success: boolean): void;
  dispose(): void;
}

interface CRCMountedElementEnhancerEntry {
  readonly key: symbol;
  readonly mounted: CRCMountedElementEnhancer;
}

const elementEnhancers = new WeakMap<
  CompEl<any, any>,
  readonly CRCElementEnhancerDescriptor[]
>();
const mountedElementEnhancers = new WeakMap<
  CompRefs<any>,
  CRCMountedElementEnhancerEntry[]
>();

/** @internal Adds private metadata without introducing a component boundary. */
export function appendElementEnhancer<
  P,
  S extends SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
>(
  element: CompEl<P, S, N, R>,
  descriptor: CRCElementEnhancerDescriptor,
): CompEl<P, S, N, R> {
  const enhanced = { ...element };
  elementEnhancers.set(enhanced, [
    ...(elementEnhancers.get(element) ?? []),
    descriptor,
  ]);
  return enhanced;
}

/** @internal Layer cache key for otherwise field-identical enhanced elements. */
export function haveSameElementEnhancers(
  left: CompEl<any, any>,
  right: CompEl<any, any>,
): boolean {
  const leftDescriptors = elementEnhancers.get(left) ?? [];
  const rightDescriptors = elementEnhancers.get(right) ?? [];
  return leftDescriptors.length === rightDescriptors.length &&
    leftDescriptors.every((descriptor, index) =>
      descriptor === rightDescriptors[index]
    );
}

/** @internal */
export function hasElementEnhancer(
  element: CompEl<any, any>,
  key: symbol,
): boolean {
  return elementEnhancers.get(element)?.some(descriptor =>
    descriptor.key === key
  ) ?? false;
}

/** @internal */
export function reconcileElementEnhancers(
  component: CompRefs<any>,
  instance: CRCInstance,
): void {
  const descriptors = elementEnhancers.get(component.element) ?? [];
  assertUniqueDescriptorKeys(descriptors);

  const hasOwnership = mountedElementEnhancers.has(component);
  const previous = mountedElementEnhancers.get(component) ?? [];
  const previousByKey = new Map(previous.map(entry => [entry.key, entry]));
  const next: CRCMountedElementEnhancerEntry[] = [];
  const acquired: CRCMountedElementEnhancerEntry[] = [];

  try {
    for (const descriptor of descriptors) {
      let entry = previousByKey.get(descriptor.key);
      if (!entry) {
        entry = {
          key: descriptor.key,
          mounted: descriptor.mount({ component, instance }),
        };
        acquired.push(entry);
      }
      entry.mounted.update(descriptor);
      next.push(entry);
    }
  } catch (error) {
    disposeEntries(acquired);
    throw error;
  }

  const nextKeys = new Set(next.map(entry => entry.key));
  const removed = previous.filter(entry => !nextKeys.has(entry.key));
  if (hasOwnership || next.length > 0) {
    mountedElementEnhancers.set(component, next);
    if (!hasOwnership) {
      component.teardowns.add(() => disposeElementEnhancers(component));
    }
  }
  disposeEntries(removed);
}

/** @internal */
export function enterElementEnhancers(
  component: CompRefs<any>,
): readonly CRCMountedElementEnhancerEntry[] {
  const entered: CRCMountedElementEnhancerEntry[] = [];
  try {
    for (const entry of mountedElementEnhancers.get(component) ?? []) {
      entry.mounted.enter();
      entered.push(entry);
    }
  } catch (error) {
    try {
      exitElementEnhancers(entered, false);
    } catch (exitError) {
      runTeardown(() => { throw exitError; });
    }
    throw error;
  }
  return entered;
}

/** @internal */
export function exitElementEnhancers(
  entered: readonly CRCMountedElementEnhancerEntry[],
  success: boolean,
): void {
  let firstError: unknown;
  for (let index = entered.length - 1; index >= 0; index--) {
    try {
      entered[index].mounted.exit(success);
    } catch (error) {
      firstError ??= error;
      success = false;
    }
  }
  if (firstError) throw firstError;
}

/** @internal */
export function disposeElementEnhancers(component: CompRefs<any>): void {
  const entries = mountedElementEnhancers.get(component) ?? [];
  mountedElementEnhancers.delete(component);
  disposeEntries(entries);
}

function assertUniqueDescriptorKeys(
  descriptors: readonly CRCElementEnhancerDescriptor[],
): void {
  const keys = new Set<symbol>();
  for (const descriptor of descriptors) {
    if (keys.has(descriptor.key)) {
      throw new Error(
        `Duplicate CRC element enhancer "${descriptor.key.description ?? 'anonymous'}".`,
      );
    }
    keys.add(descriptor.key);
  }
}

function disposeEntries(entries: readonly CRCMountedElementEnhancerEntry[]): void {
  for (let index = entries.length - 1; index >= 0; index--) {
    runTeardown(() => entries[index].mounted.dispose());
  }
}
