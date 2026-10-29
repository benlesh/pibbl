import { afterEach, beforeAll, expect, it } from 'vitest';
import { Flex, Rectangle, signal, useCanvasContext, useConst, useLayoutBox, type FlexItemStyle, type FlexStyle, type PibblController, type RectStyle } from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: PibblController[] = [];
beforeAll(() => { if (nativeLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: bounds.left + x, clientY: bounds.top + y }));
}

type ItemStyle = RectStyle & FlexItemStyle;
type Box = Readonly<{ x: number; y: number; width: number; height: number; stamp: number }>;
type Fixture = Readonly<{
  name: string;
  width: number;
  height: number;
  options?: Readonly<Partial<FlexStyle>>;
  items: readonly ItemStyle[];
  expected: readonly Omit<Box, 'stamp'>[];
  yoga?: readonly Omit<Box, 'stamp'>[];
  hit: readonly [number, number, string];
}>;

it.runIf(nativeLayout)('keeps signed margin allocation, overflow targets, and the classified wrapped cross policy observable through public Flex', async () => {
  const fixtures: readonly Fixture[] = [
    {
      name: 'opposing-negative', width: 120, height: 60,
      items: [
        { width: 40, height: 20, flexBasis: 40, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0, marginLeft: -30, marginRight: -30 },
        { width: 80, height: 20, flexBasis: 80, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0 },
      ],
      expected: [{ x: -30, y: 0, width: 40, height: 20 }, { x: -20, y: 0, width: 80, height: 20 }],
      hit: [-15, 5, 'B'],
    },
    {
      name: 'unshrinkable-overflow', width: 100, height: 60,
      items: [
        { width: 80, height: 20, flexBasis: 80, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0, marginLeft: -10, marginRight: -10 },
        { width: 80, height: 20, flexBasis: 80, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0 },
      ],
      expected: [{ x: -10, y: 0, width: 80, height: 20 }, { x: 60, y: 0, width: 80, height: 20 }],
      hit: [110, 5, 'B'],
    },
    {
      name: 'grow-max-negative', width: 200, height: 60,
      items: [
        { width: 100, height: 20, flexBasis: 100, flexGrow: 1, flexShrink: 1, minWidth: 0, minHeight: 0, maxWidth: 120, marginLeft: -20, marginRight: -10 },
        { width: 80, height: 20, flexBasis: 80, flexGrow: 1, flexShrink: 1, minWidth: 0, minHeight: 0 },
      ],
      expected: [{ x: -20, y: 0, width: 120, height: 20 }, { x: 90, y: 0, width: 110, height: 20 }],
      hit: [95, 5, 'B'],
    },
    {
      name: 'shrink-min-negative', width: 100, height: 60,
      items: [
        { width: 100, height: 20, flexBasis: 100, flexGrow: 0, flexShrink: 1, minWidth: 50, minHeight: 0, marginLeft: -10, marginRight: -10 },
        { width: 80, height: 20, flexBasis: 80, flexGrow: 0, flexShrink: 1, minWidth: 0, minHeight: 0 },
      ],
      expected: [{ x: -10, y: 0, width: 66.6666666667, height: 20 }, { x: 46.6666666667, y: 0, width: 53.3333333333, height: 20 }],
      hit: [50, 5, 'B'],
    },
    {
      name: 'wrapped-cross-center-classified', width: 100, height: 100,
      options: { flexWrap: 'wrap', alignItems: 'center', alignContent: 'flex-start' },
      items: [
        { width: 60, height: 40, flexBasis: 60, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0, marginTop: -20, marginBottom: -10 },
        { width: 40, height: 20, flexBasis: 40, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0 },
        { width: 60, height: 20, flexBasis: 60, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0 },
      ],
      // Pibbl centers the content box inside its signed-margin line. Yoga's
      // ErrataNone result is A.y=-10, retained separately as a classification.
      expected: [{ x: 0, y: -15, width: 60, height: 40 }, { x: 60, y: 0, width: 40, height: 20 }, { x: 0, y: 20, width: 60, height: 20 }],
      yoga: [{ x: 0, y: -10, width: 60, height: 40 }, { x: 60, y: 0, width: 40, height: 20 }, { x: 0, y: 20, width: 60, height: 20 }],
      hit: [5, 22, 'C'],
    },
  ];
  for (const fixture of fixtures) {
    const baseline = snapshotWasmLayoutDiagnostics();
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 220; document.body.append(canvas);
    const ink = signal('#8a3248'), hits: string[] = [], boxes = new Map<string, Box>(); let serial = 0;
    function Probe({ name, style: _style }: { readonly name: string; readonly style: ItemStyle }) {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      boxes.set(name, { x: matrix.e - 50, y: matrix.f - 50, width: box.width, height: box.height, stamp });
      return <Rectangle onClick={() => hits.push(name)} style={{ width: box.width, height: box.height, fill: ink, cursor: 'pointer' }} />;
    }
    const controller = pibbl(canvas, <Flex style={{ left: 50, top: 50, width: fixture.width, height: fixture.height, alignItems: 'flex-start', ...fixture.options }}>
      {fixture.items.map((style, index) => <Probe key={String(index)} name={String.fromCharCode(65 + index)} style={style} />)}
    </Flex>);
    controllers.push(controller); await frame();
    const actual = fixture.items.map((_, index) => boxes.get(String.fromCharCode(65 + index))!);
    for (let index = 0; index < fixture.expected.length; index++) {
      const box = actual[index]!, expected = fixture.expected[index]!;
      expect(Math.abs(box.x - expected.x), fixture.name + ' x').toBeLessThan(1e-4);
      expect(Math.abs(box.y - expected.y), fixture.name + ' y').toBeLessThan(1e-4);
      expect(Math.abs(box.width - expected.width), fixture.name + ' width').toBeLessThan(1e-4);
      expect(Math.abs(box.height - expected.height), fixture.name + ' height').toBeLessThan(1e-4);
    }
    if (fixture.yoga) expect(fixture.expected).not.toEqual(fixture.yoga);
    const stamps = actual.map(box => box.stamp), beforePaint = snapshotWasmLayoutDiagnostics();
    click(canvas, fixture.hit[0] + 50, fixture.hit[1] + 50); await frame();
    expect(hits).toEqual([fixture.hit[2]]);
    ink.set('#426b61'); await frame();
    expect(fixture.items.map((_, index) => boxes.get(String.fromCharCode(65 + index))!.stamp)).toEqual(stamps);
    const painted = snapshotWasmLayoutDiagnostics();
    expect(painted.solves).toBe(beforePaint.solves);
    expect(painted.nodeCreates).toBe(beforePaint.nodeCreates);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
  }
});
