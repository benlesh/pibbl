import {
  pibbl,
  signal,
  tween,
  useAnimatedValue,
  type PibblController,
  type Signal,
} from "@pibbl/core";
import {
  interpolateNumericRange,
  type NumericDomain,
} from "@pibbl/core/viz";
import { afterEach, expect, it, vi } from "vitest";

let controller: PibblController | undefined;

afterEach(() => {
  controller?.dispose();
  controller = undefined;
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

it("preserves exact ends, direction, flat pairs, and finite opposite large endpoints", () => {
  const ascending = [2, 10] as const;
  const descending = [10, 2] as const;
  expect(interpolateNumericRange(ascending, [6, 18], 0)).toEqual(ascending);
  expect(interpolateNumericRange(ascending, [6, 18], 1)).toEqual([6, 18]);
  expect(interpolateNumericRange(descending, [18, 6], 0.5)).toEqual([14, 4]);
  expect(interpolateNumericRange([4, 4], [9, 9], 0.25)).toEqual([5.25, 5.25]);
  expect(interpolateNumericRange(
    [Number.MAX_VALUE, -Number.MAX_VALUE],
    [-Number.MAX_VALUE, Number.MAX_VALUE],
    0.5,
  )).toEqual([0, 0]);
  expect(interpolateNumericRange([0, 10], [20, 30], 1.5)).toEqual([30, 40]);
  expect(() => interpolateNumericRange([0, 1], [2, Number.POSITIVE_INFINITY], 0.5))
    .toThrow(/finite/i);
  expect(() => interpolateNumericRange([0, 1], [2, 3], Number.NaN)).toThrow(/progress/i);
});

it("interpolates finite numeric ranges through public target-driven animation", () => {
  const driver = new ManualFrames();
  driver.install();
  const intent = signal<NumericDomain>([0, 10]);
  const direct = signal(false);
  let shown!: Signal<NumericDomain>;
  function Probe() {
    shown = useAnimatedValue(intent, {
      animation: tween<NumericDomain>({
        duration: direct.get() ? 0 : 100,
        interpolate: interpolateNumericRange,
      }),
      equals: (a, b) => a[0] === b[0] && a[1] === b[1],
    });
    shown.get();
  }

  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  controller = pibbl(canvas, <Probe />);
  driver.flush(0);
  expect(shown.get()).toEqual([0, 10]);

  intent.set([20, 40]);
  driver.flush(10);
  driver.flush(60);
  driver.flush(110);
  expect(shown.get()).toEqual([10, 25]);
  expect(Object.isFrozen(shown.get())).toBe(true);

  intent.set([40, 80]);
  driver.flush(120);
  const interrupted = shown.get();
  driver.flush(130);
  driver.flush(180);
  expect(shown.get()).toEqual(
    interpolateNumericRange(interrupted, [40, 80], 0.5),
  );

  direct.set(true);
  intent.set(shown.get());
  driver.flush(190);
  driver.flush(200);
  intent.set([30, 50]);
  driver.flush(210);
  driver.flush(220);
  expect(shown.get()).toEqual([30, 50]);

  controller.dispose();
  expect(driver.pending).toBe(0);
  controller = undefined;
});

class ManualFrames {
  private callbacks = new Map<number, FrameRequestCallback>();
  private nextId = 0;

  get pending(): number {
    return this.callbacks.size;
  }

  install(): void {
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
      (callback) => {
        const id = ++this.nextId;
        this.callbacks.set(id, callback);
        return id;
      },
    );
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
      this.callbacks.delete(id);
    });
  }

  flush(time: number): void {
    const entry = this.callbacks.entries().next().value as
      | readonly [number, FrameRequestCallback]
      | undefined;
    if (!entry) throw new Error("No Pibbl host frame is pending.");
    this.callbacks.delete(entry[0]);
    entry[1](time);
  }
}
