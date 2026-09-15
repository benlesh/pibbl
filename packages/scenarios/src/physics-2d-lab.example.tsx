import {
  Circle,
  Ellipse,
  Group,
  Polygon,
  Rectangle,
  Star,
  Text,
  crcPlayback,
  signal,
  track,
  tween,
  type CRCNode,
  type CRCPlayback,
  type WritableSignal,
} from "@crc/core";
import {
  Capsule2D,
  PhysicsWorld2D,
  collider2D,
  crcPhysicsBody2D,
  crcPhysicsWorld2D,
  dynamicBody2D,
  enableBody2D,
  kinematicBody2D,
  setLinearVelocity2D,
  staticBody2D,
  teleportBody2D,
  type CRCPhysicsBodyHandle2D,
  type CRCPhysicsCollisionEvent2D,
  type CRCPhysicsOverlapEvent2D,
  type CRCPhysicsVector2,
  type CRCPhysicsWorldHandle2D,
} from "@crc/physics/2d";

// prettier-ignore
export const PHYSICS_2D_LAB_SOURCE_ID = 'first-class-physics-2d-laboratory-example';

export const PHYSICS_2D_LAB_BODY_IDS = [
  "circle",
  "box",
  "ellipse",
  "capsule",
  "polygon",
  "star",
  "platform",
  "sensorMover",
  "handoff",
] as const;

export type Physics2DLabBodyId = (typeof PHYSICS_2D_LAB_BODY_IDS)[number];

export type Physics2DLabAction =
  | "settle"
  | "impulse"
  | "cross-sensor"
  | "move-platform"
  | "query"
  | "disable-handoff"
  | "transfer-animation"
  | "reenable-handoff"
  | "remove-owner";

export interface Physics2DLabBodySnapshot {
  readonly position: CRCPhysicsVector2;
  readonly rotationDegrees: number;
  readonly linearVelocity: CRCPhysicsVector2;
  readonly angularVelocityDegreesPerSecond: number;
  readonly sleeping: boolean;
  readonly enabled: boolean;
  readonly generation: number;
  readonly presentedPosition: CRCPhysicsVector2;
  readonly presentationOffset: number;
}

export interface Physics2DLabState {
  readonly bodies: Readonly<
    Record<Physics2DLabBodyId, Physics2DLabBodySnapshot>
  >;
  readonly worldRevision: number;
  readonly contacts: readonly string[];
  readonly overlaps: readonly string[];
  readonly queryTags: readonly string[];
  readonly owner: "mounted" | "removed";
  readonly transferStage:
    "physics" | "disabled" | "animating" | "reenable-pending" | "removed";
  readonly lastAction: "mount" | "reset" | Physics2DLabAction;
}

export interface Physics2DLabModel {
  readonly handles: Partial<Record<Physics2DLabBodyId, CRCPhysicsBodyHandle2D>>;
  readonly presentedPositions: Partial<
    Record<Physics2DLabBodyId, CRCPhysicsVector2>
  >;
  readonly contacts: string[];
  readonly overlaps: string[];
  readonly queryTags: string[];
  readonly contactHandlers: Map<
    string,
    Readonly<{
      onStart: (event: CRCPhysicsCollisionEvent2D) => void;
      onEnd: (event: CRCPhysicsCollisionEvent2D) => void;
    }>
  >;
  readonly overlapHandlers: Map<
    string,
    Readonly<{
      onStart: (event: CRCPhysicsOverlapEvent2D) => void;
      onEnd: (event: CRCPhysicsOverlapEvent2D) => void;
    }>
  >;
  readonly platformPosition: WritableSignal<CRCPhysicsVector2>;
  readonly handoffPosition: WritableSignal<CRCPhysicsVector2>;
  readonly handoffEnabled: WritableSignal<boolean>;
  readonly ownerVisible: WritableSignal<boolean>;
  world: CRCPhysicsWorldHandle2D | undefined;
  platformPlayback: CRCPlayback | undefined;
  handoffPlayback: CRCPlayback | undefined;
  handoffCompletionArmed: boolean;
  transferStage: Physics2DLabState["transferStage"];
  publish: (() => void) | undefined;
}

const INITIAL_PLATFORM_POSITION = Object.freeze([220, 142] as const);
const PLATFORM_DESTINATION = Object.freeze([310, 142] as const);
const INITIAL_HANDOFF_POSITION = Object.freeze([420, 202] as const);
const HANDOFF_DESTINATION = Object.freeze([462, 116] as const);

