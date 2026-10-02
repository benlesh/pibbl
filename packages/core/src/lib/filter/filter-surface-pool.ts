import { GLOBAL_STATE } from '../global-state.js';
import type { RenderTargetSnapshot } from '../render-target.js';
import { layoutDiagnostic } from '../style/diagnostics.js';
import { resetNativeCanvasFilter } from '../../filters/native-canvas-filter.js';
import type { FilterPixelWindow, FilterWindows } from './filter-region.js';

const MAX_UNSIGNED_LONG = 0xffff_ffff;

export interface FilterSurface {
  readonly canvas: OffscreenCanvas;
  readonly context: OffscreenCanvasRenderingContext2D;
  readonly target: RenderTargetSnapshot;
}

export interface FilterSurfacePairLease {
  readonly source: FilterSurface;
  readonly result: FilterSurface;
  release(): void;
}

export interface FilterSurfacePoolSnapshot {
  readonly surfaceSlots: number;
  readonly createdSurfaceSlots: number;
  readonly activePairs: number;
  readonly peakActivePairs: number;
  readonly pairCheckouts: number;
  readonly pairReturns: number;
  readonly resized: number;
  readonly releasedSurfaceSlots: number;
}

interface FilterSurfaceSlot extends FilterSurface {
  target: RenderTargetSnapshot;
}

export class FilterSurfacePool {
  private slots: Array<FilterSurfaceSlot | undefined> = [];
  private activePairs = 0;
  private peakActivePairs = 0;
  private pairCheckouts = 0;
  private pairReturns = 0;
  private createdSurfaceSlots = 0;
  private resized = 0;
  private releasedSurfaceSlots = 0;
  private surfaceSlots = 0;
  private disposed = false;

  checkoutPair(windows: FilterWindows): FilterSurfacePairLease {
    if (this.disposed) {
      throw new Error('Cannot check out filter surfaces from a disposed pool.');
    }
    validateWindow(windows.source, 'source');
    validateWindow(windows.output, 'result');

    const depth = this.activePairs;
    const sourceIndex = 2 * depth;
    const resultIndex = sourceIndex + 1;
    const sourceSlot = this.slots[sourceIndex];
    const resultSlot = this.slots[resultIndex];
    this.activePairs = depth + 1;

    let source: FilterSurfaceSlot;
    let result: FilterSurfaceSlot;
    try {
      source = this.setupSlot(sourceIndex, sourceSlot, windows.source, 'source');
      result = this.setupSlot(resultIndex, resultSlot, windows.output, 'result');
    } catch (error) {
      this.activePairs = depth;
      throw error;
    }

    this.pairCheckouts += 1;
    this.peakActivePairs = Math.max(this.peakActivePairs, this.activePairs);
    let released = false;
    return {
      source,
      result,
      release: () => {
        if (released) return;
        if (this.disposed) {
          released = true;
          return;
        }
        if (this.activePairs !== depth + 1) {
          throw new Error(
            'Filter surface pairs must be released in strict LIFO order.',
          );
        }
        released = true;
        this.activePairs = depth;
        this.pairReturns += 1;
        scrubIdleSurface(source);
        scrubIdleSurface(result);
      },
    };
  }

