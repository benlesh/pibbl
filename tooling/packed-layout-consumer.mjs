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
const nestedPercentFixtures = JSON.parse(await readFile(new URL('./layout-yoga-rehearsal/reference.json', import.meta.url), 'utf8')).cases.filter(value => value.nestedBoxes);
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
import { createElement, Rectangle, Flex, type FlexItemStyle, type BoxStyle } from '@pibbl/core';
const box: BoxStyle = { boxSizing: 'border-box', width: '50%', height: 30, padding: {left: '10%', top: '5%', right: 4, bottom: 0}, borderWidth: { left: 2, right: 4 } };
export const sized = createElement(Rectangle, { style: { ...box, width: 100, height: 30 } });
// @ts-expect-error Box sizing is a closed policy, not arbitrary CSS.
const invalidBox: BoxStyle = { boxSizing: 'padding-box' };
// @ts-expect-error Percentage layout borders remain unsupported.
const invalidBorder: BoxStyle = { borderWidth: '10%' };
const margin: FlexItemStyle = { aspectRatio: 3, alignSelf: 'start', margin: 5, marginTop: '-2%', marginRight: '3%', marginBottom: '4%', marginLeft: '6%' };
export const rectangle = createElement(Rectangle, { style: { width: 20, height: 20, ...margin } });
// @ts-expect-error Gap strings are percentages, not CSS pixel lengths.
export const invalidGap = createElement(Flex, { style: { gap: '10px' }, children: rectangle });
export const reverseFlex = createElement(Flex, { style: { width: 100, height: 40, gap: '10%', rowGap: '20%', columnGap: 5, flexDirection: 'row-reverse', flexWrap: 'wrap-reverse', justifyContent: 'start', alignItems: 'end', alignContent: 'start' }, children: rectangle });
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
    `import { fileURLToPath } from 'node:url'; import { signal,isSignal,Flex,resolveBox } from '@pibbl/core'; import {jsx} from '@pibbl/core/jsx-runtime'; if(!isSignal(signal(1))||!jsx(Flex,{}))throw Error('identity'); const b=resolveBox({boxSizing:'border-box',width:100,height:30,padding:10,borderWidth:2},{minWidth:0,maxWidth:200,minHeight:0,maxHeight:100});if(b.borderBox.width!==100||b.contentBox.width!==76||b.contentBox.height!==6)throw Error('box sizing'); if(!fileURLToPath(import.meta.resolve('@pibbl/core')).startsWith(${JSON.stringify(installed + "/")}))throw Error('source fallback');`,
  ]);
  await writeFile(
    join(consumer, "entry.ts"),
    `import { WasmFlexNestedIntrinsicExample } from './example';
import { createElement, Absolute, Flex, Rectangle, Text, signal } from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
const receipt = globalThis.__PIBBL_PACKED_PROOF__;
if(receipt.modules || receipt.instances || receipt.frames) throw Error('Import-time work');
receipt.importInert = true;
globalThis.requestAnimationFrame = receipt.request;
const aspectCanvas = document.createElement('canvas'); aspectCanvas.width=120; aspectCanvas.height=140; aspectCanvas.style.cssText='width:120px;height:140px'; document.body.append(aspectCanvas);
receipt.textCrossHits=0;
const aspectController=pibblSync(aspectCanvas,createElement(Absolute,{style:{width:120,height:140},children:[
createElement(Flex,{style:{width:100,height:35},children:createElement(Rectangle,{style:{width:90,height:50,minWidth:0,flexShrink:0,aspectRatio:3,fill:'red'}})}),
createElement(Flex,{style:{left:0,top:40,width:112,height:20,gap:12,flexDirection:'row-reverse',justifyContent:'start'},children:[createElement(Rectangle,{style:{width:20,height:10,flexBasis:20,flexGrow:.25,flexShrink:0,minWidth:0,maxWidth:10,fill:'red'}}),createElement(Rectangle,{style:{width:20,height:10,flexBasis:20,flexGrow:.25,flexShrink:0,minWidth:0,fill:'red'}})]}),
createElement(Flex,{style:{left:0,top:60,width:100,height:5,gap:12,justifyContent:'space-around'},children:[0,1].map(()=>createElement(Rectangle,{style:{width:80,height:5,minWidth:0,flexShrink:0,fill:'red'}}))}),
createElement(Flex,{style:{left:0,top:80,width:120,height:40,flexDirection:'column',alignItems:'center',gap:4},children:[createElement(Text,{children:'Measured',style:{width:60,minWidth:0,minHeight:0,flexShrink:0,font:'10px monospace',lineHeight:10,fill:'red'}}),createElement(Rectangle,{onClick:()=>receipt.textCrossHits++,style:{width:20,height:10,minWidth:0,minHeight:0,flexShrink:0,fill:'blue'}})]})
]}));
try { await new Promise(resolve => requestAnimationFrame(resolve)); const context=aspectCanvas.getContext('2d')!; if(context.getImageData(85,25,1,1).data[3]!==255||context.getImageData(85,35,1,1).data[3]!==0)throw Error('installed aspect ratio geometry '+JSON.stringify({width:aspectCanvas.width,height:aspectCanvas.height,inside:[...context.getImageData(85,25,1,1).data],outside:[...context.getImageData(85,35,1,1).data]})); receipt.aspectRatio=true; if(context.getImageData(58,45,1,1).data[3]!==255||context.getImageData(62,45,1,1).data[3]!==0)throw Error('installed initially frozen partial allocation'); receipt.frozenPartial=true; if(context.getImageData(1,61,1,1).data[3]!==255||context.getImageData(84,61,1,1).data[3]!==0||context.getImageData(95,61,1,1).data[3]!==255)throw Error('installed safe overflow fallback');receipt.safeOverflow=true;const bounds=aspectCanvas.getBoundingClientRect();for(const x of [2,52])for(const type of ['mousedown','mouseup','click'])aspectCanvas.dispatchEvent(new MouseEvent(type,{clientX:bounds.left+x,clientY:bounds.top+96,bubbles:true,button:0}));if(receipt.textCrossHits!==1)throw Error('installed measured auto-cross target '+receipt.textCrossHits); } finally { aspectController.dispose(); aspectCanvas.remove(); }
const boundCanvas=document.createElement('canvas');boundCanvas.width=240;boundCanvas.height=60;boundCanvas.style.cssText='width:240px;height:60px';document.body.append(boundCanvas);
const ownerMain=signal(200);let boundHits=0;
const boundController=pibblSync(boundCanvas,createElement(Flex,{style:{width:ownerMain,height:40,gap:12,alignItems:'flex-start'},children:[createElement(Rectangle,{style:{width:40,height:10,flexBasis:40,flexGrow:1,flexShrink:0,minWidth:0,maxWidth:'25%',fill:'red'}}),createElement(Rectangle,{onClick:()=>boundHits++,style:{width:40,height:10,flexBasis:40,flexGrow:1,flexShrink:0,minWidth:0,fill:'blue'}})]}));
try {const clickBound=(x:number)=>{const rect=boundCanvas.getBoundingClientRect();for(const type of ['mousedown','mouseup','click'])boundCanvas.dispatchEvent(new MouseEvent(type,{clientX:rect.left+x,clientY:rect.top+5,bubbles:true,button:0}));};await new Promise(resolve=>requestAnimationFrame(resolve));const context=boundCanvas.getContext('2d')!;if(context.getImageData(65,5,1,1).data[2]!==255)throw Error('installed percent initial cap');clickBound(65);ownerMain.set(240);await new Promise(resolve=>requestAnimationFrame(resolve));if(context.getImageData(65,5,1,1).data[3]!==0||context.getImageData(75,5,1,1).data[2]!==255)throw Error('installed percent resized cap');clickBound(65);clickBound(75);if(boundHits!==2)throw Error('installed percentage moved target '+boundHits);receipt.percentageBounds=true;}finally{boundController.dispose();boundCanvas.remove();}
const wrapCanvas=document.createElement('canvas');wrapCanvas.width=200;wrapCanvas.height=200;wrapCanvas.style.cssText='width:200px;height:200px';document.body.append(wrapCanvas);
const wrapWidth=signal(200);let wrapHits=0;
const wrapController=pibblSync(wrapCanvas,createElement(Flex,{style:{width:wrapWidth,height:200,flexWrap:'wrap',columnGap:12,rowGap:10,alignItems:'flex-start',alignContent:'flex-start'},children:[0,1,2].map(index=>createElement(Rectangle,{onClick:()=>{if(index===2)wrapHits++;},style:{width:80,height:'auto',flexBasis:80,flexGrow:1,flexShrink:0,minWidth:0,minHeight:0,aspectRatio:2,fill:'blue'}}))}));
try{const clickWrap=(y:number)=>{const rect=wrapCanvas.getBoundingClientRect();for(const type of ['mousedown','mouseup','click'])wrapCanvas.dispatchEvent(new MouseEvent(type,{clientX:rect.left+5,clientY:rect.top+y,bubbles:true,button:0}));};await new Promise(resolve=>requestAnimationFrame(resolve));const context=wrapCanvas.getContext('2d')!;if(context.getImageData(5,145,1,1).data[2]!==255)throw Error('installed wrapped ratio initial box');clickWrap(145);wrapWidth.set(172);await new Promise(resolve=>requestAnimationFrame(resolve));if(context.getImageData(5,145,1,1).data[3]!==0||context.getImageData(5,54,1,1).data[2]!==255)throw Error('installed wrapped ratio resized box');clickWrap(145);clickWrap(54);if(wrapHits!==2)throw Error('installed wrapped ratio moved target '+wrapHits);receipt.wrappedAspectRatio=true;}finally{wrapController.dispose();wrapCanvas.remove();}
const gapCanvas=document.createElement('canvas');gapCanvas.width=400;gapCanvas.height=300;gapCanvas.style.cssText='width:400px;height:300px';document.body.append(gapCanvas);
const gapWidth=signal(300),gapHeight=signal(200);let gapHits=0;
const gapController=pibblSync(gapCanvas,createElement(Flex,{style:{boxSizing:'border-box',width:gapWidth,height:gapHeight,padding:{left:10,right:30,top:20,bottom:40},columnGap:'10%',rowGap:'20%',alignItems:'flex-start'},children:[0,1].map(index=>createElement(Rectangle,{onClick:()=>{if(index===1)gapHits++;},style:{width:100,height:30,flexBasis:100,flexGrow:1,flexShrink:0,minWidth:0,fill:index?'blue':'red'}}))}));
try{const clickGap=(x:number)=>{const rect=gapCanvas.getBoundingClientRect();for(const type of ['mousedown','mouseup','click'])gapCanvas.dispatchEvent(new MouseEvent(type,{clientX:rect.left+x,clientY:rect.top+25,bubbles:true,button:0}));};await new Promise(resolve=>requestAnimationFrame(resolve));const context=gapCanvas.getContext('2d')!;if(context.getImageData(157,25,1,1).data[2]!==255)throw Error('installed percentage gap content reference');clickGap(157);gapWidth.set(360);gapHeight.set(250);await new Promise(resolve=>requestAnimationFrame(resolve));if(context.getImageData(157,25,1,1).data[3]!==0||context.getImageData(190,25,1,1).data[2]!==255)throw Error('installed resized percentage gap');clickGap(157);clickGap(190);if(gapHits!==2)throw Error('installed percentage gap target '+gapHits);receipt.percentageGaps=true;}finally{gapController.dispose();gapCanvas.remove();}
const paddingCanvas=document.createElement('canvas');paddingCanvas.width=320;paddingCanvas.height=180;paddingCanvas.style.cssText='width:320px;height:180px';document.body.append(paddingCanvas);
const paddingOwner=signal(200);let paddingHits=0;
const paddingController=pibblSync(paddingCanvas,createElement(Flex,{style:{width:paddingOwner,height:180,alignItems:'flex-start'},children:createElement(Flex,{style:{boxSizing:'border-box',width:150,height:100,flexBasis:150,flexShrink:0,minWidth:0,padding:{left:'10%',right:'15%',top:'5%',bottom:'10%'}},children:createElement(Rectangle,{style:{width:'100%',height:'100%',minWidth:0,flexShrink:0,fill:'blue'},onClick:()=>paddingHits++})})}));
try{const clickPadding=(x:number,y:number)=>{const rect=paddingCanvas.getBoundingClientRect();for(const type of ['mousedown','mouseup','click'])paddingCanvas.dispatchEvent(new MouseEvent(type,{clientX:rect.left+x,clientY:rect.top+y,bubbles:true,button:0}));};await new Promise(resolve=>requestAnimationFrame(resolve));const context=paddingCanvas.getContext('2d')!;if(context.getImageData(22,12,1,1).data[2]!==255)throw Error('installed percentage padding initial content');clickPadding(22,12);paddingOwner.set(300);await new Promise(resolve=>requestAnimationFrame(resolve));if(context.getImageData(22,12,1,1).data[3]!==0||context.getImageData(115,20,1,1).data[3]!==0||context.getImageData(35,20,1,1).data[2]!==255)throw Error('installed percentage padding resized content');clickPadding(22,12);clickPadding(35,20);if(paddingHits!==2)throw Error('installed percentage padding moved target '+paddingHits);receipt.percentagePadding=true;}finally{paddingController.dispose();paddingCanvas.remove();}
const crossCanvas=document.createElement('canvas');crossCanvas.width=180;crossCanvas.height=220;crossCanvas.style.cssText='width:180px;height:220px';document.body.append(crossCanvas);
const crossOwner=signal(100);let crossHits=0;
const crossController=pibblSync(crossCanvas,createElement(Flex,{style:{width:crossOwner,height:200,flexDirection:'column',flexWrap:'wrap',gap:12,alignItems:'stretch',alignContent:'flex-start'},children:[createElement(Rectangle,{style:{width:'auto',height:80,flexBasis:80,flexShrink:0,minHeight:0,minWidth:'60%',fill:'red'}}),createElement(Rectangle,{style:{width:40,height:80,flexBasis:80,flexShrink:0,minWidth:0,minHeight:0,fill:'green'}}),createElement(Rectangle,{style:{width:20,height:80,flexBasis:80,flexShrink:0,minWidth:0,minHeight:0,fill:'blue'},onClick:()=>crossHits++})]}));
try{const clickCross=(x:number)=>{const rect=crossCanvas.getBoundingClientRect();for(const type of ['mousedown','mouseup','click'])crossCanvas.dispatchEvent(new MouseEvent(type,{clientX:rect.left+x,clientY:rect.top+5,bubbles:true,button:0}));};await new Promise(resolve=>requestAnimationFrame(resolve));const context=crossCanvas.getContext('2d')!;if(context.getImageData(76,5,1,1).data[2]!==255)throw Error('installed wrapped cross initial line');clickCross(76);crossOwner.set(160);await new Promise(resolve=>requestAnimationFrame(resolve));if(context.getImageData(76,5,1,1).data[0]!==255||context.getImageData(112,5,1,1).data[2]!==255)throw Error('installed wrapped cross resized line');clickCross(76);clickCross(112);if(crossHits!==2)throw Error('installed wrapped cross moved target '+crossHits);receipt.wrappedCrossBounds=true;}finally{crossController.dispose();crossCanvas.remove();}
const textWrapCanvas=document.createElement('canvas');textWrapCanvas.width=200;textWrapCanvas.height=100;textWrapCanvas.style.cssText='width:200px;height:100px';document.body.append(textWrapCanvas);
const textWrapContent=signal('aaaa'),textWrapFill=signal('black'),textWrapHeight=signal(60);let textWrapHits=0;
const textWrapController=pibblSync(textWrapCanvas,createElement(Flex,{style:{width:180,height:textWrapHeight,flexDirection:'column',flexWrap:'wrap',gap:10,alignItems:'flex-start',alignContent:'flex-start'},children:[createElement(Text,{pointerEvents:'none',children:textWrapContent,style:{width:50,wrap:true,font:'10px monospace',lineHeight:10,minHeight:0,flexGrow:0,flexShrink:0,fill:textWrapFill}}),createElement(Rectangle,{style:{width:40,height:30,flexBasis:30,minHeight:0,flexShrink:0,fill:'blue'},onClick:()=>textWrapHits++})]}));
try{const clickTextWrap=(x:number,y:number)=>{const rect=textWrapCanvas.getBoundingClientRect();for(const type of ['mousedown','mouseup','click'])textWrapCanvas.dispatchEvent(new MouseEvent(type,{clientX:rect.left+x,clientY:rect.top+y,bubbles:true,button:0}));};const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));await frame();const context=textWrapCanvas.getContext('2d')!;if(context.getImageData(5,25,1,1).data[2]!==255)throw Error('installed measured column initial target');clickTextWrap(5,25);textWrapContent.set('aaaa aaaa aaaa');await frame();if(context.getImageData(5,25,1,1).data[3]!==0||context.getImageData(65,5,1,1).data[2]!==255)throw Error('installed measured column moved target');clickTextWrap(5,25);clickTextWrap(65,5);if(textWrapHits!==2)throw Error('installed measured column target count');const before=(globalThis as any).__PIBBL_LAYOUT_DIAGNOSTICS__();textWrapFill.set('red');await frame();const painted=(globalThis as any).__PIBBL_LAYOUT_DIAGNOSTICS__();for(const key of ['measuredLeaves','solves','lineFormations','nodeCreates'])if(painted[key]!==before[key])throw Error('installed measured column paint cache '+key);textWrapHeight.set(80);await frame();if((globalThis as any).__PIBBL_LAYOUT_DIAGNOSTICS__().measuredLeaves!==painted.measuredLeaves||context.getImageData(5,45,1,1).data[2]!==255)throw Error('installed measured column owner resize');clickTextWrap(5,45);if(textWrapHits!==3)throw Error('installed measured column resized hit');receipt.measuredColumnWrapText=true;}finally{textWrapController.dispose();textWrapCanvas.remove();}
const marginCanvas=document.createElement('canvas');marginCanvas.width=400;marginCanvas.height=260;marginCanvas.style.cssText='width:400px;height:260px';document.body.append(marginCanvas);
const marginOwner=signal(300),marginInk=signal('red');let marginHits=0;
const marginController=pibblSync(marginCanvas,createElement(Flex,{style:{width:marginOwner,height:200,boxSizing:'border-box',padding:{left:10,right:30,top:20,bottom:40},alignItems:'flex-start'},children:[createElement(Rectangle,{style:{width:60,height:30,minWidth:0,minHeight:0,flexShrink:0,marginLeft:'10%',marginRight:'15%',marginTop:'5%',marginBottom:'20%',fill:marginInk}}),createElement(Rectangle,{style:{width:136,height:81,minWidth:0,minHeight:0,flexShrink:0,fill:'blue'},onClick:()=>marginHits++})]}));
try{const clickMargin=(x:number)=>{const rect=marginCanvas.getBoundingClientRect();for(const type of ['mousedown','mouseup','click'])marginCanvas.dispatchEvent(new MouseEvent(type,{clientX:rect.left+x,clientY:rect.top+21,bubbles:true,button:0}));};const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));await frame();const context=marginCanvas.getContext('2d')!;if(context.getImageData(136,21,1,1).data[2]!==255)throw Error('installed percentage margin initial');clickMargin(136);const before=(globalThis as any).__PIBBL_LAYOUT_DIAGNOSTICS__();marginInk.set('green');await frame();if((globalThis as any).__PIBBL_LAYOUT_DIAGNOSTICS__().solves!==before.solves)throw Error('installed percentage margin paint solve');marginOwner.set(360);await frame();if(context.getImageData(136,21,1,1).data[3]!==0||context.getImageData(151,21,1,1).data[2]!==255)throw Error('installed percentage margin resized');clickMargin(136);clickMargin(151);if(marginHits!==2)throw Error('installed percentage margin target');receipt.percentageMargins=true;}finally{marginController.dispose();marginCanvas.remove();}
const nestedPercentCases = ${JSON.stringify(nestedPercentFixtures)};
for(let pair=0;pair<nestedPercentCases.length;pair+=2){
 const first=nestedPercentCases[pair],column=first.flexDirection==='column',wrapped=first.flexWrap==='wrap';
 const nestedCanvas=document.createElement('canvas');nestedCanvas.width=400;nestedCanvas.height=400;nestedCanvas.style.cssText='width:400px;height:400px';document.body.append(nestedCanvas);
 const nestedWidth=signal(first.width),nestedHeight=signal(first.height),nestedInk=signal('green');let nestedHits=0;
 const nestedLeaf=(second:boolean)=>createElement(Rectangle,{key:second?'second':'first',style:{width:column?'100%':'40%',height:column?'40%':'100%',flexBasis:'40%',flexGrow:0,flexShrink:0,minWidth:0,minHeight:0,fill:second?'red':nestedInk}});
 const nestedController=pibblSync(nestedCanvas,createElement(Flex,{style:{width:nestedWidth,height:nestedHeight,flexDirection:first.flexDirection,flexWrap:first.flexWrap,gap:12,alignItems:'stretch',alignContent:'flex-start'},children:[...Array.from({length:3},(_,index)=>createElement(Flex,{key:index,style:{width:column?60:80,height:column?80:60,flexBasis:80,flexGrow:1,flexShrink:1,minWidth:0,minHeight:0,flexDirection:first.flexDirection,gap:'10%',alignItems:'stretch'},children:[nestedLeaf(false),nestedLeaf(true)]})),createElement(Rectangle,{key:'footer',style:{width:column?36:80,height:column?80:36,flexBasis:80,flexGrow:1,flexShrink:1,minWidth:0,minHeight:0,fill:'blue'},onClick:()=>nestedHits++})]}));
 try{const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));const clickNested=(x:number,y:number)=>{const rect=nestedCanvas.getBoundingClientRect();for(const type of ['mousedown','mouseup','click'])nestedCanvas.dispatchEvent(new MouseEvent(type,{clientX:rect.left+x,clientY:rect.top+y,bubbles:true,button:0}));};const context=nestedCanvas.getContext('2d')!;let before:any;
  for(let variant=0;variant<2;variant++){const fixture=nestedPercentCases[pair+variant];if(variant){nestedWidth.set(fixture.width);nestedHeight.set(fixture.height);}await frame();
   if(variant){if((globalThis as any).__PIBBL_LAYOUT_DIAGNOSTICS__().nodeCreates!==before.nodeCreates)throw Error('installed nested percent identity');const old=first.boxes[3];const point=wrapped?(column?{x:old.x+2,y:220}:{x:220,y:old.y+2}):{x:old.x+2,y:old.y+2};const hits=nestedHits;clickNested(point.x,point.y);if(nestedHits!==hits)throw Error('installed nested percent former footer');}
   const leaf=fixture.nestedBoxes[1],footer=fixture.boxes[3];if(context.getImageData(Math.ceil(leaf.x+2),Math.ceil(leaf.y+2),1,1).data[0]!==255)throw Error('installed nested percent leaf '+fixture.name);if(context.getImageData(footer.x+2,footer.y+2,1,1).data[2]!==255)throw Error('installed nested percent footer '+fixture.name);clickNested(footer.x+2,footer.y+2);if(nestedHits!==variant+1)throw Error('installed nested percent current footer');
   const painted=(globalThis as any).__PIBBL_LAYOUT_DIAGNOSTICS__();nestedInk.set(variant?'green':'yellow');await frame();before=(globalThis as any).__PIBBL_LAYOUT_DIAGNOSTICS__();for(const key of ['solves','lineFormations','measuredLeaves','nodeCreates'])if(painted[key]!==before[key])throw Error('installed nested percent paint reuse '+key);
  }
 }finally{nestedController.dispose();nestedCanvas.remove();}
}
receipt.nestedPercentageWrapping=true;
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
