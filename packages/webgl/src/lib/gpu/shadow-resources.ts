import { haveSameWebGLShadowPlan } from '../scene/shadows.js';
import type {
  SettledWebGLDirectionalShadowPlan,
  SettledWebGLPointShadowPlan,
  SettledWebGLShadowPlan,
  SettledWebGLSpotShadowPlan,
  WebGLSceneIdentity,
} from '../scene/types.js';
import { WEBGL_MAX_SHADOW_VIEWS } from './program-sources.js';

const SHADOW_VIEWS_PER_LIGHT = 6;

export interface CRCWebGLShadowArrayResource {
  readonly texture: WebGLTexture;
  readonly framebuffer: WebGLFramebuffer;
  readonly resolution: number;
  readonly capacity: number;
}

export interface CRCWebGLShadowViewAssignment {
  readonly layer: number;
  readonly matrix: Readonly<Float32Array>;
}

export interface WebGLDirectionalShadowResource {
  readonly kind: 'directional';
  readonly resolution: number;
  readonly plan: SettledWebGLDirectionalShadowPlan;
  readonly views: readonly [CRCWebGLShadowViewAssignment];
}

export interface WebGLPointShadowResource {
  readonly kind: 'point';
  readonly resolution: number;
  readonly plan: SettledWebGLPointShadowPlan;
  readonly views: readonly CRCWebGLShadowViewAssignment[];
}

export interface WebGLSpotShadowResource {
  readonly kind: 'spot';
  readonly resolution: number;
  readonly plan: SettledWebGLSpotShadowPlan;
  readonly views: readonly [CRCWebGLShadowViewAssignment];
}

export type WebGLShadowResource =
  | WebGLDirectionalShadowResource
  | WebGLPointShadowResource
  | WebGLSpotShadowResource;

