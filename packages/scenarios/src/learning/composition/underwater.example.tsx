import {
  crc,
  defineTexture,
  DragHandle,
  Group,
  Layer,
  ManipulationFrame,
  Rectangle,
  Text,
  useManipulation,
  useSignal,
  useTexture,
  type CRCController,
  type CRCManipulationBox,
} from "@crc/core";
import { displacement, reflectedLight } from "@crc/core/filters";
import { marble, waterSurface } from "@crc/core/textures";

const skyReflection = defineTexture({
  create: () => ({}),
  rasterize(_, { canvas }) {
    const ctx = canvas.getContext("2d")!;
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, "#c9f5ff");
    sky.addColorStop(1, "#557eb0");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f8ffff";
    for (let x = 12; x < canvas.width; x += 44)
      ctx.fillRect(x, 10, 26, canvas.height - 20);
  },
});

function Underwater() {
  const enabled = useSignal(true);
  const paused = useSignal(false);
  const strength = useSignal(8);
  const speed = useSignal(0.4);
  const rippleStrength = useSignal(1);
  const clicks = useSignal(0);
  const viscosity = useSignal(0);
  const surface = useSignal(0);
  const surfaceOpacity = useSignal(0.5);
  const lava = useTexture(marble({ seed: 12, scale: 8, detail: 0.8 }), {
    resolution: { width: 256, height: 128 },
    palette: ["#200b08", "#591408", "#d53a0c", "#ffb323"],
  });
  const lightOpacity = useSignal(0.15);
  const patternedLight = useSignal(false);
  const obstacle = useSignal<CRCManipulationBox>({
    left: 480,
    top: 196,
    width: 96,
    height: 62,
  });
  const obstacleManipulation = useManipulation({
    box: obstacle,
    move: { bounds: { left: 32, top: 94, width: 592, height: 292 } },
  });
  const obstacleBox = obstacle.get();
  const sky = useTexture(skyReflection({}), {
    resolution: { width: 128, height: 64 },
  });
  const water = useTexture(
    waterSurface({
      seed: 7,
      speed: speed.get(),
      paused: paused.get(),
      rippleStrength: rippleStrength.get(),
      viscosity: viscosity.get(),
      obstacles: [
        {
          x: (obstacleBox.left - 32) / 592,
          y: (obstacleBox.top - 94) / 292,
          width: obstacleBox.width / 592,
          height: obstacleBox.height / 292,
        },
      ],
    }),
    {
      resolution: { width: 256, height: 128 },
    },
  );
  const map = water.paint({ mode: "stretch" });
  const buttons = [
    {
      label: enabled.get() ? "WATER ON" : "WATER OFF",
      click: () => enabled.update((value) => !value),
    },
    {
      label: paused.get() ? "RESUME" : "PAUSE",
      click: () => paused.update((value) => !value),
    },
    {
      label: `STRENGTH ${strength.get()}`,
      click: () =>
        strength.update((value) => (value === 8 ? 18 : value === 18 ? 0 : 8)),
    },
    {
      label: `RIPPLE ${rippleStrength.get()}×`,
      click: () =>
        rippleStrength.update((value) =>
          value === 0
            ? 0.5
            : value === 0.5
              ? 1
              : value === 1
                ? 2
                : value === 2
                  ? 4
                  : 0,
        ),
    },
    {
      label: `SPEED ${speed.get()}`,
      click: () =>
        speed.update((value) => (value === 0.4 ? 1 : value === 1 ? 0 : 0.4)),
    },
  ];
  const lightButtons = [
    {
      label: `REFLECT ${Math.round(lightOpacity.get() * 100)}%`,
      click: () =>
        lightOpacity.update((value) =>
          value === 0 ? 0.15 : value === 0.15 ? 0.3 : value === 0.3 ? 0.5 : 0,
        ),
    },
    {
      label: patternedLight.get() ? "LIGHT: TEXTURE" : "LIGHT: TINT",
      click: () => patternedLight.update((value) => !value),
    },
  ];
  lightButtons.push(
    {
      label: `VISCOSITY ${viscosity.get()}`,
      click: () =>
        viscosity.update((value) =>
          value === 0 ? 0.3 : value === 0.3 ? 0.7 : value === 0.7 ? 1 : 0,
        ),
    },
    {
      label: `SURFACE: ${["CLEAR", "BLUE", "AMBER", "LAVA"][surface.get()]}`,
      click: () => surface.update((value) => (value + 1) % 4),
    },
    {
      label: `SURFACE ${Math.round(surfaceOpacity.get() * 100)}%`,
      click: () =>
        surfaceOpacity.update((value) =>
          value === 0.25 ? 0.5 : value === 0.5 ? 0.8 : value === 0.8 ? 1 : 0.25,
        ),
    },
  );
  return (
    <Group>
      <Rectangle style={{ width: 800, height: 540, fill: "#edf3ee" }} />
      <Text
        style={{
          left: 32,
          top: 43,
          font: "800 28px sans-serif",
          fill: "#143d42",
        }}
      >
        A scene beneath moving water
      </Text>
      <Text
        style={{ left: 32, top: 70, font: "14px sans-serif", fill: "#45636b" }}
      >
        Click anywhere in the water to send out ripples. The scene stays in
        place.
      </Text>
      <Group
        onClick={(event) => {
          if (
            event.x >= 32 &&
            event.x <= 624 &&
            event.y >= 94 &&
            event.y <= 386
          ) {
            water.send({
              type: "ripple",
              x: (event.x - 32) / 592,
              y: (event.y - 94) / 292,
            });
          }
        }}
        style={{
          filter: enabled.get()
            ? [
                displacement({
                  map,
                  strength,
                  region: { x: 32, y: 94, width: 592, height: 292 },
                }),
                reflectedLight({
                  map,
                  region: { x: 32, y: 94, width: 592, height: 292 },
                  source: patternedLight.get()
                    ? sky.paint({ mode: "stretch" })
                    : "#eaffff",
                  opacity: lightOpacity,
                }),
              ]
            : [],
        }}
      >
        <Layer style={{ width: 800, height: 400 }}>
          <Rectangle
            style={{
              left: 32,
              top: 94,
              width: 592,
              height: 292,
              fill: "#103c4a",
            }}
          />
          {Array.from({ length: 15 }, (_, index) => (
            <Rectangle
              key={`vertical-${index}`}
              style={{
                left: 40 + index * 40,
                top: 94,
                width: 1,
                height: 292,
                fill: "#2b6570",
              }}
            />
          ))}
          {Array.from({ length: 8 }, (_, index) => (
            <Rectangle
              key={`horizontal-${index}`}
              style={{
                left: 32,
                top: 100 + index * 40,
                width: 592,
                height: 1,
                fill: "#2b6570",
              }}
            />
          ))}
          <Text
            style={{
              left: 70,
              top: 151,
              font: "800 30px sans-serif",
              fill: "#b6f3e2",
            }}
          >
            STILL SCENE / LIVE WATER
          </Text>
          <Rectangle
            style={{
              left: 230,
              top: 205,
              width: 190,
              height: 100,
              fill: "#44c8ab",
              cursor: "pointer",
            }}
            onClick={() => clicks.update((value) => value + 1)}
          />
          <Text
            pointerEvents="none"
            style={{
              left: 325,
              top: 264,
              textAlign: "center",
              font: "800 21px sans-serif",
              fill: "#103c4a",
            }}
          >
            CLICK ME
          </Text>
          {surface.get() !== 0 && (
            <Rectangle
              pointerEvents="none"
              style={{
                left: 32,
                top: 94,
                width: 592,
                height: 292,
                fill:
                  surface.get() === 1
                    ? "#168ab0"
                    : surface.get() === 2
                      ? "#a65b0a"
                      : lava.paint({ mode: "stretch" }),
                opacity: surfaceOpacity.get(),
              }}
            />
          )}
          <ManipulationFrame {...obstacleManipulation.frameProps}>
            <DragHandle controller={obstacleManipulation}>
              <Rectangle
                style={{
                  width: obstacleBox.width,
                  height: obstacleBox.height,
                  fill: "#184852",
                  stroke: "#ffc76b",
                  strokeWidth: 2,
                  cursor: "grab",
                }}
              />
            </DragHandle>
          </ManipulationFrame>
          <Text
            pointerEvents="none"
            style={{
              left: obstacleBox.left + obstacleBox.width / 2,
              top: obstacleBox.top + obstacleBox.height / 2 + 5,
              textAlign: "center",
              font: "700 12px sans-serif",
              fill: "#d9fbf0",
            }}
          >
            DRAG WAKE
          </Text>
          <Text
            style={{
              left: 70,
              top: 356,
              font: "14px monospace",
              fill: "#b6f3e2",
            }}
          >
            An explicit Layer keeps this scene cached.
          </Text>
        </Layer>
      </Group>
      <Rectangle
        pointerEvents="none"
        style={{
          left: 230,
          top: 205,
          width: 190,
          height: 100,
          stroke: "#ffc76b",
          strokeWidth: 2,
        }}
      />
      <Rectangle
        pointerEvents="none"
        style={{
          left: 648,
          top: 94,
          width: 120,
          height: 120,
          fill: water.paint({ mode: "stretch" }),
        }}
      />
      <Text
        style={{
          left: 648,
          top: 237,
          font: "700 14px sans-serif",
          fill: "#143d42",
        }}
      >
        LIVE RG MAP
      </Text>
      <Text
        style={{
          left: 648,
          top: 265,
          font: "12px sans-serif",
          fill: "#45636b",
        }}
      >
        Red: horizontal
      </Text>
      <Text
        style={{
          left: 648,
          top: 285,
          font: "12px sans-serif",
          fill: "#45636b",
        }}
      >
        Green: vertical
      </Text>
      <Text
        style={{
          left: 648,
          top: 344,
          font: "700 17px monospace",
          fill: "#143d42",
        }}
      >{`CLICKS ${clicks.get()}`}</Text>
      {buttons.map((button, index) => (
        <Group key={index}>
          <Rectangle
            style={{
              left: 32 + index * 150,
              top: 408,
              width: 140,
              height: 36,
              fill: "#143d42",
              cursor: "pointer",
            }}
            onClick={button.click}
          />
          <Text
            pointerEvents="none"
            style={{
              left: 102 + index * 150,
              top: 420,
              textAlign: "center",
              font: "700 13px sans-serif",
              fill: "#ffffff",
            }}
          >
            {button.label}
          </Text>
        </Group>
      ))}
      {lightButtons.map((button, index) => (
        <Group key={`light-${index}`}>
          <Rectangle
            style={{
              left: 32 + index * 150,
              top: 458,
              width: 140,
              height: 36,
              fill: "#2d6872",
              cursor: "pointer",
            }}
            onClick={button.click}
          />
          <Text
            pointerEvents="none"
            style={{
              left: 102 + index * 150,
              top: 470,
              textAlign: "center",
              font: "700 13px sans-serif",
              fill: "#ffffff",
            }}
          >
            {button.label}
          </Text>
        </Group>
      ))}
      <Text
        style={{ left: 32, top: 510, font: "13px sans-serif", fill: "#45636b" }}
      >
        Try several clicks or drag the block. Speed zero still lets ripples
        spread; pause freezes everything.
      </Text>
    </Group>
  );
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <Underwater />);
}
