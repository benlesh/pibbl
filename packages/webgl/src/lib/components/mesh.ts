import { defineWebGLPrimitive } from '../define-webgl-primitive.js';
import {
  getWebGLGPUResources,
} from '../render-environment.js';
import {
  composeModelMatrix4,
  multiplyMatrix4,
} from '../math/matrix4.js';
import type {
  CRCWebGLContext,
  CRCWebGLGeometry,
  CRCWebGLTargetProps,
  CRCWebGLTransformStyle,
} from '../types.js';

export interface MeshProps extends CRCWebGLTargetProps {
  readonly geometry: CRCWebGLGeometry;
}

export interface MeshStyle extends CRCWebGLTransformStyle {
  readonly color?: string;
  readonly opacity?: number;
  readonly cursor?: string;
}

interface ParsedColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}

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
  'inherit',
  'initial',
  'linktext',
  'mark',
  'marktext',
  'menu',
  'menutext',
  'revert',
  'revert-layer',
  'scrollbar',
  'selecteditem',
  'selecteditemtext',
  'threeddarkshadow',
  'threedface',
  'threedhighlight',
  'threedlightshadow',
  'threedshadow',
  'unset',
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
  'light-dark',
  'random',
  'random-item',
  'sibling-count',
  'sibling-index',
  'var',
]);

let colorParser: CanvasRenderingContext2D | undefined;

function renderMesh(
  props: Readonly<MeshProps>,
  style: Readonly<MeshStyle>,
  context: CRCWebGLContext,
): void {
  drawBuiltInMesh('Mesh', props.geometry, style, context, 1);
}

/** Draws one built-in geometry through the shared unlit pipeline. */
export function drawBuiltInMesh(
  componentName: string,
  geometry: CRCWebGLGeometry,
  style: Readonly<MeshStyle>,
  context: CRCWebGLContext,
  uniformScale: number,
): void {
  const opacity = resolveOpacity(componentName, style.opacity);
  const color = parseConcreteColor(componentName, style.color ?? '#ffffff');
  const localModel = new Float32Array(16);
  composeModelMatrix4(localModel, scaledStyle(style, uniformScale));
  const model = new Float32Array(16);
  multiplyMatrix4(model, context.modelMatrix, localModel);

  const cache = getWebGLGPUResources(context);
  const program = context.resources.use(
    () => cache.acquireProgram(componentName),
    (lease, releaseContext) => lease.release(releaseContext.contextLost),
    [cache],
  ).value;
  const uploaded = context.resources.use(
    () => cache.acquireGeometry(geometry, componentName),
    (lease, releaseContext) => lease.release(releaseContext.contextLost),
    [cache, geometry],
  ).value;
  const { gl } = context;

  installBuiltInDrawState(gl, context);
  gl.useProgram(program.program);
  gl.bindVertexArray(uploaded.vertexArray);
  gl.bindBuffer(gl.ARRAY_BUFFER, uploaded.positionBuffer);
  gl.enableVertexAttribArray(program.positionAttribute);
  gl.vertexAttribPointer(
    program.positionAttribute,
    3,
    gl.FLOAT,
    false,
    0,
    0,
  );
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, uploaded.indexBuffer ?? null);
  gl.uniformMatrix4fv(program.model, false, model);
  gl.uniformMatrix4fv(
    program.view,
    false,
    context.camera.viewMatrix as Float32Array,
  );
  gl.uniformMatrix4fv(
    program.projection,
    false,
    context.camera.projectionMatrix as Float32Array,
  );
  gl.uniform4f(
    program.color,
    color.red,
    color.green,
    color.blue,
    color.alpha * opacity,
  );
  if (uploaded.indexCount !== undefined) {
    gl.drawElements(
      gl.TRIANGLES,
      uploaded.indexCount,
      gl.UNSIGNED_INT,
      0,
    );
  } else {
    gl.drawArrays(gl.TRIANGLES, 0, uploaded.vertexCount);
  }
}

