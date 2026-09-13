export type SignalEquals<T> = (previous: T, next: T) => boolean;

declare const signalBrand: unique symbol;

export interface SignalOptions<T> {
  equals?: SignalEquals<T>;
  debugName?: string;
}

export interface Signal<T> {
  readonly [signalBrand]: T;
  get(): T;
}

export interface WritableSignal<T> extends Signal<T> {
  set(value: T): void;
  update(update: (current: T) => T): void;
  asReadonly(): Signal<T>;
}
