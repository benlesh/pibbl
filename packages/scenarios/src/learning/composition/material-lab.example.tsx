/** @jsxImportSource @crc/core */
import {
  crc,
  Group,
  Rectangle,
  Text,
  FocusManagement,
  useSignal,
  type CRCController,
} from "@crc/core";
import {
  useTexture, marble, paper, cellular,
  type TextureKind,
} from "@crc/textures";

const palettes = [
  ["#f2e8d7", "#c4b8a9", "#625e68", "#252c3f"],
  ["#091f26", "#24525a", "#88b8a5", "#e0dbb0"],
  ["#321c35", "#986780", "#e8b6a0", "#fff0cc"],
];
const kinds: readonly TextureKind[] = ["marble", "paper", "cellular"];
function MaterialSwatches({
  kind,
  seed,
  scale,
  detail,
  palette,
}: {
  kind: TextureKind;
  seed: number;
  scale: number;
  detail: number;
  palette: number;
}) {
  const factories = { marble, paper, cellular };
  const texture = useTexture(factories[kind]({ seed, scale, detail }), {
    resolution: { width: 320, height: 240 },
    palette: palettes[palette],
  });
  return (
    <>
      <Rectangle
        pointerEvents="none"
        style={{
          width: 520,
          height: 370,
          fill: texture.paint({ mode: "stretch" }),
        }}
      />
      <Rectangle
        pointerEvents="none"
        style={{
          left: 540,
          width: 292,
          height: 370,
          cornerRadius: 18,
          fill: texture.paint({
            mode: "repeat",
            tileWidth: 160,
            tileHeight: 120,
          }),
        }}
      />
      <Rectangle
        pointerEvents="none"
        style={{ left: 560, top: 222, width: 252, height: 126, fill: "#14232cbb" }}
      />
      <Rectangle
        pointerEvents="none"
        style={{
          left: 18,
          top: 304,
          width: 350,
          height: 50,
          cornerRadius: 10,
          fill: "#14232cee",
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 32,
          top: 338,
          textBaseline: "alphabetic",
          font: "bold 28px Georgia",
          fill: texture,
          stroke: "#f4ead7",
          strokeWidth: 0.6,
        }}
      >
        One source. Real fills.
      </Text>
    </>
  );
}
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
          width: 108,
          height: 36,
          cornerRadius: 18,
          fill: active ? "#edc9a1" : "#343541",
          cursor: "pointer",
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 54,
          top: 23,
          textBaseline: "alphabetic",
          textAlign: "center",
          font: "600 12px Arial",
          fill: active ? "#2b2831" : "#ece6dc",
        }}
      >
        {label}
      </Text>
    </Group>
  );
}
function MaterialLab() {
  const state = useSignal({
    kind: "marble" as TextureKind,
    seed: 24,
    scale: 6,
    detail: 0.65,
    palette: 0,
  });
  const s = state.get();
  return (
    <FocusManagement>
      <Group>
        <Rectangle
          pointerEvents="none"
          style={{ width: 880, height: 630, fill: "#20232e" }}
        />
        <Text
          pointerEvents="none"
          style={{
            left: 28,
            top: 30,
            textBaseline: "alphabetic",
            font: "600 11px Arial",
            fill: "#d6b798",
          }}
        >
          TEXTURE STUDIES / 02
        </Text>
        <Text
          pointerEvents="none"
          style={{
            left: 28,
            top: 70,
            textBaseline: "alphabetic",
            font: "600 34px Georgia",
            fill: "#f6ead5",
          }}
        >
          Material Lab
        </Text>
        <Text
          pointerEvents="none"
          style={{
            left: 28,
            top: 95,
            textBaseline: "alphabetic",
            font: "13px Arial",
            fill: "#bcb9c5",
          }}
        >
          A little geology. A little paper. A reproducible accident.
        </Text>
        <Group style={{ translateX: 24, translateY: 118 }}>
          <MaterialSwatches
            key={s.kind}
            kind={s.kind}
            seed={s.seed}
            scale={s.scale}
            detail={s.detail}
            palette={s.palette}
          />
          <Text
            pointerEvents="none"
            style={{
              left: 580,
              top: 270,
              textBaseline: "alphabetic",
              font: "600 24px Georgia",
              fill: "#fff5df",
            }}
          >
            Made of texture.
          </Text>
          <Text
            pointerEvents="none"
            style={{
              left: 580,
              top: 299,
              textBaseline: "alphabetic",
              font: "12px Arial",
              fill: "#e5d9c8",
            }}
          >
            Same source. Seamless repeat.
          </Text>
          <Text
            pointerEvents="none"
            style={{
              left: 580,
              top: 325,
              textBaseline: "alphabetic",
              font: "11px Arial",
              fill: "#b8c6c2",
            }}
          >
            Ordinary CRC text on top.
          </Text>
        </Group>
        <Group style={{ translateX: 24, translateY: 510 }}>
          {kinds.map((kind, i) => (
            <Button
              key={kind}
              x={i * 116}
              label={kind[0].toUpperCase() + kind.slice(1)}
              active={s.kind === kind}
              onClick={() => state.update((v) => ({ ...v, kind }))}
            />
          ))}
          <Button
            x={364}
            label={`Scale ${s.scale}`}
            onClick={() =>
              state.update((v) => ({
                ...v,
                scale: v.scale === 6 ? 12 : v.scale === 12 ? 3 : 6,
              }))
            }
          />
          <Button
            x={480}
            label={`Detail ${Math.round(s.detail * 100)}%`}
            onClick={() =>
              state.update((v) => ({
                ...v,
                detail: v.detail === 0.65 ? 1 : v.detail === 1 ? 0.25 : 0.65,
              }))
            }
          />
          <Button
            x={596}
            label="Palette"
            onClick={() =>
              state.update((v) => ({ ...v, palette: (v.palette + 1) % 3 }))
            }
          />
          <Button
            x={712}
            label="New variation"
            onClick={() =>
              state.update((v) => ({ ...v, seed: (v.seed + 1) >>> 0 }))
            }
          />
        </Group>
        <Text
          pointerEvents="none"
          style={{
            left: 28,
            top: 582,
            textBaseline: "alphabetic",
            font: "12px Arial",
            fill: "#d0c7bc",
          }}
        >{`${s.kind.toUpperCase()} / seed ${s.seed} / scale ${s.scale} / detail ${Math.round(s.detail * 100)}%`}</Text>
        <Text
          pointerEvents="none"
          style={{
            left: 28,
            top: 606,
            textBaseline: "alphabetic",
            font: "11px Arial",
            fill: "#9396a6",
          }}
        >
          Static after generation. Change shape controls to regenerate; palette
          changes only recolor.
        </Text>
      </Group>
    </FocusManagement>
  );
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <MaterialLab />);
}
