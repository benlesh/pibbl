/** @jsxImportSource @pibbl/core */
import {
  pibbl,
  Group,
  Rectangle,
  Text,
  Image,
  FocusManagement,
  useSignal,
  definePrimitive,
  type PibblNode,
  type PibblController,
} from "@pibbl/core";
import {
  softNoise,
  ridgedNoise,
  plainWeave,
  paper,
  cellular,
  useTexture,
} from "@pibbl/core/textures";

import { emboss } from "@pibbl/core/filters";

// Original vector artwork stays editable and local; Image handles its decoding.
const artwork = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="660" height="500" viewBox="0 0 660 500">
<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#deb788"/><stop offset="1" stop-color="#f0dac1"/></linearGradient><linearGradient id="water" x2="0" y2="1"><stop stop-color="#668b92"/><stop offset="1" stop-color="#233f51"/></linearGradient></defs>
<rect width="660" height="500" fill="url(#sky)"/><circle cx="482" cy="128" r="49" fill="#e7a35d"/>
<path d="M0 260 Q60 154 148 201 T288 161 Q388 122 440 210 T660 184 V370 H0" fill="#849895"/>
<path d="M0 308 Q90 231 202 285 T365 245 Q454 210 560 263 L660 229 V370 H0" fill="#567976"/>
<path d="M0 332 Q230 310 660 326 V500 H0" fill="url(#water)"/>
<g fill="none" stroke-linecap="round" opacity=".5"><path d="M24 364h161m40 5h110m60-9h220M10 408h150m50-8h190m42 10h160M62 455h210m50-7h100m50 10h153" stroke="#a5b2a1" stroke-width="5"/><path d="M382 347h80m-99 15h112m-66 16h60" stroke="#e9bc81" stroke-width="7"/></g>
<path d="M0 418 Q40 381 85 401 T166 455 L0 500" fill="#304d46"/><path d="M515 500 Q565 419 660 411 V500" fill="#304f4b"/>
<path d="M472 316l64 3-14 12h-40z" fill="#503c36"/><path d="M500 257v60l30-2z" fill="#f5e4bf"/>
</svg>`)}`;
// App-owned blend scopes use Canvas state already isolated by definePrimitive.
const Darken = definePrimitive<{ children: PibblNode }>(
  (props, _style, context) => {
    context.globalCompositeOperation = "multiply";
    return props.children;
  },
);
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

const lightDirections = [
  [-0.6, -0.8],
  [0.6, -0.8],
  [0.6, 0.8],
  [-0.6, 0.8],
] as const;
const lightLabels = [
  "Light upper left",
  "Light upper right",
  "Light lower right",
  "Light lower left",
] as const;
function Surface({
  canvas,
  seed,
  tile,
  strength,
  relief,
  light,
}: {
  canvas: boolean;
  seed: number;
  tile: number;
  strength: number;
  relief: boolean;
  light: number;
}) {
  // White is height, not yarn color. The filter derives normals from neighboring
  // samples and applies light to the image itself, preserving its pigment color.
  const height = useTexture(
    canvas
      ? plainWeave({
          seed,
          threads: 16,
          threadWidth: 0.95,
          relief: 0.4,
          fuzz: 0.6,
        })
      : paper({ seed, scale: 8, detail: 0.7 }),
    {
      resolution: { width: 512, height: 512 },
      palette: ["#000000", "#ffffff"],
    },
  );
  return (
    <Group
      style={{
        left: 444,
        top: 164,
        width: 396,
        height: 300,
        filter: emboss(
          height.paint({ mode: "repeat", tileWidth: tile, tileHeight: tile }),
          {
            region: { x: 0, y: 0, width: 396, height: 300 },
            depth: 3,
            strength: relief ? strength : 0,
            direction: lightDirections[light]!,
          },
        ),
      }}
    >
      <Image
        pointerEvents="none"
        style={{ src: artwork, width: 396, height: 300 }}
      />
    </Group>
  );
}

