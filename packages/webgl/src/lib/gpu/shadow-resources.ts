import {
  haveSameWebGLShadowPlan,
} from '../scene/shadows.js';
import type {
  SettledWebGLDirectionalShadowPlan,
  SettledWebGLPointShadowPlan,
  SettledWebGLSpotShadowPlan,
  WebGLSceneIdentity,
} from '../scene/types.js';

export interface WebGLDirectionalShadowResource {
  readonly kind: 'directional';
  readonly texture: WebGLTexture;
  readonly resolution: number;
  readonly plan: SettledWebGLDirectionalShadowPlan;
}

export interface WebGLPointShadowResource {
  readonly kind: 'point';
  readonly texture: WebGLTexture;
  readonly resolution: number;
  readonly plan: SettledWebGLPointShadowPlan;
}

export interface WebGLSpotShadowResource {
  readonly kind: 'spot';
  readonly texture: WebGLTexture;
  readonly resolution: number;
  readonly plan: SettledWebGLSpotShadowPlan;
}

export type WebGLShadowResource =
  | WebGLDirectionalShadowResource
  | WebGLPointShadowResource
  | WebGLSpotShadowResource;

export interface WebGLShadowBindings {
  readonly fallback2D: WebGLTexture;
  readonly fallbackCube: WebGLTexture;
}

export interface WebGLShadowResourceTransaction {
  useDirectional(
    plan: SettledWebGLDirectionalShadowPlan,
    render: (resolution: number) => void,
  ): WebGLDirectionalShadowResource;
  usePoint(
    plan: SettledWebGLPointShadowPlan,
    render: (face: number, resolution: number) => void,
  ): WebGLPointShadowResource;
  useSpot(
    plan: SettledWebGLSpotShadowPlan,
    render: (resolution: number) => void,
  ): WebGLSpotShadowResource;
  getBindings(): WebGLShadowBindings;
  commit(): void;
  rollback(contextLost?: boolean): void;
}

interface ShadowCandidate {
  active: boolean;
  bindingsCreated: boolean;
  framebufferCreated: boolean;
  readonly usedLights: Set<WebGLSceneIdentity>;
  readonly created: Map<WebGLSceneIdentity, WebGLShadowResource>;
}

