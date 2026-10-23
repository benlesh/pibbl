import { Absolute, Flex, Flow, Grid, Overlay, Rectangle, signal, type PibblNode, type PibblController, type RectStyle } from "@pibbl/core";
import { pibblSync as pibbl } from "@pibbl/core/sync";
import { afterEach, describe, expect, it } from 'vitest';
import { installSchedulerDriverForTest, ManualSchedulerDriver } from '../src/lib/scheduler/testing';

let controller: PibblController | undefined;
let restore: (() => void) | undefined;
let driver: ManualSchedulerDriver | undefined;
afterEach(() => {
  controller?.dispose();
  if (driver?.pendingHostFrames) driver.flush(2);
  restore?.();
  controller = undefined;
  driver = undefined;
  restore = undefined;
  document.body.replaceChildren();
});

function mount(node: PibblNode) {
  controller?.dispose();
  if (!driver) {
    driver = new ManualSchedulerDriver();
    restore = installSchedulerDriverForTest(driver);
  }
  const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 100; document.body.append(canvas);
  controller = pibbl(canvas, node, { pixelRatio: 1 }); return () => driver!.flush(1);
}

describe('ignored layout positioning', () => {
  it.each([
    ['Flow', <Flow><Rectangle style={{ left: 0, top: 1, width: 10, height: 10 }} /></Flow>],
    ['Flex', <Flex><Rectangle style={{ left: 0, width: 10, height: 10, minWidth: 0 }} /></Flex>],
    ['Grid', <Grid style={{ gridTemplateColumns: [200], gridTemplateRows: [100] }}><Rectangle style={{ top: 0, width: 10, height: 10 }} /></Grid>],
  ] as const)('rejects explicit offsets in %s', (name, node) => {
    expect(mount(node)).toThrow(new RegExp(`PIBBL_LAYOUT_IGNORED_POSITION.*${name}`));
  });
  it('permits omitted and undefined offsets, but catches resolved signal offsets', () => {
    expect(mount(<Flow><Rectangle style={{ left: undefined, width: 10, height: 10 }} /></Flow>)).not.toThrow();
    const left = signal(0);
    expect(mount(<Flow><Rectangle style={{ left, width: 10, height: 10 }} /></Flow>)).toThrow('PIBBL_LAYOUT_IGNORED_POSITION');
  });
});


describe('explicit direct-Flex position modes', () => {
  const positioned = { position: 'relative' as const, left: 12, right: 18, top: 8, bottom: 10, width: 50, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0 };

  it.each([
    ['standalone', <Rectangle style={positioned} />],
    ['Absolute', <Absolute style={{ width: 200, height: 100 }}><Rectangle style={positioned} /></Absolute>],
    ['Overlay', <Overlay style={{ width: 200, height: 100 }}><Rectangle style={positioned} /></Overlay>],
    ['Flow', <Flow style={{ width: 200, height: 100 }}><Rectangle style={positioned} /></Flow>],
    ['Grid', <Grid style={{ width: 200, height: 100, gridTemplateColumns: [200], gridTemplateRows: [100] }}><Rectangle style={positioned} /></Grid>],
    ['column Flex', <Flex style={{ width: 200, height: 100, flexDirection: 'column' }}><Rectangle style={positioned} /></Flex>],
    ['wrapped Flex', <Flex style={{ width: 200, height: 100, flexWrap: 'wrap' }}><Rectangle style={positioned} /></Flex>],
  ] as const)('rejects relative placement in %s outside the finite row-nowrap contract', (_name, node) => {
    expect(mount(node)).toThrow('PIBBL_LAYOUT_UNSUPPORTED_POSITION');
  });

  it('rejects right and bottom without an explicit mode instead of dropping them', () => {
    expect(mount(<Flex style={{ width: 200, height: 100 }}>
      <Rectangle style={{ right: 18, bottom: 10, width: 50, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0 }} />
    </Flex>)).toThrow('PIBBL_LAYOUT_IGNORED_POSITION');
  });
  it('rejects a function child that modifies any forwarded relative inset', () => {
    function Modified({ style }: { readonly style: typeof positioned }) {
      return <Rectangle style={{ ...style, left: 13 }} />;
    }
    expect(mount(<Flex style={{ width: 200, height: 100 }}>
      <Modified style={positioned} />
    </Flex>)).toThrow('PIBBL_LAYOUT_UNSUPPORTED_POSITION');
  });
});


describe('bounded direct-Flex absolute admission', () => {
  const fixed = { position: 'absolute' as const, width: 30, height: 20, left: 12, top: 8 };
  it.each([
    ['standalone', <Rectangle style={fixed} />],
    ['Absolute', <Absolute style={{ width: 200, height: 100 }}><Rectangle style={fixed} /></Absolute>],
    ['Overlay', <Overlay style={{ width: 200, height: 100 }}><Rectangle style={fixed} /></Overlay>],
    ['Flow', <Flow style={{ width: 200, height: 100 }}><Rectangle style={fixed} /></Flow>],
    ['Grid', <Grid style={{ width: 200, height: 100, gridTemplateColumns: [200], gridTemplateRows: [100] }}><Rectangle style={fixed} /></Grid>],
    ['column', <Flex style={{ width: 200, height: 100, flexDirection: 'column' }}><Rectangle style={fixed} /></Flex>],
    ['wrap', <Flex style={{ width: 200, height: 100, flexWrap: 'wrap' }}><Rectangle style={fixed} /></Flex>],
    ['layout child', <Flex style={{ width: 200, height: 100 }}><Flex style={fixed}>{null}</Flex></Flex>],
  ] as const)('rejects absolute participation in %s outside the bounded contract', (_name, node) => {
    expect(mount(node)).toThrow('PIBBL_LAYOUT_UNSUPPORTED_POSITION');
  });
  it.each([
    ['automatic width', { ...fixed, width: undefined }],
    ['percentage width', { ...fixed, width: '50%' as const }],
    ['percentage inset', { ...fixed, left: '10%' as const }],
    ['nonfinite inset', { ...fixed, left: Infinity }],
    ['self alignment', { ...fixed, alignSelf: 'center' as const }],
    ['margin', { ...fixed, margin: 1 }],
    ['child padding', { ...fixed, padding: 1 }],
  ] as const)('rejects unsupported absolute %s instead of changing flow', (_name, style) => {
    expect(mount(<Flex style={{ width: 200, height: 100 }}><Rectangle style={style as RectStyle} /></Flex>)).toThrow();
  });
});
