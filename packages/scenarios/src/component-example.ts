import type { PibblComponent } from "@pibbl/core";
import type { LearningExampleModule } from "./learning-types";

/** Adapts component lessons to the catalog's executable test-host interface. */
export async function loadComponentExample(
  pending: Promise<PibblComponent<object>>,
): Promise<LearningExampleModule> {
  const [Component, { pibbl, createElement }] = await Promise.all([
    pending,
    import("@pibbl/core"),
  ]);
  return {
    default: (canvas) => pibbl(canvas, createElement(Component, null)),
  };
}
