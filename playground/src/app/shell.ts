import {
  activeNavigationIds,
  type NavigationArea,
  type NavigationEntry,
} from "./navigation";
import type { ParsedStudioRoute } from "./routes";
import type { SearchDialogController } from "../search/search-dialog";
import type { SearchBundleLoader } from "../search/search-engine";

export interface StudioShellOptions {
  readonly app: HTMLElement;
  readonly navigation: readonly NavigationArea[];
  readonly onSearchNavigate?: (url: string) => void;
  readonly loadSearchBundle?: SearchBundleLoader;
}

export interface StudioShell {
  readonly main: HTMLElement;
  setNavigation(navigation: readonly NavigationArea[]): void;
  setActiveNavigation(route: ParsedStudioRoute): void;
  finishRoute(title: string, focus?: boolean): void;
  closeDrawer(restoreFocus?: boolean): void;
  dispose(): void;
}

/** Owns the stable Studio chrome while pages replace only the main region. */
export function createStudioShell(options: StudioShellOptions): StudioShell {
  const skipLink = document.createElement("a");
  skipLink.className = "skip-link";
  skipLink.href = "#studio-main";
  skipLink.textContent = "Skip to content";

  const shell = document.createElement("div");
  shell.className = "studio-shell";
  const mobileBar = document.createElement("header");
  mobileBar.className = "studio-mobile-bar";
  const menuButton = document.createElement("button");
  menuButton.type = "button";
  menuButton.className = "studio-menu-button";
  menuButton.setAttribute("aria-controls", "studio-navigation");
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.innerHTML = '<span aria-hidden="true">☰</span> Browse';
  const mobileBrand = document.createElement("a");
  mobileBrand.href = "#/learn";
  mobileBrand.className = "studio-mobile-brand";
  mobileBrand.textContent = "CRC / DOCS";
  const mobileSearchButton = createSearchTrigger("studio-search-trigger--mobile");
  mobileBar.append(menuButton, mobileBrand, mobileSearchButton);

  const drawerBackdrop = document.createElement("button");
  drawerBackdrop.type = "button";
  drawerBackdrop.className = "studio-drawer-backdrop";
  drawerBackdrop.ariaLabel = "Close documentation navigation";

  const sidebar = document.createElement("aside");
  sidebar.id = "studio-navigation";
  sidebar.className = "studio-sidebar";
  sidebar.ariaLabel = "Documentation navigation";
  const drawerCloseButton = document.createElement("button");
  drawerCloseButton.type = "button";
  drawerCloseButton.className = "studio-drawer-close";
  drawerCloseButton.ariaLabel = "Close documentation navigation";
  drawerCloseButton.textContent = "×";
  const brand = document.createElement("a");
  brand.href = "#/learn";
  brand.className = "studio-brand";
  brand.innerHTML =
    '<span class="studio-brand__mark" aria-hidden="true"><i></i><b></b><em></em></span><span>CRC<br><small>Canvas docs</small></span>';
  const desktopSearchButton = createSearchTrigger("studio-search-trigger--desktop");
  const navigationHost = document.createElement("nav");
  navigationHost.ariaLabel = "Documentation";
  navigationHost.className = "studio-nav";
  const testingLink = document.createElement("a");
  testingLink.href = "#/testing";
  testingLink.className = "studio-testing-link";
  testingLink.dataset.navigationId = "testing";
  testingLink.innerHTML =
    '<span aria-hidden="true">◇</span><span>Automated test labs<small>Deterministic browser fixtures</small></span>';
  sidebar.append(
    drawerCloseButton,
    brand,
    desktopSearchButton,
    navigationHost,
    testingLink,
  );

  const main = document.createElement("main");
  main.id = "studio-main";
  main.className = "studio-main";
  main.tabIndex = -1;
  const routeAnnouncements = document.createElement("div");
  routeAnnouncements.className = "visually-hidden";
  routeAnnouncements.role = "status";
  routeAnnouncements.ariaLive = "polite";

  shell.append(mobileBar, sidebar, drawerBackdrop, main);
  options.app.replaceChildren(skipLink, shell, routeAnnouncements);

  const narrowNavigation = window.matchMedia("(max-width: 980px)");
  let searchController: SearchDialogController | undefined;
  let loadingSearch: Promise<SearchDialogController> | undefined;
  let disposed = false;
  const ensureSearch = async (): Promise<SearchDialogController> => {
    if (searchController !== undefined) return searchController;
    if (loadingSearch !== undefined) return loadingSearch;
    loadingSearch = import("../search/search-dialog").then(({ mountSearchDialog }) => {
      const controller = mountSearchDialog({
        loadBundle:
          options.loadSearchBundle ??
          (() => Promise.reject(new Error("Search bundle loader was not configured."))),
        navigate:
          options.onSearchNavigate ??
          ((url) => {
            window.location.hash = url;
          }),
      });
      if (disposed) controller.dispose();
      else searchController = controller;
      return controller;
    });
    return loadingSearch;
  };
  const prepareSearch = () => {
    void ensureSearch().then((controller) => controller.preload()).catch(() => undefined);
  };
  const openSearch = (invoker: HTMLElement) => {
    void ensureSearch()
      .then((controller) => controller.open(invoker))
      .catch(() => undefined);
  };
  const onSearchShortcut = (event: KeyboardEvent) => {
    if (
      !(event.metaKey || event.ctrlKey) ||
      event.key.toLocaleLowerCase("en-US") !== "k" ||
      hasOpenModal() ||
      isMonacoInput(document.activeElement)
    ) {
      return;
    }
    event.preventDefault();
    const invoker =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : desktopSearchButton;
    openSearch(invoker);
  };
  const searchTriggers = [desktopSearchButton, mobileSearchButton];
  const onSearchTriggerClick = (event: Event) => {
    openSearch(event.currentTarget as HTMLButtonElement);
  };
  const syncDrawerAvailability = () => {
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
  };
  const closeDrawer = (restoreFocus = false) => {
    document.body.classList.remove("studio-drawer-open");
    menuButton.setAttribute("aria-expanded", "false");
    sidebar.removeAttribute("role");
    sidebar.removeAttribute("aria-modal");
    syncDrawerAvailability();
    if (restoreFocus) menuButton.focus();
  };
  const onMenuClick = () => {
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
  };
  const onKeydown = (event: KeyboardEvent) => {
    onSearchShortcut(event);
    if (event.defaultPrevented) return;
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
  };
  menuButton.addEventListener("click", onMenuClick);
  drawerCloseButton.addEventListener("click", () => closeDrawer(true));
  drawerBackdrop.addEventListener("click", () => closeDrawer(true));
  navigationHost.addEventListener("click", () => closeDrawer());
  testingLink.addEventListener("click", () => closeDrawer());
  for (const trigger of searchTriggers) {
    trigger.addEventListener("focus", prepareSearch);
    trigger.addEventListener("pointerenter", prepareSearch);
    trigger.addEventListener("click", onSearchTriggerClick);
  }
  document.addEventListener("keydown", onKeydown);
  narrowNavigation.addEventListener("change", syncDrawerAvailability);
  syncDrawerAvailability();

  const setNavigation = (navigation: readonly NavigationArea[]) => {
    navigationHost.replaceChildren(
      ...navigation.map((area) => renderNavigationEntry(area, true)),
    );
  };
  setNavigation(options.navigation);

  return {
    main,
    setNavigation,
    setActiveNavigation(route) {
      const active = activeNavigationIds(route);
      const activeArea = areaForRoute(route);
      for (const element of navigationHost.querySelectorAll<HTMLElement>(
        "[data-navigation-id]",
      )) {
        const id = element.dataset.navigationId;
        const activeBranch =
          id !== undefined && (active.has(id) || id === activeArea);
        element.classList.toggle("is-active", activeBranch);
        if (element instanceof HTMLAnchorElement && isCurrentRouteLink(element, route)) {
          element.setAttribute("aria-current", "page");
        } else if (element instanceof HTMLAnchorElement) {
          element.removeAttribute("aria-current");
        }
      }
      testingLink.classList.toggle(
        "is-active",
        route.kind === "testing" || route.kind === "test",
      );
      if (route.kind === "testing") {
        testingLink.setAttribute("aria-current", "page");
      } else {
        testingLink.removeAttribute("aria-current");
      }
    },
    finishRoute(title, focus = true) {
      document.title = `${title} · CRC Studio`;
      routeAnnouncements.textContent = `${title} loaded`;
      if (focus) main.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
    },
    closeDrawer,
    dispose() {
      disposed = true;
      menuButton.removeEventListener("click", onMenuClick);
      document.removeEventListener("keydown", onKeydown);
      narrowNavigation.removeEventListener("change", syncDrawerAvailability);
      for (const trigger of searchTriggers) {
        trigger.removeEventListener("focus", prepareSearch);
        trigger.removeEventListener("pointerenter", prepareSearch);
        trigger.removeEventListener("click", onSearchTriggerClick);
      }
      searchController?.dispose();
      document.body.classList.remove("studio-drawer-open");
    },
  };
}

