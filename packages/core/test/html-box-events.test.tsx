import { afterEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import {
  crc,
  Group,
  HtmlBox,
  Layer,
  signal,
  type CRCController,
} from "@crc/core";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../src/lib/scheduler/testing.js";
import { clearSharedState } from "../src/lib/global-state.js";
import { getSignalNode } from "../src/lib/signals/graph.js";

const controllers = new Set<CRCController>();

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  clearSharedState();
  document.body.replaceChildren();
});

function surface() {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:relative;width:400px;height:300px";
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 300;
  canvas.style.cssText = "display:block;width:100%;height:100%";
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:absolute;inset:0;pointer-events:none;z-index:1";
  wrapper.append(canvas, overlay);
  document.body.append(wrapper);
  return { canvas, overlay, wrapper };
}

function dispatchPointer(target: EventTarget, clientX: number, clientY: number) {
  target.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      pointerId: 7,
      pointerType: "mouse",
    }),
  );
}

describe("HtmlBox public native event bridge", () => {
  it("maps nested native events to root and border-box coordinates before padding", () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const { canvas, overlay, wrapper } = surface();
    document.body.style.margin = "0";
    // This is a known affine transform, not a bounding-rectangle oracle.
    wrapper.style.transformOrigin = "0 0";
    wrapper.style.transform = "matrix(0, 1, -1, 0, 300, 0)";
    let nested!: HTMLSpanElement;
    const received: Array<{
      x: number;
      y: number;
      localX: number;
      localY: number;
      targetIsCurrentTarget: boolean;
      originalTarget: unknown;
    }> = [];
    const mount = (host: HTMLDivElement) => {
      const button = document.createElement("button");
      nested = document.createElement("span");
      nested.textContent = "nested";
      button.append(nested);
      host.append(button);
      return () => undefined;
    };
    try {
      const controller = crc(
        canvas,
        <Group style={{ translateX: 60, translateY: 40, rotationDegrees: 90, scaleX: 2, scaleY: 1.5 }}>
          <HtmlBox
            data={0}
            mount={mount}
            style={{ width: 100, height: 60, padding: 6 }}
            onPointerMove={(event) => {
              received.push({
                x: event.x,
                y: event.y,
                localX: event.localX,
                localY: event.localY,
                targetIsCurrentTarget: event.target === event.currentTarget,
                originalTarget: event.originalEvent.target,
              });
            }}
          />
        </Group>,
        { htmlOverlay: overlay, viewport: { width: 400, height: 300 }, pixelRatio: 1 },
      );
      controllers.add(controller);
      driver.flush(1);

      // Ten logical units into content is sixteen units into the padded border box.
      // HtmlBox local (16, 21) maps through scale × rotation × translation
      // to root (-122, 114), then through the wrapper's known CSS matrix to
      // screen (186, -122).
      dispatchPointer(nested, 186, -122);

      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({
        x: -122,
        y: 114,
        localX: 16,
        localY: 21,
      });
      expect(received[0].targetIsCurrentTarget).toBe(true);
      expect(received[0].originalTarget).toBe(nested);
    } finally {
      restore();
    }
  });

  it("uses committed geometry through fit, density, and a clean nested Layer replay", () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const { canvas, overlay } = surface();
    let child!: HTMLButtonElement;
    const samples: string[] = [];
    const outerX = signal(30);
    let updates = 0;
    const mount = (
      host: HTMLDivElement,
      _initial: string,
      _signal: AbortSignal,
    ) => {
      child = document.createElement("button");
      host.append(child);
      return (_data: string) => {
        updates++;
      };
    };
    const inner = (
      <Layer style={{ width: 180, height: 100 }}>
        <Group style={{ translateX: 8, translateY: 9 }}>
          <HtmlBox
            data="stable"
            mount={mount}
            style={{ width: 80, height: 40, padding: 4 }}
            onMouseMove={(event) =>
              samples.push(`stable:${event.x},${event.y}:${event.localX},${event.localY}`)
            }
          />
        </Group>
      </Layer>
    );
    const scene = <Group style={{ translateX: outerX, translateY: 12 }}>{inner}</Group>;
    try {
      const controller = crc(canvas, scene, {
        htmlOverlay: overlay,
        viewport: { width: 200, height: 100 },
        fit: "contain",
        pixelRatio: 2,
      });
      controllers.add(controller);
      driver.flush(1);
      const firstShell = overlay.querySelector<HTMLElement>("[data-crc-html-box]")!;
      const first = new DOMPoint(14, 16).matrixTransform(
        new DOMMatrix(firstShell.style.transform),
      );
      child.dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, clientX: first.x, clientY: first.y }),
      );
      expect(samples).toEqual(["stable:52,37:14,16"]);

      // The outer signal invalidates its parent. The retained Layer itself is
      // clean, so its stable child descriptor is replayed without an HtmlBox
      // data update or native remount while projection still changes.
      outerX.set(90);
      driver.flush(2);
      expect(overlay.querySelector("button")).toBe(child);
      expect(updates).toBe(0);
      const replayedShell = overlay.querySelector<HTMLElement>("[data-crc-html-box]")!;
      const replayed = new DOMPoint(14, 16).matrixTransform(
        new DOMMatrix(replayedShell.style.transform),
      );
      child.dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, clientX: replayed.x, clientY: replayed.y }),
      );
      expect(samples).toEqual([
        "stable:52,37:14,16",
        "stable:112,37:14,16",
      ]);
    } finally {
      restore();
    }
  });

  it("preserves native descendant ordering, cancellation, activation, capture, and cleanup", () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const { canvas, overlay } = surface();
    let input!: HTMLInputElement;
    let nested!: HTMLSpanElement;
    const order: string[] = [];
    const nativeCaptureCalls: number[] = [];
    let selectionChanges = 0;
    const mount = (host: HTMLDivElement, _data: boolean, signal: AbortSignal) => {
      input = document.createElement("input");
      input.type = "checkbox";
      nested = document.createElement("span");
      nested.textContent = "child";
      input.after(nested);
      nested.addEventListener("pointermove", (event) => {
        order.push("native-child");
        event.stopPropagation();
      }, { signal });
      host.append(input, nested);
      return () => undefined;
    };
    const scene = (show: boolean) => (
      <Group onPointerMoveCapture={() => order.push("group-capture")}>
        {show && (
          <HtmlBox
            data={show}
            mount={mount}
            style={{ width: 100, height: 40 }}
            onPointerMoveCapture={(event) => {
              order.push("host-capture");
              event.target.setPointerCapture(7);
            }}
            onPointerMove={() => order.push("host-bubble")}
            onClick={(event) => event.preventDefault()}
            onSelectionChange={(event) => {
              selectionChanges++;
              expect(event.bubbles).toBe(true);
              expect(event.originalEvent.target).toBe(input);
            }}
          />
        )}
      </Group>
    );
    try {
      const controller = crc(canvas, scene(true), { htmlOverlay: overlay });
      controllers.add(controller);
      driver.flush(1);
      const content = overlay.querySelector<HTMLDivElement>(
        "[data-crc-html-content]",
      )!;
      content.setPointerCapture = (pointerId) => nativeCaptureCalls.push(pointerId);
      dispatchPointer(nested, 12, 14);
      expect(order).toEqual(["group-capture", "host-capture", "native-child"]);
      expect(nativeCaptureCalls).toEqual([7]);

      input.click();
      expect(input.checked).toBe(false);
      input.dispatchEvent(new Event("selectionchange", { bubbles: true }));
      expect(selectionChanges).toBe(1);
      crc(canvas, scene(false));
      driver.flush(2);
      dispatchPointer(nested, 12, 14);
      expect(order).toEqual(["group-capture", "host-capture", "native-child"]);
    } finally {
      restore();
    }
  });

  it("preserves exactly one native checkbox activation while relaying HtmlBox and ancestor clicks", async () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const { canvas, overlay } = surface();
    let checkbox!: HTMLInputElement;
    const clicks: string[] = [];
    const mount = (host: HTMLDivElement) => {
      checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      host.append(checkbox);
      return () => undefined;
    };
    try {
      const controller = crc(
        canvas,
        <Group onClick={() => clicks.push("ancestor")}>
          <HtmlBox
            data={0}
            mount={mount}
            style={{ width: 100, height: 40 }}
            onClick={() => clicks.push("host")}
          />
        </Group>,
        { htmlOverlay: overlay },
      );
      controllers.add(controller);
      driver.flush(1);

      await userEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
      expect(clicks).toEqual(["host", "ancestor"]);
    } finally {
      restore();
    }
  });

  it("uses native pointer capture from the HtmlBox event target", async () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const { canvas, overlay } = surface();
    let button!: HTMLButtonElement;
    let pointerId: number | undefined;
    let capturedDuringDispatch = false;
    const nativeCaptureEvents: string[] = [];
    const mount = (host: HTMLDivElement) => {
      button = document.createElement("button");
      host.addEventListener("gotpointercapture", (event) => {
        nativeCaptureEvents.push(`got:${(event as PointerEvent).pointerId}`);
      });
      host.addEventListener("lostpointercapture", (event) => {
        nativeCaptureEvents.push(`lost:${(event as PointerEvent).pointerId}`);
      });
      host.append(button);
      return () => undefined;
    };
    try {
      const controller = crc(
        canvas,
        <HtmlBox
          data={0}
          mount={mount}
          style={{ width: 100, height: 40 }}
          onPointerDown={(event) => {
            pointerId = event.pointerId;
            event.target.setPointerCapture(event.pointerId);
            capturedDuringDispatch = event.target.hasPointerCapture(event.pointerId);
          }}
        />,
        { htmlOverlay: overlay },
      );
      controllers.add(controller);
      driver.flush(1);

      await userEvent.click(button);
      expect(pointerId).toBeTypeOf("number");
      expect(capturedDuringDispatch).toBe(true);
      expect(nativeCaptureEvents).toEqual([`got:${pointerId}`, `lost:${pointerId}`]);
    } finally {
      restore();
    }
  });

  it("batches each HtmlBox native capture and bubble callback around descendant propagation", async () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const { canvas, overlay } = surface();
    const value = signal(0);
    const observed: number[] = [];
    const phases: string[] = [];
    getSignalNode(value).observers.add(() => observed.push(value.get()));
    let button!: HTMLButtonElement;
    const mount = (host: HTMLDivElement, _initial: number, abort: AbortSignal) => {
      button = document.createElement("button");
      button.addEventListener("click", () => {
        phases.push("native-descendant");
        expect(observed).toEqual([2]);
      }, { signal: abort });
      host.append(button);
      return () => undefined;
    };
    try {
      const controller = crc(
        canvas,
        <HtmlBox
          data={0}
          mount={mount}
          style={{ width: 100, height: 40 }}
          onClickCapture={() => {
            phases.push("host-capture");
            value.set(1);
            value.set(2);
            expect(observed).toEqual([]);
          }}
          onClick={() => {
            phases.push("host-bubble");
            expect(observed).toEqual([2]);
            value.set(3);
            value.set(4);
            expect(observed).toEqual([2]);
          }}
        />,
        { htmlOverlay: overlay },
      );
      controllers.add(controller);
      driver.flush(1);

      await userEvent.click(button);
      expect(phases).toEqual([
        "host-capture",
        "native-descendant",
        "host-bubble",
      ]);
      expect(observed).toEqual([2, 4]);
    } finally {
      restore();
    }
  });

  it("relays pointer and mouse enter/leave only when native focus crosses the host boundary", () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const { canvas, overlay } = surface();
    let first!: HTMLButtonElement;
    let second!: HTMLButtonElement;
    const trace: string[] = [];
    const mount = (host: HTMLDivElement) => {
      first = document.createElement("button");
      second = document.createElement("button");
      host.append(first, second);
      return () => undefined;
    };
    try {
      const controller = crc(
        canvas,
        <HtmlBox
          data={0}
          mount={mount}
          style={{ width: 100, height: 30 }}
          onPointerEnter={() => trace.push("pointer-enter")}
          onPointerLeave={(event) =>
            trace.push(`pointer-leave:${event.relatedTarget === null ? "outside" : "host"}`)
          }
          onMouseEnter={() => trace.push("mouse-enter")}
          onMouseLeave={(event) =>
            trace.push(`mouse-leave:${event.relatedTarget === null ? "outside" : "host"}`)
          }
        />,
        { htmlOverlay: overlay },
      );
      controllers.add(controller);
      driver.flush(1);

      const shell = overlay.querySelector<HTMLElement>("[data-crc-html-box]")!;
      // The browser delivers a real non-bubbling boundary event to the shell;
      // descendant transitions must not create a second HtmlBox entry.
      shell.dispatchEvent(new PointerEvent("pointerenter"));
      shell.dispatchEvent(new MouseEvent("mouseenter"));
      first.dispatchEvent(
        new PointerEvent("pointerout", { bubbles: true, relatedTarget: second }),
      );
      second.dispatchEvent(
        new PointerEvent("pointerover", { bubbles: true, relatedTarget: first }),
      );
      first.dispatchEvent(
        new MouseEvent("mouseout", { bubbles: true, relatedTarget: second }),
      );
      second.dispatchEvent(
        new MouseEvent("mouseover", { bubbles: true, relatedTarget: first }),
      );
      expect(trace).toEqual(["pointer-enter", "mouse-enter"]);

      shell.dispatchEvent(new PointerEvent("pointerleave"));
      shell.dispatchEvent(new MouseEvent("mouseleave"));
      expect(trace).toEqual([
        "pointer-enter",
        "mouse-enter",
        "pointer-leave:outside",
        "mouse-leave:outside",
      ]);
    } finally {
      restore();
    }
  });

  it("delivers native focus and blur in capture without bubbling them to CRC ancestors", () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const { canvas, overlay } = surface();
    let input!: HTMLInputElement;
    const trace: string[] = [];
    const mount = (host: HTMLDivElement) => {
      input = document.createElement("input");
      host.append(input);
      return () => undefined;
    };
    try {
      const controller = crc(
        canvas,
        <Group
          onFocusCapture={() => trace.push("group-focus-capture")}
          onFocus={() => trace.push("group-focus-bubble")}
          onBlurCapture={() => trace.push("group-blur-capture")}
          onBlur={() => trace.push("group-blur-bubble")}
        >
          <HtmlBox
            data={0}
            mount={mount}
            style={{ width: 100, height: 30 }}
            onFocus={() => trace.push("host-focus")}
            onBlur={() => trace.push("host-blur")}
          />
        </Group>,
        { htmlOverlay: overlay },
      );
      controllers.add(controller);
      driver.flush(1);
      input.focus();
      input.blur();
      expect(trace).toEqual([
        "group-focus-capture",
        "host-focus",
        "group-blur-capture",
        "host-blur",
      ]);
    } finally {
      restore();
    }
  });

  it("suppresses events while zero-scale geometry is inactive and restores the same host", () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const { canvas, overlay } = surface();
    let input!: HTMLInputElement;
    const samples: Array<[number, number, number, number]> = [];
    const mount = (host: HTMLDivElement) => {
      input = document.createElement("input");
      host.append(input);
      return () => undefined;
    };
    const scene = (scale: number) => (
      <Group style={{ scaleX: scale, scaleY: scale }}>
        <HtmlBox
          data={scale}
          mount={mount}
          style={{ width: 80, height: 30 }}
          onPointerMove={(event) =>
            samples.push([event.x, event.y, event.localX, event.localY])
          }
        />
      </Group>
    );
    try {
      const controller = crc(canvas, scene(1), { htmlOverlay: overlay });
      controllers.add(controller);
      driver.flush(1);
      const content = overlay.querySelector("[data-crc-html-content]")!;

      crc(canvas, scene(0));
      expect(() => driver.flush(2)).not.toThrow();
      dispatchPointer(input, 12, 14);
      expect(samples).toEqual([]);
      expect(overlay.querySelector("[data-crc-html-content]")).toBe(content);

      crc(canvas, scene(1));
      driver.flush(3);
      expect(overlay.querySelector("[data-crc-html-content]")).toBe(content);
      dispatchPointer(input, 12, 14);
      expect(samples).toHaveLength(1);
      expect(samples[0][2]).toBeCloseTo(samples[0][0]);
      expect(samples[0][3]).toBeCloseTo(samples[0][1]);
    } finally {
      restore();
    }
  });
});
