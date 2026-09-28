import type { CRCNodeInput } from "@crc/core";
import type { CRCPhysicsVector3 } from "../../../3d-geometry.js";
import type {
  CRCPhysicsBodyStateHandler3D,
  CRCPhysicsSolverOptions,
} from "../types.js";

export interface CRCResolvedPhysicsWorld3DProps {
  readonly gravity?: CRCPhysicsVector3;
  readonly fixedStepMilliseconds?: number;
  readonly maxCatchUpSteps?: number;
  readonly interpolation?: "linear" | "none";
  readonly sleeping?: boolean;
  readonly solver?: CRCPhysicsSolverOptions;
  readonly onSleep?: CRCPhysicsBodyStateHandler3D;
  readonly onWake?: CRCPhysicsBodyStateHandler3D;
  readonly onError?: (error: unknown) => void;
  readonly children?: CRCNodeInput;
}
