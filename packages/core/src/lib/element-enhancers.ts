import { runTeardown } from './teardowns.js';
import { clonePibblElement } from './element/create-element.js';
import {
  getElementSource,
  registerElementCloneMetadataHandler,
  type PibblElementSource,
} from './element/metadata.js';
import type {
  PibblComponentRefs,
  PibblElement,
  PibblInstance,
} from './types.js';
import type { PibblPresentationTransformLineage } from './global-state.js';

/**
 * Resolved primitive inputs and transform lineage supplied to an official attachment integration.
 *
 * @see {@link PibblElementSource}
 * @see {@link PibblInternalMountedPropAttachment}
 */
export interface PibblInternalPrimitiveAttachmentInput {
  /**
   * Component function owning the primitive attachment. See
   * {@link PibblInternalPrimitiveAttachmentInput}.
   */
  readonly componentType: Function;
  /** Component name retained for diagnostics. See {@link PibblInternalPrimitiveAttachmentInput}. */
  readonly componentName: string;
  /**
   * Component props supplied to evaluation or measurement. See
   * {@link PibblInternalPrimitiveAttachmentInput}.
   */
  readonly props: Readonly<Record<PropertyKey, unknown>>;
  /**
   * Declared presentation and layout properties. See {@link PibblInternalPrimitiveAttachmentInput}.
   */
  readonly style: Readonly<Record<PropertyKey, unknown>>;
  /** Authoring source location retained for diagnostics. See {@link PibblElementSource}. */
  readonly source: PibblElementSource | undefined;
  /** World transform at the primitive's parent. See {@link PibblInternalPrimitiveAttachmentInput}. */
  readonly parentWorldTransform: DOMMatrix;
  /** Exact Pibbl-owned transform lineage at this primitive's parent. */
  readonly presentationTransformLineage: PibblPresentationTransformLineage | undefined;
  /** A direct Canvas transform occurred outside the tracked Pibbl lineage. */
  readonly hasUntrackedCanvasTransform: boolean;
}

/**
 * Mount-owned primitive attachment with explicit update and teardown semantics.
 *
 * @see {@link PibblInternalPrimitiveAttachmentInput}
 * @see {@link pibblInternalCreatePropAttachment}
 */
export interface PibblInternalMountedPropAttachment {
  /**
   * Updates the mounted attachment using the latest resolved primitive inputs. See
   * {@link PibblInternalMountedPropAttachment}.
   * @param value - Latest attachment descriptor supplied by the component.
   */
  update(value: unknown): void;
  /**
   * Enters the attachment's scope before primitive evaluation. See
   * {@link PibblInternalMountedPropAttachment}.
   */
  enter(): void;
  /**
   * Prepares the attachment against the primitive's resolved inputs. See
   * {@link PibblInternalMountedPropAttachment}.
   * @param input - Primitive props, style, and geometry for attachment preparation. See
   * {@link PibblInternalPrimitiveAttachmentInput} .
   * @returns An optional presentation transform for the primitive.
   */
  preparePrimitive(input: PibblInternalPrimitiveAttachmentInput): Readonly<{
    /**
     * Transform applied to the primitive's presented Canvas geometry. See
     * {@link PibblInternalMountedPropAttachment}.
     */
    readonly presentationTransform2D?: DOMMatrix;
  }> | void;
  /**
   * Restores the surrounding scope after primitive evaluation. See
   * {@link PibblInternalMountedPropAttachment}.
   * @param success - Whether the attached component completed successfully.
   */
  exit(success: boolean): void;
  /**
   * Releases resources owned by this mounted object. See {@link PibblInternalMountedPropAttachment}
   * .
   */
  dispose(): void;
}

export interface PibblElementEnhancerDescriptor {
  readonly key: symbol;
  mount(context: {
    readonly component: PibblComponentRefs<any>;
    readonly instance: PibblInstance;
  }): PibblMountedElementEnhancer;
}

