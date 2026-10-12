/** @jsxImportSource @pibbl/core */
import {
  pibbl,
  Group,
  Rectangle,
  Text,
  FocusManagement,
  useSignal,
  useReaction,
  type PibblController,
  type Texture,
  type TextureRecipe,
} from "@pibbl/core";
import {
  stripes,
  checkers,
  woodGrain,
  reactionDiffusion,
  grayScottPresets,
  useTexture,
  type InkMessage,
  type ReactionDiffusionPreset,
} from "@pibbl/core/textures";

const palettes = [
  ["#24160d", "#704020", "#ba8350", "#f1d6a0"],
  ["#092b32", "#247780", "#88cdb0", "#eef7d5"],
  ["#241c48", "#704c9b", "#d494db", "#ffe6f1"],
];
const presets = Object.keys(grayScottPresets) as ReactionDiffusionPreset[];
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
    resolution: { width: 256, height: 256 },
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
          fill: texture.paint({ mode: "repeat", tileWidth: 128, tileHeight: 128 }),
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
function InkCard({
  preset,
  palette,
  tile,
  paused,
  reset,
}: {
  preset: ReactionDiffusionPreset;
  palette: number;
  tile: number;
  paused: boolean;
  reset: number;
}) {
  const texture: Texture<InkMessage> = useTexture(
    reactionDiffusion({ preset, seed: 42 + reset, warmupSteps: 1800 }),
    { resolution: { width: 96, height: 96 }, palette: palettes[palette] },
  );
  useReaction(() => {
    texture.send({ type: "pause", paused });
  }, [texture, paused, preset, reset]);
  return (
    <>
      <Rectangle
        style={{
          left: 24,
          top: 554,
          width: 160,
          height: 160,
          fill: texture.paint({ mode: "stretch" }),
          cursor: "crosshair",
        }}
        onClick={(event) =>
          texture.send({
            type: "paint",
            u: (event.x - 24) / 160,
            v: (event.y - 554) / 160,
            radius: 10,
          })
        }
      />
      <Rectangle
        pointerEvents="none"
        style={{
          left: 200,
          top: 554,
          width: 656,
          height: 160,
          fill: texture.paint({
            mode: "repeat",
            tileWidth: tile,
            tileHeight: tile,
          }),
        }}
      />
    </>
  );
}
function TextureExplorer() {
  const state = useSignal({
    palette: 0,
    tile: 80,
    moving: false,
    bands: 8,
    wave: 0,
    cells: 8,
    distortion: 0.5,
    knots: 2,
    seed: 42,
    preset: "coral" as ReactionDiffusionPreset,
    inkPaused: false,
    reset: 0,
  });
  const s = state.get();
  const speed = s.moving ? 0.12 : 0;
  return (
    <FocusManagement>
      <Group>
        <Rectangle
          pointerEvents="none"
          style={{ width: 880, height: 820, fill: "#211e2b" }}
        />
        <Label
          x={24}
          y={34}
          children="TEXTURE EXPLORER / FIRST COLLECTION"
          size={11}
          color="#edbd91"
        />
        <Label
          x={24}
          y={70}
          children="Patterns you can make your own."
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
              tile: v.tile === 80 ? 40 : v.tile === 40 ? 128 : 80,
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
          label="New wood seed"
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
          title="Stripes"
          recipe={stripes({ bands: s.bands, wave: s.wave, speed })}
          palette={s.palette}
          tile={s.tile}
        />
        <PatternCard
          x={304}
          title="Checkers"
          recipe={checkers({ columns: s.cells, rows: s.cells, speed })}
          palette={s.palette}
          tile={s.tile}
        />
        <PatternCard
          x={584}
          title="Wood grain"
          recipe={woodGrain({
            seed: s.seed,
            grain: 24,
            distortion: s.distortion,
            knots: s.knots,
            knotSize: 0.12,
            speed,
          })}
          palette={s.palette}
          tile={s.tile}
        />
        <Button
          x={24}
          y={454}
          label={`Bands ${s.bands}`}
          onClick={() =>
            state.update((v) => ({ ...v, bands: v.bands === 8 ? 4 : 8 }))
          }
        />
        <Button
          x={158}
          y={454}
          label={s.wave ? "Wavy" : "Straight"}
          active={!!s.wave}
          onClick={() =>
            state.update((v) => ({ ...v, wave: v.wave ? 0 : 0.08 }))
          }
        />
        <Button
          x={304}
          y={454}
          width={256}
          label={`Checker cells ${s.cells}`}
          onClick={() =>
            state.update((v) => ({ ...v, cells: v.cells === 8 ? 4 : 8 }))
          }
        />
        <Button
          x={584}
          y={454}
          label={`Bend ${Math.round(s.distortion * 100)}%`}
          onClick={() =>
            state.update((v) => ({
              ...v,
              distortion:
                v.distortion === 0.5 ? 1 : v.distortion === 1 ? 0 : 0.5,
            }))
          }
        />
        <Button
          x={718}
          y={454}
          label={`Knots ${s.knots}`}
          onClick={() =>
            state.update((v) => ({
              ...v,
              knots: v.knots === 2 ? 0 : v.knots === 0 ? 4 : 2,
            }))
          }
        />
        <Label
          x={24}
          y={534}
          children={`Living Gray–Scott / ${s.preset}`}
          size={22}
          color="#fff1d9"
        />
        <Button
          x={584}
          y={508}
          label={s.inkPaused ? "Resume ink" : "Pause ink"}
          active={s.inkPaused}
          onClick={() =>
            state.update((v) => ({ ...v, inkPaused: !v.inkPaused }))
          }
        />
        <Button
          x={718}
          y={508}
          label="Reseed ink"
          onClick={() => state.update((v) => ({ ...v, reset: v.reset + 1 }))}
        />
        <InkCard
          preset={s.preset}
          palette={s.palette}
          tile={s.tile}
          paused={s.inkPaused}
          reset={s.reset}
        />
        {presets.map((preset, i) => (
          <Button
            key={preset}
            x={24 + i * 140}
            y={734}
            width={132}
            label={preset}
            active={s.preset === preset}
            onClick={() => state.update((v) => ({ ...v, preset }))}
          />
        ))}
        <Label
          x={24}
          y={797}
          children="Paint the ink tile. Colors and tile size preserve its field. Warm-started at 1,800 steps."
          size={12}
        />
      </Group>
    </FocusManagement>
  );
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <TextureExplorer />);
}
