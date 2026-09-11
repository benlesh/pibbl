/** Returns whether a native or ARIA modal other than an optional owner is open. */
export function hasOpenModalOwner(except?: Element): boolean {
  return [...document.querySelectorAll("dialog[open], [aria-modal='true']")].some(
    (candidate) => candidate !== except,
  );
}