const interpolateVector = (
  from: CRCPhysicsVector2,
  to: CRCPhysicsVector2,
  progress: number,
): CRCPhysicsVector2 =>
  Object.freeze([
    from[0] + (to[0] - from[0]) * progress,
    from[1] + (to[1] - from[1]) * progress,
  ] as const);

export function createPhysics2DLabModel(): Physics2DLabModel {
  const model: Physics2DLabModel = {
    handles: {},
    presentedPositions: {},
    contacts: [],
    overlaps: [],
    queryTags: [],
    contactHandlers: new Map(),
    overlapHandlers: new Map(),
    platformPosition: signal<CRCPhysicsVector2>(INITIAL_PLATFORM_POSITION, {
      debugName: "physics laboratory platform position",
    }),
    handoffPosition: signal<CRCPhysicsVector2>(INITIAL_HANDOFF_POSITION, {
      debugName: "physics laboratory handoff position",
    }),
    handoffEnabled: signal(true, {
      debugName: "physics laboratory handoff enabled",
    }),
    ownerVisible: signal(true, {
      debugName: "physics laboratory handoff owner",
    }),
    world: undefined,
    platformPlayback: undefined,
    handoffPlayback: undefined,
    handoffCompletionArmed: false,
    transferStage: "physics",
    publish: undefined,
  };
  for (const id of [
    "ground",
    "circle",
    "box",
    "ellipse",
    "capsule",
    "polygon",
    "star",
  ]) {
    model.contactHandlers.set(
      id,
      Object.freeze({
        onStart: (event: CRCPhysicsCollisionEvent2D) =>
          recordContact(model, "start", event),
        onEnd: (event: CRCPhysicsCollisionEvent2D) =>
          recordContact(model, "end", event),
      }),
    );
  }
  for (const id of ["sensor", "sensor-mover"]) {
    model.overlapHandlers.set(
      id,
      Object.freeze({
        onStart: (event: CRCPhysicsOverlapEvent2D) => {
          recordOverlap(model, "start", event);
          if (id === "sensor") {
            teleportBody2D(event.otherBody, {
              position: [360, 104],
              rotationDegrees: 0,
            });
            setLinearVelocity2D(event.otherBody, [0, 0]);
          }
        },
        onEnd: (event: CRCPhysicsOverlapEvent2D) =>
          recordOverlap(model, "end", event),
      }),
    );
  }
  return model;
}

function recordContact(
  model: Physics2DLabModel,
  phase: "start" | "end",
  event: CRCPhysicsCollisionEvent2D,
): void {
  model.contacts.push(
    `${String(event.selfTag)}>${String(event.otherTag)}:${phase}`,
  );
  model.publish?.();
}

function recordOverlap(
  model: Physics2DLabModel,
  phase: "start" | "end",
  event: CRCPhysicsOverlapEvent2D,
): void {
  model.overlaps.push(
    `${String(event.selfTag)}>${String(event.otherTag)}:${phase}`,
  );
  model.publish?.();
}

function WorldCapture({ model }: { readonly model: Physics2DLabModel }) {
  model.world = crcPhysicsWorld2D();
  model.world.revision.get();
  return undefined;
}

function DynamicBody({
  id,
  model,
  position,
  children,
  gravityScale = 1,
}: Readonly<{
  id: Exclude<Physics2DLabBodyId, "platform" | "handoff">;
  model: Physics2DLabModel;
  position: CRCPhysicsVector2;
  children: CRCNode;
  gravityScale?: number;
}>) {
  const body = crcPhysicsBody2D();
  model.handles[id] = body;
  return (
    <Group
      physics={dynamicBody2D({
        handle: body,
        collider: false,
        mass: 1,
        gravityScale,
        linearDamping: 0.15,
      })}
      style={{ translateX: position[0], translateY: position[1] }}
    >
      {children}
    </Group>
  );
}

function SolidCollider({
  id,
  model,
  children,
}: Readonly<{
  id: string;
  model: Physics2DLabModel;
  children: (physics: ReturnType<typeof collider2D>) => CRCNode;
}>) {
  const handlers = model.contactHandlers.get(id);
  if (!handlers) throw new Error(`Missing contact handlers for "${id}".`);
  const physics = collider2D({
    tag: id,
    friction: 0.65,
    restitution: 0.1,
    onCollisionStart: handlers.onStart,
    onCollisionEnd: handlers.onEnd,
  });
  return children(physics);
}

