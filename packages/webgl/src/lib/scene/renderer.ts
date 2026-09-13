import {
  WebGLRendererResourceCache,
  type WebGLRendererResourceTransaction,
} from '../gpu/renderer-resources.js';
import {
  beginWebGLFrame,
  createWebGLStateBaseline,
  installOpaqueWebGLPass,
  installTransparentWebGLPass,
  installWebGLStateBaseline,
  type WebGLStateBaseline,
} from '../gpu/state.js';
import type { SettledWebGLMesh, SettledWebGLScene } from './settle.js';

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
    const transaction = this.resources.beginRender();
    try {
      beginWebGLFrame(
        this.gl,
        scene.backingViewport.width,
        scene.backingViewport.height,
        baseline,
      );
      installOpaqueWebGLPass(this.gl);
      for (const mesh of scene.opaque) {
        drawMesh(this.gl, transaction, scene, mesh);
      }
      installTransparentWebGLPass(this.gl);
      for (const mesh of scene.transparent) {
        drawMesh(this.gl, transaction, scene, mesh);
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
      attemptRendererCleanup(() => transaction.rollback(contextLost));
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
): void {
  const program = transaction.useProgram(mesh.componentName);
  const geometry = transaction.useGeometry(mesh.geometry, mesh.componentName);
  gl.useProgram(program.program);
  gl.bindVertexArray(geometry.vertexArray);
  gl.bindBuffer(gl.ARRAY_BUFFER, geometry.positionBuffer);
  gl.enableVertexAttribArray(program.positionAttribute);
  gl.vertexAttribPointer(program.positionAttribute, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geometry.indexBuffer ?? null);
  gl.uniformMatrix4fv(program.model, false, mesh.model as Float32Array);
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
  gl.uniform4f(program.color, ...mesh.color);
  if (geometry.indexCount !== undefined) {
    gl.drawElements(gl.TRIANGLES, geometry.indexCount, gl.UNSIGNED_INT, 0);
  } else {
    gl.drawArrays(gl.TRIANGLES, 0, geometry.vertexCount);
  }
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
