import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pibbl, createElement, signal, type PibblNode } from "@pibbl/core";
import {
  pibblInternalRequestRender,
  type PibblInternalRenderOwner,
} from "@pibbl/core/internal";
import { clearSharedState } from "../../../../lib/global-state.js";
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
  snapshotRealmScheduler,
} from "../../../../lib/scheduler/testing.js";
import { compileParticleEffect2D } from "../compiler.js";
import { defineParticleEffect2D } from "../definition.js";
import type { PibblParticleEffect2D, PibblParticleSystem } from "../types.js";
import {
  type ParticleBindingCandidate,
  useParticleSystemBinding,
} from "./binding.js";
import {
  getParticleSystemController,
  particleSystemControllerSnapshot,
} from "./controller.js";
import { useParticleSystem } from "./hook.js";
import { particleSystemOwnershipSnapshot } from "./ownership.js";

let driver: ManualSchedulerDriver;
let restoreDriver: () => void;
const roots = new Set<ReturnType<typeof pibbl>>();

beforeEach(() => {
  document.body.replaceChildren();
  driver = new ManualSchedulerDriver();
  restoreDriver = installSchedulerDriverForTest(driver);
});

afterEach(() => {
  for (const root of roots) root.dispose();
  roots.clear();
  clearSharedState();
  restoreDriver();
  document.body.replaceChildren();
});

function effect(debugName: string) {
  return defineParticleEffect2D({
    debugName,
    emitters: [
      {
        name: "burst",
        capacity: 4,
        emission: [{ type: "manual", count: 1 }],
        shape: { type: "point" },
        initial: { lifetimeMilliseconds: 50 },
        renderer: { type: "circle" },
      },
    ],
  });
}

function candidate(
  owner: PibblInternalRenderOwner,
  definition: PibblParticleEffect2D,
): ParticleBindingCandidate {
  const compiled = compileParticleEffect2D(definition);
  return {
    owner,
    backend: "canvas",
    execution: "stateless-canvas",
    compiled,
    parameters: compiled.parameterLayout.defaults,
    requestRender() {
      pibblInternalRequestRender(owner);
    },
    adoptFrame() {},
    clear() {},
    dispose() {},
  };
}