function Platform({ model }: { readonly model: Physics2DLabModel }) {
  const body = crcPhysicsBody2D();
  model.handles.platform = body;
  const position = model.platformPosition.get();
  return (
    <Group
      physics={kinematicBody2D({
        handle: body,
        collider: false,
        target: { position: model.platformPosition },
      })}
      style={{ translateX: position[0], translateY: position[1] }}
    >
      <Rectangle
        physics={collider2D({ tag: "platform", friction: 0.8 })}
        style={{
          x: -42,
          y: -7,
          width: 84,
          height: 14,
          cornerRadius: 5,
          fill: "#22c55e",
          stroke: "#14532d",
          strokeWidth: 2,
        }}
      />
    </Group>
  );
}

function HandoffBall({ model }: { readonly model: Physics2DLabModel }) {
  const body = crcPhysicsBody2D();
  model.handles.handoff = body;
  const position = model.handoffPosition.get();
  const enabled = model.handoffEnabled.get();
  return (
    <Group
      physics={dynamicBody2D({
        handle: body,
        enabled,
        collider: false,
        mass: 1,
        reenableVelocity: "zero",
      })}
      style={{ translateX: position[0], translateY: position[1] }}
    >
      <Circle
        physics={collider2D({ tag: "handoff", restitution: 0.25 })}
        style={{
          radius: 10,
          fill: "#f97316",
          stroke: "#7c2d12",
          strokeWidth: 2,
        }}
      />
    </Group>
  );
}

function Sensor({ model }: { readonly model: Physics2DLabModel }) {
  const handlers = model.overlapHandlers.get("sensor");
  if (!handlers) throw new Error('Missing overlap handlers for "sensor".');
  return (
    <Group
      physics={staticBody2D({ collider: false })}
      style={{ translateX: 320, translateY: 104 }}
    >
      <Rectangle
        physics={collider2D({
          sensor: true,
          contributesToMass: false,
          tag: "sensor",
          onOverlapStart: handlers.onStart,
          onOverlapEnd: handlers.onEnd,
        })}
        style={{
          x: -10,
          y: -22,
          width: 20,
          height: 44,
          fill: "#38bdf833",
          stroke: "#0284c7",
          strokeWidth: 2,
        }}
      />
    </Group>
  );
}

function SensorMover({ model }: { readonly model: Physics2DLabModel }) {
  const handlers = model.overlapHandlers.get("sensor-mover");
  if (!handlers)
    throw new Error('Missing overlap handlers for "sensor-mover".');
  return (
    <DynamicBody
      id="sensorMover"
      model={model}
      position={[270, 104]}
      gravityScale={0}
    >
      <Circle
        physics={collider2D({
          tag: "sensor-mover",
          onOverlapStart: handlers.onStart,
          onOverlapEnd: handlers.onEnd,
        })}
        style={{
          radius: 6,
          fill: "#facc15",
          stroke: "#854d0e",
          strokeWidth: 2,
        }}
      />
    </DynamicBody>
  );
}

function AnimationOwners({ model }: { readonly model: Physics2DLabModel }) {
  model.platformPlayback = crcPlayback(
    track(
      model.platformPosition,
      tween({
        to: PLATFORM_DESTINATION,
        duration: 600,
        interpolate: interpolateVector,
        debugName: "physics laboratory kinematic platform",
      }),
    ),
    { debugName: "physics laboratory platform playback" },
  );
  model.handoffPlayback = crcPlayback(
    track(
      model.handoffPosition,
      tween({
        to: HANDOFF_DESTINATION,
        duration: 500,
        interpolate: interpolateVector,
        debugName: "physics laboratory authored transfer",
      }),
    ),
    {
      debugName: "physics laboratory transfer playback",
      onEvent: (event) => {
        if (event.type !== "finish" || !model.handoffCompletionArmed) return;
        const body = model.handles.handoff;
        if (!body) return;
        model.handoffCompletionArmed = false;
        model.transferStage = "reenable-pending";
        teleportBody2D(body, {
          position: model.handoffPosition.get(),
          rotationDegrees: body.rotationDegrees.get(),
        });
        enableBody2D(body, { velocity: "zero" });
        model.handoffEnabled.set(true);
        model.publish?.();
      },
    },
  );
  return undefined;
}

function PresentationProbe({ model }: { readonly model: Physics2DLabModel }) {
  for (const id of PHYSICS_2D_LAB_BODY_IDS) {
    const handle = model.handles[id];
    if (!handle) continue;
    const position =
      id === "handoff" && !model.handoffEnabled.get()
        ? model.handoffPosition.get()
        : handle.position.get();
    model.presentedPositions[id] = Object.freeze([...position] as [
      number,
      number,
    ]);
  }
  model.publish?.();
  return undefined;
}