export interface WebGLShadowBindings {
  readonly texture: WebGLTexture;
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

interface ShadowRequest {
  readonly plan: SettledWebGLShadowPlan;
  readonly resolution: number;
  readonly resource: MutableShadowResource;
  readonly render: (face: number, resolution: number) => void;
  slot: number;
}

interface MutableShadowResource {
  kind: WebGLShadowResource['kind'];
  resolution: number;
  plan: SettledWebGLShadowPlan;
  views: readonly CRCWebGLShadowViewAssignment[];
}

interface ShadowResident {
  readonly array: CRCWebGLShadowArrayResource;
  readonly records: ReadonlyMap<WebGLSceneIdentity, ShadowResidentRecord>;
}

interface ShadowResidentRecord {
  readonly plan: SettledWebGLShadowPlan;
  readonly resolution: number;
  readonly slot: number;
}

interface ShadowCandidate {
  active: boolean;
  finalized: boolean;
  fallbackCreated: boolean;
  array: CRCWebGLShadowArrayResource | undefined;
  bindings: WebGLShadowBindings | undefined;
  readonly requests: Map<WebGLSceneIdentity, ShadowRequest>;
}

/** Owns transactional array-backed depth targets for one renderer context. */
export class WebGLShadowResourceCache {
  private fallbackTexture: WebGLTexture | undefined;
  private resident: ShadowResident | undefined;
  private activeCandidate: ShadowCandidate | undefined;
  private maximumResolution: number | undefined;
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
      finalized: false,
      fallbackCreated: false,
      array: undefined,
      bindings: undefined,
      requests: new Map(),
    };
    this.activeCandidate = candidate;
    return Object.freeze({
      useDirectional: (
        plan: SettledWebGLDirectionalShadowPlan,
        render: (resolution: number) => void,
      ) => this.usePlan(candidate, plan, (_face, resolution) => {
        render(resolution);
      }) as WebGLDirectionalShadowResource,
      usePoint: (
        plan: SettledWebGLPointShadowPlan,
        render: (face: number, resolution: number) => void,
      ) => this.usePlan(candidate, plan, render) as WebGLPointShadowResource,
      useSpot: (
        plan: SettledWebGLSpotShadowPlan,
        render: (resolution: number) => void,
      ) => this.usePlan(candidate, plan, (_face, resolution) => {
        render(resolution);
      }) as WebGLSpotShadowResource,
      getBindings: () => this.getBindings(candidate),
      commit: () => this.commit(candidate),
      rollback: (contextLost = false) => this.rollback(candidate, contextLost),
    });
  }

  invalidateContext(): void {
    if (this.disposed || this.invalidated) return;
    this.invalidated = true;
    this.closeActiveCandidate();
    this.fallbackTexture = undefined;
    this.resident = undefined;
    this.maximumResolution = undefined;
  }

  dispose(contextLost: boolean): void {
    if (this.disposed) return;
    this.disposed = true;
    const candidateArray = this.activeCandidate?.array;
    this.closeActiveCandidate();
    const fallback = this.fallbackTexture;
    const resident = this.resident;
    this.fallbackTexture = undefined;
    this.resident = undefined;
    this.maximumResolution = undefined;
    if (contextLost || this.invalidated) return;
    if (candidateArray) deleteShadowArray(this.gl, candidateArray);
    if (resident) deleteShadowArray(this.gl, resident.array);
    if (fallback) runShadowCleanup(() => this.gl.deleteTexture(fallback));
  }

  private usePlan(
    candidate: ShadowCandidate,
    plan: SettledWebGLShadowPlan,
    render: (face: number, resolution: number) => void,
  ): WebGLShadowResource {
    this.requireCandidate(candidate);
    if (candidate.finalized) {
      throw new Error('WebGL shadow views cannot be added after binding.');
    }
    if (plan.contextGeneration !== this.contextGeneration) {
      throw new Error(
        `${shadowKindName(plan.kind)} shadow generation ` +
        `${plan.contextGeneration} cannot be used by cache generation ` +
        `${this.contextGeneration}.`,
      );
    }
    if (candidate.requests.has(plan.lightIdentity)) {
      throw new Error('A shadow light can be used only once per render.');
    }
    if (candidate.requests.size >= WEBGL_MAX_SHADOW_VIEWS / 6) {
      throw new Error('A WebGL scene cannot allocate more than eight shadows.');
    }
    const resolution = Math.min(
      plan.requestedResolution,
      this.getMaximumResolution(),
    );
    const resource: MutableShadowResource = {
      kind: plan.kind,
      resolution,
      plan,
      views: [],
    };
    const request: ShadowRequest = {
      plan,
      resolution,
      resource,
      render,
      slot: -1,
    };
    candidate.requests.set(plan.lightIdentity, request);
    return resource as WebGLShadowResource;
  }

  private getBindings(candidate: ShadowCandidate): WebGLShadowBindings {
    this.finalize(candidate);
    return candidate.bindings!;
  }

  private finalize(candidate: ShadowCandidate): void {
    this.requireCandidate(candidate);
    if (candidate.finalized) return;
    candidate.finalized = true;
    assignStableSlots(candidate.requests, this.resident?.records);
    const needsCandidate = this.needsCandidate(candidate.requests);
    if (candidate.requests.size === 0) {
      candidate.bindings = Object.freeze({
        texture: this.requireFallback(candidate),
      });
      return;
    }
    if (!needsCandidate) {
      candidate.bindings = Object.freeze({
        texture: this.resident!.array.texture,
      });
      return;
    }
    const resolution = requireCommonResolution(candidate.requests);
    const array = createShadowArray(this.gl, resolution);
    candidate.array = array;
    candidate.bindings = Object.freeze({ texture: array.texture });
    this.renderCandidate(array, candidate.requests);
  }

  private needsCandidate(
    requests: ReadonlyMap<WebGLSceneIdentity, ShadowRequest>,
  ): boolean {
    const resident = this.resident;
    if (!resident || resident.records.size !== requests.size) return true;
    for (const [identity, request] of requests) {
      const existing = resident.records.get(identity);
      if (!existing || existing.slot !== request.slot ||
        !haveSameWebGLShadowPlan(
          existing.plan,
          existing.resolution,
          request.plan,
          request.resolution,
        )) return true;
    }
    return false;
  }

  private renderCandidate(
    array: CRCWebGLShadowArrayResource,
    requests: ReadonlyMap<WebGLSceneIdentity, ShadowRequest>,
  ): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, array.framebuffer);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    for (const [identity, request] of requests) {
      const views = request.resource.views;
      const residentRecord = this.resident?.records.get(identity);
      const canReuse = residentRecord !== undefined &&
        residentRecord.slot === request.slot &&
        this.resident!.array.resolution === array.resolution &&
        haveSameWebGLShadowPlan(
          residentRecord.plan,
          residentRecord.resolution,
          request.plan,
          request.resolution,
        );
      if (canReuse) {
        for (let face = 0; face < views.length; face += 1) {
          copyShadowLayer(
            gl,
            this.resident!.array,
            residentRecord.slot * SHADOW_VIEWS_PER_LIGHT + face,
            array,
            views[face]!.layer,
          );
        }
        continue;
      }
      for (let face = 0; face < views.length; face += 1) {
        const view = views[face]!;
        gl.framebufferTextureLayer(
          gl.FRAMEBUFFER,
          gl.DEPTH_ATTACHMENT,
          array.texture,
          0,
          view.layer,
        );
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
          throw new Error(
            `${shadowKindName(request.plan.kind)} shadow layer ${view.layer} ` +
            `framebuffer is incomplete (status ${status}).`,
          );
        }
        request.render(face, request.resolution);
      }
    }
  }

  private requireFallback(candidate: ShadowCandidate): WebGLTexture {
    if (this.fallbackTexture) return this.fallbackTexture;
    const texture = createDepthTextureArray(this.gl, 1, 1);
    this.fallbackTexture = texture;
    candidate.fallbackCreated = true;
    return texture;
  }

  private getMaximumResolution(): number {
    if (this.maximumResolution !== undefined) return this.maximumResolution;
    const value = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as unknown;
    if (!Number.isInteger(value) || (value as number) < 1) {
      throw new Error('WebGL2 MAX_TEXTURE_SIZE must be a positive integer.');
    }
    this.maximumResolution = value as number;
    return this.maximumResolution;
  }

  private commit(candidate: ShadowCandidate): void {
    if (!candidate.active) return;
    if (!candidate.finalized && candidate.requests.size === 0) {
      this.closeCandidate(candidate);
      return;
    }
    this.finalize(candidate);
    const previous = this.resident;
    try {
      if (candidate.requests.size === 0) {
        this.resident = undefined;
      } else if (candidate.array) {
        this.resident = {
          array: candidate.array,
          records: createResidentRecords(candidate.requests),
        };
        candidate.array = undefined;
      } else if (previous) {
        this.resident = {
          array: previous.array,
          records: createResidentRecords(candidate.requests),
        };
      }
      if (previous && previous.array !== this.resident?.array) {
        deleteShadowArray(this.gl, previous.array);
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
      if (candidate.array) {
        const array = candidate.array;
        candidate.array = undefined;
        deleteShadowArray(this.gl, array);
      }
      if (candidate.fallbackCreated && this.fallbackTexture) {
        const fallback = this.fallbackTexture;
        this.fallbackTexture = undefined;
        runShadowCleanup(() => this.gl.deleteTexture(fallback));
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
    candidate.requests.clear();
    if (this.activeCandidate === candidate) this.activeCandidate = undefined;
  }
}

function copyShadowLayer(
  gl: WebGL2RenderingContext,
  source: CRCWebGLShadowArrayResource,
  sourceLayer: number,
  target: CRCWebGLShadowArrayResource,
  targetLayer: number,
): void {
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, source.framebuffer);
  gl.framebufferTextureLayer(
    gl.READ_FRAMEBUFFER,
    gl.DEPTH_ATTACHMENT,
    source.texture,
    0,
    sourceLayer,
  );
  const sourceStatus = gl.checkFramebufferStatus(gl.READ_FRAMEBUFFER);
  if (sourceStatus !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error(
      `Resident shadow layer ${sourceLayer} framebuffer is incomplete ` +
      `(status ${sourceStatus}).`,
    );
  }
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, target.framebuffer);
  gl.framebufferTextureLayer(
    gl.DRAW_FRAMEBUFFER,
    gl.DEPTH_ATTACHMENT,
    target.texture,
    0,
    targetLayer,
  );
  const targetStatus = gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER);
  if (targetStatus !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error(
      `Candidate shadow layer ${targetLayer} framebuffer is incomplete ` +
      `(status ${targetStatus}).`,
    );
  }
  gl.blitFramebuffer(
    0,
    0,
    source.resolution,
    source.resolution,
    0,
    0,
    target.resolution,
    target.resolution,
    gl.DEPTH_BUFFER_BIT,
    gl.NEAREST,
  );
}

