import mount from "../../../../scenarios/src/learning/composition/financial-relative-performance.example.js";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function scene(width = 760, height = 500) {
  const pending = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
    pending.set(++id, cb);
    return id;
  });
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    pending.delete(id);
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, width, height),
  );
  vi.spyOn(canvas, "setPointerCapture").mockImplementation(() => undefined);
  vi.spyOn(canvas, "releasePointerCapture").mockImplementation(() => undefined);
  document.body.append(canvas);
  let labels: string[] = [];
  const ctx = canvas.getContext("2d")!;
  const native = ctx.fillText.bind(ctx);
  vi.spyOn(ctx, "fillText").mockImplementation((text, x, y, maxWidth) => {
    labels.push(String(text));
    const m = ctx.measureText(text),
      t = ctx.getTransform();
    const a = t.transformPoint(
      new DOMPoint(x - m.actualBoundingBoxLeft, y - m.actualBoundingBoxAscent),
    );
    const b = t.transformPoint(
      new DOMPoint(
        x + m.actualBoundingBoxRight,
        y + m.actualBoundingBoxDescent,
      ),
    );
    expect(a.x, String(text)).toBeGreaterThanOrEqual(-1);
    expect(b.x, String(text)).toBeLessThanOrEqual(width + 1);
    expect(a.y, String(text)).toBeGreaterThanOrEqual(-1);
    expect(b.y, String(text)).toBeLessThanOrEqual(height + 1);
    native(text, x, y, maxWidth);
  });
  const controller = mount(canvas);
  let time = performance.now();
  const flush = (elapsed = 40) => {
    time += elapsed;
    const callbacks = [...pending.values()];
    pending.clear();
    if (callbacks.length) labels = [];
    callbacks.forEach((cb) => cb(time));
    return labels;
  };
  const settle = () => {
    for (let frame = 0; frame < 8; frame += 1) flush();
    return labels;
  };
  const click = (x: number, y: number, finish = true) => {
    for (const type of ["mousedown", "mouseup", "click"])
      canvas.dispatchEvent(
        new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }),
      );
    flush();
    return finish ? settle() : labels;
  };
  const key = (key: string) => {
    canvas.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
    );
    return flush();
  };
  const wheel = (
    x: number,
    y: number,
    deltaY: number,
    deltaX = 0,
    shiftKey = false,
  ) => {
    canvas.dispatchEvent(
      new WheelEvent("wheel", {
        clientX: x,
        clientY: y,
        deltaY,
        deltaX,
        shiftKey,
        bubbles: true,
        cancelable: true,
      }),
    );
    flush();
    return settle();
  };
  const pointer = (
    type: string,
    pointerId: number,
    x: number,
    y: number,
    pointerType = "touch",
  ) => {
    canvas.dispatchEvent(
      new PointerEvent(type, {
        pointerId,
        pointerType,
        clientX: x,
        clientY: y,
        buttons: type === "pointerup" || type === "pointercancel" ? 0 : 1,
        bubbles: true,
        cancelable: true,
      }),
    );
    flush();
    return flush(0);
  };
  return {
    canvas,
    flush,
    settle,
    click,
    key,
    wheel,
    pointer,
    controller,
    pending,
  };
}
it("shows a fixed common base, unavailable asset and calendar navigation independent of pinning", () => {
  const s = scene();
  try {
    const initial = s.flush();
    expect(initial).toContain("Relative Performance Desk");
    expect(initial).toContain("Price return (%)");
    expect(initial.some((text) => /Dec|Jan|Feb|Mar/.test(text))).toBe(true);
    expect(initial.some((text) => /^[-+\d].*%$/.test(text))).toBe(true);
    expect(initial.some((text) => text.includes("Base 02 Jan 2026"))).toBe(
      true,
    );
    expect(initial.some((text) => text.includes("Unavailable"))).toBe(true);
    const range = initial.find((text) => text.startsWith("Window "));
    const month = s.click(36, 100);
    expect(month.find((text) => text.startsWith("Window "))).not.toBe(range);
    expect(month.some((text) => text.includes("Base 02 Jan 2026"))).toBe(true);
    expect(s.click(180, 200).some((text) => text.includes("Pinned"))).toBe(
      true,
    );
    expect(s.key("ArrowLeft").some((text) => text.includes("Pinned"))).toBe(
      true,
    );
    expect(s.key("Escape").some((text) => text.includes("Inspect"))).toBe(true);
  } finally {
    s.controller.dispose();
  }
});
it("keeps the comparison readout and controls inside a phone allocation in both palettes", () => {
  const s = scene(360, 260);
  try {
    const initial = s.flush();
    expect(initial.some((text) => text.includes("Base 02 Jan 2026"))).toBe(
      true,
    );
    expect(initial.some((text) => text.includes("Northstar"))).toBe(true);
    expect(s.click(315, 22)).toContain("Light");
    expect(s.key("Enter")).toContain("Dark");
  } finally {
    s.controller.dispose();
  }
});

