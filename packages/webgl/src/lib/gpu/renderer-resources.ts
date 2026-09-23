import { getWebGLGeometryData } from '../geometry/geometry.js';
import {
  acquireInternalWebGLTexture,
  getInternalWebGLTextureData,
  type InternalWebGLTextureData,
} from '../texture/texture.js';
import type {
  CRCWebGLGeometry,
  CRCWebGLTexture,
  CRCWebGLTextureSampler,
} from '../types.js';
import type {
  CRCWebGLInstancedRecipe,
  CRCWebGLLookupTableRecipe,
} from '../scene/types.js';
import {
  createBuiltInProgram,
  deleteBuiltInProgram,
  WEBGL_TANGENT_ATTRIBUTE,
  WEBGL_TEXTURE_COORDINATES_0_ATTRIBUTE,
  type WebGLBuiltInProgram,
  type WebGLProgramKey,
} from './program.js';

export interface WebGLGeometryResource {
  readonly vertexArray: WebGLVertexArrayObject;
  readonly positionBuffer: WebGLBuffer;
  readonly normalBuffer: WebGLBuffer | undefined;
  readonly textureCoordinates0Buffer: WebGLBuffer | undefined;
  readonly tangentBuffer: WebGLBuffer | undefined;
  readonly indexBuffer: WebGLBuffer | undefined;
  readonly vertexCount: number;
  readonly indexCount: number | undefined;
}

export interface WebGLInstancedResources {
  readonly program: WebGLProgram;
  readonly vertexArray: WebGLVertexArrayObject;
  readonly staticVertexBuffer: WebGLBuffer | undefined;
  readonly lookupTextures: readonly WebGLTexture[];
  readonly spriteTexture: WebGLTexture | undefined;
  readonly projectionView: WebGLUniformLocation;
  readonly model: WebGLUniformLocation;
  readonly cameraRight: WebGLUniformLocation | null;
  readonly cameraUp: WebGLUniformLocation | null;
  readonly effectiveOpacity: WebGLUniformLocation;
  readonly frameUniforms: WebGLUniformLocation | null;
  readonly lookupSamplers: readonly WebGLUniformLocation[];
  readonly spriteSampler: WebGLUniformLocation | null;
}

export interface WebGLTextureResource {
  readonly texture: WebGLTexture;
}

interface OwnedWebGLTextureResource extends WebGLTextureResource {
  readonly releaseDecodedTexture: () => void;
}

export interface WebGLRendererResourceTransaction {
  useProgram(
    key: WebGLProgramKey,
    componentName: string,
  ): WebGLBuiltInProgram;
  useGeometry(
    geometry: CRCWebGLGeometry,
    componentName: string,
  ): WebGLGeometryResource;
  useTexture(
    texture: CRCWebGLTexture,
    componentName: string,
  ): WebGLTextureResource;
  useInstanced(
    recipe: CRCWebGLInstancedRecipe,
    componentName: string,
  ): WebGLInstancedResources;
  commit(): void;
  rollback(contextLost?: boolean): void;
}

interface ResourceCandidate {
  active: boolean;
  readonly usedProgramKeys: Set<WebGLProgramKey>;
  readonly usedGeometries: Set<CRCWebGLGeometry>;
  readonly usedTextures: Set<CRCWebGLTexture>;
  readonly usedInstancedKeys: Set<object>;
  readonly createdPrograms: Map<WebGLProgramKey, WebGLBuiltInProgram>;
  readonly createdGeometries: Map<CRCWebGLGeometry, WebGLGeometryResource>;
  readonly createdTextures: Map<CRCWebGLTexture, OwnedWebGLTextureResource>;
  readonly createdInstanced: Map<object, WebGLInstancedResources>;
}

