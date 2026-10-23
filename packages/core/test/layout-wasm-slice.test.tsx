import yogaReference from '../../../tooling/layout-yoga-rehearsal/reference.json';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createElement, Absolute, Overlay, Flex, Grid, Flow, Group, Clip, Text, Rectangle, measureElement, useLayoutBox, useConst, Layer, signal, computed, type PibblNode, type PibblNodeInput, type GridStyle, type FlexStyle, type RectStyle, defineLayoutComponent } from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { WasmFlexTextExample as mountWasmFlexTextComponent } from "../../scenarios/src/learning/layout/wasm-flex-text.example";
import { LayoutRegion, snapshotWasmLayoutDiagnostics, experimentalLayout } from '../src/lib/layout/wasm/region';
import { frozenFlexInputs } from '../src/lib/layout/flex-allocation-cache';
import { layoutFlex } from '../src/lib/layout/flex';
import { createExampleMount } from "../../scenarios/src/example-host";

const mountWasmFlexText = createExampleMount(mountWasmFlexTextComponent);


const service = { measureText: (value: string) => ({ width: value.length * 10 } as TextMetrics) };
const measurement = { service, measureElement: (element: Parameters<typeof measureElement>[0], constraints: Parameters<typeof measureElement>[1]) => measureElement(element, constraints, service) };

beforeAll(() => {
  if (experimentalLayout) prepareLayoutEngineSync();
});

describe('Flex/Text replacement contract', () => {
  it('remeasures wrapped height at the final shrunken width', () => {
    const text = () => createElement(Text, { children: 'aaaa aaaa aaaa aaaa', style: {
      flexBasis: 100, minWidth: 0, flexShrink: 1, wrap: true, lineHeight: 10,
    } });
    const boxes = layoutFlex({ x: 0, y: 0, width: 100, height: 100 }, [text(), text()], { alignItems: 'flex-start' }, measurement);
    expect(boxes).toEqual([
      { x: 0, y: 0, width: 50, height: 40 },
      { x: 50, y: 0, width: 50, height: 40 },
    ]);
  });
});

it('build lane matches the requested mode', () => expect(experimentalLayout).toBe(import.meta.env.MODE === 'layout-wasm'));
const controllers: { dispose(): void }[] = [];
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function clickCanvas(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) {
    canvas.dispatchEvent(new MouseEvent(type, {
      clientX: bounds.left + x, clientY: bounds.top + y, bubbles: true, button: 0,
    }));
  }
}
async function mountExample() {
  const canvas = document.createElement('canvas');
  canvas.width = 760; canvas.height = 460;
  document.body.append(canvas);
  const controller = mountWasmFlexText(canvas);
  controllers.push(controller);
  await nextFrame();
  return { canvas, controller };
}
afterEach(() => { for (const c of controllers.splice(0)) c.dispose(); document.body.replaceChildren(); vi.restoreAllMocks(); });
it('terminates for huge finite shrink factors', () => {
  const child = () => createElement(Rectangle, { style: { width: 80, height: 10, minWidth: 0, flexShrink: 1e308 } });
  expect(layoutFlex({ x: 0, y: 0, width: 100, height: 20 }, [child(), child()], {}, measurement).map(b => b.width)).toEqual([50, 50]);
});
it.runIf(experimentalLayout)('drives the exact public scenario through signals, reuses nodes, and releases arenas', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const { canvas, controller } = await mountExample();
  const initial = snapshotWasmLayoutDiagnostics();
  expect(initial.solves).toBeGreaterThan(baseline.solves);
  expect(initial.activeNodes - baseline.activeNodes).toBe(3);
  clickCanvas(canvas, 60, 110);
  await nextFrame();
  const resized = snapshotWasmLayoutDiagnostics();
  expect(resized.solves).toBeGreaterThan(initial.solves);
  expect(resized.measuredLeaves).toBeGreaterThan(initial.measuredLeaves);
  expect(resized.nodeCreates).toBe(initial.nodeCreates);
  clickCanvas(canvas, 250, 110);
  await nextFrame();
  const painted = snapshotWasmLayoutDiagnostics();
  expect(painted.frames).toBeGreaterThan(resized.frames);
  const rgba = canvas.getContext('2d')!.getImageData(0, 0, 760, 460).data;
  let coloredTextPixels = 0;
  for (let i = 0; i < rgba.length; i += 4) if (rgba[i] === 166 && rgba[i+1] === 55 && rgba[i+2] === 88) coloredTextPixels++;
  expect(coloredTextPixels).toBeGreaterThan(0);
  expect(painted.solves).toBe(resized.solves);
  expect(painted.measuredLeaves).toBe(resized.measuredLeaves);
  expect(painted.nodeCreates).toBe(initial.nodeCreates);
  controller.dispose();
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);
  expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
});

it.runIf(experimentalLayout)('renews output views after WASM growth and never accepts a failed revision', async () => {
  const { LayoutRegion } = await import('../src/lib/layout/wasm/region');
  const region = new LayoutRegion();
  const nodes = Array.from({ length: 1000 }, () => ({ baseMain: 80, minMain: 75, maxMain: Infinity, paddingMain: 0, grow: 0, shrink: 1, targetMain: 0, receiverToken: {} }));
  try {
    region.solve(nodes, 60000, 0);
    expect(nodes.every(n => n.targetMain === 75)).toBe(true);
    const bad = nodes.map(n => ({ ...n, baseMain: 1e308 }));
    expect(() => region.solve(bad, 60000, 0)).toThrow();
    expect(() => region.solve(bad, 60000, 0)).toThrow();
    region.solve([], 60000, 0);
    expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(0);
  } finally { region.dispose(); }
});

it.runIf(experimentalLayout)('releases numeric gap records across mounted one-empty-one transitions', async () => {
  const { signal } = await import('@pibbl/core');
  const { pibblSync: pibbl } = await import('@pibbl/core/sync');
  const { Flex } = await import('@pibbl/core');
  const show = signal(true); let hits = 0;
  const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 100;
  document.body.append(canvas);
  const baseline = snapshotWasmLayoutDiagnostics().activeNodes;
  function Scene() { return <Flex style={{ width: 200, height: 100, gap: 10, justifyContent: 'space-between' }}>{show.get() ? <Rectangle style={{ width: 50, height: 20, minWidth: 0, fill: 'red' }} onClick={() => hits++} /> : null}</Flex>; }
  const controller = pibbl(canvas, <Scene />); controllers.push(controller);
  await nextFrame();
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline + 1);
  show.set(false);
  await nextFrame();
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline);
  clickCanvas(canvas,49,10); expect(hits).toBe(0);
  show.set(true); await nextFrame();
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline+1);
  expect([...canvas.getContext('2d')!.getImageData(49,10,1,1).data]).toEqual([255,0,0,255]);
  clickCanvas(canvas,49,10); expect(hits).toBe(1); clickCanvas(canvas,55,10); expect(hits).toBe(1);
  controller.dispose(); expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline);
});

it.runIf(experimentalLayout)('retains reactive Text measurements on paint-only updates', async () => {
  const { Flex, signal } = await import('@pibbl/core');
  const { pibblSync: pibbl } = await import('@pibbl/core/sync');
  const text = signal('Signal-owned text wraps at its final allocated width.');
  const ink = signal('#19375b');
  const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 200;
  document.body.append(canvas);
  const controller = pibbl(canvas, <Flex style={{ width: 300, height: 200, alignItems: 'flex-start' }}><Text style={{ flexBasis: 150, minWidth: 0, wrap: true, font: '16px sans-serif', fill: ink }}>{text}</Text></Flex>);
  controllers.push(controller);
  await nextFrame();
  const initial = snapshotWasmLayoutDiagnostics();
  ink.set('#a63758');
  await nextFrame();
  expect(snapshotWasmLayoutDiagnostics().frames).toBeGreaterThan(initial.frames);
  expect(snapshotWasmLayoutDiagnostics().measuredLeaves).toBe(initial.measuredLeaves);
  const painted = snapshotWasmLayoutDiagnostics();
  const draw = vi.spyOn(canvas.getContext('2d')!, 'fillText');
  text.set('UPDATED'); // Its source edge must survive the preceding cache hit.
  await nextFrame();
  expect(snapshotWasmLayoutDiagnostics().frames).toBe(painted.frames + 1);
  expect(snapshotWasmLayoutDiagnostics().measuredLeaves).toBeGreaterThan(painted.measuredLeaves);
  expect(draw.mock.calls.some(call => call[0] === 'UPDATED')).toBe(true);
});

it.runIf(experimentalLayout)('classifies declared Flex/Text inputs before coalescing their redraw', async () => {
  const { Flex, signal } = await import('@pibbl/core');
  const { pibblSync: pibbl } = await import('@pibbl/core/sync');
  const width = signal(300);
  const text = signal('Signal-owned text wraps at its final allocated width.');
  const ink = signal('#19375b');
  const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 200;
  document.body.append(canvas);
  const controller = pibbl(canvas, <Flex style={{ width, height: 200, alignItems: 'flex-start' }}><Text style={{ flexBasis: 150, minWidth: 0, wrap: true, font: '16px sans-serif', fill: ink }}>{text}</Text></Flex>);
  controllers.push(controller);
  await nextFrame();

  let before = snapshotWasmLayoutDiagnostics();
  ink.set('#a63758');
  await nextFrame();
  let after = snapshotWasmLayoutDiagnostics();
  expect(after.paintInputInvalidations).toBe(before.paintInputInvalidations + 1);
  expect(after.layoutInputInvalidations).toBe(before.layoutInputInvalidations);
  expect(after.measurementInputInvalidations).toBe(before.measurementInputInvalidations);

  before = after;
  text.set('Text content requires a measurement revision.');
  await nextFrame();
  after = snapshotWasmLayoutDiagnostics();
  expect(after.measurementInputInvalidations).toBe(before.measurementInputInvalidations + 1);
  expect(after.paintInputInvalidations).toBe(before.paintInputInvalidations);
  expect(after.layoutInputInvalidations).toBe(before.layoutInputInvalidations);

  before = after;
  width.set(260);
  await nextFrame();
  after = snapshotWasmLayoutDiagnostics();
  expect(after.layoutInputInvalidations).toBe(before.layoutInputInvalidations + 1);
  expect(after.paintInputInvalidations).toBe(before.paintInputInvalidations);
  expect(after.measurementInputInvalidations).toBe(before.measurementInputInvalidations);
});

it.runIf(experimentalLayout)('drives reactive content and computed dependency controls in the exact Studio scenario', async () => {
  const { canvas, controller } = await mountExample();
  const click = (x: number) => clickCanvas(canvas, x, 160);
  const initial = snapshotWasmLayoutDiagnostics();
  click(220); // 560 -> 561; computed width stays 560.
  await nextFrame();
  expect(snapshotWasmLayoutDiagnostics()).toEqual(initial);
  click(390); // Switch to the equal-width alternate source.
  await nextFrame();
  expect(snapshotWasmLayoutDiagnostics()).toEqual(initial);
  click(560); // Change the now-unused primary source by 40.
  await nextFrame();
  expect(snapshotWasmLayoutDiagnostics()).toEqual(initial);
  click(390); // Reattach to the changed primary source: width is now 600.
  await nextFrame();
  const switched = snapshotWasmLayoutDiagnostics();
  expect(switched.frames).toBe(initial.frames + 1);
  expect(switched.solves).toBeGreaterThan(initial.solves);
  expect(switched.nodeCreates).toBe(initial.nodeCreates);
  const paint = vi.spyOn(canvas.getContext('2d')!, 'fillText');
  click(45); // Long paragraph -> short paragraph.
  await nextFrame();
  const changed = snapshotWasmLayoutDiagnostics();
  expect(changed.frames).toBe(switched.frames + 1);
  expect(changed.measuredLeaves).toBeGreaterThan(switched.measuredLeaves);
  expect(changed.solves).toBe(switched.solves);
  expect(paint.mock.calls.some(call => call[0] === 'Pibbl keeps text reactive.')).toBe(true);
  paint.mockClear();
  click(45); // Different text, same one-line height: still must paint.
  await nextFrame();
  expect(paint.mock.calls.some(call => call[0] === 'Pibbl keeps text dynamic.')).toBe(true);
  expect(snapshotWasmLayoutDiagnostics().frames).toBe(changed.frames + 1);
  expect(snapshotWasmLayoutDiagnostics().solves).toBe(changed.solves);
  const inkBefore = canvas.getContext('2d')!.getImageData(28, 260, 560, 200).data;
  let darkPixels = 0;
  for (let i=0; i<inkBefore.length; i+=4) if (inkBefore[i] === 25 && inkBefore[i+1] === 55 && inkBefore[i+2] === 91) darkPixels++;
  expect(darkPixels).toBeGreaterThan(0);
  controller.dispose();
  const disposed = snapshotWasmLayoutDiagnostics();
  click(45); await nextFrame();
  expect(snapshotWasmLayoutDiagnostics()).toEqual(disposed);
});

it.runIf(experimentalLayout)('reorders keyed paragraphs, releases removed inputs, and restores only the removed node', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const { canvas, controller } = await mountExample();
  const click = (x: number, y: number) => clickCanvas(canvas, x, y);
  click(45,160); await nextFrame(); // Make A one line, distinct from B.
  const initial = snapshotWasmLayoutDiagnostics();
  const inspector = canvas.nextElementSibling!;
  click(350,270); // B occupies the second painted column initially.
  await vi.waitFor(() => expect(inspector.textContent).toContain('selected: B'));
  const paint = vi.spyOn(canvas.getContext('2d')!, 'fillText');
  click(45,208); await nextFrame(); // Reverse keys.
  const reordered = snapshotWasmLayoutDiagnostics();
  expect(reordered.frames).toBe(initial.frames+1);
  expect(reordered.nodeCreates).toBe(initial.nodeCreates);
  expect(reordered.activeNodes).toBe(initial.activeNodes);
  expect(reordered.measuredLeaves).toBe(initial.measuredLeaves);
  const firstB = paint.mock.calls.findIndex(call => call[0].startsWith('Second paragraph'));
  const firstA = paint.mock.calls.findIndex(call => call[0] === 'Pibbl keeps text reactive.');
  expect(firstB).toBeGreaterThanOrEqual(0);
  expect(firstA).toBeGreaterThan(firstB);
  click(350,270); // After reorder the same logical coordinate hits A.
  await vi.waitFor(() => expect(inspector.textContent).toContain('selected: A'));
  click(280,208); await nextFrame(); // Remove B.
  const removed = snapshotWasmLayoutDiagnostics();
  expect(removed.activeNodes).toBe(initial.activeNodes-1);
  expect(removed.cachedMeasurements).toBeLessThan(initial.cachedMeasurements);
  expect(removed.nodeCreates).toBe(initial.nodeCreates);
  click(520,208); await nextFrame(); // Write B's now-unobserved text.
  expect(snapshotWasmLayoutDiagnostics()).toEqual(removed);
  paint.mockClear();
  click(280,208); await nextFrame(); // Restore B at its latest content.
  const restored = snapshotWasmLayoutDiagnostics();
  expect(restored.activeNodes).toBe(initial.activeNodes);
  expect(restored.nodeCreates).toBe(initial.nodeCreates+1);
  expect(paint.mock.calls.some(call => call[0].startsWith('Second paragraph updated:'))).toBe(true);
  controller.dispose();
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);
  expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
});

it.runIf(experimentalLayout)('composes width, text, keyed removal, paint and restore without cache churn', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const { canvas, controller } = await mountExample();
  const click = async (x: number, y: number) => { clickCanvas(canvas,x,y); await nextFrame(); };
  await click(60,110); // Narrow.
  await click(45,160); // Short text.
  await click(45,208); // Reverse.
  await click(280,208); // Remove B: surviving A gets a new final width.
  const removed = snapshotWasmLayoutDiagnostics();
  await click(250,110); // Paint must reuse both basis and final-width measurements.
  const painted = snapshotWasmLayoutDiagnostics();
  expect(painted.frames).toBe(removed.frames+1);
  expect(painted.solves).toBe(removed.solves);
  expect(painted.measuredLeaves).toBe(removed.measuredLeaves);
  expect(painted.nodeCreates).toBe(removed.nodeCreates);
  await click(520,208); // Update removed B.
  await click(220,160); // Equal computed width.
  expect(snapshotWasmLayoutDiagnostics()).toEqual(painted);
  await click(390,160); // Switch to B's wider source.
  await click(280,208); // Restore latest B.
  const restored = snapshotWasmLayoutDiagnostics();
  expect(restored.nodeCreates).toBe(removed.nodeCreates+1);
  await click(45,208); // Reorder the restored pair.
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(restored.nodeCreates);
  expect(snapshotWasmLayoutDiagnostics().measuredLeaves).toBe(restored.measuredLeaves);
  controller.dispose();
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);
  expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
});

it('measures column Text auto basis at its final max-width before placing the next sibling', () => {
  const text = createElement(Text, { children: 'aaaa aaaa aaaa aaaa', style: {
    maxWidth: 50, minHeight: 0, flexShrink: 0, wrap: true, lineHeight: 10,
  } });
  const footer = createElement(Rectangle, { style: { width: 100, height: 10, minHeight: 0, flexShrink: 0 } });
  expect(layoutFlex({ x: 0, y: 0, width: 100, height: 200 }, [text, footer], {
    flexDirection: 'column',
  }, measurement)).toEqual([
    { x: 0, y: 0, width: 50, height: 40 },
    { x: 0, y: 40, width: 100, height: 10 },
  ]);
});

it.runIf(experimentalLayout)('reflows the exact column scenario and moves its following sibling hit target in the same frame', async () => {
  const mountColumnModule = await import('../../scenarios/src/learning/layout/wasm-flex-column-text.example');
const mountColumn = createExampleMount(mountColumnModule.WasmFlexColumnTextExample);
  const baseline = snapshotWasmLayoutDiagnostics();
  const canvas = document.createElement('canvas'); canvas.width = 760; canvas.height = 460;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d')!;
  const draw = ctx.fillText;
  const lines: { text: string; x: number; y: number }[] = [];
  vi.spyOn(ctx, 'fillText').mockImplementation(function(this: CanvasRenderingContext2D, text, x, y, maxWidth) {
    lines.push({ text, x: ctx.getTransform().e + x, y: ctx.getTransform().f + y });
    draw.call(this, text, x, y, maxWidth);
  });
  const controller = mountColumn(canvas); controllers.push(controller);
  await nextFrame();
  const initial = snapshotWasmLayoutDiagnostics();
  const footerY = () => lines.find(line => line.text.startsWith('Following sibling'))!.y;
  const beforeY = footerY();
  lines.length = 0;
  clickCanvas(canvas, 60,110); await nextFrame();
  const resized = snapshotWasmLayoutDiagnostics();
  const afterY = footerY();
  expect(afterY).toBeGreaterThan(beforeY + 24);
  expect(resized.frames).toBe(initial.frames+1);
  expect(resized.solves).toBe(initial.solves+1);
  expect(resized.nodeCreates).toBe(initial.nodeCreates);
  const bodyLines = lines.filter(line => line.y >= 150 && !line.text.startsWith('Following sibling'));
  expect(Math.max(...bodyLines.map(line => line.y)) + 24).toBeLessThanOrEqual(afterY-10);
  const inspector = canvas.nextElementSibling!;
  clickCanvas(canvas, 50,beforeY); await nextFrame();
  expect(inspector.textContent).toContain('footer hits: 0');
  clickCanvas(canvas, 50,afterY); await nextFrame();
  await vi.waitFor(() => expect(inspector.textContent).toContain('footer hits: 1'));
  const beforePaint = snapshotWasmLayoutDiagnostics();
  clickCanvas(canvas, 250,110); await nextFrame();
  const painted = snapshotWasmLayoutDiagnostics();
  expect(painted.frames).toBe(beforePaint.frames+1);
  expect(painted.solves).toBe(beforePaint.solves);
  expect(painted.measuredLeaves).toBe(beforePaint.measuredLeaves);
  expect(painted.crossPlacements).toBe(beforePaint.crossPlacements);
  const beforeX = lines.find(line => line.text.startsWith('Following sibling'))!.x;
  lines.length = 0;
  clickCanvas(canvas, 450,110); await nextFrame();
  const aligned = snapshotWasmLayoutDiagnostics();
  const afterX = lines.find(line => line.text.startsWith('Following sibling'))!.x;
  expect(afterX).toBeGreaterThan(beforeX);
  expect(aligned.crossPlacements).toBe(painted.crossPlacements+1);
  expect(aligned.solves).toBe(painted.solves);
  expect(aligned.measuredLeaves).toBe(painted.measuredLeaves);
  expect(aligned.nodeCreates).toBe(painted.nodeCreates);
  clickCanvas(canvas, 50,afterY); await nextFrame();
  expect(inspector.textContent).toContain('footer hits: 1');
  clickCanvas(canvas, afterX,afterY); await nextFrame();
  await vi.waitFor(() => expect(inspector.textContent).toContain('footer hits: 2'));
  // Restore wide text and exercise distribution together with cross alignment.
  clickCanvas(canvas, 60,110); await nextFrame();
  const beforeDistribution = snapshotWasmLayoutDiagnostics();
  const wideY = footerY(); lines.length = 0;
  clickCanvas(canvas, 660,110); await nextFrame();
  const distributed = snapshotWasmLayoutDiagnostics();
  const distributedY = footerY();
  expect(distributedY).toBeGreaterThan(wideY);
  expect(distributed.mainPlacements).toBe(beforeDistribution.mainPlacements+1);
  expect(distributed.solves).toBe(beforeDistribution.solves);
  expect(distributed.measuredLeaves).toBe(beforeDistribution.measuredLeaves);
  expect(distributed.crossPlacements).toBe(beforeDistribution.crossPlacements);
  clickCanvas(canvas, afterX,wideY); await nextFrame();
  expect(inspector.textContent).toContain('footer hits: 2');
  clickCanvas(canvas, afterX,distributedY); await nextFrame();
  await vi.waitFor(() => expect(inspector.textContent).toContain('footer hits: 3'));
  controller.dispose();
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);
  expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
});

it.runIf(experimentalLayout)('computes nowrap cross-axis placement through WASM', () => {
  const before = snapshotWasmLayoutDiagnostics();
  const item = createElement(Rectangle, { style: { width: 40, height: 20, minWidth: 0, flexShrink: 0 } });
  expect(layoutFlex({ x: 3, y: 5, width: 100, height: 80 }, [item], {
    alignItems: 'center',
  }, measurement)).toEqual([{ x: 3, y: 35, width: 40, height: 20 }]);
  expect(snapshotWasmLayoutDiagnostics().crossPlacements).toBe(before.crossPlacements + 1);
});

it.runIf(experimentalLayout)('computes nowrap distributed main offsets through WASM', () => {
  const before = snapshotWasmLayoutDiagnostics();
  const item = () => createElement(Rectangle, { style: { width: 20, height: 10, minWidth: 0, flexShrink: 0 } });
  expect(layoutFlex({ x: 3, y: 5, width: 100, height: 30 }, [item(), item()], {
    justifyContent: 'space-evenly', gap: 10,
  }, measurement).map(box => box.x)).toEqual([3 + 50/3, 3 + 50/3 + 30 + 50/3]);
  expect(snapshotWasmLayoutDiagnostics().mainPlacements).toBe(before.mainPlacements + 1);
});

it.runIf(experimentalLayout)('switches the exact mounted example between column and row without replacing layout ownership', async () => {
  const mountModule = await import('../../scenarios/src/learning/layout/wasm-flex-column-text.example');
const mount = createExampleMount(mountModule.WasmFlexColumnTextExample);
  const baseline = snapshotWasmLayoutDiagnostics();
  const canvas = document.createElement('canvas'); canvas.width = 760; canvas.height = 460;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d')!;
  const positions: { x: number; y: number }[] = [];
  const draw = ctx.fillText;
  vi.spyOn(ctx, 'fillText').mockImplementation(function(this: CanvasRenderingContext2D, text, x, y, maxWidth) {
    if (text.startsWith('Following sibling')) positions.push({ x: ctx.getTransform().e+x, y: ctx.getTransform().f+y });
    draw.call(this,text,x,y,maxWidth);
  });
  const controller = mount(canvas); controllers.push(controller); await nextFrame();
  const column = positions.at(-1)!;
  const initial = snapshotWasmLayoutDiagnostics();
  clickCanvas(canvas,650,40); await nextFrame();
  const row = positions.at(-1)!;
  expect(row.x).toBeGreaterThan(column.x+100);
  expect(row.y).toBeLessThan(column.y);
  const switched = snapshotWasmLayoutDiagnostics();
  expect(switched.solves).toBe(initial.solves+1);
  expect(switched.nodeCreates).toBe(initial.nodeCreates);
  expect(switched.activeArenas).toBe(initial.activeArenas);
  const inspector = canvas.nextElementSibling!;
  clickCanvas(canvas,column.x,column.y); await nextFrame();
  expect(inspector.textContent).toContain('footer hits: 0');
  clickCanvas(canvas,row.x,row.y); await nextFrame();
  await vi.waitFor(() => expect(inspector.textContent).toContain('footer hits: 1'));
  clickCanvas(canvas,250,110); await nextFrame();
  const painted = snapshotWasmLayoutDiagnostics();
  for (const key of ['solves','mainPlacements','crossPlacements','measuredLeaves'] as const) expect(painted[key]).toBe(switched[key]);
  clickCanvas(canvas,650,40); await nextFrame();
  expect(positions.at(-1)).toEqual(column);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(initial.nodeCreates);
  controller.dispose();
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);
  expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
});

it.runIf(experimentalLayout)('freezes a signal-capped public panel and gives remaining space to its sibling', async () => {
  const mountModule = await import('../../scenarios/src/learning/layout/wasm-flex-constraints.example');
const mount = createExampleMount(mountModule.WasmFlexConstraintsExample);
  const baseline = snapshotWasmLayoutDiagnostics();
  const canvas = document.createElement('canvas'); canvas.width = 760; canvas.height = 460;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d')!, draw = ctx.fillText;
  const labels: string[] = [];
  const bodyLines: { x: number; y: number; end: number }[] = [];
  vi.spyOn(ctx,'fillText').mockImplementation(function(this: CanvasRenderingContext2D,text,x,y,maxWidth) {
    if (text.startsWith('Panel ')) labels.push(text);
    const worldX = ctx.getTransform().e+x, worldY = ctx.getTransform().f+y;
    if (worldY >= 224) bodyLines.push({ x: worldX, y: worldY, end: worldX+ctx.measureText(text).width });
    draw.call(this,text,x,y,maxWidth);
  });
  const controller = mount(canvas); controllers.push(controller); await nextFrame();
  expect(labels.slice(-2)).toEqual(['Panel A · 332 px','Panel B · 332 px']);
  const initial = snapshotWasmLayoutDiagnostics();
  bodyLines.length = 0;
  clickCanvas(canvas,60,110); await nextFrame();
  expect(labels.slice(-2)).toEqual(['Panel A · 180 px','Panel B · 484 px']);
  const aLines = bodyLines.filter(line => line.x === 40);
  expect(aLines.length).toBeGreaterThan(1);
  expect(aLines.every(line => line.end <= 196 && line.y+24 <= 420)).toBe(true);
  const capped = snapshotWasmLayoutDiagnostics();
  expect(capped.solves).toBe(initial.solves+1);
  expect(capped.nodeCreates).toBe(initial.nodeCreates);
  clickCanvas(canvas,250,200); await nextFrame();
  const inspector = canvas.nextElementSibling!;
  await vi.waitFor(() => expect(inspector.textContent).toContain('selected: B'));
  clickCanvas(canvas,250,110); await nextFrame(); // Grow changes while A stays frozen.
  expect(labels.slice(-2)).toEqual(['Panel A · 180 px','Panel B · 484 px']);
  clickCanvas(canvas,60,110); await nextFrame(); // Remove cap with 3:1 growth.
  expect(labels.slice(-2)).toEqual(['Panel A · 448 px','Panel B · 216 px']);
  clickCanvas(canvas,250,200); await nextFrame();
  await vi.waitFor(() => expect(inspector.textContent).toContain('selected: A'));
  const beforePaint = snapshotWasmLayoutDiagnostics();
  clickCanvas(canvas,450,110); await nextFrame();
  const painted = snapshotWasmLayoutDiagnostics();
  for (const key of ['solves','mainPlacements','crossPlacements','measuredLeaves'] as const) expect(painted[key]).toBe(beforePaint[key]);
  clickCanvas(canvas,60,154); await nextFrame();
  expect(labels.slice(-2)).toEqual(['Panel A · 152 px','Panel B · 152 px']);
  const shrunk = snapshotWasmLayoutDiagnostics();
  bodyLines.length = 0;
  clickCanvas(canvas,250,154); await nextFrame();
  expect(labels.slice(-2)).toEqual(['Panel A · 180 px','Panel B · 124 px']);
  expect(bodyLines.every(line => line.y+24 <= 420 && line.end <= (line.x === 40 ? 196 : 336))).toBe(true);
  expect(snapshotWasmLayoutDiagnostics().solves).toBe(shrunk.solves+1);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(initial.nodeCreates);
  clickCanvas(canvas,202,200); await nextFrame();
  await vi.waitFor(() => expect(inspector.textContent).toContain('selected: A'));
  clickCanvas(canvas,250,154); await nextFrame();
  expect(labels.slice(-2)).toEqual(['Panel A · 152 px','Panel B · 152 px']);
  clickCanvas(canvas,202,200); await nextFrame();
  await vi.waitFor(() => expect(inspector.textContent).toContain('selected: B'));
  const beforeShrinkPaint = snapshotWasmLayoutDiagnostics();
  clickCanvas(canvas,450,110); await nextFrame();
  const afterShrinkPaint = snapshotWasmLayoutDiagnostics();
  for (const key of ['solves','mainPlacements','crossPlacements','measuredLeaves'] as const) expect(afterShrinkPaint[key]).toBe(beforeShrinkPaint[key]);
  controller.dispose();
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);
  expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
});

it.runIf(experimentalLayout)('measures an intrinsic built-in column around wrapped Text at its definite width', () => {
  const nested = createElement(Flex, { style: { width: 50, flexDirection: 'column', minHeight: 0, flexShrink: 0 },
    children: createElement(Text, { children: 'aaaa aaaa aaaa aaaa', style: { minHeight: 0, flexShrink: 0, wrap: true, lineHeight: 10 } }),
  });
  const footer = createElement(Rectangle, { style: { width: 100, height: 10, minHeight: 0, flexShrink: 0 } });
  expect(layoutFlex({ x: 0, y: 0, width: 100, height: 200 }, [nested, footer], { flexDirection: 'column' }, measurement)).toEqual([
    { x: 0, y: 0, width: 50, height: 40 },
    { x: 0, y: 40, width: 100, height: 10 },
  ]);
});

it.runIf(experimentalLayout)('updates intrinsic built-in Text height and following sibling input together', async () => {
  const mountModule = await import('../../scenarios/src/learning/layout/wasm-flex-intrinsic-text.example');
const mount = createExampleMount(mountModule.WasmFlexIntrinsicTextExample);
  const baseline = snapshotWasmLayoutDiagnostics();
  const canvas = document.createElement('canvas'); canvas.width = 760; canvas.height = 460;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d')!, draw = ctx.fillText;
  const footers: number[] = [];
  const paintedText: string[] = [];
  vi.spyOn(ctx,'fillText').mockImplementation(function(this: CanvasRenderingContext2D,text,x,y,maxWidth) {
    paintedText.push(text);
    if (text.startsWith('Following sibling')) footers.push(ctx.getTransform().f+y);
    draw.call(this,text,x,y,maxWidth);
  });
  const controller = mount(canvas); controllers.push(controller); await nextFrame();
  const originalY = footers.at(-1)!;
  const initial = snapshotWasmLayoutDiagnostics();
  expect(footers.length).toBe(1); // Opaque footer paints once, never during measurement.
  clickCanvas(canvas,60,110); await nextFrame();
  const narrowY = footers.at(-1)!;
  expect(narrowY).toBeGreaterThan(originalY);
  expect(footers.length).toBe(2);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(initial.nodeCreates);
  const inspector = canvas.nextElementSibling!;
  clickCanvas(canvas,50,originalY); await nextFrame();
  expect(inspector.textContent).toContain('footer hits: 0');
  clickCanvas(canvas,50,narrowY); await nextFrame();
  await vi.waitFor(() => expect(inspector.textContent).toContain('footer hits: 1'));
  clickCanvas(canvas,250,110); await nextFrame();
  const shortY = footers.at(-1)!;
  expect(shortY).toBeLessThan(narrowY);
  clickCanvas(canvas,50,narrowY); await nextFrame();
  expect(inspector.textContent).toContain('footer hits: 1');
  clickCanvas(canvas,50,shortY); await nextFrame();
  await vi.waitFor(() => expect(inspector.textContent).toContain('footer hits: 2'));
  const beforePaint = snapshotWasmLayoutDiagnostics();
  clickCanvas(canvas,450,110); await nextFrame();
  const painted = snapshotWasmLayoutDiagnostics();
  for (const key of ['solves','mainPlacements','crossPlacements','nodeCreates'] as const) expect(painted[key]).toBe(beforePaint[key]);
  expect(painted.measuredLeaves-beforePaint.measuredLeaves).toBe(0); // Aggregate intrinsic measurement also reuses validated inputs.
  clickCanvas(canvas,650,110); await nextFrame();
  const fontChanged = snapshotWasmLayoutDiagnostics();
  expect(fontChanged.measuredLeaves).toBeGreaterThan(painted.measuredLeaves);
  const fontY = footers.at(-1)!;
  expect(fontY).toBeGreaterThan(shortY);
  paintedText.length = 0;
  clickCanvas(canvas,250,110); await nextFrame();
  expect(paintedText.join(' ')).toContain('height!');
  expect(footers.at(-1)).toBe(fontY); // Changed content with equal height still paints.
  clickCanvas(canvas,650,110); await nextFrame(); // Unregistered custom family: deliberately uncached.
  const custom = snapshotWasmLayoutDiagnostics();
  clickCanvas(canvas,450,110); await nextFrame();
  expect(snapshotWasmLayoutDiagnostics().measuredLeaves).toBeGreaterThan(custom.measuredLeaves);
  expect(snapshotWasmLayoutDiagnostics().cachedMeasurements-baseline.cachedMeasurements).toBeLessThanOrEqual((initial.activeNodes-baseline.activeNodes)*2);
  controller.dispose();
  expect(snapshotWasmLayoutDiagnostics().cachedMeasurements).toBe(baseline.cachedMeasurements);
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);
  expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
});

