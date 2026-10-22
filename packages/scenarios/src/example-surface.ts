import type { PibblConfig } from "@pibbl/core";

export const exampleMounts = new WeakMap<
  HTMLCanvasElement,
  { dispose(): void }
>();

/** Host-owned surface setup shared by Studio and headless example runners. */
export function prepareExampleHost(
  canvas: HTMLCanvasElement,
  options: { config?: PibblConfig; htmlOverlay?: boolean } = {},
) {
  if (!options.htmlOverlay) return { config: options.config, dispose() {} };
  const placeholder = document.createComment("Pibbl example canvas");
  canvas.before(placeholder);
  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "position:relative;width:100%;height:100%;isolation:isolate";
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:absolute;inset:0;z-index:1;pointer-events:none";
  const previousStyle = canvas.getAttribute("style");
  canvas.style.cssText =
    "display:block;width:100%;height:100%;border:0;padding:0";
  const ownedStyle = canvas.getAttribute("style");
  placeholder.after(wrapper);
  wrapper.append(canvas, overlay);
  let disposed = false;
  return {
    config: { ...options.config, htmlOverlay: overlay },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (canvas.parentElement === wrapper) placeholder.after(canvas);
      if (canvas.getAttribute("style") === ownedStyle) {
        if (previousStyle === null) canvas.removeAttribute("style");
        else canvas.setAttribute("style", previousStyle);
      }
      wrapper.remove();
      placeholder.remove();
    },
  };
}
