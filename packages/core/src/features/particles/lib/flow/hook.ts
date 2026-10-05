import type { PibblParticleSystemOptions } from '../types.js';
import {
  resolveSignalValue,
  signal,
  type Signal,
  type SignalValue,
} from "@pibbl/core";
import {
  pibblInternalCurrentRenderOwner,
  pibblInternalCurrentSimulationOwner,
  pibblInternalOnRenderFinish,
  pibblInternalQueueSimulationCommitAcknowledgement,
  pibblInternalRegisterSimulationAdvance,
  useInternalHookSlot,
  type PibblInternalSimulationOwner,
} from "@pibbl/core/internal";
import { FlowFieldKernel2D, type FlowSource2D } from "./field.js";

/**
 * Committed obstacle geometry and motion packed into borrowed numeric buffers.
 *
 * @see {@link PibblFlowObstacleSource2D}
 */
export interface PibblFlowObstacleBatch2D {
  /**
   * Revision used to detect changes to the underlying state or geometry. See
   * {@link PibblFlowObstacleBatch2D}.
   */
  readonly revision: number;
  /** cx, cy, halfWidth, halfHeight, radians, vx, vy, omega, COM x/y. */
  readonly boxes: Float64Array;
  /**
   * Packed ellipse obstacle data consumed by the simulation. See {@link PibblFlowObstacleBatch2D}.
   */
  readonly ellipses?: Float64Array;
  /**
   * Packed polygon obstacle data consumed by the simulation. See {@link PibblFlowObstacleBatch2D}.
   */
  readonly polygons?: Float64Array;
}
/**
 * Supplies committed obstacle batches to a flow field without transferring buffer ownership.
 *
 * @see {@link PibblFlowObstacleBatch2D}
 * @see {@link PibblFlowFieldOptions2D}
 */
export interface PibblFlowObstacleSource2D {
  /**
   * Returns committed simulation state. Buffers are borrowed for this call only.
   * @returns The current obstacle revision and packed obstacle geometry. See
   * {@link PibblFlowObstacleBatch2D} .
   */
  read(): PibblFlowObstacleBatch2D;
}
/**
 * Logical bounds, grid resolution, obstacle source, and buoyancy for a flow field.
 *
 * @see {@link PibblFlowObstacleSource2D}
 * @see {@link useFlowField2D}
 */
export interface PibblFlowFieldOptions2D {
  /** Logical region constraining the content or query. See {@link PibblFlowFieldOptions2D}. */
  readonly bounds: Readonly<{
    /**
     * Horizontal extent in the units of the containing geometry or surface. See
     * {@link PibblFlowFieldOptions2D}.
     */
    width: number;
    /**
     * Vertical extent in the units of the containing geometry or surface. See
     * {@link PibblFlowFieldOptions2D}.
     */
    height: number;
  }>;
  /** Dimensions of the simulation or raster grid. See {@link PibblFlowFieldOptions2D}. */
  readonly resolution: readonly [columns: number, rows: number];
  /**
   * Obstacle geometry used by the flow or water simulation. See {@link PibblFlowObstacleSource2D}.
   */
  readonly obstacles?: PibblFlowObstacleSource2D;
  /** Strength of heat-driven upward motion in the flow field. See {@link PibblFlowFieldOptions2D}. */
  readonly buoyancy?: number;
}
declare const flowBrand: unique symbol;
/**
 * A mount-owned flow field with revision tracking and batched velocity sampling.
 *
 * @see {@link Signal}
 * @see {@link useFlowField2D}
 * @see {@link useFlowSource2D}
 * @see {@link PibblParticleSystemOptions}
 */
export interface PibblFlowField2D {
  readonly [flowBrand]: true;
  /** Revision used to detect changes to the underlying state or geometry. See {@link Signal}. */
  readonly revision: Signal<number>;
  /**
   * Samples velocities for packed position pairs into caller-provided output storage. See
   * {@link PibblFlowField2D}.
   * @param positions - Packed input positions, with two floats per particle.
   * @param velocities - Output buffer receiving sampled velocities, with two floats per particle.
   * @param count - Number of position pairs to sample.
   */
  sampleBatch(positions: Float32Array, velocities: Float32Array, count: number): void;
}
/**
 * Reactive position, radius, acceleration, heat, and enablement of a flow source.
 *
 * @see {@link SignalValue}
 * @see {@link useFlowSource2D}
 */
