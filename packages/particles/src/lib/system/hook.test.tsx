import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { crc, createElement, signal, type CRCNode } from "@crc/core";
import {
  crcInternalRequestRender,
  type CRCInternalRenderOwner,
} from "@crc/core/internal";
import { clearSharedState } from "../../../../core/src/lib/global-state.js";
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
  snapshotRealmScheduler,
} from "../../../../core/src/lib/scheduler/testing.js";
import { compileParticleEffect2D } from "../compiler.js";
import { defineParticleEffect2D } from "../definition.js";
import type { CRCParticleEffect2D, CRCParticleSystem } from "../types.js";
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
const roots = new Set<ReturnType<typeof crc>>();

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
  owner: CRCInternalRenderOwner,
  definition: CRCParticleEffect2D,
): ParticleBindingCandidate {
  const compiled = compileParticleEffect2D(definition);
  return {
    owner,
    backend: "canvas",
    execution: "stateless-canvas",
    compiled,
    parameters: compiled.parameterLayout.defaults,
    requestRender() {
      crcInternalRequestRender(owner);
    },
    adoptFrame() {},
    clear() {},
    dispose() {},
  };
}

describe("useParticleSystem hook ownership", () => {
  it("catches handle recreation and stale effect/callback adoption", () => {
    const first = effect("first");
    const second = effect("second");
    const selected = signal(first);
    const observerVersion = signal("old");
    const calls: string[] = [];
    let system!: CRCParticleSystem;
    let original!: CRCParticleSystem;
    let activeCandidate: ParticleBindingCandidate | undefined;
    const Root = (): CRCNode => {
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
    let system!: CRCParticleSystem;
    let bound: ParticleBindingCandidate | undefined;
    const Root = (): CRCNode => {
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
    let system!: CRCParticleSystem;
    let bound: ParticleBindingCandidate | undefined;
    const Root = (): CRCNode => {
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
    let failedSystem!: CRCParticleSystem;
    const Failed = (): CRCNode => {
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
    let guardedSystem!: CRCParticleSystem;
    const Guarded = (): CRCNode => {
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
    expect(guardError).toMatchObject({ message: "CRC render" });
    expect(guardedSystem.status.get()).toBe("idle");
    guardedRoot.dispose();
    roots.delete(guardedRoot);
  });
});

function mount(node: CRCNode) {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const root = crc(canvas, node);
  roots.add(root);
  return root;
}
