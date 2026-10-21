import {
  pibbl,
  createElement,
  type PibblComponent,
  type PibblConfig,
} from "@pibbl/core";

const exampleMounts = new WeakMap<HTMLCanvasElement, { dispose(): void }>();

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

/** Mounts a selected component; the host owns runtime and optional overlay cleanup. */
export function mountExampleComponent<Props extends object>(
  canvas: HTMLCanvasElement,
  options: {
    Component: PibblComponent<Props>;
    props?: Props;
    config?: PibblConfig;
    htmlOverlay?: boolean;
  },
) {
  exampleMounts.get(canvas)?.dispose();
  const host = prepareExampleHost(canvas, options);
  try {
    // JSX construction uses the same public descriptor protocol without imposing
    // a prop shape on components selected by the catalog or a test fixture.
    const node = createElement<object>(
      options.Component as PibblComponent<object>,
      options.props ?? null,
    );
    const controller = pibbl(canvas, node, host.config);
    let disposed = false;
    const mounted = {
      dispose() {
        if (disposed) return;
        disposed = true;
        try {
          controller.dispose();
        } finally {
          host.dispose();
          if (exampleMounts.get(canvas) === mounted)
            exampleMounts.delete(canvas);
        }
      },
    };
    exampleMounts.set(canvas, mounted);
    return mounted;
  } catch (error) {
    host.dispose();
    throw error;
  }
}

/** Supplies the same host settings to focused tests and deterministic labs. */
export function createExampleMount<Props extends object | undefined>(
  Component: PibblComponent<Props>,
  options: {
    config?: PibblConfig;
    htmlOverlay?: boolean;
  } = {},
) {
  return (canvas: HTMLCanvasElement, props?: NonNullable<Props>) =>
    mountExampleComponent<NonNullable<Props>>(canvas, {
      Component,
      props,
      ...options,
    });
}
