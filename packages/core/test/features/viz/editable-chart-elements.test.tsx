import { FocusManagement, Group, pibbl, signal } from "@pibbl/core";
import {
  EditableReferenceBand,
  EditableReferenceLine,
  EditableTrendLine,
  LinearScale,
  LogScale,
  RangeNavigator,
  TradingTimeScale,
} from "@pibbl/core/viz";
import type { ChartAnchor } from "@pibbl/core/viz";
import { afterEach, expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";

const controllers: { dispose(): void }[] = [];
let runtime: ReturnType<typeof testRuntime> | undefined;
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.dispose();
  runtime?.dispose();
  runtime = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

it("rejects TradingTimeScale for range and reference controls before interaction", () => {
  runtime = testRuntime();
  runtime.mount(
    <TradingTimeScale id="time" timestamps={[1_000, 2_000]} range={[0, 100]}>
      <EditableReferenceLine
        scale="time"
        direction="vertical"
        value={1_000}
        span={[0, 100]}
        keyboardStep={1}
        onChange={() => undefined}
      />
    </TradingTimeScale>,
  );
  expect(() => runtime!.flush()).toThrow(
    /invertible numeric continuous scale.*TradingTimeScale/i,
  );
});

it("rejects impossible editable intervals before an edge can leave the domain", () => {
  runtime = testRuntime();
  runtime.mount(
    <LinearScale id="numeric" domain={[0, 10]} range={[0, 100]}>
      <RangeNavigator
        scale="numeric"
        values={[2, 6]}
        span={[0, 20]}
        minimumSpan={11}
        onChange={() => undefined}
      />
    </LinearScale>,
  );
  expect(() => runtime!.flush()).toThrow(
    /minimumSpan cannot exceed.*domain span/i,
  );
});

it.each([
  [2, 6],
  [6, 2],
] as const)(
  "rejects an impossible reference-band minimum span for %j",
  (first, second) => {
    runtime = testRuntime();
    runtime.mount(
      <LinearScale id="numeric" domain={[0, 10]} range={[0, 100]}>
        <EditableReferenceBand
          scale="numeric"
          direction="vertical"
          values={[first, second]}
          span={[0, 20]}
          minimumSpan={11}
          keyboardStep={1}
          onChange={() => undefined}
        />
      </LinearScale>,
    );
    expect(() => runtime!.flush()).toThrow(
      /EditableReferenceBand values must meet minimumSpan/i,
    );
  },
);

it("retains a valid reference band outside the visible scale domain", () => {
  runtime = testRuntime();
  runtime.mount(
    <LinearScale id="numeric" domain={[0, 10]} range={[0, 100]}>
      <EditableReferenceBand
        scale="numeric"
        direction="vertical"
        values={[2, 16]}
        span={[0, 20]}
        minimumSpan={11}
        keyboardStep={1}
        onChange={() => undefined}
      />
    </LinearScale>,
  );
  expect(() => runtime!.flush()).not.toThrow();
});

function scene(node: unknown) {
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 260;
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 400, 260),
  );
  vi.spyOn(canvas, "setPointerCapture").mockImplementation(() => undefined);
  vi.spyOn(canvas, "releasePointerCapture").mockImplementation(() => undefined);
  document.body.append(canvas);
  const controller = pibbl(canvas, node as never, { pixelRatio: 1 });
  controllers.push(controller);
  return canvas;
}

function pointer(
  canvas: HTMLCanvasElement,
  type: string,
  x: number,
  y: number,
  pointerId = 1,
) {
  canvas.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId,
      pointerType: "mouse",
      isPrimary: true,
      buttons: type === "pointerup" || type === "pointercancel" ? 0 : 1,
      clientX: x,
      clientY: y,
    }),
  );
}

it("lets reference edits extrapolate beyond the current visible scale domain", async () => {
  const value = signal(5);
  const canvas = scene(
    <LinearScale id="numeric" domain={[0, 10]} range={[0, 100]}>
      <EditableReferenceLine
        scale="numeric"
        direction="vertical"
        value={value}
        span={[0, 20]}
        keyboardStep={1}
        onChange={value.set}
      />
    </LinearScale>,
  );
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  pointer(canvas, "pointerdown", 50, 10);
  pointer(canvas, "pointermove", 120, 10);
  pointer(canvas, "pointerup", 120, 10);
  expect(value.get()).toBe(12);
});

