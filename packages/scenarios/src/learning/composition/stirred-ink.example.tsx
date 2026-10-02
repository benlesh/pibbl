/** @jsxImportSource @crc/core */
import {
  crc,
  Group,
  Rectangle,
  Circle,
  useSignal,
  useReaction,
  useRef,
  useTexture,
  usePlayback,
  track,
  tween,
  repeat,
  sequence,
  wait,
  type Texture,
  type CRCController,
  Text,
  signal,
} from "@crc/core";
import {
  marble,
  paper,
  cellular,
  reactionDiffusion,
  type InkMessage,
} from "@crc/textures";
import {
  PhysicsWorld2D,
  crcPhysicsBody2D,
  collider2D,
  dynamicBody2D,
  staticBody2D,
} from "@crc/physics/2d";
export default function mount(canvas: HTMLCanvasElement): CRCController {
  const paused = signal(false);
  const stirring = signal(true);
  let ink: Texture<InkMessage>;
  function Materials() {
    const detail = useSignal(0.2);
    usePlayback(
      repeat(
        sequence(
          track(detail, tween({ from: 0.2, to: 0.9, duration: 3000 })),
          wait(16),
        ),
        { iterations: Infinity, direction: "alternate" },
      ),
      { autoplay: true },
    );
    const value = detail.get();
    const a = useTexture(marble({ detail: value }), {
      resolution: { width: 96, height: 96 },
    });
    const b = useTexture(paper({ detail: value }), {
      resolution: { width: 96, height: 96 },
    });
    const c = useTexture(cellular({ detail: value }), {
      resolution: { width: 96, height: 96 },
    });
    return (
      <Group>
        {[a, b, c].map((texture, i) => (
          <Rectangle
            key={i}
            style={{ x: i * 200, y: 0, width: 192, height: 160, fill: texture }}
          />
        ))}
      </Group>
    );
  }
  function Ink() {
    const body = crcPhysicsBody2D();
    ink = useTexture(reactionDiffusion({ seed: 42, preset: "stripes" }), {
      resolution: { width: 256, height: 128 },
      palette: ["#101f2b", "#265869", "#77b8ac", "#f3d69d"],
    });
    const previous = useRef<readonly number[] | undefined>(undefined);
    useReaction(() => {
      const active = stirring.get();
      const [x, y] = body.position.get();
      const generation = body.generation.get();
      const last = previous.current;
      previous.current = [x, y, generation];
      if (
        !active ||
        !last ||
        last[2] !== generation ||
        Math.hypot(x - last[0], y - last[1]) > 40 ||
        (x === last[0] && y === last[1])
      )
        return;
      ink.send({
        type: "stir",
        u: x / 600,
        v: (y - 180) / 300,
        du: ((x - last[0]) / 600) * 2.5,
        dv: ((y - last[1]) / 300) * 2.5,
        radius: 22,
      });
    });
    return (
      <PhysicsWorld2D gravity={[0, 0]}>
        <Rectangle
          style={{ x: 0, y: 180, width: 600, height: 300, fill: ink }}
        />
        <Rectangle
          physics={staticBody2D({ collider: { restitution: 1, friction: 0 } })}
          style={{ x: 0, y: 180, width: 600, height: 8, fill: "#6c9699" }}
        />
        <Rectangle
          physics={staticBody2D({ collider: { restitution: 1, friction: 0 } })}
          style={{ x: 0, y: 472, width: 600, height: 8, fill: "#6c9699" }}
        />
        <Rectangle
          physics={staticBody2D({ collider: { restitution: 1, friction: 0 } })}
          style={{ x: 0, y: 180, width: 8, height: 300, fill: "#6c9699" }}
        />
        <Rectangle
          physics={staticBody2D({ collider: { restitution: 1, friction: 0 } })}
          style={{ x: 592, y: 180, width: 8, height: 300, fill: "#6c9699" }}
        />
        <Group
          physics={dynamicBody2D({
            handle: body,
            linearVelocity: [180, 130],
            allowSleep: false,
            collider: false,
            mass: 1,
          })}
          style={{ translateX: 300, translateY: 300 }}
        >
          <Circle
            physics={collider2D({
              restitution: 1,
              friction: 0,
            })}
            style={{
              radius: 9,
              fill: "#77b8ac66",
              stroke: "#e3fff1",
              strokeWidth: 2,
            }}
          />
        </Group>
      </PhysicsWorld2D>
    );
  }
  function Button({
    x,
    label,
    onClick,
  }: {
    x: number;
    label: string;
    onClick: () => void;
  }) {
    return (
      <Group style={{ translateX: x, translateY: 520 }}>
        <Rectangle
          keyboardFocusable
          onClick={onClick}
          style={{
            width: 192,
            height: 40,
            cornerRadius: 8,
            fill: "#265869",
            cursor: "pointer",
          }}
        />
        <Text
          pointerEvents="none"
          style={{
            x: 96,
            y: 25,
            font: "14px Arial",
            textAlign: "center",
            fill: "#ffffff",
          }}
        >
          {label}
        </Text>
      </Group>
    );
  }
  function Controls() {
    return (
      <>
        <Text style={{ x: 0, y: 500, font: "14px Arial", fill: "#cadfd9" }}>
          A moving body drags the ink; the reaction reshapes its wake.
        </Text>
        <Button
          x={0}
          label={paused.get() ? "Resume reaction" : "Pause reaction"}
          onClick={() => {
            paused.set(!paused.get());
            ink.send({ type: "pause", paused: paused.get() });
          }}
        />
        <Button
          x={200}
          label={stirring.get() ? "Stop stirring" : "Start stirring"}
          onClick={() => stirring.set(!stirring.get())}
        />
        <Button
          x={400}
          label="Reset ink"
          onClick={() => ink.send({ type: "reset" })}
        />
      </>
    );
  }
  return crc(
    canvas,
    <>
      <Rectangle
        pointerEvents="none"
        style={{ width: 600, height: 580, fill: "#101f2b" }}
      />
      <Materials />
      <Ink />
      <Controls />
    </>,
  );
}