function assignStableSlots(
  requests: ReadonlyMap<WebGLSceneIdentity, ShadowRequest>,
  resident: ReadonlyMap<WebGLSceneIdentity, ShadowResidentRecord> | undefined,
): void {
  const occupied = new Set<number>();
  for (const [identity, request] of requests) {
    const previous = resident?.get(identity);
    if (!previous) continue;
    request.slot = previous.slot;
    occupied.add(request.slot);
  }
  for (const request of requests.values()) {
    if (request.slot >= 0) continue;
    let slot = 0;
    while (occupied.has(slot)) slot += 1;
    request.slot = slot;
    occupied.add(slot);
  }
  for (const request of requests.values()) {
    const baseLayer = request.slot * SHADOW_VIEWS_PER_LIGHT;
    request.resource.views = Object.freeze(
      request.plan.kind === 'point' ? request.plan.projectionViewMatrices.map(
        (matrix, face) => Object.freeze({ layer: baseLayer + face, matrix }),
      ) : [Object.freeze({
        layer: baseLayer,
        matrix: request.plan.projectionViewMatrix,
      })],
    );
  }
}

function createResidentRecords(
  requests: ReadonlyMap<WebGLSceneIdentity, ShadowRequest>,
): ReadonlyMap<WebGLSceneIdentity, ShadowResidentRecord> {
  return new Map(Array.from(requests, ([identity, request]) => [identity, {
    plan: request.plan,
    resolution: request.resolution,
    slot: request.slot,
  }]));
}

