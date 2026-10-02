// Private, opt-in instrumentation. Ordinary conversions do not read a clock.
export interface TextTimings {
  inputMs: number;
  nativeSetupMs: number;
  shapingMs: number;
  outlineMs: number;
  bufferViewsMs: number;
  materializationMs: number;
  boundsMs: number;
  totalMs: number;
}
export let activeProfile: TextTimings | undefined;
export function profileConversion<T>(convert: () => T): {
  result: T;
  timings: TextTimings;
} {
  if (activeProfile) throw new Error("Nested text profiling is unsupported.");
  const timings: TextTimings = {
    inputMs: 0,
    nativeSetupMs: 0,
    shapingMs: 0,
    outlineMs: 0,
    bufferViewsMs: 0,
    materializationMs: 0,
    boundsMs: 0,
    totalMs: 0,
  };
  activeProfile = timings;
  const start = performance.now();
  try {
    return { result: convert(), timings };
  } finally {
    timings.totalMs = performance.now() - start;
    activeProfile = undefined;
  }
}
