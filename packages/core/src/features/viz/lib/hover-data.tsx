import type { PibblNode } from "@pibbl/core";
import { withHooksForbidden } from "@pibbl/core/internal";
import type { HoverDataProps, HoverQueryContext } from "./hover-types.js";
import type { ResolvedLinearScale, ScaleId } from "./types.js";
import { readScale } from "./scale-context.js";
/**
 * Evaluates an ordinary synchronous query under the current scale scope.
 *
 * @param props - Hover query and child renderer receiving its result. See {@link HoverDataProps}.
 * @returns Content rendered from the current hover query result. See {@link PibblNode}.
 *
 * @see {@link HoverDataProps}
 * @see {@link PibblNode}
 */
export function HoverData<T>({ query, children }: HoverDataProps<T>): PibblNode {
  if (typeof query !== "function" || typeof children !== "function")
    throw new TypeError("HoverData requires query and children functions.");
  const snapshots = new Map<ScaleId, ResolvedLinearScale>();
  let active = true;
  const context: HoverQueryContext = {
    scale(id) {
      if (!active)
        throw new Error(
          "HoverData query context cannot be retained outside its invocation.",
        );
      let snapshot = snapshots.get(id);
      if (!snapshot) {
        const value = readScale(id, "HoverData");
        if (!value) throw new TypeError("HoverData requires a scale ID.");
        const resolved = value.get();
        if (resolved.type !== "linear")
          throw new TypeError(
            "HoverData numeric queries require linear scales.",
          );
        snapshot = resolved;
        snapshots.set(id, snapshot);
      }
      return snapshot;
    },
  };
  let result: T | undefined;
  try {
    result = withHooksForbidden(
      "Pibbl hooks cannot be called inside a HoverData query.",
      () => query(context),
    );
    if (
      result != null &&
      (typeof result === "object" || typeof result === "function") &&
      typeof (result as { then?: unknown }).then === "function"
    )
      throw new TypeError(
        "HoverData query must be synchronous; promises are unsupported.",
      );
  } finally {
    active = false;
  }
  return withHooksForbidden(
    "Pibbl hooks cannot be called inside a HoverData render callback; return a component instead.",
    () => children(result),
  );
}
