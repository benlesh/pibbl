/** @jsxImportSource @crc/core */
import {
  Clip,
  FocusManagement,
  Group,
  Layer,
  Rectangle,
  Star,
  Text,
  type CRCNode,
} from '@crc/core';
import {
  Cube,
  Group3D,
  Sphere,
  WebGLLayer,
  defineWebGLPrimitive,
  type CRCWebGLContext,
  type CRCWebGLPerspectiveCamera,
} from '@crc/webgl';

export const WEBGL_LAB_SOURCE_ID = 'webgl-islands-laboratory-example';

export type WebGLLabMode =
  | 'mixed-order'
  | 'depth'
  | 'transforms'
  | 'clipped'
  | 'layered'
  | 'filtered'
  | 'focus'
  | 'animation'
  | 'context-restored';

export type WebGLLabTarget =
  | 'lower-canvas'
  | 'cube'
  | 'sphere'
  | 'upper-star';

export type WebGLLabFocusTarget = 'none' | 'cube' | 'sphere';

export interface WebGLLabState {
  mode: WebGLLabMode;
  revision: number;
  lastTarget: WebGLLabTarget | null;
  cubeSelections: number;
  sphereSelections: number;
  animationAngle: number;
  focusTarget: WebGLLabFocusTarget;
  contextGeneration: number;
}

export interface WebGLLabPoint {
  readonly x: number;
  readonly y: number;
}

export const WEBGL_LAB_PROBES = {
  lowerCanvas: { x: 24, y: 276 },
  cube: { x: 210, y: 150 },
  transparentIsland: { x: 240, y: 26 },
  upperStar: { x: 183, y: 150 },
  sphere: { x: 292, y: 150 },
  overlappingSphere: { x: 240, y: 150 },
  transformedCube: { x: 235, y: 128 },
  clippedVisible: { x: 210, y: 150 },
  clippedAway: { x: 292, y: 150 },
  layeredCube: { x: 240, y: 150 },
  filteredSource: { x: 225, y: 150 },
  filteredShadowOnly: { x: 380, y: 150 },
  focusCube: { x: 183, y: 150 },
  focusSphere: { x: 292, y: 150 },
} as const satisfies Readonly<Record<string, WebGLLabPoint>>;

interface WebGLLabSceneProps {
  readonly state: Readonly<WebGLLabState>;
  readonly camera?: CRCWebGLPerspectiveCamera;
  readonly rotationDegrees: number;
  readonly pointerEvents: 'auto' | 'none';
  readonly starFirst: boolean;
  readonly onTarget: (target: WebGLLabTarget) => void;
  readonly onCubeSelection: () => void;
  readonly onSphereSelection: () => void;
  readonly onCubeFocus: () => void;
  readonly onSphereFocus: () => void;
  readonly onCubeTarget: () => void;
  readonly onSphereTarget: () => void;
  readonly onContext: (context: CRCWebGLContext) => void;
}

interface ContextReporterProps {
  readonly onContext: (context: CRCWebGLContext) => void;
}

const ContextReporter = defineWebGLPrimitive<ContextReporterProps, {}>(
  function renderContextReporter(props, _style, context) {
    props.onContext(context);
  },
  { hit: { kind: 'none' } },
);

function rectanglePath(
  x: number,
  y: number,
  width: number,
  height: number,
): Path2D {
  const path = new Path2D();
  path.rect(x, y, width, height);
  return path;
}

function standardObjects(props: WebGLLabSceneProps): CRCNode {
  return (
    <>
      <Cube
        keyboardFocusable
        style={{
          size: 1.2,
          translateX: -0.8,
          color: '#8b5cf6',
          cursor: 'pointer',
        }}
        onClick={props.onCubeSelection}
        onFocus={props.onCubeFocus}
        onPointerDown={props.onCubeTarget}
      />
      <Sphere
        keyboardFocusable
        style={{
          radius: 0.6,
          translateX: 0.8,
          color: '#22c55e',
          cursor: 'pointer',
        }}
        onClick={props.onSphereSelection}
        onFocus={props.onSphereFocus}
        onTouchStart={props.onSphereTarget}
      />
      <ContextReporter
        pointerEvents="none"
        onContext={props.onContext}
      />
    </>
  );
}

