export function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b),
    count = sorted.length;
  return {
    count,
    mean: count ? sorted.reduce((a, b) => a + b, 0) / count : 0,
    median: count ? sorted[Math.floor(count / 2)] : 0,
    p95: count ? sorted[Math.ceil(count * 0.95) - 1] : 0,
    max: count ? sorted[count - 1] : 0,
  };
}
export function estimateRecording({
  width,
  height,
  duration,
  fps,
  headroom = 1.15,
}) {
  if (
    ![width, height, duration, fps, headroom].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    duration <= 0 ||
    fps <= 0 ||
    headroom < 1
  )
    throw new RangeError("Invalid recording estimate");
  const frameBytes = width * height * 4,
    expectedFrames = Math.ceil((duration * fps) / 1000),
    frameCapacity = Math.ceil(expectedFrames * headroom),
    pages = Math.ceil((frameBytes * (frameCapacity + 1)) / 65536);
  if (pages > 65536)
    throw new RangeError(
      "Estimated raw recording exceeds this WASM32 recorder; reduce resolution, duration or capture rate.",
    );
  return {
    frameBytes,
    expectedFrames,
    frameCapacity,
    pages,
    allocatedBytes: pages * 65536,
    fps,
    headroom,
  };
}
