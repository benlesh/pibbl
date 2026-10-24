import { afterEach, beforeAll, expect, it } from 'vitest';
import { Flex, Rectangle, definePrimitive, signal, type LayoutBox, type SystemStyle, useCanvasContext, useConst, useLayoutBox } from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { experimentalLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: { dispose(): void }[] = [];
beforeAll(() => { if (experimentalLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function click(canvas: HTMLCanvasElement, x: number, y: number): void { const bounds = canvas.getBoundingClientRect(); for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { clientX: bounds.left + x, clientY: bounds.top + y, bubbles: true, button: 0 })); }

interface Style extends SystemStyle { width?: number; height?: number | 'auto'; minWidth?: number; minHeight?: number; flexBasis?: number; flexGrow?: number; flexShrink?: number; alignSelf?: 'stretch' | 'flex-start'; fill?: string; padding?: { top: number; bottom: number }; }
interface Props { readonly name: 'A' | 'B' | 'C'; }

it.runIf(experimentalLayout)(
  'uses the allocated wrapped-line extent for a padded stretched opt-out without querying its baseline',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const alignment = signal<'stretch' | 'flex-start'>('stretch');
    const boxes = new Map<string, LayoutBox>(); const stamps = new Map<string, number>(); const hits: string[] = []; const constraints: Array<{ readonly minWidth: number; readonly maxWidth: number }> = []; const errors: unknown[] = [];
    let serial = 0;
    const receive = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
    const Leaf = definePrimitive<Props, Style, Style, Style & { readonly width: number; readonly height: number }>((props) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform();
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height }); stamps.set(props.name, useConst(() => ++serial));
      return <Rectangle onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: props.name === 'A' ? '#8a3248' : '#426b61', cursor: 'pointer' }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measure: ({ props, constraints: input }) => {
        if (props.name !== 'A') return { status: 'unsupported' as const, reason: 'fixed leaf' };
        constraints.push({ minWidth: input.minWidth, maxWidth: input.maxWidth });
        return { status: 'measured' as const, size: { width: 40, height: 20 } };
      },
      measureBaselines: ({ props }) => {
        if (props.name === 'A') throw new Error('cross-aligned A must not query a baseline');
        const first = props.name === 'B' ? 30 : 8;
        return { status: 'measured' as const, first, last: first };
      },
    });
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 120; document.body.append(canvas);
    window.addEventListener('error', receive);
    try {
      const controller = pibbl(canvas, <Flex style={{ width: 100, height: 120, flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, alignItems: 'first-baseline', alignContent: 'stretch' }}>
        <Leaf key="A" name="A" style={{ width: 40, height: 'auto', minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, padding: { top: 6, bottom: 4 }, alignSelf: alignment }} />
        <Leaf key="B" name="B" style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }} />
        <Leaf key="C" name="C" style={{ width: 60, height: 20, minWidth: 0, minHeight: 0, flexBasis: 60, flexGrow: 0, flexShrink: 0 }} />
      </Flex>);
      controllers.push(controller); await nextFrame();
      expect(errors).toEqual([]);
      expect(constraints).toContainEqual({ minWidth: 40, maxWidth: 40 });
      expect(Object.fromEntries(boxes)).toEqual({ A: { x: 0, y: 0, width: 40, height: 66 }, B: { x: 40, y: 0, width: 40, height: 40 }, C: { x: 0, y: 74, width: 60, height: 20 } });
      const initialStamps = Object.fromEntries(stamps); const mounted = snapshotWasmLayoutDiagnostics();
      click(canvas, 4, 50); expect(hits).toEqual(['A']);
      alignment.set('flex-start'); await nextFrame();
      expect(errors).toEqual([]);
      expect(boxes.get('A')).toEqual({ x: 0, y: 0, width: 40, height: 30 });
      expect(boxes.get('B')).toEqual({ x: 40, y: 0, width: 40, height: 40 });
      expect(boxes.get('C')).toEqual({ x: 0, y: 74, width: 60, height: 20 });
      expect(Object.fromEntries(stamps)).toEqual(initialStamps);
      click(canvas, 4, 50); expect(hits).toEqual(['A']);
      expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
      controller.dispose();
      const disposed = snapshotWasmLayoutDiagnostics();
      expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
    } finally { window.removeEventListener('error', receive); }
  },
);
