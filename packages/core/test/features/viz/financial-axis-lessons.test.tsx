import calendarMount from "../../../../scenarios/src/learning/composition/financial-calendar-ranges.example.js";
import linkedMount from "../../../../scenarios/src/learning/composition/financial-linked-panes.example.js";
import { afterEach, expect, it, vi } from "vitest";

const frames = new Map<number, FrameRequestCallback>();
let id = 0;
afterEach(() => {
  frames.clear();
  id = 0;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function mount(example: (canvas: HTMLCanvasElement) => { dispose(): void }) {
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
    (callback) => {
      frames.set(++id, callback);
      return id;
    },
  );
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((key) => {
    frames.delete(key);
  });
  const canvas = document.createElement("canvas");
  canvas.width = 760;
  canvas.height = 460;
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 760, 460),
  );
  document.body.append(canvas);
  const labels: string[] = [],
    context = canvas.getContext("2d")!,
    native = context.fillText.bind(context);
  vi.spyOn(context, "fillText").mockImplementation((text, ...args) => {
    labels.push(String(text));
    native(text, ...args);
  });
  let time = performance.now();
  const flush = (elapsed = 40) => {
    time += elapsed;
    const pending = [...frames.values()];
    frames.clear();
    if (pending.length) labels.length = 0;
    pending.forEach((callback) => callback(time));
  };
  const controller = example(canvas);
  flush();
  const settle = () => {
    for (let frame = 0; frame < 8; frame += 1) flush();
  };
  const click = (x: number, y: number, finish = true) => {
    labels.length = 0;
    for (const type of ["mousedown", "mouseup", "click"])
      canvas.dispatchEvent(
        new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }),
      );
    flush();
    if (finish) settle();
  };
  return { canvas, labels, controller, click, flush, settle, frames };
}
it("teaches financial units, dates, and inspection across coordinated OHLCV panes", () => {
  const view = mount(linkedMount);
  try {
    expect(view.labels).toContain("Northstar Materials · daily OHLCV");
    expect(view.labels).toContain("USD");
    expect(view.labels).toContain("shares");
    expect(view.labels.some((label) => label.includes("not a live feed"))).toBe(
      true,
    );
  } finally {
    view.controller.dispose();
  }
});
it("teaches realistic UTC calendar windows with USD axes and the March clamp", () => {
  const view = mount(calendarMount);
  try {
    expect(view.labels).toContain("Northstar Materials · calendar windows");
    expect(view.labels).toContain("USD");
    expect(
      view.labels.some((label) => label.includes("1M starts 28 Feb UTC")),
    ).toBe(true);
    expect(view.labels.some((label) => label.includes("31 Mar"))).toBe(true);
  } finally {
    view.controller.dispose();
  }
});

it("derives matching presets and calendar tick granularity from the current window", () => {
  const view = mount(calendarMount);
  try {
    expect(
      view.labels.some((label) => label.startsWith("Range: 3M / All")),
    ).toBe(true);
    expect(view.labels).toContain("Feb 2026");
    view.click(27, 65);
    expect(view.labels.some((label) => label.startsWith("Range: 1M"))).toBe(
      true,
    );
    expect(view.labels).toContain("02 Mar");
    expect(view.labels).not.toContain("Feb 2026");
    view.click(291, 65);
    expect(view.labels.some((label) => label.startsWith("Range: Custom"))).toBe(
      true,
    );
    view.click(27, 65);
    expect(view.labels.some((label) => label.startsWith("Range: 1M"))).toBe(
      true,
    );
  } finally {
    view.controller.dispose();
  }
});

it("animates calendar navigation through an intermediate custom range and retargets cleanly", () => {
  const preference = Object.assign(new EventTarget(), { matches: false });
  vi.spyOn(window, "matchMedia").mockReturnValue(preference as unknown as MediaQueryList);
  const view = mount(calendarMount);
  try {
    view.click(27, 65, false);
    view.flush();
    view.flush();
    expect(view.labels.some((label) => label.startsWith("Range: Custom"))).toBe(
      true,
    );
    expect(view.frames.size).toBeGreaterThan(0);
    view.click(159, 65, false);
    view.settle();
    expect(
      view.labels.some((label) => label.startsWith("Range: 3M / All")),
    ).toBe(true);
  } finally {
    view.controller.dispose();
  }
  expect(view.frames.size).toBe(0);
});
