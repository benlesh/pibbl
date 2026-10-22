import { WasmFlexNestedIntrinsicExample } from '../../scenarios/src/learning/layout/wasm-flex-nested-intrinsic.example';
import { afterEach, expect, it } from 'vitest';
import { defineLayoutComponent, Flex, Text, Rectangle, signal, measureElement, useConst, useReaction, useCanvasContext, useLayoutBox, type FlexStyle, type PibblController } from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
import { experimentalLayout } from '../src/lib/layout/wasm/region';

let controller: PibblController | undefined;
afterEach(() => { controller?.dispose(); controller = undefined; document.body.replaceChildren(); });
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
it.runIf(experimentalLayout)('prepares a reusable Card once and moves its footer geometry and target with text', async () => {
  const target = document.createElement('canvas'); target.width = 400; target.height = 400;
  document.body.append(target);
  const title = signal('One short title');
  let descriptions = 0;
  const Card = defineLayoutComponent((props: { title(): string; style: FlexStyle }) => {
    descriptions++;
    return <Flex style={{ ...props.style, flexDirection: 'column', padding: 8, gap: 4 }}>
      <Text style={{ minHeight: 0, flexShrink: 0, wrap: true, font: '16px monospace', lineHeight: 20 }}>{props.title()}</Text>
    </Flex>;
  });
  let hits = 0;
  controller = pibblSync(target, <Flex style={{ width: 180, height: 380, flexDirection: 'column', gap: 12 }}>
    <Card title={() => title.get()} style={{ width: 164, minHeight: 0, flexShrink: 0 }} />
    <Rectangle onClick={() => hits++} style={{ width: 180, height: 24, minHeight: 0, flexShrink: 0, fill: '#426b61' }} />
  </Flex>);
  await nextFrame();
  const footerTop = () => {
    const context = target.getContext('2d')!;
    for (let y = 0; y < 400; y++) {
      const value = context.getImageData(5, y, 1, 1).data;
      if (value[0] === 66 && value[1] === 107 && value[2] === 97 && value[3] === 255) return y;
    }
    throw new Error('Footer did not paint');
  };
  const original = footerTop();
  expect(descriptions).toBe(1);
  title.set('A much longer reusable Card title wraps across several lines and changes the following footer allocation.');
  await nextFrame();
  const moved = footerTop();
  expect(moved).toBeGreaterThan(original + 20);
  expect(descriptions).toBe(2);
  function click(y: number) {
    const bounds = target.getBoundingClientRect();
    for (const type of ['mousedown', 'mouseup', 'click']) target.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: bounds.left + 5, clientY: bounds.top + y }));
  }
  click(original + 5); expect(hits).toBe(0);
  click(moved + 5); expect(hits).toBe(1);
});

it.runIf(experimentalLayout)('exposes the reusable Card in the nested public example', async () => {
  const target = document.createElement('canvas'); target.width = 760; target.height = 460;
  document.body.append(target);
  controller = pibblSync(target, <WasmFlexNestedIntrinsicExample />);
  await nextFrame();
  async function click(x: number, y: number) {
    const bounds = target.getBoundingClientRect();
    for (const type of ['mousedown', 'mouseup', 'click']) target.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: bounds.left + x, clientY: bounds.top + y }));
    await nextFrame();
    await new Promise(resolve => setTimeout(resolve, 120));
    return JSON.parse(document.querySelector('pre')!.textContent!);
  }
  const initial = await click(620, 40);
  expect(initial.structuralCard).toBe(true);
  expect(initial.descriptions).toBe(1);
  const narrow = await click(60, 110);
  expect(narrow.footerBox.y).toBeGreaterThan(initial.footerBox.y);
  expect(narrow.descriptions).toBe(initial.descriptions + 1);
  expect(narrow.layout.nodeCreates).toBe(initial.layout.nodeCreates);
  expect(narrow.probeRenders).toBe(initial.probeRenders + 1);
  expect((await click(40, initial.footerBox.y + 5)).footerHits).toBe(0);
  expect((await click(40, narrow.footerBox.y + 5)).footerHits).toBe(1);
  const short = await click(240, 110);
  expect(short.footerBox.y).toBeLessThan(narrow.footerBox.y);
  expect(short.footerBox.y).toBe(short.cardBottom + 12);
});

const constraints = { minWidth: 0, maxWidth: 200, minHeight: 0, maxHeight: 200 };
const service = { measureText: (value: string) => ({ width: value.length * 10 } as TextMetrics) };
it('provides the same pure description operation in ordinary builds with definite roots', () => {
  const Card = defineLayoutComponent(() => <Flex style={{ width: 120, height: 60 }}>{null}</Flex>);
  expect(measureElement(<Card />, constraints, service)).toEqual({ status: 'measured', size: { width: 120, height: 60 } });
});
it.each([
  { name: 'state hooks', callback: () => useConst(() => 0), error: /Hooks are forbidden/ },
  { name: 'Canvas reads', callback: () => useCanvasContext(), error: /only during Pibbl rendering/ },
  { name: 'allocation reads', callback: () => useLayoutBox(), error: /No Pibbl layout context/ },
  { name: 'signal writes', callback: () => signal(0).set(1), error: /Signal writes are forbidden/ },
])('rejects $name while preparing a description', ({ callback, error }) => {
  const Bad = defineLayoutComponent(() => { callback(); return <Rectangle style={{ width: 20, height: 20 }} />; });
  expect(() => measureElement(<Bad />, constraints, service)).toThrow(error);
});
it('requires a single known root without invoking an ordinary component', () => {
  let ordinaryCalls = 0;
  function Ordinary() { ordinaryCalls++; return <Rectangle style={{ width: 20, height: 20 }} />; }
  const Bad = defineLayoutComponent(() => <Ordinary />);
  expect(() => measureElement(<Bad />, constraints, service)).toThrow(/one drawing or layout primitive root/);
  expect(ordinaryCalls).toBe(0);
});

it('keeps Card identity while a changed root key remounts owned descendants', async () => {
  const target = document.createElement('canvas'); target.width = 100; target.height = 100;
  document.body.append(target);
  const key = signal('first');
  let mounts = 0, cleanups = 0;
  function OwnedChild({ style: _style }: { style: FlexStyle }) {
    useConst(() => ++mounts);
    useReaction(() => () => { cleanups++; }, []);
    return <Rectangle style={{ width: 10, height: 10, fill: '#426b61' }} />;
  }
  const Card = defineLayoutComponent(() => <Flex key={key.get()} style={{ width: 40, height: 40 }}>
    <OwnedChild style={{ width: 10, height: 10, minWidth: 0, flexShrink: 0 }} />
  </Flex>);
  controller = pibblSync(target, <Card />);
  await nextFrame();
  expect(mounts).toBe(1);
  key.set('second');
  await nextFrame();
  expect(mounts).toBe(2);
  expect(cleanups).toBe(1);
  controller.dispose(); controller = undefined;
  expect(cleanups).toBe(2);
});
