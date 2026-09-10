import {
  executeBackendCRC,
  mountBackendCRC,
  registerNestedInteractionResolver,
  type CRCBackendMount,
  type CRCHitTestOutput,
} from '@crc/core/internal';
import type {
  Canvas,
  CRCNode,
  RenderingContext2D,
} from '@crc/core';
import {
  createWebGLBackend,
  type WebGLBackendDriver,
  type WebGLCompletedFrame,
} from './backend.js';
import { resolveCamera } from './math/camera.js';
import type {
  CRCWebGLCameraSnapshot,
  CRCWebGLPerspectiveCamera,
} from './types.js';

const WEBGL_CONTEXT_ATTRIBUTES: WebGLContextAttributes = Object.freeze({
  alpha: true,
  depth: true,
  premultipliedAlpha: true,
  preserveDrawingBuffer: false,
});

export interface WebGLLayerSurface {
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly backingWidth: number;
  readonly backingHeight: number;
  readonly densityX: number;
  readonly densityY: number;
}

export interface WebGLLayerDestination {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface WebGLLayerGeneration {
  readonly number: number;
  readonly bitmap: ImageBitmap;
  readonly surface: WebGLLayerSurface;
  readonly ledger: WebGLCompletedFrame;
}

/** Resolves one upright WebGL surface using core's managed-layer rounding. */
export function resolveWebGLLayerSurface(
  logicalWidth: number,
  logicalHeight: number,
  density: Readonly<{ x: number; y: number }>,
): WebGLLayerSurface {
  assertPositiveFinite(logicalWidth, 'width');
  assertPositiveFinite(logicalHeight, 'height');
  assertPositiveFinite(density.x, 'density.x');
  assertPositiveFinite(density.y, 'density.y');
  const backingWidth = Math.max(1, Math.round(logicalWidth * density.x));
  const backingHeight = Math.max(1, Math.round(logicalHeight * density.y));
  assertPositiveFinite(backingWidth, 'backing width');
  assertPositiveFinite(backingHeight, 'backing height');
  return Object.freeze({
    logicalWidth,
    logicalHeight,
    backingWidth,
    backingHeight,
    densityX: backingWidth / logicalWidth,
    densityY: backingHeight / logicalHeight,
  });
}

/** Owns one WebGL island's surface, private mount, and bitmap transaction. */
export class WebGLLayerController {
  readonly canvas: OffscreenCanvas;
  readonly gl: WebGL2RenderingContext;

  private readonly driver: WebGLBackendDriver;
  private readonly mount: CRCBackendMount;
  private currentCamera: CRCWebGLCameraSnapshot;
  private currentSurface: WebGLLayerSurface;
  private contextGenerationValue = 1;
  private pending: WebGLLayerGeneration | undefined;
  private committed: WebGLLayerGeneration | undefined;
  private disposed = false;

  constructor(
    parent: Canvas,
    root: CRCNode,
    camera: CRCWebGLPerspectiveCamera | undefined,
    surface: WebGLLayerSurface,
  ) {
    validateSurface(surface);
    this.currentSurface = surface;
    this.currentCamera = resolveCamera(
      camera,
      surface.logicalWidth,
      surface.logicalHeight,
    );
    this.canvas = createOffscreenCanvas(surface);
    this.gl = acquireWebGL2Context(this.canvas);
    this.driver = createWebGLBackend({
      gl: this.gl,
      getCamera: () => this.currentCamera,
      getContextGeneration: () => this.contextGenerationValue,
    });
    this.mount = mountBackendCRC(this.canvas, root, {
      parent,
      logicalWidth: surface.logicalWidth,
      logicalHeight: surface.logicalHeight,
      driver: this.driver,
    });
  }

  get surface(): WebGLLayerSurface {
    return this.currentSurface;
  }

  get committedGeneration(): number | undefined {
    return this.committed?.number;
  }

  get contextGeneration(): number {
    return this.contextGenerationValue;
  }

  renderUpdatedChild(
    root: CRCNode,
    camera: CRCWebGLPerspectiveCamera | undefined,
    surface: WebGLLayerSurface,
    timestamp: number,
  ): void {
    this.requireActive();
    validateSurface(surface);
    const nextCamera = resolveCamera(
      camera,
      surface.logicalWidth,
      surface.logicalHeight,
    );
    this.releasePending();
    if (!haveSameSurface(this.currentSurface, surface)) {
      this.resizeSurface(surface);
    }
    this.currentCamera = nextCamera;
    executeBackendCRC(this.mount, root, timestamp);
    const ledger = this.driver.takeCompletedFrame();
    let bitmap: ImageBitmap;
    try {
      bitmap = this.canvas.transferToImageBitmap();
    } catch (error) {
      throw webGLLayerError('could not transfer its rendered ImageBitmap', error);
    }
    this.pending = Object.freeze({
      number: (this.committed?.number ?? 0) + 1,
      bitmap,
      surface,
      ledger,
    });
  }

