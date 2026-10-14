// Coordinator-only fixtures for evaluating the actual public inspection API.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { applicationSource } from "./private-cases.mjs";
import { prepareTrial } from "./prepare.mjs";
export const decisionCases = [
  "decision-01",
  "decision-02",
  "decision-03",
  "decision-04",
];
export const decisionContract = `Additional behavior: F/focus narrows the line clip to 299 plot-local units wide, leaving only record a's anchor visible. Hover while focused must choose the nearest visible record anchor, so a remains selected even at root x=340. G/unfocus restores the full plot clip. R restores data, domain, full clip and hover. After Z/zoom followed by F/focus, no record anchor is inside the clip and hover must be null. Zoom must use the current domain for hover, not a mount-time mapping. Pointer x/y are root-logical; scale ranges here are plot-local. Inspection selection is not a routed event target. The application source may contain zero or one fault; leave correct behavior unchanged.`;
export function decisionSource(caseId) {
  if (!decisionCases.includes(caseId)) throw new Error("Unknown decision case");
  let s = applicationSource("case-04");
  const candidateExpression =
    caseId === "decision-02"
      ? "rows"
      : caseId === "decision-03"
        ? "rows.filter(row => currentScale.map(row.x) < 299)"
        : "rows.filter(row => { const x = currentScale.map(row.x); return x >= 0 && x < 299; })";
  s = s
    .replace("pibbl, signal", "pibbl, signal, useRef")
    .replace(
      "import { LinearScale",
      "import {useOptionalInspection} from './inspection-bridge.mjs';\nimport { LinearScale",
    );
  s = s.replace(
    "const hover = signal",
    "const focused = signal(false);\nconst hover = signal",
  );
  s = s.replace(
    "const x = useLinearScale('time').get();",
    `const currentScale = useLinearScale('time').get();\n  const mountScale = useRef(currentScale);\n  const x = ${caseId === "decision-01" ? "mountScale.current" : "currentScale"};`,
  );
  s = s.replace(
    "evaluated = rows.map",
    'const inspection=useOptionalInspection({data:rows,x:"x",y:"y"});\n  evaluated = rows.map',
  );
  s = s.replace(
    "path.rect(0, 0, 600, 240);",
    "path.rect(0, 0, focused.get() ? 299 : 600, 240);",
  );
  s = s.replace(
    "let nearest=rows[0]; for(const row of rows) if(Math.abs(row.x-time)<Math.abs(nearest.x-time)) nearest=row; hover.set(nearest.id);",
    `const candidates=focused.get() ? ${candidateExpression} : rows; let nearest=candidates[0]; for(const row of candidates) if(!nearest || Math.abs(row.x-time)<Math.abs(nearest.x-time)) nearest=row; hover.set(nearest?.id ?? null);`,
  );
  s = s.replace(
    "<LineSeries data={rows}",
    "<LineSeries inspection={inspection} data={rows}",
  );
  s = s.replace(
    "reset() { data.set(initial());",
    "focus() { focused.set(true); },\n  unfocus() { focused.set(false); },\n  reset() { focused.set(false); data.set(initial());",
  );
  s = s.replace("hover:hover.get()", "hover:hover.get(),focused:focused.get()");
  return s;
}
export async function prepareDecisionPair({ caseId, directory }) {
  await mkdir(directory, { recursive: false });
  const app = decisionSource(caseId);
  for (const arm of ["ordinary", "inspection"])
    await prepareTrial({
      caseId,
      arm,
      directory: resolve(directory, arm),
      application: app,
      contract: decisionContract,
    });
  const manifests = await Promise.all(
    ["ordinary", "inspection"].map(async (arm) =>
      JSON.parse(await readFile(resolve(directory, arm, "trial.json"), "utf8")),
    ),
  );
  assert.equal(manifests[0].initialSourceHash, manifests[1].initialSourceHash);
  assert.equal(manifests[0].runtimeHash, manifests[1].runtimeHash);
  await writeFile(resolve(directory, "initial-app.tsx"), app);
  await writeFile(
    resolve(directory, "pair.json"),
    JSON.stringify(
      {
        caseId,
        arms: ["ordinary", "inspection"],
        applicationSourceMatched: true,
        runtimeBytesMatched: true,
        coreSourceReceipts: manifests[0].runtimeSources,
      },
      null,
      2,
    ),
  );
  // Capsule keyboard controls and immutable task are prepared before integrity hashes.
  for (const arm of ["ordinary", "inspection"]) {
    const path = resolve(directory, arm, "boot.mjs");
    const code = await readFile(path, "utf8");
    await writeFile(
      path,
      code.replace(
        "r:actions.reset",
        "r:actions.reset,f:actions.focus,g:actions.unfocus",
      ),
    );
  }
}
export async function repairDecisionReference(directory, caseId) {
  const path = resolve(directory, "app.tsx");
  let s = await readFile(path, "utf8");
  if (caseId === "decision-01")
    s = s.replace("const x = mountScale.current;", "const x = currentScale;");
  if (caseId === "decision-02")
    s = s.replace(
      "const candidates=focused.get() ? rows : rows;",
      "const candidates=focused.get() ? rows.filter(row => { const x = currentScale.map(row.x); return x >= 0 && x < 299; }) : rows;",
    );
  if (caseId === "decision-03")
    s = s.replace(
      "const candidates=focused.get() ? rows.filter(row => currentScale.map(row.x) < 299) : rows;",
      "const candidates=focused.get() ? rows.filter(row => { const x = currentScale.map(row.x); return x >= 0 && x < 299; }) : rows;",
    );
  await writeFile(path, s);
}