/** Owns the resident GPU resources for one renderer context generation. */
export class WebGLRendererResourceCache {
  private readonly geometries = new Map<
    CRCWebGLGeometry,
    WebGLGeometryResource
  >();
  private readonly programs = new Map<WebGLProgramKey, WebGLBuiltInProgram>();
  private readonly residentProgramKeys = new Set<WebGLProgramKey>();
  private readonly residentGeometries = new Set<CRCWebGLGeometry>();
  private readonly textures = new Map<
    CRCWebGLTexture,
    OwnedWebGLTextureResource
  >();
  private readonly residentTextures = new Set<CRCWebGLTexture>();
  private readonly instanced = new Map<object, WebGLInstancedResources>();
  private readonly residentInstancedKeys = new Set<object>();
  private activeCandidate: ResourceCandidate | undefined;
  private invalidated = false;
  private disposed = false;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    readonly contextGeneration: number,
  ) {}

  beginRender(): WebGLRendererResourceTransaction {
    this.requireUsable();
    if (this.activeCandidate) {
      throw new Error(
        `WebGL renderer resource cache generation ${this.contextGeneration} ` +
          'already has an active render transaction.',
      );
    }
    const candidate: ResourceCandidate = {
      active: true,
      usedProgramKeys: new Set(),
      usedGeometries: new Set(),
      usedTextures: new Set(),
      usedInstancedKeys: new Set(),
      createdPrograms: new Map(),
      createdGeometries: new Map(),
      createdTextures: new Map(),
      createdInstanced: new Map(),
    };
    this.activeCandidate = candidate;
    return Object.freeze({
      useProgram: (
        key: WebGLProgramKey,
        componentName: string,
      ): WebGLBuiltInProgram => this.useProgram(candidate, key, componentName),
      useGeometry: (
        geometry: CRCWebGLGeometry,
        componentName: string,
      ): WebGLGeometryResource =>
        this.useGeometry(candidate, geometry, componentName),
      useTexture: (
        texture: CRCWebGLTexture,
        componentName: string,
      ): WebGLTextureResource =>
        this.useTexture(candidate, texture, componentName),
      useInstanced: (
        recipe: CRCWebGLInstancedRecipe,
        componentName: string,
      ): WebGLInstancedResources =>
        this.useInstanced(candidate, recipe, componentName),
      commit: (): void => this.commit(candidate),
      rollback: (contextLost = false): void =>
        this.rollback(candidate, contextLost),
    });
  }

  invalidateContext(): void {
    if (this.disposed || this.invalidated) return;
    this.invalidated = true;
    this.closeActiveCandidate();
    const textures = Array.from(this.textures.values());
    this.programs.clear();
    this.residentProgramKeys.clear();
    this.geometries.clear();
    this.residentGeometries.clear();
    this.textures.clear();
    this.residentTextures.clear();
    this.instanced.clear();
    this.residentInstancedKeys.clear();
    for (const texture of textures) {
      releaseDecodedTextureResource(this.gl, texture, false);
    }
  }

  dispose(contextLost: boolean): void {
    if (this.disposed) return;
    this.disposed = true;
    this.closeActiveCandidate();
    const programs = Array.from(this.programs.values());
    const geometries = Array.from(this.geometries.values());
    const textures = Array.from(this.textures.values());
    const instanced = Array.from(this.instanced.values());
    this.programs.clear();
    this.residentProgramKeys.clear();
    this.geometries.clear();
    this.residentGeometries.clear();
    this.textures.clear();
    this.residentTextures.clear();
    this.instanced.clear();
    this.residentInstancedKeys.clear();
    if (contextLost || this.invalidated) {
      for (const texture of textures) {
        releaseDecodedTextureResource(this.gl, texture, false);
      }
      return;
    }
    for (const program of programs) {
      runResourceCleanup(() => deleteBuiltInProgram(this.gl, program));
    }
    for (const geometry of geometries) {
      deleteGeometry(this.gl, geometry);
    }
    for (const texture of textures) {
      releaseDecodedTextureResource(this.gl, texture, true);
    }
    for (const resource of instanced) {
      deleteInstancedResources(this.gl, resource);
    }
  }

  private useProgram(
    candidate: ResourceCandidate,
    key: WebGLProgramKey,
    componentName: string,
  ): WebGLBuiltInProgram {
    this.requireCandidate(candidate);
    candidate.usedProgramKeys.add(key);
    const existing = this.programs.get(key);
    if (existing) return existing;
    const program = createBuiltInProgram(this.gl, key, componentName);
    this.programs.set(key, program);
    candidate.createdPrograms.set(key, program);
    return program;
  }

  private useGeometry(
    candidate: ResourceCandidate,
    geometry: CRCWebGLGeometry,
    componentName: string,
  ): WebGLGeometryResource {
    this.requireCandidate(candidate);
    candidate.usedGeometries.add(geometry);
    const existing = this.geometries.get(geometry);
    if (existing) return existing;
    const created = uploadGeometry(this.gl, geometry, componentName);
    this.geometries.set(geometry, created);
    candidate.createdGeometries.set(geometry, created);
    return created;
  }

  private useTexture(
    candidate: ResourceCandidate,
    texture: CRCWebGLTexture,
    componentName: string,
  ): WebGLTextureResource {
    this.requireCandidate(candidate);
    getInternalWebGLTextureData(texture);
    candidate.usedTextures.add(texture);
    const existing = this.textures.get(texture);
    if (existing) return existing;
    const created = uploadDecodedTexture(this.gl, texture, componentName);
    this.textures.set(texture, created);
    candidate.createdTextures.set(texture, created);
    return created;
  }

  private useInstanced(
    candidate: ResourceCandidate,
    recipe: CRCWebGLInstancedRecipe,
    componentName: string,
  ): WebGLInstancedResources {
    this.requireCandidate(candidate);
    candidate.usedInstancedKeys.add(recipe.key);
    const existing = this.instanced.get(recipe.key);
    if (existing) return existing;
    const created = createInstancedResources(this.gl, recipe, componentName);
    this.instanced.set(recipe.key, created);
    candidate.createdInstanced.set(recipe.key, created);
    return created;
  }

  private commit(candidate: ResourceCandidate): void {
    if (!candidate.active) return;
    this.requireCandidate(candidate);
    try {
      for (const key of this.residentProgramKeys) {
        if (candidate.usedProgramKeys.has(key)) continue;
        const omitted = this.programs.get(key);
        this.programs.delete(key);
        if (omitted) {
          runResourceCleanup(() => deleteBuiltInProgram(this.gl, omitted));
        }
      }
      for (const geometry of this.residentGeometries) {
        if (candidate.usedGeometries.has(geometry)) continue;
        const omitted = this.geometries.get(geometry);
        this.geometries.delete(geometry);
        if (omitted) deleteGeometry(this.gl, omitted);
      }
      for (const texture of this.residentTextures) {
        if (candidate.usedTextures.has(texture)) continue;
        const omitted = this.textures.get(texture);
        this.textures.delete(texture);
        if (omitted) {
          releaseDecodedTextureResource(this.gl, omitted, true);
        }
      }
      for (const key of this.residentInstancedKeys) {
        if (candidate.usedInstancedKeys.has(key)) continue;
        const omitted = this.instanced.get(key);
        this.instanced.delete(key);
        if (omitted) deleteInstancedResources(this.gl, omitted);
      }
      this.residentProgramKeys.clear();
      for (const key of candidate.usedProgramKeys) {
        if (this.programs.has(key)) this.residentProgramKeys.add(key);
      }
      this.residentGeometries.clear();
      for (const geometry of candidate.usedGeometries) {
        if (this.geometries.has(geometry)) {
          this.residentGeometries.add(geometry);
        }
      }
      this.residentTextures.clear();
      for (const texture of candidate.usedTextures) {
        if (this.textures.has(texture)) this.residentTextures.add(texture);
      }
      this.residentInstancedKeys.clear();
      for (const key of candidate.usedInstancedKeys) {
        if (this.instanced.has(key)) this.residentInstancedKeys.add(key);
      }
    } finally {
      this.closeCandidate(candidate);
    }
  }

  private rollback(candidate: ResourceCandidate, contextLost: boolean): void {
    if (!candidate.active) return;
    this.requireCandidate(candidate);
    if (contextLost) {
      this.invalidateContext();
      return;
    }
    try {
      for (const [key, created] of candidate.createdPrograms) {
        if (this.programs.get(key) === created) {
          this.programs.delete(key);
        }
        runResourceCleanup(() => deleteBuiltInProgram(this.gl, created));
      }
      for (const [geometry, created] of candidate.createdGeometries) {
        if (this.geometries.get(geometry) === created) {
          this.geometries.delete(geometry);
        }
        deleteGeometry(this.gl, created);
      }
      for (const [texture, created] of candidate.createdTextures) {
        if (this.textures.get(texture) === created) {
          this.textures.delete(texture);
        }
        releaseDecodedTextureResource(this.gl, created, true);
      }
      for (const [key, created] of candidate.createdInstanced) {
        if (this.instanced.get(key) === created) this.instanced.delete(key);
        deleteInstancedResources(this.gl, created);
      }
    } finally {
      this.closeCandidate(candidate);
    }
  }

  private requireCandidate(candidate: ResourceCandidate): void {
    if (!candidate.active || this.activeCandidate !== candidate) {
      throw new Error('WebGL renderer resource transaction is closed.');
    }
    this.requireUsable();
  }

  private requireUsable(): void {
    if (this.disposed) {
      throw new Error(
        `WebGL renderer resource cache generation ${this.contextGeneration} ` +
          'is disposed.',
      );
    }
    if (this.invalidated) {
      throw new Error(
        `WebGL renderer resource cache generation ${this.contextGeneration} ` +
          'is invalid.',
      );
    }
  }

  private closeActiveCandidate(): void {
    if (this.activeCandidate) this.closeCandidate(this.activeCandidate);
  }

  private closeCandidate(candidate: ResourceCandidate): void {
    candidate.active = false;
    candidate.usedProgramKeys.clear();
    candidate.usedGeometries.clear();
    candidate.usedTextures.clear();
    candidate.usedInstancedKeys.clear();
    candidate.createdPrograms.clear();
    candidate.createdGeometries.clear();
    candidate.createdTextures.clear();
    candidate.createdInstanced.clear();
    if (this.activeCandidate === candidate) this.activeCandidate = undefined;
  }
}

