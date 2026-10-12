import type { PibblEvent } from "@pibbl/core";
import {
  borrowDispatchResource,
  withHooksForbidden,
} from "@pibbl/core/internal";

/** A mount-owned source of borrowed committed render records.
 * @see {@link InspectionContext}
 */
export interface InspectionRef<S> {
  /** Returns the current committed record.
   * @returns Borrowed record or undefined before paint/after disposal.
   */
  rendered(): S | undefined;
}

/** Lazy synchronous inspection; expires when its handler returns.
 * @see {@link InspectionRef}
 */
export interface InspectionContext {
  /** Pins one receiver's committed generation for this logical dispatch.
   * @param ref - Explicit ref identifying the mounted receiver.
   * @returns Borrowed generation or undefined before paint/after disposal.
   */
  rendered<S>(ref: InspectionRef<S>): S | undefined;
  /**
   * Executes only on demand and memoizes equal requests, including no result.
   * Options contain plain scalar fields, function identities and logical points.
   * @param query - Pure synchronous query with a stable result contract.
   * @param rendered - Committed generation pinned for this request.
   * @param options - Named query parameters; functions compare by identity.
   * @returns Query result, including undefined, reused for equal requests in dispatch.
   */
  request<S, A, R>(
    query: (rendered: S, options: A) => R,
    rendered: S,
    options: A,
  ): R;
}

const dispatchKey = {};
interface Memo {
  query: unknown;
  rendered: unknown;
  options: unknown;
  result: unknown;
}
interface DispatchInspection {
  live: boolean;
  renders: Map<object, unknown>;
  memo: Memo[];
}

function copyArguments(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== "object") return value;
  if (depth > 2 || Object.getPrototypeOf(value) !== Object.prototype)
    throw new TypeError(
      "Inspection arguments must contain plain scalar options and logical points.",
    );
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      copyArguments(item, depth + 1),
    ]),
  );
}
function sameArguments(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const aa = a as Record<string, unknown>,
    bb = b as Record<string, unknown>;
  const keys = Object.keys(aa);
  return (
    keys.length === Object.keys(bb).length &&
    keys.every(
      (key) => Object.hasOwn(bb, key) && sameArguments(aa[key], bb[key]),
    )
  );
}

/**
 * Adapts an ordinary handler to lazy typed inspection without changing its event.
 * @param handler - Synchronous callback receiving the unchanged event and an expiring context.
 * @returns An ordinary event handler. Searches occur only on request; memo state releases at dispatch end.
 * @see {@link InspectionContext}
 */
export function withInspection<E extends PibblEvent>(
  handler: (event: E, context: InspectionContext) => void,
): (event: E) => void {
  return (event) => {
    let live = true;
    const borrow = () => {
      if (!live)
        throw new Error(
          "Inspection context has expired; use it synchronously within dispatch.",
        );
      return borrowDispatchResource<DispatchInspection>(
        event,
        dispatchKey,
        () => {
          const value: DispatchInspection = {
            live: true,
            renders: new Map(),
            memo: [],
          };
          return {
            value,
            dispose: () => {
              value.live = false;
              value.renders.clear();
              value.memo.length = 0;
            },
          };
        },
      );
    };
    const context: InspectionContext = Object.freeze({
      rendered<S>(ref: InspectionRef<S>): S | undefined {
        const state = borrow();
        if (!state.renders.has(ref)) state.renders.set(ref, ref.rendered());
        return state.renders.get(ref) as S | undefined;
      },
      request<S, A, R>(
        query: (rendered: S, options: A) => R,
        rendered: S,
        options: A,
      ): R {
        const state = borrow();
        const args = copyArguments(options);
        const cached = state.memo.find(
          (memo) =>
            memo.query === query &&
            memo.rendered === rendered &&
            sameArguments(memo.options, args),
        );
        if (cached) return cached.result as R;
        const result = withHooksForbidden(
          "Inspection queries must be pure synchronous functions.",
          () => query(rendered, options),
        );
        if (result && typeof (result as { then?: unknown }).then === "function")
          throw new TypeError("Inspection queries must be synchronous.");
        state.memo.push({ query, rendered, options: args, result });
        return result;
      },
    });
    try {
      const result = handler(event, context) as unknown;
      if (result && typeof (result as { then?: unknown }).then === "function")
        throw new TypeError("Inspection handlers must be synchronous.");
    } finally {
      live = false;
    }
  };
}
