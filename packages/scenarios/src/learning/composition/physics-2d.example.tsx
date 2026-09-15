import {
  Circle,
  Group,
  Rectangle,
  Text,
  crc,
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

function ImpulseBall() {
  const body = crcPhysicsBody2D();
  return (
    <Circle
      physics={dynamicBody2D({
        handle: body,
        mass: 1,
        collider: { tag: "ball", restitution: 0.35 },
      })}
      style={{
        cx: 210,
        cy: 110,
        radius: 28,
        fill: "#2563eb",
        stroke: "#17211d",
        strokeWidth: 5,
        cursor: "pointer",
      }}
      onClick={() => {
        applyImpulse2D(body, [45, -120]);
      }}
    />
  );
}

function GroundSensor() {
  return (
    <Group physics={staticBody2D({ collider: false })}>
      <Rectangle
        physics={collider2D({ sensor: true, tag: "ground-check" })}
        pointerEvents="none"
        style={{
          x: 164,
          y: 304,
          width: 92,
          height: 12,
          fill: "#38bdf833",
          stroke: "#0284c7",
          strokeWidth: 2,
        }}
      />
    </Group>
  );
}

function PhysicsLesson() {
  return (
    <>
      <Rectangle style={{ width: 720, height: 420, fill: "#eff6ff" }} />
      <PhysicsWorld2D gravity={[0, 560]} fixedStepMilliseconds={1000 / 60}>
        <Rectangle
          physics={staticBody2D({ collider: { tag: "ground", friction: 0.8 } })}
          style={{ x: 72, y: 316, width: 576, height: 34, fill: "#334155" }}
        />
        <GroundSensor />
        <ImpulseBall />
      </PhysicsWorld2D>
      <Text
        pointerEvents="none"
        style={{
          x: 360,
          y: 54,
          fill: "#17211d",
          font: "900 24px Arial",
          textAlign: "center",
        }}
      >
        FIRST-CLASS 2D PHYSICS
      </Text>
      <Text
        pointerEvents="none"
        style={{
          x: 360,
          y: 82,
          fill: "#475569",
          font: "600 13px Arial",
          textAlign: "center",
        }}
      >
        Click the ball to apply an impulse through its body handle
      </Text>
      <Text
        pointerEvents="none"
        style={{
          x: 360,
          y: 390,
          fill: "#0f172a",
          font: "600 12px monospace",
          textAlign: "center",
        }}
      >
        ENABLED DYNAMIC ROOT POSE IS PHYSICS-OWNED
      </Text>
    </>
  );
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <PhysicsLesson />, { pixelRatio: 1 });
}
