import { FAT_AABB_MARGIN } from "../numeric-policy.js";
import type { PhysicsOwnershipCounters2D } from "../runtime/ownership.js";

const NO_INDEX = -1;
const FREE_HEIGHT = -1;
const MAX_PROXY_INDEX = 0x7fff_ffff;
const MAX_GENERATION = 0xffff_ffff;

export class DynamicAabbBroadPhase2D {
  proxyColliderIndices: Int32Array;
  proxyColliderGenerations: Uint32Array;
  proxyNodes: Int32Array;
  proxyGenerations: Uint32Array;
  proxyMoved: Uint8Array;

  nodeParents: Int32Array;
  nodeChild1: Int32Array;
  nodeChild2: Int32Array;
  nodeHeights: Int32Array;
  nodeProxyIndices: Int32Array;
  nodeMinProxyIndices: Int32Array;
  nodeMinX: Float64Array;
  nodeMinY: Float64Array;
  nodeMaxX: Float64Array;
  nodeMaxY: Float64Array;
  nodeGenerations: Uint32Array;
  nodeActive: Uint8Array;

  pairFirstColliderIndices: Int32Array;
  pairFirstColliderGenerations: Uint32Array;
  pairSecondColliderIndices: Int32Array;
  pairSecondColliderGenerations: Uint32Array;
  pairCount = 0;
  rootNode = NO_INDEX;

  private proxyActive: Uint8Array;
  private proxyNextFree: Int32Array;
  private proxyFreeHead = NO_INDEX;
  private colliderProxyIndices: Int32Array;
  private nodeNextFree: Int32Array;
  private nodeFreeHead = NO_INDEX;
  private movedBuffer: Int32Array;
  private movedCount = 0;
  private queryStack: Int32Array;

  constructor(
    public readonly counters: PhysicsOwnershipCounters2D,
    initialProxyCapacity = 4,
    initialNodeCapacity = 8,
  ) {
    const proxyCapacity = normalizedCapacity(initialProxyCapacity);
    const nodeCapacity = normalizedCapacity(initialNodeCapacity);
    this.proxyColliderIndices = filledInt32(proxyCapacity, NO_INDEX);
    this.proxyColliderGenerations = new Uint32Array(proxyCapacity);
    this.proxyNodes = filledInt32(proxyCapacity, NO_INDEX);
    this.proxyGenerations = new Uint32Array(proxyCapacity);
    this.proxyMoved = new Uint8Array(proxyCapacity);
    this.proxyActive = new Uint8Array(proxyCapacity);
    this.proxyNextFree = createFreeList(proxyCapacity, 0);
    this.proxyFreeHead = 0;
    this.colliderProxyIndices = filledInt32(proxyCapacity, NO_INDEX);

    this.nodeParents = filledInt32(nodeCapacity, NO_INDEX);
    this.nodeChild1 = filledInt32(nodeCapacity, NO_INDEX);
    this.nodeChild2 = filledInt32(nodeCapacity, NO_INDEX);
    this.nodeHeights = filledInt32(nodeCapacity, FREE_HEIGHT);
    this.nodeProxyIndices = filledInt32(nodeCapacity, NO_INDEX);
    this.nodeMinProxyIndices = filledInt32(nodeCapacity, MAX_PROXY_INDEX);
    this.nodeMinX = new Float64Array(nodeCapacity);
    this.nodeMinY = new Float64Array(nodeCapacity);
    this.nodeMaxX = new Float64Array(nodeCapacity);
    this.nodeMaxY = new Float64Array(nodeCapacity);
    this.nodeGenerations = new Uint32Array(nodeCapacity);
    this.nodeActive = new Uint8Array(nodeCapacity);
    this.nodeNextFree = createFreeList(nodeCapacity, 0);
    this.nodeFreeHead = 0;

    this.movedBuffer = new Int32Array(proxyCapacity);
    const pairCapacity = normalizedCapacity(proxyCapacity * 2);
    this.pairFirstColliderIndices = new Int32Array(pairCapacity);
    this.pairFirstColliderGenerations = new Uint32Array(pairCapacity);
    this.pairSecondColliderIndices = new Int32Array(pairCapacity);
    this.pairSecondColliderGenerations = new Uint32Array(pairCapacity);
    this.queryStack = new Int32Array(nodeCapacity);

    counters.proxyCapacity = proxyCapacity;
    counters.freeProxySlots = proxyCapacity;
    counters.colliderProxyMapCapacity = proxyCapacity;
    counters.treeNodeCapacity = nodeCapacity;
    counters.freeTreeNodeSlots = nodeCapacity;
    counters.movedBufferCapacity = proxyCapacity;
    counters.pairBufferCapacity = pairCapacity;
    counters.queryStackCapacity = nodeCapacity;
  }

