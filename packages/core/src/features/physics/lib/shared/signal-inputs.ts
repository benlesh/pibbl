import {
  isSignal,
  resolveSignalValue,
  type SignalValue,
} from "@crc/core";

export type SignalFields<T extends object> = {
  readonly [K in keyof T]: SignalValue<T[K]>;
};

export function resolveSignalFields<T extends object>(
  source: SignalFields<T>,
  preserve: ReadonlySet<PropertyKey> = EMPTY_KEYS,
): T {
  let resolved: Record<PropertyKey, unknown> | undefined;
  for (const key in source) {
    if (preserve.has(key)) continue;
    const value = source[key as keyof SignalFields<T>];
    if (!isSignal(value)) continue;
    resolved ??= { ...source };
    resolved[key] = resolveSignalValue(value);
  }
  return (resolved ?? source) as T;
}

const EMPTY_KEYS = new Set<PropertyKey>();
