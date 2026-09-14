export interface WebGLStateBaseline {
  readonly textureUnitCount: number;
}

/** Reads the one bounded capability needed to install the fixed state baseline. */
export function createWebGLStateBaseline(
  gl: WebGL2RenderingContext,
): WebGLStateBaseline {
  const textureUnitCount = gl.getParameter(
    gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS,
  ) as unknown;
  if (!Number.isInteger(textureUnitCount) || (textureUnitCount as number) < 1) {
    throw new Error(
      'WebGL2 MAX_COMBINED_TEXTURE_IMAGE_UNITS must be a positive integer.',
    );
  }
  return Object.freeze({ textureUnitCount: textureUnitCount as number });
}

/** Installs the complete WebGL state baseline owned by the initial CRC pass. */
export function installWebGLStateBaseline(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  baseline: WebGLStateBaseline,
): void {
  let hasError = false;
  let firstError: unknown;
  const attempt = (operation: () => void) => {
    try {
      operation();
    } catch (error) {
      if (!hasError) {
        hasError = true;
        firstError = error;
      } else {
        reportSecondaryStateError(error);
      }
    }
  };
  attempt(() => gl.bindFramebuffer(gl.FRAMEBUFFER, null));
  attempt(() => gl.viewport(0, 0, width, height));
  attempt(() => gl.disable(gl.SCISSOR_TEST));
  attempt(() => gl.scissor(0, 0, width, height));

  attempt(() => gl.useProgram(null));
  attempt(() => gl.bindVertexArray(null));
  attempt(() => gl.bindBuffer(gl.ARRAY_BUFFER, null));
  attempt(() => gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null));

  for (let unit = 0; unit < baseline.textureUnitCount; unit += 1) {
    attempt(() => gl.activeTexture(gl.TEXTURE0 + unit));
    attempt(() => gl.bindTexture(gl.TEXTURE_2D, null));
    attempt(() => gl.bindTexture(gl.TEXTURE_CUBE_MAP, null));
    attempt(() => gl.bindTexture(gl.TEXTURE_3D, null));
    attempt(() => gl.bindTexture(gl.TEXTURE_2D_ARRAY, null));
    attempt(() => gl.bindSampler(unit, null));
  }
  attempt(() => gl.activeTexture(gl.TEXTURE0));

  attempt(() => gl.colorMask(true, true, true, true));
  attempt(() => gl.depthMask(true));
  attempt(() => gl.stencilMaskSeparate(gl.FRONT, 0xffffffff));
  attempt(() => gl.stencilMaskSeparate(gl.BACK, 0xffffffff));

  attempt(() => gl.disable(gl.BLEND));
  attempt(() => gl.blendColor(0, 0, 0, 0));
  attempt(() => gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD));
  attempt(() => gl.blendFuncSeparate(gl.ONE, gl.ZERO, gl.ONE, gl.ZERO));

  attempt(() => gl.disable(gl.DEPTH_TEST));
  attempt(() => gl.depthFunc(gl.LESS));
  attempt(() => gl.depthRange(0, 1));

  attempt(() => gl.disable(gl.CULL_FACE));
  attempt(() => gl.cullFace(gl.BACK));
  attempt(() => gl.frontFace(gl.CCW));

  attempt(() => gl.disable(gl.STENCIL_TEST));
  attempt(() => gl.stencilFuncSeparate(gl.FRONT, gl.ALWAYS, 0, 0xffffffff));
  attempt(() => gl.stencilFuncSeparate(gl.BACK, gl.ALWAYS, 0, 0xffffffff));
  attempt(() => gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.KEEP));
  attempt(() => gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.KEEP));

  attempt(() => gl.disable(gl.POLYGON_OFFSET_FILL));
  attempt(() => gl.polygonOffset(0, 0));

  attempt(() => gl.clearColor(0, 0, 0, 0));
  attempt(() => gl.clearDepth(1));
  attempt(() => gl.clearStencil(0));

  attempt(() => gl.pixelStorei(gl.PACK_ALIGNMENT, 4));
  attempt(() => gl.pixelStorei(gl.PACK_ROW_LENGTH, 0));
  attempt(() => gl.pixelStorei(gl.PACK_SKIP_PIXELS, 0));
  attempt(() => gl.pixelStorei(gl.PACK_SKIP_ROWS, 0));
  attempt(() => gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4));
  attempt(() => gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0));
  attempt(() => gl.pixelStorei(gl.UNPACK_IMAGE_HEIGHT, 0));
  attempt(() => gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0));
  attempt(() => gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0));
  attempt(() => gl.pixelStorei(gl.UNPACK_SKIP_IMAGES, 0));
  attempt(() => gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0));
  attempt(() => gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0));
  attempt(() => gl.pixelStorei(
    gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,
    gl.BROWSER_DEFAULT_WEBGL,
  ));
  if (hasError) throw firstError;
}

function reportSecondaryStateError(error: unknown): void {
  try {
    globalThis.reportError(error);
  } catch {
    // Reporting cannot suppress later framework-state restoration attempts.
  }
}

/** Installs the fixed state dependencies for opaque settled-scene draws. */
export function installOpaqueWebGLPass(gl: WebGL2RenderingContext): void {
  gl.colorMask(true, true, true, true);
  gl.disable(gl.BLEND);
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.depthFunc(gl.LEQUAL);
  gl.depthRange(0, 1);
}

/** Installs standard source-alpha blending without transparent depth writes. */
export function installTransparentWebGLPass(gl: WebGL2RenderingContext): void {
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
  gl.depthMask(false);
  gl.depthFunc(gl.LEQUAL);
  gl.depthRange(0, 1);
}
