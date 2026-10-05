import { runTeardown } from './teardowns.js';
import { cloneCRCElement } from './element/create-element.js';
import {
  getElementSource,
  registerElementCloneMetadataHandler,
  type CRCElementSource,
} from './element/metadata.js';
import type {
  CRCComponentRefs,
  CRCElement,
  CRCInstance,
} from './types.js';
import type { CRCPresentationTransformLineage } from './global-state.js';

/**
 * Resolved primitive inputs and transform lineage supplied to an official attachment integration.
 *
 * @see {@link CRCElementSource}
 * @see {@link CRCInternalMountedPropAttachment}
 */
export interface CRCInternalPrimitiveAttachmentInput {
  /**
   * Component function owning the primitive attachment. See
   * {@link CRCInternalPrimitiveAttachmentInput}.
   */
  readonly componentType: Function;
  /** Component name retained for diagnostics. See {@link CRCInternalPrimitiveAttachmentInput}. */
  readonly componentName: string;
  /**
   * Component props supplied to evaluation or measurement. See
   * {@link CRCInternalPrimitiveAttachmentInput}.
   */
  readonly props: Readonly<Record<PropertyKey, unknown>>;
  /**
   * Declared presentation and layout properties. See {@link CRCInternalPrimitiveAttachmentInput}.
   */
  readonly style: Readonly<Record<PropertyKey, unknown>>;
  /** Authoring source location retained for diagnostics. See {@link CRCElementSource}. */
  readonly source: CRCElementSource | undefined;
  /** World transform at the primitive's parent. See {@link CRCInternalPrimitiveAttachmentInput}. */
  readonly parentWorldTransform: DOMMatrix;
  /** Exact CRC-owned transform lineage at this primitive's parent. */
  readonly presentationTransformLineage: CRCPresentationTransformLineage | undefined;
  /** A direct Canvas transform occurred outside the tracked CRC lineage. */
  readonly hasUntrackedCanvasTransform: boolean;
}

/**
 * Mount-owned primitive attachment with explicit update and teardown semantics.
 *
 * @see {@link CRCInternalPrimitiveAttachmentInput}
 * @see {@link crcInternalCreatePropAttachment}
 */
export interface CRCInternalMountedPropAttachment {
  /**
   * Updates the mounted attachment using the latest resolved primitive inputs. See
   * {@link CRCInternalMountedPropAttachment}.
   * @param value - Latest attachment descriptor supplied by the component.
   */
  update(value: unknown): void;
  /**
   * Enters the attachment's scope before primitive evaluation. See
   * {@link CRCInternalMountedPropAttachment}.
   */
  enter(): void;
  /**
   * Prepares the attachment against the primitive's resolved inputs. See
   * {@link CRCInternalMountedPropAttachment}.
   * @param input - Primitive props, style, and geometry for attachment preparation. See
   * {@link CRCInternalPrimitiveAttachmentInput} .
   * @returns An optional presentation transform for the primitive.
   */
  preparePrimitive(input: CRCInternalPrimitiveAttachmentInput): Readonly<{
    /**
     * Transform applied to the primitive's presented Canvas geometry. See
     * {@link CRCInternalMountedPropAttachment}.
     */
    readonly presentationTransform2D?: DOMMatrix;
  }> | void;
  /**
   * Restores the surrounding scope after primitive evaluation. See
   * {@link CRCInternalMountedPropAttachment}.
   * @param success - Whether the attached component completed successfully.
   */
  exit(success: boolean): void;
  /**
   * Releases resources owned by this mounted object. See {@link CRCInternalMountedPropAttachment}
   * .
   */
  dispose(): void;
}

export interface CRCElementEnhancerDescriptor {
  readonly key: symbol;
  mount(context: {
    readonly component: CRCComponentRefs<any>;
    readonly instance: CRCInstance;
  }): CRCMountedElementEnhancer;
}