function requireCommonResolution(
  requests: ReadonlyMap<WebGLSceneIdentity, ShadowRequest>,
): number {
  let resolution: number | undefined;
  for (const request of requests.values()) {
    resolution ??= request.resolution;
    if (request.resolution !== resolution) {
      throw new Error('All WebGL shadow views must use one resolution.');
    }
  }
  return resolution!;
}

function createShadowArray(
  gl: WebGL2RenderingContext,
  resolution: number,
): CRCWebGLShadowArrayResource {
  const framebuffer = gl.createFramebuffer();
  if (!framebuffer) throw new Error('WebGL shadow framebuffer creation failed.');
  let texture: WebGLTexture | undefined;
  let published = false;
  try {
    texture = createDepthTextureArray(
      gl,
      resolution,
      WEBGL_MAX_SHADOW_VIEWS,
    );
    published = true;
    return Object.freeze({
      texture,
      framebuffer,
      resolution,
      capacity: WEBGL_MAX_SHADOW_VIEWS,
    });
  } finally {
    if (!published && !contextLossPreventsShadowCleanup(gl)) {
      if (texture) runShadowCleanup(() => gl.deleteTexture(texture!));
      runShadowCleanup(() => gl.deleteFramebuffer(framebuffer));
    }
  }
}

function createDepthTextureArray(
  gl: WebGL2RenderingContext,
  resolution: number,
  capacity: number,
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error('WebGL shadow depth array creation failed.');
  let published = false;
  try {
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
    configureDepthTextureArray(gl);
    gl.texStorage3D(
      gl.TEXTURE_2D_ARRAY,
      1,
      gl.DEPTH_COMPONENT24,
      resolution,
      resolution,
      capacity,
    );
    published = true;
    return texture;
  } finally {
    if (!published && !contextLossPreventsShadowCleanup(gl)) {
      runShadowCleanup(() => gl.deleteTexture(texture));
    }
  }
}

function configureDepthTextureArray(gl: WebGL2RenderingContext): void {
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
}

function deleteShadowArray(
  gl: WebGL2RenderingContext,
  array: CRCWebGLShadowArrayResource,
): void {
  runShadowCleanup(() => gl.deleteTexture(array.texture));
  runShadowCleanup(() => gl.deleteFramebuffer(array.framebuffer));
}

function shadowKindName(kind: SettledWebGLShadowPlan['kind']): string {
  return kind[0]!.toUpperCase() + kind.slice(1);
}

function contextLossPreventsShadowCleanup(
  gl: WebGL2RenderingContext,
): boolean {
  try {
    return gl.isContextLost();
  } catch (error) {
    try {
      globalThis.reportError(error);
    } catch {
      // Unknown validity remains a reason to abandon generation handles.
    }
    return true;
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
