import {
  crc,
  createElement,
  Group,
  Rectangle,
  Text,
  type CRCController,
} from "@crc/core";
import {
  getLearningExampleBySlug,
  getLearningExampleRoute,
  learningExampleCatalog,
  learningSections,
  type LearningExampleCatalogEntry,
} from "@crc/scenarios";

import type { PageLifecycle } from "../app/page-lifecycle";
import { loadLearningSource } from "../learning-sources";
import { readSharedCode } from "../share-code";

export interface ExamplePagesOptions {
  readonly container: HTMLElement;
  readonly lifecycle: PageLifecycle;
  readonly finishRoute: (title: string, focus?: boolean) => void;
}

export interface ExamplePages {
  renderLanding(version: number): Promise<void>;
  renderDetail(entry: LearningExampleCatalogEntry, version: number): Promise<void>;
}

/** Hosts the live teaching examples without giving page routing ownership to them. */
export function createExamplePages(options: ExamplePagesOptions): ExamplePages {
  return {
    async renderLanding(version): Promise<void> {
      const article = document.createElement("article");
      article.className = "studio-landing";
      const intro = document.createElement("header");
      intro.className = "studio-landing__intro";
      const copy = document.createElement("div");
      const eyebrow = document.createElement("p");
      eyebrow.className = "studio-eyebrow";
      eyebrow.textContent = "A hands-on Canvas workshop";
      const title = routeHeading("Make shapes. Teach the mouse.");
      const summary = document.createElement("p");
      summary.textContent =
        "Learn CRC one clear idea at a time. Every lesson pairs a live Canvas with editable, type-aware TypeScript.";
      const start = document.createElement("a");
      start.className = "studio-primary-action";
      start.href = getLearningExampleRoute(learningExampleCatalog[0]);
      start.textContent = "Start drawing →";
      copy.append(eyebrow, title, summary, start);

      const hero = document.createElement("section");
      hero.className = "studio-hero-canvas";
      hero.ariaLabel = "Interactive CRC composition";
      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = 420;
      const heroButton = document.createElement("button");
      heroButton.type = "button";
      heroButton.textContent = "Shuffle the composition";
      let phase = 0;
      let controller: CRCController | undefined;
      const renderHero = () => {
        controller?.dispose();
        controller = crc(
          canvas,
          createElement(HeroScene, {
            phase,
            onActivate: () => {
              phase++;
              renderHero();
            },
          }),
        );
      };
      heroButton.addEventListener("click", () => {
        phase++;
        renderHero();
      });
      renderHero();
      hero.append(canvas, heroButton);
      intro.append(copy, hero);

      const cards = document.createElement("section");
      cards.className = "studio-category-grid";
      cards.ariaLabel = "Lesson categories";
      cards.append(
        categoryCard({
          eyebrow: "11 focused primitives",
          title: "Draw & compose",
          description: "Rects, paths, lines, type, images, transforms, clips, and layers.",
          href: getLearningExampleRoute(getLearningExampleBySlug("rectangle")!),
          className: "is-drawing",
        }),
        categoryCard({
          eyebrow: "8 mouse events",
          title: "Make it react",
          description: "See every supported event produce immediate, visible feedback.",
          href: getLearningExampleRoute(getLearningExampleBySlug("click")!),
          className: "is-mouse",
        }),
        categoryCard({
          eyebrow: "4 deeper studies",
          title: "Master targeting",
          description: "Trace sequences, widen hit areas, and reason about composed paint order.",
          href: getLearningExampleRoute(getLearningExampleBySlug("event-sequences")!),
          className: "is-advanced",
        }),
      );
      article.append(intro, cards);
      options.container.replaceChildren(article);
      await options.lifecycle.setDisposable(version, {
        dispose: () => controller?.dispose(),
      });
      if (options.lifecycle.isCurrent(version)) options.finishRoute("Interactive examples");
    },

    async renderDetail(entry, version): Promise<void> {
      const section = learningSections.find((value) => value.id === entry.section);
      const article = document.createElement("article");
      article.className = "lesson-page";
      const header = document.createElement("header");
      header.className = "lesson-header";
      const index = document.createElement("p");
      index.className = "studio-eyebrow";
      index.textContent = `${section?.label ?? entry.section} / ${String(learningExampleCatalog.indexOf(entry) + 1).padStart(2, "0")}`;
      const title = routeHeading(entry.title);
      const summary = document.createElement("p");
      summary.className = "lesson-header__summary";
      summary.textContent = entry.summary;
      const api = document.createElement("div");
      api.className = "lesson-api-pills";
      for (const name of entry.api) api.appendChild(codePill(name));
      header.append(index, title, summary, api);

      const objectives = document.createElement("section");
      objectives.className = "lesson-objectives";
      const objectiveTitle = document.createElement("h2");
      objectiveTitle.textContent = "You’ll learn";
      const objectiveList = document.createElement("ol");
      for (const objective of entry.objectives) {
        const item = document.createElement("li");
        item.textContent = objective;
        objectiveList.appendChild(item);
      }
      objectives.append(objectiveTitle, objectiveList);

      const workbenchHost = document.createElement("div");
      workbenchHost.className = "lesson-workbench-loading";
      workbenchHost.innerHTML = '<p role="status">Loading the TypeScript workbench…</p>';

      const teaching = document.createElement("div");
      teaching.className = "lesson-teaching-grid";
      const tryIt = document.createElement("section");
      tryIt.className = "lesson-callout lesson-callout--try";
      tryIt.innerHTML = '<p class="studio-eyebrow">Try it</p><h2>Touch the scene, then the code.</h2>';
      const prompts = document.createElement("ol");
      for (const [label, value] of [["Gesture", entry.prompts.gesture], ["Code change", entry.prompts.code]] as const) {
        const item = document.createElement("li");
        const strong = document.createElement("strong");
        strong.textContent = label;
        item.append(strong, document.createTextNode(value));
        prompts.appendChild(item);
      }
      tryIt.appendChild(prompts);
      const notes = document.createElement("section");
      notes.className = "lesson-callout lesson-callout--notes";
      notes.innerHTML = '<p class="studio-eyebrow">API notes</p><h2>Keep in mind</h2>';
      const notesList = document.createElement("ul");
      for (const note of entry.apiNotes) {
        const item = document.createElement("li");
        const parts = note.split("`");
        for (let index = 0; index < parts.length; index++) {
          item.append(index % 2 ? codePill(parts[index]) : document.createTextNode(parts[index]));
        }
        notesList.appendChild(item);
      }
      notes.appendChild(notesList);
      teaching.append(tryIt, notes);

      const limitation = document.createElement("p");
      limitation.className = "lesson-limitation";
      limitation.innerHTML = "<strong>Canvas accessibility note:</strong> CRC supports DOM-aligned user events and optional logical focus and keyboard navigation. Painted targets still do not create DOM semantics or an accessibility tree; applications must provide an equivalent semantic experience.";

      const pagination = document.createElement("nav");
      pagination.className = "lesson-pagination";
      pagination.ariaLabel = "Previous and next lessons";
      const previous = entry.relationships.previous ? getLearningExampleBySlug(entry.relationships.previous) : undefined;
      const next = entry.relationships.next ? getLearningExampleBySlug(entry.relationships.next) : undefined;
      pagination.append(
        categoryLink(previous, previous ? "← Previous" : "← Studio home"),
        categoryLink(next, next ? "Next →" : "Studio home →"),
      );
      article.append(header, objectives, workbenchHost, teaching, limitation, pagination);
      options.container.replaceChildren(article);
      options.finishRoute(entry.title);

      const [source, editorModule] = await Promise.all([
        loadLearningSource(entry),
        import("../editor-workbench"),
      ]);
      if (!options.lifecycle.isCurrent(version)) return;
      const shared = readSharedCode(window.location.hash, source);
      workbenchHost.replaceChildren();
      workbenchHost.classList.remove("lesson-workbench-loading");
      const disposable = await editorModule.mountEditorWorkbench({
        container: workbenchHost,
        entry,
        canonicalSource: source,
        initialSource: shared.code,
        sourceIssue: shared.issue,
      });
      await options.lifecycle.setDisposable(version, disposable);
    },
  };
}

