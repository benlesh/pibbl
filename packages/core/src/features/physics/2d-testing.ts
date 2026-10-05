/**
 * Deterministic test support for public 2D physics compositions.
 *
 * The harness drives Pibbl's existing realm scheduler. `advanceFrames()` advances
 * host frames; a physics world may run zero, one, or several fixed ticks in a
 * host frame according to its public fixed-step configuration.
 */
import { pibbl, type PibblController, type PibblNode } from "@pibbl/core";
import {
  PibblInternalManualSchedulerDriver,
  pibblInternalInstallTestSchedulerDriver,
  pibblInternalSnapshotRealmScheduler,
} from "@pibbl/core/internal";

/**
 * Caller-owned canvas, root factory, and observation callback for deterministic physics testing.
 *
 * @see {@link PibblNode}
 * @see {@link createPhysicsTestHarness2D}
 */
export interface PibblPhysicsTestHarness2DOptions<Observation> {
  /** The caller owns this canvas; disposing the harness never removes it. */
  readonly canvas: HTMLCanvasElement;
  /**
   * Creates a new public Pibbl root for the initial mount and each reset.
   * @returns The Pibbl root tree mounted by the test harness. See {@link PibblNode}.
   */
  readonly root: () => PibblNode;
  /**
   * Reads application state after a frame or action.
   * @returns The semantic state to expose through the harness's observe method.
   */
  readonly observe: () => Observation;
}

/**
 * A disposable test mount with explicit host-frame advancement and public-state observations.
 *
 * @see {@link createPhysicsTestHarness2D}
 */
export interface PibblPhysicsTestHarness2D<Observation> {
  /** Number of host callbacks currently requested by Pibbl (zero or one). */
  readonly pendingFrames: number;
  /**
   * Delivers one already-requested host frame at the current host time.
   * @returns Whether a pending frame was flushed.
   */
  flush(): boolean;
  /**
   * Advances up to `count` requested host frames by `milliseconds` each.
   * This advances the host clock, not a guaranteed count of physics fixed ticks.
   * @param count - Number of frames to advance.
   * @param milliseconds - Duration of each frame in milliseconds.
   * @returns The number of frames advanced.
   */
  advanceFrames(count: number, milliseconds?: number): number;
  /**
   * Runs an application action and delivers one resulting frame at the current time.
   * @param callback - Action to run within the harness's deterministic scheduling context.
   * @returns The action's return value.
   */
  act<Result>(callback: () => Result): Result;
  /**
   * Reads the caller-provided public observation without scheduling work.
   * @returns The current observation from the configured observer.
   */
  observe(): Observation;
  /** Disposes the mounted root and mounts a new one without moving host time backward. */
  reset(): void;
  /** Disposes the root and restores the previous realm scheduler driver. */
  dispose(): void;
}

const DEFAULT_FRAME_MILLISECONDS = 1000 / 60;

/**
 * Creates an isolated manual-clock test mount for one Pibbl 2D physics composition.
 *
 * It refuses a realm with an existing root because a Pibbl realm deliberately has
 * one scheduler. Use ordinary browser tests when a test needs multiple roots.
 *
 * @param options - Caller-owned canvas, root factory, and semantic state observer. See
 * {@link PibblPhysicsTestHarness2DOptions} .
 * @returns A harness owning the test mount and scheduler lifetime; dispose it after use. See
 * {@link PibblPhysicsTestHarness2D} .
 *
 * @see {@link PibblPhysicsTestHarness2DOptions}
 * @see {@link PibblPhysicsTestHarness2D}
 */
export function createPhysicsTestHarness2D<Observation>(
  options: PibblPhysicsTestHarness2DOptions<Observation>,
): PibblPhysicsTestHarness2D<Observation> {
  const before = pibblInternalSnapshotRealmScheduler();
  if (before.registeredRoots !== 0) {
    throw new Error(
      "createPhysicsTestHarness2D() requires an isolated Pibbl realm; dispose existing Pibbl roots before creating the harness.",
    );
  }
  if (before.phase !== "idle" || before.pendingHostFrames !== 0) {
    throw new Error(
      "createPhysicsTestHarness2D() cannot replace the Pibbl clock while realm work is active.",
    );
  }

  const driver = new PibblInternalManualSchedulerDriver();
  let restoreDriver: (() => void) | undefined;
  let controller: PibblController | undefined;
  let disposed = false;
  let hostTime = 0;

  try {
    restoreDriver = pibblInternalInstallTestSchedulerDriver(driver);
    controller = mountRoot(options);
  } catch (error) {
    try {
      controller?.dispose();
    } finally {
      controller = undefined;
      restoreSchedulerDriver();
    }
    throw error;
  }

  const requireLive = (): void => {
    if (disposed) {
      throw new Error("This Pibbl physics 2D test harness has been disposed.");
    }
  };
  const flush = (): boolean => {
    requireLive();
    if (driver.pendingHostFrames === 0) return false;
    driver.flush(hostTime);
    return true;
  };

  return Object.freeze({
    get pendingFrames(): number {
      return driver.pendingHostFrames;
    },
    flush,
    advanceFrames(
      count: number,
      milliseconds = DEFAULT_FRAME_MILLISECONDS,
    ): number {
      requireLive();
      requireFrameCount(count);
      requireMilliseconds(milliseconds);
      let advanced = 0;
      for (let index = 0; index < count; index++) {
        if (driver.pendingHostFrames === 0) break;
        const nextHostTime = hostTime + milliseconds;
        if (!Number.isFinite(nextHostTime)) {
          throw new RangeError(
            "advanceFrames() cannot advance the host clock beyond a finite time.",
          );
        }
        hostTime = nextHostTime;
        driver.flush(hostTime);
        advanced++;
      }
      return advanced;
    },
    act<Result>(callback: () => Result): Result {
      requireLive();
      const result = callback();
      flush();
      return result;
    },
    observe(): Observation {
      requireLive();
      return options.observe();
    },
    reset(): void {
      requireLive();
      const previousController = controller;
      controller = undefined;
      try {
        previousController?.dispose();
        controller = mountRoot(options);
      } catch (error) {
        disposed = true;
        try {
          restoreSchedulerDriver();
        } catch (restoreError) {
          throw new AggregateError(
            [error, restoreError],
            "Pibbl physics 2D test harness reset failed and could not restore the scheduler driver.",
            { cause: restoreError },
          );
        }
        throw error;
      }
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      const currentController = controller;
      controller = undefined;
      try {
        currentController?.dispose();
      } finally {
        restoreSchedulerDriver();
      }
    },
  });

  function restoreSchedulerDriver(): void {
    const restore = restoreDriver;
    restoreDriver = undefined;
    restore?.();
  }
}

function mountRoot<Observation>(
  options: PibblPhysicsTestHarness2DOptions<Observation>,
): PibblController {
  return pibbl(options.canvas, options.root());
}

function requireFrameCount(count: number): void {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError(
      "advanceFrames(count) requires a non-negative safe integer.",
    );
  }
}

function requireMilliseconds(milliseconds: number): void {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    throw new RangeError(
      "advanceFrames(milliseconds) requires a finite non-negative number.",
    );
  }
}
