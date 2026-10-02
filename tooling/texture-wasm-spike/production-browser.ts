import { mountProductionScene } from "./production-scene.js";
const canvas = document.querySelector("canvas")!;
let scene = mountProductionScene(canvas);
document.querySelector("button")!.addEventListener("click", () => {
  scene.controller.dispose();
  scene = mountProductionScene(canvas);
  paused.checked = false;
});
const paused = document.querySelector<HTMLInputElement>("input")!;
paused.addEventListener("change", () => scene.pauseInk(paused.checked));
Object.assign(window, { productionProof: () => ({ ...scene.observations }) });
window.addEventListener("pagehide", () => scene.controller.dispose(), {
  once: true,
});
