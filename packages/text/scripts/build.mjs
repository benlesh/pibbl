import {
  mkdir,
  readFile,
  writeFile,
  copyFile,
  rm,
  rename,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { root, cache, lock, run } from "./common.mjs";
import { ensureSetup } from "./setup.mjs";
import {
  withDirectoryLock,
  artifactHashes,
  verifyArtifacts,
} from "./lib/files.mjs";
await withDirectoryLock(resolve(cache, "tooling.lock"), async () => {
  await ensureSetup();
  const sdk = resolve(cache, `emsdk-${lock.emsdk.version}`);
  const upstream = resolve(cache, `harfbuzz-${lock.harfbuzz.version}`);
  const flags = [
    `-DCRC_TEXT_PROTOCOL=${lock.protocolVersion}`,
    "-O3",
    "-std=c++17",
    "-fexceptions",
    "-sDISABLE_EXCEPTION_CATCHING=0",
    "-sABORTING_MALLOC=0",
    "-DHB_NO_MT",
    "-DHB_NO_MMAP",
    "-sMODULARIZE=1",
    "-sEXPORT_ES6=1",
    "-sENVIRONMENT=web,node",
    "-sALLOW_MEMORY_GROWTH=1",
    "-sMAXIMUM_MEMORY=268435456",
    '-sEXPORTED_FUNCTIONS=["_malloc","_free"]',
    '-sEXPORTED_RUNTIME_METHODS=["HEAPU8"]',
  ];
  const digest = createHash("sha256")
    .update(await readFile(new URL(import.meta.url)))
    .update(JSON.stringify(lock))
    .update(JSON.stringify(flags))
    .update(await readFile(resolve(root, "native/crc-text.cpp")))
    .digest("hex");
  const native = resolve(cache, "native", digest);
  const files = ["engine.mjs", "engine.wasm", "browser/engine.mjs"];
  let cached = false;
  try {
    const hashes = JSON.parse(
      await readFile(resolve(native, "hashes.json"), "utf8"),
    );
    cached =
      files.every((file) => typeof hashes[file] === "string") &&
      (await verifyArtifacts(native, hashes));
  } catch {}
  if (process.argv.includes("--rebuild-native")) cached = false;
  if (!cached) {
    const staging = resolve(cache, "native-stage");
    await rm(staging, { recursive: true, force: true });
    await mkdir(resolve(staging, "browser"), { recursive: true });
    const compile = (environment, output) =>
      run(
        "python3",
        [
          resolve(sdk, "upstream/emscripten/em++.py"),
          resolve(upstream, "src/harfbuzz.cc"),
          resolve(root, "native/crc-text.cpp"),
          "-I" + resolve(upstream, "src"),
          ...flags.map((flag) =>
            flag.startsWith("-sENVIRONMENT=")
              ? `-sENVIRONMENT=${environment}`
              : flag,
          ),
          "-o",
          output,
        ],
        { env: { ...process.env, EM_CONFIG: resolve(sdk, ".emscripten") } },
      );
    compile("web,node", resolve(staging, "engine.mjs"));
    compile("web", resolve(staging, "browser/engine.mjs"));
    if (
      !(await readFile(resolve(staging, "engine.wasm"))).equals(
        await readFile(resolve(staging, "browser/engine.wasm")),
      )
    )
      throw new Error("Browser and Node loaders must share identical WASM.");
    await rm(resolve(staging, "browser/engine.wasm"));
    // Both loaders share one binary. Keep the browser fallback URL valid too,
    // so URL-aware bundlers can resolve every static asset reference.
    const browserLoaderPath = resolve(staging, "browser/engine.mjs");
    const browserLoader = await readFile(browserLoaderPath, "utf8");
    const fallback = 'new URL("engine.wasm",import.meta.url)';
    if (browserLoader.split(fallback).length !== 2)
      throw new Error("Unexpected Emscripten browser asset reference.");
    await writeFile(
      browserLoaderPath,
      browserLoader.replace(
        fallback,
        'new URL("../engine.wasm",import.meta.url)',
      ),
    );

    await writeFile(
      resolve(staging, "hashes.json"),
      JSON.stringify(await artifactHashes(staging, files), null, 2) + "\n",
    );
    await mkdir(resolve(cache, "native"), { recursive: true });
    await rm(native, { recursive: true, force: true });
    await rename(staging, native);
  }
  const output = resolve(cache, "build-stage");
  await rm(output, { recursive: true, force: true });
  await mkdir(resolve(output, "browser"), { recursive: true });
  for (const file of files)
    await copyFile(resolve(native, file), resolve(output, file));
  await copyFile(
    resolve(upstream, "COPYING"),
    resolve(output, "HARFBUZZ-LICENSE.txt"),
  );
  await copyFile(
    resolve(sdk, "upstream/emscripten/LICENSE"),
    resolve(output, "EMSCRIPTEN-LICENSE.txt"),
  );
  await copyFile(
    resolve(root, "../../LICENSE.txt"),
    resolve(output, "CRC-LICENSE.txt"),
  );
  const runtimeNotices = [
    [
      "HarfBuzz Microsoft USE shaping data",
      resolve(upstream, "src/ms-use/COPYING"),
    ],
    ...["libcxx", "libcxxabi", "libunwind", "compiler-rt", "llvm-libc"].map(
      (name) => [
        `Emscripten runtime: ${name}`,
        resolve(sdk, `upstream/emscripten/system/lib/${name}/LICENSE.TXT`),
      ],
    ),
    [
      "Emscripten runtime: musl",
      resolve(sdk, "upstream/emscripten/system/lib/libc/musl/COPYRIGHT"),
    ],
  ];
  const notices = await Promise.all(
    runtimeNotices.map(
      async ([name, path]) =>
        `===== ${name} =====\n\n${await readFile(path, "utf8")}`,
    ),
  );
  await writeFile(
    resolve(output, "THIRD-PARTY-NOTICES.txt"),
    notices.join("\n\n") + "\n",
  );

  await writeFile(
    resolve(output, "engine-browser.mjs"),
    `import initialize from './browser/engine.mjs';\nexport default function() {return initialize({locateFile:()=>new URL('./engine.wasm', import.meta.url).href});}\n`,
  );
  run("pnpm", [
    "exec",
    "tsc",
    "-p",
    resolve(root, "tsconfig.build.json"),
    "--outDir",
    output,
  ]);
  run("pnpm", [
    "exec",
    "esbuild",
    resolve(root, "src/index.ts"),
    resolve(root, "src/testing.ts"),
    "--splitting",
    "--bundle",
    "--format=esm",
    "--platform=neutral",
    "--target=esnext",
    "--external:@crc/core",
    "--external:../engine.mjs",
    "--out-extension:.js=.mjs",
    "--chunk-names=chunks/[name]-[hash]",
    "--outdir=" + output,
  ]);
  await writeFile(
    resolve(output, "build-info.json"),
    JSON.stringify(
      {
        protocolVersion: lock.protocolVersion,
        emscripten: lock.emsdk.version,
        harfbuzz: lock.harfbuzz.version,
        nativeKey: digest,
        flags,
        artifacts: await artifactHashes(output, files),
      },
      null,
      2,
    ) + "\n",
  );
  const destination = resolve(root, "dist"),
    previous = resolve(cache, "previous-dist");
  // Keep the previous usable output until all compilers have succeeded.
  await rm(previous, { recursive: true, force: true });
  let hadPrevious = false;
  try {
    await rename(destination, previous);
    hadPrevious = true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  try {
    await rename(output, destination);
  } catch (error) {
    if (hadPrevious) await rename(previous, destination);
    throw error;
  }
  await rm(previous, { recursive: true, force: true });
  process.stdout.write(
    `${cached ? "Reused verified native build." : "Built native HarfBuzz bridge."}\n`,
  );
});
