import type { CreativeContext } from './studio-context';
export interface StudioAdDraft {
  id:string; accountId:string; assetId:string; name:string; type:'image'|'video'; sample:boolean;
  context:CreativeContext; media:Blob; createdAt:number;
}
const open=()=>new Promise<IDBDatabase>((resolve,reject)=>{
 const request=indexedDB.open('whopdesktop.creative-drafts',1);
 request.onupgradeneeded=()=>request.result.createObjectStore('drafts',{keyPath:'id'});
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});
export async function saveAdDraft(draft:StudioAdDraft){
 const db=await open();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put(draft);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
}
export async function getAdDrafts(accountId:string){
 const db=await open();try{return await new Promise<StudioAdDraft[]>((resolve,reject)=>{const req=db.transaction('drafts').objectStore('drafts').getAll();req.onsuccess=()=>resolve((req.result as StudioAdDraft[]).filter(x=>x.accountId===accountId).sort((a,b)=>b.createdAt-a.createdAt));req.onerror=()=>reject(req.error);});}finally{db.close();}
}
