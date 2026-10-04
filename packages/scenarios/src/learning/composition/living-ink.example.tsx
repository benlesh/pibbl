/** @jsxImportSource @crc/core */
import {
  crc,
  Group,
  Rectangle,
  Text,
  FocusManagement,
  useSignal,
  useConst,
  type CRCPointerEvent,
  useReaction,
  type CRCController,
} from "@crc/core";
import { useTexture, reactionDiffusion, texturePalettes } from "@crc/core/textures";

const palettes = [
  texturePalettes.lagoon,
  texturePalettes.porcelain,
  texturePalettes.ember,
];
const paletteNames = ["Lagoon", "Porcelain", "Ember"];

function Button({
  x,
  label,
  active,
  onClick,
}: {
  x: number;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Group style={{ translateX: x }}>
      <Rectangle
        keyboardFocusable
        onClick={onClick}
        style={{
          width: 104,
          height: 36,
          cornerRadius: 18,
          fill: active ? "#d7f2bc" : "#233b48",
          cursor: "pointer",
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          textBaseline: "alphabetic",
          left: 52,
          top: 23,
          textAlign: "center",
          font: "600 12px Arial",
          fill: active ? "#172c28" : "#e1eee9",
        }}
      >
        {label}
      </Text>
    </Group>
  );
}

function LivingInk({ canvas }: { canvas: HTMLCanvasElement }) {
  useReaction(() => {
    const previous = canvas.style.touchAction;
    canvas.style.touchAction = "none";
    return () => {
      if (canvas.style.touchAction === "none")
        canvas.style.touchAction = previous;
    };
  }, [canvas]);
  const state = useSignal({
    paused: false,
    preset: "spots" as "spots" | "stripes",
    palette: 0,
    brush: 6,
    seed: 42,
  });
  const s = state.get();
  const ink = useTexture(
    reactionDiffusion({ seed: s.seed, preset: s.preset }),
    {
      resolution: { width: 256, height: 144 },
      palette: palettes[s.palette],
    },
  );
  const stroke = useConst(() => ({
    id: undefined as number | undefined,
    u: 0,
    v: 0,
  }));
  const paint = (event: CRCPointerEvent) => {
    // CRC coordinates are root-logical. This lesson's panel is at (24,116).
    const u = (event.x - 24) / 832,
      v = (event.y - 116) / 400;
    const count = Math.min(
      256,
      Math.max(
        1,
        Math.ceil(Math.hypot((u - stroke.u) * 256, (v - stroke.v) * 144) / 2),
      ),
    );
    for (let i = 1; i <= count; i++)
      ink.send({
        type: "paint",
        u: stroke.u + ((u - stroke.u) * i) / count,
        v: stroke.v + ((v - stroke.v) * i) / count,
        radius: s.brush,
        strength: 0.85,
      });
    stroke.u = u;
    stroke.v = v;
  };
  const end = (event: CRCPointerEvent) => {
    if (stroke.id !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    stroke.id = undefined;
  };
  return (
    <FocusManagement>
      <Group>
        <Rectangle
          style={{ width: 880, height: 630, fill: "#0c202b" }}
          pointerEvents="none"
        />
        <Text
          style={{
            textBaseline: "alphabetic",
            left: 28,
            top: 30,
            fill: "#97c4b2",
            font: "600 11px Arial",
          }}
          pointerEvents="none"
        >
          TEXTURE STUDIES / 01
        </Text>
        <Text
          style={{
            textBaseline: "alphabetic",
            left: 28,
            top: 70,
            fill: "#eff5e8",
            font: "600 34px Georgia",
          }}
          pointerEvents="none"
        >
          Living Ink
        </Text>
        <Text
          style={{
            textBaseline: "alphabetic",
            left: 28,
            top: 95,
            fill: "#9bb7be",
            font: "13px Arial",
          }}
          pointerEvents="none"
        >
          Paint living ink. Pause to compose, then let it evolve.
        </Text>
        <Group style={{ translateX: 24, translateY: 116 }}>
          <Rectangle
            style={{ width: 832, height: 400, fill: ink }}
            onPointerDown={(event) => {
              if (
                event.button !== 0 ||
                !event.isPrimary ||
                stroke.id !== undefined
              )
                return;
              stroke.id = event.pointerId;
              stroke.u = (event.x - 24) / 832;
              stroke.v = (event.y - 116) / 400;
              event.currentTarget.setPointerCapture(event.pointerId);
              paint(event);
            }}
            onPointerMove={(event) => {
              if (stroke.id === event.pointerId) paint(event);
            }}
            onPointerUp={end}
            onPointerCancel={end}
          />
          <Group style={{ translateX: 22, translateY: 320 }}>
            <Rectangle
              pointerEvents="none"
              style={{
                width: 340,
                height: 60,
                cornerRadius: 12,
                fill: "#071c2dcc",
              }}
            />
            <Text
              pointerEvents="none"
              style={{
                textBaseline: "alphabetic",
                left: 16,
                top: 25,
                fill: "#f4f3df",
                font: "600 16px Georgia",
              }}
            >
              A background with a life of its own.
            </Text>
            <Text
              pointerEvents="none"
              style={{
                textBaseline: "alphabetic",
                left: 16,
                top: 45,
                fill: "#a8c8c7",
                font: "11px Arial",
              }}
            >
              Ordinary CRC content, layered over living color.
            </Text>
          </Group>
        </Group>
        <Group style={{ translateX: 24, translateY: 532 }}>
          <Button
            x={0}
            label="Spots"
            active={s.preset === "spots"}
            onClick={() => state.update((v) => ({ ...v, preset: "spots" }))}
          />
          <Button
            x={112}
            label="Stripes"
            active={s.preset === "stripes"}
            onClick={() => state.update((v) => ({ ...v, preset: "stripes" }))}
          />
          <Button
            x={244}
            label={paletteNames[s.palette]}
            onClick={() =>
              state.update((v) => ({ ...v, palette: (v.palette + 1) % 3 }))
            }
          />
          <Button
            x={356}
            label={`Brush ${s.brush}`}
            onClick={() =>
              state.update((v) => ({
                ...v,
                brush: v.brush === 6 ? 12 : v.brush === 12 ? 3 : 6,
              }))
            }
          />
          <Button
            x={488}
            label={s.paused ? "Resume" : "Pause"}
            active={s.paused}
            onClick={() => {
              ink.send({ type: "pause", paused: !s.paused });
              state.update((v) => ({ ...v, paused: !v.paused }));
            }}
          />
          <Button
            x={600}
            label="Reset"
            onClick={() => ink.send({ type: "reset" })}
          />
          <Button
            x={712}
            label="New seed"
            onClick={() =>
              state.update((v) => ({ ...v, seed: (v.seed + 1) >>> 0 }))
            }
          />
        </Group>
        <Text
          pointerEvents="none"
          style={{
            textBaseline: "alphabetic",
            left: 28,
            top: 602,
            fill: "#819fa9",
            font: "11px Arial",
          }}
        >{`${s.paused ? "PAUSED · painting still works" : "EVOLVING"}  /  ${paletteNames[s.palette]}  /  seed ${s.seed}  /  256 × 144 cells`}</Text>
      </Group>
    </FocusManagement>
  );
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <LivingInk canvas={canvas} />);
}
