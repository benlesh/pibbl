import { afterEach, expect, it, vi } from "vitest";
import { commands } from "vitest/browser";
import * as CRC from "@crc/core";
import type {
  CRCController,
  CRCManipulationCancelEvent,
  CRCNode,
} from "@crc/core";
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
} from "../src/lib/scheduler/testing";

const mounts: CRCController[] = [];

afterEach(async () => {
  for (const mount of mounts.splice(0)) mount.dispose();
  await settle();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

it("rolls a captured drag back exactly once on pointercancel and native capture loss", async () => {
  for (const terminal of ["pointercancel", "capture-loss"] as const) {
    const {
      box,
      cancellations,
      commits,
      control,
      canvas,
      mount,
      nativeLosses,
      pointerId,
    } = await mountActiveDrag();
    if (terminal === "pointercancel") {
      dispatchPointer(canvas, "pointercancel", pointerId(), 100, 100);
    } else {
      canvas.releasePointerCapture(pointerId());
      // Chromium queues native capture loss until it next processes this pointer.
      await commands.manipulationPointer([{ type: "move", x: 100, y: 100 }]);
    }
    await settle();

    if (terminal === "capture-loss") expect(nativeLosses()).toBeGreaterThan(0);
    expect(control.active.get(), terminal).toBe(null);
    expect(box.get()).toEqual({ left: 40, top: 50, width: 100, height: 80 });
    expect(commits).toEqual([]);
    expect(cancellations.map((event) => event.reason)).toEqual([
      terminal === "pointercancel" ? "pointer-cancel" : "capture-lost",
    ]);
    await commands.manipulationPointer([{ type: "up" }]);
    mount.dispose();
    mounts.splice(mounts.indexOf(mount), 1);
    canvas.remove();
    await settle();
  }
});

it("does not arm or preview when native pointer capture fails", async () => {
  const starts: number[] = [];
  const box = CRC.signal({ left: 40, top: 50, width: 100, height: 80 });
  let control!: CRC.CRCManipulationController;
  const canvas = createCanvas();
  vi.spyOn(canvas, "setPointerCapture").mockImplementation(() => {});
  function Scene(): CRCNode {
    control = CRC.useManipulation({
      box,
      move: {},
      onStart: () => starts.push(1),
    });
    return (
      <CRC.ManipulationFrame {...control.frameProps}>
        <CRC.DragHandle controller={control}>
          <CRC.Rectangle
            pointerEvents="auto"
            keyboardFocusable
            style={{ width: 100, height: 80, fill: "transparent" }}
          />
        </CRC.DragHandle>
      </CRC.ManipulationFrame>
    );
  }
  mounts.push(CRC.crc(canvas, <Scene />, { pixelRatio: 1 }));
  await settle();

  await commands.manipulationPointer([
    { type: "move", x: 60, y: 70 },
    { type: "down" },
    { type: "move", x: 90, y: 90 },
    { type: "up" },
  ]);

  expect(control.active.get()).toBe(null);
  expect(starts).toEqual([]);
  expect(box.get()).toEqual({ left: 40, top: 50, width: 100, height: 80 });
});

it("lets a nested control decline a drag and lets the deepest resize handle claim first", async () => {
  const declined = CRC.signal({ left: 40, top: 50, width: 100, height: 80 });
  const resized = CRC.signal({ left: 180, top: 50, width: 100, height: 80 });
  const canvas = createCanvas(400, 240);
  function Declined(): CRCNode {
    const control = CRC.useManipulation({ box: declined, move: {} });
    return (
      <CRC.ManipulationFrame {...control.frameProps}>
        <CRC.DragHandle controller={control}>
          <CRC.Rectangle
            pointerEvents="auto"
            keyboardFocusable
            style={{ width: 100, height: 80, fill: "#16a34a" }}
            onPointerDown={(event) => event.preventDefault()}
          />
        </CRC.DragHandle>
      </CRC.ManipulationFrame>
    );
  }
  function DeepestResize(): CRCNode {
    const control = CRC.useManipulation({ box: resized, move: {}, resize: {} });
    return (
      <CRC.ManipulationFrame {...control.frameProps}>
        <CRC.DragHandle controller={control}>
          <CRC.Rectangle
            pointerEvents="auto"
            keyboardFocusable
            style={{ width: 100, height: 80, fill: "transparent" }}
          />
          <CRC.ResizeHandle controller={control} position="bottom-right" />
        </CRC.DragHandle>
      </CRC.ManipulationFrame>
    );
  }
  mounts.push(
    CRC.crc(
      canvas,
      [<Declined key="declined" />, <DeepestResize key="resize" />],
      { pixelRatio: 1 },
    ),
  );
  await settle();

  await commands.manipulationPointer([
    { type: "move", x: 60, y: 70 },
    { type: "down" },
    { type: "move", x: 90, y: 90 },
    { type: "up" },
  ]);
  expect(declined.get()).toEqual({ left: 40, top: 50, width: 100, height: 80 });

  await commands.manipulationPointer([
    { type: "move", x: 280, y: 130 },
    { type: "down" },
    { type: "move", x: 300, y: 140 },
    { type: "up" },
  ]);
  expect(resized.get()).toEqual({ left: 180, top: 50, width: 120, height: 90 });
});

it("rejects duplicate and cross-root frame attachment before either mount can render", () => {
  const driver = new ManualSchedulerDriver();
  const restoreDriver = installSchedulerDriverForTest(driver);
  try {
    function Duplicate(): CRCNode {
      const control = CRC.useManipulation({
        box: CRC.signal({ left: 40, top: 50, width: 100, height: 80 }),
        move: {},
      });
      return [
        <CRC.ManipulationFrame key="first" {...control.frameProps} />,
        <CRC.ManipulationFrame key="second" {...control.frameProps} />,
      ];
    }
    mounts.push(CRC.crc(createCanvas(), <Duplicate />, { pixelRatio: 1 }));
    expect(() => driver.flush(0)).toThrow(
      "A manipulation controller can attach to only one frame.",
    );

    let shared!: CRC.CRCManipulationController;
    function Owner(): CRCNode {
      shared = CRC.useManipulation({
        box: CRC.signal({ left: 40, top: 50, width: 100, height: 80 }),
        move: {},
      });
      return <CRC.ManipulationFrame {...shared.frameProps} />;
    }
    mounts.push(CRC.crc(createCanvas(), <Owner />, { pixelRatio: 1 }));
    driver.flush(1);
    mounts.push(
      CRC.crc(
        createCanvas(),
        <CRC.ManipulationFrame {...shared.frameProps} />,
        { pixelRatio: 1 },
      ),
    );
    expect(() => driver.flush(2)).toThrow(
      "A manipulation controller cannot attach across CRC roots.",
    );
  } finally {
    restoreDriver();
  }
});

it("rejects a manipulation press while an active animation owns its box signal", async () => {
  const errors: unknown[] = [];
  vi.spyOn(globalThis, "reportError").mockImplementation((error) =>
    errors.push(error),
  );
  const box = CRC.signal({ left: 40, top: 50, width: 100, height: 80 });
  let control!: CRC.CRCManipulationController;
  let playback!: CRC.CRCPlayback;
  const canvas = createCanvas();
  function Scene(): CRCNode {
    control = CRC.useManipulation({ box, move: {} });
    playback = CRC.usePlayback(
      CRC.track(
        box,
        CRC.tween({
          from: { left: 40, top: 50, width: 100, height: 80 },
          to: { left: 140, top: 50, width: 100, height: 80 },
          duration: 100_000,
          interpolate: (from, to, progress) => ({
            left: from.left + (to.left - from.left) * progress,
            top: from.top + (to.top - from.top) * progress,
            width: from.width + (to.width - from.width) * progress,
            height: from.height + (to.height - from.height) * progress,
          }),
        }),
      ),
      { autoplay: true },
    );
    return (
      <CRC.ManipulationFrame {...control.frameProps}>
        <CRC.DragHandle controller={control}>
          <CRC.Rectangle
            pointerEvents="auto"
            keyboardFocusable
            style={{ width: 100, height: 80, fill: "transparent" }}
          />
        </CRC.DragHandle>
      </CRC.ManipulationFrame>
    );
  }
  mounts.push(CRC.crc(canvas, <Scene />, { pixelRatio: 1 }));
  await settle();
  const beforePress = box.get();
  expect(playback.status.get()).toBe("running");

  await commands.manipulationPointer([
    { type: "move", x: 60, y: 70 },
    { type: "down" },
    { type: "up" },
  ]);

  expect(control.active.get()).toBe(null);
  expect(box.get().top).toBe(beforePress.top);
  expect(errors.map(String).join("\n")).toMatch(/writer lease|leased/i);
});

async function mountActiveDrag() {
  const box = CRC.signal({ left: 40, top: 50, width: 100, height: 80 });
  const cancellations: CRCManipulationCancelEvent[] = [];
  const commits: unknown[] = [];
  let control!: CRC.CRCManipulationController;
  let seenPointerId: number | undefined;
  let nativeLosses = 0;
  const canvas = createCanvas();
  canvas.addEventListener("pointerdown", (event) => {
    seenPointerId = event.pointerId;
  });
  canvas.addEventListener("lostpointercapture", () => nativeLosses++);
  function Scene(): CRCNode {
    control = CRC.useManipulation({
      box,
      move: {},
      onCancel: (event) => cancellations.push(event),
      onCommit: (event) => commits.push(event),
    });
    return (
      <CRC.ManipulationFrame {...control.frameProps}>
        <CRC.DragHandle controller={control}>
          <CRC.Rectangle
            pointerEvents="auto"
            keyboardFocusable
            style={{ width: 100, height: 80, fill: "transparent" }}
          />
        </CRC.DragHandle>
      </CRC.ManipulationFrame>
    );
  }
  mounts.push(CRC.crc(canvas, <Scene />, { pixelRatio: 1 }));
  await settle();
  await commands.manipulationPointer([
    { type: "move", x: 60, y: 70 },
    { type: "down" },
    { type: "move", x: 90, y: 90 },
  ]);
  expect(control.active.get()?.operation).toBe("move");
  return {
    box,
    cancellations,
    commits,
    control,
    canvas,
    mount: mounts.at(-1)!,
    nativeLosses: () => nativeLosses,
    pointerId: () => {
      if (seenPointerId === undefined)
        throw new Error("Expected native pointerdown.");
      return seenPointerId;
    },
  };
}

function createCanvas(width = 320, height = 240): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.dataset.manipulationTest = "";
  document.body.append(canvas);
  return canvas;
}

function dispatchPointer(
  canvas: HTMLCanvasElement,
  type: "pointercancel",
  pointerId: number,
  x: number,
  y: number,
): void {
  const bounds = canvas.getBoundingClientRect();
  canvas.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId,
      pointerType: "mouse",
      isPrimary: true,
      clientX: bounds.left + x,
      clientY: bounds.top + y,
    }),
  );
}

function settle(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}