  get proxyCapacity(): number {
    return this.proxyActive.length;
  }

  get nodeCapacity(): number {
    return this.nodeActive.length;
  }

  createProxy(
    colliderIndex: number,
    colliderGeneration: number,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): number {
    this.ensureColliderProxyCapacity(colliderIndex + 1);
    if (this.colliderProxyIndices[colliderIndex] !== NO_INDEX) {
      throw new Error("collider already has a live broad-phase proxy.");
    }
    if (this.proxyFreeHead === NO_INDEX) this.growProxies();
    const proxy = this.proxyFreeHead;
    this.proxyFreeHead = this.proxyNextFree[proxy]!;
    this.proxyNextFree[proxy] = NO_INDEX;
    this.proxyActive[proxy] = 1;
    this.proxyGenerations[proxy] = nextGeneration(
      this.proxyGenerations[proxy]!,
    );
    this.proxyColliderIndices[proxy] = colliderIndex;
    this.proxyColliderGenerations[proxy] = colliderGeneration;
    this.colliderProxyIndices[colliderIndex] = proxy;
    const node = this.allocateNode();
    this.proxyNodes[proxy] = node;
    this.nodeProxyIndices[node] = proxy;
    this.nodeMinProxyIndices[node] = proxy;
    this.nodeHeights[node] = 0;
    this.setFatBounds(node, minX, minY, maxX, maxY, 0, 0);
    this.insertLeaf(node);
    this.bufferMove(proxy);
    this.counters.proxyAllocations += 1;
    this.counters.liveProxies += 1;
    this.counters.freeProxySlots -= 1;
    return proxy;
  }

  hasProxy(proxy: number, generation: number): boolean {
    return (
      Number.isInteger(proxy) &&
      proxy >= 0 &&
      proxy < this.proxyActive.length &&
      this.proxyActive[proxy] === 1 &&
      this.proxyGenerations[proxy] === generation
    );
  }

  readFatBoundsInto(
    proxy: number,
    generation: number,
    output: Float64Array,
    outputOffset: number,
  ): boolean {
    if (!this.hasProxy(proxy, generation)) return false;
    const node = this.proxyNodes[proxy]!;
    output[outputOffset] = this.nodeMinX[node]!;
    output[outputOffset + 1] = this.nodeMinY[node]!;
    output[outputOffset + 2] = this.nodeMaxX[node]!;
    output[outputOffset + 3] = this.nodeMaxY[node]!;
    return true;
  }

  moveProxy(
    proxy: number,
    generation: number,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    displacementX: number,
    displacementY: number,
  ): boolean {
    if (!this.hasProxy(proxy, generation)) return false;
    const node = this.proxyNodes[proxy]!;
    if (
      this.nodeMinX[node]! <= minX &&
      this.nodeMinY[node]! <= minY &&
      this.nodeMaxX[node]! >= maxX &&
      this.nodeMaxY[node]! >= maxY
    ) {
      return false;
    }
    this.removeLeaf(node);
    this.setFatBounds(
      node,
      minX,
      minY,
      maxX,
      maxY,
      displacementX,
      displacementY,
    );
    this.insertLeaf(node);
    this.bufferMove(proxy);
    return true;
  }

  destroyProxy(proxy: number, generation: number): boolean {
    if (!this.hasProxy(proxy, generation)) return false;
    if (this.proxyMoved[proxy] === 1) this.unbufferMove(proxy);
    const node = this.proxyNodes[proxy]!;
    this.removeLeaf(node);
    this.releaseNode(node);
    this.proxyActive[proxy] = 0;
    this.colliderProxyIndices[this.proxyColliderIndices[proxy]!] = NO_INDEX;
    this.proxyColliderIndices[proxy] = NO_INDEX;
    this.proxyColliderGenerations[proxy] = 0;
    this.proxyNodes[proxy] = NO_INDEX;
    this.proxyMoved[proxy] = 0;
    this.counters.proxyReleases += 1;
    this.counters.liveProxies -= 1;
    if (generation === MAX_GENERATION) {
      this.proxyNextFree[proxy] = NO_INDEX;
      this.counters.retiredProxySlots += 1;
    } else {
      this.proxyNextFree[proxy] = this.proxyFreeHead;
      this.proxyFreeHead = proxy;
      this.counters.freeProxySlots += 1;
    }
    return true;
  }