describe("useParticleSystem hook ownership", () => {
  it("resolves signal-valued effects, option objects, and direct option fields", () => {
    const first = effect("first");
    const second = effect("second");
    const selected = signal(first);
    const seed = signal(3);
    const options = signal({ autoplay: signal(false), seed });
    let system!: PibblParticleSystem;
    const Root = (): PibblNode => {
      system = useParticleSystem(selected, options);
      return null;
    };

    mount(createElement(Root, {}));
    driver.flush(0);
    expect(getParticleSystemController(system).compiled)
      .toBe(compileParticleEffect2D(first));
    expect(particleSystemControllerSnapshot(system).seed).toBe(3);

    seed.set(9);
    selected.set(second);
    driver.flush(1);
    if (driver.pendingHostFrames > 0) driver.flush(2);
    expect(getParticleSystemController(system).compiled)
      .toBe(compileParticleEffect2D(second));
    expect(particleSystemControllerSnapshot(system).seed).toBe(9);
  });

  it("catches handle recreation and stale effect/callback adoption", () => {
    const first = effect("first");
    const second = effect("second");
    const selected = signal(first);
    const observerVersion = signal("old");
    const calls: string[] = [];
    let system!: PibblParticleSystem;
    let original!: PibblParticleSystem;
    let activeCandidate: ParticleBindingCandidate | undefined;
    const Root = (): PibblNode => {
      const current = selected.get();
      const label = observerVersion.get();
      system = useParticleSystem(current, {
        onEvent: (event) => calls.push(`${label}:${event.type}`),
      });
      original ??= system;
      useParticleSystemBinding({
        system,
        backend: "canvas",
        create(owner) {
          const compiled = compileParticleEffect2D(current);
          if (activeCandidate?.compiled === compiled) return activeCandidate;
          return (activeCandidate = candidate(owner, current));
        },
      });
      return null;
    };
    const root = mount(createElement(Root, {}));
    driver.flush(0);
    if (driver.pendingHostFrames > 0) driver.flush(1);

    system.emit("burst");
    driver.flush(2);
    driver.flush(3);
    driver.flush(4);
    expect(calls).toEqual(["old:start", "old:burst-accepted"]);

    observerVersion.set("new");
    selected.set(second);
    driver.flush(5);
    expect(system).toBe(original);
    expect(getParticleSystemController(system).compiled).toBe(
      compileParticleEffect2D(second),
    );
    expect(system.status.get()).toBe("running");
    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(6);
    expect(system.status.get()).toBe("running");
    expect(particleSystemControllerSnapshot(system)).toMatchObject({
      generation: 2,
      effectTimeMilliseconds: 0,
      previousEffectTimeMilliseconds: 0,
    });
    driver.flush(7);
    expect(calls).toEqual(["old:start", "old:burst-accepted", "new:start"]);
    system.emit("burst");
    driver.flush(8);
    driver.flush(9);
    driver.flush(10);
    expect(calls).toEqual([
      "old:start",
      "old:burst-accepted",
      "new:start",
      "new:burst-accepted",
    ]);

    root.dispose();
    roots.delete(root);
  });

  it("catches reversed observer order and lets both observers finish when either throws", () => {
    const definition = effect("callbacks");
    const order: string[] = [];
    let system!: PibblParticleSystem;
    let bound: ParticleBindingCandidate | undefined;
    const Root = (): PibblNode => {
      system = useParticleSystem(definition, {
        onEvent(event) {
          order.push(`system:${event.type}`);
          if (event.type === "start") throw new Error("system observer failed");
        },
      });
      useParticleSystemBinding({
        system,
        backend: "canvas",
        create(owner) {
          return (bound ??= candidate(owner, definition));
        },
        onEvent(event) {
          order.push(`component:${event.type}`);
          if (event.type === "burst-accepted") {
            throw new Error("component observer failed");
          }
        },
      });
      return null;
    };
    const root = mount(createElement(Root, {}));
    driver.flush(0);
    if (driver.pendingHostFrames > 0) driver.flush(1);

    system.emit("burst");
    driver.flush(10);
    driver.flush(11);
    expect(() => driver.flush(12)).toThrow(/observer failed/i);
    expect(order).toEqual([
      "system:start",
      "component:start",
      "system:burst-accepted",
      "component:burst-accepted",
    ]);
    expect(system.status.get()).toBe("running");

    root.dispose();
    roots.delete(root);
  });

  it("catches queued-command resurrection, non-idempotent disposal, and stale live registrations", () => {
    const baseline = particleSystemOwnershipSnapshot();
    const definition = effect("disposed");
    let system!: PibblParticleSystem;
    let bound: ParticleBindingCandidate | undefined;
    const Root = (): PibblNode => {
      system = useParticleSystem(definition);
      useParticleSystemBinding({
        system,
        backend: "canvas",
        create(owner) {
          return (bound ??= candidate(owner, definition));
        },
      });
      return null;
    };
    const root = mount(createElement(Root, {}));
    driver.flush(0);
    if (driver.pendingHostFrames > 0) driver.flush(1);

    system.play();
    system.restart({ seed: 9 });
    expect(snapshotRealmScheduler().queuedBeginCommands).toBe(2);
    root.dispose();
    root.dispose();
    roots.delete(root);

    expect(system.status.get()).toBe("disposed");
    expect(system.execution.get()).toBe("unbound");
    expect(snapshotRealmScheduler()).toMatchObject({
      queuedBeginCommands: 0,
      registeredAdvanceParticipants: 0,
      pendingHostFrames: 0,
    });
    system.play();
    system.emit("burst");
    system.stop();
    expect(snapshotRealmScheduler().queuedBeginCommands).toBe(0);
    expect(particleSystemControllerSnapshot(system)).toMatchObject({
      disposed: true,
      generation: 0,
    });

    const after = particleSystemOwnershipSnapshot();
    expect(after.activeSystems).toBe(baseline.activeSystems);
    expect(after.activeBindings).toBe(baseline.activeBindings);
    expect(after.activeParameterEpochs).toBe(baseline.activeParameterEpochs);
    expect(after.queuedCommands).toBe(baseline.queuedCommands);
  });

  it("catches autoplay before a successful render and command use during component evaluation", () => {
    const definition = effect("guarded autoplay");
    let failedSystem!: PibblParticleSystem;
    const Failed = (): PibblNode => {
      failedSystem = useParticleSystem(definition, { autoplay: true });
      throw new Error("mount failed");
    };
    const failedRoot = mount(createElement(Failed, {}));
    expect(() => driver.flush(0)).toThrow(/mount failed/i);
    expect(failedSystem.status.get()).toBe("disposed");
    expect(snapshotRealmScheduler().queuedBeginCommands).toBe(0);
    failedRoot.dispose();
    roots.delete(failedRoot);

    let guardError: unknown;
    let guardedSystem!: PibblParticleSystem;
    const Guarded = (): PibblNode => {
      guardedSystem = useParticleSystem(definition);
      try {
        guardedSystem.play();
      } catch (error) {
        guardError = error;
      }
      return null;
    };
    const guardedRoot = mount(createElement(Guarded, {}));
    driver.flush(1);
    expect(guardError).toMatchObject({ message: "Pibbl render" });
    expect(guardedSystem.status.get()).toBe("idle");
    guardedRoot.dispose();
    roots.delete(guardedRoot);
  });
});

function mount(node: PibblNode) {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const root = pibbl(canvas, node);
  roots.add(root);
  return root;
}
