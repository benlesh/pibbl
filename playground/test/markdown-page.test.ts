import { afterEach, describe, expect, it, vi } from "vitest";

import type { LoadedPublicDoc } from "../../tooling/studio-docs/model";
import { renderMarkdownPage } from "../src/docs/markdown-page";

const fixtureDocument: LoadedPublicDoc = {
  frontmatter: {
    id: "guide-state-lifecycle",
    title: "Manage state and lifecycle",
    summary:
      "Keep state local, preserve component identity, and clean up owned resources.",
    kind: "guide",
    slug: "state-and-lifecycle",
    order: 20,
    exampleSlug: "getting-started",
  },
  route: "#/learn/guides/state-and-lifecycle",
  html: `
    <h1 id="manage-state-and-lifecycle">Manage state and lifecycle</h1>
    <p>Keep state local and clean up what you own.</p>
    <h2 id="component-identity">Component identity</h2>
    <p><code>crcState</code> follows the component path.</p>
    <table><thead><tr><th>Concern</th><th>Rule</th></tr></thead><tbody><tr><td>Cleanup</td><td>Dispose owned resources</td></tr></tbody></table>
    <script>window.__untrusted = true</script>
  `,
  plainText: "Manage state and lifecycle\nComponent identity",
  headings: [
    {
      id: "manage-state-and-lifecycle",
      level: 1,
      text: "Manage state and lifecycle",
    },
    { id: "component-identity", level: 2, text: "Component identity" },
  ],
  sections: [
    {
      heading: {
        id: "manage-state-and-lifecycle",
        level: 1,
        text: "Manage state and lifecycle",
      },
      plainText: "Keep state local and clean up what you own.",
    },
    {
      heading: {
        id: "component-identity",
        level: 2,
        text: "Component identity",
      },
      plainText:
        "crcState follows the component path.\nConcern\nRule\nCleanup\nDispose owned resources",
    },
  ],
  internalLinks: [],
};

afterEach(() => {
  document.body.replaceChildren();
  window.location.hash = "";
  delete (window as Window & { __untrusted?: boolean }).__untrusted;
  vi.restoreAllMocks();
});

describe("Markdown documentation pages", () => {
  it("renders generated Markdown safely with semantic route context", async () => {
    const container = document.createElement("main");
    document.body.appendChild(container);

    const page = await renderMarkdownPage({
      document: fixtureDocument,
      container,
      focus: false,
      mountExample: () => ({ dispose: () => undefined }),
    });

    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.querySelector("h1")?.textContent).toBe(
      "Manage state and lifecycle",
    );
    expect(container.querySelector("h1")?.id).toBe(
      "manage-state-and-lifecycle",
    );
    expect(
      container.querySelector(".documentation-breadcrumb")?.textContent,
    ).toContain("Learn");
    expect(container.querySelector(".documentation-summary")?.textContent).toBe(
      fixtureDocument.frontmatter.summary,
    );
    expect(container.querySelector("#component-identity")).not.toBeNull();
    expect(container.querySelector("code")?.textContent).toBe("crcState");
    expect(container.querySelector("table tbody td")?.textContent).toBe(
      "Cleanup",
    );
    expect(container.querySelector("script")).toBeNull();
    expect(
      (window as Window & { __untrusted?: boolean }).__untrusted,
    ).toBeUndefined();
    expect(
      container.querySelector("[data-example-slug='getting-started']"),
    ).not.toBeNull();
    expect(container.querySelector("h1")?.tabIndex).toBe(-1);

    await page.dispose?.();
  });

  it("scrolls and focuses a route anchor without a second page jump", async () => {
    const container = document.createElement("main");
    document.body.appendChild(container);
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    await renderMarkdownPage({
      document: fixtureDocument,
      container,
      anchor: "component-identity",
      focus: false,
      mountExample: () => ({ dispose: () => undefined }),
    });

    expect(scrollIntoView).toHaveBeenCalledOnce();
    const anchor = container.querySelector<HTMLElement>("#component-identity");
    expect(anchor).toHaveAttribute("tabindex", "-1");
    expect(document.activeElement).toBe(anchor);
  });

  it("focuses the document heading for a new route without an anchor", async () => {
    const container = document.createElement("main");
    document.body.appendChild(container);

    await renderMarkdownPage({
      document: fixtureDocument,
      container,
      focus: true,
      mountExample: () => ({ dispose: () => undefined }),
    });

    expect(document.activeElement).toBe(container.querySelector("h1"));
  });
});
