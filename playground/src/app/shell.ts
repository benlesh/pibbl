import {
  activeNavigationIds,
  createNavigationState,
  type NavigationArea,
  type NavigationEntry,
} from "./navigation";
import { hasOpenModalOwner } from "./modal-owner";
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
  mobileBrand.href = "#/examples";
  mobileBrand.className = "studio-mobile-brand";
  mobileBrand.textContent = "CRC / STUDIO";
  const mobileSearchButton = createSearchTrigger("studio-search-trigger--mobile");
  mobileBar.append(menuButton, mobileBrand, mobileSearchButton);

  const drawerBackdrop = document.createElement("button");
  drawerBackdrop.type = "button";
  drawerBackdrop.className = "studio-drawer-backdrop";
  drawerBackdrop.ariaLabel = "Close navigation";

  const sidebar = document.createElement("aside");
  sidebar.id = "studio-navigation";
  sidebar.className = "studio-sidebar";
  sidebar.ariaLabel = "Studio navigation";
  const drawerCloseButton = document.createElement("button");
  drawerCloseButton.type = "button";
  drawerCloseButton.className = "studio-drawer-close";
  drawerCloseButton.ariaLabel = "Close navigation";
  drawerCloseButton.textContent = "×";
  const brand = document.createElement("a");
  brand.href = "#/examples";
  brand.className = "studio-brand";
  brand.innerHTML =
    '<span class="studio-brand__mark" aria-hidden="true"><i></i><b></b><em></em></span><span>CRC<br><small>Studio</small></span>';
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
  const navigationState = createNavigationState();
  let currentNavigation = options.navigation;
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
      hasOpenModalOwner() ||
      document.body.classList.contains("studio-drawer-open") ||
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
  navigationHost.addEventListener("click", (event) => {
    if ((event.target as Element).closest("a") !== null) closeDrawer();
  });
  testingLink.addEventListener("click", () => closeDrawer());
  for (const trigger of searchTriggers) {
    trigger.addEventListener("focus", prepareSearch);
    trigger.addEventListener("pointerenter", prepareSearch);
    trigger.addEventListener("click", onSearchTriggerClick);
  }
  document.addEventListener("keydown", onKeydown);
  narrowNavigation.addEventListener("change", syncDrawerAvailability);
  syncDrawerAvailability();

  const setNavigation = (
    navigation: readonly NavigationArea[],
    focusNavigationId = focusedNavigationId(navigationHost),
  ) => {
    currentNavigation = navigation;
    navigationHost.replaceChildren(
      ...navigation.map((area) =>
        renderNavigationEntry(area, navigationState, (navigationId) => {
          setNavigation(currentNavigation, navigationId);
        }, true),
      ),
    );
    if (!disposed && focusNavigationId !== undefined) {
      navigationHost
        .querySelectorAll<HTMLButtonElement>("button[data-navigation-id]")
        .forEach((button) => {
          if (button.dataset.navigationId === focusNavigationId)
            button.focus({ preventScroll: true });
        });
    }
  };
  setNavigation(options.navigation);

  return {
    main,
    setNavigation,
    setActiveNavigation(route) {
      navigationState.setActiveRoute(route);
      setNavigation(currentNavigation);
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

function isMonacoInput(element: Element | null): boolean {
  return element?.closest(".monaco-editor, textarea.inputarea") !== null;
}

function renderNavigationEntry(
  entry: NavigationEntry,
  state: ReturnType<typeof createNavigationState>,
  onToggle: (navigationId: string) => void,
  primary = false,
): HTMLElement {
  const section = document.createElement("section");
  section.className = primary ? "studio-nav__area" : "studio-nav__group";
  const children = entry.children ?? [];
  const hasChildren = children.length > 0;
  const header = document.createElement("div");
  header.className = "studio-nav__entry";
  if (entry.href !== undefined) {
    const label = document.createElement("a");
    label.dataset.navigationId = entry.id;
    label.textContent = entry.label;
    label.href = entry.href;
    header.appendChild(label);
  }
  if (hasChildren) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "studio-nav__toggle";
    toggle.dataset.navigationId = entry.id;
    toggle.setAttribute("aria-expanded", String(state.isExpanded(entry.id)));
    toggle.setAttribute(
      "aria-label",
      `${state.isExpanded(entry.id) ? "Collapse" : "Expand"} ${entry.label}`,
    );
    toggle.innerHTML = '<span aria-hidden="true">⌄</span>';
    toggle.addEventListener("click", () => {
      state.toggle(entry.id);
      onToggle(entry.id);
    });
    if (entry.href === undefined) {
      toggle.classList.add("studio-nav__toggle--label");
      toggle.textContent = entry.label;
    }
    header.appendChild(toggle);
  }
  section.appendChild(header);
  if (hasChildren) {
    const list = document.createElement("ul");
    list.hidden = !state.isExpanded(entry.id);
    for (const child of children) {
      const item = document.createElement("li");
      item.appendChild(renderNavigationEntry(child, state, onToggle));
      list.appendChild(item);
    }
    section.appendChild(list);
  }
  return section;
}

function focusedNavigationId(host: HTMLElement): string | undefined {
  const focused = document.activeElement;
  if (!(focused instanceof HTMLButtonElement) || !host.contains(focused)) {
    return undefined;
  }
  return focused.dataset.navigationId;
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