it.runIf(experimentalLayout)('measures intrinsic Text after its built-in container reaches a cross-axis maximum', () => {
  const nested = createElement(Flex, { style: { width: 100, maxWidth: 50, minWidth: 0, flexDirection: 'column', minHeight: 0, flexShrink: 0 },
    children: createElement(Text, { children: 'aaaa aaaa aaaa aaaa', style: { minHeight: 0, flexShrink: 0, wrap: true, lineHeight: 10 } }),
  });
  const footer = createElement(Rectangle, { style: { width: 100, height: 10, minWidth: 0, minHeight: 0, flexShrink: 0 } });
  expect(layoutFlex({ x: 0, y: 0, width: 100, height: 200 }, [nested, footer], { flexDirection: 'column' }, measurement)).toEqual([
    { x: 0, y: 0, width: 50, height: 40 }, { x: 0, y: 40, width: 100, height: 10 },
  ]);
  expect(layoutFlex({ x: 0, y: 0, width: 100, height: 200 }, [nested, footer], { alignItems: 'flex-start' }, measurement)).toEqual([
    { x: 0, y: 0, width: 50, height: 40 }, { x: 50, y: 0, width: 100, height: 10 },
  ]);
});

it.runIf(experimentalLayout)('settles a stretched intrinsic column width from its parent before measuring Text', () => {
  for (const padding of [0, 10]) {
    const nested = createElement(Flex, { style: { maxWidth: 50, padding, flexDirection: 'column', minHeight: 0, flexShrink: 0 },
      children: createElement(Text, { children: 'aaaa aaaa aaaa aaaa', style: { minHeight: 0, flexShrink: 0, wrap: true, lineHeight: 10 } }),
    });
    // A max constraint alone is not an allocated width; do not invent an intrinsic fixed point.
    expect(measureElement(nested, { minWidth: 0, maxWidth: 100, minHeight: 0, maxHeight: 200 }, service).status).toBe('unsupported');
    const footer = createElement(Rectangle, { style: { width: 100, height: 10, minHeight: 0, flexShrink: 0 } });
    expect(layoutFlex({ x: 0, y: 0, width: 100, height: 200 }, [nested, footer], { flexDirection: 'column' }, measurement)).toEqual([
      { x: 0, y: 0, width: 50+padding*2, height: 40+padding*2 },
      { x: 0, y: 40+padding*2, width: 100, height: 10 },
    ]);
  }
});

it.runIf(experimentalLayout)('isolates intrinsic snapshot iterables from the outer render allocation', async () => {
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100;
  document.body.append(canvas);
  let leaked = false, rejected = false;
  const children = { *[Symbol.iterator]() {
    try { useLayoutBox(); leaked = true; }
    catch (error) { rejected = String(error).includes('No Pibbl layout context is available'); }
    yield createElement(Text, { children: 'pure descriptor', style: { minHeight: 0, flexShrink: 0 } });
  } };
  const controller = pibbl(canvas, createElement(Flex, { style: { width: 100, height: 100, flexDirection: 'column' },
    children: createElement(Flex, { style: { minHeight: 0, flexShrink: 0, flexDirection: 'column' }, children }),
  }));
  controllers.push(controller);
  await nextFrame();
  expect(rejected).toBe(true);
  expect(leaked).toBe(false);
});

it.runIf(experimentalLayout)('rasterizes an allocated Layer once after parent width and content settle', async () => {
  const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 100;
  document.body.append(canvas);
  const revision = signal(0), width = computed(() => revision.get() === 0 ? 240 : 120);
  const rasters: { width: number; revision: number }[] = [];
  function Content() {
    const box = useLayoutBox();
    rasters.push({ width: box.width, revision: revision.get() });
    return createElement(Rectangle, { style: { width: box.width, height: box.height, fill: revision.get() ? '#426b61' : '#19375b' } });
  }
  const controller = pibbl(canvas, createElement(Flex, { style: { width, height: 100 },
    children: createElement(Layer, { style: { flexBasis: 0, flexGrow: 1, minWidth: 0, height: 100 }, children: createElement(Content, {}) }),
  }));
  controllers.push(controller); await nextFrame();
  rasters.length = 0;
  revision.set(1); await nextFrame();
  expect(rasters).toEqual([{ width: 120, revision: 1 }]);
});

it.runIf(experimentalLayout)('composes the exact allocated Layer example with current pixels, hits and cached siblings', async () => {
  const mountModule = await import('../../scenarios/src/learning/layout/wasm-flex-layer.example');
const mount = createExampleMount(mountModule.WasmFlexLayerExample);
  const baseline = snapshotWasmLayoutDiagnostics();
  const canvas = document.createElement('canvas'); canvas.width = 760; canvas.height = 460;
  document.body.append(canvas);
  const controller = mount(canvas); controllers.push(controller); await nextFrame();
  const panel = canvas.nextElementSibling!;
  await vi.waitFor(() => expect(panel.textContent).toContain('content rasters: 1 · clean rasters: 1'));
  clickCanvas(canvas,60,110); await nextFrame();
  await vi.waitFor(() => expect(panel.textContent).toContain('content rasters: 2 · clean rasters: 1'));
  expect(panel.textContent).toContain('last rasters: 0@544px, 1@284px');
  const pixel = (x: number) => Array.from(canvas.getContext('2d')!.getImageData(x,230,1,1).data);
  expect(pixel(500)).toEqual([243,240,232,255]); // Old wide bitmap is cleared.
  expect(pixel(300)).toEqual([166,55,88,255]);
  expect(pixel(400)).toEqual([66,107,97,255]); // Clean sibling moved without rasterizing.
  clickCanvas(canvas,500,230); await nextFrame();
  expect(panel.textContent).toContain('hits: 0');
  clickCanvas(canvas,300,230); await nextFrame();
  await vi.waitFor(() => expect(panel.textContent).toContain('hits: 1'));
  clickCanvas(canvas,250,110); await nextFrame();
  await vi.waitFor(() => expect(panel.textContent).toContain('content rasters: 3 · clean rasters: 1'));
  const beforePaint = snapshotWasmLayoutDiagnostics();
  clickCanvas(canvas,450,110); await nextFrame();
  expect(panel.textContent).toContain('content rasters: 3 · clean rasters: 1');
  expect(snapshotWasmLayoutDiagnostics().solves).toBe(beforePaint.solves);
  controller.dispose();
  expect(canvas.nextElementSibling).toBeNull();
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);
  expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
});

for (const scenario of [
  { name: 'direct Layer', load: () => import('../../scenarios/src/learning/layout/wasm-flex-render-layer.example') },
  { name: 'opaque panel', load: () => import('../../scenarios/src/learning/layout/wasm-flex-panel.example') },
]) {
it.runIf(experimentalLayout)(`sizes the public renderer lifecycle and committed target inside an allocated ${scenario.name}`, async () => {
  const mountModule = await scenario.load();
const mount = createExampleMount("WasmFlexRenderLayerExample" in mountModule ? mountModule.WasmFlexRenderLayerExample : mountModule.WasmFlexPanelExample);
  const baseline = snapshotWasmLayoutDiagnostics();
  const canvas = document.createElement('canvas'); canvas.width = 760; canvas.height = 460;
  document.body.append(canvas);
  const controller = mount(canvas); controllers.push(controller); await nextFrame();
  const panel = canvas.nextElementSibling!;
  await vi.waitFor(() => expect(panel.textContent).toContain('renderer renders: 1 · creates: 1 · disposes: 0'));
  clickCanvas(canvas,60,110); await nextFrame();
  await vi.waitFor(() => expect(panel.textContent).toContain('renderer renders: 2 · creates: 1 · disposes: 0'));
  expect(panel.textContent).toContain('render sizes: 0@544px, 1@284px');
  expect(panel.textContent).toContain('resize widths: 544, 284');
  const pixel = (x: number) => Array.from(canvas.getContext('2d')!.getImageData(x,230,1,1).data);
  expect(pixel(500)).toEqual([243,240,232,255]);
  expect(pixel(300)).toEqual([166,55,88,255]);
  clickCanvas(canvas,500,230); await nextFrame();
  expect(panel.textContent).toContain('hits: 0');
  clickCanvas(canvas,300,230); await nextFrame();
  await vi.waitFor(() => expect(panel.textContent).toContain('hits: 1'));
  expect(panel.textContent).toContain('last hit: 1');
  clickCanvas(canvas,250,110); await nextFrame();
  await vi.waitFor(() => expect(panel.textContent).toContain('renderer renders: 3'));
  clickCanvas(canvas,450,110); await nextFrame();
  expect(panel.textContent).toContain('renderer renders: 3');
  expect(panel.textContent).toContain('clean rasters: 1');
  if (scenario.name === 'opaque panel') await vi.waitFor(() => expect(panel.textContent).toContain('panel traversals: 4')); 
  controller.dispose(); controller.dispose();
  expect(panel.textContent).toContain('creates: 1 · disposes: 1');
  expect(canvas.nextElementSibling).toBeNull();
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);
  expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
});

}

it.runIf(experimentalLayout)('carries final allocation through an ordinary panel returning a Layer', async () => {
  const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 100;
  document.body.append(canvas);
  const revision = signal(0), width = computed(() => revision.get() === 0 ? 240 : 120);
  const rasters: { width: number; revision: number }[] = [];
  let panels = 0;
  function Content() {
    const box = useLayoutBox();
    rasters.push({ width: box.width, revision: revision.get() });
    return createElement(Rectangle, { style: { width: box.width, height: box.height, fill: '#426b61' } });
  }
  function Panel(_props: { style: unknown }) {
    panels++;
    const box = useLayoutBox();
    return createElement(Layer, { style: { width: box.width, height: box.height }, children: createElement(Content, {}) });
  }
  const controller = pibbl(canvas, createElement(Flex, { style: { width, height: 100 },
    children: createElement(Panel, { style: { flexBasis: 0, flexGrow: 1, minWidth: 0, height: 100 } }),
  }));
  controllers.push(controller); await nextFrame();
  const initialPanels = panels; rasters.length = 0;
  revision.set(1); await nextFrame();
  expect(rasters).toEqual([{ width: 120, revision: 1 }]);
  expect(panels).toBe(initialPanels+1);
});

it.runIf(experimentalLayout).each([false,true])('rehearses pinned Yoga matches and classified geometry through the public Pibbl example logicalPadding=%s', async logicalPadding => {
  const mountModule = await import('../../scenarios/src/learning/layout/wasm-yoga-migration.example');
const mount = createExampleMount(mountModule.WasmYogaMigrationExample);
  const baseline = snapshotWasmLayoutDiagnostics();
  const canvas = document.createElement('canvas'); canvas.width = 760; canvas.height = 540;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d')!, draw = ctx.fillText;
  const labels: { text: string; x: number; y: number }[] = [];
  vi.spyOn(ctx,'fillText').mockImplementation(function(this: CanvasRenderingContext2D,text,x,y,maxWidth) {
    labels.push({ text, x: ctx.getTransform().e+x, y: ctx.getTransform().f+y });
    draw.call(this,text,x,y,maxWidth);
  });
  const controller = mount(canvas); controllers.push(controller); await nextFrame();
  if(logicalPadding)for(let section=0;section<8;section++){clickCanvas(canvas,520,158);await nextFrame();}
  const cases=yogaReference.cases.filter(fixture=>('contentBoxes' in fixture)===logicalPadding);
  for (const [index, fixture] of cases.entries()) {
    const expected = fixture.pibblBoxes ?? fixture.boxes;
    if (index) { labels.length = 0; clickCanvas(canvas,60,158); await nextFrame(); }
    if (fixture.contentBoxes) {
      if(!fixture.itemStyles)throw new Error('Logical padding reference requires item styles.');
      await expect.poll(()=>canvas.nextElementSibling?.textContent).toContain(fixture.name);
      const content=JSON.parse(canvas.nextElementSibling!.textContent!.split('content state: ')[1]);
      const child=createElement(Flex,{style:fixture.itemStyles[0] as FlexStyle,children:[]});
      expect(layoutFlex({x:0,y:0,width:fixture.width,height:fixture.height},[child],{layoutDirection:fixture.layoutDirection as 'ltr'|'rtl',alignItems:'flex-start'},measurement)).toEqual(expected);
      expect(content.boxes.A1).toEqual(fixture.contentBoxes[0]);
      const leaf=fixture.contentBoxes[0];clickCanvas(canvas,394+leaf.x,242+leaf.y);await expect.poll(()=>canvas.nextElementSibling?.textContent).toContain('selected: A1');
      continue;
    }
    if (fixture.nestedBoxes) {
      await expect.poll(()=>canvas.nextElementSibling?.textContent).toContain(fixture.name);
      const nested=JSON.parse(canvas.nextElementSibling!.textContent!.split('nested state: ')[1]);
      for(let boxIndex=0;boxIndex<4;boxIndex++) expect(nested.boxes[String.fromCharCode(65+boxIndex)]).toEqual(fixture.boxes[boxIndex]);
      expect(nested.boxes.A1).toEqual(fixture.nestedBoxes[0]);expect(nested.boxes.A2).toEqual(fixture.nestedBoxes[1]);
      const leaf=fixture.nestedBoxes[0];clickCanvas(canvas,394+leaf.x,242+leaf.y);await expect.poll(()=>canvas.nextElementSibling?.textContent).toContain('selected: A1');
      continue;
    }
    if (fixture.name.startsWith('rectangle-')) {
      const padded = fixture.name === 'rectangle-percent-content-box';
      const children = [0, 1].map(index => createElement(Rectangle, { style: {
        width: 80, height: 80, flexShrink: 1,
        flexBasis: padded ? '70%' : 'auto', padding: padded ? 10 : 0,
        minWidth: padded && index === 0 ? 90 : undefined,
      } }));
      expect(layoutFlex({ x: 0, y: 0, width: fixture.width, height: 100 }, children, { alignItems: 'flex-start' }, measurement)).toEqual(expected);
      for (const [index, box] of expected.entries()) {
        expect([...ctx.getImageData(392 + box.x + 1, 241, 1, 1).data]).toEqual(index === 0 ? [214, 227, 219, 255] : [225, 219, 202, 255]);
        clickCanvas(canvas, 392 + box.x + 2, 242);
        await expect.poll(() => canvas.nextElementSibling?.textContent).toContain(`selected: ${String.fromCharCode(65+index)}`);
      }
    } else {
      const column = fixture.flexDirection.startsWith('column');
      for (const [boxIndex,box] of expected.entries()) {
        expect(labels.some(label => label.text === (fixture.flexWrap !== 'nowrap' ? `${String.fromCharCode(65+boxIndex)} ${box.width}×${box.height}` : box.width < 50 ? String.fromCharCode(65+boxIndex) : column ? `${box.width} × ${box.height} px` : `${box.width} px`) && label.x === 392+box.x+(column || fixture.flexWrap !== 'nowrap' || box.width < 50 ? 4 : 12) && label.y === 240+box.y+(box.width < 50 || fixture.flexWrap !== 'nowrap' ? 4 : column ? 16 : 38)), `${fixture.name}: box ${boxIndex}`).toBe(true);
      }
    }
    const column = fixture.flexDirection.startsWith('column');
    if (!fixture.name.startsWith('rectangle-')) {
      const shrinking = fixture.name === 'shrink' || fixture.name === 'column-shrink';
      const boxed = fixture.name.startsWith('border-box-');
      const floor = fixture.name === 'border-box-floor-bounds';
      const asymmetricBorder = fixture.name.startsWith('border-box-asymmetric-');
      const wrapped = fixture.flexWrap !== 'nowrap';
      const capped = fixture.name.endsWith('cap');
      const children = expected.map((_box,index) => {
        if (fixture.itemStyles) return createElement(Rectangle, { style: fixture.itemStyles[index] as RectStyle });
        if (asymmetricBorder) return createElement(Rectangle, { style: { boxSizing: 'border-box', width: column ? 54 : 'auto', height: column ? 'auto' : 62, flexBasis: column ? 62 : 54, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0, padding: { left: 3, right: 5, top: 7, bottom: 11 }, borderWidth: { left: 2, right: 4, top: 6, bottom: 8 } } });
        if (boxed) return createElement(Rectangle, { style: { boxSizing: 'border-box', width: 80, height: floor ? 60 : '60%', padding: 10, flexBasis: floor ? index === 0 ? 8 : 80 : '70%', flexGrow: 0, flexShrink: floor ? 0 : 1, minWidth: floor ? index === 0 ? 0 : 100 : index === 0 ? 110 : 0, maxWidth: floor ? index === 0 ? 8 : 110 : index === 0 ? '60%' : undefined } });
        return createElement(Rectangle, { style: {
        width: column ? 80 : 60, height: wrapped ? 20 : 80,
        flexBasis: column ? shrinking ? 80 : 20 : shrinking ? 180 : 60,
        flexGrow: wrapped || shrinking ? 0 : 1, flexShrink: 1,
        minWidth: column ? undefined : shrinking && index === 0 ? 120 : 0,
        minHeight: column ? shrinking && index === 0 ? 60 : 0 : undefined,
        maxWidth: !column && capped && index === 0 ? 80 : undefined,
        maxHeight: column && capped && index === 0 ? 30 : undefined,
      } }); });
      const gapContent = (fixture.name.startsWith('gap-percent-') || fixture.name.startsWith('margin-percent-')) ? {x:10,y:20,width:fixture.width-40,height:fixture.height-60} : {x:0,y:0,width:fixture.width,height:fixture.height};
      expect(layoutFlex(gapContent, children, { flexDirection: fixture.flexDirection as 'row' | 'column' | 'row-reverse' | 'column-reverse', flexWrap: fixture.flexWrap as 'nowrap' | 'wrap' | 'wrap-reverse', layoutDirection: 'layoutDirection' in fixture ? fixture.layoutDirection as 'ltr' | 'rtl' : undefined, alignContent: 'flex-start', alignItems: 'flex-start', gap: fixture.gap, ...(fixture.containerStyle as FlexStyle | undefined) }, measurement)).toEqual(expected);
      for (const [index,box] of expected.entries()) {
        clickCanvas(canvas,394+box.x,242+box.y); await expect.poll(() => canvas.nextElementSibling?.textContent).toContain(`selected: ${String.fromCharCode(65+index)}`);
      }
      if (fixture.gap > 0) {
        const gap = column ? Math.min(...expected.map(box => box.y+box.height))+fixture.gap/2 : Math.min(...expected.map(box => box.x+box.width))+fixture.gap/2;
        clickCanvas(canvas,column ? 396 : 392+gap,column ? 240+gap : 244+expected[0].y); await nextFrame();
        expect(canvas.nextElementSibling?.textContent).toContain(`selected: ${String.fromCharCode(64+expected.length)}`);
      }
    }
    if (fixture.flexWrap === 'nowrap' && fixture.name !== 'border-box-floor-bounds' && !fixture.name.startsWith('border-box-asymmetric-') && !('itemStyles' in fixture)) expect(expected.reduce((sum,box) => sum+(column ? box.height : box.width),fixture.gap*(expected.length-1))).toBe(column ? fixture.height : fixture.width);
  }
  const beforePaint = snapshotWasmLayoutDiagnostics();
  clickCanvas(canvas,300,158); await nextFrame();
  expect(snapshotWasmLayoutDiagnostics().solves).toBe(beforePaint.solves);
  controller.dispose();
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);
  expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
}, 60000);

it.runIf(experimentalLayout)('forms finite row wrap lines in WASM and remeasures Text at each final width', () => {
  const children = () => Array.from({ length: 3 }, (_, key) => createElement(Text, { key,
    children: 'aaaa aaaa aaaa aaaa', style: { flexBasis: 90, minWidth: 0, flexGrow: 1, wrap: true, lineHeight: 10 },
  }));
  const options = { flexWrap: 'wrap', gap: 10, alignItems: 'flex-start', alignContent: 'flex-start' } as const;
  expect(layoutFlex({ x: 0, y: 0, width: 320, height: 100 }, children(), options, measurement)).toEqual([
    { x: 0, y: 0, width: 100, height: 20 }, { x: 110, y: 0, width: 100, height: 20 }, { x: 220, y: 0, width: 100, height: 20 },
  ]);
  expect(layoutFlex({ x: 0, y: 0, width: 210, height: 100 }, children(), options, measurement)).toEqual([
    { x: 0, y: 0, width: 100, height: 20 }, { x: 110, y: 0, width: 100, height: 20 }, { x: 0, y: 30, width: 210, height: 10 },
  ]);
  expect(layoutFlex({ x: 0, y: 0, width: 210, height: 100 }, children(), { flexWrap: 'wrap', gap: 10 }, measurement)).toEqual([
    { x: 0, y: 0, width: 100, height: 50 }, { x: 110, y: 0, width: 100, height: 50 }, { x: 0, y: 60, width: 210, height: 40 },
  ]);
  const huge = () => createElement(Rectangle, { style: { width: 80, flexBasis: 80, minWidth: 50, height: 10, flexShrink: 1e308 } });
  expect(layoutFlex({ x: 0, y: 0, width: 40, height: 20 }, [huge(), huge()], options, measurement)).toEqual([
    { x: 0, y: 0, width: 50, height: 10 }, { x: 0, y: 20, width: 50, height: 10 },
  ]);
  expect(layoutFlex({ x: 0, y: 0, width: 40, height: 20 }, [], { flexDirection: 'column', flexWrap: 'wrap' }, measurement)).toEqual([]);
});

it.runIf(experimentalLayout)('drives public row wrap geometry, targets and reuse with width/Text/paint signals', async () => {
  const mountModule = await import('../../scenarios/src/learning/layout/wasm-flex-wrap.example');
const mount = createExampleMount(mountModule.WasmFlexWrapExample);
  const baseline = snapshotWasmLayoutDiagnostics();
  const canvas = document.createElement('canvas'); canvas.width = 760; canvas.height = 460; document.body.append(canvas);
  const controller = mount(canvas); controllers.push(controller); await nextFrame();
  const state = () => JSON.parse(canvas.parentElement!.querySelector('pre')!.textContent!);
  const refresh = () => new Promise(resolve => setTimeout(resolve,120));
  await refresh();
  expect(state().boxes.C).toEqual({ x: 436, y: 180, width: 192, height: 104 });
  clickCanvas(canvas,60,118); await nextFrame(); await refresh();
  expect(state().boxes.B).toEqual({ x: 234, y: 180, width: 194, height: 104 });
  expect(state().boxes.C).toEqual({ x: 28, y: 296, width: 400, height: 104 });
  clickCanvas(canvas,450,190); await nextFrame(); await refresh(); expect(state().selected).toBe('none');
  clickCanvas(canvas,40,310); await nextFrame(); await refresh(); expect(state().selected).toBe('C');
  const settled = snapshotWasmLayoutDiagnostics();
  clickCanvas(canvas,236,118); await nextFrame();
  clickCanvas(canvas,432,118); await nextFrame();
  expect(snapshotWasmLayoutDiagnostics().solves).toBe(settled.solves);
  expect(snapshotWasmLayoutDiagnostics().lineFormations).toBe(settled.lineFormations);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(settled.nodeCreates);
  clickCanvas(canvas,60,118); await nextFrame(); await refresh();
  expect(state().boxes.C).toEqual({ x: 436, y: 180, width: 192, height: 104 });
  controller.dispose();
  const disposed = snapshotWasmLayoutDiagnostics();
  expect(disposed.activeNodes).toBe(baseline.activeNodes);
  expect(disposed.activeArenas).toBe(baseline.activeArenas);
  expect(disposed.cachedMeasurements).toBe(baseline.cachedMeasurements);
});

it.runIf(experimentalLayout)('wraps finite declared column items and rejects intrinsic item cycles', () => {
  const children = () => Array.from({ length: 3 }, () => createElement(Rectangle, { style: { width: 100, height: 80, minHeight: 0, flexGrow: 1 } }));
  const options = { flexDirection: 'column', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start', alignContent: 'flex-start' } as const;
  expect(layoutFlex({ x: 0, y: 0, width: 240, height: 260 }, children(), options, measurement)).toEqual([
    { x: 0, y: 0, width: 100, height: 80 }, { x: 0, y: 90, width: 100, height: 80 }, { x: 0, y: 180, width: 100, height: 80 },
  ]);
  expect(layoutFlex({ x: 0, y: 0, width: 240, height: 170 }, children(), options, measurement)).toEqual([
    { x: 0, y: 0, width: 100, height: 80 }, { x: 0, y: 90, width: 100, height: 80 }, { x: 110, y: 0, width: 100, height: 170 },
  ]);
  const text = createElement(Text, { children: 'measured height', style: { width: 100, minHeight: 0, wrap: true } });
  expect(() => layoutFlex({ x: 0, y: 0, width: 240, height: 170 }, [text], options, measurement)).toThrow(/declared height or flexBasis/);
  const automaticWidth = createElement(Text, { children: 'measured width', style: { height: 80, minHeight: 0 } });
  expect(() => layoutFlex({ x: 0, y: 0, width: 240, height: 170 }, [automaticWidth], options, measurement)).toThrow(/declared width/);
  const large = () => createElement(Rectangle, { style: { width: 100, height: 80, minHeight: 50, flexShrink: 1e308 } });
  expect(layoutFlex({ x: 0, y: 0, width: 240, height: 40 }, [large(), large()], options, measurement)).toEqual([
    { x: 0, y: 0, width: 100, height: 50 }, { x: 110, y: 0, width: 100, height: 50 },
  ]);
});

it.runIf(experimentalLayout)('drives public column wrap height, hit targets and declared-width Text through signals', async () => {
  const mountModule = await import('../../scenarios/src/learning/layout/wasm-flex-column-wrap.example');
const mount = createExampleMount(mountModule.WasmFlexColumnWrapExample);
  const baseline = snapshotWasmLayoutDiagnostics();
  const canvas = document.createElement('canvas'); canvas.width = 760; canvas.height = 460; document.body.append(canvas);
  const controller = mount(canvas); controllers.push(controller); await nextFrame();
  const state = () => JSON.parse(canvas.parentElement!.querySelector('pre')!.textContent!);
  const refresh = () => new Promise(resolve => setTimeout(resolve,120));
  await refresh();
  expect(state().boxes.C).toEqual({ x: 28, y: 348, width: 192, height: 88 });
  clickCanvas(canvas,60,118); await nextFrame(); await refresh();
  expect(state().boxes.B).toEqual({ x: 28, y: 246, width: 192, height: 86 });
  expect(state().boxes.C).toEqual({ x: 232, y: 148, width: 192, height: 184 });
  clickCanvas(canvas,40,360); await nextFrame(); await refresh(); expect(state().selected).toBe('none');
  clickCanvas(canvas,244,160); await nextFrame(); await refresh(); expect(state().selected).toBe('C');
  const settled = snapshotWasmLayoutDiagnostics();
  clickCanvas(canvas,236,118); await nextFrame(); clickCanvas(canvas,432,118); await nextFrame();
  expect(snapshotWasmLayoutDiagnostics().solves).toBe(settled.solves);
  expect(snapshotWasmLayoutDiagnostics().lineFormations).toBe(settled.lineFormations);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(settled.nodeCreates);
  clickCanvas(canvas,60,118); await nextFrame(); await refresh();
  expect(state().boxes.C).toEqual({ x: 28, y: 348, width: 192, height: 88 });
  controller.dispose();
  const disposed = snapshotWasmLayoutDiagnostics();
  expect(disposed.activeNodes).toBe(baseline.activeNodes);
  expect(disposed.activeArenas).toBe(baseline.activeArenas);
  expect(disposed.cachedMeasurements).toBe(baseline.cachedMeasurements);
});

it.runIf(experimentalLayout)('preserves keyed identities through wrapped row/column reorder removal and restore', async () => {
  const mountModule = await import('../../scenarios/src/learning/layout/wasm-flex-keyed-wrap.example');
const mount = createExampleMount(mountModule.WasmFlexKeyedWrapExample);
  const baseline = snapshotWasmLayoutDiagnostics();
  const canvas = document.createElement('canvas'); canvas.width = 760; canvas.height = 460; document.body.append(canvas);
  const controller = mount(canvas); controllers.push(controller); await nextFrame();
  const state = () => JSON.parse(canvas.parentElement!.querySelector('pre')!.textContent!);
  const refresh = () => new Promise(resolve => setTimeout(resolve,120));
  const click = async (x: number, y: number) => { clickCanvas(canvas,x,y); await nextFrame(); await refresh(); };
  await refresh();
  const initial = state();
  expect(initial.boxes['row:C']).toMatchObject({ x: 28, y: 272, width: 360, height: 80 });
  expect(initial.boxes['column:C']).toMatchObject({ x: 582, y: 180, width: 130, height: 180 });
  expect(initial.layout.activeNodes-baseline.activeNodes).toBe(6);
  await click(40,118);
  const reordered = state();
  expect(reordered.keys).toEqual(['C','B','A']);
  for (const key of Object.keys(initial.boxes)) expect(reordered.boxes[key].stamp).toBe(initial.boxes[key].stamp);
  expect(reordered.layout.nodeCreates).toBe(initial.layout.nodeCreates);
  await click(40,284); expect(state().selected).toBe('row:A');
  await click(594,192); expect(state().selected).toBe('column:A');
  await click(192,118);
  const removed = state();
  expect(removed.keys).toEqual(['C','A']);
  expect(removed.boxes['row:B']).toBeUndefined(); expect(removed.boxes['column:B']).toBeUndefined();
  expect(removed.layout.activeNodes-baseline.activeNodes).toBe(4);
  expect(removed.layout.nodeCreates).toBe(initial.layout.nodeCreates);
  const beforeOldTarget = state().hits;
  await click(594,192); expect(state().hits).toBe(beforeOldTarget);
  await click(226,192); expect(state().selected).toBe('row:A');
  await click(452,288); expect(state().selected).toBe('column:A');
  await click(344,118);
  const restored = state();
  expect(restored.keys).toEqual(['C','A','B']);
  for (const zone of ['row','column']) {
    for (const key of ['A','C']) expect(restored.boxes[`${zone}:${key}`].stamp).toBe(initial.boxes[`${zone}:${key}`].stamp);
    expect(restored.boxes[`${zone}:B`].stamp).not.toBe(initial.boxes[`${zone}:B`].stamp);
  }
  expect(restored.layout.nodeCreates).toBe(initial.layout.nodeCreates+2);
  expect(restored.layout.activeNodes-baseline.activeNodes).toBe(6);
  const beforePaint = snapshotWasmLayoutDiagnostics(); await click(496,118);
  expect(snapshotWasmLayoutDiagnostics().solves).toBe(beforePaint.solves);
  expect(snapshotWasmLayoutDiagnostics().lineFormations).toBe(beforePaint.lineFormations);
  controller.dispose();
  const disposed = snapshotWasmLayoutDiagnostics();
  expect(disposed.activeNodes).toBe(baseline.activeNodes);
  expect(disposed.activeArenas).toBe(baseline.activeArenas);
  expect(disposed.cachedMeasurements).toBe(baseline.cachedMeasurements);
});

it.runIf(experimentalLayout)('retains bounded measured Text caches across wrapped keyed topology changes', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const keys = signal(['A','B','C']), ink = signal('#19375b');
  function Collection() {
    return createElement(Flex, { style: { width: 210, height: 120, flexWrap: 'wrap', gap: 10, alignItems: 'flex-start', alignContent: 'flex-start' },
      children: keys.get().map(key => createElement(Text, { key, children: `${key} aaaa aaaa aaaa aaaa`, style: { flexBasis: 90, minWidth: 0, flexGrow: 1, wrap: true, font: '16px sans-serif', lineHeight: 20, fill: ink } })),
    });
  }
  const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 160; document.body.append(canvas);
  const controller = pibbl(canvas, createElement(Collection, {})); controllers.push(controller); await nextFrame();
  const initial = snapshotWasmLayoutDiagnostics();
  expect(initial.cachedMeasurements-baseline.cachedMeasurements).toBe(6);
  keys.set(['C','B','A']); await nextFrame();
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(initial.nodeCreates);
  keys.set(['C','A']); await nextFrame();
  const removed = snapshotWasmLayoutDiagnostics();
  expect(removed.activeNodes-baseline.activeNodes).toBe(2);
  expect(removed.cachedMeasurements-baseline.cachedMeasurements).toBe(4);
  keys.set(['C','A','B']); await nextFrame();
  const restored = snapshotWasmLayoutDiagnostics();
  expect(restored.nodeCreates).toBe(initial.nodeCreates+1);
  expect(restored.cachedMeasurements-baseline.cachedMeasurements).toBe(6);
  ink.set('#a63758'); await nextFrame();
  expect(snapshotWasmLayoutDiagnostics().measuredLeaves).toBe(restored.measuredLeaves);
  expect(snapshotWasmLayoutDiagnostics().solves).toBe(restored.solves);
  controller.dispose();
  expect(snapshotWasmLayoutDiagnostics().cachedMeasurements).toBe(baseline.cachedMeasurements);
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);
  expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
});

