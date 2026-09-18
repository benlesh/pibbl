/** @jsxImportSource @crc/core */
import {
  FocusManagement,
  Group,
  Rectangle,
  Text,
  crc,
  useState,
  type CRCController,
} from "@crc/core";
import {
  DirectionalLight,
  Mesh,
  Model,
  WebGLLayer,
  createWebGLGeometry,
  useOrbitCamera,
} from "@crc/webgl";
import { useGLTF, type CRCWebGLAssetLoadResult } from "@crc/webgl/gltf";

// Static GLB feedback slice

const groundGeometry = createWebGLGeometry({
  positions: [-4, 0, -3, 4, 0, -3, 4, 0, 3, -4, 0, 3],
  normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
  indices: [0, 2, 1, 0, 3, 2],
});

function LoadMessage({ loaded }: { readonly loaded: CRCWebGLAssetLoadResult }) {
  if (loaded.status === "ready") return null;
  const failed = loaded.status === "error";
  return (
    <>
      <Rectangle
        pointerEvents="none"
        style={{
          x: 176,
          y: 174,
          width: 368,
          height: 72,
          fill: failed ? "rgb(127 29 29 / 92%)" : "rgb(15 23 42 / 88%)",
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
  );
}

function StaticGLBPresentation({
  loaded,
}: {
  readonly loaded: CRCWebGLAssetLoadResult;
}) {
  const [focused, setFocused] = useState(false);
  const orbit = useOrbitCamera({
    orbitPoint: [0, 0.5, 0],
    initialPosition: [4, 3, 6],
    minDistance: 3,
    maxDistance: 14,
  });

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
              style={{
                color: focused ? "#dbeafe" : "#ffffff",
                cursor: "pointer",
              }}
              onClick={() => setFocused(true)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
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
        <LoadMessage loaded={loaded} />
        {focused ? (
          <Text
            pointerEvents="none"
            style={{
              x: 24,
              y: 38,
              fill: "#bfdbfe",
              font: "700 13px monospace",
            }}
          >
            MODEL FOCUSED · ENTER OR SPACE ACTIVATES
          </Text>
        ) : null}
      </Group>
    </FocusManagement>
  );
}

function StaticGLBLesson() {
  const loaded = useGLTF("/models/crc-static-glb-slice.glb");
  return <StaticGLBPresentation loaded={loaded} />;
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <StaticGLBLesson />, { pixelRatio: 1 });
}
