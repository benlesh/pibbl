import {
  Circle,
  Group,
  Rectangle,
  Text,
  crc,
  useSignal,
  type CRCController,
} from "@crc/core";
import {
  PhysicsWorld2D,
  applyImpulse2D,
  collider2D,
  crcPhysicsBody2D,
  dynamicBody2D,
  staticBody2D,
} from "@crc/physics/2d";

function Ball({ x, color }: { x: number; color: string }) {
  const body = crcPhysicsBody2D();
  return (
    <Group
      physics={dynamicBody2D({ handle: body, collider: false, mass: 1 })}
      style={{ translateX: x, translateY: 30 }}
    >
      <Circle
        physics={collider2D({ restitution: 0.25, friction: 0.5 })}
        style={{
          radius: 13,
          fill: color,
          stroke: "#17211d",
          strokeWidth: 2,
          cursor: "pointer",
        }}
        onPointerDown={() => applyImpulse2D(body, [20, -180])}
      />
    </Group>
  );
}

// Each instance owns a local simulation. Parent transforms only change its view.
function SimulationPanel({ color }: { color: string }) {
  return (
    <PhysicsWorld2D space="local" gravity={[0, 500]}>
      <Rectangle
        pointerEvents="none"
        style={{
          width: 270,
          height: 210,
          fill: "#ffffff",
          stroke: "#17211d",
          strokeWidth: 3,
        }}
      />
      <Rectangle
        physics={staticBody2D()}
        style={{ left: 10, top: 185, width: 250, height: 15, fill: "#334155" }}
      />
      <Rectangle
        physics={staticBody2D()}
        pointerEvents="none"
        style={{ left: 0, top: 0, width: 10, height: 200, fill: "#334155" }}
      />
      <Rectangle
        physics={staticBody2D()}
        pointerEvents="none"
        style={{ left: 260, top: 0, width: 10, height: 200, fill: "#334155" }}
      />
      {[65, 120, 175].map((x) => (
        <Ball key={x} x={x} color={color} />
      ))}
    </PhysicsWorld2D>
  );
}

function PhysicsPanels() {
  const resized = useSignal(false);
  const moved = useSignal(false);
  return (
    <>
      <Rectangle style={{ width: 720, height: 420, fill: "#eff6ff" }} />
      <Text
        pointerEvents="none"
        style={{
          left: 360,
          top: 38,
          textAlign: "center",
          font: "900 24px Arial",
          fill: "#17211d",
        }}
      >
        TWO VIEWS. TWO WORLDS.
      </Text>
      <Text
        pointerEvents="none"
        style={{
          left: 360,
          top: 63,
          textAlign: "center",
          font: "14px Arial",
          fill: "#475569",
        }}
      >
        Click a ball. Move or resize its panel while it bounces.
      </Text>
      <Group style={{ translateX: moved.get() ? 90 : 45, translateY: 90 }}>
        <Group
          style={{
            scaleX: resized.get() ? 0.8 : 1,
            scaleY: resized.get() ? 0.8 : 1,
          }}
        >
          <SimulationPanel color="#2563eb" />
        </Group>
      </Group>
      <Group style={{ translateX: 385, translateY: moved.get() ? 112 : 90 }}>
        <SimulationPanel color="#ec4899" />
      </Group>
      <Rectangle
        style={{
          left: 115,
          top: 344,
          width: 220,
          height: 44,
          fill: "#17211d",
          cursor: "pointer",
        }}
        onClick={() => resized.update((value) => !value)}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 225,
          top: 371,
          textAlign: "center",
          font: "700 15px Arial",
          fill: "#ffffff",
        }}
      >
        Resize blue panel
      </Text>
      <Rectangle
        style={{
          left: 385,
          top: 344,
          width: 220,
          height: 44,
          fill: "#17211d",
          cursor: "pointer",
        }}
        onClick={() => moved.update((value) => !value)}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 495,
          top: 371,
          textAlign: "center",
          font: "700 15px Arial",
          fill: "#ffffff",
        }}
      >
        Move panels
      </Text>
    </>
  );
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <PhysicsPanels />);
}
