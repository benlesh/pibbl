import {
  createElement,
  definePrimitive,
  defineAnimation,
  drive,
  repeat,
  signal,
  pibbl,
  usePlayback,
  useReaction,
} from "@pibbl/core";
import { identity } from "./identity.mjs";
import { loopFrame, finishRun, stillFrame } from "./canvas-score.mjs";

// Explicit Canvas postmultiplication: T × S × R, before path normalization.
export function applyPose(context, pose) {
  context.translate(pose.x, pose.y);
  context.scale(pose.sx ?? 1, pose.sy ?? 1);
  context.rotate((pose.rotation * Math.PI) / 180);
}
export const PibblLogoFrame = definePrimitive(function renderPibblLogoFrame(
  { frame },
  _style,
  ctx,
) {
  identity.icon.forEach((piece, i) => {
    ctx.save();
    try {
      applyPose(ctx, frame.poses[i]);
      ctx.translate(i === 2 ? -128 : 0, i === 1 ? -140 : 0);
      if (i === 2) {
        // Clip a rectangle with holes, then fill the bowl normally. Unlike XOR
        // filling bowl+circles, this cannot paint the part of a hole outside violet.
        const clip = new Path2D();
        clip.rect(128, 0, 130, 145);
        identity.cutouts.forEach((c, j) => {
          const r = frame.bubbles[j].cutout;
          if (r > 0) {
            clip.moveTo(c.x + r, c.y);
            clip.arc(c.x, c.y, r, 0, Math.PI * 2);
          }
        });
        ctx.clip(clip, "evenodd");
      }
      ctx.fillStyle = identity.palette[piece.color];
      ctx.fill(new Path2D(piece.d));
    } finally {
      ctx.restore();
    }
  });
  ctx.save();
  try {
    const alpha = ctx.globalAlpha;
    ctx.translate(200, 110);
    for (const b of frame.bubbles) {
      if (b.opacity <= 0 || b.r <= 0) continue;
      ctx.globalAlpha = alpha * b.opacity;
      ctx.fillStyle = b.fill;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
  } finally {
    ctx.restore();
  }
});

/** One controller per mounted component. No host animation clock. */
export function createLogoLoader({
  reducedMotion = false,
  onComplete,
  onFrame,
} = {}) {
  const frame = signal(reducedMotion ? stillFrame() : loopFrame(0));
  const makeLoop = () =>
    repeat(
      drive(
        frame,
        defineAnimation({
          duration: 11000,
          sample: ({ localTime }) => loopFrame(localTime),
        }),
      ),
      { iterations: Infinity },
    );
  const program = signal(makeLoop());
  let player,
    requested = false,
    notified = false,
    disposed = false,
    mounted = false,
    generation = 0,
    pendingTime;
  const notify = () => {
    if (!disposed && requested && !notified) {
      notified = true;
      onComplete?.();
    }
  };
  const replace = (next) => {
    pendingTime = 0;
    program.set(next);
  };
  const controls = {
    get frame() {
      return frame.get();
    },
    get phase() {
      return frame.get().phase;
    },
    get time() {
      return pendingTime ?? player?.currentTime.get() ?? 0;
    },
    complete() {
      if (disposed) return;
      if (requested) {
        player?.resume();
        return;
      }
      requested = true;
      if (reducedMotion) {
        const run = generation;
        queueMicrotask(() => {
          if (run === generation) notify();
        });
        return;
      }
      const run = finishRun(controls.time);
      replace(
        drive(
          frame,
          defineAnimation({
            duration: run.duration,
            sample: ({ localTime }) => run.sample(localTime),
          }),
        ),
      );
    },
    pause() {
      if (!disposed) player?.pause();
    },
    resume() {
      if (!disposed) player?.resume();
    },
    restart() {
      if (disposed) return;
      requested = false;
      notified = false;
      generation++;
      if (reducedMotion) return;
      replace(makeLoop());
    },
    seek(milliseconds) {
      if (!Number.isFinite(milliseconds) || milliseconds < 0)
        throw new RangeError("Seek requires nonnegative finite milliseconds.");
      if (!disposed && !reducedMotion) player?.seek(milliseconds);
    },
  };
  function LogoLoader() {
    const candidate = program.get();
    player = usePlayback(candidate, {
      onEvent: (event) => {
        if (event.type === "finish") notify();
      },
    });
    useReaction(() => {
      if (mounted)
        throw new Error(
          "Use a separate logo controller for each mounted instance.",
        );
      mounted = true;
      return () => {
        mounted = false;
        disposed = true;
      };
    }, []);
    useReaction(() => {
      pendingTime = undefined;
      if (!reducedMotion) player.play({ conflict: "replace" });
    }, [candidate]);
    useReaction(() => {
      const value = frame.get();
      onFrame?.(value);
      if (value.phase === "complete" && requested) {
        const run = generation;
        queueMicrotask(() => {
          if (run === generation) notify();
        });
      }
    });
    return createElement(PibblLogoFrame, {
      frame: frame.get(),
      pointerEvents: "none",
    });
  }
  return { Component: LogoLoader, controls };
}

/** Responsive 640×450 mount; owns preference listener and root teardown. */
export function mountLogoLoader(canvas, options = {}) {
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let root,
    loader,
    disposed = false,
    requested = false,
    notified = false;
  const mount = () => {
    loader = createLogoLoader({
      ...options,
      onComplete: () => {
        if (!disposed && !notified) {
          notified = true;
          options.onComplete?.();
        }
      },
      reducedMotion: options.reducedMotion ?? media.matches,
    });
    root = pibbl(canvas, createElement(loader.Component), {
      viewport: { width: 640, height: 450 },
      pixelRatio: options.pixelRatio ?? "device",
    });
  };
  mount();
  const change = () => {
    root.dispose();
    mount();
    if (requested) loader.controls.complete();
  };
  if (options.reducedMotion === undefined)
    media.addEventListener("change", change);
  return {
    get phase() {
      return loader.controls.phase;
    },
    get frame() {
      return loader.controls.frame;
    },
    get time() {
      return loader.controls.time;
    },
    complete() {
      if (!disposed) {
        requested = true;
        loader.controls.complete();
      }
    },
    pause() {
      if (!disposed) loader.controls.pause();
    },
    resume() {
      if (!disposed) loader.controls.resume();
    },
    restart() {
      if (!disposed) {
        requested = false;
        notified = false;
        loader.controls.restart();
      }
    },
    seek(time) {
      if (!disposed) loader.controls.seek(time);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      media.removeEventListener("change", change);
      root.dispose();
    },
  };
}
