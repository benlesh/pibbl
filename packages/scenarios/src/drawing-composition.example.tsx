import { Clip, Group, Layer, Rectangle, SvgPath } from '@crc/core';
export const DRAWING_COMPOSITION_SOURCE_ID = 'drawing-composition-example';
export type DrawingCompositionAction = 'mount' | 'reset' | 'update-composition';
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
const LayerArtwork = ({ updated }: LayerArtworkProps) => [
  <Rectangle
    style={{
      x: 0,
      y: 0,
      width: 112,
      height: 92,
      fill: updated ? '#fbcfe8' : '#dbeafe',
    }}
  />,
  <SvgPath
    style={{
      d: updated ? 'M 20 72 L 56 16 L 92 72 Z' : 'M 18 18 H 94 V 74 H 18 Z',
      fill: updated ? '#ec4899' : '#2563eb',
    }}
  />,
];
function clipPath(updated: boolean): Path2D {
  const path = new Path2D();
  if (updated) {
    path.roundRect(184, 38, 118, 116, 22);
  } else {
    path.arc(243, 96, 58, 0, Math.PI * 2);
  }
  return path;
}
const DrawingCompositionScene = ({ state }: DrawingCompositionSceneProps) => [
  <Rectangle
    style={{
      x: 0,
      y: 0,
      width: 480,
      height: 240,
      fill: '#f8fafc',
    }}
  />,
  <Group
    style={{
      translateX: state.updated ? 34 : 24,
      translateY: state.updated ? 40 : 30,
      rotationDegrees: state.updated ? 12 : 0,
      rotationOrigin: [58, 52],
    }}
    key="transformed-group"
  >
    <Rectangle
      style={{
        x: 0,
        y: 0,
        width: 116,
        height: 104,
        fill: '#bfdbfe',
      }}
    />
    <Rectangle
      style={{
        x: 18,
        y: 18,
        width: 80,
        height: 68,
        fill: '#2563eb',
      }}
    />
  </Group>,
  <Clip
    style={{
      d: clipPath(state.updated),
    }}
  >
    <Rectangle
      style={{
        x: 174,
        y: 28,
        width: 138,
        height: 136,
        fill: '#fef3c7',
      }}
    />
    <Rectangle
      style={{
        x: 190,
        y: 44,
        width: 106,
        height: 104,
        fill: '#f59e0b',
      }}
    />
  </Clip>,
  <Clip
    style={{
      d: new Path2D(
        'M 210 54 H 276 V 138 H 210 Z M 228 74 H 258 V 118 H 228 Z',
      ),
      fillRule: 'evenodd',
    }}
  >
    <Rectangle
      style={{
        x: 210,
        y: 54,
        width: 66,
        height: 84,
        fill: '#fef3c7',
      }}
    />
  </Clip>,
  <Group
    style={{
      translateX: 344,
      translateY: 36,
    }}
    key="layer-position"
  >
    <Layer
      style={{
        width: 112,
        height: 92,
      }}
      key="artwork-layer"
    >
      <LayerArtwork updated={state.updated} />
    </Layer>
  </Group>,
  <Rectangle
    style={{
      x: 24,
      y: 190,
      width: 432,
      height: 20,
      fill: '#e2e8f0',
    }}
  />,
];
export function createDrawingCompositionScene(
  state: Readonly<DrawingCompositionState>,
) {
  return <DrawingCompositionScene state={state} />;
}
