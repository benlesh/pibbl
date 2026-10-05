import { computed, type Signal } from "@pibbl/core";
import { lookupScale, scaleKind } from "./scale-context.js";
import type { ResolvedScale, ScaleId } from "./types.js";
/** A lazy shared view: one readonly signal per provider and supported hook. */
export function scaleView<T extends ResolvedScale>(
  cache: WeakMap<Signal<ResolvedScale>, Signal<T>>,
  id: ScaleId,
  receiver: string,
  accepts: (kind: ResolvedScale["type"] | undefined) => boolean,
): Signal<T> {
  const source = lookupScale(id, receiver);
  if (!source) throw new TypeError(`${receiver} requires a scale ID.`);
  // Return the provider transaction directly; an extra computed cache would hide
  // candidate formulas during layout/reflow until the render commits.
  if (accepts(scaleKind(source))) return source as Signal<T>;
  let view = cache.get(source);
  if (!view) {
    view = computed(() => {
      const value = source.get();
      if (!accepts(value.type)) throw new TypeError(`${receiver} cannot read a ${value.type} scale.`);
      return value as T;
    });
    cache.set(source, view);
  }
  return view;
}