/** Geometry capability stays present even when paint opacity resolves to zero. */
export const Mesh = defineWebGLPrimitive<MeshProps, MeshStyle>(renderMesh, {
  hit: {
    kind: 'geometry',
    geometry: props => props.geometry,
  },
});

function scaledStyle(
  style: Readonly<MeshStyle>,
  uniformScale: number,
): CRCWebGLTransformStyle {
  return {
    translateX: style.translateX,
    translateY: style.translateY,
    translateZ: style.translateZ,
    rotationXDegrees: style.rotationXDegrees,
    rotationYDegrees: style.rotationYDegrees,
    rotationZDegrees: style.rotationZDegrees,
    scaleX: (style.scaleX ?? 1) * uniformScale,
    scaleY: (style.scaleY ?? 1) * uniformScale,
    scaleZ: (style.scaleZ ?? 1) * uniformScale,
  };
}

function resolveOpacity(componentName: string, value: number | undefined) {
  const opacity = value ?? 1;
  if (!Number.isFinite(opacity)) {
    throw new TypeError(`${componentName} style.opacity must be finite.`);
  }
  if (opacity < 0 || opacity > 1) {
    throw new RangeError(
      `${componentName} style.opacity must be between 0 and 1.`,
    );
  }
  return opacity;
}

function parseConcreteColor(
  componentName: string,
  value: string,
): ParsedColor {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(
      `${componentName} style.color must be a concrete Canvas color.`,
    );
  }
  const inspection = inspectColorTokens(value);
  if (!inspection.balanced) {
    throw new TypeError(
      `${componentName} style.color must remain within one balanced ` +
      'CSS color token boundary.',
    );
  }
  if (inspection.contextual) {
    throw new TypeError(
      `${componentName} style.color must be concrete rather than a ` +
      'contextual CSS color reference.',
    );
  }
  const context = getColorParser(componentName);
  context.fillStyle = '#000000';
  context.fillStyle = value;
  const fromBlack = context.fillStyle;
  context.fillStyle = '#ffffff';
  context.fillStyle = value;
  const fromWhite = context.fillStyle;
  if (fromBlack !== fromWhite) {
    throw new TypeError(
      `${componentName} style.color must be a concrete Canvas color.`,
    );
  }

  context.clearRect(0, 0, 1, 1);
  context.fillStyle = fromBlack;
  context.fillRect(0, 0, 1, 1);
  const data = context.getImageData(0, 0, 1, 1).data;
  return {
    red: data[0]! / 255,
    green: data[1]! / 255,
    blue: data[2]! / 255,
    alpha: data[3]! / 255,
  };
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

function getColorParser(componentName: string): CanvasRenderingContext2D {
  if (colorParser) return colorParser;
  if (typeof document === 'undefined') {
    throw new Error(
      `${componentName} color parsing requires browser Canvas 2D support.`,
    );
  }
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error(
      `${componentName} color parsing requires browser Canvas 2D support.`,
    );
  }
  colorParser = context;
  return context;
}

function installBuiltInDrawState(
  gl: WebGL2RenderingContext,
  context: CRCWebGLContext,
): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(
    0,
    0,
    context.backingViewport.width,
    context.backingViewport.height,
  );
  gl.disable(gl.SCISSOR_TEST);
  gl.scissor(
    0,
    0,
    context.backingViewport.width,
    context.backingViewport.height,
  );
  gl.colorMask(true, true, true, true);
  gl.enable(gl.BLEND);
  gl.blendColor(0, 0, 0, 0);
  gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
  gl.blendFuncSeparate(
    gl.SRC_ALPHA,
    gl.ONE_MINUS_SRC_ALPHA,
    gl.ONE,
    gl.ONE_MINUS_SRC_ALPHA,
  );
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.depthFunc(gl.LEQUAL);
  gl.depthRange(0, 1);
  gl.disable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.frontFace(gl.CCW);
  gl.disable(gl.STENCIL_TEST);
  gl.disable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(0, 0);
}
