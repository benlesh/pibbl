import { pibbl, Group, Rectangle, Circle, Text, signal } from "@pibbl/core";
import { displacement } from "@pibbl/core/filters";
import {
  rainDrops,
  useTexture,
  type RainDropsOptions,
  type RainDropsMessage,
} from "@pibbl/core/textures";

const width = 360,
  height = 240;
const canvas = document.createElement("canvas");
canvas.width = width;
canvas.height = height;
canvas.style.touchAction = "none";
const instruction = document.createElement("p");
instruction.id = "wipe-instruction";
instruction.textContent = "Drag with your mouse or finger to wipe the glass.";
canvas.setAttribute("aria-describedby", instruction.id);
document.body.append(instruction, canvas);
const enabled = signal(true);
const toggle = document.createElement("input");
toggle.type = "checkbox";
toggle.checked = true;
toggle.onchange = () => enabled.set(toggle.checked);
const label = document.createElement("label");
label.append(toggle, "Fogged glass");
document.body.append(label);
function RainGlass() {
  const options: RainDropsOptions = {
    seed: 7,
    condensation: 0.75,
    rainRate: 20,
    initialDrops: 80,
  };
  const water = useTexture(rainDrops(options), {
    resolution: { width: 240, height: 160 },
  });
  const map = water.paint({ mode: "stretch" });
  const filter = displacement({
    map,
    strength: 16,
    blurRadius: 12,
    region: { x: 0, y: 0, width, height },
  });
  const send = (x: number, y: number) => {
    const message: RainDropsMessage = {
      type: "finger",
      x: Math.max(0, Math.min(1, x / width)),
      y: Math.max(0, Math.min(1, y / height)),
      radius: 0.09,
    };
    water.send(message);
  };
  return (
    <>
      <Group style={{ filter: enabled.get() ? filter : undefined }}>
        <Rectangle style={{ width, height, fill: "#192934" }} />
        {Array.from({ length: 54 }, (_, i) => (
          <Rectangle
            key={i}
            style={{
              left: (i % 9) * 40 + 2,
              top: Math.floor(i / 9) * 40 + 2,
              width: 36,
              height: 36,
              fill: ["#d49759", "#275668", "#c0d9cf"][i % 3],
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
        onPointerMove={(event) => {
          if (event.buttons) send(event.x, event.y);
        }}
        onPointerUp={(event) => {
          water.send({ type: "release" });
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => water.send({ type: "release" })}
      />
    </>
  );
}
const controller = pibbl(canvas, <RainGlass />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
