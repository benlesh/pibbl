import { withSignalWriteForbidden } from '../signals/graph.js';
import { easing } from './easing.js';
import type {
  CRCAnimationDefinition,
  CRCAnimationOptions,
  CRCAnimationSampleInput,
  CRCEasing,
  CRCInterpolator,
  CRCKeyframesOptions,
  CRCStepperOptions,
  CRCTweenOptions,
} from './types.js';

interface BaseDefinitionRecord {
  readonly duration: number;
  readonly debugName: string | undefined;
}

interface TweenDefinitionRecord<T> extends BaseDefinitionRecord {
  readonly kind: 'tween';
  readonly hasFrom: boolean;
  readonly from: T | undefined;
  readonly to: T;
  readonly easing: CRCEasing;
  readonly interpolate: CRCInterpolator<T> | undefined;
}

interface KeyframesDefinitionRecord<T> extends BaseDefinitionRecord {
  readonly kind: 'keyframes';
  readonly values: readonly T[];
  readonly offsets: readonly number[];
  readonly easings: readonly CRCEasing[];
  readonly interpolate: CRCInterpolator<T> | undefined;
}

interface CustomDefinitionRecord<T> extends BaseDefinitionRecord {
  readonly kind: 'custom';
  readonly sample: (input: CRCAnimationSampleInput<T>) => T;
}

interface StepperDefinitionRecord<T> extends BaseDefinitionRecord {
  readonly kind: 'stepper';
  readonly initialState: T;
  readonly step: (state: T, delta: number) => T;
  readonly done: ((state: T) => boolean) | undefined;
  readonly fixedDelta: number;
}

export type DefinitionRecord<T> =
  | TweenDefinitionRecord<T>
  | KeyframesDefinitionRecord<T>
  | CustomDefinitionRecord<T>
  | StepperDefinitionRecord<T>;

const definitionRecords = new WeakMap<
  CRCAnimationDefinition<unknown>,
  DefinitionRecord<unknown>
>();

function definitionLabel(debugName: string | undefined): string {
  return debugName === undefined ? 'CRC animation definition' :
    `CRC animation definition "${debugName}"`;
}

function assertDuration(duration: number, debugName: string | undefined): void {
  if (!Number.isFinite(duration) || duration < 0) {
    throw new RangeError(`${definitionLabel(debugName)} duration must be finite and nonnegative.`);
  }
}

function assertFiniteNumber(value: number, message: string): void {
  if (!Number.isFinite(value)) throw new RangeError(message);
}

const MUTATING_MAP_METHODS = new Set<PropertyKey>(['set', 'delete', 'clear']);
const MUTATING_SET_METHODS = new Set<PropertyKey>(['add', 'delete', 'clear']);
const MUTATING_DATE_METHODS = new Set<PropertyKey>([
  'setDate', 'setFullYear', 'setHours', 'setMilliseconds', 'setMinutes',
  'setMonth', 'setSeconds', 'setTime', 'setUTCDate', 'setUTCFullYear',
  'setUTCHours', 'setUTCMilliseconds', 'setUTCMinutes', 'setUTCMonth',
  'setUTCSeconds', 'setYear',
]);

function immutableBuiltin<T extends object>(
  target: T,
  mutatingMethods: ReadonlySet<PropertyKey>,
): T {
  return new Proxy(target, {
    get(current, key) {
      if (mutatingMethods.has(key)) {
        return (): never => {
          throw new TypeError('Cannot mutate an animation definition snapshot.');
        };
      }
      const member = Reflect.get(current, key, current);
      return typeof member === 'function' && key !== 'constructor' ?
        member.bind(current) : member;
    },
    set(): false {
      return false;
    },
    defineProperty(): false {
      return false;
    },
    deleteProperty(): false {
      return false;
    },
  });
}

function rememberIdentity<T extends object>(
  value: T,
  seen: WeakMap<object, unknown>,
): T {
  seen.set(value, value);
  return value;
}

function hasOwnProperties(value: object, allowed: ReadonlySet<PropertyKey>): boolean {
  return Reflect.ownKeys(value).some(key => !allowed.has(key));
}

function hasOnlyDataProperties(value: object, allowed: ReadonlySet<PropertyKey>): boolean {
  return Reflect.ownKeys(value).every(key => {
    if (allowed.has(key)) return true;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && 'value' in descriptor;
  });
}

const ARRAY_OWN_KEYS = new Set<PropertyKey>(['length']);
const REGEXP_OWN_KEYS = new Set<PropertyKey>(['lastIndex']);

function isArrayIndex(key: PropertyKey): boolean {
  return typeof key === 'string' && /^(?:0|[1-9]\d*)$/u.test(key);
}

