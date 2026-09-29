/** @jsxImportSource @crc/core */
import {
  FocusManagement,
  Group,
  Rectangle,
  type CRCNode,
  type Signal,
} from '@crc/core';
import {
  AmbientLight,
  Cube,
  DirectionalLight,
  Group3D,
  HemisphereLight,
  Mesh,
  PointLight,
  Sphere,
  SpotLight,
  WebGLBackground,
  WebGLLayer,
  createWebGLGeometry,
  useOrbitCamera,
  type CRCWebGLShadowQuality,
} from '@crc/webgl';

export const WEBGL_LIGHTING_LAB_SOURCE_ID =
  'webgl-lighting-laboratory-example';

export type WebGLLightingLabMode =
  | 'ambient'
  | 'hemisphere'
  | 'directional'
  | 'point'
  | 'spot'
  | 'all';

export type WebGLLightingLabCasterAlpha = 'opaque' | 'partial' | 'zero';
export type WebGLLightingLabBackgroundMode =
  | 'transparent'
  | 'opaque'
  | 'alpha';
export type WebGLLightingLabTarget = 'backing' | 'caster';
export type WebGLLightingLabFocusTarget = 'none' | 'caster';

export interface WebGLLightingLabConfiguration {
  readonly lightMode: WebGLLightingLabMode;
  readonly backgroundMode: WebGLLightingLabBackgroundMode;
  readonly shadowQuality: CRCWebGLShadowQuality;
  readonly transformedLight: boolean;
  readonly casterAlpha: WebGLLightingLabCasterAlpha;
  readonly lit: boolean;
  readonly emissive: boolean;
  readonly casterOffset: number;
}

export interface WebGLLightingLabState
  extends WebGLLightingLabConfiguration {
  readonly revision: number;
  readonly lastTarget: WebGLLightingLabTarget | null;
  readonly focusTarget: WebGLLightingLabFocusTarget;
}

export const WEBGL_LIGHTING_LAB_PROBES = {
  orbitStart: { x: 620, y: 80 },
  orbitEnd: { x: 530, y: 130 },
  emptyBackground: { x: 32, y: 32 },
} as const;

interface WebGLLightingLabSceneProps {
  readonly configuration: Signal<WebGLLightingLabConfiguration>;
  readonly onBackingTarget: () => void;
  readonly onCasterTarget: () => void;
  readonly onCasterFocus: () => void;
}

const groundGeometry = createWebGLGeometry({
  positions: [-4, 0, -3, 4, 0, -3, 4, 0, 3, -4, 0, 3],
  normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
  indices: [0, 2, 1, 0, 3, 2],
});

function directLights(configuration: WebGLLightingLabConfiguration): CRCNode {
  const directional = (
    <DirectionalLight
      style={{
        color: '#fff4de',
        intensity: 1.6,
        rotationXDegrees: -42,
        rotationYDegrees: 35,
      }}
    />
  );
  const point = (
    <PointLight
      style={{
        color: '#ffb26b',
        intensity: 45,
        range: 9,
        translateX: -2.6,
        translateY: 2.8,
        translateZ: 2.2,
      }}
    />
  );
  const spot = (
    <SpotLight
      style={{
        color: '#9bdcff',
        intensity: 95,
        range: 12,
        innerConeAngleDegrees: 14,
        outerConeAngleDegrees: 27,
        translateX: 0.5,
        translateY: 4,
        translateZ: 4,
        rotationXDegrees: -45,
        rotationYDegrees: 6,
      }}
    />
  );

  let direct: CRCNode = null;
  if (configuration.lightMode === 'directional') direct = directional;
  if (configuration.lightMode === 'point') direct = point;
  if (configuration.lightMode === 'spot') direct = spot;
  if (configuration.lightMode === 'all') {
    direct = <>{directional}{point}{spot}</>;
  }
  if (!direct) return null;
  return configuration.transformedLight ? (
    <Group3D
      style={{
        rotationYDegrees: 32,
        scaleX: 1.2,
        scaleY: 1.2,
        scaleZ: 1.2,
      }}
    >
      {direct}
    </Group3D>
  ) : direct;
}

