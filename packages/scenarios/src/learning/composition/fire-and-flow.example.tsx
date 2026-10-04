import {
  PhysicsWorld2D,
  crcPhysicsWorld2D,
  physicsObstacles2D,
  kinematicBody2D,
  collider2D,
} from "@crc/core/physics/2d";
import {
  Group,
  Rectangle,
  Ellipse,
  Polygon,
  Text,
  crc,
  definePrimitive,
  useConst,
  useComputed,
  usePlayback,
  useSignal,
  useManipulation,
  ManipulationFrame,
  DragHandle,
  ResizeHandles,
  RotationHandle,
  type WritableSignal,
  type CRCManipulationBox,
  repeat,
  sequence,
  wait,
  marker,
  type CRCController,
} from "@crc/core";
import {
  Particles2D,
  defineParticleEffect2D,
  particleCurve,
  particleRange,
  useParticleSystem,
  useFlowField2D,
  useFlowSource2D,
  type CRCParticleEmitter2D,
} from "@crc/core/particles";

// Original procedural artwork; buffers live with this mounted example.
function smokeSprite(variant: number): OffscreenCanvas {
  const canvas = new OffscreenCanvas(96, 96);
  const context = canvas.getContext("2d")!;
  // Overlapping shaded lobes give each soft sprite internal volume, rather
  // than a single bright dot. Three silhouettes keep the plume irregular.
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.4 + variant;
    const x = 48 + Math.cos(angle) * (10 + (i % 3) * 4),
      y = 48 + Math.sin(angle) * 13;
    const radius = 22 + ((i + variant) % 3) * 3;
    const body = context.createRadialGradient(x - 5, y - 7, 0, x, y, radius);
    body.addColorStop(0, "rgba(193,204,211,0.52)");
    body.addColorStop(0.28, "rgba(156,171,183,0.48)");
    body.addColorStop(0.6, "rgba(84,102,119,0.34)");
    body.addColorStop(0.82, "rgba(61,78,94,0.14)");
    body.addColorStop(1, "rgba(61,78,94,0)");
    context.fillStyle = body;
    context.fillRect(0, 0, 96, 96);
  }
  return canvas;
}

function createFlameSurface() {
  const canvas = new OffscreenCanvas(112, 160);
  const context = canvas.getContext("2d")!;
  const pixels = context.createImageData(canvas.width, canvas.height);
  const lattice = new Float32Array(4096);
  let seed = 7919;
  for (let i = 0; i < lattice.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    lattice[i] = seed / 4294967296;
  }
  const noise = (x: number, y: number) => {
    const ix = Math.floor(x),
      iy = Math.floor(y);
    let fx = x - ix,
      fy = y - iy;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const a = lattice[((iy & 63) << 6) | (ix & 63)];
    const b = lattice[((iy & 63) << 6) | ((ix + 1) & 63)];
    const c = lattice[(((iy + 1) & 63) << 6) | (ix & 63)];
    const d = lattice[(((iy + 1) & 63) << 6) | ((ix + 1) & 63)];
    return a + (b - a) * fx + (c - a + (a - b - c + d) * fx) * fy;
  };
  let lastTime = -1,
    lastIntensity = -1;
  return {
    canvas,
    update(time: number, intensity: number) {
      if (time === lastTime && intensity === lastIntensity)
        return;
      lastTime = time;
      lastIntensity = intensity;
      for (let y = 0; y < canvas.height; y++) {
        const height = 1 - y / (canvas.height - 1);
        for (let x = 0; x < canvas.width; x++) {
          const u = (x / (canvas.width - 1) - 0.5) * 2;
          // Height increases upward; subtract time so the noise rises with it.
          const lift = height * 5 - time * 2.4;
          const curl = noise(u * 2.4 + 8, lift * 0.65) - 0.5;
          const bent =
            u - curl * height * 0.75;
          const grain =
            noise(bent * 5 + 20, lift) * 0.62 +
            noise(bent * 11 + 40, lift * 1.8) * 0.26 +
            noise(bent * 23 + 30, lift * 3.5) * 0.12;
          const taper = 0.5 * Math.pow(1 - height, 0.65);
          const envelope = 1 - Math.abs(bent) / Math.max(0.025, taper);
          const density = Math.max(
            0,
            Math.min(
              1,
              (envelope * 0.65 + grain * 0.9 - height * 0.7 - 0.2) * 3.4,
            ),
          );
          const hot = Math.min(1, density * 0.76 + (1 - height) * 0.27);
          const offset = (y * canvas.width + x) * 4;
          pixels.data[offset] = 255;
          pixels.data[offset + 1] = Math.round(55 + 196 * hot * hot);
          pixels.data[offset + 2] = Math.round(8 + 170 * Math.pow(hot, 5));
          pixels.data[offset + 3] = Math.round(
            255 * density * Math.min(1, (1 - height) * 14),
          );
        }
      }
      context.putImageData(pixels, 0, 0);
    },
  };
}

