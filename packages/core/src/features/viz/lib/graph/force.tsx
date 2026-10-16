import type { PibblNode } from "@pibbl/core";
import {
  Group,
  computed,
  drive,
  resolveSignalValue,
  signal,
  stepper,
  useConst,
  usePlayback,
  useReaction,
  untracked,
} from "@pibbl/core";
import type {
  GraphData,
  ForceOptions,
  ForceLayout,
  ForceSimulation,
  ForceNetworkController,
  ForceHookOptions,
  ForceNetworkProps,
  Point,
  VizKey,
} from "./types.js";
import { graphRecords, nodeSize } from "./dependency.js";
import {
  graphNodeGeometry,
  readAccessor,
  validateBounds,
  useGraphFrame,
  GraphView,
} from "./shared.js";
import { straightGraphRoute, routePath } from "./routes.js";
type Particle<N> = {
  key: VizKey;
  datum: N;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  label: string;
  detail?: string;
};
function configuration<N, E>(
  graph: GraphData<N, E>,
  options: ForceOptions<N, E>,
) {
  const bounds = validateBounds(options.bounds),
    records = graphRecords(graph, options);
  const settings = {
    seed: options.simulation?.seed ?? 1,
    linkDistance: options.simulation?.linkDistance ?? 90,
    nodeGap: options.simulation?.nodeGap ?? 8,
    maxIterations: options.simulation?.maxIterations ?? 300,
  };
  if (
    !Number.isSafeInteger(settings.seed) ||
    !Number.isSafeInteger(settings.maxIterations) ||
    settings.maxIterations < 0
  )
    throw new RangeError(
      "Force seed must be a safe integer; maxIterations must be a nonnegative safe integer.",
    );
  if (
    !Number.isFinite(settings.linkDistance) ||
    settings.linkDistance <= 0 ||
    !Number.isFinite(settings.nodeGap) ||
    settings.nodeGap < 0
  )
    throw new RangeError(
      "Force distances must be finite; linkDistance positive and nodeGap nonnegative.",
    );
  const nodes = [...records.nodes].map(([key, datum]) => ({
    key,
    datum,
    ...nodeSize(datum, options.nodeSize, { width: 40, height: 40 }),
    label: options.label ? readAccessor(datum, options.label) : String(key),
    detail: options.detail ? readAccessor(datum, options.detail) : undefined,
  }));
  if (
    bounds.width > 0 &&
    bounds.height > 0 &&
    nodes.some((n) => n.width > bounds.width || n.height > bounds.height)
  )
    throw new RangeError("Force node exceeds layout bounds.");
  return {
    bounds,
    settings,
    nodes,
    edges: records.edges,
    directed: options.directed ?? true,
  };
}
/** Create a deterministic, manually stepped numeric solver without resources or scheduling.
 * Uses inverse-square repulsion, Hooke link relaxation, damping, box collisions and bounded iterations.
 * @param graph - Original records. See {@link GraphData}.
 * @param options - Accessors, bounds and seed. See {@link ForceOptions}.
 * @returns Numeric session whose snapshots can be rendered or advanced by any public driver. See {@link ForceSimulation}.
 */