  publishPairs(): number {
    this.pairCount = 0;
    for (let movedIndex = 0; movedIndex < this.movedCount; movedIndex += 1) {
      const proxy = this.movedBuffer[movedIndex]!;
      if (this.proxyActive[proxy] === 1) this.appendPairsForProxy(proxy);
    }
    this.sortPairs();
    this.deduplicatePairs();
    this.counters.publishedPairs = this.pairCount;
    for (let movedIndex = 0; movedIndex < this.movedCount; movedIndex += 1) {
      this.proxyMoved[this.movedBuffer[movedIndex]!] = 0;
    }
    this.movedCount = 0;
    this.counters.movedProxies = 0;
    return this.pairCount;
  }

  queryAabbInto(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    output: Int32Array,
    outputOffset: number,
    maxCount: number,
  ): number {
    if (this.rootNode === NO_INDEX || maxCount <= 0) return 0;
    let stackCount = 0;
    this.ensureQueryStackCapacity(1);
    this.queryStack[stackCount] = this.rootNode;
    stackCount += 1;
    let count = 0;
    while (stackCount > 0) {
      stackCount -= 1;
      const node = this.queryStack[stackCount]!;
      if (!this.overlaps(node, minX, minY, maxX, maxY)) continue;
      const proxy = this.nodeProxyIndices[node]!;
      if (proxy !== NO_INDEX) {
        if (count < maxCount && outputOffset + count < output.length) {
          output[outputOffset + count] = proxy;
          count += 1;
        }
        continue;
      }
      this.ensureQueryStackCapacity(stackCount + 2);
      this.queryStack[stackCount] = this.nodeChild1[node]!;
      this.queryStack[stackCount + 1] = this.nodeChild2[node]!;
      stackCount += 2;
    }
    sortInt32Range(output, outputOffset, count);
    return count;
  }

  private appendPairsForProxy(proxy: number): void {
    const leaf = this.proxyNodes[proxy]!;
    const minX = this.nodeMinX[leaf]!;
    const minY = this.nodeMinY[leaf]!;
    const maxX = this.nodeMaxX[leaf]!;
    const maxY = this.nodeMaxY[leaf]!;
    let stackCount = 0;
    this.ensureQueryStackCapacity(1);
    this.queryStack[stackCount] = this.rootNode;
    stackCount += 1;
    while (stackCount > 0) {
      stackCount -= 1;
      const node = this.queryStack[stackCount]!;
      if (!this.overlaps(node, minX, minY, maxX, maxY)) continue;
      const other = this.nodeProxyIndices[node]!;
      if (other !== NO_INDEX) {
        if (other !== proxy) this.appendPair(proxy, other);
        continue;
      }
      this.ensureQueryStackCapacity(stackCount + 2);
      this.queryStack[stackCount] = this.nodeChild1[node]!;
      this.queryStack[stackCount + 1] = this.nodeChild2[node]!;
      stackCount += 2;
    }
  }

  private appendPair(firstProxy: number, secondProxy: number): void {
    let firstIndex = this.proxyColliderIndices[firstProxy]!;
    let firstGeneration = this.proxyColliderGenerations[firstProxy]!;
    let secondIndex = this.proxyColliderIndices[secondProxy]!;
    let secondGeneration = this.proxyColliderGenerations[secondProxy]!;
    const order = compareIdentity(
      firstIndex,
      firstGeneration,
      secondIndex,
      secondGeneration,
    );
    if (order === 0) return;
    if (order > 0) {
      const swapIndex = firstIndex;
      const swapGeneration = firstGeneration;
      firstIndex = secondIndex;
      firstGeneration = secondGeneration;
      secondIndex = swapIndex;
      secondGeneration = swapGeneration;
    }
    this.ensurePairCapacity(this.pairCount + 1);
    this.pairFirstColliderIndices[this.pairCount] = firstIndex;
    this.pairFirstColliderGenerations[this.pairCount] = firstGeneration;
    this.pairSecondColliderIndices[this.pairCount] = secondIndex;
    this.pairSecondColliderGenerations[this.pairCount] = secondGeneration;
    this.pairCount += 1;
  }

