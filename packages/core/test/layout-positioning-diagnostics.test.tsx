import { Absolute, definePrimitive, type BoxStyle, type SystemStyle, Flex, Flow, Grid, Overlay, Rectangle, Text, signal, type FlexItemStyle, type FlexStyle, type PibblNode, type PibblController, type RectStyle } from "@pibbl/core";
import { pibblSync as pibbl } from "@pibbl/core/sync";
import { afterEach, describe, expect, it } from 'vitest';
import { snapshotWasmLayoutDiagnostics, experimentalLayout } from '../src/lib/layout/wasm/region';
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
    ['wrapped Flex owner', <Flex style={{ width: 200, height: 100, flexWrap: 'wrap' }}><Flex style={positioned}><Rectangle style={{ width: 10, height: 10 }} /></Flex></Flex>],
    ['wrap-reverse static Flex owner', <Flex style={{ width: 200, height: 100, flexWrap: 'wrap-reverse' }}><Flex style={{ ...positioned, position: 'static' }}><Rectangle style={{ width: 10, height: 10 }} /></Flex></Flex>],
  ] as const)('rejects relative placement in %s outside the finite nowrap contract', (_name, node) => {
    expect(mount(node)).toThrow(!experimentalLayout && _name === 'wrap-reverse static Flex owner' ? 'unsupported flex wrap' : 'PIBBL_LAYOUT_UNSUPPORTED_POSITION');
  });

  it.runIf(!experimentalLayout)('rejects relative column placement in the normal runtime', () => {
    expect(mount(<Flex style={{ width: 200, height: 100, flexDirection: 'column' }}><Rectangle style={positioned} /></Flex>)).toThrow('PIBBL_LAYOUT_UNSUPPORTED_POSITION');
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
    ['unanchored wrap-reverse', <Flex style={{ width: 200, height: 100, flexWrap: 'wrap-reverse' }}><Rectangle style={{ ...fixed, top: undefined }} /></Flex>],
    ['unanchored RTL wrap', <Flex style={{ width: 200, height: 100, flexWrap: 'wrap', layoutDirection: 'rtl' }}><Rectangle style={{ ...fixed, top: undefined }} /></Flex>],
    ['unanchored reversed wrap', <Flex style={{ width: 200, height: 100, flexDirection: 'row-reverse', flexWrap: 'wrap' }}><Rectangle style={{ ...fixed, top: undefined }} /></Flex>],
    ['layout child', <Flex style={{ width: 200, height: 100 }}><Flex style={fixed}>{null}</Flex></Flex>],
  ] as const)('rejects absolute participation in %s outside the bounded contract', (_name, node) => {
    expect(mount(node)).toThrow(!experimentalLayout && (_name === 'unanchored wrap-reverse' || _name === 'unanchored RTL wrap' || _name === 'unanchored reversed wrap')
      ? /uses an unsupported flex/ : 'PIBBL_LAYOUT_UNSUPPORTED_POSITION');
  });
  it.runIf(experimentalLayout).each([
    ['unpaired automatic width', { ...fixed, width: 'auto' as const }],
    ['missing horizontal anchor', { ...fixed, left: undefined }],
    ['missing vertical anchor', { ...fixed, top: undefined }],
    ['nonfinite horizontal anchor', { ...fixed, left: Infinity }],
    ['percentage horizontal anchor', { ...fixed, left: '10%' as const }],
    ['both-auto aspect', { ...fixed, width: 'auto' as const, height: 'auto' as const, aspectRatio: 2 }],
  ])('keeps wrapped absolute %s outside anchored admission', (_name, style) => {
    expect(mount(<Flex style={{ width: 200, height: 100, flexWrap: 'wrap' }}><Rectangle style={style} /></Flex>)).toThrow('PIBBL_LAYOUT_UNSUPPORTED_POSITION');
  });
  it.runIf(!experimentalLayout)('rejects column absolute participation in the normal runtime', () => {
    expect(mount(<Flex style={{ width: 200, height: 100, flexDirection: 'column' }}><Rectangle style={fixed} /></Flex>)).toThrow('PIBBL_LAYOUT_UNSUPPORTED_POSITION');
  });
  it.runIf(experimentalLayout).each(['row-reverse', 'column', 'column-reverse'] as const)('keeps unpaired automatic axes and ambiguous aspect sizing outside expanded %s absolute placement', flexDirection => {
    for (const style of [{ ...fixed, width: 'auto' as const }, { ...fixed, aspectRatio: 2 }, { ...fixed, width: 'auto' as const, height: 'auto' as const, aspectRatio: 2 }]) {
      expect(mount(<Flex style={{ width: 200, height: 100, flexDirection }}><Rectangle style={style} /></Flex>)).toThrow('PIBBL_LAYOUT_UNSUPPORTED_POSITION');
    }
  });
  it.runIf(experimentalLayout).each(['row-reverse', 'column', 'column-reverse'] as const)('requires paired natural providers in %s before measurement', flexDirection => {
    let calls = 0;
    const Leaf = definePrimitive<{}, BoxStyle & FlexItemStyle, BoxStyle & FlexItemStyle, SystemStyle & { width: number; height: number }>(() => null, {
      resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
      measure: () => { calls++; return { status: 'measured', size: { width: 60, height: 20 } }; },
    });
    for (const style of [{ width: 'auto' as const, height: 20 }, { width: 80, height: 'auto' as const }]) {
      expect(mount(<Flex style={{ width: 200, height: 100, flexDirection }}><Leaf style={{ ...style, position: 'absolute', left: 12, top: 8 }} /></Flex>)).toThrow('PIBBL_LAYOUT_UNSUPPORTED_POSITION');
    }
    expect(calls).toBe(0);
  });
  it('rejects an opaque static Flex handoff when no declarative containing-block metadata exists', () => {
    function OpaqueStatic({ style }: { readonly style: FlexStyle & FlexItemStyle }) {
      return <Flex style={style}><Rectangle style={fixed} /></Flex>;
    }
    expect(mount(<Flex style={{ width: 200, height: 100 }}>
      <OpaqueStatic style={{
        position: 'static', width: 80, height: 60,
        minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
        flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start',
      }} />
    </Flex>)).toThrow(experimentalLayout ? 'static containing-block inheritance requires a direct declarative Flex chain' : 'PIBBL_LAYOUT_UNSUPPORTED_POSITION');
  });
  it.runIf(experimentalLayout).each(['unsupported','throwing'] as const)('releases an absolute natural-width provider after %s measurement', mode => {
    const baseline = snapshotWasmLayoutDiagnostics();
    let rendered = 0;
    const Leaf = definePrimitive<{}, BoxStyle & FlexItemStyle, BoxStyle & FlexItemStyle, SystemStyle>(() => { rendered++; return null; }, {
      resolveStyle: () => ({}),
      measureIntrinsic: () => ({status:'measured',minContent:{width:20,height:20},maxContent:{width:60,height:20}}),
      measure: () => { if(mode==='throwing') throw new Error('absolute natural failure'); return {status:'unsupported',reason:'absolute natural unavailable'}; },
    });
    expect(mount(<Flex style={{width:200,height:100}}><Leaf style={{position:'absolute',left:12,top:8,width:'auto',height:20}} /></Flex>)).toThrow(mode==='throwing'?'absolute natural failure':'absolute natural unavailable');
    expect(rendered).toBe(0);controller?.dispose();controller=undefined;
    const disposed=snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements]).toEqual([baseline.activeNodes,baseline.activeArenas,baseline.cachedMeasurements]);
  });
  it.each([
    ['automatic width without opposing insets', { ...fixed, width: undefined }],
    ['automatic height without opposing insets', { ...fixed, height: 'auto' as const }],
    ['derived overflow before zero clamping', { ...fixed, width: 'auto' as const, left: 1e308, right: 1e308 }],
    ['percentage width', { ...fixed, width: '50%' as const }],
    ['percentage inset', { ...fixed, left: '10%' as const }],
    ['nonfinite inset', { ...fixed, left: Infinity }],
    ['percentage minimum', { ...fixed, minWidth: '10%' as const }],
    ['negative minimum', { ...fixed, minHeight: -1 }],
    ['nonfinite maximum', { ...fixed, maxWidth: Infinity }],
    ['contradictory bounds', { ...fixed, minWidth: 60, maxWidth: 40 }],
    ['aspect with both explicit axes', { ...fixed, aspectRatio: 2 }],
    ['aspect with both automatic axes', { ...fixed, width: 'auto' as const, height: 'auto' as const, right: 10, bottom: 10, aspectRatio: 2 }],
    ['aspect overflow', { ...fixed, width: 1e308, height: 'auto' as const, aspectRatio: 1e-308 }],
    ['invalid aspect ratio', { ...fixed, height: 'auto' as const, aspectRatio: 0 }],
    ['self alignment', { ...fixed, alignSelf: 'center' as const }],
    ['margin', { ...fixed, margin: 1 }],
    ['child padding', { ...fixed, padding: 1 }],
  ] as const)('rejects unsupported absolute %s instead of changing flow', (_name, style) => {
    expect(mount(<Flex style={{ width: 200, height: 100 }}><Rectangle style={style as RectStyle} /></Flex>)).toThrow();
  });
});

