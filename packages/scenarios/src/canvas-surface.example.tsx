import type { canvasSurfaceScenarioEntry } from './catalog.js';
import {
  useLayoutBox,
  useRef,
  Rectangle,
  Text,
  type LayoutBox,
} from '@crc/core';
export const CANVAS_SURFACE_SOURCE_ID = 'canvas-surface-example';
/**
 * Supported canvas surface mode values: `"fixed"`, `"responsive"`.
 *
 * @see {@link CanvasSurfaceState}
 */
export type CanvasSurfaceMode = 'fixed' | 'responsive';
/**
 * Actions supported by the canvas surface scenario's public controller.
 *
 * @see {@link CanvasSurfaceState}
 */
export type CanvasSurfaceAction =
  | 'mount'
  | 'resize-fixed'
  | 'show-responsive'
  | 'resize-responsive'
  | 'mousemove'
  | 'reset';
/**
 * Observable state exposed by the canvas surface scenario for controls and assertions.
 *
 * @see {@link CanvasSurfaceMode}
 * @see {@link CanvasSurfaceAction}
 * @see {@link canvasSurfaceScenarioEntry}
 */
export interface CanvasSurfaceState {
  /** Mode recorded or configured by this scenario. See {@link CanvasSurfaceMode}. */
  mode: CanvasSurfaceMode;
  /** Css width recorded or configured by this scenario. See {@link CanvasSurfaceState}. */
  cssWidth: number;
  /** Css height recorded or configured by this scenario. See {@link CanvasSurfaceState}. */
  cssHeight: number;
  /** Logical width recorded or configured by this scenario. See {@link CanvasSurfaceState}. */
  logicalWidth: number;
  /** Logical height recorded or configured by this scenario. See {@link CanvasSurfaceState}. */
  logicalHeight: number;
  /** Backing width recorded or configured by this scenario. See {@link CanvasSurfaceState}. */
  backingWidth: number;
  /** Backing height recorded or configured by this scenario. See {@link CanvasSurfaceState}. */
  backingHeight: number;
  /** Pixel ratio recorded or configured by this scenario. See {@link CanvasSurfaceState}. */
  pixelRatio: number;
  /** Identity recorded or configured by this scenario. See {@link CanvasSurfaceState}. */
  identity: number;
  /** Renders recorded or configured by this scenario. See {@link CanvasSurfaceState}. */
  renders: number;
  /** Last coordinates recorded or configured by this scenario. See {@link CanvasSurfaceState}. */
  lastCoordinates: readonly [number, number] | null;
  /** Last action recorded or configured by this scenario. See {@link CanvasSurfaceAction}. */
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
        left: box.width / 4,
        top: box.height / 4,
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
        left: box.width / 2,
        top: box.height / 2,
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