it("translates a whole numeric trend beyond the viewport without changing its mapped shape", async () => {
  const anchors = signal<readonly [ChartAnchor, ChartAnchor]>([
    { x: 2, y: 2 },
    { x: 4, y: 4 },
  ]);
  const canvas = scene(
    <LinearScale id="x" domain={[0, 10]} range={[0, 100]}>
      <LinearScale id="y" domain={[0, 10]} range={[0, 100]}>
        <EditableTrendLine
          xScale="x"
          yScale="y"
          anchors={anchors}
          keyboardStep={{ x: 1, y: 1 }}
          onChange={anchors.set}
          style={{ hitSize: 4 }}
        />
      </LinearScale>
    </LinearScale>,
  );
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  pointer(canvas, "pointerdown", 30, 30);
  pointer(canvas, "pointermove", 130, 130);
  pointer(canvas, "pointerup", 130, 130);
  expect(anchors.get()).toEqual([
    { x: 12, y: 12 },
    { x: 14, y: 14 },
  ]);
});

it("edits controlled navigator, references, and transformed trend geometry with draft cancellation and commits", async () => {
  const window = signal<readonly [number, number]>([2, 6]);
  const line = signal(5);
  const band = signal<readonly [number, number]>([2, 4]);
  const anchors = signal<
    readonly [{ x: number; y: number }, { x: number; y: number }]
  >([
    { x: 1_000, y: 10 },
    { x: 3_000, y: 30 },
  ]);
  const commits: unknown[] = [];
  let lineSelections = 0;
  const canvas = scene(
    <Group style={{ translateX: 40, translateY: 20 }}>
      <LinearScale id="overview" domain={[0, 10]} range={[0, 100]}>
        <RangeNavigator
          scale="overview"
          values={window}
          span={[10, 40]}
          minimumSpan={1}
          onChange={window.set}
          onCommit={(value) => commits.push(value)}
        />
        <EditableReferenceLine
          scale="overview"
          direction="horizontal"
          value={line}
          span={[120, 220]}
          keyboardStep={1}
          onSelect={() => lineSelections++}
          onChange={line.set}
          onCommit={(value) => commits.push(value)}
        />
        <EditableReferenceBand
          scale="overview"
          direction="vertical"
          values={band}
          span={[70, 110]}
          keyboardStep={1}
          minimumSpan={1}
          onChange={band.set}
          onCommit={(value) => commits.push(value)}
        />
      </LinearScale>
      <TradingTimeScale
        id="time"
        timestamps={[1_000, 2_000, 3_000, 4_000]}
        range={[0, 100]}
      >
        <LinearScale id="price" domain={[0, 100]} range={[100, 0]}>
          <EditableTrendLine
            xScale="time"
            yScale="price"
            anchors={anchors}
            keyboardStep={{ x: 1, y: 1 }}
            onChange={anchors.set}
            onCommit={(value) => commits.push(value)}
          />
        </LinearScale>
      </TradingTimeScale>
    </Group>,
  );
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  // The overview is translated: local edge x=20 is root x=60. Resizing then
  // cancelling restores the caller-owned value and frees the pointer transaction.
  pointer(canvas, "pointerdown", 60, 45);
  pointer(canvas, "pointermove", 90, 45);
  expect(window.get()).toEqual([5, 6]);
  pointer(canvas, "pointercancel", 90, 45);
  expect(window.get()).toEqual([2, 6]);

  // Interior dragging uses one shared domain delta, then releases the last draft.
  pointer(canvas, "pointerdown", 80, 45, 2);
  pointer(canvas, "pointermove", 100, 45, 2);
  pointer(canvas, "pointerup", 100, 45, 2);
  expect(window.get()).toEqual([4, 8]);
  expect(commits).toContainEqual([4, 8]);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  // A controlled edge update may re-render before release; commit still uses the
  // drag's final draft rather than the closure's original prop.
  pointer(canvas, "pointerdown", 80, 45, 3);
  pointer(canvas, "pointermove", 90, 45, 3);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  pointer(canvas, "pointerup", 90, 45, 3);
  expect(window.get()).toEqual([5, 8]);
  expect(commits).toContainEqual([5, 8]);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  // Horizontal reference values use the local y coordinate under the same transform.
  pointer(canvas, "pointerdown", 180, 70, 4);
  pointer(canvas, "pointermove", 180, 50, 4);
  pointer(canvas, "pointerup", 180, 50, 4);
  expect(lineSelections).toBe(1);
  expect(line.get()).toBe(3);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  // A vertical band edge resizes while preserving its configured minimum span.
  pointer(canvas, "pointerdown", 80, 130, 5);
  pointer(canvas, "pointermove", 110, 130, 5);
  pointer(canvas, "pointerup", 110, 130, 5);
  expect(band.get()).toEqual([2, 7]);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  // Dragging the first trend endpoint snaps x to supplied observations and maps y
  // through the linear price scale.
  pointer(canvas, "pointerdown", 53, 110, 6);
  pointer(canvas, "pointermove", 103, 90, 6);
  pointer(canvas, "pointerup", 103, 90, 6);
  expect(anchors.get()[0]).toEqual({ x: 3_000, y: 30 });
});

