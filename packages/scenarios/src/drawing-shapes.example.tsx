import {
  Arc,
  Circle,
  Clip,
  createRegularPolygonPath,
  Ellipse,
  Path,
  Polygon,
  Rectangle,
  RegularPolygon,
  Star,
  SvgPath,
  Wedge,
} from '@crc/core';
export const DRAWING_SHAPES_SOURCE_ID = 'drawing-shapes-example';
export type DrawingShapesAction =
  | 'mount'
  | 'reset'
  | 'update-shapes'
  | 'star-hit'
  | 'rounded-cut-miss'
  | 'clipped-hit'
  | 'clipped-miss';
export interface DrawingShapesState {
  clippedHits: number;
  clippedMisses: number;
  lastAction: DrawingShapesAction;
  revision: number;
  roundedCutMisses: number;
  starHits: number;
  updated: boolean;
}
interface DrawingShapesSceneProps {
  onClippedHit: () => void;
  onClippedMiss: () => void;
  onRoundedCutMiss: () => void;
  onStarHit: () => void;
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
function clipHexagon(): Path2D {
  return createRegularPolygonPath({
    sides: 6,
    cx: 390,
    cy: 180,
    inradius: 36,
  });
}
export const DrawingShapesScene = ({
  onClippedHit,
  onClippedMiss,
  onRoundedCutMiss,
  onStarHit,
  state,
}: DrawingShapesSceneProps) => [
  <Rectangle
    key="background"
    style={{
      left: 0,
      top: 0,
      width: 480,
      height: 240,
      fill: '#f8fafc',
    }}
  />,
  <Rectangle
    key="rectangle"
    style={{
      left: state.updated ? 28 : 20,
      top: state.updated ? 26 : 20,
      width: state.updated ? 132 : 120,
      height: state.updated ? 70 : 80,
      cornerRadius: 18,
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
  />,
  <RegularPolygon
    key="regular-polygon"
    style={{
      sides: 6,
      cx: 320,
      cy: 60,
      circumradius: state.updated ? 36 : 32,
      rotation: Math.PI / 6,
      fill: state.updated ? '#8b5cf6' : '#6366f1',
      stroke: '#0f172a',
      strokeWidth: 3,
    }}
  />,
  <Circle
    key="circle"
    style={{
      cx: 30,
      cy: 124,
      radius: 10,
      fill: state.updated ? '#8b5cf6' : '#0ea5e9',
    }}
  />,
  <Ellipse
    key="ellipse"
    style={{
      cx: 78,
      cy: 124,
      radiusX: 14,
      radiusY: 8,
      fill: state.updated ? '#ec4899' : '#f97316',
    }}
  />,
  <Arc
    key="arc"
    style={{
      cx: 125,
      cy: 124,
      radius: 12,
      startAngle: 0,
      endAngle: Math.PI,
      stroke: state.updated ? '#facc15' : '#14b8a6',
      strokeWidth: 6,
    }}
  />,
  <Wedge
    key="wedge"
    style={{
      cx: 170,
      cy: 124,
      radius: 12,
      startAngle: 0,
      endAngle: Math.PI / 2,
      fill: state.updated ? '#22c55e' : '#a855f7',
    }}
  />,
  <Polygon
    key="polygon"
    style={{
      coords: [
        [220, 114],
        [232, 120],
        [230, 134],
        [210, 134],
        [208, 120],
      ],
      fill: state.updated ? '#3b82f6' : '#f43f5e',
    }}
  />,
  <Rectangle
    key="rounded-cut-underlay"
    style={{
      left: 20,
      top: 142,
      width: 92,
      height: 64,
      fill: '#ef4444',
    }}
    onClick={onRoundedCutMiss}
  />,
  <Rectangle
    key="rounded-rectangle"
    style={{
      left: 20,
      top: 142,
      width: 92,
      height: 64,
      fill: '#2563eb',
      cornerRadius: 22,
    }}
  />,
  <Polygon
    key="rounded-polygon"
    style={{
      coords: [
        [150, 145],
        [190, 150],
        [198, 190],
        [170, 208],
        [135, 185],
      ],
      cornerRadius: 10,
      fill: state.updated ? '#f59e0b' : '#f7c948',
      stroke: '#0f172a',
      strokeWidth: 2,
    }}
  />,
  <Star
    key="star"
    style={{
      points: 5,
      cx: 270,
      cy: 180,
      outerRadius: 30,
      innerRadius: 14,
      cornerRadii: [6, 0, 6, 0, 6, 0, 6, 0, 6, 0],
      fill: state.updated ? '#ec4899' : '#f43f5e',
      stroke: '#0f172a',
      strokeWidth: 2,
    }}
    onClick={onStarHit}
  />,
  <Rectangle
    key="clip-underlay"
    style={{
      left: 345,
      top: 135,
      width: 90,
      height: 90,
      fill: '#f8fafc',
    }}
    onClick={onClippedMiss}
  />,
  <Clip key="hexagon-clip" style={{ d: clipHexagon() }}>
    <Rectangle
      style={{
        left: 345,
        top: 135,
        width: 90,
        height: 90,
        fill: state.updated ? '#22c55e' : '#14b8a6',
      }}
      onClick={onClippedHit}
    />
  </Clip>,
];
export function createDrawingShapesScene(
  state: Readonly<DrawingShapesState>,
  callbacks: Omit<DrawingShapesSceneProps, 'state'>,
) {
  return <DrawingShapesScene {...callbacks} state={state} />;
}
