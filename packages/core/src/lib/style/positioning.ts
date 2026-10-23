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
const PLACEMENT_DERIVED_ABSOLUTE_AXES = Symbol('pibbl.placement-derived-absolute-axes');

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
  if (Object.hasOwn(style, 'position') || Object.hasOwn(style, 'left') || Object.hasOwn(style, 'right') || Object.hasOwn(style, 'top') || Object.hasOwn(style, 'bottom')) return true;
  const when = style.when;
  return Array.isArray(when) && when.some((rule) => {
    if (!rule || typeof rule !== 'object') return false;
    const patch = (rule as { style?: unknown }).style;
    return !!patch && typeof patch === 'object' &&
      (Object.hasOwn(patch, 'position') || Object.hasOwn(patch, 'left') || Object.hasOwn(patch, 'right') || Object.hasOwn(patch, 'top') || Object.hasOwn(patch, 'bottom'));
  });
}

/** @internal Marks only a fresh placement-owned style; authored style objects are never changed. */
export function markDerivedAbsoluteAxes(style: SystemStyle, width: boolean, height: boolean): void {
  (style as Record<PropertyKey, unknown>)[PLACEMENT_DERIVED_ABSOLUTE_AXES] = (width ? 1 : 0) | (height ? 2 : 0);
}

/** @internal Substitutes settled axes only across an exact forwarded placement handoff. */
export function resolveForwardedDerivedAbsoluteAxes(
  style: Readonly<SystemStyle>,
  source: Readonly<SystemStyle> | undefined,
): Readonly<SystemStyle> {
  if (source === undefined) return style;
  const axes = (source as Record<PropertyKey, unknown>)[PLACEMENT_DERIVED_ABSOLUTE_AXES] as number | undefined;
  if (!axes || !samePositioning(style, source)) return style;
  const raw = style as Readonly<Record<string, unknown>>;
  const settled = source as Readonly<Record<string, unknown>>;
  const width = (axes & 1) !== 0 && (raw.width === undefined || raw.width === 'auto') && typeof settled.width === 'number' ? settled.width : raw.width;
  const height = (axes & 2) !== 0 && (raw.height === undefined || raw.height === 'auto') && typeof settled.height === 'number' ? settled.height : raw.height;
  if (Object.is(width, raw.width) && Object.is(height, raw.height)) return style;
  return Object.freeze({ ...raw, width, height }) as Readonly<SystemStyle>;
}

function samePositioning(style: Readonly<SystemStyle>, source: Readonly<SystemStyle>): boolean {
  const left = style as Readonly<Record<string, unknown>>;
  const right = source as Readonly<Record<string, unknown>>;
  return Object.is(left.position, right.position) && Object.is(left.left, right.left) &&
    Object.is(left.right, right.right) && Object.is(left.top, right.top) &&
    Object.is(left.bottom, right.bottom);
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
  const record = style as Record<PropertyKey, unknown>;
  if (record[PLACEMENT_HANDOFF] === undefined && record[PLACEMENT_DERIVED_ABSOLUTE_AXES] === undefined) return style;
  const withoutHandoff = { ...record };
  delete withoutHandoff[PLACEMENT_HANDOFF];
  delete withoutHandoff[PLACEMENT_DERIVED_ABSOLUTE_AXES];
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
  /**
   * Experimental direct-Flex placement mode. In a finite row-nowrap Flex, static
   * keeps the allocated slot and ignores insets; relative offsets final geometry
   * once without moving siblings; absolute stays out of sibling allocation, using
   * the padding box for explicit insets and content alignment for omitted axes.
   * On the documented finite direct-child path, automatic absolute axes resolve
   * from opposing numeric physical insets. With a positive finite aspectRatio,
   * exactly one automatic axis can instead derive from its declared finite numeric opposite axis.
   * Opposing insets win. Finite numeric min/max bounds clamp used axes
   * independently after derivation; a clamp does not recouple aspectRatio, and a
   * numeric minimum above its maximum rejects. A direct custom primitive with
   * paired pure measurement providers may instead measure natural automatic
   * width at a declared numeric height, or natural height at a declared numeric
   * width. The automatic axis is unbounded; the exact axis uses its declared
   * value before numeric bounds clamp the used dimensions.
   * In direct declarative Flex chains,
   * static Flex passes the containing box outward while relative Flex owns a local box.
   * Omission retains the legacy local Flex boundary and left/top behavior.
   */
  position?: 'static' | 'relative' | 'absolute';
  /** Left edge coordinate or inset. Explicit Flex modes currently accept finite numeric insets only. See {@link Length}. */
  left?: Exclude<Length, 'auto'>;
  /** Right edge inset for an explicit direct-Flex placement mode; must be finite numeric. */
  right?: number;
  /** Top edge coordinate or inset. Explicit Flex modes currently accept finite numeric insets only. See {@link Length}. */
  top?: Exclude<Length, 'auto'>;
  /** Bottom edge inset for an explicit direct-Flex placement mode; must be finite numeric. */
  bottom?: number;
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
