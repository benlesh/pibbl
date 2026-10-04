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
} from "@crc/core";
import {
  marble,
  paper,
  cellular,
  reactionDiffusion,
  type InkMessage,
} from "@crc/core/textures";
import {
  PhysicsWorld2D,
  crcPhysicsBody2D,
  collider2D,
  dynamicBody2D,
  staticBody2D,
} from "@crc/core/physics/2d";
export function mountProductionScene(canvas: HTMLCanvasElement) {
  const observations = {
    disturbances: 0,
    materialDetail: 0.2,
  };
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
    observations.materialDetail = value;
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
            style={{ left: i * 200, top: 0, width: 192, height: 160, fill: texture }}
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
      const [x, y] = body.position.get();
      const generation = body.generation.get();
      const last = previous.current;
      previous.current = [x, y, generation];
      if (!last || last[2] !== generation || Math.hypot(x-last[0], y-last[1]) > 40 || (x === last[0] && y === last[1])) return;
      ink.send({
        type: "stir",
        u: x / 600,
        v: (y - 180) / 300,
        du: ((x - last[0]) / 600) * 2.5,
        dv: ((y - last[1]) / 300) * 2.5,
        radius: 22,
      });
      observations.disturbances++;
    });
    return (
      <PhysicsWorld2D gravity={[0, 0]}>
        <Rectangle
          style={{ left: 0, top: 180, width: 600, height: 300, fill: ink }}
        />
        <Rectangle
          physics={staticBody2D({ collider: { restitution: 1, friction: 0 } })}
          style={{ left: 0, top: 180, width: 600, height: 8, fill: "#6c9699" }}
        />
        <Rectangle
          physics={staticBody2D({ collider: { restitution: 1, friction: 0 } })}
          style={{ left: 0, top: 472, width: 600, height: 8, fill: "#6c9699" }}
        />
        <Rectangle
          physics={staticBody2D({ collider: { restitution: 1, friction: 0 } })}
          style={{ left: 0, top: 180, width: 8, height: 300, fill: "#6c9699" }}
        />
        <Rectangle
          physics={staticBody2D({ collider: { restitution: 1, friction: 0 } })}
          style={{ left: 592, top: 180, width: 8, height: 300, fill: "#6c9699" }}
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
  const controller = crc(
    canvas,
    <>
      <Materials />
      <Ink />
    </>,
  );
  return {
    controller,
    observations,
    pauseInk(paused: boolean) {
      ink.send({ type: "pause", paused });
    },
  };
}
