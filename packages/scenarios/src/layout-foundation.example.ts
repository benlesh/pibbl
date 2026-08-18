import {
  absolute,
  crc,
  crcLayoutBox,
  crcState,
  defineComp,
  flex,
  flow,
  grid,
  img,
  overlay,
  rect,
  text,
  type BoxStyle,
  type CRCController,
  type FlexItemStyle,
  type GridItemStyle,
  type OverlayStyle,
  type ResolvedStyle,
  type StyleResolutionContext,
  type SystemStyle,
} from '@crc/core';
import type { ScenarioDefinition } from './types';

export const LAYOUT_FOUNDATION_SOURCE_ID = 'layout-foundation-example';

export interface LayoutFoundationState {
  topClicks: number;
  keyedClicks: number;
  clippedClicks: number;
  observedBox?: Readonly<{ x: number; y: number; width: number; height: number }>;
}

export interface LayoutFoundationMount {
  readonly controller: CRCController;
  getState(): Readonly<LayoutFoundationState>;
  resize(width: number, height: number): void;
}

interface ProbeProps {
  state: LayoutFoundationState;
}

interface ProbeStyle extends BoxStyle {
  fill: string;
}

interface ResolvedProbeStyle extends SystemStyle {
  width: number;
  height: number;
  fill: string;
}

const KeyedProbe = defineComp<
  ProbeProps,
  ProbeStyle,
  ProbeStyle,
  ResolvedProbeStyle
>(function KeyedProbe({ state }, style) {
  const [clicks, setClicks] = crcState(0);
  const box = crcLayoutBox();
  state.keyedClicks = clicks;
  state.observedBox = { ...box };
  return rect({
    style: { width: style.width, height: style.height, fill: style.fill },
    onClick: () => setClicks(value => value + 1),
  });
}, {
  resolveStyle: (
    style: Readonly<ProbeStyle>,
    context: Readonly<StyleResolutionContext>,
  ): ResolvedStyle<ResolvedProbeStyle> => ({
    width: context.allocation.width,
    height: context.allocation.height,
    fill: style.fill,
  }),
});

const imageSource =
  'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2224%22%20height=%2224%22%3E%3Crect%20width=%2224%22%20height=%2224%22%20fill=%22%23f7c948%22/%3E%3C/svg%3E';

export function mountLayoutFoundation(
  canvas: HTMLCanvasElement,
): LayoutFoundationMount {
  const state: LayoutFoundationState = {
    topClicks: 0,
    keyedClicks: 0,
    clippedClicks: 0,
  };
  const gridStyle = {
    width: '100%',
    height: '100%',
    minWidth: 0,
    flexBasis: '100%',
    flexShrink: 1,
    gridTemplateColumns: ['60%', '1fr'],
    gridTemplateRows: ['1fr'],
  } satisfies Parameters<typeof grid>[0]['style'] & FlexItemStyle;
  const overlayStyle = {
    width: 'auto',
    height: 'auto',
    gridColumnStart: 1,
    gridRowStart: 1,
    overflow: 'clip',
    alignItems: 'center',
    justifyItems: 'center',
  } satisfies OverlayStyle & GridItemStyle;
  const createScene = () => absolute({
    style: { width: '100%', height: '100%' },
    children: [flex({
      style: { width: '100%', height: '100%' },
      children: [grid({
        style: gridStyle,
        children: [overlay({
          style: overlayStyle,
          children: [
            KeyedProbe({
              key: 'keyed-probe',
              state,
              style: { width: '100%', height: '100%', fill: '#0e7490' },
            }),
            flow({
              style: {
                width: 180,
                height: 24,
                alignSelf: 'start',
                justifySelf: 'start',
              } as Parameters<typeof flow>[0]['style'],
              children: [text({
                style: {
                  text: 'MEASURED TEXT',
                  font: '800 14px sans-serif',
                  fill: '#ffffff',
                },
              })],
            }),
            img({
              style: {
                src: imageSource,
                width: 24,
                height: 24,
                alignSelf: 'start',
                justifySelf: 'end',
              },
            }),
            rect({
              style: {
                width: 520,
                height: 50,
                fill: '#7c3aed',
                alignSelf: 'end',
                justifySelf: 'center',
              },
              onClick: () => state.clippedClicks++,
            }),
            rect({
              style: {
                width: 120,
                height: 80,
                fill: '#f97316',
                alignSelf: 'center',
                justifySelf: 'center',
              },
              onClick: () => state.topClicks++,
            }),
          ],
        })],
      })],
    })],
  });
  const controller = crc(canvas, createScene());

  return {
    controller,
    getState: () => ({ ...state }),
    resize(width, height) {
      canvas.width = width;
      canvas.height = height;
      crc(canvas, createScene());
    },
  };
}

function settled(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() =>
    requestAnimationFrame(() => resolve()),
  ));
}

const layoutFoundationScenario: ScenarioDefinition<LayoutFoundationState> = {
  id: 'layout-foundation',
  sourceId: LAYOUT_FOUNDATION_SOURCE_ID,
  actionIds: ['resize'],
  async mount({ canvas, onStateChange }) {
    let mounted = mountLayoutFoundation(canvas);
    const notify = () => onStateChange?.(mounted.getState());
    await settled();
    notify();
    return {
      getState: () => mounted.getState(),
      async perform(actionId) {
        if (actionId !== 'resize') throw new Error(`Unknown action: ${actionId}`);
        mounted.resize(480, 360);
        await settled();
        notify();
      },
      async reset() {
        mounted.controller.dispose();
        canvas.width = 720;
        canvas.height = 420;
        mounted = mountLayoutFoundation(canvas);
        await settled();
        notify();
      },
      async settled() { await settled(); notify(); },
      async dispose() { mounted.controller.dispose(); },
    };
  },
  formatState: state => [
    { label: 'Keyed clicks', value: String(state.keyedClicks) },
    { label: 'Top clicks', value: String(state.topClicks) },
    { label: 'Clipped clicks', value: String(state.clippedClicks) },
    { label: 'Observed box', value: state.observedBox ?
      `${state.observedBox.width} × ${state.observedBox.height}` : 'pending' },
  ],
};

export default layoutFoundationScenario;