it.runIf(experimentalLayout)('measures nested intrinsic built-in columns at bounded content widths and rejects cycles', () => {
  const text = (children: string) => createElement(Text, { children, style: { minHeight: 0, flexShrink: 0, wrap: true, lineHeight: 10 } });
  const card = () => createElement(Flex, { style: { flexDirection: 'column', minHeight: 0, flexShrink: 0, padding: 5, maxWidth: 80, gap: 4 }, children: [
    text('aaaa'), createElement(Flex, { style: { flexDirection: 'column', minHeight: 0, flexShrink: 0, padding: 3, maxWidth: 50, gap: 2 }, children: [text('aa aa aa aa'), text('aa')] }),
  ] });
  const footer = createElement(Rectangle, { style: { width: 40, height: 10, minHeight: 0, flexShrink: 0 } });
  expect(layoutFlex({ x: 0, y: 0, width: 100, height: 300 }, [card(), footer], { flexDirection: 'column', gap: 5 }, measurement)).toEqual([
    { x: 0, y: 0, width: 90, height: 62 }, { x: 0, y: 67, width: 40, height: 10 },
  ]);
  expect(layoutFlex({ x: 0, y: 0, width: 50, height: 300 }, [card(), footer], { flexDirection: 'column', gap: 5 }, measurement)).toEqual([
    { x: 0, y: 0, width: 50, height: 82 }, { x: 0, y: 87, width: 40, height: 10 },
  ]);
  const cyclicChildren: PibblNode[] = [];
  const cycle = createElement(Flex, { style: { width: 80, flexDirection: 'column', minHeight: 0, flexShrink: 0 }, children: cyclicChildren });
  cyclicChildren.push(cycle);
  expect(() => measureElement(cycle, { minWidth: 0, maxWidth: 100, minHeight: 0, maxHeight: 300 }, service)).toThrow(/cyclic measurement/);
  expect(measureElement(createElement(Flex, { style: { width: 100, flexDirection: 'column' }, children: card() }), { minWidth: 0, maxWidth: 100, minHeight: 0, maxHeight: 300 }, service).status).toBe('measured');
});

it.runIf(experimentalLayout)('reflows a public nested descriptor Card and following target without speculative probe execution', async () => {
  const mountModule = await import('../../scenarios/src/learning/layout/wasm-flex-nested-intrinsic.example');
const mount = createExampleMount(mountModule.WasmFlexNestedIntrinsicExample);
  const baseline = snapshotWasmLayoutDiagnostics();
  const canvas = document.createElement('canvas'); canvas.width = 760; canvas.height = 460; document.body.append(canvas);
  const controller = mount(canvas); controllers.push(controller); await nextFrame();
  const state = () => JSON.parse(canvas.parentElement!.querySelector('pre')!.textContent!);
  const refresh = () => new Promise(resolve => setTimeout(resolve,120));
  const click = async (x: number, y: number) => { clickCanvas(canvas,x,y); await nextFrame(); await refresh(); };
  await refresh();
  const initial = state();
  expect(initial.probeRenders).toBe(1);
  expect(initial.footerBox.y).toBe(initial.cardBottom+12);
  await click(60,110);
  const narrow = state();
  expect(narrow.footerBox.y).toBeGreaterThan(initial.footerBox.y);
  expect(narrow.footerBox.y).toBe(narrow.cardBottom+12);
  expect(narrow.probeRenders).toBe(initial.probeRenders+1);
  expect(narrow.layout.nodeCreates).toBe(initial.layout.nodeCreates);
  await click(40,initial.footerBox.y+12); expect(state().footerHits).toBe(0);
  await click(40,narrow.footerBox.y+12); expect(state().footerHits).toBe(1);
  await click(236,110);
  const shortened = state();
  expect(shortened.footerBox.y).toBeLessThan(narrow.footerBox.y);
  expect(shortened.footerBox.y).toBe(shortened.cardBottom+12);
  const beforePaint = snapshotWasmLayoutDiagnostics(); await click(432,110);
  expect(snapshotWasmLayoutDiagnostics().solves).toBe(beforePaint.solves);
  expect(snapshotWasmLayoutDiagnostics().measuredLeaves).toBe(beforePaint.measuredLeaves);
  controller.dispose();
  const disposed = snapshotWasmLayoutDiagnostics();
  expect(disposed.activeNodes).toBe(baseline.activeNodes);
  expect(disposed.activeArenas).toBe(baseline.activeArenas);
  expect(disposed.cachedMeasurements).toBe(baseline.cachedMeasurements);
});

it.runIf(experimentalLayout)('refreshes nested cache subscriptions, metrics and bounded ownership', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const selected = signal(true), first = signal('first paragraph wraps across narrow columns'), second = signal('second paragraph'), font = signal('14px sans-serif'), width = signal(160), ink = signal('#123456');
  const content = computed(() => selected.get() ? first.get() : second.get());
  let renders = 0;
  function App() {
    renders++;
    return createElement(Flex, { style: { width, height: 400, flexDirection: 'column' }, children:
      createElement(Flex, { style: { flexDirection: 'column', minHeight: 0, flexShrink: 0 }, children:
        createElement(Flex, { style: { flexDirection: 'column', minHeight: 0, flexShrink: 0, padding: 4 }, children:
          createElement(Text, { children: content, style: { font, fill: ink, wrap: true, lineHeight: 20, minHeight: 0, flexShrink: 0 } }) }) }) });
  }
  const canvas = document.createElement('canvas'); canvas.width=300; canvas.height=450; document.body.append(canvas);
  const controller = pibbl(canvas, createElement(App, {})); controllers.push(controller); await nextFrame();
  let prior = snapshotWasmLayoutDiagnostics();
  ink.set('#654321'); await nextFrame(); expect(snapshotWasmLayoutDiagnostics().measuredLeaves).toBe(prior.measuredLeaves);
  selected.set(false); await nextFrame(); expect(snapshotWasmLayoutDiagnostics().measuredLeaves).toBeGreaterThan(prior.measuredLeaves);
  prior = snapshotWasmLayoutDiagnostics(); const settledRenders = renders;
  first.set('detached input'); await nextFrame(); expect(renders).toBe(settledRenders); expect(snapshotWasmLayoutDiagnostics().measuredLeaves).toBe(prior.measuredLeaves);
  second.set('active paragraph changes its intrinsic geometry substantially'); await nextFrame(); expect(snapshotWasmLayoutDiagnostics().measuredLeaves).toBeGreaterThan(prior.measuredLeaves);
  prior = snapshotWasmLayoutDiagnostics(); font.set('20px sans-serif'); await nextFrame(); expect(snapshotWasmLayoutDiagnostics().measuredLeaves).toBeGreaterThan(prior.measuredLeaves);
  for (const value of [120,180,130,190]) { prior=snapshotWasmLayoutDiagnostics(); width.set(value); await nextFrame(); expect(snapshotWasmLayoutDiagnostics().measuredLeaves).toBeGreaterThan(prior.measuredLeaves); }
  const final = snapshotWasmLayoutDiagnostics();
  expect(final.cachedMeasurements-baseline.cachedMeasurements).toBeLessThanOrEqual(2*(final.activeNodes-baseline.activeNodes));
  ink.set('#abcdef'); await nextFrame(); expect(snapshotWasmLayoutDiagnostics().measuredLeaves).toBe(final.measuredLeaves);
  controller.dispose();
  expect(snapshotWasmLayoutDiagnostics().cachedMeasurements).toBe(baseline.cachedMeasurements);
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);
  expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
});

it.runIf(experimentalLayout)('invalidates nested keyed membership while releasing removed measurement receivers', async () => {
  const mountModule = await import('../../scenarios/src/learning/layout/wasm-flex-nested-intrinsic.example');
const mount = createExampleMount(mountModule.WasmFlexNestedIntrinsicExample);
  const baseline = snapshotWasmLayoutDiagnostics();
  const canvas = document.createElement('canvas'); canvas.width=760; canvas.height=460; document.body.append(canvas);
  const controller = mount(canvas); controllers.push(controller); await nextFrame();
  const state = () => JSON.parse(canvas.parentElement!.querySelector('pre')!.textContent!);
  const click = async (x: number,y: number) => { clickCanvas(canvas,x,y); await nextFrame(); await new Promise(resolve=>setTimeout(resolve,120)); return state(); };
  await new Promise(resolve=>setTimeout(resolve,120));
  const initial = state();
  const reversed = await click(40,426); expect(reversed.layout.nodeCreates).toBe(initial.layout.nodeCreates);
  expect(reversed.layout.measuredLeaves).toBeGreaterThan(initial.layout.measuredLeaves);
  const removed = await click(240,426);
  expect(removed.footerBox.y).toBeLessThan(initial.footerBox.y);
  expect(removed.layout.activeNodes).toBe(initial.layout.activeNodes-1);
  const changed = await click(240,110);
  expect(changed.layout.measuredLeaves).toBe(removed.layout.measuredLeaves);
  expect(changed.probeRenders).toBe(removed.probeRenders);
  expect((await click(40,initial.footerBox.y+12)).footerHits).toBe(0);
  expect((await click(40,removed.footerBox.y+12)).footerHits).toBe(1);
  const restored = await click(240,426);
  expect(restored.layout.nodeCreates).toBe(initial.layout.nodeCreates+1);
  expect(restored.footerBox.y).toBeGreaterThan(removed.footerBox.y);
  expect(restored.footerBox.y).toBe(restored.cardBottom+12);
  expect(restored.footerBox.y).toBe(280);
  expect(restored.layout.cachedMeasurements-baseline.cachedMeasurements).toBeLessThanOrEqual(2*(restored.layout.activeNodes-baseline.activeNodes));
  const painted = await click(440,110); expect(painted.layout.measuredLeaves).toBe(restored.layout.measuredLeaves);
  controller.dispose(); const disposed=snapshotWasmLayoutDiagnostics();
  expect(disposed.cachedMeasurements).toBe(baseline.cachedMeasurements); expect(disposed.activeNodes).toBe(baseline.activeNodes); expect(disposed.activeArenas).toBe(baseline.activeArenas);
});


it.runIf(experimentalLayout)('shrinks empty fixed-size Rectangles with an automatic zero minimum through the public mount', async () => {
  const fixed = () => createElement(Rectangle, { style: { width: 80, height: 20 } });
  expect(layoutFlex({ x: 0, y: 0, width: 100, height: 20 }, [fixed(), fixed()], {}, measurement))
    .toEqual([{ x: 0, y: 0, width: 50, height: 20 }, { x: 50, y: 0, width: 50, height: 20 }]);
  const canvas = document.createElement('canvas');
  canvas.width = 120; canvas.height = 30; document.body.append(canvas);
  const hits: number[] = [];
  const App = () => createElement(Flex, { style: { width: 100, height: 20 }, children: [
    createElement(Rectangle, { style: { width: 80, height: 20, fill: 'red' }, onClick: () => hits.push(0) }),
    createElement(Rectangle, { style: { width: 80, height: 20, fill: 'blue' }, onClick: () => hits.push(1) }),
  ] });
  const controller = pibbl(canvas, createElement(App, {})); controllers.push(controller);
  await nextFrame();
  const context = canvas.getContext('2d')!;
  expect([...context.getImageData(49, 10, 1, 1).data]).toEqual([255, 0, 0, 255]);
  expect([...context.getImageData(50, 10, 1, 1).data]).toEqual([0, 0, 255, 255]);
  clickCanvas(canvas, 49, 10); clickCanvas(canvas, 50, 10); clickCanvas(canvas, 99, 10); clickCanvas(canvas, 101, 10);
  expect(hits).toEqual([0, 1, 1]);
});

it.runIf(experimentalLayout)('keeps explicit rectangle minima and no-shrink policy while supporting column auto minima', () => {
  const fixed = (style: Record<string, number>) => createElement(Rectangle, { style: { width: 80, height: 80, ...style } });
  expect(layoutFlex({ x: 0, y: 0, width: 100, height: 100 }, [fixed({ minWidth: 70 }), fixed({})], {}, measurement).map(box => box.width)).toEqual([70, 30]);
  expect(layoutFlex({ x: 0, y: 0, width: 100, height: 100 }, [fixed({ flexShrink: 0 }), fixed({})], {}, measurement).map(box => box.width)).toEqual([80, 20]);
  expect(layoutFlex({ x: 0, y: 0, width: 100, height: 100 }, [fixed({}), fixed({})], { flexDirection: 'column', alignItems: 'flex-start' }, measurement).map(box => box.height)).toEqual([50, 50]);
});

it.runIf(experimentalLayout)('measures intrinsic Flex columns containing empty fixed-size Rectangles through the public API', () => {
  const column = createElement(Flex, { style: { flexDirection: 'column', width: 100, gap: 5 }, children: [
    createElement(Rectangle, { style: { width: 80, height: 20 } }),
    createElement(Rectangle, { style: { width: 80, height: 30 } }),
  ] });
  expect(measureElement(column, { minWidth: 0, maxWidth: 100, minHeight: 0, maxHeight: 100 }, service))
    .toEqual({ status: 'measured', size: { width: 100, height: 55 } });
});

it.runIf(experimentalLayout)('shrinks percentage-sized empty Rectangles against definite parent dimensions', () => {
  const child = () => createElement(Rectangle, { style: { width: '80%', height: 20 } });
  expect(layoutFlex({ x: 0, y: 0, width: 100, height: 30 }, [child(), child()], {}, measurement))
    .toEqual([{ x: 0, y: 0, width: 50, height: 20 }, { x: 50, y: 0, width: 50, height: 20 }]);
});

it.runIf(experimentalLayout)('keeps percentage Rectangle explicit bounds and content padding floors', () => {
  const child = (minimum: number) => createElement(Rectangle, { style: { width: '80%', height: 20, minWidth: minimum } });
  expect(layoutFlex({ x: 0, y: 0, width: 100, height: 30 }, [child(70), child(0)], {}, measurement).map(box => box.width)).toEqual([70, 30]);
  const padded = () => createElement(Rectangle, { style: { width: '80%', height: 20, padding: 10 } });
  expect(layoutFlex({ x: 0, y: 0, width: 20, height: 40 }, [padded(), padded()], {}, measurement))
    .toEqual([{ x: 0, y: 0, width: 20, height: 40 }, { x: 20, y: 0, width: 20, height: 40 }]);
  const column = () => createElement(Rectangle, { style: { width: 20, height: '80%' } });
  expect(layoutFlex({ x: 0, y: 0, width: 20, height: 100 }, [column(), column()], { flexDirection: 'column' }, measurement).map(box => box.height)).toEqual([50, 50]);
});

it.runIf(experimentalLayout)('allocates physical numeric margins outside public Rectangle paint and hit bounds', async () => {
  const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 40; document.body.append(canvas);
  const left = signal(5); const hits: string[] = [];
  const children = () => [
    createElement(Rectangle, { style: { width: 80, height: 20, minWidth: 0, margin: 5, marginLeft: left, marginTop: 3, fill: 'red' }, onClick: () => hits.push('A') }),
    createElement(Rectangle, { style: { width: 80, height: 20, minWidth: 0, margin: 5, fill: 'blue' }, onClick: () => hits.push('B') }),
  ];
  const App = () => createElement(Flex, { style: { width: 100, height: 30, alignItems: 'flex-start' }, children: children() });
  expect(layoutFlex({ x: 0, y: 0, width: 100, height: 30 }, children(), { alignItems: 'flex-start' }, measurement))
    .toEqual([{ x: 5, y: 3, width: 40, height: 20 }, { x: 55, y: 5, width: 40, height: 20 }]);
  const controller = pibbl(canvas, createElement(App, {})); controllers.push(controller); await nextFrame();
  const initialRoles = snapshotWasmLayoutDiagnostics();
  const pixel = (x: number, y: number) => [...canvas.getContext('2d')!.getImageData(x, y, 1, 1).data];
  expect(pixel(4, 4)).toEqual([0, 0, 0, 0]); expect(pixel(5, 3)).toEqual([255, 0, 0, 255]);
  expect(pixel(44, 4)).toEqual([255, 0, 0, 255]); expect(pixel(45, 4)).toEqual([0, 0, 0, 0]);
  clickCanvas(canvas, 4, 4); clickCanvas(canvas, 5, 4); clickCanvas(canvas, 55, 6); expect(hits).toEqual(['A', 'B']);
  left.set(-5); await nextFrame(); clickCanvas(canvas, 0, 4); expect(hits).toEqual(['A', 'B', 'A']);
  expect(snapshotWasmLayoutDiagnostics().layoutInputInvalidations).toBeGreaterThan(initialRoles.layoutInputInvalidations);
  expect(snapshotWasmLayoutDiagnostics().paintInputInvalidations).toBe(initialRoles.paintInputInvalidations);
});

it.runIf(experimentalLayout)('clamps an intrinsic Flex auto dimension after signed margin accumulation', () => {
  const column = createElement(Flex, { style: { width: 100, flexDirection: 'column' }, children:
    createElement(Rectangle, { style: { width: 20, height: 10, minHeight: 0, flexShrink: 0, marginTop: -20 } }),
  });
  expect(measureElement(column, { minWidth: 0, maxWidth: 100, minHeight: 0, maxHeight: 100 }, service))
    .toEqual({ status: 'measured', size: { width: 100, height: 0 } });
});

it.runIf(experimentalLayout)('places numeric cross margins and rejects unsupported margin inputs', () => {
  const child = () => createElement(Rectangle, { style: { width: 'auto', height: 40, minHeight: 0, margin: 5, marginLeft: 3 } });
  expect(layoutFlex({ x: 0, y: 0, width: 100, height: 100 }, [child(), child()], { flexDirection: 'column' }, measurement))
    .toEqual([{ x: 3, y: 5, width: 92, height: 40 }, { x: 3, y: 55, width: 92, height: 40 }]);
  for (const margin of [NaN, Infinity, 'bad%', 'auto', null]) {
    const invalid = createElement(Rectangle, { style: { width: 20, height: 20, minWidth: 0, margin } as any });
    expect(() => layoutFlex({ x: 0, y: 0, width: 100, height: 30 }, [invalid], {}, measurement)).toThrow(/margin/);
  }
});

it.runIf(experimentalLayout)('rejects margins under other layout families rather than ignoring them', async () => {
  const { prepareDirectChildStyle } = await import('../src/lib/layout/absolute');
  for (const margin of [{ marginLeft: 5 }, { marginStart: 0 }, { marginEnd: '-5%' as const }]) {
    const child = createElement(Rectangle, { style: { width: 20, height: 20, ...margin } });
    expect(() => prepareDirectChildStyle(child)).toThrow(/margins.*experimental Flex/);
  }
});

it.runIf(experimentalLayout)('forms wrapped margin lines and preserves source paint/hit order under negative overlap', async () => {
  const positive = () => createElement(Rectangle, { style: { width: 80, height: 20, minWidth: 0, margin: 5 } });
  expect(layoutFlex({ x: 0, y: 0, width: 180, height: 60 }, [positive(), positive(), positive()], { flexWrap: 'wrap', alignContent: 'flex-start' }, measurement))
    .toEqual([{ x: 5, y: 5, width: 80, height: 20 }, { x: 95, y: 5, width: 80, height: 20 }, { x: 5, y: 35, width: 80, height: 20 }]);
  const column = () => createElement(Rectangle, { style: { width: 20, height: 80, minHeight: 0, margin: 5 } });
  expect(layoutFlex({ x: 0, y: 0, width: 60, height: 180 }, [column(), column(), column()], { flexDirection: 'column', flexWrap: 'wrap', alignContent: 'flex-start' }, measurement))
    .toEqual([{ x: 5, y: 5, width: 20, height: 80 }, { x: 5, y: 95, width: 20, height: 80 }, { x: 35, y: 5, width: 20, height: 80 }]);
  const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 60; document.body.append(canvas);
  const hits: string[] = [];
  const child = (name: string, fill: string) => createElement(Rectangle, { style: { width: 80, height: 20, minWidth: 0, marginRight: -10, marginBottom: -5, fill }, onClick: () => hits.push(name) });
  const root = createElement(Flex, { style: { width: 140, height: 50, flexWrap: 'wrap', alignContent: 'flex-start', alignItems: 'flex-start' }, children: [child('A', 'red'), child('B', 'blue'), child('C', 'green')] });
  const controller = pibbl(canvas, root); controllers.push(controller); await nextFrame();
  expect([...canvas.getContext('2d')!.getImageData(75, 5, 1, 1).data]).toEqual([0, 0, 255, 255]);
  expect([...canvas.getContext('2d')!.getImageData(5, 17, 1, 1).data]).toEqual([0, 128, 0, 255]);
  clickCanvas(canvas, 75, 5); clickCanvas(canvas, 5, 17); expect(hits).toEqual(['B', 'C']);
});

it.runIf(experimentalLayout)('places reversed main axes with physical margins while preserving source order', async () => {
  const first = createElement(Rectangle, { style: { width: 40, height: 40, flexShrink: 0, minWidth: 0, minHeight: 0, marginLeft: 3, marginRight: 7, marginTop: 3, marginBottom: 7 } });
  const second = createElement(Rectangle, { style: { width: 30, height: 30, flexShrink: 0, minWidth: 0, minHeight: 0, marginLeft: 5, marginRight: 9, marginTop: 5, marginBottom: 9 } });
  expect(layoutFlex({ x: 0, y: 0, width: 150, height: 150 }, [first, second], { flexDirection: 'row-reverse', gap: 10, alignItems: 'flex-start' }, measurement))
    .toEqual([{ x: 103, y: 3, width: 40, height: 40 }, { x: 51, y: 5, width: 30, height: 30 }]);
  expect(layoutFlex({ x: 0, y: 0, width: 150, height: 150 }, [first, second], { flexDirection: 'column-reverse', gap: 10, alignItems: 'flex-start' }, measurement))
    .toEqual([{ x: 3, y: 103, width: 40, height: 40 }, { x: 5, y: 51, width: 30, height: 30 }]);
  const wrapped = () => createElement(Rectangle, { style: { width: 80, height: 20, minWidth: 0, margin: 5 } });
  expect(layoutFlex({ x: 0, y: 0, width: 180, height: 60 }, [wrapped(), wrapped(), wrapped()], { flexDirection: 'row-reverse', flexWrap: 'wrap', alignContent: 'flex-start' }, measurement))
    .toEqual([{ x: 95, y: 5, width: 80, height: 20 }, { x: 5, y: 5, width: 80, height: 20 }, { x: 95, y: 35, width: 80, height: 20 }]);
  const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 40; document.body.append(canvas);
  const hits: string[] = [];
  const child = (name: string, fill: string) => createElement(Rectangle, { style: { width: 80, height: 20, marginLeft: -10, minWidth: 0, fill }, onClick: () => hits.push(name) });
  const controller = pibbl(canvas, createElement(Flex, { style: { width: 140, height: 30, flexDirection: 'row-reverse' }, children: [child('A', 'red'), child('B', 'blue')] }));
  controllers.push(controller); await nextFrame();
  expect([...canvas.getContext('2d')!.getImageData(65, 5, 1, 1).data]).toEqual([0, 0, 255, 255]);
  clickCanvas(canvas, 65, 5); clickCanvas(canvas, 100, 5); expect(hits).toEqual(['B', 'A']);
});

it.runIf(experimentalLayout)('uses main-direction start/end distribution for reversed axes', () => {
  const child = () => createElement(Rectangle, { style: { width: 40, height: 40, minWidth: 0, minHeight: 0, flexShrink: 0 } });
  for (const [justifyContent, offset] of [['flex-start', 60], ['flex-end', 0], ['center', 30]] as const) {
    expect(layoutFlex({ x: 0, y: 0, width: 100, height: 100 }, [child()], { flexDirection: 'row-reverse', justifyContent, alignItems: 'flex-start' }, measurement)[0].x).toBe(offset);
    expect(layoutFlex({ x: 0, y: 0, width: 100, height: 100 }, [child()], { flexDirection: 'column-reverse', justifyContent, alignItems: 'flex-start' }, measurement)[0].y).toBe(offset);
  }
});

it.runIf(experimentalLayout)('places wrap-reverse lines and cross alignment with physical margins without reversing source hits', async () => {
  const rowChild = (height: number, top: number, bottom: number) => createElement(Rectangle, { style: { width: 80, height, minWidth: 0, marginLeft: 5, marginRight: 5, marginTop: top, marginBottom: bottom } });
  const rowChildren = () => [rowChild(20, 3, 7), rowChild(10, 1, 9), rowChild(20, 3, 7)];
  expect(layoutFlex({ x: 0, y: 0, width: 180, height: 80 }, rowChildren(), { flexWrap: 'wrap-reverse', alignItems: 'flex-start', alignContent: 'flex-start' }, measurement))
    .toEqual([{ x: 5, y: 53, width: 80, height: 20 }, { x: 95, y: 61, width: 80, height: 10 }, { x: 5, y: 23, width: 80, height: 20 }]);
  expect(layoutFlex({ x: 0, y: 0, width: 180, height: 80 }, rowChildren(), { flexDirection: 'row-reverse', flexWrap: 'wrap-reverse', alignItems: 'flex-start', alignContent: 'flex-start' }, measurement))
    .toEqual([{ x: 95, y: 53, width: 80, height: 20 }, { x: 5, y: 61, width: 80, height: 10 }, { x: 95, y: 23, width: 80, height: 20 }]);
  const columnChild = (width: number, left: number, right: number) => createElement(Rectangle, { style: { width, height: 80, minHeight: 0, marginTop: 5, marginBottom: 5, marginLeft: left, marginRight: right } });
  expect(layoutFlex({ x: 0, y: 0, width: 80, height: 180 }, [columnChild(20, 3, 7), columnChild(10, 1, 9), columnChild(20, 3, 7)], { flexDirection: 'column', flexWrap: 'wrap-reverse', alignItems: 'flex-start', alignContent: 'flex-start' }, measurement))
    .toEqual([{ x: 53, y: 5, width: 20, height: 80 }, { x: 61, y: 95, width: 10, height: 80 }, { x: 23, y: 5, width: 20, height: 80 }]);
  const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 60; document.body.append(canvas); const hits: string[] = [];
  const child = (name: string, fill: string) => createElement(Rectangle, { style: { width: 80, height: 20, minWidth: 0, marginRight: -10, marginTop: -5, fill }, onClick: () => hits.push(name) });
  const controller = pibbl(canvas, createElement(Flex, { style: { width: 140, height: 50, flexWrap: 'wrap-reverse', alignItems: 'flex-start', alignContent: 'flex-start' }, children: [child('A', 'red'), child('B', 'blue'), child('C', 'green')] }));
  controllers.push(controller); await nextFrame();
  expect([...canvas.getContext('2d')!.getImageData(75, 40, 1, 1).data]).toEqual([0, 0, 255, 255]);
  expect([...canvas.getContext('2d')!.getImageData(5, 32, 1, 1).data]).toEqual([0, 128, 0, 255]);
  clickCanvas(canvas, 75, 40); clickCanvas(canvas, 5, 32); expect(hits).toEqual(['B', 'C']);
});

it.runIf(experimentalLayout)('shares one root WASM instance across independent Flex regions while isolating roots', async () => {
  const instantiate = vi.spyOn(WebAssembly.Instance.prototype, 'exports', 'get');
  const width = signal(100); const visible = signal(true);
  const justify = signal<'flex-start' | 'flex-end'>('flex-start');
  const pair = (left: number, value: number | typeof width) => createElement(Flex, { style: { left, width: value, height: 20, justifyContent: left === 0 ? justify : 'flex-start' }, children: [
    createElement(Rectangle, { style: { width: 60, height: 20, minWidth: 0, fill: 'red' } }),
    createElement(Rectangle, { style: { width: 60, height: 20, minWidth: 0, fill: 'blue' } }),
  ] });
  const App = () => [pair(0, width), visible.get() ? pair(120, 80) : null];
  const first = document.createElement('canvas'); first.width = 220; first.height = 30; document.body.append(first);
  const a = pibbl(first, createElement(App, {})); controllers.push(a); await nextFrame();
  expect(instantiate).toHaveBeenCalledTimes(1);
  const pixel = (canvas: HTMLCanvasElement, x: number) => [...canvas.getContext('2d')!.getImageData(x, 10, 1, 1).data];
  expect(pixel(first, 49)).toEqual([255, 0, 0, 255]); expect(pixel(first, 50)).toEqual([0, 0, 255, 255]);
  expect(pixel(first, 159)).toEqual([255, 0, 0, 255]); expect(pixel(first, 160)).toEqual([0, 0, 255, 255]);
  expect(snapshotWasmLayoutDiagnostics().activeWasmInstances).toBe(1);
  expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(2);
  const beforePlacement = snapshotWasmLayoutDiagnostics(); justify.set('flex-end'); await nextFrame();
  expect(snapshotWasmLayoutDiagnostics().solves).toBe(beforePlacement.solves);
  expect(snapshotWasmLayoutDiagnostics().mainPlacements).toBe(beforePlacement.mainPlacements + 1);
  expect(pixel(first, 49)).toEqual([255, 0, 0, 255]); expect(pixel(first, 50)).toEqual([0, 0, 255, 255]);
  const beforeWidth = snapshotWasmLayoutDiagnostics(); width.set(120); await nextFrame();
  expect(snapshotWasmLayoutDiagnostics().solves).toBe(beforeWidth.solves + 1);
  expect(pixel(first, 59)).toEqual([255, 0, 0, 255]); expect(pixel(first, 60)).toEqual([0, 0, 255, 255]);
  expect(pixel(first, 160)).toEqual([0, 0, 255, 255]); expect(instantiate).toHaveBeenCalledTimes(1);
  visible.set(false); await nextFrame(); expect(instantiate).toHaveBeenCalledTimes(1);
  visible.set(true); await nextFrame(); expect(pixel(first, 160)).toEqual([0, 0, 255, 255]); expect(instantiate).toHaveBeenCalledTimes(1);
  const second = document.createElement('canvas'); second.width = 100; second.height = 30; document.body.append(second);
  const b = pibbl(second, pair(0, 80)); controllers.push(b); await nextFrame(); expect(instantiate).toHaveBeenCalledTimes(2);
  a.dispose(); expect(snapshotWasmLayoutDiagnostics().activeWasmInstances).toBe(1); expect(pixel(second, 40)).toEqual([0, 0, 255, 255]); b.dispose();
  expect(snapshotWasmLayoutDiagnostics().activeWasmInstances).toBe(0);
  expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(0);
});

it.runIf(experimentalLayout)('shares the owning root instance with Flex inside a managed Layer', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 40; document.body.append(canvas);
  const inner = createElement(Flex, { style: { width: 80, height: 20 }, children: createElement(Rectangle, { style: { width: 80, height: 20, fill: 'red' } }) });
  const controller = pibbl(canvas, createElement(Flex, { style: { width: 100, height: 40 }, children: createElement(Layer, { style: { width: 80, height: 20, minWidth: 0 }, children: inner }) }));
  controllers.push(controller); await nextFrame();
  const mounted = snapshotWasmLayoutDiagnostics();
  expect(mounted.activeWasmInstances).toBe(baseline.activeWasmInstances + 1);
  expect(mounted.activeArenas).toBe(baseline.activeArenas + 2);
  expect([...canvas.getContext('2d')!.getImageData(10, 10, 1, 1).data]).toEqual([255, 0, 0, 255]);
  controller.dispose(); controller.dispose();
  const disposed = snapshotWasmLayoutDiagnostics();
  expect(disposed.activeWasmInstances).toBe(baseline.activeWasmInstances);
  expect(disposed.activeArenas).toBe(baseline.activeArenas);
  expect(disposed.activeNodes).toBe(baseline.activeNodes);
});

it.runIf(experimentalLayout)('preflights later known sibling Flex inputs before evaluating an earlier opaque child', async () => {
  const width = signal(80), grow = signal(0); let evaluations = 0;
  function Probe(_props: { style: Record<string, unknown> }) { evaluations++; const box = useLayoutBox(); return createElement(Rectangle, { style: { width: box.width, height: 20, fill: 'red' } }); }
  const scene = createElement(Absolute, { style: { width: 220, height: 30 }, children: [
    createElement(Flex, { style: { width, height: 20 }, children: createElement(Probe, { style: { width: 80, height: 20, minWidth: 0, flexGrow: 1 } }) }),
    createElement(Flex, { style: { left: 120, width: 80, height: 20 }, children: createElement(Rectangle, { style: { width: 80, height: 20, minWidth: 0, flexGrow: grow, fill: 'blue' } }) }),
  ] });
  const canvas = document.createElement('canvas'); canvas.width = 220; canvas.height = 30; document.body.append(canvas);
  const errors: unknown[] = []; const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); }; window.addEventListener('error', prevent);
  try {
    const controller = pibbl(canvas, scene); controllers.push(controller); await nextFrame(); expect(evaluations).toBe(1);
    width.set(100); grow.set(-1); await nextFrame();
    expect(errors.some(error => error instanceof Error && error.message.includes('flexGrow received -1'))).toBe(true); expect(evaluations).toBe(1);
    grow.set(0); pibbl(canvas, scene); await nextFrame(); expect(evaluations).toBe(2);
    expect([...canvas.getContext('2d')!.getImageData(90, 10, 1, 1).data]).toEqual([255, 0, 0, 255]);
  } finally { window.removeEventListener('error', prevent); }
});

