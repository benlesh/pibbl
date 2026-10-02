/** Native light-DOM tab-stop discovery for managed HtmlBox regions. */

const CANDIDATE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "iframe",
  "object",
  "embed",
  "[contenteditable]",
  "[tabindex]",
].join(",");

export function getManagedTabStops(root: HTMLElement): HTMLElement[] {
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>(CANDIDATE_SELECTOR),
  );
  const stops = candidates.filter((element) => isManagedTabStop(element, root));
  const positive = stops.find((element) => element.tabIndex > 0);
  if (positive) {
    throw new Error(
      'HtmlBox managed focus does not support positive tabindex. Use source order or tabindex="0".',
    );
  }
  return removeUncheckedRadioPeers(stops);
}

export function isManagedTabStop(
  element: HTMLElement,
  root: HTMLElement,
): boolean {
  if (!root.contains(element) || element.tabIndex < 0) return false;
  if (element.matches(":disabled, [inert]") || isInertOrHidden(element, root))
    return false;
  if (element instanceof HTMLInputElement && element.type === "hidden")
    return false;
  if (element instanceof HTMLDetailsElement && !element.open) return false;
  if (element.closest("details:not([open])") && !element.matches("summary"))
    return false;
  if (element.matches("summary") && !element.parentElement?.matches("details"))
    return false;
  return true;
}

function isInertOrHidden(element: HTMLElement, root: HTMLElement): boolean {
  for (
    let current: HTMLElement | null = element;
    current && current !== root.parentElement;
    current = current.parentElement
  ) {
    if (
      current.hasAttribute("inert") ||
      current.hidden ||
      current.getAttribute("aria-hidden") === "true"
    )
      return true;
    const style = current.ownerDocument.defaultView?.getComputedStyle(current);
    if (style?.display === "none" || style?.visibility === "hidden")
      return true;
  }
  return false;
}

function removeUncheckedRadioPeers(
  stops: readonly HTMLElement[],
): HTMLElement[] {
  const checkedGroups = new Set<string>();
  for (const element of stops) {
    if (
      element instanceof HTMLInputElement &&
      element.type === "radio" &&
      element.name &&
      element.checked
    ) {
      checkedGroups.add(radioKey(element));
    }
  }
  return stops.filter((element) => {
    if (
      !(element instanceof HTMLInputElement) ||
      element.type !== "radio" ||
      !element.name
    )
      return true;
    return !checkedGroups.has(radioKey(element)) || element.checked;
  });
}

function radioKey(input: HTMLInputElement): string {
  return `${input.form ? String(input.form) : ""}\u0000${input.name}`;
}
