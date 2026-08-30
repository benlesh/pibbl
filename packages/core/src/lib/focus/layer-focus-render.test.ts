import { userEvent } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { crc } from "../crc";
import { defineComp } from "../define-comp";
import { getCRCInstance } from "../global-state";
import { crcEventTarget } from "../hooks/crc-event-target";
import { crcState } from "../hooks/crc-state";
import { layer } from "../components/layer";
import { rect } from "../components/rect";
import { g } from "../components/g";
import type { CompEl, CRCController } from "../types";
import { withFocusManagement } from "./with-focus-management";

const activeControllers = new Set<CRCController>();

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(() => {
  for (const controller of activeControllers) controller.dispose();
  activeControllers.clear();
  document.body.replaceChildren();
});

describe("focus snapshots in cached layers", () => {
  it("repaints an affected layer for Tab, pointer, and blur transitions only", async () => {
    let layerRenders = 0;
    let unrelatedLayerRenders = 0;
    let updateUnrelated!: () => void;
    const FocusTarget = defineComp(() => {
      layerRenders++;
      const snapshot = crcEventTarget(
        { onClick: () => undefined },
        { path: rectanglePath(0, 0, 80, 80), fill: true },
      );
      return rect({
        style: {
          width: 80,
          height: 80,
          fill: snapshot.isFocusVisible
            ? "#00ff00"
            : snapshot.isFocused
              ? "#ff0000"
              : "#0000ff",
        },
      });
    });
    const UnrelatedLayer = defineComp(() => {
      unrelatedLayerRenders++;
      return rect({
        style: { width: 80, height: 80, fill: "#ffff00" },
      });
    });
    const Root = defineComp(() => {
      const [version, setVersion] = crcState(0);
      updateUnrelated = () => setVersion(version + 1);
      return [
        layer({
          style: { width: 80, height: 80 },
          render: FocusTarget({}),
        }),
        g({
          style: { translateX: 100 },
          children: [
            layer({
              style: { width: 80, height: 80 },
              render: UnrelatedLayer({}),
            }),
          ],
        }),
      ];
    });
    const mounted = mount(withFocusManagement(Root({})));
    await nextFrame();

    expect(layerRenders).toBe(1);
    expect(unrelatedLayerRenders).toBe(1);
    expect(pixel(mounted.canvas)).toEqual([0, 0, 255, 255]);

    updateUnrelated();
    await nextFrame();
    expect(layerRenders).toBe(1);

    mounted.before.focus();
    await userEvent.tab();
    await nextFrame();
    expect(document.activeElement).toBe(mounted.canvas);
    expect(layerRenders).toBe(2);
    expect(pixel(mounted.canvas)).toEqual([0, 255, 0, 255]);

    mounted.after.focus();
    await nextFrame();
    expect(layerRenders).toBe(3);
    expect(pixel(mounted.canvas)).toEqual([0, 0, 255, 255]);

    await userEvent.click(mounted.canvas, { position: { x: 10, y: 10 } });
    await nextFrame();
    expect(layerRenders).toBe(4);
    expect(pixel(mounted.canvas)).toEqual([255, 0, 0, 255]);

    mounted.after.focus();
    await nextFrame();
    expect(layerRenders).toBe(5);
    expect(unrelatedLayerRenders).toBe(1);
    expect(pixel(mounted.canvas)).toEqual([0, 0, 255, 255]);
  });

  it("keeps inert focus snapshots cached when focus management is absent", async () => {
    let layerRenders = 0;
    let updateUnrelated!: () => void;
    const InertTarget = defineComp(() => {
      layerRenders++;
      const snapshot = crcEventTarget(
        { onClick: () => undefined },
        { path: rectanglePath(0, 0, 80, 80), fill: true },
      );
      return rect({
        style: {
          width: 80,
          height: 80,
          fill: snapshot.isFocused ? "#ff0000" : "#0000ff",
        },
      });
    });
    const Root = defineComp(() => {
      const [version, setVersion] = crcState(0);
      updateUnrelated = () => setVersion(version + 1);
      return layer({
        style: { width: 100, height: 100 },
        render: InertTarget({}),
      });
    });
    const mounted = mount(Root({}));
    await nextFrame();

    updateUnrelated();
    await nextFrame();

    expect(layerRenders).toBe(1);
    expect(pixel(mounted.canvas)).toEqual([0, 0, 255, 255]);
    expect(
      getCRCInstance(mounted.canvas).eventRoot.focusPolicy,
    ).toBeUndefined();
  });

  it("repaints the first focus transition after a layer replaces its focus manager", async () => {
    let layerRenders = 0;
    let replaceTarget!: () => void;
    const FocusTarget = defineComp(({ version }: { version: number }) => {
      layerRenders++;
      const snapshot = crcEventTarget(
        { onClick: () => undefined },
        { path: rectanglePath(0, 0, 80, 80), fill: true },
      );
      return rect({
        style: {
          width: 80,
          height: 80,
          fill: snapshot.isFocusVisible ? "#00ff00" : "#0000ff",
        },
      });
    });
    const Root = defineComp(() => {
      const [version, setVersion] = crcState(0);
      replaceTarget = () => setVersion(version + 1);
      return layer({
        style: { width: 80, height: 80 },
        render: withFocusManagement(FocusTarget({
          key: `target-${version}`,
          version,
        })),
      });
    });
    const mounted = mount(Root({}));
    await nextFrame();

    mounted.before.focus();
    await userEvent.tab();
    await nextFrame();
    expect(layerRenders).toBe(2);
    expect(pixel(mounted.canvas)).toEqual([0, 255, 0, 255]);

    replaceTarget();
    await nextFrame();
    expect(document.activeElement).toBe(mounted.canvas);
    expect(layerRenders).toBe(3);
    expect(pixel(mounted.canvas)).toEqual([0, 0, 255, 255]);

    await userEvent.tab();
    await nextFrame();
    expect(document.activeElement).toBe(mounted.canvas);
    expect(layerRenders).toBe(4);
    expect(pixel(mounted.canvas)).toEqual([0, 255, 0, 255]);
  });
});

function mount(element: CompEl<any, any>) {
  const before = document.createElement("button");
  before.textContent = "before";
  const canvas = document.createElement("canvas");
  canvas.width = 200;
  canvas.height = 100;
  canvas.style.cssText = "display:block;width:200px;height:100px";
  const after = document.createElement("button");
  after.textContent = "after";
  document.body.append(before, canvas, after);
  const controller = crc(canvas, element, { pixelRatio: 1 });
  activeControllers.add(controller);
  return { after, before, canvas };
}

function rectanglePath(
  x: number,
  y: number,
  width: number,
  height: number,
): Path2D {
  const path = new Path2D();
  path.rect(x, y, width, height);
  return path;
}

function pixel(canvas: HTMLCanvasElement): number[] {
  return Array.from(canvas.getContext("2d")!.getImageData(10, 10, 1, 1).data);
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