function MaterialOverlay() {
  const state = useSignal({
    strength: 0.45,
    tile: 96,
    canvas: true,
    seed: 42,
    pigment: true,
    moving: false,
    relief: true,
    light: 0,
  });
  const s = state.get();
  const noiseOptions = {
    seed: s.seed,
    frequency: 4,
    octaves: 4,
    speed: s.moving ? 0.08 : 0,
  };
  const cloud = useTexture(softNoise(noiseOptions), {
    resolution: { width: 256, height: 256 },
    palette: ["#232d38", "#76999a", "#e7ddc4"],
  });
  const ridge = useTexture(ridgedNoise(noiseOptions), {
    resolution: { width: 256, height: 256 },
    palette: ["#232d38", "#76999a", "#e7ddc4"],
  });
  const cells = useTexture(cellular({ seed: s.seed, scale: 8 }), {
    resolution: { width: 256, height: 256 },
    palette: ["#232d38", "#76999a", "#e7ddc4"],
  });
  const pigment = useTexture(softNoise(noiseOptions), {
    resolution: { width: 256, height: 256 },
    palette: ["#b0b0b0", "#ffffff"],
  });
  return (
    <FocusManagement>
      <Group>
        <Rectangle
          pointerEvents="none"
          style={{ width: 880, height: 790, fill: "#211e2b" }}
        />
        <Label
          x={24}
          y={34}
          children="TEXTURE EXPLORER / NOISE + COMPOSITION"
          size={11}
          color="#edbd91"
        />
        <Label
          x={24}
          y={70}
          children="Give an image a surface."
          size={30}
          color="#fff1d9"
        />
        <Button
          x={24}
          y={88}
          label={`Strength ${Math.round(s.strength * 100)}%`}
          onClick={() =>
            state.update((v) => ({
              ...v,
              strength: v.strength === 0.45 ? 0 : v.strength === 0 ? 0.8 : 0.45,
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
              tile: v.tile === 96 ? 48 : v.tile === 48 ? 160 : 96,
            }))
          }
        />
        <Button
          x={292}
          y={88}
          label={s.canvas ? "Canvas weave" : "Paper grain"}
          onClick={() => state.update((v) => ({ ...v, canvas: !v.canvas }))}
        />
        <Button
          x={426}
          y={88}
          label="New seed"
          onClick={() => state.update((v) => ({ ...v, seed: v.seed + 1 }))}
        />
        <Button
          x={560}
          y={88}
          label={s.pigment ? "Pigment on" : "Pigment off"}
          active={s.pigment}
          onClick={() => state.update((v) => ({ ...v, pigment: !v.pigment }))}
        />
        <Button
          x={694}
          y={88}
          label={s.moving ? "Noise moving" : "Noise still"}
          active={s.moving}
          onClick={() => state.update((v) => ({ ...v, moving: !v.moving }))}
        />
        <Label
          x={24}
          y={151}
          children="Original image"
          size={18}
          color="#fff1d9"
        />
        <Label
          x={444}
          y={151}
          children="Height-lit surface + pigment"
          size={18}
          color="#fff1d9"
        />
        <Image
          pointerEvents="none"
          style={{ src: artwork, left: 24, top: 164, width: 396, height: 300 }}
        />
        <Surface
          key={s.canvas ? "canvas" : "paper"}
          canvas={s.canvas}
          seed={s.seed}
          tile={s.tile}
          strength={s.strength}
          relief={s.relief}
          light={s.light}
        />
        <Darken>
          {s.pigment && (
            <Rectangle
              pointerEvents="none"
              style={{
                left: 444,
                top: 164,
                width: 396,
                height: 300,
                opacity: s.strength * 0.5,
                fill: pigment.paint({ mode: "stretch" }),
              }}
            />
          )}
        </Darken>
        <Button
          x={444}
          y={478}
          width={168}
          label={s.relief ? "Relief on" : "Relief off"}
          active={s.relief}
          onClick={() => state.update((v) => ({ ...v, relief: !v.relief }))}
        />
        <Button
          x={624}
          y={478}
          width={168}
          label={lightLabels[s.light]!}
          onClick={() =>
            state.update((v) => ({ ...v, light: (v.light + 1) % 4 }))
          }
        />
        <Label x={24} y={502} children="Strength zero restores the original." />
        <Label x={24} y={543} children="Soft noise" size={18} color="#fff1d9" />
        <Label
          x={304}
          y={543}
          children="Ridged noise"
          size={18}
          color="#fff1d9"
        />
        <Label
          x={584}
          y={543}
          children="Cellular (existing)"
          size={18}
          color="#fff1d9"
        />
        <Rectangle
          pointerEvents="none"
          style={{
            left: 24,
            top: 560,
            width: 256,
            height: 144,
            fill: cloud.paint({
              mode: "repeat",
              tileWidth: 128,
              tileHeight: 128,
            }),
          }}
        />
        <Rectangle
          pointerEvents="none"
          style={{
            left: 304,
            top: 560,
            width: 256,
            height: 144,
            fill: ridge.paint({
              mode: "repeat",
              tileWidth: 128,
              tileHeight: 128,
            }),
          }}
        />
        <Rectangle
          pointerEvents="none"
          style={{
            left: 584,
            top: 560,
            width: 256,
            height: 144,
            fill: cells.paint({
              mode: "repeat",
              tileWidth: 128,
              tileHeight: 128,
            }),
          }}
        />
        <Label
          x={24}
          y={742}
          children="Seamless height maps. Directional relief lighting. Independent pigment variation."
        />
      </Group>
    </FocusManagement>
  );
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <MaterialOverlay />);
}
