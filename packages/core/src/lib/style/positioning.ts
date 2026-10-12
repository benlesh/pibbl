import type { StyleResolutionContext, SystemStyle } from '../types.js';
import {
  getPlacementSignalHandoffStyle,
  setPlacementSignalHandoff,
} from '../element/metadata.js';
import type { PibblElement } from '../element/types.js';
import { isSignal } from '../signals/graph.js';
import { resolveLocalOffset } from './resolve-built-in.js';
import type { Length } from './types.js';

const PLACEMENT_HANDOFF = Symbol('pibbl.placement-handoff');

type PropsWithStyle = Record<PropertyKey, unknown> & {
  readonly style?: unknown;
};

type PlacementHandoff = Readonly<{
  source: Readonly<SystemStyle>;
}>;

let activeSignalHandoff: {
  readonly signal: object;
  readonly consumedStyle: Readonly<SystemStyle>;
} | undefined;

function hasPositioning(style: Readonly<Record<PropertyKey, unknown>>): boolean {
  if (Object.hasOwn(style, 'left') || Object.hasOwn(style, 'top')) return true;
  const when = style.when;
  return Array.isArray(when) && when.some((rule) => {
    if (!rule || typeof rule !== 'object') return false;
    const patch = (rule as { style?: unknown }).style;
    return !!patch && typeof patch === 'object' &&
      (Object.hasOwn(patch, 'left') || Object.hasOwn(patch, 'top'));
  });
}

/** @internal Marks a placed function component's object style for forwarding. */
export function withPlacementHandoff<P>(
  props: P,
  consumedStyle: Readonly<SystemStyle> | undefined,
): P {
  if (!props || typeof props !== 'object') return props;
  const candidate = props as PropsWithStyle;
  const style = candidate.style;
  if (
    !style ||
    typeof style !== 'object' ||
    isSignal(style) ||
    (style as Record<PropertyKey, unknown>)[PLACEMENT_HANDOFF] !== undefined ||
    !hasPositioning(style as Readonly<Record<PropertyKey, unknown>>)
  ) {
    return props;
  }
  return {
    ...candidate,
    style: Object.freeze({
      ...(style as Record<PropertyKey, unknown>),
      [PLACEMENT_HANDOFF]: Object.freeze({
        source: consumedStyle ?? style as Readonly<SystemStyle>,
      }),
    }),
  } as P;
}

/** @internal Activates signal identity capture while one plain component runs. */
export function enterPlacementHandoffCapture(
  props: unknown,
  consumedStyle: Readonly<SystemStyle> | undefined,
): () => void {
  const style = props && typeof props === 'object' ?
    (props as PropsWithStyle).style : undefined;
  const previous = activeSignalHandoff;
  activeSignalHandoff = style && isSignal(style) && consumedStyle !== undefined ? {
    signal: style,
    consumedStyle,
  } : undefined;
  return () => {
    activeSignalHandoff = previous;
  };
}

/** @internal Annotates an element created with the active forwarded style signal. */
export function capturePlacementHandoff(
  element: PibblElement<any>,
  style: unknown,
): void {
  if (style && style === activeSignalHandoff?.signal) {
    setPlacementSignalHandoff(element, activeSignalHandoff.consumedStyle);
  }
}

/** @internal Reads the original style behind an enumerable forwarding marker. */
export function getPlacementHandoffSource(
  style: unknown,
): Readonly<SystemStyle> | undefined {
  if (!style || typeof style !== 'object') return undefined;
  const marker = (style as Record<PropertyKey, unknown>)[PLACEMENT_HANDOFF];
  if (!marker || typeof marker !== 'object') return undefined;
  return (marker as PlacementHandoff).source;
}

/** @internal Removes a private handoff marker before style callbacks run. */
export function consumePlacementHandoff(
  style: Readonly<SystemStyle>,
): Readonly<SystemStyle> {
  if (getPlacementHandoffSource(style) === undefined) return style;
  const withoutHandoff = { ...(style as Record<PropertyKey, unknown>) };
  delete withoutHandoff[PLACEMENT_HANDOFF];
  return Object.freeze(withoutHandoff) as Readonly<SystemStyle>;
}

/** @internal Determines whether a primitive consumes one forwarded signal style. */
export function getPlacementSignalHandoff(
  element: PibblElement<any>,
): Readonly<SystemStyle> | undefined {
  return getPlacementSignalHandoffStyle(element);
}

/**
 * Offsets in the parent layout coordinate system; percentages resolve against the containing box.
 *
 * @see {@link Length}
 * @see {@link SystemStyle}
 */
export interface PositioningStyle extends SystemStyle {
  /** Left edge coordinate or inset. See {@link Length}. */
  left?: Exclude<Length, 'auto'>;
  /** Top edge value or top envelope guide. See {@link Length}. */
  top?: Exclude<Length, 'auto'>;
}

export interface ResolvedPosition {
  left: number;
  top: number;
}

export function resolveStandalonePosition(
  style: Readonly<PositioningStyle>,
  context: Readonly<StyleResolutionContext>,
): ResolvedPosition {
  return {
    left: resolveLocalOffset(style.left, context.percentageBasis.width, 'left', context),
    top: resolveLocalOffset(style.top, context.percentageBasis.height, 'top', context),
  };
}