function createSearchTrigger(modifier: string): HTMLButtonElement {
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = `studio-search-trigger ${modifier}`;
  trigger.setAttribute("aria-label", "Search documentation");
  trigger.innerHTML = '<span aria-hidden="true">⌕</span> Search docs...<kbd>⌘K</kbd>';
  return trigger;
}

function hasOpenModal(): boolean {
  return document.querySelector("dialog[open], [aria-modal='true']") !== null;
}

function isMonacoInput(element: Element | null): boolean {
  return element?.closest(".monaco-editor, textarea.inputarea") !== null;
}

function renderNavigationEntry(
  entry: NavigationEntry,
  primary = false,
): HTMLElement {
  const section = document.createElement("section");
  section.className = primary ? "studio-nav__area" : "studio-nav__group";
  const label = entry.href === undefined ? document.createElement("h2") : document.createElement("a");
  label.dataset.navigationId = entry.id;
  label.textContent = entry.label;
  if (label instanceof HTMLAnchorElement) label.href = entry.href!;
  section.appendChild(label);
  if (entry.children?.length) {
    const list = document.createElement("ul");
    for (const child of entry.children) {
      const item = document.createElement("li");
      item.appendChild(renderNavigationEntry(child));
      list.appendChild(item);
    }
    section.appendChild(list);
  }
  return section;
}

function areaForRoute(route: ParsedStudioRoute): string | undefined {
  if (route.kind === "example" || route.kind === "examples") return "examples";
  if (route.kind !== "document") return undefined;
  if (route.route.startsWith("#/api")) return "api";
  return "learn";
}

function isCurrentRouteLink(
  link: HTMLAnchorElement,
  route: ParsedStudioRoute,
): boolean {
  const href = routePathFromHref(link.href);
  switch (route.kind) {
    case "document":
      return href === route.route;
    case "example":
      return href === `#/examples/${route.group}/${route.slug}`;
    case "examples":
      return href === "#/examples";
    default:
      return false;
  }
}

function routePathFromHref(href: string): string {
  const hash = new URL(href, window.location.href).hash;
  const anchorIndex = hash.indexOf("#", 1);
  const queryIndex = hash.indexOf("?");
  const end = [anchorIndex, queryIndex]
    .filter((index) => index !== -1)
    .reduce((smallest, index) => Math.min(smallest, index), hash.length);
  return hash.slice(0, end);
}
