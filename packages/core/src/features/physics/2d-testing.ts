/**
 * Deterministic test support for public 2D physics compositions.
 *
 * The harness drives CRC's existing realm scheduler. `advanceFrames()` advances
 * host frames; a physics world may run zero, one, or several fixed ticks in a
 * host frame according to its public fixed-step configuration.
 */
import { crc, type CRCController, type CRCNode } from "@crc/core";
import {
  CRCInternalManualSchedulerDriver,
  crcInternalInstallTestSchedulerDriver,
  crcInternalSnapshotRealmScheduler,
} from "@crc/core/internal";

export interface CRCPhysicsTestHarness2DOptions<Observation> {
  /** The caller owns this canvas; disposing the harness never removes it. */
  readonly canvas: HTMLCanvasElement;
  /** Creates a new public CRC root for the initial mount and each reset. */
  readonly root: () => CRCNode;
  /** Reads application state after a frame or action. */
  readonly observe: () => Observation;
}

export interface CRCPhysicsTestHarness2D<Observation> {
  /** Number of host callbacks currently requested by CRC (zero or one). */
  readonly pendingFrames: number;
  /** Delivers one already-requested host frame at the current host time. */
  flush(): boolean;
  /**
   * Advances up to `count` requested host frames by `milliseconds` each.
   * This advances the host clock, not a guaranteed count of physics fixed ticks.
   */
  advanceFrames(count: number, milliseconds?: number): number;
  /** Runs an application action and delivers one resulting frame at the current time. */
  act<Result>(callback: () => Result): Result;
  /** Reads the caller-provided public observation without scheduling work. */
  observe(): Observation;
  /** Disposes the mounted root and mounts a new one without moving host time backward. */
  reset(): void;
  /** Disposes the root and restores the previous realm scheduler driver. */
  dispose(): void;
}

const DEFAULT_FRAME_MILLISECONDS = 1000 / 60;

/**
 * Creates an isolated manual-clock test mount for one CRC 2D physics composition.
 *
 * It refuses a realm with an existing root because a CRC realm deliberately has
 * one scheduler. Use ordinary browser tests when a test needs multiple roots.
 */
export function createPhysicsTestHarness2D<Observation>(
  options: CRCPhysicsTestHarness2DOptions<Observation>,
): CRCPhysicsTestHarness2D<Observation> {
  const before = crcInternalSnapshotRealmScheduler();
  if (before.registeredRoots !== 0) {
    throw new Error(
      "createPhysicsTestHarness2D() requires an isolated CRC realm; dispose existing CRC roots before creating the harness.",
    );
  }
  if (before.phase !== "idle" || before.pendingHostFrames !== 0) {
    throw new Error(
      "createPhysicsTestHarness2D() cannot replace the CRC clock while realm work is active.",
    );
  }

  const driver = new CRCInternalManualSchedulerDriver();
  let restoreDriver: (() => void) | undefined;
  let controller: CRCController | undefined;
  let disposed = false;
  let hostTime = 0;

  try {
    restoreDriver = crcInternalInstallTestSchedulerDriver(driver);
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
      throw new Error("This CRC physics 2D test harness has been disposed.");
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
            "CRC physics 2D test harness reset failed and could not restore the scheduler driver.",
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
  options: CRCPhysicsTestHarness2DOptions<Observation>,
): CRCController {
  return crc(options.canvas, options.root());
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
