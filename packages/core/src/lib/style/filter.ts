import type {
  RenderingContext2D,
  StyleResolutionContext,
  SystemStyle,
} from '../types.js';
import { layoutDiagnostic } from './diagnostics.js';
import type { CRCFilter } from './filter-types.js';

export interface ResolvedFilterList {
  readonly values: readonly CRCFilter[];
}

const filterListOrigins = new WeakMap<readonly CRCFilter[], boolean>();

const contextualColorIdentifiers = new Set([
  '-webkit-activelink',
  '-webkit-link',
  'accentcolor',
  'accentcolortext',
  'activeborder',
  'activecaption',
  'activetext',
  'appworkspace',
  'background',
  'buttonborder',
  'buttonface',
  'buttonhighlight',
  'buttonshadow',
  'buttontext',
  'canvas',
  'canvastext',
  'captiontext',
  'currentcolor',
  'field',
  'fieldtext',
  'graytext',
  'highlight',
  'highlighttext',
  'inactiveborder',
  'inactivecaption',
  'inactivecaptiontext',
  'infobackground',
  'infotext',
  'linktext',
  'mark',
  'marktext',
  'menu',
  'menutext',
  'scrollbar',
  'selecteditem',
  'selecteditemtext',
  'threeddarkshadow',
  'threedface',
  'threedhighlight',
  'threedlightshadow',
  'threedshadow',
  'visitedtext',
  'window',
  'windowframe',
  'windowtext',
]);

const contextualColorFunctions = new Set([
  'attr',
  'cycle',
  'env',
  'if',
  'inherit',
  'light-dark',
  'random',
  'random-item',
  'sibling-count',
  'sibling-index',
  'var',
]);

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
  const resolvedValues = Object.freeze(resolved);
  filterListOrigins.set(resolvedValues, Array.isArray(value));
  return Object.freeze({ values: resolvedValues });
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

export function assertNativeFilter(
  context: RenderingContext2D,
  cssText: string,
  component: string,
  resolved?: ResolvedFilterList,
  backingPixelsPerLogicalUnit = 1,
): void {
  const accessor = requireNativeFilterAccessor(context, component);
  resetNativeFilterAccessor(context, accessor, component);
  writeNativeFilter(context, accessor, cssText, component);
  if (readNativeFilter(context, accessor, component) !== 'none') return;

  if (resolved) {
    diagnoseRejectedDropShadowColors(
      context,
      accessor,
      resolved,
      backingPixelsPerLogicalUnit,
      component,
    );
  }

  throw layoutDiagnostic({
    component,
    property: 'filter',
    value: cssText,
    algorithm: 'filter-rendering',
    reason: 'the complete native Canvas filter chain is unsupported',
  });
}

export function resetNativeFilter(
  context: RenderingContext2D,
  component: string,
): void {
  const accessor = requireNativeFilterAccessor(context, component);
  resetNativeFilterAccessor(context, accessor, component);
}

export function resetNativeFilterIfSupported(
  context: RenderingContext2D,
): void {
  try {
    const accessor = requireNativeFilterAccessor(context, 'filter surface');
    accessor.set.call(context, 'none');
  } catch {
    // Pool reset/release must not mask the boundary's component-aware
    // capability diagnostic or an error already thrown by user rendering.
  }
}

function diagnoseRejectedDropShadowColors(
  context: RenderingContext2D,
  accessor: NativeFilterAccessor,
  resolved: ResolvedFilterList,
  backingPixelsPerLogicalUnit: number,
  component: string,
): void {
  for (let index = 0; index < resolved.values.length; index += 1) {
    const value = resolved.values[index]!;
    if (value.type !== 'dropShadow') continue;
    resetNativeFilterAccessor(context, accessor, component);
    const candidate = compileFilterList(
      { values: [value] },
      backingPixelsPerLogicalUnit,
    );
    writeNativeFilter(context, accessor, candidate, component);
    if (readNativeFilter(context, accessor, component) !== 'none') continue;
    const prefix = filterListOrigins.get(resolved.values) === false ?
        'filter' : `filter[${index}]`;
    throw layoutDiagnostic({
      component,
      property: `${prefix}.color`,
      value: value.color,
      algorithm: 'filter-rendering',
      reason: 'was rejected by the native Canvas filter color parser',
    });
  }
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
  const inspection = inspectColorTokens(value);
  if (!inspection.balanced) {
    throw invalidFilter(
      property,
      value,
      'must remain within one balanced CSS color token boundary',
      context,
    );
  }
  if (inspection.contextual) {
    throw invalidFilter(
      property,
      value,
      'must be concrete rather than a contextual CSS reference',
      context,
    );
  }
  return value;
}

function inspectColorTokens(
  value: string,
): { readonly balanced: boolean; readonly contextual: boolean } {
  const delimiters: string[] = [];
  let contextual = false;
  for (let index = 0; index < value.length;) {
    const character = value[index]!;
    if (character === '/' && value[index + 1] === '*') {
      index = skipCssComment(value, index + 2);
      continue;
    }
    if (character === '"' || character === "'") {
      index = skipCssString(value, index + 1, character);
      continue;
    }
    const closing = closingDelimiter(character);
    if (closing) {
      delimiters.push(closing);
      index += 1;
      continue;
    }
    if (isClosingDelimiter(character)) {
      if (delimiters.pop() !== character) {
        return { balanced: false, contextual };
      }
      index += 1;
      continue;
    }
    if (!isCssNameCharacter(character) && character !== '\\') {
      index += 1;
      continue;
    }

    let identifier = '';
    while (index < value.length) {
      const identifierCharacter = value[index]!;
      if (isCssNameCharacter(identifierCharacter)) {
        identifier += identifierCharacter;
        index += 1;
        continue;
      }
      if (identifierCharacter !== '\\') break;
      const escape = consumeCssEscape(value, index);
      identifier += escape.character;
      index = escape.nextIndex;
    }

    const normalized = identifier.toLowerCase();
    if (
      contextualColorIdentifiers.has(normalized) ||
      contextualColorFunctions.has(normalized)
    ) {
      contextual = true;
    }
  }
  return { balanced: delimiters.length === 0, contextual };
}