/** Owns transactional depth targets for one renderer context generation. */
export class WebGLShadowResourceCache {
  private bindings: WebGLShadowBindings | undefined;
  private framebuffer: WebGLFramebuffer | undefined;
  private readonly resident = new Map<
    WebGLSceneIdentity,
    WebGLShadowResource
  >();
  private activeCandidate: ShadowCandidate | undefined;
  private maximum2DResolution: number | undefined;
  private maximumCubeResolution: number | undefined;
  private invalidated = false;
  private disposed = false;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    readonly contextGeneration: number,
  ) {}

  beginRender(): WebGLShadowResourceTransaction {
    this.requireUsable();
    if (this.activeCandidate) {
      throw new Error(
        `WebGL shadow cache generation ${this.contextGeneration} already ` +
        'has an active render transaction.',
      );
    }
    const candidate: ShadowCandidate = {
      active: true,
      bindingsCreated: false,
      framebufferCreated: false,
      usedLights: new Set(),
      created: new Map(),
    };
    this.activeCandidate = candidate;
    return Object.freeze({
      useDirectional: (
        plan: SettledWebGLDirectionalShadowPlan,
        render: (resolution: number) => void,
      ) =>
        this.useDirectional(candidate, plan, render),
      usePoint: (
        plan: SettledWebGLPointShadowPlan,
        render: (face: number, resolution: number) => void,
      ) => this.usePoint(candidate, plan, render),
      useSpot: (
        plan: SettledWebGLSpotShadowPlan,
        render: (resolution: number) => void,
      ) => this.useSpot(candidate, plan, render),
      getBindings: () => this.getBindings(candidate),
      commit: () => this.commit(candidate),
      rollback: (contextLost = false) => this.rollback(candidate, contextLost),
    });
  }

  invalidateContext(): void {
    if (this.disposed || this.invalidated) return;
    this.invalidated = true;
    this.closeActiveCandidate();
    this.bindings = undefined;
    this.framebuffer = undefined;
    this.resident.clear();
    this.maximum2DResolution = undefined;
    this.maximumCubeResolution = undefined;
  }

  dispose(contextLost: boolean): void {
    if (this.disposed) return;
    this.disposed = true;
    const candidateResources = this.activeCandidate ?
      Array.from(this.activeCandidate.created.values()) : [];
    this.closeActiveCandidate();
    const bindings = this.bindings;
    const framebuffer = this.framebuffer;
    const resources = Array.from(this.resident.values());
    this.bindings = undefined;
    this.framebuffer = undefined;
    this.resident.clear();
    this.maximum2DResolution = undefined;
    this.maximumCubeResolution = undefined;
    if (contextLost || this.invalidated) return;
    for (const resource of candidateResources) {
      runShadowCleanup(() => this.gl.deleteTexture(resource.texture));
    }
    for (const resource of resources) {
      runShadowCleanup(() => this.gl.deleteTexture(resource.texture));
    }
    if (bindings) {
      runShadowCleanup(() => this.gl.deleteTexture(bindings.fallback2D));
      runShadowCleanup(() => this.gl.deleteTexture(bindings.fallbackCube));
    }
    if (framebuffer) {
      runShadowCleanup(() => this.gl.deleteFramebuffer(framebuffer));
    }
  }

  private useDirectional(
    candidate: ShadowCandidate,
    plan: SettledWebGLDirectionalShadowPlan,
    render: (resolution: number) => void,
  ): WebGLDirectionalShadowResource {
    this.requireCandidate(candidate);
    if (plan.contextGeneration !== this.contextGeneration) {
      throw new Error(
        `Directional shadow generation ${plan.contextGeneration} cannot be ` +
        `used by cache generation ${this.contextGeneration}.`,
      );
    }
    const identity = plan.lightIdentity;
    candidate.usedLights.add(identity);
    const resolution = Math.min(
      plan.requestedResolution,
      this.getMaximum2DResolution(),
    );
    const pending = candidate.created.get(identity);
    if (pending?.kind === 'directional' && haveSameWebGLShadowPlan(
      pending.plan,
      pending.resolution,
      plan,
      resolution,
    )) return pending;
    const existing = this.resident.get(identity);
    if (existing?.kind === 'directional' && haveSameWebGLShadowPlan(
      existing.plan,
      existing.resolution,
      plan,
      resolution,
    )) return existing;

    const framebuffer = this.requireFramebuffer(candidate);
    const texture = createDepthTexture2D(this.gl, resolution);
    const resource = Object.freeze({
      kind: 'directional' as const,
      texture,
      resolution,
      plan,
    });
    candidate.created.set(identity, resource);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.DEPTH_ATTACHMENT,
      this.gl.TEXTURE_2D,
      texture,
      0,
    );
    this.gl.drawBuffers([this.gl.NONE]);
    this.gl.readBuffer(this.gl.NONE);
    const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
    if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(
        `Directional shadow framebuffer is incomplete (status ${status}).`,
      );
    }
    render(resolution);
    return resource;
  }

  private useSpot(
    candidate: ShadowCandidate,
    plan: SettledWebGLSpotShadowPlan,
    render: (resolution: number) => void,
  ): WebGLSpotShadowResource {
    this.requireCandidate(candidate);
    if (plan.contextGeneration !== this.contextGeneration) {
      throw new Error(
        `Spot shadow generation ${plan.contextGeneration} cannot be ` +
        `used by cache generation ${this.contextGeneration}.`,
      );
    }
    const identity = plan.lightIdentity;
    candidate.usedLights.add(identity);
    const resolution = Math.min(
      plan.requestedResolution,
      this.getMaximum2DResolution(),
    );
    const pending = candidate.created.get(identity);
    if (pending?.kind === 'spot' && haveSameWebGLShadowPlan(
      pending.plan,
      pending.resolution,
      plan,
      resolution,
    )) return pending;
    const existing = this.resident.get(identity);
    if (existing?.kind === 'spot' && haveSameWebGLShadowPlan(
      existing.plan,
      existing.resolution,
      plan,
      resolution,
    )) return existing;

    const framebuffer = this.requireFramebuffer(candidate);
    const texture = createDepthTexture2D(this.gl, resolution);
    const resource = Object.freeze({
      kind: 'spot' as const,
      texture,
      resolution,
      plan,
    });
    candidate.created.set(identity, resource);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.DEPTH_ATTACHMENT,
      this.gl.TEXTURE_2D,
      texture,
      0,
    );
    this.gl.drawBuffers([this.gl.NONE]);
    this.gl.readBuffer(this.gl.NONE);
    const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
    if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(
        `Spot shadow framebuffer is incomplete (status ${status}).`,
      );
    }
    render(resolution);
    return resource;
  }

  private usePoint(
    candidate: ShadowCandidate,
    plan: SettledWebGLPointShadowPlan,
    render: (face: number, resolution: number) => void,
  ): WebGLPointShadowResource {
    this.requireCandidate(candidate);
    if (plan.contextGeneration !== this.contextGeneration) {
      throw new Error(
        `Point shadow generation ${plan.contextGeneration} cannot be ` +
        `used by cache generation ${this.contextGeneration}.`,
      );
    }
    const identity = plan.lightIdentity;
    candidate.usedLights.add(identity);
    const resolution = Math.min(
      plan.requestedResolution,
      this.getMaximumCubeResolution(),
    );
    const pending = candidate.created.get(identity);
    if (pending?.kind === 'point' && haveSameWebGLShadowPlan(
      pending.plan,
      pending.resolution,
      plan,
      resolution,
    )) return pending;
    const existing = this.resident.get(identity);
    if (existing?.kind === 'point' && haveSameWebGLShadowPlan(
      existing.plan,
      existing.resolution,
      plan,
      resolution,
    )) return existing;

    const framebuffer = this.requireFramebuffer(candidate);
    const texture = createDepthTextureCube(this.gl, resolution);
    const resource = Object.freeze({
      kind: 'point' as const,
      texture,
      resolution,
      plan,
    });
    candidate.created.set(identity, resource);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
    this.gl.drawBuffers([this.gl.NONE]);
    this.gl.readBuffer(this.gl.NONE);
    for (let face = 0; face < 6; face += 1) {
      this.gl.framebufferTexture2D(
        this.gl.FRAMEBUFFER,
        this.gl.DEPTH_ATTACHMENT,
        this.gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
        texture,
        0,
      );
      const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
      if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
        throw new Error(
          `Point shadow face ${face} framebuffer is incomplete ` +
          `(status ${status}).`,
        );
      }
      render(face, resolution);
    }
    return resource;
  }

  private getBindings(candidate: ShadowCandidate): WebGLShadowBindings {
    this.requireCandidate(candidate);
    if (this.bindings) return this.bindings;
    const bindings = createShadowBindings(this.gl);
    this.bindings = bindings;
    candidate.bindingsCreated = true;
    return bindings;
  }

  private requireFramebuffer(candidate: ShadowCandidate): WebGLFramebuffer {
    this.requireCandidate(candidate);
    if (this.framebuffer) return this.framebuffer;
    const framebuffer = this.gl.createFramebuffer();
    if (!framebuffer) {
      throw new Error('WebGL shadow framebuffer creation failed.');
    }
    this.framebuffer = framebuffer;
    candidate.framebufferCreated = true;
    return framebuffer;
  }

  private getMaximum2DResolution(): number {
    if (this.maximum2DResolution !== undefined) return this.maximum2DResolution;
    const value = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as unknown;
    if (!Number.isInteger(value) || (value as number) < 1) {
      throw new Error('WebGL2 MAX_TEXTURE_SIZE must be a positive integer.');
    }
    this.maximum2DResolution = value as number;
    return this.maximum2DResolution;
  }

  private getMaximumCubeResolution(): number {
    if (this.maximumCubeResolution !== undefined) {
      return this.maximumCubeResolution;
    }
    const value = this.gl.getParameter(
      this.gl.MAX_CUBE_MAP_TEXTURE_SIZE,
    ) as unknown;
    if (!Number.isInteger(value) || (value as number) < 1) {
      throw new Error(
        'WebGL2 MAX_CUBE_MAP_TEXTURE_SIZE must be a positive integer.',
      );
    }
    this.maximumCubeResolution = value as number;
    return this.maximumCubeResolution;
  }

  private commit(candidate: ShadowCandidate): void {
    if (!candidate.active) return;
    this.requireCandidate(candidate);
    try {
      for (const [identity, resource] of this.resident) {
        const replacement = candidate.created.get(identity);
        if (!candidate.usedLights.has(identity) || replacement) {
          this.resident.delete(identity);
          runShadowCleanup(() => this.gl.deleteTexture(resource.texture));
        }
      }
      for (const [identity, resource] of candidate.created) {
        this.resident.set(identity, resource);
      }
    } finally {
      this.closeCandidate(candidate);
    }
  }

  private rollback(candidate: ShadowCandidate, contextLost: boolean): void {
    if (!candidate.active) return;
    this.requireCandidate(candidate);
    if (contextLost) {
      this.invalidateContext();
      return;
    }
    try {
      for (const resource of candidate.created.values()) {
        runShadowCleanup(() => this.gl.deleteTexture(resource.texture));
      }
      if (candidate.bindingsCreated && this.bindings) {
        const bindings = this.bindings;
        this.bindings = undefined;
        runShadowCleanup(() => this.gl.deleteTexture(bindings.fallback2D));
        runShadowCleanup(() => this.gl.deleteTexture(bindings.fallbackCube));
      }
      if (candidate.framebufferCreated && this.framebuffer) {
        const framebuffer = this.framebuffer;
        this.framebuffer = undefined;
        runShadowCleanup(() => this.gl.deleteFramebuffer(framebuffer));
      }
    } finally {
      this.closeCandidate(candidate);
    }
  }

  private requireCandidate(candidate: ShadowCandidate): void {
    if (!candidate.active || this.activeCandidate !== candidate) {
      throw new Error('WebGL shadow resource transaction is closed.');
    }
    this.requireUsable();
  }

  private requireUsable(): void {
    if (this.disposed) {
      throw new Error(
        `WebGL shadow cache generation ${this.contextGeneration} is disposed.`,
      );
    }
    if (this.invalidated) {
      throw new Error(
        `WebGL shadow cache generation ${this.contextGeneration} is invalid.`,
      );
    }
  }

  private closeActiveCandidate(): void {
    if (this.activeCandidate) this.closeCandidate(this.activeCandidate);
  }

  private closeCandidate(candidate: ShadowCandidate): void {
    candidate.active = false;
    candidate.usedLights.clear();
    candidate.created.clear();
    if (this.activeCandidate === candidate) this.activeCandidate = undefined;
  }
}

