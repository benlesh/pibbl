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
  HemisphereLight,
  Mesh,
  Model,
  WebGLLayer,
  createWebGLGeometry,
  useOrbitCamera,
} from "@crc/webgl";
import { useGLTF, type CRCWebGLAssetLoadResult } from "@crc/webgl/gltf";

// Static GLB feedback slice
// CC0 Khronos sample-asset gallery

const galleryModels = [
  { name: "AVOCADO", source: "/models/khronos-avocado.glb" },
  { name: "BOOM BOX", source: "/models/khronos-boombox.glb" },
  { name: "TOY CAR", source: "/models/khronos-toy-car.glb" },
  { name: "SCI-FI HELMET", source: "/models/khronos-scifi-helmet.glb" },
] as const;

const selectorBoxes = [
  { x: 12, width: 148 },
  { x: 174, width: 148 },
  { x: 336, width: 148 },
  { x: 498, width: 210 },
] as const;

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
  selectedModel,
  onSelectModel,
}: {
  readonly loaded: CRCWebGLAssetLoadResult;
  readonly selectedModel: number;
  readonly onSelectModel: (index: number) => void;
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
          <HemisphereLight
            style={{
              skyColor: "#dbeafe",
              groundColor: "#8b6b52",
              intensity: 0.75,
            }}
          />
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
        <Text
          pointerEvents="none"
          style={{
            x: 696,
            y: 28,
            fill: "#bae6fd",
            font: "700 11px monospace",
            textAlign: "right",
          }}
        >
          {galleryModels[selectedModel]!.name} · KHRONOS SAMPLE · CC0
        </Text>
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
        {galleryModels.map((model, index) => {
          const box = selectorBoxes[index]!;
          const selected = index === selectedModel;
          return (
            <Group key={model.source} onClick={() => onSelectModel(index)}>
              <Rectangle
                style={{
                  x: box.x,
                  y: 366,
                  width: box.width,
                  height: 42,
                  fill: selected ? "#38bdf8" : "rgb(15 23 42 / 92%)",
                  stroke: selected ? "#e0f2fe" : "#475569",
                  strokeWidth: 2,
                  cornerRadius: 10,
                  cursor: "pointer",
                }}
              />
              <Text
                pointerEvents="none"
                style={{
                  x: box.x + box.width / 2,
                  y: 392,
                  fill: selected ? "#082f49" : "#e2e8f0",
                  font: "700 12px sans-serif",
                  textAlign: "center",
                }}
              >
                {model.name}
              </Text>
            </Group>
          );
        })}
      </Group>
    </FocusManagement>
  );
}

function StaticGLBLesson() {
  const [selectedModel, setSelectedModel] = useState(0);
  const loaded = useGLTF(galleryModels[selectedModel]!.source);
  return (
    <StaticGLBPresentation
      loaded={loaded}
      selectedModel={selectedModel}
      onSelectModel={setSelectedModel}
    />
  );
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <StaticGLBLesson />, { pixelRatio: 1 });
}
