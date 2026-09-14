import { getWorkbenchEntryBySlug } from "@crc/scenarios";

import type { Disposable } from "../app/page-lifecycle";
import { loadWorkbenchSource } from "../learning-sources";
import { readSharedCode } from "../share-code";
import type { LoadedPublicDoc } from "../../../tooling/studio-docs/model";

export type RenderablePublicDoc = Pick<
  LoadedPublicDoc,
  "frontmatter" | "route" | "html" | "headings" | "tutorialRelationship"
>;

export interface RenderMarkdownPageOptions {
  readonly document: RenderablePublicDoc;
  readonly container: HTMLElement;
  readonly anchor?: string;
  /** Focus only on a route change, never after an in-page anchor action. */
  readonly focus?: boolean;
  readonly mountExample?: (
    options: MarkdownExampleOptions,
  ) => Promise<Disposable> | Disposable;
}

export interface MarkdownExampleOptions {
  readonly container: HTMLElement;
  readonly slug: string;
}

export interface RenderedMarkdownPage {
  readonly dispose?: () => void | Promise<void>;
}

/** Renders already-sanitized, build-produced documentation HTML into the Studio. */
export async function renderMarkdownPage(
  options: RenderMarkdownPageOptions,
): Promise<RenderedMarkdownPage> {
  const article = document.createElement("article");
  article.className = "documentation-page";

  const breadcrumb = document.createElement("nav");
  breadcrumb.className = "documentation-breadcrumb";
  breadcrumb.ariaLabel = "Breadcrumb";
  breadcrumb.append(...breadcrumbItems(options.document));

  const header = document.createElement("header");
  header.className = "documentation-header";
  const title = document.createElement("h1");
  const titleHeading = options.document.headings.find(
    ({ level }) => level === 1,
  );
  if (titleHeading !== undefined) title.id = titleHeading.id;
  title.tabIndex = -1;
  title.textContent = options.document.frontmatter.title;
  const summary = document.createElement("p");
  summary.className = "documentation-summary";
  summary.textContent = options.document.frontmatter.summary;
  header.append(title, summary);

  const body = document.createElement("div");
  body.className = "documentation-body";
  appendGeneratedHtml(body, options.document.html);
  body.querySelector("h1")?.remove();

  let workbenchHost: HTMLElement | undefined;
  if (options.document.frontmatter.exampleSlug !== undefined) {
    workbenchHost = document.createElement("section");
    workbenchHost.className =
      "documentation-workbench lesson-workbench-loading";
    workbenchHost.dataset.exampleSlug =
      options.document.frontmatter.exampleSlug;
    workbenchHost.setAttribute("aria-label", "Interactive learning example");
    workbenchHost.textContent = "Loading the TypeScript workbench…";
  }

  article.append(breadcrumb, header, body);
  if (workbenchHost) article.appendChild(workbenchHost);
  const pagination = tutorialPagination(options.document);
  if (pagination) article.appendChild(pagination);
  options.container.replaceChildren(article);

  if (options.anchor !== undefined) {
    const anchor = options.container.querySelector<HTMLElement>(
      `#${CSS.escape(options.anchor)}`,
    );
    if (anchor !== null) {
      anchor.tabIndex = -1;
      anchor.scrollIntoView();
      anchor.focus({ preventScroll: true });
    }
  } else if (options.focus) {
    title.focus({ preventScroll: true });
  }

  if (!workbenchHost) return {};
  const disposable = await mountLearningWorkbench(
    options.document.frontmatter.exampleSlug!,
    workbenchHost,
    options.mountExample,
  );
  return disposable === undefined
    ? {}
    : { dispose: () => disposable.dispose() };
}

function appendGeneratedHtml(container: HTMLElement, html: string): void {
  const template = document.createElement("template");
  template.innerHTML = html;
  for (const script of template.content.querySelectorAll("script"))
    script.remove();
  container.replaceChildren(template.content);
}

function breadcrumbItems(documentation: RenderablePublicDoc): readonly Node[] {
  const items = [document.createTextNode("Learn")];
  if (documentation.frontmatter.kind === "api") {
    items[0] = document.createTextNode("API");
  } else if (documentation.frontmatter.kind === "tutorial") {
    items.push(document.createTextNode("Tutorials"));
  } else if (documentation.frontmatter.kind === "guide") {
    items.push(document.createTextNode("Guides"));
  }
  return items.flatMap((item, index) =>
    index === 0 ? [item] : [document.createTextNode(" / "), item],
  );
}

function tutorialPagination(
  documentation: RenderablePublicDoc,
): HTMLElement | undefined {
  const relationship = documentation.tutorialRelationship;
  if (relationship === undefined) return undefined;

  const pagination = document.createElement("nav");
  pagination.className = "tutorial-pagination";
  pagination.setAttribute("aria-label", "Tutorial chapters");

  if (relationship.previous !== undefined) {
    const previous = document.createElement("a");
    previous.dataset.tutorialDirection = "previous";
    previous.href = relationship.previous.route;
    previous.textContent = `Previous: ${relationship.previous.title}`;
    pagination.appendChild(previous);
  }

  const next = document.createElement("a");
  next.dataset.tutorialDirection = "next";
  if (relationship.next === undefined) {
    next.href = relationship.rootRoute;
    next.textContent = "Back to the tutorial overview";
  } else {
    next.href = relationship.next.route;
    next.textContent = `Next: ${relationship.next.title}`;
  }
  pagination.appendChild(next);

  return pagination;
}

async function mountLearningWorkbench(
  slug: string,
  container: HTMLElement,
  mountExample: RenderMarkdownPageOptions["mountExample"],
): Promise<Disposable | undefined> {
  if (mountExample !== undefined) {
    container.replaceChildren();
    const disposable = await mountExample({ container, slug });
    container.classList.remove("lesson-workbench-loading");
    return disposable;
  }

  const entry = getWorkbenchEntryBySlug(slug);
  if (!entry) {
    container.textContent =
      "This page references an unavailable workbench source.";
    return undefined;
  }
  const source = await loadWorkbenchSource(entry);
  const shared = readSharedCode(window.location.hash, source);
  container.replaceChildren();
  container.classList.remove("lesson-workbench-loading");
  const { mountEditorWorkbench } = await import("../editor-workbench");
  return mountEditorWorkbench({
    container,
    entry,
    canonicalSource: source,
    initialSource: shared.code,
    sourceIssue: shared.issue,
  });
}