describe('static containing-block direction boundary', () => {
  const absolute = { position: 'absolute' as const, width: 30, height: 20, left: 12, top: 8 };
  it.each([
    ['growing static child in column parent', 'column' as const, 'row' as const],
    ['growing column static child in row parent', 'row' as const, 'column' as const],
  ])('rejects %s instead of extending static containing ownership', (_name, outerDirection, innerDirection) => {
    expect(mount(<Flex style={{ width: 200, height: 100, flexDirection: outerDirection, flexWrap: 'nowrap' }}>
      <Flex style={{ position: 'static', width: 80, height: 60, minWidth: 0, minHeight: 0, flexGrow: 1, flexShrink: 0,
        flexDirection: innerDirection, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <Rectangle style={absolute} />
      </Flex>
    </Flex>)).toThrow('PIBBL_LAYOUT_UNSUPPORTED_POSITION');
  });
});


describe('bounded absolute wrapped Text height', () => {
  const style = { position: 'absolute' as const, width: 40, height: 'auto' as const, left: 12, bottom: 10, minWidth: 0, minHeight: 0, flexShrink: 0, wrap: true, font: '10px monospace', lineHeight: 10 };
  it.runIf(experimentalLayout).each([
    ['ellipsized fit', { ...style, fit: 'ellipsis' as const }],
    ['clipped fit', { ...style, fit: 'clip' as const }],
    ['squished fit', { ...style, fit: 'squish' as const }],
    ['clipped overflow', { ...style, overflow: 'clip' as const }],
    ['custom font', { ...style, font: '10px AppFont' }],
    ['both automatic axes', { ...style, width: 'auto' as const }],
  ])('rejects natural Text height with %s', (_name, textStyle) => {
    expect(mount(<Flex style={{ width: 200, height: 100 }}><Text style={textStyle}>aaaa aaaa</Text></Flex>)).toThrow('PIBBL_LAYOUT_UNSUPPORTED_POSITION');
  });
});


describe('bounded absolute natural Text width', () => {
  const style = { position: 'absolute' as const, width: 'auto' as const, height: 20, right: 18, top: 8, minWidth: 0, minHeight: 0, flexShrink: 0, wrap: false, font: '10px monospace' };
  it.runIf(experimentalLayout).each([
    ['wrapped', { ...style, wrap: true }],
    ['clipped fit', { ...style, fit: 'clip' as const }],
    ['ellipsized fit', { ...style, fit: 'ellipsis' as const }],
    ['clipped overflow', { ...style, overflow: 'clip' as const }],
    ['custom font', { ...style, font: '10px AppFont' }],
    ['wrapped both automatic axes', { ...style, height: 'auto' as const, wrap: true }],
  ])('rejects natural Text width with %s', (_name, textStyle) => {
    expect(mount(<Flex style={{ width: 200, height: 100 }}><Text style={textStyle}>aaaa aaaa</Text></Flex>)).toThrow('PIBBL_LAYOUT_UNSUPPORTED_POSITION');
  });
  it.runIf(experimentalLayout)('rejects responsive Text width measurement', () => {
    expect(mount(<Flex style={{ width: 200, height: 100 }}><Text style={{ ...style, when: [{ query: { minWidth: 0 }, style: { fill: '#a63758' } }] }}>aaaa aaaa</Text></Flex>)).toThrow('PIBBL_LAYOUT_UNSUPPORTED_POSITION');
  });
});


describe('bounded both-auto Text measurement', () => {
  const style = { position: 'absolute' as const, width: 'auto' as const, height: 'auto' as const, right: 18, bottom: 10, minWidth: 0, minHeight: 0, flexShrink: 0, wrap: false, font: '10px monospace' };
  it.runIf(experimentalLayout).each([
    ['both-auto aspect', { ...style, aspectRatio: 2 }],
    ['horizontal pair with natural height', { ...style, left: 12 }],
    ['vertical pair with natural width', { ...style, top: 8 }],
    ['non-generic font', { ...style, font: '10px AppFont' }],
  ])('rejects %s before introducing constraint feedback', (_name, textStyle) => {
    expect(mount(<Flex style={{ width: 200, height: 100 }}><Text style={textStyle}>aaaa aaaa</Text></Flex>)).toThrow('PIBBL_LAYOUT_UNSUPPORTED_POSITION');
  });
});
