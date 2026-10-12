import { pibbl, Group, Rectangle, Circle, Text, signal } from "@pibbl/core";
import { displacement, reflectedLight } from "@pibbl/core/filters";
import {
  waterWaves,
  useTexture,
  type WaterWavesOptions,
  type WaterWavesMessage,
} from "@pibbl/core/textures";

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
label.append(toggle, "Refraction + reflections");
document.body.append(label);
function Waves() {
  const options: WaterWavesOptions = {
    seed: 7,
    speed: 2.4,
    scale: 10,
    rippleStrength: 1.2,
  };
  const water = useTexture(waterWaves(options), {
    resolution: { width, height },
  });
  const map = water.paint({ mode: "stretch" });
  const region = { x: 0, y: 0, width, height };
  const filters = [
    displacement({ map, strength: 8, region }),
    reflectedLight({
      map,
      region,
      source: "#ffffff",
      opacity: 0.65,
      direction: [-0.6, -0.8],
    }),
  ];
  const send = (x: number, y: number) => {
    const message: WaterWavesMessage = {
      type: "ripple",
      x: Math.max(0, Math.min(1, x / width)),
      y: Math.max(0, Math.min(1, y / height)),
    };
    water.send(message);
  };
  return (
    <>
      <Group style={{ filter: enabled.get() ? filters : undefined }}>
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
          Pibbl
        </Text>
      </Group>

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
const controller = pibbl(canvas, <Waves />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