function cloneTypedArray(value: ArrayBufferView): ArrayBufferView {
  if (value instanceof DataView) {
    const bytes = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
    return new DataView(bytes);
  }
  const TypedArray = value.constructor as unknown as {
    new (source: ArrayBufferView): ArrayBufferView;
  };
  return new TypedArray(value);
}

/**
 * Definitions retain values after their caller has moved on. The context is
 * shared across one definition so aliases and cycles remain aliases and cycles
 * in its immutable snapshot. Only categories with stable, inspectable cloning
 * semantics are copied. Functions, classes, accessors, and opaque host values
 * (notably WeakMap, WeakSet, Promise, and host handles) remain usable identity
 * values because cloning them can manufacture an invalid receiver or change
 * their behavior; an absolute snapshot guarantee for those values requires an
 * explicit public clone contract that CRC does not currently provide.
 */
function snapshotAnimationValue<T>(
  value: T,
  seen: WeakMap<object, unknown>,
): T {
  if (value === null || typeof value === 'function' || typeof value !== 'object') {
    return value;
  }
  const existing = seen.get(value);
  if (existing !== undefined) return existing as T;

  if (value instanceof Date) {
    if (hasOwnProperties(value, new Set())) return rememberIdentity(value, seen) as T;
    const snapshot = immutableBuiltin(new Date(value.getTime()), MUTATING_DATE_METHODS);
    seen.set(value, snapshot);
    return snapshot as T;
  }
  if (value instanceof Map) {
    if (hasOwnProperties(value, new Set())) return rememberIdentity(value, seen) as T;
    const target = new Map();
    const snapshot = immutableBuiltin(target, MUTATING_MAP_METHODS);
    seen.set(value, snapshot);
    for (const [key, entry] of value) {
      target.set(snapshotAnimationValue(key, seen), snapshotAnimationValue(entry, seen));
    }
    return snapshot as T;
  }
  if (value instanceof Set) {
    if (hasOwnProperties(value, new Set())) return rememberIdentity(value, seen) as T;
    const target = new Set();
    const snapshot = immutableBuiltin(target, MUTATING_SET_METHODS);
    seen.set(value, snapshot);
    for (const entry of value) target.add(snapshotAnimationValue(entry, seen));
    return snapshot as T;
  }
  if (Array.isArray(value)) {
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some(key => !ARRAY_OWN_KEYS.has(key) && !isArrayIndex(key)) ||
      !hasOnlyDataProperties(value, ARRAY_OWN_KEYS)) {
      return rememberIdentity(value, seen) as T;
    }
    const snapshot: unknown[] = [];
    seen.set(value, snapshot);
    for (const item of value) {
      snapshot.push(snapshotAnimationValue(item, seen));
    }
    return Object.freeze(snapshot) as T;
  }

  if (value instanceof RegExp) {
    if (hasOwnProperties(value, REGEXP_OWN_KEYS)) return rememberIdentity(value, seen) as T;
    const snapshot = new RegExp(value.source, value.flags);
    snapshot.lastIndex = value.lastIndex;
    seen.set(value, snapshot);
    return snapshot as T;
  }

  if (ArrayBuffer.isView(value)) {
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some(key => !isArrayIndex(key))) return rememberIdentity(value, seen) as T;
    const snapshot = cloneTypedArray(value);
    seen.set(value, snapshot);
    return snapshot as T;
  }

  if (value instanceof ArrayBuffer) {
    const snapshot = value.slice(0);
    seen.set(value, snapshot);
    return snapshot as T;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null ||
    !hasOnlyDataProperties(value, new Set())) {
    return rememberIdentity(value, seen) as T;
  }
  const snapshot = Object.create(prototype) as Record<PropertyKey, unknown>;
  seen.set(value, snapshot);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) continue;
    Object.defineProperty(snapshot, key, {
      configurable: false,
      enumerable: descriptor.enumerable,
      writable: false,
      value: snapshotAnimationValue(descriptor.value, seen),
    });
  }
  return Object.freeze(snapshot) as T;
}

function validateSampledValue<T>(sampled: T, debugName: string | undefined): T {
  if (typeof sampled === 'number' && !Number.isFinite(sampled)) {
    throw new RangeError(`${definitionLabel(debugName)} sampled value must be finite.`);
  }
  return sampled;
}

function createDefinition<T>(record: DefinitionRecord<T>): CRCAnimationDefinition<T> {
  const definition = Object.freeze({}) as CRCAnimationDefinition<T>;
  definitionRecords.set(
    definition as CRCAnimationDefinition<unknown>,
    Object.freeze(record) as DefinitionRecord<unknown>,
  );
  return definition;
}

