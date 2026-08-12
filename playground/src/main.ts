import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/jetbrains-mono";
import { crc, defineComp, g, rect, text, type CRCController } from "@crc/core";
import type { ScenarioSurface } from "@crc/scenarios/surface";
import {
  getLearningExampleBySlug,
  getLearningExampleRoute,
  getLearningExamplesBySection,
  getScenarioBySlug,
  getScenarioRoute,
  learningExampleCatalog,
  learningSections,
  loadScenario,
  scenarioCatalog,
  smokeScenarioEntry,
  type LearningExampleCatalogEntry,
} from "@crc/scenarios";
import { mountScenarioSurface } from "@crc/scenarios/surface";
import { loadLearningSource } from "./learning-sources";
import { loadScenarioSource } from "./scenario-sources";
import { readSharedCode } from "./share-code";
import "./style.css";

type Route =
  | { kind: "examples" }
  | { kind: "lesson"; entry: LearningExampleCatalogEntry }
  | { kind: "testing" }
  | { kind: "test"; slug: string };

interface Disposable {
  dispose(): void | Promise<void>;
}

const app = document.getElementById("app");
if (!app) throw new Error("No app element found.");

const skipLink = document.createElement("a");
skipLink.className = "skip-link";
skipLink.href = "#studio-main";
skipLink.textContent = "Skip to lesson";

const shell = document.createElement("div");
shell.className = "studio-shell";
const mobileBar = document.createElement("header");
mobileBar.className = "studio-mobile-bar";
const menuButton = document.createElement("button");
menuButton.type = "button";
menuButton.className = "studio-menu-button";
menuButton.setAttribute("aria-controls", "studio-navigation");
menuButton.setAttribute("aria-expanded", "false");
menuButton.innerHTML = '<span aria-hidden="true">☰</span> Lessons';
const mobileBrand = document.createElement("a");
mobileBrand.href = "#/examples";
mobileBrand.className = "studio-mobile-brand";
mobileBrand.textContent = "CRC / STUDIO";
mobileBar.append(menuButton, mobileBrand);

const drawerBackdrop = document.createElement("button");
drawerBackdrop.type = "button";
drawerBackdrop.className = "studio-drawer-backdrop";
drawerBackdrop.ariaLabel = "Close lesson navigation";

const sidebar = document.createElement("aside");
sidebar.id = "studio-navigation";
sidebar.className = "studio-sidebar";
sidebar.ariaLabel = "Lesson navigation";
const drawerCloseButton = document.createElement("button");
drawerCloseButton.type = "button";
drawerCloseButton.className = "studio-drawer-close";
drawerCloseButton.ariaLabel = "Close lesson navigation";
drawerCloseButton.textContent = "×";
const brand = document.createElement("a");
brand.href = "#/examples";
brand.className = "studio-brand";
brand.innerHTML =
  '<span class="studio-brand__mark" aria-hidden="true"><i></i><b></b><em></em></span><span>CRC<br><small>Canvas studio</small></span>';
const navigation = document.createElement("nav");
navigation.ariaLabel = "Learning examples";
navigation.className = "studio-nav";
const homeLink = document.createElement("a");
homeLink.href = "#/examples";
homeLink.className = "studio-nav__home";
homeLink.dataset.route = "examples";
homeLink.innerHTML = '<span aria-hidden="true">◫</span> Studio home';
navigation.appendChild(homeLink);

for (const section of learningSections) {
  const group = document.createElement("section");
  group.className = "studio-nav__group";
  const heading = document.createElement("h2");
  heading.textContent = section.label;
  const list = document.createElement("ul");
  for (const entry of getLearningExamplesBySection(section.id)) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = getLearningExampleRoute(entry);
    link.dataset.lessonSlug = entry.slug;
    link.textContent = entry.shortTitle;
    item.appendChild(link);
    list.appendChild(item);
  }
  group.append(heading, list);
  navigation.appendChild(group);
}

