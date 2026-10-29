import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
import { loadAuthored, topicFor } from "../website/documentation.mjs";

test("visualization has a primary navigation link and homepage entry", async () => {
  const config = await readFile(new URL("../website/astro.config.mjs", import.meta.url), "utf8");
  assert.match(
    config,
    /label: "Data Visualization", link: "\/visualization\/"/,
  );
  const pages = await loadAuthored(root);
  const home = pages.find(({ id }) => id === "index");
  assert.match(home.content, /\[.*[Cc]harts.*\]\(\/visualization\/\)/);
  const hub = pages.find(({ id }) => id === "visualization");
  assert.ok(hub, "dedicated visualization landing page");
  for (const destination of [
    "/guides/data-visualization/",
    "/reference/capabilities/visualization/",
    "/reference/components/paired-series/",
    "/reference/components/trajectory-series/",
    "/reference/functions/financial-series/",
    "/playground/#/examples/composition/viz-band-bars",
  ])
    assert.ok(hub.content.includes(destination), destination);
});

test("financial algorithms and chart guides stay in the visualization capability", () => {
  for (const id of [
    "reference/functions/financial-indicators",
    "reference/functions/financial-oscillators",
    "reference/functions/ohlcv-aggregation",
    "reference/components/chart-editing",
    "reference/components/chart-lines",
    "reference/components/hover-data",
    "reference/functions/rendered-series-inspection",
    "reference/components/paired-series",
  ])
    assert.equal(topicFor(id), "visualization", id);
});
