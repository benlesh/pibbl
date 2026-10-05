import { afterEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import {
  pibbl,
  FocusManagement,
  Group,
  HtmlBox,
  Layer,
  Rectangle,
  type PibblController,
} from "@pibbl/core";
import { getPibblInstance, clearSharedState } from "../src/lib/global-state.js";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../src/lib/scheduler/testing.js";
import { isHtmlFocusCandidate } from "../src/lib/focus/types.js";
import { moveTab } from "../src/lib/focus/keyboard-defaults.js";
import type { PibblFocusManager } from "../src/lib/focus/focus-manager.js";

const controllers = new Set<PibblController>();

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  clearSharedState();
  document.body.replaceChildren();
});

describe("HtmlBox managed native focus", () => {
  it("keeps HtmlBox in mixed source order through a clean Layer replay", () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const { canvas, overlay } = htmlSurface();
    const mount = (
      content: HTMLDivElement,
      _initial: string,
      _signal: AbortSignal,
    ) => {
      const input = document.createElement("input");
      input.setAttribute("aria-label", "middle");
      content.append(input);
      return () => undefined;
    };
    const scene = (key: string) => (
      <FocusManagement>
        <Group>
          <Rectangle
            key="before"
            style={{ left: 0, top: 0, width: 20, height: 20 }}
            onClick={() => undefined}
          />
          <Layer style={{ width: 100, height: 40 }}>
            <HtmlBox
              key={key}
              data="middle"
              mount={mount}
              style={{ width: 80, height: 24 }}
            />
          </Layer>
          <Rectangle
            key="after"
            style={{ left: 120, top: 0, width: 20, height: 20 }}
            onClick={() => undefined}
          />
        </Group>
      </FocusManagement>
    );
    try {
      const controller = pibbl(canvas, scene("stable"), { htmlOverlay: overlay });
      controllers.add(controller);
      driver.flush(10);
      expect(candidateKinds(canvas)).toEqual(["canvas", "html", "canvas"]);

      // A root update retains the Layer subtree; focus metadata must replay in
      // its original mixed position instead of appending HtmlBox after Canvas.
      pibbl(canvas, scene("stable"));
      driver.flush(20);
      expect(candidateKinds(canvas)).toEqual(["canvas", "html", "canvas"]);
    } finally {
      restore();
    }
  });

  it("adopts programmatic native focus, preserves native activation, and returns focus on removal", async () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const { canvas, overlay } = htmlSurface();
    let input: HTMLInputElement | undefined;
    let button: HTMLButtonElement | undefined;
    let clicks = 0;
    const mount = (
      content: HTMLDivElement,
      _initial: boolean,
      signal: AbortSignal,
    ) => {
      input = document.createElement("input");
      button = document.createElement("button");
      button.textContent = "native";
      button.addEventListener(
        "click",
        () => {
          clicks++;
        },
        { signal },
      );
      content.append(input, button);
      return () => undefined;
    };
    const scene = (show: boolean) => (
      <FocusManagement>
        <Group>
          <Rectangle
            style={{ left: 0, top: 0, width: 20, height: 20 }}
            onClick={() => undefined}
          />
          {show && (
            <HtmlBox
              data={show}
              mount={mount}
              style={{ width: 100, height: 30 }}
            />
          )}
          <Rectangle
            style={{ left: 120, top: 0, width: 20, height: 20 }}
            onClick={() => undefined}
          />
        </Group>
      </FocusManagement>
    );
    let controller: PibblController | undefined;
    try {
      controller = pibbl(canvas, scene(true), { htmlOverlay: overlay });
      controllers.add(controller);
      driver.flush(10);
      input!.focus({ preventScroll: true });
      await Promise.resolve();
      expect(document.activeElement).toBe(input);
      button!.click();
      expect(clicks).toBe(1);

      pibbl(canvas, scene(false));
      driver.flush(20);
      await Promise.resolve();
      expect(document.activeElement).toBe(canvas);
      driver.flush(30);
    } finally {
      controller?.dispose();
      controllers.delete(controller!);
      restore();
    }
  });

  it("excludes pointerEvents none HtmlBox from managed navigation", () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const { canvas, overlay } = htmlSurface();
    const mount = (
      content: HTMLDivElement,
      _initial: string,
      _signal: AbortSignal,
    ) => {
      content.append(document.createElement("input"));
      return () => undefined;
    };
    try {
      const controller = pibbl(
        canvas,
        <FocusManagement>
          <HtmlBox
            data="disabled"
            mount={mount}
            pointerEvents="none"
            style={{ width: 100, height: 30 }}
          />
        </FocusManagement>,
        { htmlOverlay: overlay },
      );
      controllers.add(controller);
      driver.flush(10);
      expect(candidateKinds(canvas)).toEqual([]);
      expect(
        overlay.querySelector<HTMLElement>("[data-pibbl-html-box]")!.inert,
      ).toBe(true);
    } finally {
      restore();
    }
  });

  it("relays native Tab between surrounding controls and honors a cancelled boundary Tab", async () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const before = document.createElement("button");
    const after = document.createElement("button");
    const { canvas, overlay } = htmlSurface();
    document.body.prepend(before);
    document.body.append(after);
    let input: HTMLInputElement | undefined;
    const mount = (
      content: HTMLDivElement,
      _initial: boolean,
      _signal: AbortSignal,
    ) => {
      input = document.createElement("input");
      content.append(input);
      return () => undefined;
    };
    let controller: PibblController | undefined;
    try {
      controller = pibbl(
        canvas,
        <FocusManagement>
          <HtmlBox
            data={true}
            mount={mount}
            style={{ width: 100, height: 30 }}
          />
        </FocusManagement>,
        { htmlOverlay: overlay },
      );
      controllers.add(controller);
      driver.flush(10);

      before.focus();
      await userEvent.tab();
      expect(document.activeElement).toBe(input);
      await userEvent.tab();
      expect(document.activeElement).toBe(after);
      await userEvent.tab({ shift: true });
      expect(document.activeElement).toBe(input);

      input!.addEventListener("keydown", (event) => {
        if (event.key === "Tab") event.preventDefault();
      });
      await userEvent.tab();
      expect(document.activeElement).toBe(input);
    } finally {
      controller?.dispose();
      if (controller) controllers.delete(controller);
      restore();
    }
  });

  it("re-evaluates native radio, disabled fieldset, and details eligibility at entry", async () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const { canvas, overlay } = htmlSurface();
    let disabledField: HTMLInputElement | undefined;
    let details: HTMLDetailsElement | undefined;
    const mount = (
      content: HTMLDivElement,
      _initial: boolean,
      _signal: AbortSignal,
    ) => {
      const fieldset = document.createElement("fieldset");
      fieldset.disabled = true;
      disabledField = document.createElement("input");
      fieldset.append(disabledField);
      details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "more";
      details.append(summary, document.createElement("input"));
      const firstRadio = document.createElement("input");
      firstRadio.type = "radio";
      firstRadio.name = "choice";
      const checkedRadio = document.createElement("input");
      checkedRadio.type = "radio";
      checkedRadio.name = "choice";
      checkedRadio.checked = true;
      content.append(fieldset, details, firstRadio, checkedRadio);
      return (enabled: boolean) => {
        fieldset.disabled = !enabled;
        details!.open = enabled;
      };
    };
    let controller: PibblController | undefined;
    try {
      controller = pibbl(
        canvas,
        <FocusManagement>
          <HtmlBox
            data={false}
            mount={mount}
            style={{ width: 100, height: 30 }}
          />
        </FocusManagement>,
        { htmlOverlay: overlay },
      );
      controllers.add(controller);
      driver.flush(10);
      expect(focusFirstNavigationCandidate(canvas)).toBe(true);
      expect(document.activeElement?.tagName).toBe("SUMMARY");
      await userEvent.tab();
      expect((document.activeElement as HTMLInputElement).type).toBe("radio");
      expect((document.activeElement as HTMLInputElement).checked).toBe(true);

      pibbl(
        canvas,
        <FocusManagement>
          <HtmlBox
            data={true}
            mount={mount}
            style={{ width: 100, height: 30 }}
          />
        </FocusManagement>,
      );
      driver.flush(20);
      expect(focusFirstNavigationCandidate(canvas)).toBe(true);
      expect(document.activeElement).toBe(disabledField);
      expect(details!.open).toBe(true);
    } finally {
      controller?.dispose();
      if (controller) controllers.delete(controller);
      restore();
    }
  });

  it("removes a zero-scale HtmlBox from managed navigation without unmounting it", () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const { canvas, overlay } = htmlSurface();
    const mount = (
      content: HTMLDivElement,
      _initial: boolean,
      _signal: AbortSignal,
    ) => {
      content.append(document.createElement("input"));
      return () => undefined;
    };
    const scene = (visible: boolean) => (
      <FocusManagement>
        <Group style={{ scaleX: visible ? 1 : 0 }}>
          <HtmlBox
            data={visible}
            mount={mount}
            style={{ width: 100, height: 30 }}
          />
        </Group>
      </FocusManagement>
    );
    let controller: PibblController | undefined;
    try {
      controller = pibbl(canvas, scene(true), { htmlOverlay: overlay });
      controllers.add(controller);
      driver.flush(10);
      expect(candidateKinds(canvas)).toEqual(["html"]);
      pibbl(canvas, scene(false));
      driver.flush(20);
      expect(candidateKinds(canvas)).toEqual([]);
      expect(
        overlay.querySelector<HTMLElement>("[data-pibbl-html-box]"),
      ).not.toBeNull();
    } finally {
      controller?.dispose();
      if (controller) controllers.delete(controller);
      restore();
    }
  });

  it("skips an empty managed HtmlBox and uses it again when a control becomes eligible", () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const { canvas, overlay } = htmlSurface();
    let field: HTMLInputElement | undefined;
    const mount = (
      content: HTMLDivElement,
      _initial: boolean,
      _signal: AbortSignal,
    ) => {
      field = document.createElement("input");
      field.disabled = true;
      content.append(field);
      return (enabled: boolean) => {
        field!.disabled = !enabled;
      };
    };
    const scene = (enabled: boolean) => (
      <FocusManagement>
        <Group>
          <Rectangle
            style={{ left: 0, top: 0, width: 10, height: 10 }}
            onClick={() => undefined}
          />
          <HtmlBox
            data={enabled}
            mount={mount}
            style={{ width: 100, height: 30 }}
          />
          <Rectangle
            style={{ left: 120, top: 0, width: 10, height: 10 }}
            onClick={() => undefined}
          />
        </Group>
      </FocusManagement>
    );
    let controller: PibblController | undefined;
    try {
      controller = pibbl(canvas, scene(false), { htmlOverlay: overlay });
      controllers.add(controller);
      driver.flush(10);
      const manager = focusManager(canvas);
      expect(
        manager.focusNavigationCandidate(
          manager.navigationCandidates[0],
          "keyboard",
        ),
      ).toBe(true);
      expect(moveTab(manager, false)).toBe("moved");
      expect(manager.focusedNavigationCandidate).toBe(
        manager.navigationCandidates[2],
      );

      pibbl(canvas, scene(true));
      driver.flush(20);
      expect(
        manager.focusNavigationCandidate(
          manager.navigationCandidates[0],
          "keyboard",
        ),
      ).toBe(true);
      expect(moveTab(manager, false)).toBe("moved");
      expect(document.activeElement).toBe(field);
    } finally {
      controller?.dispose();
      if (controller) controllers.delete(controller);
      restore();
    }
  });

  it("keeps keyed HtmlBox content mounted while its managed source order changes", () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const { canvas, overlay } = htmlSurface();
    const mounts: string[] = [];
    const mount = (
      content: HTMLDivElement,
      initial: string,
      _signal: AbortSignal,
    ) => {
      mounts.push(initial);
      const input = document.createElement("input");
      input.dataset.name = initial;
      content.append(input);
      return () => undefined;
    };
    const scene = (order: readonly string[]) => (
      <FocusManagement>
        <Group>
          {order.map((name) => (
            <HtmlBox
              key={name}
              data={name}
              mount={mount}
              style={{ width: 100, height: 30 }}
            />
          ))}
        </Group>
      </FocusManagement>
    );
    let controller: PibblController | undefined;
    try {
      controller = pibbl(canvas, scene(["a", "b"]), { htmlOverlay: overlay });
      controllers.add(controller);
      driver.flush(10);
      expect(htmlNames(canvas)).toEqual(["a", "b"]);
      pibbl(canvas, scene(["b", "a"]));
      driver.flush(20);
      expect(htmlNames(canvas)).toEqual(["b", "a"]);
      expect(mounts).toEqual(["a", "b"]);
    } finally {
      controller?.dispose();
      if (controller) controllers.delete(controller);
      restore();
    }
  });

  it("carries keyboard-visible modality into mount and update programmatic focus", async () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const { canvas, overlay } = htmlSurface();
    const outside = document.createElement("button");
    document.body.append(outside);
    const changes: string[] = [];
    let first: HTMLInputElement | undefined;
    let second: HTMLInputElement | undefined;
    const mount = (
      content: HTMLDivElement,
      _initial: number,
      _signal: AbortSignal,
    ) => {
      first = document.createElement("input");
      second = document.createElement("input");
      content.append(first, second);
      first.focus({ preventScroll: true });
      return (which: number) => {
        if (which === 1) second!.focus({ preventScroll: true });
      };
    };
    const scene = (show: boolean, which = 0) => (
      <FocusManagement>
        <Group>
          <Rectangle
            style={{ left: 0, top: 0, width: 10, height: 10 }}
            onClick={() => undefined}
          />
          {show && (
            <HtmlBox
              data={which}
              mount={mount}
              onFocusChange={(state) =>
                changes.push(`${state.isFocusWithin}:${state.isFocusVisible}`)
              }
              style={{ width: 100, height: 30 }}
            />
          )}
        </Group>
      </FocusManagement>
    );
    let controller: PibblController | undefined;
    try {
      controller = pibbl(canvas, scene(false), { htmlOverlay: overlay });
      controllers.add(controller);
      driver.flush(10);
      const manager = focusManager(canvas);
      expect(
        manager.focusNavigationCandidate(
          manager.navigationCandidates[0],
          "keyboard",
        ),
      ).toBe(true);
      pibbl(canvas, scene(true));
      driver.flush(20);
      await Promise.resolve();
      expect(document.activeElement).toBe(first);
      expect(changes).toContain("true:true");

      pibbl(canvas, scene(true, 1));
      driver.flush(30);
      await Promise.resolve();
      expect(document.activeElement).toBe(second);
      expect(changes.at(-1)).toBe("true:true");

      await userEvent.click(first!);
      await Promise.resolve();
      expect(document.activeElement).toBe(first);
      expect(changes.at(-1)).toBe("true:false");

      // Clicking an already focused control leaves no focusin; its stale
      // pointer marker must not leak into the following native Tab focusin.
      await userEvent.click(first!);
      await userEvent.tab();
      await Promise.resolve();
      expect(document.activeElement).toBe(second);
      expect(changes.at(-1)).toBe("true:true");

      await userEvent.click(outside);
      await Promise.resolve();
      first!.focus({ preventScroll: true });
      await Promise.resolve();
      expect(document.activeElement).toBe(first);
      expect(changes.at(-1)).toBe("true:false");
    } finally {
      controller?.dispose();
      if (controller) controllers.delete(controller);
      restore();
    }
  });

  it("suspends focused HTML navigation at zero display size and restores the same host", () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const { wrapper, canvas, overlay } = htmlSurface();
    let input: HTMLInputElement | undefined;
    const mount = (
      content: HTMLDivElement,
      _initial: boolean,
      _signal: AbortSignal,
    ) => {
      input = document.createElement("input");
      content.append(input);
      return () => undefined;
    };
    const scene = (
      <FocusManagement>
        <HtmlBox data={true} mount={mount} style={{ width: 100, height: 30 }} />
      </FocusManagement>
    );
    let controller: PibblController | undefined;
    try {
      controller = pibbl(canvas, scene, { htmlOverlay: overlay });
      controllers.add(controller);
      driver.flush(10);
      input!.focus({ preventScroll: true });
      expect(document.activeElement).toBe(input);

      wrapper.style.width = "0px";
      wrapper.style.height = "0px";
      pibbl(canvas, scene);
      driver.flush(20);
      expect(candidateKinds(canvas)).toEqual([]);
      expect(document.activeElement).toBe(canvas);
      expect(wrapper.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(
        0,
      );

      const first = input;
      wrapper.style.width = "400px";
      wrapper.style.height = "300px";
      pibbl(canvas, scene);
      driver.flush(30);
      expect(input).toBe(first);
      expect(candidateKinds(canvas)).toEqual(["html"]);
    } finally {
      controller?.dispose();
      if (controller) controllers.delete(controller);
      restore();
    }
  });
});