const testingLink = document.createElement("a");
testingLink.href = "#/testing";
testingLink.className = "studio-testing-link";
testingLink.dataset.route = "testing";
testingLink.innerHTML =
  '<span aria-hidden="true">◇</span><span>Automated test labs<small>Deterministic browser fixtures</small></span>';
sidebar.append(drawerCloseButton, brand, navigation, testingLink);

const main = document.createElement("main");
main.id = "studio-main";
main.className = "studio-main";
main.tabIndex = -1;
const routeAnnouncements = document.createElement("div");
routeAnnouncements.className = "visually-hidden";
routeAnnouncements.role = "status";
routeAnnouncements.ariaLive = "polite";

shell.append(mobileBar, sidebar, drawerBackdrop, main);
app.append(skipLink, shell, routeAnnouncements);

let activeDisposable: Disposable | undefined;
let activeSurface: ScenarioSurface<unknown> | undefined;
let renderVersion = 0;

const narrowNavigation = window.matchMedia("(max-width: 980px)");

function syncDrawerAvailability(): void {
  if (!narrowNavigation.matches) {
    document.body.classList.remove("studio-drawer-open");
    menuButton.setAttribute("aria-expanded", "false");
    sidebar.removeAttribute("role");
    sidebar.removeAttribute("aria-modal");
  }
  const closedOnNarrowScreen =
    narrowNavigation.matches &&
    !document.body.classList.contains("studio-drawer-open");
  sidebar.inert = closedOnNarrowScreen;
  if (closedOnNarrowScreen) sidebar.setAttribute("aria-hidden", "true");
  else sidebar.removeAttribute("aria-hidden");
}

function closeDrawer(restoreFocus = false): void {
  document.body.classList.remove("studio-drawer-open");
  menuButton.setAttribute("aria-expanded", "false");
  sidebar.removeAttribute("role");
  sidebar.removeAttribute("aria-modal");
  syncDrawerAvailability();
  if (restoreFocus) menuButton.focus();
}

menuButton.addEventListener("click", () => {
  const open = !document.body.classList.contains("studio-drawer-open");
  document.body.classList.toggle("studio-drawer-open", open);
  menuButton.setAttribute("aria-expanded", String(open));
  if (open) {
    sidebar.inert = false;
    sidebar.removeAttribute("aria-hidden");
    sidebar.setAttribute("role", "dialog");
    sidebar.setAttribute("aria-modal", "true");
    drawerCloseButton.focus();
  } else {
    closeDrawer(true);
  }
});
drawerCloseButton.addEventListener("click", () => closeDrawer(true));
drawerBackdrop.addEventListener("click", () => closeDrawer(true));
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    document.body.classList.contains("studio-drawer-open")
  ) {
    closeDrawer(true);
    return;
  }
  if (
    event.key === "Tab" &&
    document.body.classList.contains("studio-drawer-open")
  ) {
    const focusable = [
      ...sidebar.querySelectorAll<HTMLElement>("a, button:not([disabled])"),
    ];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
});
navigation.addEventListener("click", () => closeDrawer());
testingLink.addEventListener("click", () => closeDrawer());
narrowNavigation.addEventListener("change", syncDrawerAvailability);
syncDrawerAvailability();

function hashPath(): string {
  return window.location.hash.split("?", 1)[0];
}

function parseRoute(): Route {
  const path = hashPath();
  if (!path || path === "#" || path === "#/") {
    window.history.replaceState(null, "", "#/examples");
    return { kind: "examples" };
  }
  if (path === "#/scenarios") {
    window.history.replaceState(null, "", "#/testing");
    return { kind: "testing" };
  }
  const legacyMatch = /^#\/scenarios\/([a-z0-9-]+)$/u.exec(path);
  if (legacyMatch) {
    window.history.replaceState(null, "", `#/testing/${legacyMatch[1]}`);
    return { kind: "test", slug: legacyMatch[1] };
  }
  if (path === "#/examples") return { kind: "examples" };
  const lessonMatch = /^#\/examples\/([a-z0-9-]+)\/([a-z0-9-]+)$/u.exec(path);
  if (lessonMatch) {
    const entry = getLearningExampleBySlug(lessonMatch[2]);
    if (entry) {
      const canonical = getLearningExampleRoute(entry);
      if (!path.startsWith(canonical))
        window.history.replaceState(
          null,
          "",
          `${canonical}${window.location.hash.includes("?") ? `?${window.location.hash.split("?", 2)[1]}` : ""}`,
        );
      return { kind: "lesson", entry };
    }
  }
  if (path === "#/testing") return { kind: "testing" };
  const testMatch = /^#\/testing\/([a-z0-9-]+)$/u.exec(path);
  if (testMatch) return { kind: "test", slug: testMatch[1] };
  window.history.replaceState(null, "", "#/examples");
  return { kind: "examples" };
}

