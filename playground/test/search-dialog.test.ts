import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildSearchBundle,
  type SearchBundleInput,
} from "../../tooling/studio-docs/search-index";
import { mountSearchDialog } from "../src/search/search-dialog";

const bundle = buildSearchBundle({
  pages: [
    {
      frontmatter: {
        id: "api-state",
        title: "useState",
        summary: "State for a component.",
        kind: "api",
        slug: "use-state",
        apiCategory: "hook",
        symbols: ["useState"],
      },
      route: "#/api/hooks/use-state",
      plainText: "Use useState for state.",
      headings: [],
      sections: [],
    },
    {
      frontmatter: {
        id: "guide-state",
        title: "Manage state",
        summary: "A Learn guide.",
        kind: "guide",
        slug: "state",
      },
      route: "#/learn/guides/state",
      plainText: "Keep local state near its component.",
      headings: [],
      sections: [],
    },
  ],
  examples: [
    {
      slug: "stateful-rectangle",
      title: "Stateful rectangle",
      shortTitle: "Stateful rectangle",
      browseGroup: "drawing",
      summary: "An interactive example.",
      api: ["useState"],
      objectives: ["Update state"],
      apiNotes: [],
    },
  ],
} satisfies SearchBundleInput);

afterEach(() => {
  document.body.replaceChildren();
  document.body.classList.remove("studio-search-open");
  vi.restoreAllMocks();
});

describe("documentation search dialog", () => {
  it("opens from Ctrl or Cmd+K unless another modal owns the shortcut", () => {
    const dialog = mountSearchDialog({ loadBundle: async () => bundle, navigate: vi.fn() });

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
    );
    expect(document.querySelector<HTMLDialogElement>("dialog")?.open).toBe(true);
    dialog.close();

    const otherModal = document.createElement("dialog");
    document.body.append(otherModal);
    otherModal.showModal();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
    );
    expect(
      document.querySelector<HTMLDialogElement>(".studio-search-dialog")?.open,
    ).toBe(false);

    dialog.dispose();
  });

  it("does not reopen over an aria-modal drawer after it has been mounted", () => {
    const dialog = mountSearchDialog({ loadBundle: async () => bundle, navigate: vi.fn() });
    const drawer = document.createElement("aside");
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    document.body.append(drawer);

    dialog.open();
    dialog.close();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
    );
    expect(document.querySelector<HTMLDialogElement>(".studio-search-dialog")?.open).toBe(
      false,
    );

    drawer.remove();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
    );
    expect(document.querySelector<HTMLDialogElement>(".studio-search-dialog")?.open).toBe(
      true,
    );

    dialog.dispose();
  });

  it("opens from its trigger, filters results, and activates the selected route", async () => {
    const navigate = vi.fn();
    const trigger = document.createElement("button");
    trigger.textContent = "Search docs...";
    document.body.append(trigger);
    const dialog = mountSearchDialog({
      loadBundle: async () => bundle,
      navigate,
    });

    dialog.open(trigger);
    const input = document.querySelector<HTMLInputElement>("[data-search-input]")!;
    expect(document.activeElement).toBe(input);
    input.value = "useState";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();

    expect(document.querySelector("[role='status']")?.textContent).toContain(
      "3 results",
    );
    expect(document.querySelector("[data-search-kind='api']")?.textContent).toContain(
      "API (1)",
    );
    expect(document.querySelector("[role='option']")).toHaveAttribute(
      "data-search-url",
      "#/api/hooks/use-state",
    );
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(navigate).toHaveBeenCalledWith("#/api/hooks/use-state");
    expect(document.querySelector<HTMLDialogElement>("dialog")?.open).toBe(false);

    dialog.dispose();
  });

  it("keeps combobox focus while traversing non-tabbable listbox options", async () => {
    const navigate = vi.fn();
    const dialog = mountSearchDialog({ loadBundle: async () => bundle, navigate });

    dialog.open();
    const input = document.querySelector<HTMLInputElement>("[data-search-input]")!;
    input.value = "state";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    const options = [
      ...document.querySelectorAll<HTMLElement>("[role='option']"),
    ];
    expect(input).toHaveAttribute("role", "combobox");
    expect(input).toHaveAttribute("aria-controls", "studio-search-results");
    expect(options.length).toBeGreaterThan(1);
    expect(options.every((option) => option.tabIndex === -1)).toBe(true);
    expect(options.every((option) => option.tagName !== "BUTTON")).toBe(true);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(document.activeElement).toBe(input);
    expect(input).toHaveAttribute("aria-activedescendant", options[0]!.id);
    expect(document.getElementById(options[0]!.id)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(input).toHaveAttribute("aria-activedescendant", options.at(-1)!.id);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    expect(input).toHaveAttribute("aria-activedescendant", options[0]!.id);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(input);

    document.getElementById(options[0]!.id)?.click();
    expect(navigate).toHaveBeenCalledWith("#/api/hooks/use-state");
    dialog.dispose();
  });

  it("dismisses with Escape, restores its invoker, and removes global listeners", async () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    const dialog = mountSearchDialog({ loadBundle: async () => bundle, navigate: vi.fn() });

    dialog.open(trigger);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.querySelector("dialog")?.open).toBe(false);
    expect(document.activeElement).toBe(trigger);

    dialog.dispose();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
    );
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("reports no results and provides a retryable unavailable state", async () => {
    let attempt = 0;
    const dialog = mountSearchDialog({
      loadBundle: async () => {
        attempt++;
        if (attempt === 1) throw new Error("index unavailable");
        return bundle;
      },
      navigate: vi.fn(),
    });

    dialog.open();
    await settle();
    expect(document.body.textContent).toContain("Search unavailable");
    document.querySelector<HTMLButtonElement>("[data-search-retry]")?.click();
    await settle();
    const input = document.querySelector<HTMLInputElement>("[data-search-input]")!;
    input.value = "no-such-document";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    expect(document.body.textContent).toContain("No results");

    dialog.dispose();
  });
});

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}