  private sortPairs(): void {
    for (let root = Math.floor(this.pairCount / 2) - 1; root >= 0; root -= 1) {
      this.siftPairDown(root, this.pairCount);
    }
    for (let end = this.pairCount - 1; end > 0; end -= 1) {
      this.swapPairs(0, end);
      this.siftPairDown(0, end);
    }
  }

  private siftPairDown(root: number, count: number): void {
    let current = root;
    while (current * 2 + 1 < count) {
      const left = current * 2 + 1;
      const right = left + 1;
      let greater = left;
      if (right < count && this.comparePairs(left, right) < 0) greater = right;
      if (this.comparePairs(current, greater) >= 0) return;
      this.swapPairs(current, greater);
      current = greater;
    }
  }

  private comparePairs(first: number, second: number): number {
    let comparison = compareIdentity(
      this.pairFirstColliderIndices[first]!,
      this.pairFirstColliderGenerations[first]!,
      this.pairFirstColliderIndices[second]!,
      this.pairFirstColliderGenerations[second]!,
    );
    if (comparison !== 0) return comparison;
    comparison = compareIdentity(
      this.pairSecondColliderIndices[first]!,
      this.pairSecondColliderGenerations[first]!,
      this.pairSecondColliderIndices[second]!,
      this.pairSecondColliderGenerations[second]!,
    );
    return comparison;
  }

  private swapPairs(first: number, second: number): void {
    let value = this.pairFirstColliderIndices[first]!;
    this.pairFirstColliderIndices[first] =
      this.pairFirstColliderIndices[second]!;
    this.pairFirstColliderIndices[second] = value;
    value = this.pairFirstColliderGenerations[first]!;
    this.pairFirstColliderGenerations[first] =
      this.pairFirstColliderGenerations[second]!;
    this.pairFirstColliderGenerations[second] = value;
    value = this.pairSecondColliderIndices[first]!;
    this.pairSecondColliderIndices[first] =
      this.pairSecondColliderIndices[second]!;
    this.pairSecondColliderIndices[second] = value;
    value = this.pairSecondColliderGenerations[first]!;
    this.pairSecondColliderGenerations[first] =
      this.pairSecondColliderGenerations[second]!;
    this.pairSecondColliderGenerations[second] = value;
  }

  private deduplicatePairs(): void {
    if (this.pairCount < 2) return;
    let write = 1;
    for (let read = 1; read < this.pairCount; read += 1) {
      if (this.comparePairs(read, write - 1) === 0) continue;
      if (write !== read) this.copyPair(read, write);
      write += 1;
    }
    this.pairCount = write;
  }

  private copyPair(source: number, target: number): void {
    this.pairFirstColliderIndices[target] =
      this.pairFirstColliderIndices[source]!;
    this.pairFirstColliderGenerations[target] =
      this.pairFirstColliderGenerations[source]!;
    this.pairSecondColliderIndices[target] =
      this.pairSecondColliderIndices[source]!;
    this.pairSecondColliderGenerations[target] =
      this.pairSecondColliderGenerations[source]!;
  }

  private insertLeaf(leaf: number): void {
    if (this.rootNode === NO_INDEX) {
      this.rootNode = leaf;
      this.nodeParents[leaf] = NO_INDEX;
      return;
    }
    let sibling = this.rootNode;
    while (this.nodeProxyIndices[sibling] === NO_INDEX) {
      const first = this.nodeChild1[sibling]!;
      const second = this.nodeChild2[sibling]!;
      const perimeter = this.perimeter(sibling);
      const combinedPerimeter = this.combinedPerimeter(sibling, leaf);
      const parentCost = 2 * combinedPerimeter;
      const inheritanceCost = 2 * (combinedPerimeter - perimeter);
      const firstCost = this.descendCost(first, leaf, inheritanceCost);
      const secondCost = this.descendCost(second, leaf, inheritanceCost);
      if (parentCost < firstCost && parentCost < secondCost) break;
      if (firstCost < secondCost) {
        sibling = first;
      } else if (secondCost < firstCost) {
        sibling = second;
      } else {
        sibling =
          this.nodeMinProxyIndices[first]! <= this.nodeMinProxyIndices[second]!
            ? first
            : second;
      }
    }

    const oldParent = this.nodeParents[sibling]!;
    const newParent = this.allocateNode();
    this.nodeParents[newParent] = oldParent;
    this.nodeChild1[newParent] = sibling;
    this.nodeChild2[newParent] = leaf;
    this.nodeProxyIndices[newParent] = NO_INDEX;
    this.nodeParents[sibling] = newParent;
    this.nodeParents[leaf] = newParent;
    this.updateNode(newParent);
    if (oldParent === NO_INDEX) {
      this.rootNode = newParent;
    } else if (this.nodeChild1[oldParent] === sibling) {
      this.nodeChild1[oldParent] = newParent;
    } else {
      this.nodeChild2[oldParent] = newParent;
    }

    let node = this.nodeParents[leaf]!;
    while (node !== NO_INDEX) {
      node = this.balance(node);
      this.updateNode(node);
      node = this.nodeParents[node]!;
    }
  }

