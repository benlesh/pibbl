import { crc, createElement, type CRCController } from "@crc/core";
import {
  applyImpulse3D,
  raycast3D,
  setAngularVelocity3D,
  setLinearVelocity3D,
  teleportBody3D,
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
  "drop",
  "impulse",
  "query",
] as const satisfies readonly Physics3DAction[];

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
      PHYSICS_3D_BODY_IDS.map((id) => [
        id,
        physics3DBodySnapshot(model, id),
      ]),
    ) as unknown as Readonly<
      Record<Physics3DBodyId, ReturnType<typeof physics3DBodySnapshot>>
    >,
    worldRevision: model.world?.revision.get() ?? 0,
    contacts: [...model.contacts],
    compoundAligned: physics3DCompoundAligned(model),
    queryTag: model.queryTag,
    queryPoint: model.queryMarker.get(),
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
    if (disposed) throw new Error("Cannot operate on a disposed physics 3D scene.");
  };
  const publish = (): void => {
    context.onStateChange?.(snapshot(model, lastAction));
  };
  const resetRoot = (): void => {
    runtime.dispose();
    model = createPhysics3DModel();
    model.publish = publish;
    armRenderBarrier();
    runtime = crc(
      context.canvas,
      createElement(Physics3DRoot, { model }),
      { pixelRatio: 1 },
    );
  };
  model.publish = publish;

  const execute = (action: Physics3DAction): void => {
    switch (action) {
      case "reset":
        resetRoot();
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
      case "impulse": {
        const body = requireBody(model, "drop-cube");
        const position = body.position.get();
        applyImpulse3D(body, [4, 3, 0], {
          at: [position[0], position[1] + 0.4, position[2]],
        });
        break;
      }
      case "query": {
        const world = model.world;
        if (world === undefined) {
          throw new Error("Physics 3D world has not rendered yet.");
        }
        const hit = raycast3D(world, {
          origin: [6.5, 10, 0],
          direction: [0, -1, 0],
          maxDistance: 30,
        });
        model.queryTag = hit === null ? null : String(hit.tag);
        model.queryMarker.set(hit?.point ?? null);
        break;
      }
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
      value: state.compoundAligned ? "colliders aligned" : "awaiting alignment",
    },
    {
      label: "Ray query",
      value: state.queryTag ?? "not queried",
    },
  ],
};

export type {
  Physics3DAction,
  Physics3DBodyId,
  Physics3DBodySnapshot,
  Physics3DState,
} from "./physics-3d.example";
export { PHYSICS_3D_BODY_IDS } from "./physics-3d.example";