function candidateKinds(canvas: HTMLCanvasElement): string[] {
  const manager = focusManager(canvas);
  return manager.navigationCandidates.map((candidate) =>
    isHtmlFocusCandidate(candidate) ? "html" : "canvas",
  );
}

function focusManager(canvas: HTMLCanvasElement): PibblFocusManager {
  return getPibblInstance(canvas).eventRoot.focusPolicy! as PibblFocusManager;
}

function focusFirstNavigationCandidate(canvas: HTMLCanvasElement): boolean {
  const manager = focusManager(canvas);
  return manager.focusNavigationCandidate(
    manager.navigationCandidates[0],
    "keyboard",
  );
}

function htmlNames(canvas: HTMLCanvasElement): string[] {
  const manager = getPibblInstance(canvas).eventRoot.focusPolicy! as unknown as {
    navigationCandidates: readonly Parameters<typeof isHtmlFocusCandidate>[0][];
  };
  return manager.navigationCandidates.flatMap((candidate) =>
    isHtmlFocusCandidate(candidate)
      ? [
          candidate.region.content?.querySelector<HTMLInputElement>("input")
            ?.dataset.name ?? "",
        ]
      : [],
  );
}

function htmlSurface() {
  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "position:relative;width:400px;height:300px;isolation:isolate";
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 300;
  canvas.style.cssText =
    "display:block;width:100%;height:100%;border:0;padding:0";
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:absolute;inset:0;pointer-events:none;z-index:1";
  wrapper.append(canvas, overlay);
  document.body.append(wrapper);
  return { wrapper, canvas, overlay };
}
