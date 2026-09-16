/** @jsxImportSource @crc/core */
import {
  Rectangle,
  signal,
  type WritableSignal,
} from "@crc/core";
import {
  AmbientLight,
  Cube,
  DirectionalLight,
  Group3D,
  Sphere,
  WebGLLayer,
  type CRCWebGLPerspectiveCamera,
} from "@crc/webgl";
import {
  PhysicsWorld3D,
  collider3D,
  crcPhysicsBody3D,
  crcPhysicsWorld3D,
  dynamicBody3D,
  queryPoint3D,
  staticBody3D,
  type CRCPhysicsBodyHandle3D,
  type CRCPhysicsColliderConfiguration3D,
  type CRCPhysicsCollisionEvent3D,
  type CRCPhysicsQuaternion,
  type CRCPhysicsVector3,
  type CRCPhysicsWorldHandle3D,
} from "@crc/physics/3d";

// prettier-ignore
export const PHYSICS_3D_SOURCE_ID = 'first-class-physics-3d-example';

export const PHYSICS_3D_BODY_IDS = [
  "drop-cube",
  "slider-cube",
  "bounce-sphere",
  "cube-c",
  "sphere-b",
  "sphere-c",
  "compound",
] as const;

export type Physics3DBodyId = (typeof PHYSICS_3D_BODY_IDS)[number];
export type Physics3DAction = "reset" | "drop" | "impulse" | "query";

export interface Physics3DBodySnapshot {
  readonly position: CRCPhysicsVector3;
  readonly orientation: CRCPhysicsQuaternion;
  readonly linearVelocity: CRCPhysicsVector3;
  readonly angularVelocityDegreesPerSecond: CRCPhysicsVector3;
  readonly sleeping: boolean;
  readonly enabled: boolean;
  readonly generation: number;
}

export interface Physics3DState {
  readonly bodies: Readonly<Record<Physics3DBodyId, Physics3DBodySnapshot>>;
  readonly worldRevision: number;
  readonly contacts: readonly string[];
  readonly compoundAligned: boolean;
  readonly queryTag: string | null;
  readonly queryPoint: CRCPhysicsVector3 | null;
  readonly lastAction: "mount" | Physics3DAction;
}

export interface Physics3DModel {
  readonly handles: Partial<Record<Physics3DBodyId, CRCPhysicsBodyHandle3D>>;
  readonly contacts: string[];
  readonly colliderConfigurations: Readonly<
    Record<string, CRCPhysicsColliderConfiguration3D>
  >;
  readonly queryMarker: WritableSignal<CRCPhysicsVector3 | null>;
  world: CRCPhysicsWorldHandle3D | undefined;
  queryTag: string | null;
  publish: (() => void) | undefined;
  notifyRendered: (() => void) | undefined;
}

export const PHYSICS_3D_CAMERA: CRCWebGLPerspectiveCamera = Object.freeze({
  type: "perspective",
  position: Object.freeze([11, 8, 15] as const),
  lookAt: Object.freeze([0, 1.5, 0] as const),
  up: Object.freeze([0, 1, 0] as const),
  fieldOfViewDegrees: 44,
  near: 0.1,
  far: 60,
});

export const PHYSICS_3D_INITIAL_POSITIONS: Readonly<
  Record<Physics3DBodyId, CRCPhysicsVector3>
> = Object.freeze({
  "drop-cube": Object.freeze([-4.2, 6, 0] as const),
  "slider-cube": Object.freeze([-1.8, -1.72, 1.6] as const),
  "bounce-sphere": Object.freeze([1.8, 5.3, 0] as const),
  "cube-c": Object.freeze([-1.1, 8.1, -1.2] as const),
  "sphere-b": Object.freeze([4.1, 7.2, 1.4] as const),
  "sphere-c": Object.freeze([0.1, 10, 1.2] as const),
  compound: Object.freeze([4.3, 9.2, -1.7] as const),
});

const IDENTITY_ORIENTATION = Object.freeze([0, 0, 0, 1] as const);