function hasOwn(object: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function callback<T>(
  debugName: string | undefined,
  callback: () => T,
): T {
  return withSignalWriteForbidden(
    `${definitionLabel(debugName)} callbacks cannot write to signals.`,
    callback,
  );
}

function sampledProgress(duration: number, localTime: number): {
  readonly localTime: number;
  readonly progress: number;
} {
  assertFiniteNumber(localTime, 'CRC animation sample localTime must be finite.');
  if (duration === 0) return Object.freeze({ localTime: 0, progress: 1 });
  const normalizedLocalTime = Math.min(duration, Math.max(0, localTime));
  return Object.freeze({
    localTime: normalizedLocalTime,
    progress: normalizedLocalTime / duration,
  });
}

function interpolate<T>(
  from: T,
  to: T,
  progress: number,
  custom: CRCInterpolator<T> | undefined,
  debugName: string | undefined,
): T {
  if (custom === undefined && (typeof from !== 'number' || typeof to !== 'number')) {
    throw new TypeError(`${definitionLabel(debugName)} requires an explicit interpolator for nonnumeric values.`);
  }
  const sampled = custom === undefined ?
    ((from as unknown as number) +
      ((to as unknown as number) - (from as unknown as number)) * progress) as T :
    callback(debugName, () => custom(from, to, progress));
  return validateSampledValue(sampled, debugName);
}

function easedProgress(
  ease: CRCEasing,
  progress: number,
  debugName: string | undefined,
): number {
  const eased = callback(debugName, () => ease(progress));
  if (!Number.isFinite(eased)) {
    throw new RangeError(`${definitionLabel(debugName)} easing result must be finite.`);
  }
  return eased;
}

function normalizeOffsets(
  values: readonly unknown[],
  offsets: readonly number[] | undefined,
  debugName: string | undefined,
): readonly number[] {
  if (offsets === undefined) {
    return Object.freeze(values.map((_, index) => index / (values.length - 1)));
  }
  if (offsets.length !== values.length) {
    throw new RangeError(`${definitionLabel(debugName)} keyframe offsets must match the values length.`);
  }
  const snapshot = [...offsets];
  for (const offset of snapshot) {
    if (!Number.isFinite(offset) || offset < 0 || offset > 1) {
      throw new RangeError(`${definitionLabel(debugName)} keyframe offsets must be finite values within [0, 1].`);
    }
  }
  if (snapshot[0] !== 0) {
    throw new RangeError(`${definitionLabel(debugName)} keyframe offsets must start at 0.`);
  }
  if (snapshot.at(-1) !== 1) {
    throw new RangeError(`${definitionLabel(debugName)} keyframe offsets must end at 1.`);
  }
  for (let index = 1; index < snapshot.length; index++) {
    if (snapshot[index] < snapshot[index - 1]) {
      throw new RangeError(`${definitionLabel(debugName)} keyframe offsets must be nondecreasing.`);
    }
  }
  return Object.freeze(snapshot);
}

function normalizeEasings(
  easingOption: CRCEasing | readonly CRCEasing[] | undefined,
  segmentCount: number,
  debugName: string | undefined,
): readonly CRCEasing[] {
  if (Array.isArray(easingOption)) {
    if (easingOption.length !== segmentCount) {
      throw new RangeError(`${definitionLabel(debugName)} keyframe easing list must have one entry per segment.`);
    }
    if (easingOption.some(ease => typeof ease !== 'function')) {
      throw new TypeError(`${definitionLabel(debugName)} keyframe easings must be functions.`);
    }
    return Object.freeze([...easingOption]);
  }
  const ease = easingOption ?? easing.linear;
  if (typeof ease !== 'function') {
    throw new TypeError(`${definitionLabel(debugName)} easing must be a function.`);
  }
  return Object.freeze(Array.from({ length: segmentCount }, () => ease));
}

/** Returns an opaque immutable tween definition. */
export function tween<T>(options: Readonly<CRCTweenOptions<T>>): CRCAnimationDefinition<T> {
  assertDuration(options.duration, options.debugName);
  if (typeof options.easing !== 'undefined' && typeof options.easing !== 'function') {
    throw new TypeError(`${definitionLabel(options.debugName)} easing must be a function.`);
  }
  if (typeof options.interpolate !== 'undefined' && typeof options.interpolate !== 'function') {
    throw new TypeError(`${definitionLabel(options.debugName)} interpolator must be a function.`);
  }
  const hasFrom = hasOwn(options, 'from');
  const snapshots = new WeakMap<object, unknown>();
  return createDefinition({
    kind: 'tween',
    duration: options.duration,
    debugName: options.debugName,
    hasFrom,
    from: hasFrom ? snapshotAnimationValue(options.from as T, snapshots) : undefined,
    to: snapshotAnimationValue(options.to, snapshots),
    easing: options.easing ?? easing.linear,
    interpolate: options.interpolate,
  });
}

/** Returns an opaque immutable keyframe definition. */
export function keyframes<T>(
  options: Readonly<CRCKeyframesOptions<T>>,
): CRCAnimationDefinition<T> {
  assertDuration(options.duration, options.debugName);
  if (options.values.length < 2) {
    throw new RangeError(`${definitionLabel(options.debugName)} keyframes require at least two values.`);
  }
  if (typeof options.interpolate !== 'undefined' && typeof options.interpolate !== 'function') {
    throw new TypeError(`${definitionLabel(options.debugName)} interpolator must be a function.`);
  }
  const snapshots = new WeakMap<object, unknown>();
  const values = Object.freeze(options.values.map(value => snapshotAnimationValue(value, snapshots)));
  return createDefinition({
    kind: 'keyframes',
    duration: options.duration,
    debugName: options.debugName,
    values,
    offsets: normalizeOffsets(values, options.offsets, options.debugName),
    easings: normalizeEasings(options.easing, values.length - 1, options.debugName),
    interpolate: options.interpolate,
  });
}

/** Returns an opaque immutable definition from a custom seekable sampler. */
export function defineAnimation<T>(
  options: Readonly<CRCAnimationOptions<T>>,
): CRCAnimationDefinition<T> {
  assertDuration(options.duration, options.debugName);
  if (typeof options.sample !== 'function') {
    throw new TypeError(`${definitionLabel(options.debugName)} sample must be a function.`);
  }
  return createDefinition({
    kind: 'custom',
    duration: options.duration,
    debugName: options.debugName,
    sample: options.sample,
  });
}

/**
 * Returns an opaque immutable stepper definition. Steppers are evaluated by
 * the playback engine, not by the seekable sampler.
 */
export function stepper<T>(
  options: Readonly<CRCStepperOptions<T>>,
): CRCAnimationDefinition<T> {
  if (typeof options.step !== 'function') {
    throw new TypeError(`${definitionLabel(options.debugName)} stepper step must be a function.`);
  }
  if (typeof options.done !== 'undefined' && typeof options.done !== 'function') {
    throw new TypeError(`${definitionLabel(options.debugName)} stepper done must be a function.`);
  }
  const fixedDelta = options.fixedDelta ?? 1000 / 60;
  if (!Number.isFinite(fixedDelta) || fixedDelta <= 0) {
    throw new RangeError(`${definitionLabel(options.debugName)} stepper fixedDelta must be finite and positive.`);
  }
  return createDefinition({
    kind: 'stepper',
    duration: Number.POSITIVE_INFINITY,
    debugName: options.debugName,
    initialState: snapshotAnimationValue(options.initialState, new WeakMap()),
    step: options.step,
    done: options.done,
    fixedDelta,
  });
}

/** @internal Returns the private immutable record associated with a definition. */
export function getDefinitionRecord<T>(
  definition: CRCAnimationDefinition<T>,
): DefinitionRecord<T> {
  const record = definitionRecords.get(definition as CRCAnimationDefinition<unknown>);
  if (record === undefined) throw new TypeError('Expected a CRC animation definition.');
  return record as DefinitionRecord<T>;
}

/** @internal Samples a non-stepper definition from its activation snapshot. */
export function sampleSeekableDefinition<T>(
  definition: CRCAnimationDefinition<T>,
  input: Readonly<Pick<CRCAnimationSampleInput<T>, 'initialValue' | 'localTime'>>,
): T {
  const record = getDefinitionRecord(definition);
  if (record.kind === 'stepper') {
    throw new TypeError(`${definitionLabel(record.debugName)} is stateful and cannot be sampled directly.`);
  }
  const timing = sampledProgress(record.duration, input.localTime);
  if (record.kind === 'custom') {
    const sampled = callback(record.debugName, () => record.sample(Object.freeze({
      initialValue: input.initialValue,
      localTime: timing.localTime,
      progress: timing.progress,
    })));
    return validateSampledValue(sampled, record.debugName);
  }
  if (record.kind === 'tween') {
    const from = record.hasFrom ? record.from as T : input.initialValue;
    return interpolate(
      from,
      record.to,
      easedProgress(record.easing, timing.progress, record.debugName),
      record.interpolate,
      record.debugName,
    );
  }

  let segment = 0;
  for (let index = 1; index < record.offsets.length; index++) {
    if (record.offsets[index] <= timing.progress) segment = index;
    else break;
  }
  if (segment === record.values.length - 1) {
    return validateSampledValue(record.values[segment], record.debugName);
  }
  const start = record.offsets[segment];
  const end = record.offsets[segment + 1];
  return interpolate(
    record.values[segment],
    record.values[segment + 1],
    easedProgress(record.easings[segment], (timing.progress - start) / (end - start), record.debugName),
    record.interpolate,
    record.debugName,
  );
}
