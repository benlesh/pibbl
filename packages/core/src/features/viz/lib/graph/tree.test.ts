import { describe, expect, it } from "vitest";
import { layoutTree } from "@pibbl/core/viz";

describe("layoutTree", () => {
  it("preserves child order, measured card bounds, and app-owned collapse", () => {
    type Role = { id: string; title: string; children: readonly Role[] };
    const root: Role = {
      id: "root",
      title: "Root",
      children: [
        { id: "left", title: "Left", children: [] },
        {
          id: "right",
          title: "Right",
          children: [{ id: "hidden", title: "Hidden", children: [] }],
        },
      ],
    };
    const layout = layoutTree(root, {
      keyBy: "id",
      childrenBy: "children",
      label: "title",
      collapsed: (role) => role.id === "right",
      nodeSize: (role) => ({
        width: role.id === "root" ? 180 : 120,
        height: 56,
      }),
      bounds: { x: 0, y: 0, width: 500, height: 300 },
    });
    expect(layout.nodes.map((node) => node.key)).toEqual([
      "root",
      "left",
      "right",
    ]);
    expect(
      layout.nodes.find((node) => node.key === "right")?.hiddenChildren,
    ).toBe(1);
    expect(
      layout.edges.map((edge) => [edge.sourceKey, edge.targetKey]),
    ).toEqual([
      ["root", "left"],
      ["root", "right"],
    ]);
    expect(layout.nodes.find((node) => node.key === "root")?.bounds.width).toBe(
      180,
    );
  });
});
