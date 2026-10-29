import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import {
  Flex,
  Rectangle,
  Text,
  definePrimitive,
  fitContent,
  signal,
  useCanvasContext,
  useConst,
  useLayoutBox,
  type BoxStyle,
  type FlexItemStyle,
  type PibblController,
  type SystemStyle,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region.js';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded.js';

const controllers: PibblController[] = [];
beforeAll(() => { if (nativeLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); vi.restoreAllMocks(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
const near = (actual: number, expected: number, label: string) => expect(Math.abs(actual - expected), label).toBeLessThan(1e-4);
function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: bounds.left + x, clientY: bounds.top + y }));
}

type TailStyle = SystemStyle & BoxStyle & FlexItemStyle;
type TailBox = Readonly<{ x: number; y: number; width: number; height: number; stamp: number }>;

it.runIf(nativeLayout)('uses Canvas natural runs and word floors for direct Text min/max/fit-content requests in every horizontal direction', async () => {
  const variants = [
    ['row', 'ltr', false], ['row-reverse', 'ltr', true],
    ['row', 'rtl', true], ['row-reverse', 'rtl', false],
  ] as const;
  for (const [flexDirection, layoutDirection, reverse] of variants) {
    for (const mode of ['min-content', 'max-content'] as const) {
    const before = snapshotWasmLayoutDiagnostics();
    const canvas = document.createElement('canvas'); canvas.width = 220; canvas.height = 50; document.body.append(canvas);
    const context = canvas.getContext('2d')!; context.font = '10px monospace';
    const words = signal('alpha beta gamma'), hits: string[] = [];
    const boxes = new Map<string, TailBox>(); let serial = 0;
    const Tail = definePrimitive<{ readonly id: string }, TailStyle, TailStyle, SystemStyle & { readonly width: number; readonly height: number }>((props) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      boxes.set(props.id, { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle onClick={() => hits.push(props.id)} style={{ width: box.width, height: box.height, fill: '#39805d', cursor: 'pointer' }} />;
    }, { resolveStyle: (_style, allocation) => ({ width: allocation.allocation.width, height: allocation.allocation.height }) });
    const draws: Array<Readonly<{ text: string; x: number; y: number }>> = [];
    const fillText = context.fillText;
    vi.spyOn(context, 'fillText').mockImplementation(function(this: CanvasRenderingContext2D, text, x, y, maxWidth) {
      const matrix = this.getTransform(); draws.push({ text: String(text), x: matrix.e + x, y: matrix.f + y }); fillText.call(this, text, x, y, maxWidth);
    });
    const controller = pibbl(canvas, <Flex style={{ width: 220, height: 40, flexDirection, layoutDirection, flexWrap: 'nowrap', alignItems: 'center' }}>
      <Text key="min" style={{ width: mode, height: 'auto', wrap: true, font: '10px monospace', lineHeight: 10, fill: '#19375b' }}>{words}</Text>
      <Text key="fit" style={{ flexBasis: fitContent(80), height: 'auto', wrap: true, font: '10px monospace', lineHeight: 10, fill: '#426b61' }}>{words}</Text>
      <Tail key="tail" id="tail" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }} />
    </Flex>);
    controllers.push(controller); await frame();
    const floor = context.measureText('gamma').width, natural = context.measureText(words.get()).width, word = mode === 'min-content' ? floor : natural, fit = Math.min(natural, Math.max(floor, 80));
    const tail = boxes.get('tail')!;
    near(tail.x, reverse ? 220 - word - fit - 20 : word + fit, 'tail x after initial intrinsic contributions');
    expect(tail).toMatchObject({ y: 10, width: 20, height: 20 });
    // min-content wraps each word; the fit-content cap retains two visible lines.
    expect(draws.filter(draw => Math.abs(draw.x - (reverse ? 220 - word : 0)) < 1e-4).map(draw => draw.text)).toEqual(mode === 'min-content' ? ['alpha', 'beta', 'gamma'] : ['alpha beta gamma']);
    const firstDraw = draws.find(draw => Math.abs(draw.x - (reverse ? 220 - word : 0)) < 1e-4)!;
    near(firstDraw.y, mode === 'min-content' ? 5 : 15, 'actual Text vertical allocation');
    expect(draws.filter(draw => Math.abs(draw.x - (reverse ? 220 - word - fit : word)) < 1e-4).map(draw => draw.text)).toEqual(['alpha beta', 'gamma']);
    const stamp = tail.stamp;
    click(canvas, tail.x + 4, tail.y + 4); await frame(); expect(hits).toEqual(['tail']);
    draws.length = 0; words.set('omega zeta'); await frame();
    const nextFloor = context.measureText('omega').width, nextNatural = context.measureText(words.get()).width, nextWord = mode === 'min-content' ? nextFloor : nextNatural, nextFit = Math.min(nextNatural, Math.max(nextFloor, 80));
    const moved = boxes.get('tail')!;
    near(moved.x, reverse ? 220 - nextWord - nextFit - 20 : nextWord + nextFit, 'tail x after text update');
    expect(moved.stamp).toBe(stamp);
    expect(draws.filter(draw => Math.abs(draw.x - (reverse ? 220 - nextWord : 0)) < 1e-4).map(draw => draw.text)).toEqual(mode === 'min-content' ? ['omega', 'zeta'] : ['omega zeta']);
    expect(draws.filter(draw => Math.abs(draw.x - (reverse ? 220 - nextWord - nextFit : nextWord)) < 1e-4).map(draw => draw.text)).toEqual(['omega zeta']);
    click(canvas, reverse ? tail.x + 4 : tail.x + 15, tail.y + 4); await frame(); expect(hits).toEqual(['tail']);
    click(canvas, moved.x + 4, moved.y + 4); await frame(); expect(hits).toEqual(['tail', 'tail']);
    controller.dispose(); canvas.remove();
    const after = snapshotWasmLayoutDiagnostics();
    expect([after.activeNodes, after.activeArenas, after.cachedMeasurements, after.activeWasmInstances]).toEqual([before.activeNodes, before.activeArenas, before.cachedMeasurements, before.activeWasmInstances]);
    }
  }
});

it.runIf(nativeLayout)('preserves leading spaces in unwrapped intrinsic runs and handles an empty run', async () => {
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 40; document.body.append(canvas);
  const context = canvas.getContext('2d')!; context.font = '10px monospace';
  const words = signal('   alpha beta'); let tailX = -1;
  const Tail = definePrimitive<{}, TailStyle, TailStyle, SystemStyle & { width: number; height: number }>(() => {
    const box = useLayoutBox(); tailX = useCanvasContext().getTransform().e;
    return <Rectangle style={{ width: box.width, height: box.height, fill: '#39805d' }} />;
  }, { resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }) });
  const controller = pibbl(canvas, <Flex style={{ width: 240, height: 40, alignItems: 'flex-start' }}>
    <Text style={{ width: 'min-content', wrap: false, font: '10px monospace', flexShrink: 0 }}>{words}</Text>
    <Tail style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0 }} />
  </Flex>);
  controllers.push(controller); await frame();
  near(tailX, context.measureText(words.get()).width, 'unwrapped leading-space width');
  words.set(''); await frame(); near(tailX, 0, 'empty intrinsic run');
});
