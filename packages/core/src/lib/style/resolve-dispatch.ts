import { resolveTransitionBinding } from '../transitions/binding.js';
import { type PreparedQuery } from './responsive.js';
import { getLayoutBox, getPercentageBasis } from '../layout/context.js';
import { EMPTY_STYLE } from './empty-style.js';
import {
  getPrimitiveDefinition,
  getSpecifiedStyle,
  setPrimitiveReceiverToken,
  type PrimitiveDefinition,
} from '../element/metadata.js';
import type { CRCElement } from '../element/types.js';
import type {
  ResolvedStyle,
  SpecifiedStyle,
  StyleResolutionContext,
  SystemStyle,
} from '../types.js';
import { layoutDiagnostic } from './diagnostics.js';
import { resolveFilterList } from './filter.js';
import type { CRCFilter } from './filter-types.js';

const opaqueStyleProperties = new WeakMap<Function, ReadonlySet<string>>();
export interface PreparedStyleInput {
  style: Readonly<SystemStyle>;
  source: CRCElement<any>;
  query?: PreparedQuery;
}
const preNormalizedStyles = new WeakMap<CRCElement<any>, PreparedStyleInput>();

/** @internal Carries one normalized style through an internal placement descriptor. */
export function setPreNormalizedStyle(
  element: CRCElement<any>,
  style: Readonly<SystemStyle>,
  source: CRCElement<any> = element,
  receiverToken?: object,
  query?: PreparedQuery,
): void {
  preNormalizedStyles.set(element, { style, source, query });
  if (receiverToken) setPrimitiveReceiverToken(element, receiverToken);
}

/** @internal Consumes an internal normalized-style override exactly once. */
export function takePreNormalizedStyle(
  element: CRCElement<any>,
): PreparedStyleInput | undefined {
  const value = preNormalizedStyles.get(element);
  preNormalizedStyles.delete(element);
  return value;
}

/** @internal Registers strings that are data, paint, or enums, not allocation syntax. */
export function registerOpaqueStyleProperties(
  type: Function,
  properties: readonly string[],
): void {
  opaqueStyleProperties.set(type, new Set(properties));
}

/** @internal Reads the framework-owned filter property from a system style. */
export function extractSystemFilter(
  style: Readonly<SystemStyle>,
): CRCFilter | readonly CRCFilter[] | undefined {
  return style.filter;
}

/** @internal Removes the framework-owned filter before custom style callbacks run. */
export function withoutSystemFilter(
  style: Readonly<SystemStyle>,
): Readonly<SystemStyle> {
  if (!('when' in style)) {
    const { filter: _filter, transition: _transition, ...withoutFilter } = style;
    return Object.freeze(withoutFilter);
  }
  const { filter: _filter, transition: _transition, when: _when, ...withoutFilter } = style as Readonly<SystemStyle> & { when?: unknown };
  return Object.freeze(withoutFilter);
}

export function resolveElementStyle<
  S extends SystemStyle,
  N extends SystemStyle,
  R extends SystemStyle,
>(
  element: CRCElement<any>,
  resolvedSpecifiedStyle?: Readonly<SystemStyle>,
  hasResolvedSpecifiedStyle = false,
  prepared?: PreparedStyleInput,
): ResolvedStyle<R> {
  const allocation = getLayoutBox();
  const percentageBasis = getPercentageBasis();
  const type = element.type;
  const definition = getPrimitiveDefinition(type) as
    PrimitiveDefinition<any, S, N, R> | undefined;
  if (!definition) {
    throw new Error(
      `${type.name || 'Anonymous'} does not have CRC primitive metadata`,
    );
  }
  const component = type.name || 'Anonymous';
  const context: StyleResolutionContext = {
    allocation,
    percentageBasis,
    constraints: {
      minWidth: 0,
      maxWidth: allocation.width,
      minHeight: 0,
      maxHeight: allocation.height,
    },
    component,
    algorithm: 'render-dispatch',
  };
  // The renderer already consumed placement metadata before resolving inputs.
  const preNormalized = prepared;
  const specified = ((hasResolvedSpecifiedStyle ?
    resolvedSpecifiedStyle : getSpecifiedStyle(element)) ?? EMPTY_STYLE) as
    SpecifiedStyle<S>;
  const presentationStyle = preNormalized?.style ?? specified;
  const ordinaryFilter = extractSystemFilter(presentationStyle);
  const transitionFilters = presentationStyle.transition === undefined ? undefined : resolveTransitionBinding(presentationStyle.transition);
  const combined = transitionFilters?.length ? [
    ...(ordinaryFilter === undefined ? [] : Array.isArray(ordinaryFilter) ? ordinaryFilter : [ordinaryFilter]),
    ...transitionFilters,
  ] : ordinaryFilter;
  const systemFilter = resolveFilterList(
    combined,
    context,
  );
  const normalized = preNormalized ?
      withoutSystemFilter(preNormalized.style) as Readonly<N> :
    definition.normalizeStyle ?
        definition.normalizeStyle(withoutSystemFilter(specified) as SpecifiedStyle<S>) :
        withoutSystemFilter(specified) as unknown as Readonly<N>;
  const resolved = definition.resolveStyle ?
      definition.resolveStyle(normalized, context) :
      normalized as unknown as ResolvedStyle<R>;
  const final = systemFilter ? { ...resolved, filter: systemFilter.values } : resolved;
  assertResolvedValue(
    final,
    '',
    context,
    new Set(),
    opaqueStyleProperties.get(type) ?? new Set(),
  );
  return final;
}

function assertResolvedValue(
  value: unknown,
  property: string,
  context: Readonly<StyleResolutionContext>,
  seen: Set<object>,
  opaqueProperties: ReadonlySet<string>,
): void {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw unresolvedDiagnostic(property, value, context, 'must be finite');
    }
    return;
  }
  if (typeof value === 'string') {
    if (
      !opaqueProperties.has(property) &&
      (value === 'auto' || value.endsWith('%'))
    ) {
      throw unresolvedDiagnostic(
        property,
        value,
        context,
        'must resolve before the component callback is invoked',
      );
    }
    return;
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  if (property === 'custom' || property === 'filter') return;
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    return;
  }
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (key === 'custom') continue;
    assertResolvedValue(
      child,
      property ? `${property}.${key}` : key,
      context,
      seen,
      opaqueProperties,
    );
  }
}

function unresolvedDiagnostic(
  property: string,
  value: unknown,
  context: Readonly<StyleResolutionContext>,
  reason: string,
) {
  return layoutDiagnostic({
    component: context.component,
    property: property || 'style',
    value,
    algorithm: context.algorithm,
    constraints: context.constraints,
    reason,
  });
}
