import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
const root = resolve(import.meta.dirname, ".."),
  require = createRequire(import.meta.url);
const temporary = mkdtempSync(join(tmpdir(), "pibbl-packed-recording-"));
const run = (command, args, cwd = root) =>
  execFileSync(command, args, { cwd, stdio: "pipe", encoding: "utf8" });
try {
  const archive = join(temporary, "core.tgz");
  run(
    "corepack",
    ["pnpm@11.21.0", "pack", "--out", archive],
    join(root, "packages/core"),
  );
  const installed = join(temporary, "node_modules/@pibbl/core");
  mkdirSync(installed, { recursive: true });
  run("tar", ["-xzf", archive, "--strip-components=1", "-C", installed]);
  writeFileSync(
    join(temporary, "package.json"),
    JSON.stringify({ type: "module", private: true }),
  );
  const runtime = await import(
    pathToFileURL(join(installed, "dist/index.mjs")).href
  );
  assert.equal(typeof runtime.recordFrames, "function");
  assert.equal(typeof runtime.exportGif, "function");
  const consumer = `import {recordFrames,exportGif,type PibblFrameRecordingOptions,type PibblFrameRecordingSession,type PibblFrameRecording,type PibblRecordedFrameInfo,type PibblRecordedFrame,type PibblGifExportOptions} from '@pibbl/core';
 const options:PibblFrameRecordingOptions={duration:1000,frameRate:60};
 const session:PibblFrameRecordingSession=recordFrames(document.createElement('canvas'),options);
 const recording:PibblFrameRecording=await session.finished;
 const metadata:readonly PibblRecordedFrameInfo[]=recording.frames;
 const frame:PibblRecordedFrame=await recording.readFrame(0);
 const gifOptions:PibblGifExportOptions={frameRate:25,width:320,height:225,maxColors:64,palette:["red","blue"],dithering:true,quantizationSampleFactor:1,paletteSampleCount:8192,signal:new AbortController().signal};
 const blob:Blob=await exportGif(recording,gifOptions);
 session.stop();session.cancel();recording.dispose();void [metadata,frame,blob];
 // @ts-expect-error There is no selector-driven export operation.
 exportGif(recording,{format:'zip'});
 `;
  writeFileSync(join(temporary, "consumer.ts"), consumer);
  const tsc = join(dirname(require.resolve("typescript")), "tsc.js");
  for (const resolution of ["Bundler", "NodeNext"]) {
    writeFileSync(
      join(temporary, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          module: resolution === "Bundler" ? "ESNext" : "NodeNext",
          moduleResolution: resolution,
          target: "ESNext",
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          types: [],
        },
        files: ["consumer.ts"],
      }),
    );
    run(process.execPath, [tsc, "-p", join(temporary, "tsconfig.json")]);
  }
  for (const [name, contents] of Object.entries({
    ordinary: "import {pibbl} from '@pibbl/core';globalThis.mount=pibbl;",
    recording:
      "import {recordFrames,exportGif} from '@pibbl/core';globalThis.capture=recordFrames;globalThis.encode=exportGif;",
  })) {
    const result = await build({
      stdin: { contents, resolveDir: temporary },
      bundle: true,
      format: "esm",
      splitting: true,
      outdir: join(temporary, name),
      write: false,
      metafile: true,
      minify: true,
      platform: "browser",
      logLevel: "silent",
    });
    const retained = Object.values(result.metafile.outputs).flatMap((output) =>
      Object.entries(output.inputs ?? {})
        .filter(([, info]) => info.bytesInOutput > 0)
        .map(([path]) => path),
    );
    if (name === "ordinary")
      assert.equal(
        retained.some((path) => path.includes("/recording/")),
        false,
        "An ordinary app retained recording or encoder code.",
      );
    else {
      assert.ok(retained.some((path) => path.includes("wasm-bytes")));
    }
  }
  const bytesSource = readFileSync(
    join(installed, "dist/lib/recording/wasm-bytes.js"),
    "utf8",
  );
  const encoded = bytesSource.match(/const bytes = "([^"]+)"/)[1];
  assert.ok(WebAssembly.validate(Buffer.from(encoded, "base64")));
  process.stdout.write(
    "Packed recording: runtime import inertness, Bundler/NodeNext types, inert encoder, and ordinary-app tree shaking passed.\n",
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
