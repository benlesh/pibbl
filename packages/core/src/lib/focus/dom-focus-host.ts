import type { Teardowns } from "../teardowns.js";
import type { PibblEventRoot } from "../types.js";
import type { PibblEventType } from "../events/types.js";
import type { PibblFocusManager } from "./focus-manager.js";
import { moveTab } from "./keyboard-defaults.js";
import type { HtmlFocusRegion } from "./html-focus-region.js";
import { getManagedTabStops } from "./dom-tab-stops.js";

interface TabIndexSnapshot {
  readonly existed: boolean;
  readonly value: string | null;
}

interface TabIndexOwnership {
  snapshot: TabIndexSnapshot;
  baseTabIndex: number;
  ownedValue: string | undefined;
  lost: boolean;
}

interface PendingTabEntry {
  readonly event: KeyboardEvent;
  readonly origin: Element | null;
}

export interface PibblMountedDOMFocusHost {
  beforeNativeDispatch(type: PibblEventType, event: Event): boolean;
  focusFromPress(): void;
  setManager(manager: PibblFocusManager | undefined): void;
  syncCandidateAvailability(hasCandidates: boolean): void;
  syncHtmlRegions(regions: readonly HtmlFocusRegion[]): void;
}

export function mountDOMFocusHost(
  canvas: HTMLCanvasElement,
  eventRoot: PibblEventRoot,
  teardowns: Teardowns,
): PibblMountedDOMFocusHost {
  let tabIndexOwnership: TabIndexOwnership | undefined;
  let candidateReason = false;
  let pressReason = false;
  let pendingTabEntry: PendingTabEntry | undefined;
  let pendingTabExpiry: ReturnType<typeof setTimeout> | undefined;
  let manager: PibblFocusManager | undefined;
  let disposed = false;
  let domFocusActive = canvas.ownerDocument.activeElement === canvas;
  let htmlRegions: readonly HtmlFocusRegion[] = Object.freeze([]);
  let managedHtmlReason = false;
  let leadingSentinel: HTMLSpanElement | undefined;
  let trailingSentinel: HTMLSpanElement | undefined;
  let exitingSentinel: HTMLSpanElement | undefined;
  let pendingPointerRegion: HtmlFocusRegion | undefined;
  let pendingKeyboardFocus = false;
  // htmlOverlay is mount configuration: it cannot appear after this focus host
  // is constructed. Keep the ordinary Canvas-only listener footprint intact.
  const supportsHtmlRegions = Boolean(eventRoot.htmlOverlay);
  const keydownsWithTarget = new WeakSet<KeyboardEvent>();

  const restoreSnapshot = (ownership: TabIndexOwnership) => {
    if (ownership.snapshot.existed) {
      canvas.setAttribute("tabindex", ownership.snapshot.value ?? "");
    } else {
      canvas.removeAttribute("tabindex");
    }
  };

  const snapshotTabIndex = (): TabIndexSnapshot => ({
    existed: canvas.hasAttribute("tabindex"),
    value: canvas.getAttribute("tabindex"),
  });

  const matchesSnapshot = (snapshot: TabIndexSnapshot): boolean =>
    canvas.hasAttribute("tabindex") === snapshot.existed &&
    canvas.getAttribute("tabindex") === snapshot.value;

  const syncTabIndex = () => {
    const hasReason = candidateReason || pressReason;
    if (!tabIndexOwnership && hasReason) {
      tabIndexOwnership = {
        snapshot: snapshotTabIndex(),
        baseTabIndex: canvas.tabIndex,
        ownedValue: undefined,
        lost: false,
      };
    }
    const ownership = tabIndexOwnership;
    if (!ownership) return;

    if (
      !ownership.lost &&
      ownership.ownedValue !== undefined &&
      (!canvas.hasAttribute("tabindex") ||
        canvas.getAttribute("tabindex") !== ownership.ownedValue)
    ) {
      ownership.lost = true;
      ownership.ownedValue = undefined;
    }

    if (
      !ownership.lost &&
      ownership.ownedValue === undefined &&
      !matchesSnapshot(ownership.snapshot)
    ) {
      ownership.snapshot = snapshotTabIndex();
      ownership.baseTabIndex = canvas.tabIndex;
    }

    if (!hasReason) {
      if (!ownership.lost && ownership.ownedValue !== undefined) {
        restoreSnapshot(ownership);
      }
      tabIndexOwnership = undefined;
      return;
    }
    if (ownership.lost) return;

    const desired = candidateReason
      ? managedHtmlReason
        ? "-1"
        : ownership.snapshot.existed && ownership.baseTabIndex >= 0
          ? undefined
          : "0"
      : ownership.snapshot.existed
        ? undefined
        : "-1";
    if (desired === ownership.ownedValue) return;
    if (desired === undefined) {
      if (ownership.ownedValue !== undefined) {
        restoreSnapshot(ownership);
        ownership.ownedValue = undefined;
      }
      return;
    }
    canvas.setAttribute("tabindex", desired);
    ownership.ownedValue = desired;
  };

  const focusFromPress = () => {
    if (disposed) return;
    pressReason = true;
    syncTabIndex();
    canvas.focus({ preventScroll: true });
    if (canvas.ownerDocument.activeElement !== canvas) {
      pressReason = false;
      syncTabIndex();
    }
  };

  const syncCandidateAvailability = (hasCandidates: boolean) => {
    if (disposed) return;
    if (candidateReason === hasCandidates) return;
    candidateReason = hasCandidates;
    syncTabIndex();
  };

  const setManager = (nextManager: PibblFocusManager | undefined) => {
    if (disposed) return;
    manager = nextManager;
    syncCandidateAvailability(Boolean(nextManager?.hasFocusCandidates));
    syncHtmlRegions(nextManager?.htmlFocusRegions ?? []);
  };

  const isManagedRegion = (
    target: EventTarget | null,
  ): HtmlFocusRegion | undefined =>
    target instanceof Node
      ? htmlRegions.find(
          (region) => region.active && region.content?.contains(target),
        )
      : undefined;

  const removeSentinels = () => {
    leadingSentinel?.remove();
    trailingSentinel?.remove();
    leadingSentinel = undefined;
    trailingSentinel = undefined;
    exitingSentinel = undefined;
  };

  const makeSentinel = () => {
    const sentinel = canvas.ownerDocument.createElement("span");
    sentinel.tabIndex = 0;
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText =
      "position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;";
    return sentinel;
  };

  const enterFromSentinel = (backwards: boolean, sentinel: HTMLSpanElement) => {
    if (exitingSentinel === sentinel) {
      exitingSentinel = undefined;
      return;
    }
    const activeManager = manager;
    if (!activeManager) return;
    activeManager.enterDOMFocus(backwards);
  };

  const syncHtmlRegions = (regions: readonly HtmlFocusRegion[]) => {
    htmlRegions = regions.filter((region) => region.active && region.content);
    managedHtmlReason = htmlRegions.length > 0;
    syncTabIndex();
    removeSentinels();
    const activeRegion = isManagedRegion(canvas.ownerDocument.activeElement);
    manager?.reconcileNativeHtmlFocus(activeRegion);
    if (!manager || htmlRegions.length === 0) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    leadingSentinel = makeSentinel();
    trailingSentinel = makeSentinel();
    parent.insertBefore(leadingSentinel, canvas);
    // The configured overlay is the canvas's adjacent sibling. Keeping the
    // trailing sentinel after it makes native entry/exit cover both surfaces.
    const overlay = canvas.nextElementSibling;
    parent.insertBefore(
      trailingSentinel,
      overlay ? overlay.nextSibling : canvas.nextSibling,
    );
    leadingSentinel.addEventListener("focus", () =>
      enterFromSentinel(true, leadingSentinel!),
    );
    trailingSentinel.addEventListener("focus", () =>
      enterFromSentinel(false, trailingSentinel!),
    );
  };

  const exitSurface = (backwards: boolean) => {
    const sentinel = backwards ? leadingSentinel : trailingSentinel;
    if (!sentinel) return;
    exitingSentinel = sentinel;
    sentinel.focus({ preventScroll: true });
  };

  const clearPendingTabEntry = () => {
    pendingTabEntry = undefined;
    if (pendingTabExpiry !== undefined) clearTimeout(pendingTabExpiry);
    pendingTabExpiry = undefined;
  };

  const onDocumentKeyDown = (event: KeyboardEvent) => {
    // A click on an already focused control has no focusin to consume this
    // marker. Keyboard navigation must establish a fresh keyboard modality.
    pendingPointerRegion = undefined;
    pendingKeyboardFocus = event.key === "Tab";
    if (event.key !== "Tab") return;
    clearPendingTabEntry();
    const entry: PendingTabEntry = {
      event,
      origin: canvas.ownerDocument.activeElement,
    };
    pendingTabEntry = entry;
    const expiry = setTimeout(() => {
      if (pendingTabEntry === entry) pendingTabEntry = undefined;
      if (pendingTabExpiry === expiry) pendingTabExpiry = undefined;
    }, 0);
    pendingTabExpiry = expiry;
  };

  const beforeNativeDispatch = (type: PibblEventType, event: Event) => {
    const activeManager = manager;
    if (!activeManager) return true;
    if (type === "focus" || type === "focusin") {
      if (canvas.ownerDocument.activeElement !== canvas) return false;
      if (domFocusActive) return false;
      domFocusActive = true;
      const entry = pendingTabEntry;
      clearPendingTabEntry();
      activeManager.enterDOMFocus(
        Boolean(
          entry &&
          entry.event.eventPhase === Event.NONE &&
          !entry.event.defaultPrevented &&
          entry.origin?.ownerDocument === canvas.ownerDocument &&
          isFocusEventForCanvas(event, canvas) &&
          event.relatedTarget === entry.origin &&
          entry.event.shiftKey,
        ),
      );
      return false;
    }
    if (type === "blur" || type === "focusout") {
      if (canvas.ownerDocument.activeElement === canvas) return false;
      if (domFocusActive) {
        domFocusActive = false;
        clearPendingTabEntry();
        activeManager.leaveDOMFocus();
      }
      return false;
    }
    if (
      type === "keydown" &&
      event instanceof KeyboardEvent &&
      activeManager.resolveKeyboardTarget()
    ) {
      keydownsWithTarget.add(event);
    }
    return true;
  };

  const onNativeFocus = () => undefined;
  const onNativeKeyUp = () => undefined;
  const onNativePress = () => undefined;
  const onNativeExit = () => {
    pressReason = false;
    syncTabIndex();
  };
  const onNativeKeyDown = (event: Event) => {
    if (!(event instanceof KeyboardEvent) || event.key !== "Tab") return;
    if (keydownsWithTarget.delete(event)) return;
    const activeManager = manager;
    if (
      !activeManager ||
      event.defaultPrevented ||
      activeManager.resolveKeyboardTarget()
    ) {
      return;
    }
    if (moveTab(activeManager, event.shiftKey) === "moved") {
      event.preventDefault();
    }
  };

  const onHtmlFocusIn = (event: FocusEvent) => {
    const region = isManagedRegion(event.target);
    if (!region || !manager) return;
    const pointerOrigin = pendingPointerRegion === region;
    const keyboardOrigin = pendingKeyboardFocus;
    pendingPointerRegion = undefined;
    pendingKeyboardFocus = false;
    manager.adoptNativeHtmlFocus(
      region,
      pointerOrigin ? "pointer" : keyboardOrigin ? "keyboard" : undefined,
    );
  };

  const onHtmlPointerDown = (event: PointerEvent) => {
    // A pointer interaction supersedes a Tab origin even when it occurs
    // outside this root; no later programmatic focus may inherit that Tab.
    pendingKeyboardFocus = false;
    pendingPointerRegion = isManagedRegion(event.target);
  };

  const onHtmlFocusOut = (event: FocusEvent) => {
    const region = isManagedRegion(event.target);
    if (!region || !manager) return;
    queueMicrotask(() => {
      if (!region.content?.contains(canvas.ownerDocument.activeElement)) {
        manager?.clearNativeHtmlFocus(region);
      }
    });
  };

  const onHtmlKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Tab" || event.defaultPrevented || !manager) return;
    const region = isManagedRegion(event.target);
    if (!region?.content) return;
    const stops = getManagedTabStops(region.content);
    const index = stops.indexOf(
      canvas.ownerDocument.activeElement as HTMLElement,
    );
    if (index < 0) return;
    const next = index + (event.shiftKey ? -1 : 1);
    if (next >= 0 && next < stops.length) return;
    if (moveTab(manager, event.shiftKey) === "moved") {
      event.preventDefault();
    } else {
      exitSurface(event.shiftKey);
    }
  };

  const focusObservers = requireObservers(eventRoot, "focus");
  const focusinObservers = requireObservers(eventRoot, "focusin");
  const blurObservers = requireObservers(eventRoot, "blur");
  const focusoutObservers = requireObservers(eventRoot, "focusout");
  const keydownObservers = requireObservers(eventRoot, "keydown");
  const keyupObservers = requireObservers(eventRoot, "keyup");
  const pointerdownObservers = requireObservers(eventRoot, "pointerdown");
  const mousedownObservers = requireObservers(eventRoot, "mousedown");
  const touchstartObservers = requireObservers(eventRoot, "touchstart");
  const touchendObservers = requireObservers(eventRoot, "touchend");
  const touchcancelObservers = requireObservers(eventRoot, "touchcancel");
  focusObservers.add(onNativeFocus);
  focusinObservers.add(onNativeFocus);
  blurObservers.add(onNativeExit);
  focusoutObservers.add(onNativeExit);
  keydownObservers.add(onNativeKeyDown);
  keyupObservers.add(onNativeKeyUp);
  pointerdownObservers.add(onNativePress);
  mousedownObservers.add(onNativePress);
  touchstartObservers.add(onNativePress);
  touchendObservers.add(onNativePress);
  touchcancelObservers.add(onNativePress);
  canvas.ownerDocument.addEventListener("keydown", onDocumentKeyDown, true);
  if (supportsHtmlRegions) {
    canvas.ownerDocument.addEventListener("focusin", onHtmlFocusIn, true);
    canvas.ownerDocument.addEventListener("focusout", onHtmlFocusOut, true);
    canvas.ownerDocument.addEventListener("pointerdown", onHtmlPointerDown, true);
    canvas.ownerDocument.addEventListener("keydown", onHtmlKeyDown);
  }

  teardowns.add(() => {
    if (disposed) return;
    disposed = true;
    manager = undefined;
    clearPendingTabEntry();
    candidateReason = false;
    pressReason = false;
    syncTabIndex();
    focusObservers.delete(onNativeFocus);
    focusinObservers.delete(onNativeFocus);
    blurObservers.delete(onNativeExit);
    focusoutObservers.delete(onNativeExit);
    keydownObservers.delete(onNativeKeyDown);
    keyupObservers.delete(onNativeKeyUp);
    pointerdownObservers.delete(onNativePress);
    mousedownObservers.delete(onNativePress);
    touchstartObservers.delete(onNativePress);
    touchendObservers.delete(onNativePress);
    touchcancelObservers.delete(onNativePress);
    canvas.ownerDocument.removeEventListener(
      "keydown",
      onDocumentKeyDown,
      true,
    );
    if (supportsHtmlRegions) {
      canvas.ownerDocument.removeEventListener("focusin", onHtmlFocusIn, true);
      canvas.ownerDocument.removeEventListener("focusout", onHtmlFocusOut, true);
      canvas.ownerDocument.removeEventListener(
        "pointerdown",
        onHtmlPointerDown,
        true,
      );
      canvas.ownerDocument.removeEventListener("keydown", onHtmlKeyDown);
    }
    removeSentinels();
  });

  return {
    beforeNativeDispatch,
    focusFromPress,
    setManager,
    syncCandidateAvailability,
    syncHtmlRegions,
  };
}

function isFocusEventForCanvas(
  event: Event,
  canvas: HTMLCanvasElement,
): event is FocusEvent {
  const FocusEventClass = canvas.ownerDocument.defaultView?.FocusEvent;
  return Boolean(FocusEventClass && event instanceof FocusEventClass);
}

function requireObservers(
  eventRoot: PibblEventRoot,
  type:
    | "blur"
    | "focus"
    | "focusin"
    | "focusout"
    | "keydown"
    | "keyup"
    | "mousedown"
    | "pointerdown"
    | "touchcancel"
    | "touchend"
    | "touchstart",
): Set<(event: Event) => void> {
  const observers = eventRoot.observers.get(type);
  if (!observers) {
    throw new Error(`Pibbl ${type} observer registry is unavailable.`);
  }
  return observers;
}