  composite(
    context: RenderingContext2D,
    destination: WebGLLayerDestination,
  ): void {
    this.requireActive();
    const candidate = this.pending;
    const visible = candidate ?? this.committed;
    if (!visible) {
      throw new Error('WebGLLayer has no completed bitmap to composite.');
    }
    try {
      context.drawImage(
        visible.bitmap,
        0,
        0,
        visible.surface.backingWidth,
        visible.surface.backingHeight,
        destination.x,
        destination.y,
        destination.width,
        destination.height,
      );
    } catch (error) {
      if (candidate) {
        this.pending = undefined;
        candidate.bitmap.close();
      }
      throw error;
    }
    if (!candidate) return;
    const previous = this.committed;
    this.pending = undefined;
    this.committed = candidate;
    previous?.bitmap.close();
  }

  resolveLocal(
    _localX: number,
    _localY: number,
    output: CRCHitTestOutput,
  ): void {
    // Task 9 replaces this empty committed-ledger resolver with scene picking.
    output.disposition = 0;
    output.target = null;
  }

  registerInteraction(
    width: number,
    height: number,
    pointerEvents: 'auto' | 'none',
  ): void {
    const bounds = new Path2D();
    bounds.rect(0, 0, width, height);
    registerNestedInteractionResolver({
      child: this.mount,
      bounds,
      pointerEvents,
      resolveLocal: (localX, localY, output) => {
        this.resolveLocal(localX, localY, output);
      },
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const mount = this.mount;
    const pending = this.pending;
    const committed = this.committed;
    this.pending = undefined;
    this.committed = undefined;
    try {
      mount.dispose();
    } finally {
      try {
        pending?.bitmap.close();
      } finally {
        if (committed?.bitmap !== pending?.bitmap) committed?.bitmap.close();
      }
    }
  }

  private resizeSurface(surface: WebGLLayerSurface): void {
    this.canvas.width = surface.backingWidth;
    this.canvas.height = surface.backingHeight;
    this.currentSurface = surface;
    this.mount.resize(surface.logicalWidth, surface.logicalHeight);
  }

  private releasePending(): void {
    const pending = this.pending;
    this.pending = undefined;
    pending?.bitmap.close();
  }

  private requireActive(): void {
    if (this.disposed) {
      throw new Error('WebGLLayer controller is disposed.');
    }
  }
}

function createOffscreenCanvas(surface: WebGLLayerSurface): OffscreenCanvas {
  if (typeof OffscreenCanvas === 'undefined') {
    throw webGLLayerError('requires browser OffscreenCanvas support');
  }
  let canvas: OffscreenCanvas;
  try {
    canvas = new OffscreenCanvas(surface.backingWidth, surface.backingHeight);
  } catch (error) {
    throw webGLLayerError('could not allocate its OffscreenCanvas', error);
  }
  if (typeof canvas.transferToImageBitmap !== 'function') {
    throw webGLLayerError('requires OffscreenCanvas.transferToImageBitmap()');
  }
  return canvas;
}

function acquireWebGL2Context(canvas: OffscreenCanvas): WebGL2RenderingContext {
  let context: WebGL2RenderingContext | null;
  try {
    context = canvas.getContext('webgl2', WEBGL_CONTEXT_ATTRIBUTES);
  } catch (error) {
    throw webGLLayerError('could not acquire its WebGL2 context', error);
  }
  if (!context) {
    throw webGLLayerError('requires browser WebGL2 OffscreenCanvas support');
  }
  const gl = context as WebGL2RenderingContext;
  let actual: WebGLContextAttributes | null;
  try {
    actual = gl.getContextAttributes();
  } catch (error) {
    throw webGLLayerError('could not inspect its WebGL2 context attributes', error);
  }
  if (actual?.alpha !== true) {
    throw webGLLayerError('requires a WebGL2 context with alpha enabled');
  }
  if (actual.depth !== true) {
    throw webGLLayerError('requires a WebGL2 context with depth enabled');
  }
  return gl;
}

function validateSurface(surface: WebGLLayerSurface): void {
  assertPositiveFinite(surface.logicalWidth, 'width');
  assertPositiveFinite(surface.logicalHeight, 'height');
  assertPositiveFinite(surface.backingWidth, 'backing width');
  assertPositiveFinite(surface.backingHeight, 'backing height');
  assertPositiveFinite(surface.densityX, 'density.x');
  assertPositiveFinite(surface.densityY, 'density.y');
}

function assertPositiveFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`WebGLLayer ${field} must be finite and positive.`);
  }
}

function haveSameSurface(
  previous: WebGLLayerSurface,
  next: WebGLLayerSurface,
): boolean {
  return previous.logicalWidth === next.logicalWidth &&
    previous.logicalHeight === next.logicalHeight &&
    previous.backingWidth === next.backingWidth &&
    previous.backingHeight === next.backingHeight;
}

function webGLLayerError(reason: string, cause?: unknown): Error {
  const error = new Error(`WebGLLayer ${reason}.`);
  if (cause !== undefined) error.cause = cause;
  return error;
}
