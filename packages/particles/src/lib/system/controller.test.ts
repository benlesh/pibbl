import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { crc, createElement, type CRCNode } from "@crc/core";
import type { CRCInternalRenderOwner } from "@crc/core/internal";
import { clearSharedState } from "../../../../core/src/lib/global-state.js";
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
  snapshotRealmScheduler,
} from "../../../../core/src/lib/scheduler/testing.js";
import { compileParticleEffect2D } from "../compiler.js";
import { defineParticleEffect2D } from "../definition.js";
import type {
  CRCParticleEffect2D,
  CRCParticleSystem,
  CRCParticleSystemEvent,
  CRCParticleSystemOptions,
} from "../types.js";
import {
  type ParticleBindingCandidate,
  type ParticleSystemFrame,
  useParticleSystemBinding,
} from "./binding.js";
import {
  getParticleSystemController,
  particleSystemControllerSnapshot,
} from "./controller.js";
import { crcParticleSystem } from "./hook.js";
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

interface TestCandidate extends ParticleBindingCandidate {
  readonly frames: ParticleSystemFrame[];
  clearCount: number;
  disposeCount: number;
  renderRequests: number;
}

function createCandidate(
  owner: CRCInternalRenderOwner,
  effect: CRCParticleEffect2D,
): TestCandidate {
  const frames: ParticleSystemFrame[] = [];
  return {
    owner,
    backend: "canvas",
    execution: "stateless-canvas",
    compiled: compileParticleEffect2D(effect),
    parameters: compileParticleEffect2D(effect).parameterLayout.defaults,
    frames,
    clearCount: 0,
    disposeCount: 0,
    renderRequests: 0,
    requestRender() {
      this.renderRequests += 1;
    },
    adoptFrame(frame) {
      frames.push(frame);
    },
    clear() {
      this.clearCount += 1;
    },
    dispose() {
      this.disposeCount += 1;
    },
  };
}

function mountSystem(
  effect: CRCParticleEffect2D,
  options: CRCParticleSystemOptions = {},
  componentObserver?: (event: CRCParticleSystemEvent) => void,
) {
  let system!: CRCParticleSystem;
  let candidate: TestCandidate | undefined;
  const Root = (): CRCNode => {
    system = crcParticleSystem(effect, options);
    useParticleSystemBinding({
      system,
      backend: "canvas",
      create(owner) {
        return (candidate ??= createCandidate(owner, effect));
      },
      onEvent: componentObserver,
    });
    return null;
  };
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const root = crc(canvas, createElement(Root, {}));
  roots.add(root);
  driver.flush(0);
  if (driver.pendingHostFrames > 0) driver.flush(1);
  return {
    candidate: candidate!,
    root,
    system,
  };
}

function finiteEffect(lifetimeMilliseconds = 100) {
  return defineParticleEffect2D({
    debugName: "finite sparks",
    emitters: [
      {
        name: "sparks",
        capacity: 8,
        emission: [{ type: "burst", atMilliseconds: 0, count: 2 }],
        shape: { type: "point" },
        initial: { lifetimeMilliseconds },
        renderer: { type: "circle" },
      },
    ],
  });
}

function manualEffect(lifetimeMilliseconds = 100) {
  return defineParticleEffect2D({
    debugName: "manual impact",
    emitters: [
      {
        name: "impact",
        capacity: 3,
        emission: [{ type: "manual", count: 2 }],
        shape: { type: "point" },
        initial: { lifetimeMilliseconds },
        renderer: { type: "circle" },
      },
    ],
  });
}

function infiniteEffect() {
  return defineParticleEffect2D({
    debugName: "infinite snow",
    emitters: [
      {
        name: "snow",
        capacity: 20,
        emission: [{ type: "rate", particlesPerSecond: 10 }],
        shape: { type: "point" },
        initial: { lifetimeMilliseconds: 100 },
        renderer: { type: "circle" },
      },
    ],
  });
}

