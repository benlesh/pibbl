import { pageByRoute } from "virtual:crc-studio-docs";

import type { PageLifecycle } from "../app/page-lifecycle";
import type { DocumentStudioRoute } from "../app/routes";
import { renderMarkdownPage } from "./markdown-page";

export interface DocumentationPagesOptions {
  readonly container: HTMLElement;
  readonly lifecycle: PageLifecycle;
  readonly finishRoute: (title: string, focus?: boolean) => void;
}

export interface DocumentationPages {
  render(route: DocumentStudioRoute, version: number): Promise<boolean>;
  renderMissing(): void;
}

/** Bridges the generated manifest to the browser's trusted Markdown renderer. */
export function createDocumentationPages(
  options: DocumentationPagesOptions,
): DocumentationPages {
  return {
    async render(route, version): Promise<boolean> {
      const document = pageByRoute[route.route];
      if (!document) return false;
      const rendered = await renderMarkdownPage({
        document,
        container: options.container,
        anchor: route.anchor,
        focus: route.anchor === undefined,
      });
      if (rendered.dispose !== undefined) {
        await options.lifecycle.setDisposable(version, {
          dispose: rendered.dispose,
        });
      }
      if (options.lifecycle.isCurrent(version)) {
        options.finishRoute(document.frontmatter.title, false);
      }
      return true;
    },
    renderMissing(): void {
      const article = document.createElement("article");
      article.className = "documentation-page documentation-page--missing";
      const title = document.createElement("h1");
      title.tabIndex = -1;
      title.textContent = "Page not found";
      const summary = document.createElement("p");
      summary.textContent =
        "This documentation route is not published in the current Studio build.";
      const learn = document.createElement("a");
      learn.className = "studio-primary-action";
      learn.href = "#/learn";
      learn.textContent = "Open Learn";
      article.append(title, summary, learn);
      options.container.replaceChildren(article);
      options.finishRoute("Page not found");
    },
  };
}
