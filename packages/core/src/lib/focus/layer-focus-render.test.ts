import { userEvent } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { crc } from "../crc";
import { getCRCInstance } from "../global-state";
import { useEventTarget } from "../hooks/use-event-target";
import { useSignal } from "../hooks/use-signal";
import { Layer } from "../components/layer";
import { Rectangle } from "../components/rect";
import { Group } from "../components/g";
import {
  releaseTarget,
  type CRCEventTargetRegistration,
} from "../events/registrations";
import type { CRCElement, CRCController } from "../types";
import { directionalPolicy, focusManaged } from "./policy-test-support";
import { createElement } from '../element/create-element';

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
  it("replays mixed retained targets once in root registration order and excludes dead siblings", async () => {
    const Target = (_props: { label: string }) => {
      useEventTarget(
        { onClick: () => undefined },
        {
          path: rectanglePath(0, 0, 10, 10),
          fill: true,
          keyboardNavigationBounds: { x: 0, y: 0, width: 10, height: 10 },
        },
      );
    };
    const mounted = mount(focusManaged(createElement(Group, {
      children: [
        createElement(Layer, {
          key: "retained",
          style: { width: 80, height: 80 },
          children: ["backend-a", "path-b", "backend-c", "dead-d", "path-e"]
            .map(label => createElement(Target, { key: label, label })),
        }),
        createElement(Layer, {
          key: "sibling",
          style: { width: 80, height: 80 },
          children: createElement(Target, { label: "sibling" }),
        }),
      ],
    })));
    await nextFrame();
    const manager = getCRCInstance(mounted.canvas).eventRoot.focusPolicy as
      NonNullable<ReturnType<typeof getCRCInstance>["eventRoot"]["focusPolicy"]> & {
        readonly candidates: ReadonlyArray<{
          readonly target: CRCEventTargetRegistration;
        }>;
        beginCollection(): void;
        finishCollection(success: boolean): void;
      };
    const targets = new Map(manager.candidates.map(candidate => [
      (candidate.target.component.element.props as { label: string }).label,
      candidate.target,
    ]));
    const retainedOwner = targets.get("backend-a")!.owner;
    const siblingRoot = mount(focusManaged(createElement(Target, {
      label: "sibling-root",
    })));
    await nextFrame();
    const siblingRootManager = getCRCInstance(siblingRoot.canvas).eventRoot
      .focusPolicy as NonNullable<ReturnType<
        typeof getCRCInstance
      >["eventRoot"]["focusPolicy"]> & {
        readonly candidates: ReadonlyArray<{
          readonly target: CRCEventTargetRegistration;
        }>;
      };
    const siblingRootTarget = siblingRootManager.candidates[0]!.target;
    retainedOwner.eventRoot.targets.add(siblingRootTarget);
    for (const label of ["backend-a", "backend-c"]) {
      const target = targets.get(label)!;
      target.owner.paintEntries.delete(target.paintEntry!);
      target.paintEntry = undefined;
    }
    const reattached = targets.get("path-b")!;
    const reattachedEntry = reattached.paintEntry!;
    reattached.owner.paintEntries.delete(reattachedEntry);
    reattached.owner.paintEntries.add(reattachedEntry);
    reattached.owner.eventRoot.targets.delete(reattached);
    reattached.owner.eventRoot.targets.add(reattached);
    releaseTarget(targets.get("dead-d")!);

    manager.beginCollection();
    manager.replayRetainedSubtree(retainedOwner);
    manager.finishCollection(true);

    const replayedLabels = manager.candidates.map(candidate =>
      (candidate.target.component.element.props as { label: string }).label
    );
    expect(replayedLabels).toEqual([
      "backend-a",
      "backend-c",
      "path-e",
      "path-b",
    ]);
    expect(new Set(manager.candidates.map(candidate => candidate.target)).size)
      .toBe(manager.candidates.length);
    expect(replayedLabels).not.toContain("dead-d");
    expect(replayedLabels).not.toContain("sibling");
    expect(replayedLabels).not.toContain("sibling-root");
    retainedOwner.eventRoot.targets.delete(siblingRootTarget);
  });

  it("replays geometry-independent backend targets with their retained directional boundary", async () => {
    const BackendTarget = (_props: {}) => {
      useEventTarget(
        { onClick: () => undefined },
        {
          path: rectanglePath(0, 0, 20, 10),
          fill: true,
          keyboardNavigationBounds: { x: 4, y: 5, width: 20, height: 10 },
        },
      );
    };
    const mounted = mount(focusManaged(directionalPolicy(
      createElement(BackendTarget, {}),
    )));
    await nextFrame();
    const manager = getCRCInstance(mounted.canvas).eventRoot.focusPolicy as
      NonNullable<ReturnType<typeof getCRCInstance>["eventRoot"]["focusPolicy"]> & {
        readonly candidates: ReadonlyArray<{
          readonly target: CRCEventTargetRegistration;
          readonly directionalBoundary: unknown;
          readonly rootBounds: unknown;
        }>;
        beginCollection(): void;
        finishCollection(success: boolean): void;
      };
    const original = manager.candidates[0]!;
    const target = original.target;

    target.owner.paintEntries.delete(target.paintEntry!);
    target.paintEntry = undefined;
    manager.beginCollection();
    manager.replayRetainedSubtree(target.owner);
    manager.finishCollection(true);

    expect(manager.candidates).toHaveLength(1);
    expect(manager.candidates[0]).toMatchObject({
      target,
      directionalBoundary: original.directionalBoundary,
      rootBounds: { x: 4, y: 5, width: 20, height: 10 },
    });
  });

  it("repaints an affected layer for Tab, pointer, and blur transitions only", async () => {
    let layerRenders = 0;
    let unrelatedLayerRenders = 0;
    let updateUnrelated!: () => void;
    const FocusTarget = (_props: {}) => {
      layerRenders++;
      const snapshot = useEventTarget(
        { onClick: () => undefined },
        { path: rectanglePath(0, 0, 80, 80), fill: true },
      );
      return createElement(Rectangle, {
        pointerEvents: 'none',
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
    };
    const UnrelatedLayer = (_props: {}) => {
      unrelatedLayerRenders++;
      return createElement(Rectangle, {
        style: { width: 80, height: 80, fill: "#ffff00" },
      });
    };
    const Root = (_props: {}) => {
      const version = useSignal(0);
      updateUnrelated = () => version.update(value => value + 1);
      return [
        createElement(Layer, {
          style: { width: 80, height: 80 },
          children: createElement(FocusTarget, {}),
        }),
        createElement(Group, {
          style: { translateX: 100 },
          children: [
            createElement(Layer, {
              style: { width: 80, height: 80 },
              children: createElement(UnrelatedLayer, {}),
            }),
          ],
        }),
      ];
    };
    const mounted = mount(focusManaged(createElement(Root, {})));
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
    const InertTarget = (_props: {}) => {
      layerRenders++;
      const snapshot = useEventTarget(
        { onClick: () => undefined },
        { path: rectanglePath(0, 0, 80, 80), fill: true },
      );
      return createElement(Rectangle, {
        pointerEvents: 'none',
        style: {
          width: 80,
          height: 80,
          fill: snapshot.isFocused ? "#ff0000" : "#0000ff",
        },
      });
    };
    const Root = (_props: {}) => {
      const version = useSignal(0);
      updateUnrelated = () => version.update(value => value + 1);
      return createElement(Layer, {
        style: { width: 100, height: 100 },
        children: createElement(InertTarget, {}),
      });
    };
    const mounted = mount(createElement(Root, {}));
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
    const FocusTarget = (_props: {}) => {
      layerRenders++;
      const snapshot = useEventTarget(
        { onClick: () => undefined },
        { path: rectanglePath(0, 0, 80, 80), fill: true },
      );
      return createElement(Rectangle, {
        pointerEvents: 'none',
        style: {
          width: 80,
          height: 80,
          fill: snapshot.isFocusVisible ? "#00ff00" : "#0000ff",
        },
      });
    };
    const Root = (_props: {}) => {
      const version = useSignal(0);
      replaceTarget = () => version.update(value => value + 1);
      return createElement(Layer, {
        style: { width: 80, height: 80 },
        children: focusManaged(createElement(FocusTarget, {
          key: `target-${version.get()}`,
        })),
      });
    };
    const mounted = mount(createElement(Root, {}));
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

describe("focus snapshots during manager removal", () => {
  it("paints and exposes an unfocused snapshot in the removal render", async () => {
    let removeManager!: () => void;
    const snapshots: Array<{
      readonly isFocused: boolean;
      readonly isFocusVisible: boolean;
    }> = [];
    const FocusTarget = (_props: {}) => {
      const snapshot = useEventTarget(
        { onClick: () => undefined },
        { path: rectanglePath(0, 0, 80, 80), fill: true },
      );
      snapshots.push(snapshot);
      return createElement(Rectangle, {
        pointerEvents: 'none',
        style: {
          width: 80,
          height: 80,
          fill: snapshot.isFocusVisible ? "#00ff00" : "#0000ff",
        },
      });
    };
    const Root = (_props: {}) => {
      const managed = useSignal(true);
      removeManager = () => managed.set(false);
      const target = createElement(FocusTarget, {});
      return managed.get() ? focusManaged(target) : target;
    };
    const mounted = mount(createElement(Root, {}));
    await nextFrame();

    mounted.before.focus();
    await userEvent.tab();
    await nextFrame();
    expect(snapshots.at(-1)).toEqual({
      isFocused: true,
      isFocusVisible: true,
    });
    expect(pixel(mounted.canvas)).toEqual([0, 255, 0, 255]);

    removeManager();
    await nextFrame();

    expect(snapshots.at(-1)).toEqual({
      isFocused: false,
      isFocusVisible: false,
    });
    expect(pixel(mounted.canvas)).toEqual([0, 0, 255, 255]);
    expect(getCRCInstance(mounted.canvas).eventRoot.focusPolicy).toBeUndefined();
  });

  it("invalidates a cached descendant layer when its ancestor manager is removed", async () => {
    let layerRenders = 0;
    let removeManager!: () => void;
    const snapshots: Array<{
      readonly isFocused: boolean;
      readonly isFocusVisible: boolean;
    }> = [];
    const FocusTarget = (_props: {}) => {
      layerRenders++;
      const snapshot = useEventTarget(
        { onClick: () => undefined },
        { path: rectanglePath(0, 0, 80, 80), fill: true },
      );
      snapshots.push(snapshot);
      return createElement(Rectangle, {
        style: {
          width: 80,
          height: 80,
          fill: snapshot.isFocusVisible ? "#00ff00" : "#0000ff",
        },
      });
    };
    const LayerHost = (_props: {}) => createElement(Layer, {
      style: { width: 80, height: 80 },
      children: createElement(FocusTarget, {}),
    });
    const Root = (_props: {}) => {
      const managed = useSignal(true);
      removeManager = () => managed.set(false);
      const host = createElement(LayerHost, {});
      return managed.get() ? focusManaged(host) : host;
    };
    const mounted = mount(createElement(Root, {}));
    await nextFrame();

    mounted.before.focus();
    await userEvent.tab();
    await nextFrame();
    expect(layerRenders).toBe(2);
    expect(pixel(mounted.canvas)).toEqual([0, 255, 0, 255]);

    removeManager();
    await nextFrame();

    expect(layerRenders).toBe(3);
    expect(snapshots.at(-1)).toEqual({
      isFocused: false,
      isFocusVisible: false,
    });
    expect(pixel(mounted.canvas)).toEqual([0, 0, 255, 255]);
    expect(getCRCInstance(mounted.canvas).eventRoot.focusPolicy).toBeUndefined();
  });
});

function mount(element: CRCElement<any>) {
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
