import {
  Flex,
  Flow,
  Grid,
  ManipulationFrame,
  Rectangle,
  ResizeHandles,
  pibbl,
  signal,
  useConst,
  useLayoutBox,
  useManipulation,
  type BoxStyle,
  type PibblController,
  type PibblNode,
  type FlexItemStyle,
  type GridItemStyle,
} from '@pibbl/core';
import { afterEach, describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';

type ItemStyle = BoxStyle & FlexItemStyle & GridItemStyle;
type LayoutKind = 'flex' | 'flow' | 'grid';
type ItemReport = { readonly identity: number; readonly box: Readonly<{ x: number; y: number; width: number; height: number }> };

let controller: PibblController | undefined;
let nextIdentity = 0;

afterEach(async () => {
  controller?.dispose();
  controller = undefined;
  await settle();
  document.body.replaceChildren();
});

function Item({ id, reports }: { id: string; reports: Map<string, ItemReport>; style: ItemStyle }): PibblNode {
  const identity = useConst(() => ++nextIdentity);
  const box = useLayoutBox();
  reports.set(id, { identity, box: { ...box } });
  return <Rectangle style={{ width: box.width, height: box.height, fill: id === 'first' ? '#dc2626' : '#16a34a' }} />;
}

function FrameContent({ kind, reports }: { kind: LayoutKind; reports: Map<string, ItemReport> }): PibblNode {
  if (kind === 'flex') {
    return <Flex style={{ flexDirection: 'column' }}>
      <Item key="first" id="first" reports={reports} style={{ width: 100, height: 0, minHeight: 0, flexGrow: 1 }} />
      <Item key="second" id="second" reports={reports} style={{ width: 100, height: 0, minHeight: 0, flexGrow: 1 }} />
    </Flex>;
  }
  if (kind === 'flow') {
    return <Flow style={{ direction: 'horizontal', wrap: true }}>
      <Item key="first" id="first" reports={reports} style={{ width: 60, height: 20 }} />
      <Item key="second" id="second" reports={reports} style={{ width: 60, height: 20 }} />
    </Flow>;
  }
  return <Grid style={{ gridTemplateColumns: [40, '1fr'], gridTemplateRows: ['1fr'] }}>
    <Item key="first" id="first" reports={reports} style={{ gridColumnStart: 1, gridRowStart: 1 }} />
    <Item key="second" id="second" reports={reports} style={{ gridColumnStart: 2, gridRowStart: 1 }} />
  </Grid>;
}

function Scene({ kind, box, reports }: { kind: LayoutKind; box: ReturnType<typeof signal<{ left: number; top: number; width: number; height: number }>>; reports: Map<string, ItemReport> }): PibblNode {
  const manipulation = useManipulation({ box, resize: {} });
  return <ManipulationFrame {...manipulation.frameProps}>
    <FrameContent kind={kind} reports={reports} />
    <ResizeHandles controller={manipulation} />
  </ManipulationFrame>;
}

async function mount(kind: LayoutKind) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 200;
  canvas.dataset.manipulationTest = '';
  document.body.append(canvas);
  const box = signal({ left: 32, top: 40, width: 100, height: 80 });
  const reports = new Map<string, ItemReport>();
  controller = pibbl(canvas, <Scene kind={kind} box={box} reports={reports} />, { pixelRatio: 1 });
  await settle();
  return { canvas, box, reports };
}

async function resizeBottomRight(_canvas: HTMLCanvasElement): Promise<void> {
  await commands.manipulationPointer([
    { type: 'move', x: 132, y: 120 },
    { type: 'down' },
    { type: 'move', x: 182, y: 150 },
    { type: 'up' },
  ]);
  await settle();
}

function settle(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function paintedBounds(canvas: HTMLCanvasElement, color: readonly [number, number, number]) {
  const image = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  let left = canvas.width;
  let top = canvas.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const offset = (y * canvas.width + x) * 4;
      if (image.data[offset] !== color[0] || image.data[offset + 1] !== color[1] || image.data[offset + 2] !== color[2] || image.data[offset + 3] !== 255) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return { left, top, right, bottom };
}

describe('manipulation frame layout', () => {
  it('reallocates a Flex column on native handle resize without remounting keyed children', async () => {
    const { canvas, box, reports } = await mount('flex');
    const before = new Map(reports);
    expect(before.get('first')?.box).toMatchObject({ height: 40 });
    expect(before.get('second')?.box).toMatchObject({ height: 40 });
    expect(paintedBounds(canvas, [22, 163, 74])).toMatchObject({ top: 80, bottom: 119 });

    await resizeBottomRight(canvas);

    expect(box.get()).toEqual({ left: 32, top: 40, width: 150, height: 110 });
    expect(reports.get('first')?.box).toMatchObject({ height: 55 });
    expect(reports.get('second')?.box).toMatchObject({ height: 55 });
    expect(paintedBounds(canvas, [22, 163, 74])).toMatchObject({ top: 95, bottom: 149 });
    expect(reports.get('first')?.identity).toBe(before.get('first')?.identity);
    expect(reports.get('second')?.identity).toBe(before.get('second')?.identity);
  });

  it('reflows a wrapping Flow while keyed children and frame handles stay outside its item sequence', async () => {
    const { canvas, reports } = await mount('flow');
    const before = new Map(reports);
    expect(before.get('first')?.box).toMatchObject({ width: 60, height: 20 });
    expect(before.get('second')?.box).toMatchObject({ width: 60, height: 20 });
    expect(paintedBounds(canvas, [22, 163, 74])).toMatchObject({ left: 32, top: 60, right: 91, bottom: 79 });

    await resizeBottomRight(canvas);

    expect(reports.get('first')?.box).toMatchObject({ width: 60, height: 20 });
    expect(reports.get('second')?.box).toMatchObject({ width: 60, height: 20 });
    expect(paintedBounds(canvas, [22, 163, 74])).toMatchObject({ left: 92, top: 40, right: 151, bottom: 59 });
    expect(reports.get('first')?.identity).toBe(before.get('first')?.identity);
    expect(reports.get('second')?.identity).toBe(before.get('second')?.identity);
  });

  it('resizes fractional Grid tracks while preserving fixed tracks, keyed state, and handle isolation', async () => {
    const { canvas, reports } = await mount('grid');
    const before = new Map(reports);
    expect(before.get('first')?.box).toMatchObject({ x: 0, width: 40, height: 80 });
    expect(before.get('second')?.box).toMatchObject({ x: 0, width: 60, height: 80 });
    expect(paintedBounds(canvas, [22, 163, 74])).toMatchObject({ left: 72, top: 40, right: 131, bottom: 119 });

    await resizeBottomRight(canvas);

    expect(reports.get('first')?.box).toMatchObject({ x: 0, width: 40, height: 110 });
    expect(reports.get('second')?.box).toMatchObject({ x: 0, width: 110, height: 110 });
    expect(paintedBounds(canvas, [22, 163, 74])).toMatchObject({ left: 72, top: 40, right: 181, bottom: 149 });
    expect(reports.get('first')?.identity).toBe(before.get('first')?.identity);
    expect(reports.get('second')?.identity).toBe(before.get('second')?.identity);
  });
});
