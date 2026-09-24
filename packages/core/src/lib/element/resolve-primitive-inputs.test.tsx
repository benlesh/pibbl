import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  Rectangle,
  crc,
  definePrimitive,
  resolveSignalValue,
  signal,
  type SignalValue,
} from '../../index.js';
import { clearSharedState, getCRCInstance } from '../global-state.js';
import {
  getPrimitiveDefinition,
  getPrimitiveProgramProps,
} from './metadata.js';
import { resolvePrimitiveInputs } from './resolve-primitive-inputs.js';
import { signalGraphSnapshot } from '../signals/graph.js';
import type { Signal } from '../signals/types.js';
import type { SystemStyle } from '../types.js';

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(() => {
  clearSharedState();
  document.body.replaceChildren();
});

describe('primitive signal-valued inputs', () => {
  it('attributes direct signal fields to the primitive receiver', async () => {
    const x = signal(10);
    const canvas = createCanvas();
    const Outer = (_props: {}) => (
      <Rectangle style={{ x, width: 20, height: 20 }} />
    );
    const baseline = signalGraphSnapshot();
    const controller = crc(canvas, <Outer />);
    await nextFrame();
    const refs = Array.from(getCRCInstance(canvas).refs.values());

    expect(refs.find(ref => ref.element.type === Outer)?.signalConsumer)
      .toBeUndefined();
    expect(refs.find(ref => ref.element.type === Rectangle)?.signalConsumer)
      .toBeDefined();
    expect(signalGraphSnapshot().rendererEdges).toBe(
      baseline.rendererEdges + 1,
    );

    controller.dispose();
    expect(signalGraphSnapshot().rendererEdges).toBe(baseline.rendererEdges);
  });

  it('attributes explicit get props to the enclosing component', async () => {
    const x = signal(10);
    const canvas = createCanvas();
    const Outer = (_props: {}) => (
      <Rectangle style={{ x: x.get(), width: 20, height: 20 }} />
    );
    const controller = crc(canvas, <Outer />);
    await nextFrame();
    const refs = Array.from(getCRCInstance(canvas).refs.values());

    expect(refs.find(ref => ref.element.type === Outer)?.signalConsumer)
      .toBeDefined();
    expect(refs.find(ref => ref.element.type === Rectangle)?.signalConsumer)
      .toBeUndefined();
    controller.dispose();
  });

  it('deduplicates shared style and prop reads and copies only signal inputs', async () => {
    interface ProbeStyle extends SystemStyle {
      x?: number;
    }
    const shared = signal(10);
    const wholeStyle = signal({ x: shared });
    const observations: unknown[] = [];
    const Probe = definePrimitive<{ value: number }, ProbeStyle>(
      function renderInputProbe(props, style) {
        observations.push({ props, style });
      },
    );
    const before = signalGraphSnapshot();
    const controller = crc(createCanvas(), (
      <Probe value={shared} style={wholeStyle} />
    ));
    await nextFrame();
    const after = signalGraphSnapshot();

    expect(observations).toEqual([{ props: { value: 10 }, style: { x: 10 } }]);
    expect(after.rendererEdges - before.rendererEdges).toBe(2);
    expect(after.signalInputResolutions - before.signalInputResolutions).toBe(3);
    expect(after.shallowInputCopies - before.shallowInputCopies).toBe(2);
    controller.dispose();

    const plainBefore = signalGraphSnapshot();
    const plainController = crc(createCanvas(), (
      <Probe value={1} style={{ x: 2 }} />
    ));
    await nextFrame();
    const plainAfter = signalGraphSnapshot();
    expect(plainAfter.shallowInputCopies).toBe(plainBefore.shallowInputCopies);
    expect(plainAfter.rendererEdges).toBe(plainBefore.rendererEdges);
    plainController.dispose();
  });

  it('reuses the construction-time program props for plain primitive inputs', () => {
    const Probe = definePrimitive<{ value: number }>(
      function renderPlainInputProbe() {},
    );
    const element = <Probe value={1} style={{ custom: 'opaque' }} />;
    const definition = getPrimitiveDefinition(Probe);
    if (!definition) throw new Error('Probe primitive definition is missing.');
    const programProps = getPrimitiveProgramProps(element);

    const first = resolvePrimitiveInputs(element, definition);
    const second = resolvePrimitiveInputs(element, definition);

    expect(first.props).toBe(programProps);
    expect(second.props).toBe(programProps);
    expect(first.props).toEqual({ value: 1 });
  });

  it('treats a whole optional style signal resolving undefined as no style', async () => {
    const wholeStyle = signal<SystemStyle | undefined>(undefined);
    const observations: unknown[] = [];
    const Probe = definePrimitive<{}, SystemStyle>((_props, style) => {
      observations.push(style);
    });
    const controller = crc(createCanvas(), <Probe style={wholeStyle} />);
    await nextFrame();

    expect(observations).toEqual([{}]);
    controller.dispose();
  });

  it('resolves handlers as values and keeps nested or exact signals opaque', async () => {
    const handlerCalls: string[] = [];
    const handler = signal(() => handlerCalls.push('called'));
    const nested = signal(3);
    const exact = signal(4);
    const observations: unknown[] = [];
    const Probe = definePrimitive<{
      handler: () => void;
      data: { nested: Signal<number> };
      valueSignal: Signal<number>;
    }>(function renderOpaqueInputProbe(props) {
      observations.push(props);
    }, { preserveSignalProps: ['valueSignal'] });
    const baseline = signalGraphSnapshot();
    const controller = crc(createCanvas(), (
      <Probe
        handler={handler}
        data={{ nested }}
        valueSignal={exact}
        style={{ custom: { nested } }}
      />
    ));
    await nextFrame();

    expect(handlerCalls).toEqual([]);
    expect(observations).toEqual([{
      handler: handler.get(),
      data: { nested },
      valueSignal: exact,
    }]);
    expect(signalGraphSnapshot().rendererEdges - baseline.rendererEdges).toBe(1);
    controller.dispose();
  });

  it('preserves optional exact signal props when present', async () => {
    const exact = signal(4);
    const observations: unknown[] = [];
    const Probe = definePrimitive<{ valueSignal?: Signal<number> }>(
      function renderOptionalExactSignal(props) {
        observations.push(props.valueSignal);
      },
      { preserveSignalProps: ['valueSignal'] },
    );
    const controller = crc(createCanvas(), <Probe valueSignal={exact} />);
    await nextFrame();

    expect(observations).toEqual([exact]);
    controller.dispose();
  });

  it('uses a signal-valued built-in event handler after receiver resolution', async () => {
    const calls: string[] = [];
    const onClick = signal(() => calls.push('clicked'));
    const canvas = createCanvas();
    const controller = crc(canvas, (
      <Rectangle
        onClick={onClick}
        style={{ x: 0, y: 0, width: 20, height: 20, fill: 'red' }}
      />
    ));
    await nextFrame();

    dispatchMouse(canvas, 'mousedown', 10, 10);
    dispatchMouse(canvas, 'mouseup', 10, 10);
    dispatchMouse(canvas, 'click', 10, 10);

    expect(calls).toEqual(['clicked']);
    controller.dispose();
  });

  it('lets custom components resolve one level and own that read', async () => {
    const inner = signal(7);
    const outer = signal(inner);
    let resolved: Signal<number> | undefined;
    const Gauge = (props: { value: SignalValue<Signal<number>> }) => {
      resolved = resolveSignalValue(props.value);
      return <Rectangle style={{ width: 1, height: 1 }} />;
    };
    const baseline = signalGraphSnapshot();
    const canvas = createCanvas();
    const controller = crc(canvas, <Gauge value={outer} />);
    await nextFrame();
    const gaugeRefs = Array.from(getCRCInstance(canvas).refs.values())
      .find(ref => ref.element.type === Gauge);

    expect(resolved).toBe(inner);
    expect(gaugeRefs?.signalConsumer).toBeDefined();
    expect(signalGraphSnapshot().rendererEdges - baseline.rendererEdges).toBe(1);
    controller.dispose();
  });
});

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 60;
  document.body.append(canvas);
  return canvas;
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function dispatchMouse(
  canvas: HTMLCanvasElement,
  type: 'click' | 'mousedown' | 'mouseup',
  x: number,
  y: number,
): void {
  const bounds = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: bounds.left + x,
    clientY: bounds.top + y,
  }));
}