const decodedTexturePixelStoreParameters = [
  'UNPACK_FLIP_Y_WEBGL',
  'UNPACK_PREMULTIPLY_ALPHA_WEBGL',
  'UNPACK_COLORSPACE_CONVERSION_WEBGL',
  'UNPACK_ALIGNMENT',
  'UNPACK_ROW_LENGTH',
  'UNPACK_IMAGE_HEIGHT',
  'UNPACK_SKIP_PIXELS',
  'UNPACK_SKIP_ROWS',
  'UNPACK_SKIP_IMAGES',
] as const;

function uploadDecodedTexture(
  gl: WebGL2RenderingContext,
  identity: CRCWebGLTexture,
  componentName: string,
): OwnedWebGLTextureResource {
  let texture: WebGLTexture | undefined;
  let releaseDecodedTexture: (() => void) | undefined;
  let published = false;
  let abandonFailedHandle = false;
  try {
    releaseDecodedTexture = acquireInternalWebGLTexture(identity);
    const data = getInternalWebGLTextureData(identity);
    if (data.width < 1 || data.height < 1) {
      throw new RangeError(
        `${componentName} texture dimensions must be positive; received ` +
        `${data.width}x${data.height}.`,
      );
    }
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    if (data.width > maxTextureSize || data.height > maxTextureSize) {
      throw new RangeError(
        `${componentName} texture dimensions ${data.width}x${data.height} ` +
        `exceed MAX_TEXTURE_SIZE ${maxTextureSize}.`,
      );
    }
    const previousPixelStore = decodedTexturePixelStoreParameters.map(name =>
      [gl[name], gl.getParameter(gl[name])] as const,
    );
    texture = gl.createTexture() ?? undefined;
    if (!texture) {
      throw new Error(`${componentName} texture creation failed.`);
    }
    let uploadError: unknown;
    try {
      discardPendingGLErrors(gl);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_S,
        textureWrap(gl, data.sampler.wrapS),
      );
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_T,
        textureWrap(gl, data.sampler.wrapT),
      );
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        textureMinFilter(gl, data.sampler.minFilter),
      );
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MAG_FILTER,
        textureMagFilter(gl, data.sampler.magFilter),
      );
      installDecodedTexturePixelStore(gl);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        data.bitmap,
      );
      throwOnGLError(gl, `${componentName} texture upload`);
      if (requiresMipmaps(data)) {
        gl.generateMipmap(gl.TEXTURE_2D);
        throwOnGLError(gl, `${componentName} texture mipmap generation`);
      }
    } catch (error) {
      uploadError = error;
    }
    const restoreErrors: unknown[] = [];
    for (const [parameter, value] of previousPixelStore) {
      try {
        gl.pixelStorei(parameter, value);
      } catch (error) {
        restoreErrors.push(error);
      }
    }
    if (uploadError !== undefined) {
      for (const error of restoreErrors) reportSecondaryResourceError(error);
      throw uploadError;
    }
    if (restoreErrors.length > 0) {
      for (const error of restoreErrors.slice(1)) {
        reportSecondaryResourceError(error);
      }
      throw restoreErrors[0];
    }
    const contextValidity = readResourceContextValidity(gl);
    if (contextValidity.status === 'lost') {
      abandonFailedHandle = true;
      throw new Error(
        `${componentName} texture upload failed because the WebGL context was lost.`,
      );
    }
    if (contextValidity.status === 'unknown') {
      abandonFailedHandle = true;
      throw new Error(
        `${componentName} texture upload context validation failed.`,
        { cause: contextValidity.error },
      );
    }
    const resource = Object.freeze({ texture, releaseDecodedTexture });
    published = true;
    return resource;
  } catch (error) {
    if (!abandonFailedHandle) {
      abandonFailedHandle = contextLossPreventsResourceCleanup(gl);
    }
    if (error instanceof Error && error.message.startsWith(componentName)) {
      throw error;
    }
    throw new Error(`${componentName} texture upload failed.`, { cause: error });
  } finally {
    if (!published && texture && !abandonFailedHandle) {
      runResourceCleanup(() => gl.deleteTexture(texture!));
    }
    if (!published && releaseDecodedTexture) {
      runResourceCleanup(releaseDecodedTexture);
    }
  }
}