export interface PibblFlowSourceOptions2D {
  /** Position of the geometry, source, or selected resize handle. See {@link SignalValue}. */
  readonly position: SignalValue<readonly [number, number]>;
  /** Radius in the coordinate system of this geometry or effect. See {@link SignalValue}. */
  readonly radius: SignalValue<number>;
  /** Acceleration injected by this flow source. See {@link SignalValue}. */
  readonly acceleration?: SignalValue<readonly [number, number]>;
  /** Heat injected by this flow source. See {@link SignalValue}. */
  readonly heat?: SignalValue<number>;
  /** Whether this operation or resource participates in updates. See {@link SignalValue}. */
  readonly enabled?: SignalValue<boolean>;
}
const controllers = new WeakMap<PibblFlowField2D, FlowController2D>();
const STEP = 1000 / 60;
const EMPTY_OBSTACLES = Object.freeze({ boxes: new Float64Array(0) });

/** Private coupling point; ordinary callers see only the read-only field handle. */
export function getFlowController2D(handle: PibblFlowField2D): FlowController2D {
  const controller = controllers.get(handle);
  if (!controller) throw new TypeError("Expected a Pibbl flow field.");
  controller.requireActive();
  return controller;
}

export class FlowController2D {
  readonly handle: PibblFlowField2D;
  private committed: FlowFieldKernel2D | undefined;
  private candidate: FlowFieldKernel2D | undefined;
  private readonly revision = signal(0);
  private readonly sources = new Map<object, FlowSource2D>();
  private sourceList: readonly FlowSource2D[] = [];
  private unregister: (() => void) | undefined;
  private lastTime: number | undefined;
  private remainder = 0;
  private obstacleRevision: number | undefined;
  private obstacleSourceChanged = true;
  private options: PibblFlowFieldOptions2D;
  private consumers = 0;
  constructor(
    private readonly owner: PibblInternalSimulationOwner,
    options: PibblFlowFieldOptions2D,
  ) {
    this.options = options;
    const [columns, rows] = options.resolution;
    this.committed = new FlowFieldKernel2D(
      columns,
      rows,
      options.bounds.width,
      options.bounds.height,
    );
    this.candidate = new FlowFieldKernel2D(
      columns,
      rows,
      options.bounds.width,
      options.bounds.height,
    );
    this.handle = Object.freeze({
      revision: this.revision.asReadonly(),
      sampleBatch: (
        positions: Float32Array,
        velocities: Float32Array,
        count: number,
      ) => {
        this.requireActive().sampleBatch(positions, velocities, count);
      },
    }) as PibblFlowField2D;
    controllers.set(this.handle, this);
  }
  requireActive(): FlowFieldKernel2D {
    if (!this.committed) throw new Error("Pibbl flow field is disposed.");
    return this.committed;
  }
  validateOptions(options: PibblFlowFieldOptions2D): void {
    const field = this.requireActive();
    if (
      field.width !== options.bounds.width ||
      field.height !== options.bounds.height ||
      field.columns !== options.resolution[0] ||
      field.rows !== options.resolution[1]
    ) {
      throw new Error(
        "Flow bounds and resolution are mount-only; use a keyed remount to change them.",
      );
    }
    if (!Number.isFinite(options.buoyancy ?? -300))
      throw new RangeError("Flow buoyancy must be finite.");
  }
  adoptOptions(options: PibblFlowFieldOptions2D): void {
    if (!this.committed) return;
    if (this.options.obstacles !== options.obstacles)
      this.obstacleSourceChanged = true;
    this.options = options;
  }
  setSource(key: object, source: FlowSource2D | undefined): void {
    if (!this.committed) return;
    if (source) this.sources.set(key, source);
    else this.sources.delete(key);
    this.sourceList = Array.from(this.sources.values());
    this.synchronize();
  }
  retain(): () => void {
    this.requireActive();
    this.consumers++;
    this.synchronize();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.consumers--;
      this.synchronize();
    };
  }
  private synchronize(): void {
    const active =
      this.committed && (this.sources.size > 0 || this.consumers > 0);
    if (active && !this.unregister) {
      this.unregister = pibblInternalRegisterSimulationAdvance(
        this.owner,
        "physics",
        (frame, batch) => {
          const committed = this.requireActive();
          const candidate = this.candidate!;
          const elapsed =
            this.lastTime === undefined
              ? 0
              : Math.max(0, frame.logicalTime - this.lastTime);
          const accumulated = this.remainder + Math.min(elapsed, STEP * 4);
          const steps = Math.min(4, Math.floor((accumulated + 1e-7) / STEP));
          const remainder = Math.max(0, accumulated - steps * STEP);
          candidate.copyFrom(committed);
          const obstacles = this.options.obstacles?.read();
          const nextObstacleRevision = obstacles?.revision;
          const obstaclesChanged =
            this.obstacleSourceChanged ||
            nextObstacleRevision !== this.obstacleRevision;
          if (obstaclesChanged) {
            candidate.setObstacles(obstacles ?? EMPTY_OBSTACLES);
          }
          for (let i = 0; i < steps; i++)
            candidate.advance(
              STEP / 1000,
              this.sourceList,
              this.options.buoyancy ?? -300,
            );
          if (steps > 0 || obstaclesChanged) {
            batch.stage(this.revision, this.revision.get() + 1, this);
          }
          pibblInternalQueueSimulationCommitAcknowledgement(
            this.owner,
            (_frame, outcome) => {
              if (!outcome.applied || !this.committed) return;
              this.committed = candidate;
              this.candidate = committed;
              this.lastTime = frame.logicalTime;
              this.remainder = remainder;
              this.obstacleRevision = nextObstacleRevision;
              this.obstacleSourceChanged = false;
            },
          );
        },
      );
    } else if (!active && this.unregister) {
      this.unregister();
      this.unregister = undefined;
      this.lastTime = undefined;
    }
  }
  dispose(): void {
    this.unregister?.();
    this.unregister = undefined;
    this.sources.clear();
    this.sourceList = [];
    this.committed = undefined;
    this.candidate = undefined;
  }
}