it("derives active presets from the current range after wheel navigation", () => {
  const s = scene();
  try {
    expect(s.flush().some((text) => text.includes("Preset All"))).toBe(true);
    expect(s.click(36, 100).some((text) => text.includes("Preset 1M"))).toBe(
      true,
    );
    expect(
      s.wheel(340, 230, -120).some((text) => text.includes("Preset custom")),
    ).toBe(true);
    expect(s.click(36, 100).some((text) => text.includes("Preset 1M"))).toBe(
      true,
    );
  } finally {
    s.controller.dispose();
  }
});

it("pans and pinches through captured touch pointers, and cancellation does not suppress a later pin", () => {
  const s = scene();
  try {
    s.flush();
    s.click(36, 100);
    s.pointer("pointerdown", 1, 220, 220);
    expect(
      s
        .pointer("pointermove", 1, 270, 220)
        .some((text) => text.includes("Preset custom")),
    ).toBe(true);
    s.pointer("pointerup", 1, 270, 220);
    s.pointer("pointerdown", 2, 180, 220);
    s.pointer("pointerdown", 3, 280, 220);
    expect(
      s
        .pointer("pointermove", 3, 330, 220)
        .some((text) => text.includes("Preset custom")),
    ).toBe(true);
    s.pointer("pointercancel", 2, 180, 220);
    s.pointer("pointercancel", 3, 330, 220);
    expect(s.click(250, 220).some((text) => text.includes("Pinned"))).toBe(
      true,
    );
  } finally {
    s.controller.dispose();
  }
});

it("owns native touch gestures while mounted and restores the canvas setting on disposal", () => {
  const s = scene();
  s.flush();
  expect(s.canvas.style.touchAction).toBe("none");
  s.controller.dispose();
  expect(s.canvas.style.touchAction).toBe("");
});

it("allows a fresh touch tap after a completed drag without relying on a synthesized click", () => {
  const s = scene();
  try {
    s.flush();
    s.click(36, 100);
    s.pointer("pointerdown", 1, 220, 220);
    s.pointer("pointermove", 1, 270, 220);
    s.pointer("pointerup", 1, 270, 220);
    s.pointer("pointerdown", 2, 240, 220);
    s.pointer("pointerup", 2, 240, 220);
    expect(s.click(250, 220).some((text) => text.includes("Pinned"))).toBe(
      true,
    );
  } finally {
    s.controller.dispose();
  }
});