function releaseDecodedTextureResource(
  gl: WebGL2RenderingContext,
  resource: OwnedWebGLTextureResource,
  deleteGPUTexture: boolean,
): void {
  if (deleteGPUTexture) {
    runResourceCleanup(() => gl.deleteTexture(resource.texture));
  }
  runResourceCleanup(resource.releaseDecodedTexture);
}

function discardPendingGLErrors(gl: WebGL2RenderingContext): void {
  while (gl.getError() !== gl.NO_ERROR) {
    // WebGL has no error-state restore. Draining here isolates owned calls.
  }
}

function throwOnGLError(
  gl: WebGL2RenderingContext,
  operation: string,
): void {
  const error = gl.getError();
  if (error === gl.NO_ERROR) return;
  while (gl.getError() !== gl.NO_ERROR) {
    // Drain the remaining owned errors so they cannot leak into later work.
  }
  throw new Error(`${operation} reported ${webGLErrorName(gl, error)}.`);
}

function webGLErrorName(gl: WebGL2RenderingContext, error: number): string {
  switch (error) {
    case gl.INVALID_ENUM: return 'INVALID_ENUM';
    case gl.INVALID_VALUE: return 'INVALID_VALUE';
    case gl.INVALID_OPERATION: return 'INVALID_OPERATION';
    case gl.INVALID_FRAMEBUFFER_OPERATION:
      return 'INVALID_FRAMEBUFFER_OPERATION';
    case gl.OUT_OF_MEMORY: return 'OUT_OF_MEMORY';
    case gl.CONTEXT_LOST_WEBGL: return 'CONTEXT_LOST_WEBGL';
    default: return `WebGL error 0x${error.toString(16)}`;
  }
}

