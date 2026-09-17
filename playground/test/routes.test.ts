import { describe, expect, it } from "vitest";

import {
  canonicalizeHash,
  parseStudioRoute,
  resolveLearningExampleRoute,
  routeHref,
} from "../src/app/routes";

describe("Studio routes", () => {
  it("parses every canonical public route family", () => {
    expect(parseStudioRoute("#/learn")).toEqual({
      kind: "document",
      route: "#/learn",
    });
    expect(parseStudioRoute("#/learn/tutorials/diagram-editor")).toEqual({
      kind: "document",
      route: "#/learn/tutorials/diagram-editor",
    });
    expect(parseStudioRoute("#/learn/tutorials/diagram-editor/first-scene")).toEqual({
      kind: "document",
      route: "#/learn/tutorials/diagram-editor/first-scene",
    });
    expect(parseStudioRoute("#/learn/guides/configure-jsx")).toEqual({
      kind: "document",
      route: "#/learn/guides/configure-jsx",
    });
    expect(parseStudioRoute("#/api")).toEqual({
      kind: "document",
      route: "#/api",
    });
    expect(parseStudioRoute("#/api/components/rectangle")).toEqual({
      kind: "document",
      route: "#/api/components/rectangle",
    });
    expect(parseStudioRoute("#/api/functions/crc")).toEqual({
      kind: "document",
      route: "#/api/functions/crc",
    });
    expect(parseStudioRoute("#/api/hooks/use-state")).toEqual({
      kind: "document",
      route: "#/api/hooks/use-state",
    });
    expect(parseStudioRoute("#/api/types/events#crcpointerevent")).toEqual({
      kind: "document",
      route: "#/api/types/events",
      anchor: "crcpointerevent",
    });
    expect(parseStudioRoute("#/examples/drawing/rectangle")).toEqual({
      kind: "example",
      group: "drawing",
      slug: "rectangle",
    });
    expect(parseStudioRoute("#/examples/webgl/ambient-light")).toEqual({
      kind: "example",
      group: "webgl",
      slug: "ambient-light",
    });
    expect(parseStudioRoute("#/testing")).toEqual({ kind: "testing" });
    expect(parseStudioRoute("#/testing/baseline-smoke")).toEqual({
      kind: "test",
      slug: "baseline-smoke",
    });
  });

  it("keeps query text while parsing and serializing", () => {
    const route = parseStudioRoute("#/examples/drawing/rectangle?code=v1.abc");

    expect(route).toEqual({
      kind: "example",
      group: "drawing",
      slug: "rectangle",
      query: "?code=v1.abc",
    });
    expect(routeHref(route)).toBe("#/examples/drawing/rectangle?code=v1.abc");
  });

  it("round-trips document anchors together with their query text", () => {
    const route = parseStudioRoute(
      "#/api/types/events#crcpointerevent?mode=detail",
    );

    expect(route).toEqual({
      kind: "document",
      route: "#/api/types/events",
      anchor: "crcpointerevent",
      query: "?mode=detail",
    });
    expect(routeHref(route)).toBe(
      "#/api/types/events#crcpointerevent?mode=detail",
    );
  });

  it("reports paths outside public route families as unknown", () => {
    expect(parseStudioRoute("#/made-up/place")).toEqual({
      kind: "unknown",
      route: "#/made-up/place",
    });
  });

  it("canonicalizes only registered old example section aliases", () => {
    expect(canonicalizeHash("#/examples/composition/filters?code=v1.abc")).toMatchObject({
      canonical: "#/examples/drawing/filters?code=v1.abc",
      changed: true,
    });
    expect(canonicalizeHash("#/examples/drawing/filters")).toMatchObject({
      canonical: "#/examples/drawing/filters",
      changed: false,
    });
    expect(canonicalizeHash("#/examples/made-up/filters?code=v1.abc")).toMatchObject({
      canonical: "#/examples/made-up/filters?code=v1.abc",
      changed: false,
    });
  });

  it("resolves a live example only from its exact canonical route", () => {
    expect(
      resolveLearningExampleRoute(
        parseStudioRoute("#/examples/drawing/filters"),
      )?.slug,
    ).toBe("filters");
    expect(
      resolveLearningExampleRoute(
        parseStudioRoute("#/examples/made-up/filters"),
      ),
    ).toBeUndefined();
    expect(
      resolveLearningExampleRoute(
        parseStudioRoute("#/examples/webgl/ambient-light"),
      )?.slug,
    ).toBe("ambient-light");

    const legacy = canonicalizeHash("#/examples/composition/filters");
    expect(resolveLearningExampleRoute(legacy.route)?.slug).toBe("filters");
  });

  it("canonicalizes old scenario routes", () => {
    expect(canonicalizeHash("#/scenarios")).toMatchObject({
      canonical: "#/testing",
      changed: true,
    });
    expect(canonicalizeHash("#/scenarios/baseline-smoke").canonical).toBe(
      "#/testing/baseline-smoke",
    );
  });

  it("canonicalizes public document aliases before dispatch while preserving anchors and queries", () => {
    expect(
      canonicalizeHash("#/legacy/first-scene#next-steps?mode=detail", {
        "#/legacy/first-scene": "#/learn/guides/first-scene",
      }),
    ).toMatchObject({
      canonical: "#/learn/guides/first-scene#next-steps?mode=detail",
      changed: true,
      route: {
        kind: "document",
        route: "#/learn/guides/first-scene",
        anchor: "next-steps",
        query: "?mode=detail",
      },
    });
  });
});
