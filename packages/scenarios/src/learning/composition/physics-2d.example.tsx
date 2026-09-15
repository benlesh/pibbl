import {
  Circle,
  Group,
  Rectangle,
  Text,
  crc,
  crcRef,
  crcState,
  type CRCController,
  type CRCPointerEvent,
} from "@crc/core";
import {
  PhysicsWorld2D,
  collider2D,
  crcPhysicsBody2D,
  dynamicBody2D,
  staticBody2D,
} from "@crc/physics/2d";

const BALL_RADIUS = 28;

interface BallDragSession {
  readonly pointerId: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

function clampBallPosition(
  x: number,
  y: number,
): Readonly<{ x: number; y: number }> {
  return {
    x: Math.max(82, Math.min(638, x)),
    y: Math.max(108, Math.min(280, y)),
  };
}

function DraggableBall() {
  const body = crcPhysicsBody2D();
  const dragSession = crcRef<BallDragSession | null>(null);
  const [dragging, setDragging] = crcState(false);
  const [authoredPosition, setAuthoredPosition] = crcState({ x: 210, y: 110 });

  const dragTo = (event: CRCPointerEvent): void => {
    const session = dragSession.current;
    if (session?.pointerId !== event.pointerId) return;
    setAuthoredPosition(
      clampBallPosition(
        event.x + session.offsetX,
        event.y + session.offsetY,
      ),
    );
  };

  const finishDrag = (event: CRCPointerEvent): void => {
    const session = dragSession.current;
    if (session?.pointerId !== event.pointerId) return;
    dragTo(event);
    dragSession.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <Circle
      physics={dynamicBody2D({
        enabled: !dragging,
        handle: body,
        fixedRotation: true,
        mass: 1,
        reenableVelocity: "zero",
        collider: { tag: "ball", restitution: 0.35 },
      })}
      style={{
        cx: authoredPosition.x,
        cy: authoredPosition.y,
        radius: BALL_RADIUS,
        fill: "#2563eb",
        stroke: "#17211d",
        strokeWidth: 5,
        cursor: dragging ? "grabbing" : "grab",
      }}
      onPointerDown={(event) => {
        if (dragSession.current !== null) return;
        const [bodyX, bodyY] = body.position.get();
        const x = bodyX + authoredPosition.x;
        const y = bodyY + authoredPosition.y;
        dragSession.current = {
          pointerId: event.pointerId,
          offsetX: x - event.x,
          offsetY: y - event.y,
        };
        setAuthoredPosition({ x, y });
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
      }}
      onPointerMove={dragTo}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onLostPointerCapture={(event) => {
        if (dragSession.current?.pointerId !== event.pointerId) return;
        dragSession.current = null;
        setDragging(false);
      }}
    />
  );
}

interface StaticBumperProps {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly fill: string;
  readonly tag: string;
}

function StaticBumper(props: StaticBumperProps) {
  return (
    <Circle
      physics={staticBody2D({
        collider: {
          tag: props.tag,
          friction: 0.15,
          restitution: 0.8,
        },
      })}
      pointerEvents="none"
      style={{
        cx: props.x,
        cy: props.y,
        radius: props.radius,
        fill: props.fill,
        stroke: "#17211d",
        strokeWidth: 4,
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
          style={{ x: 54, y: 316, width: 612, height: 34, fill: "#334155" }}
        />
        <Rectangle
          physics={staticBody2D({ collider: { tag: "left-wall", friction: 0.4 } })}
          pointerEvents="none"
          style={{ x: 54, y: 96, width: 20, height: 220, fill: "#475569" }}
        />
        <Rectangle
          physics={staticBody2D({ collider: { tag: "right-wall", friction: 0.4 } })}
          pointerEvents="none"
          style={{ x: 646, y: 96, width: 20, height: 220, fill: "#475569" }}
        />
        <StaticBumper x={250} y={205} radius={20} fill="#f59e0b" tag="bumper-left" />
        <StaticBumper x={362} y={258} radius={22} fill="#ec4899" tag="bumper-center" />
        <StaticBumper x={478} y={198} radius={20} fill="#22c55e" tag="bumper-right" />
        <GroundSensor />
        <DraggableBall />
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
        Drag the ball above the bumpers, then let gravity take over
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
        DRAGGED POSE IS APP-OWNED · RELEASED POSE IS PHYSICS-OWNED
      </Text>
    </>
  );
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <PhysicsLesson />, { pixelRatio: 1 });
}