function HeroScene(props: { phase: number; onActivate: () => void }) {
  const angle = props.phase % 2 ? 11 : -7;
  return [
    createElement(Rectangle, { style: { x: 0, y: 0, width: 720, height: 420, fill: "#f7c948" } }),
    createElement(Rectangle, { style: { x: 38, y: 38, width: 644, height: 344, fill: "#fffdf6", stroke: "#17211d", strokeWidth: 6 } }),
    createElement(Group, { style: { translateX: 76, translateY: 60, rotationDegrees: angle, rotationOrigin: [284, 150] }, children: [
      createElement(Rectangle, { style: { x: 46, y: 22, width: 222, height: 252, fill: "#1f4bd8", cursor: "pointer" }, onClick: props.onActivate }),
      createElement(Rectangle, { style: { x: 238, y: 84, width: 252, height: 152, fill: props.phase % 2 ? "#74d3ae" : "#ff6b57", stroke: "#17211d", strokeWidth: 6, cursor: "pointer" }, onClick: props.onActivate }),
      createElement(Rectangle, { style: { x: 456, y: 18, width: 92, height: 92, fill: "#f7c948", stroke: "#17211d", strokeWidth: 5, cursor: "pointer" }, onClick: props.onActivate }),
    ] }),
    createElement(Text, { style: { x: 358, y: 150, fill: "#17211d", font: "900 54px sans-serif", textAlign: "center" } }, "DRAW."),
    createElement(Text, { style: { x: 358, y: 222, fill: "#17211d", font: "900 42px sans-serif", textAlign: "center" } }, "MOVE. LEARN."),
  ];
}

function categoryCard(options: { eyebrow: string; title: string; description: string; href: string; className: string }): HTMLAnchorElement {
  const card = document.createElement("a");
  card.href = options.href;
  card.className = `studio-category-card ${options.className}`;
  card.innerHTML = `<span class="studio-category-card__art" aria-hidden="true"><i></i><b></b><em></em></span><span class="studio-category-card__copy"><small>${options.eyebrow}</small><strong>${options.title}</strong><span>${options.description}</span><u>Open lessons →</u></span>`;
  return card;
}

function routeHeading(title: string): HTMLHeadingElement {
  const element = document.createElement("h1");
  element.tabIndex = -1;
  element.textContent = title;
  return element;
}

function codePill(value: string): HTMLElement {
  const code = document.createElement("code");
  code.textContent = value;
  return code;
}

function categoryLink(entry: LearningExampleCatalogEntry | undefined, label: string): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = entry ? getLearningExampleRoute(entry) : "#/examples";
  const small = document.createElement("small");
  small.textContent = label;
  const strong = document.createElement("strong");
  strong.textContent = entry?.title ?? "Interactive examples";
  link.append(small, strong);
  return link;
}