export function createForceSimulation<N, E>(
  graph: GraphData<N, E>,
  options: ForceOptions<N, E>,
): ForceSimulation<N, E> {
  let config = configuration(graph, options),
    iterations = 0,
    settled = false,
    particles: Particle<N>[] = [],
    pins = new Map<VizKey, Point>();
  let stableSteps = 0;
  const seedParticles = () => {
    let seed = config.settings.seed >>> 0;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    return config.nodes.map((node) => ({
      ...node,
      x:
        config.bounds.x +
        node.width / 2 +
        random() * Math.max(0, config.bounds.width - node.width),
      y:
        config.bounds.y +
        node.height / 2 +
        random() * Math.max(0, config.bounds.height - node.height),
      vx: 0,
      vy: 0,
    }));
  };
  particles = seedParticles();
  const read = (): ForceLayout<N, E> => {
    const { bounds } = config;
    if (!bounds.width || !bounds.height)
      return { bounds, nodes: [], edges: [], iterations, settled };
    const nodes = particles.map((p) => {
      const box = {
        x: p.x - p.width / 2,
        y: p.y - p.height / 2,
        width: p.width,
        height: p.height,
      };
      const node = graphNodeGeometry(p.datum, p.key, box, p.label, p.detail);
      return {
        ...node,
        label: {
          text: p.label,
          bounds: {
            x: p.x - 80,
            y: p.y + p.height / 2 + 6,
            width: 160,
            height: 18,
          },
          rotationDegrees: 0,
        },
      };
    });
    const byKey = new Map(particles.map((p) => [p.key, p]));
    const edges = config.edges.map((edge) => {
      const a = byKey.get(edge.sourceKey)!,
        b = byKey.get(edge.targetKey)!;
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const boundary = (p: Particle<N>, x: number, y: number) => {
        const t = Math.min(
          x === 0 ? Infinity : p.width / 2 / Math.abs(x),
          y === 0 ? Infinity : p.height / 2 / Math.abs(y),
        );
        return {
          x: p.x + x * (Number.isFinite(t) ? t : 0),
          y: p.y + y * (Number.isFinite(t) ? t : 0),
        };
      };
      const route = straightGraphRoute(
        {
          sourceAnchor: boundary(a, dx, dy),
          targetAnchor: boundary(b, -dx, -dy),
        },
        { arrowLength: config.directed ? 6 : 0 },
      );
      return {
        ...edge,
        route,
        path: forcePath(route.segments),
        arrowPath: route.arrowSegments ? routePath(route.arrowSegments) : null,
      };
    });
    return { bounds, nodes, edges, iterations, settled };
  };
  return {
    read,
    step({ iterations: count }) {
      if (!Number.isSafeInteger(count) || count < 0)
        throw new RangeError(
          "Force step iterations must be a nonnegative safe integer.",
        );
      if (!config.bounds.width || !config.bounds.height) return read();
      for (
        let n = 0;
        n < count && iterations < config.settings.maxIterations && !settled;
        n++, iterations++
      ) {
        const forces = particles.map((p) => ({
          x: (config.bounds.x + config.bounds.width / 2 - p.x) * 0.002,
          y: (config.bounds.y + config.bounds.height / 2 - p.y) * 0.002,
        }));
        for (let i = 0; i < particles.length; i++)
          for (let j = i + 1; j < particles.length; j++) {
            const a = particles[i],
              b = particles[j];
            let dx = b.x - a.x,
              dy = b.y - a.y;
            if (Math.abs(dx) + Math.abs(dy) < 0.01) {
              dx = 0.1;
              dy = 0.1;
            }
            const distance = Math.hypot(dx, dy),
              repulsion = 4500 / Math.max(25, distance * distance);
            const overlapX =
                (a.width + b.width) / 2 +
                config.settings.nodeGap -
                Math.abs(dx),
              overlapY =
                (a.height + b.height) / 2 +
                config.settings.nodeGap -
                Math.abs(dy);
            let fx = (dx / distance) * repulsion,
              fy = (dy / distance) * repulsion;
            if (overlapX > 0 && overlapY > 0) {
              if (overlapX < overlapY)
                fx += Math.sign(dx || 1) * overlapX * 0.12;
              else fy += Math.sign(dy || 1) * overlapY * 0.12;
            }
            forces[i].x -= fx;
            forces[i].y -= fy;
            forces[j].x += fx;
            forces[j].y += fy;
          }
        const indices = new Map(particles.map((p, i) => [p.key, i]));
        for (const edge of config.edges) {
          const i = indices.get(edge.sourceKey)!,
            j = indices.get(edge.targetKey)!,
            a = particles[i],
            b = particles[j];
          const dx = b.x - a.x,
            dy = b.y - a.y,
            length = Math.hypot(dx, dy) || 1,
            pull = (length - config.settings.linkDistance) * 0.025;
          const x = (dx / length) * pull,
            y = (dy / length) * pull;
          forces[i].x += x;
          forces[i].y += y;
          forces[j].x -= x;
          forces[j].y -= y;
        }
        let movement = 0;
        particles = particles.map((p, i) => {
          const pin = pins.get(p.key);
          if (pin) return { ...p, ...pin, vx: 0, vy: 0 };
          const vx = Math.max(-8, Math.min(8, (p.vx + forces[i].x) * 0.78)),
            vy = Math.max(-8, Math.min(8, (p.vy + forces[i].y) * 0.78));
          movement = Math.max(movement, Math.abs(vx) + Math.abs(vy));
          return {
            ...p,
            vx,
            vy,
            x: Math.max(
              config.bounds.x + p.width / 2,
              Math.min(
                config.bounds.x + config.bounds.width - p.width / 2,
                p.x + vx,
              ),
            ),
            y: Math.max(
              config.bounds.y + p.height / 2,
              Math.min(
                config.bounds.y + config.bounds.height - p.height / 2,
                p.y + vy,
              ),
            ),
          };
        });
        stableSteps = movement < 0.02 ? stableSteps + 1 : 0;
        settled = stableSteps >= 8;
      }
      return read();
    },
    update(nextGraph, nextOptions) {
      const next = configuration(nextGraph, nextOptions); // Validate before changing owned state.
      const old = new Map(particles.map((p) => [p.key, p]));
      config = next;
      particles = seedParticles().map((p) => {
        const previous = old.get(p.key);
        return previous
          ? {
              ...p,
              x: Math.max(
                config.bounds.x + p.width / 2,
                Math.min(
                  config.bounds.x + config.bounds.width - p.width / 2,
                  previous.x,
                ),
              ),
              y: Math.max(
                config.bounds.y + p.height / 2,
                Math.min(
                  config.bounds.y + config.bounds.height - p.height / 2,
                  previous.y,
                ),
              ),
              vx: previous.vx,
              vy: previous.vy,
            }
          : p;
      });
      pins = new Map(
        [...pins].filter(
          ([key]) => old.has(key) && config.nodes.some((n) => n.key === key),
        ),
      );
      iterations = 0;
      stableSteps = 0;
      settled = false;
    },
    restart() {
      iterations = 0;
      stableSteps = 0;
      settled = false;
    },
    reset() {
      pins.clear();
      particles = seedParticles();
      iterations = 0;
      stableSteps = 0;
      settled = false;
    },
    pin(key, position) {
      if (!particles.some((p) => p.key === key))
        throw new Error(`Unknown force node ${key}.`);
      if (!Number.isFinite(position.x) || !Number.isFinite(position.y))
        throw new RangeError("Pin coordinates must be finite.");
      pins.set(key, { ...position });
      particles = particles.map((p) =>
        p.key === key ? { ...p, ...position, vx: 0, vy: 0 } : p,
      );
      settled = false;
      stableSteps = 0;
    },
    release(key) {
      if (!particles.some((p) => p.key === key))
        throw new Error(`Unknown force node ${key}.`);
      pins.delete(key);
      settled = false;
      stableSteps = 0;
    },
  };
}
/**
 * Solve a seeded force layout synchronously, bounded by maxIterations. No timers or resources are allocated.
 * @param graph - Original node and edge records. See {@link GraphData}.
 * @param options - Accessors, finite bounds and numeric settings. See {@link ForceOptions}.
 * @returns A bounded result which may remain unsettled on exhaustion. See {@link ForceLayout}.
 */
