import {
  useLayoutBox,
  useRef,
  Rectangle,
  Text,
  type LayoutBox,
} from '@crc/core';
export const CANVAS_SURFACE_SOURCE_ID = 'canvas-surface-example';
export type CanvasSurfaceMode = 'fixed' | 'responsive';
export type CanvasSurfaceAction =
  | 'mount'
  | 'resize-fixed'
  | 'show-responsive'
  | 'resize-responsive'
  | 'mousemove'
  | 'reset';
export interface CanvasSurfaceState {
  mode: CanvasSurfaceMode;
  cssWidth: number;
  cssHeight: number;
  logicalWidth: number;
  logicalHeight: number;
  backingWidth: number;
  backingHeight: number;
  pixelRatio: number;
  identity: number;
  renders: number;
  lastCoordinates: readonly [number, number] | null;
  lastAction: CanvasSurfaceAction;
}
interface CanvasSurfaceSceneProps {
  mode: CanvasSurfaceMode;
  onMouseMove: (x: number, y: number) => void;
  onRender: (box: Readonly<LayoutBox>, identity: number) => void;
}
let nextIdentity = 0;
const CanvasSurfaceScene = ({
  mode,
  onMouseMove,
  onRender,
}: CanvasSurfaceSceneProps) => {
  const identity = useRef<number>();
  identity.current ??= ++nextIdentity;
  const box = useLayoutBox();
  onRender(box, identity.current);
  return [
    <Rectangle
      style={{
        width: box.width,
        height: box.height,
        fill: '#f8fafc',
      }}
      onMouseMove={(event) => onMouseMove(event.x, event.y)}
    />,
    <Rectangle
      pointerEvents="none"
      style={{
        x: box.width / 4,
        y: box.height / 4,
        width: box.width / 2,
        height: box.height / 2,
        fill: mode === 'fixed' ? '#2563eb' : '#10b981',
        stroke: '#0f172a',
        strokeWidth: 2,
      }}
    />,
    <Text
      pointerEvents="none"
      style={{
        x: box.width / 2,
        y: box.height / 2,
        textAlign: 'center',
        textBaseline: 'middle',
        font: '700 16px Arial',
        fill: '#ffffff',
      }}
    >{`${mode} · ${Math.round(box.width)} × ${Math.round(box.height)}`}</Text>,
  ];
};
export function createCanvasSurfaceScene(props: CanvasSurfaceSceneProps) {
  return <CanvasSurfaceScene {...props} />;
}
