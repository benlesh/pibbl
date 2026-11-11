import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("effect galleries publish runnable examples and complete agent-readable source", async () => {
  const root = new URL("../website/dist/", import.meta.url);
  for (const slug of [
    "rainy-window",
    "plasma-globe",
    "visibility-transitions",
    "energy-transitions",
  ]) {
    const html = await readFile(
      new URL(`examples/${slug}/index.html`, root),
      "utf8",
    );
    assert.match(html, /data-effect-demo/);
    const markdown = await readFile(
      new URL(`examples/${slug}.md`, root),
      "utf8",
    );
    assert.match(markdown, /## Complete source/);
    assert.match(markdown, /controller.dispose\(\)/);
    assert.match(markdown, /## Integration boundaries/);
    assert.match(
      await readFile(new URL("catalogs.md", root), "utf8"),
      new RegExp(slug),
    );
  }
});

async function effectHarness({ load, mount } = {}) {
  const { transform } = await import("esbuild");
  const { runInNewContext } = await import("node:vm");
  const astro = await readFile(new URL("../website/src/components/EffectDemo.astro", import.meta.url), "utf8");
  const script = astro.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  const javascript = (await transform(script, { loader: "ts", format: "esm" })).code;
  const code = (await transform(javascript.replace(/import\.meta\.glob\([^)]*\)/g, "__loaders"), { format: "cjs" })).code;
  const callbacks = new Map();
  const pageCallbacks = new Map();
  const start = { disabled: false, addEventListener: (_type, callback) => callbacks.set("start", callback) };
  const stop = { disabled: true, addEventListener: (_type, callback) => callbacks.set("stop", callback) };
  const status = { textContent: "Stopped" };
  const canvas = {};
  const host = {
    dataset: { source: "example.tsx", exportName: "Scene", config: JSON.stringify({ pixelRatio: 1 }), htmlOverlay: "true" },
    querySelector: selector => ({ canvas, "[data-start]": start, "[data-stop]": stop, "[data-status]": status })[selector],
  };
  const mounted = [];
  const surfaces = [];
  const controllerDisposals = [];
  let disposed = 0;
  let surfaceDisposed = 0;
  const Scene = () => undefined;
  runInNewContext(code, {
    document: { querySelectorAll: () => [host] },
    window: { matchMedia: () => ({ matches: true }), addEventListener: (type, callback) => pageCallbacks.set(type, callback) },
    AbortController,
    __loaders: { "../../../example.tsx": load ?? (async () => ({ Scene })) },
    require: name => {
      if (name === "@pibbl/core") return {
        createElement: Component => ({ Component }),
        pibbl: async (target, element, config) => {
          const index = mounted.length;
          mounted.push({ target, element, config });
          controllerDisposals.push(0);
          const controller = { dispose() { disposed++; controllerDisposals[index]++; } };
          return mount ? mount(controller) : controller;
        },
      };
      if (name.endsWith("example-surface")) return {
        prepareExampleHost: (_canvas, options) => { surfaces.push(options); return { config: options.config, dispose() { surfaceDisposed++; } }; },
      };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return { start: () => callbacks.get("start")(), stop: () => callbacks.get("stop")(), pagehide: () => pageCallbacks.get("pagehide")(), status, mounted, surfaces, controllerDisposals, Scene,
    get disposed() { return disposed; }, get surfaceDisposed() { return surfaceDisposed; }, get startDisabled() { return start.disabled; } };
}

test("gallery host mounts the catalog's named component through awaited public pibbl", async () => {
  const host = await effectHarness();
  await host.start();
  assert.equal(host.status.textContent, "Running");
  assert.equal(host.mounted.length, 1);
  assert.equal(host.mounted[0].element.Component, host.Scene);
  assert.equal(host.mounted[0].config.pixelRatio, 1);
  assert.equal(host.surfaces[0].htmlOverlay, true);
  host.stop();
  assert.equal(host.disposed, 1);
  assert.equal(host.surfaceDisposed, 1);
  assert.equal(host.status.textContent, "Stopped");
});

test("gallery stop during module loading never mounts a stale example", async () => {
  let resolve;
  const loading = new Promise(done => { resolve = done; });
  const host = await effectHarness({ load: () => loading });
  const started = host.start();
  host.stop();
  resolve({ Scene: () => undefined });
  await started;
  assert.equal(host.status.textContent, "Stopped");
  assert.equal(host.mounted.length, 0);
});

test("gallery pagehide aborts pending mounting and releases a late controller", async () => {
  let finish;
  const mounting = new Promise(done => { finish = done; });
  const host = await effectHarness({ mount: async controller => { await mounting; return controller; } });
  const started = host.start();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(host.mounted.length, 1);
  host.pagehide();
  assert.equal(host.mounted[0].config.signal.aborted, true);
  finish();
  await started;
  assert.equal(host.status.textContent, "Stopped");
  assert.equal(host.disposed, 1);
  assert.equal(host.surfaceDisposed, 1);
});

test("catalog pagehide cancels async startup and disposes a late controller", async () => {
  const { transform } = await import("esbuild");
  const { runInNewContext } = await import("node:vm");
  const astro = await readFile(new URL("../website/src/components/CatalogDemo.astro", import.meta.url), "utf8");
  const script = astro.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  const code = (await transform(script, { loader: "ts", format: "cjs" })).code;
  let pagehide;
  let finish;
  let config;
  let disposed = 0;
  const controller = { dispose() { disposed++; } };
  const mounting = new Promise(resolve => { finish = resolve; });
  runInNewContext(code, {
    document: { querySelectorAll: () => [{ dataset: { kind: "circle" } }] },
    window: { addEventListener: (_type, callback) => { pagehide = callback; } },
    AbortController,
    console,
    require: name => {
      if (name === "@pibbl/core") return { createElement: Component => ({ Component }), pibbl: (_canvas, _element, options) => { config = options; return mounting; } };
      if (name === "@pibbl/core/filters" || name === "@pibbl/core/textures") return {};
      throw new Error(`Unexpected import ${name}`);
    },
  });
  assert.doesNotThrow(() => pagehide());
  assert.equal(config.signal.aborted, true);
  finish(controller);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(disposed, 1);
});


test("gallery restart keeps the new mount when an aborted attempt completes late", async () => {
  let finishFirst;
  let attempts = 0;
  const firstMount = new Promise(resolve => { finishFirst = resolve; });
  const host = await effectHarness({ mount: async controller => {
    if (++attempts === 1) await firstMount;
    return controller;
  } });
  const first = host.start();
  await new Promise(resolve => setImmediate(resolve));
  host.stop();
  await host.start();
  assert.equal(host.status.textContent, "Running");
  finishFirst();
  await first;
  assert.equal(host.status.textContent, "Running");
  assert.deepEqual(host.controllerDisposals, [1, 0]);
  assert.equal(host.surfaceDisposed, 1);
  host.stop();
  assert.deepEqual(host.controllerDisposals, [1, 1]);
  assert.equal(host.surfaceDisposed, 2);
});

test("gallery startup failures release the prepared host and leave Run available", async () => {
  const host = await effectHarness({ mount: async () => { throw new Error("layout unavailable"); } });
  await host.start();
  assert.match(host.status.textContent, /Unable to run:.*layout unavailable/);
  assert.equal(host.surfaceDisposed, 1);
  assert.equal(host.disposed, 0);
  assert.equal(host.startDisabled, false);
  host.stop();
  assert.equal(host.surfaceDisposed, 1);
});
