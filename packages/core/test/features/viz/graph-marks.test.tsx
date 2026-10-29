import { expect, it, vi } from "vitest";
import { Group, Rectangle, FocusManagement } from "@pibbl/core";
import {
  GraphNode,
  GraphEdge,
  GraphLabel,
  straightGraphRoute,
} from "@pibbl/core/viz";
import { testRuntime } from "./support/runtime.js";
import { tab, pressKey } from "../../support/user-input.js";
it("bubbles authored child clicks through the public node mark", () => {
  const runtime = testRuntime();
  let clicked = 0;
  const node = {
    key: "node",
    datum: { id: "node" },
    bounds: { x: 30, y: 40, width: 100, height: 60 },
    label: {
      text: "Node",
      bounds: { x: 35, y: 45, width: 80, height: 20 },
      rotationDegrees: 0,
    },
    detail: null,
  };
  try {
    const canvas = runtime.mount(
      <GraphNode
        node={node}
        style={{ fill: "white" }}
        onClick={() => clicked++}
      >
        <Rectangle style={{ width: 50, height: 30, fill: "#167663" }} />
      </GraphNode>,
    );
    runtime.flush();
    const rect = canvas.getBoundingClientRect();
    for (const type of ["mousedown", "mouseup", "click"])
      canvas.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          clientX: rect.left + 40,
          clientY: rect.top + 50,
        }),
      );
    expect(clicked).toBe(1);
  } finally {
    runtime.dispose();
  }
});
it("exposes a keyboard-focusable public edge target without another tab stop for its arrow", async () => {
  const runtime = testRuntime();
  let key = "";
  const route = straightGraphRoute({
    sourceAnchor: { x: 20, y: 20 },
    targetAnchor: { x: 120, y: 20 },
  });
  const edge = {
    key: "edge",
    datum: {},
    sourceKey: "a",
    targetKey: "b",
    route,
    path: "M20 20L120 20",
    arrowPath: "M120 20L112 16L112 24Z",
  };
  const before = document.createElement("button");
  document.body.append(before);
  try {
    runtime.mount(
      <FocusManagement>
        <Group>
          <GraphEdge
            edge={edge}
            keyboardFocusable
            keyboardNavigationBounds={{ x: 20, y: 10, width: 100, height: 20 }}
            style={{ stroke: "#167663", strokeWidth: 3 }}
            onKeyDown={(event) => {
              key = event.key;
            }}
          />
        </Group>
      </FocusManagement>,
    );
    runtime.flush();
    before.focus();
    await tab();
    runtime.flush();
    await pressKey("ArrowRight");
    runtime.flush();
    expect(key).toBe("ArrowRight");
  } finally {
    runtime.dispose();
  }
});

it("fits a decorative graph label to its declared width with a centered baseline", () => {
  const runtime = testRuntime();
  const painted: { text: string; width: number; baseline: string }[] = [];
  const original = CanvasRenderingContext2D.prototype.fillText;
  vi.spyOn(CanvasRenderingContext2D.prototype, "fillText").mockImplementation(
    function (
      this: CanvasRenderingContext2D,
      ...args: Parameters<CanvasRenderingContext2D["fillText"]>
    ) {
      painted.push({
        text: args[0],
        width: this.measureText(args[0]).width,
        baseline: this.textBaseline,
      });
      original.apply(this, args);
    },
  );
  try {
    runtime.mount(
      <GraphLabel
        label={{
          text: "Signature verification and deployment",
          bounds: { x: 20, y: 20, width: 80, height: 24 },
          rotationDegrees: 0,
        }}
        style={{ fill: "#123" }}
      />,
    );
    runtime.flush();
    expect(painted).toHaveLength(1);
    expect(painted[0].text).toContain("...");
    expect(painted[0].width).toBeLessThanOrEqual(80);
    expect(painted[0].baseline).toBe("middle");
  } finally {
    runtime.dispose();
  }
});
