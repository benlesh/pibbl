import type { CRCInstance } from './types.js';

export interface OptionalService {
  dispose(): void;
  beginRender?(): void;
  endRender?(success: boolean): void;
}

/** @internal Lazily installs an optional feature service on one CRC instance. */
export function getOptionalService<T extends OptionalService>(instance: CRCInstance, key: symbol, create: () => T): T {
  const existing = instance.optionalServices.get(key) as T | undefined;
  if (existing) return existing;
  const service = create();
  instance.optionalServices.set(key, service);
  return service;
}
