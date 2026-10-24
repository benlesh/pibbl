import { afterEach, beforeAll, expect, it } from 'vitest';
import { Flex, Rectangle, measureElement, signal, type RectStyle, type PibblController } from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { experimentalLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';

const controllers: PibblController[] = [];
beforeAll(() => { if (experimentalLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

for (const axis of ['row', 'column'] as const) for (const mode of ['start', 'both'] as const) {
  it.runIf(experimentalLayout)(`treats ${axis} ${mode} auto main margins as zero for pure contribution, then allocates final free space`, async () => {
    const row = axis === 'row';
    const minimum = 200;
    const firstStyle: RectStyle = row ? {
      width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0,
      marginLeft: 'auto', ...(mode === 'both' ? { marginRight: 'auto' } : {}),
    } : {
      width: 20, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0,
      marginTop: 'auto', ...(mode === 'both' ? { marginBottom: 'auto' } : {}),
    };
    const secondStyle: RectStyle = row ? {
      width: 80, height: 20, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0,
    } : {
      width: 20, height: 80, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0,
    };
    const owner = <Flex style={{
      width: row ? 'auto' : 20, height: row ? 20 : 'auto',
      minWidth: row ? minimum : 0, minHeight: row ? 0 : minimum,
      flexDirection: axis, flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0,
    }}>
      <Rectangle style={firstStyle} />
      <Rectangle style={secondStyle} />
    </Flex>;
    expect(measureElement(owner, {
      minWidth: row ? 0 : 20, maxWidth: row ? Number.POSITIVE_INFINITY : 20,
      minHeight: row ? 20 : 0, maxHeight: row ? 20 : Number.POSITIVE_INFINITY,
    }, { measureText: () => { throw new Error('No text.'); } })).toEqual({
      status: 'measured', size: row ? { width: 120, height: 20 } : { width: 20, height: 120 },
    });

    const baseline = snapshotWasmLayoutDiagnostics();
    let hits = 0;
    const mounted = <Flex style={{ width: row ? 200 : 20, height: row ? 20 : 200, flexDirection: axis, alignItems: 'flex-start' }}>
      <Flex style={{ width: row ? 'auto' : 20, height: row ? 20 : 'auto', minWidth: row ? minimum : 0, minHeight: row ? 0 : minimum, flexDirection: axis, flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0 }}>
        <Rectangle key="A" onClick={() => { hits++; }} style={{ ...firstStyle, fill: "#8a3248" }} />
        <Rectangle key="B" style={{ ...secondStyle, fill: "#426b61" }} />
      </Flex>
    </Flex>;
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240; document.body.append(canvas);
    const controller = pibbl(canvas, mounted); controllers.push(controller); await frame();
    const mainA = mode === 'start' ? 80 : 40;
    const pixel = (main: number) => [...canvas.getContext('2d')!.getImageData(row ? main : 4, row ? 4 : main, 1, 1).data];
    expect(pixel(mainA - 1)).toEqual([0, 0, 0, 0]);
    expect(pixel(mainA)).toEqual([138, 50, 72, 255]);
    expect(pixel(mainA + 39)).toEqual([138, 50, 72, 255]);
    expect(pixel(120)).toEqual([66, 107, 97, 255]);
    expect(pixel(199)).toEqual([66, 107, 97, 255]);
    expect(pixel(200)).toEqual([0, 0, 0, 0]);
    const initial = snapshotWasmLayoutDiagnostics();
    const point = row ? { x: mainA + 4, y: 4 } : { x: 4, y: mainA + 4 };
    const rect = canvas.getBoundingClientRect();
    for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: rect.left + point.x, clientY: rect.top + point.y })); await frame();
    expect(hits).toBe(1);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
    expect(initial.nodeCreates).toBeGreaterThanOrEqual(baseline.nodeCreates + 2);
  });
}


it.runIf(experimentalLayout)('keeps automatic physical main margins out of pure size, across finite and unbounded availability', () => {
  for (const axis of ['row', 'column'] as const) for (const maximum of [200, Number.POSITIVE_INFINITY]) {
    const row = axis === 'row';
    const owner = <Flex style={{
      width: row ? 'auto' : 20, height: row ? 20 : 'auto',
      maxWidth: row ? 160 : undefined, maxHeight: row ? undefined : 160,
      flexDirection: axis, flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start',
    }}>
      <Rectangle style={row ? { width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, marginLeft: 'auto' } : { width: 20, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, marginTop: 'auto' }} />
      <Rectangle style={row ? { width: 80, height: 20, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0 } : { width: 20, height: 80, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0 }} />
    </Flex>;
    expect(measureElement(owner, {
      minWidth: row ? 0 : 20, maxWidth: row ? maximum : 20,
      minHeight: row ? 20 : 0, maxHeight: row ? 20 : maximum,
    }, { measureText: () => { throw new Error('No text.'); } })).toEqual({
      status: 'measured', size: row ? { width: 120, height: 20 } : { width: 20, height: 120 },
    });
  }
  const crossAuto = <Flex style={{ width: 'auto', height: 20, flexDirection: 'row', flexWrap: 'nowrap', layoutDirection: 'ltr' }}>
    <Rectangle style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, marginTop: 'auto', marginStart: 0 }} />
  </Flex>;
  expect(measureElement(crossAuto, { minWidth: 0, maxWidth: Number.POSITIVE_INFINITY, minHeight: 20, maxHeight: 20 }, { measureText: () => { throw new Error('No text.'); } }))
    .toEqual({ status: 'unsupported', reason: expect.stringMatching(/automatic physical margin/i) });
});

