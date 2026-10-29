import { describe, expect, it, vi } from "vitest";
import {
  GraphView,
  useForceNetwork,
  createForceSimulation,
  type ForceNetworkController,
  type GraphData,
} from "@pibbl/core/viz";
import { useSignal, type WritableSignal } from "@pibbl/core";
import { testRuntime } from "./support/runtime.js";
const graph = {
  nodes: [{ id: "a" }, { id: "b" }],
  edges: [{ id: "ab", from: "a", to: "b" }],
};
type Controller = ForceNetworkController<
  (typeof graph.nodes)[number],
  (typeof graph.edges)[number]
>;
describe("public force playback ownership", () => {
  it("commits bounded iterations, pause/resume/reset/pins, then releases scheduled work", () => {
    const runtime = testRuntime();
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    let controller!: Controller;
    function Scene() {
      controller = useForceNetwork(graph, {
        nodeKey: "id",
        edgeKey: "id",
        source: "from",
        target: "to",
        bounds: { x: 0, y: 0, width: 500, height: 300 },
        simulation: { maxIterations: 12 },
      });
      return <GraphView layout={controller.layout} />;
    }
    const tick = () => {
      now += 17;
      runtime.flush();
    };
    try {
      runtime.mount(<Scene />);
      for (let i = 0; i < 20; i++) tick();
      expect(controller.layout.get().iterations).toBe(12);
      expect(controller.status.get()).toBe("exhausted");
      controller.reset();
      controller.pause();
      for (let i = 0; i < 3; i++) tick();
      expect(controller.status.get()).toBe("paused");
      expect(controller.layout.get().iterations).toBe(0);
      controller.pin("a", { x: 70, y: 80 });
      controller.resume();
      for (let i = 0; i < 20; i++) tick();
      expect(controller.layout.get().nodes[0].bounds.x).toBe(50);
      expect(controller.status.get()).toBe("exhausted");
    } finally {
      runtime.dispose();
    }
    expect(runtime.pending).toBe(0);
  });
});

it("retains the last good snapshot on invalid updates and recovers with a replacement numeric solver", () => {
  const runtime = testRuntime();
  let now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  let controller!: Controller;
  let input!: WritableSignal<
    GraphData<(typeof graph.nodes)[number], (typeof graph.edges)[number]>
  >;
  let created = 0,
    steps = 0;
  const createSimulation: typeof createForceSimulation<
    (typeof graph.nodes)[number],
    (typeof graph.edges)[number]
  > = (data, options) => {
    created++;
    const base = createForceSimulation(data, options);
    return {
      ...base,
      step(options) {
        steps++;
        return base.step(options);
      },
    };
  };
  function Scene() {
    input =
      useSignal<
        GraphData<(typeof graph.nodes)[number], (typeof graph.edges)[number]>
      >(graph);
    controller = useForceNetwork(input, {
      nodeKey: "id",
      edgeKey: "id",
      source: "from",
      target: "to",
      bounds: { x: 0, y: 0, width: 500, height: 300 },
      createSimulation,
    });
    return <GraphView layout={controller.layout} />;
  }
  const tick = () => {
    now += 17;
    runtime.flush();
  };
  try {
    runtime.mount(<Scene />);
    for (let i = 0; i < 3; i++) tick();
    expect(created).toBe(1);
    expect(steps).toBeGreaterThan(0);
    input.set({ ...graph, edges: [{ id: "bad", from: "a", to: "unknown" }] });
    tick();
    const committed = controller.layout.get();
    for (let i = 0; i < 3; i++) tick();
    expect(controller.status.get()).toBe("failed");
    expect(controller.error.get()?.message).toMatch(/endpoint/i);
    expect(controller.layout.get()).toEqual(committed);
    input.set(graph);
    for (let i = 0; i < 3; i++) tick();
    expect(controller.status.get()).toBe("running");
    expect(controller.error.get()).toBeNull();
    expect(created).toBe(1);
  } finally {
    runtime.dispose();
  }
  controller.reset();
  controller.resume();
  expect(runtime.pending).toBe(0);
});

