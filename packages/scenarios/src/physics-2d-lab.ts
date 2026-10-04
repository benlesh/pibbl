import { crc, createElement } from "@crc/core";
import {
  applyImpulse2D,
  disableBody2D,
  enableBody2D,
  queryAabb2D,
  setLinearVelocity2D,
  teleportBody2D,
  type CRCPhysicsBodyHandle2D,
  type CRCPhysicsVector2,
} from "@crc/core/physics/2d";
import {
  PHYSICS_2D_LAB_BODY_IDS,
  PHYSICS_2D_LAB_SOURCE_ID,
  Physics2DLabRoot,
  createPhysics2DLabModel,
  type Physics2DLabAction,
  type Physics2DLabBodyId,
  type Physics2DLabBodySnapshot,
  type Physics2DLabModel,
  type Physics2DLabState,
} from "./physics-2d-lab.example";
import type {
  ScenarioController,
  ScenarioDefinition,
  ScenarioMountContext,
} from "./types";

export const PHYSICS_2D_LAB_ACTION_IDS = [
  "settle",
  "impulse",
  "cross-sensor",
  "move-platform",
  "query",
  "disable-handoff",
  "transfer-animation",
  "reenable-handoff",
  "remove-owner",
] as const satisfies readonly Physics2DLabAction[];

const INITIAL_POSITIONS: Readonly<
  Record<Physics2DLabBodyId, CRCPhysicsVector2>
> = {
  circle: [64, 202],
  box: [120, 202],
  ellipse: [176, 204],
  capsule: [236, 202],
  polygon: [300, 202],
  star: [362, 202],
  platform: [220, 142],
  sensorMover: [270, 104],
  handoff: [420, 202],
};

function nextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function clean(value: number): number {
  const rounded = Number(value.toFixed(6));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function vector(value: CRCPhysicsVector2): CRCPhysicsVector2 {
  return Object.freeze([clean(value[0]), clean(value[1])] as const);
}

function requireBody(
  model: Physics2DLabModel,
  id: Physics2DLabBodyId,
): CRCPhysicsBodyHandle2D {
  const body = model.handles[id];
  if (!body) {
    throw new Error(`Physics laboratory body "${id}" has not rendered yet.`);
  }
  return body;
}

function bodySnapshot(
  model: Physics2DLabModel,
  id: Physics2DLabBodyId,
): Physics2DLabBodySnapshot {
  const body = model.handles[id];
  const fallback = INITIAL_POSITIONS[id];
  if (!body) {
    return {
      position: vector(fallback),
      rotationDegrees: 0,
      linearVelocity: [0, 0],
      angularVelocityDegreesPerSecond: 0,
      sleeping: false,
      enabled: false,
      generation: 0,
      presentedPosition: vector(fallback),
      presentationOffset: 0,
    };
  }
  const enabled =
    id === "handoff" ? model.handoffEnabled.get() : body.enabled.get();
  const authoritativePosition =
    id === "handoff" && !model.handoffEnabled.get()
      ? model.handoffPosition.get()
      : body.position.get();
  const presentedPosition =
    model.presentedPositions[id] ?? authoritativePosition;
  return {
    position: vector(authoritativePosition),
    rotationDegrees: clean(body.rotationDegrees.get()),
    linearVelocity: vector(body.linearVelocity.get()),
    angularVelocityDegreesPerSecond: clean(
      body.angularVelocityDegreesPerSecond.get(),
    ),
    sleeping: body.sleeping.get(),
    enabled,
    generation: body.generation.get(),
    presentedPosition: vector(presentedPosition),
    presentationOffset: clean(
      Math.hypot(
        presentedPosition[0] - authoritativePosition[0],
        presentedPosition[1] - authoritativePosition[1],
      ),
    ),
  };
}

function snapshot(
  model: Physics2DLabModel,
  lastAction: Physics2DLabState["lastAction"],
): Physics2DLabState {
  return {
    bodies: Object.fromEntries(
      PHYSICS_2D_LAB_BODY_IDS.map((id) => [id, bodySnapshot(model, id)]),
    ) as unknown as Readonly<
      Record<Physics2DLabBodyId, Physics2DLabBodySnapshot>
    >,
    worldRevision: model.world?.revision.get() ?? 0,
    contacts: [...model.contacts],
    overlaps: [...model.overlaps],
    queryTags: [...model.queryTags],
    owner: model.ownerVisible.get() ? "mounted" : "removed",
    transferStage: model.ownerVisible.get() ? model.transferStage : "removed",
    lastAction,
  };
}

async function mountPhysics2DLab(
  context: ScenarioMountContext<Physics2DLabState>,
): Promise<ScenarioController<Physics2DLabState>> {
  let disposed = false;
  let model = createPhysics2DLabModel();
  let lastAction: Physics2DLabState["lastAction"] = "mount";
  let mount = crc(context.canvas, createElement(Physics2DLabRoot, { model }), {
    pixelRatio: 1,
  });
  let actionQueue = Promise.resolve();

  const assertActive = (): void => {
    if (disposed)
      throw new Error("Cannot operate on a disposed physics laboratory.");
  };
  const publish = (): void => {
    context.onStateChange?.(snapshot(model, lastAction));
  };
  const resetRoot = (): void => {
    mount.dispose();
    model = createPhysics2DLabModel();
    model.publish = publish;
    mount = crc(context.canvas, createElement(Physics2DLabRoot, { model }), {
      pixelRatio: 1,
    });
  };
  model.publish = publish;

  const execute = (action: Physics2DLabAction): void => {
    switch (action) {
      case "settle":
        // Observe the simulation; never manufacture a settled state.
        break;
      case "impulse":
        applyImpulse2D(requireBody(model, "circle"), [80, -30]);
        break;
      case "cross-sensor":
        model.overlaps.length = 0;
        teleportBody2D(requireBody(model, "sensorMover"), {
          position: [270, 104],
          rotationDegrees: 0,
        });
        setLinearVelocity2D(requireBody(model, "sensorMover"), [100, 0]);
        break;
      case "move-platform":
        model.platformPlayback?.play({ conflict: "replace" });
        break;
      case "query": {
        const world = model.world;
        if (!world)
          throw new Error("Physics laboratory world has not rendered yet.");
        const matches = queryAabb2D(
          world,
          { min: [0, 70], max: [480, 240] },
          { mode: "all", sensors: "include" },
        );
        model.queryTags.splice(
          0,
          model.queryTags.length,
          ...matches.map((match) => String(match.tag)),
        );
        break;
      }
      case "disable-handoff": {
        const body = requireBody(model, "handoff");
        const position = vector(body.position.get());
        model.handoffCompletionArmed = false;
        model.handoffPlayback?.cancel();
        model.handoffPosition.set(position);
        model.handoffEnabled.set(false);
        model.transferStage = "disabled";
        disableBody2D(body);
        break;
      }
      case "transfer-animation": {
        if (model.handoffEnabled.get()) {
          const body = requireBody(model, "handoff");
          model.handoffPosition.set(vector(body.position.get()));
          model.handoffEnabled.set(false);
          disableBody2D(body);
        }
        model.handoffCompletionArmed = true;
        model.transferStage = "animating";
        model.handoffPlayback?.play({ conflict: "replace" });
        break;
      }
      case "reenable-handoff": {
        const body = requireBody(model, "handoff");
        model.handoffCompletionArmed = false;
        model.handoffPlayback?.cancel();
        model.handoffEnabled.set(true);
        model.transferStage = "physics";
        teleportBody2D(body, {
          position: model.handoffPosition.get(),
          rotationDegrees: body.rotationDegrees.get(),
        });
        enableBody2D(body, { velocity: "zero" });
        break;
      }
      case "remove-owner":
        model.handoffCompletionArmed = false;
        model.handoffPlayback?.cancel();
        model.ownerVisible.set(false);
        model.transferStage = "removed";
        break;
    }
    publish();
  };

  publish();

  return {
    getState: () => snapshot(model, lastAction),
    perform: (actionId) => {
      assertActive();
      if (
        !(PHYSICS_2D_LAB_ACTION_IDS as readonly string[]).includes(actionId)
      ) {
        return Promise.reject(
          new Error(
            `Physics laboratory does not support action "${actionId}".`,
          ),
        );
      }
      const action = actionId as Physics2DLabAction;
      const current = actionQueue.then(() => {
        assertActive();
        lastAction = action;
        execute(action);
      });
      actionQueue = current.catch(() => {});
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
      actionQueue = current.catch(() => {});
      return current;
    },
    settled: async () => {
      await actionQueue;
      await nextPaint();
      await nextPaint();
      publish();
    },
    dispose: async () => {
      if (disposed) return;
      await actionQueue.catch(() => {});
      mount.dispose();
      disposed = true;
    },
  };
}

export const physics2DLabScenario: ScenarioDefinition<Physics2DLabState> = {
  id: "first-class-physics-2d",
  sourceId: PHYSICS_2D_LAB_SOURCE_ID,
  actionIds: PHYSICS_2D_LAB_ACTION_IDS,
  mount: mountPhysics2DLab,
  formatState: (state) => [
    {
      label: "World",
      value: `revision ${state.worldRevision} · ${state.owner}`,
    },
    {
      label: "Circle",
      value: `${state.bodies.circle.sleeping ? "sleeping" : "awake"} · v ${state.bodies.circle.linearVelocity.join(", ")}`,
    },
    {
      label: "Sensor",
      value: state.overlaps.at(-1) ?? "no overlap yet",
    },
    {
      label: "Platform",
      value: `x ${state.bodies.platform.position[0]}`,
    },
    {
      label: "Handoff",
      value: `${state.transferStage} · x ${state.bodies.handoff.position[0]} · offset ${state.bodies.handoff.presentationOffset}`,
    },
    {
      label: "Query tags",
      value: state.queryTags.length
        ? state.queryTags.join(", ")
        : "not queried",
    },
    { label: "Last action", value: state.lastAction },
  ],
};