export function createPhysics3DModel(): Physics3DModel {
  let model!: Physics3DModel;
  const configuration = (
    tag: string,
    friction: number,
    restitution: number,
  ): CRCPhysicsColliderConfiguration3D => Object.freeze({
    tag,
    friction,
    restitution,
    onCollisionStart: (event: CRCPhysicsCollisionEvent3D) => {
      model.contacts.push(
        `${String(event.selfTag)}>${String(event.otherTag)}:start`,
      );
      model.publish?.();
    },
  });
  const colliderConfigurations = Object.freeze({
      floor: configuration("floor", 0.95, 0.05),
      obstacle: configuration("obstacle", 0.7, 0.15),
      "drop-cube": configuration("drop-cube", 0.35, 0.2),
      "slider-cube": configuration("slider-cube", 1.1, 0),
      "bounce-sphere": configuration("bounce-sphere", 0.15, 0.86),
      "cube-c": configuration("cube-c", 0.65, 0.1),
      "sphere-b": configuration("sphere-b", 0.4, 0.45),
      "sphere-c": configuration("sphere-c", 0.8, 0.25),
      "compound-left": configuration("compound-left", 0.5, 0.2),
      "compound-right": configuration("compound-right", 0.2, 0.55),
    });
  model = {
    handles: {},
    contacts: [],
    colliderConfigurations,
    queryMarker: signal<CRCPhysicsVector3 | null>(null, {
      debugName: "physics 3D ray marker",
    }),
    world: undefined,
    queryTag: null,
    publish: undefined,
    notifyRendered: undefined,
  };
  return model;
}

function WorldCapture({ model }: { readonly model: Physics3DModel }) {
  model.world = crcPhysicsWorld3D();
  model.notifyRendered?.();
  return undefined;
}

function DynamicCubeBody({
  id,
  model,
  color,
  size = 0.85,
  initialVelocity = [0, 0, 0],
}: Readonly<{
  id: Extract<Physics3DBodyId, "drop-cube" | "slider-cube" | "cube-c">;
  model: Physics3DModel;
  color: string;
  size?: number;
  initialVelocity?: CRCPhysicsVector3;
}>) {
  const body = crcPhysicsBody3D();
  model.handles[id] = body;
  const position = PHYSICS_3D_INITIAL_POSITIONS[id];
  return (
    <Cube
      physics={dynamicBody3D({
        handle: body,
        mass: "auto",
        linearVelocity: initialVelocity,
        linearDamping: 0.04,
        angularDamping: 0.05,
        collider: model.colliderConfigurations[id],
      })}
      style={{
        size,
        color,
        translateX: position[0],
        translateY: position[1],
        translateZ: position[2],
      }}
    />
  );
}

function DynamicSphereBody({
  id,
  model,
  color,
  radius,
}: Readonly<{
  id: Extract<Physics3DBodyId, "bounce-sphere" | "sphere-b" | "sphere-c">;
  model: Physics3DModel;
  color: string;
  radius: number;
}>) {
  const body = crcPhysicsBody3D();
  model.handles[id] = body;
  const position = PHYSICS_3D_INITIAL_POSITIONS[id];
  return (
    <Sphere
      physics={dynamicBody3D({
        handle: body,
        mass: "auto",
        linearDamping: 0.025,
        angularDamping: 0.04,
        collider: model.colliderConfigurations[id],
      })}
      style={{
        radius,
        color,
        translateX: position[0],
        translateY: position[1],
        translateZ: position[2],
      }}
    />
  );
}

function CompoundBody({ model }: { readonly model: Physics3DModel }) {
  const body = crcPhysicsBody3D();
  model.handles.compound = body;
  const position = PHYSICS_3D_INITIAL_POSITIONS.compound;
  return (
    <Group3D
      physics={dynamicBody3D({
        handle: body,
        collider: false,
        mass: "auto",
        linearDamping: 0.04,
        angularDamping: 0.06,
      })}
      style={{
        translateX: position[0],
        translateY: position[1],
        translateZ: position[2],
      }}
    >
      <Cube
        physics={collider3D(model.colliderConfigurations["compound-left"])}
        style={{
          size: 0.72,
          color: "#f97316",
          translateX: -0.65,
        }}
      />
      <Sphere
        physics={collider3D(model.colliderConfigurations["compound-right"])}
        style={{
          radius: 0.42,
          color: "#fb923c",
          translateX: 0.65,
        }}
      />
    </Group3D>
  );
}

function RayMarker({ model }: { readonly model: Physics3DModel }) {
  const point = model.queryMarker.get();
  return point === null ? undefined : (
    <Sphere
      pointerEvents="none"
      style={{
        radius: 0.16,
        color: "#f43f5e",
        translateX: point[0],
        translateY: point[1],
        translateZ: point[2],
      }}
    />
  );
}

