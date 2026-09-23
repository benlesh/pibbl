export const GEOMETRY_EPSILON = 1e-9;
export const CONTACT_SLOP = 0.005;
export const MAX_POSITION_CORRECTION = 0.2;
export const RESTITUTION_VELOCITY_THRESHOLD = 1;
export const SLEEP_LINEAR_SPEED = 0.05;
export const SLEEP_ANGULAR_SPEED_DEGREES = 0.5;
export const SLEEP_DURATION_SECONDS = 0.5;
export const FAT_AABB_MARGIN = 0.1;
export const MAX_GJK_ITERATIONS = 24;
export const MAX_EPA_ITERATIONS = 32;
export const MAX_CCD_IMPACTS_PER_TICK = 4;

export const DEGREES_TO_RADIANS = Math.PI / 180;
export const RADIANS_TO_DEGREES = 180 / Math.PI;

export const DEFAULT_GRAVITY = Object.freeze([0, 0] as const);
export const DEFAULT_FIXED_STEP_MILLISECONDS = 1000 / 60;
export const DEFAULT_MAX_CATCH_UP_STEPS = 4;
export const DEFAULT_INTERPOLATION = 'linear' as const;
export const DEFAULT_SLEEPING = true;
export const DEFAULT_VELOCITY_ITERATIONS = 8;
export const DEFAULT_POSITION_ITERATIONS = 3;

export const MIN_SOLVER_ITERATIONS = 1;
export const MAX_SOLVER_ITERATIONS = 32;
export const MIN_CATCH_UP_STEPS = 1;
export const MAX_CATCH_UP_STEPS = 16;
