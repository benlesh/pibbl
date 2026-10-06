import { useComputed, type Signal } from "@pibbl/core";
import {
  getCurrentBackendHostCanvas,
  setCurrentComponentAfterRender,
  useInternalHookSlot,
} from "@pibbl/core/internal";
import type { ScaleId } from "./types.js";
interface Scope {
  id: ScaleId;
  kind: string;
  value: Signal<unknown>;
  canvas: ReturnType<typeof getCurrentBackendHostCanvas>;
  parent: Scope | undefined;
}
let current: Scope | undefined;
export function provideColor<T>(
  id: ScaleId,
  kind: string,
  resolve: () => T,
  deps: readonly unknown[],
): void {
  if ((typeof id !== "string" || id.length === 0) && typeof id !== "symbol")
    throw new TypeError("Color scale id requires a nonempty string or symbol.");
  const value = useComputed(resolve, deps),
    parent = current;
  current = { id, kind, value, canvas: getCurrentBackendHostCanvas(), parent };
  const restore = () => {
    current = parent;
  };
  try {
    setCurrentComponentAfterRender(restore);
  } catch (error) {
    restore();
    throw error;
  }
}
export function useColor<T>(id: ScaleId, kind: string): Signal<T> {
  useInternalHookSlot("vizColorScaleLookup", () => undefined);
  for (let scope = current; scope; scope = scope.parent) {
    if (scope.id !== id) continue;
    if (scope.canvas !== getCurrentBackendHostCanvas())
      throw new Error("Color scale cannot cross a Layer boundary.");
    if (scope.kind !== kind)
      throw new TypeError(`Expected ${kind} color scale; found ${scope.kind}.`);
    return scope.value as Signal<T>;
  }
  throw new Error(
    `Unknown color scale ${String(id)}; add the matching ancestor provider.`,
  );
}