describe("scheduled particle system controller", () => {
  it("catches immediate status writes, delta accumulation, and duplicate Advance registrations", () => {
    const { candidate, system } = mountSystem(finiteEffect());

    expect(system.status.get()).toBe("idle");
    expect(system.execution.get()).toBe("stateless-canvas");
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);

    system.play();
    expect(system.status.get()).toBe("idle");
    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(10);

    expect(system.status.get()).toBe("running");
    expect(candidate.frames.at(-1)).toMatchObject({
      effectTimeMilliseconds: 0,
      previousEffectTimeMilliseconds: 0,
      seed: 0,
      status: "running",
    });
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(1);

    driver.flush(35);
    expect(candidate.frames.at(-1)?.effectTimeMilliseconds).toBe(25);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(1);

    system.pause();
    driver.flush(40);
    expect(system.status.get()).toBe("paused");
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
    expect(driver.pendingHostFrames).toBe(0);

    system.resume();
    driver.flush(100);
    expect(system.status.get()).toBe("running");
    expect(candidate.frames.at(-1)?.effectTimeMilliseconds).toBe(30);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(1);

    driver.flush(120);
    expect(candidate.frames.at(-1)?.effectTimeMilliseconds).toBe(50);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(1);
  });

  it("catches restart seed drift, paused births, capacity over-acceptance, and wrong drain/clear order", () => {
    const events: Array<CRCParticleSystemEvent & Record<string, unknown>> = [];
    const errors: unknown[] = [];
    const { candidate, system } = mountSystem(manualEffect(), {
      seed: -1,
      onEvent: (event) => events.push(event as (typeof events)[number]),
      onError: (error) => errors.push(error),
    });

    system.emit("impact", { count: 5, position: [4, 6], seedSalt: 7 });
    driver.flush(10);
    expect(system.status.get()).toBe("running");
    expect(events.map((event) => event.type)).toEqual([
      "start",
      "burst-accepted",
    ]);
    expect(events[1]).toMatchObject({
      emitter: "impact",
      requested: 5,
      accepted: 3,
      frameId: expect.any(Number),
      logicalTime: 10,
      effect: "manual impact",
    });
    expect(errors).toEqual([
      expect.objectContaining({
        type: "capacity-rejected",
        emitter: "impact",
        requested: 5,
        accepted: 3,
      }),
    ]);

    system.pause();
    driver.flush(20);
    const errorsBeforePausedBurst = errors.length;
    system.emit("impact", { count: 1 });
    driver.flush(30);
    expect(events.at(-1)).toMatchObject({
      type: "burst-rejected",
      emitter: "impact",
      requested: 1,
      accepted: 0,
      reason: "paused",
    });
    expect(errors).toHaveLength(errorsBeforePausedBurst);
    expect(candidate.frames).toHaveLength(1);

    system.restart({ seed: 4_294_967_297 });
    driver.flush(50);
    expect(candidate.clearCount).toBe(1);
    expect(candidate.frames.at(-1)).toMatchObject({
      generation: 2,
      effectTimeMilliseconds: 0,
      previousEffectTimeMilliseconds: 0,
      seed: 1,
      status: "running",
    });
    expect(events.at(-1)?.type).toBe("start");

    system.emit("impact", { count: 1 });
    driver.flush(60);
    system.stop({ mode: "drain" });
    driver.flush(70);
    expect(system.status.get()).toBe("draining");
    expect(events.at(-1)?.type).toBe("drain-start");
    driver.flush(160);
    expect(system.status.get()).toBe("finished");
    expect(events.at(-1)?.type).toBe("finish");
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);

    system.restart();
    driver.flush(200);
    expect(candidate.frames.at(-1)?.seed).toBe(0xffff_ffff);
    system.stop({ mode: "clear" });
    driver.flush(201);
    expect(system.status.get()).toBe("finished");
    expect(candidate.clearCount).toBe(3);
    expect(events.at(-1)?.type).toBe("finish");
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
  });

  it("catches finite early/late finish and accidental completion of infinite or manual-open runs", () => {
    const finiteEvents: string[] = [];
    const finite = mountSystem(finiteEffect(100), {
      autoplay: true,
      onEvent: (event) => finiteEvents.push(event.type),
    });
    expect(finite.system.status.get()).toBe("running");
    expect(finiteEvents).toEqual(["start"]);
    driver.flush(100);
    expect(finite.system.status.get()).toBe("running");
    driver.flush(101);
    expect(finite.system.status.get()).toBe("finished");
    expect(finiteEvents).toEqual(["start", "finish"]);

    finite.root.dispose();
    roots.delete(finite.root);
    const infinite = mountSystem(infiniteEffect(), { autoplay: true });
    driver.flush(2_000);
    expect(infinite.system.status.get()).toBe("running");
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(1);

    infinite.root.dispose();
    roots.delete(infinite.root);
    const manual = mountSystem(manualEffect(), { autoplay: true });
    expect(manual.system.status.get()).toBe("running");
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
    expect(driver.pendingHostFrames).toBe(0);
  });

  it("catches invalid command admission and proves controller resources balance", () => {
    const baseline = particleSystemOwnershipSnapshot();
    const effect = manualEffect();
    const mounted = mountSystem(effect);
    const during = particleSystemOwnershipSnapshot();
    expect(during.activeSystems).toBe(baseline.activeSystems + 1);
    expect(during.activeBindings).toBe(baseline.activeBindings + 1);
    expect(particleSystemControllerSnapshot(mounted.system)).toMatchObject({
      disposed: false,
      generation: 0,
      seed: 0,
    });

    expect(() => mounted.system.emit("missing" as "impact")).toThrow(
      /unknown emitter.*missing/i,
    );
    expect(() => mounted.system.emit("impact", { count: 0 })).toThrow(
      /count.*positive safe integer/i,
    );
    expect(() => mounted.system.restart({ seed: Number.NaN })).toThrow(
      /seed.*finite/i,
    );
    expect(() => mounted.system.stop({ mode: "later" as "drain" })).toThrow(
      /mode.*drain.*clear/i,
    );
    expect(getParticleSystemController(mounted.system).handle).toBe(
      mounted.system,
    );

    mounted.root.dispose();
    roots.delete(mounted.root);
    const after = particleSystemOwnershipSnapshot();
    expect(after.activeSystems).toBe(baseline.activeSystems);
    expect(after.activeBindings).toBe(baseline.activeBindings);
    expect(after.activeParameterEpochs).toBe(baseline.activeParameterEpochs);
    expect(after.queuedCommands).toBe(baseline.queuedCommands);
    expect(after.createdSystems - baseline.createdSystems).toBe(
      after.releasedSystems - baseline.releasedSystems,
    );
    expect(after.acquiredBindings - baseline.acquiredBindings).toBe(
      after.releasedBindings - baseline.releasedBindings,
    );
  });
});
