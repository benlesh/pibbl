import { getWebGLGeometryData } from '../geometry/geometry.js';
import type { CRCWebGLGeometry } from '../types.js';
import {
  createBuiltInProgram,
  deleteBuiltInProgram,
  type WebGLBuiltInProgram,
} from './program.js';

export interface WebGLGeometryResource {
  readonly vertexArray: WebGLVertexArrayObject;
  readonly positionBuffer: WebGLBuffer;
  readonly indexBuffer: WebGLBuffer | undefined;
  readonly vertexCount: number;
  readonly indexCount: number | undefined;
}

export interface WebGLResourceLease<T> {
  readonly value: T;
  release(contextLost: boolean): void;
}

interface CacheEntry<T> {
  readonly value: T;
  references: number;
  contextLost: boolean;
  live: boolean;
}

/** Context-generation-owned program and immutable-geometry caches. */
export class WebGLGPUResourceCache {
  private readonly geometries = new Map<
    CRCWebGLGeometry,
    CacheEntry<WebGLGeometryResource>
  >();
  private program: CacheEntry<WebGLBuiltInProgram> | undefined;
  private disposed = false;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    readonly contextGeneration: number,
  ) {}

  acquireProgram(
    componentName: string,
  ): WebGLResourceLease<WebGLBuiltInProgram> {
    this.requireActive();
    let entry = this.program;
    if (!entry) {
      entry = {
        value: createBuiltInProgram(this.gl, componentName),
        references: 0,
        contextLost: false,
        live: true,
      };
      this.program = entry;
    }
    entry.references += 1;
    return createLease(entry, contextLost => {
      this.releaseProgram(entry!, contextLost);
    });
  }

  acquireGeometry(
    geometry: CRCWebGLGeometry,
    componentName: string,
  ): WebGLResourceLease<WebGLGeometryResource> {
    this.requireActive();
    let entry = this.geometries.get(geometry);
    if (!entry) {
      entry = {
        value: uploadGeometry(this.gl, geometry, componentName),
        references: 0,
        contextLost: false,
        live: true,
      };
      this.geometries.set(geometry, entry);
    }
    entry.references += 1;
    return createLease(entry, contextLost => {
      this.releaseGeometry(geometry, entry!, contextLost);
    });
  }

  dispose(contextLost: boolean): void {
    if (this.disposed) return;
    this.disposed = true;
    const program = this.program;
    this.program = undefined;
    if (program?.live) {
      program.live = false;
      if (!contextLost && !program.contextLost) {
        deleteBuiltInProgram(this.gl, program.value);
      }
    }
    for (const entry of this.geometries.values()) {
      if (!entry.live) continue;
      entry.live = false;
      if (!contextLost && !entry.contextLost) {
        deleteGeometry(this.gl, entry.value);
      }
    }
    this.geometries.clear();
  }

  private releaseProgram(
    entry: CacheEntry<WebGLBuiltInProgram>,
    contextLost: boolean,
  ): void {
    if (!entry.live) return;
    entry.contextLost ||= contextLost;
    entry.references -= 1;
    if (entry.references > 0) return;
    entry.live = false;
    if (this.program === entry) this.program = undefined;
    if (!entry.contextLost) deleteBuiltInProgram(this.gl, entry.value);
  }

  private releaseGeometry(
    geometry: CRCWebGLGeometry,
    entry: CacheEntry<WebGLGeometryResource>,
    contextLost: boolean,
  ): void {
    if (!entry.live) return;
    entry.contextLost ||= contextLost;
    entry.references -= 1;
    if (entry.references > 0) return;
    entry.live = false;
    if (this.geometries.get(geometry) === entry) {
      this.geometries.delete(geometry);
    }
    if (!entry.contextLost) deleteGeometry(this.gl, entry.value);
  }

  private requireActive(): void {
    if (this.disposed) {
      throw new Error(
        `WebGL GPU resource cache generation ${this.contextGeneration} ` +
        'is disposed.',
      );
    }
  }
}

function createLease<T>(
  entry: CacheEntry<T>,
  releaseEntry: (contextLost: boolean) => void,
): WebGLResourceLease<T> {
  let active = true;
  return Object.freeze({
    value: entry.value,
    release(contextLost: boolean): void {
      if (!active) return;
      active = false;
      releaseEntry(contextLost);
    },
  });
}

function uploadGeometry(
  gl: WebGL2RenderingContext,
  geometry: CRCWebGLGeometry,
  componentName: string,
): WebGLGeometryResource {
  const data = getWebGLGeometryData(geometry);
  let vertexArray: WebGLVertexArrayObject | undefined;
  let positionBuffer: WebGLBuffer | undefined;
  let indexBuffer: WebGLBuffer | undefined;
  let published = false;
  try {
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
    if (data.indices !== undefined) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer!);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
    }
    const resource = Object.freeze({
      vertexArray,
      positionBuffer,
      indexBuffer,
      vertexCount: geometry.vertexCount,
      indexCount: data.indices?.length,
    });
    published = true;
    return resource;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(componentName)) {
      throw error;
    }
    throw new Error(`${componentName} geometry upload failed.`, { cause: error });
  } finally {
    if (!published) {
      if (indexBuffer) gl.deleteBuffer(indexBuffer);
      if (positionBuffer) gl.deleteBuffer(positionBuffer);
      if (vertexArray) gl.deleteVertexArray(vertexArray);
    }
  }
}

function deleteGeometry(
  gl: WebGL2RenderingContext,
  geometry: WebGLGeometryResource,
): void {
  if (geometry.indexBuffer) gl.deleteBuffer(geometry.indexBuffer);
  gl.deleteBuffer(geometry.positionBuffer);
  gl.deleteVertexArray(geometry.vertexArray);
}
