import { crc, createElement, type CRCController } from "@crc/core";
import {
  applyImpulse3D,
  disableBody3D,
  enableBody3D,
  raycast3D,
  setAngularVelocity3D,
  setLinearVelocity3D,
  teleportBody3D,
  sleepBody3D,
  wakeBody3D,
  type CRCPhysicsBodyHandle3D,
} from "@crc/physics/3d";
import {
  PHYSICS_3D_BODY_IDS,
  PHYSICS_3D_INITIAL_POSITIONS,
  PHYSICS_3D_SOURCE_ID,
  Physics3DRoot,
  createPhysics3DModel,
  physics3DBodySnapshot,
  physics3DCompoundAligned,
  type Physics3DAction,
  type Physics3DBodyId,
  type Physics3DModel,
  type Physics3DState,
} from "./physics-3d.example";
import type {
  ScenarioController,
  ScenarioDefinition,
  ScenarioMountContext,
} from "./types";

export const PHYSICS_3D_ACTION_IDS = [
  "reset",
  "settle",
  "drop",
  "query",
  "grab",
  "drag",
  "throw",
  "impulse",
  "teleport",
  "disable",
  "authored-move",
  "re-enable",
  "sleep",
  "wake",
  "remove",
  "remount",
] as const satisfies readonly Physics3DAction[];

const TELEPORT_POSITION = Object.freeze([0.2, 7.2, 1.8] as const);
const AUTHORED_POSITION = Object.freeze([-1.6, 4.8, 1.2] as const);
const DRAG_POSITION = Object.freeze([-2.4, 5.3, 0.8] as const);

function requireBody(
  model: Physics3DModel,
  id: Physics3DBodyId,
): CRCPhysicsBodyHandle3D {
  const body = model.handles[id];
  if (body === undefined) {
    throw new Error(`Physics 3D body "${id}" has not rendered yet.`);
  }
  return body;
}

function snapshot(
  model: Physics3DModel,
  lastAction: Physics3DState["lastAction"],
): Physics3DState {
  return {
    bodies: Object.fromEntries(
      PHYSICS_3D_BODY_IDS.map((id) => [id, physics3DBodySnapshot(model, id)]),
    ) as unknown as Readonly<
      Record<Physics3DBodyId, ReturnType<typeof physics3DBodySnapshot>>
    >,
    worldRevision: model.world?.revision.get() ?? 0,
    contacts: [...model.contacts],
    compoundAligned: physics3DCompoundAligned(model),
    queryTag: model.queryTag,
    queryPoint: model.queryMarker.get(),
    grabbed: model.grabbed,
    dropMounted: model.dropMounted.get(),
    sensorOverlaps: [...model.sensorOverlaps].sort(),
    eventLog: [...model.eventLog],
    lastAction,
  };
}

