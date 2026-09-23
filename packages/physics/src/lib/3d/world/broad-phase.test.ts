import { describe, expect, it } from "vitest";
import { createPhysicsOwnershipCounters3D } from "../runtime/ownership.js";
import { DynamicAabbBroadPhase3D } from "./broad-phase.js";

describe("deterministic 3D dynamic AABB tree", () => {
  it("preserves parent, child, height, and bounds invariants after every mutation", () => {
    const counters = createPhysicsOwnershipCounters3D();
    const broadPhase = new DynamicAabbBroadPhase3D(counters, 4, 8);
    const first = broadPhase.createProxy(7, 1, 0, 0, 0, 1, 1, 1);
    const firstGeneration = broadPhase.proxyGenerations[first]!;
    assertTreeInvariants(broadPhase);
    const second = broadPhase.createProxy(2, 3, 3, 0, -1, 4, 1, 2);
    const secondGeneration = broadPhase.proxyGenerations[second]!;
    assertTreeInvariants(broadPhase);
    const third = broadPhase.createProxy(11, 2, -3, 0, 2, -2, 1, 4);
    const thirdGeneration = broadPhase.proxyGenerations[third]!;
    assertTreeInvariants(broadPhase);

    const fatBounds = new Float64Array(6);
    expect(
      broadPhase.readFatBoundsInto(first, firstGeneration, fatBounds, 0),
    ).toBe(true);
    expect(Array.from(fatBounds)).toEqual([-0.1, -0.1, -0.1, 1.1, 1.1, 1.1]);
    expect(
      broadPhase.moveProxy(
        first,
        firstGeneration,
        5,
        2,
        -3,
        6,
        3,
        -2,
        2,
        -4,
        1,
      ),
    ).toBe(true);
    expect(
      broadPhase.readFatBoundsInto(first, firstGeneration, fatBounds, 0),
    ).toBe(true);
    const movedFatBounds = [4.9, -2.1, -3.1, 8.1, 3.1, -0.9];
    movedFatBounds.forEach((expected, axis) => {
      expect(fatBounds[axis]).toBeCloseTo(expected, 14);
    });
    assertTreeInvariants(broadPhase);

    expect(broadPhase.destroyProxy(second, secondGeneration)).toBe(true);
    assertTreeInvariants(broadPhase);
    const replacement = broadPhase.createProxy(5, 9, 0, 0, 0, 1, 1, 1);
    expect(replacement).toBe(second);
    expect(broadPhase.proxyGenerations[replacement]).toBe(secondGeneration + 1);
    expect(
      broadPhase.moveProxy(second, secondGeneration, 8, 8, 8, 9, 9, 9, 0, 0, 0),
    ).toBe(false);
    assertTreeInvariants(broadPhase);

    expect(broadPhase.destroyProxy(first, firstGeneration)).toBe(true);
    assertTreeInvariants(broadPhase);
    expect(broadPhase.destroyProxy(third, thirdGeneration)).toBe(true);
    assertTreeInvariants(broadPhase);
    expect(
      broadPhase.destroyProxy(
        replacement,
        broadPhase.proxyGenerations[replacement]!,
      ),
    ).toBe(true);
    assertTreeInvariants(broadPhase);

    broadPhase.dispose();
    expect(counters.proxyAllocations).toBe(counters.proxyReleases);
    expect(counters.treeNodeAllocations).toBe(counters.treeNodeReleases);
    expect(counters.liveProxies).toBe(0);
    expect(counters.liveTreeNodes).toBe(0);
    expect(counters.broadPhaseAllocations).toBe(1);
    expect(counters.broadPhaseReleases).toBe(1);
    expect(counters.liveBroadPhases).toBe(0);
  });

  it("publishes unique pair keys lexicographically independent of insertion order", () => {
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
  });

  it("reuses clean proxy slots and warmed buffers without stale candidates", () => {
    const counters = createPhysicsOwnershipCounters3D();
    const broadPhase = new DynamicAabbBroadPhase3D(counters, 4, 8);
    const proxies: number[] = [];
    const generations: number[] = [];
    for (let collider = 0; collider < 6; collider += 1) {
      const proxy = broadPhase.createProxy(collider, 1, 0, 0, 0, 2, 2, 2);
      proxies.push(proxy);
      generations.push(broadPhase.proxyGenerations[proxy]!);
    }
    expect(broadPhase.publishPairs()).toBe(15);
    const output = new Int32Array(8);
    expect(broadPhase.queryAabbInto(-1, -1, -1, 3, 3, 3, output, 0, 8)).toBe(6);
    expect(Array.from(output.subarray(0, 6))).toEqual([0, 1, 2, 3, 4, 5]);
    const warmed = {
      proxyCapacity: counters.proxyCapacity,
      treeNodeCapacity: counters.treeNodeCapacity,
      movedBufferCapacity: counters.movedBufferCapacity,
      pairBufferCapacity: counters.pairBufferCapacity,
      queryStackCapacity: counters.queryStackCapacity,
      proxyGrowths: counters.proxyCapacityGrowths,
      nodeGrowths: counters.treeNodeCapacityGrowths,
      movedGrowths: counters.movedBufferGrowths,
      pairGrowths: counters.pairBufferGrowths,
      queryGrowths: counters.queryStackGrowths,
    };

    const removed = proxies[2]!;
    expect(broadPhase.destroyProxy(removed, generations[2]!)).toBe(true);
    expect(broadPhase.publishPairs()).toBe(0);
    const replacement = broadPhase.createProxy(20, 7, 20, 20, 20, 21, 21, 21);
    expect(replacement).toBe(removed);
    expect(broadPhase.publishPairs()).toBe(0);
    expect(publishedRows(broadPhase)).toEqual([]);
    assertTreeInvariants(broadPhase);

    expect({
      proxyCapacity: counters.proxyCapacity,
      treeNodeCapacity: counters.treeNodeCapacity,
      movedBufferCapacity: counters.movedBufferCapacity,
      pairBufferCapacity: counters.pairBufferCapacity,
      queryStackCapacity: counters.queryStackCapacity,
      proxyGrowths: counters.proxyCapacityGrowths,
      nodeGrowths: counters.treeNodeCapacityGrowths,
      movedGrowths: counters.movedBufferGrowths,
      pairGrowths: counters.pairBufferGrowths,
      queryGrowths: counters.queryStackGrowths,
    }).toEqual(warmed);
  });
});

