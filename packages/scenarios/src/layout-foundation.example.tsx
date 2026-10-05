import {
  Absolute,
  crc,
  useLayoutBox,
  useSignal,
  Flex,
  Flow,
  Grid,
  Image,
  Overlay,
  Rectangle,
  Text,
  type BoxStyle,
  type CRCController,
  type CRCNode,
  type FlexItemStyle,
  type GridItemStyle,
  type OverlayStyle,
} from '@crc/core';
import type { ScenarioDefinition } from './types';
export const LAYOUT_FOUNDATION_SOURCE_ID = 'layout-foundation-example';
/**
 * Observable state exposed by the layout foundation scenario for controls and assertions.
 *
 * @see {@link LayoutFoundationMount}
 */
export interface LayoutFoundationState {
  /** Top clicks recorded or configured by this scenario. See {@link LayoutFoundationState}. */
  topClicks: number;
  /** Keyed clicks recorded or configured by this scenario. See {@link LayoutFoundationState}. */
  keyedClicks: number;
  /** Clipped clicks recorded or configured by this scenario. See {@link LayoutFoundationState}. */
  clippedClicks: number;
  /** Observed box recorded or configured by this scenario. See {@link LayoutFoundationState}. */
  observedBox?: Readonly<{
    /** X recorded or configured by this scenario. See {@link LayoutFoundationState}. */
    x: number;
    /** Y recorded or configured by this scenario. See {@link LayoutFoundationState}. */
    y: number;
    /** Width recorded or configured by this scenario. See {@link LayoutFoundationState}. */
    width: number;
    /** Height recorded or configured by this scenario. See {@link LayoutFoundationState}. */
    height: number;
  }>;
}
/**
 * Controls and owned cleanup returned by the mounted layout-foundation example.
 *
 * @see {@link CRCController}
 * @see {@link LayoutFoundationState}
 * @see {@link mountLayoutFoundation}
 */
export interface LayoutFoundationMount {
  /** Controller recorded or configured by this scenario. See {@link CRCController}. */
  readonly controller: CRCController;
  /**
   * Reads the current public layout demonstration state. See {@link LayoutFoundationState}.
   * @returns The example's current semantic state. See {@link LayoutFoundationState}.
   */
  getState(): Readonly<LayoutFoundationState>;
  /**
   * Changes the demonstration's available layout dimensions. See {@link LayoutFoundationMount}.
   * @param width - New logical canvas width.
   * @param height - New logical canvas height.
   */
  resize(width: number, height: number): void;
}
interface ProbeProps {
  state: LayoutFoundationState;
  style: ProbeStyle;
}
interface ProbeStyle extends BoxStyle {
  fill: string;
}
function KeyedProbe({ state, style }: ProbeProps): CRCNode {
  const clicks = useSignal(0);
  const box = useLayoutBox();
  state.keyedClicks = clicks.get();
  state.observedBox = {
    ...box,
  };
  return (
    <Rectangle
      style={{
        width: box.width,
        height: box.height,
        fill: style.fill,
      }}
      onClick={() => clicks.update((value) => value + 1)}
    />
  );
}
const imageSource =
  'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2224%22%20height=%2224%22%3E%3Crect%20width=%2224%22%20height=%2224%22%20fill=%22%23f7c948%22/%3E%3C/svg%3E';
/**
 * Mounts the layout-foundation demonstration on a caller-owned canvas and returns its controls.
 *
 * @param canvas - Canvas on which to mount the layout example.
 * @returns Controls for inspecting, resizing, and disposing the example. See
 * {@link LayoutFoundationMount} .
 *
 * @see {@link LayoutFoundationMount}
 */
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
  } satisfies Parameters<typeof Grid>[0]['style'] & FlexItemStyle;
  const overlayStyle = {
    width: 'auto',
    height: 'auto',
    gridColumnStart: 1,
    gridRowStart: 1,
    overflow: 'clip',
    alignItems: 'center',
    justifyItems: 'center',
  } satisfies OverlayStyle & GridItemStyle;
  const createScene = () => (
    <Absolute
      style={{
        width: '100%',
        height: '100%',
      }}
    >
      <Flex
        style={{
          width: '100%',
          height: '100%',
        }}
      >
        <Grid style={gridStyle}>
          <Overlay style={overlayStyle}>
            <KeyedProbe
              key="keyed-probe"
              state={state}
              style={{
                width: '100%',
                height: '100%',
                fill: '#0e7490',
              }}
            />
            <Flow
              style={
                {
                  width: 180,
                  height: 24,
                  alignSelf: 'start',
                  justifySelf: 'start',
                } as Parameters<typeof Flow>[0]['style']
              }
            >
              <Text
                style={{
                  font: '800 14px sans-serif',
                  fill: '#ffffff',
                }}
              >
                {'MEASURED TEXT'}
              </Text>
            </Flow>
            <Image
              style={{
                src: imageSource,
                width: 24,
                height: 24,
                alignSelf: 'start',
                justifySelf: 'end',
              }}
            />
            <Rectangle
              style={{
                width: 520,
                height: 50,
                fill: '#7c3aed',
                alignSelf: 'end',
                justifySelf: 'center',
              }}
              onClick={() => state.clippedClicks++}
            />
            <Rectangle
              style={{
                width: 120,
                height: 80,
                fill: '#f97316',
                alignSelf: 'center',
                justifySelf: 'center',
              }}
              onClick={() => state.topClicks++}
            />
          </Overlay>
        </Grid>
      </Flex>
    </Absolute>
  );
  const controller = crc(canvas, createScene(), {
    viewport: 'responsive',
  });
  return {
    controller,
    getState: () => ({
      ...state,
    }),
    resize(width, height) {
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      crc(canvas, createScene());
    },
  };
}
function settled(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
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
        if (actionId !== 'resize')
          throw new Error(`Unknown action: ${actionId}`);
        mounted.resize(480, 360);
        await settled();
        notify();
      },
      async reset() {
        mounted.controller.dispose();
        canvas.style.width = '720px';
        canvas.style.height = '420px';
        mounted = mountLayoutFoundation(canvas);
        await settled();
        notify();
      },
      async settled() {
        await settled();
        notify();
      },
      async dispose() {
        mounted.controller.dispose();
      },
    };
  },
  formatState: (state) => [
    {
      label: 'Keyed clicks',
      value: String(state.keyedClicks),
    },
    {
      label: 'Top clicks',
      value: String(state.topClicks),
    },
    {
      label: 'Clipped clicks',
      value: String(state.clippedClicks),
    },
    {
      label: 'Observed box',
      value: state.observedBox
        ? `${state.observedBox.width} × ${state.observedBox.height}`
        : 'pending',
    },
  ],
};
export default layoutFoundationScenario;
