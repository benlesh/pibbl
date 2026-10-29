import { beforeAll, describe, expect, it } from "vitest";
import { createLayoutTree, prepareLayout } from "../src/index.js";

beforeAll(async () => {
  await prepareLayout();
});

describe("native owned tree positioning and decorated boxes", () => {
  it("keeps absolute children out of Flex flow and resolves right/bottom against the positioned padding box", () => {
    const tree = createLayoutTree();
    const root = tree.createNode({
      style: {
        position: "relative",
        boxSizing: "border-box",
        width: 200,
        height: 120,
        flexDirection: "row",
        padding: { left: 10, right: 20, top: 5, bottom: 15 },
        borderWidth: { left: 3, right: 7, top: 2, bottom: 8 },
      },
    });
    const first = tree.createNode({ style: { width: 40, height: 20 } });
    const following = tree.createNode({ style: { width: 30, height: 20 } });
    const badge = tree.createNode({
      style: {
        position: "absolute",
        right: 0,
        bottom: 0,
        width: 20,
        height: 10,
      },
    });
    tree.appendChild(root, first);
    tree.appendChild(root, badge);
    tree.appendChild(root, following);

    const snapshot = tree.calculateLayout({ root, width: 200, height: 120 });
    // The flow content starts after border + padding. The absolute badge uses
    // the root's padding box (inside the border), not the content box.
    expect(snapshot.getBox(first)).toEqual({ x: 13, y: 7, width: 40, height: 20 });
    expect(snapshot.getBox(following)).toEqual({ x: 53, y: 7, width: 30, height: 20 });
    expect(snapshot.getBox(badge)).toEqual({ x: 173, y: 102, width: 20, height: 10 });
    tree.dispose();
  });

  it("uses the nearest positioned nested padding box without moving a following sibling", () => {
    const tree = createLayoutTree();
    const root = tree.createNode({
      style: {
        position: "relative",
        boxSizing: "border-box",
        width: 200,
        height: 120,
        flexDirection: "row",
        padding: { left: 10, right: 20, top: 5, bottom: 15 },
        borderWidth: { left: 3, right: 7, top: 2, bottom: 8 },
      },
    });
    const branch = tree.createNode({
      style: {
        position: "relative",
        boxSizing: "border-box",
        width: 80,
        height: 60,
        padding: { left: 5, right: 5, top: 4, bottom: 6 },
        borderWidth: { left: 2, right: 2, top: 3, bottom: 3 },
      },
    });
    const badge = tree.createNode({
      style: { position: "absolute", right: 0, bottom: 0, width: 10, height: 10 },
    });
    const following = tree.createNode({ style: { width: 30, height: 20 } });
    tree.appendChild(root, branch);
    tree.appendChild(branch, badge);
    tree.appendChild(root, following);

    const snapshot = tree.calculateLayout({ root, width: 200, height: 120 });
    expect(snapshot.getBox(branch)).toEqual({ x: 13, y: 7, width: 80, height: 60 });
    expect(snapshot.getBox(badge)).toEqual({ x: 81, y: 54, width: 10, height: 10 });
    expect(snapshot.getBox(following)).toEqual({ x: 93, y: 7, width: 30, height: 20 });
    tree.dispose();
  });

  it("derives the cross size from a clamped main-axis aspect ratio in rows and columns", () => {
    const rowTree = createLayoutTree();
    const rowRoot = rowTree.createNode({ style: { width: 240, height: 100, flexDirection: "row" } });
    const rowRatio = rowTree.createNode({
      style: { width: 120, minWidth: 80, maxWidth: 100, aspectRatio: 2 },
    });
    const rowFollowing = rowTree.createNode({ style: { width: 40, height: 20 } });
    rowTree.appendChild(rowRoot, rowRatio);
    rowTree.appendChild(rowRoot, rowFollowing);
    const row = rowTree.calculateLayout({ root: rowRoot, width: 240, height: 100 });
    expect(row.getBox(rowRatio)).toEqual({ x: 0, y: 0, width: 100, height: 50 });
    expect(row.getBox(rowFollowing)).toEqual({ x: 100, y: 0, width: 40, height: 20 });
    rowTree.dispose();

    const columnTree = createLayoutTree();
    const columnRoot = columnTree.createNode({ style: { width: 240, height: 240, flexDirection: "column" } });
    const columnRatio = columnTree.createNode({
      style: { height: 120, minHeight: 80, maxHeight: 100, aspectRatio: 2 },
    });
    const columnFollowing = columnTree.createNode({ style: { width: 40, height: 20 } });
    columnTree.appendChild(columnRoot, columnRatio);
    columnTree.appendChild(columnRoot, columnFollowing);
    const column = columnTree.calculateLayout({ root: columnRoot, width: 240, height: 240 });
    expect(column.getBox(columnRatio)).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    expect(column.getBox(columnFollowing)).toEqual({ x: 0, y: 100, width: 40, height: 20 });
    columnTree.dispose();
  });
});
