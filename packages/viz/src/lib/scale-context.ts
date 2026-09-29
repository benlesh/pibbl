import type { Canvas, Signal } from "@crc/core";
import {
  getCurrentBackendHostCanvas,
  setCurrentComponentAfterRender,
  useInternalHookSlot,
} from "@crc/core/internal";
import type { ResolvedScale, ScaleId } from "./types.js";
interface Scope {
  id: ScaleId;
  value: Signal<ResolvedScale>;
  canvas: Canvas;
  parent: Scope | undefined;
}
let current: Scope | undefined;
export function provideScale(id: ScaleId, value: Signal<ResolvedScale>): void {
  const parent = current;
  const scope: Scope = {
    id,
    value,
    canvas: getCurrentBackendHostCanvas(),
    parent,
  };
  current = scope;
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
export function lookupScale(
  id: ScaleId | undefined,
  receiver: string,
): Signal<ResolvedScale> | undefined {
  useInternalHookSlot("vizScaleLookup", () => undefined);
  return readScale(id, receiver);
}
/** Invocation-scoped lookup for official viz receivers; does not allocate a hook. */
export function readScale(
  id: ScaleId | undefined,
  receiver: string,
): Signal<ResolvedScale> | undefined {
  if (id === undefined) return undefined;
  const canvas = getCurrentBackendHostCanvas();
  for (let scope = current; scope; scope = scope.parent) {
    if (scope.id !== id) continue;
    if (scope.canvas !== canvas)
      throw new Error(
        `${receiver}: scale ${String(id)} crosses a Layer boundary; place Scale inside the Layer.`,
      );
    return scope.value;
  }
  throw new Error(
    `${receiver}: unknown scale ${String(id)}; add an ancestor Scale with this ID.`,
  );
}
