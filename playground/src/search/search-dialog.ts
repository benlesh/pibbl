import type { SearchKind } from "../../../tooling/studio-docs/search-index";
import { hasOpenModalOwner } from "../app/modal-owner";

import {
  createSearchEngine,
  type SearchBundleLoader,
  type SearchExcerpt,
  type SearchResult,
} from "./search-engine";

const kinds: readonly SearchKind[] = ["learn", "api", "example"];
const kindLabels: Readonly<Record<SearchKind, string>> = {
  learn: "Learn",
  api: "API",
  example: "Examples",
};

export interface SearchDialogOptions {
  readonly loadBundle: SearchBundleLoader;
  readonly navigate: (url: string) => void;
}

export interface SearchDialogController {
  open(invoker?: HTMLElement): void;
  close(): void;
  preload(): Promise<void>;
  dispose(): void;
}

/** Mounts the only search modal and owns its document-level keyboard handling. */
export function mountSearchDialog(
  options: SearchDialogOptions,
): SearchDialogController {
  const engine = createSearchEngine(options.loadBundle);
  const dialog = document.createElement("dialog");
  dialog.className = "studio-search-dialog";
  dialog.ariaLabel = "Search Pibbl documentation";

  const header = document.createElement("header");
  header.className = "studio-search-dialog__header";
  const title = document.createElement("h2");
  title.id = "studio-search-title";
  title.textContent = "Search docs";
  dialog.setAttribute("aria-labelledby", title.id);
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "studio-search-dialog__close";
  closeButton.ariaLabel = "Close search";
  closeButton.textContent = "×";
  header.append(title, closeButton);

  const inputLabel = document.createElement("label");
  inputLabel.className = "studio-search-dialog__label";
  inputLabel.htmlFor = "studio-search-input";
  inputLabel.textContent = "Search Learn, API, and Examples";
  const input = document.createElement("input");
  input.id = inputLabel.htmlFor;
  input.type = "search";
  input.className = "studio-search-dialog__input";
  input.dataset.searchInput = "";
  input.placeholder = "Search docs...";
  input.autocomplete = "off";
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-haspopup", "listbox");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", "studio-search-results");
  input.setAttribute("aria-autocomplete", "list");

  const filters = document.createElement("fieldset");
  filters.className = "studio-search-dialog__filters";
  const legend = document.createElement("legend");
  legend.textContent = "Search in";
  filters.append(legend);
  const filterButtons = new Map<SearchKind, HTMLButtonElement>();
  for (const kind of kinds) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.searchKind = kind;
    button.setAttribute("aria-pressed", "true");
    button.addEventListener("click", () => {
      if (selectedKinds.has(kind)) selectedKinds.delete(kind);
      else selectedKinds.add(kind);
      activeResult = -1;
      void refresh();
    });
    filterButtons.set(kind, button);
    filters.append(button);
  }

  const status = document.createElement("p");
  status.className = "studio-search-dialog__status";
  status.role = "status";
  status.ariaLive = "polite";
  const results = document.createElement("div");
  results.id = "studio-search-results";
  results.className = "studio-search-dialog__results";
  results.role = "listbox";
  results.ariaLabel = "Search results";
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "studio-search-dialog__retry";
  retry.dataset.searchRetry = "";
  retry.textContent = "Retry search";
  retry.hidden = true;

  dialog.append(header, inputLabel, input, filters, status, results, retry);
  document.body.append(dialog);

  let selectedKinds = new Set<SearchKind>(kinds);
  let currentResults: readonly SearchResult[] = [];
  let activeResult = -1;
  let requestVersion = 0;
  let invoker: HTMLElement | undefined;
  let restoreFocus = true;
  let disposed = false;
  const narrowScreen = window.matchMedia("(max-width: 700px)");

  const syncNarrowClass = () => {
    dialog.classList.toggle("studio-search-dialog--narrow", narrowScreen.matches);
  };
  const refresh = async (): Promise<void> => {
    const version = ++requestVersion;
    const query = input.value.trim();
    if (query.length === 0) {
      currentResults = [];
      activeResult = -1;
      renderReady("Start typing to search the public docs.", { learn: 0, api: 0, example: 0 });
      return;
    }
    retry.hidden = true;
    status.textContent = "Loading search results…";
    results.replaceChildren();
    try {
      const response = await engine.search(query, [...selectedKinds]);
      if (disposed || version !== requestVersion) return;
      currentResults = response.results;
      if (activeResult >= currentResults.length) activeResult = -1;
      const resultLabel = `${currentResults.length} result${currentResults.length === 1 ? "" : "s"}`;
      renderReady(
        currentResults.length === 0
          ? "No results. Try a different spelling or choose another category."
          : `${resultLabel} found.`,
        response.counts,
      );
    } catch {
      if (disposed || version !== requestVersion) return;
      currentResults = [];
      activeResult = -1;
      retry.hidden = false;
      status.textContent = "Search unavailable. You can keep browsing and try again.";
      results.replaceChildren();
    }
  };
  const preloadAndRefresh = async (): Promise<void> => {
    const version = ++requestVersion;
    retry.hidden = true;
    status.textContent = "Loading search index…";
    try {
      await engine.preload();
      if (disposed || version !== requestVersion) return;
      await refresh();
    } catch {
      if (disposed || version !== requestVersion) return;
      currentResults = [];
      activeResult = -1;
      retry.hidden = false;
      status.textContent = "Search unavailable. You can keep browsing and try again.";
      results.replaceChildren();
    }
  };
  const renderReady = (
    message: string,
    counts: Readonly<Record<SearchKind, number>>,
  ) => {
    status.textContent = message;
    retry.hidden = true;
    for (const kind of kinds) {
      const button = filterButtons.get(kind)!;
      const selected = selectedKinds.has(kind);
      button.setAttribute("aria-pressed", String(selected));
      button.classList.toggle("is-selected", selected);
      button.textContent = `${kindLabels[kind]} (${counts[kind]})`;
    }
    results.replaceChildren(...currentResults.map(renderResult));
    input.setAttribute("aria-expanded", String(currentResults.length > 0));
    if (activeResult >= 0) {
      input.setAttribute("aria-activedescendant", resultId(activeResult));
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  };
  const renderResult = (result: SearchResult, index: number): HTMLElement => {
    const option = document.createElement("div");
    option.id = resultId(index);
    option.className = "studio-search-result";
    option.role = "option";
    option.tabIndex = -1;
    option.dataset.searchUrl = result.url;
    option.setAttribute("aria-selected", String(index === activeResult));
    if (index === activeResult) option.classList.add("is-active");
    const resultHeader = document.createElement("span");
    resultHeader.className = "studio-search-result__header";
    const resultTitle = document.createElement("strong");
    resultTitle.textContent = result.heading || result.title;
    const kind = document.createElement("span");
    kind.textContent = kindLabels[result.kind];
    resultHeader.append(resultTitle, kind);
    const breadcrumb = document.createElement("span");
    breadcrumb.className = "studio-search-result__breadcrumb";
    breadcrumb.textContent = result.breadcrumb;
    const excerpt = document.createElement("span");
    excerpt.className = "studio-search-result__excerpt";
    appendHighlightedText(excerpt, result.excerpt);
    option.append(resultHeader, breadcrumb, excerpt);
    option.addEventListener("mousedown", (event) => event.preventDefault());
    option.addEventListener("pointermove", () => setActiveResult(index));
    option.addEventListener("click", () => activate(index));
    return option;
  };
  const setActiveResult = (index: number) => {
    if (activeResult === index) return;
    activeResult = index;
    for (const [position, option] of [...results.children].entries()) {
      option.classList.toggle("is-active", position === index);
      option.setAttribute("aria-selected", String(position === index));
    }
    input.setAttribute("aria-activedescendant", resultId(index));
  };
  const activate = (index: number) => {
    const result = currentResults[index];
    if (result === undefined) return;
    closeDialog(false);
    options.navigate(result.url);
  };
  const closeDialog = (shouldRestoreFocus = true) => {
    if (!dialog.open) return;
    const focusTarget =
      shouldRestoreFocus && invoker?.isConnected ? invoker : undefined;
    restoreFocus = false;
    dialog.close();
    focusTarget?.focus();
    invoker = undefined;
  };
  const onInput = () => {
    activeResult = -1;
    void refresh();
  };
  const onInputKeydown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown" && currentResults.length > 0) {
      event.preventDefault();
      setActiveResult(Math.min(activeResult + 1, currentResults.length - 1));
    } else if (event.key === "ArrowUp" && currentResults.length > 0) {
      event.preventDefault();
      setActiveResult(
        activeResult === -1
          ? currentResults.length - 1
          : Math.max(activeResult - 1, 0),
      );
    } else if (event.key === "Home" && currentResults.length > 0) {
      event.preventDefault();
      setActiveResult(0);
    } else if (event.key === "End" && currentResults.length > 0) {
      event.preventDefault();
      setActiveResult(currentResults.length - 1);
    } else if (event.key === "Enter" && activeResult >= 0) {
      event.preventDefault();
      activate(activeResult);
    }
  };
  const onDialogClose = () => {
    if (restoreFocus && invoker?.isConnected) invoker.focus();
    invoker = undefined;
    restoreFocus = true;
  };
  const onDialogCancel = (event: Event) => {
    event.preventDefault();
    closeDialog();
  };
  const onDocumentKeydown = (event: KeyboardEvent) => {
    if (disposed || event.defaultPrevented) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase("en-US") === "k") {
      if (hasOpenModalOwner(dialog) || isMonacoInput(document.activeElement)) return;
      event.preventDefault();
      open();
      return;
    }
    if (event.key === "Escape" && dialog.open) {
      event.preventDefault();
      closeDialog();
    }
  };
  const open = (nextInvoker?: HTMLElement) => {
    if (disposed || !dialog.isConnected) return;
    if (nextInvoker !== undefined) invoker = nextInvoker;
    else if (document.activeElement instanceof HTMLElement && document.activeElement !== dialog) {
      invoker = document.activeElement;
    }
    if (!dialog.open) dialog.showModal();
    syncNarrowClass();
    input.focus();
    void preloadAndRefresh();
  };

  const onCloseButtonClick = () => closeDialog();
  closeButton.addEventListener("click", onCloseButtonClick);
  retry.addEventListener("click", () => {
    void engine.retry().then(() => refresh()).catch(() => preloadAndRefresh());
  });
  input.addEventListener("input", onInput);
  input.addEventListener("keydown", onInputKeydown);
  dialog.addEventListener("close", onDialogClose);
  dialog.addEventListener("cancel", onDialogCancel);
  document.addEventListener("keydown", onDocumentKeydown);
  narrowScreen.addEventListener("change", syncNarrowClass);
  syncNarrowClass();

  return {
    open,
    close(): void {
      closeDialog();
    },
    async preload(): Promise<void> {
      await engine.preload();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      requestVersion++;
      closeDialog(false);
      closeButton.removeEventListener("click", onCloseButtonClick);
      input.removeEventListener("input", onInput);
      input.removeEventListener("keydown", onInputKeydown);
      dialog.removeEventListener("close", onDialogClose);
      dialog.removeEventListener("cancel", onDialogCancel);
      document.removeEventListener("keydown", onDocumentKeydown);
      narrowScreen.removeEventListener("change", syncNarrowClass);
      dialog.remove();
    },
  };
}

/** Renders only text nodes and marks; serialized excerpts never enter as HTML. */
export function appendHighlightedText(
  target: HTMLElement,
  excerpt: SearchExcerpt,
): void {
  target.replaceChildren();
  let cursor = 0;
  for (const range of excerpt.matches) {
    const start = Math.max(cursor, Math.min(range.start, excerpt.text.length));
    const end = Math.max(start, Math.min(range.end, excerpt.text.length));
    if (start > cursor) target.append(document.createTextNode(excerpt.text.slice(cursor, start)));
    if (end > start) {
      const mark = document.createElement("mark");
      mark.textContent = excerpt.text.slice(start, end);
      target.append(mark);
    }
    cursor = end;
  }
  if (cursor < excerpt.text.length) {
    target.append(document.createTextNode(excerpt.text.slice(cursor)));
  }
}

function resultId(index: number): string {
  return `studio-search-result-${index}`;
}

function isMonacoInput(element: Element | null): boolean {
  return element?.closest(".monaco-editor, textarea.inputarea") !== null;
}
