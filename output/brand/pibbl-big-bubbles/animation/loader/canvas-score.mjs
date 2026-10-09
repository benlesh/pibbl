import { Playback, timings } from "./playback.mjs";
import { checkpoints } from "./motion.mjs";
export function loopFrame(time) {
  const p = new Playback();
  p.advance(time % timings.loop);
  return p.frame();
}
export function stillFrame() {
  const p = new Playback();
  p.showStill();
  return p.frame();
}
export function finishRun(time) {
  time = ((time % timings.loop) + timings.loop) % timings.loop;
  const checkpoint =
    checkpoints.find((v) => v > time / timings.loop + 1e-8) ?? 1;
  const duration = checkpoint * timings.loop - time + timings.settle + 690;
  return {
    duration,
    sample(elapsed) {
      if (elapsed >= duration) return stillFrame();
      const p = new Playback();
      p.advance(time);
      p.complete();
      p.advance(elapsed);
      return p.frame();
    },
  };
}
