import type { CRCNodeInput } from "@crc/core";
import type { CRCPhysicsVector2 } from "../../../2d-geometry.js";
import type {
  CRCPhysicsBodyStateHandler2D,
  CRCPhysicsSolverOptions,
} from "../types.js";

export interface CRCResolvedPhysicsWorld2DProps {
  readonly gravity?: CRCPhysicsVector2;
  readonly fixedStepMilliseconds?: number;
  readonly maxCatchUpSteps?: number;
  readonly interpolation?: "linear" | "none";
  readonly sleeping?: boolean;
  readonly solver?: CRCPhysicsSolverOptions;
  readonly onSleep?: CRCPhysicsBodyStateHandler2D;
  readonly onWake?: CRCPhysicsBodyStateHandler2D;
  readonly onError?: (error: unknown) => void;
  readonly children?: CRCNodeInput;
}
