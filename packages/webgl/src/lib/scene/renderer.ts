import {
  WebGLRendererResourceCache,
  type WebGLGeometryResource,
  type WebGLRendererResourceTransaction,
} from '../gpu/renderer-resources.js';
import {
  WebGLShadowResourceCache,
  type WebGLShadowResource,
  type WebGLShadowBindings,
  type WebGLShadowResourceTransaction,
} from '../gpu/shadow-resources.js';
import {
  WEBGL_LIGHT_KIND,
  WEBGL_MAX_LIGHTS,
  WEBGL_MAX_SHADOWS,
} from '../gpu/program-sources.js';
import type {
  WebGLBuiltInProgram,
  WebGLLambertProgram,
  WebGLShadowDepthProgram,
  WebGLUnlitProgram,
} from '../gpu/program.js';
import {
  createWebGLStateBaseline,
  installDirectionalShadowWebGLPass,
  installOpaqueWebGLPass,
  installTransparentWebGLPass,
  installWebGLStateBaseline,
  type WebGLStateBaseline,
} from '../gpu/state.js';
import type { SettledWebGLMesh, SettledWebGLScene } from './settle.js';
import type {
  SettledWebGLLight,
  SettledWebGLDirectionalShadowPlan,
  SettledWebGLPointShadowPlan,
  SettledWebGLSpotShadowPlan,
  SettledWebGLShadowPlan,
} from './types.js';

interface PackedWebGLLights {
  readonly count: number;
  readonly kinds: Int32Array;
  readonly colorIntensities: Float32Array;
  readonly positionRanges: Float32Array;
  readonly directionInnerCosines: Float32Array;
  readonly groundOuterCosines: Float32Array;
}

interface PackedWebGLShadows {
  readonly enabled: Int32Array;
  readonly matrices: Float32Array;
  readonly parameters: Float32Array;
  readonly textures2D: readonly WebGLTexture[];
  readonly texturesCube: readonly WebGLTexture[];
  readonly bindings: WebGLShadowBindings;
}

