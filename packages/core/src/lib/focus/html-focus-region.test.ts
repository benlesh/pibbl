import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createElement } from "../element/create-element";
import { executeRender } from "../execute-render";
import { clearSharedState, getPibblInstance } from "../global-state";
import { mountPibbl } from "../mount-pibbl";
import type { PibblController, PibblElement } from "../types";
import type { HtmlFocusRegion } from "./html-focus-region";
import { PibblFocusManager } from "./focus-manager";
import { focusManaged } from "./policy-test-support";

const controllers = new Set<PibblController>();

beforeEach(() => document.body.replaceChildren());
afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  clearSharedState();
  document.body.replaceChildren();
});

describe("HtmlBox focus regions", () => {
  it("enters the first or last native control and reports a keyboard-visible region", () => {
    const { manager, owner } = mounted();
    const content = document.createElement("div");
    const first = document.createElement("button");
    const last = document.createElement("input");
    content.append(first, last);
    document.body.append(content);
    const snapshots: string[] = [];
    const region = htmlRegion(owner, content, snapshots);

    manager.beginCollection();
    manager.observeHtmlRegion(region);
    manager.finishCollection(true);

    expect(manager.navigationCandidates).toHaveLength(1);
    expect(
      manager.focusNavigationCandidate(
        manager.navigationCandidates[0],
        "keyboard",
      ),
    ).toBe(true);
    expect(document.activeElement).toBe(first);
    expect(snapshots).toEqual(["true:true"]);

    manager.clearNativeHtmlFocus(region);
    expect(
      manager.focusNavigationCandidate(
        manager.navigationCandidates[0],
        "keyboard",
        true,
      ),
    ).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it("skips inactive or empty regions without creating an implicit host stop", () => {
    const { manager, owner } = mounted();
    const content = document.createElement("div");
    document.body.append(content);
    const region = htmlRegion(owner, content, []);

    manager.beginCollection();
    manager.observeHtmlRegion(region);
    manager.finishCollection(true);

    expect(manager.navigationCandidates).toHaveLength(1);
    expect(
      manager.focusNavigationCandidate(
        manager.navigationCandidates[0],
        "keyboard",
      ),
    ).toBe(false);
  });
});

function mounted(): {
  manager: PibblFocusManager;
  owner: NonNullable<ReturnType<typeof getPibblInstance>>;
} {
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  const controller = mountPibbl(canvas, focusManaged(createElement(Empty, {})));
  controllers.add(controller);
  executeRender(canvas, 1);
  const owner = getPibblInstance(canvas);
  const manager = owner.eventRoot.focusPolicy as PibblFocusManager;
  return { manager, owner };
}

const Empty = (_props: {}): PibblElement<any> | undefined => undefined;

function htmlRegion(
  owner: NonNullable<ReturnType<typeof getPibblInstance>>,
  content: HTMLElement,
  snapshots: string[],
): HtmlFocusRegion {
  return {
    identity: {},
    owner,
    content,
    rootBounds: { x: 10, y: 10, width: 50, height: 20 },
    active: true,
    onFocusSnapshot: (snapshot) =>
      snapshots.push(`${snapshot.isFocusWithin}:${snapshot.isFocusVisible}`),
  };
}
