import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Absolute,
  Clip,
  Flow,
  Fragment,
  Group,
  Layer,
  Rectangle,
  crc,
  signal,
  type CRCNode,
} from "@crc/core";
import {
  clearSharedState,
  getCRCInstance,
} from "../../../../core/src/lib/global-state.js";
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
} from "../../../../core/src/lib/scheduler/testing.js";
import {
  Particles2D,
  useParticleSystem,
  defineParticleEffect2D,
  type CRCParticleSystem,
} from "../../index.js";
import { particleSystemOwnershipSnapshot } from "../system/ownership.js";

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
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function effect(
  options: {
    automatic?: boolean;
    count?: number;
    position?: readonly [number, number];
    color?: string;
    size?: number;
  } = {},
) {
  const count = options.count ?? 1;
  return defineParticleEffect2D({
    emitters: [
      {
        name: "marks",
        capacity: Math.max(4, count),
        emission: options.automatic
          ? [{ type: "burst", atMilliseconds: 0, count }]
          : [{ type: "manual", count }],
        shape: { type: "point", position: options.position ?? [10, 10] },
        initial: {
          lifetimeMilliseconds: 1_000,
          size: options.size ?? 10,
          color: options.color ?? "#ff0000",
        },
        renderer: { type: "circle" },
        bounds: { min: [0, 0], max: [20, 20] },
      },
    ],
  });
}

function mount(node: CRCNode, width = 80, height = 60) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  document.body.appendChild(canvas);
  const root = crc(canvas, node, { pixelRatio: 1 });
  roots.add(root);
  return { canvas, root };
}

function flush(time: number): void {
  if (driver.pendingHostFrames > 0) driver.flush(time);
}

function pixel(canvas: HTMLCanvasElement, x: number, y: number) {
  return Array.from(canvas.getContext("2d")!.getImageData(x, y, 1, 1).data);
}

