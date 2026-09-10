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
  if (
    typeof value !== 'string' ||
    value.trim() === '' ||
    /^(currentcolor|inherit|initial|unset|revert(?:-layer)?)$/i.test(
      value.trim(),
    ) ||
    /var\s*\(/i.test(value)
  ) {
    throw new TypeError(
      `${componentName} style.color must be a concrete Canvas color.`,
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