function installDecodedTexturePixelStore(gl: WebGL2RenderingContext): void {
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
  gl.pixelStorei(gl.UNPACK_IMAGE_HEIGHT, 0);
  gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
  gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
  gl.pixelStorei(gl.UNPACK_SKIP_IMAGES, 0);
}

function textureWrap(
  gl: WebGL2RenderingContext,
  value: CRCWebGLTextureSampler['wrapS'],
): number {
  switch (value) {
    case 'repeat': return gl.REPEAT;
    case 'clamp-to-edge': return gl.CLAMP_TO_EDGE;
    case 'mirrored-repeat': return gl.MIRRORED_REPEAT;
  }
}

function textureMinFilter(
  gl: WebGL2RenderingContext,
  value: CRCWebGLTextureSampler['minFilter'],
): number {
  switch (value) {
    case 'nearest': return gl.NEAREST;
    case 'linear': return gl.LINEAR;
    case 'nearest-mipmap-nearest': return gl.NEAREST_MIPMAP_NEAREST;
    case 'linear-mipmap-nearest': return gl.LINEAR_MIPMAP_NEAREST;
    case 'nearest-mipmap-linear': return gl.NEAREST_MIPMAP_LINEAR;
    case 'linear-mipmap-linear': return gl.LINEAR_MIPMAP_LINEAR;
  }
}

function textureMagFilter(
  gl: WebGL2RenderingContext,
  value: CRCWebGLTextureSampler['magFilter'],
): number {
  return value === 'nearest' ? gl.NEAREST : gl.LINEAR;
}

function requiresMipmaps(data: InternalWebGLTextureData): boolean {
  return data.sampler.minFilter !== 'nearest' &&
    data.sampler.minFilter !== 'linear';
}

function createInstancedResources(
  gl: WebGL2RenderingContext,
  recipe: CRCWebGLInstancedRecipe,
  componentName: string,
): WebGLInstancedResources {
  let program: WebGLProgram | undefined;
  let vertexArray: WebGLVertexArrayObject | undefined;
  let staticVertexBuffer: WebGLBuffer | undefined;
  const lookupTextures: WebGLTexture[] = [];
  let spriteTexture: WebGLTexture | undefined;
  let published = false;
  let abandonFailedHandles = false;
  try {
    program = createInstancedProgram(gl, recipe, componentName);
    vertexArray = gl.createVertexArray() ?? undefined;
    if (!vertexArray) {
      throw new Error(`${componentName} instanced vertex array creation failed.`);
    }
    gl.bindVertexArray(vertexArray);
    if (recipe.staticVertexData !== undefined) {
      const components = recipe.staticVertexData.length /
        recipe.verticesPerInstance;
      if (!Number.isInteger(components) || components < 1 || components > 4) {
        throw new Error(
          `${componentName} instanced static vertex data must contain one ` +
          'to four components per vertex.',
        );
      }
      staticVertexBuffer = gl.createBuffer() ?? undefined;
      if (!staticVertexBuffer) {
        throw new Error(
          `${componentName} instanced static vertex buffer creation failed.`,
        );
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, staticVertexBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        recipe.staticVertexData as Float32Array,
        gl.STATIC_DRAW,
      );
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, components, gl.FLOAT, false, 0, 0);
    }
    for (const table of recipe.lookupTables) {
      lookupTextures.push(uploadLookupTable(gl, table, componentName));
    }
    if (recipe.sprite !== undefined) {
      spriteTexture = uploadSprite(gl, recipe.sprite.source, componentName);
    }
    const resource = Object.freeze({
      program,
      vertexArray,
      staticVertexBuffer,
      lookupTextures: Object.freeze(lookupTextures.slice()),
      spriteTexture,
      projectionView: requireInstancedUniform(
        gl,
        program,
        componentName,
        'u_projection_view',
      ),
      model: requireInstancedUniform(gl, program, componentName, 'u_model'),
      cameraRight: gl.getUniformLocation(program, 'u_camera_right'),
      cameraUp: gl.getUniformLocation(program, 'u_camera_up'),
      effectiveOpacity: requireInstancedUniform(
        gl,
        program,
        componentName,
        'u_effective_opacity',
      ),
      frameUniforms: gl.getUniformLocation(program, 'u_frame_uniforms[0]'),
      lookupSamplers: Object.freeze(recipe.lookupTables.map((_, index) =>
        requireInstancedUniform(
          gl,
          program!,
          componentName,
          `u_lookup_${index}`,
        ),
      )),
      spriteSampler: recipe.sprite === undefined ? null :
        requireInstancedUniform(gl, program, componentName, 'u_sprite'),
    });
    published = true;
    return resource;
  } catch (error) {
    abandonFailedHandles = contextLossPreventsResourceCleanup(gl);
    if (error instanceof Error && error.message.startsWith(componentName)) {
      throw error;
    }
    throw new Error(`${componentName} instanced resource creation failed.`, {
      cause: error,
    });
  } finally {
    if (!published && !abandonFailedHandles) {
      if (spriteTexture) {
        runResourceCleanup(() => gl.deleteTexture(spriteTexture!));
      }
      for (const texture of lookupTextures.reverse()) {
        runResourceCleanup(() => gl.deleteTexture(texture));
      }
      if (staticVertexBuffer) {
        runResourceCleanup(() => gl.deleteBuffer(staticVertexBuffer!));
      }
      if (vertexArray) {
        runResourceCleanup(() => gl.deleteVertexArray(vertexArray!));
      }
      if (program) runResourceCleanup(() => gl.deleteProgram(program!));
    }
  }
}

