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
import {
  createCanvasBirthLedger,
  type CanvasBirthLedger,
} from "../canvas/birth-ledger.js";
import { compileParticleEffect2D } from "../compiler.js";
import { defineParticleEffect2D } from "../definition.js";
import { sampleBurstCount } from "../emission.js";
import { particle } from "../particle.js";
import type {
  CRCParticleEffect2D,
  CRCParticleExecution,
  CRCParticleSystem,
  CRCParticleSystemEvent,
  CRCParticleSystemOptions,
  CRCParticleSystemStatus,
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

interface TestCandidate extends ParticleBindingCandidate {
  readonly frames: ParticleSystemFrame[];
  clearCount: number;
  disposeCount: number;
  renderRequests: number;
  failClear: boolean;
  failDispose: boolean;
  failAdopt: boolean;
  failRequest: boolean;
}

function createCandidate(
  owner: CRCInternalRenderOwner,
  effect: CRCParticleEffect2D,
  requestRealRender = true,
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
    failClear: false,
    failDispose: false,
    failAdopt: false,
    failRequest: false,
    requestRender() {
      this.renderRequests += 1;
      if (this.failRequest) {
        this.failRequest = false;
        throw new Error("candidate request failed");
      }
      if (requestRealRender) crcInternalRequestRender(owner);
    },
    adoptFrame(frame) {
      if (this.failAdopt) {
        this.failAdopt = false;
        throw new Error("candidate adopt failed");
      }
      frames.push(frame);
    },
    clear() {
      this.clearCount += 1;
      if (this.failClear) throw new Error("candidate clear failed");
    },
    dispose() {
      this.disposeCount += 1;
      if (this.failDispose) {
        this.failDispose = false;
        throw new Error("candidate dispose failed");
      }
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
    system = useParticleSystem(effect, options);
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

interface LedgerCandidate extends ParticleBindingCandidate {
  readonly ledger: CanvasBirthLedger;
  disposeCount: number;
}

function mountLedgerSystem(
  effect: CRCParticleEffect2D,
  options: CRCParticleSystemOptions = {},
) {
  let system!: CRCParticleSystem;
  let candidate!: LedgerCandidate;
  const Root = (): CRCNode => {
    system = useParticleSystem(effect, options);
    const controller = getParticleSystemController(system);
    useParticleSystemBinding({
      system,
      backend: "canvas",
      create(owner) {
        if (candidate !== undefined) return candidate;
        const ledger = createCanvasBirthLedger(
          compileParticleEffect2D(effect),
          {
            retainSpawnEpoch: (epoch) => controller.retainSpawnEpoch(epoch),
            releaseSpawnEpoch: (epoch) => controller.releaseSpawnEpoch(epoch),
          },
        );
        candidate = {
          owner,
          backend: "canvas",
          execution: "stateless-canvas",
          compiled: compileParticleEffect2D(effect),
          parameters: compileParticleEffect2D(effect).parameterLayout.defaults,
          ledger,
          disposeCount: 0,
          requestRender() {
            crcInternalRequestRender(owner);
          },
          adoptFrame(nextFrame) {
            return ledger.adoptFrame(
              nextFrame,
              controller.currentSpawnEpoch,
              controller.spawnParameters(controller.currentSpawnEpoch),
            );
          },
          requestedBurstCount(emitterIndex, count, seed) {
            return ledger.requestedManualBirths(emitterIndex, count, seed);
          },
          emitBurst(request) {
            const acceptance = ledger.emitManualSources({
              ...request,
              origin: [request.origin[0], request.origin[1]],
              parameters: controller.spawnParameters(request.spawnEpoch),
            });
            return { ...ledger.candidateSummary(), ...acceptance };
          },
          clear() {
            ledger.clear();
            return ledger.candidateSummary();
          },
          finishTransaction(success) {
            ledger.finishTransaction(success);
          },
          dispose() {
            this.disposeCount += 1;
            ledger.dispose();
          },
        };
        return candidate;
      },
    });
    return null;
  };
  const root = mount(createElement(Root, {}));
  driver.flush(0);
  if (driver.pendingHostFrames > 0) driver.flush(1);
  return { candidate, root, system };
}

function mount(node: CRCNode) {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const root = crc(canvas, node);
  roots.add(root);
  return root;
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

function manualEffect(lifetimeMilliseconds = 100, capacity = 3) {
  return defineParticleEffect2D({
    debugName: "manual impact",
    emitters: [
      {
        name: "impact",
        capacity,
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
  it("catches a later pause overwriting running metadata before its start delivery", () => {
    const observations: Array<
      readonly [
        type: CRCParticleSystemEvent["type"],
        status: CRCParticleSystemStatus,
        execution: CRCParticleExecution,
      ]
    > = [];
    const { system } = mountSystem(manualEffect(), {
      onEvent(event) {
        observations.push([
          event.type,
          system.status.get(),
          system.execution.get(),
        ]);
      },
    });

    system.play();
    driver.flush(10);
    expect(system.status.get()).toBe("idle");
    expect(observations).toEqual([]);
    driver.flush(11);
    expect(system.status.get()).toBe("idle");
    expect(observations).toEqual([]);

    system.pause();
    driver.flush(12);
    expect(system.status.get()).toBe("running");
    expect(system.execution.get()).toBe("stateless-canvas");
    expect(observations).toEqual([["start", "running", "stateless-canvas"]]);

    driver.flush(13);
    expect(system.status.get()).toBe("paused");
    expect(system.execution.get()).toBe("stateless-canvas");
    expect(observations).toEqual([["start", "running", "stateless-canvas"]]);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
    expect(driver.pendingHostFrames).toBe(0);
  });

  it("catches immediate status writes, delta accumulation, and duplicate Advance registrations", () => {
    const { candidate, system } = mountSystem(finiteEffect());

    expect(system.status.get()).toBe("idle");
    expect(system.execution.get()).toBe("stateless-canvas");
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);

    system.play();
    expect(system.status.get()).toBe("idle");
    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(10);

    expect(system.status.get()).toBe("idle");
    expect(candidate.frames.at(-1)).toMatchObject({
      effectTimeMilliseconds: 0,
      previousEffectTimeMilliseconds: 0,
      seed: 0,
      status: "running",
    });
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(1);
    driver.flush(11);
    expect(system.status.get()).toBe("idle");
    driver.flush(12);
    expect(system.status.get()).toBe("running");

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
    expect(system.status.get()).toBe("paused");
    expect(candidate.frames.at(-1)?.effectTimeMilliseconds).toBe(30);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(1);
    driver.flush(101);
    driver.flush(102);
    expect(system.status.get()).toBe("running");

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
    expect(system.status.get()).toBe("idle");
    driver.flush(11);
    driver.flush(12);
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
    const framesBeforePausedBurst = candidate.frames.length;
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
    expect(candidate.frames).toHaveLength(framesBeforePausedBurst);

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
    driver.flush(51);
    driver.flush(52);
    expect(events.at(-1)?.type).toBe("start");

    system.emit("impact", { count: 1 });
    driver.flush(60);
    system.stop({ mode: "drain" });
    driver.flush(70);
    expect(system.status.get()).toBe("running");
    driver.flush(71);
    expect(system.status.get()).toBe("running");
    expect(events.at(-1)?.type).toBe("burst-accepted");
    driver.flush(72);
    expect(system.status.get()).toBe("draining");
    expect(events.at(-1)?.type).toBe("drain-start");
    driver.flush(160);
    expect(system.status.get()).toBe("draining");
    driver.flush(161);
    expect(system.status.get()).toBe("finished");
    expect(events.at(-1)?.type).toBe("finish");
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);

    system.restart();
    driver.flush(200);
    expect(candidate.frames.at(-1)?.seed).toBe(0xffff_ffff);
    system.stop({ mode: "clear" });
    driver.flush(201);
    driver.flush(202);
    expect(system.status.get()).toBe("running");
    expect(events.at(-1)?.type).toBe("start");
    driver.flush(203);
    expect(system.status.get()).toBe("finished");
    expect(candidate.clearCount).toBe(3);
    expect(events.at(-1)?.type).toBe("finish");
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
  });

  it("catches success delivery and accepted capacity surviving a real renderer transaction failure", () => {
    const events: Array<CRCParticleSystemEvent & Record<string, unknown>> = [];
    const definition = manualEffect(100, 3);
    let system!: CRCParticleSystem;
    let failRender = false;
    let failedCandidate!: TestCandidate;
    let replacementCandidate!: TestCandidate;
    const SystemOwner = (): CRCNode => {
      system = useParticleSystem(definition, {
        onEvent: (event) => events.push(event as (typeof events)[number]),
      });
      return null;
    };
    const FailedBinding = (): CRCNode => {
      useParticleSystemBinding({
        system,
        backend: "canvas",
        create(owner) {
          return (failedCandidate ??= createCandidate(owner, definition, true));
        },
      });
      if (failRender) throw new Error("injected particle renderer failure");
      return null;
    };
    const ReplacementBinding = (): CRCNode => {
      useParticleSystemBinding({
        system,
        backend: "canvas",
        create(owner) {
          return (replacementCandidate ??= createCandidate(
            owner,
            definition,
            true,
          ));
        },
      });
      return null;
    };
    const systemRoot = mount(createElement(SystemOwner, {}));
    driver.flush(0);
    const failedRoot = mount(createElement(FailedBinding, {}));
    driver.flush(1);
    if (driver.pendingHostFrames > 0) driver.flush(2);

    failRender = true;
    system.emit("impact", { count: 3 });
    driver.flush(10);
    expect(system.status.get()).toBe("idle");
    expect(() => driver.flush(11)).toThrow(
      /injected particle renderer failure/i,
    );
    expect(system.status.get()).toBe("idle");
    expect(events).toEqual([]);
    expect(failedCandidate.disposeCount).toBe(1);

    failedRoot.dispose();
    roots.delete(failedRoot);
    const replacementRoot = mount(createElement(ReplacementBinding, {}));
    driver.flush(11);
    if (driver.pendingHostFrames > 0) driver.flush(12);
    system.emit("impact", { count: 3 });
    driver.flush(20);
    driver.flush(21);
    driver.flush(22);
    expect(events.map((event) => event.type)).toEqual([
      "start",
      "burst-accepted",
    ]);
    expect(events.at(-1)).toMatchObject({ requested: 3, accepted: 3 });

    replacementRoot.dispose();
    roots.delete(replacementRoot);
    systemRoot.dispose();
    roots.delete(systemRoot);
  });

  it("catches failed empty presentation publishing finished status", () => {
    const events: CRCParticleSystemEvent[] = [];
    const definition = manualEffect(100, 1);
    let system!: CRCParticleSystem;
    let bound!: TestCandidate;
    let failRender = false;
    const SystemOwner = (): CRCNode => {
      system = useParticleSystem(definition, {
        onEvent: (event) => events.push(event),
      });
      return null;
    };
    const Binding = (): CRCNode => {
      useParticleSystemBinding({
        system,
        backend: "canvas",
        create(owner) {
          return (bound ??= createCandidate(owner, definition, true));
        },
      });
      if (failRender) throw new Error("injected empty render failure");
      return null;
    };
    const systemRoot = mount(createElement(SystemOwner, {}));
    driver.flush(0);
    const bindingRoot = mount(createElement(Binding, {}));
    driver.flush(1);
    if (driver.pendingHostFrames > 0) driver.flush(2);

    system.emit("impact", { count: 1 });
    driver.flush(10);
    driver.flush(11);
    driver.flush(12);
    expect(system.status.get()).toBe("running");

    failRender = true;
    system.stop({ mode: "clear" });
    expect(() => driver.flush(20)).toThrow(/injected empty render failure/i);
    expect(bound.clearCount).toBeGreaterThan(0);
    expect(system.status.get()).toBe("running");
    expect(events.some((event) => event.type === "finish")).toBe(false);

    bindingRoot.dispose();
    roots.delete(bindingRoot);
    systemRoot.dispose();
    roots.delete(systemRoot);
  });

  it("catches clear finishing before the empty renderer transaction succeeds", () => {
    const order: string[] = [];
    const definition = manualEffect();
    let system!: CRCParticleSystem;
    let candidate!: TestCandidate;
    let renderCount = 0;
    const Root = (): CRCNode => {
      renderCount += 1;
      system = useParticleSystem(definition, {
        onEvent(event) {
          order.push(`${event.type}@${renderCount}`);
        },
      });
      useParticleSystemBinding({
        system,
        backend: "canvas",
        create(owner) {
          return (candidate ??= createCandidate(owner, definition, true));
        },
      });
      return null;
    };
    const root = mount(createElement(Root, {}));
    driver.flush(0);
    if (driver.pendingHostFrames > 0) driver.flush(1);
    system.emit("impact");
    driver.flush(10);
    driver.flush(11);
    system.pause();
    driver.flush(12);
    expect(system.status.get()).toBe("running");
    driver.flush(13);
    expect(system.status.get()).toBe("paused");
    expect(driver.pendingHostFrames).toBe(0);
    const rendersBeforeClear = renderCount;

    system.stop({ mode: "clear" });
    driver.flush(20);
    expect(candidate.clearCount).toBeGreaterThan(0);
    expect(renderCount).toBe(rendersBeforeClear + 1);
    expect(order.at(-1)).not.toBe(`finish@${renderCount}`);
    expect(system.status.get()).toBe("paused");
    driver.flush(21);
    expect(order.at(-1)).toBe(`finish@${renderCount}`);
    expect(system.status.get()).toBe("finished");

    root.dispose();
    roots.delete(root);
  });

  it("catches manual births expiring from stale pre-gap effect time", () => {
    const events: Array<CRCParticleSystemEvent & Record<string, unknown>> = [];
    const { system } = mountSystem(manualEffect(100, 1), {
      autoplay: true,
      onEvent: (event) => events.push(event as (typeof events)[number]),
    });
    events.length = 0;

    system.emit("impact", { count: 1 });
    driver.flush(100);
    driver.flush(101);
    system.emit("impact", { count: 1 });
    driver.flush(102);
    driver.flush(103);
    expect(events.at(-1)).toMatchObject({
      type: "burst-rejected",
      reason: "capacity",
      requested: 1,
      accepted: 0,
    });
  });

  it("catches candidate clear failure corrupting accepted work or escaping its error channel", () => {
    const errors: unknown[] = [];
    const events: Array<CRCParticleSystemEvent & Record<string, unknown>> = [];
    const { candidate, system } = mountSystem(manualEffect(100, 1), {
      onEvent: (event) => events.push(event as (typeof events)[number]),
      onError: (error) => errors.push(error),
    });
    system.emit("impact", { count: 1 });
    driver.flush(10);
    candidate.failClear = true;

    system.stop({ mode: "clear" });
    expect(() => driver.flush(20)).not.toThrow();
    expect(system.status.get()).toBe("idle");
    expect(errors).toEqual([]);
    driver.flush(21);
    expect(system.status.get()).toBe("running");
    expect(events.some((event) => event.type === "finish")).toBe(false);
    expect(errors).toEqual([]);
    driver.flush(22);
    expect(errors).toEqual([
      expect.objectContaining({
        type: "execution-failed",
        message: "candidate clear failed",
      }),
    ]);

    system.emit("impact", { count: 1 });
    driver.flush(30);
    driver.flush(31);
    expect(events.at(-1)).toMatchObject({
      type: "burst-rejected",
      reason: "capacity",
    });
  });

  it("catches adoptFrame failure stranding or falsely succeeding its delivery", () => {
    const events: Array<CRCParticleSystemEvent & Record<string, unknown>> = [];
    const errors: unknown[] = [];
    const { candidate, system } = mountSystem(manualEffect(100, 1), {
      onEvent: (event) => events.push(event as (typeof events)[number]),
      onError: (error) => errors.push(error),
    });
    candidate.failAdopt = true;

    system.emit("impact", { count: 1 });
    expect(() => driver.flush(10)).not.toThrow();
    expect(system.status.get()).toBe("idle");
    expect(events).toEqual([]);
    expect(errors).toEqual([]);
    driver.flush(11);
    expect(errors).toEqual([
      expect.objectContaining({
        type: "execution-failed",
        message: "candidate adopt failed",
      }),
    ]);
    expect(events).toEqual([]);

    system.emit("impact", { count: 1 });
    driver.flush(20);
    driver.flush(21);
    driver.flush(22);
    expect(events.map((event) => event.type)).toEqual([
      "start",
      "burst-accepted",
    ]);
    expect(events.at(-1)).toMatchObject({ requested: 1, accepted: 1 });
  });

  it("catches requestRender failure stranding or falsely succeeding its delivery", () => {
    const events: Array<CRCParticleSystemEvent & Record<string, unknown>> = [];
    const errors: unknown[] = [];
    const { candidate, system } = mountSystem(manualEffect(100, 1), {
      onEvent: (event) => events.push(event as (typeof events)[number]),
      onError: (error) => errors.push(error),
    });
    candidate.failRequest = true;

    system.emit("impact", { count: 1 });
    expect(() => driver.flush(10)).not.toThrow();
    expect(system.status.get()).toBe("idle");
    expect(events).toEqual([]);
    expect(errors).toEqual([]);
    driver.flush(11);
    expect(errors).toEqual([
      expect.objectContaining({
        type: "execution-failed",
        message: "candidate request failed",
      }),
    ]);
    expect(events).toEqual([]);

    system.emit("impact", { count: 1 });
    driver.flush(20);
    driver.flush(21);
    driver.flush(22);
    expect(events.map((event) => event.type)).toEqual([
      "start",
      "burst-accepted",
    ]);
    expect(events.at(-1)).toMatchObject({ requested: 1, accepted: 1 });
  });

  it("catches a throwing clear render request escaping after population release", () => {
    const events: Array<CRCParticleSystemEvent & Record<string, unknown>> = [];
    const errors: unknown[] = [];
    const { candidate, system } = mountSystem(manualEffect(100, 1), {
      onEvent: (event) => events.push(event as (typeof events)[number]),
      onError: (error) => errors.push(error),
    });
    system.emit("impact", { count: 1 });
    driver.flush(10);
    driver.flush(11);
    driver.flush(12);
    expect(system.status.get()).toBe("running");

    candidate.failRequest = true;
    const clearsBeforeFailure = candidate.clearCount;
    system.stop({ mode: "clear" });
    expect(() => driver.flush(20)).not.toThrow();
    expect(candidate.clearCount).toBe(clearsBeforeFailure);
    expect(system.status.get()).toBe("running");
    expect(events.some((event) => event.type === "finish")).toBe(false);
    expect(errors).toEqual([]);
    driver.flush(21);
    expect(errors).toEqual([
      expect.objectContaining({
        type: "execution-failed",
        message: "candidate request failed",
      }),
    ]);

    system.emit("impact", { count: 1 });
    driver.flush(22);
    driver.flush(23);
    expect(events.at(-1)).toMatchObject({
      type: "burst-rejected",
      reason: "capacity",
      accepted: 0,
    });
  });

  it("catches finite early/late finish and accidental completion of infinite or manual-open runs", () => {
    const finiteEvents: string[] = [];
    const finite = mountSystem(finiteEffect(100), {
      autoplay: true,
      onEvent: (event) => finiteEvents.push(event.type),
    });
    driver.flush(2);
    expect(finite.system.status.get()).toBe("idle");
    driver.flush(3);
    expect(finite.system.status.get()).toBe("running");
    expect(finiteEvents).toEqual(["start"]);
    driver.flush(100);
    expect(finite.system.status.get()).toBe("running");
    driver.flush(101);
    expect(finite.system.status.get()).toBe("running");
    driver.flush(102);
    expect(finite.system.status.get()).toBe("finished");
    expect(finiteEvents).toEqual(["start", "finish"]);

    finite.root.dispose();
    roots.delete(finite.root);
    const infinite = mountSystem(infiniteEffect(), { autoplay: true });
    driver.flush(2_000);
    driver.flush(2_001);
    expect(infinite.system.status.get()).toBe("running");
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(1);

    infinite.root.dispose();
    roots.delete(infinite.root);
    const manual = mountSystem(manualEffect(), { autoplay: true });
    if (driver.pendingHostFrames > 0) driver.flush(2_002);
    if (driver.pendingHostFrames > 0) driver.flush(2_003);
    expect(manual.system.status.get()).toBe("running");
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
    expect(driver.pendingHostFrames).toBe(0);
  });

  it("uses the Canvas ledger's exact recycle acceptance and committed live generation", () => {
    const events: Array<CRCParticleSystemEvent & Record<string, unknown>> = [];
    const errors: unknown[] = [];
    const effect = defineParticleEffect2D({
      debugName: "recycled impact",
      emitters: [
        {
          name: "impact",
          capacity: 1,
          overflow: "recycle-oldest",
          emission: [{ type: "manual", count: 1 }],
          shape: { type: "point" },
          initial: { lifetimeMilliseconds: 1_000 },
          renderer: { type: "circle" },
        },
      ],
    });
    const mounted = mountLedgerSystem(effect, {
      onEvent: (event) => events.push(event as (typeof events)[number]),
      onError: (error) => errors.push(error),
    });

    mounted.system.emit("impact", { count: 2 });
    driver.flush(10);
    driver.flush(11);
    driver.flush(12);

    expect(events.at(-1)).toMatchObject({
      type: "burst-accepted",
      requested: 2,
      accepted: 2,
    });
    expect(errors).toEqual([]);
    const committed = mounted.candidate.ledger.committed.emitters[0]!;
    expect(committed.liveCount).toBe(1);
    expect(
      Array.from(committed.ordinals).filter(
        (_ordinal, slot) => committed.occupied[slot] === 1,
      ),
    ).toEqual([1]);
  });

  it("retains a successful birth epoch before parameter adoption can prune it", () => {
    const launch = signal(1);
    const effect = defineParticleEffect2D({
      parameters: {
        launch: { type: "number", default: 1, timing: "spawn" },
      },
      emitters: [
        {
          name: "spark",
          capacity: 1,
          emission: [{ type: "burst", atMilliseconds: 100, count: 1 }],
          shape: { type: "point" },
          initial: {
            lifetimeMilliseconds: 1_000,
            velocity: [particle.parameter("launch"), 0],
          },
          renderer: { type: "circle" },
          bounds: { min: [-10, -10], max: [10, 10] },
        },
      ],
    });
    const compiled = compileParticleEffect2D(effect);
    let system!: CRCParticleSystem;
    let candidate!: LedgerCandidate;
    let renderedParameters = compiled.parameterLayout.defaults;
    const Root = (): CRCNode => {
      system = useParticleSystem(effect, { autoplay: true });
      const controller = getParticleSystemController(system);
      renderedParameters = new Float64Array([launch.get()]);
      useParticleSystemBinding({
        system,
        backend: "canvas",
        create(owner) {
          if (candidate !== undefined) return candidate;
          const ledger = createCanvasBirthLedger(compiled, {
            retainSpawnEpoch: (epoch) => controller.retainSpawnEpoch(epoch),
            releaseSpawnEpoch: (epoch) => controller.releaseSpawnEpoch(epoch),
          });
          candidate = {
            owner,
            backend: "canvas",
            execution: "stateless-canvas",
            compiled,
            get parameters() {
              return renderedParameters;
            },
            ledger,
            disposeCount: 0,
            requestRender() {
              crcInternalRequestRender(owner);
            },
            adoptFrame(nextFrame) {
              return ledger.adoptFrame(
                nextFrame,
                controller.currentSpawnEpoch,
                controller.spawnParameters(controller.currentSpawnEpoch),
              );
            },
            requestedBurstCount(emitterIndex, count, seed) {
              return ledger.requestedManualBirths(emitterIndex, count, seed);
            },
            emitBurst(request) {
              const acceptance = ledger.emitManualSources({
                ...request,
                origin: [request.origin[0], request.origin[1]],
                parameters: controller.spawnParameters(request.spawnEpoch),
              });
              return { ...ledger.candidateSummary(), ...acceptance };
            },
            clear() {
              ledger.clear();
              return ledger.candidateSummary();
            },
            finishTransaction(success) {
              ledger.finishTransaction(success);
            },
            dispose() {
              this.disposeCount += 1;
              ledger.dispose();
            },
          };
          return candidate;
        },
      });
      return null;
    };
    const root = mount(createElement(Root, {}));
    driver.flush(0);
    if (driver.pendingHostFrames > 0) driver.flush(1);
    if (driver.pendingHostFrames > 0) driver.flush(2);
    const controller = getParticleSystemController(system);
    const birthEpoch = controller.currentSpawnEpoch;

    launch.set(2);
    driver.flush(101);

    const committed = candidate.ledger.committed.emitters[0]!;
    const slot = Array.from(committed.occupied).findIndex(
      (occupied) => occupied === 1,
    );
    expect(slot).toBeGreaterThanOrEqual(0);
    expect(committed.spawnEpochs[slot]).toBe(birthEpoch);
    expect([...controller.spawnParameters(birthEpoch)]).toEqual([1]);
    expect(controller.currentSpawnEpoch).not.toBe(birthEpoch);
    expect([
      ...controller.spawnParameters(controller.currentSpawnEpoch),
    ]).toEqual([2]);

    root.dispose();
    roots.delete(root);
  });

  it("publishes the ledger's restarted default manual count instead of the prior run's ordinal", () => {
    const events: Array<CRCParticleSystemEvent & Record<string, unknown>> = [];
    const effect = defineParticleEffect2D({
      emitters: [
        {
          name: "impact",
          capacity: 3,
          emission: [{ type: "manual", count: particle.integer(1, 3) }],
          shape: { type: "point" },
          initial: { lifetimeMilliseconds: 1_000 },
          renderer: { type: "circle" },
        },
      ],
    });
    const compiled = compileParticleEffect2D(effect);
    const emitter = compiled.emitters[0]!;
    const manual = emitter.emission.manual[0]!;
    let seed = 0;
    while (
      sampleBurstCount(manual, seed, emitter.emitterHash, 0) ===
      sampleBurstCount(manual, seed, emitter.emitterHash, 1)
    ) {
      seed += 1;
    }
    const restartedCount = sampleBurstCount(
      manual,
      seed,
      emitter.emitterHash,
      0,
    );
    const mounted = mountLedgerSystem(effect, {
      seed,
      onEvent: (event) => events.push(event as (typeof events)[number]),
    });

    mounted.system.emit("impact", { count: 1 });
    driver.flush(10);
    driver.flush(11);
    driver.flush(12);
    mounted.system.restart();
    mounted.system.emit("impact");
    driver.flush(20);
    driver.flush(21);
    driver.flush(22);

    expect(
      events.filter((event) => event.type === "burst-accepted").at(-1),
    ).toMatchObject({
      requested: restartedCount,
      accepted: restartedCount,
    });
  });

  it("finishes finite and draining systems from exact ledger births and deaths", () => {
    const events: string[] = [];
    const effect = defineParticleEffect2D({
      emitters: [
        {
          name: "spark",
          capacity: 2,
          emission: [
            { type: "burst", atMilliseconds: 0, count: 1 },
            { type: "burst", atMilliseconds: 100, count: 1 },
          ],
          shape: { type: "point" },
          initial: { lifetimeMilliseconds: 50 },
          renderer: { type: "circle" },
        },
      ],
    });
    const mounted = mountLedgerSystem(effect, {
      autoplay: true,
      onEvent: (event) => events.push(event.type),
    });

    driver.flush(49);
    expect(mounted.candidate.ledger.candidateSummary()).toMatchObject({
      liveCount: 1,
      nextAutomaticBirthMilliseconds: 100,
      latestDeathMilliseconds: 50,
    });
    driver.flush(51);
    expect(mounted.candidate.ledger.candidateSummary().liveCount).toBe(0);
    expect(mounted.system.status.get()).toBe("running");
    driver.flush(101);
    expect(mounted.candidate.ledger.candidateSummary()).toMatchObject({
      liveCount: 1,
      nextAutomaticBirthMilliseconds: null,
      latestDeathMilliseconds: 150,
    });
    driver.flush(151);
    driver.flush(152);
    expect(mounted.system.status.get()).toBe("finished");
    expect(events).toEqual(["start", "finish"]);

    mounted.root.dispose();
    roots.delete(mounted.root);
    const draining = mountLedgerSystem(infiniteEffect(), {
      autoplay: true,
      onEvent: (event) => events.push(event.type),
    });
    driver.flush(2_000);
    const liveAtStop = draining.candidate.ledger.candidateSummary().liveCount;
    expect(liveAtStop).toBeGreaterThan(0);
    draining.system.stop({ mode: "drain" });
    driver.flush(2_001);
    const closed = draining.candidate.ledger.candidateSummary();
    expect(closed.nextAutomaticBirthMilliseconds).toBeNull();
    driver.flush(2_101);
    expect(draining.system.status.get()).toBe("finished");
  });

  it("finishes an exact drain immediately when the ledger has no live births", () => {
    const events: string[] = [];
    const mounted = mountLedgerSystem(manualEffect(), {
      autoplay: true,
      onEvent: (event) => events.push(event.type),
    });

    if (driver.pendingHostFrames > 0) driver.flush(2);
    if (driver.pendingHostFrames > 0) driver.flush(3);
    expect(mounted.system.status.get()).toBe("running");
    expect(mounted.candidate.ledger.candidateSummary().liveCount).toBe(0);
    mounted.system.stop({ mode: "drain" });
    driver.flush(10);
    if (driver.pendingHostFrames > 0) driver.flush(11);
    if (driver.pendingHostFrames > 0) driver.flush(12);

    expect(mounted.system.status.get()).toBe("finished");
    expect(events).toEqual(["start", "drain-start", "finish"]);
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
