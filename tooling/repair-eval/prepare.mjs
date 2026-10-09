import { build } from "esbuild";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { applicationSource } from "./private-cases.mjs";
import { instrumentLineAttribution } from "../line-attribution/plugin.mjs";
const repository = resolve(import.meta.dirname, "../..");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const cache = new Map();
async function runtime(arm) {
  if (cache.has(arm)) return cache.get(arm);
  const entries = new Map(
    [
      ["@pibbl/core", "index.ts"],
      ["@pibbl/core/internal", "internal.ts"],
      ["@pibbl/core/viz/inspection", "features/viz/inspection.ts"],
      ["@pibbl/core/viz", "features/viz/index.ts"],
      ["@pibbl/core/jsx-runtime", "jsx-runtime.ts"],
      ["@pibbl/core/jsx-dev-runtime", "jsx-dev-runtime.ts"],
    ].map(([id, path]) => [id, resolve(repository, "packages/core/src", path)]),
  );
  const contents = `export * from ${JSON.stringify(entries.get("@pibbl/core"))}; export * from ${JSON.stringify(entries.get("@pibbl/core/viz"))}; export * from ${JSON.stringify(entries.get("@pibbl/core/viz/inspection"))}; export {jsx,jsxs} from ${JSON.stringify(entries.get("@pibbl/core/jsx-runtime"))}; ${arm === "attribution" ? `export {createLineAttributionInspector} from ${JSON.stringify(resolve(repository, "tooling/line-attribution/capture.ts"))};` : ""}`;
  const receipt = {};
  const result = await build({
    stdin: { contents, resolveDir: repository, loader: "ts" },
    bundle: true,
    format: "esm",
    platform: "browser",
    minify: true,
    write: false,
    metafile: true,
    jsx: "automatic",
    jsxImportSource: "@pibbl/core",
    plugins: [
      {
        name: "public-runtime",
        setup(b) {
          b.onResolve({ filter: /^@pibbl\/core(?:\/.*)?$/ }, (a) =>
            entries.has(a.path) ? { path: entries.get(a.path) } : undefined,
          );
        },
      },
      {
        name: "snapshot-source",
        setup(b) {
          b.onLoad({ filter: /\.(?:tsx?|m?js)$/ }, async ({ path }) => {
            const bytes = await readFile(path);
            receipt[relative(repository, path)] = hash(bytes);
            const original = bytes.toString("utf8");
            return {
              contents:
                arm === "attribution"
                  ? (instrumentLineAttribution(original, path, repository) ??
                    original)
                  : original,
              loader: path.endsWith(".tsx")
                ? "tsx"
                : path.endsWith(".ts")
                  ? "ts"
                  : "js",
            };
          });
        },
      },
    ],
    logLevel: "silent",
  });
  const value = { bytes: result.outputFiles[0].contents, receipt };
  cache.set(arm, value);
  return value;
}
export async function prepareTrial({
  caseId,
  arm,
  directory,
  application,
  contract,
}) {
  if (!["ordinary", "attribution", "inspection"].includes(arm))
    throw new Error("Arm must be ordinary, attribution, or inspection");
  const app = application ?? applicationSource(caseId);
  directory = resolve(directory);
  await mkdir(directory, { recursive: false });
  const compiled = await runtime(arm);
  await writeFile(resolve(directory, "runtime.mjs"), compiled.bytes);
  await writeFile(resolve(directory, "app.tsx"), app);
  const require = createRequire(import.meta.url),
    esbuildUrl = pathToFileURL(require.resolve("esbuild")).href;
  await writeFile(
    resolve(directory, "serve.mjs"),
    `import {createServer} from 'node:http'; import {readFile} from 'node:fs/promises'; import {build} from ${JSON.stringify(esbuildUrl)};
const server=createServer(async(req,res)=>{ try { const url=new URL(req.url,'http://localhost'); if(url.pathname==='/app.js'){ const r=await build({entryPoints:[new URL('./app.tsx',import.meta.url).pathname],bundle:true,format:'esm',write:false,jsx:'automatic',jsxImportSource:'@pibbl/core',plugins:[{name:'runtime',setup(b){b.onResolve({filter:/^@pibbl\\/core(?:\\/.*)?$/},()=>({path:'/runtime.mjs',external:true}));}}]});res.setHeader('Content-Type','text/javascript');res.end(r.outputFiles[0].contents);return; } const file={'/':'index.html','/runtime.mjs':'runtime.mjs','/boot.mjs':'boot.mjs'}[url.pathname];if(!file){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('html')?'text/html':'text/javascript');res.end(await readFile(new URL(file,import.meta.url))); } catch(e){res.writeHead(500);res.end(String(e));} });
server.listen(Number(process.argv[2]??0),'127.0.0.1',()=>process.stdout.write(JSON.stringify({port:server.address().port})+'\\n')); process.on('SIGTERM',()=>server.close(()=>process.exit()));
`,
  );
  await writeFile(
    resolve(directory, "index.html"),
    `<!doctype html><meta charset="utf-8"><title>Sensor readings</title><style>body{margin:24px;font:14px system-ui}canvas{display:block;width:710px;height:420px}pre{white-space:pre-wrap}button{padding:8px;margin:8px}</style><h1>Sensor readings</h1><p>Three readings. U updates the middle reading, Z zooms, R resets.</p><nav></nav><canvas width="710" height="420"></canvas><pre></pre><script type="module" src="/boot.mjs"></script>`,
  );
  await writeFile(
    resolve(directory, "boot.mjs"),
    `import * as runtime from './runtime.mjs'; import {mount,actions,getState} from './app.js';
const canvas=document.querySelector('canvas'); const inspector=${arm === "attribution" ? "runtime.createLineAttributionInspector(canvas)" : "null"};const app=mount(canvas);
window.applicationState=getState; window.inspectionCalls=[];
${arm === "attribution" ? `window.inspectPlot=point=>{const result={snapshot:inspector.snapshot(),query:inspector.segmentAt(point)};window.inspectionCalls.push({at:performance.now(),point,result});return result;};` : ""}
for(const [name,invoke]of Object.entries(actions)){const b=document.createElement('button');b.textContent=name;b.onclick=invoke;document.querySelector('nav').append(b);}window.addEventListener('keydown',e=>({u:actions.update,z:actions.zoom,r:actions.reset})[e.key]?.());
canvas.addEventListener('pointermove',()=>{document.querySelector('pre').textContent=JSON.stringify(getState(),null,2);});window.addEventListener('pagehide',()=>{inspector?.dispose();app.dispose();});
`,
  );
  await writeFile(
    resolve(directory, "inspection-bridge.mjs"),
    arm === "inspection"
      ? `import {useNumericInspection,nearestRecordedX,anchorInsideClips} from '@pibbl/core/viz/inspection';
export function useOptionalInspection(series){const ref=useNumericInspection(series);window.inspectPlot=point=>{const r=ref.rendered();if(!r)return {available:false};const domainX=r.domainXAtRoot(point);const serialize=h=>h?{id:h.datum.id,sourceIndex:h.sourceIndex,domainX:h.domainX,domainY:h.domainY,anchorLocal:{...h.anchorLocal},anchorRoot:{...h.anchorRoot}}:null;const result={available:true,evidence:'last-successful-render; source datum identity is live; anchors/values captured; geometric not pixels or event target',domainX,observations:r.observations.map(h=>({...serialize(h),insideClips:r.anchorInsideClips(h.anchorLocal)})),nearest:serialize(nearestRecordedX(r,{domainX})),visible:serialize(nearestRecordedX(r,{domainX,filter:anchorInsideClips}))};window.inspectionCalls.push({point,result});return result;};return ref;}`
      : "export function useOptionalInspection(){return undefined;}",
  );
  if (arm === "inspection")
    await writeFile(
      resolve(directory, "inspection-api.md"),
      await readFile(
        resolve(
          repository,
          "docs/site/api/functions/rendered-series-inspection.md",
        ),
      ),
    );
  await writeFile(
    resolve(directory, "TASK.md"),
    `Validate this Pibbl application against the intended behavior and repair any mismatch. If it already meets the contract, leave app.tsx unchanged and explain your evidence. Work only in app.tsx. Preserve the supported public API and the intended behavior below; do not change the runtime, harness, server or task. You may inspect application source and use the browser freely. This is an API research exercise, not a speed contest.

The 710×420 logical Canvas contains a plot at (55,90), size 600×240. The initial x domain is [0,10], y domain [0,40], with y increasing upward. The line joins records a=(0,10), b=(5,20), c=(10,30). Clip exactly to the plot rectangle. U/update must publish b.y=30 and paint the new line without another interaction. Z/zoom changes x domain to [2.5,7.5]. R/reset restores initial data/domain. Hover reports the nearest record's stable ID by x. Decorative line paint must not intercept the plot input.

${contract ?? ""}\n\nRun: node serve.mjs 5210, then open http://127.0.0.1:5210. Reload after edits; the server rebuilds app.tsx. window.applicationState() is cooperating application evidence, not a pixel oracle. ${arm === "attribution" ? "Development attribution is available via window.inspectPlot({x,y}) using root logical coordinates. Its captured values/scales/clips and generation are geometric evidence; original source references are live." : arm === "inspection" ? "Public @pibbl/core/viz/inspection is enabled through inspection-bridge.mjs. window.inspectPlot({x,y}) synchronously serializes captured observations, root-to-domain conversion, and nearest/clip-filtered queries from useNumericInspection. Read inspection-api.md for its public contract. You may use the public inspection API in your repair. Source datum references are live; numeric values and anchors are captured. This is geometry, not a pixel or event-target oracle." : "Use normal application and browser evidence. In the ordinary condition do not import or enable @pibbl/core/viz/inspection; that is the capability being compared."}

Independent rendering evidence: distinguish published source values, evaluated component values, captured render geometry, and actual pixels. Corroborate painted-result claims with independent Canvas pixel observations; use native pointer input for interaction identity. Geometric segment coverage is not a pixel or routed-target oracle. Derive expectations from the declared contract rather than the scale/query implementation. State which evidence you did not obtain. Pointer event x/y is root-logical, including inside translated groups. Inspect the supplied scale range before converting event coordinates; the chart's scale range is plot-local. Attribution query points are also root-logical.\n\nThis capsule is intentionally not a Git checkout; use ordinary file comparisons for source changes.\n\nFinish with a concise diagnosis, repair description, actual verification performed, and remaining uncertainty. Save observations.json with elapsedMinutes, browserQueries, editIterations, evidenceUsed, confusingAPIs, missingCapabilities, unsupportedConclusions, and model/settings if known. Do not infer missing measurements.

Blinding protocol: do not read evaluator files, another trial, repository history, or previous conversations about these fixtures. If exposed to an answer key, report contamination and stop this trial. This restriction is procedural, not a filesystem security boundary.
`,
  );
  await writeFile(
    resolve(directory, "trial.json"),
    JSON.stringify(
      {
        schema: "pibbl-repair-trial/1",
        caseId,
        arm,
        created: new Date().toISOString(),
        initialSourceHash: hash(app),
        runtimeHash: hash(compiled.bytes),
        runtimeSources: compiled.receipt,
      },
      null,
      2,
    ),
  );
  return directory;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (process.argv.length !== 5)
    throw new Error(
      "Usage: node prepare.mjs CASE_ID ordinary|attribution NEW_DIRECTORY",
    );
  process.stdout.write(
    (await prepareTrial({
      caseId: process.argv[2],
      arm: process.argv[3],
      directory: process.argv[4],
    })) + "\n",
  );
}
