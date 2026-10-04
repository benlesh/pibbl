// Private test entry: deliberately absent from package exports.
import { getEngine } from "./lib/engine.js";
export async function nativeResources() {
  const engine = await getEngine();
  return {
    fonts: engine._crc_live_fonts(),
    results: engine._crc_live_results(),
    allocatedBytes: engine._crc_heap_used(),
    capacityBytes: engine.HEAPU8.byteLength,
  };
}
export { inkBounds } from "./lib/bounds.js";

export async function failNextDrawAfter(commands: number): Promise<void> {
  if (!Number.isInteger(commands) || commands < 0 || commands > 1000000)
    throw new RangeError("Invalid fault position.");
  (await getEngine())._crc_test_fail_draw_after(commands);
}

import { createTextGeometry } from "./index.js";
import { profileConversion } from "./lib/profiling.js";
export function profileTextGeometry(
  ...args: Parameters<typeof createTextGeometry>
) {
  return profileConversion(() => createTextGeometry(...args));
}

export async function failNextSetupAllocation(
  phase: "buffer" | "draw",
): Promise<void> {
  if (phase !== "buffer" && phase !== "draw")
    throw new TypeError("Invalid setup fault phase.");
  (await getEngine())._crc_test_fail_setup(phase === "buffer" ? 1 : 2);
}
