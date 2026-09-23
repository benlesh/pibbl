import {
  Circle,
  Group,
  Rectangle,
  Text,
  crc,
  useRef,
  useState,
  type CRCController,
  type CRCPointerEvent,
} from "@crc/core";
import {
  PhysicsWorld2D,
  collider2D,
  crcPhysicsBody2D,
  disableBody2D,
  dynamicBody2D,
  enableBody2D,
  setLinearVelocity2D,
  staticBody2D,
  teleportBody2D,
} from "@crc/physics/2d";

const BALL_RADIUS = 28;
const MAX_THROW_SPEED = 1000;
const TRAIL_WINDOW_MILLISECONDS = 120;
const MAX_TRAIL_SAMPLES = 8;

interface PointerTrailSample {
  readonly x: number;
  readonly y: number;
  readonly timeStamp: number;
}

interface BallDragSession {
  readonly pointerId: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly rotationDegrees: number;
  position: readonly [number, number];
  readonly trail: PointerTrailSample[];
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

function addTrailSample(
  trail: PointerTrailSample[],
  sample: PointerTrailSample,
): void {
  trail.push(sample);
  const earliest = sample.timeStamp - TRAIL_WINDOW_MILLISECONDS;
  while (trail.length > 1 && trail[0]!.timeStamp < earliest) trail.shift();
  while (trail.length > MAX_TRAIL_SAMPLES) trail.splice(1, 1);
}

function releaseVelocity(
  trail: readonly PointerTrailSample[],
): readonly [number, number] {
  const final = trail.at(-1);
  if (!final) return [0, 0];
  const oldest = trail.find(
    (sample) =>
      sample.timeStamp < final.timeStamp &&
      final.timeStamp - sample.timeStamp <= TRAIL_WINDOW_MILLISECONDS,
  );
  if (!oldest) return [0, 0];

  const seconds = (final.timeStamp - oldest.timeStamp) / 1000;
  if (seconds <= 0) return [0, 0];
  const velocityX = (final.x - oldest.x) / seconds;
  const velocityY = (final.y - oldest.y) / seconds;
  const magnitude = Math.hypot(velocityX, velocityY);
  if (magnitude <= MAX_THROW_SPEED) return [velocityX, velocityY];
  const scale = MAX_THROW_SPEED / magnitude;
  return [velocityX * scale, velocityY * scale];
}

function DraggableBall() {
  const body = crcPhysicsBody2D();
  const dragSession = useRef<BallDragSession | null>(null);
  const [dragging, setDragging] = useState(false);
  const [, requestDragPresentation] = useState(0);

  const dragTo = (event: CRCPointerEvent): readonly [number, number] | null => {
    const session = dragSession.current;
    if (session?.pointerId !== event.pointerId) return null;
    const position = clampBallPosition(
      event.x + session.offsetX,
      event.y + session.offsetY,
    );
    const pose = [position.x, position.y] as const;
    teleportBody2D(body, {
      position: pose,
      rotationDegrees: session.rotationDegrees,
    });
    session.position = pose;
    addTrailSample(session.trail, {
      x: event.x,
      y: event.y,
      timeStamp: event.timeStamp,
    });
    requestDragPresentation((revision) => revision + 1);
    return pose;
  };

  const finishDrag = (event: CRCPointerEvent): void => {
    const session = dragSession.current;
    if (session?.pointerId !== event.pointerId) return;
    const position = clampBallPosition(
      event.x + session.offsetX,
      event.y + session.offsetY,
    );
    const pose = [position.x, position.y] as const;
    session.position = pose;
    addTrailSample(session.trail, {
      x: event.x,
      y: event.y,
      timeStamp: event.timeStamp,
    });
    const velocity = releaseVelocity(session.trail);
    teleportBody2D(body, {
      position: pose,
      rotationDegrees: session.rotationDegrees,
    });
    enableBody2D(body, { velocity: "zero" });
    setLinearVelocity2D(body, velocity);
    dragSession.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const cancelDrag = (event: CRCPointerEvent): void => {
    const session = dragSession.current;
    if (session?.pointerId !== event.pointerId) return;
    teleportBody2D(body, {
      position: session.position,
      rotationDegrees: session.rotationDegrees,
    });
    enableBody2D(body, { velocity: "zero" });
    dragSession.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const draggedPosition = dragSession.current?.position;
  const dragTranslateX =
    dragging && draggedPosition !== undefined ? draggedPosition[0] - 210 : 0;
  const dragTranslateY =
    dragging && draggedPosition !== undefined ? draggedPosition[1] - 110 : 0;

  return (
    <Group
      physics={dynamicBody2D({
        collider: false,
        handle: body,
        mass: 1,
        linearDamping: 0.025,
        angularDamping: 0.04,
      })}
      style={{ translateX: 210, translateY: 110 }}
    >
      <Group style={{ translateX: dragTranslateX, translateY: dragTranslateY }}>
        <Circle
          physics={collider2D({
            tag: "ball",
            restitution: 0.35,
            friction: 0.65,
          })}
          style={{
            cx: 0,
            cy: 0,
            radius: BALL_RADIUS,
            fill: "#2563eb",
            stroke: "#17211d",
            strokeWidth: 5,
            cursor: dragging ? "grabbing" : "grab",
          }}
          onPointerDown={(event) => {
            if (dragSession.current !== null) return;
            const [x, y] = body.position.get();
            const position = [x, y] as const;
            dragSession.current = {
              pointerId: event.pointerId,
              offsetX: x - event.x,
              offsetY: y - event.y,
              rotationDegrees: body.rotationDegrees.get(),
              position,
              trail: [],
            };
            addTrailSample(dragSession.current.trail, {
              x: event.x,
              y: event.y,
              timeStamp: event.timeStamp,
            });
            disableBody2D(body);
            setDragging(true);
            event.currentTarget.setPointerCapture(event.pointerId);
            event.preventDefault();
          }}
          onPointerMove={dragTo}
          onPointerUp={finishDrag}
          onPointerCancel={cancelDrag}
          onLostPointerCapture={cancelDrag}
        />
      </Group>
    </Group>
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
          physics={staticBody2D({
            collider: { tag: "ground", friction: 0.55 },
          })}
          style={{ x: 54, y: 316, width: 612, height: 34, fill: "#334155" }}
        />
        <Rectangle
          physics={staticBody2D({
            collider: { tag: "left-wall", friction: 0.4 },
          })}
          pointerEvents="none"
          style={{ x: 54, y: 96, width: 20, height: 220, fill: "#475569" }}
        />
        <Rectangle
          physics={staticBody2D({
            collider: { tag: "right-wall", friction: 0.4 },
          })}
          pointerEvents="none"
          style={{ x: 646, y: 96, width: 20, height: 220, fill: "#475569" }}
        />
        <StaticBumper
          x={250}
          y={205}
          radius={20}
          fill="#f59e0b"
          tag="bumper-left"
        />
        <StaticBumper
          x={362}
          y={258}
          radius={22}
          fill="#ec4899"
          tag="bumper-center"
        />
        <StaticBumper
          x={478}
          y={198}
          radius={20}
          fill="#22c55e"
          tag="bumper-right"
        />
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
        Drag and throw the ball above the bumpers
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
        POINTER RELEASE HANDS VELOCITY TO PHYSICS
      </Text>
    </>
  );
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <PhysicsLesson />, { pixelRatio: 1 });
}
