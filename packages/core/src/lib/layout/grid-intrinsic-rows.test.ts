import { beforeAll, describe, expect, it } from 'vitest';
import { Rectangle } from '../components/rect';
import { Text } from '../components/text';
import { fitContent } from '../style/sizing-length';
import { Flex } from './flex';
import { autoFillTracks, autoFitTracks, Grid, layoutGrid, minmax, repeatTracks, type GridTrack } from './grid';
import { measureElement, measureIntrinsicElement } from './measure';
import { createElement } from '../element/create-element';
import { prepareLayoutEngineSync } from './wasm/embedded';
import { snapshotWasmLayoutDiagnostics } from './wasm/region';

beforeAll(() => prepareLayoutEngineSync());
const service = { measureText: (value: string) => ({ width: value.length * 10 }) as TextMetrics };
function child(style: Record<string, unknown>) {
  return createElement(Rectangle, { style: { width: 'auto', height: 'auto', gridColumnStart: 1, gridRowStart: 1, ...style } });
}

describe('Grid intrinsic row allocation boundaries', () => {
  it('rejects allocation-dependent intrinsic rows even when width is selected', () => {
    const tracks: readonly GridTrack[] = [
      '1fr', '50%', minmax({ min: 10, max: '1fr' }),
      minmax({ min: '25%', max: 'auto' }),
      repeatTracks(['1fr'], { count: 2 }),
      repeatTracks(['50%'], { count: 2 }),
      autoFillTracks(10), autoFitTracks(10), fitContent('50%'),
    ];
    const before = snapshotWasmLayoutDiagnostics();
    for (const track of tracks) for (const maxHeight of [100, 200]) for (const height of [undefined, 'auto'] as const) {
      const constraints = { minWidth: 0, maxWidth: 100, minHeight: 0, maxHeight };
      const grid = createElement(Grid, {
        style: { width: 100, height, gridTemplateColumns: ['1fr'], gridTemplateRows: [track], minHeight: 0, flexShrink: 0 },
        children: [],
      });
      expect(measureElement(grid, constraints, service)).toMatchObject({ status: 'unsupported' });
      expect(measureIntrinsicElement(grid, constraints, service)).toMatchObject({ status: 'unsupported' });
      const column = createElement(Flex, {
        style: { width: 100, flexDirection: 'column' }, children: grid,
      });
      expect(measureElement(column, constraints, service)).toMatchObject({ status: 'unsupported' });
    }
    const after = snapshotWasmLayoutDiagnostics();
    expect([after.activeArenas, after.activeGridArenas, after.activeNodes, after.activeWasmInstances]).toEqual(
      [before.activeArenas, before.activeGridArenas, before.activeNodes, before.activeWasmInstances],
    );
  });

  it('rejects allocation-dependent implicit rows only when normal-flow children need them', () => {
    const before = snapshotWasmLayoutDiagnostics();
    for (const gridAutoRows of ['1fr', '50%', minmax({ min: 0, max: '1fr' })] as const) {
      const style = { width: 100, gridTemplateColumns: ['1fr'], gridTemplateRows: [10], gridAutoRows } as const;
      for (const maxHeight of [100, 200]) {
        const constraints = { minWidth: 0, maxWidth: 100, minHeight: 0, maxHeight };
        const overflow = createElement(Grid, { style, children: [child({}), child({ gridRowStart: 2 })] });
        expect(measureElement(overflow, constraints, service)).toMatchObject({ status: 'unsupported' });
        expect(measureIntrinsicElement(overflow, constraints, service)).toMatchObject({ status: 'unsupported' });
        const explicit = createElement(Grid, { style, children: child({}) });
        expect(measureElement(explicit, constraints, service)).toEqual({ status: 'measured', size: { width: 100, height: 10 } });
        const absolute = createElement(Grid, { style, children: child({ position: 'absolute', gridRowStart: 2, width: 5, height: 5 }) });
        expect(measureElement(absolute, constraints, service)).toEqual({ status: 'measured', size: { width: 100, height: 10 } });
      }
    }
    const after = snapshotWasmLayoutDiagnostics();
    expect([after.activeArenas, after.activeGridArenas, after.activeNodes, after.activeWasmInstances]).toEqual(
      [before.activeArenas, before.activeGridArenas, before.activeNodes, before.activeWasmInstances],
    );
  });

  it('keeps selected-width fixed and automatic rows intrinsic and definite-height fractions allocated', () => {
    for (const maxHeight of [100, 200]) {
      const constraints = { minWidth: 0, maxWidth: 100, minHeight: 0, maxHeight };
      for (const [row, height] of [[20, 20], ['auto', 0]] as const) {
        const grid = createElement(Grid, { style: { width: 100, gridTemplateColumns: ['1fr'], gridTemplateRows: [row] }, children: [] });
        expect(measureElement(grid, constraints, service)).toEqual({ status: 'measured', size: { width: 100, height } });
      }
      const definite = createElement(Grid, { style: { width: 100, height: 60, gridTemplateColumns: ['1fr'], gridTemplateRows: ['1fr'] }, children: [] });
      expect(measureElement(definite, constraints, service)).toEqual({ status: 'measured', size: { width: 100, height: 60 } });
      expect(measureIntrinsicElement(definite, constraints, service)).toMatchObject({ status: 'measured', minContent: { width: 100, height: 60 }, maxContent: { width: 100, height: 60 } });
      const fixed = createElement(Grid, { style: { width: 100, height: 60, gridTemplateColumns: ['1fr'], gridTemplateRows: [10] }, children: [] });
      expect(measureIntrinsicElement(fixed, constraints, service)).toMatchObject({ status: 'measured', minContent: { width: 100, height: 10 }, maxContent: { width: 100, height: 10 } });
      const percentage = createElement(Grid, { style: { width: 100, height: '50%', gridTemplateColumns: ['1fr'], gridTemplateRows: ['1fr'] }, children: [] });
      expect(measureIntrinsicElement(percentage, constraints, service)).toMatchObject({ status: 'unsupported' });
      const wrapped = createElement(Grid, { style: { width: 40, gridTemplateColumns: ['1fr'], gridTemplateRows: ['auto'] }, children: createElement(Text, { children: 'aa bb', style: { wrap: true, lineHeight: 10 } }) });
      expect(measureElement(wrapped, constraints, service)).toEqual({ status: 'measured', size: { width: 40, height: 20 } });
      expect(layoutGrid({ x: 0, y: 0, width: 100, height: 60 }, [child({ width: '100%', height: '100%' })], { gridTemplateColumns: ['1fr'], gridTemplateRows: ['1fr'] }, { service, measureElement: (element, limits) => measureElement(element, limits, service) })).toEqual([{ x: 0, y: 0, width: 100, height: 60 }]);
    }
  });

});