function island(
  props: WebGLLabSceneProps,
  children: CRCNode,
  filtered = false,
  width = 480,
  height = 300,
): CRCNode {
  return (
    <WebGLLayer
      key="webgl-island"
      camera={props.camera}
      pointerEvents={props.pointerEvents}
      style={{
        width,
        height,
        filter: filtered
          ? {
              type: 'dropShadow',
              offsetX: 55,
              offsetY: 10,
              blurRadius: 3,
              color: '#0f172a',
            }
          : undefined,
      }}
    >
      {children}
    </WebGLLayer>
  );
}

function modeContent(props: WebGLLabSceneProps): CRCNode {
  switch (props.state.mode) {
    case 'depth':
      return island(
        props,
        <>
          <Sphere
            style={{ radius: 0.65, translateZ: 1, color: '#22c55e' }}
            onClick={props.onSphereSelection}
          />
          <Cube
            style={{ size: 1.1, color: '#8b5cf6' }}
            onClick={props.onCubeSelection}
          />
          <ContextReporter
            pointerEvents="none"
            onContext={props.onContext}
          />
        </>,
      );
    case 'transforms':
      return island(
        props,
        <>
          <Group3D
            style={{
              translateX: 0.3,
              translateY: 0.35,
              rotationYDegrees: props.rotationDegrees || 35,
            }}
          >
            <Cube
              style={{ size: 1.2, translateX: -0.35, color: '#f97316' }}
              onClick={props.onCubeSelection}
            />
          </Group3D>
          <ContextReporter
            pointerEvents="none"
            onContext={props.onContext}
          />
        </>,
      );
    case 'clipped':
      return (
        <Clip style={{ d: rectanglePath(0, 0, 240, 300) }}>
          {island(props, standardObjects(props))}
        </Clip>
      );
    case 'layered':
      return (
        <Group style={{ translateX: 40, translateY: 30 }}>
          <Layer style={{ width: 400, height: 240 }}>
            {island(
              props,
              <>
                <Cube
                  style={{ size: 1.2, color: '#38bdf8' }}
                  onClick={props.onCubeSelection}
                />
                <Sphere
                  style={{ radius: 0.55, translateX: 1, color: '#fbbf24' }}
                  onClick={props.onSphereSelection}
                />
                <ContextReporter
                  pointerEvents="none"
                  onContext={props.onContext}
                />
              </>,
              false,
              400,
              240,
            )}
          </Layer>
        </Group>
      );
    case 'filtered':
      return (
        <Clip style={{ d: rectanglePath(20, 20, 340, 260) }}>
          {island(props, standardObjects(props), true)}
        </Clip>
      );
    case 'animation':
      return island(
        props,
        <>
          <Group3D style={{ rotationYDegrees: props.state.animationAngle }}>
            {standardObjects(props)}
          </Group3D>
        </>,
      );
    case 'mixed-order':
    case 'focus':
    case 'context-restored':
      return island(props, standardObjects(props));
  }
}

export function createWebGLLabScene(props: WebGLLabSceneProps): CRCNode {
  const background = (
    <Rectangle
      key="lower-canvas"
      keyboardFocusable={false}
      style={{ width: 480, height: 300, fill: '#dbeafe' }}
      onClick={() => props.onTarget('lower-canvas')}
    />
  );
  const star = (
    <Star
      key="upper-star"
      keyboardFocusable={false}
      style={{
        cx: 183,
        cy: 150,
        points: 5,
        outerRadius: 18,
        innerRadius: 8,
        fill: '#ef4444',
        stroke: '#7f1d1d',
        strokeWidth: 1,
        cursor: 'pointer',
      }}
      onClick={() => props.onTarget('upper-star')}
    />
  );
  const webgl = modeContent(props);
  const ordered = props.starFirst
    ? [background, star, webgl]
    : [background, webgl, star];

  return (
    <FocusManagement>
      <Group>
        {ordered}
        <Text
          pointerEvents="none"
          style={{
            x: 14,
            y: 18,
            fill: '#0f172a',
            font: '700 12px monospace',
          }}
        >
          {`WEBGL · ${props.state.mode}`}
        </Text>
        <Text
          pointerEvents="none"
          style={{ x: 14, y: 292, fill: '#334155', font: '11px monospace' }}
        >
          {`cube ${props.state.cubeSelections} · sphere ${props.state.sphereSelections} · generation ${props.state.contextGeneration}`}
        </Text>
      </Group>
    </FocusManagement>
  );
}
