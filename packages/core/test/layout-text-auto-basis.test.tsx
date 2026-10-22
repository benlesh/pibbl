import { WasmFlexTextExample } from '../../scenarios/src/learning/layout/wasm-flex-text.example';
import { afterEach, expect, it } from 'vitest';
import { Flex, Rectangle, Text, signal, type PibblController } from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
import { experimentalLayout } from '../src/lib/layout/wasm/region';

let controller: PibblController | undefined;
afterEach(() => { controller?.dispose(); controller = undefined; document.body.replaceChildren(); });
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
it.runIf(experimentalLayout)('uses natural Text width for an automatic row basis and then respects its word floor', async () => {
  const target = document.createElement('canvas'); target.width = 400; target.height = 100;
  document.body.append(target);
  const context = target.getContext('2d')!;
  context.font = '20px monospace';
  const naturalWidth = context.measureText('alpha beta').width;
  const wordWidth = context.measureText('alpha').width;
  const width = signal(300);
  controller = pibblSync(target, <>
    <Flex style={{ width, height: 40, alignItems: 'flex-start' }}>
      <Text style={{ minWidth: 0, wrap: true, font: '20px monospace', lineHeight: 24 }}>alpha beta</Text>
      <Rectangle style={{ width: 60, height: 30, minWidth: 0, flexShrink: 0, fill: '#426b61' }} />
    </Flex>
    <Flex style={{ top: 50, width, height: 40, alignItems: 'flex-start' }}>
      <Text style={{ wrap: true, font: '20px monospace', lineHeight: 24 }}>alpha beta</Text>
      <Rectangle style={{ width: 60, height: 30, minWidth: 0, flexShrink: 0, fill: '#426b61' }} />
    </Flex>
  </>);
  await nextFrame();
  const pixel = (x: number, y: number) => Array.from(context.getImageData(x, y, 1, 1).data);
  expect(pixel(Math.ceil(naturalWidth) + 5, 10)).toEqual([66, 107, 97, 255]);
  expect(pixel(Math.ceil(naturalWidth) + 5, 60)).toEqual([66, 107, 97, 255]);
  expect(pixel(250, 10)).toEqual([0, 0, 0, 0]);
  width.set(100);
  await nextFrame();
  expect(wordWidth).toBeGreaterThan(40);
  expect(pixel(45, 10)).toEqual([66, 107, 97, 255]);
  expect(pixel(45, 60)).not.toEqual([66, 107, 97, 255]);
  expect(pixel(Math.ceil(wordWidth) + 5, 60)).toEqual([66, 107, 97, 255]);
});

it.runIf(experimentalLayout)('exposes natural basis and text changes in the existing comparison example', async () => {
  const target = document.createElement('canvas'); target.width = 760; target.height = 460;
  document.body.append(target);
  controller = pibblSync(target, <WasmFlexTextExample />);
  await nextFrame();
  function click(x: number, y: number) {
    const bounds = target.getBoundingClientRect();
    for (const type of ['mousedown', 'mouseup', 'click']) target.dispatchEvent(new MouseEvent(type, {
      bubbles: true, button: 0, clientX: bounds.left + x, clientY: bounds.top + y,
    }));
  }
  click(500, 40); // Comparison.
  await nextFrame();
  click(500, 110); // In comparison, switch numeric/automatic basis.
  await nextFrame();
  const context = target.getContext('2d')!;
  const pixel = (x: number, y: number) => Array.from(context.getImageData(x, y, 1, 1).data);
  expect(pixel(205, 290)).toEqual([66, 107, 97, 255]);
  click(50, 160); // Short word changes natural basis and minimum.
  await nextFrame();
  expect(pixel(90, 290)).toEqual([66, 107, 97, 255]);
  expect(pixel(205, 290)).not.toEqual([66, 107, 97, 255]);
  click(90, 290);
  await new Promise(resolve => setTimeout(resolve, 220));
  expect(document.querySelector('pre')?.textContent).toContain('selected: auto minimum sibling');
});

it.runIf(experimentalLayout)('uses the same leading-space behavior as wrapped Text for its natural basis', async () => {
  const target = document.createElement('canvas'); target.width = 400; target.height = 80;
  document.body.append(target);
  const context = target.getContext('2d')!;
  context.font = '20px monospace';
  const naturalWidth = context.measureText('alpha beta').width;
  const text = signal('   alpha beta');
  controller = pibblSync(target, <Flex style={{ width: 300, height: 40, alignItems: 'flex-start' }}>
    <Text style={{ minWidth: 0, wrap: true, font: '20px monospace', lineHeight: 24 }}>{text}</Text>
    <Rectangle style={{ width: 60, height: 30, minWidth: 0, flexShrink: 0, fill: '#426b61' }} />
  </Flex>);
  await nextFrame();
  const pixel = (x: number) => Array.from(context.getImageData(x, 10, 1, 1).data);
  expect(pixel(Math.ceil(naturalWidth) + 5)).toEqual([66, 107, 97, 255]);
  text.set('   ');
  await nextFrame();
  expect(pixel(5)).toEqual([66, 107, 97, 255]);
});
