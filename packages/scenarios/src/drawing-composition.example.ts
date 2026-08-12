import {
  clip,
  defineComp,
  g,
  layer,
  rect,
  svgPath,
} from '@crc/core';

export const DRAWING_COMPOSITION_SOURCE_ID = 'drawing-composition-example';

export type DrawingCompositionAction =
  | 'mount'
  | 'reset'
  | 'update-composition';

export interface DrawingCompositionState {
  lastAction: DrawingCompositionAction;
  revision: number;
  updated: boolean;
}

interface DrawingCompositionSceneProps {
  state: Readonly<DrawingCompositionState>;
}

interface LayerArtworkProps {
  updated: boolean;
}

const LayerArtwork = defineComp<LayerArtworkProps>(({ updated }) => [
  rect({
    x: 0,
    y: 0,
    width: 112,
    height: 92,
    fillStyle: updated ? '#fbcfe8' : '#dbeafe',
  }),
  svgPath({
    d: updated ? 'M 20 72 L 56 16 L 92 72 Z' : 'M 18 18 H 94 V 74 H 18 Z',
    fillStyle: updated ? '#ec4899' : '#2563eb',
  }),
]);

function clipPath(updated: boolean): Path2D {
  const path = new Path2D();
  if (updated) {
    path.roundRect(184, 38, 118, 116, 22);
  } else {
    path.arc(243, 96, 58, 0, Math.PI * 2);
  }
  return path;
}

const DrawingCompositionScene = defineComp<DrawingCompositionSceneProps>(({ state }) => [
  rect({ x: 0, y: 0, width: 480, height: 240, fillStyle: '#f8fafc' }),
  g({
    key: 'transformed-group',
    x: state.updated ? 34 : 24,
    y: state.updated ? 40 : 30,
    rotate: state.updated ? 12 : 0,
    rotateOrigin: [58, 52],
    children: [
      rect({ x: 0, y: 0, width: 116, height: 104, fillStyle: '#bfdbfe' }),
      rect({ x: 18, y: 18, width: 80, height: 68, fillStyle: '#2563eb' }),
    ],
  }),
  clip({
    path: clipPath(state.updated),
    children: [
      rect({ x: 174, y: 28, width: 138, height: 136, fillStyle: '#fef3c7' }),
      rect({ x: 190, y: 44, width: 106, height: 104, fillStyle: '#f59e0b' }),
    ],
  }),
  clip({
    path: new Path2D('M 210 54 H 276 V 138 H 210 Z M 228 74 H 258 V 118 H 228 Z'),
    fillRule: 'evenodd',
    children: [
      rect({ x: 210, y: 54, width: 66, height: 84, fillStyle: '#fef3c7' }),
    ],
  }),
  g({
    key: 'layer-position',
    x: 344,
    y: 36,
    children: [
      layer({
        key: 'artwork-layer',
        width: 112,
        height: 92,
        render: LayerArtwork({ updated: state.updated }),
      }),
    ],
  }),
  rect({ x: 24, y: 190, width: 432, height: 20, fillStyle: '#e2e8f0' }),
]);

export function createDrawingCompositionScene(
  state: Readonly<DrawingCompositionState>,
): ReturnType<typeof DrawingCompositionScene> {
  return DrawingCompositionScene({ state });
}
