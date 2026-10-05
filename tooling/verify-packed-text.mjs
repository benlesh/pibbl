import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  rmSync,
  realpathSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";
import { build } from "esbuild";
import { createServer } from "node:http";
import { chromium } from "playwright";
const root = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const store = dirname(
  parse(readFileSync(join(root, "node_modules/.modules.yaml"), "utf8"))
    .storeDir,
);
const temp = mkdtempSync(join(tmpdir(), "crc-packed-text-"));
const pnpm = (args, cwd = root) =>
  execFileSync("corepack", ["pnpm@11.21.0", ...args], {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
  });
let server, browser;
try {
  const dependencies = {};
  for (const name of ["core", "text"]) {
    pnpm(
      ["pack", "--out", join(temp, `${name}.tgz`)],
      join(root, "packages", name),
    );
    dependencies[`@crc/${name}`] = `file:${join(temp, `${name}.tgz`)}`;
  }
  const consumer = join(temp, "consumer");
  mkdirSync(consumer);
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module", dependencies }),
  );
  writeFileSync(
    join(consumer, "pnpm-workspace.yaml"),
    `packages:\n  - .\n`,
  );
  pnpm(
    [
      "install",
      "--offline",
      "--strict-peer-dependencies",
      "--store-dir",
      store,
    ],
    consumer,
  );
  const installed = createRequire(join(consumer, "probe.mjs"));
  const entry = installed.resolve("@crc/text");
  assert.ok(!readdirSync(dirname(entry)).includes("testing.mjs"), "Private text testing entry must not ship");
  const manifest = JSON.parse(
    readFileSync(installed.resolve("@crc/text/package.json"), "utf8"),
  );
  assert.equal(manifest.scripts.install, undefined);
  assert.equal(manifest.scripts.postinstall, undefined);
  assert.equal(
    realpathSync(createRequire(entry).resolve("@crc/core")),
    realpathSync(installed.resolve("@crc/core")),
  );
  for (const path of ["@crc/text/testing", "@crc/text/src/index.ts"])
    assert.throws(() => installed.resolve(path), {
      code: "ERR_PACKAGE_PATH_NOT_EXPORTED",
    });
  const text = await import(pathToFileURL(entry));
  assert.deepEqual(Object.keys(text).sort(), [
    "createTextGeometry",
    "loadOutlineFont",
  ]);
  using font = await text.loadOutlineFont(
    readFileSync(join(root, "packages/text/test/fixtures/ABeeZee-Regular.ttf")),
  );
  const result = text.createTextGeometry(font, "Hello", { fontSize: 100 });
  const { PathGeometry } = await import(
    pathToFileURL(installed.resolve("@crc/core"))
  );
  assert.ok(result.geometry instanceof PathGeometry);
  font.dispose();
  assert.ok(result.geometry.segmentCount > 0);
  assert.ok(readFileSync(join(dirname(entry), "engine.wasm")).length > 0);
  assert.match(
    readFileSync(join(dirname(entry), "HARFBUZZ-LICENSE.txt"), "utf8"),
    /Copyright/,
  );
  const runtimeNotices = readFileSync(
    join(dirname(entry), "THIRD-PARTY-NOTICES.txt"),
    "utf8",
  );
  for (const attribution of [
    "Microsoft Corporation",
    "Rich Felker",
    "Apache License",
    "LLVM Exceptions",
  ])
    assert.ok(runtimeNotices.includes(attribution), attribution);

  const publicSource = `import {loadOutlineFont,createTextGeometry,type OutlineFont,type InkBounds} from '@crc/text';\nexport async function convert(bytes:Uint8Array) {using font:OutlineFont=await loadOutlineFont(bytes); const result=createTextGeometry(font,'Hello',{fontSize:100}); const bounds:InkBounds|null=result.inkBounds; return {result,bounds};}\n`;
  writeFileSync(join(consumer, "public.ts"), publicSource);
  const tsc = join(dirname(require.resolve("typescript")), "tsc.js");
  for (const mode of ["Bundler", "NodeNext"]) {
    writeFileSync(
      join(consumer, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ESNext",
          lib: ["ESNext", "DOM"],
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          types: [],
          module: mode === "Bundler" ? "ESNext" : "NodeNext",
          moduleResolution: mode,
        },
        files: ["public.ts"],
      }),
    );
    execFileSync(
      process.execPath,
      [tsc, "-p", join(consumer, "tsconfig.json")],
      { stdio: "pipe" },
    );
  }
  await build({
    entryPoints: [join(consumer, "public.ts")],
    bundle: true,
    platform: "browser",
    format: "esm",
    splitting: true,
    outdir: join(temp, "browser"),
    metafile: true,
  });
  const assets = new Map(
    readdirSync(join(temp, "browser")).map((name) => [
      "/" + name,
      readFileSync(join(temp, "browser", name)),
    ]),
  );
  assets.set("/engine.wasm", readFileSync(join(dirname(entry), "engine.wasm")));
  assets.set(
    "/font.ttf",
    readFileSync(join(root, "packages/text/test/fixtures/ABeeZee-Regular.ttf")),
  );
  server = createServer((request, response) => {
    const path = new URL(request.url, "http://localhost").pathname;
    const bytes = path === "/" ? "<!doctype html>" : assets.get(path);
    response.writeHead(bytes === undefined ? 404 : 200, {
      "Content-Type": path.endsWith(".wasm")
        ? "application/wasm"
        : path.endsWith(".js")
          ? "text/javascript"
          : path === "/"
            ? "text/html"
            : "application/octet-stream",
    });
    response.end(bytes);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch();
  const page = await browser.newPage();
  const requests = [],
    errors = [];
  page.on("request", (request) =>
    requests.push(new URL(request.url()).pathname),
  );
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(() => import("/public.js"));
  assert.ok(!requests.some((path) => path.endsWith(".wasm")));
  let rejectWasm = true;
  await page.route("**/engine.wasm", (route) =>
    rejectWasm
      ? route.fulfill({ status: 503, body: "temporarily unavailable" })
      : route.continue(),
  );
  const firstLoadFailed = await page.evaluate(async () => {
    const { convert } = await import("/public.js");
    try {
      await convert(
        new Uint8Array(await (await fetch("/font.ttf")).arrayBuffer()),
      );
      return false;
    } catch {
      return true;
    }
  });
  assert.equal(
    firstLoadFailed,
    true,
    "engine initialization must reject a failed WASM download",
  );
  rejectWasm = false;
  const rendered = await page.evaluate(async () => {
    const { convert } = await import("/public.js");
    const value = await convert(
      new Uint8Array(await (await fetch("/font.ttf")).arrayBuffer()),
    );
    return {
      segments: value.result.geometry.segmentCount,
      bounds: value.bounds,
    };
  });
  assert.ok(rendered.segments > 0 && rendered.bounds.width > 0);
  assert.ok(requests.includes("/engine.wasm"));
  assert.deepEqual(errors, []);
  process.stdout.write(
    String(
      "Packed text: installed runtime, shared core, WASM, declarations, using, private exports, browser bundle, and failed-WASM recovery passed.",
    ) + "\n",
  );
} catch (error) {
  if (error.stdout) process.stderr.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  throw error;
} finally {
  await browser?.close();
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  rmSync(temp, { recursive: true, force: true });
}