it.runIf(experimentalLayout)('normalizes a preflighted receiver once per transaction without executing its component early', async () => {
  const { definePrimitive } = await import('@pibbl/core');
  let normalizations = 0, renders = 0, sequences = 0;
  type Style = { width: number; height: number; minWidth: number; custom: null };
  const Leaf = definePrimitive<{}, Style, Style, Style>((_props, style, ctx) => { renders++; ctx.fillRect(0, 0, style.width, style.height); }, {
    normalizeStyle(style) { normalizations++; return style; },
  });
  const width = signal(80);
  const children = { *[Symbol.iterator]() { sequences++; yield createElement(Leaf, { style: { width: 80, height: 20, minWidth: 0, custom: null } }); } };
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 30; document.body.append(canvas);
  const controller = pibbl(canvas, createElement(Absolute, { style: { width: 100, height: 30 }, children: createElement(Flex, { style: { width, height: 20 }, children }) }));
  controllers.push(controller); await nextFrame();
  expect([sequences, normalizations, renders]).toEqual([1, 1, 1]);
  width.set(90); await nextFrame();
  expect([sequences, normalizations, renders]).toEqual([2, 2, 2]);
});

it.runIf(experimentalLayout)('prepares later known sibling sizing failures before evaluating an earlier opaque child', async () => {
  const width = signal(80), minimum = signal(0); let evaluations = 0;
  function Probe(_props: { style: Record<string, unknown> }) { evaluations++; const box = useLayoutBox(); return createElement(Rectangle, { style: { width: box.width, height: 20, fill: 'red' } }); }
  const scene = createElement(Absolute, { style: { width: 220, height: 30 }, children: [
    createElement(Flex, { style: { width, height: 20 }, children: createElement(Probe, { style: { width: 80, height: 20, minWidth: 0, flexGrow: 1 } }) }),
    createElement(Flex, { style: { left: 120, width: 80, height: 20 }, children: createElement(Rectangle, { style: { width: 80, height: 20, minWidth: minimum, maxWidth: 80, fill: 'blue' } }) }),
  ] });
  const canvas = document.createElement('canvas'); canvas.width = 220; canvas.height = 30; document.body.append(canvas);
  const errors: unknown[] = []; const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); }; window.addEventListener('error', prevent);
  try {
    const baseline = snapshotWasmLayoutDiagnostics();
    const controller = pibbl(canvas, scene); controllers.push(controller); await nextFrame(); expect(evaluations).toBe(1);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBe(baseline.allocationPasses + 2);
    expect(snapshotWasmLayoutDiagnostics().solves).toBe(baseline.solves + 2);
    const mounted = snapshotWasmLayoutDiagnostics(); width.set(90); await nextFrame();
    expect(evaluations).toBe(2);
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBe(mounted.allocationPasses + 2);
    expect(snapshotWasmLayoutDiagnostics().solves).toBe(mounted.solves + 1);
    width.set(100); minimum.set(90); await nextFrame();
    expect(errors.some(error => error instanceof Error && error.message.includes('minimum must not exceed maximum'))).toBe(true);
    expect(evaluations).toBe(2);
    expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
    expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);
    minimum.set(0); pibbl(canvas, scene); await nextFrame(); expect(evaluations).toBe(3);
    expect([...canvas.getContext('2d')!.getImageData(90, 10, 1, 1).data]).toEqual([255, 0, 0, 255]);
  } finally { window.removeEventListener('error', prevent); }
});

it.runIf(experimentalLayout)('retains prepared keyed region ownership through reorder and releases removed slots', async () => {
  const order = signal(['A', 'B']); let serial = 0;
  const stamps = new Map<string, number>(); const hits: string[] = [];
  function Probe({ name }: { name: string; style: Record<string, unknown> }) {
    stamps.set(name, useConst(() => ++serial));
    const box = useLayoutBox();
    return createElement(Rectangle, { style: { width: box.width, height: box.height, fill: 'red' }, onClick: () => hits.push(name) });
  }
  function Scene() { return createElement(Absolute, { style: { width: 220, height: 30 }, children: order.get().map((name, index) => createElement(Flex, { key: name, style: { left: index * 100, width: 80, height: 20 }, children: createElement(Probe, { name, style: { width: 80, height: 20, minWidth: 0 } }) })) }); }
  const canvas = document.createElement('canvas'); canvas.width = 220; canvas.height = 30; document.body.append(canvas);
  const baseline = snapshotWasmLayoutDiagnostics(); const controller = pibbl(canvas, createElement(Scene, {})); controllers.push(controller); await nextFrame();
  const a = stamps.get('A'), b = stamps.get('B'), mounted = snapshotWasmLayoutDiagnostics();
  expect(mounted.activeArenas).toBe(baseline.activeArenas + 2);
  order.set(['B', 'A']); await nextFrame();
  expect([stamps.get('A'), stamps.get('B')]).toEqual([a, b]);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
  clickCanvas(canvas, 10, 10); clickCanvas(canvas, 110, 10); expect(hits).toEqual(['B', 'A']);
  order.set(['A']); await nextFrame(); expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas + 1);
  order.set(['B', 'A']); await nextFrame();
  expect(stamps.get('A')).toBe(a); expect(stamps.get('B')).not.toBe(b);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates + 1);
  controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics();
  expect([disposed.activeArenas, disposed.activeNodes, disposed.activeWasmInstances]).toEqual([baseline.activeArenas, baseline.activeNodes, baseline.activeWasmInstances]);
});

it.runIf(experimentalLayout).each([false, true])('consumes prepared wrapped Text allocations without a second pass (nested=%s)', async nested => {
  const width = signal(180); let probes = 0; const hits: string[] = [];
  const allocations: number[] = [];
  function Probe(_props: { style: Record<string, unknown> }) {
    probes++; const box = useLayoutBox(); allocations.push(box.width);
    return createElement(Rectangle, { style: { width: box.width, height: 20, fill: 'red' } });
  }
  const text = createElement(Text, { onClick: () => hits.push('text'), children: 'aaaa aaaa aaaa aaaa', style: { flexBasis: 0, flexGrow: 1, minWidth: 0, wrap: true, font: '10px monospace', lineHeight: 10 } });
  const probe = createElement(Probe, { style: { width: 30, height: 20, minWidth: 0, flexShrink: 0 } });
  const flexChildren = [text, probe];
  const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 100; document.body.append(canvas);
  const row = createElement(Flex, { style: { width: nested ? '100%' : width, height: 100, minHeight: 0, alignItems: 'flex-start' }, children: flexChildren });
  const scene = createElement(Absolute, { style: { width: 200, height: 100 }, children: nested ? createElement(Flex, { style: { width, height: 100, flexDirection: 'column' }, children: row }) : row });
  const baseline = snapshotWasmLayoutDiagnostics(); const controller = pibbl(canvas, scene); controllers.push(controller); await nextFrame();
  const mounted = snapshotWasmLayoutDiagnostics(); expect(probes).toBe(1); expect(allocations).toEqual([30]);
  expect(mounted.allocationPasses).toBe(baseline.allocationPasses + (nested ? 2 : 1)); expect(mounted.solves).toBe(baseline.solves + (nested ? 2 : 1));
  expect(mounted.measuredLeaves - baseline.measuredLeaves).toBeGreaterThan(0);
  const numeric = layoutFlex({ x: 0, y: 0, width: 180, height: 100 }, flexChildren, { alignItems: 'flex-start' }, { service: { measureText(value, font) { const ctx = canvas.getContext('2d')!; ctx.font = font; return ctx.measureText(value); } }, measureElement: (element, constraints) => measureElement(element, constraints, { measureText(value, font) { const ctx = canvas.getContext('2d')!; ctx.font = font; return ctx.measureText(value); } }) });
  expect(numeric[0].height).toBe(10); expect(numeric[1].x).toBe(150);
  clickCanvas(canvas, 45, 15); expect(hits).toEqual([]);
  const beforeNarrow = snapshotWasmLayoutDiagnostics(); width.set(90); await nextFrame();
  const narrow = snapshotWasmLayoutDiagnostics(); expect(probes).toBe(2);
  expect(narrow.allocationPasses).toBe(beforeNarrow.allocationPasses + (nested ? 2 : 1)); expect(narrow.solves).toBe(beforeNarrow.solves + 1);
  expect(narrow.nodeCreates).toBe(beforeNarrow.nodeCreates);
  expect([...canvas.getContext('2d')!.getImageData(65, 5, 1, 1).data]).toEqual([255, 0, 0, 255]);
  clickCanvas(canvas, 45, 15); expect(hits).toEqual(['text']);
});

it.runIf(experimentalLayout)('prepares a later nested known Flex before an earlier opaque sibling evaluates', async () => {
  const width = signal(180), grow = signal(0); let evaluations = 0;
  function Probe(_props: { style: Record<string, unknown> }) { evaluations++; const box = useLayoutBox(); return createElement(Rectangle, { style: { width: box.width, height: 20, fill: 'red' } }); }
  const scene = createElement(Absolute, { style: { width: 220, height: 30 }, children: createElement(Flex, { style: { width, height: 20 }, children: [
    createElement(Probe, { style: { width: 20, height: 20, minWidth: 0, flexGrow: 1 } }),
    createElement(Flex, { key: 'inner', style: { width: 80, height: 20, minWidth: 0, flexShrink: 0 }, children: createElement(Rectangle, { style: { width: 80, height: 20, minWidth: 0, flexGrow: grow, fill: 'blue' } }) }),
  ] }) });
  const canvas = document.createElement('canvas'); canvas.width = 220; canvas.height = 30; document.body.append(canvas);
  const errors: unknown[] = []; const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); }; window.addEventListener('error', prevent);
  try {
    const baseline = snapshotWasmLayoutDiagnostics();
    const controller = pibbl(canvas, scene); controllers.push(controller); await nextFrame(); expect(evaluations).toBe(1);
    const mounted = snapshotWasmLayoutDiagnostics();
    expect(mounted.allocationPasses).toBe(baseline.allocationPasses + 2); expect(mounted.solves).toBe(baseline.solves + 2);
    expect(mounted.activeArenas).toBe(baseline.activeArenas + 2); expect(mounted.activeWasmInstances).toBe(baseline.activeWasmInstances + 1);
    width.set(190); await nextFrame(); expect(evaluations).toBe(2);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBe(mounted.allocationPasses + 2);
    expect(snapshotWasmLayoutDiagnostics().solves).toBe(mounted.solves + 1);
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    width.set(200); grow.set(-1); await nextFrame();
    expect(errors.some(error => error instanceof Error && error.message.includes('flexGrow received -1'))).toBe(true);
    expect(evaluations).toBe(2);
    grow.set(0); pibbl(canvas, scene); await nextFrame(); expect(evaluations).toBe(3);
    expect([...canvas.getContext('2d')!.getImageData(110, 10, 1, 1).data]).toEqual([255, 0, 0, 255]);
  } finally { window.removeEventListener('error', prevent); }
});

it.runIf(experimentalLayout)('rejects cyclic known Flex descriptions before recursive region growth', async () => {
  let traversals = 0;
  let cyclic: PibblNode;
  const children = { *[Symbol.iterator]() { traversals++; yield cyclic; } };
  cyclic = createElement(Flex, { style: { width: 80, height: 20, minWidth: 0, flexShrink: 0 }, children });
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 30; document.body.append(canvas);
  const baseline = snapshotWasmLayoutDiagnostics(), errors: unknown[] = [];
  const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); }; window.addEventListener('error', prevent);
  try {
    const controller = pibbl(canvas, createElement(Absolute, { style: { width: 100, height: 30 }, children: cyclic })); controllers.push(controller); await nextFrame();
    expect(errors.some(error => error instanceof Error && error.message.includes('Known layout descriptions form a cycle'))).toBe(true);
    expect(traversals).toBe(1);
    expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
    expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);
    controller.dispose(); expect(snapshotWasmLayoutDiagnostics().activeWasmInstances).toBe(baseline.activeWasmInstances);
  } finally { window.removeEventListener('error', prevent); }
});

it.runIf(experimentalLayout)('retains nested prepared keyed regions through reorder and releases their subtree ownership', async () => {
  const order = signal(['A', 'B']); let serial = 0;
  const stamps = new Map<string, number>(); const hits: string[] = [];
  function Probe({ name }: { name: string; style: Record<string, unknown> }) {
    stamps.set(name, useConst(() => ++serial));
    const box = useLayoutBox();
    return createElement(Rectangle, { style: { width: box.width, height: box.height, fill: 'red' }, onClick: () => hits.push(name) });
  }
  function Scene() { return createElement(Absolute, { style: { width: 220, height: 30 }, children: createElement(Flex, { style: { width: 200, height: 20 }, children: order.get().map(name => createElement(Flex, { key: name, style: { width: 80, height: 20, minWidth: 0, flexShrink: 0 }, children: createElement(Probe, { name, style: { width: 80, height: 20, minWidth: 0 } }) })) }) }); }
  const canvas = document.createElement('canvas'); canvas.width = 220; canvas.height = 30; document.body.append(canvas);
  const baseline = snapshotWasmLayoutDiagnostics(); const controller = pibbl(canvas, createElement(Scene, {})); controllers.push(controller); await nextFrame();
  const a = stamps.get('A'), b = stamps.get('B'), mounted = snapshotWasmLayoutDiagnostics();
  expect(mounted.activeArenas).toBe(baseline.activeArenas + 3);
  order.set(['B', 'A']); await nextFrame();
  expect([stamps.get('A'), stamps.get('B')]).toEqual([a, b]);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
  clickCanvas(canvas, 10, 10); clickCanvas(canvas, 90, 10); expect(hits).toEqual(['B', 'A']);
  order.set(['A']); await nextFrame(); expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas + 2);
  order.set(['B', 'A']); await nextFrame();
  expect(stamps.get('A')).toBe(a); expect(stamps.get('B')).not.toBe(b);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates + 2);
  controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics();
  expect([disposed.activeArenas, disposed.activeNodes, disposed.activeWasmInstances]).toEqual([baseline.activeArenas, baseline.activeNodes, baseline.activeWasmInstances]);
});

it.runIf(experimentalLayout).each([false, true])('prepares a direct or opaque-boundary Flex entry before earlier children (opaque=%s)', async opaque => {
  const width = signal(180), grow = signal(0); let evaluations = 0;
  function Probe(_props: { style: Record<string, unknown> }) { evaluations++; const box = useLayoutBox(); return createElement(Rectangle, { style: { width: box.width, height: 20, fill: 'red' } }); }
  const flex = createElement(Flex, { style: { width, height: 20 }, children: [
    createElement(Probe, { style: { width: 20, height: 20, minWidth: 0, flexGrow: 1 } }),
    createElement(Flex, { key: 'inner', style: { width: 80, height: 20, minWidth: 0, flexShrink: 0 }, children: createElement(Rectangle, { style: { width: 80, height: 20, minWidth: 0, flexGrow: grow, fill: 'blue' } }) }),
  ] });
  let outerCalls = 0; const outerWidths: number[] = [];
  function Boundary() { outerCalls++; outerWidths.push(useLayoutBox().width); return flex; }
  const scene = opaque ? createElement(Boundary, {}) : flex;
  const canvas = document.createElement('canvas'); canvas.width = 220; canvas.height = 30; document.body.append(canvas);
  const errors: unknown[] = []; const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); }; window.addEventListener('error', prevent);
  try {
    const baseline = snapshotWasmLayoutDiagnostics();
    const controller = pibbl(canvas, scene); controllers.push(controller); await nextFrame(); expect(evaluations).toBe(1);
    expect(outerCalls).toBe(opaque ? 1 : 0);
    const mounted = snapshotWasmLayoutDiagnostics();
    expect(mounted.allocationPasses).toBe(baseline.allocationPasses + 2); expect(mounted.solves).toBe(baseline.solves + 2);
    expect(mounted.activeArenas).toBe(baseline.activeArenas + 2); expect(mounted.activeWasmInstances).toBe(baseline.activeWasmInstances + 1);
    width.set(190); await nextFrame(); expect(evaluations).toBe(2);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBe(mounted.allocationPasses + 2);
    expect(snapshotWasmLayoutDiagnostics().solves).toBe(mounted.solves + 1);
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    width.set(200); grow.set(-1); await nextFrame();
    expect(errors.some(error => error instanceof Error && error.message.includes('flexGrow received -1'))).toBe(true);
    expect(evaluations).toBe(2); expect(outerCalls).toBe(opaque ? 3 : 0);
    grow.set(0); pibbl(canvas, scene); await nextFrame(); expect(evaluations).toBe(3);
    expect([...canvas.getContext('2d')!.getImageData(110, 10, 1, 1).data]).toEqual([255, 0, 0, 255]);
    expect(outerCalls).toBe(opaque ? 4 : 0); expect(outerWidths.every(value => value === 220)).toBe(true);
  } finally { window.removeEventListener('error', prevent); }
});

it.runIf(experimentalLayout)('prepares a described Flex root before earlier opaque siblings with one description per transaction', async () => {
  const { defineLayoutComponent } = await import('@pibbl/core');
  const width = signal(180), grow = signal(0); let evaluations = 0, descriptions = 0, hits = 0;
  function Probe(_props: { style: Record<string, unknown> }) { evaluations++; const box = useLayoutBox(); return createElement(Rectangle, { style: { width: box.width, height: 20, fill: 'red' }, onClick: () => hits++ }); }
  const Card = defineLayoutComponent((props: { style: import('@pibbl/core').FlexStyle; grow: typeof grow }) => {
    descriptions++;
    return createElement(Flex, { style: props.style, children: createElement(Rectangle, { style: { width: 80, height: 20, minWidth: 0, flexGrow: props.grow, fill: 'blue' } }) });
  });
  const scene = createElement(Flex, { style: { width, height: 20 }, children: [
    createElement(Probe, { style: { width: 20, height: 20, minWidth: 0, flexGrow: 1 } }),
    createElement(Card, { key: 'card', style: { width: 80, height: 20, minWidth: 0, flexShrink: 0 }, grow }),
  ] });
  const canvas = document.createElement('canvas'); canvas.width = 220; canvas.height = 30; document.body.append(canvas);
  const errors: unknown[] = []; const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); }; window.addEventListener('error', prevent);
  try {
    const controller = pibbl(canvas, scene); controllers.push(controller); await nextFrame(); expect([evaluations, descriptions]).toEqual([1, 1]);
    const mounted = snapshotWasmLayoutDiagnostics(); width.set(190); await nextFrame(); expect([evaluations, descriptions]).toEqual([2, 2]);
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    width.set(200); grow.set(-1); await nextFrame();
    expect(errors.some(error => error instanceof Error && error.message.includes('flexGrow received -1'))).toBe(true);
    expect([evaluations, descriptions]).toEqual([2, 3]); clickCanvas(canvas, 110, 10); expect(hits).toBe(0);
    grow.set(0); pibbl(canvas, scene); await nextFrame(); expect([evaluations, descriptions]).toEqual([3, 4]);
    expect([...canvas.getContext('2d')!.getImageData(110, 10, 1, 1).data]).toEqual([255, 0, 0, 255]);
    clickCanvas(canvas, 110, 10); expect(hits).toBe(1);
  } finally { window.removeEventListener('error', prevent); }
});

it.runIf(experimentalLayout)('replaces a prepared described root region when its own key changes', async () => {
  const { defineLayoutComponent, useReaction } = await import('@pibbl/core');
  const rootKey = signal('first'); let mounts = 0, cleanups = 0;
  function Owned(_props: { style: Record<string, unknown> }) {
    useConst(() => ++mounts); useReaction(() => () => { cleanups++; }, []);
    return createElement(Rectangle, { style: { width: 10, height: 10, fill: 'red' } });
  }
  const Card = defineLayoutComponent(() => createElement(Flex, { key: rootKey.get(), style: { width: 40, height: 40, minWidth: 0, flexShrink: 0 }, children: createElement(Owned, { style: { width: 10, height: 10, minWidth: 0, flexShrink: 0 } }) }));
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100; document.body.append(canvas);
  const baseline = snapshotWasmLayoutDiagnostics(); const controller = pibbl(canvas, createElement(Flex, { style: { width: 100, height: 100 }, children: createElement(Card, {}) })); controllers.push(controller); await nextFrame();
  const mounted = snapshotWasmLayoutDiagnostics(); expect(mounted.activeArenas).toBe(baseline.activeArenas + 2); expect(mounts).toBe(1);
  rootKey.set('second'); await nextFrame();
  expect([mounts, cleanups]).toEqual([2, 1]); expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(mounted.activeArenas);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates + 1);
  controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics(); expect(cleanups).toBe(2);
  expect([disposed.activeArenas, disposed.activeNodes, disposed.activeWasmInstances]).toEqual([baseline.activeArenas, baseline.activeNodes, baseline.activeWasmInstances]);
});

it.runIf(experimentalLayout)('prepares a later Layer direct Flex before earlier opaque siblings and child bitmap work', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const width = signal(80), grow = signal(0), shown = signal(true);
  let evaluations = 0, layerEvaluations = 0, hits = 0;
  function Probe(_props: { style: Record<string, unknown> }) { evaluations++; return createElement(Rectangle, { style: { width: useLayoutBox().width, height: 20, fill: 'red' } }); }
  function LayerProbe(_props: { style: Record<string, unknown> }) { layerEvaluations++; const box = useLayoutBox(); return createElement(Rectangle, { style: { width: box.width, height: 20, fill: 'blue' }, onClick: () => hits++ }); }
  const scene = () => createElement(Absolute, { style: { width: 240, height: 30 }, children: [
    createElement(Flex, { style: { width, height: 20 }, children: createElement(Probe, { style: { width: 80, height: 20, minWidth: 0 } }) }),
    ...(shown.get() ? [createElement(Layer, { key: 'later', style: { left: 120, width: 100, height: 20 }, children: createElement(Flex, { style: { left: 10, top: 3, width: 100, height: 20 }, children: createElement(LayerProbe, { style: { width: 80, height: 20, minWidth: 0, flexGrow: grow } }) }) })] : []),
  ] });
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 30; document.body.append(canvas);
  const errors: unknown[] = []; const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); }; window.addEventListener('error', prevent);
  try {
    const controller = pibbl(canvas, scene()); controllers.push(controller); await nextFrame();
    expect(errors.map(error => String(error))).toEqual([]); expect([evaluations, layerEvaluations]).toEqual([1, 1]);
    const mounted = snapshotWasmLayoutDiagnostics();
    expect(mounted.activeWasmInstances - baseline.activeWasmInstances).toBe(1);
    expect(mounted.activeArenas - baseline.activeArenas).toBe(2);
    width.set(85); await nextFrame();
    expect([evaluations, layerEvaluations]).toEqual([2, 1]);
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(mounted.activeArenas);
    width.set(90); grow.set(-1); await nextFrame();
    expect(errors.some(error => error instanceof Error && error.message.includes('flexGrow received -1'))).toBe(true);
    expect([evaluations, layerEvaluations]).toEqual([2, 1]);
    grow.set(1); pibbl(canvas, scene()); await nextFrame();
    expect([evaluations, layerEvaluations]).toEqual([3, 2]);
    expect([...canvas.getContext('2d')!.getImageData(210, 10, 1, 1).data]).toEqual([0, 0, 255, 255]);
    expect([...canvas.getContext('2d')!.getImageData(125, 10, 1, 1).data]).toEqual([0, 0, 0, 0]);
    clickCanvas(canvas, 125, 10); expect(hits).toBe(0);
    clickCanvas(canvas, 210, 10); expect(hits).toBe(1);
    shown.set(false); pibbl(canvas, scene()); await nextFrame();
    expect(snapshotWasmLayoutDiagnostics().activeArenas - baseline.activeArenas).toBe(1);
    shown.set(true); pibbl(canvas, scene()); await nextFrame();
    expect(layerEvaluations).toBe(3);
    expect(snapshotWasmLayoutDiagnostics().activeArenas - baseline.activeArenas).toBe(2);
    clickCanvas(canvas, 210, 10); expect(hits).toBe(2);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect(disposed.activeArenas).toBe(baseline.activeArenas); expect(disposed.activeNodes).toBe(baseline.activeNodes); expect(disposed.activeWasmInstances).toBe(baseline.activeWasmInstances);
  } finally { window.removeEventListener('error', prevent); }
});


it.runIf(experimentalLayout)('prepares a later Grid Flex cell before an earlier opaque cell evaluates', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const width = signal(200), grow = signal(1); let evaluations = 0, hits = 0;
  function Probe(_props: { style: Record<string, unknown> }) { evaluations++; return createElement(Rectangle, { style: { width: useLayoutBox().width, height: 20, fill: 'red' } }); }
  const scene = createElement(Grid, { style: { width, height: 20, gridTemplateColumns: ['1fr', '1fr'], gridTemplateRows: [20] }, children: [
    createElement(Probe, { style: { width: '100%', height: 20, gridColumnStart: 1, gridRowStart: 1 } }),
    createElement(Flex, { key: 'cell', style: { width: '100%', height: 20, gridColumnStart: 2, gridRowStart: 1 }, children: createElement(Rectangle, { style: { width: 20, height: 20, minWidth: 0, flexGrow: grow, fill: 'blue' }, onClick: () => hits++ }) }),
  ] });
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 30; document.body.append(canvas);
  const errors: unknown[] = []; const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); }; window.addEventListener('error', prevent);
  try {
    const controller = pibbl(canvas, scene); controllers.push(controller); await nextFrame(); expect(errors).toEqual([]); expect(evaluations).toBe(1);
    width.set(220); grow.set(-1); await nextFrame();
    expect(errors.some(error => error instanceof Error && error.message.includes('flexGrow received -1'))).toBe(true);
    expect(evaluations).toBe(1); clickCanvas(canvas, 210, 10); expect(hits).toBe(0);
    grow.set(1); pibbl(canvas, scene); await nextFrame(); expect(evaluations).toBe(2);
    expect([...canvas.getContext('2d')!.getImageData(105, 10, 1, 1).data]).toEqual([255, 0, 0, 255]);
    expect([...canvas.getContext('2d')!.getImageData(210, 10, 1, 1).data]).toEqual([0, 0, 255, 255]);
    clickCanvas(canvas, 210, 10); expect(hits).toBe(1);
    controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics();
    expect(disposed.activeNodes).toBe(baseline.activeNodes); expect(disposed.activeArenas).toBe(baseline.activeArenas); expect(disposed.activeWasmInstances).toBe(baseline.activeWasmInstances);
  } finally { window.removeEventListener('error', prevent); }
});


it.runIf(experimentalLayout)('prepares a later Flow Flex before an earlier opaque child evaluates', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const width = signal(200), grow = signal(1); let evaluations = 0, hits = 0;
  function Probe(_props: { style: Record<string, unknown> }) { evaluations++; return createElement(Rectangle, { style: { width: useLayoutBox().width, height: 20, fill: 'red' } }); }
  const scene = createElement(Flow, { style: { width, height: 20, direction: 'horizontal', wrap: false, gap: 10 }, children: [
    createElement(Probe, { style: { width: 80, height: 20 } }),
    createElement(Flex, { key: 'later', style: { width: 80, height: 20 }, children: createElement(Rectangle, { style: { width: 20, height: 20, minWidth: 0, flexGrow: grow, fill: 'blue' }, onClick: () => hits++ }) }),
  ] });
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 30; document.body.append(canvas);
  const errors: unknown[] = []; const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); }; window.addEventListener('error', prevent);
  try {
    const controller = pibbl(canvas, scene); controllers.push(controller); await nextFrame(); expect(errors).toEqual([]); expect(evaluations).toBe(1);
    width.set(220); grow.set(-1); await nextFrame();
    expect(errors.some(error => error instanceof Error && error.message.includes('flexGrow received -1'))).toBe(true);
    expect(evaluations).toBe(1); clickCanvas(canvas, 160, 10); expect(hits).toBe(0);
    grow.set(1); pibbl(canvas, scene); await nextFrame(); expect(evaluations).toBe(2);
    expect([...canvas.getContext('2d')!.getImageData(85, 10, 1, 1).data]).toEqual([0, 0, 0, 0]);
    expect([...canvas.getContext('2d')!.getImageData(160, 10, 1, 1).data]).toEqual([0, 0, 255, 255]);
    clickCanvas(canvas, 160, 10); expect(hits).toBe(1);
    controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics();
    expect(disposed.activeNodes).toBe(baseline.activeNodes); expect(disposed.activeArenas).toBe(baseline.activeArenas); expect(disposed.activeWasmInstances).toBe(baseline.activeWasmInstances);
  } finally { window.removeEventListener('error', prevent); }
});

it.runIf(experimentalLayout)('resolves public mixed Grid tracks natively and reuses them for paint-only updates', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const resolutions = () => (snapshotWasmLayoutDiagnostics() as ReturnType<typeof snapshotWasmLayoutDiagnostics> & { gridTrackResolutions?: number }).gridTrackResolutions ?? 0;
  const before = resolutions(); const width = signal(200), fill = signal('red');
  const boxes = new Map<number, number>(); let hits = 0;
  function Cell({ id, color }: { id: number; color: string | typeof fill; style: Record<string, unknown> }) {
    const box = useLayoutBox(); boxes.set(id, box.width);
    return createElement(Rectangle, { style: { width: box.width, height: 20, fill: color }, onClick: () => { if (id === 3) hits++; } });
  }
  const scene = createElement(Grid, { style: { width, height: 20, gridTemplateColumns: [20, '25%', '1fr'], gridTemplateRows: [20], columnGap: 10 }, children: [
    createElement(Cell, { id: 1, color: fill, style: { width: '100%', height: 20, gridColumnStart: 1, gridRowStart: 1 } }),
    createElement(Cell, { id: 2, color: 'green', style: { width: '100%', height: 20, gridColumnStart: 2, gridRowStart: 1 } }),
    createElement(Cell, { id: 3, color: 'blue', style: { width: '100%', height: 20, gridColumnStart: 3, gridRowStart: 1 } }),
  ] });
  const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 30; document.body.append(canvas);
  const controller = pibbl(canvas, scene); controllers.push(controller); await nextFrame();
  expect([...boxes.values()]).toEqual([20, 50, 110]);
  clickCanvas(canvas, 100, 10); expect(hits).toBe(1);
  expect(resolutions() - before).toBe(2);
  width.set(260); await nextFrame();
  expect([...boxes.values()]).toEqual([20, 65, 155]);
  clickCanvas(canvas, 100, 10); expect(hits).toBe(1);
  clickCanvas(canvas, 110, 10); expect(hits).toBe(2);
  expect(resolutions() - before).toBe(3);
  fill.set('orange'); await nextFrame();
  expect([...canvas.getContext('2d')!.getImageData(10, 10, 1, 1).data]).toEqual([255, 165, 0, 255]);
  expect(resolutions() - before).toBe(3);
  controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics();
  expect(disposed.activeNodes).toBe(baseline.activeNodes); expect(disposed.activeArenas).toBe(baseline.activeArenas); expect(disposed.activeWasmInstances).toBe(baseline.activeWasmInstances);
});


it.runIf(experimentalLayout)('places explicit spanning Grid cells natively and preserves small spans after huge tracks', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const placements = () => (snapshotWasmLayoutDiagnostics() as ReturnType<typeof snapshotWasmLayoutDiagnostics> & { gridCellPlacements?: number }).gridCellPlacements ?? 0;
  const before = placements(); const width = signal(200), fill = signal('blue'); let hits = 0, usedWidth = 0, usedHeight = 0;
  function Cell(_props: { style: Record<string, unknown> }) {
    const box = useLayoutBox(); usedWidth = box.width; usedHeight = box.height;
    return createElement(Rectangle, { style: { width: box.width, height: box.height, fill }, onClick: () => hits++ });
  }
  const scene = createElement(Grid, { style: { width, height: 45, gridTemplateColumns: [20, '25%', '1fr'], gridTemplateRows: [20,20], columnGap: 10, rowGap: 5 }, children: createElement(Cell, { style: { width: '100%', height: '100%', gridColumnStart: 2, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 2 } }) });
  const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 50; document.body.append(canvas);
  const controller = pibbl(canvas, scene); controllers.push(controller); await nextFrame();
  expect([usedWidth, usedHeight]).toEqual([170,45]);
  expect(placements() - before).toBe(1);
  clickCanvas(canvas, 210, 40); expect(hits).toBe(0);
  width.set(260); await nextFrame(); expect([usedWidth, usedHeight]).toEqual([230,45]);
  expect(placements() - before).toBe(2);
  clickCanvas(canvas, 210, 40); expect(hits).toBe(1);
  fill.set('orange'); await nextFrame(); expect(placements() - before).toBe(2);
  expect([...canvas.getContext('2d')!.getImageData(210, 40, 1, 1).data]).toEqual([255,165,0,255]);
  pibbl(canvas, createElement(Grid, { style: { width: 100, height: 20, gridTemplateColumns: [1e20,1], gridTemplateRows: [20] }, children: createElement(Cell, { style: { width: '100%', height: 20, gridColumnStart: 2, gridRowStart: 1 } }) }));
  await nextFrame(); expect([usedWidth,usedHeight]).toEqual([1,20]);
  controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics();
  expect(disposed.activeArenas).toBe(baseline.activeArenas); expect(disposed.activeNodes).toBe(baseline.activeNodes); expect(disposed.activeWasmInstances).toBe(baseline.activeWasmInstances);
});

