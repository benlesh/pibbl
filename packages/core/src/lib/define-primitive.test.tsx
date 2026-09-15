import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from './element/create-element.js';
import { clearSharedState } from './global-state.js';
import { measureElement } from './layout/measure.js';
import { LayoutDiagnostic } from './style/diagnostics.js';
import type { Length } from './style/types.js';
import type {
  CanvasMeasurementService,
  CRCElement,
  MeasureResult,
  SystemStyle,
} from './types.js';
import { crc } from './crc.js';
import {
  crcInternalRunPurePrimitiveResolver,
  definePrimitive,
  derivePrimitive,
} from './define-primitive.js';
import { setPrimitivePresentation } from './primitive-presentation.js';
import { crcState } from './hooks/crc-state.js';
import { signal } from './signals/graph.js';

const constraints = {
  minWidth: 0,
  maxWidth: 200,
  minHeight: 0,
  maxHeight: 100,
};

const service: CanvasMeasurementService = {
  measureText(value) {
    return { width: value.length * 10 } as TextMetrics;
  },
};

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
});

describe('definePrimitive', () => {
  it('runs friend primitive resolvers without hook or signal-write authority and restores render hooks', async () => {
    const value = signal(1);
    const observed: string[] = [];
    const Probe = definePrimitive(function renderPureResolverProbe() {
      const [before] = crcState('before');
      expect(() => crcInternalRunPurePrimitiveResolver(() => crcState('no')))
        .toThrow(/hooks can only be called/i);
      expect(() => crcInternalRunPurePrimitiveResolver(() => value.set(2)))
        .toThrow(/pure primitive resolver/i);
      expect(crcInternalRunPurePrimitiveResolver(() => 42)).toBe(42);
      const [after] = crcState('after');
      observed.push(before, after);
    });
    const controller = crc(createCanvas(10, 10), <Probe />);
    await nextFrame();

    expect(value.get()).toBe(1);
    expect(observed).toEqual(['before', 'after']);
    controller.dispose();
  });

  it('derives an independent primitive identity with the complete private definition and presentation', async () => {
    interface DerivedStyle extends SystemStyle {
      width: Length;
    }
    interface ResolvedDerivedStyle extends SystemStyle {
      width: number;
    }
    const paints: number[] = [];
    const normalizeStyle = vi.fn((style: Readonly<DerivedStyle>) => style);
    const resolveStyle = vi.fn((style: Readonly<DerivedStyle>) => ({
      width: typeof style.width === 'number' ? style.width : 20,
    }));
    const measure = vi.fn(() => ({
      status: 'measured' as const,
      size: { width: 20, height: 4 },
    }));
    const Source = definePrimitive<
      {}, DerivedStyle, DerivedStyle, ResolvedDerivedStyle
    >(function renderDerivable(_props, style, context) {
      paints.push(style.width);
      context.fillRect(0, 0, 1, 1);
    }, { normalizeStyle, resolveStyle, measure });
    setPrimitivePresentation<ResolvedDerivedStyle>(Source, () => ({
      transform: new DOMMatrix().translate(3, 0),
    }));

    const Derived = derivePrimitive(Source);
    setPrimitivePresentation<ResolvedDerivedStyle>(Source, () => ({
      transform: new DOMMatrix().translate(9, 0),
    }));

    expect(Derived).not.toBe(Source);
    expect(Derived.name).toBe(Source.name);
    expect(measureElement(<Derived style={{ width: '50%' }} />, constraints, service)).toEqual({
      status: 'measured', size: { width: 20, height: 4 },
    });
    const canvas = createCanvas(20, 4);
    const controller = crc(canvas, <>
      <Derived style={{ width: '50%' }} />
      <Source style={{ width: '50%' }} />
    </>);
    await nextFrame();

    expect(paints).toEqual([20, 20]);
    expect(Array.from(canvas.getContext('2d')!.getImageData(3, 0, 1, 1).data)).toEqual([0, 0, 0, 255]);
    expect(Array.from(canvas.getContext('2d')!.getImageData(9, 0, 1, 1).data)).toEqual([0, 0, 0, 255]);
    expect(normalizeStyle).toHaveBeenCalledTimes(3);
    expect(resolveStyle).toHaveBeenCalledTimes(2);
    expect(measure).toHaveBeenCalledOnce();
    controller.dispose();
  });

  it('types optional and required specified style without exposing reserved program props', () => {
    interface OptionalStyle extends SystemStyle {
      opacity?: number;
    }
    interface RequiredStyle extends SystemStyle {
      width: number;
    }
    const Optional = definePrimitive<{ label: string }, OptionalStyle>(
      function renderOptional() {},
    );
    const Required = definePrimitive<{ label: string }, RequiredStyle>(
      function renderRequired() {},
    );

    const optional = <Optional label="optional" />;
    const optionalStyled = <Optional
      label="optional"
      style={{ opacity: 0.5 }}
    />;
    const required = <Required label="required" style={{ width: 20 }} />;
    const direct = createElement(Required, {
      label: 'direct',
      style: { width: 30 },
    });

    // @ts-expect-error required style members make the style field required
    void <Required label="missing" />;
    // @ts-expect-error style remains closed to excess members
    void <Required label="invalid" style={{ unknown: true, width: 20 }} />;
    // @ts-expect-error key is reserved construction metadata
    definePrimitive<{ key: string }>(function renderReservedKey() {});
    // @ts-expect-error style is reserved primitive metadata
    definePrimitive<{ style: string }>(function renderReservedStyle() {});

    expect(optional.props).toEqual({ label: 'optional' });
    expect(optionalStyled.props).toEqual({
      label: 'optional',
      style: { opacity: 0.5 },
    });
    expect(required.props).toEqual({ label: 'required', style: { width: 20 } });
    expect(direct.props).toEqual({ label: 'direct', style: { width: 30 } });
  });

  it('normalizes, resolves percentages, and invokes the primitive renderer with program props', async () => {
    interface ProbeStyle extends SystemStyle {
      width: Length;
      height?: number;
    }
    interface NormalizedProbeStyle extends SystemStyle {
      width: Length;
      height: number;
    }
    interface ResolvedProbeStyle extends SystemStyle {
      width: number;
      height: number;
    }
    const calls: unknown[] = [];
    const normalizeStyle = vi.fn((style: Readonly<ProbeStyle>) => ({
      ...style,
      height: style.height ?? 12,
    }));
    const resolveStyle = vi.fn((
      style: Readonly<NormalizedProbeStyle>,
      context: { allocation: Readonly<{ width: number }> },
    ) => ({
      ...style,
      width: typeof style.width === 'number' ? style.width :
        context.allocation.width * Number.parseFloat(style.width) / 100,
    }));
    const StyleProbe = definePrimitive<
      { value: number },
      ProbeStyle,
      NormalizedProbeStyle,
      ResolvedProbeStyle
    >(function renderStyleProbe(props, style, context) {
      calls.push({ props, style, canvas: context.canvas });
    }, { normalizeStyle, resolveStyle });
    const specified = { width: '50%' } as const;
    const canvas = createCanvas(300, 80);
    const controller = crc(
      canvas,
      <StyleProbe value={7} style={specified} />,
    );
    await nextFrame();

    expect(calls).toEqual([{
      props: { value: 7 },
      style: { width: 150, height: 12 },
      canvas,
    }]);
    expect(normalizeStyle).toHaveBeenCalledWith(specified);
    expect(resolveStyle).toHaveBeenCalledOnce();
    expect(Object.keys(StyleProbe)).toEqual([]);
    expect(Object.prototype.hasOwnProperty.call(StyleProbe, 'normalizeStyle'))
      .toBe(false);
    expect(Object.prototype.hasOwnProperty.call(StyleProbe, 'resolveStyle'))
      .toBe(false);
    controller.dispose();
  });

  it('rejects allocation syntax leaked by an untyped resolver before rendering', () => {
    const render = vi.fn();
    const UnsafeDefine = definePrimitive as any;
    const Leaky = UnsafeDefine(render, {
      resolveStyle: (style: any) => style,
    });
    const canvas = createCanvas();
    let pending: FrameRequestCallback | undefined;
    const request = vi.spyOn(window, 'requestAnimationFrame')
      .mockImplementation(callback => {
        pending = callback;
        return 1;
      });
    const controller = crc(canvas, createElement(Leaky, {
      style: { radius: '50%' },
    }));

    expect(() => pending?.(0)).toThrowError(/radius.*50%.*resolve/i);
    expect(render).not.toHaveBeenCalled();
    controller.dispose();
    request.mockRestore();
  });

  it('reports direct primitive invocation with both supported construction forms', () => {
    const DirectProbe = definePrimitive(function renderDirectProbe() {});

    expect(() => DirectProbe({})).toThrowError(
      'DirectProbe is a CRC component and was invoked outside the CRC renderer.\n' +
      'Use <DirectProbe ... /> in a CRC JSX file or ' +
      'createElement(DirectProbe, props).',
    );
  });

  it('requires an explicit resolver for allocation-dependent declared style', () => {
    interface PercentageStyle extends SystemStyle {
      radius: `${number}%`;
    }
    interface NumericStyle extends SystemStyle {
      radius: number;
    }

    // @ts-expect-error percentage-capable style requires resolveStyle
    definePrimitive<{}, PercentageStyle>(function renderUnresolved() {});
    definePrimitive<
      {},
      PercentageStyle,
      PercentageStyle,
      PercentageStyle
    >(function renderStillUnresolved() {},
      // @ts-expect-error resolved style may not retain allocation syntax
      {
        resolveStyle: (style: PercentageStyle) => style,
      },
    );
    const Resolved = definePrimitive<
      {},
      PercentageStyle,
      PercentageStyle,
      NumericStyle
    >(function renderResolved(_props, style) {
      const radius: number = style.radius;
      void radius;
    }, {
      resolveStyle: style => ({ radius: Number.parseFloat(style.radius) }),
    });

    const resolved = <Resolved style={{ radius: '50%' }} />;
    expect((resolved.props as { style: PercentageStyle }).style.radius)
      .toBe('50%');
  });
});

