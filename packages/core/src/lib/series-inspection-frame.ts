import { GLOBAL_STATE } from "./global-state.js";
import { requireHookContext } from "./hooks/hook-slot.js";
import { getCurrentWorldTransform } from "./render-target.js";
import { PibblPaintEntryKind } from "./events/paint-entry.js";
import type { PibblClippingStackEntry } from "./types.js";

/** Private geometry/ownership seam; no inspection algorithms enter core rendering.
 * @returns Captured receiver ownership and lazily composed root geometry.
 * @see {@link PibblClippingStackEntry}
 */
export function captureSeriesInspectionFrame() {
  const { componentRefs, pibblInstance } = requireHookContext();
  const localTransform = new DOMMatrix(
    Array.from(getCurrentWorldTransform().toFloat64Array()),
  );
  const localClips = GLOBAL_STATE.clippingStack.map((clip) => ({
    ...clip,
    path: new Path2D(clip.path),
    transform: new DOMMatrix(Array.from(clip.transform.toFloat64Array())),
  }));
  const transaction = GLOBAL_STATE.renderTransaction!;
  return {
    receiver: componentRefs,
    onDispose: (callback: () => void) => componentRefs.teardowns.add(callback),
    onFinish: (callback: (success: boolean) => void) =>
      transaction.onFinish(callback),
    alive: () =>
      !componentRefs.teardowns.closed && !pibblInstance.mainTeardowns.closed,
    generation: () =>
      pibblInstance.eventRoot.rootInstance?.committedRenderGeneration ?? 0,
    resolve() {
      let owner = pibblInstance;
      let transform = new DOMMatrix(
        Array.from(localTransform.toFloat64Array()),
      );
      let clips: PibblClippingStackEntry[] = localClips.slice();
      while (owner !== owner.eventRoot.rootInstance) {
        const parent =
          owner.parent && GLOBAL_STATE.pibblInstances.get(owner.parent);
        if (!parent) return undefined;
        const bridge = [...parent.paintEntries].find(
          (entry) =>
            entry.paintKind !== PibblPaintEntryKind.Path &&
            entry.instance === owner,
        );
        if (!bridge || bridge.paintKind === PibblPaintEntryKind.Path)
          return undefined;
        const outer = bridge.transform;
        clips = clips.map((clip) => ({
          ...clip,
          transform: outer.multiply(clip.transform),
        }));
        clips.push(
          ...bridge.clippingStack.map((clip) => ({
            ...clip,
            path: new Path2D(clip.path),
            transform: new DOMMatrix(
              Array.from(clip.transform.toFloat64Array()),
            ),
          })),
        );
        clips.push({
          path: new Path2D(bridge.bounds),
          transform: new DOMMatrix(Array.from(outer.toFloat64Array())),
          fillRule: "nonzero",
        });
        transform = outer.multiply(transform);
        owner = parent;
      }
      return {
        transform,
        clips,
        generation: owner.committedRenderGeneration ?? 0,
        canvas: owner.canvas as HTMLCanvasElement,
      };
    },
  };
}
