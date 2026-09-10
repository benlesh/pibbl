import { describe, expect, it } from "vitest";

import {
  buildSearchBundle,
  type SearchBundleInput,
} from "../../tooling/studio-docs/search-index";
import { createSearchEngine } from "../src/search/search-engine";

const bundle = buildSearchBundle({
  pages: [
    page("learn-state", "#/learn/guides/state", "Learn state", "learn", {
      body: "Use crcState to keep local state in one component.",
    }),
    page("api-state", "#/api/hooks/crc-state", "crcState", "api", {
      symbols: ["crcState"],
      body: "Creates state that survives scheduled renders.",
    }),
  ],
  examples: [
    {
      slug: "stateful-rectangle",
      title: "Stateful rectangle",
      shortTitle: "Stateful rectangle",
      browseGroup: "drawing",
      summary: "Change a Rectangle with crcState.",
      api: ["Rectangle", "crcState"],
      objectives: ["Use local state"],
      apiNotes: ["State belongs to the owning component."],
    },
  ],
} satisfies SearchBundleInput);

describe("browser documentation search engine", () => {
  it("defers and deduplicates restoration until search intent", async () => {
    let loadCalls = 0;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const engine = createSearchEngine(async () => {
      loadCalls++;
      await gate;
      return bundle;
    });

    expect(loadCalls).toBe(0);
    const first = engine.preload();
    const second = engine.preload();
    expect(loadCalls).toBe(1);
    release?.();
    await Promise.all([first, second]);
    expect(loadCalls).toBe(1);
  });

  it("uses the shared exact ranking and exposes kind counts before filtering", async () => {
    const engine = createSearchEngine(async () => bundle);

    const all = await engine.search("crcState");
    expect(all.results[0]?.url).toBe("#/api/hooks/crc-state");
    expect(all.counts).toEqual({ learn: 1, api: 1, example: 1 });

    const examples = await engine.search("crcState", ["example"]);
    expect(examples.results.map(({ kind }) => kind)).toEqual(["example"]);
    expect(examples.counts).toEqual({ learn: 1, api: 1, example: 1 });
  });

  it("returns plain-text excerpts with bounded highlight ranges", async () => {
    const engine = createSearchEngine(async () => bundle);

    const result = await engine.search("state");
    const excerpt = result.results.find(({ kind }) => kind === "learn")?.excerpt;

    expect(excerpt?.text).toContain("state");
    expect(excerpt?.matches).toEqual([
      expect.objectContaining({ start: expect.any(Number), end: expect.any(Number) }),
    ]);
    for (const range of excerpt?.matches ?? []) {
      expect(range.start).toBeGreaterThanOrEqual(0);
      expect(range.end).toBeGreaterThan(range.start);
      expect(range.end).toBeLessThanOrEqual(excerpt!.text.length);
    }
  });

  it("keeps highlight ranges aligned after collapsing source whitespace", async () => {
    const whitespaceBundle = buildSearchBundle({
      pages: [
        page("whitespace", "#/learn/guides/whitespace", "Whitespace", "learn", {
          body: `${"background ".repeat(24)}\n\nstate remains readable after line breaks.`,
        }),
      ],
      examples: [],
    } satisfies SearchBundleInput);
    const engine = createSearchEngine(async () => whitespaceBundle);

    const excerpt = (await engine.search("state")).results[0]?.excerpt;

    expect(excerpt?.matches).toHaveLength(1);
    for (const range of excerpt?.matches ?? []) {
      expect(excerpt?.text.slice(range.start, range.end)).toBe("state");
      expect(range.start).toBeGreaterThanOrEqual(0);
      expect(range.end).toBeLessThanOrEqual(excerpt!.text.length);
    }
  });

  it("allows a failed lazy bundle to be retried", async () => {
    let loadCalls = 0;
    const engine = createSearchEngine(async () => {
      loadCalls++;
      if (loadCalls === 1) throw new Error("index unavailable");
      return bundle;
    });

    await expect(engine.search("state")).rejects.toThrow("index unavailable");
    await engine.retry();
    expect((await engine.search("state")).results.length).toBeGreaterThan(0);
    expect(loadCalls).toBe(2);
  });
});

function page(
  id: string,
  route: string,
  title: string,
  kind: "learn" | "api",
  options: { readonly symbols?: readonly string[]; readonly body: string },
): SearchBundleInput["pages"][number] {
  return {
    frontmatter: {
      id,
      title,
      summary: `${title} summary`,
      kind: kind === "api" ? "api" : "guide",
      slug: id,
      ...(kind === "api" ? { apiCategory: "hook", symbols: options.symbols } : {}),
    },
    route,
    plainText: options.body,
    headings: [],
    sections: [],
  };
}