  private removeLeaf(leaf: number): void {
    if (leaf === this.rootNode) {
      this.rootNode = NO_INDEX;
      this.nodeParents[leaf] = NO_INDEX;
      return;
    }
    const parent = this.nodeParents[leaf]!;
    const grandParent = this.nodeParents[parent]!;
    const sibling =
      this.nodeChild1[parent] === leaf
        ? this.nodeChild2[parent]!
        : this.nodeChild1[parent]!;
    if (grandParent === NO_INDEX) {
      this.rootNode = sibling;
      this.nodeParents[sibling] = NO_INDEX;
      this.releaseNode(parent);
    } else {
      if (this.nodeChild1[grandParent] === parent) {
        this.nodeChild1[grandParent] = sibling;
      } else {
        this.nodeChild2[grandParent] = sibling;
      }
      this.nodeParents[sibling] = grandParent;
      this.releaseNode(parent);
      let node = grandParent;
      while (node !== NO_INDEX) {
        node = this.balance(node);
        this.updateNode(node);
        node = this.nodeParents[node]!;
      }
    }
    this.nodeParents[leaf] = NO_INDEX;
  }

  private balance(node: number): number {
    if (
      this.nodeProxyIndices[node] !== NO_INDEX ||
      this.nodeHeights[node]! < 2
    ) {
      return node;
    }
    const first = this.nodeChild1[node]!;
    const second = this.nodeChild2[node]!;
    const balance = this.nodeHeights[second]! - this.nodeHeights[first]!;
    if (balance > 1) return this.rotateSecondUp(node, second);
    if (balance < -1) return this.rotateFirstUp(node, first);
    return node;
  }

  private rotateSecondUp(node: number, second: number): number {
    const secondFirst = this.nodeChild1[second]!;
    const secondSecond = this.nodeChild2[second]!;
    const parent = this.nodeParents[node]!;
    this.nodeParents[second] = parent;
    this.nodeChild1[second] = node;
    this.nodeParents[node] = second;
    this.replaceParentChild(parent, node, second);
    const preferred = this.preferredBalanceChild(secondFirst, secondSecond);
    const other = preferred === secondFirst ? secondSecond : secondFirst;
    this.nodeChild2[second] = preferred;
    this.nodeParents[preferred] = second;
    this.nodeChild2[node] = other;
    this.nodeParents[other] = node;
    this.updateNode(node);
    this.updateNode(second);
    return second;
  }

  private rotateFirstUp(node: number, first: number): number {
    const firstFirst = this.nodeChild1[first]!;
    const firstSecond = this.nodeChild2[first]!;
    const parent = this.nodeParents[node]!;
    this.nodeParents[first] = parent;
    this.nodeChild2[first] = node;
    this.nodeParents[node] = first;
    this.replaceParentChild(parent, node, first);
    const preferred = this.preferredBalanceChild(firstFirst, firstSecond);
    const other = preferred === firstFirst ? firstSecond : firstFirst;
    this.nodeChild1[first] = preferred;
    this.nodeParents[preferred] = first;
    this.nodeChild1[node] = other;
    this.nodeParents[other] = node;
    this.updateNode(node);
    this.updateNode(first);
    return first;
  }

  private replaceParentChild(
    parent: number,
    previous: number,
    replacement: number,
  ): void {
    if (parent === NO_INDEX) {
      this.rootNode = replacement;
    } else if (this.nodeChild1[parent] === previous) {
      this.nodeChild1[parent] = replacement;
    } else {
      this.nodeChild2[parent] = replacement;
    }
  }

