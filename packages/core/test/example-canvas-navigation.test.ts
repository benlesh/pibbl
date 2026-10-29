import { afterEach, expect, it, vi } from "vitest";
import { createExamplePages } from "../../../playground/src/examples/example-pages";
import { createPageLifecycle } from "../../../playground/src/app/page-lifecycle";
import { getLearningExampleBySlug } from "@pibbl/scenarios";

vi.mock("../../../playground/src/learning-sources", () => ({
  loadWorkbenchSource: async () => "",
}));
vi.mock("../../../playground/src/editor-workbench", () => ({
  mountEditorWorkbench: async ({ container }: { container: HTMLElement }) => {
    const preview = document.createElement("section");
    preview.className = "studio-preview";
    container.append(preview);
    return {
      dispose() {
        preview.remove();
      },
    };
  },
}));
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

it("lets a reader jump from the example heading to its live Canvas workspace", async () => {
  const container = document.createElement("main");
  document.body.append(container);
  const lifecycle = createPageLifecycle();
  const version = await lifecycle.begin();
  const pages = createExamplePages({ container, lifecycle, finishRoute() {} });
  const pending = pages.renderDetail(
    getLearningExampleBySlug("wasm-flex-text")!,
    version,
  );
  const jump = Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === "Jump to Live Canvas",
  );
  expect(jump).toBeDefined();
  expect(jump!.disabled).toBe(true);
  await pending;
  expect(jump!.disabled).toBe(false);
  const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
  jump!.click();
  expect(scroll).toHaveBeenCalledOnce();
  expect(scroll.mock.instances[0]).toBe(
    container.querySelector(".studio-preview"),
  );
  expect(document.activeElement).toBe(
    container.querySelector('[aria-label="Live Canvas workspace"]'),
  );
  await lifecycle.dispose();
});
