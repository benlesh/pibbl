import { getLearningExampleBySlug } from "@crc/scenarios";

import type { Disposable } from "../app/page-lifecycle";
import { loadLearningSource } from "../learning-sources";
import { readSharedCode } from "../share-code";
import type { LoadedPublicDoc } from "../../../tooling/studio-docs/model";

export interface RenderMarkdownPageOptions {
  readonly document: LoadedPublicDoc;
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
  const titleHeading = options.document.headings.find(({ level }) => level === 1);
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
    workbenchHost.className = "documentation-workbench lesson-workbench-loading";
    workbenchHost.dataset.exampleSlug = options.document.frontmatter.exampleSlug;
    workbenchHost.setAttribute("aria-label", "Interactive learning example");
    workbenchHost.textContent = "Loading the TypeScript workbench…";
  }

  article.append(breadcrumb, header, body);
  if (workbenchHost) article.appendChild(workbenchHost);
  options.container.replaceChildren(article);

  if (options.anchor !== undefined) {
    options.container
      .querySelector<HTMLElement>(`#${CSS.escape(options.anchor)}`)
      ?.scrollIntoView();
  } else if (options.focus) {
    title.focus({ preventScroll: true });
  }

  if (!workbenchHost) return {};
  const disposable = await mountLearningWorkbench(
    options.document.frontmatter.exampleSlug!,
    workbenchHost,
    options.mountExample,
  );
  return disposable === undefined ? {} : { dispose: () => disposable.dispose() };
}

function appendGeneratedHtml(container: HTMLElement, html: string): void {
  const template = document.createElement("template");
  template.innerHTML = html;
  for (const script of template.content.querySelectorAll("script")) script.remove();
  container.replaceChildren(template.content);
}

function breadcrumbItems(documentation: LoadedPublicDoc): readonly Node[] {
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

async function mountLearningWorkbench(
  slug: string,
  container: HTMLElement,
  mountExample: RenderMarkdownPageOptions["mountExample"],
): Promise<Disposable | undefined> {
  if (mountExample !== undefined) {
    container.replaceChildren();
    container.classList.remove("lesson-workbench-loading");
    return mountExample({ container, slug });
  }

  const entry = getLearningExampleBySlug(slug);
  if (!entry) {
    container.textContent = "This page references an unavailable learning example.";
    return undefined;
  }
  const source = await loadLearningSource(entry);
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
