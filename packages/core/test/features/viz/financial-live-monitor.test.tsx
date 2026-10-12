import mount from "../../../../scenarios/src/learning/composition/financial-live-monitor.example.js";
import { afterEach, expect, it, vi } from "vitest";
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function scene(width = 960, height = 640) {
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
    for (let i = 0; i < 12; i++) flush();
    return labels;
  };
  return { controller, flush, click, canvas, positions: () => positions };
}
it("preserves the time window across aggregation and suspends follow on wheel browsing", () => {
  const s = scene();
  try {
    expect(s.flush()).toContain("Live Market Monitor");
    expect(s.flush().some(text => text.includes("60 minutes wide"))).toBe(true);
    expect(s.click(440, 100).some(text => text.includes("15m bars"))).toBe(true);
    expect(s.flush().some(text => text.includes("60 minutes wide"))).toBe(true);
    s.canvas.dispatchEvent(new WheelEvent("wheel", {clientX:500,clientY:240,deltaY:-100,bubbles:true,cancelable:true}));
    for(let i=0;i<8;i++) s.flush();
    expect(s.flush().some(text => text.includes("BROWSING HISTORY"))).toBe(true);
    const before = s.flush().find(text => text.includes("minutes wide"));
    expect(s.click(140, 100).find(text => text.includes("minutes wide"))).toBe(before);
    expect(s.click(370, 130).some(text => text.includes("FOLLOWING LATEST"))).toBe(true);
  } finally { s.controller.dispose(); }
});
it("keeps the phone readable and restores touch policy on disposal", () => {
  const s=scene(360,300);
  try { expect(s.flush()).toContain("Live Market Monitor"); expect(s.canvas.style.touchAction).toBe("none"); s.click(310,100); s.click(315,20); } finally {s.controller.dispose();}
  expect(s.canvas.style.touchAction).toBe("");
});

it("Step advances one displayed bar and Play advances the replay clock", () => {
  const nativeMedia = window.matchMedia.bind(window);
  vi.spyOn(window, "matchMedia").mockImplementation(query => {
    const media = nativeMedia(query); Object.defineProperty(media, "matches", { value: false }); return media;
  });
  const timers: (() => void)[] = [];
  vi.spyOn(window, "setInterval").mockImplementation((callback) => {
    if(typeof callback === "function") timers.push(callback as () => void);
    return 123 as unknown as ReturnType<typeof window.setInterval>;
  });
  vi.spyOn(window, "clearInterval").mockImplementation(() => {});
  const s=scene();
  try {
    s.flush();
    expect(s.click(130,100).some(text => text.includes("15:35:00"))).toBe(true);
    s.click(40,100);
    expect(timers.length).toBeGreaterThan(0);
    timers.at(-1)!(); s.flush(); s.flush();
    const intermediate=s.flush().find(text => text.includes("REPLAY RUNNING"))!;
    const receivedVolume=/Vol ([^·]+)/.exec(s.flush().find(text=>text.startsWith("VWAP $"))!)![1];
    expect(intermediate).not.toContain("15:35:00");
    expect(intermediate).not.toContain("15:35:30");
    for(let i=0;i<8;i++) s.flush();
    expect(s.flush().some(text => text.includes("15:35:30"))).toBe(true);
    expect(/Vol ([^·]+)/.exec(s.flush().find(text=>text.startsWith("VWAP $"))!)![1]).toBe(receivedVolume);
  } finally {s.controller.dispose();}
});

it("keeps clock-aligned ticks anchored while the window scrolls", () => {
  const s=scene();
  try {
    s.flush();
    const before=s.positions().find(point=>point.text === "14:40")!;
    expect(before).toBeDefined();
    s.click(130,100);
    const after=s.positions().find(point=>point.text === "14:40")!;
    expect(after).toBeDefined();
    expect(after.x).toBeCloseTo(before.x - (960-18-55)*5/60, 3);
  } finally {s.controller.dispose();}
});

it("retains the same tick interval throughout thirty-minute follow animation", () => {
  const nativeMedia=window.matchMedia.bind(window);
  vi.spyOn(window,"matchMedia").mockImplementation(query => {const media=nativeMedia(query); Object.defineProperty(media,"matches",{value:false});return media;});
  const timers: (()=>void)[]=[];
  vi.spyOn(window,"setInterval").mockImplementation(callback => {timers.push(callback as ()=>void); return 123 as unknown as ReturnType<typeof window.setInterval>;});
  vi.spyOn(window,"clearInterval").mockImplementation(()=>{});
  const s=scene(360,300);
  try {
    s.flush();s.click(35,130);s.click(305,130);s.click(35,100);
    for(let update=0;update<8;update++) {
      timers.at(-1)!();
      for(let frame=0;frame<5;frame++) {s.flush();expect(s.positions().some(p=>p.text==="15:10")).toBe(true);}
    }
  } finally {s.controller.dispose();}
});