function createInstancedProgram(
  gl: WebGL2RenderingContext,
  recipe: CRCWebGLInstancedRecipe,
  componentName: string,
): WebGLProgram {
  let vertex: WebGLShader | undefined;
  let fragment: WebGLShader | undefined;
  let program: WebGLProgram | undefined;
  let linked = false;
  let published = false;
  let abandonFailedHandles = false;
  try {
    vertex = compileInstancedShader(
      gl,
      gl.VERTEX_SHADER,
      recipe.vertexSource,
      componentName,
      'vertex',
    );
    fragment = compileInstancedShader(
      gl,
      gl.FRAGMENT_SHADER,
      recipe.fragmentSource,
      componentName,
      'fragment',
    );
    program = gl.createProgram() ?? undefined;
    if (!program) {
      throw new Error(`${componentName} instanced program creation failed.`);
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(
        `${componentName} instanced program link failed: ` +
        sanitizePlatformLog(gl.getProgramInfoLog(program)),
      );
    }
    linked = true;
    runResourceCleanup(() => gl.detachShader(program!, vertex!));
    runResourceCleanup(() => gl.detachShader(program!, fragment!));
    runResourceCleanup(() => gl.deleteShader(vertex!));
    vertex = undefined;
    runResourceCleanup(() => gl.deleteShader(fragment!));
    fragment = undefined;
    published = true;
    return program;
  } catch (error) {
    abandonFailedHandles = contextLossPreventsResourceCleanup(gl);
    throw error;
  } finally {
    if (!abandonFailedHandles) {
      if (linked && program) {
        if (vertex) runResourceCleanup(() => gl.detachShader(program!, vertex!));
        if (fragment) {
          runResourceCleanup(() => gl.detachShader(program!, fragment!));
        }
      }
      if (vertex) runResourceCleanup(() => gl.deleteShader(vertex!));
      if (fragment) runResourceCleanup(() => gl.deleteShader(fragment!));
      if (!published && program) {
        runResourceCleanup(() => gl.deleteProgram(program!));
      }
    }
  }
}

function compileInstancedShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
  componentName: string,
  stage: 'vertex' | 'fragment',
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error(`${componentName} instanced ${stage} shader creation failed.`);
  }
  try {
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(
        `${componentName} instanced ${stage} shader compilation failed: ` +
        sanitizePlatformLog(gl.getShaderInfoLog(shader)),
      );
    }
    return shader;
  } catch (error) {
    if (!contextLossPreventsResourceCleanup(gl)) {
      runResourceCleanup(() => gl.deleteShader(shader));
    }
    throw error;
  }
}

function uploadLookupTable(
  gl: WebGL2RenderingContext,
  table: CRCWebGLLookupTableRecipe,
  componentName: string,
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error(`${componentName} instanced lookup texture creation failed.`);
  }
  try {
    const formats = lookupFormats(gl, table.channels);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      formats.internal,
      table.width,
      table.height,
      0,
      formats.format,
      gl.FLOAT,
      table.data as Float32Array,
    );
    return texture;
  } catch (error) {
    if (!contextLossPreventsResourceCleanup(gl)) {
      runResourceCleanup(() => gl.deleteTexture(texture));
    }
    throw error;
  }
}

