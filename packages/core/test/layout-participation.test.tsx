import { afterEach, beforeAll, expect, it } from 'vitest';
import { Flex, FocusManagement, Group, HtmlBox, Layer, Rectangle, definePrimitive, defineRenderLayer, signal, useCanvasContext, useConst, useLayoutBox, useReaction, type BoxStyle, type FlexItemStyle, type SystemStyle } from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { nativeLayout } from '../src/lib/layout/wasm/region';

const controllers: { dispose(): void }[] = [];
beforeAll(() => { if (nativeLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

it.runIf(nativeLayout)('hoists contents boxes while retaining transformed logical scopes and hidden resources', async () => {
  const participation = signal<'contents' | 'hidden'>('contents');
  const boxes = new Map<string, { x: number; y: number; width: number; stamp: number }>();
  const hits: string[] = [];
  let mounts = 0, cleanups = 0;
  type Style = SystemStyle & BoxStyle & FlexItemStyle;
  const Probe = definePrimitive<{ name: string }, Style, Style, SystemStyle & { width: number; height: number }>((props, style) => {
    const allocation = useLayoutBox(), matrix = useCanvasContext().getTransform();
    const stamp = useConst(() => ++mounts);
    useReaction(() => () => { cleanups++; }, []);
    boxes.set(props.name, { x: matrix.e, y: matrix.f, width: allocation.width, stamp });
    return <Rectangle onClick={() => hits.push(props.name)} style={{ width: style.width, height: style.height, fill: '#246b61' }} />;
  }, { resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }) });
  const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 80; document.body.append(canvas);
  const controller = pibbl(canvas, <Flex style={{ width: 200, height: 80, gap: 10, alignItems: 'flex-start' }}>
    <Group key="contents" onClick={() => hits.push('group')} style={{ layoutParticipation: participation, translateX: 5 }}>
      <Probe key="A" name="A" style={{ width: 30, height: 20, minWidth: 0, flexShrink: 0 }} />
      <Probe key="B" name="B" style={{ width: 40, height: 20, minWidth: 0, flexShrink: 0 }} />
    </Group>
    <Probe key="C" name="C" style={{ width: 20, height: 20, minWidth: 0, flexShrink: 0 }} />
  </Flex>); controllers.push(controller);
  await nextFrame();
  expect([...boxes.entries()]).toEqual([
    ['A', { x: 5, y: 0, width: 30, stamp: 1 }],
    ['B', { x: 45, y: 0, width: 40, stamp: 2 }],
    ['C', { x: 90, y: 0, width: 20, stamp: 3 }],
  ]);
  const click = (x: number) => {
    const rect = canvas.getBoundingClientRect();
    for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: rect.left + x, clientY: rect.top + 5 }));
  };
  click(10); expect(hits).toEqual(['A', 'group']);
  participation.set('hidden'); await nextFrame();
  expect(boxes.get('C')).toEqual({ x: 0, y: 0, width: 20, stamp: 3 });
  expect(cleanups).toBe(0);
  click(50); expect(hits).toEqual(['A', 'group']);
  participation.set('contents'); await nextFrame();
  expect(boxes.get('A')).toEqual({ x: 5, y: 0, width: 30, stamp: 1 });
  expect(boxes.get('B')).toEqual({ x: 45, y: 0, width: 40, stamp: 2 });
  expect(mounts).toBe(3);
  controller.dispose(); expect(cleanups).toBe(3);
});

it.runIf(nativeLayout)('does not evaluate a hidden component or measure its declared descendants', async () => {
  let calls = 0;
  function Hidden({ style: _style }: { style: Style }) { calls++; throw new Error('Hidden program must remain suspended'); }
  type Style = SystemStyle & BoxStyle & FlexItemStyle;
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 50; document.body.append(canvas);
  controllers.push(pibbl(canvas, <Flex style={{ width: 100, height: 50 }}>
    <Hidden style={{ layoutParticipation: 'hidden' }} />
    <Rectangle style={{ width: 20, height: 20, minWidth: 0, flexShrink: 0 }} />
  </Flex>));
  await nextFrame(); expect(calls).toBe(0);
});

