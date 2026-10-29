import { GLOBAL_STATE } from "../global-state.js";
import { normalizePaddingInsets } from "./box-insets.js";
import type { BoxStyle } from "../style/types.js";
import type { LayoutBox } from "./types.js";

/** @internal A pushed allocation remains active through ordinary components. */
export function hasParentLayoutAllocation(): boolean {
  return (GLOBAL_STATE.layoutStack?.length ?? 0) > 1;
}

/** @internal Inherited inline direction; roots default to LTR. */
export function getLayoutDirection(): "ltr" | "rtl" {
  return GLOBAL_STATE.layoutStack?.at(-1)?.layoutDirection ?? "ltr";
}

export function getLayoutBox(): Readonly<LayoutBox> {
  const context = GLOBAL_STATE.layoutStack?.at(-1);
  if (!context) {
    throw new Error("No Pibbl layout context is available");
  }
  return context.allocation;
}

export function getPercentageBasis(): Readonly<LayoutBox> {
  const context = GLOBAL_STATE.layoutStack?.at(-1);
  if (!context) {
    throw new Error("No Pibbl layout context is available");
  }
  return context.percentageBasis;
}

interface LogicalLayoutContext {
  readonly x: number;
  readonly y: number;
  readonly containing: Readonly<LayoutBox>;
}
const logicalContexts = new WeakMap<object, LogicalLayoutContext>();
const ROOT_LOGICAL_ORIGIN = Object.freeze({ x: 0, y: 0 });

/** @internal Current accumulated layout origin, before Canvas presentation transforms. */
export function getLogicalLayoutOrigin(): Readonly<{ x: number; y: number }> {
  const context = GLOBAL_STATE.layoutStack?.at(-1);
  if (!context) throw new Error('No Pibbl layout context is available');
  return logicalContexts.get(context) ?? ROOT_LOGICAL_ORIGIN;
}

/** The nearest positioned layout box, expressed before presentation transforms. */
export function getLogicalContainingBox(): Readonly<LayoutBox> {
  const context = GLOBAL_STATE.layoutStack?.at(-1);
  if (!context)
    throw new Error("No Pibbl containing layout context is available");
  const logical = logicalContexts.get(context);
  if (!logical) return context.allocation;
  return {
    x: logical.containing.x - logical.x,
    y: logical.containing.y - logical.y,
    width: logical.containing.width,
    height: logical.containing.height,
  };
}

/**
 * Resolves the positioned containing block in the current layout coordinates.
 * A positioned layout boundary owns its padding box; a static boundary stays
 * transparent and inherits the nearest positioned ancestor.
 *
 * @internal
 */
export function resolvePositionedContainingBox(
  style: Readonly<BoxStyle & { readonly position?: string }>,
  content: Readonly<LayoutBox>,
  component: string,
): Readonly<LayoutBox> | undefined {
  if (style.position === "static") return undefined;
  const padding = normalizePaddingInsets(style, {
    component,
    algorithm: "containing block",
    constraints: {
      minWidth: 0,
      maxWidth: content.width,
      minHeight: 0,
      maxHeight: content.height,
    },
  });
  return Object.freeze({
    x: content.x - padding.left,
    y: content.y - padding.top,
    width: content.width + padding.left + padding.right,
    height: content.height + padding.top + padding.bottom,
  });
}

/**
 * Pushes one finite layout allocation and returns its exact restoration callback.
 *
 * @param box - Child allocation to expose during nested layout work.
 * @param options - Optional inherited direction and containing-block metadata.
 * @returns A callback that restores the prior layout context.
 *
 * @see {@link LayoutBox}
 */
export function pushLayoutBox(
  box: Readonly<LayoutBox>,
  options?: {
    readonly layoutDirection?: "ltr" | "rtl";
    readonly logicalOffset?: Readonly<{ x: number; y: number }>;
    readonly containingBlock?: Readonly<LayoutBox>;
  },
): () => void {
  const stack = GLOBAL_STATE.layoutStack;
  if (!stack) {
    throw new Error("No Pibbl layout context is available");
  }
  const parent = stack.at(-1);
  if (!parent) {
    throw new Error("No Pibbl parent layout context is available");
  }
  const context = {
    allocation: box,
    percentageBasis: parent.allocation,
    layoutDirection:
      options?.layoutDirection ?? parent.layoutDirection ?? "ltr",
  };
  const inherited = logicalContexts.get(parent);
  const x = (inherited?.x ?? 0) + (options?.logicalOffset?.x ?? 0);
  const y = (inherited?.y ?? 0) + (options?.logicalOffset?.y ?? 0);
  const declared = options?.containingBlock;
  logicalContexts.set(context, {
    x,
    y,
    containing: declared
      ? {
          x: x + declared.x,
          y: y + declared.y,
          width: declared.width,
          height: declared.height,
        }
      : (inherited?.containing ?? parent.allocation),
  });
  stack.push(context);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    if (stack.at(-1) !== context) {
      throw new Error("Pibbl layout context was restored out of order");
    }
    stack.pop();
  };
}
