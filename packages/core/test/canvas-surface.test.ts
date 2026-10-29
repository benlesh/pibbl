import { pibblSync } from "@pibbl/core/sync";
import {
  FocusManagement,
  Group,
  Layer,
  Rectangle,
  createElement,
} from "@pibbl/core";
import {
  canvasSurfaceScenarioEntry,
  loadScenario,
  type CanvasSurfaceState,
  type ScenarioController,
} from "../../scenarios/src/index";
import { afterEach, describe, expect, it } from "vitest";
import { clickMouse } from "./support/mouse-input";
import canvasSurfaceSource from "../../scenarios/src/canvas-surface.example.tsx?raw";

let activeController: ScenarioController<CanvasSurfaceState> | undefined;

afterEach(async () => {
  await activeController?.dispose();
  activeController = undefined;
  document.body.replaceChildren();
});

describe("Canvas surface public contract", () => {
  it("proves fixed density, responsive reflow, stable identity, and logical mouse coordinates", async () => {
    expect(canvasSurfaceSource).toContain(
      canvasSurfaceScenarioEntry.source.marker,
    );
    const definition = await loadScenario(canvasSurfaceScenarioEntry);
    const canvas = document.createElement("canvas");
    canvas.width = canvasSurfaceScenarioEntry.canvas.width;
    canvas.height = canvasSurfaceScenarioEntry.canvas.height;
    canvas.style.display = "block";
    document.body.appendChild(canvas);

    const controller = await definition.mount({ canvas });
    activeController = controller;
    await controller.settled();

    expect(controller.getState()).toMatchObject({
      mode: "fixed",
      cssWidth: 480,
      cssHeight: 240,
      logicalWidth: 480,
      logicalHeight: 240,
      backingWidth: 960,
      backingHeight: 480,
      pixelRatio: 2,
    });
    const fixedIdentity = controller.getState().identity;

    await controller.perform("resize-fixed");
    expect(controller.getState()).toMatchObject({
      mode: "fixed",
      cssWidth: 720,
      cssHeight: 360,
      logicalWidth: 480,
      logicalHeight: 240,
      backingWidth: 1440,
      backingHeight: 720,
      identity: fixedIdentity,
    });

    await controller.perform("show-responsive");
    expect(controller.getState()).toMatchObject({
      mode: "responsive",
      logicalWidth: 720,
      logicalHeight: 360,
      backingWidth: 1440,
      backingHeight: 720,
    });
    const responsiveIdentity = controller.getState().identity;
    expect(responsiveIdentity).not.toBe(fixedIdentity);

    await controller.perform("resize-responsive");
    expect(controller.getState()).toMatchObject({
      mode: "responsive",
      cssWidth: 600,
      cssHeight: 300,
      logicalWidth: 600,
      logicalHeight: 300,
      backingWidth: 1200,
      backingHeight: 600,
      identity: responsiveIdentity,
    });

    canvas.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        clientX: canvas.getBoundingClientRect().left + 300,
        clientY: canvas.getBoundingClientRect().top + 150,
      }),
    );
    expect(controller.getState().lastCoordinates).toEqual([300, 150]);

    await controller.reset();
    expect(controller.getState()).toMatchObject({
      mode: "fixed",
      cssWidth: 480,
      cssHeight: 240,
      logicalWidth: 480,
      logicalHeight: 240,
      backingWidth: 960,
      backingHeight: 480,
    });
  });

  it("rounds only backing dimensions across fractional densities while preserving logical Layer geometry and interaction", async () => {
    const samples: Array<{
      pixelRatio: number;
      backingWidth: number;
      backingHeight: number;
      hits: readonly [number, number][];
    }> = [];

    for (const pixelRatio of [1, 1.5, 2]) {
      const canvas = document.createElement("canvas");
      canvas.width = 101;
      canvas.height = 61;
      canvas.style.cssText = "display:block;width:101px;height:61px";
      document.body.append(canvas);

      const hits: Array<[number, number]> = [];
      let focusCount = 0;
      const target = createElement(Rectangle, {
        keyboardFocusable: true,
        onFocus: () => {
          focusCount++;
        },
        onClick: (event) => hits.push([event.x, event.y]),
        style: {
          width: 0.125,
          height: 0.125,
          fill: "#2563eb",
        },
      });
      const scene = createElement(FocusManagement, {
        children: createElement(Group, {
          style: { translateX: 1_000_000.25, translateY: 1_000_000.25 },
          children: createElement(Group, {
            style: { translateX: -1_000_000, translateY: -1_000_000 },
            children: createElement(Group, {
              style: { translateX: -0.5, translateY: -0.5 },
              children: createElement(Layer, {
                // The retained Layer begins at 1.125 after the three Group
                // transforms. A local independent pixel round would miss this
                // 0.125-wide target at the chosen fractional point.
                style: { left: 1.375, top: 1.375, width: 0.375, height: 0.375 },
                children: target,
              }),
            }),
          }),
        }),
      });
      const controller = pibblSync(canvas, scene, {
        viewport: { width: 6.3125, height: 3.8125 },
        fit: "fill",
        pixelRatio,
      });
      try {
        await settleSurface();
        // Native MouseEvent client coordinates are integral in Chromium. A 16×
        // display scale makes the fractional logical center an integer CSS point.
        await clickMouse(canvas, { x: 19, y: 19 });
        expect(document.activeElement).toBe(canvas);
        expect(hits).toHaveLength(1);
        expect(focusCount).toBe(1);
        expect(hits[0]![0]).toBeCloseTo(1.1875, 6);
        expect(hits[0]![1]).toBeCloseTo(1.1875, 6);
        samples.push({
          pixelRatio,
          backingWidth: canvas.width,
          backingHeight: canvas.height,
          hits,
        });
      } finally {
        controller.dispose();
        canvas.remove();
      }
    }

    expect(
      samples.map(({ pixelRatio, backingWidth, backingHeight }) => ({
        pixelRatio,
        backingWidth,
        backingHeight,
      })),
    ).toEqual([
      { pixelRatio: 1, backingWidth: 101, backingHeight: 61 },
      { pixelRatio: 1.5, backingWidth: 152, backingHeight: 92 },
      { pixelRatio: 2, backingWidth: 202, backingHeight: 122 },
    ]);
  });
  it("keeps a fractional fixed viewport while display resizing rounds only the backing store", async () => {
    const definition = await loadScenario(canvasSurfaceScenarioEntry);
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 240;
    canvas.style.display = "block";
    document.body.append(canvas);
    const controller = await definition.mount({ canvas });
    activeController = controller;
    await controller.settled();
    await controller.perform("show-fractional");
    expect(controller.getState()).toMatchObject({
      mode: "fractional",
      cssWidth: 201.25,
      cssHeight: 100.5,
      logicalWidth: 101.5,
      logicalHeight: 47.25,
      backingWidth: 302,
      backingHeight: 151,
      pixelRatio: 1.5,
    });
    const identity = controller.getState().identity;
    await controller.perform("resize-fractional");
    expect(controller.getState()).toMatchObject({
      mode: "fractional",
      cssWidth: 240.75,
      cssHeight: 120.25,
      logicalWidth: 101.5,
      logicalHeight: 47.25,
      backingWidth: 361,
      backingHeight: 180,
      pixelRatio: 1.5,
      identity,
    });
    const bounds = canvas.getBoundingClientRect();
    const clientX = Math.round(bounds.left + 100),
      clientY = Math.round(bounds.top + 50);
    canvas.dispatchEvent(
      new MouseEvent("mousemove", { bubbles: true, clientX, clientY }),
    );
    expect(controller.getState().lastCoordinates![0]).toBeCloseTo(
      clientX - bounds.left - (240.75 - 101.5) / 2,
      6,
    );
    expect(controller.getState().lastCoordinates![1]).toBeCloseTo(
      clientY - bounds.top - (120.25 - 47.25) / 2,
      6,
    );
  });
});

async function settleSurface(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
