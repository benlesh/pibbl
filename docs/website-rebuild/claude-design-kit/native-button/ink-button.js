import {
  pibbl,
  createElement,
  Rectangle,
  signal,
  useLayoutBox,
  useReaction,
} from "@pibbl/core";
import { useTexture, reactionDiffusion } from "@pibbl/core/textures";

// Application integration code, not a Pibbl-exported widget.
export function mountInkButton(button, canvas) {
  const events = new AbortController();
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let visible = true;
  let disposed = false;
  let controller;
  let texture;
  let previousPointer;
  const state = signal({ active: false, pressed: false, paused: true });
  const sync = () => {
    if (disposed) return;
    const disabled = button.matches(":disabled");
    state.set({
      active:
        !disabled &&
        (button.matches(":hover") || document.activeElement === button),
      pressed: !disabled && button.matches(":active"),
      paused: disabled || motion.matches || document.hidden || !visible,
    });
  };
  function Background() {
    const { width, height } = useLayoutBox();
    const ink = useTexture(reactionDiffusion({ seed: 42, preset: "stripes" }), {
      resolution: { width: 128, height: 48 },
      palette: ["#031a22", "#087c80", "#38c8a5", "#a8f5d8"],
    });
    useReaction(() => {
      texture = ink;
      return () => {
        texture = undefined;
      };
    }, [ink]);
    useReaction(() => {
      const current = state.get();
      ink.send({ type: "pause", paused: current.paused });
      if (current.active && !current.paused) {
        ink.send({
          type: "paint",
          u: 0.5,
          v: 0.5,
          radius: current.pressed ? 12 : 6,
          strength: 0.8,
        });
      }
      canvas.dataset.inkState = current.paused ? "paused" : "running";
    });
    return createElement(Rectangle, {
      pointerEvents: "none",
      style: { width, height, fill: ink },
    });
  }
  const attributes = new MutationObserver(sync);
  const canDisturb = () =>
    texture &&
    !disposed &&
    !button.matches(":disabled") &&
    !motion.matches &&
    !document.hidden &&
    visible;
  const point = (event) => {
    const box = button.getBoundingClientRect();
    return {
      u: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)),
      v: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)),
    };
  };
  const stir = (event) => {
    const next = point(event);
    const last = previousPointer;
    previousPointer = next;
    if (!last || !canDisturb()) return;
    // Convert CSS motion to normalized texture displacement, bounded per event.
    texture.send({
      type: "stir",
      ...next,
      du: Math.max(-0.3, Math.min(0.3, (next.u - last.u) * 2.5)),
      dv: Math.max(-0.3, Math.min(0.3, (next.v - last.v) * 2.5)),
      radius: 16,
    });
    texture.send({ type: "paint", ...next, radius: 4, strength: 0.3 });
  };
  const burst = (event) => {
    if (!canDisturb()) return;
    // Keyboard activation has no pointer location; use the center instead.
    const center = event.detail === 0 ? { u: 0.5, v: 0.5 } : point(event);
    for (let i = 0; i < 20; i++) {
      const angle = (i * Math.PI * 2) / 20;
      const x = Math.cos(angle),
        y = Math.sin(angle);
      const position = {
        u: center.u + (x * 12) / 128,
        v: center.v + (y * 12) / 48,
      };
      texture.send({
        type: "stir",
        ...position,
        du: x * 0.15,
        dv: y * 0.3,
        radius: 10,
      });
      texture.send({ type: "paint", ...position, radius: 3, strength: 0.95 });
    }
  };
  const intersection = new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting ?? false;
    sync();
  });
  function dispose() {
    if (disposed) return;
    disposed = true;
    events.abort();
    attributes.disconnect();
    intersection.disconnect();
    controller?.dispose();
    canvas.hidden = true;
    canvas.dataset.inkState = "disposed";
  }
  try {
    button.addEventListener(
      "pointerenter",
      (event) => {
        previousPointer = point(event);
      },
      { signal: events.signal },
    );
    button.addEventListener(
      "pointerleave",
      () => {
        previousPointer = undefined;
      },
      { signal: events.signal },
    );
    button.addEventListener(
      "pointercancel",
      () => {
        previousPointer = undefined;
      },
      { signal: events.signal },
    );
    button.addEventListener("pointermove", stir, { signal: events.signal });
    button.addEventListener("click", burst, { signal: events.signal });
    for (const event of [
      "pointerenter",
      "pointerleave",
      "pointerdown",
      "pointerup",
      "pointercancel",
      "focus",
      "blur",
      "keydown",
      "keyup",
    ]) {
      button.addEventListener(event, sync, { signal: events.signal });
    }
    window.addEventListener("pointerup", sync, { signal: events.signal });
    document.addEventListener("visibilitychange", sync, {
      signal: events.signal,
    });
    motion.addEventListener("change", sync, { signal: events.signal });
    attributes.observe(button, {
      attributes: true,
      attributeFilter: ["disabled"],
    });
    // Disabled fieldsets affect native buttons too.
    for (
      let parent = button.parentElement;
      parent;
      parent = parent.parentElement
    ) {
      if (parent instanceof HTMLFieldSetElement)
        attributes.observe(parent, {
          attributes: true,
          attributeFilter: ["disabled"],
        });
    }
    intersection.observe(button);
    sync();
    canvas.hidden = false;
    controller = pibbl(canvas, createElement(Background, {}), {
      viewport: "responsive",
      pixelRatio: Math.min(devicePixelRatio || 1, 2),
    });
  } catch (error) {
    dispose();
    throw error;
  }
  return { update: sync, dispose };
}
