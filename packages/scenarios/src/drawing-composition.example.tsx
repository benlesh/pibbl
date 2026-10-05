import type { drawingCompositionScenarioEntry } from './catalog.js';
import { Clip, Group, Layer, Rectangle, SvgPath } from '@crc/core';
export const DRAWING_COMPOSITION_SOURCE_ID = 'drawing-composition-example';
/**
 * Actions supported by the drawing composition scenario's public controller.
 *
 * @see {@link DrawingCompositionState}
 */
export type DrawingCompositionAction = 'mount' | 'reset' | 'update-composition';
/**
 * Observable state exposed by the drawing composition scenario for controls and assertions.
 *
 * @see {@link DrawingCompositionAction}
 * @see {@link drawingCompositionScenarioEntry}
 */
export interface DrawingCompositionState {
  /** Last action recorded or configured by this scenario. See {@link DrawingCompositionAction}. */
  lastAction: DrawingCompositionAction;
  /** Revision recorded or configured by this scenario. See {@link DrawingCompositionState}. */
  revision: number;
  /** Updated recorded or configured by this scenario. See {@link DrawingCompositionState}. */
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
      left: 0,
      top: 0,
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
      left: 0,
      top: 0,
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
        left: 0,
        top: 0,
        width: 116,
        height: 104,
        fill: '#bfdbfe',
      }}
    />
    <Rectangle
      style={{
        left: 18,
        top: 18,
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
        left: 174,
        top: 28,
        width: 138,
        height: 136,
        fill: '#fef3c7',
      }}
    />
    <Rectangle
      style={{
        left: 190,
        top: 44,
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
        left: 210,
        top: 54,
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
      left: 24,
      top: 190,
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