function uploadSprite(
  gl: WebGL2RenderingContext,
  source: TexImageSource,
  componentName: string,
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error(`${componentName} instanced sprite texture creation failed.`);
  }
  try {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      source,
    );
    return texture;
  } catch (error) {
    if (!contextLossPreventsResourceCleanup(gl)) {
      runResourceCleanup(() => gl.deleteTexture(texture));
    }
    throw error;
  }
}

function lookupFormats(
  gl: WebGL2RenderingContext,
  channels: CRCWebGLLookupTableRecipe['channels'],
): Readonly<{ internal: number; format: number }> {
  switch (channels) {
    case 1: return { internal: gl.R32F, format: gl.RED };
    case 2: return { internal: gl.RG32F, format: gl.RG };
    case 3: return { internal: gl.RGB32F, format: gl.RGB };
    case 4: return { internal: gl.RGBA32F, format: gl.RGBA };
  }
}

function requireInstancedUniform(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  componentName: string,
  name: string,
): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);
  if (location === null) {
    throw new Error(
      `${componentName} instanced program link did not expose ${name}.`,
    );
  }
  return location;
}

function sanitizePlatformLog(log: string | null): string {
  const sanitized = Array.from(log ?? '', character => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f ? ' ' : character;
  }).join('').replace(/\s+/g, ' ').trim();
  return sanitized || 'no platform diagnostic was provided';
}

function deleteInstancedResources(
  gl: WebGL2RenderingContext,
  resource: WebGLInstancedResources,
): void {
  if (resource.spriteTexture) {
    runResourceCleanup(() => gl.deleteTexture(resource.spriteTexture!));
  }
  for (const texture of resource.lookupTextures) {
    runResourceCleanup(() => gl.deleteTexture(texture));
  }
  if (resource.staticVertexBuffer) {
    runResourceCleanup(() => gl.deleteBuffer(resource.staticVertexBuffer!));
  }
  runResourceCleanup(() => gl.deleteVertexArray(resource.vertexArray));
  runResourceCleanup(() => gl.deleteProgram(resource.program));
}

function uploadGeometry(
  gl: WebGL2RenderingContext,
  geometry: CRCWebGLGeometry,
  componentName: string,
): WebGLGeometryResource {
  let vertexArray: WebGLVertexArrayObject | undefined;
  let positionBuffer: WebGLBuffer | undefined;
  let normalBuffer: WebGLBuffer | undefined;
  let textureCoordinates0Buffer: WebGLBuffer | undefined;
  let tangentBuffer: WebGLBuffer | undefined;
  let indexBuffer: WebGLBuffer | undefined;
  let published = false;
  let abandonFailedHandles = false;
  let cleanupDecisionMade = false;
  try {
    const data = getWebGLGeometryData(geometry);
    vertexArray = gl.createVertexArray() ?? undefined;
    if (!vertexArray) {
      throw new Error(
        `${componentName} geometry vertex array creation failed.`,
      );
    }
    positionBuffer = gl.createBuffer() ?? undefined;
    if (!positionBuffer) {
      throw new Error(
        `${componentName} geometry position buffer creation failed.`,
      );
    }
    if (data.normals !== undefined) {
      normalBuffer = gl.createBuffer() ?? undefined;
      if (!normalBuffer) {
        throw new Error(
          `${componentName} geometry normal buffer creation failed.`,
        );
      }
    }
    if (data.textureCoordinates0 !== undefined) {
      textureCoordinates0Buffer = gl.createBuffer() ?? undefined;
      if (!textureCoordinates0Buffer) {
        throw new Error(
          `${componentName} geometry textureCoordinates0 buffer creation failed.`,
        );
      }
    }
    if (data.tangents !== undefined) {
      tangentBuffer = gl.createBuffer() ?? undefined;
      if (!tangentBuffer) {
        throw new Error(`${componentName} geometry tangent buffer creation failed.`);
      }
    }
    if (data.indices !== undefined) {
      indexBuffer = gl.createBuffer() ?? undefined;
      if (!indexBuffer) {
        throw new Error(
          `${componentName} geometry index buffer creation failed.`,
        );
      }
    }

    gl.bindVertexArray(vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    if (data.normals !== undefined) {
      gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer!);
      gl.bufferData(gl.ARRAY_BUFFER, data.normals, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    }
    if (data.textureCoordinates0 !== undefined) {
      gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordinates0Buffer!);
      gl.bufferData(gl.ARRAY_BUFFER, data.textureCoordinates0, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(WEBGL_TEXTURE_COORDINATES_0_ATTRIBUTE);
      gl.vertexAttribPointer(
        WEBGL_TEXTURE_COORDINATES_0_ATTRIBUTE,
        2,
        gl.FLOAT,
        false,
        0,
        0,
      );
    } else {
      gl.disableVertexAttribArray(WEBGL_TEXTURE_COORDINATES_0_ATTRIBUTE);
      gl.vertexAttrib2f(WEBGL_TEXTURE_COORDINATES_0_ATTRIBUTE, 0, 0);
    }
    if (data.tangents !== undefined) {
      gl.bindBuffer(gl.ARRAY_BUFFER, tangentBuffer!);
      gl.bufferData(gl.ARRAY_BUFFER, data.tangents, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(WEBGL_TANGENT_ATTRIBUTE);
      gl.vertexAttribPointer(
        WEBGL_TANGENT_ATTRIBUTE,
        4,
        gl.FLOAT,
        false,
        0,
        0,
      );
    } else {
      gl.disableVertexAttribArray(WEBGL_TANGENT_ATTRIBUTE);
      gl.vertexAttrib4f(WEBGL_TANGENT_ATTRIBUTE, 1, 0, 0, 1);
    }
    if (data.indices !== undefined) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer!);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
    }
    const contextValidity = readResourceContextValidity(gl);
    if (contextValidity.status === 'lost') {
      cleanupDecisionMade = true;
      abandonFailedHandles = true;
      throw new Error(
        `${componentName} geometry upload failed because the WebGL context was lost.`,
      );
    }
    if (contextValidity.status === 'unknown') {
      cleanupDecisionMade = true;
      abandonFailedHandles = true;
      throw new Error(
        `${componentName} geometry upload context validation failed.`,
        { cause: contextValidity.error },
      );
    }
    const resource = Object.freeze({
      vertexArray,
      positionBuffer,
      normalBuffer,
      textureCoordinates0Buffer,
      tangentBuffer,
      indexBuffer,
      vertexCount: geometry.vertexCount,
      indexCount: data.indices?.length,
    });
    published = true;
    return resource;
  } catch (error) {
    if (!cleanupDecisionMade) {
      abandonFailedHandles = contextLossPreventsResourceCleanup(gl);
    }
    if (error instanceof Error && error.message.startsWith(componentName)) {
      throw error;
    }
    throw new Error(`${componentName} geometry upload failed.`, {
      cause: error,
    });
  } finally {
    if (!published && !abandonFailedHandles) {
      if (indexBuffer) {
        runResourceCleanup(() => gl.deleteBuffer(indexBuffer!));
      }
      if (tangentBuffer) {
        runResourceCleanup(() => gl.deleteBuffer(tangentBuffer!));
      }
      if (textureCoordinates0Buffer) {
        runResourceCleanup(() => gl.deleteBuffer(textureCoordinates0Buffer!));
      }
      if (normalBuffer) {
        runResourceCleanup(() => gl.deleteBuffer(normalBuffer!));
      }
      if (positionBuffer) {
        runResourceCleanup(() => gl.deleteBuffer(positionBuffer!));
      }
      if (vertexArray) {
        runResourceCleanup(() => gl.deleteVertexArray(vertexArray!));
      }
    }
  }
}

