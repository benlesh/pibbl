import {
  Absolute, Flow, Layer, Rectangle, Text, pibbl, definePrimitive, signal, type PibblController, type SystemStyle,
  type PibblResponsiveStyle, type RectStyle,
} from '@pibbl/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signalGraphSnapshot } from '../src/lib/signals/graph';
import { responsiveStyleSnapshot } from '../src/lib/style/responsive';
import { installSchedulerDriverForTest, ManualSchedulerDriver } from '../src/lib/scheduler/testing';

let driver: ManualSchedulerDriver;
let restore: () => void;
const controllers: PibblController[] = [];
beforeEach(() => {
  driver = new ManualSchedulerDriver();
  restore = installSchedulerDriverForTest(driver);
});
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.dispose();
  restore();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
function mount(tree: Parameters<typeof pibbl>[1]) {
  const canvas = document.createElement('canvas');
  canvas.width = 700;
  canvas.height = 160;
  document.body.append(canvas);
  const controller = pibbl(canvas, tree, { pixelRatio: 1 });
  controllers.push(controller);
  driver.flush(1);
  return controller;
}

describe('responsive style work and ownership', () => {
  it.each(['render', 'layout'] as const)('identifies %s query preparation in diagnostics', (algorithm) => {
    const invalid = <Rectangle style={{ width: 10, height: 10, when: [
      { query: { minWidth: -1 }, style: { fill: 'red' } },
    ] }} />;
    expect(() => mount(algorithm === 'layout' ? <Absolute>{invalid}</Absolute> : invalid)).toThrow(`during ${algorithm};`);
  });
  it('keeps queries local to nested Layers and preserves 99 clean sibling surfaces', () => {
    const width = signal(80);
    const active = signal('red');
    const inactive = signal('blue');
    const values = Array.from({ length: 100 }, () => '');
    const renders = Array.from({ length: 100 }, () => 0);
    const Probe = definePrimitive<{ index: number }, SystemStyle & { color?: string }>(
      ({ index }, style) => {
        renders[index]++;
        values[index] = style.color!;
        return <Rectangle style={{ width: 4, height: 4, fill: style.color }} />;
      },
    );
    const nodes = Array.from({ length: 100 }, (_, index) => {
      const child = <Layer style={{ width: index === 0 ? width : 80, height: 60 }}>
        <Probe index={index} style={{ color: 'black', when: [
          { query: { minWidth: 50, minHeight: 50 }, style: { color: index === 0 ? active : 'red' } },
          { query: { maxWidth: 49 }, style: { color: inactive } },
          { query: { minWidth: 500 }, style: { color: 'green' } },
        ] }} />
      </Layer>;
      return index === 0 ? <Layer style={{ width: 200, height: 160 }}>{child}</Layer> : child;
    });
    const draws = vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage');
    const offscreenDraws = vi.spyOn(OffscreenCanvasRenderingContext2D.prototype, 'drawImage');
    const before = signalGraphSnapshot();
    const controller = mount(nodes);
    const surfaces = () => new Set([...draws.mock.calls, ...offscreenDraws.mock.calls].map(call => call[0]));
    const initial = surfaces();
    expect(initial.size).toBe(101);
    expect(values).toEqual(Array.from({ length: 100 }, () => 'red'));
    renders.fill(0);
    draws.mockClear();
    offscreenDraws.mockClear();
    active.set('orange');
    driver.flush(2);
    expect(renders).toEqual([1, ...Array.from({ length: 99 }, () => 0)]);
    expect(surfaces()).toEqual(initial);
    width.set(40);
    driver.flush(3);
    expect(values[0]).toBe('blue');
    active.set('purple');
    expect(driver.pendingHostFrames).toBe(0);
    inactive.set('yellow');
    driver.flush(4);
    expect(values[0]).toBe('yellow');
    width.set(80);
    driver.flush(5);
    expect(values[0]).toBe('purple');
    controller.dispose();
    expect(signalGraphSnapshot().rendererEdges).toBe(before.rendererEdges);
    expect(signalGraphSnapshot().receiverInputProvisions).toBe(before.receiverInputProvisions);
    inactive.set('pink');
    expect(driver.pendingHostFrames).toBe(0);
  });

  it('releases preinspection signal reads when a later queried item requires intrinsic measurement', () => {
    const fill = signal('red');
    const before = signalGraphSnapshot();
    expect(() => mount(<Flow>
      <Rectangle style={{ width: 10, height: 10, when: [{ query: { minWidth: 0 }, style: { fill } }] }} />
      <Text style={{ when: [{ query: { minWidth: 0 }, style: { lineHeight: 20 } }] }}>unsupported</Text>
    </Flow>)).toThrow('PIBBL_STYLE_QUERY_MEASUREMENT');
    const after = signalGraphSnapshot();
    expect(after.rendererEdges).toBe(before.rendererEdges);
    expect(after.rendererConsumers).toBe(before.rendererConsumers);
    expect(after.receiverInputProvisions).toBe(before.receiverInputProvisions);
    fill.set('blue');
    expect(driver.pendingHostFrames).toBe(0);
  });

  it('cleans up a failed query root while an independent root completes its update', () => {
    const baseline = signalGraphSnapshot();
    const badFill = signal('red');
    const badStyle = signal<PibblResponsiveStyle<RectStyle>>({ width: 10, height: 10, when: [
      { query: { minWidth: 0 }, style: { fill: badFill } },
    ] });
    const failing = mount(<Rectangle style={badStyle} />);
    const goodFill = signal('black');
    const seen: string[] = [];
    const Probe = definePrimitive<{}, SystemStyle & { color: string }>(
      (_props, style) => { seen.push(style.color); },
    );
    const healthy = mount(<Probe style={{ color: goodFill, when: [
      { query: { minWidth: 0 }, style: {} },
    ] }} />);
    badStyle.set({ width: 10, height: 10, when: [
      { query: { minWidth: -1 }, style: { fill: badFill } },
    ] });
    goodFill.set('green');
    expect(() => driver.flush(2)).toThrow('PIBBL_STYLE_QUERY_BOUND');
    expect(seen).toEqual(['black', 'green']);
    expect(signalGraphSnapshot().receiverInputProvisions).toBe(baseline.receiverInputProvisions);
    expect(signalGraphSnapshot().rendererEdges).toBe(baseline.rendererEdges + 1);
    badFill.set('blue');
    expect(driver.pendingHostFrames).toBe(0);
    goodFill.set('yellow');
    driver.flush(3);
    expect(seen).toEqual(['black', 'green', 'yellow']);
    failing.dispose();
    healthy.dispose();
    expect(signalGraphSnapshot().rendererEdges).toBe(baseline.rendererEdges);
    expect(signalGraphSnapshot().rendererConsumers).toBe(baseline.rendererConsumers);
    badStyle.set({ width: 20, height: 20 });
    goodFill.set('pink');
    expect(driver.pendingHostFrames).toBe(0);
  });

  it('does not rematch a width- or height-changing patch against its resulting allocation', () => {
    const seen: Array<{ width: number; height: number }> = [];
    const Probe = definePrimitive<{}, SystemStyle & { width: number; height: number }>(
      (_props, style) => { seen.push({ width: style.width, height: style.height }); },
    );
    mount(<Absolute><Probe style={{ width: 700, height: 160, when: [
      { query: { minWidth: 600, minHeight: 150 }, style: { width: 300, height: 40 } },
    ] }} /></Absolute>);
    expect(seen).toEqual([{ width: 300, height: 40 }]);
    expect(driver.pendingHostFrames).toBe(0);
  });

  it.each([8, 16])('keeps %i-rule preparation linear with one merge and exact teardown', ruleCount => {
    const fill = signal('red');
    const read = vi.spyOn(fill, 'get');
    const before = responsiveStyleSnapshot();
    const graph = signalGraphSnapshot();
    const controller = mount(<Absolute><Rectangle style={{ width: 10, height: 10, when:
      Array.from({ length: ruleCount }, (_, index) => ({
        query: { minWidth: index, maxHeight: 200 }, style: { fill },
      })),
    }} /></Absolute>);
    const after = responsiveStyleSnapshot();
    expect(after.preparations - before.preparations).toBe(1);
    expect(after.rules - before.rules).toBe(ruleCount);
    expect(after.patchFields - before.patchFields).toBe(ruleCount);
    expect(after.mergeCopies - before.mergeCopies).toBe(1);
    expect(read).toHaveBeenCalledTimes(ruleCount);
    expect(signalGraphSnapshot().rendererEdges - graph.rendererEdges).toBe(1);
    const canvas = document.querySelector('canvas')!;
    expect(Array.from(canvas.getContext('2d')!.getImageData(0, 0, 1, 1).data)).toEqual([255, 0, 0, 255]);
    controller.dispose();
    expect(signalGraphSnapshot().rendererEdges).toBe(graph.rendererEdges);
    expect(signalGraphSnapshot().receiverInputProvisions).toBe(graph.receiverInputProvisions);
    fill.set('blue');
    expect(driver.pendingHostFrames).toBe(0);
  });

  it('does no query work or input copies for 1,000 ordinary rectangles', () => {
    const before = responsiveStyleSnapshot();
    const graph = signalGraphSnapshot();
    mount(<Absolute>{Array.from({ length: 1000 }, (_, key) =>
      <Rectangle key={key} style={{ width: 10, height: 10 }} />,
    )}</Absolute>);
    expect(responsiveStyleSnapshot()).toEqual(before);
    const after = signalGraphSnapshot();
    expect(after.shallowInputCopies).toBe(graph.shallowInputCopies);
    expect(after.rendererEdges).toBe(graph.rendererEdges);
    expect(after.rendererConsumers).toBe(graph.rendererConsumers);
    expect(after.receiverInputProvisions).toBe(graph.receiverInputProvisions);
    expect(driver.pendingHostFrames).toBe(0);
  });

  it('prepares 1,000 queried receivers once and releases exclusive branch edges on exit and disposal', () => {
    const width = signal(700);
    const base = signal('black');
    const active = signal('red');
    const overridden = signal('orange');
    const inactive = signal('blue');
    const reads = [base, active, overridden, inactive].map(value => vi.spyOn(value, 'get'));
    const style = signal<PibblResponsiveStyle<RectStyle>>({ width: 10, height: 10, fill: base, when: [
      { query: { minWidth: 600 }, style: { fill: overridden } },
      { query: { minHeight: 100 }, style: { fill: active } },
      { query: { maxWidth: 599 }, style: { fill: inactive } },
      { query: { maxHeight: 50 }, style: { fill: inactive } },
    ] });
    const whole = vi.spyOn(style, 'get');
    function Scene() {
      return <Absolute style={{ width: width.get(), height: 160 }}>
        {Array.from({ length: 1000 }, (_, key) => <Rectangle key={key} style={style} />)}
      </Absolute>;
    }
    const before = responsiveStyleSnapshot();
    const graph = signalGraphSnapshot();
    const controller = mount(<Scene />);
    const after = responsiveStyleSnapshot();
    expect(after.preparations - before.preparations).toBe(1000);
    expect(after.rules - before.rules).toBe(4000);
    expect(after.mergeCopies - before.mergeCopies).toBe(1000);
    expect(after.patchFields - before.patchFields).toBe(2000);
    expect(whole).toHaveBeenCalledTimes(1000);
    for (const read of reads.slice(0, 3)) expect(read).toHaveBeenCalledTimes(1000);
    expect(reads[3]).not.toHaveBeenCalled();
    inactive.set('purple');
    expect(driver.pendingHostFrames).toBe(0);
    const requests = driver.requestCount;
    for (let index = 0; index < 1000; index++) active.set(`rgb(${index % 255}, 0, 0)`);
    expect(driver.requestCount - requests).toBe(1);
    driver.flush(2);
    width.set(320);
    driver.flush(3);
    overridden.set('pink');
    expect(driver.pendingHostFrames).toBe(0);
    inactive.set('green');
    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(4);
    controller.dispose();
    const disposed = signalGraphSnapshot();
    expect(disposed.rendererEdges).toBe(graph.rendererEdges);
    expect(disposed.rendererConsumers).toBe(graph.rendererConsumers);
    expect(disposed.receiverInputProvisions).toBe(graph.receiverInputProvisions);
    width.set(700);
    active.set('white');
    inactive.set('yellow');
    expect(driver.pendingHostFrames).toBe(0);
  });
});
