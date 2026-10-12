import { dropShadow } from '@pibbl/core/filters';
import { describe, expect, it, vi } from 'vitest';
import { pibbl } from '../pibbl';
import { Image } from '../components/img';
import { Text } from '../components/text';
import { resolveTextLayout } from '../components/text-layout';
import { useLayoutBox } from '../hooks/use-layout-box';
import { useRef } from '../hooks/use-ref';
import { useSignal } from '../hooks/use-signal';
import { LayoutDiagnostic } from '../style/diagnostics';
import { componentTest } from '../test-utils/component-test';
import type { PibblElement, MeasureResult, SystemStyle } from '../types';
import {
  measureElement,
  type CanvasMeasurementService,
} from './measure';
import { createElement } from '../element/create-element';
import { definePrimitive } from '../define-primitive';
import { signal, signalGraphSnapshot } from '../signals/graph';

const constraints = {
  minWidth: 0,
  maxWidth: 200,
  minHeight: 0,
  maxHeight: 100,
};

const service: CanvasMeasurementService = {
  measureText(value) {
    return {
      width: value.length * 10,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: value.length * 10,
      actualBoundingBoxAscent: 9,
      actualBoundingBoxDescent: 3,
    } as TextMetrics;
  },
};

describe('pure element measurement', () => {
  it('snapshots signal inputs without retaining an edge or provision', () => {
    const label = signal('snapshot');
    const style = signal({ font: '12px sans-serif' });
    const baseline = signalGraphSnapshot();

    expect(measureElement(createElement(Text, {
      children: label,
      style,
    }), constraints, service)).toEqual({
      status: 'measured',
      size: { width: 80, height: 12 },
    });

    const after = signalGraphSnapshot();
    expect(after.rendererEdges).toBe(baseline.rendererEdges);
    expect(after.rendererConsumers).toBe(baseline.rendererConsumers);
    expect(after.receiverInputProvisions).toBe(baseline.receiverInputProvisions);
  });

  it('normalizes and measures without invoking render', () => {
    interface ProbeStyle extends SystemStyle {
      label?: string;
    }
    interface NormalizedProbeStyle extends SystemStyle {
      label: string;
    }
    let renders = 0;
    const measure = vi.fn(input => {
      expect(input.props).toEqual({ value: 7 });
      expect(input.style).toEqual({ label: 'normalized' });
      expect(input.constraints).toBe(constraints);
      expect(input.service).toBe(service);
      return {
        status: 'measured' as const,
        size: { width: 40, height: 20 },
      };
    });
    const Measured = definePrimitive<
      { value: number },
      ProbeStyle,
      NormalizedProbeStyle,
      NormalizedProbeStyle
    >(() => {
      renders++;
    }, {
      normalizeStyle: () => ({ label: 'normalized' }),
      measure,
    });
    const element = createElement(Measured, { value: 7 });

    expect(measureElement(element, constraints, service)).toEqual({
      status: 'measured',
      size: { width: 40, height: 20 },
    });
    expect(renders).toBe(0);
    expect(measure).toHaveBeenCalledOnce();
    expect(Object.keys(element.type)).not.toContain('measure');
  });

  it('returns a typed unsupported result without a measurement capability', () => {
    function UnmeasuredComponent() {}
    const Unmeasured = UnmeasuredComponent;

    expect(measureElement(createElement(Unmeasured, {}), constraints, service)).toEqual({
      status: 'unsupported',
      reason: 'UnmeasuredComponent does not provide measurement',
    });
  });

  it('measures text through the shared text layout utility', () => {
    expect(measureElement(createElement(Text, {
      style: { font: '12px sans-serif' },
    }, 'hello'), constraints, service)).toEqual({
      status: 'measured',
      size: { width: 50, height: 12 },
    });
  });

  it('retains the finite wrapping width so measurement and repaint agree', () => {
    const wrappingService: CanvasMeasurementService = {
      measureText(value) {
        return {
          width: value.length * 10,
          actualBoundingBoxLeft: 0,
          actualBoundingBoxRight: value.length * 5,
          actualBoundingBoxAscent: 9,
          actualBoundingBoxDescent: 3,
        } as TextMetrics;
      },
    };
    const style = {
      text: 'aa bb',
      wrap: true,
      lineHeight: 12,
      font: '12px sans-serif',
    } as const;
    const result = measureElement(createElement(Text, { style }), {
      ...constraints,
      maxWidth: 50,
    }, wrappingService);

    expect(result).toEqual({
      status: 'measured',
      size: { width: 50, height: 12 },
    });
    if (result.status !== 'measured') throw new Error('expected measurement');
    const { text: content, ...layoutStyle } = style;
    expect(resolveTextLayout(
      value => wrappingService.measureText(value, style.font),
      content,
      { ...layoutStyle, width: result.size.width },
    ).lines).toHaveLength(1);
  });

  it('measures only explicitly sized images without creating a resource', () => {
    const ImageConstructor = vi.spyOn(window, 'Image');

    expect(measureElement(createElement(Image, {
      style: { src: 'image.png', width: 30, height: 20 },
    }), constraints, service)).toEqual({
      status: 'measured',
      size: { width: 30, height: 20 },
    });
    expect(measureElement(createElement(Image, {
      style: { src: 'image.png' },
    }), constraints, service)).toEqual({
      status: 'unsupported',
      reason: 'Image natural dimensions are unavailable during pure measurement',
    });
    expect(ImageConstructor).not.toHaveBeenCalled();
  });

  it('ignores filters during pure measurement without allocating an offscreen canvas', () => {
    let measureStyle: Readonly<SystemStyle> | undefined;
    const offscreenConstructor = vi.spyOn(globalThis, 'OffscreenCanvas');
    const Measuring = definePrimitive<{}, SystemStyle>(() => undefined, {
      measure: input => {
        measureStyle = input.style;
        return { status: 'measured', size: { width: 12, height: 8 } };
      },
    });
    const filtered = createElement(Measuring, {
      style: {
        filter: dropShadow({ offsetX: 2, offsetY: 4, color: 'not-a-browser-color' }),
      },
    });

    expect(measureElement(filtered, constraints, service)).toEqual({
      status: 'measured',
      size: { width: 12, height: 8 },
    });
    expect(measureStyle).not.toHaveProperty('filter');
    expect(offscreenConstructor).not.toHaveBeenCalled();
  });

  it('isolates measurement from active render hooks and layout context', async () => {
    const errors: string[] = [];
    const probes = [
      () => useSignal(1),
      () => useRef(),
      () => useLayoutBox(),
    ];
    const Probe = definePrimitive<{}>(() => undefined, {
      measure: () => {
        probes.shift()!();
        return { status: 'measured' as const, size: { width: 1, height: 1 } };
      },
    });
    const Host = ({ revision }: { revision: number }) => {
      useSignal(revision);
      for (let index = 0; index < 3; index++) {
        try {
          measureElement(createElement(Probe, {}), constraints, service);
        } catch (error) {
          errors.push(String(error));
        }
      }
      useRef(revision);
    };
    const canvas = await componentTest(createElement(Host, { revision: 1 }));

    expect(errors).toHaveLength(3);
    expect(errors[0]).toMatch(/hooks?.*component|component.*hooks?/i);
    expect(errors[1]).toMatch(/hooks?.*component|component.*hooks?/i);
    expect(errors[2]).toMatch(/layout context/i);

    pibbl(canvas.element, createElement(Host, { revision: 2 }));
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    expect(errors).toHaveLength(6);
  });

  it('rejects direct and indirect cyclic measurement and cleans up afterward', () => {
    let directElement: PibblElement<any>;
    const Direct = definePrimitive<{}>(() => undefined, {
      measure: (input): MeasureResult =>
        input.measureElement(directElement, constraints),
    });
    directElement = createElement(Direct, {});

    let aElement: PibblElement<any>;
    let bElement: PibblElement<any>;
    const A = definePrimitive<{}>(() => undefined, {
      measure: (input): MeasureResult =>
        input.measureElement(bElement, constraints),
    });
    const B = definePrimitive<{}>(() => undefined, {
      measure: (input): MeasureResult =>
        input.measureElement(aElement, constraints),
    });
    aElement = createElement(A, {});
    bElement = createElement(B, {});

    for (const element of [directElement, aElement]) {
      expect(() => measureElement(element, constraints, service))
        .toThrowError(LayoutDiagnostic);
      expect(() => measureElement(element, constraints, service))
        .toThrowError(/cyclic measurement/i);
    }
    expect(measureElement(createElement(Text, { style: {  } }, 'ok'), constraints, service))
      .toEqual({ status: 'measured', size: { width: 20, height: 12 } });
  });
});