/** Executes immutable settled render queues for one WebGL context generation. */
export class WebGLSceneRenderer {
  private readonly resources: WebGLRendererResourceCache;
  private readonly shadows: WebGLShadowResourceCache;
  private baseline: WebGLStateBaseline | undefined;
  private invalidated = false;
  private disposed = false;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    readonly contextGeneration: number,
  ) {
    this.resources = new WebGLRendererResourceCache(gl, contextGeneration);
    this.shadows = new WebGLShadowResourceCache(gl, contextGeneration);
  }

  render(scene: SettledWebGLScene): void {
    this.requireUsable();
    if (scene.contextGeneration !== this.contextGeneration) {
      throw new Error(
        `WebGL settled scene generation ${scene.contextGeneration} cannot be ` +
          `rendered by renderer generation ${this.contextGeneration}.`,
      );
    }
    const baseline = this.baseline ?? createWebGLStateBaseline(this.gl);
    this.baseline = baseline;
    const lights = packWebGLLights(scene.lights);
    let transaction: WebGLRendererResourceTransaction | undefined;
    let shadowTransaction: WebGLShadowResourceTransaction | undefined;
    try {
      installWebGLStateBaseline(
        this.gl,
        scene.backingViewport.width,
        scene.backingViewport.height,
        baseline,
      );
      shadowTransaction = this.shadows.beginRender();
      const shadowResources = new Map<number, WebGLShadowResource>();
      if (scene.shadowPlans.length > 0) {
        transaction = this.resources.beginRender();
        for (const plan of scene.shadowPlans) {
          const componentName = plan.kind === 'directional' ?
            'DirectionalLight' : plan.kind === 'point' ?
              'PointLight' : 'SpotLight';
          const program = transaction.useProgram('shadow-depth', componentName);
          if (program.key !== 'shadow-depth') {
            throw new Error(
              'Shadow renderer acquired the wrong program.',
            );
          }
          const resource = plan.kind === 'point' ?
            shadowTransaction.usePoint(
              plan,
              (face, resolution) => drawPointShadowPlan(
                this.gl,
                transaction!,
                program,
                plan,
                face,
                resolution,
              ),
            ) : plan.kind === 'spot' ? shadowTransaction.useSpot(
              plan,
              resolution => drawSpotShadowPlan(
                this.gl,
                transaction!,
                program,
                plan,
                resolution,
              ),
            ) : shadowTransaction.useDirectional(
              plan,
              resolution => drawDirectionalShadowPlan(
                this.gl,
                transaction!,
                program,
                plan,
                resolution,
              ),
            );
          shadowResources.set(plan.lightIndex, resource);
        }
        installWebGLStateBaseline(
          this.gl,
          scene.backingViewport.width,
          scene.backingViewport.height,
          baseline,
        );
      }
      const background = scene.background?.color;
      this.gl.clearColor(
        background?.[0] ?? 0,
        background?.[1] ?? 0,
        background?.[2] ?? 0,
        background?.[3] ?? 0,
      );
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
      transaction ??= this.resources.beginRender();
      const needsLambert = scene.opaque.some(isLambertMesh) ||
        scene.transparent.some(isLambertMesh);
      const packedShadows = needsLambert ? packWebGLShadows(
        scene.shadowPlans,
        shadowResources,
        shadowTransaction.getBindings(),
      ) : undefined;
      const frameBoundPrograms = new Set<WebGLBuiltInProgram>();
      installOpaqueWebGLPass(this.gl);
      for (const mesh of scene.opaque) {
        drawMesh(
          this.gl,
          transaction,
          scene,
          mesh,
          lights,
          packedShadows,
          frameBoundPrograms,
        );
      }
      installTransparentWebGLPass(this.gl);
      for (const mesh of scene.transparent) {
        drawMesh(
          this.gl,
          transaction,
          scene,
          mesh,
          lights,
          packedShadows,
          frameBoundPrograms,
        );
      }
      installWebGLStateBaseline(
        this.gl,
        scene.backingViewport.width,
        scene.backingViewport.height,
        baseline,
      );
      transaction.commit();
      shadowTransaction.commit();
    } catch (error) {
      const contextLost = this.contextIsLost();
      const failedTransaction = transaction;
      if (failedTransaction) {
        attemptRendererCleanup(() => failedTransaction.rollback(contextLost));
      }
      const failedShadowTransaction = shadowTransaction;
      if (failedShadowTransaction) {
        attemptRendererCleanup(() =>
          failedShadowTransaction.rollback(contextLost),
        );
      }
      if (!contextLost && !this.invalidated && !this.disposed) {
        attemptRendererCleanup(() =>
          installWebGLStateBaseline(
            this.gl,
            scene.backingViewport.width,
            scene.backingViewport.height,
            baseline,
          ),
        );
      }
      throw error;
    }
  }

  invalidateContext(): void {
    if (this.invalidated || this.disposed) return;
    this.invalidated = true;
    this.resources.invalidateContext();
    this.shadows.invalidateContext();
    this.baseline = undefined;
  }

  dispose(contextLost: boolean): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resources.dispose(contextLost);
    this.shadows.dispose(contextLost);
    this.baseline = undefined;
  }

  private requireUsable(): void {
    if (this.disposed) {
      throw new Error(
        `WebGL scene renderer generation ${this.contextGeneration} is disposed.`,
      );
    }
    if (this.invalidated) {
      throw new Error(
        `WebGL scene renderer generation ${this.contextGeneration} is invalid.`,
      );
    }
  }

  private contextIsLost(): boolean {
    if (this.invalidated) return true;
    try {
      return this.gl.isContextLost();
    } catch (error) {
      reportSecondaryRendererError(error);
      return false;
    }
  }
}

