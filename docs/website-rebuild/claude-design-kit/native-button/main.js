import { mountInkButton } from "./ink-button.js";

const button = document.querySelector("#ink-button");
const canvas = document.querySelector("#ink-canvas");
const events = new AbortController();
let effect;
let count = 0;
function start() {
  try {
    effect = mountInkButton(button, canvas);
  } catch (error) {
    console.warn(
      "CRC decoration unavailable; native button remains usable.",
      error,
    );
  }
}
button.addEventListener(
  "click",
  () => {
    count++;
    document.querySelector("#result").textContent =
      `Activated ${count} ${count === 1 ? "time" : "times"}`;
  },
  { signal: events.signal },
);
document.querySelector("#disabled").addEventListener(
  "change",
  (event) => {
    button.disabled = event.target.checked;
    effect?.update();
  },
  { signal: events.signal },
);
document.querySelector("#effect").addEventListener(
  "change",
  (event) => {
    effect?.dispose();
    effect = undefined;
    if (event.target.checked) start();
  },
  { signal: events.signal },
);
start();
// A framework/router should call this before removing the host.
export function dispose() {
  effect?.dispose();
  events.abort();
}
window.addEventListener("pagehide", () => effect?.dispose(), {
  signal: events.signal,
});
window.addEventListener(
  "pageshow",
  (event) => {
    if (event.persisted && document.querySelector("#effect").checked) start();
  },
  { signal: events.signal },
);
if (import.meta.hot) import.meta.hot.dispose(dispose);
