import mount from "../../../../scenarios/src/learning/composition/financial-research-workspace.example.js";
import { afterEach, expect, it, vi } from "vitest";
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function scene(width = 960, height = 680) {
  const pending = new Map<number, FrameRequestCallback>();
  let id = 0,
    time = performance.now();
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
  document.body.append(canvas);
  let labels: string[] = [];
  let positions: { text: string; x: number; y: number }[] = [];
  const context = canvas.getContext("2d")!,
    native = context.fillText.bind(context);
  vi.spyOn(context, "fillText").mockImplementation((text, x, y, maxWidth) => {
    labels.push(String(text));
    const at = context.getTransform().transformPoint(new DOMPoint(x, y));
    positions.push({ text: String(text), x: at.x, y: at.y });
    const metrics = context.measureText(text),
      transform = context.getTransform();
    const left = transform.transformPoint(
      new DOMPoint(
        x - metrics.actualBoundingBoxLeft,
        y - metrics.actualBoundingBoxAscent,
      ),
    );
    const right = transform.transformPoint(
      new DOMPoint(
        x + metrics.actualBoundingBoxRight,
        y + metrics.actualBoundingBoxDescent,
      ),
    );
    expect(left.x, String(text)).toBeGreaterThanOrEqual(-1);
    expect(right.x, String(text)).toBeLessThanOrEqual(width + 1);
    expect(left.y, String(text)).toBeGreaterThanOrEqual(-1);
    expect(right.y, String(text)).toBeLessThanOrEqual(height + 1);
    native(text, x, y, maxWidth);
  });
  const controller = mount(canvas);
  const flush = () => {
    time += 40;
    const callbacks = [...pending.values()];
    pending.clear();
    if (callbacks.length) {
      labels = [];
      positions = [];
    }
    callbacks.forEach((cb) => cb(time));
    return labels;
  };
  const click = (x: number, y: number) => {
    for (const type of ["mousedown", "mouseup", "click"])
      canvas.dispatchEvent(
        new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }),
      );
    for (let i = 0; i < 8; i++) flush();
    return labels;
  };
  return { controller, flush, click, canvas, positions: () => positions };
}
it("shows a research workspace with editable annotations and a full-history navigator", () => {
  const s = scene();
  try {
    expect(s.flush()).toContain("Research Workspace");
    expect(s.flush()).toContain("Full history · drag window / edges");
    expect(s.click(120, 100)).toContain("Click the chart to place a level");
    s.click(500, 280);
    expect(s.flush().some((text) => text.includes("Level 2"))).toBe(true);
    s.click(370, 100);
    expect(s.flush().some((text) => text.includes("Level 2"))).toBe(false);
  } finally {
    s.controller.dispose();
  }
});
it("keeps phone controls and labels within the canvas", () => {
  const s = scene(360, 360);
  try {
    expect(s.flush()).toContain("Research Workspace");
    s.click(315, 20);
    s.click(180, 100);
  } finally {
    s.controller.dispose();
  }
});
it("retains annotations when the Shock window puts their prices off screen", () => {
  const s = scene();
  try {
    s.flush();
    expect(s.click(294, 130)).toContain("Research Workspace");
    expect(s.click(374, 130)).toContain("Research Workspace");
  } finally {
    s.controller.dispose();
  }
});
it("preserves wheel zoom, pointer pan, and animated calendar windows", () => {
  const s = scene();
  try {
    const window = () =>
      s.flush().find((text) => text.includes("sessions wide"));
    const pointer = (type: string, x: number) => {
      s.canvas.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: "mouse",
          button: 0,
          buttons: type === "pointerup" ? 0 : 1,
          clientX: x,
          clientY: 330,
        }),
      );
    };
    const initial = window();
    s.canvas.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        clientX: 600,
        clientY: 330,
        deltaY: -140,
      }),
    );
    for (let i = 0; i < 8; i++) s.flush();
    const zoomed = window();
    expect(zoomed).not.toEqual(initial);
    pointer("pointerdown", 600);
    pointer("pointermove", 700);
    pointer("pointerup", 700);
    for (let i = 0; i < 8; i++) s.flush();
    expect(window()).not.toEqual(zoomed);
    s.click(36, 130);
    expect(window()).toContain("sessions wide");
    expect(window()).not.toEqual(zoomed);
  } finally {
    s.controller.dispose();
  }
});
