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
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, width, height);
  gl.disable(gl.SCISSOR_TEST);
  gl.scissor(0, 0, width, height);

  gl.useProgram(null);
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  try {
    for (let unit = 0; unit < baseline.textureUnitCount; unit += 1) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
      gl.bindTexture(gl.TEXTURE_3D, null);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
      gl.bindSampler(unit, null);
    }
  } finally {
    gl.activeTexture(gl.TEXTURE0);
  }

  gl.colorMask(true, true, true, true);
  gl.depthMask(true);
  gl.stencilMaskSeparate(gl.FRONT, 0xffffffff);
  gl.stencilMaskSeparate(gl.BACK, 0xffffffff);

  gl.disable(gl.BLEND);
  gl.blendColor(0, 0, 0, 0);
  gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
  gl.blendFuncSeparate(gl.ONE, gl.ZERO, gl.ONE, gl.ZERO);

  gl.disable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LESS);
  gl.depthRange(0, 1);

  gl.disable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.frontFace(gl.CCW);

  gl.disable(gl.STENCIL_TEST);
  gl.stencilFuncSeparate(gl.FRONT, gl.ALWAYS, 0, 0xffffffff);
  gl.stencilFuncSeparate(gl.BACK, gl.ALWAYS, 0, 0xffffffff);
  gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.KEEP);
  gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.KEEP);

  gl.disable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(0, 0);

  gl.clearColor(0, 0, 0, 0);
  gl.clearDepth(1);
  gl.clearStencil(0);

  gl.pixelStorei(gl.PACK_ALIGNMENT, 4);
  gl.pixelStorei(gl.PACK_ROW_LENGTH, 0);
  gl.pixelStorei(gl.PACK_SKIP_PIXELS, 0);
  gl.pixelStorei(gl.PACK_SKIP_ROWS, 0);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
  gl.pixelStorei(gl.UNPACK_IMAGE_HEIGHT, 0);
  gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
  gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
  gl.pixelStorei(gl.UNPACK_SKIP_IMAGES, 0);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
  gl.pixelStorei(
    gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,
    gl.BROWSER_DEFAULT_WEBGL,
  );
}

/** Starts one transparent color/depth frame from the same explicit baseline. */
export function beginWebGLFrame(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  baseline: WebGLStateBaseline,
): void {
  installWebGLStateBaseline(gl, width, height, baseline);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}
