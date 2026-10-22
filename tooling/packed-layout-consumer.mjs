// Local tarball only: never publishes or changes ordinary package exports.
import { strict as assert } from "node:assert";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import {
  mkdtemp,
  readFile,
  writeFile,
  lstat,
  realpath,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build } from "esbuild";
const root = fileURLToPath(new URL("../", import.meta.url));
const consumer = await realpath(
  await mkdtemp(join(tmpdir(), "pibbl-packed-layout-")),
);
const execute = promisify(execFile);
let server;
try {
  const packageRoot = join(root, "packages/core/.layout-wasm-package");
  const run = async (command, args, cwd = consumer) => {
    const result = await execute(command, args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    if (result.stderr) process.stderr.write(result.stderr);
    return result.stdout;
  };
  const packed = JSON.parse(
    await run(
      "npm",
      [
        "pack",
        "--json",
        "--ignore-scripts",
        "--cache",
        join(consumer, "cache"),
        "--pack-destination",
        consumer,
      ],
      packageRoot,
    ),
  )[0];
  const archive = join(consumer, packed.filename);
  const digest = createHash("sha256")
    .update(await readFile(archive))
    .digest("hex");
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  await run("npm", [
    "install",
    "--offline",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--cache",
    join(consumer, "cache"),
    archive,
  ]);
  const installed = join(consumer, "node_modules/@pibbl/core");
  assert.equal((await lstat(installed)).isSymbolicLink(), false);
  assert.equal(await realpath(installed), installed);
  const manifest = JSON.parse(
    await readFile(join(installed, "package.json"), "utf8"),
  );
  assert.equal(manifest.private, true);
  assert.equal(
    await readFile(join(installed, "THIRD_PARTY_NOTICES.txt"), "utf8"),
    await readFile(join(packageRoot, "THIRD_PARTY_NOTICES.txt"), "utf8"),
  );
  await writeFile(
    join(consumer, "example.tsx"),
    await readFile(
      join(
        root,
        "packages/scenarios/src/learning/layout/wasm-flex-nested-intrinsic.example.tsx",
      ),
      "utf8",
    ),
  );
  await writeFile(join(consumer, "margin-types.ts"), `
import { createElement, Rectangle, Flex, type FlexItemStyle } from '@pibbl/core';
const margin: FlexItemStyle = { margin: 5, marginTop: -2, marginRight: 3, marginBottom: 4, marginLeft: 6 };
export const rectangle = createElement(Rectangle, { style: { width: 20, height: 20, ...margin } });
export const reverseFlex = createElement(Flex, { style: { width: 100, height: 40, flexDirection: 'row-reverse', flexWrap: 'wrap-reverse' }, children: rectangle });
`);
  for (const resolution of ["Bundler", "NodeNext"]) {
    await writeFile(
      join(consumer, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          target: "ESNext",
          lib: ["ESNext", "DOM"],
          module: resolution === "Bundler" ? "ESNext" : "NodeNext",
          moduleResolution: resolution,
          jsx: "react-jsx",
          jsxImportSource: "@pibbl/core",
          types: [],
          skipLibCheck: false,
        },
        files: ["example.tsx", "margin-types.ts"],
      }),
    );
    await run(process.execPath, [
      join(root, "node_modules/typescript/bin/tsc"),
      "-p",
      join(consumer, "tsconfig.json"),
    ]);
  }
  await run(process.execPath, [
    "--input-type=module",
    "-e",
    `import { fileURLToPath } from 'node:url'; import { signal,isSignal,Flex } from '@pibbl/core'; import {jsx} from '@pibbl/core/jsx-runtime'; if(!isSignal(signal(1))||!jsx(Flex,{}))throw Error('identity'); if(!fileURLToPath(import.meta.resolve('@pibbl/core')).startsWith(${JSON.stringify(installed + "/")}))throw Error('source fallback');`,
  ]);
  await writeFile(
    join(consumer, "entry.ts"),
    `import { WasmFlexNestedIntrinsicExample } from './example';
import { createElement } from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
const receipt = globalThis.__PIBBL_PACKED_PROOF__;
if(receipt.modules || receipt.instances || receipt.frames) throw Error('Import-time work');
receipt.importInert = true;
globalThis.requestAnimationFrame = receipt.request;
const controller = pibblSync(document.querySelector('canvas')!, createElement(WasmFlexNestedIntrinsicExample, {}));
addEventListener('pagehide', () => controller.dispose(), {once:true});`,
  );
  const bundle = await build({
    absWorkingDir: consumer,
    entryPoints: ["entry.ts"],
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "esnext",
    jsx: "automatic",
    jsxImportSource: "@pibbl/core",
    write: false,
    metafile: true,
  });
  const inputs = Object.keys(bundle.metafile.inputs).map((path) =>
    resolve(consumer, path),
  );
  const coreInputs = inputs.filter((path) => path.includes("/@pibbl/core/"));
  assert.ok(coreInputs.length > 0);
  assert.ok(coreInputs.every((path) => path.startsWith(installed + "/dist/")));
  assert.ok(
    inputs.every((path) => path.startsWith(consumer + "/")),
    "No repository source/alias fallback",
  );
  const proof = {
    mode: "layout-wasm-packed",
    coreInputs,
    sha256: digest,
    tarball: packed.filename,
  };
  const instrument = `<script>globalThis.__PIBBL_BUILT_LAYOUT_PROOF__=${JSON.stringify(proof)}; const receipt=globalThis.__PIBBL_PACKED_PROOF__={modules:0,instances:0,frames:0,request:requestAnimationFrame.bind(globalThis)};const M=WebAssembly.Module,I=WebAssembly.Instance;WebAssembly.Module=class extends M{constructor(...args){super(...args);receipt.modules++}};WebAssembly.Instance=class extends I{constructor(...args){super(...args);receipt.instances++}};globalThis.requestAnimationFrame=(...args)=>{receipt.frames++;return receipt.request(...args)};</script>`;
  const child = `<!doctype html><style>body{margin:0;background:#f3f0e8}canvas{display:block;width:760px;height:460px;max-width:100%}</style><canvas width="760" height="460"></canvas>${instrument}<script type="module" src="/consumer.js"></script>`;
  const html = `<!doctype html><title>Pibbl packed WASM consumer</title><h1>Unpublished tarball consumer</h1><p>Installed offline from ${packed.filename}. Generic fonts only; no source aliases. SHA256 ${digest}</p><iframe style="width:900px;height:750px;border:0" srcdoc="${child.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"></iframe>`;
  server = createServer((request, response) => {
    if (request.url === "/consumer.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(bundle.outputFiles[0].text);
    } else {
      response.setHeader("Content-Type", "text/html");
      response.end(html);
    }
  });
  const checking = process.argv.includes("--check");
  await new Promise((ready, reject) => {
    server.once("error", reject);
    server.listen(checking ? 0 : 5189, "127.0.0.1", ready);
  });
  const address = `http://127.0.0.1:${server.address().port}`;
  console.warn(
    `Packed consumer: ${address}/ ; tarball SHA256 ${digest}; ${coreInputs.length} installed dist inputs; Bundler/NodeNext pass; no symlinks/aliases`,
  );
  if (process.argv.includes("--check")) {
    process.stdout.write(
      await run(process.execPath, [
        join(root, "tooling/test-wasm-nested-intrinsic.mjs"),
        address,
        "--packed",
        ...(process.argv.includes("--structural") ? ["--structural"] : []),
      ]),
    );
  } else {
    console.warn(`Keeping isolated consumer running at ${consumer}`);
    await new Promise((resolve) => {
      process.once("SIGINT", resolve);
      process.once("SIGTERM", resolve);
    });
  }
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await rm(consumer, { recursive: true, force: true });
}
