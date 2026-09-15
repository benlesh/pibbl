import { describe, expect, it } from "vitest";
import { createPhysicsOwnershipCounters2D } from "../runtime/ownership.js";
import { DynamicAabbBroadPhase2D } from "./broad-phase.js";

describe("dynamic AABB broad phase", () => {
  it("retires exhausted proxy and node generations instead of wrapping", () => {
    const counters = createPhysicsOwnershipCounters2D();
    const broadPhase = new DynamicAabbBroadPhase2D(counters, 4, 8);
    const proxy = broadPhase.createProxy(0, 1, 0, 0, 1, 1);
    const node = broadPhase.proxyNodes[proxy]!;
    broadPhase.proxyGenerations[proxy] = 0xffff_ffff;
    broadPhase.nodeGenerations[node] = 0xffff_ffff;

    expect(broadPhase.destroyProxy(proxy, 0xffff_ffff)).toBe(true);
    const replacement = broadPhase.createProxy(1, 1, 0, 0, 1, 1);
    expect(replacement).toBe(1);
    expect(broadPhase.proxyNodes[replacement]).toBe(1);
    expect(broadPhase.hasProxy(proxy, 1)).toBe(false);
    expect(counters.retiredProxySlots).toBe(1);
    expect(counters.retiredTreeNodeSlots).toBe(1);
  });

  it("rejects a second live leaf for the same collider identity", () => {
    const counters = createPhysicsOwnershipCounters2D();
    const broadPhase = new DynamicAabbBroadPhase2D(counters, 4, 8);
    broadPhase.createProxy(3, 7, 0, 0, 1, 1);

    expect(() => broadPhase.createProxy(3, 7, 2, 2, 3, 3)).toThrow(
      "collider already has a live broad-phase proxy",
    );
    assertTreeInvariants(broadPhase);
    expect(counters.liveProxies).toBe(1);
  });

  it("descends through the lower proxy subtree on an exact perimeter-cost tie", () => {
    const counters = createPhysicsOwnershipCounters2D();
    const broadPhase = new DynamicAabbBroadPhase2D(counters, 4, 8);
    const lower = broadPhase.createProxy(10, 1, 0, 0, 1, 1);
    const higher = broadPhase.createProxy(11, 1, 0, 0, 1, 1);
    const inserted = broadPhase.createProxy(12, 1, 0, 0, 1, 1);

    expect(broadPhase.nodeParents[broadPhase.proxyNodes[lower]!]).toBe(
      broadPhase.nodeParents[broadPhase.proxyNodes[inserted]!],
    );
    expect(broadPhase.nodeParents[broadPhase.proxyNodes[higher]!]).not.toBe(
      broadPhase.nodeParents[broadPhase.proxyNodes[inserted]!],
    );
    assertTreeInvariants(broadPhase);
  });

  it("keeps the lower proxy subtree when balancing equal-height branches", () => {
    const counters = createPhysicsOwnershipCounters2D();
    const broadPhase = new DynamicAabbBroadPhase2D(counters, 8, 16);
    const bounds = [
      [3, 2, 6, 5],
      [3, -2, 5, 0],
      [-1, 2, 0, 5],
      [1, 0, 3, 1],
      [1, 2, 2, 5],
      [-1, 4, 1, 6],
    ] as const;
    const proxies: number[] = [];
    for (let index = 0; index < bounds.length; index += 1) {
      const [minX, minY, maxX, maxY] = bounds[index]!;
      proxies.push(broadPhase.createProxy(index, 1, minX, minY, maxX, maxY));
    }

    expect(broadPhase.destroyProxy(proxies[0]!, 1)).toBe(true);
    const first = broadPhase.nodeChild1[broadPhase.rootNode]!;
    const second = broadPhase.nodeChild2[broadPhase.rootNode]!;
    expect(
      [
        broadPhase.nodeMinProxyIndices[first]!,
        broadPhase.nodeMinProxyIndices[second]!,
      ].sort((left, right) => left - right),
    ).toEqual([1, 2]);
    assertTreeInvariants(broadPhase);
  });

  it("preserves exact tree invariants across insert, move, remove, and generation-safe reuse", () => {
    const counters = createPhysicsOwnershipCounters2D();
    const broadPhase = new DynamicAabbBroadPhase2D(counters, 4, 8);
    const first = broadPhase.createProxy(7, 1, 0, 0, 1, 1);
    const firstGeneration = broadPhase.proxyGenerations[first]!;
    assertTreeInvariants(broadPhase);
    const second = broadPhase.createProxy(2, 3, 3, 0, 4, 1);
    const secondGeneration = broadPhase.proxyGenerations[second]!;
    assertTreeInvariants(broadPhase);
    const third = broadPhase.createProxy(11, 2, -3, 0, -2, 1);
    const thirdGeneration = broadPhase.proxyGenerations[third]!;
    assertTreeInvariants(broadPhase);

    const fatBounds = new Float64Array(4);
    expect(
      broadPhase.readFatBoundsInto(first, firstGeneration, fatBounds, 0),
    ).toBe(true);
    expect(Array.from(fatBounds)).toEqual([-0.1, -0.1, 1.1, 1.1]);
    expect(
      broadPhase.moveProxy(first, firstGeneration, 5, 2, 6, 3, 2, -4),
    ).toBe(true);
    expect(
      broadPhase.readFatBoundsInto(first, firstGeneration, fatBounds, 0),
    ).toBe(true);
    expect(Array.from(fatBounds)).toEqual([4.9, -2.1, 8.1, 3.1]);
    assertTreeInvariants(broadPhase);

    const movedBeforeContainedMove = counters.movedProxies;
    expect(
      broadPhase.moveProxy(first, firstGeneration, 5.1, 2, 6.1, 3, 0.1, 0),
    ).toBe(false);
    expect(counters.movedProxies).toBe(movedBeforeContainedMove);
    expect(broadPhase.publishPairs()).toBe(0);
    expect(counters.movedProxies).toBe(0);
    expect(broadPhase.proxyMoved[first]).toBe(0);

    const removedNode = broadPhase.proxyNodes[second]!;
    const removedNodeGeneration = broadPhase.nodeGenerations[removedNode]!;
    expect(broadPhase.destroyProxy(second, secondGeneration)).toBe(true);
    assertTreeInvariants(broadPhase);
    const replacement = broadPhase.createProxy(5, 9, 0, 0, 1, 1);
    const replacementGeneration = broadPhase.proxyGenerations[replacement]!;
    expect(replacement).toBe(second);
    expect(replacementGeneration).toBe(secondGeneration + 1);
    expect(
      broadPhase.nodeGenerations[broadPhase.proxyNodes[replacement]!],
    ).toBeGreaterThan(removedNodeGeneration);
    expect(
      broadPhase.moveProxy(second, secondGeneration, 8, 8, 9, 9, 0, 0),
    ).toBe(false);
    expect(broadPhase.destroyProxy(second, secondGeneration)).toBe(false);
    assertTreeInvariants(broadPhase);

    expect(broadPhase.destroyProxy(first, firstGeneration)).toBe(true);
    expect(broadPhase.destroyProxy(third, thirdGeneration)).toBe(true);
    expect(broadPhase.destroyProxy(replacement, replacementGeneration)).toBe(
      true,
    );
    assertTreeInvariants(broadPhase);
    expect(counters.liveProxies).toBe(0);
    expect(counters.liveTreeNodes).toBe(0);
    expect(counters.freeProxySlots).toBe(counters.proxyCapacity);
    expect(counters.freeTreeNodeSlots).toBe(counters.treeNodeCapacity);
    expect(counters.proxyAllocations).toBe(counters.proxyReleases);
    expect(counters.treeNodeAllocations).toBe(counters.treeNodeReleases);
  });

  it("publishes unique collider pairs in lexicographic identity order for different tree shapes", () => {
    const first = createOverlappingBroadPhase([9, 2, 5, 1]);
    const second = createOverlappingBroadPhase([1, 5, 2, 9]);
    const expected = [
      [1, 1, 2, 1],
      [1, 1, 5, 1],
      [1, 1, 9, 1],
      [2, 1, 5, 1],
      [2, 1, 9, 1],
      [5, 1, 9, 1],
    ];

    expect(publishedPairs(first)).toEqual(expected);
    expect(publishedPairs(second)).toEqual(expected);
    expect(first.counters.publishedPairs).toBe(6);
    expect(second.counters.publishedPairs).toBe(6);
    expect(first.broadPhase.proxyMoved.every((value) => value === 0)).toBe(
      true,
    );
    expect(second.broadPhase.proxyMoved.every((value) => value === 0)).toBe(
      true,
    );
  });

  it("reuses warmed proxy, node, moved, pair, and query storage without capacity growth", () => {
    const counters = createPhysicsOwnershipCounters2D();
    const broadPhase = new DynamicAabbBroadPhase2D(counters, 8, 16);
    const proxies: number[] = [];
    const generations: number[] = [];
    for (let collider = 0; collider < 6; collider += 1) {
      const proxy = broadPhase.createProxy(collider, 1, 0, 0, 2, 2);
      proxies.push(proxy);
      generations.push(broadPhase.proxyGenerations[proxy]!);
    }
    expect(broadPhase.publishPairs()).toBe(15);
    const queryOutput = new Int32Array(8);
    expect(broadPhase.queryAabbInto(-1, -1, 3, 3, queryOutput, 0, 8)).toBe(6);
    expect(Array.from(queryOutput.subarray(0, 6))).toEqual([0, 1, 2, 3, 4, 5]);
    const warmed = {
      proxyCapacity: counters.proxyCapacity,
      treeNodeCapacity: counters.treeNodeCapacity,
      movedBufferCapacity: counters.movedBufferCapacity,
      pairBufferCapacity: counters.pairBufferCapacity,
      queryStackCapacity: counters.queryStackCapacity,
      proxyCapacityGrowths: counters.proxyCapacityGrowths,
      treeNodeCapacityGrowths: counters.treeNodeCapacityGrowths,
      movedBufferGrowths: counters.movedBufferGrowths,
      pairBufferGrowths: counters.pairBufferGrowths,
      queryStackGrowths: counters.queryStackGrowths,
    };

    for (let iteration = 0; iteration < 20; iteration += 1) {
      const proxy = proxies[iteration % proxies.length]!;
      const generation = generations[iteration % generations.length]!;
      const x = Math.floor(iteration / proxies.length) % 2 === 0 ? 10 : 0;
      expect(
        broadPhase.moveProxy(
          proxy,
          generation,
          x,
          0,
          x + 2,
          2,
          x === 0 ? -10 : 10,
          0,
        ),
      ).toBe(true);
      broadPhase.publishPairs();
      broadPhase.queryAabbInto(-1, -1, 13, 3, queryOutput, 0, 8);
      assertTreeInvariants(broadPhase);
    }
    expect({
      proxyCapacity: counters.proxyCapacity,
      treeNodeCapacity: counters.treeNodeCapacity,
      movedBufferCapacity: counters.movedBufferCapacity,
      pairBufferCapacity: counters.pairBufferCapacity,
      queryStackCapacity: counters.queryStackCapacity,
      proxyCapacityGrowths: counters.proxyCapacityGrowths,
      treeNodeCapacityGrowths: counters.treeNodeCapacityGrowths,
      movedBufferGrowths: counters.movedBufferGrowths,
      pairBufferGrowths: counters.pairBufferGrowths,
      queryStackGrowths: counters.queryStackGrowths,
    }).toEqual(warmed);
  });
});

