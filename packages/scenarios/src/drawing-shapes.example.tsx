import { Path, Rectangle, SvgPath } from '@crc/core';
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
const DrawingShapesScene = ({ state }: DrawingShapesSceneProps) => [
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
  <Rectangle
    key="rectangle"
    style={{
      x: state.updated ? 28 : 20,
      y: state.updated ? 26 : 20,
      width: state.updated ? 132 : 120,
      height: state.updated ? 70 : 80,
      fill: state.updated ? '#7c3aed' : '#2563eb',
      stroke: '#0f172a',
      strokeWidth: 3,
      alignToPixelGrid: 'round',
    }}
  />,
  <Path
    key="triangle"
    style={{
      d: trianglePath(state.updated),
      fill: state.updated ? '#ec4899' : '#f59e0b',
      stroke: '#0f172a',
      strokeWidth: 3,
    }}
  />,
  <SvgPath
    key="svg-diamond"
    style={{
      d: state.updated
        ? 'M 346 62 L 396 18 L 446 62 L 396 106 Z'
        : 'M 350 62 L 396 24 L 442 62 L 396 100 Z',
      fill: state.updated ? '#14b8a6' : '#10b981',
      stroke: '#0f172a',
      strokeWidth: 3,
    }}
  />, // These underlays make invisible and boundary behavior easy to inspect.
  <Rectangle
    style={{
      x: 20,
      y: 142,
      width: 72,
      height: 62,
      fill: '#ef4444',
    }}
  />,
  <Rectangle
    style={{
      x: 20,
      y: 142,
      width: 72,
      height: 62,
      fill: '#2563eb',
      opacity: 0,
    }}
  />,
  <Rectangle
    style={{
      x: 120,
      y: 142,
      width: 72,
      height: 62,
      fill: '#22c55e',
    }}
  />,
  <Path
    style={{
      d: new Path2D('M 120 142 H 192 V 204 H 120 Z'),
      fill: 'transparent',
    }}
  />,
  <Rectangle
    style={{
      x: 294,
      y: 142,
      width: 72,
      height: 62,
      fill: '#e2e8f0',
    }}
  />,
  <Path
    style={{
      d: emptyPath(),
      fill: '#0f172a',
    }}
  />,
  <Rectangle
    style={{
      x: 454,
      y: 142,
      width: -62,
      height: 62,
      fill: '#6366f1',
    }}
  />,
];
export function createDrawingShapesScene(state: Readonly<DrawingShapesState>) {
  return <DrawingShapesScene state={state} />;
}