it("reheats exhausted force layouts when pin constraints change without unpausing an explicit pause", () => {
  const runtime = testRuntime();
  let now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  let controller!: Controller;
  function Scene() {
    controller = useForceNetwork(graph, {
      nodeKey: "id",
      edgeKey: "id",
      source: "from",
      target: "to",
      bounds: { x: 0, y: 0, width: 500, height: 300 },
      simulation: { maxIterations: 12 },
    });
    return <GraphView layout={controller.layout} />;
  }
  const tick = () => {
    now += 17;
    runtime.flush();
  };
  try {
    runtime.mount(<Scene />);
    for (let i = 0; i < 20; i++) tick();
    expect(controller.status.get()).toBe("exhausted");
    const before = controller.layout.get().nodes[1].bounds;
    controller.pin("a", { x: 40, y: 45 });
    for (let i = 0; i < 3; i++) tick();
    expect(controller.layout.get().nodes[1].bounds).not.toEqual(before);
    expect(controller.layout.get().nodes[0].bounds).toMatchObject({
      x: 20,
      y: 25,
    });
    controller.pause();
    for (let i = 0; i < 3; i++) tick();
    controller.release("a");
    for (let i = 0; i < 3; i++) tick();
    expect(controller.status.get()).toBe("paused");
    expect(controller.layout.get().iterations).toBe(0);
  } finally {
    runtime.dispose();
  }
  expect(runtime.pending).toBe(0);
});

it.each([60, 120, 144, 240])(
  "renders moving force positions on every %i Hz frame while integrating about 60 solver ticks per second",
  (refreshRate) => {
    const runtime = testRuntime();
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    let controller!: Controller;
    function Scene() {
      controller = useForceNetwork(graph, {
        nodeKey: "id",
        edgeKey: "id",
        source: "from",
        target: "to",
        bounds: { x: 0, y: 0, width: 500, height: 300 },
        simulation: { maxIterations: 500 },
      });
      return <GraphView layout={controller.layout} />;
    }
    const tick = () => {
      now += 1000 / refreshRate;
      runtime.flush();
    };
    try {
      runtime.mount(<Scene />);
      for (let i = 0; i < 20; i++) tick();
      const iterations = controller.layout.get().iterations;
      let previous = controller.layout.get().nodes[0].bounds;
      let changedFrames = 0;
      for (let i = 0; i < refreshRate / 2; i++) {
        tick();
        const next = controller.layout.get().nodes[0].bounds;
        if (next.x !== previous.x || next.y !== previous.y) changedFrames++;
        previous = next;
      }
      expect(
        controller.layout.get().iterations - iterations,
      ).toBeGreaterThanOrEqual(29);
      expect(
        controller.layout.get().iterations - iterations,
      ).toBeLessThanOrEqual(31);
      expect(changedFrames).toBe(refreshRate / 2);
      const beforeGap = controller.layout.get().iterations;
      now += 10_000;
      runtime.flush();
      expect(
        controller.layout.get().iterations - beforeGap,
      ).toBeLessThanOrEqual(2);
      expect(controller.status.get()).toBe("running");
    } finally {
      runtime.dispose();
    }
    expect(runtime.pending).toBe(0);
  },
);

it("keeps integrating while pointer-rate pin commands arrive instead of restarting its clock every frame", () => {
  const runtime = testRuntime();
  let now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  let controller!: Controller;
  let integrated = 0;
  const factory: typeof createForceSimulation<
    (typeof graph.nodes)[number],
    (typeof graph.edges)[number]
  > = (input, options) => {
    const base = createForceSimulation(input, options);
    return {
      ...base,
      step(options) {
        integrated += options.iterations;
        return base.step(options);
      },
    };
  };
  function Scene() {
    controller = useForceNetwork(graph, {
      nodeKey: "id",
      edgeKey: "id",
      source: "from",
      target: "to",
      createSimulation: factory,
      bounds: { x: 0, y: 0, width: 500, height: 300 },
      simulation: { maxIterations: 500 },
    });
    return <GraphView layout={controller.layout} />;
  }
  const tick = () => {
    now += 1000 / 120;
    runtime.flush();
  };
  try {
    runtime.mount(<Scene />);
    for (let i = 0; i < 20; i++) tick();
    const start = integrated;
    for (let i = 0; i < 30; i++) {
      controller.pin("a", { x: 70 + i, y: 80 });
      tick();
    }
    expect(integrated - start).toBeGreaterThanOrEqual(12);
    expect(controller.layout.get().nodes[0].bounds.x).toBe(79);
  } finally {
    runtime.dispose();
  }
  expect(runtime.pending).toBe(0);
});