async function mountPhysics3D(
  context: ScenarioMountContext<Physics3DState>,
): Promise<ScenarioController<Physics3DState>> {
  let disposed = false;
  let model = createPhysics3DModel();
  let lastAction: Physics3DState["lastAction"] = "mount";
  let rendered = Promise.resolve();
  const armRenderBarrier = (): void => {
    rendered = new Promise<void>((resolve) => {
      let pending = true;
      model.notifyRendered = () => {
        if (!pending) return;
        pending = false;
        model.notifyRendered = undefined;
        resolve();
      };
    });
  };
  armRenderBarrier();
  let runtime: CRCController = crc(
    context.canvas,
    createElement(Physics3DRoot, { model }),
    { pixelRatio: 1 },
  );
  let actionQueue = Promise.resolve();

  const assertActive = (): void => {
    if (disposed)
      throw new Error("Cannot operate on a disposed physics 3D scene.");
  };
  const publish = (): void => {
    context.onStateChange?.(snapshot(model, lastAction));
  };
  const resetRoot = (): void => {
    runtime.dispose();
    model = createPhysics3DModel();
    model.publish = publish;
    armRenderBarrier();
    runtime = crc(context.canvas, createElement(Physics3DRoot, { model }), {
      pixelRatio: 1,
    });
  };
  model.publish = publish;

  const execute = (action: Physics3DAction): void => {
    switch (action) {
      case "reset":
        resetRoot();
        break;
      case "settle":
        model.eventLog.push("action:settle");
        break;
      case "drop": {
        const body = requireBody(model, "drop-cube");
        teleportBody3D(body, {
          position: PHYSICS_3D_INITIAL_POSITIONS["drop-cube"],
          orientation: [0, 0, 0, 1],
        });
        setLinearVelocity3D(body, [0, 0, 0]);
        setAngularVelocity3D(body, [0, 0, 0]);
        break;
      }
      case "query": {
        const world = model.world;
        if (world === undefined) {
          throw new Error("Physics 3D world has not rendered yet.");
        }
        const hit = raycast3D(world, {
          origin: [3.6, 10, -2.6],
          direction: [0, -1, 0],
          maxDistance: 30,
        });
        model.queryTag = hit === null ? null : String(hit.tag);
        model.queryMarker.set(hit?.point ?? null);
        model.eventLog.push(`query:${model.queryTag ?? "miss"}`);
        break;
      }
      case "grab": {
        const body = requireBody(model, "drop-cube");
        const position = body.position.get();
        model.dropAuthoredPosition.set(position);
        model.dropEnabled.set(false);
        model.grabbed = true;
        model.grabSamples.splice(0, model.grabSamples.length, position);
        disableBody3D(body);
        model.eventLog.push("grab:disable");
        break;
      }
      case "drag": {
        if (!model.grabbed) {
          const body = requireBody(model, "drop-cube");
          const position = body.position.get();
          model.dropAuthoredPosition.set(position);
          model.dropEnabled.set(false);
          model.grabbed = true;
          model.grabSamples.splice(0, model.grabSamples.length, position);
          disableBody3D(body);
          model.eventLog.push("grab:disable");
        }
        model.dropAuthoredPosition.set(DRAG_POSITION);
        model.grabSamples.push(DRAG_POSITION);
        if (model.grabSamples.length > 4) model.grabSamples.shift();
        model.eventLog.push("drag:authored");
        break;
      }
      case "throw": {
        const body = requireBody(model, "drop-cube");
        const samples = model.grabSamples;
        const previous =
          samples[Math.max(0, samples.length - 2)] ?? body.position.get();
        const current = samples.at(-1) ?? body.position.get();
        const velocity = boundedVelocity(previous, current);
        model.dropEnabled.set(true);
        model.grabbed = false;
        enableBody3D(body, { velocity: "zero" });
        setLinearVelocity3D(body, velocity);
        wakeBody3D(body);
        model.eventLog.push(`throw:${velocity.join(",")}`);
        break;
      }
      case "impulse": {
        const body = requireBody(model, "drop-cube");
        const position = body.position.get();
        applyImpulse3D(body, [4, 3, 0], {
          at: [position[0], position[1] + 0.4, position[2]],
        });
        break;
      }
      case "teleport": {
        const body = requireBody(model, "drop-cube");
        teleportBody3D(body, {
          position: TELEPORT_POSITION,
          orientation: [0, 0, 0, 1],
        });
        model.eventLog.push("teleport");
        break;
      }
      case "disable": {
        const body = requireBody(model, "drop-cube");
        model.dropAuthoredPosition.set(body.position.get());
        model.dropEnabled.set(false);
        model.grabbed = false;
        disableBody3D(body);
        model.eventLog.push("disable");
        break;
      }
      case "authored-move": {
        if (model.dropEnabled.get()) {
          const body = requireBody(model, "drop-cube");
          model.dropAuthoredPosition.set(body.position.get());
          model.dropEnabled.set(false);
          disableBody3D(body);
          model.eventLog.push("disable");
        }
        model.dropAuthoredPosition.set(AUTHORED_POSITION);
        model.eventLog.push("authored-move");
        break;
      }
      case "re-enable": {
        const body = requireBody(model, "drop-cube");
        model.dropEnabled.set(true);
        enableBody3D(body, { velocity: "zero" });
        model.eventLog.push("re-enable:zero");
        break;
      }
      case "sleep":
        sleepBody3D(requireBody(model, "drop-cube"));
        model.eventLog.push("sleep");
        break;
      case "wake":
        wakeBody3D(requireBody(model, "drop-cube"));
        model.eventLog.push("wake");
        break;
      case "remove":
        model.dropMounted.set(false);
        model.grabbed = false;
        model.eventLog.push("remove");
        break;
      case "remount":
        model.dropAuthoredPosition.set(
          PHYSICS_3D_INITIAL_POSITIONS["drop-cube"],
        );
        model.dropEnabled.set(true);
        model.dropMounted.set(true);
        model.eventLog.push("remount");
        break;
    }
    publish();
  };

  publish();
  return {
    getState: () => snapshot(model, lastAction),
    perform: (actionId) => {
      assertActive();
      if (!(PHYSICS_3D_ACTION_IDS as readonly string[]).includes(actionId)) {
        return Promise.reject(
          new Error(`Physics 3D scene does not support action "${actionId}".`),
        );
      }
      const action = actionId as Physics3DAction;
      const current = actionQueue.then(async () => {
        assertActive();
        await rendered;
        assertActive();
        lastAction = action;
        execute(action);
      });
      actionQueue = current.catch(() => undefined);
      return current;
    },
    reset: () => {
      assertActive();
      const current = actionQueue.then(() => {
        assertActive();
        lastAction = "reset";
        resetRoot();
        publish();
      });
      actionQueue = current.catch(() => undefined);
      return current;
    },
    settled: async () => {
      await actionQueue;
      await rendered;
      publish();
    },
    dispose: async () => {
      if (disposed) return;
      await actionQueue.catch(() => undefined);
      runtime.dispose();
      disposed = true;
    },
  };
}