function createShadowBindings(
  gl: WebGL2RenderingContext,
): WebGLShadowBindings {
  let fallback2D: WebGLTexture | undefined;
  let fallbackCube: WebGLTexture | undefined;
  let published = false;
  try {
    fallback2D = createDepthTexture2D(gl, 1);
    fallbackCube = createDepthTextureCube(gl, 1);
    published = true;
    return Object.freeze({ fallback2D, fallbackCube });
  } finally {
    if (!published) {
      if (fallbackCube) runShadowCleanup(() => gl.deleteTexture(fallbackCube!));
      if (fallback2D) runShadowCleanup(() => gl.deleteTexture(fallback2D!));
    }
  }
}

function createDepthTexture2D(
  gl: WebGL2RenderingContext,
  resolution: number,
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error('WebGL directional depth texture creation failed.');
  }
  let published = false;
  try {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    configureDepthTexture(gl, gl.TEXTURE_2D);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.DEPTH_COMPONENT24,
      resolution,
      resolution,
      0,
      gl.DEPTH_COMPONENT,
      gl.UNSIGNED_INT,
      null,
    );
    published = true;
    return texture;
  } finally {
    if (!published) runShadowCleanup(() => gl.deleteTexture(texture));
  }
}

function createDepthTextureCube(
  gl: WebGL2RenderingContext,
  resolution: number,
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error('WebGL cube depth fallback creation failed.');
  let published = false;
  try {
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
    configureDepthTexture(gl, gl.TEXTURE_CUBE_MAP);
    for (let face = 0; face < 6; face += 1) {
      gl.texImage2D(
        gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
        0,
        gl.DEPTH_COMPONENT24,
        resolution,
        resolution,
        0,
        gl.DEPTH_COMPONENT,
        gl.UNSIGNED_INT,
        null,
      );
    }
    published = true;
    return texture;
  } finally {
    if (!published) runShadowCleanup(() => gl.deleteTexture(texture));
  }
}

function configureDepthTexture(
  gl: WebGL2RenderingContext,
  target: number,
): void {
  gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (target === gl.TEXTURE_CUBE_MAP) {
    gl.texParameteri(target, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
  }
}

function runShadowCleanup(cleanup: () => void): void {
  try {
    cleanup();
  } catch (error) {
    try {
      globalThis.reportError(error);
    } catch {
      // Cleanup reporting cannot suppress later owned releases.
    }
  }
}