function sceneLights(configuration: WebGLLightingLabConfiguration): CRCNode {
  return (
    <>
      {configuration.lightMode === 'ambient' || configuration.lightMode === 'all' ? (
        <AmbientLight style={{ color: '#ffffff', intensity: 0.18 }} />
      ) : null}
      {configuration.lightMode === 'hemisphere' || configuration.lightMode === 'all' ? (
        <HemisphereLight
          style={{
            skyColor: '#b9dcff',
            groundColor: '#3b271c',
            intensity: 0.32,
          }}
        />
      ) : null}
      {directLights(configuration)}
    </>
  );
}

function casterColor(alpha: WebGLLightingLabCasterAlpha): string {
  if (alpha === 'partial') return 'rgb(244 114 182 / 55%)';
  if (alpha === 'zero') return 'rgb(244 114 182 / 0%)';
  return '#f472b6';
}

function sceneBackground(mode: WebGLLightingLabBackgroundMode): CRCNode {
  if (mode === 'transparent') return null;
  return (
    <WebGLBackground
      style={{
        color: mode === 'opaque' ? '#07111f' : 'rgb(7 17 31 / 50%)',
      }}
    />
  );
}

export function WebGLLightingLabScene(
  props: WebGLLightingLabSceneProps,
): CRCNode {
  const configuration = props.configuration.get();
  const orbit = useOrbitCamera({
    orbitPoint: [0, -0.25, 0],
    initialPosition: [5.8, 4.2, 7.8],
    minDistance: 3,
    maxDistance: 18,
  });
  return (
    <FocusManagement>
      <Group {...orbit.handlers}>
        <Rectangle
          pointerEvents="none"
          style={{ width: 720, height: 420, fill: '#173047' }}
        />
        <Rectangle
          pointerEvents="none"
          style={{ left: 360, width: 360, height: 420, fill: '#44254f' }}
        />
        <Rectangle
          style={{ width: 720, height: 420, fill: 'transparent' }}
          onClick={props.onBackingTarget}
        />
        <WebGLLayer
          camera={{
            type: 'perspective',
            position: orbit.position,
            lookAt: orbit.lookAt,
            up: [0, 1, 0],
            fieldOfViewDegrees: 48,
            near: 0.1,
            far: 100,
          }}
          style={{
            width: 720,
            height: 420,
            shadows: configuration.shadowQuality,
          }}
        >
          {sceneBackground(configuration.backgroundMode)}
          {sceneLights(configuration)}
          <Cube
            keyboardFocusable
            style={{
              size: 1.6,
              translateX: -1.45 + configuration.casterOffset,
              translateY: -0.05,
              rotationXDegrees: 10,
              rotationYDegrees: -28,
              color: casterColor(configuration.casterAlpha),
              lit: configuration.lit,
              castShadow:
                configuration.casterAlpha === 'opaque' ? undefined : true,
              receiveShadow: true,
              material: { type: 'lambert' },
              cursor: 'pointer',
            }}
            onClick={props.onCasterTarget}
            onFocus={props.onCasterFocus}
          />
          <Sphere
            pointerEvents="none"
            style={{
              radius: 0.9,
              translateX: 1.25,
              translateY: -0.1,
              color: '#38bdf8',
              lit: true,
              material: configuration.emissive
                ? {
                    type: 'lambert',
                    emissiveColor: '#0ea5e9',
                    emissiveIntensity: 0.45,
                  }
                : { type: 'lambert' },
            }}
          />
          <Cube
            pointerEvents="none"
            style={{
              size: 0.55,
              translateX: 0,
              translateY: -0.72,
              translateZ: 1.4,
              color: '#facc15',
              lit: false,
            }}
          />
          <Mesh
            geometry={groundGeometry}
            pointerEvents="none"
            style={{
              translateY: -1.08,
              color: '#94a3b8',
              lit: true,
              material: { type: 'lambert' },
            }}
          />
        </WebGLLayer>
      </Group>
    </FocusManagement>
  );
}
