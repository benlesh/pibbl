import { pibblSync } from '@pibbl/core/sync';
import {
  createElement,
  type PibblComponent,
  type PibblConfig,
} from "@pibbl/core";

import { exampleMounts, prepareExampleHost } from "./example-surface";

export { prepareExampleHost } from "./example-surface";

/** Mounts a selected component; the host owns runtime and optional overlay cleanup. */
export function mountExampleComponentSync<Props extends object>(
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
    const controller = pibblSync(canvas, node, host.config);
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
    mountExampleComponentSync<NonNullable<Props>>(canvas, {
      Component,
      props,
      ...options,
    });
}
