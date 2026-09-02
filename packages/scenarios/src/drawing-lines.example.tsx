import { HorizontalLine, Line, Rectangle, VerticalLine } from '@crc/core';
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
const DrawingLinesScene = ({ state }: DrawingLinesSceneProps) => [
  <Rectangle
    key="background"
    style={{
      x: 0,
      y: 0,
      width: 480,
      height: 240,
      fill: '#f8fafc',
    }}
  />,
  <Line
    key="polyline"
    style={{
      coords: state.updated
        ? [
            [24, 92],
            [92, 28],
            [160, 102],
            [226, 42],
          ]
        : [
            [24, 82],
            [92, 34],
            [160, 96],
            [226, 26],
          ],
      stroke: state.updated ? '#7c3aed' : '#2563eb',
      strokeWidth: state.updated ? 8 : 6,
    }}
  />,
  <HorizontalLine
    key="horizontal"
    style={{
      y: state.updated ? 152.2 : 142.2,
      x1: 24,
      x2: 456,
      stroke: '#f59e0b',
      strokeWidth: 1,
      alignToPixelGrid: 'round',
    }}
  />,
  <VerticalLine
    key="vertical"
    style={{
      x: state.updated ? 332.2 : 312.2,
      y1: 20,
      y2: 218,
      stroke: '#10b981',
      strokeWidth: 1,
      alignToPixelGrid: 'round',
    }}
  />,
  <Line
    key="empty-line"
    style={{
      coords: [],
      stroke: '#ef4444',
      strokeWidth: 12,
    }}
  />,
];
export function createDrawingLinesScene(state: Readonly<DrawingLinesState>) {
  return <DrawingLinesScene state={state} />;
}
