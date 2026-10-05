import type { Canvas, Signal } from "@pibbl/core";
import {
  getCurrentBackendHostCanvas,
  setCurrentComponentAfterRender,
  useInternalHookSlot,
} from "@pibbl/core/internal";
import type { ResolvedScale, ScaleId } from "./types.js";
interface Scope {
  id: ScaleId;
  value: Signal<ResolvedScale>;
  canvas: Canvas;
  parent: Scope | undefined;
}
let current: Scope | undefined;
const kinds = new WeakMap<Signal<ResolvedScale>, ResolvedScale["type"]>();
export function scaleKind(value: Signal<ResolvedScale>) { return kinds.get(value); }
export function provideScale(
  id: ScaleId,
  value: Signal<ResolvedScale>,
  kind: ResolvedScale["type"],
): void {
  kinds.set(value, kind);
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
  return findScale(current, getCurrentBackendHostCanvas(), id, receiver);
}
/** Captures visible ancestors so reactive formulas can resolve IDs outside traversal. */
export function captureScaleLookup(receiver: string) {
  useInternalHookSlot("vizScaleLookup", () => undefined);
  const parent = current;
  const canvas = getCurrentBackendHostCanvas();
  return (id: ScaleId | undefined) =>
    findScale(parent, canvas, id, receiver);
}
function findScale(
  parent: Scope | undefined,
  canvas: Canvas,
  id: ScaleId | undefined,
  receiver: string,
): Signal<ResolvedScale> | undefined {
  if (id === undefined) return undefined;
  for (let scope = parent; scope; scope = scope.parent) {
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