it.runIf(experimentalLayout)('keeps native Grid track results valid when resolution grows WASM memory', () => {
  const NativeInstance = WebAssembly.Instance;
  let growths = 0;
  vi.stubGlobal('WebAssembly', Object.assign(Object.create(WebAssembly), {
    Instance: class {
      readonly exports: WebAssembly.Exports;
      constructor(module: WebAssembly.Module, imports?: WebAssembly.Imports) {
        const instance = new NativeInstance(module, imports);
        const kernel = instance.exports;
        this.exports = { ...kernel, resolve_grid_tracks: (...args: number[]) => {
          const status = (kernel.resolve_grid_tracks as (...args: number[]) => number)(...args);
          (kernel.memory as WebAssembly.Memory).grow(1); growths++; return status;
        } };
      }
    },
  }));
  const region = new LayoutRegion();
  try {
    expect(region.resolveGridTracks([{ kind: 'fixed', value: 20 }, { kind: 'percentage', factor: 25 }, { kind: 'fraction', factor: 1 }], { axis: 'columns', bound: 200, gap: 10 })).toEqual([20,50,110]);
    expect(growths).toBe(1);
  } finally { region.dispose(); vi.unstubAllGlobals(); }
});

it.runIf(experimentalLayout).each(['horizontal', 'vertical'] as const)('places wrapped Flow lines natively with centered items and paint-only reuse (%s)', async direction => {
  const horizontal = direction === 'horizontal';
  const baseline = snapshotWasmLayoutDiagnostics();
  const placements = () => (snapshotWasmLayoutDiagnostics() as ReturnType<typeof snapshotWasmLayoutDiagnostics> & { flowPlacements?: number }).flowPlacements ?? 0;
  const before = placements(), bound = signal(60), fill = signal('blue'); let hits = 0;
  const scene = createElement(Flow, { style: { width: horizontal ? bound : 80, height: horizontal ? 80 : bound, direction, wrap: true, gap: 5, lineGap: 7, alignItems: 'center' }, children: [
    createElement(Rectangle, { style: { width: horizontal ? 30 : 20, height: horizontal ? 20 : 30, fill: 'red' } }),
    createElement(Rectangle, { style: { width: horizontal ? 20 : 10, height: horizontal ? 10 : 20, fill: 'green' } }),
    createElement(Rectangle, { style: { width: horizontal ? 30 : 15, height: horizontal ? 15 : 30, fill }, onClick: () => hits++ }),
  ] });
  const canvas = document.createElement('canvas'); canvas.width = horizontal ? 140 : 80; canvas.height = horizontal ? 80 : 140; document.body.append(canvas);
  const pixel = (main: number, cross: number) => [...canvas.getContext('2d')!.getImageData(horizontal ? main : cross, horizontal ? cross : main, 1, 1).data];
  const click = (main: number, cross: number) => clickCanvas(canvas, horizontal ? main : cross, horizontal ? cross : main);
  const controller = pibbl(canvas, scene); controllers.push(controller); await nextFrame();
  expect(pixel(37,2)).toEqual([0,0,0,0]);
  expect(pixel(37,7)).toEqual([0,128,0,255]);
  expect(pixel(5,30)).toEqual([0,0,255,255]);
  expect(placements() - before).toBe(1);
  click(5,30); expect(hits).toBe(1);
  bound.set(100); await nextFrame(); expect(placements() - before).toBe(2);
  click(5,30); expect(hits).toBe(1);
  click(65,10); expect(hits).toBe(2);
  fill.set('orange'); await nextFrame(); expect(placements() - before).toBe(2);
  expect(pixel(65,10)).toEqual([255,165,0,255]);
  controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics();
  expect(disposed.activeArenas).toBe(baseline.activeArenas); expect(disposed.activeNodes).toBe(baseline.activeNodes); expect(disposed.activeWasmInstances).toBe(baseline.activeWasmInstances);
});

it.runIf(experimentalLayout)('invalidates native Flow placement when a measured Text width changes', async () => {
  const before = snapshotWasmLayoutDiagnostics().flowPlacements;
  const content = signal('a'), fill = signal('blue'); let hits = 0;
  const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 30; document.body.append(canvas);
  const ctx = canvas.getContext('2d')!; ctx.save(); ctx.font = '10px monospace';
  const short = ctx.measureText('a').width, long = ctx.measureText('aaaaa').width; ctx.restore();
  const scene = createElement(Flow, { style: { width: 200, height: 20, gap: 5 }, children: [
    createElement(Text, { children: content, style: { font: '10px monospace', lineHeight: 20, height: 20 } }),
    createElement(Rectangle, { style: { width: 20, height: 20, fill }, onClick: () => hits++ }),
  ] });
  const controller = pibbl(canvas, scene); controllers.push(controller); await nextFrame();
  expect(snapshotWasmLayoutDiagnostics().flowPlacements - before).toBe(1);
  clickCanvas(canvas, short + 10, 10); expect(hits).toBe(1);
  content.set('aaaaa'); await nextFrame();
  expect(snapshotWasmLayoutDiagnostics().flowPlacements - before).toBe(2);
  clickCanvas(canvas, short + 10, 10); expect(hits).toBe(1);
  clickCanvas(canvas, long + 10, 10); expect(hits).toBe(2);
  fill.set('orange'); await nextFrame();
  expect(snapshotWasmLayoutDiagnostics().flowPlacements - before).toBe(2);
});

it.runIf(experimentalLayout)('prepares a later Grid root before earlier opaque siblings and adopts its native plan once', async () => {
  const baseline = snapshotWasmLayoutDiagnostics(), width = signal(100), grow = signal(1);
  let evaluations = 0, hits = 0;
  function Probe(_props: { style: Record<string, unknown> }) { evaluations++; return createElement(Rectangle, { style: { width: 80, height: 20, fill: 'red' } }); }
  const scene = createElement(Absolute, { style: { width: 260, height: 30 }, children: [
    createElement(Probe, { style: { width: 80, height: 20 } }),
    createElement(Grid, { key: 'later', style: { left: 120, width, height: 20, gridTemplateColumns: ['1fr'], gridTemplateRows: [20] }, children: createElement(Flex, { style: { width: '100%', height: 20, gridColumnStart: 1, gridRowStart: 1 }, children: createElement(Rectangle, { style: { width: 20, height: 20, minWidth: 0, flexGrow: grow, fill: 'blue' }, onClick: () => hits++ }) }) }),
  ] });
  const canvas = document.createElement('canvas'); canvas.width = 260; canvas.height = 30; document.body.append(canvas);
  const errors: unknown[] = []; const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); }; window.addEventListener('error', prevent);
  try {
    const controller = pibbl(canvas, scene); controllers.push(controller); await nextFrame(); expect(errors).toEqual([]); expect(evaluations).toBe(1);
    const mounted = snapshotWasmLayoutDiagnostics(); expect(mounted.activeArenas - baseline.activeArenas).toBe(2); expect(mounted.activeWasmInstances - baseline.activeWasmInstances).toBe(1);
    width.set(110); await nextFrame(); expect(evaluations).toBe(2);
    const updated = snapshotWasmLayoutDiagnostics();
    expect(updated.gridTrackResolutions - mounted.gridTrackResolutions).toBe(1);
    expect(updated.gridCellPlacements - mounted.gridCellPlacements).toBe(1);
    expect(updated.solves - mounted.solves).toBe(1); expect(updated.activeArenas).toBe(mounted.activeArenas); expect(updated.nodeCreates).toBe(mounted.nodeCreates);
    width.set(120); grow.set(-1); await nextFrame();
    expect(errors.some(error => error instanceof Error && error.message.includes('flexGrow received -1'))).toBe(true);
    expect(evaluations).toBe(2); expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas); expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes); clickCanvas(canvas, 225, 10); expect(hits).toBe(0);
    grow.set(1); pibbl(canvas, scene); await nextFrame(); expect(evaluations).toBe(3);
    expect([...canvas.getContext('2d')!.getImageData(235, 10, 1, 1).data]).toEqual([0,0,255,255]);
    clickCanvas(canvas, 235, 10); expect(hits).toBe(1);
    controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics();
    expect(disposed.activeArenas).toBe(baseline.activeArenas); expect(disposed.activeNodes).toBe(baseline.activeNodes); expect(disposed.activeWasmInstances).toBe(baseline.activeWasmInstances);
  } finally { window.removeEventListener('error', prevent); }
});

it.runIf(experimentalLayout)('prepares a later Flow root before earlier opaque siblings and adopts its native plan once', async () => {
  const baseline = snapshotWasmLayoutDiagnostics(), width = signal(100), grow = signal(1);
  let evaluations = 0, hits = 0;
  function Probe(_props: { style: Record<string, unknown> }) { evaluations++; return createElement(Rectangle, { style: { width: 80, height: 20, fill: 'red' } }); }
  const scene = createElement(Absolute, { style: { width: 260, height: 30 }, children: [
    createElement(Probe, { style: { width: 80, height: 20 } }),
    createElement(Flow, { key: 'later', style: { left: 120, width, height: 20 }, children: createElement(Flex, { style: { width: '100%', height: 20 }, children: createElement(Rectangle, { style: { width: 20, height: 20, minWidth: 0, flexGrow: grow, fill: 'blue' }, onClick: () => hits++ }) }) }),
  ] });
  const canvas = document.createElement('canvas'); canvas.width = 260; canvas.height = 30; document.body.append(canvas);
  const errors: unknown[] = []; const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); }; window.addEventListener('error', prevent);
  try {
    const controller = pibbl(canvas, scene); controllers.push(controller); await nextFrame(); expect(errors).toEqual([]); expect(evaluations).toBe(1);
    const mounted = snapshotWasmLayoutDiagnostics(); expect(mounted.activeArenas - baseline.activeArenas).toBe(2); expect(mounted.activeWasmInstances - baseline.activeWasmInstances).toBe(1);
    width.set(110); await nextFrame(); expect(evaluations).toBe(2);
    const updated = snapshotWasmLayoutDiagnostics(); expect(updated.flowPlacements - mounted.flowPlacements).toBe(1);
    expect(updated.solves - mounted.solves).toBe(1); expect(updated.activeArenas).toBe(mounted.activeArenas); expect(updated.nodeCreates).toBe(mounted.nodeCreates);
    width.set(120); grow.set(-1); await nextFrame();
    expect(errors.some(error => error instanceof Error && error.message.includes('flexGrow received -1'))).toBe(true);
    expect(evaluations).toBe(2); expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas); clickCanvas(canvas, 225, 10); expect(hits).toBe(0);
    grow.set(1); pibbl(canvas, scene); await nextFrame(); expect(evaluations).toBe(3);
    expect([...canvas.getContext('2d')!.getImageData(235, 10, 1, 1).data]).toEqual([0,0,255,255]); clickCanvas(canvas, 235, 10); expect(hits).toBe(1);
    controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics();
    expect(disposed.activeArenas).toBe(baseline.activeArenas); expect(disposed.activeNodes).toBe(baseline.activeNodes); expect(disposed.activeWasmInstances).toBe(baseline.activeWasmInstances);
  } finally { window.removeEventListener('error', prevent); }
});

it.runIf(experimentalLayout)('measures a prepared Flow leaf once per transaction before adopting its plan', async () => {
  const { definePrimitive } = await import('@pibbl/core');
  let measurements = 0;
  type Raw = import('@pibbl/core').SystemStyle & { width?: number | 'auto'; height?: number };
  type Resolved = import('@pibbl/core').SystemStyle & { width: number; height: number };
  const Measured = definePrimitive<{}, Raw, Raw, Resolved>((_props, _style, ctx) => { ctx.fillStyle = 'green'; ctx.fillRect(0,0,30,20); }, {
    resolveStyle: (style, context) => ({ width: typeof style.width === 'number' ? style.width : context.allocation.width, height: style.height ?? context.allocation.height }),
    measure: () => { measurements++; return { status: 'measured', size: { width: 30, height: 20 } }; },
  });
  const width = signal(100);
  const scene = createElement(Absolute, { style: { width: 200, height: 30 }, children: createElement(Flow, { style: { width, height: 20 }, children: createElement(Measured, { style: { width: 'auto', height: 20 } }) }) });
  const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 30; document.body.append(canvas);
  const controller = pibbl(canvas, scene); controllers.push(controller); await nextFrame(); expect(measurements).toBe(1);
  width.set(110); await nextFrame(); expect(measurements).toBe(2);
  expect([...canvas.getContext('2d')!.getImageData(10,10,1,1).data]).toEqual([0,128,0,255]);
});


it.runIf(experimentalLayout)('prepares an aligned later Overlay root before opaque siblings without an unnecessary native arena', async () => {
  const baseline = snapshotWasmLayoutDiagnostics(), width = signal(100), grow = signal(1); let evaluations = 0, hits = 0;
  function Probe(_props: { style: Record<string, unknown> }) { evaluations++; return createElement(Rectangle, { style: { width: 80, height: 20, fill: 'red' } }); }
  const scene = createElement(Absolute, { style: { width: 280, height: 60 }, children: [
    createElement(Probe, { style: { width: 80, height: 20 } }),
    createElement(Overlay, { key: 'later', style: { left: 120, width, height: 40, justifyItems: 'center', alignItems: 'end' }, children: createElement(Grid, { style: { width: '80%', height: 20, gridTemplateColumns: ['1fr'], gridTemplateRows: [20] }, children: createElement(Flex, { style: { width: '100%', height: 20, gridColumnStart: 1, gridRowStart: 1 }, children: createElement(Rectangle, { style: { width: 20, height: 20, minWidth: 0, flexGrow: grow, fill: 'blue' }, onClick: () => hits++ }) }) }) }),
  ] });
  const canvas = document.createElement('canvas'); canvas.width = 280; canvas.height = 60; document.body.append(canvas);
  const errors: unknown[] = []; const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); }; window.addEventListener('error', prevent);
  try {
    const controller = pibbl(canvas, scene); controllers.push(controller); await nextFrame(); expect(errors).toEqual([]); expect(evaluations).toBe(1);
    const mounted = snapshotWasmLayoutDiagnostics(); expect(mounted.activeArenas - baseline.activeArenas).toBe(2); expect(mounted.activeWasmInstances - baseline.activeWasmInstances).toBe(1);
    width.set(120); await nextFrame(); expect(evaluations).toBe(2);
    const updated = snapshotWasmLayoutDiagnostics(); expect(updated.gridTrackResolutions - mounted.gridTrackResolutions).toBe(1); expect(updated.gridCellPlacements - mounted.gridCellPlacements).toBe(1); expect(updated.solves - mounted.solves).toBe(1); expect(updated.activeArenas).toBe(mounted.activeArenas);
    width.set(140); grow.set(-1); await nextFrame();
    expect(errors.some(error => error instanceof Error && error.message.includes('flexGrow received -1'))).toBe(true);
    expect(evaluations).toBe(2); expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas); clickCanvas(canvas, 235, 30); expect(hits).toBe(0);
    grow.set(1); pibbl(canvas, scene); await nextFrame(); expect(evaluations).toBe(3);
    expect([...canvas.getContext('2d')!.getImageData(128,30,1,1).data]).toEqual([0,0,0,0]);
    expect([...canvas.getContext('2d')!.getImageData(235,30,1,1).data]).toEqual([0,0,255,255]); clickCanvas(canvas,235,30); expect(hits).toBe(1);
    controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics(); expect(disposed.activeArenas).toBe(baseline.activeArenas); expect(disposed.activeNodes).toBe(baseline.activeNodes); expect(disposed.activeWasmInstances).toBe(baseline.activeWasmInstances);
  } finally { window.removeEventListener('error', prevent); }
});

it.runIf(experimentalLayout)('prepares a nested Absolute root before opaque siblings without an unnecessary native arena', async () => {
  const baseline = snapshotWasmLayoutDiagnostics(), width = signal(100), grow = signal(1); let evaluations = 0, hits = 0;
  function Probe(_props: { style: Record<string, unknown> }) { evaluations++; return createElement(Rectangle, { style: { width: 80, height: 20, fill: 'red' } }); }
  const scene = createElement(Absolute, { style: { width: 280, height: 60 }, children: [
    createElement(Probe, { style: { width: 80, height: 20 } }),
    createElement(Overlay, { key: 'later', style: { left: 120, width, height: 40, justifyItems: 'center', alignItems: 'end' }, children: createElement(Absolute, { style: { width: '80%', height: 20 }, children: createElement(Grid, { style: { width: '100%', height: 20, gridTemplateColumns: ['1fr'], gridTemplateRows: [20] }, children: createElement(Flex, { style: { width: '100%', height: 20, gridColumnStart: 1, gridRowStart: 1 }, children: createElement(Rectangle, { style: { width: 20, height: 20, minWidth: 0, flexGrow: grow, fill: 'blue' }, onClick: () => hits++ }) }) }) }) }),
  ] });
  const canvas = document.createElement('canvas'); canvas.width = 280; canvas.height = 60; document.body.append(canvas);
  const errors: unknown[] = []; const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); }; window.addEventListener('error', prevent);
  try {
    const controller = pibbl(canvas, scene); controllers.push(controller); await nextFrame(); expect(errors).toEqual([]); expect(evaluations).toBe(1);
    const mounted = snapshotWasmLayoutDiagnostics(); expect(mounted.activeArenas - baseline.activeArenas).toBe(2); expect(mounted.activeWasmInstances - baseline.activeWasmInstances).toBe(1);
    width.set(120); await nextFrame(); expect(evaluations).toBe(2);
    const updated = snapshotWasmLayoutDiagnostics(); expect(updated.gridTrackResolutions - mounted.gridTrackResolutions).toBe(1); expect(updated.gridCellPlacements - mounted.gridCellPlacements).toBe(1); expect(updated.solves - mounted.solves).toBe(1); expect(updated.activeArenas).toBe(mounted.activeArenas);
    width.set(140); grow.set(-1); await nextFrame();
    expect(errors.some(error => error instanceof Error && error.message.includes('flexGrow received -1'))).toBe(true);
    expect(evaluations).toBe(2); expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas); clickCanvas(canvas, 235, 30); expect(hits).toBe(0);
    grow.set(1); pibbl(canvas, scene); await nextFrame(); expect(evaluations).toBe(3);
    expect([...canvas.getContext('2d')!.getImageData(128,30,1,1).data]).toEqual([0,0,0,0]);
    expect([...canvas.getContext('2d')!.getImageData(235,30,1,1).data]).toEqual([0,0,255,255]); clickCanvas(canvas,235,30); expect(hits).toBe(1);
    controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics(); expect(disposed.activeArenas).toBe(baseline.activeArenas); expect(disposed.activeNodes).toBe(baseline.activeNodes); expect(disposed.activeWasmInstances).toBe(baseline.activeWasmInstances);
  } finally { window.removeEventListener('error', prevent); }
});

for (const Root of [Grid, Flow, Overlay, Absolute, Layer]) {
for (const constrained of Root === Layer ? [false, true] : [false]) {
it.runIf(experimentalLayout)(`prepares a later Layer known ${Root.name} root constrained=${constrained} before earlier opaque siblings and child bitmap work`, async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const width = signal(80), grow = signal(0), shown = signal(true);
  let evaluations = 0, layerEvaluations = 0, hits = 0;
  function Probe(_props: { style: Record<string, unknown> }) { evaluations++; return createElement(Rectangle, { style: { width: useLayoutBox().width, height: 20, fill: 'red' } }); }
  function LayerProbe(_props: { style: Record<string, unknown> }) { layerEvaluations++; const box = useLayoutBox(); return createElement(Rectangle, { style: { width: box.width, height: 20, fill: 'blue' }, onClick: () => hits++ }); }
  const scene = () => createElement(Absolute, { style: { width: 240, height: 30 }, children: [
    createElement(Flex, { style: { width, height: 20 }, children: createElement(Probe, { style: { width: 80, height: 20, minWidth: 0 } }) }),
    ...(shown.get() ? [createElement(Layer, { key: 'later', style: { left: 120, width: 100, height: 20 }, children: createElement(Root as typeof Grid, { style: { left: 10, top: 3, width: 100, height: 20, ...(constrained ? { maxWidth: 50, padding: 2 } : {}), gridTemplateColumns: ['1fr'], gridTemplateRows: [20] }, children: createElement(Flex, { style: { width: '100%', height: 20, gridColumnStart: 1, gridRowStart: 1 }, children: createElement(LayerProbe, { style: { width: 80, height: 20, minWidth: 0, flexGrow: grow } }) }) }) })] : []),
  ] });
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 30; document.body.append(canvas);
  const errors: unknown[] = []; const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); }; window.addEventListener('error', prevent);
  try {
    const controller = pibbl(canvas, scene()); controllers.push(controller); await nextFrame();
    expect(errors.map(error => String(error))).toEqual([]); expect([evaluations, layerEvaluations]).toEqual([1, 1]);
    const mounted = snapshotWasmLayoutDiagnostics();
    expect(mounted.activeWasmInstances - baseline.activeWasmInstances).toBe(1);
    expect(mounted.activeArenas - baseline.activeArenas).toBe(Root === Grid || Root === Flow ? 3 : 2);
    width.set(85); await nextFrame();
    expect([evaluations, layerEvaluations]).toEqual([2, 1]);
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(mounted.activeArenas);
    width.set(90); grow.set(-1); await nextFrame();
    expect(errors.some(error => error instanceof Error && error.message.includes('flexGrow received -1'))).toBe(true);
    expect([evaluations, layerEvaluations]).toEqual([2, 1]);
    grow.set(1); pibbl(canvas, scene()); await nextFrame();
    expect([evaluations, layerEvaluations]).toEqual([3, 2]);
    expect([...canvas.getContext('2d')!.getImageData(210, 10, 1, 1).data]).toEqual([0, 0, 255, 255]);
    expect([...canvas.getContext('2d')!.getImageData(125, 10, 1, 1).data]).toEqual([0, 0, 0, 0]);
    clickCanvas(canvas, 125, 10); expect(hits).toBe(0);
    clickCanvas(canvas, 210, 10); expect(hits).toBe(1);
    shown.set(false); pibbl(canvas, scene()); await nextFrame();
    expect(snapshotWasmLayoutDiagnostics().activeArenas - baseline.activeArenas).toBe(1);
    shown.set(true); pibbl(canvas, scene()); await nextFrame();
    expect(layerEvaluations).toBe(3);
    expect(snapshotWasmLayoutDiagnostics().activeArenas - baseline.activeArenas).toBe(Root === Grid || Root === Flow ? 3 : 2);
    clickCanvas(canvas, 210, 10); expect(hits).toBe(2);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect(disposed.activeArenas).toBe(baseline.activeArenas); expect(disposed.activeNodes).toBe(baseline.activeNodes); expect(disposed.activeWasmInstances).toBe(baseline.activeWasmInstances);
  } finally { window.removeEventListener('error', prevent); }
});

}

}

for (const opaque of [false, true]) {
it.runIf(experimentalLayout)(`prepares direct-entry Layer known children opaque=${opaque} before opaque siblings and bitmap work`, async () => {
  const baseline = snapshotWasmLayoutDiagnostics(), width = signal(100), grow = signal(1); let evaluations = 0, hits = 0;
  function Probe(_props: { style: Record<string, unknown> }) { evaluations++; return createElement(Rectangle, { style: { width: 80, height: 20, fill: 'red' } }); }
  const layer = createElement(Layer, { style: { width: 280, height: 60 }, children: [
    createElement(Probe, { style: { width: 80, height: 20 } }),
    createElement(Overlay, { key: 'later', style: { left: 120, width, height: 40, justifyItems: 'center', alignItems: 'end' }, children: createElement(Absolute, { style: { width: '80%', height: 20 }, children: createElement(Grid, { style: { width: '100%', height: 20, gridTemplateColumns: ['1fr'], gridTemplateRows: [20] }, children: createElement(Flex, { style: { width: '100%', height: 20, gridColumnStart: 1, gridRowStart: 1 }, children: createElement(Rectangle, { style: { width: 20, height: 20, minWidth: 0, flexGrow: grow, fill: 'blue' }, onClick: () => hits++ }) }) }) }) }),
  ] });
  function OpaqueEntry() { return layer; }
  const scene = opaque ? createElement(OpaqueEntry, {}) : layer;
  const canvas = document.createElement('canvas'); canvas.width = 280; canvas.height = 60; document.body.append(canvas);
  const errors: unknown[] = []; const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); }; window.addEventListener('error', prevent);
  try {
    const controller = pibbl(canvas, scene); controllers.push(controller); await nextFrame(); expect(errors).toEqual([]); expect(evaluations).toBe(1);
    const mounted = snapshotWasmLayoutDiagnostics(); expect(mounted.activeArenas - baseline.activeArenas).toBe(2); expect(mounted.activeWasmInstances - baseline.activeWasmInstances).toBe(1);
    width.set(120); await nextFrame(); expect(evaluations).toBe(2);
    const updated = snapshotWasmLayoutDiagnostics(); expect(updated.gridTrackResolutions - mounted.gridTrackResolutions).toBe(1); expect(updated.gridCellPlacements - mounted.gridCellPlacements).toBe(1); expect(updated.solves - mounted.solves).toBe(1); expect(updated.activeArenas).toBe(mounted.activeArenas);
    width.set(140); grow.set(-1); await nextFrame();
    expect(errors.some(error => error instanceof Error && error.message.includes('flexGrow received -1'))).toBe(true);
    expect(evaluations).toBe(2); expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas); clickCanvas(canvas, 235, 30); expect(hits).toBe(0);
    grow.set(1); pibbl(canvas, scene); await nextFrame(); expect(evaluations).toBe(3);
    expect([...canvas.getContext('2d')!.getImageData(128,30,1,1).data]).toEqual([0,0,0,0]);
    expect([...canvas.getContext('2d')!.getImageData(235,30,1,1).data]).toEqual([0,0,255,255]); clickCanvas(canvas,235,30); expect(hits).toBe(1);
    controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics(); expect(disposed.activeArenas).toBe(baseline.activeArenas); expect(disposed.activeNodes).toBe(baseline.activeNodes); expect(disposed.activeWasmInstances).toBe(baseline.activeWasmInstances);
  } finally { window.removeEventListener('error', prevent); }
});


}

for (const Root of [Grid, Flow, Layer]) {
for (const constrained of Root === Layer ? [false, true] : [false]) {
for (const defaulted of Root === Layer && !constrained ? [false, true] : [false]) {
it.runIf(experimentalLayout)(`prepares a later Layer described ${Root.name} root constrained=${constrained} defaulted=${defaulted} before earlier opaque siblings and child bitmap work`, async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const width = signal(80), grow = signal(0), shown = signal(true);
  let evaluations = 0, layerEvaluations = 0, hits = 0;
  function Probe(_props: { style: Record<string, unknown> }) { evaluations++; return createElement(Rectangle, { style: { width: useLayoutBox().width, height: 20, fill: 'red' } }); }
  function LayerProbe(_props: { style: Record<string, unknown> }) { layerEvaluations++; const box = useLayoutBox(); return createElement(Rectangle, { style: { width: box.width, height: 20, fill: 'blue' }, onClick: () => hits++ }); }
  let descriptions = 0;
  const Card = defineLayoutComponent((props: { style: GridStyle; children: PibblNodeInput }) => {
    descriptions++;
    return createElement(Root as typeof Grid, { ...props, style: props.style });
  });
  const scene = () => createElement(Absolute, { style: { width: 240, height: 30 }, children: [
    createElement(Flex, { style: { width, height: 20 }, children: createElement(Probe, { style: { width: 80, height: 20, minWidth: 0 } }) }),
    ...(shown.get() ? [createElement(Layer, { key: 'later', style: { left: 120, width: 100, height: 20 }, children: createElement(Card, { style: { left: 10, top: 3, ...(defaulted ? {} : { width: 100, height: 20 }), ...(constrained ? { maxWidth: 50, padding: 2 } : {}), gridTemplateColumns: ['1fr'], gridTemplateRows: [20] }, children: createElement(Flex, { style: { width: '100%', height: 20, gridColumnStart: 1, gridRowStart: 1 }, children: createElement(LayerProbe, { style: { width: 80, height: 20, minWidth: 0, flexGrow: grow } }) }) }) })] : []),
  ] });
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 30; document.body.append(canvas);
  const errors: unknown[] = []; const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); }; window.addEventListener('error', prevent);
  try {
    const controller = pibbl(canvas, scene()); controllers.push(controller); await nextFrame();
    expect(errors.map(error => String(error))).toEqual([]); expect([evaluations, layerEvaluations]).toEqual([1, 1]);
    const mounted = snapshotWasmLayoutDiagnostics();
    expect(mounted.activeWasmInstances - baseline.activeWasmInstances).toBe(1);
    expect(mounted.activeArenas - baseline.activeArenas).toBe(Root === Grid || Root === Flow ? 3 : 2);
    expect(descriptions).toBe(1);
    width.set(85); await nextFrame();
    expect([evaluations, layerEvaluations]).toEqual([2, 1]); expect(descriptions).toBe(2);
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(mounted.activeArenas);
    width.set(90); grow.set(-1); await nextFrame();
    expect(errors.some(error => error instanceof Error && error.message.includes('flexGrow received -1'))).toBe(true);
    expect([evaluations, layerEvaluations]).toEqual([2, 1]);
    grow.set(1); pibbl(canvas, scene()); await nextFrame();
    expect([evaluations, layerEvaluations]).toEqual([3, 2]);
    expect([...canvas.getContext('2d')!.getImageData(210, 10, 1, 1).data]).toEqual([0, 0, 255, 255]);
    expect([...canvas.getContext('2d')!.getImageData(125, 10, 1, 1).data]).toEqual([0, 0, 0, 0]);
    clickCanvas(canvas, 125, 10); expect(hits).toBe(0);
    clickCanvas(canvas, 210, 10); expect(hits).toBe(1);
    shown.set(false); pibbl(canvas, scene()); await nextFrame();
    expect(snapshotWasmLayoutDiagnostics().activeArenas - baseline.activeArenas).toBe(1);
    shown.set(true); pibbl(canvas, scene()); await nextFrame();
    expect(layerEvaluations).toBe(3);
    expect(snapshotWasmLayoutDiagnostics().activeArenas - baseline.activeArenas).toBe(Root === Grid || Root === Flow ? 3 : 2);
    clickCanvas(canvas, 210, 10); expect(hits).toBe(2);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect(disposed.activeArenas).toBe(baseline.activeArenas); expect(disposed.activeNodes).toBe(baseline.activeNodes); expect(disposed.activeWasmInstances).toBe(baseline.activeWasmInstances);
  } finally { window.removeEventListener('error', prevent); }
});

}

}


}

it.runIf(experimentalLayout)('measures a wrapped Flow at settled width inside an intrinsic Flex column', async () => {
  const baseline = snapshotWasmLayoutDiagnostics(), width = signal(100), maximum = signal(100); let hits = 0;
  const flow = createElement(Flow, { style: { maxWidth: maximum, minHeight: 0, flexShrink: 0, direction: 'horizontal', wrap: true, gap: 5, lineGap: 5 }, children: [0,1,2].map(key => createElement(Rectangle, { key, style: { width: 70, height: 10, fill: 'blue' } })) });
  const card = createElement(Flex, { style: { width: 100, flexDirection: 'column', alignItems: 'stretch', minHeight: 0, flexShrink: 0 }, children: flow });
  expect(measureElement(card, { minWidth: 0, maxWidth: 100, minHeight: 0, maxHeight: 100 }, service)).toEqual({ status: 'measured', size: { width: 100, height: 40 } });
  const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 100; document.body.append(canvas);
  const scene = createElement(Flex, { style: { width, height: 100, flexDirection: 'column', alignItems: 'stretch' }, children: [
    createElement(Flex, { style: { minHeight: 0, flexShrink: 0, flexDirection: 'column', alignItems: 'stretch' }, children: flow }),
    createElement(Rectangle, { style: { width: '100%', height: 10, minHeight: 0, flexShrink: 0, fill: 'red' }, onClick: () => hits++ }),
  ] });
  const controller = pibbl(canvas, scene); controllers.push(controller); await nextFrame();
  expect([...canvas.getContext('2d')!.getImageData(5,45,1,1).data]).toEqual([255,0,0,255]); clickCanvas(canvas,5,45); expect(hits).toBe(1);
  const mounted = snapshotWasmLayoutDiagnostics();
  width.set(160); await nextFrame();
  expect([...canvas.getContext('2d')!.getImageData(5,45,1,1).data]).toEqual([255,0,0,255]);
  maximum.set(160); await nextFrame();
  expect([...canvas.getContext('2d')!.getImageData(5,30,1,1).data]).toEqual([255,0,0,255]);
  expect([...canvas.getContext('2d')!.getImageData(5,45,1,1).data]).toEqual([0,0,0,0]); clickCanvas(canvas,5,45); expect(hits).toBe(1); clickCanvas(canvas,5,30); expect(hits).toBe(2);
  const updated = snapshotWasmLayoutDiagnostics(); expect(updated.activeArenas).toBe(mounted.activeArenas); expect(updated.nodeCreates).toBe(mounted.nodeCreates);
  controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics(); expect([disposed.activeArenas,disposed.activeNodes,disposed.activeWasmInstances]).toEqual([baseline.activeArenas,baseline.activeNodes,baseline.activeWasmInstances]);
});

for (const property of ['width','minWidth','maxWidth'] as const) {
  it.runIf(experimentalLayout)(`measures percentage cross ${property} at an explicit numeric column owner width`, () => {
    const flow = createElement(Flow,{style:{direction:'horizontal',wrap:true,gap:5,lineGap:5,minHeight:0,flexShrink:0,...(property === 'minWidth' ? {width:40} : {}),[property]:'50%'},children:[0,1,2].map(key=>createElement(Rectangle,{key,style:{width:70,height:10}}))});
    const owner = (width:number) => createElement(Flex,{style:{width,flexDirection:'column',alignItems:'stretch'},children:flow});
    expect(measureElement(owner(200),{minWidth:0,maxWidth:400,minHeight:0,maxHeight:100},service)).toEqual({status:'measured',size:{width:200,height:40}});
    expect(measureElement(owner(320),{minWidth:0,maxWidth:400,minHeight:0,maxHeight:100},service)).toEqual({status:'measured',size:{width:320,height:25}});
  });
}