it.runIf(experimentalLayout)('reuses direct automatic-margin targets while an owner minimum changes final free space', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const minimum = signal(200), hits: string[] = [];
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 80; document.body.append(canvas);
  const controller = pibbl(canvas, <Flex style={{ width: 200, height: 20, alignItems: 'flex-start' }}>
    <Flex style={{ width: 'auto', height: 20, minWidth: minimum, flexDirection: 'row', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0 }}>
      <Rectangle key="A" onClick={() => { hits.push('A'); }} style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, marginLeft: 'auto', fill: '#8a3248', cursor: 'pointer' }} />
      <Rectangle key="B" onClick={() => { hits.push('B'); }} style={{ width: 80, height: 20, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0, fill: '#426b61', cursor: 'pointer' }} />
    </Flex>
  </Flex>);
  controllers.push(controller); await frame();
  const pixel = (x: number) => [...canvas.getContext('2d')!.getImageData(x, 4, 1, 1).data];
  expect(pixel(79)).toEqual([0, 0, 0, 0]); expect(pixel(80)).toEqual([138, 50, 72, 255]); expect(pixel(120)).toEqual([66, 107, 97, 255]);
  for (const type of ['mousedown', 'mouseup', 'click']) { const rect = canvas.getBoundingClientRect(); canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: rect.left + 84, clientY: rect.top + 4 })); } await frame();
  expect(hits).toEqual(['A']);
  const mounted = snapshotWasmLayoutDiagnostics();
  minimum.set(120); await frame();
  expect(pixel(0)).toEqual([138, 50, 72, 255]); expect(pixel(40)).toEqual([66, 107, 97, 255]);
  for (const type of ['mousedown', 'mouseup', 'click']) { const rect = canvas.getBoundingClientRect(); canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: rect.left + 84, clientY: rect.top + 4 })); } await frame();
  expect(hits).toEqual(['A', 'B']);
  const moved = snapshotWasmLayoutDiagnostics();
  expect(moved.nodeCreates).toBe(mounted.nodeCreates);
  controller.dispose();
  const disposed = snapshotWasmLayoutDiagnostics();
  expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
    baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
  ]);
});

for (const axis of ['row', 'column'] as const) {
  it.runIf(experimentalLayout)(`treats a physical ${axis} cross auto margin as zero for pure size, then places it in the final cross owner`, async () => {
    const row = axis === 'row';
    const firstStyle: RectStyle = row
      ? { width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, marginTop: 'auto' }
      : { width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, marginLeft: 'auto' };
    const secondStyle: RectStyle = row
      ? { width: 80, height: 20, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0 }
      : { width: 20, height: 80, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0 };
    const owner = <Flex style={{
      width: row ? 'auto' : 200, height: row ? 200 : 'auto',
      flexDirection: axis, flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0,
    }}>
      <Rectangle style={firstStyle} />
      <Rectangle style={secondStyle} />
    </Flex>;
    expect(measureElement(owner, {
      minWidth: row ? 0 : 200, maxWidth: row ? Number.POSITIVE_INFINITY : 200,
      minHeight: row ? 200 : 0, maxHeight: row ? 200 : Number.POSITIVE_INFINITY,
    }, { measureText: () => { throw new Error('No text.'); } })).toEqual({
      status: 'measured', size: row ? { width: 120, height: 200 } : { width: 200, height: 120 },
    });

    const baseline = snapshotWasmLayoutDiagnostics();
    const cross = signal(200);
    let hits = 0;
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240; document.body.append(canvas);
    const controller = pibbl(canvas, row
      ? <Flex style={{ width: 120, height: cross, flexDirection: 'row', alignItems: 'flex-start' }}>
          <Flex style={{ width: 'auto', height: cross, minWidth: 0, minHeight: 0, flexDirection: 'row', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0 }}>
            <Rectangle key="A" onClick={() => { hits++; }} style={{ ...firstStyle, fill: '#8a3248', cursor: 'pointer' }} />
            <Rectangle key="B" style={{ ...secondStyle, fill: '#426b61' }} />
          </Flex>
        </Flex>
      : <Flex style={{ width: cross, height: 120, flexDirection: 'column', alignItems: 'flex-start' }}>
          <Flex style={{ width: cross, height: 'auto', minWidth: 0, minHeight: 0, flexDirection: 'column', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0 }}>
            <Rectangle key="A" onClick={() => { hits++; }} style={{ ...firstStyle, fill: '#8a3248', cursor: 'pointer' }} />
            <Rectangle key="B" style={{ ...secondStyle, fill: '#426b61' }} />
          </Flex>
        </Flex>,
    );
    controllers.push(controller); await frame();
    const pixel = (x: number, y: number) => [...canvas.getContext('2d')!.getImageData(x, y, 1, 1).data];
    const initialPoint = row ? { x: 4, y: 164 } : { x: 164, y: 4 };
    const movedPoint = row ? { x: 4, y: 124 } : { x: 124, y: 4 };
    const emptyPoint = row ? { x: 4, y: 156 } : { x: 156, y: 4 };
    expect(pixel(initialPoint.x, initialPoint.y)).toEqual([138, 50, 72, 255]);
    expect(pixel(emptyPoint.x, emptyPoint.y)).toEqual([0, 0, 0, 0]);
    const dispatch = (point: { x: number; y: number }) => {
      const rect = canvas.getBoundingClientRect();
      for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: rect.left + point.x, clientY: rect.top + point.y }));
    };
    dispatch(initialPoint); await frame(); expect(hits).toBe(1);
    const initial = snapshotWasmLayoutDiagnostics();
    cross.set(160); await frame();
    expect(pixel(initialPoint.x, initialPoint.y)).toEqual([0, 0, 0, 0]);
    expect(pixel(movedPoint.x, movedPoint.y)).toEqual([138, 50, 72, 255]);
    dispatch(initialPoint); await frame(); expect(hits).toBe(1);
    dispatch(movedPoint); await frame(); expect(hits).toBe(2);
    const moved = snapshotWasmLayoutDiagnostics();
    expect(moved.nodeCreates).toBe(initial.nodeCreates);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  });
}

