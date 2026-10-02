import { GLOBAL_STATE } from '../global-state.js';
import {
  getCurrentPaintTransform,
  getCurrentWorldTransform,
  type RenderTargetSnapshot,
  withRenderTarget,
} from '../render-target.js';
import { getOptionalService } from '../optional-services.js';
import type { NativePreparedFilter } from '../../filters/native-operations.js';
import { compileNativeFilters } from '../../filters/native-operations.js';
import { assertNativeCanvasFilter, resetNativeCanvasFilter } from '../../filters/native-canvas-filter.js';
import { copyFilterSourceState } from './canvas-state.js';
import { FilterSurfacePool } from './filter-surface-pool.js';
import { resolveFilterWindows } from './filter-region.js';
import {
  enterPrimitivePresentation,
  type PrimitivePresentation,
} from '../primitive-presentation.js';
import { layoutDiagnostic } from '../style/diagnostics.js';
import type { CRCInstance } from '../types.js';

const FILTER_SURFACE_POOL = Symbol('crc.native-filter-surface-pool');

export interface RenderFilterBoundaryInput {
  readonly component: string;
  readonly filters: readonly NativePreparedFilter[];
  readonly presentation?: Readonly<PrimitivePresentation>;
  readonly process?: (source: OffscreenCanvas, result: OffscreenCanvasRenderingContext2D, windows: ReturnType<typeof resolveFilterWindows> extends infer T ? Exclude<T, 'discard'> : never) => void;
}

export function renderFilterBoundary(
  input: Readonly<RenderFilterBoundaryInput>,
  renderSubtree: () => void,
): void {
  const parent = GLOBAL_STATE.renderContext;
  const parentTarget = GLOBAL_STATE.renderTarget;
  const instance = GLOBAL_STATE.currentCRCInstance;
  if (!parent || !parentTarget || !instance) {
    throw new Error('Filter rendering requires an active CRC render target.');
  }

  const parentPaintTransform = getCurrentPaintTransform();
  const parentWorld = getCurrentWorldTransform();
  const boundaryPaintTransform = input.presentation?.transform ?
    parentPaintTransform.multiply(input.presentation.transform) :
    parentPaintTransform;
  const windows = resolveFilterWindows(
    parentTarget,
    boundaryPaintTransform,
    { values: input.filters },
  );
  if (windows === 'discard') {
    renderDiscardedBoundary(input, parent, parentWorld, renderSubtree);
    return;
  }

  const pool = getOptionalService(instance, FILTER_SURFACE_POOL, () => new NativeFilterService(instance));
  pool.used = true;
  const pair = pool.pool.checkoutPair(windows);
  try {
    const { source, result } = pair;
    result.context.setTransform(1, 0, 0, 1, 0, 0);
    if (!input.process) validateNativeFilter(input, result.context, windows.density);

    copyFilterSourceState(parent, source.context);
    source.context.setTransform(windows.source.renderTransform);
    withRenderTarget(
      source.context,
      source.target,
      parentWorld,
      () => {
        const releasePresentation = enterPrimitivePresentation(
          input.presentation,
          { deferPaint: true },
        );
        try {
          renderSubtree();
        } finally {
          releasePresentation();
        }
      },
    );

    if (input.process) input.process(source.canvas, result.context, windows);
    else result.context.drawImage(source.canvas, windows.sourceToOutputX, windows.sourceToOutputY);
    parent.save();
    let releasePresentation: (() => void) | undefined;
    try {
      releasePresentation = enterPrimitivePresentation(input.presentation);
      parent.drawImage(
        result.canvas,
        0,
        0,
        windows.output.backingWidth,
        windows.output.backingHeight,
        windows.output.logicalBounds.x,
        windows.output.logicalBounds.y,
        windows.output.logicalBounds.width,
        windows.output.logicalBounds.height,
      );
    } finally {
      try {
        releasePresentation?.();
      } finally {
        parent.restore();
      }
    }
  } finally {
    pair.release();
  }
}

/** @internal Read-only test/diagnostic access; it never allocates a pool. */
export function peekNativeFilterPool(instance: CRCInstance): FilterSurfacePool | undefined {
  return (instance.optionalServices.get(FILTER_SURFACE_POOL) as NativeFilterService | undefined)?.pool;
}

class NativeFilterService {
  readonly pool = new FilterSurfacePool();
  used = false;
  private committed = false;

  constructor(private readonly instance: NonNullable<typeof GLOBAL_STATE.currentCRCInstance>) {}

  beginRender(): void { this.used = false; }
  endRender(success: boolean): void {
    if (success && this.used) {
      this.committed = true;
      return;
    }
    if (!success && this.committed) return;
    this.pool.dispose();
    this.instance.optionalServices.delete(FILTER_SURFACE_POOL);
  }
  dispose(): void { this.pool.dispose(); }
}

function renderDiscardedBoundary(
  input: Readonly<RenderFilterBoundaryInput>,
  parent: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  parentWorld: DOMMatrix,
  renderSubtree: () => void,
): void {
  if (typeof OffscreenCanvas === 'undefined') {
    throw filterCapabilityError(
      input.component,
      'requires browser OffscreenCanvas support for its discard target',
    );
  }
  let canvas: OffscreenCanvas;
  try {
    canvas = new OffscreenCanvas(1, 1);
  } catch (error) {
    throw filterCapabilityError(
      input.component,
      'could not allocate its discard OffscreenCanvas',
      error,
    );
  }
  let context: OffscreenCanvasRenderingContext2D | null;
  try {
    context = canvas.getContext('2d');
  } catch (error) {
    throw filterCapabilityError(
      input.component,
      'could not acquire its discard OffscreenCanvas 2D context',
      error,
    );
  }
  if (!context) {
    throw filterCapabilityError(
      input.component,
      'could not acquire its discard OffscreenCanvas 2D context',
    );
  }
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, 1, 1);
  context.beginPath();
  if (!input.process) {
    validateNativeFilter(input, context, 1);
    resetNativeCanvasFilter(context, input.component);
  }
  copyFilterSourceState(parent, context);
  const target: RenderTargetSnapshot = {
    logicalBounds: Object.freeze({ x: 0, y: 0, width: 1, height: 1 }),
    backingWidth: 1,
    backingHeight: 1,
    renderTransform: new DOMMatrix(),
    inverseRenderTransform: new DOMMatrix(),
  };
  withRenderTarget(context, target, parentWorld, () => {
    const releasePresentation = enterPrimitivePresentation(
      input.presentation,
      { deferPaint: true },
    );
    try {
      renderSubtree();
    } finally {
      releasePresentation();
    }
  });
}

function validateNativeFilter(
  input: Readonly<RenderFilterBoundaryInput>,
  context: OffscreenCanvasRenderingContext2D,
  density: number,
): void {
  const cssText = compileNativeFilters(input.filters, density);
  assertNativeCanvasFilter(context, cssText, input.component, () => {
    for (const filter of input.filters) {
      if (!filter.onRejected) continue;
      try {
        assertNativeCanvasFilter(
          context,
          compileNativeFilters([filter], density),
          input.component,
        );
      } catch {
        filter.onRejected();
      }
    }
  });
}

function filterCapabilityError(
  component: string,
  reason: string,
  cause?: unknown,
): Error {
  const diagnostic = layoutDiagnostic({
    component,
    property: 'filter',
    value: undefined,
    algorithm: 'filter-rendering',
    reason,
  });
  if (cause !== undefined) {
    diagnostic.cause = cause;
  }
  return diagnostic;
}
