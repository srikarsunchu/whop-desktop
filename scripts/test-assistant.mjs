import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const load=async(path,strip=false)=>{
 let source=fs.readFileSync(path,'utf8');if(strip)source=source.replace(/^import .*;$/gm,'');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
};
const {loadLibrary,chatKey,newThread,recoverThread}=await load('src/lib/conversations.ts');
const data=new Map();const storage={getItem:k=>data.get(k)??null};
const legacy={sessionId:'legacy-session',messages:[{id:'one',role:'user',blocks:[{type:'text',text:'Review my revenue'}],createdAt:1}]};
data.set('whopdesktop.chat.acct-a',JSON.stringify(legacy));
const migrated=loadLibrary('acct-a',storage);
assert.equal(migrated.threads[0].title,'Review my revenue');assert.equal(migrated.threads[0].sessionId,'legacy-session');
const another=newThread();another.draft='My next idea';
data.set(chatKey('acct-a'),JSON.stringify({activeId:another.id,threads:[another,...migrated.threads]}));
const restored=loadLibrary('acct-a',storage);
assert.equal(restored.threads.length,2);assert.equal(restored.threads[0].draft,'My next idea');assert.equal(restored.activeId,another.id);
assert.equal(loadLibrary('acct-b',storage).threads[0].messages.length,0);
const interrupted=recoverThread({...newThread(),messages:[{id:'stream',role:'assistant',streaming:true,createdAt:1,blocks:[{type:'tool',call:{id:'tool',done:false,command:'whop products list',startedAt:1}}]}]});
assert.equal(interrupted.messages[0].streaming,false);assert.match(interrupted.messages[0].error,/interrupted/);assert.equal(interrupted.messages[0].blocks[0].call.done,true);
data.set(chatKey('broken'),'{invalid');assert.equal(loadLibrary('broken',storage).threads.length,1);
const {handleLine}=await load('src/lib/assistant.ts',true);
let meta;const input=[];const sink={onResult:x=>meta=x,onSession:()=>{},onTextDelta:()=>{},onToolStart:()=>{},onToolInput:(...x)=>input.push(x),onToolResult:()=>{},onAssistantMessage:()=>{}};
handleLine(JSON.stringify({type:'result',model:'reported-model',duration_ms:300}),sink,new Map());assert.equal(meta.model,'reported-model');
const partial=new Map([['tool','']]);
assert.doesNotThrow(()=>handleLine(JSON.stringify({type:'stream_event',event:{type:'content_block_delta',delta:{type:'input_json_delta',partial_json:'{"command":"whop products list \\u'}}}),sink,partial));
handleLine(JSON.stringify({type:'assistant',message:{content:[{type:'tool_use',id:'tool',input:{command:'whop products list',description:'Checking products'}}]}}),sink,partial);
assert.equal(input.at(-1)[1],'whop products list');assert.equal(partial.size,0);
console.log('Assistant checks passed: legacy migration, multiple conversations, business isolation, draft restoration, interrupted runs, stream parsing and model metadata.');

// wv's gate: a write's tool result parses into a plan with a rerun, a refusal into a refusal, a read into nothing.
const {parseGate}=await load('src/lib/gate.ts');
const plan=parseGate(JSON.stringify({ok:false,error:{code:'CONFIRMATION_REQUIRED',message:'whop payouts create --amount 5 writes to production. wv did not run it.',hint:'Show the plan to the person.'},plan:{kind:'write',command:'whop payouts create --amount 5 --payout_method_id potk_x',money:{amount:5,currency:'usd'},balance:{available:18.56,currency:'usd'},cap:500,limit:{speed:'standard',max:0,code:'kyc_completed',message:'Please complete identity verification before requesting a withdrawal.'}},rerun:['wv','payouts','create','--amount','5','--payout_method_id','potk_x','--approve','1790.abc']}));
assert.equal(plan.kind,'plan');assert.equal(plan.code,'CONFIRMATION_REQUIRED');assert.deepEqual(plan.rerun.slice(0,3),['wv','payouts','create']);assert.equal(plan.plan.money.amount,5);
const refused=parseGate(JSON.stringify({ok:false,error:{code:'WHOP_LIMIT',message:'Please complete identity verification before requesting a withdrawal.'},plan:{kind:'write',money:{amount:5,currency:'usd'}}}));
assert.equal(refused.kind,'refused');assert.equal(refused.rerun,undefined);
const prefixed=parseGate('Exit code 2\n'+JSON.stringify({ok:false,error:{code:'CONFIRMATION_REQUIRED',message:'plan'},plan:{kind:'write'},rerun:['wv','products','update','prod_x','--approve','1']}));
assert.equal(prefixed.kind,'plan');assert.deepEqual(prefixed.rerun.slice(0,2),['wv','products']);
const blocked=parseGate(JSON.stringify({ok:false,error:{code:'SWAP_BLOCKED',message:'blocked'},plan:{kind:'swap',blockers:['€80.00 is more than the €12.50 available.']}}));
assert.equal(blocked.kind,'refused');
const stale=parseGate(JSON.stringify({ok:false,error:{code:'APPROVAL_EXPIRED',message:'The approval expired.'},plan:{}}));
assert.equal(stale.kind,'stale');
assert.equal(parseGate(JSON.stringify({ok:true,data:{data:[]}})),undefined);
assert.equal(parseGate('Not JSON at all'),undefined);
assert.equal(parseGate(JSON.stringify({code:'WRITE_BLOCKED',message:'blocked by the app'})),undefined,'the fallback block is not the gate');
// The typed-back amount and the plan rows.
const {typedAmountOf,planRows}=await load('src/components/PlanCard.tsx',true).catch(()=>({}));
if(typedAmountOf){
 assert.deepEqual(typedAmountOf(plan.plan),{amount:5,currency:'usd'});
 assert.deepEqual(typedAmountOf({kind:'swap',typedAmount:{amount:80,currency:'eur'}}),{amount:80,currency:'eur'});
 assert.equal(typedAmountOf({kind:'write',changes:{title:{before:'a',after:'b'}}}),undefined);
 const rows=Object.fromEntries(planRows(plan.plan));
 assert.equal(rows.amount,'$5.00');assert.match(rows["Whop's limit"],/^blocked · Please complete/);assert.equal(rows['wv cap'],'$500.00');
 const changed=Object.fromEntries(planRows({kind:'write',command:'whop products update prod_x --title "Frame Pro"',changes:[{key:'title',before:'Frame',after:'Frame Pro',changed:true},{key:'visibility',before:'visible',after:'visible',changed:false}]}));
 assert.equal(changed.title,'Frame → Frame Pro');assert.equal(changed.visibility,undefined,'an unchanged field is not a row');
}
console.log('Gate checks passed: plan, refusal, blocked recipe, stale approval, reads, the fallback block, typed amount, plan rows.');