async function clearActive(): Promise<void> {
  await activeDisposable?.dispose();
  activeDisposable = undefined;
  await activeSurface?.dispose();
  activeSurface = undefined;
}

function setActiveNavigation(route: Route): void {
  const currentSlug = route.kind === "lesson" ? route.entry.slug : undefined;
  homeLink.classList.toggle("is-active", route.kind === "examples");
  testingLink.classList.toggle(
    "is-active",
    route.kind === "testing" || route.kind === "test",
  );
  for (const link of sidebar.querySelectorAll<HTMLAnchorElement>(
    "[data-lesson-slug]",
  )) {
    const active = link.dataset.lessonSlug === currentSlug;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}

function finishRoute(title: string, focus = true): void {
  document.title = `${title} · CRC Studio`;
  routeAnnouncements.textContent = `${title} loaded`;
  if (focus)
    main.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
}

function heading(title: string): HTMLHeadingElement {
  const element = document.createElement("h1");
  element.tabIndex = -1;
  element.textContent = title;
  return element;
}

const HeroScene = defineComp(function HeroScene(props: {
  phase: number;
  onActivate: () => void;
}) {
  const angle = props.phase % 2 ? 11 : -7;
  return [
    rect({ x: 0, y: 0, width: 720, height: 420, fillStyle: "#f7c948" }),
    rect({
      x: 38,
      y: 38,
      width: 644,
      height: 344,
      fillStyle: "#fffdf6",
      strokeStyle: "#17211d",
      lineWidth: 6,
    }),
    g({
      x: 76,
      y: 60,
      rotate: angle,
      rotateOrigin: [284, 150],
      children: [
        rect({
          x: 46,
          y: 22,
          width: 222,
          height: 252,
          fillStyle: "#1f4bd8",
          cursor: "pointer",
          onClick: props.onActivate,
        }),
        rect({
          x: 238,
          y: 84,
          width: 252,
          height: 152,
          fillStyle: props.phase % 2 ? "#74d3ae" : "#ff6b57",
          strokeStyle: "#17211d",
          lineWidth: 6,
          cursor: "pointer",
          onClick: props.onActivate,
        }),
        rect({
          x: 456,
          y: 18,
          width: 92,
          height: 92,
          fillStyle: "#f7c948",
          strokeStyle: "#17211d",
          lineWidth: 5,
          cursor: "pointer",
          onClick: props.onActivate,
        }),
      ],
    }),
    text({
      text: "DRAW.",
      x: 358,
      y: 150,
      fillStyle: "#17211d",
      font: "900 54px sans-serif",
      textAlign: "center",
    }),
    text({
      text: "MOVE. LEARN.",
      x: 358,
      y: 222,
      fillStyle: "#17211d",
      font: "900 42px sans-serif",
      textAlign: "center",
    }),
  ];
});

function categoryCard(options: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  className: string;
}): HTMLAnchorElement {
  const card = document.createElement("a");
  card.href = options.href;
  card.className = `studio-category-card ${options.className}`;
  card.innerHTML = `<span class="studio-category-card__art" aria-hidden="true"><i></i><b></b><em></em></span><span class="studio-category-card__copy"><small>${options.eyebrow}</small><strong>${options.title}</strong><span>${options.description}</span><u>Open lessons →</u></span>`;
  return card;
}