  private preferredBalanceChild(first: number, second: number): number {
    const firstHeight = this.nodeHeights[first]!;
    const secondHeight = this.nodeHeights[second]!;
    if (firstHeight > secondHeight) return first;
    if (secondHeight > firstHeight) return second;
    return this.nodeMinProxyIndices[first]! <= this.nodeMinProxyIndices[second]!
      ? first
      : second;
  }

  private descendCost(
    node: number,
    leaf: number,
    inheritanceCost: number,
  ): number {
    const combinedPerimeter = this.combinedPerimeter(node, leaf);
    return this.nodeProxyIndices[node] !== NO_INDEX
      ? combinedPerimeter + inheritanceCost
      : combinedPerimeter - this.perimeter(node) + inheritanceCost;
  }

  private updateNode(node: number): void {
    const first = this.nodeChild1[node]!;
    const second = this.nodeChild2[node]!;
    this.nodeMinX[node] = Math.min(
      this.nodeMinX[first]!,
      this.nodeMinX[second]!,
    );
    this.nodeMinY[node] = Math.min(
      this.nodeMinY[first]!,
      this.nodeMinY[second]!,
    );
    this.nodeMaxX[node] = Math.max(
      this.nodeMaxX[first]!,
      this.nodeMaxX[second]!,
    );
    this.nodeMaxY[node] = Math.max(
      this.nodeMaxY[first]!,
      this.nodeMaxY[second]!,
    );
    this.nodeHeights[node] =
      1 + Math.max(this.nodeHeights[first]!, this.nodeHeights[second]!);
    this.nodeMinProxyIndices[node] = Math.min(
      this.nodeMinProxyIndices[first]!,
      this.nodeMinProxyIndices[second]!,
    );
  }

  private setFatBounds(
    node: number,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    displacementX: number,
    displacementY: number,
  ): void {
    this.nodeMinX[node] = minX - FAT_AABB_MARGIN + Math.min(0, displacementX);
    this.nodeMinY[node] = minY - FAT_AABB_MARGIN + Math.min(0, displacementY);
    this.nodeMaxX[node] = maxX + FAT_AABB_MARGIN + Math.max(0, displacementX);
    this.nodeMaxY[node] = maxY + FAT_AABB_MARGIN + Math.max(0, displacementY);
  }

  private overlaps(
    node: number,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): boolean {
    return !(
      this.nodeMaxX[node]! < minX ||
      this.nodeMaxY[node]! < minY ||
      this.nodeMinX[node]! > maxX ||
      this.nodeMinY[node]! > maxY
    );
  }

  private perimeter(node: number): number {
    return (
      2 *
      (this.nodeMaxX[node]! -
        this.nodeMinX[node]! +
        this.nodeMaxY[node]! -
        this.nodeMinY[node]!)
    );
  }

  private combinedPerimeter(first: number, second: number): number {
    return (
      2 *
      (Math.max(this.nodeMaxX[first]!, this.nodeMaxX[second]!) -
        Math.min(this.nodeMinX[first]!, this.nodeMinX[second]!) +
        Math.max(this.nodeMaxY[first]!, this.nodeMaxY[second]!) -
        Math.min(this.nodeMinY[first]!, this.nodeMinY[second]!))
    );
  }

  private allocateNode(): number {
    if (this.nodeFreeHead === NO_INDEX) this.growNodes();
    const node = this.nodeFreeHead;
    this.nodeFreeHead = this.nodeNextFree[node]!;
    this.nodeNextFree[node] = NO_INDEX;
    this.nodeActive[node] = 1;
    this.nodeGenerations[node] = nextGeneration(this.nodeGenerations[node]!);
    this.nodeParents[node] = NO_INDEX;
    this.nodeChild1[node] = NO_INDEX;
    this.nodeChild2[node] = NO_INDEX;
    this.nodeHeights[node] = 0;
    this.nodeProxyIndices[node] = NO_INDEX;
    this.nodeMinProxyIndices[node] = MAX_PROXY_INDEX;
    this.counters.treeNodeAllocations += 1;
    this.counters.liveTreeNodes += 1;
    this.counters.freeTreeNodeSlots -= 1;
    return node;
  }

