/** @jsxImportSource @pibbl/core */
import {
  pibbl,
  Group,
  Rectangle,
  Text,
  FocusManagement,
  useSignal,
  useConst,
  type PibblController,
  type TextureRecipe,
  type PibblPointerEvent,
} from "@pibbl/core";
import {
  useTexture,
  schnakenberg,
  barkley,
  brusselator,
  schnakenbergPresets,
  barkleyPresets,
  brusselatorPresets,
  texturePalettes,
  type InkMessage,
} from "@pibbl/core/textures";

const models = ["Schnakenberg", "Barkley", "Brusselator"];
const collections = [schnakenbergPresets, barkleyPresets, brusselatorPresets];
const factories = [schnakenberg, barkley, brusselator];
const palettes = [
  texturePalettes.lagoon,
  texturePalettes.porcelain,
  texturePalettes.ember,
];
interface Controls {
  model: number;
  preset: number;
  a: number;
  b: number;
  epsilon: number;
  diffusionU: number;
  diffusionV: number;
  initialNoise: number;
  warmupSteps: number;
  speed: number;
  paused: boolean;
  seed: number;
  palette: number;
  tile: number;
  stir: boolean;
}
function presetValues(model: number, preset: number) {
  const collection = collections[model]!;
  const values = Object.values(collection)[preset]! as {
    a: number;
    b: number;
    epsilon?: number;
    diffusionU: number;
    diffusionV: number;
    warmupSteps?: number;
  };
  return {
    ...values,
    epsilon: values.epsilon ?? 0.02,
    initialNoise: 0.1,
    warmupSteps: values.warmupSteps ?? 4096,
  };
}
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
function Slider({
  label,
  value,
  min,
  max,
  step,
  y,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  y: number;
  onChange: (value: number) => void;
}) {
  const change = (value: number) =>
    onChange(Math.max(min, Math.min(max, Math.round(value / step) * step)));
  return (
    <Group>
      <Label
        x={24}
        y={y}
        children={`${label}  ${value.toFixed(step < 0.01 ? 3 : step < 1 ? 2 : 0)}`}
      />
      <Rectangle
        keyboardFocusable
        onClick={(event) => change(min + ((event.x - 24) / 248) * (max - min))}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") change(value - step);
          if (event.key === "ArrowRight") change(value + step);
        }}
        style={{
          left: 24,
          top: y + 8,
          width: 248,
          height: 18,
          cornerRadius: 6,
          fill: "#3a3547",
          cursor: "pointer",
        }}
      />
      <Rectangle
        pointerEvents="none"
        style={{
          left: 24,
          top: y + 8,
          width: Math.max(2, (248 * (value - min)) / (max - min)),
          height: 18,
          cornerRadius: 6,
          fill: "#edbd91",
        }}
      />
    </Group>
  );
}
function Field({
  recipe,
  palette,
  tile,
  stir,
}: {
  recipe: TextureRecipe<InkMessage>;
  palette: number;
  tile: number;
  stir: boolean;
}) {
  const texture = useTexture(recipe, {
    resolution: { width: 96, height: 96 },
    palette: palettes[palette],
  });
  const stroke = useConst(() => ({
    id: undefined as number | undefined,
    u: 0,
    v: 0,
  }));
  const brush = (event: PibblPointerEvent) => {
    const u = Math.max(0, Math.min(1, (event.x - 320) / 536)),
      v = Math.max(0, Math.min(1, (event.y - 210) / 360));
    if (stir)
      texture.send({
        type: "stir",
        u,
        v,
        du: u - stroke.u,
        dv: v - stroke.v,
        radius: 12,
      });
    else texture.send({ type: "paint", u, v, radius: 5, strength: 0.85 });
    stroke.u = u;
    stroke.v = v;
  };
  const end = (event: PibblPointerEvent) => {
    if (stroke.id === event.pointerId) {
      stroke.id = undefined;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  return (
    <Group>
      <Button
        x={694}
        y={132}
        label="Reset"
        onClick={() => texture.send({ type: "reset" })}
      />
      <Label
        x={320}
        y={194}
        size={17}
        color="#fff1d9"
        children="One tile · paint or drag to disturb"
      />
      <Rectangle
        style={{
          left: 320,
          top: 210,
          width: 536,
          height: 360,
          fill: texture.paint({ mode: "stretch" }),
          cursor: "crosshair",
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 || !event.isPrimary || stroke.id !== undefined)
            return;
          stroke.id = event.pointerId;
          stroke.u = (event.x - 320) / 536;
          stroke.v = (event.y - 210) / 360;
          event.currentTarget.setPointerCapture(event.pointerId);
          brush(event);
        }}
        onPointerMove={(event) => {
          if (stroke.id === event.pointerId) brush(event);
        }}
        onPointerUp={end}
        onPointerCancel={end}
      />
      <Label
        x={320}
        y={611}
        size={17}
        color="#fff1d9"
        children="Seamless repeat · same living field"
      />
      <Rectangle
        pointerEvents="none"
        style={{
          left: 320,
          top: 625,
          width: 536,
          height: 220,
          fill: texture.paint({
            mode: "repeat",
            tileWidth: tile,
            tileHeight: tile,
          }),
        }}
      />
    </Group>
  );
}
function Explorer() {
  const state = useSignal<Controls>({
    model: 0,
    preset: 0,
    ...presetValues(0, 0),
    speed: 1,
    paused: false,
    seed: 42,
    palette: 0,
    tile: 160,
    stir: false,
  });
  const s = state.get();
  const set = (key: keyof Controls, value: number) =>
    state.update((v) => ({ ...v, [key]: value }));
  const recipe = factories[s.model]!({
    a: s.a,
    b: s.b,
    epsilon: s.epsilon,
    diffusionU: s.diffusionU,
    diffusionV: s.diffusionV,
    initialNoise: s.initialNoise,
    warmupSteps: s.warmupSteps,
    speed: s.speed,
    paused: s.paused,
    seed: s.seed,
  });
  const names = Object.keys(collections[s.model]!);
  const parameters: [keyof Controls, string, number, number, number][] = [
    [
      "a",
      "a",
      s.model === 1 ? 0.3 : s.model === 2 ? 0.1 : 0.01,
      s.model === 1 ? 1.2 : s.model === 2 ? 3 : 2,
      0.01,
    ],
    [
      "b",
      "b",
      s.model === 1 ? 0 : s.model === 2 ? 0.1 : 0.01,
      s.model === 1 ? 0.2 : s.model === 2 ? 5 : 2,
      s.model === 1 ? 0.005 : 0.01,
    ],
    ...(s.model === 1
      ? [
          ["epsilon", "Recovery ε", 0.005, 0.1, 0.005] as [
            keyof Controls,
            string,
            number,
            number,
            number,
          ],
        ]
      : []),
    ["diffusionU", "Diffusion U", 0, 32, 0.1],
    ["diffusionV", "Diffusion V", 0, 32, 0.1],
    ["initialNoise", "Initial noise", 0, 1, 0.01],
    ["speed", "Speed", 0, 4, 0.1],
    ["warmupSteps", "Warmup steps", 0, 12000, 256],
  ];
  return (
    <FocusManagement>
      <Group>
        <Rectangle
          pointerEvents="none"
          style={{ width: 880, height: 910, fill: "#211e2b" }}
        />
        <Label
          x={24}
          y={30}
          children="TEXTURE EXPLORER / REACTION + DIFFUSION"
          color="#edbd91"
          size={11}
        />
        <Label
          x={24}
          y={65}
          children="Living patterns, three ways."
          color="#fff1d9"
          size={30}
        />
        {models.map((name, index) => (
          <Button
            key={name}
            x={24 + index * 190}
            y={86}
            width={180}
            label={name}
            active={s.model === index}
            onClick={() =>
              state.update((v) => ({
                ...v,
                model: index,
                preset: 0,
                ...presetValues(index, 0),
              }))
            }
          />
        ))}
        <Button
          x={614}
          y={86}
          width={204}
          label={`Preset: ${names[s.preset]}`}
          onClick={() =>
            state.update((v) => {
              const preset = (v.preset + 1) % names.length;
              return { ...v, preset, ...presetValues(v.model, preset) };
            })
          }
        />
        <Button
          x={24}
          y={132}
          label={`Palette ${s.palette + 1}`}
          onClick={() => set("palette", (s.palette + 1) % 3)}
        />
        <Button
          x={158}
          y={132}
          label={`Tile ${s.tile}px`}
          onClick={() =>
            set("tile", s.tile === 160 ? 96 : s.tile === 96 ? 240 : 160)
          }
        />
        <Button
          x={292}
          y={132}
          label={s.paused ? "Resume" : "Pause"}
          active={s.paused}
          onClick={() => state.update((v) => ({ ...v, paused: !v.paused }))}
        />
        <Button
          x={426}
          y={132}
          label={s.stir ? "Brush: stir" : "Brush: paint"}
          onClick={() => state.update((v) => ({ ...v, stir: !v.stir }))}
        />
        <Button
          x={560}
          y={132}
          label={`Seed ${s.seed}`}
          onClick={() => set("seed", s.seed + 1)}
        />
        <Label
          x={24}
          y={194}
          children="Click a track; arrow keys fine-tune."
          size={12}
        />
        {parameters.map(([key, label, min, max, step], index) => (
          <Slider
            key={key}
            label={label}
            value={s[key] as number}
            min={min}
            max={max}
            step={step}
            y={226 + index * 64}
            onChange={(value) => set(key, value)}
          />
        ))}
        <Label
          x={24}
          y={802}
          children="Chemistry changes restart the field."
          size={11}
        />
        <Label
          x={24}
          y={823}
          children="Colors, tile size, speed and pause preserve it."
          size={11}
        />
        <Field
          key={s.model}
          recipe={recipe}
          palette={s.palette}
          tile={s.tile}
          stir={s.stir}
        />
        <Label
          x={24}
          y={886}
          children={`${models[s.model]} / ${names[s.preset]} · ${s.paused || s.speed === 0 ? "Frozen" : "Evolving"} · Periodic boundaries and wrapped brushes.`}
          size={12}
        />
      </Group>
    </FocusManagement>
  );
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <Explorer />);
}