it("animates a preset and lets touch take over from the displayed window", () => {
  const preference = Object.assign(new EventTarget(), { matches: false });
  vi.spyOn(window, "matchMedia").mockReturnValue(
    preference as unknown as MediaQueryList,
  );
  const s = scene();
  try {
    s.flush();
    s.click(36, 100, false);
    s.flush();
    const midway = s.flush();
    expect(midway.some((text) => text.includes("Preset custom"))).toBe(true);
    const window = midway.find((text) => text.startsWith("Window "));
    s.pointer("pointerdown", 1, 220, 220);
    const taken = s.flush();
    expect(taken.find((text) => text.startsWith("Window "))).toBe(window);
    s.pointer("pointerup", 1, 220, 220);
    s.settle();
    expect(s.flush().some((text) => text.includes("Preset 1M"))).toBe(false);
    expect(s.click(36, 100).some((text) => text.includes("Preset 1M"))).toBe(
      true,
    );
  } finally {
    s.controller.dispose();
  }
  expect(s.pending.size).toBe(0);
});

it("snaps navigation under reduced motion and releases the preference listener", () => {
  const media = new EventTarget() as EventTarget & { matches: boolean };
  media.matches = true;
  const add = vi.spyOn(media, "addEventListener"),
    remove = vi.spyOn(media, "removeEventListener");
  vi.spyOn(window, "matchMedia").mockReturnValue(
    media as unknown as MediaQueryList,
  );
  const s = scene();
  try {
    s.flush();
    s.click(36, 100, false);
    const snapped = s.flush(0);
    expect(snapped.some((text) => text.includes("Preset 1M"))).toBe(true);
    expect(s.pending.size).toBe(0);
    media.matches = false;
    media.dispatchEvent(new Event("change"));
    s.settle();
    s.click(221, 100, false);
    s.flush();
    expect(s.flush().some((text) => text.includes("Preset custom"))).toBe(true);
    media.matches = true;
    media.dispatchEvent(new Event("change"));
    s.flush();
    expect(s.flush(0).some((text) => text.includes("Preset All"))).toBe(true);
  } finally {
    s.controller.dispose();
  }
  const callback = add.mock.calls.find((call) => call[0] === "change")?.[1];
  expect(remove).toHaveBeenCalledWith("change", callback);
});

it("supports desktop mouse drag and horizontal trackpad pan without turning a drag into a pin", () => {
  const s = scene();
  try {
    s.flush();
    s.click(36, 100);
    const window = s.flush().find((text) => text.startsWith("Window "));
    s.pointer("pointerdown", 1, 220, 220, "mouse");
    const drag = s.pointer("pointermove", 1, 310, 220, "mouse");
    expect(drag.find((text) => text.startsWith("Window "))).not.toBe(window);
    expect(drag.some((text) => text.includes("Preset custom"))).toBe(true);
    s.pointer("pointerup", 1, 310, 220, "mouse");
    expect(s.click(310, 220).some((text) => text.includes("Pinned"))).toBe(
      false,
    );
    s.click(36, 100);
    expect(
      s.wheel(220, 220, 0, -90).some((text) => text.includes("Preset custom")),
    ).toBe(true);
    s.click(36, 100);
    expect(
      s
        .wheel(220, 220, -90, 0, true)
        .some((text) => text.includes("Preset custom")),
    ).toBe(true);
  } finally {
    s.controller.dispose();
  }
});
it("applies consecutive wheel zoom steps promptly without waiting for an animated button transition", () => {
  const preference = Object.assign(new EventTarget(), { matches: false });
  vi.spyOn(window, "matchMedia").mockReturnValue(
    preference as unknown as MediaQueryList,
  );
  const s = scene();
  try {
    s.flush();
    s.click(36, 100);
    for (let i = 0; i < 6; i += 1)
      s.canvas.dispatchEvent(
        new WheelEvent("wheel", {
          clientX: 300,
          clientY: 220,
          deltaY: -80,
          bubbles: true,
          cancelable: true,
        }),
      );
    s.flush();
    const zoomed = s.flush(0);
    expect(zoomed.some((text) => text.includes("Preset custom"))).toBe(true);
    expect(zoomed.find((text) => text.startsWith("Window "))).toBe(
      "Window 02 Mar 2026 – 11 Mar 2026 · Preset custom",
    );
    expect(s.pending.size).toBe(0);
  } finally {
    s.controller.dispose();
  }
});