  private releaseNode(node: number): void {
    this.nodeActive[node] = 0;
    this.nodeParents[node] = NO_INDEX;
    this.nodeChild1[node] = NO_INDEX;
    this.nodeChild2[node] = NO_INDEX;
    this.nodeHeights[node] = FREE_HEIGHT;
    this.nodeProxyIndices[node] = NO_INDEX;
    this.nodeMinProxyIndices[node] = MAX_PROXY_INDEX;
    this.nodeMinX[node] = 0;
    this.nodeMinY[node] = 0;
    this.nodeMaxX[node] = 0;
    this.nodeMaxY[node] = 0;
    this.counters.treeNodeReleases += 1;
    this.counters.liveTreeNodes -= 1;
    if (this.nodeGenerations[node] === MAX_GENERATION) {
      this.nodeNextFree[node] = NO_INDEX;
      this.counters.retiredTreeNodeSlots += 1;
    } else {
      this.nodeNextFree[node] = this.nodeFreeHead;
      this.nodeFreeHead = node;
      this.counters.freeTreeNodeSlots += 1;
    }
  }

  private bufferMove(proxy: number): void {
    if (this.proxyMoved[proxy] === 1) return;
    this.ensureMovedCapacity(this.movedCount + 1);
    this.movedBuffer[this.movedCount] = proxy;
    this.movedCount += 1;
    this.proxyMoved[proxy] = 1;
    this.counters.movedProxies = this.movedCount;
  }

  private unbufferMove(proxy: number): void {
    for (let index = 0; index < this.movedCount; index += 1) {
      if (this.movedBuffer[index] !== proxy) continue;
      for (let shift = index + 1; shift < this.movedCount; shift += 1) {
        this.movedBuffer[shift - 1] = this.movedBuffer[shift]!;
      }
      this.movedCount -= 1;
      break;
    }
    this.proxyMoved[proxy] = 0;
    this.counters.movedProxies = this.movedCount;
  }

  private growProxies(): void {
    const oldCapacity = this.proxyCapacity;
    const capacity = oldCapacity * 2;
    this.proxyColliderIndices = growInt32(
      this.proxyColliderIndices,
      capacity,
      NO_INDEX,
    );
    this.proxyColliderGenerations = growUint32(
      this.proxyColliderGenerations,
      capacity,
    );
    this.proxyNodes = growInt32(this.proxyNodes, capacity, NO_INDEX);
    this.proxyGenerations = growUint32(this.proxyGenerations, capacity);
    this.proxyMoved = growUint8(this.proxyMoved, capacity);
    this.proxyActive = growUint8(this.proxyActive, capacity);
    this.proxyNextFree = growFreeList(
      this.proxyNextFree,
      capacity,
      oldCapacity,
    );
    this.proxyFreeHead = oldCapacity;
    this.counters.proxyCapacity = capacity;
    this.counters.proxyCapacityGrowths += 1;
    this.counters.freeProxySlots += capacity - oldCapacity;
  }

  private growNodes(): void {
    const oldCapacity = this.nodeCapacity;
    const capacity = oldCapacity * 2;
    this.nodeParents = growInt32(this.nodeParents, capacity, NO_INDEX);
    this.nodeChild1 = growInt32(this.nodeChild1, capacity, NO_INDEX);
    this.nodeChild2 = growInt32(this.nodeChild2, capacity, NO_INDEX);
    this.nodeHeights = growInt32(this.nodeHeights, capacity, FREE_HEIGHT);
    this.nodeProxyIndices = growInt32(
      this.nodeProxyIndices,
      capacity,
      NO_INDEX,
    );
    this.nodeMinProxyIndices = growInt32(
      this.nodeMinProxyIndices,
      capacity,
      MAX_PROXY_INDEX,
    );
    this.nodeMinX = growFloat64(this.nodeMinX, capacity);
    this.nodeMinY = growFloat64(this.nodeMinY, capacity);
    this.nodeMaxX = growFloat64(this.nodeMaxX, capacity);
    this.nodeMaxY = growFloat64(this.nodeMaxY, capacity);
    this.nodeGenerations = growUint32(this.nodeGenerations, capacity);
    this.nodeActive = growUint8(this.nodeActive, capacity);
    this.nodeNextFree = growFreeList(this.nodeNextFree, capacity, oldCapacity);
    this.nodeFreeHead = oldCapacity;
    this.counters.treeNodeCapacity = capacity;
    this.counters.treeNodeCapacityGrowths += 1;
    this.counters.freeTreeNodeSlots += capacity - oldCapacity;
  }