function createOverlappingBroadPhase(order: readonly number[]): Readonly<{
  broadPhase: DynamicAabbBroadPhase2D;
  counters: ReturnType<typeof createPhysicsOwnershipCounters2D>;
}> {
  const counters = createPhysicsOwnershipCounters2D();
  const broadPhase = new DynamicAabbBroadPhase2D(counters, 4, 8);
  for (const collider of order) {
    broadPhase.createProxy(collider, 1, 0, 0, 2, 2);
  }
  return { broadPhase, counters };
}

function publishedPairs(
  fixture: ReturnType<typeof createOverlappingBroadPhase>,
): number[][] {
  const count = fixture.broadPhase.publishPairs();
  const pairs: number[][] = [];
  for (let index = 0; index < count; index += 1) {
    pairs.push([
      fixture.broadPhase.pairFirstColliderIndices[index]!,
      fixture.broadPhase.pairFirstColliderGenerations[index]!,
      fixture.broadPhase.pairSecondColliderIndices[index]!,
      fixture.broadPhase.pairSecondColliderGenerations[index]!,
    ]);
  }
  return pairs;
}

function assertTreeInvariants(broadPhase: DynamicAabbBroadPhase2D): void {
  let liveNodes = 0;
  let leaves = 0;
  const leafCounts = new Int32Array(broadPhase.proxyCapacity);
  for (let node = 0; node < broadPhase.nodeCapacity; node += 1) {
    if (broadPhase.nodeActive[node] === 0) continue;
    liveNodes += 1;
    const parent = broadPhase.nodeParents[node]!;
    if (node === broadPhase.rootNode) {
      expect(parent, `root parent for node ${String(node)}`).toBe(-1);
    } else {
      expect(parent, `parent for node ${String(node)}`).toBeGreaterThanOrEqual(
        0,
      );
      expect(
        broadPhase.nodeChild1[parent] === node ||
          broadPhase.nodeChild2[parent] === node,
        `reciprocal parent link for node ${String(node)}`,
      ).toBe(true);
    }
    const first = broadPhase.nodeChild1[node]!;
    const second = broadPhase.nodeChild2[node]!;
    if (first === -1) {
      leaves += 1;
      expect(second, `leaf second child for node ${String(node)}`).toBe(-1);
      expect(
        broadPhase.nodeHeights[node],
        `leaf height for node ${String(node)}`,
      ).toBe(0);
      const proxy = broadPhase.nodeProxyIndices[node]!;
      expect(
        proxy,
        `leaf proxy for node ${String(node)}`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        broadPhase.proxyNodes[proxy],
        `proxy node for proxy ${String(proxy)}`,
      ).toBe(node);
      leafCounts[proxy] += 1;
      continue;
    }
    expect(
      second,
      `internal second child for node ${String(node)}`,
    ).toBeGreaterThanOrEqual(0);
    expect(
      broadPhase.nodeParents[first],
      `first parent for node ${String(node)}`,
    ).toBe(node);
    expect(
      broadPhase.nodeParents[second],
      `second parent for node ${String(node)}`,
    ).toBe(node);
    expect(
      broadPhase.nodeProxyIndices[node],
      `internal proxy for node ${String(node)}`,
    ).toBe(-1);
    expect(
      broadPhase.nodeHeights[node],
      `height for node ${String(node)}`,
    ).toBe(
      1 +
        Math.max(
          broadPhase.nodeHeights[first]!,
          broadPhase.nodeHeights[second]!,
        ),
    );
    expect(broadPhase.nodeMinX[node], `minX for node ${String(node)}`).toBe(
      Math.min(broadPhase.nodeMinX[first]!, broadPhase.nodeMinX[second]!),
    );
    expect(broadPhase.nodeMinY[node], `minY for node ${String(node)}`).toBe(
      Math.min(broadPhase.nodeMinY[first]!, broadPhase.nodeMinY[second]!),
    );
    expect(broadPhase.nodeMaxX[node], `maxX for node ${String(node)}`).toBe(
      Math.max(broadPhase.nodeMaxX[first]!, broadPhase.nodeMaxX[second]!),
    );
    expect(broadPhase.nodeMaxY[node], `maxY for node ${String(node)}`).toBe(
      Math.max(broadPhase.nodeMaxY[first]!, broadPhase.nodeMaxY[second]!),
    );
  }
  let liveProxies = 0;
  for (let proxy = 0; proxy < broadPhase.proxyCapacity; proxy += 1) {
    if (!broadPhase.hasProxy(proxy, broadPhase.proxyGenerations[proxy]!))
      continue;
    liveProxies += 1;
    expect(leafCounts[proxy], `leaf count for proxy ${String(proxy)}`).toBe(1);
  }
  expect(leaves).toBe(liveProxies);
  expect(liveNodes).toBe(liveProxies === 0 ? 0 : liveProxies * 2 - 1);
  expect(liveNodes).toBe(broadPhase.counters.liveTreeNodes);
  expect(liveProxies).toBe(broadPhase.counters.liveProxies);
  expect(broadPhase.rootNode === -1).toBe(liveProxies === 0);
}
