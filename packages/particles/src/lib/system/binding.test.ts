import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { crc, createElement, signal, type CRCNode } from "@crc/core";
import type { CRCInternalRenderOwner } from "@crc/core/internal";
import { clearSharedState } from "../../../../core/src/lib/global-state.js";
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
} from "../../../../core/src/lib/scheduler/testing.js";
import { compileParticleEffect2D } from "../compiler.js";
import { defineParticleEffect2D } from "../definition.js";
import { particle } from "../particle.js";
import type { CRCParticleEffect2D, CRCParticleSystem } from "../types.js";
import {
  type ParticleBindingCandidate,
  type ParticleSystemFrame,
  useParticleSystemBinding,
} from "./binding.js";
import { getParticleSystemController } from "./controller.js";
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
  readonly label: string;
  readonly frames: ParticleSystemFrame[];
  disposeCount: number;
}

function candidate(
  label: string,
  owner: CRCInternalRenderOwner,
  effect: CRCParticleEffect2D,
  parameters = compileParticleEffect2D(effect).parameterLayout.defaults,
): TestCandidate {
  return {
    label,
    owner,
    backend: "canvas",
    execution: "stateless-canvas",
    compiled: compileParticleEffect2D(effect),
    parameters,
    frames: [],
    disposeCount: 0,
    requestRender() {},
    adoptFrame(frame) {
      this.frames.push(frame);
    },
    clear() {},
    dispose() {
      this.disposeCount += 1;
    },
  };
}

function effectWithParameters(debugName = "parameter effect") {
  return defineParticleEffect2D({
    debugName,
    parameters: {
      launch: { type: "number", default: 1, timing: "spawn" },
      wind: { type: "number", default: 2, timing: "simulation" },
      alpha: { type: "number", default: 3, timing: "render" },
    },
    emitters: [
      {
        name: "sparks",
        capacity: 4,
        emission: [{ type: "manual", count: 1 }],
        shape: { type: "point" },
        initial: {
          lifetimeMilliseconds: 100,
          velocity: [particle.parameter("launch"), 0],
        },
        motion: [{ type: "drift", velocity: [particle.parameter("wind"), 0] }],
        appearance: {
          opacity: particle.curve([
            [0, 1],
            [1, 0],
          ]),
        },
        renderer: { type: "circle" },
        bounds: { min: [-10, -10], max: [10, 10] },
      },
    ],
  });
}

