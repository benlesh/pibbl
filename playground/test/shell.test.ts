import { afterEach, describe, expect, it, vi } from "vitest";

import { buildSearchBundle } from "../../tooling/studio-docs/search-index";
import type { NavigationArea } from "../src/app/navigation";
import { parseStudioRoute } from "../src/app/routes";
import { createStudioShell } from "../src/app/shell";

const navigation = [
  {
    id: "learn",
    label: "Learn",
    href: "#/learn",
    children: [
      {
        id: "learn-guides",
        label: "Guides",
        children: [
          {
            id: "document:#/learn/guides/state-and-lifecycle",
            label: "State and lifecycle",
            href: "#/learn/guides/state-and-lifecycle",
          },
        ],
      },
    ],
  },
  {
    id: "api",
    label: "API",
    href: "#/api",
    children: [
      {
        id: "api-types",
        label: "Types",
        children: [
          {
            id: "api-types-events",
            label: "Events",
            href: "#/api/types/events",
          },
        ],
      },
    ],
  },
  { id: "examples", label: "Examples", href: "#/examples" },
] satisfies readonly NavigationArea[];

afterEach(() => {
  document.body.replaceChildren();
  document.body.classList.remove("studio-drawer-open");
});

describe("Studio shell navigation", () => {
  it("keeps active classes on ancestors while marking only the current link", () => {
    const app = document.createElement("div");
    document.body.appendChild(app);
    const shell = createStudioShell({ app, navigation });

    shell.setActiveNavigation(
      parseStudioRoute("#/learn/guides/state-and-lifecycle"),
    );

    const learn = link(app, "learn");
    const guides = app.querySelector<HTMLElement>(
      "[data-navigation-id='learn-guides']",
    );
    const current = link(app, "document:#/learn/guides/state-and-lifecycle");
    expect(learn.classList).toContain("is-active");
    expect(guides?.classList).toContain("is-active");
    expect(current.classList).toContain("is-active");
    expect(learn).not.toHaveAttribute("aria-current");
    expect(current).toHaveAttribute("aria-current", "page");

    shell.dispose();
  });

  it("marks Automated Test Labs as current only on its index route", () => {
    const app = document.createElement("div");
    document.body.appendChild(app);
    const shell = createStudioShell({ app, navigation });
    const testing = app.querySelector<HTMLAnchorElement>(".studio-testing-link")!;

    shell.setActiveNavigation(parseStudioRoute("#/testing"));
    expect(testing.classList).toContain("is-active");
    expect(testing).toHaveAttribute("aria-current", "page");

    shell.setActiveNavigation(parseStudioRoute("#/testing/baseline-smoke"));
    expect(testing.classList).toContain("is-active");
    expect(testing).not.toHaveAttribute("aria-current");

    shell.dispose();
  });

  it("uses buttons to expand navigation groups and keeps active ancestors visible", () => {
    const app = document.createElement("div");
    document.body.appendChild(app);
    const shell = createStudioShell({ app, navigation });
    const learnToggle = app.querySelector<HTMLButtonElement>(
      "[data-navigation-id='learn'][aria-expanded]",
    )!;

    expect(learnToggle).toHaveAttribute("aria-expanded", "false");
    expect(app.querySelector(".studio-nav__area > ul")).toHaveAttribute("hidden");

    learnToggle.click();
    expect(
      app.querySelector<HTMLButtonElement>(
        "[data-navigation-id='learn'][aria-expanded]",
      ),
    ).toHaveAttribute("aria-expanded", "true");
    expect(app.querySelector(".studio-nav__area > ul")).not.toHaveAttribute("hidden");

    shell.setActiveNavigation(
      parseStudioRoute("#/learn/guides/state-and-lifecycle"),
    );
    expect(
      app.querySelector<HTMLButtonElement>(
        "[data-navigation-id='learn'][aria-expanded]",
      ),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      app.querySelector<HTMLButtonElement>(
        "[data-navigation-id='learn-guides'][aria-expanded]",
      ),
    ).toHaveAttribute("aria-expanded", "true");

    shell.dispose();
  });

  it("restores focus to a disclosure after rerendering its navigation branch", () => {
    const app = document.createElement("div");
    document.body.appendChild(app);
    const shell = createStudioShell({ app, navigation });
    app.querySelector<HTMLButtonElement>(".studio-menu-button")?.click();
    const learnToggle = app.querySelector<HTMLButtonElement>(
      "[data-navigation-id='learn'][aria-expanded]",
    )!;

    learnToggle.focus();
    learnToggle.click();

    const replacement = app.querySelector<HTMLButtonElement>(
      "[data-navigation-id='learn'][aria-expanded]",
    )!;
    expect(document.activeElement).toBe(replacement);

    shell.dispose();
  });

  it("opens search from a visible trigger and the Ctrl/Cmd+K shortcut", async () => {
    const app = document.createElement("div");
    document.body.appendChild(app);
    const shell = createStudioShell({
      app,
      navigation,
      loadSearchBundle: async () => searchBundle,
    });
    const trigger = app.querySelector<HTMLButtonElement>(
      ".studio-search-trigger--mobile",
    )!;

    trigger.click();
    await settle();
    await vi.waitFor(() => {
      expect(document.querySelector<HTMLDialogElement>("dialog")?.open).toBe(true);
    });
    expect(document.activeElement).toBe(
      document.querySelector("[data-search-input]"),
    );

    document.querySelector<HTMLDialogElement>("dialog")?.close();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
    );
    await settle();
    await vi.waitFor(() => {
      expect(document.querySelector<HTMLDialogElement>("dialog")?.open).toBe(true);
    });

    shell.dispose();
  });

  it("defers the shortcut to an open mobile drawer and removes trigger listeners on dispose", async () => {
    let bundleLoads = 0;
    const app = document.createElement("div");
    document.body.appendChild(app);
    const shell = createStudioShell({
      app,
      navigation,
      loadSearchBundle: async () => {
        bundleLoads++;
        return searchBundle;
      },
    });
    const menu = app.querySelector<HTMLButtonElement>(".studio-menu-button")!;
    const trigger = app.querySelector<HTMLButtonElement>(
      ".studio-search-trigger--mobile",
    )!;

    menu.click();
    expect(document.querySelector("#studio-navigation")).toHaveAttribute(
      "aria-modal",
      "true",
    );
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
    );
    await settle();
    expect(document.querySelector(".studio-search-dialog")).toBeNull();
    expect(bundleLoads).toBe(0);

    menu.click();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
    );
    await settle();
    expect(document.querySelector<HTMLDialogElement>(".studio-search-dialog")?.open).toBe(
      true,
    );
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
    );
    expect(document.querySelector<HTMLDialogElement>(".studio-search-dialog")?.open).toBe(
      true,
    );

    shell.dispose();
    document.querySelector<HTMLDialogElement>(".studio-search-dialog")?.remove();
    trigger.click();
    await settle();
    expect(document.querySelector(".studio-search-dialog")).toBeNull();
  });
});

const searchBundle = buildSearchBundle({
  pages: [
    {
      frontmatter: {
        id: "hook-state",
        title: "crcState",
        summary: "State for a component.",
        kind: "api",
        slug: "crc-state",
        apiCategory: "hook",
        symbols: ["crcState"],
      },
      route: "#/api/hooks/crc-state",
      plainText: "Use crcState to hold local state.",
      headings: [],
      sections: [],
    },
  ],
  examples: [],
});

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 50));
}

function link(container: HTMLElement, id: string): HTMLAnchorElement {
  return container.querySelector<HTMLAnchorElement>(`[data-navigation-id='${id}']`)!;
}