// A small effect primitive, composed in normal CRC paint order. The shared CRC
// clock changes time; rendering reuses one raster, with no separate frame loop.
const Flame = definePrimitive<{
  surface: ReturnType<typeof createFlameSurface>;
  time: number;
  intensity: number;
  x: number;
  y: number;
  pointerEvents: "none";
}>((props, _style, context) => {
  props.surface.update(props.time, props.intensity);
  const height = 100 + props.intensity * 45;
  context.drawImage(
    props.surface.canvas,
    props.x - 66,
    props.y - height + 6,
    132,
    height,
  );
});

const clockProgram = repeat(sequence(wait(40), marker("emit")), {
  iterations: Infinity,
});

function Obstacle({
  id,
  kind,
  initial,
  selected,
}: {
  id: string;
  kind: "rectangle" | "ellipse" | "triangle";
  initial: CRCManipulationBox;
  selected: WritableSignal<string | null>;
}) {
  const box = useSignal(initial);
  const rotation = useSignal(0);
  const controller = useManipulation({
    box,
    rotation,
    move: { bounds: { left: 30, top: 92, width: 660, height: 338 } },
    resize: { minWidth: 36, minHeight: 30, maxWidth: 250, maxHeight: 200 },
    rotate: {},
    onStart: () => selected.set(id),
  });
  const position = useComputed(() => {
    const b = box.get(),
      angle = rotation.get(),
      c = Math.cos(angle),
      sn = Math.sin(angle);
    return [
      b.left + b.width / 2 - (c * b.width) / 2 + (sn * b.height) / 2,
      b.top + b.height / 2 - (sn * b.width) / 2 - (c * b.height) / 2,
    ] as const;
  });
  const angleDegrees = useComputed(() => (rotation.get() * 180) / Math.PI);
  const { width, height } = box.get();
  const active = selected.get() === id;
  const paint = {
    fill:
      kind === "ellipse"
        ? "#657e9b"
        : kind === "triangle"
          ? "#997254"
          : "#397b83",
    stroke: active ? "#f2d6a1" : "#b3c7c755",
    strokeWidth: active ? 2 : 1,
    cursor: "grab" as const,
  };
  const select = () => selected.set(id);
  return (
    <ManipulationFrame {...controller.frameProps}>
      <DragHandle controller={controller}>
        <Group
          physics={kinematicBody2D({
            collider: false,
            target: { position, rotationDegrees: angleDegrees },
          })}
        >
          {kind === "rectangle" ? (
            <Rectangle
              keyboardFocusable
              onPointerDown={select}
              physics={collider2D()}
              style={{
                width,
                height,
                fill: paint.fill,
                stroke: paint.stroke,
                strokeWidth: paint.strokeWidth,
                cursor: paint.cursor,
              }}
            />
          ) : kind === "ellipse" ? (
            <Ellipse
              keyboardFocusable
              onPointerDown={select}
              physics={collider2D()}
              style={{
                cx: width / 2,
                cy: height / 2,
                radiusX: width / 2,
                radiusY: height / 2,
                fill: paint.fill,
                stroke: paint.stroke,
                strokeWidth: paint.strokeWidth,
                cursor: paint.cursor,
              }}
            />
          ) : (
            <Polygon
              keyboardFocusable
              onPointerDown={select}
              physics={collider2D()}
              style={{
                coords: [
                  [width / 2, 0],
                  [width, height],
                  [0, height],
                ],
                fill: paint.fill,
                stroke: paint.stroke,
                strokeWidth: paint.strokeWidth,
                cursor: paint.cursor,
              }}
            />
          )}
        </Group>
      </DragHandle>
      {active && <ResizeHandles controller={controller} />}
      {active && (
        <RotationHandle
          controller={controller}
          style={{ arc: true, readout: true }}
        />
      )}
    </ManipulationFrame>
  );
}