describe("particle system binding transactions", () => {
  it("catches allocation before conflict detection and permits binding after removal", () => {
    const effect = effectWithParameters();
    let system!: CRCParticleSystem;
    let allocatedA = 0;
    let allocatedB = 0;
    let first!: TestCandidate;
    let second!: TestCandidate;
    const SystemOwner = (): CRCNode => {
      system = crcParticleSystem(effect);
      return null;
    };
    const FirstBinding = (_props: {}): CRCNode => {
      useParticleSystemBinding({
        system,
        backend: "canvas",
        create(owner) {
          allocatedA += 1;
          return (first = candidate("first", owner, effect));
        },
      });
      return null;
    };
    const SecondBinding = (_props: {}): CRCNode => {
      useParticleSystemBinding({
        system,
        backend: "canvas",
        create(owner) {
          allocatedB += 1;
          return (second = candidate("second", owner, effect));
        },
      });
      return null;
    };
    const systemRoot = mount(createElement(SystemOwner, {}));
    driver.flush(0);
    const firstRoot = mount(createElement(FirstBinding, {}));
    driver.flush(1);
    if (driver.pendingHostFrames > 0) driver.flush(2);
    expect(allocatedA).toBe(1);

    const conflictedRoot = mount(createElement(SecondBinding, {}));
    expect(() => driver.flush(3)).toThrow(/already bound.*another component/i);
    expect(allocatedB).toBe(0);
    expect(first.disposeCount).toBe(0);
    conflictedRoot.dispose();
    roots.delete(conflictedRoot);

    firstRoot.dispose();
    roots.delete(firstRoot);
    expect(first.disposeCount).toBe(1);
    const secondRoot = mount(createElement(SecondBinding, {}));
    driver.flush(4);
    if (driver.pendingHostFrames > 0) driver.flush(5);
    expect(allocatedB).toBe(1);
    expect(second.disposeCount).toBe(0);
    expect(system.execution.get()).toBe("stateless-canvas");

    secondRoot.dispose();
    roots.delete(secondRoot);
    expect(second.disposeCount).toBe(1);
    driver.flush(6);
    expect(system.execution.get()).toBe("unbound");
    systemRoot.dispose();
    roots.delete(systemRoot);
  });

  it("catches adoption of mismatched definitions or malformed parameters after a failed render", () => {
    const effect = effectWithParameters("committed");
    const other = effectWithParameters("other");
    let system!: CRCParticleSystem;
    let committed!: TestCandidate;
    let failed!: TestCandidate;
    let owner!: CRCInternalRenderOwner;
    const SystemOwner = (): CRCNode => {
      system = crcParticleSystem(effect);
      return null;
    };
    const Binding = (): CRCNode => {
      useParticleSystemBinding({
        system,
        backend: "canvas",
        create(candidateOwner) {
          owner = candidateOwner;
          return (committed ??= candidate("committed", candidateOwner, effect));
        },
      });
      return null;
    };
    const systemRoot = mount(createElement(SystemOwner, {}));
    driver.flush(0);
    const bindingRoot = mount(createElement(Binding, {}));
    driver.flush(1);
    if (driver.pendingHostFrames > 0) driver.flush(2);
    const controller = getParticleSystemController(system);
    expect(controller.bindingCandidate).toBe(committed);

    const duplicateReservation = controller.reserveBinding(owner, "canvas");
    expect(() => controller.reserveBinding(owner, "canvas")).toThrow(
      /pending binding reservation/i,
    );
    controller.cancelBindingReservation(duplicateReservation);

    const committedCompiled = controller.compiled;
    const abandonedEffect = controller.prepareEffect(other);
    expect(abandonedEffect.compiled).not.toBe(committedCompiled);
    controller.cancelEffect(abandonedEffect);
    expect(controller.compiled).toBe(committedCompiled);

    const wrongReservation = controller.reserveBinding(owner, "canvas");
    failed = candidate("wrong", owner, other);
    expect(() =>
      controller.validateBindingCandidate(wrongReservation, failed),
    ).toThrow(/definition.*does not match/i);
    controller.cancelBindingReservation(wrongReservation);
    failed.dispose();
    expect(controller.bindingCandidate).toBe(committed);
    expect(committed.disposeCount).toBe(0);

    const invalidReservation = controller.reserveBinding(owner, "canvas");
    failed = candidate(
      "bad-parameters",
      owner,
      effect,
      new Float64Array([1, Number.NaN, 3]),
    );
    expect(() =>
      controller.validateBindingCandidate(invalidReservation, failed),
    ).toThrow(/parameter.*finite/i);
    controller.cancelBindingReservation(invalidReservation);
    failed.dispose();
    expect(controller.bindingCandidate).toBe(committed);
    expect(failed.disposeCount).toBe(1);
    expect(committed.disposeCount).toBe(0);

    bindingRoot.dispose();
    roots.delete(bindingRoot);
    systemRoot.dispose();
    roots.delete(systemRoot);
  });

  it("catches pre-render parameter mutation and prunes spawn epochs only after live references release", () => {
    const effect = effectWithParameters();
    const values = signal<readonly [number, number, number]>([1, 2, 3]);
    let system!: CRCParticleSystem;
    let current!: TestCandidate;
    const Root = (): CRCNode => {
      system = crcParticleSystem(effect);
      const next = values.get();
      useParticleSystemBinding({
        system,
        backend: "canvas",
        create(owner) {
          return (current = candidate(
            next.join(":"),
            owner,
            effect,
            new Float64Array(next),
          ));
        },
      });
      return null;
    };
    const root = mount(createElement(Root, {}));
    driver.flush(0);
    if (driver.pendingHostFrames > 0) driver.flush(1);
    const controller = getParticleSystemController(system);
    const firstEpoch = controller.currentSpawnEpoch;
    controller.retainSpawnEpoch(firstEpoch, 2);

    values.set([10, 20, 30]);
    expect(controller.simulationParameters[1]).toBe(2);
    expect(controller.renderParameters[2]).toBe(3);
    driver.flush(2);
    if (driver.pendingHostFrames > 0) driver.flush(3);

    expect(controller.currentSpawnEpoch).not.toBe(firstEpoch);
    expect([...controller.spawnParameters(firstEpoch)]).toEqual([1, 2, 3]);
    expect(controller.simulationParameters[1]).toBe(20);
    expect(controller.renderParameters[2]).toBe(30);
    expect(current.label).toBe("10:20:30");

    system.emit("sparks", { parameters: { launch: 99 } });
    driver.flush(4);
    const overrideEpoch = controller.currentSpawnEpoch + 1;
    expect([...controller.spawnParameters(overrideEpoch)]).toEqual([
      99, 20, 30,
    ]);
    expect([
      ...controller.spawnParameters(controller.currentSpawnEpoch),
    ]).toEqual([10, 20, 30]);
    driver.flush(105);
    expect(() => controller.spawnParameters(overrideEpoch)).toThrow(
      /unknown.*epoch/i,
    );

    const beforeRelease = particleSystemOwnershipSnapshot();
    controller.releaseSpawnEpoch(firstEpoch, 2);
    expect(() => controller.spawnParameters(firstEpoch)).toThrow(
      /unknown.*epoch/i,
    );
    expect(particleSystemOwnershipSnapshot().activeParameterEpochs).toBe(
      beforeRelease.activeParameterEpochs - 1,
    );

    root.dispose();
    roots.delete(root);
  });
});

function mount(node: CRCNode) {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const root = crc(canvas, node);
  roots.add(root);
  return root;
}
