import { afterEach, beforeAll, expect, it } from 'vitest';
import { defineLayoutComponent, definePrimitive, Flex, Rectangle, signal, useLayoutBox, type FlexStyle, type PibblController, type SystemStyle } from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { nativeLayout } from '../src/lib/layout/wasm/region';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';

const controllers: PibblController[] = [];
beforeAll(() => { if (nativeLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

it.runIf(nativeLayout)('refreshes an untraced nested public query with a changed signal style on an independently scheduled repaint', async () => {
  const nestedHeight = signal(20), footerFill = signal('#a63758');
  let providerCalls = 0, nestedCalls = 0, paintedHeight = 0;
  type Resolved = SystemStyle & { width: number; height: number };
  const Nested = definePrimitive<{}, FlexStyle, FlexStyle, Resolved>(() => null, {
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    measure: ({ style }) => {
      nestedCalls++;
      return { status: 'measured', size: { width: 1, height: style.height as number } };
    },
  });
  const nested = <Nested style={{ width: 1, height: nestedHeight }} />;
  const Provider = definePrimitive<{}, FlexStyle, FlexStyle, Resolved>(() => {
    const box = useLayoutBox(); paintedHeight = box.height;
    return <Rectangle style={{ width: box.width, height: box.height, fill: '#19375b' }} />;
  }, {
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    measureIntrinsic: () => ({ status: 'measured', minContent: { width: 0, height: 20 }, maxContent: { width: 100, height: 20 } }),
    measure: ({ constraints, measureElement }) => {
      providerCalls++;
      const result = measureElement(nested, { minWidth: 0, maxWidth: 1, minHeight: 0, maxHeight: 100 });
      if (result.status === 'unsupported') return result;
      return { status: 'measured', size: { width: constraints.maxWidth, height: result.size.height } };
    },
  });
  const Card = defineLayoutComponent((props: { style: FlexStyle }) => <Flex style={{ ...props.style, width: 80, flexDirection: 'row', alignItems: 'flex-start' }}>
    <Provider style={{ flexBasis: 100, flexShrink: 1, minWidth: 0, height: 'auto' }} />
    <Rectangle style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0 }} />
  </Flex>);
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100; document.body.append(canvas);
  const controller = pibbl(canvas, <Flex style={{ width: 80, height: 100, flexDirection: 'column', alignItems: 'flex-start' }}>
    <Card style={{ minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }} />
    <Rectangle style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0, fill: footerFill }} />
  </Flex>); controllers.push(controller); await frame();
  expect(paintedHeight).toBe(20);
  const beforeProvider = providerCalls, beforeNested = nestedCalls;
  nestedHeight.set(40); footerFill.set('#426b61'); await frame();
  expect(paintedHeight).toBe(40);
  expect([...canvas.getContext('2d')!.getImageData(10, 30, 1, 1).data]).toEqual([25, 55, 91, 255]);
  expect(providerCalls).toBeGreaterThan(beforeProvider);
  expect(nestedCalls).toBeGreaterThan(beforeNested);
});