describe("Particles2D component", () => {
  it("resolves signal-valued effect and direct component inputs", () => {
    const selected = signal(effect({ automatic: true, color: "#ff0000" }));
    const autoplay = signal(true);
    const baseline = particleSystemOwnershipSnapshot();
    const { root } = mount(
      <Particles2D
        effect={selected}
        autoplay={autoplay}
        seed={signal(7)}
        pointerEvents="none"
        style={{ width: signal(20), height: signal(20) }}
      />,
      20,
      20,
    );
    driver.flush(0);
    flush(1);

    expect(particleSystemOwnershipSnapshot().activeSystems)
      .toBe(baseline.activeSystems + 1);

    selected.set(effect({ automatic: true, color: "#0000ff" }));
    driver.flush(2);
    flush(3);
    expect(particleSystemOwnershipSnapshot().activeSystems)
      .toBe(baseline.activeSystems + 1);

    root.dispose();
    roots.delete(root);
    expect(particleSystemOwnershipSnapshot().activeSystems)
      .toBe(baseline.activeSystems);
  });

  it("balances systems, bindings, scheduler registration, and the fixed ledger on disposal", () => {
    const baseline = particleSystemOwnershipSnapshot();
    const ambient = defineParticleEffect2D({
      emitters: [
        {
          name: "ambient",
          capacity: 8,
          emission: [{ type: "rate", particlesPerSecond: 4 }],
          shape: { type: "point" },
          initial: { lifetimeMilliseconds: 1_000, size: 2 },
          renderer: { type: "circle" },
        },
      ],
    });
    const mounted = mount(
      <Particles2D
        effect={ambient}
        autoplay
        pointerEvents="none"
        style={{ width: 40, height: 40 }}
      />,
      40,
      40,
    );
    flush(0);
    flush(1);
    flush(2);

    const active = particleSystemOwnershipSnapshot();
    expect(active.activeSystems).toBe(baseline.activeSystems + 1);
    expect(active.activeBindings).toBe(baseline.activeBindings + 1);
    expect(active.schedulerRegistrations).toBe(
      baseline.schedulerRegistrations + 1,
    );
    expect(active.canvasLedgers).toBe(baseline.canvasLedgers + 1);

    mounted.root.dispose();
    roots.delete(mounted.root);
    expect(particleSystemOwnershipSnapshot()).toMatchObject({
      activeSystems: baseline.activeSystems,
      activeBindings: baseline.activeBindings,
      schedulerRegistrations: baseline.schedulerRegistrations,
      canvasLedgers: baseline.canvasLedgers,
      canvasRasterEntries: baseline.canvasRasterEntries,
    });
  });

  it("renders both implicit autoplay and explicit system modes", () => {
    const automatic = effect({ automatic: true });
    const implicit = mount(
      <Particles2D
        effect={automatic}
        autoplay
        style={{ width: 40, height: 40 }}
      />,
      40,
      40,
    );
    flush(0);
    flush(1);
    flush(2);
    flush(3);
    expect(pixel(implicit.canvas, 10, 10)[3]).toBeGreaterThan(0);

    const manual = effect();
    let system!: CRCParticleSystem<"marks", Record<never, never>>;
    const Explicit = () => {
      system = useParticleSystem(manual);
      return <Particles2D system={system} style={{ width: 40, height: 40 }} />;
    };
    const explicit = mount(<Explicit />, 40, 40);
    flush(4);
    flush(5);
    system.play();
    flush(6);
    flush(7);
    system.emit("marks");
    flush(8);
    flush(9);
    flush(10);

    expect(system.execution.get()).toBe("stateless-canvas");
    expect(pixel(explicit.canvas, 10, 10)[3]).toBeGreaterThan(0);
  });

  it("uses root and layout-parent allocations and rejects missing or nonfinite allocation", () => {
    const definition = effect();
    const rootTarget = mount(
      <Particles2D effect={definition} pointerEvents="auto" />,
      80,
      60,
    );
    flush(0);
    const rootRegistration = Array.from(
      getCRCInstance(rootTarget.canvas).eventRoot.targets,
    )[0]!;
    const hitContext = rootTarget.canvas.getContext("2d")!;
    expect(
      hitContext.isPointInPath(rootRegistration.paintEntry!.path, 79, 59),
    ).toBe(true);
    expect(
      hitContext.isPointInPath(rootRegistration.paintEntry!.path, 81, 61),
    ).toBe(false);

    const placed = mount(
      <Absolute style={{ width: 80, height: 60 }}>
        <Particles2D
          effect={definition}
          pointerEvents="auto"
          style={{ left: 12, top: 7, width: 30, height: 20 }}
        />
      </Absolute>,
      80,
      60,
    );
    flush(1);
    const placedRegistration = Array.from(
      getCRCInstance(placed.canvas).eventRoot.targets,
    )[0]!;
    expect(placedRegistration.paintEntry!.transform.e).toBe(12);
    expect(placedRegistration.paintEntry!.transform.f).toBe(7);
    expect(
      hitContext.isPointInPath(placedRegistration.paintEntry!.path, 29, 19),
    ).toBe(true);
    expect(
      hitContext.isPointInPath(placedRegistration.paintEntry!.path, 31, 21),
    ).toBe(false);

    const missing = mount(
      <Flow style={{ width: 80, height: 60 }}>
        <Particles2D effect={definition} />
      </Flow>,
      80,
      60,
    );
    expect(() => driver.flush(2)).toThrow(/measurement.*unsupported|definite/i);
    roots.delete(missing.root);

    const nonfinite = mount(
      <Particles2D
        effect={definition}
        style={{ width: Number.POSITIVE_INFINITY }}
      />,
    );
    expect(() => driver.flush(3)).toThrow(/width.*finite|finite.*width/i);
    roots.delete(nonfinite.root);
  });

  it("preserves source paint order and composes opacity, Group transforms, and Clip", () => {
    const definition = effect({ automatic: true, color: "#ff0000" });
    const clip = new Path2D();
    clip.rect(0, 0, 16, 16);
    const { canvas } = mount(
      <Fragment>
        <Rectangle style={{ width: 80, height: 60, fill: "blue" }} />
        <Group style={{ translateX: 20 }}>
          <Clip style={{ d: clip }}>
            <Particles2D
              effect={definition}
              autoplay
              style={{ width: 40, height: 40, opacity: 0.5 }}
            />
          </Clip>
        </Group>
        <Rectangle
          style={{ x: 35, y: 5, width: 10, height: 10, fill: "green" }}
        />
      </Fragment>,
    );
    flush(0);
    flush(1);
    flush(2);
    flush(3);

    expect(pixel(canvas, 30, 10)).toEqual([128, 0, 127, 255]);
    expect(pixel(canvas, 40, 10)).toEqual([0, 128, 0, 255]);
    expect(pixel(canvas, 10, 10)).toEqual([0, 0, 255, 255]);
  });

  it("invalidates an explicit Layer and captures the combined primitive through a nonempty filter", () => {
    const definition = effect({ count: 3 });
    let system!: CRCParticleSystem<"marks", Record<never, never>>;
    const arcs = vi.spyOn(OffscreenCanvasRenderingContext2D.prototype, "arc");
    const offscreenDraws = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      "drawImage",
    );
    const Host = () => {
      system = useParticleSystem(definition);
      return (
        <Layer style={{ width: 40, height: 40 }}>
          <Particles2D
            system={system}
            style={{
              width: 40,
              height: 40,
              filter: { type: "blur", radius: 1 },
            }}
          />
        </Layer>
      );
    };
    mount(<Host />, 40, 40);
    flush(0);
    flush(1);
    arcs.mockClear();
    offscreenDraws.mockClear();

    system.play();
    flush(2);
    system.emit("marks", { count: 3 });
    flush(3);
    flush(4);

    expect(arcs.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(arcs.mock.calls.length % 3).toBe(0);
    expect(offscreenDraws.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("defaults to decorative participation and adds one declared-box target with no per-particle targets", () => {
    const decorative = mount(<Particles2D effect={effect()} />);
    flush(0);
    expect(getCRCInstance(decorative.canvas).eventRoot.targets.size).toBe(0);

    const interactive = mount(
      <Particles2D
        effect={effect({ automatic: true, count: 4 })}
        autoplay
        pointerEvents="auto"
        onPointerDown={() => undefined}
        style={{ width: 30, height: 20, cursor: "pointer" }}
      />,
    );
    flush(1);
    flush(2);
    const targets = Array.from(
      getCRCInstance(interactive.canvas).eventRoot.targets,
    );
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ cursor: "pointer" });
    expect(
      interactive.canvas
        .getContext("2d")!
        .isPointInPath(targets[0]!.paintEntry!.path, 29, 19),
    ).toBe(true);
  });
});
