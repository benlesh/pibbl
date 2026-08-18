import { describe, expect, it, vi } from 'vitest';
import { crc } from '../crc';
import { img } from '../components/img';
import { text } from '../components/text';
import { resolveTextLayout } from '../components/text-layout';
import { defineComp } from '../define-comp';
import { crcLayoutBox } from '../hooks/crc-layout-box';
import { crcRef } from '../hooks/crc-ref';
import { crcState } from '../hooks/crc-state';
import { LayoutDiagnostic } from '../style/diagnostics';
import { componentTest } from '../test-utils/component-test';
import type { CompEl, MeasureResult, SystemStyle } from '../types';
import {
  measureElement,
  type CanvasMeasurementService,
} from './measure';

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
    const Measured = defineComp<
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
    const element = Measured({ value: 7 });

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
    const Unmeasured = defineComp(UnmeasuredComponent);

    expect(measureElement(Unmeasured({}), constraints, service)).toEqual({
      status: 'unsupported',
      reason: 'UnmeasuredComponent does not provide measurement',
    });
  });

  it('measures text through the shared text layout utility', () => {
    expect(measureElement(text({
      style: { text: 'hello', font: '12px sans-serif' },
    }), constraints, service)).toEqual({
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
    const result = measureElement(text({ style }), {
      ...constraints,
      maxWidth: 50,
    }, wrappingService);

    expect(result).toEqual({
      status: 'measured',
      size: { width: 50, height: 12 },
    });
    if (result.status !== 'measured') throw new Error('expected measurement');
    expect(resolveTextLayout(
      value => wrappingService.measureText(value, style.font),
      { ...style, width: result.size.width },
    ).lines).toHaveLength(1);
  });

  it('measures only explicitly sized images without creating a resource', () => {
    const ImageConstructor = vi.spyOn(window, 'Image');

    expect(measureElement(img({
      style: { src: 'image.png', width: 30, height: 20 },
    }), constraints, service)).toEqual({
      status: 'measured',
      size: { width: 30, height: 20 },
    });
    expect(measureElement(img({
      style: { src: 'image.png' },
    }), constraints, service)).toEqual({
      status: 'unsupported',
      reason: 'Image natural dimensions are unavailable during pure measurement',
    });
    expect(ImageConstructor).not.toHaveBeenCalled();
  });

  it('isolates measurement from active render hooks and layout context', async () => {
    const errors: string[] = [];
    const probes = [
      () => crcState(1),
      () => crcRef(),
      () => crcLayoutBox(),
    ];
    const Probe = defineComp(() => undefined, {
      measure: () => {
        probes.shift()!();
        return { status: 'measured' as const, size: { width: 1, height: 1 } };
      },
    });
    const Host = defineComp(({ revision }: { revision: number }) => {
      crcState(revision);
      for (let index = 0; index < 3; index++) {
        try {
          measureElement(Probe({}), constraints, service);
        } catch (error) {
          errors.push(String(error));
        }
      }
      crcRef(revision);
    });
    const canvas = await componentTest(Host({ revision: 1 }));

    expect(errors).toHaveLength(3);
    expect(errors[0]).toMatch(/hooks?.*component|component.*hooks?/i);
    expect(errors[1]).toMatch(/hooks?.*component|component.*hooks?/i);
    expect(errors[2]).toMatch(/layout context/i);

    crc(canvas.element, Host({ revision: 2 }));
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    expect(errors).toHaveLength(6);
  });

  it('rejects direct and indirect cyclic measurement and cleans up afterward', () => {
    let directElement: CompEl;
    const Direct = defineComp(() => undefined, {
      measure: (input): MeasureResult =>
        input.measureElement(directElement, constraints),
    });
    directElement = Direct({});

    let aElement: CompEl;
    let bElement: CompEl;
    const A = defineComp(() => undefined, {
      measure: (input): MeasureResult =>
        input.measureElement(bElement, constraints),
    });
    const B = defineComp(() => undefined, {
      measure: (input): MeasureResult =>
        input.measureElement(aElement, constraints),
    });
    aElement = A({});
    bElement = B({});

    for (const element of [directElement, aElement]) {
      expect(() => measureElement(element, constraints, service))
        .toThrowError(LayoutDiagnostic);
      expect(() => measureElement(element, constraints, service))
        .toThrowError(/cyclic measurement/i);
    }
    expect(measureElement(text({ style: { text: 'ok' } }), constraints, service))
      .toEqual({ status: 'measured', size: { width: 20, height: 12 } });
  });
});
