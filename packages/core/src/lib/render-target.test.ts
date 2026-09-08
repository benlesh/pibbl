import { afterEach, describe, expect, it } from 'vitest';
import { clearTempState, GLOBAL_STATE } from './global-state.js';
import {
  getCurrentPaintTransform,
  getCurrentWorldTransform,
  rootRenderTarget,
  withRenderTarget,
  type RenderTargetSnapshot,
} from './render-target.js';
import { resolveSurface } from './surface/resolve-surface.js';

afterEach(() => {
  clearTempState();
});

describe('render targets', () => {
  it('separates active-target paint transforms from root-logical world transforms', () => {
    const rootSurface = resolveSurface(
      {
        mode: 'fixed',
        width: 200,
        height: 100,
        fit: 'contain',
        pixelRatio: 2,
      },
      { width: 300, height: 300 },
      2,
    )!;
    const rootTarget = rootRenderTarget(rootSurface);
    const localTarget: RenderTargetSnapshot = {
      logicalBounds: { x: -20, y: 10, width: 100, height: 80 },
      backingWidth: 200,
      backingHeight: 160,
      renderTransform: new DOMMatrix().scale(2).translate(20, -10),
      inverseRenderTransform: new DOMMatrix().scale(2).translate(20, -10)
        .inverse(),
    };
    const worldBase = new DOMMatrix().translate(30, 40).rotate(25);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;

    expect(rootTarget.backingWidth).toBe(rootSurface.backingWidth);
    expect(rootTarget.backingHeight).toBe(rootSurface.backingHeight);
    expect(rootTarget.logicalBounds).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    });

    context.setTransform(rootTarget.renderTransform);
    withRenderTarget(context, rootTarget, new DOMMatrix(), () => {
      expectMatrixClose(getCurrentPaintTransform(), new DOMMatrix());
      expectMatrixClose(getCurrentWorldTransform(), new DOMMatrix());
    });

    context.setTransform(localTarget.renderTransform);
    withRenderTarget(context, localTarget, worldBase, () => {
      context.scale(2, 3);

      expect(matrixValues(getCurrentPaintTransform())).toEqual(
        matrixValues(new DOMMatrix().scale(2, 3)),
      );
      expect(matrixValues(getCurrentWorldTransform())).toEqual(
        matrixValues(worldBase.scale(2, 3)),
      );
    });
  });

  it('restores nested target globals after thrown work', () => {
    const canvas = document.createElement('canvas');
    const previousContext = canvas.getContext('2d')!;
    const previousTarget = createTarget(0, 0);
    const previousWorldBase = new DOMMatrix().translate(4, 5);
    const outerContext = document.createElement('canvas').getContext('2d')!;
    const outerTarget = createTarget(10, 20);
    const outerWorldBase = new DOMMatrix().scale(2);
    const innerContext = document.createElement('canvas').getContext('2d')!;
    const innerTarget = createTarget(-20, 10);
    const innerWorldBase = new DOMMatrix().rotate(15);
    GLOBAL_STATE.renderContext = previousContext;
    GLOBAL_STATE.renderTarget = previousTarget;
    GLOBAL_STATE.worldBaseTransform = previousWorldBase;

    expect(() => withRenderTarget(outerContext, outerTarget, outerWorldBase, () => {
      expect(GLOBAL_STATE.renderContext).toBe(outerContext);
      expect(GLOBAL_STATE.renderTarget).toBe(outerTarget);
      expect(GLOBAL_STATE.worldBaseTransform).toBe(outerWorldBase);
      withRenderTarget(innerContext, innerTarget, innerWorldBase, () => {
        throw new Error('expected nested failure');
      });
    })).toThrow('expected nested failure');

    expect(GLOBAL_STATE.renderContext).toBe(previousContext);
    expect(GLOBAL_STATE.renderTarget).toBe(previousTarget);
    expect(GLOBAL_STATE.worldBaseTransform).toBe(previousWorldBase);
  });
});

function createTarget(x: number, y: number): RenderTargetSnapshot {
  const renderTransform = new DOMMatrix().translate(-x, -y);
  return {
    logicalBounds: { x, y, width: 40, height: 30 },
    backingWidth: 40,
    backingHeight: 30,
    renderTransform,
    inverseRenderTransform: renderTransform.inverse(),
  };
}

function matrixValues(matrix: DOMMatrix): [number, number, number, number, number, number] {
  return [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f];
}

function expectMatrixClose(actual: DOMMatrix, expected: DOMMatrix): void {
  for (const [index, value] of matrixValues(actual).entries()) {
    expect(value).toBeCloseTo(matrixValues(expected)[index]!);
  }
}
