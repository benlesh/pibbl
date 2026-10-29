import { createStandaloneLayoutKernel } from "@pibbl/core/internal/layout";
import type {
  LayoutBox,
  LayoutChange,
  LayoutConstraints,
  LayoutIntrinsicMeasure,
  LayoutMeasure,
  LayoutNode,
  LayoutNodeInput,
  LayoutSnapshot,
  LayoutStyle,
  LayoutTree,
} from "./types.js";

/** Friend-only kernel protocol. Core owns its native arena and never retains this tree's callbacks after `calculate`. */
export interface StandaloneKernelNode {
  readonly id: number;
  readonly parent: number | undefined;
  readonly children: readonly number[];
  readonly style: Readonly<LayoutStyle>;
  readonly measure: LayoutMeasure | undefined;
  readonly measureIntrinsic: LayoutIntrinsicMeasure | undefined;
}
export interface StandaloneKernelInput {
  readonly root: number;
  readonly width: number;
  readonly height: number;
  readonly direction: "ltr" | "rtl";
  readonly nodes: readonly StandaloneKernelNode[];
}
export interface StandaloneKernelBox extends LayoutBox {
  readonly id: number;
}
export interface StandaloneKernel {
  calculate(input: StandaloneKernelInput): readonly StandaloneKernelBox[];
  dispose(): void;
}

const nodeBrand = new WeakSet<object>();
const copyBox = (box: LayoutBox): LayoutBox =>
  Object.freeze({ x: box.x, y: box.y, width: box.width, height: box.height });
const sameBox = (left: LayoutBox | undefined, right: LayoutBox): boolean =>
  left !== undefined &&
  left.x === right.x &&
  left.y === right.y &&
  left.width === right.width &&
  left.height === right.height;

class NodeHandle implements LayoutNode {
  readonly id: number;
  constructor(id: number) {
    this.id = id;
    nodeBrand.add(this);
  }
}
interface OwnedNode {
  readonly handle: NodeHandle;
  readonly children: NodeHandle[];
  parent: NodeHandle | undefined;
  style: Readonly<LayoutStyle>;
  measure: LayoutMeasure | undefined;
  measureIntrinsic: LayoutIntrinsicMeasure | undefined;
}

function copyStyleValue(value: unknown): unknown {
  if (Array.isArray(value)) return Object.freeze(value.map(copyStyleValue));
  if (value !== null && typeof value === "object") {
    const copy: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value))
      copy[key] = copyStyleValue(nested);
    return Object.freeze(copy);
  }
  return value;
}
function copyStyle(style: Readonly<LayoutStyle>): Readonly<LayoutStyle> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(style)) {
    const value = style[key as keyof LayoutStyle];
    if (value !== undefined) result[key] = copyStyleValue(value);
  }
  return Object.freeze(result) as Readonly<LayoutStyle>;
}

class Snapshot implements LayoutSnapshot {
  readonly revision: number;
  readonly root: LayoutNode;
  readonly changes: readonly LayoutChange[];
  readonly #tree: OwnedTree;
  readonly #boxes: ReadonlyMap<number, LayoutBox>;
  constructor(
    tree: OwnedTree,
    revision: number,
    root: LayoutNode,
    boxes: ReadonlyMap<number, LayoutBox>,
    changes: readonly LayoutChange[],
  ) {
    this.#tree = tree;
    this.revision = revision;
    this.root = root;
    this.#boxes = boxes;
    this.changes = Object.freeze([...changes]);
  }
  getBox(node: LayoutNode): LayoutBox {
    this.#tree.assertNode(node);
    const box = this.#boxes.get(node.id);
    if (!box)
      throw new Error("The node was not reachable from this layout snapshot.");
    return box;
  }
  has(node: LayoutNode): boolean {
    this.#tree.assertNode(node);
    return this.#boxes.has(node.id);
  }
}