type WebGLResourceContextValidity =
  | { readonly status: 'available' }
  | { readonly status: 'lost' }
  | { readonly status: 'unknown'; readonly error: unknown };

function readResourceContextValidity(
  gl: WebGL2RenderingContext,
): WebGLResourceContextValidity {
  try {
    return gl.isContextLost() ? { status: 'lost' } : { status: 'available' };
  } catch (error) {
    return { status: 'unknown', error };
  }
}

function contextLossPreventsResourceCleanup(
  gl: WebGL2RenderingContext,
): boolean {
  const validity = readResourceContextValidity(gl);
  if (validity.status === 'available') return false;
  if (validity.status === 'unknown') {
    reportSecondaryResourceError(validity.error);
  }
  // Unknown context validity is not permission to delete generation handles.
  return true;
}

function deleteGeometry(
  gl: WebGL2RenderingContext,
  geometry: WebGLGeometryResource,
): void {
  if (geometry.indexBuffer) {
    runResourceCleanup(() => gl.deleteBuffer(geometry.indexBuffer!));
  }
  if (geometry.tangentBuffer) {
    runResourceCleanup(() => gl.deleteBuffer(geometry.tangentBuffer!));
  }
  if (geometry.textureCoordinates0Buffer) {
    runResourceCleanup(() => gl.deleteBuffer(geometry.textureCoordinates0Buffer!));
  }
  if (geometry.normalBuffer) {
    runResourceCleanup(() => gl.deleteBuffer(geometry.normalBuffer!));
  }
  runResourceCleanup(() => gl.deleteBuffer(geometry.positionBuffer));
  runResourceCleanup(() => gl.deleteVertexArray(geometry.vertexArray));
}

function runResourceCleanup(cleanup: () => void): void {
  try {
    cleanup();
  } catch (error) {
    reportSecondaryResourceError(error);
  }
}

function reportSecondaryResourceError(error: unknown): void {
  try {
    globalThis.reportError(error);
  } catch {
    // Reporting cannot suppress release of later context-owned handles.
  }
}
