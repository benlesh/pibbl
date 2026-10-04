import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const requireBuiltPackage = createRequire(
  new URL("../packages/scenarios/package.json", import.meta.url),
);

function importBuilt(specifier) {
  return import(requireBuiltPackage.resolve(specifier));
}

function forbidden(name) {
  return function forbiddenBrowserResource() {
    throw new Error(
      `${name} must remain inert during optional package imports.`,
    );
  };
}

function installForbiddenBrowserResources() {
  const previous = new Map();
  const install = (name, value = forbidden(name)) => {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  };
  install(
    "WebAssembly",
    Object.assign(Object.create(WebAssembly), {
      Module: forbidden("WebAssembly.Module"),
      Instance: forbidden("WebAssembly.Instance"),
      Memory: forbidden("WebAssembly.Memory"),
      compile: forbidden("WebAssembly.compile"),
      instantiate: forbidden("WebAssembly.instantiate"),
    }),
  );
  install("OffscreenCanvas");
  install("ImageData");
  install("requestAnimationFrame");
  install("cancelAnimationFrame");
  install("addEventListener");
  install("removeEventListener");
  install("document", { createElement: forbidden("document.createElement") });
  return () => {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  };
}

test("built optional entries and their factories do not allocate browser resources before mounting", async () => {
  const restore = installForbiddenBrowserResources();
  try {
    assert.throws(() => new OffscreenCanvas(1, 1), /must remain inert/);
    assert.throws(() => requestAnimationFrame(() => {}), /must remain inert/);
    assert.throws(
      () => addEventListener("resize", () => {}),
      /must remain inert/,
    );
    assert.throws(() => document.createElement("canvas"), /must remain inert/);

    const core = await importBuilt("@crc/core");
    const textures = await importBuilt("@crc/textures");

    assert.doesNotThrow(() =>
      core.createElement(core.Rectangle, { style: { width: 1, height: 1 } }),
    );
    for (const factory of [
      textures.marble,
      textures.paper,
      textures.cellular,
      textures.reactionDiffusion,
      textures.tendrils,
      textures.lightning,
      textures.waterWaves,
      textures.waterSurface,
    ])
      assert.doesNotThrow(() => factory({ seed: 42 }));
  } finally {
    restore();
  }
});