function drawMesh(
  gl: WebGL2RenderingContext,
  transaction: WebGLRendererResourceTransaction,
  scene: SettledWebGLScene,
  mesh: SettledWebGLMesh,
  lights: PackedWebGLLights,
  shadows: PackedWebGLShadows | undefined,
  frameBoundPrograms: Set<WebGLBuiltInProgram>,
): void {
  const program = transaction.useProgram(
    mesh.shading.kind,
    mesh.componentName,
  );
  if (program.key === 'shadow-depth') {
    throw new Error(
      `${mesh.componentName} renderer acquired a depth program for color.`,
    );
  }
  const geometry = transaction.useGeometry(mesh.geometry, mesh.componentName);
  gl.useProgram(program.program);
  bindFrameProgram(
    gl,
    program,
    scene,
    lights,
    shadows,
    frameBoundPrograms,
  );
  gl.bindVertexArray(geometry.vertexArray);
  gl.bindBuffer(gl.ARRAY_BUFFER, geometry.positionBuffer);
  gl.enableVertexAttribArray(program.positionAttribute);
  gl.vertexAttribPointer(program.positionAttribute, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geometry.indexBuffer ?? null);
  gl.uniformMatrix4fv(program.model, false, mesh.model as Float32Array);
  if (program.key === 'unlit' && mesh.shading.kind === 'unlit') {
    bindUnlitMesh(gl, program, mesh.shading);
  } else if (program.key === 'lambert' && mesh.shading.kind === 'lambert') {
    const normalBuffer = geometry.normalBuffer;
    if (!normalBuffer) {
      throw new Error(
        `${mesh.componentName} Lambert geometry has no resident normal buffer.`,
      );
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.enableVertexAttribArray(program.normalAttribute);
    gl.vertexAttribPointer(
      program.normalAttribute,
      3,
      gl.FLOAT,
      false,
      0,
      0,
    );
    bindLambertMesh(gl, program, mesh);
  } else {
    throw new Error(
      `${mesh.componentName} renderer program did not match settled shading.`,
    );
  }
  if (geometry.indexCount !== undefined) {
    gl.drawElements(gl.TRIANGLES, geometry.indexCount, gl.UNSIGNED_INT, 0);
  } else {
    gl.drawArrays(gl.TRIANGLES, 0, geometry.vertexCount);
  }
}

function bindFrameProgram(
  gl: WebGL2RenderingContext,
  program: WebGLUnlitProgram | WebGLLambertProgram,
  scene: SettledWebGLScene,
  lights: PackedWebGLLights,
  shadows: PackedWebGLShadows | undefined,
  frameBoundPrograms: Set<WebGLBuiltInProgram>,
): void {
  if (frameBoundPrograms.has(program)) return;
  gl.uniformMatrix4fv(
    program.view,
    false,
    scene.camera.viewMatrix as Float32Array,
  );
  gl.uniformMatrix4fv(
    program.projection,
    false,
    scene.camera.projectionMatrix as Float32Array,
  );
  if (program.key === 'lambert') {
    bindLights(gl, program, lights);
    if (!shadows) {
      throw new Error('Lambert renderer is missing its shadow bindings.');
    }
    bindShadows(gl, program, shadows);
  }
  frameBoundPrograms.add(program);
}

function bindUnlitMesh(
  gl: WebGL2RenderingContext,
  program: WebGLUnlitProgram,
  shading: Extract<SettledWebGLMesh['shading'], { readonly kind: 'unlit' }>,
): void {
  gl.uniform4f(program.displayBaseColor, ...shading.displayBaseColor);
  gl.uniform3f(program.linearEmissive, ...shading.linearEmissive);
}

function bindLambertMesh(
  gl: WebGL2RenderingContext,
  program: WebGLLambertProgram,
  mesh: SettledWebGLMesh,
): void {
  const shading = mesh.shading;
  if (shading.kind !== 'lambert') {
    throw new Error('Lambert mesh binding received unlit shading.');
  }
  gl.uniformMatrix3fv(
    program.normalMatrix,
    false,
    shading.normalMatrix as Float32Array,
  );
  gl.uniform3f(
    program.linearBaseColor,
    shading.linearBaseColor[0],
    shading.linearBaseColor[1],
    shading.linearBaseColor[2],
  );
  gl.uniform3f(program.linearEmissive, ...shading.linearEmissive);
  gl.uniform1f(program.alpha, shading.linearBaseColor[3]);
  gl.uniform1i(program.receiveShadow, mesh.receiveShadow ? 1 : 0);
}

function drawDirectionalShadowPlan(
  gl: WebGL2RenderingContext,
  transaction: WebGLRendererResourceTransaction,
  program: WebGLShadowDepthProgram,
  plan: SettledWebGLDirectionalShadowPlan,
  resolution: number,
): void {
  installDirectionalShadowWebGLPass(gl, resolution);
  gl.useProgram(program.program);
  gl.uniformMatrix4fv(
    program.shadowProjectionView,
    false,
    plan.projectionViewMatrix as Float32Array,
  );
  gl.uniform4f(program.shadowLightPositionFar, 0, 0, 0, 0);
  for (const mesh of plan.casters) {
    const geometry = transaction.useGeometry(mesh.geometry, mesh.componentName);
    bindDepthGeometry(gl, program, geometry, mesh);
  }
}

function drawSpotShadowPlan(
  gl: WebGL2RenderingContext,
  transaction: WebGLRendererResourceTransaction,
  program: WebGLShadowDepthProgram,
  plan: SettledWebGLSpotShadowPlan,
  resolution: number,
): void {
  installDirectionalShadowWebGLPass(gl, resolution);
  gl.useProgram(program.program);
  gl.uniformMatrix4fv(
    program.shadowProjectionView,
    false,
    plan.projectionViewMatrix as Float32Array,
  );
  gl.uniform4f(program.shadowLightPositionFar, 0, 0, 0, 0);
  for (const mesh of plan.casters) {
    const geometry = transaction.useGeometry(mesh.geometry, mesh.componentName);
    bindDepthGeometry(gl, program, geometry, mesh);
  }
}

function drawPointShadowPlan(
  gl: WebGL2RenderingContext,
  transaction: WebGLRendererResourceTransaction,
  program: WebGLShadowDepthProgram,
  plan: SettledWebGLPointShadowPlan,
  face: number,
  resolution: number,
): void {
  installDirectionalShadowWebGLPass(gl, resolution);
  gl.useProgram(program.program);
  gl.uniformMatrix4fv(
    program.shadowProjectionView,
    false,
    plan.projectionViewMatrices[face] as Float32Array,
  );
  gl.uniform4f(
    program.shadowLightPositionFar,
    plan.lightPosition[0],
    plan.lightPosition[1],
    plan.lightPosition[2],
    plan.farDistance,
  );
  for (const mesh of plan.casters) {
    const geometry = transaction.useGeometry(mesh.geometry, mesh.componentName);
    bindDepthGeometry(gl, program, geometry, mesh);
  }
}

function bindDepthGeometry(
  gl: WebGL2RenderingContext,
  program: WebGLShadowDepthProgram,
  geometry: WebGLGeometryResource,
  mesh: SettledWebGLMesh,
): void {
  gl.bindVertexArray(geometry.vertexArray);
  gl.bindBuffer(gl.ARRAY_BUFFER, geometry.positionBuffer);
  gl.enableVertexAttribArray(program.positionAttribute);
  gl.vertexAttribPointer(program.positionAttribute, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geometry.indexBuffer ?? null);
  gl.uniformMatrix4fv(program.model, false, mesh.model as Float32Array);
  if (geometry.indexCount !== undefined) {
    gl.drawElements(gl.TRIANGLES, geometry.indexCount, gl.UNSIGNED_INT, 0);
  } else {
    gl.drawArrays(gl.TRIANGLES, 0, geometry.vertexCount);
  }
}

function bindLights(
  gl: WebGL2RenderingContext,
  program: WebGLLambertProgram,
  lights: PackedWebGLLights,
): void {
  gl.uniform1i(program.lightCount, lights.count);
  gl.uniform1iv(program.lightKinds, lights.kinds);
  gl.uniform4fv(program.lightColorIntensities, lights.colorIntensities);
  gl.uniform4fv(program.lightPositionRanges, lights.positionRanges);
  gl.uniform4fv(
    program.lightDirectionInnerCosines,
    lights.directionInnerCosines,
  );
  gl.uniform4fv(program.lightGroundOuterCosines, lights.groundOuterCosines);
}

function bindShadows(
  gl: WebGL2RenderingContext,
  program: WebGLLambertProgram,
  shadows: PackedWebGLShadows,
): void {
  gl.uniform1iv(program.shadowEnabled, shadows.enabled);
  gl.uniformMatrix4fv(program.shadowMatrices, false, shadows.matrices);
  gl.uniform4fv(program.shadowParameters, shadows.parameters);
  for (let index = 0; index < WEBGL_MAX_SHADOWS; index += 1) {
    gl.activeTexture(gl.TEXTURE0 + index);
    gl.bindTexture(
      gl.TEXTURE_2D,
      shadows.textures2D[index] ?? shadows.bindings.fallback2D,
    );
    gl.uniform1i(program.shadow2DSamplers[index]!, index);
    const cubeUnit = WEBGL_MAX_SHADOWS + index;
    gl.activeTexture(gl.TEXTURE0 + cubeUnit);
    gl.bindTexture(
      gl.TEXTURE_CUBE_MAP,
      shadows.texturesCube[index] ?? shadows.bindings.fallbackCube,
    );
    gl.uniform1i(program.shadowCubeSamplers[index]!, cubeUnit);
  }
}

function packWebGLShadows(
  plans: readonly SettledWebGLShadowPlan[],
  resources: ReadonlyMap<number, WebGLShadowResource>,
  bindings: WebGLShadowBindings,
): PackedWebGLShadows {
  const enabled = new Int32Array(WEBGL_MAX_SHADOWS);
  const matrices = new Float32Array(WEBGL_MAX_SHADOWS * 16);
  const parameters = new Float32Array(WEBGL_MAX_SHADOWS * 4);
  const textures2D = Array<WebGLTexture>(WEBGL_MAX_SHADOWS)
    .fill(bindings.fallback2D);
  const texturesCube = Array<WebGLTexture>(WEBGL_MAX_SHADOWS)
    .fill(bindings.fallbackCube);
  for (const plan of plans) {
    const resource = resources.get(plan.lightIndex);
    if (!resource || plan.lightIndex >= WEBGL_MAX_SHADOWS) continue;
    const parameterOffset = plan.lightIndex * 4;
    parameters[parameterOffset] = plan.bias;
    parameters[parameterOffset + 1] = 1 / resource.resolution;
    parameters[parameterOffset + 2] = plan.comparisonCount;
    if (plan.kind === 'directional' && resource.kind === 'directional') {
      enabled[plan.lightIndex] = 1;
      matrices.set(plan.projectionViewMatrix, plan.lightIndex * 16);
      textures2D[plan.lightIndex] = resource.texture;
    } else if (plan.kind === 'point' && resource.kind === 'point') {
      enabled[plan.lightIndex] = 2;
      parameters[parameterOffset + 3] = plan.farDistance;
      texturesCube[plan.lightIndex] = resource.texture;
    } else if (plan.kind === 'spot' && resource.kind === 'spot') {
      enabled[plan.lightIndex] = 3;
      matrices.set(plan.projectionViewMatrix, plan.lightIndex * 16);
      textures2D[plan.lightIndex] = resource.texture;
    }
  }
  return { enabled, matrices, parameters, textures2D, texturesCube, bindings };
}

function isLambertMesh(mesh: SettledWebGLMesh): boolean {
  return mesh.shading.kind === 'lambert';
}

function packWebGLLights(
  lights: readonly SettledWebGLLight[],
): PackedWebGLLights {
  const kinds = new Int32Array(WEBGL_MAX_LIGHTS);
  const colorIntensities = new Float32Array(WEBGL_MAX_LIGHTS * 4);
  const positionRanges = new Float32Array(WEBGL_MAX_LIGHTS * 4);
  const directionInnerCosines = new Float32Array(WEBGL_MAX_LIGHTS * 4);
  const groundOuterCosines = new Float32Array(WEBGL_MAX_LIGHTS * 4);
  for (let index = 0; index < lights.length; index += 1) {
    const light = lights[index]!;
    const offset = index * 4;
    kinds[index] = WEBGL_LIGHT_KIND[light.kind];
    switch (light.kind) {
      case 'ambient':
        writeVector4(
          colorIntensities,
          offset,
          light.linearColor,
          light.intensity,
        );
        break;
      case 'hemisphere':
        writeVector4(
          colorIntensities,
          offset,
          light.linearSkyColor,
          light.intensity,
        );
        writeVector4(directionInnerCosines, offset, light.axis, 0);
        writeVector4(groundOuterCosines, offset, light.linearGroundColor, 0);
        break;
      case 'directional':
        writeVector4(
          colorIntensities,
          offset,
          light.linearColor,
          light.intensity,
        );
        writeVector4(directionInnerCosines, offset, light.direction, 0);
        break;
      case 'point':
        writeVector4(
          colorIntensities,
          offset,
          light.linearColor,
          light.intensity,
        );
        writeVector4(positionRanges, offset, light.position, light.range ?? 0);
        break;
      case 'spot':
        writeVector4(
          colorIntensities,
          offset,
          light.linearColor,
          light.intensity,
        );
        writeVector4(positionRanges, offset, light.position, light.range ?? 0);
        writeVector4(
          directionInnerCosines,
          offset,
          light.direction,
          light.innerConeCosine,
        );
        writeVector4(
          groundOuterCosines,
          offset,
          [0, 0, 0],
          light.outerConeCosine,
        );
        break;
    }
  }
  return {
    count: lights.length,
    kinds,
    colorIntensities,
    positionRanges,
    directionInnerCosines,
    groundOuterCosines,
  };
}

function writeVector4(
  target: Float32Array,
  offset: number,
  vector: readonly [number, number, number],
  fourth: number,
): void {
  target[offset] = vector[0];
  target[offset + 1] = vector[1];
  target[offset + 2] = vector[2];
  target[offset + 3] = fourth;
}

function attemptRendererCleanup(cleanup: () => void): void {
  try {
    cleanup();
  } catch (error) {
    reportSecondaryRendererError(error);
  }
}

function reportSecondaryRendererError(error: unknown): void {
  try {
    globalThis.reportError(error);
  } catch {
    // Reporting cannot replace the first operational render failure.
  }
}