function closingDelimiter(character: string): string | undefined {
  switch (character) {
    case '(':
      return ')';
    case '[':
      return ']';
    case '{':
      return '}';
    default:
      return undefined;
  }
}

function isClosingDelimiter(character: string): boolean {
  return character === ')' || character === ']' || character === '}';
}

function isCssNameCharacter(character: string): boolean {
  const code = character.charCodeAt(0);
  return (
    code >= 0x80 ||
    (code >= 0x30 && code <= 0x39) ||
    (code >= 0x41 && code <= 0x5a) ||
    (code >= 0x61 && code <= 0x7a) ||
    character === '-' ||
    character === '_'
  );
}

function consumeCssEscape(
  value: string,
  backslashIndex: number,
): { character: string; nextIndex: number } {
  let index = backslashIndex + 1;
  let hexadecimal = '';
  while (index < value.length && hexadecimal.length < 6) {
    const character = value[index]!;
    if (!/[0-9a-f]/i.test(character)) break;
    hexadecimal += character;
    index += 1;
  }
  if (hexadecimal.length === 0) {
    if (index >= value.length) return { character: '\ufffd', nextIndex: index };
    return { character: value[index]!, nextIndex: index + 1 };
  }

  if (/\s/.test(value[index] ?? '')) {
    if (value[index] === '\r' && value[index + 1] === '\n') index += 1;
    index += 1;
  }
  const codePoint = Number.parseInt(hexadecimal, 16);
  const character = codePoint === 0 ||
      codePoint > 0x10ffff ||
      (codePoint >= 0xd800 && codePoint <= 0xdfff) ?
    '\ufffd' : String.fromCodePoint(codePoint);
  return { character, nextIndex: index };
}

function skipCssComment(value: string, start: number): number {
  const end = value.indexOf('*/', start);
  return end < 0 ? value.length : end + 2;
}

function skipCssString(
  value: string,
  start: number,
  quote: string,
): number {
  for (let index = start; index < value.length; index += 1) {
    const character = value[index]!;
    if (character === quote) return index + 1;
    if (character === '\\') index += 1;
  }
  return value.length;
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

function resetNativeFilterAccessor(
  context: RenderingContext2D,
  accessor: NativeFilterAccessor,
  component: string,
): void {
  writeNativeFilter(context, accessor, 'none', component);
  if (readNativeFilter(context, accessor, component) !== 'none') {
    throw nativeFilterDiagnostic(
      component,
      undefined,
      'the native Canvas filter state could not reset to none',
    );
  }
}

interface NativeFilterAccessor {
  readonly get: (this: RenderingContext2D) => unknown;
  readonly set: (this: RenderingContext2D, value: string) => void;
}

function requireNativeFilterAccessor(
  context: RenderingContext2D,
  component: string,
): NativeFilterAccessor {
  const ownDescriptor = Object.getOwnPropertyDescriptor(context, 'filter');
  if (ownDescriptor) {
    if (
      !ownDescriptor.configurable ||
      !Reflect.deleteProperty(context, 'filter')
    ) {
      throw nativeFilterDiagnostic(
        component,
        undefined,
        'a shadowing own filter property could not be removed',
      );
    }
  }

  let prototype = Object.getPrototypeOf(context);
  while (prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'filter');
    if (descriptor) {
      if (
        typeof descriptor.get === 'function' &&
        typeof descriptor.set === 'function'
      ) {
        return {
          get: descriptor.get as NativeFilterAccessor['get'],
          set: descriptor.set as NativeFilterAccessor['set'],
        };
      }
      break;
    }
    prototype = Object.getPrototypeOf(prototype);
  }

  throw nativeFilterDiagnostic(
    component,
    undefined,
    'requires native Canvas filter support with a getter and setter',
  );
}

function readNativeFilter(
  context: RenderingContext2D,
  accessor: NativeFilterAccessor,
  component: string,
): string {
  let value: unknown;
  try {
    value = accessor.get.call(context);
  } catch {
    throw nativeFilterDiagnostic(
      component,
      undefined,
      'the native Canvas filter getter threw',
    );
  }
  if (typeof value !== 'string') {
    throw nativeFilterDiagnostic(
      component,
      value,
      'the native Canvas filter getter returned a non-string value',
    );
  }
  return value;
}

function writeNativeFilter(
  context: RenderingContext2D,
  accessor: NativeFilterAccessor,
  value: string,
  component: string,
): void {
  try {
    accessor.set.call(context, value);
  } catch {
    throw nativeFilterDiagnostic(
      component,
      value,
      'the native Canvas filter setter threw',
    );
  }
}

function nativeFilterDiagnostic(
  component: string,
  value: unknown,
  reason: string,
) {
  return layoutDiagnostic({
    component,
    property: 'filter',
    value,
    algorithm: 'filter-rendering',
    reason,
  });
}

function assertNever(value: never): never {
  throw new Error(`Unsupported filter: ${String(value)}`);
}
