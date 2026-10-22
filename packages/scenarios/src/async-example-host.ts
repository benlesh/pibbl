import {
  pibbl,
  createElement,
  type PibblComponent,
  type PibblConfig,
  type PibblController,
} from "@pibbl/core";
import { exampleMounts, prepareExampleHost } from "./example-surface";

/** The catalog host awaits external loading; deterministic labs explicitly use sync. */
export async function mountExampleComponent<Props extends object>(
  canvas: HTMLCanvasElement,
  options: {
    Component: PibblComponent<Props>;
    props?: Props;
    config?: PibblConfig;
    htmlOverlay?: boolean;
  },
): Promise<PibblController> {
  const source = options.config?.signal;
  source?.throwIfAborted();
  exampleMounts.get(canvas)?.dispose();
  const lifetime = new AbortController();
  const stop = () => ownership.dispose();
  const host = prepareExampleHost(canvas, options);
  let controller: PibblController | undefined;
  let disposed = false;
  const ownership = {
    dispose() {
      if (disposed) return;
      disposed = true;
      lifetime.abort();
      source?.removeEventListener("abort", stop);
      try {
        controller?.dispose();
      } finally {
        host.dispose();
        if (exampleMounts.get(canvas) === ownership)
          exampleMounts.delete(canvas);
      }
    },
  };
  exampleMounts.set(canvas, ownership);
  if (source?.aborted) ownership.dispose();
  else source?.addEventListener("abort", stop, { once: true });
  try {
    controller = await pibbl(
      canvas,
      createElement<object>(
        options.Component as PibblComponent<object>,
        options.props ?? null,
      ),
      { ...host.config, signal: lifetime.signal },
    );
    if (disposed) {
      controller.dispose();
      throw new DOMException("Example was superseded.", "AbortError");
    }
    return ownership;
  } catch (error) {
    ownership.dispose();
    throw error;
  }
}
