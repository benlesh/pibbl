import { getLayoutBox, getPercentageBasis } from '../layout/context.js';
import type {
  CompEl,
  ResolvedStyle,
  StyleResolutionContext,
  SystemStyle,
} from '../types.js';
import { layoutDiagnostic } from './diagnostics.js';

const opaqueStyleProperties = new WeakMap<Function, ReadonlySet<string>>();
const preNormalizedStyles = new WeakMap<
  CompEl<any, any>,
  { style: Readonly<SystemStyle>; source: CompEl<any, any> }
>();

/** @internal Carries one normalized style through an internal placement descriptor. */
export function setPreNormalizedStyle(
  element: CompEl<any, any>,
  style: Readonly<SystemStyle>,
  source: CompEl<any, any> = element,
): void {
  preNormalizedStyles.set(element, { style, source });
}

/** @internal Consumes an internal normalized-style override exactly once. */
export function takePreNormalizedStyle(
  element: CompEl<any, any>,
): { style: Readonly<SystemStyle>; source: CompEl<any, any> } | undefined {
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
>(element: CompEl<any, S, N, R>): ResolvedStyle<R> {
  const allocation = getLayoutBox();
  const percentageBasis = getPercentageBasis();
  const type = element.type;
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
  const normalized = preNormalized ?
      preNormalized.style as Readonly<N> :
    type.normalizeStyle ?
        type.normalizeStyle(element.style) :
        element.style as unknown as Readonly<N>;
  const resolved = type.resolveStyle ?
      type.resolveStyle(normalized, context) :
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