function createOverlappingBroadPhase(order: readonly number[]): Readonly<{
  broadPhase: DynamicAabbBroadPhase3D;
  counters: ReturnType<typeof createPhysicsOwnershipCounters3D>;
}> {
  const counters = createPhysicsOwnershipCounters3D();
  const broadPhase = new DynamicAabbBroadPhase3D(counters, 4, 8);
  for (const collider of order) {
    broadPhase.createProxy(collider, 1, 0, 0, 0, 2, 2, 2);
  }
  return { broadPhase, counters };
}

function publishedPairs(
  fixture: ReturnType<typeof createOverlappingBroadPhase>,
): number[][] {
  fixture.broadPhase.publishPairs();
  return publishedRows(fixture.broadPhase);
}

function publishedRows(broadPhase: DynamicAabbBroadPhase3D): number[][] {
  const result: number[][] = [];
  for (let index = 0; index < broadPhase.pairCount; index += 1) {
    result.push([
      broadPhase.pairFirstColliderIndices[index]!,
      broadPhase.pairFirstColliderGenerations[index]!,
      broadPhase.pairSecondColliderIndices[index]!,
      broadPhase.pairSecondColliderGenerations[index]!,
    ]);
  }
  return result;
}

function assertTreeInvariants(broadPhase: DynamicAabbBroadPhase3D): void {
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
      expect(broadPhase.nodeHeights[node], `leaf height ${String(node)}`).toBe(
        0,
      );
      const proxy = broadPhase.nodeProxyIndices[node]!;
      expect(proxy).toBeGreaterThanOrEqual(0);
      expect(broadPhase.proxyNodes[proxy]).toBe(node);
      leafCounts[proxy] += 1;
      continue;
    }
    expect(second).toBeGreaterThanOrEqual(0);
    expect(broadPhase.nodeParents[first]).toBe(node);
    expect(broadPhase.nodeParents[second]).toBe(node);
    expect(broadPhase.nodeProxyIndices[node]).toBe(-1);
    expect(broadPhase.nodeHeights[node]).toBe(
      1 +
        Math.max(
          broadPhase.nodeHeights[first]!,
          broadPhase.nodeHeights[second]!,
        ),
    );
    expect(broadPhase.nodeMinX[node]).toBe(
      Math.min(broadPhase.nodeMinX[first]!, broadPhase.nodeMinX[second]!),
    );
    expect(broadPhase.nodeMinY[node]).toBe(
      Math.min(broadPhase.nodeMinY[first]!, broadPhase.nodeMinY[second]!),
    );
    expect(broadPhase.nodeMinZ[node]).toBe(
      Math.min(broadPhase.nodeMinZ[first]!, broadPhase.nodeMinZ[second]!),
    );
    expect(broadPhase.nodeMaxX[node]).toBe(
      Math.max(broadPhase.nodeMaxX[first]!, broadPhase.nodeMaxX[second]!),
    );
    expect(broadPhase.nodeMaxY[node]).toBe(
      Math.max(broadPhase.nodeMaxY[first]!, broadPhase.nodeMaxY[second]!),
    );
    expect(broadPhase.nodeMaxZ[node]).toBe(
      Math.max(broadPhase.nodeMaxZ[first]!, broadPhase.nodeMaxZ[second]!),
    );
  }
  let liveProxies = 0;
  for (let proxy = 0; proxy < broadPhase.proxyCapacity; proxy += 1) {
    if (!broadPhase.hasProxy(proxy, broadPhase.proxyGenerations[proxy]!))
      continue;
    liveProxies += 1;
    expect(leafCounts[proxy]).toBe(1);
  }
  expect(leaves).toBe(liveProxies);
  expect(liveNodes).toBe(liveProxies === 0 ? 0 : liveProxies * 2 - 1);
  expect(liveNodes).toBe(broadPhase.counters.liveTreeNodes);
  expect(liveProxies).toBe(broadPhase.counters.liveProxies);
  expect(broadPhase.rootNode === -1).toBe(liveProxies === 0);
}