export interface CRCMountedElementEnhancer {
  update(next: CRCElementEnhancerDescriptor): void;
  enter(): void;
  preparePrimitive?(
    input: CRCInternalPrimitiveAttachmentInput,
  ): Readonly<{ readonly presentationTransform2D?: DOMMatrix }> | void;
  exit(success: boolean): void;
  dispose(): void;
}

interface CRCMountedElementEnhancerEntry {
  readonly key: symbol;
  readonly mounted: CRCMountedElementEnhancer;
}

interface AttachmentFactoryRecord {
  readonly property: 'physics';
  readonly mount: () => CRCInternalMountedPropAttachment;
}

interface CRCPropAttachmentDescriptor extends CRCElementEnhancerDescriptor {
  readonly key: typeof PHYSICS_PROP_ATTACHMENT_KEY;
  readonly value: object;
}

const PHYSICS_PROP_ATTACHMENT_KEY = Symbol('physics prop attachment');

const elementEnhancers = new WeakMap<
  CRCElement<any>,
  readonly CRCElementEnhancerDescriptor[]
>();
const mountedElementEnhancers = new WeakMap<
  CRCComponentRefs<any>,
  CRCMountedElementEnhancerEntry[]
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
  element: CRCElement<P>,
  descriptor: CRCElementEnhancerDescriptor,
): CRCElement<P>;
export function appendElementEnhancer(
  element: CRCElement<any>,
  descriptor: CRCElementEnhancerDescriptor,
): CRCElement<any> {
  const enhanced = cloneCRCElement(element);
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
 * {@link CRCInternalMountedPropAttachment} .
 * @returns The public descriptor associated with the private mount factory.
 *
 * @see {@link CRCInternalMountedPropAttachment}
 */
export function crcInternalCreatePropAttachment<T extends object>(
  property: 'physics',
  publicValue: T,
  mount: () => CRCInternalMountedPropAttachment,
): T {
  propAttachments.set(publicValue, { property, mount });
  return publicValue;
}

/** @internal Layer cache key for otherwise field-identical enhanced elements. */
export function haveSameElementEnhancers(
  left: CRCElement<any>,
  right: CRCElement<any>,
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
  element: CRCElement<any>,
): readonly CRCElementEnhancerDescriptor[] {
  return elementEnhancers.get(element) ?? [];
}

/** @internal */
export function hasElementEnhancer(
  element: CRCElement<any>,
  key: symbol,
): boolean {
  return elementEnhancers.get(element)?.some(descriptor =>
    descriptor.key === key
  ) ?? false;
}

/** @internal */
export function reconcileElementEnhancers(
  component: CRCComponentRefs<any>,
  instance: CRCInstance,
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

/** @internal Reports whether a primitive has mounted official attachments. */
export function hasElementEnhancers(component: CRCComponentRefs<any>): boolean {
  return (mountedElementEnhancers.get(component) ?? []).some(
    entry => entry.mounted.preparePrimitive !== undefined,
  );
}

/** @internal Prepares mounted official attachments against resolved geometry. */
export function prepareElementEnhancers(
  component: CRCComponentRefs<any>,
  input: CRCInternalPrimitiveAttachmentInput,
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
  component: CRCComponentRefs<any>,
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
export function disposeElementEnhancers(component: CRCComponentRefs<any>): void {
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

function getPrimitivePropAttachment(
  element: CRCElement<any>,
): CRCPropAttachmentDescriptor | undefined {
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
          mounted.update((next as CRCPropAttachmentDescriptor).value);
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
  element: CRCElement<any>,
  property: 'physics',
): Error {
  const componentName = element.type.name || 'Anonymous';
  const source = getElementSource(element);
  return new Error(
    `${componentName} received an unregistered ${property} prop attachment.` +
      ' Use the matching official CRC package factory.' +
      (source ?
        ` JSX source: ${source.fileName}:${source.lineNumber}:${source.columnNumber}.` :
        ''),
  );
}

function isObject(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) ||
    typeof value === 'function';
}

function disposeEntries(entries: readonly CRCMountedElementEnhancerEntry[]): void {
  for (let index = entries.length - 1; index >= 0; index--) {
    runTeardown(() => entries[index].mounted.dispose());
  }
}