it("freezes pointer scale snapshots, preserves mapped log-band width, and rolls back capture loss", async () => {
  const domain = signal<readonly [number, number]>([0, 10]);
  const linearValues = signal<readonly [number, number]>([2, 6]);
  const logValues = signal<readonly [number, number]>([10, 50]);
  const logBandValues = signal<readonly [number, number]>([10, 50]);
  const cancelled = vi.fn();
  const canvas = scene(
    <>
      <LinearScale id="linear" domain={domain} range={[0, 100]}>
        <RangeNavigator
          scale="linear"
          values={linearValues}
          span={[10, 35]}
          minimumSpan={1}
          onChange={linearValues.set}
          onCancel={cancelled}
        />
      </LinearScale>
      <LogScale id="log" domain={[1, 100]} range={[0, 100]}>
        <RangeNavigator
          scale="log"
          values={logValues}
          span={[50, 75]}
          onChange={logValues.set}
        />
        <EditableReferenceBand
          scale="log"
          direction="vertical"
          values={logBandValues}
          span={[90, 115]}
          minimumSpan={35}
          keyboardStep={1}
          onChange={logBandValues.set}
        />
      </LogScale>
    </>,
  );
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  // Change the provider while the drag is active. The same pointer still uses
  // the mapping resolved at pointer-down: [2, 6] moves 30 pixels to [5, 9].
  pointer(canvas, "pointerdown", 40, 20);
  domain.set([0, 20]);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  pointer(canvas, "pointermove", 70, 20);
  expect(linearValues.get()).toEqual([5, 9]);
  pointer(canvas, "lostpointercapture", 70, 20);
  expect(linearValues.get()).toEqual([2, 6]);
  expect(cancelled).toHaveBeenCalledTimes(1);

  // A ten-pixel log-scale pan moves both mapped endpoints by ten pixels.
  pointer(canvas, "pointerdown", 67, 60, 2);
  pointer(canvas, "pointermove", 77, 60, 2);
  const [first, second] = logValues.get();
  expect(Math.log10(second) - Math.log10(first)).toBeCloseTo(
    Math.log10(50) - Math.log10(10),
    8,
  );
  expect(first).toBeCloseTo(10 ** 1.2, 6);
  expect(second).toBeCloseTo(10 ** (Math.log10(50) + 0.2), 6);

  // Moving a nonlinear band toward its smaller numeric width stops at its
  // configured minimum instead of emitting an invalid controlled interval.
  pointer(canvas, "pointerdown", 67, 100, 3);
  pointer(canvas, "pointermove", 20, 100, 3);
  pointer(canvas, "pointerup", 20, 100, 3);
  const [bandFirst, bandSecond] = logBandValues.get();
  expect(Math.abs(bandSecond - bandFirst)).toBeGreaterThanOrEqual(35 - 1e-6);
  expect(Math.abs(bandSecond - bandFirst)).toBeLessThan(40);
});

it("advances TradingTimeScale arrows through missing weekend observations", async () => {
  const friday = Date.UTC(2026, 9, 9);
  const monday = Date.UTC(2026, 9, 12);
  const tuesday = Date.UTC(2026, 9, 13);
  const anchors = signal<readonly [ChartAnchor, ChartAnchor]>([
    { x: friday, y: 50 },
    { x: monday, y: 50 },
  ]);
  const canvas = scene(
    <FocusManagement>
      <TradingTimeScale
        id="time"
        timestamps={[friday, monday, tuesday]}
        range={[0, 100]}
      >
        <LinearScale id="price" domain={[0, 100]} range={[100, 0]}>
          <EditableTrendLine
            xScale="time"
            yScale="price"
            anchors={anchors}
            keyboardStep={{ x: 86_400_000, y: 1 }}
            onChange={anchors.set}
          />
        </LinearScale>
      </TradingTimeScale>
    </FocusManagement>,
  );
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  canvas.focus();
  canvas.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    }),
  );
  canvas.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
  );
  expect(anchors.get().map((anchor) => anchor.x)).toEqual([monday, tuesday]);
  expect(anchors.get().map((anchor) => anchor.y)).toEqual([50, 50]);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  canvas.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
  );
  expect(anchors.get().map((anchor) => anchor.x)).toEqual([friday, monday]);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  canvas.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
  );
  expect(anchors.get().map((anchor) => anchor.x)).toEqual([friday, monday]);
  expect(anchors.get().map((anchor) => anchor.y)).toEqual([51, 51]);
});
