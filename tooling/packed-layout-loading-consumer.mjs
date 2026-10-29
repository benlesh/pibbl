import { strict as assert } from "node:assert";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, lstat, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build } from "esbuild";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const consumer = await realpath(await mkdtemp(join(tmpdir(), "pibbl-packed-loading-")));
const execute = promisify(execFile);

try {
  const run = async (command, args, cwd = consumer) =>
    execute(command, args, { cwd, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  const packageRoot = join(root, "packages/core");
  const packed = JSON.parse((await run("npm", ["pack", "--json", "--ignore-scripts", "--cache", join(consumer, "cache"), "--pack-destination", consumer], packageRoot)).stdout)[0];
  const archive = join(consumer, packed.filename);
  await writeFile(join(consumer, "package.json"), JSON.stringify({ private: true, type: "module" }));
  await run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", join(consumer, "cache"), archive]);
  const installed = join(consumer, "node_modules/@pibbl/core");
  assert.equal((await lstat(installed)).isSymbolicLink(), false);
  assert.equal(await realpath(installed), installed);
  assert.deepEqual(JSON.parse(await readFile(join(installed, "package.json"), "utf8")).exports["./sync"], { types: "./dist/sync.d.ts", default: "./dist/sync.mjs" });
  await readFile(join(installed, "dist/lib/layout/wasm/layout.wasm"));

  await writeFile(join(consumer, "entry.ts"), `
import { pibbl, prepareLayoutEngine, type PibblController, type PibblNode } from "@pibbl/core";
declare const canvas: HTMLCanvasElement;
declare const root: PibblNode;
const pending: Promise<PibblController> = pibbl(canvas, root);
void pending;
void prepareLayoutEngine();
`);
  await writeFile(join(consumer, "sync.ts"), `
import { pibblSync } from "@pibbl/core/sync";
import type { PibblController, PibblNode } from "@pibbl/core";
declare const canvas: HTMLCanvasElement;
declare const root: PibblNode;
const controller: PibblController = pibblSync(canvas, root);
void controller;
`);
  for (const resolution of ["Bundler", "NodeNext"]) {
    await writeFile(join(consumer, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: "ESNext", lib: ["ESNext", "DOM"], module: resolution === "Bundler" ? "ESNext" : "NodeNext", moduleResolution: resolution, types: [], skipLibCheck: false }, files: ["entry.ts", "sync.ts"] }));
    await run(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "-p", join(consumer, "tsconfig.json")]);
  }
  const rootBundle = await build({ absWorkingDir: consumer, entryPoints: ["entry.ts"], bundle: true, format: "esm", platform: "browser", write: false, metafile: true, logLevel: "silent" });
  const inputs = Object.keys(rootBundle.metafile.inputs).map(path => resolve(consumer, path));
  assert.ok(inputs.some(path => path.startsWith(`${installed}/dist/`)));
  assert.ok(inputs.every(path => path.startsWith(`${consumer}/`)), "The consumer bundle must not fall back to repository source.");
  assert.ok(inputs.every(path => !/\/layout\/wasm\/(?:embedded|bytes)\.js$/.test(path)), "An async-only root bundle must exclude the embedded layout payload modules.");
  const embeddedSource = await readFile(join(installed, "dist/lib/layout/wasm/bytes.js"), "utf8");
  const embeddedBytes = embeddedSource.match(/[A-Za-z0-9+/]{400,}={0,2}/u)?.[0] ?? "";
  assert.ok(embeddedBytes, "The sync entry must retain its generated embedded payload.");
  assert.doesNotMatch(rootBundle.outputFiles[0].text, new RegExp(embeddedBytes.slice(0, 256)), "An async-only installed bundle must exclude Base64 layout bytes.");
  const asyncBundle = await build({
    absWorkingDir: consumer,
    stdin: { resolveDir: consumer, loader: "ts", contents: `
      import { createElement, pibbl, Rectangle } from "@pibbl/core";
      const controller = await pibbl(document.querySelector("canvas"), createElement(Rectangle, { style: { width: 20, height: 20, fill: "#19375b" } }));
      globalThis.__PIBBL_LOADING_PROOF__.asyncMounted = true;
      controller.dispose();
    ` }, bundle: true, format: "esm", platform: "browser", write: false, logLevel: "silent" });
  const syncBundle = await build({
    absWorkingDir: consumer,
    stdin: { resolveDir: consumer, loader: "ts", contents: `
      import { createElement, Rectangle } from "@pibbl/core";
      import { pibblSync } from "@pibbl/core/sync";
      const controller = pibblSync(document.querySelector("canvas"), createElement(Rectangle, { style: { width: 20, height: 20, fill: "#19375b" } }));
      globalThis.__PIBBL_LOADING_PROOF__.syncMounted = true;
      controller.dispose();
    ` }, bundle: true, format: "esm", platform: "browser", write: false, logLevel: "silent" });
  const loadingBundle = await build({
    absWorkingDir: consumer,
    stdin: { resolveDir: consumer, loader: "ts", contents: `
      import { createElement, Flex, Layer, Rectangle, pibbl } from "@pibbl/core";
      const proof = globalThis.__PIBBL_LOADING_PROOF__;
      const canvas = document.querySelector("canvas") as HTMLCanvasElement;
      let renders = 0;
      function Root() {
        renders++;
        proof.renders = renders;
        return createElement(Flex, { style: { width: 40, height: 40, alignItems: "flex-start" }, children:
          createElement(Layer, { style: { width: 24, height: 24, minWidth: 0, flexShrink: 0 }, children:
            createElement(Rectangle, { onClick: () => proof.hits = (proof.hits ?? 0) + 1, style: { width: 24, height: 24, fill: "#19375b" } })
          })
        });
      }
      const waitForRetry = () => new Promise(resolve => { proof.retry = resolve; });
      const activate = async controller => {
        await new Promise(resolve => requestAnimationFrame(resolve));
        proof.mounted = true;
        proof.visible = canvas.getContext("2d").getImageData(5, 5, 1, 1).data[3] === 255;
        proof.dispose = () => { controller.dispose(); proof.disposed = true; };
      };
      if (proof.mode === "cancel") {
        const aborter = new AbortController();
        proof.abort = () => aborter.abort();
        try { await pibbl(canvas, createElement(Root, {}), { signal: aborter.signal }); }
        catch (error) { proof.cancelled = (error as { name?: string })?.name === "AbortError"; }
        proof.rendersBeforeRetry = renders;
        proof.retryReady = true;
        await waitForRetry();
        await activate(await pibbl(canvas, createElement(Root, {})));
      } else if (proof.mode === "failure") {
        try { await pibbl(canvas, createElement(Root, {})); }
        catch (error) { proof.failed = true; proof.failure = String(error); }
        proof.rendersBeforeRetry = renders;
        proof.retryReady = true;
        await waitForRetry();
        await activate(await pibbl(canvas, createElement(Root, {})));
      }
    ` }, bundle: true, format: "esm", platform: "browser", write: false, logLevel: "silent" });
  const wasm = await readFile(join(installed, "dist/lib/layout/wasm/layout.wasm"));
  const deploymentBase = "/nested/pibbl";
  let holdNextAsset = false;
  let failNextAsset = false;
  let releaseHeldAsset;
  let resolveHeldAsset;
  const heldAsset = new Promise(resolve => { resolveHeldAsset = resolve; });
  const server = createServer(async (request, response) => {
    if (!request.url?.startsWith(deploymentBase + "/")) { response.statusCode = 404; response.end(); return; }
    const route = request.url.slice(deploymentBase.length);
    if (route === "/layout.wasm") {
      response.setHeader("Cache-Control", "no-store");
      if (holdNextAsset) {
        holdNextAsset = false;
        resolveHeldAsset();
        await new Promise(resolve => { releaseHeldAsset = resolve; });
      }
      if (failNextAsset) { failNextAsset = false; response.statusCode = 503; response.end("temporarily unavailable"); return; }
      response.setHeader("Content-Type", "application/wasm"); response.end(wasm); return;
    }
    if (route === "/async.js") { response.setHeader("Content-Type", "text/javascript"); response.end(asyncBundle.outputFiles[0].text); return; }
    if (route === "/sync.js") { response.setHeader("Content-Type", "text/javascript"); response.end(syncBundle.outputFiles[0].text); return; }
    if (route === "/loading.js") { response.setHeader("Content-Type", "text/javascript"); response.end(loadingBundle.outputFiles[0].text); return; }
    const mode = route === "/cancel" ? "cancel" : route === "/failure" ? "failure" : undefined;
    const script = mode ? "/loading.js" : route === "/sync" ? "/sync.js" : "/async.js";
    response.setHeader("Content-Type", "text/html");
    response.end(`<!doctype html><canvas width="40" height="40"></canvas><script>globalThis.__PIBBL_LOADING_PROOF__={fetches:0,mode:${JSON.stringify(mode)}};const fetch0=fetch;globalThis.fetch=(...args)=>{globalThis.__PIBBL_LOADING_PROOF__.fetches++;return fetch0(...args)}</script><script type="module" src="${deploymentBase}${script}"></script>`);
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const browser = await chromium.launch({ headless: true });
  try {
    const base = `http://127.0.0.1:${server.address().port}${deploymentBase}`;
    const page = await browser.newPage();
    await page.goto(`${base}/`);
    await page.waitForFunction(() => globalThis.__PIBBL_LOADING_PROOF__.asyncMounted === true);
    assert.equal((await page.evaluate(() => globalThis.__PIBBL_LOADING_PROOF__.fetches)), 1, "Async mount must fetch its emitted external asset.");
    await page.goto(`${base}/sync`);
    await page.waitForFunction(() => globalThis.__PIBBL_LOADING_PROOF__.syncMounted === true);
    assert.equal((await page.evaluate(() => globalThis.__PIBBL_LOADING_PROOF__.fetches)), 0, "Sync mount must succeed offline without fetching.");

    const verifyRetriedRoot = async (candidate) => {
      await candidate.waitForFunction(() => globalThis.__PIBBL_LOADING_PROOF__.mounted === true);
      assert.deepEqual(await candidate.evaluate(() => ({ renders: globalThis.__PIBBL_LOADING_PROOF__.renders, visible: globalThis.__PIBBL_LOADING_PROOF__.visible })), { renders: 1, visible: true });
      await candidate.locator("canvas").click({ position: { x: 8, y: 8 } });
      assert.equal(await candidate.evaluate(() => globalThis.__PIBBL_LOADING_PROOF__.hits), 1, "Retried real Flex/Layer root must receive a visible Canvas click.");
      await candidate.evaluate(() => globalThis.__PIBBL_LOADING_PROOF__.dispose());
      await candidate.locator("canvas").click({ position: { x: 8, y: 8 } });
      assert.deepEqual(await candidate.evaluate(() => ({ hits: globalThis.__PIBBL_LOADING_PROOF__.hits, disposed: globalThis.__PIBBL_LOADING_PROOF__.disposed })), { hits: 1, disposed: true }, "Disposed retried root must leave no live target.");
    };

    holdNextAsset = true;
    const cancelled = await browser.newPage();
    const errors = [];
    cancelled.on("pageerror",error=>errors.push(error.message));
    await cancelled.goto(`${base}/cancel`, { waitUntil: "commit" });
    await heldAsset;
    await cancelled.evaluate(() => globalThis.__PIBBL_LOADING_PROOF__.abort());
    await cancelled.waitForFunction(() => globalThis.__PIBBL_LOADING_PROOF__.retryReady === true);
    assert.deepEqual(await cancelled.evaluate(() => ({ cancelled: globalThis.__PIBBL_LOADING_PROOF__.cancelled, renders: globalThis.__PIBBL_LOADING_PROOF__.rendersBeforeRetry })), { cancelled: true, renders: 0 }, "Aborted held external asset must not evaluate a real root.");
    releaseHeldAsset();
    await cancelled.evaluate(() => globalThis.__PIBBL_LOADING_PROOF__.retry());
    await verifyRetriedRoot(cancelled);
    await cancelled.close();

    failNextAsset = true;
    const failed = await browser.newPage();
    failed.on("pageerror",error=>errors.push(error.message));
    await failed.goto(`${base}/failure`, { waitUntil: "commit" });
    await failed.waitForFunction(() => globalThis.__PIBBL_LOADING_PROOF__.retryReady === true);
    assert.deepEqual(await failed.evaluate(() => ({ failed: globalThis.__PIBBL_LOADING_PROOF__.failed, renders: globalThis.__PIBBL_LOADING_PROOF__.rendersBeforeRetry, fetches: globalThis.__PIBBL_LOADING_PROOF__.fetches })), { failed: true, renders: 0, fetches: 1 }, "A 503 external asset must reject before evaluating a real root.");
    await failed.evaluate(() => globalThis.__PIBBL_LOADING_PROOF__.retry());
    await verifyRetriedRoot(failed);
    assert.equal(await failed.evaluate(() => globalThis.__PIBBL_LOADING_PROOF__.fetches), 2, "A fresh public call must retry after the first 503.");
    await failed.close();
    assert.deepEqual(errors, [], "Retried roots must render without browser errors.");
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
  process.stdout.write("Packed loading consumer: offline tarball, Bundler/NodeNext, nested-base external asset, real-root cancellation/503 retry/visible click/dispose, and async-only bundle isolation pass\n");
} finally {
  await rm(consumer, { recursive: true, force: true });
}
