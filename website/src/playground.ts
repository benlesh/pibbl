import { getWorkbenchEntryBySlug } from "../../packages/scenarios/src/tutorial-catalog";
import { loadWorkbenchSource } from "../../playground/src/learning-sources";
import { readSharedCode } from "../../playground/src/share-code";
import { createPageLifecycle } from "../../playground/src/app/page-lifecycle";

/** Mount the existing editor inside the documentation site's navigation. */
export function mountWebsitePlayground(): void {
  const container = document.getElementById("playground-editor")!;
  const title = document.getElementById("playground-title")!;
  const select = document.getElementById(
    "playground-example",
  ) as HTMLSelectElement;
  const lifecycle = createPageLifecycle();
  const initialHash = "#/examples/drawing/circle";
  async function render() {
    const version = await lifecycle.begin();
    if (!lifecycle.isCurrent(version)) return;
    if (!window.location.hash)
      window.history.replaceState(null, "", initialHash);
    const hash = window.location.hash;
    const path = hash.split("?")[0];
    const slug = path.match(/^#\/(?:examples\/[^/]+|workbench)\/([^/]+)$/)?.[1];
    const entry = slug && getWorkbenchEntryBySlug(slug);
    if (!entry) {
      title.textContent = "Example not found";
      container.textContent = "Choose an example above to open the editor.";
      select.value = "";
      return;
    }
    select.value =
      [...select.options].find(
        (option) => option.value.split("/").at(-1) === slug,
      )?.value ?? path;
    title.textContent = entry.title;
    container.textContent = "Loading the editor…";
    try {
      const [source, { mountEditorWorkbench }] = await Promise.all([
        loadWorkbenchSource(entry),
        import("../../playground/src/editor-workbench"),
      ]);
      if (!lifecycle.isCurrent(version)) return;
      const shared = readSharedCode(hash, source);
      container.replaceChildren();
      const editor = await mountEditorWorkbench({
        container,
        entry,
        canonicalSource: source,
        initialSource: shared.code,
        sourceIssue: shared.issue,
      });
      await lifecycle.setDisposable(version, editor);
    } catch (error) {
      if (lifecycle.isCurrent(version))
        container.textContent = `Unable to load this example: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  select.addEventListener("change", () => {
    window.location.hash = select.value;
  });
  window.addEventListener("hashchange", () => void render());
  window.addEventListener("beforeunload", () => void lifecycle.dispose(), {
    once: true,
  });
  void render();
}
