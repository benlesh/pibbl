/** @jsxImportSource @crc/core */
import {
  FocusManagement,
  Group,
  Rectangle,
  Text,
  useWhenChanged,
  type Signal,
} from "@crc/core";
import {
  DirectionalLight,
  Mesh,
  Model,
  WebGLLayer,
  createWebGLGeometry,
  useOrbitCamera,
  type CRCWebGLVector3,
} from "@crc/webgl";
import {
  useGLTF,
  type CRCGLTFSource,
  type CRCWebGLAssetLoadResult,
} from "@crc/webgl/gltf";

// prettier-ignore
export const STATIC_GLB_SLICE_SOURCE_ID = "static-glb-feedback-example";

export type StaticGLBSliceSource = "primary" | "replacement" | "malformed";

export interface StaticGLBSliceConfiguration {
  readonly source: StaticGLBSliceSource;
  readonly visible: boolean;
}

export type StaticGLBSliceSources = Readonly<
  Record<StaticGLBSliceSource, CRCGLTFSource>
>;

const PUBLIC_SOURCES: StaticGLBSliceSources = {
  primary: "/models/crc-static-glb-slice.glb",
  replacement: "/models/crc-static-glb-slice.glb?replacement=1",
  malformed: "/models/crc-static-glb-malformed.glb",
};

const groundGeometry = createWebGLGeometry({
  positions: [-4, 0, -3, 4, 0, -3, 4, 0, 3, -4, 0, 3],
  normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
  indices: [0, 2, 1, 0, 3, 2],
});

function Loader({
  source,
  onLoadResult,
  onModelClick,
  onModelFocus,
  onModelBlur,
  onOrbitPosition,
}: {
  readonly source: CRCGLTFSource;
  readonly onLoadResult: (result: CRCWebGLAssetLoadResult) => void;
  readonly onModelClick: () => void;
  readonly onModelFocus: () => void;
  readonly onModelBlur: () => void;
  readonly onOrbitPosition: (position: CRCWebGLVector3) => void;
}) {
  const loaded = useGLTF(source);
  const orbit = useOrbitCamera({
    orbitPoint: [0, 0.5, 0],
    initialPosition: [4, 3, 6],
    minDistance: 3,
    maxDistance: 14,
  });
  useWhenChanged(() => onLoadResult(loaded), [loaded]);
  useWhenChanged(
    () => onOrbitPosition(orbit.position),
    [orbit.position[0], orbit.position[1], orbit.position[2]],
  );
  const failed = loaded.status === "error";
  return (
    <FocusManagement>
      <Group {...orbit.handlers}>
        <Rectangle
          pointerEvents="none"
          style={{ width: 720, height: 420, fill: "#0f2133" }}
        />
        <Rectangle style={{ width: 720, height: 420, fill: "transparent" }} />
        <WebGLLayer
          camera={{
            type: "perspective",
            position: orbit.position,
            lookAt: orbit.lookAt,
            up: [0, 1, 0],
            fieldOfViewDegrees: 48,
            near: 0.1,
            far: 100,
          }}
          style={{ width: 720, height: 420, shadows: "medium" }}
        >
          <DirectionalLight
            style={{
              color: "#fff1d6",
              intensity: 2.1,
              rotationXDegrees: -42,
              rotationYDegrees: 35,
            }}
          />
          {loaded.status === "ready" ? (
            <Model
              asset={loaded.asset}
              keyboardFocusable
              style={{ color: "#ffffff", cursor: "pointer" }}
              onClick={onModelClick}
              onFocus={onModelFocus}
              onBlur={onModelBlur}
            />
          ) : null}
          <Mesh
            geometry={groundGeometry}
            pointerEvents="none"
            style={{
              color: "#64748b",
              lit: true,
              material: { type: "lambert" },
              receiveShadow: true,
            }}
          />
        </WebGLLayer>
        {loaded.status === "ready" ? null : (
          <>
            <Rectangle
              pointerEvents="none"
              style={{
                x: 176,
                y: 174,
                width: 368,
                height: 72,
                fill: failed
                  ? "rgb(127 29 29 / 92%)"
                  : "rgb(15 23 42 / 88%)",
                stroke: failed ? "#fca5a5" : "#7dd3fc",
                strokeWidth: 2,
                cornerRadius: 12,
              }}
            />
            <Text
              pointerEvents="none"
              style={{
                x: 360,
                y: 216,
                fill: "#f8fafc",
                font: "700 16px sans-serif",
                textAlign: "center",
              }}
            >
              {failed ? "THE GLB COULD NOT BE LOADED" : "LOADING STATIC GLB…"}
            </Text>
          </>
        )}
      </Group>
    </FocusManagement>
  );
}

export function StaticGLBSliceHarness({
  configuration,
  sources = PUBLIC_SOURCES,
  onLoadResult,
  onModelClick,
  onModelFocus,
  onModelBlur,
  onOrbitPosition,
}: {
  readonly configuration: Signal<StaticGLBSliceConfiguration>;
  readonly sources?: StaticGLBSliceSources;
  readonly onLoadResult: (result: CRCWebGLAssetLoadResult) => void;
  readonly onModelClick: () => void;
  readonly onModelFocus: () => void;
  readonly onModelBlur: () => void;
  readonly onOrbitPosition: (position: CRCWebGLVector3) => void;
}) {
  const current = configuration.get();
  if (!current.visible) return null;
  return (
    <Loader
      source={sources[current.source]}
      onLoadResult={onLoadResult}
      onModelClick={onModelClick}
      onModelFocus={onModelFocus}
      onModelBlur={onModelBlur}
      onOrbitPosition={onOrbitPosition}
    />
  );
}
