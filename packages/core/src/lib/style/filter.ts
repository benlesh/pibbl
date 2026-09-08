import type { StyleResolutionContext, SystemStyle } from '../types.js';
import { layoutDiagnostic } from './diagnostics.js';
import type { CRCFilter } from './filter-types.js';

export interface ResolvedFilterList {
  readonly values: readonly CRCFilter[];
}

export function resolveFilterList(
  value: CRCFilter | readonly CRCFilter[] | undefined,
  context: Readonly<StyleResolutionContext>,
): ResolvedFilterList | undefined {
  if (value === undefined) return undefined;

  const values = Array.isArray(value) ? value : [value];
  if (values.length === 0) return undefined;

  const resolved = new Array<CRCFilter>(values.length);
  for (let index = 0; index < values.length; index += 1) {
    resolved[index] = normalizeFilter(
      values[index],
      propertyPrefix(Array.isArray(value), index),
      context,
    );
  }
  return Object.freeze({ values: Object.freeze(resolved) });
}

export function compileFilterList(
  resolved: ResolvedFilterList,
  backingPixelsPerLogicalUnit: number,
): string {
  const parts = new Array<string>(resolved.values.length);
  for (let index = 0; index < resolved.values.length; index += 1) {
    const value = resolved.values[index]!;
    switch (value.type) {
      case 'blur':
        parts[index] = `blur(${value.radius * backingPixelsPerLogicalUnit}px)`;
        break;
      case 'dropShadow':
        parts[index] =
          `drop-shadow(${value.offsetX * backingPixelsPerLogicalUnit}px ${value.offsetY * backingPixelsPerLogicalUnit}px ${(value.blurRadius ?? 0) * backingPixelsPerLogicalUnit}px ${value.color})`;
        break;
      case 'hueRotate':
        parts[index] = `hue-rotate(${value.degrees}deg)`;
        break;
      case 'brightness':
      case 'contrast':
      case 'grayscale':
      case 'invert':
      case 'opacity':
      case 'saturate':
      case 'sepia':
        parts[index] = `${cssFunctionName(value.type)}(${value.amount})`;
        break;
      default:
        assertNever(value);
    }
  }
  return parts.join(' ');
}

export function getResolvedFilterList(
  style: Readonly<SystemStyle>,
): ResolvedFilterList | undefined {
  const { filter } = style;
  if (!Array.isArray(filter) || filter.length === 0) return undefined;
  return { values: filter };
}

function normalizeFilter(
  value: unknown,
  property: string,
  context: Readonly<StyleResolutionContext>,
): CRCFilter {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidFilter(property, value, 'must be a filter descriptor', context);
  }

  const descriptor = value as Record<string, unknown>;
  switch (descriptor.type) {
    case 'blur':
      return Object.freeze({
        type: 'blur',
        radius: nonnegativeNumber(descriptor.radius, `${property}.radius`, context),
      });
    case 'brightness':
    case 'contrast':
    case 'saturate':
      return Object.freeze({
        type: descriptor.type,
        amount: nonnegativeNumber(descriptor.amount, `${property}.amount`, context),
      });
    case 'grayscale':
    case 'invert':
    case 'opacity':
    case 'sepia':
      return Object.freeze({
        type: descriptor.type,
        amount: Math.min(
          1,
          nonnegativeNumber(descriptor.amount, `${property}.amount`, context),
        ),
      });
    case 'dropShadow':
      return Object.freeze({
        type: 'dropShadow',
        offsetX: finiteNumber(descriptor.offsetX, `${property}.offsetX`, context),
        offsetY: finiteNumber(descriptor.offsetY, `${property}.offsetY`, context),
        blurRadius: nonnegativeNumber(
          descriptor.blurRadius === undefined ? 0 : descriptor.blurRadius,
          `${property}.blurRadius`,
          context,
        ),
        color: concreteColor(descriptor.color, `${property}.color`, context),
      });
    case 'hueRotate':
      return Object.freeze({
        type: 'hueRotate',
        degrees: finiteNumber(descriptor.degrees, `${property}.degrees`, context),
      });
    default:
      throw invalidFilter(`${property}.type`, descriptor.type, 'uses an unsupported filter type', context);
  }
}

function concreteColor(
  value: unknown,
  property: string,
  context: Readonly<StyleResolutionContext>,
): string {
  if (typeof value !== 'string') {
    throw invalidFilter(property, value, 'must be a CSS color string', context);
  }
  if (
    value.trim().toLowerCase() === 'currentcolor' ||
    /\bvar\s*\(/i.test(value)
  ) {
    throw invalidFilter(
      property,
      value,
      'must be concrete rather than a contextual CSS reference',
      context,
    );
  }
  return value;
}

function finiteNumber(
  value: unknown,
  property: string,
  context: Readonly<StyleResolutionContext>,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw invalidFilter(property, value, 'must be a finite number', context);
  }
  return value;
}

function nonnegativeNumber(
  value: unknown,
  property: string,
  context: Readonly<StyleResolutionContext>,
): number {
  const number = finiteNumber(value, property, context);
  if (number < 0) {
    throw invalidFilter(property, value, 'must be nonnegative', context);
  }
  return number;
}

function invalidFilter(
  property: string,
  value: unknown,
  reason: string,
  context: Readonly<StyleResolutionContext>,
) {
  return layoutDiagnostic({
    component: context.component,
    property,
    value,
    algorithm: context.algorithm,
    constraints: context.constraints,
    reason,
  });
}

function propertyPrefix(isList: boolean, index: number): string {
  return isList ? `filter[${index}]` : 'filter';
}

function cssFunctionName(
  type:
    | 'brightness'
    | 'contrast'
    | 'grayscale'
    | 'invert'
    | 'opacity'
    | 'saturate'
    | 'sepia',
): string {
  return type;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported filter: ${String(value)}`);
}