it.runIf(experimentalLayout)('bounds settled percentage cross measurement before child border-box conversion', () => {
  const flow = createElement(Flow,{style:{boxSizing:'border-box',maxWidth:'50%',padding:{left:10,right:10,top:2,bottom:3},borderWidth:1,direction:'horizontal',wrap:true,gap:5,lineGap:5,minHeight:0,flexShrink:0},children:[0,1,2].map(key=>createElement(Rectangle,{key,style:{width:70,height:10}}))});
  const owner = createElement(Flex,{style:{width:200,flexDirection:'column'},children:flow});
  expect(measureElement(owner,{minWidth:0,maxWidth:400,minHeight:0,maxHeight:100},service)).toEqual({status:'measured',size:{width:200,height:47}});
});
it.runIf(experimentalLayout)('uses owner border-box content width as the percentage measurement reference',()=>{
  const flow=createElement(Flow,{style:{maxWidth:'50%',direction:'horizontal',wrap:true,gap:5,lineGap:5,minHeight:0,flexShrink:0},children:[0,1,2].map(key=>createElement(Rectangle,{key,style:{width:45,height:10}}))});
  const owner=createElement(Flex,{style:{boxSizing:'border-box',width:200,padding:10,borderWidth:{left:2,right:4},flexDirection:'column'},children:flow});
  expect(measureElement(owner,{minWidth:0,maxWidth:400,minHeight:0,maxHeight:100},service)).toEqual({status:'measured',size:{width:174,height:40}});
});
it.runIf(experimentalLayout)('rejects conflicting settled percentage cross bounds',()=>{
  const child=createElement(Flow,{style:{minWidth:'75%',maxWidth:'50%',minHeight:0},children:[]});
  expect(()=>measureElement(createElement(Flex,{style:{width:200,flexDirection:'column'},children:child}),{minWidth:0,maxWidth:200,minHeight:0,maxHeight:100},service)).toThrow(/minimum/);
});
it.runIf(experimentalLayout)('measures known wrapped Text at its settled percentage cross width',()=>{
  const child=createElement(Text,{children:'aaaa aaaa aaaa',style:{width:'50%',wrap:true,lineHeight:10,minHeight:0,flexShrink:0}});
  for(const [width,height] of [[200,20],[320,10]]) {
    expect(measureElement(createElement(Flex,{style:{width,flexDirection:'column'},children:child}),{minWidth:0,maxWidth:400,minHeight:0,maxHeight:100},service)).toEqual({status:'measured',size:{width,height}});
  }
});
it.runIf(experimentalLayout)('keeps percentage cross measurement bounded to explicit numeric owners and known children', () => {
  const flow = (style:Record<string,unknown>={})=>createElement(Flow,{style:{maxWidth:'50%',minHeight:0,flexShrink:0,...style},children:[]});
  const constraints={minWidth:0,maxWidth:200,minHeight:0,maxHeight:100};
  for(const width of [undefined,'auto','50%'] as const) {
    const owner=createElement(Flex,{style:{width,flexDirection:'column'},children:flow()});
    expect(measureElement(owner,constraints,service).status).toBe('unsupported');
  }
  for(const style of [{height:'50%'},{minHeight:'50%'},{maxHeight:'50%'},{flexBasis:'50%'}]) {
    expect(measureElement(createElement(Flex,{style:{width:200,flexDirection:'column'},children:flow(style)}),constraints,service).status).toBe('unsupported');
  }
  let calls=0;function Opaque(_props:{style:Record<string,unknown>}){calls++;return null;}
  expect(measureElement(createElement(Flex,{style:{width:200,flexDirection:'column'},children:createElement(Opaque,{style:{maxWidth:'50%',minHeight:0}})}),constraints,service).status).toBe('unsupported');
  expect(calls).toBe(0);
});
for(const value of ['-10%','NaN%','Infinity%']) {
  it.runIf(experimentalLayout)(`rejects invalid settled percentage cross bound ${value}`,()=>{
    const child=createElement(Flow,{style:{maxWidth:value as '50%',minHeight:0},children:[]});
    expect(()=>measureElement(createElement(Flex,{style:{width:200,flexDirection:'column'},children:child}),{minWidth:0,maxWidth:200,minHeight:0,maxHeight:100},service)).toThrow(/maxWidth/);
  });
}

it.runIf(experimentalLayout)('measures fixed Grid rows inside an intrinsic Flex column and rejects indefinite fraction rows', async () => {
  const baseline = snapshotWasmLayoutDiagnostics(), rows = signal<readonly [number,number]>([20,30]); let hits = 0;
  const grid = createElement(Grid, { style: { gridTemplateColumns: ['1fr'], gridTemplateRows: rows, gap: 5, minHeight: 0, flexShrink: 0 }, children: createElement(Rectangle, { style: { width: '100%', height: '100%', gridColumnStart: 1, gridRowStart: 2, fill: 'blue' } }) });
  const card = createElement(Flex, { style: { width: 100, flexDirection: 'column', alignItems: 'stretch', minHeight: 0, flexShrink: 0 }, children: grid });
  expect(measureElement(card, { minWidth: 0, maxWidth: 100, minHeight: 0, maxHeight: 100 }, service)).toEqual({ status: 'measured', size: { width: 100, height: 55 } });
  const indefinite = createElement(Flex, { style: { width: 100, flexDirection: 'column' }, children: createElement(Grid, { style: { gridTemplateColumns: ['1fr'], gridTemplateRows: ['1fr'], minHeight: 0, flexShrink: 0 }, children: [] }) });
  expect(measureElement(indefinite, { minWidth: 0, maxWidth: 100, minHeight: 0, maxHeight: 100 }, service)).toMatchObject({ status: 'unsupported' });
  const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 100; document.body.append(canvas);
  const scene = createElement(Flex, { style: { width: 100, height: 100, flexDirection: 'column', alignItems: 'stretch' }, children: [
    createElement(Flex, { style: { minHeight: 0, flexShrink: 0, flexDirection: 'column', alignItems: 'stretch' }, children: grid }),
    createElement(Rectangle, { style: { width: '100%', height: 10, minHeight: 0, flexShrink: 0, fill: 'red' }, onClick: () => hits++ }),
  ] });
  const controller = pibbl(canvas, scene); controllers.push(controller); await nextFrame();
  expect([...canvas.getContext('2d')!.getImageData(5,60,1,1).data]).toEqual([255,0,0,255]); clickCanvas(canvas,5,60); expect(hits).toBe(1);
  const mounted = snapshotWasmLayoutDiagnostics(); rows.set([40,30]); await nextFrame();
  expect([...canvas.getContext('2d')!.getImageData(5,80,1,1).data]).toEqual([255,0,0,255]);
  expect([...canvas.getContext('2d')!.getImageData(5,60,1,1).data]).toEqual([0,0,255,255]); clickCanvas(canvas,5,60); expect(hits).toBe(1); clickCanvas(canvas,5,80); expect(hits).toBe(2);
  const updated = snapshotWasmLayoutDiagnostics(); expect(updated.activeArenas).toBe(mounted.activeArenas); expect(updated.nodeCreates).toBe(mounted.nodeCreates); expect(updated.gridTrackResolutions-mounted.gridTrackResolutions).toBe(1); expect(updated.gridCellPlacements-mounted.gridCellPlacements).toBe(1);
  controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics(); expect([disposed.activeArenas,disposed.activeNodes,disposed.activeWasmInstances]).toEqual([baseline.activeArenas,baseline.activeNodes,baseline.activeWasmInstances]);
});

it('records pinned native Yoga column grow, cap and shrink fixtures', () => {
  expect(yogaReference.cases.map(fixture => fixture.name)).toEqual(expect.arrayContaining(['column-grow','column-cap','column-shrink']));
});

it('records pinned native Yoga reverse-axis cap fixtures', () => {
  expect(yogaReference.cases.map(fixture => fixture.name)).toEqual(expect.arrayContaining(['row-reverse-cap','column-reverse-cap']));
});

it('records pinned native Yoga row wrap and cross-reversal fixtures', () => {
  expect(yogaReference.cases.map(fixture => fixture.name)).toEqual(expect.arrayContaining(['row-wrap','row-wrap-reverse']));
});

for (const axis of ['row','column'] as const) {
it(`uses coherent ${axis} border-box basis, bounds, content and cached geometry`, async () => {
  const baseline = snapshotWasmLayoutDiagnostics(), mode = signal<'content-box'|'border-box'>('border-box'), basis = signal(80), fill = signal('red'); let hits = 0, mounts = 0;
  const boxes: { width: number; height: number }[] = [];
  function Content(_props: { style: Record<string, unknown> }) { useConst(() => { mounts++; }); const box = useLayoutBox(); boxes.push({ width: box.width, height: box.height }); return createElement(Rectangle, { style: { width: box.width, height: box.height, fill } }); }
  const itemStyle = axis === 'row' ? { minWidth: 100, maxWidth: 110, height: 30, minHeight: 0 } : { minHeight: 100, maxHeight: 110, width: 30, minWidth: 0 };
  const scene = createElement(Flex, { style: { width: 200, height: 200, flexDirection: axis, alignItems: 'flex-start' }, children: [
    createElement(Flex, { key: 'box', style: { ...itemStyle, boxSizing: mode, flexBasis: basis, flexShrink: 0, padding: 10 }, children: createElement(Content, { style: { width: '100%', height: '100%', minWidth: 0, flexShrink: 0 } }) }),
    createElement(Rectangle, { style: { width: 20, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0, fill: 'blue' }, onClick: () => hits++ }),
  ] });
  const canvas = document.createElement('canvas'); canvas.width = 220; canvas.height = 220; document.body.append(canvas);
  const controller = pibbl(canvas, scene); controllers.push(controller); await nextFrame();
  expect(boxes.at(-1)).toEqual(axis === 'row' ? { width: 80, height: 10 } : { width: 10, height: 80 });
  const point = (main: number) => axis === 'row' ? { x: main, y: 5 } : { x: 5, y: main };
  let target = point(102); expect([...canvas.getContext('2d')!.getImageData(target.x,target.y,1,1).data]).toEqual([0,0,255,255]); clickCanvas(canvas,target.x,target.y); expect(hits).toBe(1);
  basis.set(105); await nextFrame(); expect(boxes.at(-1)).toEqual(axis === 'row' ? { width: 85, height: 10 } : { width: 10, height: 85 });
  clickCanvas(canvas,target.x,target.y); expect(hits).toBe(1); target = point(107); clickCanvas(canvas,target.x,target.y); expect(hits).toBe(2);
  const beforePaint = snapshotWasmLayoutDiagnostics(); fill.set('green'); await nextFrame(); if (experimentalLayout) expect(snapshotWasmLayoutDiagnostics().solves).toBe(beforePaint.solves);
  mode.set('content-box'); await nextFrame(); expect(boxes.at(-1)).toEqual(axis === 'row' ? { width: 105, height: 30 } : { width: 30, height: 105 }); target = point(127); clickCanvas(canvas,target.x,target.y); expect(hits).toBe(3); expect(mounts).toBe(1);
  controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics(); expect([disposed.activeArenas,disposed.activeNodes,disposed.activeWasmInstances]).toEqual([baseline.activeArenas,baseline.activeNodes,baseline.activeWasmInstances]);
});
}

it('preserves the public border-box padding floor beyond a too-small parent allocation', async () => {
  const sizes: { width: number; height: number }[] = []; let hits = 0;
  function Empty(_props: { style: Record<string, unknown> }) { const box = useLayoutBox(); sizes.push({ width: box.width, height: box.height }); return null; }
  const canvas = document.createElement('canvas'); canvas.width = 50; canvas.height = 30; document.body.append(canvas);
  const controller = pibbl(canvas, createElement(Flex, { style: { width: 10, height: 10, alignItems: 'flex-start' }, children: [
    createElement(Flex, { style: { boxSizing: 'border-box', width: 8, height: 8, maxWidth: 8, maxHeight: 8, minWidth: 0, flexShrink: 0, padding: 10 }, children: createElement(Empty, { style: { width: '100%', height: '100%', minWidth: 0, flexShrink: 0 } }) }),
    createElement(Rectangle, { style: { width: 5, height: 5, minWidth: 0, flexShrink: 0, fill: 'blue' }, onClick: () => hits++ }),
  ] })); controllers.push(controller); await nextFrame(); expect(sizes.at(-1)).toEqual({ width: 0, height: 0 }); expect([...canvas.getContext('2d')!.getImageData(22,2,1,1).data]).toEqual([0,0,255,255]); clickCanvas(canvas,22,2); expect(hits).toBe(1); controller.dispose();
});

it('stretches a border-box Grid child without subtracting padding twice', async () => {
  const sizes: { width: number; height: number }[] = []; let hits = 0;
  function Content(_props: { style: Record<string, unknown> }) { const box = useLayoutBox(); sizes.push({ width: box.width, height: box.height }); return createElement(Rectangle, { style: { width: box.width, height: box.height, fill: 'red' }, onClick: () => hits++ }); }
  const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 80; document.body.append(canvas);
  const controller = pibbl(canvas, createElement(Grid, { style: { width: 100, height: 60, gridTemplateColumns: ['1fr'], gridTemplateRows: ['1fr'] }, children: createElement(Flex, { style: { boxSizing: 'border-box', padding: 10, gridColumnStart: 1, gridRowStart: 1 }, children: createElement(Content, { style: { width: '100%', height: '100%', minWidth: 0, flexShrink: 0 } }) }) })); controllers.push(controller); await nextFrame(); expect(sizes.at(-1)).toEqual({ width: 80, height: 40 }); expect([...canvas.getContext('2d')!.getImageData(85,45,1,1).data]).toEqual([255,0,0,255]); clickCanvas(canvas,85,45); expect(hits).toBe(1); controller.dispose();
});
it('uses measured border-box Flow content once before placing its following target', async () => {
  let hits = 0; const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 60; document.body.append(canvas);
  const controller = pibbl(canvas, createElement(Flow, { style: { width: 100, height: 60 }, children: [
    createElement(Flex, { style: { boxSizing: 'border-box', padding: 10 }, children: createElement(Rectangle, { style: { width: 40, height: 10, minWidth: 0, flexShrink: 0, fill: 'red' } }) }),
    createElement(Rectangle, { style: { width: 10, height: 10, fill: 'blue' }, onClick: () => hits++ }),
  ] })); controllers.push(controller); await nextFrame(); expect([...canvas.getContext('2d')!.getImageData(65,5,1,1).data]).toEqual([0,0,255,255]); clickCanvas(canvas,45,5); expect(hits).toBe(0); clickCanvas(canvas,65,5); expect(hits).toBe(1); controller.dispose();
});

it('records pinned native Yoga border-box floor/bounds and percentage fixtures', () => {
  expect(yogaReference.cases.map(fixture => fixture.name)).toEqual(expect.arrayContaining(['border-box-floor-bounds','border-box-percentage']));
});

it('matches pinned border-box percentage content sizes and separated click targets', async () => {
  const reference = yogaReference.cases.find(fixture => fixture.name === 'border-box-percentage')!;
  const content: { width: number; height: number }[] = []; const hits: number[] = [];
  function Content({ index }: { index: number; style: Record<string, unknown> }) { const box = useLayoutBox(); content[index] = { width: box.width, height: box.height }; return createElement(Rectangle, { style: { width: box.width, height: box.height, fill: index === 0 ? 'red' : 'blue' }, onClick: () => hits.push(index) }); }
  const canvas = document.createElement('canvas'); canvas.width = 220; canvas.height = 120; document.body.append(canvas);
  const controller = pibbl(canvas, createElement(Flex, { style: { width: reference.width, height: reference.height, gap: reference.gap, alignItems: 'flex-start' }, children: [0,1].map(index => createElement(Flex, { style: { boxSizing: 'border-box', flexBasis: '70%', minWidth: index === 0 ? 110 : 0, maxWidth: index === 0 ? '60%' : undefined, height: '60%', padding: 10, flexShrink: 1 }, children: createElement(Content, { index, style: { width: '100%', height: '100%', minWidth: 0, flexShrink: 0 } }) })) })); controllers.push(controller); await nextFrame();
  expect(content).toEqual(reference.boxes.map(box => ({ width: box.width-20, height: box.height-20 })));
  expect([...canvas.getContext('2d')!.getImageData(105,15,1,1).data]).toEqual([0,0,0,0]); clickCanvas(canvas,15,15); clickCanvas(canvas,105,15); clickCanvas(canvas,125,15); expect(hits).toEqual([0,1]); controller.dispose();
});

for (const axis of ['row','column'] as const) {
it(`reserves asymmetric layout borders independently from paint in ${axis}`, async () => {
  const sizing = signal<'content-box'|'border-box'>('content-box');
  const sizes: { width: number; height: number }[] = []; let hits = 0;
  function Content(_props: { style: Record<string, unknown> }) {
    const box = useLayoutBox(); sizes.push({ width: box.width, height: box.height });
    return createElement(Rectangle, { style: { width: box.width, height: box.height, fill: 'red' } });
  }
  function Scene() {
    const borderBox = sizing.get() === 'border-box';
    return createElement(Flex, { style: { width: 180, height: 180, flexDirection: axis, alignItems: 'flex-start' }, children: [
      createElement(Flex, { style: { boxSizing: sizing, width: borderBox ? 54 : 40, height: borderBox ? 62 : 30,
        minWidth: 0, minHeight: 0, flexShrink: 0, padding: { left: 3, right: 5, top: 7, bottom: 11 },
        borderWidth: { left: 2, right: 4, top: 6, bottom: 8 } }, children:
        createElement(Content, { style: { width: '100%', height: '100%', minWidth: 0, flexShrink: 0 } }) }),
      createElement(Rectangle, { style: { width: 20, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0, fill: 'blue', strokeWidth: 4 }, onClick: () => hits++ }),
    ] });
  }
  const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 200; document.body.append(canvas);
  const controller = pibbl(canvas, createElement(Scene, {})); controllers.push(controller); await nextFrame();
  const verify = () => {
    expect(sizes.at(-1)).toEqual({ width: 40, height: 30 });
    expect([...canvas.getContext('2d')!.getImageData(6,14,1,1).data]).toEqual([255,0,0,255]);
    expect([...canvas.getContext('2d')!.getImageData(1,1,1,1).data]).toEqual([0,0,0,0]);
    const x = axis === 'row' ? 58 : 4, y = axis === 'row' ? 4 : 66;
    clickCanvas(canvas,x,y);
  };
  verify(); expect(hits).toBe(1); sizing.set('border-box'); await nextFrame(); verify(); expect(hits).toBe(2);
  controller.dispose();
});
}

it('keeps Layer raster sizing independent from layout border and padding insets', async () => {
  const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 80; document.body.append(canvas);
  const controller = pibbl(canvas, createElement(Layer, { style: { width: 80, height: 40, boxSizing: 'border-box', padding: 10, paddingStart:12, paddingEnd:'15%', borderWidth: 5 }, children:
    createElement(Rectangle, { style: { width: 120, height: 80, fill: 'red' } }) })); controllers.push(controller); await nextFrame();
  expect([...canvas.getContext('2d')!.getImageData(1,1,1,1).data]).toEqual([255,0,0,255]);
  expect([...canvas.getContext('2d')!.getImageData(79,39,1,1).data]).toEqual([255,0,0,255]);
  expect([...canvas.getContext('2d')!.getImageData(81,39,1,1).data]).toEqual([0,0,0,0]);
  expect([...canvas.getContext('2d')!.getImageData(79,41,1,1).data]).toEqual([0,0,0,0]);
  controller.dispose();
});

it('records pinned asymmetric layout-border geometry on both Flex axes', () => {
  expect(yogaReference.cases.map(fixture => fixture.name)).toEqual(expect.arrayContaining(['border-box-asymmetric-row','border-box-asymmetric-column']));
});

for (const axis of ['row','column'] as const) {
it(`derives ${axis} aspect geometry from final outer main allocation`, async () => {
  const main = signal(100); let hits = 0, mounts = 0;
  const sizes: { width: number; height: number }[] = [];
  function Content(_props: { style: Record<string, unknown> }) {
    useConst(() => { mounts++; }); const box = useLayoutBox(); sizes.push({ width: box.width, height: box.height });
    return createElement(Rectangle, { style: { width: box.width, height: box.height, fill: 'red' }, onClick: () => hits++ });
  }
  const children = [0,1].map(index => createElement(Flex, { key: index, style: {
    width: axis === 'row' ? 90 : 50, height: axis === 'row' ? 50 : 90,
    minWidth: 0, minHeight: 0, flexShrink: 1, aspectRatio: 3,
  }, children: createElement(Content, { style: { width: '100%', height: '100%', minWidth: 0, flexShrink: 0 } }) }));
  const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 220; document.body.append(canvas);
  const controller = pibbl(canvas, createElement(Flex, { style: { width: axis === 'row' ? main : 320, height: axis === 'row' ? 220 : main, flexDirection: axis }, children })); controllers.push(controller); await nextFrame();
  expect(sizes.at(-1)?.width).toBeCloseTo(axis === 'row' ? 50 : 150); expect(sizes.at(-1)?.height).toBeCloseTo(axis === 'row' ? 50/3 : 50);
  const x = axis === 'row' ? 55 : 140, y = axis === 'row' ? 12 : 55;
  clickCanvas(canvas,x,y); expect(hits).toBe(1);
  main.set(60); await nextFrame(); expect(sizes.at(-1)?.width).toBeCloseTo(axis === 'row' ? 30 : 90); expect(sizes.at(-1)?.height).toBeCloseTo(axis === 'row' ? 10 : 30);
  clickCanvas(canvas,x,y); expect(hits).toBe(1); clickCanvas(canvas, axis === 'row' ? 35 : 80, axis === 'row' ? 5 : 35); expect(hits).toBe(2); expect(mounts).toBe(2);
  controller.dispose();
});
}

it('applies outer aspect ratios after insets and clamps cross bounds independently', () => {
  const container = { x: 0, y: 0, width: 300, height: 200 };
  const edges = { padding: { left: 3, right: 5, top: 7, bottom: 11 }, borderWidth: { left: 2, right: 4, top: 6, bottom: 8 } };
  for (const boxed of [false,true]) {
    const child = createElement(Rectangle, { style: { ...edges, boxSizing: boxed ? 'border-box' : 'content-box', width: boxed ? 104 : 90, height: 50, aspectRatio: 3, minWidth: 0, minHeight: 0, flexShrink: 0 } });
    const box = layoutFlex(container, [child], {}, measurement)[0];
    expect(box.width).toBe(104); expect(box.height).toBeCloseTo(104/3);
  }
  for (const [bound,height] of [{ maxHeight: 20 },{ minHeight: 40 }].map(style => [style,style.maxHeight ?? style.minHeight] as const)) {
    const child = createElement(Rectangle, { style: { width: 90, height: 50, minWidth: 0, flexShrink: 0, aspectRatio: 3, ...bound } });
    expect(layoutFlex(container,[child],{},measurement)[0]).toMatchObject({ width: 90, height });
  }
  const basis = createElement(Rectangle, { style: { width: 'auto', height: 50, flexBasis: 90, minWidth: 0, flexShrink: 0, aspectRatio: 3 } });
  expect(layoutFlex(container,[basis],{},measurement)[0]).toMatchObject({ width: 90, height: 30 });
  for (const ratio of [0,-1,Infinity,NaN]) {
    const child = createElement(Rectangle,{ style: { width: 90,height: 50,minWidth: 0,flexShrink: 0,aspectRatio: ratio } });
    expect(() => layoutFlex(container,[child],{},measurement)).toThrow(/positive finite/);
  }
  expect(layoutFlex(container,[basis],{ flexWrap: 'wrap' },measurement)[0]).toMatchObject({width:90,height:30});
  const intrinsic = createElement(Rectangle,{ style: { width: 'auto',height: 50,minWidth: 0,flexShrink: 0,aspectRatio: 3 } });
  expect(() => layoutFlex(container,[intrinsic],{},measurement)).toThrow(/definite main dimension or flexBasis/);
  expect(() => layoutFlex(container,[intrinsic],{flexWrap: "wrap"},measurement)).toThrow(/definite main dimension or flexBasis/);
});

it.runIf(experimentalLayout)('uses physical gap overrides without trailing wrapped line gaps', () => {
  const row = [0,1,2].map(() => createElement(Rectangle, { style: { width: 40,height: 10,flexBasis: 40,flexShrink: 0,minWidth: 0 } }));
  const column = [0,1,2].map(() => createElement(Rectangle, { style: { width: 10,height: 40,flexBasis: 40,flexShrink: 0,minHeight: 0 } }));
  const options = { gap: 99,columnGap: 10,rowGap: 7,flexWrap: 'wrap',alignContent: 'stretch',alignItems: 'flex-start' } as const;
  expect(layoutFlex({ x: 0,y: 0,width: 100,height: 100 },row,options,measurement)).toEqual([
    { x: 0,y: 0,width: 40,height: 10 },{ x: 50,y: 0,width: 40,height: 10 },{ x: 0,y: 53.5,width: 40,height: 10 },
  ]);
  expect(layoutFlex({ x: 0,y: 0,width: 100,height: 100 },column,{...options,flexDirection:'column'},measurement)).toEqual([
    { x: 0,y: 0,width: 10,height: 40 },{ x: 0,y: 47,width: 10,height: 40 },{ x: 55,y: 0,width: 10,height: 40 },
  ]);
});

it('updates numeric gap signals and gap misses without replacing child identities', async () => {
  const gap = signal(10); let hits = 0, mounts = 0;
  function Card({ selected, style: _style }: { selected: boolean; style: Record<string, unknown> }) {
    useConst(() => { mounts++; }); const box = useLayoutBox();
    return createElement(Rectangle,{ style: { width: box.width,height: box.height,fill: selected ? 'blue' : 'red' },onClick: () => { if (selected) hits++; } });
  }
  const scene = createElement(Flex,{style:{width:200,height:40,columnGap:gap},children:[false,true].map(selected => createElement(Card,{key:String(selected),selected,style:{width:40,height:20,minWidth:0,flexShrink:0}}))});
  const canvas = document.createElement('canvas');canvas.width=220;canvas.height=60;document.body.append(canvas);
  const controller=pibbl(canvas,scene);controllers.push(controller);await nextFrame();
  clickCanvas(canvas,45,10);expect(hits).toBe(0);clickCanvas(canvas,55,10);expect(hits).toBe(1);
  const mounted=snapshotWasmLayoutDiagnostics();gap.set(30);await nextFrame();
  clickCanvas(canvas,55,10);expect(hits).toBe(1);clickCanvas(canvas,75,10);expect(hits).toBe(2);expect(mounts).toBe(2);
  expect([...canvas.getContext('2d')!.getImageData(55,10,1,1).data]).toEqual([0,0,0,0]);
  if(experimentalLayout)expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
  controller.dispose();
});

it('records release grow-shrink-basis differentials and the preserved partial-shrink divergence', () => {
  expect(yogaReference.cases.map(fixture => fixture.name)).toEqual(expect.arrayContaining([
    'zero-fractional-grow','fractional-shrink','grow-freeze-release','shrink-freeze-release','large-finite-differential','subunit-zero-grow','subunit-shrink-policy','initial-freeze-grow-policy','initial-freeze-shrink-policy',
  ]));
});

it('preserves the documented CSS partial-shrink divergence from pinned Yoga', () => {
  const fixture = yogaReference.cases.find(fixture => fixture.name === 'subunit-shrink-policy')!;
  expect(fixture.boxes.map(box => box.width)).toEqual([50,50]);
  if (!fixture.pibblBoxes || !fixture.itemStyles) throw new Error('Missing classified input and Pibbl expectation');
  expect(fixture.pibblBoxes.map(box => box.width)).toEqual([65,65]);
  const children = fixture.itemStyles.map(style => createElement(Rectangle,{style:style as RectStyle}));
  expect(layoutFlex({x:0,y:0,width:fixture.width,height:fixture.height},children,{gap:fixture.gap},measurement)).toEqual(fixture.pibblBoxes);
});

it('keeps unequal huge f64 factors finite without claiming Yoga input parity', () => {
  const children = [1e308,1].map(flexGrow => createElement(Rectangle,{style:{width:0,height:10,flexBasis:0,flexGrow,flexShrink:0,minWidth:0}}));
  const boxes = layoutFlex({x:0,y:0,width:100,height:20},children,{},measurement);
  expect(boxes[0].width).toBe(100);expect(Number.isFinite(boxes[1].width)).toBe(true);expect(boxes[1].width).toBeGreaterThan(0);
});

it('calculates partial free space after initially freezing constrained items', () => {
  const grow = [createElement(Rectangle,{style:{width:20,height:10,flexBasis:20,flexGrow:.25,flexShrink:0,minWidth:0,maxWidth:10}}),createElement(Rectangle,{style:{width:20,height:10,flexBasis:20,flexGrow:.25,flexShrink:0,minWidth:0}})];
  expect(layoutFlex({x:0,y:0,width:112,height:20},grow,{gap:12},measurement)).toEqual([
    {x:0,y:0,width:10,height:10},{x:22,y:0,width:37.5,height:10},
  ]);
  const shrink = [createElement(Rectangle,{style:{width:80,height:10,flexBasis:80,flexShrink:.25,minWidth:90}}),createElement(Rectangle,{style:{width:80,height:10,flexBasis:80,flexShrink:.25,minWidth:0}})];
  expect(layoutFlex({x:0,y:0,width:112,height:20},shrink,{gap:12},measurement)).toEqual([
    {x:0,y:0,width:90,height:10},{x:102,y:0,width:62.5,height:10},
  ]);
});

for (const axis of ['row-reverse','column-reverse'] as const) {
it.runIf(experimentalLayout)(`keeps logical start and end physical under ${axis}`, async () => {
  const alignment = signal<'start'|'end'>('start'); let hits=0,mounts=0;
  function Card({name,style:_style}:{name:string;style:Record<string,unknown>}) {useConst(()=>{mounts++;});const box=useLayoutBox();return createElement(Rectangle,{style:{width:box.width,height:box.height,fill:name==='A'?'red':'blue'},onClick:()=>{if(name==='A')hits++;}});}
  const column=axis==='column-reverse';
  const scene=createElement(Flex,{style:{width:100,height:100,flexDirection:axis,justifyContent:alignment,alignItems:'flex-start'},children:['A','B'].map(name=>createElement(Card,{key:name,name,style:{width:column?10:20,height:column?20:10,minWidth:0,minHeight:0,flexShrink:0}}))});
  const canvas=document.createElement('canvas');canvas.width=120;canvas.height=120;document.body.append(canvas);const controller=pibbl(canvas,scene);controllers.push(controller);await nextFrame();
  const point=(main:number)=>column?{x:5,y:main}:{x:main,y:5};let target=point(25);clickCanvas(canvas,target.x,target.y);expect(hits).toBe(1);
  const before=snapshotWasmLayoutDiagnostics();alignment.set('end');await nextFrame();clickCanvas(canvas,target.x,target.y);expect(hits).toBe(1);target=point(85);clickCanvas(canvas,target.x,target.y);expect(hits).toBe(2);expect(mounts).toBe(2);
  const after=snapshotWasmLayoutDiagnostics();expect(after.solves).toBe(before.solves);expect(after.nodeCreates).toBe(before.nodeCreates);expect(after.mainPlacements).toBeGreaterThan(before.mainPlacements);controller.dispose();
});
}

it.runIf(experimentalLayout)('keeps logical cross edges physical under wrap-reverse including alignSelf', () => {
  const children=[0,1,2].map(index=>createElement(Rectangle,{style:{width:40,height:10,minWidth:0,flexShrink:0,alignSelf:index===0?'end':undefined}}));
  const options={flexWrap:'wrap-reverse',rowGap:10,alignContent:'stretch',alignItems:'start'} as const;
  expect(layoutFlex({x:0,y:0,width:100,height:100},children,options,measurement)).toEqual([
    {x:0,y:90,width:40,height:10},{x:40,y:55,width:40,height:10},{x:0,y:0,width:40,height:10},
  ]);
  expect(layoutFlex({x:0,y:0,width:100,height:100},children,{...options,alignContent:'start'},measurement)).toEqual([
    {x:0,y:20,width:40,height:10},{x:40,y:20,width:40,height:10},{x:0,y:0,width:40,height:10},
  ]);
  expect(layoutFlex({x:0,y:0,width:100,height:100},children,{...options,alignContent:'end'},measurement)).toEqual([
    {x:0,y:90,width:40,height:10},{x:40,y:90,width:40,height:10},{x:0,y:70,width:40,height:10},
  ]);
});

for (const axis of ['row', 'column'] as const) {
  it(`accepts physical start/end on forward ${axis} axes`, () => {
    const child = createElement(Rectangle, { style: { width: 20, height: 10, minWidth: 0, minHeight: 0, flexShrink: 0 } });
    expect(layoutFlex({ x: 0, y: 0, width: 100, height: 100 }, [child], {
      flexDirection: axis, justifyContent: 'end', alignItems: 'start',
    }, measurement)).toEqual([axis === 'row'
      ? { x: 80, y: 0, width: 20, height: 10 }
      : { x: 0, y: 90, width: 20, height: 10 }]);
  });
}