describe('primitive pure measurement', () => {
  it('reports plain functions as unsupported intrinsic measurement', () => {
    function Plain(): void {}

    expect(measureElement(<Plain />, constraints, service)).toEqual({
      status: 'unsupported',
      reason: 'Plain does not provide measurement',
    });
  });

  it('normalizes and measures without invoking render or exposing style in props', () => {
    interface MeasureStyle extends SystemStyle {
      label?: string;
    }
    interface NormalizedMeasureStyle extends SystemStyle {
      label: string;
    }
    const render = vi.fn();
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
      MeasureStyle,
      NormalizedMeasureStyle
    >(render, {
      normalizeStyle: () => ({ label: 'normalized' }),
      measure,
    });
    const element = <Measured value={7} />;

    expect(measureElement(element, constraints, service)).toEqual({
      status: 'measured',
      size: { width: 40, height: 20 },
    });
    expect(render).not.toHaveBeenCalled();
    expect(measure).toHaveBeenCalledOnce();
    expect(Object.prototype.hasOwnProperty.call(Measured, 'measure')).toBe(false);
  });

  it('supports nested primitive measurement', () => {
    const Child = definePrimitive<{ value: number }>(
      function renderMeasuredChild() {},
      {
        measure: ({ props }) => ({
          status: 'measured',
          size: { width: props.value, height: 10 },
        }),
      },
    );
    const child = <Child value={24} />;
    const Parent = definePrimitive(function renderMeasuredParent() {}, {
      measure: input => input.measureElement(child, constraints),
    });

    expect(measureElement(<Parent />, constraints, service)).toEqual({
      status: 'measured',
      size: { width: 24, height: 10 },
    });
  });

  it('diagnoses primitive measurement cycles and remains usable afterward', () => {
    let directElement: CRCElement;
    const Direct = definePrimitive(function renderDirectCycle() {}, {
      measure: (input): MeasureResult =>
        input.measureElement(directElement, constraints),
    });
    directElement = <Direct />;

    let aElement: CRCElement;
    let bElement: CRCElement;
    const A = definePrimitive(function renderCycleA() {}, {
      measure: (input): MeasureResult =>
        input.measureElement(bElement, constraints),
    });
    const B = definePrimitive(function renderCycleB() {}, {
      measure: (input): MeasureResult =>
        input.measureElement(aElement, constraints),
    });
    aElement = <A />;
    bElement = <B />;

    for (const element of [directElement, aElement]) {
      expect(() => measureElement(element, constraints, service))
        .toThrowError(LayoutDiagnostic);
      expect(() => measureElement(element, constraints, service))
        .toThrowError(/cyclic measurement/i);
    }

    const Valid = definePrimitive(function renderValidMeasurement() {}, {
      measure: () => ({
        status: 'measured',
        size: { width: 1, height: 2 },
      }),
    });
    expect(measureElement(<Valid />, constraints, service)).toEqual({
      status: 'measured',
      size: { width: 1, height: 2 },
    });
  });
});

function createCanvas(width = 300, height = 150): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  document.body.appendChild(canvas);
  return canvas;
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