  snapshot(): FilterSurfacePoolSnapshot {
    return {
      surfaceSlots: this.surfaceSlots,
      createdSurfaceSlots: this.createdSurfaceSlots,
      activePairs: this.activePairs,
      peakActivePairs: this.peakActivePairs,
      pairCheckouts: this.pairCheckouts,
      pairReturns: this.pairReturns,
      resized: this.resized,
      releasedSurfaceSlots: this.releasedSurfaceSlots,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.pairReturns += this.activePairs;
    this.activePairs = 0;
    this.releasedSurfaceSlots += this.surfaceSlots;
    this.surfaceSlots = 0;
    this.slots = [];
  }

  private setupSlot(
    index: number,
    existing: FilterSurfaceSlot | undefined,
    window: FilterPixelWindow,
    role: 'source' | 'result',
  ): FilterSurfaceSlot {
    if (!existing) {
      const created = createSlot(window, role);
      this.slots[index] = created;
      this.createdSurfaceSlots += 1;
      this.surfaceSlots += 1;
      return created;
    }

    const { canvas, context } = existing;
    const dimensionsChanged =
      canvas.width !== window.backingWidth ||
      canvas.height !== window.backingHeight;
    if (dimensionsChanged) {
      try {
        if (canvas.width !== window.backingWidth) {
          canvas.width = window.backingWidth;
        }
        if (canvas.height !== window.backingHeight) {
          canvas.height = window.backingHeight;
        }
      } catch (error) {
        throw surfaceError(role, window, 'could not resize its OffscreenCanvas', error);
      }
      installDefaults(context);
      context.save();
      this.resized += 1;
    } else {
      context.restore();
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.beginPath();
      installDefaultState(context);
    }
    existing.target = targetFor(window);
    return existing;
  }
}

function createSlot(
  window: FilterPixelWindow,
  role: 'source' | 'result',
): FilterSurfaceSlot {
  if (typeof OffscreenCanvas === 'undefined') {
    throw surfaceError(role, window, 'requires browser OffscreenCanvas support');
  }

  let canvas: OffscreenCanvas;
  try {
    canvas = new OffscreenCanvas(window.backingWidth, window.backingHeight);
  } catch (error) {
    throw surfaceError(role, window, 'could not allocate its OffscreenCanvas', error);
  }
  let context: OffscreenCanvasRenderingContext2D | null;
  try {
    context = canvas.getContext('2d');
  } catch (error) {
    throw surfaceError(
      role,
      window,
      'could not acquire its OffscreenCanvas 2D context',
      error,
    );
  }
  if (!context) {
    throw surfaceError(role, window, 'could not acquire its OffscreenCanvas 2D context');
  }
  installDefaults(context);
  context.save();
  return { canvas, context, target: targetFor(window) };
}

function installDefaults(context: OffscreenCanvasRenderingContext2D): void {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.beginPath();
  installDefaultState(context);
}

function installDefaultState(
  context: OffscreenCanvasRenderingContext2D,
): void {
  context.direction = 'inherit';
  context.fillStyle = '#000000';
  resetIfSupported(context);
  context.font = '10px sans-serif';
  setIfPresent(context, 'fontKerning', 'auto');
  setIfPresent(context, 'fontStretch', 'normal');
  setIfPresent(context, 'fontVariantCaps', 'normal');
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'low';
  setIfPresent(context, 'letterSpacing', '0px');
  context.lineCap = 'butt';
  context.setLineDash([]);
  context.lineDashOffset = 0;
  context.lineJoin = 'miter';
  context.lineWidth = 1;
  context.miterLimit = 10;
  context.shadowBlur = 0;
  context.shadowColor = 'rgba(0, 0, 0, 0)';
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.strokeStyle = '#000000';
  context.textAlign = 'start';
  context.textBaseline = 'alphabetic';
  setIfPresent(context, 'textRendering', 'auto');
  setIfPresent(context, 'wordSpacing', '0px');
}

function scrubIdleSurface(surface: FilterSurface): void {
  const { context } = surface;
  try {
    context.fillStyle = '#000000';
  } catch {
    // A poisoned user-visible property must not mask an active render error.
  }
  try {
    context.strokeStyle = '#000000';
  } catch {
    // CanvasGradient and CanvasPattern are the other reference-bearing state.
  }
  resetIfSupported(context);
}

function resetIfSupported(context: OffscreenCanvasRenderingContext2D): void {
  try {
    resetNativeCanvasFilter(context, 'filter surface');
  } catch {
    // Pool reset/release must not mask the boundary's component-aware error.
  }
}

function setIfPresent(
  context: OffscreenCanvasRenderingContext2D,
  property: string,
  value: string,
): void {
  if (property in context) {
    (context as unknown as Record<string, unknown>)[property] = value;
  }
}

function targetFor(window: FilterPixelWindow): RenderTargetSnapshot {
  return {
    logicalBounds: window.logicalBounds,
    backingWidth: window.backingWidth,
    backingHeight: window.backingHeight,
    renderTransform: window.renderTransform,
    inverseRenderTransform: window.inverseRenderTransform,
  };
}

function validateWindow(
  window: FilterPixelWindow,
  role: 'source' | 'result',
): void {
  const { backingWidth: width, backingHeight: height } = window;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > MAX_UNSIGNED_LONG ||
    height > MAX_UNSIGNED_LONG
  ) {
    throw surfaceError(
      role,
      window,
      `backing dimensions must be positive unsigned-long integers no greater than ${MAX_UNSIGNED_LONG}`,
    );
  }
  if (!Number.isSafeInteger(width * height)) {
    throw surfaceError(
      role,
      window,
      'backing area must remain a finite safe integer',
    );
  }
}

function surfaceError(
  role: 'source' | 'result',
  window: FilterPixelWindow,
  reason: string,
  cause?: unknown,
): Error {
  const type = GLOBAL_STATE.componentRefs?.element.type;
  const component = typeof type === 'function' && type.name ?
    type.name : 'filter boundary';
  const diagnostic = layoutDiagnostic({
    component,
    property: `filter.${role}Surface`,
    value: {
      logicalBounds: window.logicalBounds,
      backingWidth: window.backingWidth,
      backingHeight: window.backingHeight,
    },
    algorithm: 'filter-capture',
    reason,
  });
  if (cause !== undefined) {
    diagnostic.cause = cause;
  }
  return diagnostic;
}
