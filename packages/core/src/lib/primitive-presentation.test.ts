import { afterEach, describe, expect, it, vi } from 'vitest';
import { Clip } from './components/clip';
import { Group } from './components/g';
import { GLOBAL_STATE } from './global-state';
import {
  createGroupTransform,
  enterPrimitivePresentation,
  getPrimitivePresentation,
} from './primitive-presentation';
import {
  getCurrentWorldTransform,
  type RenderTargetSnapshot,
  withRenderTarget,
} from './render-target';

afterEach(() => {
  GLOBAL_STATE.clippingStack = [];
  vi.restoreAllMocks();
});

describe('primitive presentation', () => {
  it('builds the Group transform in scale, origin rotation, translation, skewX, skewY order', () => {
    const style = {
      scaleX: 2,
      scaleY: 3,
      rotationDegrees: 30,
      rotationOrigin: [4, 5] as [number, number],
      translateX: 7,
      translateY: 11,
      skewX: 13,
      skewY: 17,
    };

    const actual = createGroupTransform(style);
    const expected = new DOMMatrix([
      1.548574315926424,
      2.4001868446785037,
      -0.6001245631190024,
      2.9443784980416607,
      7.196152422706634,
      35.088457268119896,
    ]);

    expect(matrixValues(actual)).toEqual(matrixValues(expected));
    expect(matrixValues(getPrimitivePresentation(Group, style)!.transform!))
      .toEqual(matrixValues(expected));
  });

  it('resolves Clip presentation with the nonzero default fill rule', () => {
    const path = new Path2D();
    path.rect(1, 2, 3, 4);

    expect(getPrimitivePresentation(Clip, { d: path })).toEqual({
      clip: { path, fillRule: 'nonzero' },
    });
    expect(getPrimitivePresentation(Clip, { d: path, fillRule: 'evenodd' }))
      .toEqual({ clip: { path, fillRule: 'evenodd' } });
  });

  it('applies direct transform and paint clip while publishing matching world geometry', () => {
    const context = document.createElement('canvas').getContext('2d')!;
    const target = identityTarget(40, 30);
    const parentPaint = new DOMMatrix().translate(3, 5);
    const localTransform = new DOMMatrix().scale(2, 3).translate(7, 11);
    const path = new Path2D();
    path.rect(0, 0, 10, 10);
    const clip = vi.spyOn(context, 'clip');
    context.setTransform(parentPaint);

    withRenderTarget(context, target, new DOMMatrix().translate(100, 200), () => {
      const release = enterPrimitivePresentation({
        transform: localTransform,
        clip: { path, fillRule: 'evenodd' },
      });

      const expectedWorld = new DOMMatrix()
        .translate(100, 200)
        .multiply(parentPaint)
        .multiply(localTransform);
      expect(matrixValues(context.getTransform()))
        .toEqual(matrixValues(parentPaint.multiply(localTransform)));
      expect(clip).toHaveBeenCalledWith(path, 'evenodd');
      expect(GLOBAL_STATE.clippingStack).toEqual([{
        path,
        fillRule: 'evenodd',
        transform: expectedWorld,
      }]);

      release();
      release();
      expect(GLOBAL_STATE.clippingStack).toEqual([]);
    });
  });

  it('retains known CRC world precision while including a direct Canvas context delta', () => {
    const context = document.createElement('canvas').getContext('2d')!;
    const target = identityTarget(40, 30);
    const parentPaint = new DOMMatrix().translate(3, 5);
    const localTransform = new DOMMatrix().rotate(4.5).scale(2, 3).translate(7, 11);
    context.setTransform(parentPaint);

    withRenderTarget(context, target, new DOMMatrix().translate(100, 200), () => {
      const release = enterPrimitivePresentation({ transform: localTransform });
      const expectedWorld = new DOMMatrix()
        .translate(100, 200)
        .multiply(parentPaint)
        .multiply(localTransform);
      expect(matrixValues(getCurrentWorldTransform()))
        .toEqual(matrixValues(expectedWorld));

      context.translate(13, 17);
      const expectedCustomWorld = expectedWorld.translate(13, 17);
      for (const [index, value] of matrixValues(getCurrentWorldTransform()).entries()) {
        expect(value).toBeCloseTo(matrixValues(expectedCustomWorld)[index]!, 12);
      }
      release();
    });
  });

  it('does not allocate presentation lineage outside an attachment traversal', () => {
    const context = document.createElement('canvas').getContext('2d')!;
    const target = identityTarget(40, 30);
    withRenderTarget(context, target, new DOMMatrix(), () => {
      const release = enterPrimitivePresentation({
        transform: new DOMMatrix().translate(7, 11),
      });
      expect(GLOBAL_STATE.presentationTransformLineage).toBeUndefined();
      release();
    });
  });

  it('keeps deferred source paint upright while publishing transformed world geometry', () => {
    const context = new OffscreenCanvas(40, 30).getContext('2d')!;
    const renderTransform = new DOMMatrix().scale(2).translate(6, 8);
    const target = targetWithTransform(40, 30, renderTransform);
    const parentWorld = new DOMMatrix().translate(100, 200).rotate(10);
    const localTransform = new DOMMatrix().scale(2, 3).translate(7, 11);
    const path = new Path2D();
    path.rect(0, 0, 10, 10);
    const clip = vi.spyOn(context, 'clip');
    context.setTransform(renderTransform);

    withRenderTarget(context, target, parentWorld, () => {
      const release = enterPrimitivePresentation({
        transform: localTransform,
        clip: { path, fillRule: 'nonzero' },
      }, { deferPaint: true });

      const expectedWorld = parentWorld.multiply(localTransform);
      expect(matrixValues(context.getTransform()))
        .toEqual(matrixValues(renderTransform));
      expect(clip).not.toHaveBeenCalled();
      expect(matrixValues(getCurrentWorldTransform()))
        .toEqual(matrixValues(expectedWorld));
      expect(GLOBAL_STATE.clippingStack).toEqual([{
        path,
        fillRule: 'nonzero',
        transform: expectedWorld,
      }]);

      release();
      release();
      expect(matrixValues(getCurrentWorldTransform()))
        .toEqual(matrixValues(parentWorld));
      expect(GLOBAL_STATE.clippingStack).toEqual([]);
    });
  });
});

function identityTarget(
  width: number,
  height: number,
): RenderTargetSnapshot {
  return targetWithTransform(width, height, new DOMMatrix());
}

function targetWithTransform(
  width: number,
  height: number,
  renderTransform: DOMMatrix,
): RenderTargetSnapshot {
  return {
    logicalBounds: { x: 0, y: 0, width, height },
    backingWidth: width,
    backingHeight: height,
    renderTransform,
    inverseRenderTransform: renderTransform.inverse(),
  };
}

function matrixValues(matrix: DOMMatrixReadOnly): number[] {
  return [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f];
}
