import { beforeAll, expect, it } from 'vitest';
import { Absolute, Flex, Grid, Group, Layer, Rectangle, Text, autoFitTracks, createElement, definePrimitive, measureElement, minmax, pibbl, signal, type SystemStyle } from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
import { layoutGrid } from '../src/lib/layout/grid.js';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded.js';
import { snapshotLayoutTopology } from '../src/lib/layout/topology.js';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing.js';
beforeAll(prepareLayoutEngineSync);
const service = { measureText: (text: string) => ({ width: text.length * 6, actualBoundingBoxLeft: 0, actualBoundingBoxRight: text.length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }) as TextMetrics };
const measurement = { service, measureElement: (element: Parameters<typeof measureElement>[0], constraints: Parameters<typeof measureElement>[1]) => measureElement(element, constraints, service) };
const owner = { x: 0, y: 0, width: 100, height: 100 };
it('renders empty and mixed auto-fit templates and measures intrinsic maxima', () => {
  expect(layoutGrid(owner, [], { gridTemplateColumns: [autoFitTracks(20)], gridTemplateRows: [20] }, measurement)).toEqual([]);
  const children = [0, 1].map(() => createElement(Rectangle, { style: { width: 'auto', height: 20 } }));
  expect(layoutGrid(owner, children, { gridTemplateColumns: [20, autoFitTracks(minmax({ min: 20, max: '1fr' }))], gridTemplateRows: [20] }, measurement).map(box => box.width)).toEqual([20, 80]);
  const text = createElement(Text, { children: 'abcdefghij', style: { font: '10px monospace', height: 20, width: 'auto' } });
  expect(layoutGrid(owner, [text], { gridTemplateColumns: [minmax({ min: 0, max: 'max-content' })], gridTemplateRows: [20] }, measurement)[0]!.width).toBe(60);
});
it('measures bounded fractional Grid columns using the native selected width', () => {
  const text = createElement(Text, { children: 'aa bb cc dd ee ff gg hh ii jj', style: { font: '10px monospace', lineHeight: 10, wrap: true, height: 'auto', width: 'auto' } });
  const measure = (track: import('@pibbl/core').GridTrack) => measureElement(createElement(Grid, { style: { width: 100, height: 'auto', gridTemplateColumns: [track], gridTemplateRows: ['auto'] }, children: text }), { minWidth: 0, maxWidth: 100, minHeight: 0, maxHeight: 1000 }, service);
  expect(measure(minmax({ min: 0, max: '1fr' }))).toEqual(measure('1fr'));
});
it.each(['sync', 'async'] as const)('shrinks intrinsic Grid rows after an update (%s startup)', async startup => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const height = signal(100), canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 200;
  const Leaf = definePrimitive<{}, SystemStyle & { width: number; height: number }>((_props, style, context) => { context.fillStyle = 'red'; context.fillRect(0, 0, style.width, style.height); }, { measure: ({ style }) => ({ status: 'measured', size: { width: style.width, height: style.height } }) });
  function App() { return createElement(Grid, { style: { width: 300, height: 200, gridTemplateColumns: [300], gridTemplateRows: ['auto', 10] }, children: [createElement(Leaf, { style: { width: 300, height: height.get() } }), createElement(Rectangle, { style: { width: 300, height: 10, fill: 'blue' } })] }); }
  document.body.append(canvas);
  const root = createElement(App, {}), controller = startup === 'sync' ? pibblSync(canvas, root) : await pibbl(canvas, root);
  try { driver.flush(1); height.set(20); driver.flush(2); expect([...canvas.getContext('2d')!.getImageData(5, 25, 1, 1).data]).toEqual([0, 0, 255, 255]); }
  finally { controller.dispose(); restore(); canvas.remove(); }
});
it('releases adopted topology when a subtree is removed from a live root', () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver), shown = signal(true), canvas = document.createElement('canvas');
  const before = snapshotLayoutTopology();
  function App() { return createElement(Absolute, { style: { width: 100, height: 40 }, children: shown.get() ? createElement(Flex, { style: { width: 100, height: 40 }, children: [] }) : null }); }
  document.body.append(canvas);
  const controller = pibblSync(canvas, createElement(App, {}));
  try { for (let frame = 1; frame <= 6; frame++) { shown.set(frame % 2 === 1); driver.flush(frame); if (frame % 2 === 0) expect(snapshotLayoutTopology()).toMatchObject(before); } }
  finally { controller.dispose(); restore(); canvas.remove(); }
});
it('does not invoke a hidden Layer child when its signal changes, then refreshes on reveal', () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver), participation = signal<'normal' | 'hidden'>('normal'), value = signal(0), canvas = document.createElement('canvas');
  let renders = 0;
  function Child() { value.get(); renders++; return createElement(Rectangle, { style: { width: 20, height: 20 } }); }
  document.body.append(canvas);
  const controller = pibblSync(canvas, createElement(Group, { style: { layoutParticipation: participation }, children: createElement(Layer, { style: { width: 100, height: 40 }, children: createElement(Child, {}) }) }));
  try { driver.flush(1); participation.set('hidden'); driver.flush(2); const before = renders; value.set(1); driver.flush(3); expect(renders).toBe(before); participation.set('normal'); driver.flush(4); expect(renders).toBe(before + 1); }
  finally { controller.dispose(); restore(); canvas.remove(); }
});
