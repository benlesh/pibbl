import yogaReference from '../../../tooling/layout-yoga-rehearsal/reference.json';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createElement, Flex, Text, Rectangle, measureElement, useLayoutBox, Layer, signal, computed, type PibblNode } from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { WasmFlexTextExample as mountWasmFlexTextComponent } from "../../scenarios/src/learning/layout/wasm-flex-text.example";
import { snapshotWasmLayoutDiagnostics, experimentalLayout } from '../src/lib/layout/wasm/region';
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

it.runIf(experimentalLayout)('releases numeric records when a mounted Flex becomes empty', async () => {
  const { signal } = await import('@pibbl/core');
  const { pibblSync: pibbl } = await import('@pibbl/core/sync');
  const { Flex } = await import('@pibbl/core');
  const show = signal(true);
  const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 100;
  document.body.append(canvas);
  const baseline = snapshotWasmLayoutDiagnostics().activeNodes;
  function Scene() { return <Flex style={{ width: 200, height: 100 }}>{show.get() ? <Rectangle style={{ width: 50, height: 20, minWidth: 0 }} /> : null}</Flex>; }
  const controller = pibbl(canvas, <Scene />); controllers.push(controller);
  await nextFrame();
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline + 1);
  show.set(false);
  await nextFrame();
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline);
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

it.runIf(experimentalLayout)('rehearses five pinned Yoga cases through the public Pibbl example', async () => {
  const mountModule = await import('../../scenarios/src/learning/layout/wasm-yoga-migration.example');
const mount = createExampleMount(mountModule.WasmYogaMigrationExample);
  const baseline = snapshotWasmLayoutDiagnostics();
  const canvas = document.createElement('canvas'); canvas.width = 760; canvas.height = 460;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d')!, draw = ctx.fillText;
  const labels: { text: string; x: number; y: number }[] = [];
  vi.spyOn(ctx,'fillText').mockImplementation(function(this: CanvasRenderingContext2D,text,x,y,maxWidth) {
    labels.push({ text, x: ctx.getTransform().e+x, y: ctx.getTransform().f+y });
    draw.call(this,text,x,y,maxWidth);
  });
  const controller = mount(canvas); controllers.push(controller); await nextFrame();
  for (const [index, fixture] of yogaReference.cases.entries()) {
    if (index) { labels.length = 0; clickCanvas(canvas,60,158); await nextFrame(); }
    if (fixture.name.startsWith('rectangle-')) {
      const padded = fixture.name === 'rectangle-percent-content-box';
      const children = [0, 1].map(index => createElement(Rectangle, { style: {
        width: 80, height: 80, flexShrink: 1,
        flexBasis: padded ? '70%' : 'auto', padding: padded ? 10 : 0,
        minWidth: padded && index === 0 ? 90 : undefined,
      } }));
      expect(layoutFlex({ x: 0, y: 0, width: fixture.width, height: 100 }, children, { alignItems: 'flex-start' }, measurement)).toEqual(fixture.boxes);
      for (const [index, box] of fixture.boxes.entries()) {
        expect([...ctx.getImageData(392 + box.x + 1, 241, 1, 1).data]).toEqual(index === 0 ? [214, 227, 219, 255] : [225, 219, 202, 255]);
        clickCanvas(canvas, 392 + box.x + 2, 242);
        await expect.poll(() => canvas.nextElementSibling?.textContent).toContain(`selected: ${index === 0 ? 'A' : 'B'}`);
      }
    } else {
      for (const box of fixture.boxes) {
        expect(labels.some(label => label.text === `${box.width} px` && label.x === 392+box.x+12 && label.y === 240+box.y+38)).toBe(true);
      }
    }
    expect(fixture.boxes.reduce((sum,box) => sum+box.width,fixture.name.startsWith('rectangle-') ? 0 : 12)).toBe(fixture.width);
  }
  const beforePaint = snapshotWasmLayoutDiagnostics();
  clickCanvas(canvas,300,158); await nextFrame();
  expect(snapshotWasmLayoutDiagnostics().solves).toBe(beforePaint.solves);
  controller.dispose();
  expect(snapshotWasmLayoutDiagnostics().activeNodes).toBe(baseline.activeNodes);
  expect(snapshotWasmLayoutDiagnostics().activeArenas).toBe(baseline.activeArenas);
});

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
  for (const margin of [NaN, Infinity, '10%', 'auto', null]) {
    const invalid = createElement(Rectangle, { style: { width: 20, height: 20, minWidth: 0, margin } as any });
    expect(() => layoutFlex({ x: 0, y: 0, width: 100, height: 30 }, [invalid], {}, measurement)).toThrow(/margin.*finite number/);
  }
});

it.runIf(experimentalLayout)('rejects physical margins under other layout families rather than ignoring them', async () => {
  const { prepareDirectChildStyle } = await import('../src/lib/layout/absolute');
  const child = createElement(Rectangle, { style: { width: 20, height: 20, marginLeft: 5 } });
  expect(() => prepareDirectChildStyle(child)).toThrow(/margins.*experimental Flex/);
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
