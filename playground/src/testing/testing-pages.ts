import {
  getScenarioBySlug,
  getScenarioRoute,
  loadScenario,
  scenarioCatalog,
  smokeScenarioEntry,
} from "@pibbl/scenarios";
import { mountScenarioSurface } from "@pibbl/scenarios/surface";

import type { PageLifecycle, Disposable } from "../app/page-lifecycle";
import { loadScenarioSource } from "../scenario-sources";

export interface TestingPagesOptions {
  readonly container: HTMLElement;
  readonly lifecycle: PageLifecycle;
  readonly finishRoute: (title: string, focus?: boolean) => void;
}

export interface TestingPages {
  renderIndex(): void;
  renderDetail(slug: string, version: number): Promise<void>;
}

/** Keeps deterministic test-lab pages separate from public learning content. */
export function createTestingPages(options: TestingPagesOptions): TestingPages {
  return {
    renderIndex(): void {
      const article = document.createElement("article");
      article.className = "testing-index";
      const header = document.createElement("header");
      header.className = "testing-header";
      const eyebrow = document.createElement("p");
      eyebrow.className = "studio-eyebrow";
      eyebrow.textContent = "Verification workshop";
      const title = routeHeading("Automated test labs");
      const summary = document.createElement("p");
      summary.textContent =
        "These are deterministic fixtures for automated browser verification. They preserve diagnostic controls, exact actions, state evidence, and visual baselines; they are not sequenced as beginner lessons.";
      const back = document.createElement("a");
      back.href = "#/examples";
      back.className = "studio-secondary-action";
      back.textContent = "← Back to learning studio";
      header.append(eyebrow, title, summary, back);
      const grid = document.createElement("div");
      grid.className = "testing-grid";
      for (const entry of scenarioCatalog) {
        const card = document.createElement("a");
        card.href = getScenarioRoute(entry);
        card.className = "testing-card";
        const number = document.createElement("span");
        number.textContent = String(entry.metadata.learningOrder).padStart(3, "0");
        const cardTitle = document.createElement("strong");
        cardTitle.textContent = entry.metadata.title;
        const cardSummary = document.createElement("p");
        cardSummary.textContent = entry.metadata.summary;
        const actions = document.createElement("small");
        actions.textContent = `${entry.actions.length} scripted action${entry.actions.length === 1 ? "" : "s"} · ${entry.metadata.category}`;
        card.append(number, cardTitle, cardSummary, actions);
        grid.appendChild(card);
      }
      article.append(header, grid);
      options.container.replaceChildren(article);
      options.finishRoute("Automated test labs");
    },

    async renderDetail(slug, version): Promise<void> {
      const selected = getScenarioBySlug(slug) ?? smokeScenarioEntry;
      if (selected.metadata.slug !== slug) {
        window.history.replaceState(null, "", getScenarioRoute(selected));
      }
      const loading = document.createElement("p");
      loading.className = "testing-loading";
      loading.role = "status";
      loading.textContent = "Mounting deterministic fixture…";
      options.container.replaceChildren(loading);
      const [definition, source] = await Promise.all([
        loadScenario(selected),
        loadScenarioSource(selected),
      ]);
      if (!options.lifecycle.isCurrent(version)) return;
      const host = document.createElement("div");
      host.className = "testing-area";
      options.container.replaceChildren(host);
      const surface = await mountScenarioSurface({
        container: host,
        entry: selected,
        definition,
        sourceText: source,
      });
      if (!(await options.lifecycle.setSurface(version, surface))) return;

      const sourcePre = host.querySelector<HTMLElement>(".scenario-source");
      const sourceSection = sourcePre?.parentElement;
      if (sourcePre && sourceSection) {
        const details = document.createElement("details");
        details.className = "testing-source";
        const summary = document.createElement("summary");
        summary.textContent = "View exact fixture source";
        const editorHost = document.createElement("div");
        editorHost.className = "testing-source__editor";
        details.append(summary, editorHost);
        sourcePre.replaceWith(details);
        let sourceEditor: Disposable | undefined;
        details.addEventListener("toggle", () => {
          if (!details.open || sourceEditor) return;
          editorHost.textContent = "Loading syntax highlighting…";
          void import("../editor-workbench").then((module) => {
            if (!details.isConnected) return;
            editorHost.replaceChildren();
            sourceEditor = module.mountReadOnlySource(
              editorHost,
              source,
              selected.metadata.slug,
            );
          });
        });
        await options.lifecycle.setDisposable(version, {
          dispose: () => sourceEditor?.dispose(),
        });
      }
      const back = document.createElement("a");
      back.href = "#/testing";
      back.className = "studio-secondary-action testing-back";
      back.textContent = "← All automated test labs";
      host.prepend(back);
      if (options.lifecycle.isCurrent(version)) {
        options.finishRoute(`${selected.metadata.title} test lab`);
      }
    },
  };
}

function routeHeading(title: string): HTMLHeadingElement {
  const element = document.createElement("h1");
  element.tabIndex = -1;
  element.textContent = title;
  return element;
}
