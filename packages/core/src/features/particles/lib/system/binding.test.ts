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
} from "../../../../lib/scheduler/testing.js";
import { compileParticleEffect2D } from "../compiler.js";
import { defineParticleEffect2D } from "../definition.js";
import { particle } from "../particle.js";
import type { PibblParticleEffect2D, PibblParticleSystem } from "../types.js";
import {
  type ParticleBindingCandidate,
  type ParticleSystemFrame,
  useParticleSystemBinding,
} from "./binding.js";
import { getParticleSystemController } from "./controller.js";
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

interface TestCandidate extends ParticleBindingCandidate {
  readonly label: string;
  readonly frames: ParticleSystemFrame[];
  disposeCount: number;
}

function candidate(
  label: string,
  owner: PibblInternalRenderOwner,
  effect: PibblParticleEffect2D,
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
    requestRender() {
      pibblInternalRequestRender(owner);
    },
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
    let system!: PibblParticleSystem;
    let allocatedA = 0;
    let allocatedB = 0;
    let first!: TestCandidate;
    let second!: TestCandidate;
    const SystemOwner = (): PibblNode => {
      system = useParticleSystem(effect);
      return null;
    };
    const FirstBinding = (_props: {}): PibblNode => {
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
    const SecondBinding = (_props: {}): PibblNode => {
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

  it("catches a failed cross-system replacement destroying the committed binding during evaluation", () => {
    const definition = effectWithParameters();
    const selected = signal<"first" | "second">("first");
    let firstSystem!: PibblParticleSystem;
    let secondSystem!: PibblParticleSystem;
    let first!: TestCandidate;
    let replacementError: unknown;
    const Systems = (): PibblNode => {
      firstSystem = useParticleSystem(definition);
      secondSystem = useParticleSystem(definition);
      return null;
    };
    const Binding = (): PibblNode => {
      const selectedSystem =
        selected.get() === "first" ? firstSystem : secondSystem;
      try {
        useParticleSystemBinding({
          system: selectedSystem,
          backend: "canvas",
          create(owner) {
            if (selectedSystem === secondSystem) {
              throw new Error("replacement candidate failed");
            }
            return (first ??= candidate("first", owner, definition));
          },
        });
      } catch (error) {
        replacementError = error;
      }
      return null;
    };
    const systemsRoot = mount(createElement(Systems, {}));
    driver.flush(0);
    const bindingRoot = mount(createElement(Binding, {}));
    driver.flush(1);
    if (driver.pendingHostFrames > 0) driver.flush(2);
    expect(getParticleSystemController(firstSystem).bindingCandidate).toBe(
      first,
    );

    selected.set("second");
    driver.flush(3);
    expect(replacementError).toMatchObject({
      message: "replacement candidate failed",
    });
    expect(getParticleSystemController(firstSystem).bindingCandidate).toBe(
      first,
    );
    expect(getParticleSystemController(secondSystem).bindingCandidate).toBe(
      undefined,
    );
    expect(first.disposeCount).toBe(0);

    bindingRoot.dispose();
    roots.delete(bindingRoot);
    systemsRoot.dispose();
    roots.delete(systemsRoot);
  });

  it("catches adoption of mismatched definitions or malformed parameters after a failed render", () => {
    const effect = effectWithParameters("committed");
    const other = effectWithParameters("other");
    let system!: PibblParticleSystem;
    let committed!: TestCandidate;
    let failed!: TestCandidate;
    let owner!: PibblInternalRenderOwner;
    const SystemOwner = (): PibblNode => {
      system = useParticleSystem(effect);
      return null;
    };
    const Binding = (): PibblNode => {
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
    let system!: PibblParticleSystem;
    let current!: TestCandidate;
    const Root = (): PibblNode => {
      system = useParticleSystem(effect);
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

  it("catches old-candidate disposal failure corrupting the adopted binding or lease", () => {
    const definition = effectWithParameters();
    const values = signal(1);
    const observed: string[] = [];
    let system!: PibblParticleSystem;
    let first!: TestCandidate;
    let current!: TestCandidate;
    const Root = (): PibblNode => {
      const value = values.get();
      system = useParticleSystem(definition, {
        onError(error) {
          observed.push(`system:${(error as { message: string }).message}`);
        },
      });
      useParticleSystemBinding({
        system,
        backend: "canvas",
        create(owner) {
          current = candidate(
            String(value),
            owner,
            definition,
            new Float64Array([value, 2, 3]),
          );
          if (first === undefined) {
            first = current;
            const dispose = first.dispose.bind(first);
            first.dispose = () => {
              dispose();
              if (first.disposeCount === 1) {
                throw new Error("old candidate dispose failed");
              }
            };
          }
          return current;
        },
        onError(error) {
          observed.push(`component:${(error as { message: string }).message}`);
        },
      });
      return null;
    };
    const baseline = particleSystemOwnershipSnapshot();
    const root = mount(createElement(Root, {}));
    driver.flush(0);
    if (driver.pendingHostFrames > 0) driver.flush(1);
    const activeAfterMount = particleSystemOwnershipSnapshot().activeBindings;

    values.set(10);
    expect(() => driver.flush(2)).not.toThrow();
    expect(getParticleSystemController(system).bindingCandidate).toBe(current);
    expect(particleSystemOwnershipSnapshot().activeBindings).toBe(
      activeAfterMount,
    );
    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(3);
    expect(observed).toEqual([
      "system:old candidate dispose failed",
      "component:old candidate dispose failed",
    ]);

    root.dispose();
    roots.delete(root);
    expect(particleSystemOwnershipSnapshot().activeBindings).toBe(
      baseline.activeBindings,
    );
  });
});

function mount(node: PibblNode) {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const root = pibbl(canvas, node);
  roots.add(root);
  return root;
}
