import type { PibblNodeInput } from "@pibbl/core";
import type { PibblPhysicsVector2 } from "../../../2d-geometry.js";
import type {
  PibblPhysicsBodyStateHandler2D,
  PibblPhysicsSolverOptions,
} from "../types.js";

export interface PibblResolvedPhysicsWorld2DProps {
  readonly space?: "root" | "local";
  readonly gravity?: PibblPhysicsVector2;
  readonly fixedStepMilliseconds?: number;
  readonly maxCatchUpSteps?: number;
  readonly interpolation?: "linear" | "none";
  readonly sleeping?: boolean;
  readonly solver?: PibblPhysicsSolverOptions;
  readonly onSleep?: PibblPhysicsBodyStateHandler2D;
  readonly onWake?: PibblPhysicsBodyStateHandler2D;
  readonly onError?: (error: unknown) => void;
  readonly children?: PibblNodeInput;
}
