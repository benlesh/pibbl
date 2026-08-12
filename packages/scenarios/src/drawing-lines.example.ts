import {
  defineComp,
  horizontalLine,
  line,
  rect,
  verticalLine,
} from '@crc/core';

export const DRAWING_LINES_SOURCE_ID = 'drawing-lines-example';

export type DrawingLinesAction = 'mount' | 'reset' | 'update-lines';

export interface DrawingLinesState {
  lastAction: DrawingLinesAction;
  revision: number;
  updated: boolean;
}

interface DrawingLinesSceneProps {
  state: Readonly<DrawingLinesState>;
}

const DrawingLinesScene = defineComp<DrawingLinesSceneProps>(({ state }) => [
  rect({
    key: 'background',
    x: 0,
    y: 0,
    width: 480,
    height: 240,
    fillStyle: '#f8fafc',
  }),
  line({
    key: 'polyline',
    coords: state.updated ?
        [[24, 92], [92, 28], [160, 102], [226, 42]] :
      [[24, 82], [92, 34], [160, 96], [226, 26]],
    strokeStyle: state.updated ? '#7c3aed' : '#2563eb',
    lineWidth: state.updated ? 8 : 6,
  }),
  horizontalLine({
    key: 'horizontal',
    y: state.updated ? 152.2 : 142.2,
    left: 24,
    right: 456,
    strokeStyle: '#f59e0b',
    lineWidth: 1,
    alignToPixelGrid: 'round',
  }),
  verticalLine({
    key: 'vertical',
    x: state.updated ? 332.2 : 312.2,
    top: 20,
    bottom: 218,
    strokeStyle: '#10b981',
    lineWidth: 1,
    alignToPixelGrid: 'round',
  }),
  line({
    key: 'empty-line',
    coords: [],
    strokeStyle: '#ef4444',
    lineWidth: 12,
  }),
]);

export function createDrawingLinesScene(
  state: Readonly<DrawingLinesState>,
): ReturnType<typeof DrawingLinesScene> {
  return DrawingLinesScene({ state });
}