export interface PibblMountedElementEnhancer {
  update(next: PibblElementEnhancerDescriptor): void;
  enter(): void;
  preparePrimitive?(
    input: PibblInternalPrimitiveAttachmentInput,
  ): Readonly<{ readonly presentationTransform2D?: DOMMatrix }> | void;
  exit(success: boolean): void;
  dispose(): void;
}

interface PibblMountedElementEnhancerEntry {
  readonly key: symbol;
  readonly mounted: PibblMountedElementEnhancer;
}

interface AttachmentFactoryRecord {
  readonly property: 'physics';
  readonly mount: () => PibblInternalMountedPropAttachment;
}

interface PibblPropAttachmentDescriptor extends PibblElementEnhancerDescriptor {
  readonly key: typeof PHYSICS_PROP_ATTACHMENT_KEY;
  readonly value: object;
}

const PHYSICS_PROP_ATTACHMENT_KEY = Symbol('physics prop attachment');

const elementEnhancers = new WeakMap<
  PibblElement<any>,
  readonly PibblElementEnhancerDescriptor[]
>();
const mountedElementEnhancers = new WeakMap<
  PibblComponentRefs<any>,
  PibblMountedElementEnhancerEntry[]
>();
const propAttachments = new WeakMap<object, AttachmentFactoryRecord>();

registerElementCloneMetadataHandler((source, clone) => {
  const descriptors = elementEnhancers.get(source);
  if (descriptors) {
    elementEnhancers.set(clone, Object.freeze([...descriptors]));
  }
});

/** @internal Adds private metadata without introducing a component boundary. */
export function appendElementEnhancer<P>(
  element: PibblElement<P>,
  descriptor: PibblElementEnhancerDescriptor,
): PibblElement<P>;
export function appendElementEnhancer(
  element: PibblElement<any>,
  descriptor: PibblElementEnhancerDescriptor,
): PibblElement<any> {
  const enhanced = clonePibblElement(element);
  elementEnhancers.set(enhanced, Object.freeze([
    ...(elementEnhancers.get(element) ?? []),
    descriptor,
  ]));
  return enhanced;
}

/**
 * Registers one closed official-package attachment without mutating its public value.
 *
 * @param property - Reserved prop name receiving the attachment.
 * @param publicValue - Public descriptor exposed to component authors.
 * @param mount - Factory creating the mounted attachment lifetime. See
 * {@link PibblInternalMountedPropAttachment} .
 * @returns The public descriptor associated with the private mount factory.
 *
 * @see {@link PibblInternalMountedPropAttachment}
 */
export function pibblInternalCreatePropAttachment<T extends object>(
  property: 'physics',
  publicValue: T,
  mount: () => PibblInternalMountedPropAttachment,
): T {
  propAttachments.set(publicValue, { property, mount });
  return publicValue;
}

/** @internal Layer cache key for otherwise field-identical enhanced elements. */
export function haveSameElementEnhancers(
  left: PibblElement<any>,
  right: PibblElement<any>,
): boolean {
  const leftDescriptors = elementEnhancers.get(left) ?? [];
  const rightDescriptors = elementEnhancers.get(right) ?? [];
  return leftDescriptors.length === rightDescriptors.length &&
    leftDescriptors.every((descriptor, index) =>
      descriptor === rightDescriptors[index]
    );
}

/** @internal Reads identity-transparent policy descriptors for snapshots. */
export function getElementEnhancerDescriptors(
  element: PibblElement<any>,
): readonly PibblElementEnhancerDescriptor[] {
  return elementEnhancers.get(element) ?? [];
}

/** @internal */
export function hasElementEnhancer(
  element: PibblElement<any>,
  key: symbol,
): boolean {
  return elementEnhancers.get(element)?.some(descriptor =>
    descriptor.key === key
  ) ?? false;
}

