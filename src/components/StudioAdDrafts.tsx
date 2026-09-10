import { useEffect, useState } from 'react';
import { Button, Text, toast } from 'frosted-ui';
import { getAdDrafts, saveAdDraft, type StudioAdDraft } from '../lib/studio-drafts';
import { useAccount } from '../lib/whop';
import { loadGenerations } from '../lib/studio-jobs';
import { validDestination } from '../lib/studio-context';

function DraftCard({draft,onSave,ask}:{draft:StudioAdDraft;onSave:(d:StudioAdDraft)=>void;ask:(prompt:string)=>void}){
  const [url,setUrl]=useState('');
  const [editing,setEditing]=useState(false);
  const [context,setContext]=useState(draft.context);
  const [saving,setSaving]=useState(false);
  useEffect(()=>{
    if(draft.media.size){const u=URL.createObjectURL(draft.media);setUrl(u);return()=>URL.revokeObjectURL(u);}
    setUrl(loadGenerations().find(g=>g.id===draft.assetId && g.accountId===draft.accountId)?.url??'');
  },[draft]);
  const save=async()=>{setSaving(true);try{const next={...draft,context};await saveAdDraft(next);onSave(next);setEditing(false);toast.success('Draft saved');}catch{toast.error('Could not save draft');}finally{setSaving(false);}};
  return <article className="studio-ad-draft">
    <div className="draft-artwork">{url?draft.type==='image'?<img src={url} alt={draft.name}/>:<video src={url} controls preload="metadata"/>:<span>Video saved in Studio</span>}</div>
    <div className="draft-details"><span className="studio-eyebrow">{draft.sample?'SAMPLE · ':''}LOCAL DRAFT · NOT PUBLISHED</span><h3>{draft.name}</h3><p className="studio-hint">{draft.context.productTitle || 'No offer selected'}{draft.context.price?` · ${draft.context.price}`:''}</p>
      {editing?<div className="draft-edit-fields"><label className="studio-field">Ad headline<input value={context.adHeadline} onChange={e=>setContext({...context,adHeadline:e.target.value})}/></label><label className="studio-field">Post copy<textarea rows={3} value={context.postCopy} onChange={e=>setContext({...context,postCopy:e.target.value})}/></label><label className="studio-field">Destination<input value={context.destinationUrl} onChange={e=>setContext({...context,destinationUrl:e.target.value})}/></label><div className="studio-confirm-actions"><Button size="1" variant="surface" onClick={()=>{setContext(draft.context);setEditing(false);}}>Cancel</Button><Button size="1" loading={saving} disabled={!!context.destinationUrl && !validDestination(context.destinationUrl)} onClick={save}>Save changes</Button></div></div>:<><strong>{draft.context.adHeadline || 'Add an ad headline'}</strong><p className="draft-post-copy">{draft.context.postCopy || 'Add post copy before setting up the campaign.'}</p><p className="studio-hint">{draft.context.destinationUrl || 'Destination link needed'} · {draft.context.callToAction.replaceAll('_',' ')}</p><div className="draft-actions"><Button size="1" variant="surface" onClick={()=>setEditing(true)}>Edit copy</Button><Button size="1" variant="surface" onClick={()=>ask(`Help me plan a campaign from this local Studio draft. Do not create, publish or spend anything yet.\nOffer: ${draft.context.productTitle}. Plan: ${draft.context.planId || 'not selected'}. Price: ${draft.context.price}.\nCreative concept: ${draft.name}. Type: ${draft.type}. Format: ${draft.context.format}.\nHeadline: ${draft.context.adHeadline}\nPost copy: ${draft.context.postCopy}\nCTA: ${draft.context.callToAction}\nDestination: ${draft.context.destinationUrl || 'not supplied'}\nThe finished artwork is saved locally in Studio draft ${draft.id}; it has not been uploaded as an ad creative. ${draft.sample?'This uses sample media, not a real generated creative.':''}\nHelp me choose an audience and budget and identify what is still needed before launch.`)}>Plan campaign with Claude</Button></div></>}
    </div>
  </article>;
}
export function StudioAdDrafts({ask}:{ask:(prompt:string)=>void}){
 const {account}=useAccount();const [drafts,setDrafts]=useState<StudioAdDraft[]>([]);const [error,setError]=useState(false);
 useEffect(()=>{let canceled=false;if(!account)return;getAdDrafts(account.id).then(xs=>{if(!canceled)setDrafts(xs);}).catch(()=>{if(!canceled)setError(true);});return()=>{canceled=true;};},[account?.id]);
 if(error)return <Text color="red">Studio drafts could not be loaded. Your campaigns are shown below.</Text>;
 if(!drafts.length)return null;
 return <section className="studio-ad-drafts"><div><h2>From Studio</h2><p className="studio-hint">Your creative and offer are ready to review. Audience, budget and publishing come next.</p></div>{drafts.map(d=><DraftCard key={d.id} draft={d} ask={ask} onSave={next=>setDrafts(xs=>xs.map(x=>x.id===next.id?next:x))}/>)}</section>;
}