export function Physics3DRoot({ model }: { readonly model: Physics3DModel }) {
  return (
    <>
      <Rectangle style={{ width: 480, height: 300, fill: "#0f172a" }} />
      <WebGLLayer
        camera={PHYSICS_3D_CAMERA}
        style={{ width: 480, height: 300 }}
      >
        <AmbientLight style={{ color: "#ffffff", intensity: 0.18 }} />
        <DirectionalLight
          style={{
            color: "#fff4de",
            intensity: 0.9,
            rotationXDegrees: -42,
            rotationYDegrees: 35,
            castShadow: false,
          }}
        />
        <PhysicsWorld3D
          gravity={[0, -12, 0]}
          fixedStepMilliseconds={1000 / 60}
          maxCatchUpSteps={8}
          interpolation="linear"
        >
          <WorldCapture model={model} />
          <Cube
            physics={staticBody3D({
              collider: model.colliderConfigurations.floor,
            })}
            style={{
              color: "#334155",
              translateY: -2.5,
              scaleX: 14,
              scaleY: 0.5,
              scaleZ: 10,
            }}
          />
          <Cube
            physics={staticBody3D({
              collider: model.colliderConfigurations.obstacle,
            })}
            style={{
              color: "#64748b",
              translateX: 2.1,
              translateY: -0.35,
              translateZ: -0.4,
              rotationZDegrees: 18,
              scaleX: 3.8,
              scaleY: 0.38,
              scaleZ: 2.2,
            }}
          />
          <DynamicCubeBody
            id="drop-cube"
            model={model}
            color="#38bdf8"
          />
          <DynamicCubeBody
            id="slider-cube"
            model={model}
            color="#a78bfa"
            size={0.78}
            initialVelocity={[3, 0, 0]}
          />
          <DynamicSphereBody
            id="bounce-sphere"
            model={model}
            color="#22c55e"
            radius={0.55}
          />
          <DynamicCubeBody
            id="cube-c"
            model={model}
            color="#eab308"
            size={0.72}
          />
          <DynamicSphereBody
            id="sphere-b"
            model={model}
            color="#ec4899"
            radius={0.5}
          />
          <DynamicSphereBody
            id="sphere-c"
            model={model}
            color="#14b8a6"
            radius={0.44}
          />
          <CompoundBody model={model} />
          <RayMarker model={model} />
        </PhysicsWorld3D>
      </WebGLLayer>
    </>
  );
}

export function physics3DBodySnapshot(
  model: Physics3DModel,
  id: Physics3DBodyId,
): Physics3DBodySnapshot {
  const body = model.handles[id];
  const position = PHYSICS_3D_INITIAL_POSITIONS[id];
  if (body === undefined) {
    return {
      position,
      orientation: IDENTITY_ORIENTATION,
      linearVelocity: [0, 0, 0],
      angularVelocityDegreesPerSecond: [0, 0, 0],
      sleeping: false,
      enabled: false,
      generation: 0,
    };
  }
  return {
    position: cleanVector(body.position.get()),
    orientation: cleanQuaternion(body.orientation.get()),
    linearVelocity: cleanVector(body.linearVelocity.get()),
    angularVelocityDegreesPerSecond: cleanVector(
      body.angularVelocityDegreesPerSecond.get(),
    ),
    sleeping: body.sleeping.get(),
    enabled: body.enabled.get(),
    generation: body.generation.get(),
  };
}

export function physics3DCompoundAligned(model: Physics3DModel): boolean {
  const body = model.handles.compound;
  const world = model.world;
  if (body === undefined || world === undefined || body.generation.get() === 0) {
    return false;
  }
  const position = body.position.get();
  const orientation = body.orientation.get();
  const left = add(position, rotate([-0.65, 0, 0], orientation));
  const right = add(position, rotate([0.65, 0, 0], orientation));
  const leftTags = queryPoint3D(world, left, { mode: "all" })
    .map((match) => String(match.tag));
  const rightTags = queryPoint3D(world, right, { mode: "all" })
    .map((match) => String(match.tag));
  return leftTags.includes("compound-left") &&
    rightTags.includes("compound-right");
}

function rotate(
  vector: CRCPhysicsVector3,
  quaternion: CRCPhysicsQuaternion,
): CRCPhysicsVector3 {
  const [x, y, z, w] = quaternion;
  const [vx, vy, vz] = vector;
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return [
    vx + w * tx + (y * tz - z * ty),
    vy + w * ty + (z * tx - x * tz),
    vz + w * tz + (x * ty - y * tx),
  ];
}

function add(
  left: CRCPhysicsVector3,
  right: CRCPhysicsVector3,
): CRCPhysicsVector3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function cleanVector(value: CRCPhysicsVector3): CRCPhysicsVector3 {
  return Object.freeze([clean(value[0]), clean(value[1]), clean(value[2])]);
}

function cleanQuaternion(value: CRCPhysicsQuaternion): CRCPhysicsQuaternion {
  return Object.freeze([
    clean(value[0]),
    clean(value[1]),
    clean(value[2]),
    clean(value[3]),
  ]);
}

function clean(value: number): number {
  const rounded = Number(value.toFixed(6));
  return Object.is(rounded, -0) ? 0 : rounded;
}
