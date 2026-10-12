import { getWorkbenchEntryBySlug } from "@pibbl/scenarios";

import type { PageLifecycle } from "../app/page-lifecycle";
import { loadWorkbenchSource } from "../learning-sources";
import { readSharedCode } from "../share-code";

export async function renderWorkbenchPage(
  container: HTMLElement,
  lifecycle: PageLifecycle,
  finishRoute: (title: string, focus?: boolean) => void,
  slug: string,
  version: number,
): Promise<boolean> {
  const entry = getWorkbenchEntryBySlug(slug);
  if (entry === undefined) return false;

  const article = document.createElement("article");
  article.className = "lesson-page";
  const header = document.createElement("header");
  header.className = "lesson-header";
  const title = document.createElement("h1");
  title.tabIndex = -1;
  title.textContent = entry.title;
  header.append(title);
  const workbench = document.createElement("section");
  workbench.className = "lesson-workbench-loading";
  workbench.ariaLabel = "Interactive workbench";
  workbench.textContent = "Loading the TypeScript workbench…";
  article.append(header, workbench);
  container.replaceChildren(article);
  finishRoute(entry.title);

  const [source, editorModule] = await Promise.all([
    loadWorkbenchSource(entry),
    import("../editor-workbench"),
  ]);
  if (!lifecycle.isCurrent(version)) return true;
  const shared = readSharedCode(window.location.hash, source);
  workbench.replaceChildren();
  workbench.classList.remove("lesson-workbench-loading");
  const disposable = await editorModule.mountEditorWorkbench({
    container: workbench,
    entry,
    canonicalSource: source,
    initialSource: shared.code,
    sourceIssue: shared.issue,
  });
  await lifecycle.setDisposable(version, disposable);
  return true;
}