/** @internal */
export function reconcileElementEnhancers(
  component: PibblComponentRefs<any>,
  instance: PibblInstance,
  reconcilePrimitiveAttachments = false,
): void {
  const privateDescriptors = elementEnhancers.get(component.element) ?? [];
  const propAttachment = reconcilePrimitiveAttachments ?
    getPrimitivePropAttachment(component.element) :
    undefined;
  const descriptors = propAttachment ?
    [...privateDescriptors, propAttachment] :
    privateDescriptors;
  assertUniqueDescriptorKeys(descriptors);

  const hasOwnership = mountedElementEnhancers.has(component);
  const previous = mountedElementEnhancers.get(component) ?? [];
  const previousByKey = new Map(previous.map(entry => [entry.key, entry]));
  const next: PibblMountedElementEnhancerEntry[] = [];
  const acquired: PibblMountedElementEnhancerEntry[] = [];

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

/** @internal Reports whether a primitive has mounted official attachments. */
export function hasElementEnhancers(component: PibblComponentRefs<any>): boolean {
  return (mountedElementEnhancers.get(component) ?? []).some(
    entry => entry.mounted.preparePrimitive !== undefined,
  );
}

/** @internal Prepares mounted official attachments against resolved geometry. */
export function prepareElementEnhancers(
  component: PibblComponentRefs<any>,
  input: PibblInternalPrimitiveAttachmentInput,
): Readonly<{ readonly presentationTransform2D?: DOMMatrix }> | void {
  let presentationTransform2D: DOMMatrix | undefined;
  for (const entry of mountedElementEnhancers.get(component) ?? []) {
    const prepared = entry.mounted.preparePrimitive?.(input);
    presentationTransform2D =
      prepared?.presentationTransform2D ?? presentationTransform2D;
  }
  return presentationTransform2D ? { presentationTransform2D } : undefined;
}

/** @internal */
export function enterElementEnhancers(
  component: PibblComponentRefs<any>,
): readonly PibblMountedElementEnhancerEntry[] {
  const entered: PibblMountedElementEnhancerEntry[] = [];
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
  entered: readonly PibblMountedElementEnhancerEntry[],
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
export function disposeElementEnhancers(component: PibblComponentRefs<any>): void {
  const entries = mountedElementEnhancers.get(component) ?? [];
  mountedElementEnhancers.delete(component);
  disposeEntries(entries);
}

function assertUniqueDescriptorKeys(
  descriptors: readonly PibblElementEnhancerDescriptor[],
): void {
  const keys = new Set<symbol>();
  for (const descriptor of descriptors) {
    if (keys.has(descriptor.key)) {
      throw new Error(
        `Duplicate Pibbl element enhancer "${descriptor.key.description ?? 'anonymous'}".`,
      );
    }
    keys.add(descriptor.key);
  }
}

function getPrimitivePropAttachment(
  element: PibblElement<any>,
): PibblPropAttachmentDescriptor | undefined {
  const value = (element.props as Readonly<Record<PropertyKey, unknown>>).physics;
  if (value === undefined || value === null) return undefined;
  const record = isObject(value) ? propAttachments.get(value) : undefined;
  if (!record || record.property !== 'physics') {
    throw invalidPropAttachmentError(element, 'physics');
  }
  return {
    key: PHYSICS_PROP_ATTACHMENT_KEY,
    value,
    mount() {
      const mounted = record.mount();
      return {
        update(next) {
          mounted.update((next as PibblPropAttachmentDescriptor).value);
        },
        enter: () => mounted.enter(),
        preparePrimitive: input => mounted.preparePrimitive(input),
        exit: success => mounted.exit(success),
        dispose: () => mounted.dispose(),
      };
    },
  };
}

function invalidPropAttachmentError(
  element: PibblElement<any>,
  property: 'physics',
): Error {
  const componentName = element.type.name || 'Anonymous';
  const source = getElementSource(element);
  return new Error(
    `${componentName} received an unregistered ${property} prop attachment.` +
      ' Use the matching official Pibbl package factory.' +
      (source ?
        ` JSX source: ${source.fileName}:${source.lineNumber}:${source.columnNumber}.` :
        ''),
  );
}

function isObject(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) ||
    typeof value === 'function';
}

function disposeEntries(entries: readonly PibblMountedElementEnhancerEntry[]): void {
  for (let index = entries.length - 1; index >= 0; index--) {
    runTeardown(() => entries[index].mounted.dispose());
  }
}
