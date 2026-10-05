import {
  Absolute, Overlay, Flow, Flex, Grid, Rectangle, pibbl, createElement, definePrimitive,
  type PibblController, type SystemStyle,
} from '@pibbl/core';
import { afterEach, describe, expect, it } from 'vitest';
import { installSchedulerDriverForTest, ManualSchedulerDriver } from '../src/lib/scheduler/testing';
let controller: PibblController | undefined;
let restore: (() => void) | undefined;
afterEach(() => {
  controller?.dispose();
  restore?.();
  document.body.replaceChildren();
});
describe('responsive queries in allocated layout', () => {
  it.each(['absolute', 'overlay', 'flow', 'flex', 'grid'] as const)(
    'selects against containing size before %s assigns a smaller item box', kind => {
      const driver = new ManualSchedulerDriver();
      restore = installSchedulerDriverForTest(driver);
      const observed: unknown[] = [];
      interface ItemStyle extends SystemStyle {
        width: number; height: number; color?: string;
        flexBasis?: number; flexShrink?: number;
        gridColumnStart?: number; gridRowStart?: number;
      }
      const Item = definePrimitive<{}, ItemStyle>((_props, style) => {
        observed.push({ width: style.width, height: style.height, color: style.color });
        return <Rectangle style={{ width: 10, height: 10, fill: style.color }} />;
      });
      const item = <Item style={{ width: 10, height: 10, color: 'blue',
        ...(kind === 'grid' ? { gridColumnStart: 1, gridRowStart: 1 } : {}),
        ...(kind === 'flex' ? { flexBasis: 10, flexShrink: 0 } : {}),
        when: [{ query: { minWidth: 600, minHeight: 100 }, style: { color: 'red' } }],
      }} />;
      const root = kind === 'absolute' ? <Absolute>{item}</Absolute> :
        kind === 'overlay' ? <Overlay style={{ alignItems: 'start', justifyItems: 'start' }}>{item}</Overlay> :
        kind === 'flow' ? <Flow>{item}</Flow> :
        kind === 'flex' ? <Flex>{item}</Flex> :
        <Grid style={{ gridTemplateColumns: [700], gridTemplateRows: [160] }}>{item}</Grid>;
      const canvas = document.createElement('canvas');
      canvas.width = 700; canvas.height = 160;
      document.body.append(canvas);
      controller = pibbl(canvas, root, { pixelRatio: 1 });
      driver.flush(1);
      expect(observed).toEqual([{ width: 10, height: 10, color: 'red' }]);
      expect(driver.pendingHostFrames).toBe(0);
    },
  );
  it('uses source-ordered shallow replacement, explicit undefined, and ordinary defaults', () => {
    const driver = new ManualSchedulerDriver();
    restore = installSchedulerDriverForTest(driver);
    const observed: unknown[] = [];
    interface Style extends SystemStyle { gap?: number; values?: readonly number[] }
    const custom = { when: ['opaque'] };
    const Probe = definePrimitive<{}, Style>((_props, style) => { observed.push(style); }, {
      normalizeStyle: style => ({ ...style, gap: style.gap ?? 7 }),
    });
    const canvas = document.createElement('canvas');
    canvas.width = 600; canvas.height = 100;
    document.body.append(canvas);
    controller = pibbl(canvas, createElement(Probe, { style: {
      gap: 12, values: [1, 2], custom: { old: true },
      when: [
        { query: { minWidth: 600 }, style: { gap: 24, values: [3], custom } },
        { query: { maxWidth: 600 }, style: { gap: undefined, values: [4, 5] } },
      ],
    } }), { pixelRatio: 1 });
    driver.flush(1);
    expect(observed).toEqual([{ gap: 7, values: [4, 5], custom }]);
  });
});
