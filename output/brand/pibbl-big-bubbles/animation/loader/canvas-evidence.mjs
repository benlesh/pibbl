// Private browser evidence, deliberately outside product catalogs.
import { createElement, pibbl, definePrimitive } from "@pibbl/core";
import {
  PibblLogoFrame,
  applyPose,
  mountLogoLoader,
} from "./canvas-loader.mjs";
import { loopFrame, finishRun, stillFrame } from "./canvas-score.mjs";
import { worldPoint, checkpoints } from "./motion.mjs";
import { svg } from "./svg.mjs";
const assert = (ok, message) => {
  if (!ok) throw new Error(message);
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const canvas = () => {
  const c = document.createElement("canvas");
  c.style.cssText = "width:640px;height:450px";
  document.body.append(c);
  return c;
};
export async function evidence() {
  const c = canvas();
  let root;
  const pose = { x: 213, y: 137, rotation: 37, sx: 0.76, sy: 1.24 };
  let points;
  const Probe = definePrimitive((_props, _style, ctx) => {
    ctx.save();
    try {
      applyPose(ctx, pose);
      const m = ctx.getTransform();
      points = [
        [17, 39],
        [-124, 140],
        [100, 70],
      ].map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
    } finally {
      ctx.restore();
    }
  });
  root = pibbl(c, createElement(Probe), {
    viewport: { width: 640, height: 450 },
    pixelRatio: 1,
  });
  await wait(40);
  [
    [17, 39],
    [-124, 140],
    [100, 70],
  ].forEach((q, i) =>
    worldPoint(pose, q).forEach((v, k) =>
      assert(
        Math.abs(points[i][k] - v) < 1e-5,
        "T × S × R equivalence " +
          JSON.stringify({
            points,
            expected: worldPoint(pose, q),
            size: [c.width, c.height, c.getBoundingClientRect().width],
          }),
      ),
    ),
  );
  root.dispose();
  // Violet hole over green proves earlier paint survives; move green away to
  // prove alpha survives too, rather than substituting a background-colored disc.
  const frame = stillFrame();
  frame.poses[1] = { x: 350, y: 175, rotation: 0, sx: 1, sy: 1 };
  root = pibbl(c, createElement(PibblLogoFrame, { frame }), {
    viewport: { width: 640, height: 450 },
    pixelRatio: 1,
  });
  await wait(40);
  let pixel = c.getContext("2d").getImageData(383, 201, 1, 1).data;
  assert(
    pixel[0] === 21 && pixel[1] === 148 && pixel[2] === 71 && pixel[3] === 255,
    "cutout preserves green underneath",
  );
  frame.poses[1] = { x: 0, y: 0, rotation: 0, sx: 1, sy: 1 };
  pibbl(c, createElement(PibblLogoFrame, { frame }));
  await wait(40);
  pixel = c.getContext("2d").getImageData(383, 201, 1, 1).data;
  assert(pixel[3] === 0, "cutout preserves transparent background");
  root.dispose();
  // Raster comparison uses the exact SVG renderer and rejects differences in
  // solid interiors; only browser antialiasing at silhouette edges may differ.
  const times = [
    0, 400, 800, 1200, 1800, 2150, 2500, 2850, 3200, 3650, 3900, 4200, 4500,
    4800, 5100, 5350, 5600, 5900, 6250, 6800, 7000, 7200, 7300, 7500, 7800,
    8000, 8550, 9100, 9300, 9500, 10100, 10700, 11000,
  ];
  const frames = times.map(loopFrame);
  for (const checkpoint of checkpoints) {
    const run = finishRun(checkpoint * 11000 - 1);
    for (const fraction of [0, 0.25, 0.5, 0.75, 1])
      frames.push(run.sample(run.duration * fraction));
  }
  frames.push(stillFrame());
  let maxChanged = 0,
    maxInterior = 0;
  const reference = document.createElement("canvas");
  reference.width = 640;
  reference.height = 450;
  const rc = reference.getContext("2d");
  for (const frame of frames) {
    root = pibbl(c, createElement(PibblLogoFrame, { frame }), {
      viewport: { width: 640, height: 450 },
      pixelRatio: 1,
    });
    await wait(20);
    const image = new Image();
    image.src =
      "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg(frame));
    await image.decode();
    rc.clearRect(0, 0, 640, 450);
    rc.drawImage(image, 0, 0);
    const a = c.getContext("2d").getImageData(0, 0, 640, 450).data,
      b = rc.getImageData(0, 0, 640, 450).data;
    let changed = 0,
      interior = 0;
    for (let k = 0; k < a.length; k += 4) {
      if ([0, 1, 2, 3].some((j) => Math.abs(a[k + j] - b[k + j]) > 8))
        changed++;
      if (
        a[k + 3] === 255 &&
        b[k + 3] === 255 &&
        [0, 1, 2].some((j) => Math.abs(a[k + j] - b[k + j]) > 8)
      )
        interior++;
    }
    maxChanged = Math.max(maxChanged, changed);
    maxInterior = Math.max(maxInterior, interior);
    root.dispose();
  }
  assert(maxChanged < 2000, "raster mismatch exceeds edge tolerance");
  assert(maxInterior < 40, "solid color mismatch");
  const nativeMatchMedia = window.matchMedia,
    nativeResizeObserver = window.ResizeObserver;
  const listeners = new Set(),
    observers = new Set();
  window.matchMedia = (query) => {
    const media = nativeMatchMedia.call(window, query);
    const add = media.addEventListener.bind(media),
      remove = media.removeEventListener.bind(media);
    media.addEventListener = (name, callback, ...rest) => {
      listeners.add(callback);
      add(name, callback, ...rest);
    };
    media.removeEventListener = (name, callback, ...rest) => {
      listeners.delete(callback);
      remove(name, callback, ...rest);
    };
    return media;
  };
  window.ResizeObserver = class extends nativeResizeObserver {
    observe(target, options) {
      observers.add(this);
      super.observe(target, options);
    }
    disconnect() {
      observers.delete(this);
      super.disconnect();
    }
  };
  const a = canvas(),
    b = canvas();
  let completions = 0;
  const first = mountLogoLoader(a, {
      reducedMotion: false,
      onComplete: () => completions++,
    }),
    second = mountLogoLoader(b, { reducedMotion: false });
  await wait(70);
  first.pause();
  first.seek(2400);
  await wait(50);
  const held = JSON.stringify(first.frame);
  const secondTime = second.time;
  await wait(90);
  assert(JSON.stringify(first.frame) === held, "pause holds exact pose");
  assert(second.time > secondTime, "instances advance independently");
  first.complete();
  first.complete();
  await wait(60);
  assert(
    first.phase === "loading" || first.phase === "forming",
    "Ready resumes paused loader",
  );
  first.pause();
  await wait(40);
  const pausedFinish = first.time;
  first.complete();
  await wait(50);
  assert(first.time > pausedFinish, "repeated Ready resumes paused finish");
  first.pause();
  first.seek(1e4);
  await wait(60);
  assert(
    first.phase === "complete" && completions === 1,
    "Ready ends and notifies once",
  );
  first.complete();
  await wait(20);
  assert(completions === 1, "idempotent completion");
  first.restart();
  await wait(60);
  assert(first.phase === "loading", "restart clears completed state");
  first.pause();
  await wait(40);
  first.resume();
  const resumed = first.time;
  await wait(60);
  assert(first.time > resumed, "resume advances");
  first.complete();
  first.dispose();
  first.dispose();
  const disposedTime = first.time;
  await wait(80);
  assert(
    first.time === disposedTime && completions === 1,
    "disposal suppresses pending completion and time",
  );
  const secondBefore = second.time;
  await wait(70);
  assert(second.time > secondBefore, "disposing one leaves another alive");
  second.dispose();
  let stillNotifications = 0;
  const reduced = mountLogoLoader(b, {
    reducedMotion: true,
    onComplete: () => stillNotifications++,
  });
  await wait(40);
  assert(
    reduced.phase === "complete" &&
      reduced.time === 0 &&
      stillNotifications === 0,
    "reduced motion still without autoplay or unsolicited completion",
  );
  reduced.complete();
  reduced.complete();
  await wait(20);
  assert(stillNotifications === 1, "reduced completion notifies once");
  reduced.restart();
  reduced.complete();
  await wait(20);
  assert(stillNotifications === 2, "reduced restart allows next completion");
  reduced.dispose();
  const tracked = mountLogoLoader(b);
  await wait(40);
  tracked.dispose();
  assert(
    listeners.size === 0 && observers.size === 0,
    "all media listeners and ResizeObservers released",
  );
  window.matchMedia = nativeMatchMedia;
  window.ResizeObserver = nativeResizeObserver;
  c.remove();
  a.remove();
  b.remove();
  return {
    frames: frames.length,
    maxChanged,
    maxInterior,
    checks:
      "transform, violet-only clip, controls, independent instances, teardown, reduced motion",
  };
}
