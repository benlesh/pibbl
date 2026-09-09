import { afterEach, describe, expect, it } from "vitest";

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
});

function link(container: HTMLElement, id: string): HTMLAnchorElement {
  return container.querySelector<HTMLAnchorElement>(`[data-navigation-id='${id}']`)!;
}
