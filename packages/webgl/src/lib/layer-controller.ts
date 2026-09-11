import {
  cancelBackendMountFrame,
  executeBackendCRC,
  haveSameLayerNodeTree,
  mountBackendCRC,
  registerNestedInteractionResolver,
  retainBackendMountRoot,
  snapshotLayerNodeTree,
  type CRCBackendMount,
  type CRCHitTestOutput,
  type LayerNodeSnapshot,
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
import {
  resolveCamera,
  type ResolvedWebGLCamera,
} from './math/camera.js';
import {
  applyWebGLFocusMetadata,
  commitWebGLPickEntries,
  type CRCWebGLPickLedger,
  type CRCWebGLPickRecord,
} from './pick-ledger.js';
import { pickScene } from './scene-picker.js';
import type {
  CRCWebGLPerspectiveCamera,
} from './types.js';
import { releaseWebGLPickParticipation } from './render-environment.js';

const WEBGL_CONTEXT_ATTRIBUTES: WebGLContextAttributes = Object.freeze({
  alpha: true,
  depth: true,
  premultipliedAlpha: true,
  preserveDrawingBuffer: false,
});

const MAX_OFFSCREEN_CANVAS_DIMENSION = 0xffff_ffff;

type WebGLLayerOperation = 'idle' | 'render' | 'composite';

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
  readonly camera: ResolvedWebGLCamera;
  readonly pickLedger: CRCWebGLPickLedger;
  readonly retainedTree: LayerNodeSnapshot;
  readonly focusRevision: number | undefined;
  readonly contextGeneration: number;
  readonly ownedResourceGeneration: number;
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
  assertBackingDimension(backingWidth, 'backing width');
  assertBackingDimension(backingHeight, 'backing height');
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
  private currentCamera: ResolvedWebGLCamera;
  private currentSurface: WebGLLayerSurface;
  private retainedCamera: ResolvedWebGLCamera;
  private retainedSurface: WebGLLayerSurface;
  private mountedRoot: CRCNode;
  private renderedTree: LayerNodeSnapshot | undefined;
  private restorationTree: LayerNodeSnapshot | undefined;
  private cacheInvalidated = false;
  private contextGenerationValue = 1;
  private pending: WebGLLayerGeneration | undefined;
  private committed: WebGLLayerGeneration | undefined;
  private operation: WebGLLayerOperation = 'idle';
  private operationEpoch = 0;
  private contextAvailable = true;
  private contextListenersAttached = false;
  private disposed = false;

  constructor(
    parent: Canvas,
    root: CRCNode,
    camera: CRCWebGLPerspectiveCamera | undefined,
    surface: WebGLLayerSurface,
  ) {
    validateSurface(surface);
    this.mountedRoot = root;
    this.currentSurface = surface;
    this.currentCamera = resolveCamera(
      camera,
      surface.logicalWidth,
      surface.logicalHeight,
    );
    this.retainedCamera = this.currentCamera;
    this.retainedSurface = surface;
    this.canvas = createOffscreenCanvas(surface);
    this.gl = acquireWebGL2Context(this.canvas);
    this.driver = createWebGLBackend({
      gl: this.gl,
      getCamera: () => this.currentCamera,
      getContextGeneration: () => this.contextGenerationValue,
      isContextLost: generation =>
        !this.contextAvailable || generation < this.contextGenerationValue,
    });
    try {
      this.mount = mountBackendCRC(this.canvas, root, {
        parent,
        logicalWidth: surface.logicalWidth,
        logicalHeight: surface.logicalHeight,
        driver: this.driver,
      });
      this.attachContextListeners();
    } catch (error) {
      runCleanup(() => this.mount.dispose());
      throw error;
    }
  }

  get surface(): WebGLLayerSurface {
    return this.currentSurface;
  }

  get committedGeneration(): number | undefined {
    return this.committed?.number;
  }

  get candidateGeneration(): number | undefined {
    return this.pending?.number;
  }

  get renderedGeneration(): number {
    return this.driver.renderedGeneration;
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
    this.renderChild(root, camera, surface, timestamp, true);
  }

  renderRetainedChild(
    root: CRCNode,
    camera: CRCWebGLPerspectiveCamera | undefined,
    surface: WebGLLayerSurface,
    timestamp: number,
  ): void {
    this.renderChild(root, camera, surface, timestamp, false);
  }

  private renderChild(
    root: CRCNode,
    camera: CRCWebGLPerspectiveCamera | undefined,
    surface: WebGLLayerSurface,
    timestamp: number,
    force: boolean,
  ): void {
    this.requireActive();
    const epoch = this.beginOperation('render');
    try {
      validateSurface(surface);
      const nextCamera = resolveCamera(
        camera,
        surface.logicalWidth,
        surface.logicalHeight,
      );
      this.mountedRoot = root;
      this.retainedCamera = nextCamera;
      this.retainedSurface = surface;
      if (!this.contextAvailable) {
        retainBackendMountRoot(this.mount, root);
        this.cacheInvalidated = true;
        return;
      }
      const hadPending = this.pending !== undefined;
      this.releasePending();

      const failedFrameTimestamp = this.driver.takeFailedFrameTimestamp();
      if (failedFrameTimestamp !== undefined) {
        const committed = this.committed;
        const canDeferFailedRetry = failedFrameTimestamp === timestamp &&
          !hadPending &&
          committed !== undefined &&
          haveSameLayerNodeTree(committed.retainedTree, root) &&
          haveSameCamera(committed.camera, nextCamera) &&
          haveSameSurface(committed.surface, surface) &&
          committed.focusRevision === currentFocusRevision(
            committed.pickLedger,
          ) &&
          committed.contextGeneration === this.contextGenerationValue &&
          committed.ownedResourceGeneration ===
            this.driver.ownedResourceGeneration;
        this.cacheInvalidated = true;
        this.renderedTree = undefined;
        this.restorationTree = undefined;
        if (canDeferFailedRetry) return;
      }

      if (this.driver.hasCompletedFrame()) {
        const completedFrame = this.driver.takeCompletedFrame();
        if (
          haveSameLayerNodeTree(
            this.restorationTree ?? this.renderedTree,
            root,
          ) &&
          haveSameCamera(this.currentCamera, nextCamera) &&
          haveSameSurface(this.currentSurface, surface) &&
          completedFrame.contextGeneration === this.contextGenerationValue &&
          completedFrame.ownedResourceGeneration ===
            this.driver.ownedResourceGeneration
        ) {
          this.publishCompletedFrame(root, surface, completedFrame, epoch);
          return;
        }
        this.restorationTree = undefined;
      }

      const committed = this.committed;
      const focusRevision = currentFocusRevision(committed?.pickLedger);
      const shouldRender = force || hadPending || committed === undefined ||
        this.cacheInvalidated ||
        !haveSameLayerNodeTree(committed.retainedTree, root) ||
        !haveSameCamera(committed.camera, nextCamera) ||
        !haveSameSurface(committed.surface, surface) ||
        committed.focusRevision !== focusRevision ||
        committed.contextGeneration !== this.contextGenerationValue ||
        committed.ownedResourceGeneration !==
          this.driver.ownedResourceGeneration;
      if (!shouldRender) return;

      if (!haveSameSurface(this.currentSurface, surface)) {
        this.resizeSurface(surface);
      }
      this.currentCamera = nextCamera;
      this.restorationTree = undefined;
      executeBackendCRC(this.mount, root, timestamp);
      this.requireCurrentOperation('render', epoch);
      this.publishCompletedFrame(
        root,
        surface,
        this.driver.takeCompletedFrame(),
        epoch,
      );
    } finally {
      this.finishOperation('render', epoch);
    }
  }

  composite(
    context: RenderingContext2D,
    destination: WebGLLayerDestination,
  ): void {
    this.requireActive();
    if (!this.contextAvailable) return;
    const epoch = this.beginOperation('composite');
    const candidate = this.pending;
    const visible = candidate ?? this.committed;
    try {
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
        if (candidate && this.pending === candidate) {
          this.pending = undefined;
          candidate.bitmap.close();
        }
        throw error;
      }
      this.requireCurrentOperation('composite', epoch);
      if (!candidate) {
        if (this.committed !== visible) {
          throw webGLLayerError(
            'composite operation lost ownership of its committed generation',
          );
        }
        this.replayCommittedFocusMetadata();
        return;
      }
      if (this.pending !== candidate) {
        throw webGLLayerError(
          'composite operation lost ownership of its pending generation',
        );
      }
      const previous = this.committed;
      this.pending = undefined;
      this.committed = candidate;
      applyWebGLFocusMetadata(candidate.pickLedger);
      previous?.bitmap.close();
    } finally {
      this.finishOperation('composite', epoch);
    }
  }

  /** Re-enrolls the committed targets without rebuilding WebGL frame data. */
  replayCommittedFocusMetadata(): void {
    const committed = this.committed;
    if (!committed) return;
    const target = applyWebGLFocusMetadata(committed.pickLedger);
    target?.owner.eventRoot.focusPolicy?.replayRetainedSubtree(
      target.owner,
    );
  }

  resolveLocal(
    localX: number,
    localY: number,
    output: CRCHitTestOutput,
  ): void {
    const committed = this.committed;
    if (!committed) {
      output.disposition = 0;
      output.target = null;
      return;
    }
    pickScene(
      committed.pickLedger,
      committed.camera,
      localX,
      localY,
      output,
    );
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
    this.operationEpoch += 1;
    this.operation = 'idle';
    const mount = this.mount;
    const pending = this.pending;
    const committed = this.committed;
    this.pending = undefined;
    this.committed = undefined;
    this.detachContextListeners();
    runCleanup(() => mount.dispose());
    this.contextAvailable = false;
    runCleanup(() => pending?.bitmap.close());
    if (committed?.bitmap !== pending?.bitmap) {
      runCleanup(() => committed?.bitmap.close());
    }
  }

  private readonly handleContextLoss = (event: Event): void => {
    if (event.cancelable) event.preventDefault();
    if (this.disposed || !this.contextAvailable) return;
    const lostGeneration = this.contextGenerationValue;
    this.contextAvailable = false;
    this.contextGenerationValue += 1;
    this.operationEpoch += 1;
    this.operation = 'idle';
    const pending = this.pending;
    const committed = this.committed;
    this.pending = undefined;
    this.committed = undefined;
    this.renderedTree = undefined;
    this.restorationTree = undefined;
    this.cacheInvalidated = true;
    cancelBackendMountFrame(this.mount);
    suspendGenerationParticipation(pending, committed);
    this.driver.invalidateContext(lostGeneration);
    runCleanup(() => pending?.bitmap.close());
    if (committed?.bitmap !== pending?.bitmap) {
      runCleanup(() => committed?.bitmap.close());
    }
  };

  private readonly handleContextRestoration = (): void => {
    if (this.disposed || this.contextAvailable) return;
    if (!haveSameSurface(this.currentSurface, this.retainedSurface)) {
      try {
        this.resizeSurface(this.retainedSurface);
      } catch (error) {
        runCleanup(() => { throw error; });
        return;
      }
    }
    this.currentCamera = this.retainedCamera;
    retainBackendMountRoot(this.mount, this.mountedRoot);
    this.restorationTree = snapshotLayerNodeTree(this.mountedRoot);
    this.driver.restoreContext();
    this.contextAvailable = true;
    this.cacheInvalidated = true;
    runCleanup(() => this.mount.requestFrame(true));
  };

  private attachContextListeners(): void {
    if (typeof this.canvas.addEventListener !== 'function') return;
    this.canvas.addEventListener('webglcontextlost', this.handleContextLoss);
    try {
      this.canvas.addEventListener(
        'webglcontextrestored',
        this.handleContextRestoration,
      );
      this.contextListenersAttached = true;
    } catch (error) {
      runCleanup(() => this.canvas.removeEventListener(
        'webglcontextlost',
        this.handleContextLoss,
      ));
      throw error;
    }
  }

  private detachContextListeners(): void {
    if (!this.contextListenersAttached) return;
    this.contextListenersAttached = false;
    if (typeof this.canvas.removeEventListener !== 'function') return;
    runCleanup(() => this.canvas.removeEventListener(
      'webglcontextlost',
      this.handleContextLoss,
    ));
    runCleanup(() => this.canvas.removeEventListener(
      'webglcontextrestored',
      this.handleContextRestoration,
    ));
  }

  private resizeSurface(surface: WebGLLayerSurface): void {
    const previous = this.currentSurface;
    try {
      setCanvasDimensions(this.canvas, surface, 'resize');
      this.mount.resize(surface.logicalWidth, surface.logicalHeight);
    } catch (error) {
      try {
        setCanvasDimensions(this.canvas, previous, 'resize rollback');
      } catch (rollbackError) {
        this.dispose();
        throw webGLLayerError(
          'could not restore its OffscreenCanvas after a failed resize',
          rollbackError,
        );
      }
      throw error;
    }
    this.currentSurface = surface;
  }

  private publishCompletedFrame(
    root: CRCNode,
    surface: WebGLLayerSurface,
    completedFrame: WebGLCompletedFrame,
    epoch: number,
  ): void {
    let bitmap: ImageBitmap | undefined;
    try {
      try {
        bitmap = this.canvas.transferToImageBitmap();
      } catch (error) {
        throw webGLLayerError(
          'could not transfer its rendered ImageBitmap',
          error,
        );
      }
      this.requireCurrentOperation('render', epoch);
      const pickLedger = commitWebGLPickEntries(
        surface.logicalWidth,
        surface.logicalHeight,
        completedFrame.pickEntries as readonly CRCWebGLPickRecord[],
      );
      const retainedTree = snapshotLayerNodeTree(root);
      const candidate = Object.freeze({
        number: completedFrame.renderedGeneration,
        bitmap,
        surface,
        camera: this.currentCamera,
        pickLedger,
        retainedTree,
        focusRevision: currentFocusRevision(pickLedger),
        contextGeneration: completedFrame.contextGeneration,
        ownedResourceGeneration: completedFrame.ownedResourceGeneration,
      });
      this.requireCurrentOperation('render', epoch);
      this.renderedTree = retainedTree;
      this.restorationTree = undefined;
      this.cacheInvalidated = false;
      this.pending = candidate;
      bitmap = undefined;
    } finally {
      if (completedFrame.contextGeneration !== this.contextGenerationValue) {
        releaseWebGLPickParticipation(
          completedFrame.pickEntries as readonly CRCWebGLPickRecord[],
        );
      }
      bitmap?.close();
    }
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

  private beginOperation(operation: Exclude<WebGLLayerOperation, 'idle'>): number {
    this.requireActive();
    if (this.operation !== 'idle') {
      throw webGLLayerError(
        `rejected a reentrant ${operation} operation while ` +
        `${this.operation} is active`,
      );
    }
    this.operation = operation;
    this.operationEpoch += 1;
    return this.operationEpoch;
  }

  private requireCurrentOperation(
    operation: Exclude<WebGLLayerOperation, 'idle'>,
    epoch: number,
  ): void {
    this.requireActive();
    if (this.operation !== operation || this.operationEpoch !== epoch) {
      throw webGLLayerError(`${operation} operation lost ownership`);
    }
  }

  private finishOperation(
    operation: Exclude<WebGLLayerOperation, 'idle'>,
    epoch: number,
  ): void {
    if (this.operation === operation && this.operationEpoch === epoch) {
      this.operation = 'idle';
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
  assertCanvasDimensions(canvas, surface, 'allocation');
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
  assertBackingDimension(surface.backingWidth, 'backing width');
  assertBackingDimension(surface.backingHeight, 'backing height');
  assertPositiveFinite(surface.densityX, 'density.x');
  assertPositiveFinite(surface.densityY, 'density.y');
}

function assertBackingDimension(value: number, field: string): void {
  if (
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > MAX_OFFSCREEN_CANVAS_DIMENSION
  ) {
    throw new RangeError(
      `WebGLLayer ${field} must be a positive representable integer.`,
    );
  }
}

function setCanvasDimensions(
  canvas: OffscreenCanvas,
  surface: WebGLLayerSurface,
  phase: string,
): void {
  try {
    canvas.width = surface.backingWidth;
    canvas.height = surface.backingHeight;
  } catch (error) {
    throw webGLLayerError(
      `could not apply its OffscreenCanvas ${phase} dimensions`,
      error,
    );
  }
  assertCanvasDimensions(canvas, surface, phase);
}

function assertCanvasDimensions(
  canvas: OffscreenCanvas,
  surface: WebGLLayerSurface,
  phase: string,
): void {
  if (
    canvas.width !== surface.backingWidth ||
    canvas.height !== surface.backingHeight
  ) {
    throw webGLLayerError(
      `OffscreenCanvas ${phase} dimensions did not match the requested ` +
      `${surface.backingWidth}x${surface.backingHeight} backing size`,
    );
  }
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
    previous.backingHeight === next.backingHeight &&
    previous.densityX === next.densityX &&
    previous.densityY === next.densityY;
}

function haveSameCamera(
  previous: ResolvedWebGLCamera,
  next: ResolvedWebGLCamera,
): boolean {
  return previous.generationValues.length === next.generationValues.length &&
    previous.generationValues.every(
      (value, index) => Object.is(value, next.generationValues[index]),
    );
}

function currentFocusRevision(
  ledger: CRCWebGLPickLedger | undefined,
): number | undefined {
  const owner = ledger?.entries[0]?.target.owner;
  return owner?.eventRoot.focusPolicy?.layerFocusRenderRevision?.(owner);
}

function suspendGenerationParticipation(
  ...generations: Array<WebGLLayerGeneration | undefined>
): void {
  const entries: CRCWebGLPickRecord[] = [];
  for (const generation of generations) {
    entries.push(...generation?.pickLedger.entries ?? []);
  }
  releaseWebGLPickParticipation(entries);
}

function runCleanup(cleanup: () => void): void {
  try {
    cleanup();
  } catch (error) {
    try {
      globalThis.reportError(error);
    } catch {
      // Reporting cannot suppress release of later layer-owned resources.
    }
  }
}

function webGLLayerError(reason: string, cause?: unknown): Error {
  const error = new Error(`WebGLLayer ${reason}.`);
  if (cause !== undefined) error.cause = cause;
  return error;
}
