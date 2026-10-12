import type { responsiveStylesScenarioEntry } from './catalog.js';
import {
  pibbl, Flow, Grid, Group, Rectangle, Text, signal, useCanvasContext, useConst, useLayoutBox,
  type BoxStyle, type PibblResponsiveStyle, type FlowStyle, type LayoutItemStyle,
} from '@pibbl/core';
import type { ScenarioDefinition } from './types';

export const RESPONSIVE_STYLES_SOURCE_ID = 'responsive-styles-lab-example';
export interface ResponsiveRegionState {
  width: number;
  height: number;
  x: number;
  y: number;
  identity: number;
}
/**
 * Observable state exposed by the responsive styles scenario for controls and assertions.
 *
 * @see {@link responsiveStylesScenarioEntry}
 */
export interface ResponsiveStylesState {
  /** Root recorded or configured by this scenario. See {@link ResponsiveRegionState}. */
  root: ResponsiveRegionState | null;
  /** Cell recorded or configured by this scenario. See {@link ResponsiveRegionState}. */
  cell: ResponsiveRegionState | null;
}
export const RESPONSIVE_STYLE_ACTIONS = [
  ...[360, 599, 600, 601, 1000].map(width => ({ id: `root-width-${width}`, label: `Root width ${width}` })),
  ...[320, 599, 600, 601].map(width => ({ id: `cell-width-${width}`, label: `Cell width ${width}` })),
  ...[119, 120, 121, 160].map(height => ({ id: `cell-height-${height}`, label: `Cell height ${height}` })),
  { id: 'gap-20', label: 'Base gap 20' },
];

export const responsiveStylesScenario: ScenarioDefinition<ResponsiveStylesState> = {
  id: 'responsive-styles',
  sourceId: RESPONSIVE_STYLES_SOURCE_ID,
  actionIds: RESPONSIVE_STYLE_ACTIONS.map(action => action.id),
  async mount({ canvas, onStateChange }) {
    let disposed = false;
    let nextIdentity = 0;
    const width = signal(320);
    const height = signal(160);
    const gap = signal(12);
    let state: ResponsiveStylesState = { root: null, cell: null };
    const contentStyle = {
      width: '100%', height: 112, direction: 'vertical', gap,
      when: [
        { query: { minWidth: 600 }, style: { direction: 'horizontal', height: 44 } },
        { query: { maxHeight: 120 }, style: { gap: 8 } },
      ],
    } satisfies PibblResponsiveStyle<FlowStyle>;
    function Second({ region, identity, available }: {
      style: BoxStyle;
      region: 'root' | 'cell'; identity: number;
      available: Readonly<{ width: number; height: number }>;
    }) {
      const matrix = useCanvasContext().getTransform();
      state = { ...state, [region]: {
        width: available.width, height: available.height,
        x: matrix.e, y: matrix.f, identity,
      } };
      onStateChange?.(state);
      return <Rectangle style={{ width: 112, height: 44, fill: '#167e9c' }} />;
    }
    function Actions({ region, style: placementStyle }: {
      region: 'root' | 'cell'; style?: BoxStyle & LayoutItemStyle;
    }) {
      void placementStyle;
      const available = useLayoutBox();
      const identity = useConst(() => ++nextIdentity);
      return <Flow style={contentStyle}>
        <Rectangle style={{ width: 112, height: 44, fill: '#17324d' }} />
        <Second region={region} identity={identity} available={available} style={{ width: 112, height: 44 }} />
      </Flow>;
    }
    function Scene() {
      return <Group>
        <Text style={{ left: 0, top: 10, font: '16px sans-serif' }}>Root allocation</Text>
        <Group style={{ translateY: 40 }}><Actions region="root" /></Group>
        <Text style={{ left: 0, top: 210, font: '16px sans-serif' }}>Assigned Grid cell</Text>
        <Group style={{ translateY: 240 }}>
          <Grid style={{ gridTemplateColumns: [width.get()], gridTemplateRows: [height.get()] }}>
            <Actions region="cell" style={{ width: '100%', height: '100%', gridColumnStart: 1, gridRowStart: 1 }} />
          </Grid>
        </Group>
      </Group>;
    }
    const settle = async () => {
      for (let index = 0; index < 3; index++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    };
    const assertActive = () => {
      if (disposed) throw new Error('The responsive styles laboratory is disposed.');
    };
    canvas.style.width = '1000px';
    canvas.style.height = '600px';
    const controller = pibbl(canvas, <Scene />, { viewport: 'responsive', pixelRatio: 1 });
    await settle();
    return {
      getState: () => structuredClone(state),
      async perform(action) {
        assertActive();
        if (!RESPONSIVE_STYLE_ACTIONS.some(item => item.id === action)) throw new Error(`Unknown responsive style action: ${action}`);
        if (action.startsWith('root-width-')) canvas.style.width = `${Number(action.slice(11))}px`;
        else if (action.startsWith('cell-width-')) width.set(Number(action.slice(11)));
        else if (action.startsWith('cell-height-')) height.set(Number(action.slice(12)));
        else gap.set(20);
        await settle();
      },
      async reset() {
        assertActive();
        canvas.style.width = '1000px';
        width.set(320);
        height.set(160);
        gap.set(12);
        await settle();
      },
      settled: settle,
      async dispose() {
        if (disposed) return;
        disposed = true;
        controller.dispose();
      },
    };
  },
  formatState: state => ['root', 'cell'].map(region => {
    const value = state[region as keyof ResponsiveStylesState];
    return { label: region, value: value ? `${value.width} × ${value.height}; second target (${value.x}, ${value.y}); identity ${value.identity}` : 'pending' };
  }),
};