/**
 * Creates a mount-owned 2D flow field with configured bounds, resolution, and optional obstacles.
 *
 * @param options - Field dimensions, sampling, decay, and obstacle settings. See
 * {@link PibblFlowFieldOptions2D} .
 * @returns A mount-owned 2D flow field sampled by particle effects. See {@link PibblFlowField2D}.
 *
 * @see {@link PibblFlowFieldOptions2D}
 * @see {@link PibblFlowField2D}
 */
export function useFlowField2D(options: PibblFlowFieldOptions2D): PibblFlowField2D {
  const simulationOwner = pibblInternalCurrentSimulationOwner();
  const renderOwner = pibblInternalCurrentRenderOwner();
  const controller = useInternalHookSlot("flow-field", (teardowns) => {
    const value = new FlowController2D(simulationOwner, options);
    teardowns.add(() => value.dispose());
    return value;
  }).value;
  controller.validateOptions(options);
  pibblInternalOnRenderFinish(renderOwner, (success) => {
    if (success) controller.adoptOptions(options);
  });
  return controller.handle;
}

/**
 * Registers a mount-owned source of acceleration or heat in a flow field.
 *
 * @param field - Flow field receiving this source. See {@link PibblFlowField2D}.
 * @param options - Source position, influence, and strength settings. See
 * {@link PibblFlowSourceOptions2D} .
 *
 * @see {@link PibblFlowField2D}
 * @see {@link PibblFlowSourceOptions2D}
 */
export function useFlowSource2D(
  field: PibblFlowField2D,
  options: PibblFlowSourceOptions2D,
): void {
  const controller = getFlowController2D(field);
  const renderOwner = pibblInternalCurrentRenderOwner();
  const position = resolveSignalValue(options.position);
  const radius = resolveSignalValue(options.radius);
  const acceleration = resolveSignalValue(
    options.acceleration ?? ([0, 0] as const),
  );
  const heat = resolveSignalValue(options.heat ?? 0);
  const enabled = resolveSignalValue(options.enabled ?? true);
  if (
    !Number.isFinite(position[0]) ||
    !Number.isFinite(position[1]) ||
    !Number.isFinite(radius) ||
    radius <= 0 ||
    !Number.isFinite(acceleration[0]) ||
    !Number.isFinite(acceleration[1]) ||
    !Number.isFinite(heat) ||
    heat < 0
  ) {
    throw new RangeError(
      "Flow source requires finite values, positive radius and nonnegative heat.",
    );
  }
  const slot = useInternalHookSlot("flow-source", (teardowns) => {
    const value = { key: {}, controller, revision: 0 };
    teardowns.add(() => value.controller.setSource(value.key, undefined));
    return value;
  }).value;
  const revision = ++slot.revision;
  const source: FlowSource2D | undefined = enabled
    ? {
        x: position[0],
        y: position[1],
        radius,
        acceleration: [acceleration[0], acceleration[1]],
        heat,
      }
    : undefined;
  pibblInternalOnRenderFinish(renderOwner, (success) => {
    if (!success || revision !== slot.revision) return;
    if (slot.controller !== controller)
      slot.controller.setSource(slot.key, undefined);
    slot.controller = controller;
    controller.setSource(slot.key, source);
  });
}