it('records pinned distribution boundaries for both axes', () => {
  const names = yogaReference.cases.map(fixture => fixture.name);
  for (const axis of ['row', 'column']) {
    for (const policy of ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly']) {
      expect(names).toContain(`distribution-negative-${axis}-${policy}`);
    }
    for (const policy of ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly', 'stretch']) {
      expect(names).toContain(`distribution-single-${axis}-${policy}`);
      expect(names).toContain(`distribution-cross-negative-${axis}-${policy}`);
    }
    for (const policy of ['space-around', 'space-evenly']) {
      expect(names).toContain(`distribution-negative-${axis}-reverse-${policy}`);
      expect(names).toContain(`distribution-cross-negative-${axis}-reverse-${policy}`);
    }
    expect(names).toContain(`distribution-auto-${axis}`);
  }
});

for (const axis of ['row', 'column'] as const) for (const policy of ['space-around', 'space-evenly'] as const) {
  it.runIf(experimentalLayout)(`uses physical overflow start for reversed ${axis} ${policy}`, () => {
    const column = axis === 'column';
    const children = [0, 1].map(() => createElement(Rectangle, { style: { width: column ? 20 : 80, height: column ? 80 : 20, minWidth: 0, minHeight: 0, flexShrink: 0 } }));
    expect(layoutFlex({x:0,y:0,width:100,height:100}, children, { flexDirection: column ? 'column-reverse' : 'row-reverse', justifyContent: policy, alignItems: 'flex-start', gap:12 }, measurement)).toEqual(column
      ? [{x:0,y:92,width:20,height:80},{x:0,y:0,width:20,height:80}]
      : [{x:92,y:0,width:80,height:20},{x:0,y:0,width:80,height:20}]);
    expect(layoutFlex({x:0,y:0,width:column?30:100,height:column?100:30}, children, { flexDirection: axis, flexWrap:'wrap-reverse', alignContent:policy, alignItems:'flex-start', gap:12 }, measurement)).toEqual(column
      ? [{x:32,y:0,width:20,height:80},{x:0,y:0,width:20,height:80}]
      : [{x:0,y:32,width:80,height:20},{x:0,y:0,width:80,height:20}]);
  });
}

it('records pinned definite-owner percentage bounds', () => {
  for (const axis of ['row', 'column']) for (const operation of ['cap', 'floor']) {
    expect(yogaReference.cases.map(fixture => fixture.name)).toContain(`percent-${operation}-${axis}`);
    expect(yogaReference.cases.map(fixture => fixture.name)).toContain(`percent-${operation}-${axis}-resized`);
  }
});
for (const axis of ['row', 'column'] as const) {
  it.runIf(experimentalLayout)(`recomputes percentage caps from a resized ${axis} owner without remounting`, async () => {
    const column = axis === 'column';
    const main = signal(200);
    let mounts = 0, hits = 0;
    const boxes = new Map<number, {width:number;height:number}>();
    function Card({index,style:_style}: {index:number;style:Record<string,unknown>}) {
      useConst(() => ++mounts);
      const box = useLayoutBox(); boxes.set(index, {width:box.width,height:box.height});
      return createElement(Rectangle, {onClick:()=>{if(index===1)hits++;},style:{width:box.width,height:box.height,fill:index===0?'red':'blue'}});
    }
    const baseline = snapshotWasmLayoutDiagnostics();
    const canvas = document.createElement('canvas');canvas.width=column?60:240;canvas.height=column?240:60;document.body.append(canvas);
    const children = [0,1].map(index => createElement(Card,{key:index,index,style:{width:column?10:40,height:column?40:10,flexBasis:40,flexGrow:1,flexShrink:0,minWidth:0,minHeight:0,...(index===0?(column?{maxHeight:'25%' as const}:{maxWidth:'25%' as const}):{})}}));
    const controller = pibbl(canvas,createElement(Flex,{style:{flexDirection:axis,width:column?40:main,height:column?main:40,gap:12,alignItems:'flex-start'},children}));controllers.push(controller);await nextFrame();
    const initial = snapshotWasmLayoutDiagnostics();
    expect(boxes.get(0)).toEqual(column?{width:10,height:50}:{width:50,height:10});
    expect(boxes.get(1)).toEqual(column?{width:10,height:138}:{width:138,height:10});
    clickCanvas(canvas,column?5:65,column?65:5);expect(hits).toBe(1);
    main.set(240);await nextFrame();
    expect(boxes.get(0)).toEqual(column?{width:10,height:60}:{width:60,height:10});
    expect(boxes.get(1)).toEqual(column?{width:10,height:168}:{width:168,height:10});
    clickCanvas(canvas,column?5:65,column?65:5);expect(hits).toBe(1);
    clickCanvas(canvas,column?5:75,column?75:5);expect(hits).toBe(2);
    const resized = snapshotWasmLayoutDiagnostics();expect(resized.solves).toBeGreaterThan(initial.solves);expect(resized.nodeCreates).toBe(initial.nodeCreates);expect(mounts).toBe(2);
    controller.dispose();expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
  });
}

for (const axis of ['row', 'column'] as const) {
  const minimum = axis === 'row' ? 'minWidth' : 'minHeight';
  const maximum = axis === 'row' ? 'maxWidth' : 'maxHeight';
  for (const value of ['-10%', 'Infinity%', 'NaN%']) {
    it(`rejects invalid ${axis} percentage bound ${value}`, () => {
      const child = createElement(Rectangle, {style:{width:80,height:80,flexBasis:80,flexShrink:0,minWidth:0,minHeight:0,[minimum]:value} as RectStyle});
      expect(() => layoutFlex({x:0,y:0,width:100,height:100},[child],{flexDirection:axis},measurement)).toThrow(new RegExp(minimum));
    });
  }
  it(`rejects conflicting resolved ${axis} percentage bounds`, () => {
    const child = createElement(Rectangle, {style:{width:80,height:80,flexBasis:80,flexShrink:0,minWidth:0,minHeight:0,[minimum]:'75%',[maximum]:'25%'} as RectStyle});
    expect(() => layoutFlex({x:0,y:0,width:100,height:100},[child],{flexDirection:axis},measurement)).toThrow(/minimum/);
  });
  it(`keeps percentage-dependent intrinsic ${axis} owners explicitly unsupported`, () => {
    const child = createElement(Rectangle, {style:{width:40,height:40,flexBasis:40,flexGrow:0,flexShrink:0,minWidth:0,minHeight:0,[maximum]:'25%'} as RectStyle});
    const owner = createElement(Flex,{style:axis==='row'?{height:100,maxWidth:200}:{width:100,maxHeight:200},children:child});
    const before = snapshotWasmLayoutDiagnostics();
    expect(measureElement(owner,{minWidth:0,maxWidth:200,minHeight:0,maxHeight:200},service)).toMatchObject({status:'unsupported',reason:expect.stringContaining('percentage child sizes or bounds')});
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(before.nodeCreates);
    expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(before.activeArenas);
  });
}

for (const axis of ['row','column'] as const) for (const wrap of ['wrap','wrap-reverse'] as const) {
  it.runIf(experimentalLayout || wrap === 'wrap')(`derives final per-line ratio sizes in ${axis} ${wrap}`, () => {
    const column=axis==='column', reverse=wrap==='wrap-reverse';
    const children=[0,1,2].map(()=>createElement(Rectangle,{style:{width:column?'auto':80,height:column?80:'auto',flexBasis:80,flexGrow:1,flexShrink:0,minWidth:0,minHeight:0,aspectRatio:column?.5:2}}));
    expect(layoutFlex({x:0,y:0,width:200,height:200},children,{flexDirection:axis,flexWrap:wrap,alignContent:'flex-start',alignItems:'flex-start',rowGap:column?12:10,columnGap:column?10:12},measurement)).toEqual(column
      ? [{x:reverse?153:0,y:0,width:47,height:94},{x:reverse?153:0,y:106,width:47,height:94},{x:reverse?43:57,y:0,width:100,height:200}]
      : [{x:0,y:reverse?153:0,width:94,height:47},{x:106,y:reverse?153:0,width:94,height:47},{x:0,y:reverse?43:57,width:200,height:100}]);
  });
}
it.runIf(experimentalLayout)('publishes coupled wrapped ratio size and moved targets after owner resize', async () => {
  const main=signal(200);let mounts=0,hits=0;const sizes=new Map<number,{width:number;height:number}>();
  function Card({index,style:_style}:{index:number;style:Record<string,unknown>}){useConst(()=>++mounts);const box=useLayoutBox();sizes.set(index,{width:box.width,height:box.height});return createElement(Rectangle,{style:{width:box.width,height:box.height,fill:index===2?'blue':'red'},onClick:()=>{if(index===2)hits++;}});}
  const canvas=document.createElement('canvas');canvas.width=220;canvas.height=220;document.body.append(canvas);
  const baseline=snapshotWasmLayoutDiagnostics();
  const controller=pibbl(canvas,createElement(Flex,{style:{width:main,height:200,flexWrap:'wrap',alignContent:'flex-start',alignItems:'flex-start',columnGap:12,rowGap:10},children:[0,1,2].map(index=>createElement(Card,{key:index,index,style:{width:80,height:'auto',flexBasis:80,flexGrow:1,flexShrink:0,minWidth:0,minHeight:0,aspectRatio:2}}))}));controllers.push(controller);await nextFrame();
  expect(sizes.get(0)).toEqual({width:94,height:47});expect(sizes.get(2)).toEqual({width:200,height:100});clickCanvas(canvas,5,145);expect(hits).toBe(1);const before=snapshotWasmLayoutDiagnostics();
  main.set(172);await nextFrame();expect(sizes.get(0)).toEqual({width:80,height:40});expect(sizes.get(2)).toEqual({width:172,height:86});clickCanvas(canvas,5,145);expect(hits).toBe(1);clickCanvas(canvas,5,54);expect(hits).toBe(2);expect([...canvas.getContext('2d')!.getImageData(5,145,1,1).data]).toEqual([0,0,0,0]);expect([...canvas.getContext('2d')!.getImageData(5,54,1,1).data]).toEqual([0,0,255,255]);const after=snapshotWasmLayoutDiagnostics();expect(after.solves).toBeGreaterThan(before.solves);expect(after.nodeCreates).toBe(before.nodeCreates);expect(mounts).toBe(3);controller.dispose();expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
});

it('records pinned wrapped ratio owner pairs for both axes and line directions', () => {
  const names=yogaReference.cases.map(fixture=>fixture.name);
  for(const axis of ['row','column'])for(const reverse of ['', '-reverse'])for(const resized of ['', '-resized'])expect(names).toContain(`aspect-wrap-${axis}${reverse}${resized}`);
});

for(const axis of ['row','column'] as const)for(const wrap of [false,true]) {
  it.runIf(experimentalLayout)(`resolves finite ${axis} percentage gaps wrap=${wrap} against physical content axes`,()=>{
    const column=axis==='column';
    const children=Array.from({length:wrap?3:2},()=>createElement(Rectangle,{style:{width:column?30:100,height:column?50:30,flexBasis:column?50:100,flexGrow:wrap?0:1,flexShrink:0,minWidth:0,minHeight:0}}));
    const boxes=layoutFlex({x:0,y:0,width:260,height:140},children,{flexDirection:axis,flexWrap:wrap?'wrap':'nowrap',columnGap:'10%',rowGap:'20%',alignItems:'flex-start',alignContent:'flex-start'},measurement);
    expect(boxes).toEqual(column ? wrap ? [{x:0,y:0,width:30,height:50},{x:0,y:78,width:30,height:50},{x:56,y:0,width:30,height:50}] : [{x:0,y:0,width:30,height:56},{x:0,y:84,width:30,height:56}] : wrap ? [{x:0,y:0,width:100,height:30},{x:126,y:0,width:100,height:30},{x:0,y:58,width:100,height:30}] : [{x:0,y:0,width:117,height:30},{x:143,y:0,width:117,height:30}]);
  });
}
it.runIf(experimentalLayout)('keeps percentage gap intrinsic cycles unsupported without allocating native resources',()=>{
  const before=snapshotWasmLayoutDiagnostics();
  const owner=createElement(Flex,{style:{width:200,flexDirection:'column',gap:'10%'},children:createElement(Rectangle,{style:{width:20,height:20,minHeight:0}})});
  expect(measureElement(owner,{minWidth:0,maxWidth:200,minHeight:0,maxHeight:100},service)).toMatchObject({status:'unsupported',reason:expect.stringContaining('percentage gap')});
  const after=snapshotWasmLayoutDiagnostics();expect(after.nodeCreates).toBe(before.nodeCreates);expect(after.activeArenas).toBe(before.activeArenas);
});

it.runIf(experimentalLayout)('moves percentage-gap targets using padded owner content dimensions without remount',async()=>{
  const baseline=snapshotWasmLayoutDiagnostics();const width=signal(300),height=signal(200);let hits=0;
  const canvas=document.createElement('canvas');canvas.width=400;canvas.height=300;document.body.append(canvas);
  const scene=createElement(Flex,{style:{boxSizing:'border-box',width,height,padding:{left:10,right:30,top:20,bottom:40},rowGap:'20%',columnGap:'10%',alignItems:'flex-start'},children:[0,1].map(index=>createElement(Rectangle,{key:index,onClick:()=>{if(index===1)hits++;},style:{width:100,height:30,flexBasis:100,flexGrow:1,flexShrink:0,minWidth:0,fill:index?'blue':'red'}}))});
  const controller=pibbl(canvas,scene);controllers.push(controller);await nextFrame();
  expect([...canvas.getContext('2d')!.getImageData(157,25,1,1).data]).toEqual([0,0,255,255]);clickCanvas(canvas,157,25);expect(hits).toBe(1);
  const mounted=snapshotWasmLayoutDiagnostics();width.set(360);height.set(250);await nextFrame();
  expect([...canvas.getContext('2d')!.getImageData(157,25,1,1).data]).toEqual([0,0,0,0]);clickCanvas(canvas,157,25);expect(hits).toBe(1);clickCanvas(canvas,190,25);expect(hits).toBe(2);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);expect(snapshotWasmLayoutDiagnostics().solves).toBeGreaterThan(mounted.solves);
  controller.dispose();const disposed=snapshotWasmLayoutDiagnostics();expect([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements]).toEqual([baseline.activeNodes,baseline.activeArenas,baseline.cachedMeasurements]);
});

it.runIf(experimentalLayout)('resolves shorthand percentage gaps independently before physical overrides',()=>{
  const children=[0,1,2].map(()=>createElement(Rectangle,{style:{width:40,height:20,flexBasis:40,flexShrink:0,minWidth:0}}));
  const box={x:0,y:0,width:100,height:200};
  expect(layoutFlex(box,children,{gap:'10%',flexWrap:'wrap',alignContent:'flex-start',alignItems:'flex-start'},measurement)).toEqual([{x:0,y:0,width:40,height:20},{x:50,y:0,width:40,height:20},{x:0,y:40,width:40,height:20}]);
  expect(layoutFlex(box,children,{gap:'10%',rowGap:5,flexWrap:'wrap',alignContent:'flex-start',alignItems:'flex-start'},measurement)[2].y).toBe(25);
});
for(const property of ['gap','rowGap','columnGap'] as const)for(const value of ['-10%','NaN%','Infinity%','10px']) {
  it(`rejects invalid percentage gap ${property}=${value}`,()=>{
    expect(()=>layoutFlex({x:0,y:0,width:100,height:200},[],{[property]:value} as unknown as FlexStyle,measurement)).toThrow(new RegExp(property));
  });
}
it.runIf(!experimentalLayout)('keeps percentage gaps explicitly unsupported in ordinary JavaScript Flex',()=>{
  expect(()=>layoutFlex({x:0,y:0,width:100,height:200},[],{gap:'10%'},measurement)).toThrow(/gap/);
});
it.runIf(experimentalLayout)('resolves nested percentage gaps from the actual Grid cell content allocation',async()=>{
  const width=signal(400);let hits=0;const canvas=document.createElement('canvas');canvas.width=500;canvas.height=120;document.body.append(canvas);
  const scene=createElement(Grid,{style:{width,height:100,gridTemplateColumns:['1fr','1fr'],gridTemplateRows:[100]},children:createElement(Flex,{style:{gridColumnStart:1,gridRowStart:1,padding:10,gap:'10%',alignItems:'flex-start'},children:[0,1].map(index=>createElement(Rectangle,{onClick:()=>{if(index===1)hits++;},style:{width:80,height:20,flexBasis:80,flexGrow:1,flexShrink:0,minWidth:0,fill:index?'blue':'red'}}))})});
  const controller=pibbl(canvas,scene);controllers.push(controller);await nextFrame();clickCanvas(canvas,112,15);expect(hits).toBe(1);const before=snapshotWasmLayoutDiagnostics();
  width.set(440);await nextFrame();clickCanvas(canvas,112,15);expect(hits).toBe(1);clickCanvas(canvas,124,15);expect(hits).toBe(2);expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(before.nodeCreates);
});

for(const axis of ['row','column'] as const)for(const sizing of ['content-box','border-box'] as const){
  it.runIf(experimentalLayout)(`resolves allocated ${axis} ${sizing} percentage padding from owner width`,()=>{
    const border=sizing==='border-box';
    const child=createElement(Rectangle,{style:{boxSizing:sizing,width:border?150:80,height:border?100:60,flexBasis:axis==='row'?border?150:80:border?100:60,flexShrink:0,minWidth:0,minHeight:0,padding:{left:'10%',right:'15%',top:'5%',bottom:'10%'}}});
    expect(layoutFlex({x:0,y:0,width:200,height:180},[child],{flexDirection:axis,alignItems:'flex-start'},measurement)).toEqual([{x:0,y:0,width:border?150:130,height:border?100:90}]);
    expect(layoutFlex({x:0,y:0,width:300,height:180},[child],{flexDirection:axis,alignItems:'flex-start'},measurement)).toEqual([{x:0,y:0,width:border?150:155,height:border?100:105}]);
  });
}
it.runIf(experimentalLayout)('rejects percentage padding during intrinsic measurement before native allocation',()=>{
  const child=createElement(Text,{children:'known text',style:{padding:'10%',wrap:true,minHeight:0}});
  const owner=createElement(Flex,{style:{width:200,flexDirection:'column'},children:child});const before=snapshotWasmLayoutDiagnostics();
  expect(measureElement(owner,{minWidth:0,maxWidth:200,minHeight:0,maxHeight:100},service)).toMatchObject({status:'unsupported',reason:expect.stringContaining('percentage padding')});
  const after=snapshotWasmLayoutDiagnostics();expect(after.nodeCreates).toBe(before.nodeCreates);expect(after.activeArenas).toBe(before.activeArenas);
});

it.runIf(experimentalLayout)('moves inner paint and targets with allocated percentage padding without remount',async()=>{
  const baseline=snapshotWasmLayoutDiagnostics();const width=signal(200);let hits=0,mounts=0;let size={width:0,height:0};
  function Content(_props:{style:Record<string,unknown>}){useConst(()=>{mounts++;});const box=useLayoutBox();size={width:box.width,height:box.height};return createElement(Rectangle,{style:{width:box.width,height:box.height,fill:'blue'},onClick:()=>hits++});}
  const child=createElement(Flex,{style:{boxSizing:'border-box',width:150,height:100,flexBasis:150,flexShrink:0,minWidth:0,padding:{left:'10%',right:'15%',top:'5%',bottom:'10%'}},children:createElement(Content,{style:{width:'100%',height:'100%',minWidth:0,flexShrink:0}})});
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;document.body.append(canvas);const root=createElement(Flex,{style:{width,height:180,alignItems:'flex-start'},children:child});
  const controller=pibbl(canvas,root);controllers.push(controller);await nextFrame();expect(size).toEqual({width:100,height:70});clickCanvas(canvas,22,12);expect(hits).toBe(1);const mounted=snapshotWasmLayoutDiagnostics();
  width.set(300);await nextFrame();expect(size).toEqual({width:75,height:55});expect([...canvas.getContext('2d')!.getImageData(22,12,1,1).data]).toEqual([0,0,0,0]);clickCanvas(canvas,22,12);expect(hits).toBe(1);clickCanvas(canvas,35,20);expect(hits).toBe(2);expect(mounts).toBe(1);expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
  controller.dispose();const disposed=snapshotWasmLayoutDiagnostics();expect([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements]).toEqual([baseline.activeNodes,baseline.activeArenas,baseline.cachedMeasurements]);
});
it.runIf(experimentalLayout)('keeps frozen percentage padding off the raw-input allocation cache while numeric transitions remain eligible',async()=>{
  const fill=signal('red'),padding=signal<number|'10%'>(10);let hits=0;
  const first=createElement(Rectangle,{style:Object.freeze({width:20,height:20,minWidth:0,flexShrink:0,padding,fill})});
  const second=createElement(Rectangle,{onClick:()=>hits++,style:Object.freeze({width:20,height:20,minWidth:0,flexShrink:0,fill:'blue'})});
  Object.freeze(first.props);Object.freeze(first);Object.freeze(second.props);Object.freeze(second);const children=Object.freeze([first,second]);
  function Scene(){fill.get();return createElement(Flex,{style:{width:200,height:100,alignItems:'flex-start'},children});}
  const canvas=document.createElement('canvas');canvas.width=200;canvas.height=100;document.body.append(canvas);const controller=pibbl(canvas,createElement(Scene,{}));controllers.push(controller);await nextFrame();expect(frozenFlexInputs(children)).toBe(true);
  fill.set('green');await nextFrame();clickCanvas(canvas,45,5);expect(hits).toBe(1);
  padding.set('10%');await nextFrame();expect(frozenFlexInputs(children)).toBe(false);clickCanvas(canvas,45,5);expect(hits).toBe(1);clickCanvas(canvas,65,5);expect(hits).toBe(2);const percent=snapshotWasmLayoutDiagnostics();
  fill.set('red');await nextFrame();expect(snapshotWasmLayoutDiagnostics().allocationCacheHits).toBe(percent.allocationCacheHits);expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(percent.nodeCreates);clickCanvas(canvas,65,5);expect(hits).toBe(3);
  padding.set(10);await nextFrame();expect(frozenFlexInputs(children)).toBe(true);clickCanvas(canvas,45,5);expect(hits).toBe(4);
});

for(const Root of [Flex,Flow,Grid,Text]) {
  it(`keeps unallocated ${Root.name} percentage padding measurement unsupported`,()=>{
    const element=createElement(Root as typeof Flex,{style:{width:100,height:80,padding:'10%',...(Root===Grid?{gridTemplateColumns:[100],gridTemplateRows:[80]}:{})},children:Root===Text?'text':[]});
    expect(measureElement(element,{minWidth:0,maxWidth:200,minHeight:0,maxHeight:180},service)).toMatchObject({status:'unsupported',reason:expect.stringContaining('percentage padding')});
  });
}

for(const padding of ['-10%','NaN%','Infinity%',{top:'-5%',left:'10%'},{bottom:'NaN%',left:'10%'}]) {
  it(`rejects invalid allocated percentage padding ${JSON.stringify(padding)}`,()=>{
    const child=createElement(Rectangle,{style:{width:50,height:20,flexShrink:0,minWidth:0,padding} as unknown as RectStyle});
    expect(()=>layoutFlex({x:0,y:0,width:200,height:100},[child],{},measurement)).toThrow(/padding/);
  });
}
it('keeps percentage layout borders unsupported',()=>{
  const child=createElement(Rectangle,{style:{width:50,height:20,flexShrink:0,minWidth:0,borderWidth:'10%'} as unknown as RectStyle});
  expect(()=>layoutFlex({x:0,y:0,width:200,height:100},[child],{},measurement)).toThrow(/borderWidth/);
});
it.runIf(!experimentalLayout)('keeps percentage padding unsupported in ordinary JavaScript Flex',()=>{
  const child=createElement(Rectangle,{style:{width:50,height:20,flexShrink:0,minWidth:0,padding:'10%'}});
  expect(()=>layoutFlex({x:0,y:0,width:200,height:100},[child],{},measurement)).toThrow(/padding/);
});

for(const axis of ['row','column'] as const)for(const bound of ['min','max'] as const){
  it.runIf(experimentalLayout)(`allocates wrapped ${axis} stretched automatic cross with percentage ${bound} bounds`,()=>{
    const column=axis==='column';const crossProperty=column?'Width':'Height';
    const children=[createElement(Rectangle,{style:{width:column?'auto':80,height:column?80:'auto',flexBasis:80,flexGrow:0,flexShrink:0,minWidth:0,minHeight:0,[bound+crossProperty]:bound==='min'?'60%':'25%'}}),...[40,20].map(cross=>createElement(Rectangle,{style:{width:column?cross:80,height:column?80:cross,flexBasis:80,flexGrow:0,flexShrink:0,minWidth:0,minHeight:0}}))];
    for(const cross of [100,160]){
      const a=bound==='min'?cross*.6:Math.min(40,cross*.25),offset=bound==='min'?a+12:52;
      expect(layoutFlex({x:0,y:0,width:column?cross:200,height:column?200:cross},children,{flexDirection:axis,flexWrap:'wrap',gap:12,alignItems:'stretch',alignContent:'flex-start'},measurement)).toEqual(column?[{x:0,y:0,width:a,height:80},{x:0,y:92,width:40,height:80},{x:offset,y:0,width:20,height:80}]:[{x:0,y:0,width:80,height:a},{x:92,y:0,width:80,height:40},{x:0,y:offset,width:80,height:20}]);
    }
  });
}
it.runIf(experimentalLayout)('keeps wrapped column measured main and non-stretched automatic cross unsupported',()=>{
  const container={x:0,y:0,width:100,height:200};
  const automaticMain=createElement(Rectangle,{style:{width:20,height:'auto',minHeight:0}});
  expect(()=>layoutFlex(container,[automaticMain],{flexDirection:'column',flexWrap:'wrap'},measurement)).toThrow(/declared height or flexBasis/);
  const automaticCross=createElement(Rectangle,{style:{width:'auto',height:80,flexBasis:80,minHeight:0}});
  expect(()=>layoutFlex(container,[automaticCross],{flexDirection:'column',flexWrap:'wrap',alignItems:'center'},measurement)).toThrow(/declared width/);
});

for(const axis of ['row','column'] as const)for(const bound of ['min','max'] as const){
  it.runIf(experimentalLayout)(`moves wrapped ${axis} percentage ${bound} cross targets without repeating the main solve`,async()=>{
    const column=axis==='column',cross=signal(100);let aHits=0,cHits=0;const baseline=snapshotWasmLayoutDiagnostics();
    const a=createElement(Rectangle,{onClick:()=>aHits++,style:{width:column?'auto':80,height:column?80:'auto',flexBasis:80,flexShrink:0,minWidth:0,minHeight:0,[bound+(column?'Width':'Height')]:bound==='min'?'60%':'25%',fill:'red'}});
    const siblings=[40,20].map((size,index)=>createElement(Rectangle,{onClick:index?()=>cHits++:undefined,style:{width:column?size:80,height:column?80:size,flexBasis:80,flexShrink:0,minWidth:0,minHeight:0,fill:index?'blue':'green'}}));
    const root=createElement(Flex,{style:{width:column?cross:200,height:column?200:cross,flexDirection:axis,flexWrap:'wrap',gap:12,alignItems:'stretch',alignContent:'flex-start'},children:[a,...siblings]});
    const canvas=document.createElement('canvas');canvas.width=220;canvas.height=220;document.body.append(canvas);const controller=pibbl(canvas,root);controllers.push(controller);await nextFrame();
    const point=(value:number)=>column?{x:value,y:5}:{x:5,y:value};const old=point(bound==='min'?76:30);
    clickCanvas(canvas,old.x,old.y);expect(bound==='min'?cHits:aHits).toBe(bound==='min'?1:0);
    const mounted=snapshotWasmLayoutDiagnostics();cross.set(160);await nextFrame();
    clickCanvas(canvas,old.x,old.y);expect(bound==='min'?cHits:aHits).toBe(bound==='min'?1:1);
    if(bound==='min'){const next=point(112);expect([...canvas.getContext('2d')!.getImageData(next.x,next.y,1,1).data]).toEqual([0,0,255,255]);clickCanvas(canvas,next.x,next.y);expect(cHits).toBe(2);}
    const resized=snapshotWasmLayoutDiagnostics();expect(resized.nodeCreates).toBe(mounted.nodeCreates);expect(resized.solves).toBe(mounted.solves);expect(resized.lineFormations).toBe(mounted.lineFormations);expect(resized.crossPlacements).toBeGreaterThan(mounted.crossPlacements);
    controller.dispose();const disposed=snapshotWasmLayoutDiagnostics();expect([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements]).toEqual([baseline.activeNodes,baseline.activeArenas,baseline.cachedMeasurements]);
  });
}

it.runIf(experimentalLayout)('honors a non-stretch alignSelf override when guarding wrapped automatic column cross size',()=>{
  const child=createElement(Rectangle,{style:{width:'auto',height:80,flexBasis:80,minHeight:0,alignSelf:'center'}});
  expect(()=>layoutFlex({x:0,y:0,width:100,height:200},[child],{flexDirection:'column',flexWrap:'wrap',alignItems:'stretch'},measurement)).toThrow(/declared width/);
});
for(const value of ['-10%','NaN%','Infinity%']){
  it.runIf(experimentalLayout)(`rejects wrapped automatic column cross bound ${value}`,()=>{
    const child=createElement(Rectangle,{style:{width:'auto',height:80,flexBasis:80,minHeight:0,minWidth:0,maxWidth:value as '10%'}});
    expect(()=>layoutFlex({x:0,y:0,width:100,height:200},[child],{flexDirection:'column',flexWrap:'wrap',alignItems:'stretch'},measurement)).toThrow(/maxWidth/);
  });
}
it.runIf(experimentalLayout)('rejects opposing wrapped automatic column percentage cross bounds',()=>{
  const child=createElement(Rectangle,{style:{width:'auto',height:80,flexBasis:80,minHeight:0,minWidth:'75%',maxWidth:'25%'}});
  expect(()=>layoutFlex({x:0,y:0,width:100,height:200},[child],{flexDirection:'column',flexWrap:'wrap',alignItems:'stretch'},measurement)).toThrow(/minimum/);
});

for(const wrap of ['wrap','wrap-reverse'] as const){
  it.runIf(experimentalLayout)(`measures fixed-width direct Text before column ${wrap} line formation`,()=>{
    const text=(value:string)=>createElement(Text,{children:value,style:{width:50,wrap:true,font:'10px monospace',lineHeight:10,minHeight:0,flexGrow:0,flexShrink:0}});
    const card=createElement(Rectangle,{style:{width:40,height:30,flexBasis:30,flexShrink:0,minHeight:0}});
    const options={flexDirection:'column',flexWrap:wrap,gap:10,alignContent:'flex-start',alignItems:'flex-start'} as const;
    const box={x:0,y:0,width:180,height:60};
    expect(layoutFlex(box,[text('aaaa'),card],options,measurement)).toEqual([{x:wrap==='wrap'?0:130,y:0,width:50,height:10},{x:wrap==='wrap'?0:140,y:20,width:40,height:30}]);
    expect(layoutFlex(box,[text('aaaa aaaa aaaa'),card],options,measurement)).toEqual([{x:wrap==='wrap'?0:130,y:0,width:50,height:30},{x:wrap==='wrap'?60:80,y:0,width:40,height:30}]);
  });
}

it.runIf(experimentalLayout)('caches wrapped column direct Text measurement while content moves a stable following target',async()=>{
  const baseline=snapshotWasmLayoutDiagnostics(),text=signal('aaaa'),fill=signal('black'),height=signal(60);let hits=0,mounts=0;
  function Card(_props:{style:Record<string,unknown>}){useConst(()=>{mounts++;});const box=useLayoutBox();return createElement(Rectangle,{style:{width:box.width,height:box.height,fill:'blue'},onClick:()=>hits++});}
  const root=createElement(Flex,{style:{width:180,height,flexDirection:'column',flexWrap:'wrap',gap:10,alignItems:'flex-start',alignContent:'flex-start'},children:[createElement(Text,{key:'text',pointerEvents:'none',children:text,style:{width:50,wrap:true,font:'10px monospace',lineHeight:10,minHeight:0,flexGrow:0,flexShrink:0,fill}}),createElement(Card,{key:'card',style:{width:40,height:30,flexBasis:30,minHeight:0,flexShrink:0}})]});
  const canvas=document.createElement('canvas');canvas.width=200;canvas.height=100;document.body.append(canvas);const controller=pibbl(canvas,root);controllers.push(controller);await nextFrame();clickCanvas(canvas,5,25);expect(hits).toBe(1);const initial=snapshotWasmLayoutDiagnostics();
  text.set('aaaa aaaa aaaa');await nextFrame();clickCanvas(canvas,5,25);expect(hits).toBe(1);clickCanvas(canvas,65,5);expect(hits).toBe(2);const long=snapshotWasmLayoutDiagnostics();expect(long.measuredLeaves).toBe(initial.measuredLeaves+1);expect(long.nodeCreates).toBe(initial.nodeCreates);expect(mounts).toBe(1);
  fill.set('red');await nextFrame();const painted=snapshotWasmLayoutDiagnostics();expect(painted.measuredLeaves).toBe(long.measuredLeaves);expect(painted.solves).toBe(long.solves);expect(painted.lineFormations).toBe(long.lineFormations);
  height.set(80);await nextFrame();expect(snapshotWasmLayoutDiagnostics().measuredLeaves).toBe(painted.measuredLeaves);clickCanvas(canvas,5,45);expect(hits).toBe(3);expect(mounts).toBe(1);
  controller.dispose();const disposed=snapshotWasmLayoutDiagnostics();expect([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements]).toEqual([baseline.activeNodes,baseline.activeArenas,baseline.cachedMeasurements]);
});

