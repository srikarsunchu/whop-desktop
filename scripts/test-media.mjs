import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
const load = async path => {
 const js=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
};
const {resolveMedia,mediaArgs,pendingMedia}=await load('src/lib/media.ts');
const {demoResolve}=await load('src/lib/demo.ts');
const base={id:'pending-test',type:'video',prompt:'Test',status:'processing',createdAt:Date.now(),accountId:'biz_test'};
let calls=0;
const file=async id=>{calls++;assert.equal(id,'file_test');return {id,url:'https://example.com/clip.mp4',content_type:'video/mp4',upload_status:'ready'};};
let g=await resolveMedia({id:'media_test',status:'completed',file:{id:'file_test'}},base,file);
assert.equal(g.status,'completed');assert.equal(g.url,'https://example.com/clip.mp4');assert.equal(calls,1);
g=await resolveMedia({data:{id:'media_test',status:'completed',file:{url:'https://example.com/clip.mp4',content_type:'video/mp4'}}},base,file);
assert.equal(g.status,'completed');assert.equal(calls,1,'URL already present: no redundant file fetch');
g=await resolveMedia({id:'media_test',status:'completed',file:{id:'file_test'}},base,async()=>({id:'file_test',url:null,upload_status:'processing'}));
assert.equal(g.status,'resolving');assert.equal(g.url,undefined);assert.ok(pendingMedia(g));
g=await resolveMedia({id:'media_test',status:'completed',file:{id:'file_test'}},base,async()=>{throw Error('temporary');});
assert.equal(g.status,'resolving');assert.equal(g.id,'media_test');
g=await resolveMedia({id:'media_test',status:'queued'},base,file);assert.ok(pendingMedia(g));
g=await resolveMedia({id:'media_test',status:'failed',error:{message:'Provider refused'}},base,file);assert.equal(g.status,'failed');assert.equal(g.error,'Provider refused');
g=await resolveMedia({id:'media_test',status:'completed',file:{url:'https://example.com/poster.svg',content_type:'image/svg+xml'}},base,file);assert.equal(g.status,'failed');assert.equal(g.url,undefined);
g=await resolveMedia({id:'media_test',status:'completed',file:{url:'javascript:alert(1)'}},base,file);assert.equal(g.status,'failed');
await assert.rejects(resolveMedia({},base,file),/no media ID/);
const input={type:'video',prompt:'  Test  ',duration:'5',resolution:'1080p',demo:false,accountId:'biz_test',requestKey:'same-key'};
const args=mediaArgs(input);assert.ok(!args.includes('--wait'));assert.equal(args[args.indexOf('--idempotency-key')+1],'same-key');assert.deepEqual(args,mediaArgs(input));assert.ok(args.includes('biz_test'));assert.ok(!mediaArgs({...input,type:'image'}).includes('--resolution'));
for(const type of ['image','video']) {
 const generated=demoResolve(['media','generate','--type',type,'--prompt','test']);
 const refreshed=demoResolve(['media','get',generated.id]);
 assert.equal(generated.type,type);assert.equal(refreshed.type,type);assert.equal(generated.file.url,refreshed.file.url);assert.ok(generated.file.content_type.startsWith(type+'/'));assert.equal(generated.cost,'0.00');
}
const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_name,width,height','-show_entries','format=duration','-of','json','public/demo/studio-sample.mp4'],{encoding:'utf8'}));
assert.equal(probe.streams[0].codec_name,'h264');assert.equal(Number(probe.format.duration),5);
execFileSync('ffmpeg',['-v','error','-i','public/demo/studio-sample.mp4','-f','null','-']);
console.log('Media checks passed: file resolution, delayed readiness, failures, wrong types, envelopes, idempotency, sample refresh, and 5s H.264 decode.');
