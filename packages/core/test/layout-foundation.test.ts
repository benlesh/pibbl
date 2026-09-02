import { mountLayoutFoundation } from '@crc/scenarios';
import { userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { Rectangle } from '../src/index';
import {
  placeAbsoluteChild,
  resolveContainerBox,
} from '../src/lib/layout/absolute';
import { layoutGrid } from '../src/lib/layout/grid';
import type { LayoutBox } from '../src/lib/layout/types';
import { LayoutDiagnostic } from '../src/lib/style/diagnostics';
import { createElement } from '../src/lib/element/create-element';

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

describe('layout foundation public scenario', () => {
  it('keeps nested layout, clipping, identity, and observation aligned across reflow', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 420;
    document.body.appendChild(canvas);
    const mounted = mountLayoutFoundation(canvas);
    dispose = () => mounted.controller.dispose();
    await settle();

    expect(mounted.getState().observedBox).toEqual({
      x: 0, y: 0, width: 432, height: 420,
    });
    expect(pixelAt(canvas, 420, 400)).toEqual([124, 58, 237, 255]);
    expect(pixelAt(canvas, 450, 400)).toEqual([0, 0, 0, 0]);
    await userEvent.click(canvas, { position: { x: 216, y: 210 } });
    await userEvent.click(canvas, { position: { x: 20, y: 20 } });
    await userEvent.click(canvas, { position: { x: 420, y: 400 } });
    await userEvent.click(canvas, { position: { x: 450, y: 400 } });
    await settle();
    expect(mounted.getState()).toEqual({
      topClicks: 1,
      keyedClicks: 1,
      clippedClicks: 1,
      observedBox: { x: 0, y: 0, width: 432, height: 420 },
    });

    mounted.resize(480, 360);
    await settle();
    expect(mounted.getState().observedBox).toEqual({
      x: 0, y: 0, width: 288, height: 360,
    });
    expect(mounted.getState().keyedClicks).toBe(1);
    expect(pixelAt(canvas, 280, 340)).toEqual([124, 58, 237, 255]);
    expect(pixelAt(canvas, 300, 340)).toEqual([0, 0, 0, 0]);
    await userEvent.click(canvas, { position: { x: 144, y: 180 } });
    await userEvent.click(canvas, { position: { x: 300, y: 340 } });
    await settle();
    expect(mounted.getState()).toEqual({
      topClicks: 2,
      keyedClicks: 1,
      clippedClicks: 1,
      observedBox: { x: 0, y: 0, width: 288, height: 360 },
    });
  });
});

describe('layout diagnostic hardening', () => {
  const container: Readonly<LayoutBox> = {
    x: 0,
    y: 0,
    width: 200,
    height: 100,
  };
  const constraints = {
    minWidth: 0,
    maxWidth: 200,
    minHeight: 0,
    maxHeight: 100,
  } as const;
  const context = {
    allocation: container,
    percentageBasis: container,
    constraints,
    component: 'DiagnosticBox',
    algorithm: 'render-dispatch' as const,
  };
  const measurement = {
    service: {
      measureText: () => ({ width: 0 }) as TextMetrics,
    },
    measureElement: () => ({
      status: 'unsupported' as const,
      reason: 'not needed for definite diagnostic fixtures',
    }),
  };

  it('reports malformed percentages with complete resolution context', () => {
    expectDiagnostic(
      () => resolveContainerBox(
        { width: '1e2%' as never, height: 20 },
        context,
        'DiagnosticBox',
        'diagnostic-layout',
      ),
      {
        component: 'DiagnosticBox',
        property: 'width',
        suppliedValue: '1e2%',
        algorithm: 'diagnostic-layout',
        constraints,
      },
    );
  });

  it('reports non-finite allocation values with complete resolution context', () => {
    expectDiagnostic(
      () => resolveContainerBox(
        { width: Number.POSITIVE_INFINITY, height: 20 },
        context,
        'DiagnosticBox',
        'diagnostic-layout',
      ),
      {
        component: 'DiagnosticBox',
        property: 'width',
        suppliedValue: Number.POSITIVE_INFINITY,
        algorithm: 'diagnostic-layout',
        constraints,
      },
    );
  });

  it('reports unresolved auto child dimensions with complete layout context', () => {
    expectDiagnostic(
      () => placeAbsoluteChild(container, createElement(Rectangle, {
        style: { width: 'auto', height: 20, fill: '#000000' },
      })),
      {
        component: 'Rectangle',
        property: 'width',
        suppliedValue: 'auto',
        algorithm: 'absolute',
        constraints,
      },
    );
  });

  it('reports invalid Grid starts and overflowing spans with area context', () => {
    expectDiagnostic(
      () => layoutGrid(container, [createElement(Rectangle, {
        style: {
          width: 20,
          height: 20,
          fill: '#000000',
          gridColumnStart: 3,
          gridRowStart: 1,
        },
      })], {
        gridTemplateColumns: [100, 100],
        gridTemplateRows: [100],
      }, measurement),
      {
        component: 'Rectangle',
        property: 'gridColumnStart',
        suppliedValue: 3,
        algorithm: 'grid',
        constraints,
      },
    );
    const spanError = expectDiagnostic(
      () => layoutGrid(container, [createElement(Rectangle, {
        style: {
          width: 20,
          height: 20,
          fill: '#000000',
          gridColumnStart: 2,
          gridColumnSpan: 2,
          gridRowStart: 1,
        },
      })], {
        gridTemplateColumns: [100, 100],
        gridTemplateRows: [100],
      }, measurement),
      {
        component: 'Rectangle',
        property: 'gridColumnSpan',
        suppliedValue: 2,
        algorithm: 'grid',
        constraints,
      },
    );
    expect(spanError.message).toContain('start 2 plus span 2');
  });
});

function expectDiagnostic(
  action: () => unknown,
  expected: Readonly<{
    component: string;
    property: string;
    suppliedValue: unknown;
    algorithm: string;
    constraints: Readonly<{
      minWidth: number;
      maxWidth: number;
      minHeight: number;
      maxHeight: number;
    }>;
  }>,
): LayoutDiagnostic {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(LayoutDiagnostic);
    expect(error).toMatchObject(expected);
    const diagnostic = error as LayoutDiagnostic;
    expect(diagnostic.message).toContain(expected.component);
    expect(diagnostic.message).toContain(expected.property);
    expect(diagnostic.message).toContain(expected.algorithm);
    expect(diagnostic.message).toContain(String(expected.constraints.maxWidth));
    expect(diagnostic.message).toContain(String(expected.constraints.maxHeight));
    return diagnostic;
  }
  throw new Error('Expected a LayoutDiagnostic.');
}

function pixelAt(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
): readonly number[] {
  return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
}

function settle(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() =>
    requestAnimationFrame(() => resolve()),
  ));
}
