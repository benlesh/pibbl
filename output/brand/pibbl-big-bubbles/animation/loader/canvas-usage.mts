import { createElement, pibbl } from "@pibbl/core";
import { createLogoLoader, mountLogoLoader } from "./canvas-loader.mjs";
export function mountBrandLoader(
  canvas: HTMLCanvasElement,
  onComplete: () => void,
) {
  const loader = mountLogoLoader(canvas, { onComplete });
  return {
    ready: () => loader.complete(),
    pause: () => loader.pause(),
    resume: () => loader.resume(),
    restart: () => loader.restart(),
    dispose: () => loader.dispose(),
  };
}
// Composition alternative: create a fresh controller for each component mount.
export function mountComposedLoader(canvas: HTMLCanvasElement) {
  const { Component, controls } = createLogoLoader({
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  });
  const root = pibbl(canvas, createElement(Component, {}), {
    viewport: { width: 640, height: 450 },
  });
  return { controls, dispose: () => root.dispose() };
}