export function Physics2DLabRoot({
  model,
}: {
  readonly model: Physics2DLabModel;
}) {
  const showHandoff = model.ownerVisible.get();
  const groundHandlers = model.contactHandlers.get("ground");
  if (!groundHandlers)
    throw new Error('Missing contact handlers for "ground".');
  return (
    <>
      <Rectangle
        pointerEvents="none"
        style={{ width: 480, height: 240, fill: "#eff6ff" }}
      />
      <PhysicsWorld2D
        gravity={[0, 600]}
        fixedStepMilliseconds={50}
        maxCatchUpSteps={3}
        sleeping
      >
        <WorldCapture model={model} />
        <AnimationOwners model={model} />
        <Rectangle
          physics={staticBody2D({
            collider: {
              tag: "ground",
              friction: 0.8,
              onCollisionStart: groundHandlers.onStart,
              onCollisionEnd: groundHandlers.onEnd,
            },
          })}
          style={{ x: 12, y: 216, width: 456, height: 20, fill: "#334155" }}
        />
        <Rectangle
          physics={staticBody2D({ collider: { tag: "left-wall" } })}
          style={{ x: 0, y: 0, width: 12, height: 236, fill: "#64748b" }}
        />
        <Rectangle
          physics={staticBody2D({ collider: { tag: "right-wall" } })}
          style={{ x: 468, y: 0, width: 12, height: 236, fill: "#64748b" }}
        />
        <DynamicBody id="circle" model={model} position={[64, 202]}>
          <SolidCollider id="circle" model={model}>
            {(physics) => (
              <Circle
                physics={physics}
                style={{
                  radius: 12,
                  fill: "#2563eb",
                  stroke: "#1e3a8a",
                  strokeWidth: 2,
                }}
              />
            )}
          </SolidCollider>
        </DynamicBody>
        <DynamicBody id="box" model={model} position={[120, 202]}>
          <SolidCollider id="box" model={model}>
            {(physics) => (
              <Rectangle
                physics={physics}
                style={{
                  x: -12,
                  y: -12,
                  width: 24,
                  height: 24,
                  fill: "#8b5cf6",
                }}
              />
            )}
          </SolidCollider>
        </DynamicBody>
        <DynamicBody id="ellipse" model={model} position={[176, 204]}>
          <SolidCollider id="ellipse" model={model}>
            {(physics) => (
              <Ellipse
                physics={physics}
                style={{ radiusX: 15, radiusY: 9, fill: "#ec4899" }}
              />
            )}
          </SolidCollider>
        </DynamicBody>
        <DynamicBody id="capsule" model={model} position={[236, 202]}>
          <SolidCollider id="capsule" model={model}>
            {(physics) => (
              <Capsule2D
                physics={physics}
                style={{
                  start: [-12, 0],
                  end: [12, 0],
                  radius: 8,
                  fill: "#14b8a6",
                }}
              />
            )}
          </SolidCollider>
        </DynamicBody>
        <DynamicBody id="polygon" model={model} position={[300, 202]}>
          <SolidCollider id="polygon" model={model}>
            {(physics) => (
              <Polygon
                physics={physics}
                style={{
                  coords: [
                    [-13, 9],
                    [-10, -9],
                    [10, -9],
                    [14, 8],
                  ],
                  fill: "#f59e0b",
                }}
              />
            )}
          </SolidCollider>
        </DynamicBody>
        <DynamicBody id="star" model={model} position={[362, 202]}>
          <SolidCollider id="star" model={model}>
            {(physics) => (
              <Star
                physics={physics}
                style={{
                  points: 5,
                  outerRadius: 13,
                  innerRadius: 6,
                  fill: "#ef4444",
                }}
              />
            )}
          </SolidCollider>
        </DynamicBody>
        <Platform model={model} />
        <Sensor model={model} />
        <SensorMover model={model} />
        {showHandoff ? <HandoffBall model={model} /> : undefined}
        <PresentationProbe model={model} />
      </PhysicsWorld2D>
      <Text
        pointerEvents="none"
        style={{ x: 18, y: 24, fill: "#0f172a", font: "700 14px Arial" }}
      >
        2D PHYSICS · SHARED CRC SCHEDULER
      </Text>
      <Text
        pointerEvents="none"
        style={{ x: 18, y: 44, fill: "#475569", font: "11px Arial" }}
      >
        solids · sensor · kinematic target · explicit animation handoff
      </Text>
    </>
  );
}