for (const [name, override] of Object.entries({automaticWidth:{width:'auto'},percentageWidth:{width:'50%'},crossMinimum:{minWidth:10},crossMaximum:{maxWidth:80},grow:{flexGrow:1},shrink:{flexShrink:1},customFont:{font:'10px CustomFont'},clip:{fit:'clip'},unwrapped:{wrap:false},mainMaximum:{maxHeight:50}})) {
  it.runIf(experimentalLayout)(`rejects unsupported wrapped-column Text ${name}`,()=>{
    const child=createElement(Text,{children:'aaaa aaaa',style:{width:50,wrap:true,font:'10px monospace',lineHeight:10,minHeight:0,flexGrow:0,flexShrink:0,...override} as never});
    expect(()=>layoutFlex({x:0,y:0,width:180,height:60},[child],{flexDirection:'column',flexWrap:'wrap',alignItems:'flex-start'},measurement)).toThrow();
  });
}

for(const direction of ['row','column'] as const){
  it.runIf(experimentalLayout)(`resolves allocated ${direction} physical percentage margins against content width`,()=>{
    const child=createElement(Rectangle,{style:{width:40,height:20,minWidth:0,minHeight:0,flexShrink:0,margin:'5%',marginLeft:'10%',marginBottom:-2} as any});
    expect(layoutFlex({x:0,y:0,width:200,height:100},[child],{flexDirection:direction,alignItems:'flex-start'},measurement)).toEqual([{x:20,y:10,width:40,height:20}]);
    expect(layoutFlex({x:0,y:0,width:300,height:100},[child],{flexDirection:direction,alignItems:'flex-start'},measurement)).toEqual([{x:30,y:15,width:40,height:20}]);
  });
}

it.runIf(experimentalLayout)('moves allocated percentage margin paint and hit targets after owner width changes',async()=>{
  const baseline=snapshotWasmLayoutDiagnostics(),width=signal(300),fill=signal('red');let hits=0;
  const canvas=document.createElement('canvas');canvas.width=400;canvas.height=260;document.body.append(canvas);
  const root=createElement(Flex,{style:{width,height:200,boxSizing:'border-box',padding:{left:10,right:30,top:20,bottom:40},alignItems:'flex-start'},children:[createElement(Rectangle,{style:{width:60,height:30,minWidth:0,minHeight:0,flexShrink:0,marginLeft:'10%',marginRight:'15%',marginTop:'5%',marginBottom:'20%',fill}}),createElement(Rectangle,{style:{width:136,height:81,minWidth:0,minHeight:0,flexShrink:0,fill:'blue'},onClick:()=>hits++})]});
  const controller=pibbl(canvas,root);controllers.push(controller);await nextFrame();clickCanvas(canvas,136,21);expect(hits).toBe(1);const before=snapshotWasmLayoutDiagnostics();fill.set('green');await nextFrame();const painted=snapshotWasmLayoutDiagnostics();expect(painted.solves).toBe(before.solves);expect(painted.lineFormations).toBe(before.lineFormations);expect(painted.measuredLeaves).toBe(before.measuredLeaves);
  width.set(360);await nextFrame();clickCanvas(canvas,136,21);expect(hits).toBe(1);clickCanvas(canvas,151,21);expect(hits).toBe(2);expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(before.nodeCreates);
  controller.dispose();const disposed=snapshotWasmLayoutDiagnostics();expect([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements]).toEqual([baseline.activeNodes,baseline.activeArenas,baseline.cachedMeasurements]);
});
it.runIf(experimentalLayout)('rejects percentage margins without supported allocated ownership',()=>{
  const child=createElement(Rectangle,{style:{width:20,height:20,minWidth:0,margin:'10%'}});
  expect(()=>layoutFlex({x:0,y:0,width:Number.POSITIVE_INFINITY,height:100},[child],{flexWrap:'wrap-reverse'},measurement)).toThrow(/property width.*Infinity/);
  const root=createElement(Flex,{style:{width:100},children:child});
  expect(measureElement(root,{minWidth:0,maxWidth:100,minHeight:0,maxHeight:100},service)).toMatchObject({status:'unsupported'});
});
it.runIf(experimentalLayout)('resolves large finite percentage margin without intermediate multiplication overflow',()=>{
  const child=createElement(Rectangle,{style:{width:1,height:1,minWidth:0,minHeight:0,flexShrink:0,marginLeft:'100%'}});
  expect(layoutFlex({x:0,y:0,width:1e308,height:10},[child],{alignItems:'flex-start'},measurement)).toEqual([{x:1e308,y:0,width:1,height:1}]);
});

it.skipIf(experimentalLayout)('keeps percentage physical margins rejected in normal JavaScript Flex',()=>{
  const child=createElement(Rectangle,{style:{width:20,height:20,marginLeft:'10%'}});
  expect(()=>layoutFlex({x:0,y:0,width:100,height:100},[child],{},measurement)).toThrow(/margin/);
});

it.runIf(experimentalLayout)('drives nested percentage owners through the public comparison before and after allocation',async()=>{
  const module=await import('../../scenarios/src/learning/layout/wasm-yoga-migration.example');
  const canvas=document.createElement('canvas');canvas.width=760;canvas.height=540;document.body.append(canvas);
  const baseline=snapshotWasmLayoutDiagnostics();const controller=createExampleMount(module.WasmYogaMigrationExample)(canvas);controllers.push(controller);await nextFrame();
  for(let i=0;i<7;i++){clickCanvas(canvas,520,158);await nextFrame();}
  await expect.poll(()=>canvas.nextElementSibling?.textContent).toContain('nested-percent-gap-row-nowrap');
  const state=()=>JSON.parse(canvas.nextElementSibling!.textContent!.split('nested state: ')[1]);
  const initial=state();expect(initial.boxes.A).toEqual({x:0,y:0,width:81,height:60});expect(initial.boxes.A1).toEqual({x:0,y:0,width:32.4,height:60});expect(initial.boxes.A2).toEqual({x:40.5,y:0,width:32.4,height:60});
  clickCanvas(canvas,675,242);await nextFrame();await expect.poll(()=>state().hits).toBe(1);
  clickCanvas(canvas,60,158);await nextFrame();await expect.poll(()=>canvas.nextElementSibling?.textContent).toContain('nested-percent-gap-row-nowrap-resized');const resized=state();expect(resized.boxes.A).toEqual({x:0,y:0,width:51,height:60});expect(resized.boxes.A1).toEqual({x:0,y:0,width:20.4,height:60});expect(resized.boxes.A2).toEqual({x:25.5,y:0,width:20.4,height:60});expect(resized.stamps).toEqual(initial.stamps);
  clickCanvas(canvas,675,242);await nextFrame();expect(state().hits).toBe(1);clickCanvas(canvas,583,242);await nextFrame();await expect.poll(()=>state().hits).toBe(2);
  const before=snapshotWasmLayoutDiagnostics();clickCanvas(canvas,300,158);await nextFrame();const painted=snapshotWasmLayoutDiagnostics();expect(painted.solves).toBe(before.solves);expect(painted.lineFormations).toBe(before.lineFormations);expect(painted.measuredLeaves).toBe(before.measuredLeaves);expect(painted.nodeCreates).toBe(before.nodeCreates);
  controller.dispose();const disposed=snapshotWasmLayoutDiagnostics();expect([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements]).toEqual([baseline.activeNodes,baseline.activeArenas,baseline.cachedMeasurements]);
});
for(const maxOnly of [false,true]){
  it.runIf(experimentalLayout)(`rejects nested percentage feedback under ${maxOnly?'max-only':'intrinsic'} owners`,()=>{
    const leaf=createElement(Rectangle,{style:{width:'40%',height:20,flexBasis:'40%',minWidth:0,minHeight:0,flexShrink:0}});
    const nested=createElement(Flex,{style:{width:'auto',height:60,minWidth:0,minHeight:0,flexShrink:0,gap:'10%'},children:[leaf,leaf]});
    const root=createElement(Flex,{style:{width:'auto',maxWidth:maxOnly?360:undefined},children:nested});
    expect(measureElement(root,{minWidth:0,maxWidth:360,minHeight:0,maxHeight:240},service)).toMatchObject({status:'unsupported',reason:expect.stringContaining('definite child basis')});
  });
}
for(const column of [false,true])for(const resized of [false,true]){
  it.runIf(experimentalLayout)(`preserves numeric physical offsets for ${column?'column':'row'} wrapped percentages ${resized?'resized':'initial'}`,()=>{
    const width=resized?320:260,box={x:10,y:20,width,height:resized?190:140};
    const item=(percent:boolean)=>createElement(Rectangle,{style:{width:60,height:30,flexBasis:column?30:60,flexGrow:0,flexShrink:0,minWidth:0,minHeight:0,marginLeft:percent?'10%':width*.1,marginRight:percent?'15%':width*.15,marginTop:percent?'5%':width*.05,marginBottom:percent?'20%':width*.2}});
    const following=createElement(Rectangle,{style:{width:136,height:81,flexBasis:column?81:136,flexGrow:0,flexShrink:0,minWidth:0,minHeight:0}});
    const options={flexDirection:column?'column':'row',flexWrap:'wrap',alignItems:'flex-start',alignContent:'flex-start'} as const;
    const expected=[{x:resized?42:36,y:resized?36:33,width:60,height:30},{x:column?(resized?150:135):resized?150:10,y:column||resized?20:115,width:136,height:81}];
    expect(layoutFlex(box,[item(false),following],options,measurement)).toEqual(expected);
    expect(layoutFlex(box,[item(true),following],options,measurement)).toEqual(expected);
  });
}

for(const column of [false,true]){
 it.runIf(experimentalLayout)(`moves ${column?'column':'row'} wrapped percentage margin targets without remounting`,async()=>{
  const baseline=snapshotWasmLayoutDiagnostics(),width=signal(300),height=signal(200),fill=signal('red');let hits=0;
  const canvas=document.createElement('canvas');canvas.width=400;canvas.height=280;document.body.append(canvas);
  const root=createElement(Flex,{style:{width,height,boxSizing:'border-box',padding:{left:10,right:30,top:20,bottom:40},flexDirection:column?'column':'row',flexWrap:'wrap',alignContent:'flex-start',alignItems:'flex-start'},children:[createElement(Rectangle,{style:{width:60,height:30,flexBasis:column?30:60,flexGrow:0,flexShrink:0,minWidth:0,minHeight:0,marginLeft:'10%',marginRight:'15%',marginTop:'5%',marginBottom:'20%',fill}}),createElement(Rectangle,{style:{width:136,height:81,flexBasis:column?81:136,flexGrow:0,flexShrink:0,minWidth:0,minHeight:0,fill:'blue'},onClick:()=>hits++})]});
  const controller=pibbl(canvas,root);controllers.push(controller);await nextFrame();clickCanvas(canvas,column?136:12,column?21:117);expect(hits).toBe(1);const before=snapshotWasmLayoutDiagnostics();fill.set('green');await nextFrame();const painted=snapshotWasmLayoutDiagnostics();expect(painted.solves).toBe(before.solves);expect(painted.lineFormations).toBe(before.lineFormations);expect(painted.measuredLeaves).toBe(before.measuredLeaves);
  width.set(360);height.set(250);await nextFrame();clickCanvas(canvas,column?136:12,column?21:117);expect(hits).toBe(1);clickCanvas(canvas,152,22);expect(hits).toBe(2);expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(before.nodeCreates);
  controller.dispose();const disposed=snapshotWasmLayoutDiagnostics();expect([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements]).toEqual([baseline.activeNodes,baseline.activeArenas,baseline.cachedMeasurements]);
 });
}
for(const column of [false,true])for(const resized of [false,true]){
 it.runIf(experimentalLayout)(`preserves numeric offsets for ${column?'column':'row'} wrap-reverse percentage margins ${resized?'resized':'initial'}`,()=>{
  const width=resized?320:260,box={x:10,y:20,width,height:resized?190:140};
  const item=(percent:boolean)=>createElement(Rectangle,{style:{width:60,height:30,flexBasis:column?30:60,flexGrow:0,flexShrink:0,minWidth:0,minHeight:0,marginLeft:percent?'10%':width*.1,marginRight:percent?'15%':width*.15,marginTop:percent?'5%':width*.05,marginBottom:percent?'20%':width*.2}});
  const following=createElement(Rectangle,{style:{width:136,height:81,flexBasis:column?81:136,flexGrow:0,flexShrink:0,minWidth:0,minHeight:0}});
  const options={flexDirection:column?'column':'row',flexWrap:'wrap-reverse',alignItems:'flex-start',alignContent:'flex-start'} as const;
  const expected=column?[{x:resized?222:171,y:resized?36:33,width:60,height:30},{x:resized?54:9,y:20,width:136,height:81}]:[{x:resized?42:36,y:resized?116:78,width:60,height:30},{x:resized?150:10,y:resized?129:-16,width:136,height:81}];
  expect(layoutFlex(box,[item(false),following],options,measurement)).toEqual(expected);
  expect(layoutFlex(box,[item(true),following],options,measurement)).toEqual(expected);
 });
}
for(const column of [false,true]){
 it.runIf(experimentalLayout)(`moves ${column?'column':'row'} wrap-reverse percentage margin targets with stable nodes`,async()=>{
  const baseline=snapshotWasmLayoutDiagnostics(),width=signal(300),height=signal(200),fill=signal('red');let hits=0;
  const canvas=document.createElement('canvas');canvas.width=400;canvas.height=280;document.body.append(canvas);
  const root=createElement(Flex,{style:{width,height,boxSizing:'border-box',padding:{left:10,right:30,top:20,bottom:40},flexDirection:column?'column':'row',flexWrap:'wrap-reverse',alignContent:'flex-start',alignItems:'flex-start'},children:[createElement(Rectangle,{style:{width:60,height:30,flexBasis:column?30:60,flexGrow:0,flexShrink:0,minWidth:0,minHeight:0,marginLeft:'10%',marginRight:'15%',marginTop:'5%',marginBottom:'20%',fill}}),createElement(Rectangle,{style:{width:136,height:81,flexBasis:column?81:136,flexGrow:0,flexShrink:0,minWidth:0,minHeight:0,fill:'blue'},onClick:()=>hits++})]});
  const controller=pibbl(canvas,root);controllers.push(controller);await nextFrame();clickCanvas(canvas,column?11:12,column?22:5);expect(hits).toBe(1);const before=snapshotWasmLayoutDiagnostics();fill.set('green');await nextFrame();const painted=snapshotWasmLayoutDiagnostics();expect(painted.solves).toBe(before.solves);expect(painted.lineFormations).toBe(before.lineFormations);expect(painted.measuredLeaves).toBe(before.measuredLeaves);
  width.set(360);height.set(250);await nextFrame();clickCanvas(canvas,column?11:12,column?22:5);expect(hits).toBe(1);clickCanvas(canvas,column?56:152,column?22:131);expect(hits).toBe(2);expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(before.nodeCreates);
  controller.dispose();const disposed=snapshotWasmLayoutDiagnostics();expect([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements]).toEqual([baseline.activeNodes,baseline.activeArenas,baseline.cachedMeasurements]);
 });
}
it.runIf(experimentalLayout)('resolves signed percentage shorthand with specific zero edges independent of declaration order',()=>{
 const first=createElement(Rectangle,{style:{width:20,height:10,minWidth:0,minHeight:0,flexShrink:0,margin:'10%',marginLeft:'-5%',marginTop:0}});
 const second=createElement(Rectangle,{style:{marginTop:0,marginLeft:'-5%',margin:'10%',width:20,height:10,minWidth:0,minHeight:0,flexShrink:0}});
 const expected=[{x:-5,y:0,width:20,height:10}];
 expect(layoutFlex({x:0,y:0,width:100,height:100},[first],{},measurement)).toEqual(expected);
 expect(layoutFlex({x:0,y:0,width:100,height:100},[second],{},measurement)).toEqual(expected);
});

for(const reversed of [false,true]){
 it.runIf(experimentalLayout)(`places finite RTL ${reversed?'row-reverse':'row'} with physical margins`,()=>{
  const children=[createElement(Rectangle,{style:{width:40,height:24,minWidth:0,minHeight:0,flexShrink:0,marginLeft:8,marginRight:20,marginTop:3,marginBottom:7}}),createElement(Rectangle,{style:{width:30,height:20,minWidth:0,minHeight:0,flexShrink:0,marginLeft:5,marginRight:9,marginTop:2,marginBottom:4}})];
  const options={flexDirection:reversed?'row-reverse' as const:'row' as const,layoutDirection:'rtl' as const,gap:12,alignItems:'flex-start' as const};
  expect(layoutFlex({x:0,y:0,width:240,height:120},children,options,measurement)).toEqual([{x:reversed?8:180,y:3,width:40,height:24},{x:reversed?85:121,y:2,width:30,height:20}]);
 });
}
it.runIf(experimentalLayout)('inherits a signal layout direction through ordinary components Group and Clip with explicit LTR override',async()=>{
 const baseline=snapshotWasmLayoutDiagnostics(),direction=signal<'ltr'|'rtl'>('ltr'),fill=signal('red');let inheritedHits=0,overrideHits=0,mounts=0;
 const clip=new Path2D();clip.rect(0,0,100,40);
 function Leaf({override,first,style:_style}:{override:boolean;first:boolean;style:Record<string,unknown>}){useConst(()=>{mounts++;});const box=useLayoutBox();return createElement(Rectangle,{style:{width:box.width,height:box.height,fill},onClick:()=>{if(first){if(override)overrideHits++;else inheritedHits++;}}});}
 function Branch({override,style:_style}:{override:boolean;style:Record<string,unknown>}){const box=useLayoutBox();const innerStyle={width:box.width,height:box.height,gap:10,layoutDirection:override?'ltr' as const:undefined};return createElement(Group,{children:createElement(Clip,{style:{d:clip},children:createElement(Flex,{style:innerStyle,children:[true,false].map(first=>createElement(Leaf,{key:String(first),override,first,style:{width:20,height:20,minWidth:0,minHeight:0,flexShrink:0}}))})})});}
 const canvas=document.createElement('canvas');canvas.width=320;canvas.height=80;document.body.append(canvas);
 const rootStyle={width:300,height:60,layoutDirection:direction};const root=createElement(Flex,{style:rootStyle,children:[false,true].map(override=>createElement(Branch,{key:String(override),override,style:{width:100,height:40,minWidth:0,minHeight:0,flexShrink:0}}))});
 const controller=pibbl(canvas,root);controllers.push(controller);await nextFrame();clickCanvas(canvas,5,5);clickCanvas(canvas,105,5);expect([inheritedHits,overrideHits,mounts]).toEqual([1,1,4]);const initial=snapshotWasmLayoutDiagnostics();
 direction.set('rtl');await nextFrame();clickCanvas(canvas,5,5);expect(inheritedHits).toBe(1);clickCanvas(canvas,285,5);clickCanvas(canvas,105,5);expect([inheritedHits,overrideHits,mounts]).toEqual([2,2,4]);const mirrored=snapshotWasmLayoutDiagnostics();expect(mirrored.nodeCreates).toBe(initial.nodeCreates);expect(mirrored.measuredLeaves).toBe(initial.measuredLeaves);
 fill.set('blue');await nextFrame();const painted=snapshotWasmLayoutDiagnostics();expect(painted.solves).toBe(mirrored.solves);expect(painted.mainPlacements).toBe(mirrored.mainPlacements);expect(painted.crossPlacements).toBe(mirrored.crossPlacements);
 controller.dispose();const disposed=snapshotWasmLayoutDiagnostics();expect([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements]).toEqual([baseline.activeNodes,baseline.activeArenas,baseline.cachedMeasurements]);
});

it.runIf(experimentalLayout)('places finite RTL column on the right cross edge',()=>{
 const child=createElement(Rectangle,{style:{width:20,height:10,minWidth:0,minHeight:0,flexShrink:0}});
 expect(layoutFlex({x:0,y:0,width:100,height:60},[child],{layoutDirection:'rtl',flexDirection:'column',alignItems:'flex-start'},measurement)).toEqual([{x:80,y:0,width:20,height:10}]);
});
it.runIf(experimentalLayout)('forwards direction changes through a retained Layer',async()=>{
 const baseline=snapshotWasmLayoutDiagnostics(),direction=signal<'ltr'|'rtl'>('ltr');let hits=0,mounts=0;
 function Leaf(){useConst(()=>{mounts++;});return createElement(Rectangle,{style:{width:20,height:20,fill:'red'},onClick:()=>hits++});}
 const layer=createElement(Layer,{style:{width:100,height:40,minWidth:0,minHeight:0,flexShrink:0},children:createElement(Flex,{style:{width:100,height:40},children:createElement(Leaf,{style:{width:20,height:20,minWidth:0,minHeight:0,flexShrink:0}})})});
 const canvas=document.createElement('canvas');canvas.width=100;canvas.height=60;document.body.append(canvas);
 const controller=pibbl(canvas,createElement(Flex,{style:{width:100,height:40,layoutDirection:direction},children:layer}));controllers.push(controller);await nextFrame();clickCanvas(canvas,5,5);expect(hits).toBe(1);const initial=snapshotWasmLayoutDiagnostics();
 direction.set('rtl');await nextFrame();clickCanvas(canvas,5,5);expect(hits).toBe(1);clickCanvas(canvas,85,5);expect(hits).toBe(2);expect(mounts).toBe(1);expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(initial.nodeCreates);
 controller.dispose();const disposed=snapshotWasmLayoutDiagnostics();expect([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements]).toEqual([baseline.activeNodes,baseline.activeArenas,baseline.cachedMeasurements]);
});

it('rejects invalid layout direction before allocating native nodes',()=>{
 const before=snapshotWasmLayoutDiagnostics();
 expect(()=>layoutFlex({x:0,y:0,width:100,height:40},[],{layoutDirection:'sideways' as 'rtl'},measurement)).toThrow(/layoutDirection/);
 if(!experimentalLayout)expect(()=>layoutFlex({x:0,y:0,width:100,height:40},[],{layoutDirection:'rtl'},measurement)).toThrow(/layoutDirection/);
 const after=snapshotWasmLayoutDiagnostics();expect(after.activeNodes).toBe(before.activeNodes);expect(after.activeArenas).toBe(before.activeArenas);
});

for(const rtl of [false,true])for(const start of ['10%',0,'-10%'] as const){
 it.runIf(experimentalLayout)(`resolves logical margin precedence rtl=${rtl} start=${start}`,()=>{
  const startSize=start===0?0:start==='10%'?20:-20;
  const first={width:40,height:20,minWidth:0,minHeight:0,flexShrink:0,margin:7,marginLeft:30,marginRight:40,marginStart:start,marginEnd:'5%' as const};
  const reordered={marginEnd:'5%' as const,marginStart:start,marginRight:40,marginLeft:30,margin:7,width:40,height:20,minWidth:0,minHeight:0,flexShrink:0};
  const last=createElement(Rectangle,{style:{width:30,height:20,minWidth:0,minHeight:0,flexShrink:0}});
  const expected=[{x:rtl?160-startSize:startSize,y:7,width:40,height:20},{x:rtl?108-startSize:62+startSize,y:0,width:30,height:20}];
  for(const style of [first,reordered])expect(layoutFlex({x:0,y:0,width:200,height:60},[createElement(Rectangle,{style}),last],{layoutDirection:rtl?'rtl':'ltr',gap:12,alignItems:'flex-start'},measurement)).toEqual(expected);
 });
}
it.runIf(experimentalLayout)('moves logical margin signal targets under inherited RTL without remounting',async()=>{
 const baseline=snapshotWasmLayoutDiagnostics(),start=signal<number|'10%'>(0),direction=signal<'ltr'|'rtl'>('rtl'),fill=signal('red');let hits=0,mounts=0;
 function Card(){useConst(()=>{mounts++;});const box=useLayoutBox();return createElement(Rectangle,{style:{width:box.width,height:box.height,fill},onClick:()=>hits++});}
 const itemStyle={width:40,height:20,minWidth:0,minHeight:0,flexShrink:0,marginStart:start};const rootStyle={width:200,height:60,layoutDirection:direction};
 const canvas=document.createElement('canvas');canvas.width=200;canvas.height=60;document.body.append(canvas);const controller=pibbl(canvas,createElement(Flex,{style:rootStyle,children:createElement(Card,{style:itemStyle})}));controllers.push(controller);await nextFrame();clickCanvas(canvas,195,5);expect(hits).toBe(1);const initial=snapshotWasmLayoutDiagnostics();
 start.set('10%');await nextFrame();clickCanvas(canvas,195,5);expect(hits).toBe(1);clickCanvas(canvas,145,5);expect(hits).toBe(2);direction.set('ltr');await nextFrame();clickCanvas(canvas,145,5);expect(hits).toBe(2);clickCanvas(canvas,25,5);expect(hits).toBe(3);expect(mounts).toBe(1);expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(initial.nodeCreates);
 const before=snapshotWasmLayoutDiagnostics();fill.set('blue');await nextFrame();expect(snapshotWasmLayoutDiagnostics().solves).toBe(before.solves);controller.dispose();const disposed=snapshotWasmLayoutDiagnostics();expect([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements]).toEqual([baseline.activeNodes,baseline.activeArenas,baseline.cachedMeasurements]);
});

it.runIf(experimentalLayout)('uses an explicit child Flex direction for its logical margin',()=>{
 const child=createElement(Flex,{style:{width:40,height:20,layoutDirection:'ltr',marginStart:10,minWidth:0,minHeight:0,flexShrink:0},children:[]});
 expect(layoutFlex({x:0,y:0,width:200,height:60},[child],{layoutDirection:'rtl',alignItems:'flex-start'},measurement)).toEqual([{x:160,y:0,width:40,height:20}]);
});
it.runIf(experimentalLayout)('measures winning numeric logical margin instead of overridden physical percentage',()=>{
 const root=createElement(Flex,{style:{height:20},children:createElement(Rectangle,{style:{width:40,height:20,minWidth:0,minHeight:0,flexShrink:0,marginLeft:'10%',marginStart:0}})});
 expect(measureElement(root,{minWidth:0,maxWidth:200,minHeight:0,maxHeight:60},service)).toEqual({status:'measured',size:{width:40,height:20}});
});

it.runIf(experimentalLayout)('uses child RTL logical margins within an LTR Flex allocation',()=>{
 const child=createElement(Flex,{style:{width:40,height:20,layoutDirection:'rtl',marginStart:10,minWidth:0,minHeight:0,flexShrink:0},children:[]});
 expect(layoutFlex({x:0,y:0,width:200,height:60},[child],{layoutDirection:'ltr',alignItems:'flex-start'},measurement)).toEqual([{x:0,y:0,width:40,height:20}]);
});
it.skipIf(experimentalLayout)('rejects logical margins in normal JavaScript Flex',()=>{
 for(const edge of [{marginStart:0},{marginEnd:'-10%' as const}]){const child=createElement(Rectangle,{style:{width:40,height:20,minWidth:0,...edge}});expect(()=>layoutFlex({x:0,y:0,width:200,height:60},[child],{},measurement)).toThrow(/margin/);}
});

for(const axis of ['row','column'] as const)for(const rtl of [false,true])for(const start of [0,'10%'] as const){
 it.runIf(experimentalLayout)(`resolves logical padding ${axis} precedence rtl=${rtl} start=${start}`,()=>{
  const extra=start===0?0:20;const width=rtl?48+extra:60+extra;
  const first={width:40,height:20,minWidth:0,minHeight:0,flexShrink:0,padding:{left:8,right:20,top:5,bottom:5},paddingStart:start};
  const reordered={paddingStart:start,padding:{bottom:5,top:5,right:20,left:8},width:40,height:20,minWidth:0,minHeight:0,flexShrink:0};
  for(const style of [first,reordered])expect(layoutFlex({x:0,y:0,width:200,height:100},[createElement(Rectangle,{style})],{flexDirection:axis,layoutDirection:rtl?'rtl':'ltr',alignItems:'flex-start'},measurement)).toEqual([{x:rtl?200-width:0,y:0,width,height:30}]);
 });
}
it.runIf(experimentalLayout)('keeps logical percentage padding canonical through nested direction resize and moved hits',async()=>{
 const baseline=snapshotWasmLayoutDiagnostics(),start=signal<number|'10%'>(0),width=signal(200),direction=signal<'ltr'|'rtl'>('rtl'),fill=signal('red');let hits=0;
 const innerStyle={width:100,height:60,boxSizing:'border-box' as const,minWidth:0,minHeight:0,flexShrink:0,padding:{left:8,right:20,top:5,bottom:5},paddingStart:start};
 const root=createElement(Flex,{style:{width,height:100,layoutDirection:direction},children:createElement(Flex,{style:innerStyle,children:createElement(Rectangle,{style:{width:20,height:20,minWidth:0,minHeight:0,flexShrink:0,fill},onClick:()=>hits++})})});
 const canvas=document.createElement('canvas');canvas.width=320;canvas.height=120;document.body.append(canvas);const controller=pibbl(canvas,root);controllers.push(controller);await nextFrame();clickCanvas(canvas,195,10);expect(hits).toBe(1);const before=snapshotWasmLayoutDiagnostics();
 start.set('10%');await nextFrame();clickCanvas(canvas,195,10);expect(hits).toBe(1);clickCanvas(canvas,165,10);expect(hits).toBe(2);width.set(300);await nextFrame();clickCanvas(canvas,165,10);expect(hits).toBe(2);clickCanvas(canvas,255,10);expect(hits).toBe(3);direction.set('ltr');await nextFrame();clickCanvas(canvas,255,10);expect(hits).toBe(3);clickCanvas(canvas,35,10);expect(hits).toBe(4);expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(before.nodeCreates);
 const painted=snapshotWasmLayoutDiagnostics();fill.set('blue');await nextFrame();expect(snapshotWasmLayoutDiagnostics().solves).toBe(painted.solves);controller.dispose();const disposed=snapshotWasmLayoutDiagnostics();expect([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements]).toEqual([baseline.activeNodes,baseline.activeArenas,baseline.cachedMeasurements]);
});

it.runIf(experimentalLayout)('measures a numeric logical padding winner over a physical percentage',()=>{
 const root=createElement(Flex,{style:{height:30},children:createElement(Rectangle,{style:{width:40,height:20,minWidth:0,minHeight:0,flexShrink:0,padding:{left:'10%'},paddingStart:0}})});
 expect(measureElement(root,{minWidth:0,maxWidth:200,minHeight:0,maxHeight:60},service)).toEqual({status:'measured',size:{width:40,height:30}});
});
it.runIf(experimentalLayout)('uses explicit nested LTR direction when canonicalizing logical percentage padding',async()=>{
 let hits=0;const canvas=document.createElement('canvas');canvas.width=200;canvas.height=100;document.body.append(canvas);
 const controller=pibbl(canvas,createElement(Flex,{style:{width:200,height:100,layoutDirection:'rtl'},children:createElement(Flex,{style:{width:100,height:60,boxSizing:'border-box',layoutDirection:'ltr',minWidth:0,minHeight:0,flexShrink:0,padding:{left:8,right:20,top:5,bottom:5},paddingStart:'15%'},children:createElement(Rectangle,{style:{width:10,height:10,minWidth:0,minHeight:0,flexShrink:0,fill:'red'},onClick:()=>hits++})})}));controllers.push(controller);await nextFrame();clickCanvas(canvas,113,8);expect(hits).toBe(0);clickCanvas(canvas,133,8);expect(hits).toBe(1);
});
for(const property of ['paddingStart','paddingEnd'] as const)for(const value of [-1,'-5%',NaN,Infinity,'auto','bad%']){
 it.runIf(experimentalLayout)(`rejects invalid logical padding ${property}=${value}`,()=>{const style={width:40,height:20,minWidth:0,minHeight:0,flexShrink:0,[property]:value};const child=createElement(Rectangle,{style:style as RectStyle});expect(()=>layoutFlex({x:0,y:0,width:200,height:100},[child],{},measurement)).toThrow(/padding/);});
}
for(const Root of [Flex,Flow,Grid,Text])it(`keeps unallocated logical percentage padding unsupported for ${Root.name}`,()=>{
 const element=createElement(Root as typeof Flex,{style:{width:100,height:80,paddingStart:'15%',...(Root===Grid?{gridTemplateColumns:[100],gridTemplateRows:[80]}:{})},children:Root===Text?'text':[]});expect(measureElement(element,{minWidth:0,maxWidth:200,minHeight:0,maxHeight:180},service)).toMatchObject({status:'unsupported',reason:expect.stringContaining('percentage padding')});
});
it.skipIf(experimentalLayout)('rejects logical padding in ordinary box layout',()=>{
 for(const edge of [{paddingStart:0},{paddingEnd:10}]){const child=createElement(Rectangle,{style:{width:40,height:20,minWidth:0,...edge}});expect(()=>layoutFlex({x:0,y:0,width:200,height:100},[child],{},measurement)).toThrow(/logical padding/);}
});

for(const active of [false,true])it.runIf(experimentalLayout)(`admits winning logical padding under isolated RTL measurement active=${active}`,()=>{
 const root=createElement(Flex,{style:{height:30,layoutDirection:'rtl'},children:createElement(Rectangle,{style:{width:40,height:20,minWidth:0,minHeight:0,flexShrink:0,padding:active?{left:'10%'}:{right:'10%'},paddingStart:0}})});
 const result=measureElement(root,{minWidth:0,maxWidth:200,minHeight:0,maxHeight:60},service);if(active)expect(result).toMatchObject({status:'unsupported',reason:expect.stringContaining('percentage padding')});else expect(result).toEqual({status:'measured',size:{width:40,height:30}});
});
