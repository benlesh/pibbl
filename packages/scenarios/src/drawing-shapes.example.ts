import {
  defineComp,
  path,
  rect,
  svgPath,
} from '@crc/core';

export const DRAWING_SHAPES_SOURCE_ID = 'drawing-shapes-example';

export type DrawingShapesAction = 'mount' | 'reset' | 'update-shapes';

export interface DrawingShapesState {
  lastAction: DrawingShapesAction;
  revision: number;
  updated: boolean;
}

interface DrawingShapesSceneProps {
  state: Readonly<DrawingShapesState>;
}

function trianglePath(updated: boolean): Path2D {
  const triangle = new Path2D();
  triangle.moveTo(205, updated ? 105 : 98);
  triangle.lineTo(updated ? 292 : 278, 98);
  triangle.lineTo(242, updated ? 22 : 28);
  triangle.closePath();
  return triangle;
}

function emptyPath(): Path2D {
  return new Path2D();
}

const DrawingShapesScene = defineComp<DrawingShapesSceneProps>(({ state }) => [
  rect({
    key: 'background',
    x: 0,
    y: 0,
    width: 480,
    height: 240,
    fillStyle: '#f8fafc',
  }),
  rect({
    key: 'rectangle',
    x: state.updated ? 28 : 20,
    y: state.updated ? 26 : 20,
    width: state.updated ? 132 : 120,
    height: state.updated ? 70 : 80,
    fillStyle: state.updated ? '#7c3aed' : '#2563eb',
    strokeStyle: '#0f172a',
    lineWidth: 3,
    alignToPixelGrid: 'round',
  }),
  path({
    key: 'triangle',
    path: trianglePath(state.updated),
    fillStyle: state.updated ? '#ec4899' : '#f59e0b',
    strokeStyle: '#0f172a',
    lineWidth: 3,
  }),
  svgPath({
    key: 'svg-diamond',
    d: state.updated ?
        'M 346 62 L 396 18 L 446 62 L 396 106 Z' :
      'M 350 62 L 396 24 L 442 62 L 396 100 Z',
    fillStyle: state.updated ? '#14b8a6' : '#10b981',
    strokeStyle: '#0f172a',
    lineWidth: 3,
  }),

  // These underlays make invisible and boundary behavior easy to inspect.
  rect({ x: 20, y: 142, width: 72, height: 62, fillStyle: '#ef4444' }),
  rect({ x: 20, y: 142, width: 72, height: 62, fillStyle: '#2563eb', alpha: 0 }),
  rect({ x: 120, y: 142, width: 72, height: 62, fillStyle: '#22c55e' }),
  path({
    path: new Path2D('M 120 142 H 192 V 204 H 120 Z'),
    fillStyle: 'transparent',
  }),
  rect({ x: 294, y: 142, width: 72, height: 62, fillStyle: '#e2e8f0' }),
  path({ path: emptyPath(), fillStyle: '#0f172a' }),
  rect({
    x: 454,
    y: 142,
    width: -62,
    height: 62,
    fillStyle: '#6366f1',
  }),
]);

export function createDrawingShapesScene(
  state: Readonly<DrawingShapesState>,
): ReturnType<typeof DrawingShapesScene> {
  return DrawingShapesScene({ state });
}
