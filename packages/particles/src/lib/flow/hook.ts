import {
  resolveSignalValue,
  signal,
  type Signal,
  type SignalValue,
} from "@crc/core";
import {
  crcInternalCurrentRenderOwner,
  crcInternalCurrentSimulationOwner,
  crcInternalOnRenderFinish,
  crcInternalQueueSimulationCommitAcknowledgement,
  crcInternalRegisterSimulationAdvance,
  useInternalHookSlot,
  type CRCInternalSimulationOwner,
} from "@crc/core/internal";
import { FlowFieldKernel2D, type FlowSource2D } from "./field.js";

export interface CRCFlowObstacleBatch2D {
  readonly revision: number;
  /** cx, cy, halfWidth, halfHeight, radians, vx, vy, omega, COM x/y. */
  readonly boxes: Float64Array;
}
export interface CRCFlowObstacleSource2D {
  /** Returns committed simulation state. Buffers are borrowed for this call only. */
  read(): CRCFlowObstacleBatch2D;
}
export interface CRCFlowFieldOptions2D {
  readonly bounds: Readonly<{ width: number; height: number }>;
  readonly resolution: readonly [columns: number, rows: number];
  readonly obstacles?: CRCFlowObstacleSource2D;
  readonly buoyancy?: number;
}
declare const flowBrand: unique symbol;
export interface CRCFlowField2D {
  readonly [flowBrand]: true;
  readonly revision: Signal<number>;
  sampleBatch(
    positions: Float32Array,
    velocities: Float32Array,
    count: number,
  ): void;
}
export interface CRCFlowSourceOptions2D {
  readonly position: SignalValue<readonly [number, number]>;
  readonly radius: SignalValue<number>;
  readonly acceleration?: SignalValue<readonly [number, number]>;
  readonly heat?: SignalValue<number>;
  readonly enabled?: SignalValue<boolean>;
}
const controllers = new WeakMap<CRCFlowField2D, FlowController2D>();
const STEP = 1000 / 60;
const EMPTY_BOXES = new Float64Array(0);

/** Private coupling point; ordinary callers see only the read-only field handle. */
export function getFlowController2D(handle: CRCFlowField2D): FlowController2D {
  const controller = controllers.get(handle);
  if (!controller) throw new TypeError("Expected a CRC flow field.");
  controller.requireActive();
  return controller;
}

export class FlowController2D {
  readonly handle: CRCFlowField2D;
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
  private options: CRCFlowFieldOptions2D;
  private consumers = 0;
  constructor(
    private readonly owner: CRCInternalSimulationOwner,
    options: CRCFlowFieldOptions2D,
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
    }) as CRCFlowField2D;
    controllers.set(this.handle, this);
  }
  requireActive(): FlowFieldKernel2D {
    if (!this.committed) throw new Error("CRC flow field is disposed.");
    return this.committed;
  }
  validateOptions(options: CRCFlowFieldOptions2D): void {
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
  adoptOptions(options: CRCFlowFieldOptions2D): void {
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
      this.unregister = crcInternalRegisterSimulationAdvance(
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
          if (
            this.obstacleSourceChanged ||
            nextObstacleRevision !== this.obstacleRevision
          ) {
            candidate.setBoxes(obstacles?.boxes ?? EMPTY_BOXES);
          }
          for (let i = 0; i < steps; i++)
            candidate.advance(
              STEP / 1000,
              this.sourceList,
              this.options.buoyancy ?? -300,
            );
          if (steps > 0 || nextObstacleRevision !== this.obstacleRevision) {
            batch.stage(this.revision, this.revision.get() + 1, this);
          }
          crcInternalQueueSimulationCommitAcknowledgement(
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

export function useFlowField2D(options: CRCFlowFieldOptions2D): CRCFlowField2D {
  const simulationOwner = crcInternalCurrentSimulationOwner();
  const renderOwner = crcInternalCurrentRenderOwner();
  const controller = useInternalHookSlot("flow-field", (teardowns) => {
    const value = new FlowController2D(simulationOwner, options);
    teardowns.add(() => value.dispose());
    return value;
  }).value;
  controller.validateOptions(options);
  crcInternalOnRenderFinish(renderOwner, (success) => {
    if (success) controller.adoptOptions(options);
  });
  return controller.handle;
}

export function useFlowSource2D(
  field: CRCFlowField2D,
  options: CRCFlowSourceOptions2D,
): void {
  const controller = getFlowController2D(field);
  const renderOwner = crcInternalCurrentRenderOwner();
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
  crcInternalOnRenderFinish(renderOwner, (success) => {
    if (!success || revision !== slot.revision) return;
    if (slot.controller !== controller)
      slot.controller.setSource(slot.key, undefined);
    slot.controller = controller;
    controller.setSource(slot.key, source);
  });
}