function renderLanding(): void {
  const article = document.createElement("article");
  article.className = "studio-landing";
  const intro = document.createElement("header");
  intro.className = "studio-landing__intro";
  const copy = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "studio-eyebrow";
  eyebrow.textContent = "A hands-on Canvas workshop";
  const title = heading("Make shapes. Teach the mouse.");
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
  let controller: CRCController;
  const renderHero = () => {
    controller = crc(
      canvas,
      HeroScene({
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
      description:
        "Rects, paths, lines, type, images, transforms, clips, and layers.",
      href: getLearningExampleRoute(getLearningExampleBySlug("rectangle")!),
      className: "is-drawing",
    }),
    categoryCard({
      eyebrow: "8 mouse events",
      title: "Make it react",
      description:
        "See every supported event produce immediate, visible feedback.",
      href: getLearningExampleRoute(getLearningExampleBySlug("click")!),
      className: "is-mouse",
    }),
    categoryCard({
      eyebrow: "4 deeper studies",
      title: "Master targeting",
      description:
        "Trace sequences, widen hit areas, and reason about composed paint order.",
      href: getLearningExampleRoute(
        getLearningExampleBySlug("event-sequences")!,
      ),
      className: "is-advanced",
    }),
  );
  article.append(intro, cards);
  main.replaceChildren(article);
  activeDisposable = { dispose: () => controller.dispose() };
  finishRoute("Interactive examples");
}

function codePill(value: string): HTMLElement {
  const code = document.createElement("code");
  code.textContent = value;
  return code;
}

async function renderLesson(
  entry: LearningExampleCatalogEntry,
  version: number,
): Promise<void> {
  const section = learningSections.find((value) => value.id === entry.section);
  const article = document.createElement("article");
  article.className = "lesson-page";
  const header = document.createElement("header");
  header.className = "lesson-header";
  const index = document.createElement("p");
  index.className = "studio-eyebrow";
  index.textContent = `${section?.label ?? entry.section} / ${String(learningExampleCatalog.indexOf(entry) + 1).padStart(2, "0")}`;
  const title = heading(entry.title);
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
  workbenchHost.innerHTML =
    '<p role="status">Loading the TypeScript workbench…</p>';

  const teaching = document.createElement("div");
  teaching.className = "lesson-teaching-grid";
  const tryIt = document.createElement("section");
  tryIt.className = "lesson-callout lesson-callout--try";
  tryIt.innerHTML =
    '<p class="studio-eyebrow">Try it</p><h2>Touch the scene, then the code.</h2>';
  const prompts = document.createElement("ol");
  for (const [label, value] of [
    ["Gesture", entry.prompts.gesture],
    ["Code change", entry.prompts.code],
  ] as const) {
    const item = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = label;
    item.append(strong, document.createTextNode(value));
    prompts.appendChild(item);
  }
  tryIt.appendChild(prompts);
  const notes = document.createElement("section");
  notes.className = "lesson-callout lesson-callout--notes";
  notes.innerHTML =
    '<p class="studio-eyebrow">API notes</p><h2>Keep in mind</h2>';
  const notesList = document.createElement("ul");
  for (const note of entry.apiNotes) {
    const item = document.createElement("li");
    const parts = note.split("`");
    for (let i = 0; i < parts.length; i++)
      item.append(
        i % 2 ? codePill(parts[i]) : document.createTextNode(parts[i]),
      );
    notesList.appendChild(item);
  }
  notes.appendChild(notesList);
  teaching.append(tryIt, notes);

  const limitation = document.createElement("p");
  limitation.className = "lesson-limitation";
  limitation.innerHTML =
    "<strong>Canvas input note:</strong> CRC currently exposes mouse interactions only. The studio navigation and controls are keyboard-accessible, but painted Canvas targets do not create DOM semantics or keyboard controls.";

  const pagination = document.createElement("nav");
  pagination.className = "lesson-pagination";
  pagination.ariaLabel = "Previous and next lessons";
  const previous = entry.relationships.previous
    ? getLearningExampleBySlug(entry.relationships.previous)
    : undefined;
  const next = entry.relationships.next
    ? getLearningExampleBySlug(entry.relationships.next)
    : undefined;
  if (previous) pagination.appendChild(categoryLink(previous, "← Previous"));
  else pagination.appendChild(categoryLink(undefined, "← Studio home"));
  if (next) pagination.appendChild(categoryLink(next, "Next →"));
  else pagination.appendChild(categoryLink(undefined, "Studio home →"));

  article.append(
    header,
    objectives,
    workbenchHost,
    teaching,
    limitation,
    pagination,
  );
  main.replaceChildren(article);
  finishRoute(entry.title);

  const [source, editorModule] = await Promise.all([
    loadLearningSource(entry),
    import("./editor-workbench"),
  ]);
  if (version !== renderVersion) return;
  const shared = readSharedCode(window.location.hash, source);
  workbenchHost.replaceChildren();
  workbenchHost.classList.remove("lesson-workbench-loading");
  activeDisposable = await editorModule.mountEditorWorkbench({
    container: workbenchHost,
    entry,
    canonicalSource: source,
    initialSource: shared.code,
    sourceIssue: shared.issue,
  });
}

function categoryLink(
  entry: LearningExampleCatalogEntry | undefined,
  label: string,
): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = entry ? getLearningExampleRoute(entry) : "#/examples";
  const small = document.createElement("small");
  small.textContent = label;
  const strong = document.createElement("strong");
  strong.textContent = entry?.title ?? "Interactive examples";
  link.append(small, strong);
  return link;
}

