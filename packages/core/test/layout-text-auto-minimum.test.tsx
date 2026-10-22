import { layoutFlex } from '../src/lib/layout/flex';
import { WasmFlexTextExample } from '../../scenarios/src/learning/layout/wasm-flex-text.example';
import { afterEach, expect, it } from 'vitest';
import { createElement, measureElement, Flex, Rectangle, Text, type PibblController } from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
import { experimentalLayout } from '../src/lib/layout/wasm/region';

let controller: PibblController | undefined;
afterEach(() => {
  controller?.dispose();
  controller = undefined;
  document.body.replaceChildren();
});
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

it.runIf(experimentalLayout)('protects a direct wrapped Text word by default and retains the explicit zero escape', async () => {
  const target = document.createElement('canvas');
  target.width = 400;
  target.height = 100;
  document.body.append(target);
  const word = 'MMMMMMMMMMMMMM';
  const context = target.getContext('2d')!;
  context.font = '20px monospace';
  const wordWidth = context.measureText(word).width;
  controller = pibblSync(target, <>
    <Flex style={{ width: 200, height: 40, alignItems: 'flex-start' }}>
      <Text style={{ flexBasis: 200, flexShrink: 1, minWidth: 0, wrap: true, font: '20px monospace', lineHeight: 24 }}>{word}</Text>
      <Rectangle style={{ width: 100, height: 30, minWidth: 0, flexShrink: 0, fill: '#426b61' }} />
    </Flex>
    <Flex style={{ top: 50, width: 200, height: 40, alignItems: 'flex-start' }}>
      <Text style={{ flexBasis: 200, flexShrink: 1, wrap: true, font: '20px monospace', lineHeight: 24 }}>{word}</Text>
      <Rectangle style={{ width: 100, height: 30, minWidth: 0, flexShrink: 0, fill: '#426b61' }} />
    </Flex>
  </>);
  await nextFrame();
  const pixel = (x: number, y: number) => Array.from(context.getImageData(x, y, 1, 1).data);
  expect(wordWidth).toBeGreaterThan(100);
  expect(pixel(110, 10)).toEqual([66, 107, 97, 255]);
  expect(pixel(110, 60)).not.toEqual([66, 107, 97, 255]);
  expect(pixel(Math.ceil(wordWidth) + 5, 60)).toEqual([66, 107, 97, 255]);
});

it.runIf(experimentalLayout)('shows automatic and explicit-zero Text rows in the public learning example', async () => {
  const target = document.createElement('canvas');
  target.width = 760; target.height = 460;
  document.body.append(target);
  controller = pibblSync(target, <WasmFlexTextExample />);
  await nextFrame();
  function click(x: number, y: number) {
    const bounds = target.getBoundingClientRect();
    for (const type of ['mousedown', 'mouseup', 'click']) target.dispatchEvent(new MouseEvent(type, {
      bubbles: true, button: 0, clientX: bounds.left + x, clientY: bounds.top + y,
    }));
  }
  click(500, 40); // Compare Text minimum.
  await nextFrame();
  click(60, 110); // Narrow rows from 360 to 120.
  await nextFrame();
  const context = target.getContext('2d')!;
  const pixel = (x: number, y: number) => Array.from(context.getImageData(x, y, 1, 1).data);
  expect(pixel(90, 400)).toEqual([66, 107, 97, 255]);
  expect(pixel(90, 290)).not.toEqual([66, 107, 97, 255]);
  expect(pixel(205, 290)).toEqual([66, 107, 97, 255]);
  click(205, 290);
  await new Promise(resolve => setTimeout(resolve, 220));
  expect(document.querySelector('pre')?.textContent).toContain('selected: auto minimum sibling');
  click(50, 160); // Text metric changes must update the automatic minimum too.
  await nextFrame();
  expect(pixel(90, 290)).toEqual([66, 107, 97, 255]);
});

const service = { measureText: (value: string) => ({ width: value.length * 10 } as TextMetrics) };
const measurement = { service, measureElement: (element: Parameters<typeof measureElement>[0], constraints: Parameters<typeof measureElement>[1]) => measureElement(element, constraints, service) };
it.runIf(experimentalLayout).each([
  { name: 'does not treat flexBasis as a width cap', limits: {}, expected: 80 },
  { name: 'caps the minimum at a numeric specified width', limits: { width: 30 }, expected: 30 },
  { name: 'caps the minimum at numeric maxWidth', limits: { maxWidth: 25 }, expected: 25 },
])('$name', ({ limits, expected }) => {
  const boxes = layoutFlex({ x: 0, y: 0, width: 50, height: 30 }, [
    createElement(Text, { children: 'aaa bbbbbbbb cc', style: { flexBasis: 20, flexShrink: 1, wrap: true, height: 10, ...limits } }),
    createElement(Rectangle, { style: { width: 10, height: 10, minWidth: 0, flexShrink: 0 } }),
  ], {}, measurement);
  expect(boxes[0].width).toBe(expected);
  expect(boxes[1].x).toBe(expected);
});
it.runIf(experimentalLayout)('keeps clipped Text outside the bounded automatic minimum', () => {
  expect(() => layoutFlex({ x: 0, y: 0, width: 50, height: 30 }, [
    createElement(Text, { children: 'unbreakable', style: { flexBasis: 20, flexShrink: 1, wrap: true, height: 10, fit: 'clip' } }),
  ], {}, measurement)).toThrow(/explicit main-axis minimum/);
});
