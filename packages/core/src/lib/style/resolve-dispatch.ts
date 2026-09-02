import { getLayoutBox, getPercentageBasis } from '../layout/context.js';
import { EMPTY_STYLE } from '../create-element.js';
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

const opaqueStyleProperties = new WeakMap<Function, ReadonlySet<string>>();
const preNormalizedStyles = new WeakMap<
  CRCElement<any>,
  { style: Readonly<SystemStyle>; source: CRCElement<any> }
>();

/** @internal Carries one normalized style through an internal placement descriptor. */
export function setPreNormalizedStyle(
  element: CRCElement<any>,
  style: Readonly<SystemStyle>,
  source: CRCElement<any> = element,
  receiverToken?: object,
): void {
  preNormalizedStyles.set(element, { style, source });
  if (receiverToken) setPrimitiveReceiverToken(element, receiverToken);
}

/** @internal Consumes an internal normalized-style override exactly once. */
export function takePreNormalizedStyle(
  element: CRCElement<any>,
): { style: Readonly<SystemStyle>; source: CRCElement<any> } | undefined {
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

export function resolveElementStyle<
  S extends SystemStyle,
  N extends SystemStyle,
  R extends SystemStyle,
>(element: CRCElement<any>): ResolvedStyle<R> {
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
  const preNormalized = takePreNormalizedStyle(element);
  const specified = (getSpecifiedStyle(element) ?? EMPTY_STYLE) as
    SpecifiedStyle<S>;
  const normalized = preNormalized ?
      preNormalized.style as Readonly<N> :
    definition.normalizeStyle ?
        definition.normalizeStyle(specified) :
        specified as unknown as Readonly<N>;
  const resolved = definition.resolveStyle ?
      definition.resolveStyle(normalized, context) :
      normalized as unknown as ResolvedStyle<R>;
  assertResolvedValue(
    resolved,
    '',
    context,
    new Set(),
    opaqueStyleProperties.get(type) ?? new Set(),
  );
  return resolved;
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
  if (property === 'custom') return;
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
