import { Flex, Flow, Grid, Rectangle, crc, signal, type CRCNode, type CRCController } from '@crc/core';
import { afterEach, describe, expect, it } from 'vitest';
import { installSchedulerDriverForTest, ManualSchedulerDriver } from '../src/lib/scheduler/testing';

let controller: CRCController | undefined;
let restore: (() => void) | undefined;
afterEach(() => { controller?.dispose(); restore?.(); document.body.replaceChildren(); });

function mount(node: CRCNode) {
  const driver = new ManualSchedulerDriver(); restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 100; document.body.append(canvas);
  controller = crc(canvas, node, { pixelRatio: 1 }); return () => driver.flush(1);
}

describe('ignored layout positioning', () => {
  it.each([
    ['Flow', <Flow><Rectangle style={{ left: 0, top: 1, width: 10, height: 10 }} /></Flow>],
    ['Flex', <Flex><Rectangle style={{ left: 0, width: 10, height: 10, minWidth: 0 }} /></Flex>],
    ['Grid', <Grid style={{ gridTemplateColumns: [200], gridTemplateRows: [100] }}><Rectangle style={{ top: 0, width: 10, height: 10 }} /></Grid>],
  ] as const)('rejects explicit offsets in %s', (name, node) => {
    expect(mount(node)).toThrow(new RegExp(`CRC_LAYOUT_IGNORED_POSITION.*${name}`));
  });
  it('permits omitted and undefined offsets, but catches resolved signal offsets', () => {
    expect(mount(<Flow><Rectangle style={{ left: undefined, width: 10, height: 10 }} /></Flow>)).not.toThrow();
    const left = signal(0);
    expect(mount(<Flow><Rectangle style={{ left, width: 10, height: 10 }} /></Flow>)).toThrow('CRC_LAYOUT_IGNORED_POSITION');
  });
});
