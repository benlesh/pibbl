/** Transport events only; no inference from error-message text or page payloads. */
export function observeBrowserFailure(browser, page) {
  let pageCrashed = false;
  let unexpectedDisconnect = false;
  let cleaningUp = false;
  const crash = () => {
    pageCrashed = true;
  };
  const disconnect = () => {
    if (!cleaningUp) unexpectedDisconnect = true;
  };
  page.on("crash", crash);
  browser.on("disconnected", disconnect);
  return {
    snapshot: () =>
      Object.freeze({
        pageCrashed,
        unexpectedDisconnect,
        category: pageCrashed
          ? "page-crash"
          : unexpectedDisconnect
            ? "browser-disconnected"
            : null,
      }),
    beginCleanup: () => {
      cleaningUp = true;
    },
    dispose: () => {
      page.off("crash", crash);
      browser.off("disconnected", disconnect);
    },
  };
}