function FireAndFlow() {
  const burning = useSignal(true);
  const intensity = useSignal(0.8);
  const origin = useSignal<readonly [number, number]>([360, 370]);
  const drag = useSignal<number | null>(null);
  const fuelGesture = useConst(() => ({ x: 0, y: 0, moved: false }));
  const selected = useSignal<string | null>(null);
  const obstacles = physicsObstacles2D(crcPhysicsWorld2D());
  const flow = useFlowField2D({
    bounds: { width: 720, height: 480 },
    resolution: [96, 64],
    obstacles,
  });
  const force = useComputed(
    () => [0, -180 * intensity.get()] as const,
  );
  const heat = useComputed(() => 4 * intensity.get());
  useFlowSource2D(flow, {
    position: origin,
    radius: 40,
    acceleration: force,
    heat,
    enabled: burning,
  });
  const effects = useConst(() => {
    const smokeEmitter = (variant: number): CRCParticleEmitter2D => ({
      bounds: { min: [-720, -480], max: [720, 480] },
      name: `smoke${variant}`,
      capacity: 360,
      overflow: "recycle-oldest" as const,
      emission: [{ type: "manual" as const, count: 1 }],
      shape: {
        type: "line" as const,
        from: [-18, -30] as const,
        to: [18, -30] as const,
      },
      initial: {
        lifetimeMilliseconds: particleRange(6500, 9000),
        rotationDegrees: particleRange(0, 360),
      },
      appearance: {
        size: particleCurve([
          [0, 20 + variant * 3],
          [0.25, 44 + variant * 5],
          [1, 85 + variant * 8],
        ]),
        opacity: particleCurve([
          [0, 0],
          [0.08, 0.32],
          [0.6, 0.2],
          [1, 0],
        ]),
      },
      renderer: { type: "sprite" as const, source: smokeSprite(variant) },
    });
    return {
      smoke: defineParticleEffect2D({
        emitters: [smokeEmitter(0), smokeEmitter(1), smokeEmitter(2)],
      }),
      fire: defineParticleEffect2D({
        emitters: [
          {
            name: "embers",
            capacity: 80,
            overflow: "recycle-oldest",
            emission: [{ type: "manual", count: 1 }],
            shape: { type: "line", from: [-22, -10], to: [22, -10] },
            initial: {
              lifetimeMilliseconds: particleRange(1300, 2600),
              velocity: [particleRange(-30, 30), particleRange(-160, -90)],
              color: "#ffb85c",
              size: [2, 4],
            },
            motion: [{ type: "sway", amplitude: 8, frequency: [0.3, 0.8] }],
            appearance: {
              opacity: particleCurve([
                [0, 0],
                [0.1, 1],
                [0.55, 0.6],
                [1, 0],
              ]),
            },
            renderer: { type: "rectangle", blend: "additive" },
          },
        ],
      }),
    };
  });
  const smoke = useParticleSystem(effects.smoke, { flow, seed: 42 });
  const fire = useParticleSystem(effects.fire, { seed: 74 });
  const tick = useConst(() => ({ value: 0 }));
  const flameSurface = useConst(createFlameSurface);
  const flameTime = useSignal(0);
  usePlayback(clockProgram, {
    autoplay: true,
    onEvent: (event) => {
      if (event.type !== "marker") return;
      if (!burning.get()) return;
      const position = origin.get();
      flameTime.update((time) => time + 0.04);
      tick.value++;
      if (tick.value % 4 === 0) fire.emit("embers", { position });
      smoke.emit(`smoke${tick.value % 3}`, {
          position,
          count: Math.ceil(3 * intensity.get()),
        });
    },
  });
  const [x, y] = origin.get();
  return (
    <Group
      onKeyDown={(event) => {
        if (event.key === "Escape") selected.set(null);
      }}
    >
      <Rectangle
        onPointerDown={() => selected.set(null)}
        style={{ width: 720, height: 480, fill: "#111820" }}
      />
      <Rectangle
        pointerEvents="none"
        style={{
          left: 24,
          top: 80,
          width: 672,
          height: 360,
          fill: "#18232d",
          stroke: "#2d3b47",
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 32,
          top: 34,
          fill: "#f4e9d5",
          font: "700 24px sans-serif",
        }}
      >
        FIRE & FLOW
      </Text>
      <Text
        pointerEvents="none"
        style={{ left: 32, top: 59, fill: "#9eafbd", font: "13px sans-serif" }}
      >
        Drag a shape. Select to resize or rotate. Click empty space to deselect.
      </Text>
      <Rectangle
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.set(e.pointerId);
          fuelGesture.x = e.x;
          fuelGesture.y = e.y;
          fuelGesture.moved = false;
        }}
        onPointerMove={(e) => {
          if (drag.get() === e.pointerId) {
            fuelGesture.moved ||=
              Math.hypot(e.x - fuelGesture.x, e.y - fuelGesture.y) > 3;
            if (fuelGesture.moved)
              origin.set([
                Math.max(90, Math.min(630, e.x)),
                Math.max(320, Math.min(395, e.y)),
              ]);
          }
        }}
        onPointerUp={(e) => {
          if (drag.get() === e.pointerId) {
            e.currentTarget.releasePointerCapture(e.pointerId);
            drag.set(null);
          }
        }}
        onPointerCancel={() => drag.set(null)}
        onClick={() => {
          if (!fuelGesture.moved) burning.update((v) => !v);
        }}
        style={{
          left: x - 40,
          top: y,
          width: 80,
          height: 54,
          fill: burning.get() ? "#954526" : "#4d5660",
          stroke: "#c78958",
          cursor: drag.get() === null ? "grab" : "grabbing",
        }}
      />
      <Particles2D
        system={smoke}
        pointerEvents="none"
        style={{ width: 720, height: 480 }}
      />
      {burning.get() && (
        <Flame
          surface={flameSurface}
          time={flameTime.get()}
          intensity={intensity.get()}
          x={x}
          y={y}
          pointerEvents="none"
        />
      )}
      <Particles2D
        system={fire}
        pointerEvents="none"
        style={{ width: 720, height: 480 }}
      />
      <Rectangle
        pointerEvents="none"
        style={{
          left: x - 45,
          top: y + 39,
          width: 90,
          height: 15,
          fill: "#39434b",
          stroke: "#76808a",
        }}
      />
      <Obstacle
        id="rectangle"
        kind="rectangle"
        initial={{ left: 285, top: 245, width: 100, height: 55 }}
        selected={selected}
      />
      <Obstacle
        id="ellipse"
        kind="ellipse"
        initial={{ left: 385, top: 145, width: 125, height: 65 }}
        selected={selected}
      />
      <Obstacle
        id="triangle"
        kind="triangle"
        initial={{ left: 190, top: 125, width: 90, height: 85 }}
        selected={selected}
      />
      <Rectangle
        onClick={() => intensity.update((v) => (v >= 1.2 ? 0.4 : v + 0.4))}
        style={{
          left: 32,
          top: 447,
          width: 180,
          height: 26,
          fill: "#2d3d49",
          cursor: "pointer",
        }}
      />
      <Text
        pointerEvents="none"
        style={{ left: 44, top: 465, fill: "#d5e1e8", font: "12px sans-serif" }}
      >
        Intensity {Math.round(intensity.get() * 100)}%
      </Text>
      <Rectangle
        onClick={() => selected.set(null)}
        style={{
          left: 226,
          top: 447,
          width: 462,
          height: 26,
          fill: "#2d3d49",
          cursor: "pointer",
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 239,
          top: 465,
          fill: "#d5e1e8",
          font: "12px sans-serif",
        }}
      >
        {selected.get() ? "Deselect shape" : "Select a shape"}
      </Text>
    </Group>
  );
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(
    canvas,
    <PhysicsWorld2D space="local" gravity={[0, 0]}>
      <FireAndFlow />
    </PhysicsWorld2D>,
    { pixelRatio: 1 },
  );
}
