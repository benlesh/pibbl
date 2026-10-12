/** @jsxImportSource @pibbl/core */
import {
  pibbl,
  Group,
  Rectangle,
  Text,
  FocusManagement,
  useSignal,
  type PibblController,
  type TextureRecipe,
} from "@pibbl/core";
import {
  plainWeave,
  twill,
  herringbone,
  useTexture,
} from "@pibbl/core/textures";
const palettes = [
  ["#111827", "#294563", "#93adc1", "#e4edf2"],
  ["#271827", "#784454", "#c9988e", "#ffe6c8"],
  ["#142923", "#40654c", "#a1b78c", "#f0efca"],
];
function Label({
  x,
  y,
  children,
  size = 12,
  color = "#c1bccc",
}: {
  x: number;
  y: number;
  children: string;
  size?: number;
  color?: string;
}) {
  return (
    <Text
      pointerEvents="none"
      style={{
        left: x,
        top: y,
        textBaseline: "alphabetic",
        font: `${size}px Arial`,
        fill: color,
      }}
    >
      {children}
    </Text>
  );
}
function Button({
  x,
  y,
  label,
  active = false,
  onClick,
  width = 124,
}: {
  x: number;
  y: number;
  label: string;
  active?: boolean;
  width?: number;
  onClick: () => void;
}) {
  return (
    <Group style={{ translateX: x, translateY: y }}>
      <Rectangle
        keyboardFocusable
        onClick={onClick}
        style={{
          width,
          height: 34,
          cornerRadius: 8,
          cursor: "pointer",
          fill: active ? "#edbd91" : "#3a3547",
        }}
      />
      <Label
        x={width / 2 - label.length * 3.1}
        y={22}
        children={label}
        color={active ? "#231f2a" : "#f3e9df"}
      />
    </Group>
  );
}
function PatternCard({
  x,
  title,
  recipe,
  palette,
  tile,
}: {
  x: number;
  title: string;
  recipe: TextureRecipe;
  palette: number;
  tile: number;
}) {
  const texture = useTexture(recipe, {
    resolution: { width: 512, height: 512 },
    palette: palettes[palette],
  });
  return (
    <Group style={{ translateX: x }}>
      <Label x={0} y={140} children={title} size={20} color="#fff1d9" />
      <Rectangle
        pointerEvents="none"
        style={{
          top: 154,
          width: 256,
          height: 112,
          fill: texture.paint({
            mode: "repeat",
            tileWidth: 128,
            tileHeight: 128,
          }),
        }}
      />
      <Rectangle
        pointerEvents="none"
        style={{
          top: 282,
          width: 256,
          height: 160,
          fill: texture.paint({
            mode: "repeat",
            tileWidth: tile,
            tileHeight: tile,
          }),
        }}
      />
      <Label x={8} y={257} children="TILE DETAIL" size={10} color="#ffffff" />
    </Group>
  );
}

function FabricExplorer() {
  const state = useSignal({
    palette: 0,
    tile: 128,
    moving: false,
    seed: 42,
    threads: 16,
    threadWidth: 0.8,
    relief: 0.65,
    fuzz: 0.5,
  });
  const s = state.get();
  const options = {
    threads: s.threads,
    threadWidth: s.threadWidth,
    relief: s.relief,
    fuzz: s.fuzz,
    seed: s.seed,
    speed: s.moving ? 0.08 : 0,
  };
  return (
    <FocusManagement>
      <Group>
        <Rectangle
          pointerEvents="none"
          style={{ width: 880, height: 620, fill: "#211e2b" }}
        />
        <Label
          x={24}
          y={34}
          children="TEXTURE EXPLORER / FABRICS"
          size={11}
          color="#edbd91"
        />
        <Label
          x={24}
          y={70}
          children="Every thread has a pattern."
          size={30}
          color="#fff1d9"
        />
        <Button
          x={24}
          y={88}
          label="Palette"
          onClick={() =>
            state.update((v) => ({
              ...v,
              palette: (v.palette + 1) % palettes.length,
            }))
          }
        />
        <Button
          x={158}
          y={88}
          label={`Tile ${s.tile}px`}
          onClick={() =>
            state.update((v) => ({
              ...v,
              tile: v.tile === 128 ? 64 : v.tile === 64 ? 256 : 128,
            }))
          }
        />
        <Button
          x={292}
          y={88}
          label={s.moving ? "Motion on" : "Motion off"}
          active={s.moving}
          onClick={() => state.update((v) => ({ ...v, moving: !v.moving }))}
        />
        <Button
          x={426}
          y={88}
          label="New fiber seed"
          onClick={() => state.update((v) => ({ ...v, seed: v.seed + 1 }))}
        />
        <Label
          x={580}
          y={110}
          children="Tile detail above · seamless repeats below"
          size={11}
        />
        <PatternCard
          x={24}
          title="Plain weave"
          recipe={plainWeave(options)}
          palette={s.palette}
          tile={s.tile}
        />
        <PatternCard
          x={304}
          title="Twill"
          recipe={twill(options)}
          palette={s.palette}
          tile={s.tile}
        />
        <PatternCard
          x={584}
          title="Herringbone"
          recipe={herringbone(options)}
          palette={s.palette}
          tile={s.tile}
        />
        <Button
          x={24}
          y={454}
          label={`Threads ${s.threads}`}
          onClick={() =>
            state.update((v) => ({
              ...v,
              threads: v.threads === 16 ? 32 : v.threads === 32 ? 8 : 16,
            }))
          }
        />
        <Button
          x={158}
          y={454}
          label={`Width ${Math.round(s.threadWidth * 100)}%`}
          onClick={() =>
            state.update((v) => ({
              ...v,
              threadWidth:
                v.threadWidth === 0.8
                  ? 0.95
                  : v.threadWidth === 0.95
                    ? 0.5
                    : 0.8,
            }))
          }
        />
        <Button
          x={304}
          y={454}
          label={`Relief ${Math.round(s.relief * 100)}%`}
          onClick={() =>
            state.update((v) => ({
              ...v,
              relief: v.relief === 0.65 ? 0.2 : v.relief === 0.2 ? 1 : 0.65,
            }))
          }
        />
        <Button
          x={438}
          y={454}
          label={`Fuzz ${Math.round(s.fuzz * 100)}%`}
          onClick={() =>
            state.update((v) => ({
              ...v,
              fuzz: v.fuzz === 0.5 ? 0.8 : v.fuzz === 0.8 ? 0 : 0.5,
            }))
          }
        />
        <Label
          x={24}
          y={530}
          children="Over, under, and around."
          size={22}
          color="#fff1d9"
        />
        <Label
          x={24}
          y={562}
          children="Plain weave alternates each crossing. Twill steps diagonally. Herringbone breaks the twill at each reversal."
        />
        <Label
          x={24}
          y={591}
          children="Colors, thread size, rounded relief, and seeded fibers are yours to adjust. Motion stays seamless."
        />
      </Group>
    </FocusManagement>
  );
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <FabricExplorer />);
}
