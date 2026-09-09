import { GLOBAL_STATE } from './global-state.js';
import type { LayoutBox } from './layout/types.js';
import type { CRCSurfaceSnapshot } from './surface/types.js';
import type { RenderingContext2D } from './types.js';

export interface RenderTargetSnapshot {
  readonly logicalBounds: Readonly<LayoutBox>;
  readonly backingWidth: number;
  readonly backingHeight: number;
  readonly renderTransform: DOMMatrix;
  readonly inverseRenderTransform: DOMMatrix;
}

export function rootRenderTarget(
  surface: CRCSurfaceSnapshot,
): RenderTargetSnapshot {
  return {
    logicalBounds: bitmapVisibleLogicalBounds(surface),
    backingWidth: surface.backingWidth,
    backingHeight: surface.backingHeight,
    renderTransform: surface.renderTransform,
    inverseRenderTransform: surface.inverseRenderTransform,
  };
}

function bitmapVisibleLogicalBounds(
  surface: CRCSurfaceSnapshot,
): Readonly<LayoutBox> {
  const points = [
    surface.inverseRenderTransform.transformPoint(new DOMPoint(0, 0)),
    surface.inverseRenderTransform.transformPoint(
      new DOMPoint(surface.backingWidth, 0),
    ),
    surface.inverseRenderTransform.transformPoint(
      new DOMPoint(0, surface.backingHeight),
    ),
    surface.inverseRenderTransform.transformPoint(
      new DOMPoint(surface.backingWidth, surface.backingHeight),
    ),
  ];
  if (points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new Error(
      'CRC root surface inverse projection produced non-finite logical bounds.',
    );
  }
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return Object.freeze({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  });
}

export function getCurrentPaintTransform(): DOMMatrix {
  const target = getCurrentRenderTarget();
  return target.inverseRenderTransform.multiply(getCurrentRenderContext().getTransform());
}

export function getCurrentWorldTransform(): DOMMatrix {
  const worldBase = GLOBAL_STATE.worldBaseTransform;
  if (!worldBase) {
    throw new Error('No world transform is available.');
  }
  return worldBase.multiply(getCurrentPaintTransform());
}

export function withRenderTarget<T>(
  context: RenderingContext2D,
  target: RenderTargetSnapshot,
  worldBase: DOMMatrix,
  work: () => T,
): T {
  const previousContext = GLOBAL_STATE.renderContext;
  const previousTarget = GLOBAL_STATE.renderTarget;
  const previousWorldBase = GLOBAL_STATE.worldBaseTransform;
  try {
    GLOBAL_STATE.renderContext = context;
    GLOBAL_STATE.renderTarget = target;
    GLOBAL_STATE.worldBaseTransform = worldBase;
    return work();
  } finally {
    GLOBAL_STATE.renderContext = previousContext;
    GLOBAL_STATE.renderTarget = previousTarget;
    GLOBAL_STATE.worldBaseTransform = previousWorldBase;
  }
}

function getCurrentRenderContext(): RenderingContext2D {
  if (!GLOBAL_STATE.renderContext) {
    throw new Error('No render context is available.');
  }
  return GLOBAL_STATE.renderContext;
}

function getCurrentRenderTarget(): RenderTargetSnapshot {
  if (!GLOBAL_STATE.renderTarget) {
    throw new Error('No render target is available.');
  }
  return GLOBAL_STATE.renderTarget;
}