it.runIf(nativeLayout)('hides an HtmlBox without aborting or remounting application-owned DOM', async () => {
  const participation = signal<'normal' | 'hidden'>('normal');
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;width:200px;height:100px';
  const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 100;
  const overlay = document.createElement('div'); overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  wrapper.append(canvas, overlay); document.body.append(wrapper);
  let mounts = 0, aborts = 0;
  const mount = (host: HTMLDivElement, _data: unknown, abort: AbortSignal) => {
    mounts++;
    const input = document.createElement('input'); input.value = 'Owned native state'; host.append(input);
    abort.addEventListener('abort', () => { aborts++; });
    return () => {};
  };
  const controller = pibbl(canvas, <Group style={{ layoutParticipation: participation }}>
    <HtmlBox mount={mount} data={0} style={{ width: 100, height: 40 }} />
  </Group>, { htmlOverlay: overlay }); controllers.push(controller);
  await nextFrame();
  const input = overlay.querySelector('input'); expect(input).not.toBeNull();
  participation.set('hidden'); await nextFrame();
  expect(overlay.querySelector('input')).toBe(input);
  expect(overlay.querySelector<HTMLElement>('[data-pibbl-html-box]')?.style.visibility).toBe('hidden');
  expect([mounts, aborts]).toEqual([1, 0]);
  participation.set('normal'); await nextFrame();
  expect(overlay.querySelector('input')).toBe(input);
  expect(overlay.querySelector<HTMLElement>('[data-pibbl-html-box]')?.style.visibility).toBe('visible');
  expect([mounts, aborts]).toEqual([1, 0]);
  controller.dispose(); expect(aborts).toBe(1);
});

it.runIf(nativeLayout)('suspends retained Layer and render-layer hit bridges without disposing their resources', async () => {
  const participation = signal<'normal' | 'hidden'>('normal');
  const hits: string[] = [];
  const focused: string[] = [];
  let creates = 0, disposals = 0;
  const applicationTarget = {};
  const External = defineRenderLayer<{}, {}, typeof applicationTarget>({
    create: context => { context.canvas.getContext('2d'); creates++; return {}; },
    render: () => undefined,
    dispose: () => { disposals++; },
    interaction: {
      settle: () => ({
        targets: [{
          target: applicationTarget,
          handlers: {
            onClick: () => hits.push('external'),
            onFocus: () => focused.push('external'),
          },
          keyboardFocusable: true,
          keyboardNavigationBounds: { x: 0, y: 0, width: 20, height: 20 },
        }],
        hitTest: () => ({ kind: 'target' as const, target: applicationTarget }),
      }),
    },
  });
  const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 30; document.body.append(canvas);
  controllers.push(pibbl(canvas, <FocusManagement><Group style={{ layoutParticipation: participation }}>
    <Layer style={{ width: 20, height: 20 }}>
      <Rectangle keyboardFocusable onFocus={() => focused.push('layer')} onClick={() => hits.push('layer')} style={{ width: 20, height: 20, fill: 'red' }} />
    </Layer>
    <Group style={{ translateX: 40 }}>
      <External style={{ width: 20, height: 20 }} />
    </Group>
  </Group></FocusManagement>));
  const click = (x: number) => {
    const rect = canvas.getBoundingClientRect();
    for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: rect.left + x, clientY: rect.top + 5 }));
  };
  await nextFrame();
  click(5); click(45); expect(hits).toEqual(['layer', 'external']);
  expect([creates, disposals]).toEqual([1, 0]);
  focused.length = 0;
  canvas.blur(); canvas.focus({ preventScroll: true });
  expect(focused).toEqual(['layer']);
  canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
  expect(focused).toEqual(['layer', 'external']);
  participation.set('hidden'); await nextFrame();
  click(5); click(45); expect(hits).toEqual(['layer', 'external']);
  expect([creates, disposals]).toEqual([1, 0]);
  participation.set('normal'); await nextFrame();
  click(5); click(45); expect(hits).toEqual(['layer', 'external', 'layer', 'external']);
  expect([creates, disposals]).toEqual([1, 0]);
  focused.length = 0;
  canvas.blur(); canvas.focus({ preventScroll: true });
  expect(focused).toEqual(['layer']);
  canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
  expect(focused).toEqual(['layer', 'external']);
});
