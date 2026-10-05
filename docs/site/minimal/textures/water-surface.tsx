import { crc, Group, Rectangle, Circle, Text, signal } from "@crc/core";
import { displacement } from "@crc/core/filters";
import {
  waterSurface,
  useTexture,
  type WaterSurfaceOptions,
  type WaterSurfaceMessage,
  type WaterSurfaceObstacle,
} from "@crc/core/textures";

const width = 360,
  height = 240;
const canvas = document.createElement("canvas");
canvas.width = width;
canvas.height = height;
canvas.style.touchAction = "none";
document.body.append(canvas);
const enabled = signal(true);
const toggle = document.createElement("input");
toggle.type = "checkbox";
toggle.checked = true;
toggle.onchange = () => enabled.set(toggle.checked);
const label = document.createElement("label");
label.append(toggle, "Refraction");
document.body.append(label);
function Basin() {
  const island: WaterSurfaceObstacle = {
    x: 0.42,
    y: 0.35,
    width: 0.16,
    height: 0.3,
  };
  const options: WaterSurfaceOptions = {
    seed: 5,
    speed: 0.5,
    viscosity: 0.2,
    obstacles: [island],
  };
  const water = useTexture(waterSurface(options), {
    resolution: { width: 240, height: 160 },
  });
  const map = water.paint({ mode: "stretch" });
  const filter = displacement({
    map,
    strength: 18,
    region: { x: 0, y: 0, width, height },
  });
  const send = (x: number, y: number) => {
    const message: WaterSurfaceMessage = {
      type: "ripple",
      x: Math.max(0, Math.min(1, x / width)),
      y: Math.max(0, Math.min(1, y / height)),
    };
    water.send(message);
  };
  return (
    <>
      <Group style={{ filter: enabled.get() ? filter : undefined }}>
        <Rectangle style={{ width, height, fill: "#c3e7e8" }} />
        {Array.from({ length: 54 }, (_, i) => (
          <Rectangle
            key={i}
            style={{
              left: (i % 9) * 40 + 2,
              top: Math.floor(i / 9) * 40 + 2,
              width: 36,
              height: 36,
              fill: (i + Math.floor(i / 9)) % 2 ? "#1d8597" : "#80c4ce",
            }}
          />
        ))}
        <Circle
          style={{
            cx: 180,
            cy: 120,
            radius: 65,
            fill: "#1d3948",
            stroke: "#f2d069",
            strokeWidth: 8,
          }}
        />
        <Text
          style={{
            left: 180,
            top: 133,
            font: "bold 38px sans-serif",
            textAlign: "center",
            fill: "#ffffff",
          }}
        >
          CRC
        </Text>
      </Group>
      <Rectangle
        pointerEvents="none"
        style={{
          left: island.x * width,
          top: island.y * height,
          width: island.width * width,
          height: island.height * height,
          fill: "#596e70",
          stroke: "#fff",
          strokeWidth: 2,
        }}
      />
      <Rectangle
        style={{ width, height, fill: "#00000000", cursor: "crosshair" }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          send(event.x, event.y);
        }}
        onPointerUp={(event) =>
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      />
    </>
  );
}
const controller = crc(canvas, <Basin />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