function renderTestingIndex(): void {
  const article = document.createElement("article");
  article.className = "testing-index";
  const header = document.createElement("header");
  header.className = "testing-header";
  const eyebrow = document.createElement("p");
  eyebrow.className = "studio-eyebrow";
  eyebrow.textContent = "Verification workshop";
  const title = heading("Automated test labs");
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
  main.replaceChildren(article);
  finishRoute("Automated test labs");
}

async function renderTestDetail(slug: string, version: number): Promise<void> {
  const selected = getScenarioBySlug(slug) ?? smokeScenarioEntry;
  if (selected.metadata.slug !== slug)
    window.history.replaceState(null, "", getScenarioRoute(selected));
  const loading = document.createElement("p");
  loading.className = "testing-loading";
  loading.role = "status";
  loading.textContent = "Mounting deterministic fixture…";
  main.replaceChildren(loading);
  const [definition, source] = await Promise.all([
    loadScenario(selected),
    loadScenarioSource(selected),
  ]);
  if (version !== renderVersion) return;
  const host = document.createElement("div");
  host.className = "testing-area";
  main.replaceChildren(host);
  activeSurface = await mountScenarioSurface({
    container: host,
    entry: selected,
    definition,
    sourceText: source,
  });
  if (version !== renderVersion) {
    await activeSurface.dispose();
    activeSurface = undefined;
    return;
  }

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
      void import("./editor-workbench").then((module) => {
        if (!details.isConnected) return;
        editorHost.replaceChildren();
        sourceEditor = module.mountReadOnlySource(
          editorHost,
          source,
          selected.metadata.slug,
        );
      });
    });
    activeDisposable = { dispose: () => sourceEditor?.dispose() };
  }
  const back = document.createElement("a");
  back.href = "#/testing";
  back.className = "studio-secondary-action testing-back";
  back.textContent = "← All automated test labs";
  host.prepend(back);
  finishRoute(`${selected.metadata.title} test lab`);
}

async function renderRoute(): Promise<void> {
  const version = ++renderVersion;
  await clearActive();
  if (version !== renderVersion) return;
  closeDrawer();
  const route = parseRoute();
  setActiveNavigation(route);
  if (route.kind === "examples") renderLanding();
  if (route.kind === "lesson") await renderLesson(route.entry, version);
  if (route.kind === "testing") renderTestingIndex();
  if (route.kind === "test") await renderTestDetail(route.slug, version);
}

window.addEventListener("hashchange", () => void renderRoute());
window.addEventListener("beforeunload", () => {
  activeDisposable?.dispose();
  void activeSurface?.dispose();
});
void renderRoute();