  private ensureMovedCapacity(required: number): void {
    if (required <= this.movedBuffer.length) return;
    let capacity = this.movedBuffer.length * 2;
    while (capacity < required) capacity *= 2;
    const moved = new Int32Array(capacity);
    moved.set(this.movedBuffer);
    this.movedBuffer = moved;
    this.counters.movedBufferCapacity = capacity;
    this.counters.movedBufferGrowths += 1;
  }

  private ensureColliderProxyCapacity(required: number): void {
    if (required <= this.colliderProxyIndices.length) return;
    let capacity = this.colliderProxyIndices.length * 2;
    while (capacity < required) capacity *= 2;
    this.colliderProxyIndices = growInt32(
      this.colliderProxyIndices,
      capacity,
      NO_INDEX,
    );
    this.counters.colliderProxyMapCapacity = capacity;
    this.counters.colliderProxyMapGrowths += 1;
  }

  private ensurePairCapacity(required: number): void {
    if (required <= this.pairFirstColliderIndices.length) return;
    let capacity = this.pairFirstColliderIndices.length * 2;
    while (capacity < required) capacity *= 2;
    this.pairFirstColliderIndices = growInt32(
      this.pairFirstColliderIndices,
      capacity,
      0,
    );
    this.pairFirstColliderGenerations = growUint32(
      this.pairFirstColliderGenerations,
      capacity,
    );
    this.pairSecondColliderIndices = growInt32(
      this.pairSecondColliderIndices,
      capacity,
      0,
    );
    this.pairSecondColliderGenerations = growUint32(
      this.pairSecondColliderGenerations,
      capacity,
    );
    this.counters.pairBufferCapacity = capacity;
    this.counters.pairBufferGrowths += 1;
  }

  private ensureQueryStackCapacity(required: number): void {
    if (required <= this.queryStack.length) return;
    let capacity = this.queryStack.length * 2;
    while (capacity < required) capacity *= 2;
    const stack = new Int32Array(capacity);
    stack.set(this.queryStack);
    this.queryStack = stack;
    this.counters.queryStackCapacity = capacity;
    this.counters.queryStackGrowths += 1;
  }
}

function normalizedCapacity(initialCapacity: number): number {
  if (!Number.isInteger(initialCapacity) || initialCapacity < 1) {
    throw new RangeError("initialCapacity must be a positive integer.");
  }
  let capacity = 1;
  while (capacity < initialCapacity) capacity *= 2;
  return capacity;
}

function nextGeneration(generation: number): number {
  return generation + 1;
}

function compareIdentity(
  firstIndex: number,
  firstGeneration: number,
  secondIndex: number,
  secondGeneration: number,
): number {
  if (firstIndex !== secondIndex) return firstIndex < secondIndex ? -1 : 1;
  if (firstGeneration === secondGeneration) return 0;
  return firstGeneration < secondGeneration ? -1 : 1;
}

function sortInt32Range(
  values: Int32Array,
  offset: number,
  count: number,
): void {
  for (let index = 1; index < count; index += 1) {
    const value = values[offset + index]!;
    let position = index;
    while (position > 0 && values[offset + position - 1]! > value) {
      values[offset + position] = values[offset + position - 1]!;
      position -= 1;
    }
    values[offset + position] = value;
  }
}

function createFreeList(capacity: number, start: number): Int32Array {
  const result = filledInt32(capacity, NO_INDEX);
  for (let index = start; index + 1 < capacity; index += 1) {
    result[index] = index + 1;
  }
  return result;
}

function growFreeList(
  source: Int32Array,
  capacity: number,
  start: number,
): Int32Array {
  const result = createFreeList(capacity, start);
  result.set(source);
  return result;
}

function filledInt32(capacity: number, value: number): Int32Array {
  const result = new Int32Array(capacity);
  result.fill(value);
  return result;
}

function growFloat64(source: Float64Array, capacity: number): Float64Array {
  const result = new Float64Array(capacity);
  result.set(source);
  return result;
}

function growUint32(source: Uint32Array, capacity: number): Uint32Array {
  const result = new Uint32Array(capacity);
  result.set(source);
  return result;
}

function growUint8(source: Uint8Array, capacity: number): Uint8Array {
  const result = new Uint8Array(capacity);
  result.set(source);
  return result;
}

function growInt32(
  source: Int32Array,
  capacity: number,
  fill: number,
): Int32Array {
  const result = filledInt32(capacity, fill);
  result.set(source);
  return result;
}
