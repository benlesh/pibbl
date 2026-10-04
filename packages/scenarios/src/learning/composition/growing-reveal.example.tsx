/** @jsxImportSource @crc/core */
import {
  crc,
  Group,
  Rectangle,
  Text,
  FocusManagement,
  useSignal,
  useReaction,
  type CRCController,
} from "@crc/core";
import { ReactionDiffusion, type TextureRenderer } from "@crc/core/textures";

// The artwork and raster alpha mask are composed locally. No new core mask API.
const landscape: TextureRenderer = (ctx, texture) => {
  const { width: w, height: h } = texture;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#f2b1a1");
  sky.addColorStop(0.5, "#efdbc0");
  sky.addColorStop(1, "#5fa398");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#fff2ba";
  ctx.beginPath();
  ctx.arc(w * 0.72, h * 0.28, h * 0.19, 0, Math.PI * 2);
  ctx.fill();
  for (let layer = 0; layer < 4; layer++) {
    ctx.fillStyle = ["#a36e88", "#6b6882", "#366572", "#184e5b"][layer];
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 4)
      ctx.lineTo(
        x,
        h * (0.47 + layer * 0.12) +
          Math.sin((x / w) * 9 + layer * 2) * h * 0.13 +
          Math.sin((x / w) * 21 + layer) * h * 0.025,
      );
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(texture.mask, 0, 0, w, h);
};
const typography: TextureRenderer = (ctx, texture) => {
  const gradient = ctx.createLinearGradient(
    0,
    0,
    texture.width,
    texture.height,
  );
  gradient.addColorStop(0, "#ecb984");
  gradient.addColorStop(0.5, "#ef8da8");
  gradient.addColorStop(1, "#8cbbbc");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, texture.width, texture.height);
  ctx.fillStyle = "#203148";
  ctx.font = "900 100px Georgia";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("STAY", texture.width / 2, texture.height * 0.36);
  ctx.fillText("CURIOUS", texture.width / 2, texture.height * 0.68);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(texture.mask, 0, 0, texture.width, texture.height);
};
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
          width: 146,
          height: 38,
          cornerRadius: 19,
          fill: active ? "#edbea7" : "#303343",
          cursor: "pointer",
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          x: 73,
          y: 24,
          textBaseline: "alphabetic",
          textAlign: "center",
          font: "600 12px Arial",
          fill: active ? "#2c2732" : "#ede5e2",
        }}
      >
        {label}
      </Text>
    </Group>
  );
}
function GrowingReveal({ canvas }: { canvas: HTMLCanvasElement }) {
  useReaction(() => {
    const previous = canvas.style.touchAction;
    canvas.style.touchAction = "none";
    return () => {
      if (canvas.style.touchAction === "none")
        canvas.style.touchAction = previous;
    };
  }, [canvas]);
  const state = useSignal({ paused: false, reset: 0, artwork: 0, brush: 12 });
  const s = state.get();
  return (
    <FocusManagement>
      <Group>
        <Rectangle
          pointerEvents="none"
          style={{ width: 880, height: 630, fill: "#171c2b" }}
        />
        <Text
          pointerEvents="none"
          style={{
            x: 28,
            y: 30,
            textBaseline: "alphabetic",
            font: "600 11px Arial",
            fill: "#d3a9b3",
          }}
        >
          TEXTURE STUDIES / 03
        </Text>
        <Text
          pointerEvents="none"
          style={{
            x: 28,
            y: 70,
            textBaseline: "alphabetic",
            font: "600 34px Georgia",
            fill: "#f5e5dc",
          }}
        >
          Growing Reveal
        </Text>
        <Text
          pointerEvents="none"
          style={{
            x: 28,
            y: 95,
            textBaseline: "alphabetic",
            font: "13px Arial",
            fill: "#aeb0c4",
          }}
        >
          Paint a window into another world. The living mask grows, divides, and
          recedes.
        </Text>
        <Group style={{ translateX: 24, translateY: 118 }}>
          <Rectangle
            pointerEvents="none"
            style={{ width: 832, height: 388, fill: "#0d1422" }}
          />
          <ReactionDiffusion
            seed={18}
            preset="stripes"
            paused={s.paused}
            resetRevision={s.reset}
            render={s.artwork === 0 ? landscape : typography}
            resolution={{ width: 256, height: 144 }}
            brush={{ radius: s.brush, strength: 1 }}
            style={{ width: 832, height: 388 }}
          />
        </Group>
        <Group style={{ translateX: 24, translateY: 526 }}>
          <Button
            x={0}
            label="Landscape"
            active={s.artwork === 0}
            onClick={() => state.update((v) => ({ ...v, artwork: 0 }))}
          />
          <Button
            x={160}
            label="Stay curious"
            active={s.artwork === 1}
            onClick={() => state.update((v) => ({ ...v, artwork: 1 }))}
          />
          <Button
            x={352}
            label={s.paused ? "Resume" : "Pause"}
            active={s.paused}
            onClick={() => state.update((v) => ({ ...v, paused: !v.paused }))}
          />
          <Button
            x={512}
            label={`Brush ${s.brush}`}
            onClick={() =>
              state.update((v) => ({ ...v, brush: v.brush === 12 ? 24 : 12 }))
            }
          />
          <Button
            x={672}
            label="Begin again"
            onClick={() => state.update((v) => ({ ...v, reset: v.reset + 1 }))}
          />
        </Group>
        <Text
          pointerEvents="none"
          style={{
            x: 28,
            y: 602,
            textBaseline: "alphabetic",
            font: "11px Arial",
            fill: "#929bae",
          }}
        >
          One simulation → one alpha mask → your artwork. Switching artwork
          preserves the living pattern.
        </Text>
      </Group>
    </FocusManagement>
  );
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <GrowingReveal canvas={canvas} />);
}
