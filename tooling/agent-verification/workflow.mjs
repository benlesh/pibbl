import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { discoverRequirement } from './discover.mjs';
import { runWithWatchdog } from './watchdog.mjs';
import { readReplayEvidence } from './evidence-reader.mjs';
const root=resolve(import.meta.dirname,'../..');
const runners=new Set(['replay.mjs','viz-replay.mjs','text-replay.mjs','signal-mutation-replay.mjs']);
const fail=(code,message)=>Object.assign(new Error(message),{code});
export function planWorkflow(id,origin,output,ledger){
 let base;try{base=new URL(origin);}catch{throw fail('CRC_WORKFLOW_ORIGIN','Supply a Studio HTTP(S) origin.');}
 if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw fail('CRC_WORKFLOW_ORIGIN','Supply only the Studio HTTP(S) origin, without credentials, path, query or hash.');
 if(typeof output!=='string'||!output.trim())throw fail('CRC_WORKFLOW_OUTPUT','Supply a fresh output directory.');
 const discovery=discoverRequirement(id,ledger);
 if(!discovery.workflows.length)throw fail('CRC_WORKFLOW_UNMAPPED','No reference workflow is mapped to this requirement.');
 if(discovery.workflows.length!==1)throw fail('CRC_WORKFLOW_AMBIGUOUS','Multiple workflows require explicit selection.');
 const workflow=discovery.workflows[0];
 const relative=workflow.replay?.arguments?.[0];
 if(workflow.replay?.executable!=='node'||!runners.has(relative?.replace('tooling/agent-verification/',''))||relative!==`tooling/agent-verification/${relative?.split('/').at(-1)}`)throw fail('CRC_WORKFLOW_UNSUPPORTED_RUNNER','This workflow has no integrated versioned replay runner. Use its explicit discovery recipe.');
 output=resolve(output);
 return {schema:'crc-agent-workflow-plan/1',requirementId:id,requirementCompletion:'not-established',assessedStatus:discovery.assessedStatus,remaining:discovery.remaining,scenario:workflow.scenario,url:new URL(workflow.route,base).href,script:resolve(root,relative),output,report:resolve(output,'replay/report.json'),sources:workflow.sources,prerequisites:workflow.prerequisites,initialState:workflow.initialState,acceptance:workflow.acceptance,limits:workflow.limits};
}
export function workflowOutcome(watchdog,evidence){
 if(evidence?.claimedStatus==='fail')return 'fail';
 return watchdog.status==='exited'&&watchdog.exitCode===0&&watchdog.browserCleanup?.processExited===true&&evidence?.kind==='final-report'&&evidence?.claimedStatus==='pass'?'pass':'incomplete';
}
const readError=error=>({code:error.code??'CRC_EVIDENCE_UNAVAILABLE',message:error.message.slice(0,1024)});
export async function collectWorkflowEvidence(reportPath){
 try{return {evidence:await readReplayEvidence(reportPath),evidencePath:reportPath,readFailure:null,checkpointFailure:null};}
 catch(error){
  const readFailure=readError(error);
  if(error.code!=='ENOENT')return {evidence:null,evidencePath:null,readFailure,checkpointFailure:null};
  const checkpointPath=resolve(dirname(reportPath),'checkpoint.json');
  try{
   const evidence=await readReplayEvidence(checkpointPath);
   if(evidence.kind!=='checkpoint')throw fail('CRC_WORKFLOW_INVALID_CHECKPOINT','Fallback file is not checkpoint evidence.');
   return {evidence,evidencePath:checkpointPath,readFailure,checkpointFailure:null};
  }catch(checkpointError){return {evidence:null,evidencePath:null,readFailure,checkpointFailure:readError(checkpointError)};}
 }
}
export async function nextEvidenceQuery(path,evidence){
 if(!path||!evidence)return null;
 const truncated=new Set(evidence.truncatedFields??[]);
 const check=evidence.firstFailedCheck?.checkId;
 const action=evidence.failure?.actionId;
 const candidates=[];
 if(check&&!truncated.has('firstFailedCheck.checkId'))candidates.push({flag:'--check',id:check,options:{checkId:check}});
 if(action&&!truncated.has('failure.actionId'))candidates.push({flag:'--action',id:action,options:{actionId:action}});
 const unavailableSelections=[];
 const command=selector=>({executable:process.execPath,arguments:[resolve(root,'tooling/agent-verification/evidence-reader.mjs'),path,...selector],unavailableSelections});
 for(const candidate of candidates){
  try{await readReplayEvidence(path,candidate.options);return command([candidate.flag,candidate.id]);}
  catch(error){unavailableSelections.push({selector:candidate.flag,id:candidate.id,...readError(error)});}
 }
 return command(['--page','actions']);
}
export async function executeWorkflow(plan){
 const watchdog=await runWithWatchdog({script:plan.script,args:[plan.url,resolve(plan.output,'replay')],output:plan.output,cwd:root,ownedBrowser:true,deadlineMs:60000});
 const {evidence,evidencePath,readFailure,checkpointFailure}=await collectWorkflowEvidence(plan.report);
 const result={schema:'crc-agent-workflow-run/1',status:workflowOutcome(watchdog,evidence),requirementId:plan.requirementId,requirementCompletion:'not-established',scope:'Controlled reference workflow only; not arbitrary application or full requirement verification.',scenario:plan.scenario,url:plan.url,sources:plan.sources,remaining:plan.remaining,acceptance:plan.acceptance,watchdog:{status:watchdog.status,exitCode:watchdog.exitCode,browserCleanup:watchdog.browserCleanup},evidence,readFailure,checkpointFailure,evidencePath,artifacts:{report:plan.report,watchdog:resolve(plan.output,'watchdog.json')},next:await nextEvidenceQuery(evidencePath,evidence)};
 await writeFile(resolve(plan.output,'workflow.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const [command,id,origin,output,...extra]=process.argv.slice(2);
  if(!['plan','run'].includes(command)||!id||!origin||!output||extra.length)throw fail('CRC_WORKFLOW_USAGE','Usage: node tooling/agent-verification/workflow.mjs plan|run REQUIREMENT-ID STUDIO-ORIGIN FRESH-OUTPUT-DIRECTORY');
  const ledger=JSON.parse(await readFile(resolve(root,'docs/strategy/agent-verification-ledger.json'),'utf8'));
  const plan=planWorkflow(id,origin,output,ledger);
  const result=command==='plan'?plan:await executeWorkflow(plan);
  process.stdout.write(JSON.stringify(result)+'\n');
  if(command==='run'&&result.status!=='pass')process.exitCode=1;
 }catch(error){process.stdout.write(JSON.stringify({schema:'crc-agent-workflow-run/1',status:'unavailable',code:error.code??'CRC_WORKFLOW_UNAVAILABLE',message:error.message.slice(0,1024)})+'\n');process.exitCode=1;}
}