for (const axis of ['row', 'column'] as const) for (const profile of [
  { name: 'both auto', cross: 200, expected: 80, margins: { before: 'auto' as const, after: 'auto' as const } },
  { name: 'overflow', cross: 20, expected: 0, margins: { before: 'auto' as const, after: undefined } },
  { name: 'numeric opposite', cross: 200, expected: 150, margins: { before: 'auto' as const, after: 10 } },
]) {
  it.runIf(experimentalLayout)(`keeps ${axis} ${profile.name} cross auto margins out of pure contribution and applies final cross placement`, async () => {
    const row = axis === 'row';
    const firstStyle: RectStyle = row ? {
      width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0,
      marginTop: profile.margins.before, marginBottom: profile.margins.after,
    } : {
      width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0,
      marginLeft: profile.margins.before, marginRight: profile.margins.after,
    };
    const secondStyle: RectStyle = row
      ? { width: 80, height: 20, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0 }
      : { width: 20, height: 80, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0 };
    const owner = <Flex style={{
      width: row ? 'auto' : profile.cross, height: row ? profile.cross : 'auto',
      flexDirection: axis, flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0,
    }}>
      <Rectangle style={firstStyle} />
      <Rectangle style={secondStyle} />
    </Flex>;
    expect(measureElement(owner, {
      minWidth: row ? 0 : profile.cross, maxWidth: row ? Number.POSITIVE_INFINITY : profile.cross,
      minHeight: row ? profile.cross : 0, maxHeight: row ? profile.cross : Number.POSITIVE_INFINITY,
    }, { measureText: () => { throw new Error('No text.'); } })).toEqual({
      status: 'measured', size: row ? { width: 120, height: profile.cross } : { width: profile.cross, height: 120 },
    });

    const baseline = snapshotWasmLayoutDiagnostics();
    let hits = 0;
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240; document.body.append(canvas);
    const controller = pibbl(canvas, row
      ? <Flex style={{ width: 120, height: profile.cross, flexDirection: 'row', alignItems: 'flex-start' }}>
          <Flex style={{ width: 'auto', height: profile.cross, minWidth: 0, flexDirection: 'row', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0 }}>
            <Rectangle key="A" onClick={() => { hits++; }} style={{ ...firstStyle, fill: '#8a3248', cursor: 'pointer' }} />
            <Rectangle key="B" style={{ ...secondStyle, fill: '#426b61' }} />
          </Flex>
        </Flex>
      : <Flex style={{ width: profile.cross, height: 120, flexDirection: 'column', alignItems: 'flex-start' }}>
          <Flex style={{ width: profile.cross, height: 'auto', minHeight: 0, flexDirection: 'column', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start', flexGrow: 0, flexShrink: 0 }}>
            <Rectangle key="A" onClick={() => { hits++; }} style={{ ...firstStyle, fill: '#8a3248', cursor: 'pointer' }} />
            <Rectangle key="B" style={{ ...secondStyle, fill: '#426b61' }} />
          </Flex>
        </Flex>,
    );
    controllers.push(controller); await frame();
    const point = row ? { x: 4, y: profile.expected + 4 } : { x: profile.expected + 4, y: 4 };
    const pixel = [...canvas.getContext('2d')!.getImageData(point.x, point.y, 1, 1).data];
    expect(pixel).toEqual([138, 50, 72, 255]);
    const rect = canvas.getBoundingClientRect();
    for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: rect.left + point.x, clientY: rect.top + point.y }));
    await frame(); expect(hits).toBe(1);
    const mounted = snapshotWasmLayoutDiagnostics();
    expect(mounted.nodeCreates).toBeGreaterThanOrEqual(baseline.nodeCreates + 2);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  });
}