class OwnedTree implements LayoutTree {
  readonly #kernel: StandaloneKernel;
  readonly #nodes = new Map<number, OwnedNode>();
  #previous = new Map<number, LayoutBox>();
  #revision = 0;
  #disposed = false;
  #calculating = false;
  #nextId = 1;
  constructor() {
    this.#kernel = createStandaloneLayoutKernel() as StandaloneKernel;
  }
  createNode(input: LayoutNodeInput = {}): LayoutNode {
    this.assertMutable();
    if (input.measure !== undefined && typeof input.measure !== "function")
      throw new TypeError(
        "Layout node measurement must be a synchronous function.",
      );
    if (
      input.measureIntrinsic !== undefined &&
      typeof input.measureIntrinsic !== "function"
    )
      throw new TypeError(
        "Layout intrinsic measurement must be a synchronous function.",
      );
    const handle = new NodeHandle(this.#nextId++);
    this.#nodes.set(handle.id, {
      handle,
      children: [],
      parent: undefined,
      style: copyStyle(input.style ?? {}),
      measure: input.measure,
      measureIntrinsic: input.measureIntrinsic,
    });
    return handle;
  }
  appendChild(parent: LayoutNode, child: LayoutNode): void {
    this.insertChild(parent, child, this.require(parent).children.length);
  }
  insertChild(parent: LayoutNode, child: LayoutNode, index: number): void {
    this.assertMutable();
    const parentNode = this.require(parent);
    const childNode = this.require(child);
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index > parentNode.children.length
    )
      throw new RangeError(
        "Layout child insertion index is outside the parent child list.",
      );
    if (parent === child || this.hasAncestor(parent, child))
      throw new Error("A layout tree cannot contain a child cycle.");
    if (childNode.parent !== undefined)
      throw new Error(
        "A layout node already has an owned parent; remove it before inserting it elsewhere.",
      );
    parentNode.children.splice(index, 0, childNode.handle);
    childNode.parent = parentNode.handle;
  }
  removeChild(parent: LayoutNode, child: LayoutNode): void {
    this.assertMutable();
    const parentNode = this.require(parent);
    const childNode = this.require(child);
    const index = parentNode.children.indexOf(childNode.handle);
    if (index < 0 || childNode.parent !== parentNode.handle)
      throw new Error(
        "The child does not belong to the supplied layout parent.",
      );
    parentNode.children.splice(index, 1);
    childNode.parent = undefined;
  }
  setStyle(node: LayoutNode, patch: Readonly<Partial<LayoutStyle>>): void {
    this.assertMutable();
    const owned = this.require(node);
    const next: Record<string, unknown> = { ...owned.style };
    for (const key of Object.keys(patch) as (keyof LayoutStyle)[]) {
      const value = patch[key];
      if (value === undefined) delete next[key];
      else next[key] = copyStyleValue(value);
    }
    owned.style = Object.freeze(next) as Readonly<LayoutStyle>;
  }
  calculateLayout(
    input: Readonly<LayoutConstraints> & { readonly root: LayoutNode },
  ): LayoutSnapshot {
    this.assertActive();
    if (this.#calculating)
      throw new Error("The owned layout tree cannot calculate recursively.");
    this.#calculating = true;
    try {
      const root = this.require(input.root);
      if (root.parent !== undefined)
        throw new Error(
          "Standalone layout calculation requires an owned root node without a parent.",
        );
      if (
        !Number.isFinite(input.width) ||
        input.width < 0 ||
        !Number.isFinite(input.height) ||
        input.height < 0
      )
        throw new RangeError(
          "Standalone layout constraints must be finite nonnegative sizes.",
        );
      const nodes: StandaloneKernelNode[] = [];
      const reachable = new Set<number>();
      this.collect(root, reachable, nodes);
      const output = this.#kernel.calculate({
        root: root.handle.id,
        width: input.width,
        height: input.height,
        direction: input.direction ?? "ltr",
        nodes,
      });
      const boxes = new Map<number, LayoutBox>();
      const changes: LayoutChange[] = [];
      for (const item of output) {
        if (
          !reachable.has(item.id) ||
          !Number.isFinite(item.x) ||
          !Number.isFinite(item.y) ||
          !Number.isFinite(item.width) ||
          !Number.isFinite(item.height) ||
          item.width < 0 ||
          item.height < 0
        )
          throw new Error(
            "The standalone layout kernel returned an invalid owned box.",
          );
        const box = copyBox(item);
        boxes.set(item.id, box);
        const previous = this.#previous.get(item.id);
        if (!sameBox(previous, box))
          changes.push(
            Object.freeze({
              node: this.#nodes.get(item.id)!.handle,
              previous,
              box,
            }),
          );
      }
      if (boxes.size !== reachable.size)
        throw new Error(
          "The standalone layout kernel did not return every reachable owned node.",
        );
      this.#previous = boxes;
      this.#revision++;
      return new Snapshot(this, this.#revision, root.handle, boxes, changes);
    } finally {
      this.#calculating = false;
    }
  }
  dispose(): void {
    if (this.#disposed) return;
    if (this.#calculating)
      throw new Error(
        "The owned layout tree cannot mutate during calculateLayout().",
      );
    this.#disposed = true;
    this.#nodes.clear();
    this.#previous.clear();
    this.#kernel.dispose();
  }
  assertNode(node: LayoutNode): void {
    this.assertActive();
    this.require(node);
  }
  private assertActive(): void {
    if (this.#disposed)
      throw new Error("The owned layout tree has been disposed.");
  }
  private assertMutable(): void {
    this.assertActive();
    if (this.#calculating)
      throw new Error(
        "The owned layout tree cannot mutate during calculateLayout().",
      );
  }
  private require(node: LayoutNode): OwnedNode {
    if (!nodeBrand.has(node as object))
      throw new TypeError("Expected a LayoutNode created by this tree.");
    const owned = this.#nodes.get(node.id);
    if (!owned || owned.handle !== node)
      throw new Error(
        "The layout node belongs to another tree or is no longer owned.",
      );
    return owned;
  }
  private hasAncestor(candidate: LayoutNode, node: LayoutNode): boolean {
    let current = this.require(candidate).parent;
    while (current !== undefined) {
      if (current === node) return true;
      current = this.require(current).parent;
    }
    return false;
  }
  private collect(
    node: OwnedNode,
    reachable: Set<number>,
    result: StandaloneKernelNode[],
  ): void {
    if (reachable.has(node.handle.id))
      throw new Error("The owned layout tree contains a cycle.");
    reachable.add(node.handle.id);
    result.push(
      Object.freeze({
        id: node.handle.id,
        parent: node.parent?.id,
        children: Object.freeze(node.children.map((child) => child.id)),
        style: node.style,
        measure: node.measure,
        measureIntrinsic: node.measureIntrinsic,
      }),
    );
    for (const child of node.children)
      this.collect(this.require(child), reachable, result);
  }
}
/**
 * Creates a renderer-neutral owned {@link LayoutTree}.
 * @returns A tree backed by one native layout owner.
 */
export function createLayoutTree(): LayoutTree {
  return new OwnedTree();
}
