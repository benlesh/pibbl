import {
  isSignal,
  resolveSignalValue,
  type SignalValue,
} from "@crc/core";

export type SignalFields<T extends object> = {
  readonly [K in keyof T]: SignalValue<T[K]>;
};

export function resolveSignalFields<T extends object>(
  input: SignalValue<SignalFields<T>>,
): T {
  const source = resolveSignalValue(input);
  let resolved: Record<PropertyKey, unknown> | undefined;
  for (const key in source) {
    const value = source[key as keyof SignalFields<T>];
    if (!isSignal(value)) continue;
    resolved ??= { ...source } as Record<PropertyKey, unknown>;
    resolved[key] = resolveSignalValue(value as SignalValue<unknown>);
  }
  return (resolved ?? source) as T;
}

export function resolveDeclaredParticleProps<T extends object>(
  source: T,
  preserve: ReadonlySet<PropertyKey>,
  styleKey: keyof T | undefined,
): T {
  let resolved: Record<PropertyKey, unknown> | undefined;
  for (const key in source) {
    if (preserve.has(key)) continue;
    const value = source[key as keyof T];
    if (styleKey === key && value !== undefined) {
      const style = resolveSignalFields(
        value as SignalValue<SignalFields<object>>,
      );
      if (style !== value) {
        resolved ??= { ...source } as Record<PropertyKey, unknown>;
        resolved[key] = style;
      }
      continue;
    }
    if (!isSignal(value)) continue;
    resolved ??= { ...source } as Record<PropertyKey, unknown>;
    resolved[key] = resolveSignalValue(value as SignalValue<unknown>);
  }
  return (resolved ?? source) as T;
}
