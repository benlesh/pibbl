// Coordinator-only: never copy this file or its case mapping into an agent trial.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
export const caseIds = ["case-01", "case-02", "case-03", "case-04"];
const correctUpdate =
  'data.set(data.get().map(row => row.id === "b" ? { ...row, y: 30 } : row));';
export function applicationSource(caseId) {
  if (!caseIds.includes(caseId)) throw new Error("Unknown case");
  const update =
    caseId === "case-01"
      ? "const rows = data.get(); rows[1].y = 30; data.set(rows);"
      : correctUpdate;
  const yDomain = caseId === "case-02" ? "[0, 80]" : "[0, 40]";
  const clip =
    caseId === "case-03"
      ? "path.rect(55, 90, 600, 240);"
      : "path.rect(0, 0, 600, 240);";
  return `import { Clip, Group, Overlay, Rectangle, pibbl, signal } from '@pibbl/core';
import { LinearScale, LineSeries, useLinearScale } from '@pibbl/core/viz';
const initial = () => [{id:'a',x:0,y:10},{id:'b',x:5,y:20},{id:'c',x:10,y:30}];
const data = signal(initial());
const domain = signal([0,10] as readonly [number,number]);
const hover = signal<string|null>(null);
let evaluated = initial();
function Plot() {
  const x = useLinearScale('time').get();
  const rows = data.get();
  evaluated = rows.map(row => ({...row}));
  const path = new Path2D(); ${clip}
  return <><Rectangle onPointerMove={event => { const time=x.invert(event.x-55); let nearest=rows[0]; for(const row of rows) if(Math.abs(row.x-time)<Math.abs(nearest.x-time)) nearest=row; hover.set(nearest.id); }} onPointerLeave={() => hover.set(null)} style={{width:600,height:240,fill:'white'}} /><Clip style={{d:path}}><LineSeries data={rows} x="x" y="y" xScale="time" yScale="value" pointerEvents="none" style={{stroke:'#2563eb',strokeWidth:4}} /></Clip></>;
}
function Scene() { return <><Rectangle pointerEvents="none" style={{width:710,height:420,fill:'#f4f7fb'}} /><Group style={{translateX:55,translateY:90}}><Overlay style={{width:600,height:240}}><LinearScale id="time" domain={domain} range="width" style={{width:'100%',height:'100%'}}><LinearScale id="value" domain={${yDomain}} range="height" reverse><Plot /></LinearScale></LinearScale></Overlay></Group></>; }
export function mount(canvas: HTMLCanvasElement) { return pibbl(canvas,<Scene />,{pixelRatio:1}); }
export const actions = {
  update() { ${update} },
  zoom() { domain.set([2.5,7.5]); },
  reset() { data.set(initial()); domain.set([0,10]); hover.set(null); },
};
export function getState() { return {source:data.get().map(row=>({...row})),evaluated:evaluated.map(row=>({...row})),domain:[...domain.get()],hover:hover.get()}; }
`;
}
export async function applyReferenceRepair(directory, caseId) {
  const path = resolve(directory, "app.tsx");
  let code = await readFile(path, "utf8");
  if (caseId === "case-01")
    code = code.replace(
      "const rows = data.get(); rows[1].y = 30; data.set(rows);",
      correctUpdate,
    );
  if (caseId === "case-02")
    code = code.replace("domain={[0, 80]}", "domain={[0, 40]}");
  if (caseId === "case-03")
    code = code.replace(
      "path.rect(55, 90, 600, 240);",
      "path.rect(0, 0, 600, 240);",
    );
  await writeFile(path, code);
}
