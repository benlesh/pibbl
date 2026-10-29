import type { PibblComponent, PibblConfig } from "@pibbl/core";
import type { LearningExampleModule } from "./learning-types";

/** Selects a named component for the catalog's executable host interface. */
export async function loadComponentExample(
  pending: Promise<unknown>,
  options: { exportName: string; config?: PibblConfig; htmlOverlay?: boolean },
): Promise<LearningExampleModule> {
  const [module, { mountExampleComponent }] = await Promise.all([
    pending,
    import("./async-example-host"),
  ]);
  const Component = (module as Record<string, unknown>)[options.exportName];
  if (typeof Component !== "function")
    throw new Error(
      `Example component export "${options.exportName}" was not found.`,
    );
  return {
    mount: (canvas) =>
      mountExampleComponent(canvas, {
        Component: Component as PibblComponent<object>,
        ...options,
      }),
  };
}
