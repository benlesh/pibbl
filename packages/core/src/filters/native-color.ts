import type { StyleResolutionContext } from "../lib/types.js";
import { layoutDiagnostic } from "../lib/style/diagnostics.js";

const contextualColorIdentifiers = /* @__PURE__ */ new Set([
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

const contextualColorFunctions = /* @__PURE__ */ new Set([
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

export function concreteColor(
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