export function layoutForceNetwork<N, E>(
  graph: GraphData<N, E>,
  options: ForceOptions<N, E>,
): ForceLayout<N, E> {
  const session = createForceSimulation(graph, options);
  return session.step({ iterations: options.simulation?.maxIterations ?? 300 });
}

// Interpolate immutable presentation geometry between fixed-rate solver snapshots.
// The numeric solver stays deterministic while 120/144 Hz displays get fresh poses.
function interpolateForceLayout<N, E>(
  previous: ForceLayout<N, E>,
  current: ForceLayout<N, E>,
  amount: number,
): ForceLayout<N, E> {
  if (previous === current) return current;
  if (amount === 0)
    return { ...current, nodes: previous.nodes, edges: previous.edges };
  const numbers = <T extends object>(a: T, b: T): T => {
    const result = { ...b };
    for (const key in b) {
      const before = a[key],
        after = b[key];
      if (typeof before === "number" && typeof after === "number")
        result[key] = (before + (after - before) * amount) as T[typeof key];
    }
    return result;
  };
  const rotation = (a: number, b: number) => a + (b - a) * amount;
  const oldNodes = new Map(previous.nodes.map((node) => [node.key, node]));
  const oldEdges = new Map(previous.edges.map((edge) => [edge.key, edge]));
  return {
    ...current,
    nodes: current.nodes.map((node) => {
      const old = oldNodes.get(node.key);
      if (!old) return node;
      return {
        ...node,
        bounds: numbers(old.bounds, node.bounds),
        label: {
          ...node.label,
          bounds: numbers(old.label.bounds, node.label.bounds),
          rotationDegrees: rotation(
            old.label.rotationDegrees,
            node.label.rotationDegrees,
          ),
        },
        detail:
          old.detail && node.detail
            ? {
                ...node.detail,
                bounds: numbers(old.detail.bounds, node.detail.bounds),
                rotationDegrees: rotation(
                  old.detail.rotationDegrees,
                  node.detail.rotationDegrees,
                ),
              }
            : node.detail,
      };
    }),
    edges: current.edges.map((edge) => {
      const old = oldEdges.get(edge.key);
      if (!old) return edge;
      const segments = (
        a: typeof edge.route.segments,
        b: typeof edge.route.segments,
      ) =>
        b.map((segment, index) =>
          a[index]?.type === segment.type
            ? numbers(a[index], segment)
            : segment,
        );
      const route = {
        sourceAnchor: numbers(old.route.sourceAnchor, edge.route.sourceAnchor),
        targetAnchor: numbers(old.route.targetAnchor, edge.route.targetAnchor),
        segments: segments(old.route.segments, edge.route.segments),
        arrowSegments:
          old.route.arrowSegments && edge.route.arrowSegments
            ? segments(old.route.arrowSegments, edge.route.arrowSegments)
            : edge.route.arrowSegments,
      };
      return {
        ...edge,
        route,
        path: forcePath(route.segments),
        arrowPath: route.arrowSegments ? forcePath(route.arrowSegments) : null,
      };
    }),
  };
}
function forcePath(segments: Parameters<typeof routePath>[0]): string {
  if (
    segments.length === 2 &&
    segments[0].type === "move" &&
    segments[1].type === "line"
  )
    return `M ${segments[0].x} ${segments[0].y} L ${segments[1].x} ${segments[1].y}`;
  return routePath(segments);
}

