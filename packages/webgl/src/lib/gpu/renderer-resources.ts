import { getWebGLGeometryData } from '../geometry/geometry.js';
import type { CRCWebGLGeometry } from '../types.js';
import type {
  CRCWebGLInstancedRecipe,
  CRCWebGLLookupTableRecipe,
} from '../scene/types.js';
import {
  createBuiltInProgram,
  deleteBuiltInProgram,
  type WebGLBuiltInProgram,
  type WebGLProgramKey,
} from './program.js';

export interface WebGLGeometryResource {
  readonly vertexArray: WebGLVertexArrayObject;
  readonly positionBuffer: WebGLBuffer;
  readonly normalBuffer: WebGLBuffer | undefined;
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

export interface WebGLRendererResourceTransaction {
  useProgram(
    key: WebGLProgramKey,
    componentName: string,
  ): WebGLBuiltInProgram;
  useGeometry(
    geometry: CRCWebGLGeometry,
    componentName: string,
  ): WebGLGeometryResource;
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
  readonly usedInstancedKeys: Set<object>;
  readonly createdPrograms: Map<WebGLProgramKey, WebGLBuiltInProgram>;
  readonly createdGeometries: Map<CRCWebGLGeometry, WebGLGeometryResource>;
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
      usedInstancedKeys: new Set(),
      createdPrograms: new Map(),
      createdGeometries: new Map(),
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
    this.programs.clear();
    this.residentProgramKeys.clear();
    this.geometries.clear();
    this.residentGeometries.clear();
    this.instanced.clear();
    this.residentInstancedKeys.clear();
  }

  dispose(contextLost: boolean): void {
    if (this.disposed) return;
    this.disposed = true;
    this.closeActiveCandidate();
    const programs = Array.from(this.programs.values());
    const geometries = Array.from(this.geometries.values());
    const instanced = Array.from(this.instanced.values());
    this.programs.clear();
    this.residentProgramKeys.clear();
    this.geometries.clear();
    this.residentGeometries.clear();
    this.instanced.clear();
    this.residentInstancedKeys.clear();
    if (contextLost || this.invalidated) return;
    for (const program of programs) {
      runResourceCleanup(() => deleteBuiltInProgram(this.gl, program));
    }
    for (const geometry of geometries) {
      deleteGeometry(this.gl, geometry);
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
    candidate.usedInstancedKeys.clear();
    candidate.createdPrograms.clear();
    candidate.createdGeometries.clear();
    candidate.createdInstanced.clear();
    if (this.activeCandidate === candidate) this.activeCandidate = undefined;
  }
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
