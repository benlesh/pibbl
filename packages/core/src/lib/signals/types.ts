import type { batch, computed, signal } from './graph.js';
import type { resolveSignalValue } from './resolve-signal-value.js';
import type { usePlayback } from '../hooks/use-playback.js';
/**
 * Compares previous and next values to decide whether a signal change should be published.
 *
 * @param previous - Previously stored value.
 * @param next - Proposed replacement value.
 * @returns True when the values are equivalent and a change should be suppressed.
 *
 * @see {@link SignalOptions}
 */
export type SignalEquals<T> = (previous: T, next: T) => boolean;

declare const signalBrand: unique symbol;

/**
 * Equality comparison and diagnostic naming options for a signal.
 *
 * @see {@link SignalEquals}
 * @see {@link computed}
 * @see {@link signal}
 */
export interface SignalOptions<T> {
  /** Compares old and new values to suppress equivalent updates; defaults to Object.is. See {@link SignalEquals}. */
  equals?: SignalEquals<T>;
  /** Optional label used in diagnostics. See {@link SignalOptions}. */
  debugName?: string;
}

/**
 * A readonly reactive value; get records a dependency when called by a tracked consumer.
 *
 * @see {@link SignalValue}
 * @see {@link WritableSignal}
 * @see {@link computed}
 */
export interface Signal<T> {
  readonly [signalBrand]: T;
  /**
   * Reads the current value and records a dependency in the active tracked consumer. See
   * {@link Signal}.
   * @returns The current value, recording a dependency when called from a tracked consumer.
   */
  get(): T;
}

/**
 * A literal value or a signal supplying that value to a receiver-owned input.
 *
 * @see {@link Signal}
 * @see {@link resolveSignalValue}
 * @see {@link usePlayback}
 */
export type SignalValue<T> = T | Signal<T>;

/**
 * A signal with synchronous replacement and update operations and a readonly view.
 *
 * @see {@link Signal}
 * @see {@link batch}
 * @see {@link signal}
 */
export interface WritableSignal<T> extends Signal<T> {
  /**
   * Synchronously replaces the value, publishing only when the equality comparison reports a
   * change. See {@link WritableSignal}.
   * @param value - Replacement value to compare with the currently stored value.
   */
  set(value: T): void;
  /**
   * Computes a replacement from the current value and applies the signal's equality policy. See
   * {@link WritableSignal}.
   * @param update - Synchronous function receiving the current value and returning its
   * replacement.
   */
  update(update: (current: T) => T): void;
  /**
   * Returns a readonly signal view of this same reactive value. See {@link Signal}.
   * @returns A readonly view of the same signal, without set or update operations. See
   * {@link Signal} .
   */
  asReadonly(): Signal<T>;
}