/** Own a force session through public stepper, drive, usePlayback and signals.
 * @param graph - Graph input or signal; accessors are snapshotted during component evaluation. See {@link GraphData}.
 * @param options - Geometry and optional resource-free numeric solver factory. See {@link ForceHookOptions}.
 * @returns Readonly snapshots and commands; playback is released on unmount. See {@link ForceNetworkController}.
 */
export function useForceNetwork<N, E>(
  graph: import("@pibbl/core").SignalValue<GraphData<N, E>>,
  options: ForceHookOptions<N, E>,
): ForceNetworkController<N, E> {
  const input = resolveSignalValue(graph);
  // Capture all application callbacks now, outside Advance. The numeric session sees plain admitted values.
  let inputError: Error | null = null;
  let prepared: ReturnType<typeof configuration<N, E>>;
  try {
    prepared = configuration(input, options);
  } catch (error) {
    inputError = error instanceof Error ? error : new Error(String(error));
    prepared = configuration(
      { nodes: [], edges: [] },
      {
        ...options,
        simulation: {},
        bounds: { x: 0, y: 0, width: 0, height: 0 },
      },
    );
  }
  const nodeMetadata = new Map(
    prepared.nodes.map((node) => [node.datum, node]),
  );
  const edgeMetadata = new Map(
    prepared.edges.map((edge) => [edge.datum, edge]),
  );
  const snapshotOptions: ForceOptions<N, E> = {
    bounds: { ...prepared.bounds },
    simulation: { ...prepared.settings },
    directed: prepared.directed,
    nodeKey: (node) => nodeMetadata.get(node)!.key,
    edgeKey: (edge) => edgeMetadata.get(edge)!.key,
    source: (edge) => edgeMetadata.get(edge)!.sourceKey,
    target: (edge) => edgeMetadata.get(edge)!.targetKey,
    nodeSize: (node) => nodeMetadata.get(node)!,
    label: (node) => nodeMetadata.get(node)!.label,
    detail: options.detail
      ? (node) => nodeMetadata.get(node)!.detail!
      : undefined,
  };
  const snapshotGraph = {
    nodes: inputError ? [] : [...input.nodes],
    edges: inputError ? [] : [...input.edges],
  };
  const signature = JSON.stringify([
    prepared.bounds,
    prepared.settings,
    prepared.directed,
    prepared.nodes.map(({ datum: _datum, ...metadata }) => metadata),
    prepared.edges.map(({ datum: _datum, ...metadata }) => metadata),
  ]);
  type Status = "running" | "paused" | "settled" | "exhausted" | "failed";
  type Frame = {
    layout: ForceLayout<N, E>;
    status: Status;
    error: Error | null;
  };
  const owner = useConst(() => {
    const factory = options.createSimulation ?? createForceSimulation;
    const session = factory(snapshotGraph, snapshotOptions);
    const output = signal<Frame>({
      layout: session.read(),
      status: options.initialPaused ? "paused" : "running",
      error: null,
    });
    return {
      factory,
      session,
      previous: output.get().layout,
      current: output.get(),
      phase: 0,
      output,
      disposed: false,
      pending: [] as (() => void)[],
      paused: options.initialPaused ?? false,
      signature,
      graph: snapshotGraph,
      options: snapshotOptions,
    };
  });
  if (
    options.createSimulation !== undefined &&
    options.createSimulation !== owner.factory
  )
    throw new Error(
      "Force createSimulation is fixed for a mounted hook; remount to replace it.",
    );
  const advance = (integrate: boolean): Frame => {
    try {
      const pending = owner.pending.splice(0);
      if (!pending.length && owner.current.status === "failed")
        return owner.current;
      for (const command of pending) command();
      if (pending.length) {
        owner.current = { ...owner.current, layout: owner.session.read() };
        owner.previous = owner.current.layout;
      }
      if (integrate && !owner.paused) {
        owner.previous = owner.current.layout;
        owner.current = {
          ...owner.current,
          layout: owner.session.step({ iterations: 1 }),
        };
      }
      const layout = owner.current.layout;
      const status: Status =
        owner.paused || !layout.bounds.width || !layout.bounds.height
          ? "paused"
          : layout.settled
            ? "settled"
            : layout.iterations >=
                (owner.options.simulation?.maxIterations ?? 300)
              ? "exhausted"
              : "running";
      owner.current = { layout, status, error: null };
    } catch (error) {
      owner.current = {
        layout: owner.output.get().layout,
        status: "failed",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
    return owner.current;
  };
  const program = useConst(() =>
    drive(
      owner.output,
      stepper<Frame, Frame>({
        // Twelve presentation subdivisions divide common 60/120/144/240 Hz displays.
        // This is scheduler sampling, not another animation loop or 720 solver ticks.
        stepMilliseconds: 1000 / 720,
        maxElapsedMilliseconds: 1000 / 30,
        initial: () => {
          owner.phase = 0;
          return advance(false);
        },
        step: () => {
          owner.phase = (owner.phase + 1) % 12;
          return owner.phase === 0 || owner.pending.length
            ? advance(owner.phase === 0)
            : owner.current;
        },
        read: () => {
          const frame = owner.pending.length ? advance(false) : owner.current;
          return frame.status === "running"
            ? {
                ...frame,
                layout: interpolateForceLayout(
                  owner.previous,
                  frame.layout,
                  owner.phase / 12,
                ),
              }
            : frame;
        },
        done: (state) => state.status !== "running",
      }),
    ),
  );
  const playback = usePlayback(program, { autoplay: !options.initialPaused });
  const queue = (command: () => void) => {
    if (owner.disposed) return;
    owner.pending.push(command);
    const status = playback.status.get();
    if (status !== "running" && status !== "scheduled")
      playback.play({ conflict: "replace" });
  };
  useReaction(() => {
    if (inputError) {
      queue(() => {
        throw inputError;
      });
      return;
    }
    if (
      untracked(() => owner.output.get().status) === "failed" ||
      owner.signature !== signature ||
      owner.graph.nodes.some(
        (datum, index) => datum !== snapshotGraph.nodes[index],
      ) ||
      owner.graph.edges.some(
        (datum, index) => datum !== snapshotGraph.edges[index],
      )
    ) {
      queue(() => {
        owner.session.update(snapshotGraph, snapshotOptions);
        owner.graph = snapshotGraph;
        owner.options = snapshotOptions;
        owner.signature = signature;
      });
    }
  }, [signature, inputError?.message, ...input.nodes, ...input.edges]);
  useReaction(
    () => () => {
      owner.disposed = true;
      owner.pending.length = 0;
    },
    [],
  );
  return useConst(() => ({
    layout: computed(() => owner.output.get().layout),
    status: computed(() => owner.output.get().status),
    error: computed(() => owner.output.get().error),
    pause: () =>
      queue(() => {
        owner.paused = true;
      }),
    resume: () =>
      queue(() => {
        owner.paused = false;
      }),
    restart: () =>
      queue(() => {
        owner.session.restart();
        owner.paused = false;
      }),
    reset: () =>
      queue(() => {
        owner.session.reset();
        owner.paused = false;
      }),
    pin: (key: VizKey, point: Point) =>
      queue(() => {
        owner.session.pin(key, point);
        owner.session.restart();
      }),
    release: (key: VizKey) =>
      queue(() => {
        owner.session.release(key);
        owner.session.restart();
      }),
  }));
}
/**
 * Own and render a live force network through the public hook and GraphView; unmount releases playback.
 * @param props - Graph, definite frame, optional solver factory, controlled pause and presentation. See {@link ForceNetworkProps}.
 * @returns A public-hook and public-marks composition. See {@link useForceNetwork}.
 */
export function ForceNetwork<N, E>(props: ForceNetworkProps<N, E>): PibblNode {
  const frame = useGraphFrame(props.style);
  const paused = resolveSignalValue(props.paused) ?? false;
  const network = useForceNetwork(props.graph, {
    ...props,
    bounds: frame.bounds,
    initialPaused: paused,
  });
  useReaction(() => {
    if (paused) network.pause();
    else network.resume();
  }, [paused]);
  return (
    <Group style={frame.groupStyle}>
      <GraphView
        {...props}
        layout={network.layout}
        style={undefined}
        labelStyle={(node) => ({
          textAlign: "center",
          ...resolveSignalValue(
            typeof props.labelStyle === "function"
              ? props.labelStyle(node)
              : props.labelStyle,
          ),
        })}
        nodeStyle={(node) => ({
          cornerRadius: 100,
          ...resolveSignalValue(
            typeof props.nodeStyle === "function"
              ? props.nodeStyle(node)
              : props.nodeStyle,
          ),
        })}
      />
    </Group>
  );
}
