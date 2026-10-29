import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  defineLayoutComponent,
  definePrimitive,
  Flex,
  measureElement,
  Rectangle,
  signal,
  Text,
  type FlexStyle,
  type PibblController,
  type PibblResponsiveStyle,
  type SystemStyle,
  useCanvasContext,
  useConst,
  useLayoutBox,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';

const controllers: PibblController[] = [];
beforeAll(() => { if (nativeLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

type BoxRecord = Readonly<{ x: number; y: number; width: number; height: number; stamp: number }>;

/**
 * Every zero-margin control below already mounts.  The subsequent physical
 * margin changes are therefore a margin admission/placement contract, not an
 * intrinsic-measurement substitute.
 */
for (const family of ['text', 'provider', 'known'] as const)
  for (const flexDirection of ['column', 'column-reverse'] as const)
    for (const layoutDirection of ['ltr', 'rtl'] as const) {
      it.runIf(nativeLayout)(`keeps ${family} ${flexDirection}/${layoutDirection} intrinsic cross geometry stable through physical auto margins`, async () => {
        const baseline = snapshotWasmLayoutDiagnostics();
        const left = signal<0 | 'auto'>(0);
        const right = signal<0 | 'auto'>(0);
        const fill = signal('#8a3248');
        const natural = signal(40);
        const text = signal('probe');
        const hits: string[] = [];
        let serial = 0;
        const queries: Array<Readonly<{ minWidth: number; maxWidth: number; minHeight: number; maxHeight: number }>> = [];
        let providerBox: BoxRecord | undefined;
        let knownBox: BoxRecord | undefined;
        const textDraws: Array<{ x: number; y: number }> = [];

        const Provider = definePrimitive<{
          readonly natural: typeof natural;
          readonly fill: typeof fill;
        }, FlexStyle, FlexStyle, SystemStyle & { readonly width: number; readonly height: number }>((props, style) => {
          const box = useLayoutBox();
          const transform = useCanvasContext().getTransform();
          const stamp = useConst(() => ++serial);
          providerBox = { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp };
          return <Rectangle onClick={() => hits.push('provider')} style={{ width: style.width, height: style.height, fill: props.fill, cursor: 'pointer' }} />;
        }, {
          preserveSignalProps: ['natural', 'fill'],
          resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
          measureIntrinsic: ({ props }) => ({ status: 'measured' as const, minContent: { width: props.natural.get(), height: 40 }, maxContent: { width: props.natural.get(), height: 40 } }),
          measure: ({ props, constraints }) => {
            queries.push({ ...constraints });
            return { status: 'measured' as const, size: { width: props.natural.get(), height: 40 } };
          },
        });

        const KnownLeaf = definePrimitive<{
          readonly width: typeof natural;
          readonly fill: typeof fill;
        }, FlexStyle, FlexStyle, SystemStyle & { readonly width: number; readonly height: number }>((props, style) => {
          const box = useLayoutBox();
          const transform = useCanvasContext().getTransform();
          const stamp = useConst(() => ++serial);
          knownBox = { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp };
          return <Rectangle onClick={() => hits.push('known')} style={{ width: style.width, height: style.height, fill: props.fill, cursor: 'pointer' }} />;
        }, {
          preserveSignalProps: ['width', 'fill'],
          resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
        });
        const Card = defineLayoutComponent((props: {
          readonly style: PibblResponsiveStyle<FlexStyle>;
          readonly width: typeof natural;
          readonly fill: typeof fill;
        }) => <Flex style={props.style}>
          <KnownLeaf key="known-leaf" width={props.width} fill={props.fill} style={{ width: props.width, height: 40, minWidth: 0, minHeight: 0, flexBasis: 'auto', flexGrow: 0, flexShrink: 0 }} />
          <Rectangle key="known-tail" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexBasis: 20, flexGrow: 0, flexShrink: 0, fill: '#6e3e79' }} />
        </Flex>);

        const candidateStyle: PibblResponsiveStyle<FlexStyle> = {
          width: 'auto', height: 40, minHeight: 0,
          flexBasis: 'auto', flexGrow: 0, flexShrink: 0,
          marginLeft: left, marginRight: right,
        };
        const candidate = family === 'text'
          ? <Text key="candidate" onClick={() => hits.push('text')} style={{ ...candidateStyle, wrap: false, font: '10px monospace', fill, cursor: 'pointer' }}>{text}</Text>
          : family === 'provider'
            ? <Provider key="candidate" natural={natural} fill={fill} style={candidateStyle} />
            : <Card key="candidate" width={natural} fill={fill} style={{ ...candidateStyle, minWidth: 0, flexDirection: 'row', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start' }} />;

        if (family === 'provider') {
          expect(measureElement(candidate, {
            minWidth: 0, maxWidth: Number.POSITIVE_INFINITY,
            minHeight: 40, maxHeight: 40,
          }, { measureText: () => { throw new Error('Provider probe does not shape text.'); } }))
            .toEqual({ status: 'measured', size: { width: 40, height: 40 } });
        }
        const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 140; document.body.append(canvas);
        const context = canvas.getContext('2d')!;
        const originalFillText = context.fillText;
        context.fillText = function(value, x, y, maximum) {
          if (value === text.get()) { const transform = this.getTransform(); textDraws.push({ x: transform.e + x, y: transform.f + y }); }
          return originalFillText.call(this, value, x, y, maximum);
        };
        const controller = pibbl(canvas, <Flex style={{ width: 200, height: 120, flexDirection, flexWrap: 'nowrap', layoutDirection, alignItems: 'flex-start' }}>
          {candidate}
          <Rectangle key="peer" style={{ width: 20, height: 80, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0, fill: '#426b61' }} />
        </Flex>);
        controllers.push(controller); await frame();

        // Numeric zero is the independently accepted control. It must paint
        // before the automatic-margin transition is even attempted.
        const textWidth = () => {
          context.save(); context.font = '10px monospace';
          const metrics = context.measureText(text.get()); context.restore();
          return metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
        };
        const crossWidth = () => family === 'text'
          ? textWidth()
          : family === 'provider' ? providerBox!.width : knownBox!.width + 20;
        const position = () => family === 'text'
          ? textDraws.at(-1)!
          : family === 'provider' ? providerBox! : knownBox!;
        const expectedY = flexDirection === 'column' ? 0 : 80;
        const assertPosition = (expectedX: number, expectedWidth: number) => {
          const value = position();
          expect(value.x).toBeCloseTo(expectedX, 5);
          expect(value.y).toBeCloseTo(expectedY, 5);
          if (family !== 'text') {
            const box = family === 'provider' ? providerBox! : knownBox!;
            expect(box.width).toBe(natural.get());
            expect(box.width).toBeCloseTo(expectedWidth, 5);
            expect(box.height).toBe(40);
          }
        };
        const zeroWidth = crossWidth();
        const mounted = snapshotWasmLayoutDiagnostics();
        assertPosition(layoutDirection === 'ltr' ? 0 : 200 - zeroWidth, family === 'known' ? zeroWidth - 20 : zeroWidth);
        const initialStamp = family === 'provider' ? providerBox!.stamp : family === 'known' ? knownBox!.stamp : undefined;
        if (family === 'provider') expect(queries).toContainEqual({ minWidth: 0, maxWidth: Number.POSITIVE_INFINITY, minHeight: 40, maxHeight: 40 });

        left.set('auto'); await frame();
        assertPosition(200 - zeroWidth, family === 'known' ? zeroWidth - 20 : zeroWidth);
        const leftAuto = position();
        right.set('auto'); await frame();
        assertPosition((200 - zeroWidth) / 2, family === 'known' ? zeroWidth - 20 : zeroWidth);
        left.set(0); await frame();
        assertPosition(0, family === 'known' ? zeroWidth - 20 : zeroWidth);

        // A natural-content change keeps mounted identities and updates the
        // candidate's cross allocation before the physical right margin places it.
        natural.set(80); text.set('probe probe'); await frame();
        const changedWidth = crossWidth();
        assertPosition(0, family === 'known' ? changedWidth - 20 : changedWidth);
        if (family !== 'text') expect((family === 'provider' ? providerBox! : knownBox!).stamp).toBe(initialStamp);
        const beforePaint = snapshotWasmLayoutDiagnostics();
        const beforePaintQueries = queries.length;
        fill.set('#19375b'); await frame();
        expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
        expect(snapshotWasmLayoutDiagnostics().solves).toBe(beforePaint.solves);
        expect(queries.length).toBe(beforePaintQueries);
        assertPosition(0, family === 'known' ? crossWidth() - 20 : crossWidth());

        // Right-auto has moved the candidate away from its former left-auto
        // center. The old center is inert; a point in the new painted box hits.
        const rect = canvas.getBoundingClientRect();
        const oldX = rect.left + leftAuto.x + 3;
        const oldY = rect.top + leftAuto.y + 3;
        for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: oldX, clientY: oldY }));
        const target = position();
        const x = rect.left + target.x + 3;
        const y = rect.top + target.y + 3;
        for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y }));
        await frame();
        expect(hits).toEqual([family]);

        controller.dispose();
        const disposed = snapshotWasmLayoutDiagnostics();
        expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
          baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
        ]);
      });
    }
