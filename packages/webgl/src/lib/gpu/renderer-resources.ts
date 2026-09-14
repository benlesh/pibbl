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

export interface WebGLRendererResourceTransaction {
  useProgram(componentName: string): WebGLBuiltInProgram;
  useGeometry(
    geometry: CRCWebGLGeometry,
    componentName: string,
  ): WebGLGeometryResource;
  commit(): void;
  rollback(contextLost?: boolean): void;
}

interface ResourceCandidate {
  active: boolean;
  usedProgram: boolean;
  readonly usedGeometries: Set<CRCWebGLGeometry>;
  createdProgram: WebGLBuiltInProgram | undefined;
  readonly createdGeometries: Map<CRCWebGLGeometry, WebGLGeometryResource>;
}

/** Owns the resident GPU resources for one renderer context generation. */
export class WebGLRendererResourceCache {
  private readonly geometries = new Map<
    CRCWebGLGeometry,
    WebGLGeometryResource
  >();
  private readonly residentGeometries = new Set<CRCWebGLGeometry>();
  private program: WebGLBuiltInProgram | undefined;
  private programResident = false;
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
      usedProgram: false,
      usedGeometries: new Set(),
      createdProgram: undefined,
      createdGeometries: new Map(),
    };
    this.activeCandidate = candidate;
    return Object.freeze({
      useProgram: (componentName: string): WebGLBuiltInProgram =>
        this.useProgram(candidate, componentName),
      useGeometry: (
        geometry: CRCWebGLGeometry,
        componentName: string,
      ): WebGLGeometryResource =>
        this.useGeometry(candidate, geometry, componentName),
      commit: (): void => this.commit(candidate),
      rollback: (contextLost = false): void =>
        this.rollback(candidate, contextLost),
    });
  }

  invalidateContext(): void {
    if (this.disposed || this.invalidated) return;
    this.invalidated = true;
    this.closeActiveCandidate();
    this.program = undefined;
    this.programResident = false;
    this.geometries.clear();
    this.residentGeometries.clear();
  }

  dispose(contextLost: boolean): void {
    if (this.disposed) return;
    this.disposed = true;
    this.closeActiveCandidate();
    const program = this.program;
    const geometries = Array.from(this.geometries.values());
    this.program = undefined;
    this.programResident = false;
    this.geometries.clear();
    this.residentGeometries.clear();
    if (contextLost || this.invalidated) return;
    if (program) {
      runResourceCleanup(() => deleteBuiltInProgram(this.gl, program));
    }
    for (const geometry of geometries) {
      deleteGeometry(this.gl, geometry);
    }
  }

  private useProgram(
    candidate: ResourceCandidate,
    componentName: string,
  ): WebGLBuiltInProgram {
    this.requireCandidate(candidate);
    candidate.usedProgram = true;
    if (this.program) return this.program;
    const program = createBuiltInProgram(this.gl, componentName);
    this.program = program;
    candidate.createdProgram = program;
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

  private commit(candidate: ResourceCandidate): void {
    if (!candidate.active) return;
    this.requireCandidate(candidate);
    try {
      if (this.programResident && !candidate.usedProgram && this.program) {
        const omitted = this.program;
        this.program = undefined;
        runResourceCleanup(() => deleteBuiltInProgram(this.gl, omitted));
      }
      for (const geometry of this.residentGeometries) {
        if (candidate.usedGeometries.has(geometry)) continue;
        const omitted = this.geometries.get(geometry);
        this.geometries.delete(geometry);
        if (omitted) deleteGeometry(this.gl, omitted);
      }
      this.programResident =
        candidate.usedProgram && this.program !== undefined;
      this.residentGeometries.clear();
      for (const geometry of candidate.usedGeometries) {
        if (this.geometries.has(geometry)) {
          this.residentGeometries.add(geometry);
        }
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
      if (
        candidate.createdProgram &&
        this.program === candidate.createdProgram
      ) {
        const created = candidate.createdProgram;
        this.program = undefined;
        runResourceCleanup(() => deleteBuiltInProgram(this.gl, created));
      }
      for (const [geometry, created] of candidate.createdGeometries) {
        if (this.geometries.get(geometry) === created) {
          this.geometries.delete(geometry);
        }
        deleteGeometry(this.gl, created);
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
    candidate.usedProgram = false;
    candidate.usedGeometries.clear();
    candidate.createdProgram = undefined;
    candidate.createdGeometries.clear();
    if (this.activeCandidate === candidate) this.activeCandidate = undefined;
  }
}

function uploadGeometry(
  gl: WebGL2RenderingContext,
  geometry: CRCWebGLGeometry,
  componentName: string,
): WebGLGeometryResource {
  let vertexArray: WebGLVertexArrayObject | undefined;
  let positionBuffer: WebGLBuffer | undefined;
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
