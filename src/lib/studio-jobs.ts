import { useEffect } from 'react';
import { runWhopJson } from './whop';
import { DEMO_ACCOUNT_ID, DEMO_POSTER, DEMO_VIDEO } from './demo';
import { pendingMedia, resolveMedia, type Generation } from './media';
const LS='whopdesktop.studio';
export const loadGenerations = ():Generation[] => {
  try {
    const items:Generation[]=JSON.parse(localStorage.getItem(LS) ?? '[]');
    if(!Array.isArray(items))return [];
    return items.map(g=>g.accountId===DEMO_ACCOUNT_ID && !g.sample ? {...g,id:g.id.includes(`_${g.type}_`)?g.id:`media_Nw_${g.type}_${g.id}`,sample:true,cost:'0.00',status:'completed',error:undefined,url:g.type==='video'?DEMO_VIDEO:DEMO_POSTER,contentType:g.type==='video'?'video/mp4':'image/svg+xml'}:g);
  }catch{return [];}
};
export const updateGenerations=(update:(items:Generation[])=>Generation[])=>{
  localStorage.setItem(LS,JSON.stringify(update(loadGenerations())));
  window.dispatchEvent(new Event('whopdesktop:studio-updated'));
};
/** Track existing jobs throughout the app and resume them on launch. Never generate here. */
export function useStudioJobs(){
  useEffect(()=>{
    // A request interrupted before returning a server ID can safely be retried
    // with its persisted idempotency key; never submit it automatically.
    updateGenerations(xs=>xs.map(g=>g.conversationId && g.id.startsWith('pending-') && pendingMedia(g)?{...g,status:'failed',error:'The app closed before this request could be tracked. Retry the same request to recover it.'}:g));
    let disposed=false;
    const checking=new Set<string>();
    const tick=()=>{
      const jobs=loadGenerations().filter(g=>pendingMedia(g) && !g.id.startsWith('pending-'));
      for(const job of jobs){
        if(checking.has(job.id))continue;checking.add(job.id);
        void (async()=>{
          try{
            const result=await runWhopJson(['media','get',job.id],!!job.sample);
            const next=await resolveMedia(result,job,id=>runWhopJson(['files','get',id]));
            if(!disposed)updateGenerations(xs=>xs.map(x=>x.id===job.id?next:x));
          }catch{ /* Keep the job retryable through temporary network failures. */ }
          finally{checking.delete(job.id);}
        })();
      }
    };
    tick();const timer=setInterval(tick,5000);
    return()=>{disposed=true;clearInterval(timer);};
  },[]);
}