export const physics3DScenario: ScenarioDefinition<Physics3DState> = {
  id: "first-class-physics-3d",
  sourceId: PHYSICS_3D_SOURCE_ID,
  actionIds: PHYSICS_3D_ACTION_IDS,
  mount: mountPhysics3D,
  formatState: (state) => [
    {
      label: "World",
      value: `revision ${state.worldRevision} · ${state.contacts.length} contacts`,
    },
    {
      label: "Drop cube",
      value: `y ${state.bodies["drop-cube"].position[1]} · v ${state.bodies["drop-cube"].linearVelocity.join(", ")}`,
    },
    {
      label: "Bounce sphere",
      value: `y ${state.bodies["bounce-sphere"].position[1]} · vy ${state.bodies["bounce-sphere"].linearVelocity[1]}`,
    },
    {
      label: "Compound",
      value: `${state.compoundAligned ? "colliders aligned" : "awaiting alignment"} · sensor ${state.sensorOverlaps.length === 0 ? "clear" : state.sensorOverlaps.join(", ")}`,
    },
    {
      label: "Control",
      value: `${state.dropMounted ? (state.grabbed ? "grabbed" : "mounted") : "removed"} · ${state.bodies["drop-cube"].enabled ? "enabled" : "disabled"}`,
    },
    {
      label: "Ray query",
      value: state.queryTag ?? "not queried",
    },
  ],
};

function boundedVelocity(
  previous: readonly [number, number, number],
  current: readonly [number, number, number],
): readonly [number, number, number] {
  const raw = [
    (current[0] - previous[0]) * 6,
    (current[1] - previous[1]) * 6,
    (current[2] - previous[2]) * 6,
  ] as const;
  const magnitude = Math.hypot(...raw);
  const scale = magnitude > 8 ? 8 / magnitude : 1;
  return Object.freeze([raw[0] * scale, raw[1] * scale, raw[2] * scale]);
}

export type {
  Physics3DAction,
  Physics3DBodyId,
  Physics3DBodySnapshot,
  Physics3DState,
} from "./physics-3d.example";
export { PHYSICS_3D_BODY_IDS } from "./physics-3d.example";
