import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { planWorkflow, workflowOutcome } from './workflow.mjs';
const ledger=JSON.parse(await readFile(new URL('../../docs/strategy/agent-verification-ledger.json',import.meta.url)));
test('connects requirement discovery to a fixed native replay, fresh evidence and bounded retrieval',()=>{
 const plan=planWorkflow('SIG-14','http://127.0.0.1:5199','/tmp/crc-workflow-check',ledger);
 assert.equal(plan.url,'http://127.0.0.1:5199/#/testing/agent-signal-mutation');
 assert.ok(plan.script.endsWith('/signal-mutation-replay.mjs'));
 assert.ok(plan.report.endsWith('/replay/report.json'));
 assert.equal(plan.requirementCompletion,'not-established');
 assert.ok(plan.acceptance.length);
});
test('refuses unmapped and unsupported runners and malformed Studio origins',()=>{
 assert.throws(()=>planWorkflow('RULE-09','http://localhost:5199','/tmp/x',ledger),{code:'CRC_WORKFLOW_UNMAPPED'});
 assert.throws(()=>planWorkflow('LAY-02','http://localhost:5199','/tmp/x',ledger),{code:'CRC_WORKFLOW_UNSUPPORTED_RUNNER'});
 for(const url of ['file:///tmp/x','http://localhost:5199/#/wrong','http://user:password@localhost:5199','http://localhost:5199/other'])assert.throws(()=>planWorkflow('SIG-14',url,'/tmp/x',ledger),{code:'CRC_WORKFLOW_ORIGIN'});
});
test('neither child exit nor saved pass overrides timeout, missing evidence or failed browser cleanup',()=>{
 const good={status:'exited',exitCode:0,browserCleanup:{status:'closed',processExited:true}};
 assert.equal(workflowOutcome(good,{kind:'final-report',claimedStatus:'pass'}),'pass');
 assert.equal(workflowOutcome({...good,status:'timeout'},{kind:'final-report',claimedStatus:'pass'}),'incomplete');
 assert.equal(workflowOutcome({...good,exitCode:1},{kind:'final-report',claimedStatus:'pass'}),'incomplete');
 assert.equal(workflowOutcome(good,null),'incomplete');
 assert.equal(workflowOutcome(good,{kind:'checkpoint',claimedStatus:'pass'}),'incomplete');
 assert.equal(workflowOutcome(good,{kind:'final-report',claimedStatus:'fail'}),'fail');
 assert.equal(workflowOutcome({...good,browserCleanup:{processExited:false}},{kind:'final-report',claimedStatus:'pass'}),'incomplete');
});

test('recovers checkpoint evidence after interruption without hiding a corrupt final report',async()=>{
 const { mkdtemp,writeFile,rm }=await import('node:fs/promises');
 const { tmpdir }=await import('node:os');const { join }=await import('node:path');
 const { collectWorkflowEvidence }=await import('./workflow.mjs');
 const directory=await mkdtemp(join(tmpdir(),'crc-workflow-recovery-'));
 try{
  const report={schema:'crc-text-replay/1',status:'incomplete',steps:[{actionId:'repair',status:'incomplete'}]};
  await writeFile(join(directory,'checkpoint.json'),JSON.stringify({schema:'crc-replay-checkpoint/1',status:'partial',sequence:2,stage:'repair',report}));
  const recovered=await collectWorkflowEvidence(join(directory,'report.json'));
  assert.equal(recovered.evidence.kind,'checkpoint');assert.equal(recovered.readFailure.code,'ENOENT');
  assert.equal(recovered.evidencePath,join(directory,'checkpoint.json'));
  await writeFile(join(directory,'report.json'),'{');
  const invalid=await collectWorkflowEvidence(join(directory,'report.json'));
  assert.equal(invalid.evidence,null);assert.ok(invalid.readFailure);assert.equal(invalid.evidencePath,null);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('validates next queries against saved data and finds failed actions beyond the summary page',async()=>{
 const { mkdtemp,writeFile,rm }=await import('node:fs/promises');
 const { tmpdir }=await import('node:os');const { join }=await import('node:path');
 const { nextEvidenceQuery }=await import('./workflow.mjs');
 const { readReplayEvidence }=await import('./evidence-reader.mjs');
 const directory=await mkdtemp(join(tmpdir(),'crc-workflow-query-'));const path=join(directory,'report.json');
 try{
  const report={schema:'crc-text-replay/1',status:'fail',steps:Array.from({length:40},(_,i)=>({actionId:`action-${i}`,status:i===39?'fail':'pass'})),firstFailedCheck:{checkId:'missing-check'},failure:{actionId:'action-39'}};
  await writeFile(path,JSON.stringify(report));
  report.checks=[{checkId:'known-check',status:'fail',required:true,reason:'independent mismatch'}];
  report.firstFailedCheck.checkId='known-check';await writeFile(path,JSON.stringify(report));
  const checkNext=await nextEvidenceQuery(path,await readReplayEvidence(path));
  assert.deepEqual(checkNext.arguments.slice(-2),['--check','known-check']);
  report.firstFailedCheck.checkId='missing-check';await writeFile(path,JSON.stringify(report));
  const next=await nextEvidenceQuery(path,await readReplayEvidence(path));
  assert.deepEqual(next.arguments.slice(-2),['--action','action-39']);
  assert.equal(next.unavailableSelections.length,1);
  assert.equal((await readReplayEvidence(path,{actionId:next.arguments.at(-1)})).data.status,'fail');
  report.steps.push({actionId:'action-39',status:'fail'});await writeFile(path,JSON.stringify(report));
  const ambiguous=await nextEvidenceQuery(path,await readReplayEvidence(path));
  assert.deepEqual(ambiguous.arguments.slice(-2),['--page','actions']);
  assert.equal(ambiguous.unavailableSelections.length,2);
 }finally{await rm(directory,{recursive:true,force:true});}
});
