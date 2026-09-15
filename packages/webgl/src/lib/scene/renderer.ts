import {
  WebGLRendererResourceCache,
  type WebGLRendererResourceTransaction,
} from '../gpu/renderer-resources.js';
import {
  WEBGL_LIGHT_KIND,
  WEBGL_MAX_LIGHTS,
} from '../gpu/program-sources.js';
import type {
  WebGLBuiltInProgram,
  WebGLLambertProgram,
  WebGLUnlitProgram,
} from '../gpu/program.js';
import {
  createWebGLStateBaseline,
  installOpaqueWebGLPass,
  installTransparentWebGLPass,
  installWebGLStateBaseline,
  type WebGLStateBaseline,
} from '../gpu/state.js';
import type { SettledWebGLMesh, SettledWebGLScene } from './settle.js';
import type { SettledWebGLLight } from './types.js';

interface PackedWebGLLights {
  readonly count: number;
  readonly kinds: Int32Array;
  readonly colorIntensities: Float32Array;
  readonly positionRanges: Float32Array;
  readonly directionInnerCosines: Float32Array;
  readonly groundOuterCosines: Float32Array;
}

/** Executes immutable settled render queues for one WebGL context generation. */
export class WebGLSceneRenderer {
  private readonly resources: WebGLRendererResourceCache;
  private baseline: WebGLStateBaseline | undefined;
  private invalidated = false;
  private disposed = false;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    readonly contextGeneration: number,
  ) {
    this.resources = new WebGLRendererResourceCache(gl, contextGeneration);
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
    try {
      installWebGLStateBaseline(
        this.gl,
        scene.backingViewport.width,
        scene.backingViewport.height,
        baseline,
      );
      const background = scene.background?.color;
      this.gl.clearColor(
        background?.[0] ?? 0,
        background?.[1] ?? 0,
        background?.[2] ?? 0,
        background?.[3] ?? 0,
      );
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
      transaction = this.resources.beginRender();
      const frameBoundPrograms = new Set<WebGLBuiltInProgram>();
      installOpaqueWebGLPass(this.gl);
      for (const mesh of scene.opaque) {
        drawMesh(
          this.gl,
          transaction,
          scene,
          mesh,
          lights,
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
    } catch (error) {
      const contextLost = this.contextIsLost();
      if (transaction) {
        attemptRendererCleanup(() => transaction.rollback(contextLost));
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
    this.baseline = undefined;
  }

  dispose(contextLost: boolean): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resources.dispose(contextLost);
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
  frameBoundPrograms: Set<WebGLBuiltInProgram>,
): void {
  const program = transaction.useProgram(
    mesh.shading.kind,
    mesh.componentName,
  );
  const geometry = transaction.useGeometry(mesh.geometry, mesh.componentName);
  gl.useProgram(program.program);
  bindFrameProgram(
    gl,
    program,
    scene,
    lights,
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
    bindLambertMesh(gl, program, mesh.shading);
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
  program: WebGLBuiltInProgram,
  scene: SettledWebGLScene,
  lights: PackedWebGLLights,
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
  if (program.key === 'lambert') bindLights(gl, program, lights);
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
  shading: Extract<SettledWebGLMesh['shading'], { readonly kind: 'lambert' }>,
): void {
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
