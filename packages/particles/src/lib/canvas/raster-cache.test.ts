import { describe, expect, it, vi } from "vitest";
import { createCanvasRasterCache } from "./raster-cache.js";

interface TestBitmap {
  readonly id: string;
  close(): void;
}

function bitmap(id: string): TestBitmap {
  return { id, close: vi.fn() };
}

describe("Canvas particle raster cache", () => {
  it("evicts the deterministic least-recently-used owned raster at sixteen entries per source", () => {
    const cache = createCanvasRasterCache();
    const source = {};
    const values = Array.from({ length: 17 }, (_, index) =>
      bitmap(String(index)),
    );

    for (let index = 0; index < 16; index += 1) {
      expect(cache.get(source, `size:${index}`, () => values[index]!)).toBe(
        values[index],
      );
    }
    expect(cache.get(source, "size:0", () => bitmap("duplicate"))).toBe(
      values[0],
    );
    cache.get(source, "size:16", () => values[16]!);

    expect(cache.sizeFor(source)).toBe(16);
    expect(values[0]!.close).not.toHaveBeenCalled();
    expect(values[1]!.close).toHaveBeenCalledTimes(1);
  });

  it("keeps independent source budgets and closes owned rasters without closing caller sources", () => {
    const cache = createCanvasRasterCache();
    const firstSource = { close: vi.fn() };
    const secondSource = { close: vi.fn() };
    const first = bitmap("first");
    const second = bitmap("second");

    cache.get(firstSource, "same", () => first);
    cache.get(secondSource, "same", () => second);
    expect(cache.sizeFor(firstSource)).toBe(1);
    expect(cache.sizeFor(secondSource)).toBe(1);

    cache.dispose();
    cache.dispose();

    expect(first.close).toHaveBeenCalledTimes(1);
    expect(second.close).toHaveBeenCalledTimes(1);
    expect(firstSource.close).not.toHaveBeenCalled();
    expect(secondSource.close).not.toHaveBeenCalled();
  });
});
