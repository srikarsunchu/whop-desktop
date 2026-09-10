import { useEffect, useState } from 'react';
import { Button, Dialog, toast } from 'frosted-ui';
import { invoke } from '@tauri-apps/api/core';
import { useWhop, useAccount, runWhopJson, invalidateAll, commandString, type Page } from '../lib/whop';
import { campaignCommand, type AdLevel, type AdRecord } from '../lib/campaign-editor';
import { getAdDrafts, type StudioAdDraft } from '../lib/studio-drafts';
import { money, num, daysAgo, isoDay } from '../lib/format';
import { StatusBadge } from './UserCell';

const labels:Record<AdLevel,string>={'ad-campaigns':'Campaign','ad-groups':'Ad group',ads:'Ad'};
const text=(v:unknown)=>typeof v==='string'?v:v==null?'':String(v);
const list=(v:unknown)=>Array.isArray(v)?v:[];
export function CampaignWorkspace({ask}:{ask:(s:string)=>void}){
 const {account}=useAccount();
 return account?<Workspace key={account.id} accountId={account.id} demo={!!account.demo} ask={ask}/>:null;
}
function Workspace({accountId,demo,ask}:{accountId:string;demo:boolean;ask:(s:string)=>void}){
 const [campaign,setCampaign]=useState('');const [group,setGroup]=useState('');const [level,setLevel]=useState<AdLevel>('ad-campaigns');
 const [search,setSearch]=useState('');const [status,setStatus]=useState('all');
 const stats=['--stats_from',isoDay(daysAgo(29)),'--stats_to',isoDay(daysAgo(0))];
 const campaigns=useWhop<Page<AdRecord>>(['ad-campaigns','list','--first','100',...stats]);
 const groups=useWhop<Page<AdRecord>>(['ad-groups','list','--first','100',...(campaign?['--ad_campaign_id',campaign]:[]),...stats]);
 const ads=useWhop<Page<AdRecord>>(['ads','list','--first','100',...(group?['--ad_group_id',group]:[]),...stats]);
 const social=useWhop<Page<AdRecord>>(['social-accounts','list']);
 const [local,setLocal]=useState<Record<string,AdRecord[]>>(()=>{try{return JSON.parse(localStorage.getItem('campaign-demo.'+accountId)??'{}');}catch{return {};}});
 const [drafts,setDrafts]=useState<StudioAdDraft[]>([]);
 const [editor,setEditor]=useState<{level:AdLevel;id?:string}|null>(null);const [values,setValues]=useState<Record<string,string>>({});
 const [selectedDraft,setSelectedDraft]=useState('');const [preview,setPreview]=useState('');const [uploading,setUploading]=useState(false);
 const [pending,setPending]=useState<{args:string[];title:string}|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const [requestKey,setRequestKey]=useState('');
 const data=(kind:AdLevel):AdRecord[]=>demo&&local[kind]?local[kind]:(kind==='ads'?ads:kind==='ad-groups'?groups:campaigns).data?.data??[];
 const cs=data('ad-campaigns'),gs=data('ad-groups').filter(x=>text(x.ad_campaign_id)===campaign),as=data('ads').filter(x=>text(x.ad_group_id)===group);
 const currentCampaign=cs.find(x=>x.id===campaign),currentGroup=gs.find(x=>x.id===group);
 const rows=(level==='ad-campaigns'?cs:level==='ad-groups'?gs:as).filter(x=>(status==='all'||x.status===status)&&text(x.title??x.name).toLowerCase().includes(search.toLowerCase()));
 const query=level==='ad-campaigns'?campaigns:level==='ad-groups'?groups:ads;
 useEffect(()=>{if(demo)localStorage.setItem('campaign-demo.'+accountId,JSON.stringify(local));},[local,demo,accountId]);
 useEffect(()=>{getAdDrafts(accountId).then(setDrafts).catch(()=>setError('Could not load Studio drafts.'));},[accountId,editor]);
 useEffect(()=>{const d=drafts.find(x=>x.id===selectedDraft);if(!d?.media.size){setPreview('');return;}const url=URL.createObjectURL(d.media);setPreview(url);return()=>URL.revokeObjectURL(url);},[selectedDraft,drafts]);
 const change=(key:string,value:string)=>{setValues(v=>({...v,[key]:value}));setRequestKey(crypto.randomUUID());};
 const open=async(kind:AdLevel,row?:AdRecord)=>{
  setError('');setSelectedDraft('');setEditor({level:kind,id:row?.id});setRequestKey(crypto.randomUUID());
  let r=row;
  if(row&&!demo){setBusy(true);try{const result=await runWhopJson<AdRecord|{data:AdRecord}>([kind,'get',row.id]);r=('data' in result?result.data:result) as AdRecord;}catch(e){setError(String(e));setEditor(null);return;}finally{setBusy(false);}}
  const v:Record<string,string>={title:text(r?.title??r?.name)};
  if(kind==='ad-campaigns'){
   if(!r){v.objective='traffic';v.budget_type='daily';v.budget_amount='';}
   else if(r.budget_optimization!=='ad_group')v.budget_amount=text(r.budget_amount);
  }
  if(kind==='ad-groups'&&!r){v.optimization_goal=currentCampaign?.objective==='awareness'?'reach':currentCampaign?.objective==='sales'?'conversions':'landing_page_views';v.conversion_location='website';v.regions=JSON.stringify({include:{countries:['US']}});}
  if(kind==='ad-groups'&&r){for(const k of ['optimization_goal','conversion_event',...(currentCampaign?.budget_optimization==='ad_group'?['budget_amount','budget_type']:[])])if(r[k]!=null)v[k]=text(r[k]);}
  if(kind==='ads'){v.headlines=text(list(r?.headlines)[0]);v.primary_texts=text(list(r?.primary_texts??r?.descriptions)[0]);v.url=text(r?.url??r?.destination_url);v.call_to_action=text(r?.call_to_action)||'learn_more';if(!r){v.creatives='';v.social_accounts='';}}
  setValues(v);
 };
 const chooseDraft=(id:string)=>{setSelectedDraft(id);const d=drafts.find(x=>x.id===id);if(d)setValues(v=>({...v,title:d.name,headlines:d.context.adHeadline,primary_texts:d.context.postCopy,url:d.context.destinationUrl,call_to_action:d.context.callToAction,creatives:''}));setRequestKey(crypto.randomUUID());};
 const upload=async()=>{
  const d=drafts.find(x=>x.id===selectedDraft);if(!d)return;
  if(demo){change('creatives',JSON.stringify([{id:'sample-'+d.id}]));return;}
  if(d.sample){setError('Sample artwork cannot be used in a live ad. Choose a real Studio creative.');return;}
  if(d.type!=='image'||!d.media.size){setError('Use a finished image draft, or enter an uploaded Whop file ID for video.');return;}
  setUploading(true);setError('');try{
   const id=await invoke<string>('studio_upload_image',{filename:'campaign-creative.png',bytes:Array.from(new Uint8Array(await d.media.arrayBuffer()))});
   let ready=false;
   for(let attempt=0;attempt<20;attempt++){
    const file=await runWhopJson<{upload_status?:string;data?:{upload_status?:string}}>(['files','get',id]);
    const state=(file.data??file).upload_status;
    if(state==='ready'){ready=true;break;}if(state==='failed')throw Error('Whop could not process the artwork.');
    await new Promise(resolve=>setTimeout(resolve,1500));
   }
   if(!ready)throw Error('Artwork is still processing. Try again shortly.');
   change('creatives',JSON.stringify([{id}]));
   toast.success('Artwork uploaded. Review before creating the ad.');
  }catch(e){setError(String(e));}finally{setUploading(false);}
 };
 const review=()=>{if(!editor)return;try{
  if(editor.level==='ads'&&!editor.id&&(!values.creatives||!values.social_accounts||!values.url||!values.headlines||!values.primary_texts))throw Error('Add artwork, connected page, headline, caption, and destination.');
  const args=campaignCommand(editor.level,editor.id,values,editor.level==='ads'?group:campaign,requestKey);
  setPending({args,title:editor.id?'Save '+labels[editor.level].toLowerCase()+' changes':'Create '+labels[editor.level].toLowerCase()});setError('');
 }catch(e){setError((e as Error).message);}};
 const execute=async()=>{
  if(!pending||busy)return;setBusy(true);setError('');
  try{
   const [kind,action,id]=pending.args as [AdLevel,string,string];
   if(demo){
    const xs=data(kind);const fields:Record<string,unknown>={};
    for(let i=action==='create'?2:3;i<pending.args.length;i+=2){const key=pending.args[i].slice(2);let value:unknown=pending.args[i+1];try{value=JSON.parse(String(value));}catch{}fields[key]=value;}
    const next=action==='create'?[...xs,{...fields,id:'demo-'+crypto.randomUUID(),status:kind==='ad-campaigns'?'draft':'paused'}]:action==='delete'?xs.filter(x=>x.id!==id):action==='duplicate'?[...xs,{...xs.find(x=>x.id===id)!,id:'demo-'+crypto.randomUUID(),title:text(xs.find(x=>x.id===id)?.title)+' copy',status:'paused'}]:xs.map(x=>x.id===id?{...x,...fields,...(action==='pause'?{status:'paused'}:action==='unpause'?{status:'active'}:{})}:x);
    setLocal(v=>({...v,[kind]:next}));
   }else{await runWhopJson(pending.args);invalidateAll();campaigns.refresh();groups.refresh();ads.refresh();}
   toast.success(demo?'Demo updated on this Mac':pending.title+' completed');setPending(null);setEditor(null);
  }catch(e){setError((e as {message?:string}).message??String(e));}finally{setBusy(false);}
 };
 const action=(row:AdRecord,verb:string)=>setPending({args:[level,verb,row.id],title:verb==='unpause'?'Resume delivery':verb==='pause'?'Pause delivery':verb==='delete'?'Delete '+labels[level].toLowerCase():'Duplicate '+labels[level].toLowerCase()});
 const field=(key:string,label:string,type='text')=><label className="studio-field" key={key}>{label}<input type={type} value={values[key]??''} onChange={e=>change(key,e.target.value)}/></label>;
 const select=(key:string,label:string,options:string[])=><label className="studio-field">{label}<select value={values[key]??''} onChange={e=>change(key,e.target.value)}>{options.map(v=><option key={v} value={v}>{v.startsWith('[')?(JSON.parse(v).join(', ').replaceAll('_',' ')||'None'):v.replaceAll('_',' ')||'Keep existing'}</option>)}</select></label>;
 return <section className="campaign-workspace">
  <div className="campaign-heading"><div><h2>Campaign workspace</h2><p>{demo?'Demo mode · changes stay on this Mac':'Manage delivery, audience, budget and creative'} · Last 30 days</p></div><Button onClick={()=>open('ad-campaigns')}>New campaign</Button></div>
  {drafts.length>0&&<div className="campaign-studio-tray"><strong>{drafts.length} creative{drafts.length===1?'':'s'} from Studio</strong><p>{level==='ads'?'Create an ad, then choose a saved Studio creative.':'Open a campaign and ad group to use your saved artwork and copy.'}</p>{level==='ads'&&<Button variant="surface" onClick={()=>open('ads')}>Use Studio creative</Button>}</div>}
  <nav className="campaign-breadcrumbs" aria-label="Campaign hierarchy"><button onClick={()=>{setLevel('ad-campaigns');setStatus('all');setSearch('');}}>All campaigns</button>{currentCampaign&&<><span>/</span><button onClick={()=>{setLevel('ad-groups');setStatus('all');setSearch('');}}>{text(currentCampaign.title??currentCampaign.name)}</button></>}{currentGroup&&<><span>/</span><button onClick={()=>{setLevel('ads');setStatus('all');setSearch('');}}>{text(currentGroup.title)}</button></>}</nav>
  <div className="campaign-heading"><div><h3>{level==='ad-campaigns'?'Campaigns':level==='ad-groups'?'Ad groups':'Ads'}</h3>{currentCampaign&&level!=='ad-campaigns'&&<p>{text(currentCampaign.objective)} · {currentCampaign.budget_optimization==='ad_group'?'Budget per ad group':money(Number(currentCampaign.budget_amount))+' / '+(currentCampaign.budget_type==='lifetime'?'lifetime':'day')}</p>}</div><div className="draft-actions"><input aria-label="Search campaigns, groups or ads" placeholder="Search by name" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Filter delivery status" value={status} onChange={e=>setStatus(e.target.value)}>{['all','draft','active','paused','rejected','in_review'].map(v=><option key={v}>{v}</option>)}</select>{level!=='ad-campaigns'&&<Button onClick={()=>open(level)}>New {labels[level].toLowerCase()}</Button>}</div></div>
  {error&&!editor&&!pending&&<p role="alert" className="campaign-error">{error}</p>}
  {query.error?<div role="alert">{query.error.message}<Button onClick={()=>query.refresh()}>Retry</Button></div>:query.loading?<p>Loading campaign data…</p>:<div className="campaign-table-wrap"><table className="campaign-table"><thead><tr><th>Name</th><th>Delivery</th><th>Spend</th><th>Clicks</th><th>Results</th><th>Manage</th></tr></thead><tbody>{rows.map(row=>{const st=(row.stats??row) as Record<string,unknown>;return <tr key={row.id}><td><button className="campaign-name" onClick={()=>{if(level==='ad-campaigns'){setCampaign(row.id);setGroup('');setLevel('ad-groups');}else if(level==='ad-groups'){setGroup(row.id);setLevel('ads');}else void open('ads',row);setStatus('all');setSearch('');}}>{text(row.title??row.name)||row.id}</button><small>{level==='ad-campaigns'?text(row.objective):level==='ad-groups'?text(row.optimization_goal):text(list(row.headlines)[0])}</small></td><td><StatusBadge status={text(row.status)}/></td><td>{st.spend==null?'—':money(Number(st.spend))}</td><td>{st.clicks==null?'—':num(Number(st.clicks))}</td><td>{st.results==null?'—':num(Number(st.results))}</td><td><div className="campaign-row-actions"><button onClick={()=>open(level,row)}>Edit</button>{row.status==='draft'&&level==='ad-campaigns'?<button onClick={()=>setPending({args:['ad-campaigns','update',row.id,'--status','active'],title:'Launch campaign — may spend your configured budget'})}>Review launch</button>:<button onClick={()=>action(row,row.status==='paused'?'unpause':'pause')}>{row.status==='paused'?'Resume':'Pause'}</button>}<details><summary>More</summary><button onClick={()=>action(row,'duplicate')}>Duplicate</button><button onClick={()=>action(row,'delete')}>Delete</button></details></div></td></tr>;})}</tbody></table>{!rows.length&&<div className="campaign-empty"><h3>{search||status!=='all'?'No matching results':'Build your next '+labels[level].toLowerCase()}</h3><p>{level==='ad-campaigns'?'Set the goal and budget, then add an audience and creative.':level==='ad-groups'?'Add an audience group to this campaign.':'Choose a finished Studio creative and add your copy.'}</p></div>}{query.data?.page_info?.has_next_page&&<p className="studio-hint">Showing the first 100 results. More items exist in this account.</p>}</div>}
  <Dialog.Root open={!!editor} onOpenChange={o=>{if(!o&&!busy&&!uploading)setEditor(null);}}><Dialog.Content className="campaign-editor" size="3"><Dialog.Title>{editor?.id?'Edit':'New'} {editor?labels[editor.level].toLowerCase():''}</Dialog.Title><Dialog.Description>{editor?.level==='ad-campaigns'?'Set the campaign goal and spending limit.':editor?.level==='ad-groups'?'Audience and delivery settings for '+text(currentCampaign?.title):'Creative and copy for '+text(currentGroup?.title)}</Dialog.Description>
   <div className="campaign-fields">{field('title','Name')}
   {editor?.level==='ad-campaigns'&&<>{!editor.id&&<>{select('objective','Objective',['traffic','sales','awareness','engagement','leads'])}{select('budget_type','Budget type',['daily','lifetime'])}</>}{(!editor.id||'budget_amount' in values)&&field('budget_amount','Budget (ad account currency)','number')}{field('starts_at','New start time (optional)','datetime-local')}{field('ends_at','New end time (optional)','datetime-local')}{select('special_ad_categories','Special ad category',['','[]','["housing"]','["employment"]','["financial_products"]','["politics"]'])}<p className="studio-hint">A new campaign starts as a draft. Launch is a separate action. Blank optional fields preserve existing settings.</p></>}
   {editor?.level==='ad-groups'&&<>{select('optimization_goal','Optimize delivery for',['','landing_page_views','link_clicks','conversions','reach','impressions','lead_generation','value'])}{field('conversion_event','Conversion event (for sales, e.g. purchase)')}<label className="studio-field">Audience<select value={values.demographics??''} onChange={e=>change('demographics',e.target.value)}><option value="">{editor.id?'Keep current targeting':'Broad audience'}</option><option value={JSON.stringify({automatic:true})}>Automatic audience</option><option value={JSON.stringify({automatic:false,minimum_age:18,maximum_age:65,gender:'all'})}>Adults 18–65, all genders</option></select></label><label className="studio-field">Placements<select value={values.placements??''} onChange={e=>change('placements',e.target.value)}><option value="">{editor.id?'Keep existing placements':'Default placements'}</option><option value="automatic">Automatic placements</option></select></label>{currentCampaign?.budget_optimization==='ad_group'&&<>{field('budget_amount','Group budget','number')}{select('budget_type','Budget type',['','daily','lifetime'])}</>}{field('starts_at','New start time (optional)','datetime-local')}{field('ends_at','New end time (optional)','datetime-local')}<label className="studio-field">Target countries (comma-separated ISO codes)<input placeholder="US, CA" value={values.regions?((JSON.parse(values.regions).include?.countries??[]) as string[]).join(', '):''} onChange={e=>change('regions',JSON.stringify({include:{countries:e.target.value.toUpperCase().split(',').map(x=>x.trim()).filter(Boolean)}}))}/></label><p className="studio-hint">New groups start paused. Country changes replace location targeting. Leave blank optional settings unchanged when editing.</p></>}
   {editor?.level==='ads'&&<><label className="studio-field">From Studio<select value={selectedDraft} onChange={e=>chooseDraft(e.target.value)}><option value="">Choose a finished creative</option>{drafts.map(d=><option key={d.id} value={d.id}>{d.sample?'Sample · ':''}{d.name}</option>)}</select></label>{preview&&<img className="campaign-art-preview" src={preview} alt="Selected finished Studio creative"/>}{selectedDraft&&<Button variant="surface" loading={uploading} disabled={busy||(!demo&&!!drafts.find(d=>d.id===selectedDraft)?.sample)} onClick={upload}>{demo?'Attach demo creative':'Upload finished artwork'}</Button>}<label className="studio-field">Whop creative file ID<input placeholder="file_…" value={values.creatives?text(list(JSON.parse(values.creatives))[0]?.id):''} onChange={e=>change('creatives',e.target.value?JSON.stringify([{id:e.target.value}]):'')}/></label><label className="studio-field">Connected page<select value={values.social_accounts?text(list(JSON.parse(values.social_accounts))[0]?.id):''} onChange={e=>change('social_accounts',e.target.value?JSON.stringify([{id:e.target.value}]):'')}><option value="">{editor.id?'Keep existing page':'Choose a Facebook page'}</option>{social.data?.data.filter(a=>a.platform==='facebook').map(a=><option key={a.id} value={a.id}>{text(a.name??a.username??a.title)||a.id}</option>)}</select></label>{field('headlines','Headline')}<label className="studio-field">Caption<textarea rows={4} value={values.primary_texts??''} onChange={e=>change('primary_texts',e.target.value)}/></label>{field('url','Destination URL')}{select('call_to_action','Call to action',['learn_more','sign_up','subscribe','shop_now','download','contact_us'])}<p className="studio-hint">Saving changes to a live ad replaces its copy or artwork. New ads in an active group may begin delivery.</p></>}
   </div>{error&&<p role="alert" className="campaign-error">{error}</p>}<div className="studio-confirm-actions"><Button variant="surface" disabled={busy||uploading} onClick={()=>setEditor(null)}>Cancel</Button><Button disabled={busy||uploading} onClick={review}>Review changes</Button></div>
  </Dialog.Content></Dialog.Root>
  <Dialog.Root open={!!pending} onOpenChange={o=>{if(!o&&!busy)setPending(null);}}><Dialog.Content className="campaign-editor" size="2"><Dialog.Title>{pending?.title}</Dialog.Title><Dialog.Description>{demo?'This updates only your local demo campaign workspace.':`This changes your real Whop ad account. Launching, resuming, duplicating, or adding ads to an active group can spend your configured budget. Changes are submitted to Whop and may require platform review.`}</Dialog.Description><div className="campaign-review-summary"><strong>{pending?text(data(pending.args[0] as AdLevel).find(x=>x.id===pending.args[2])?.title)||values.title:''}</strong>{editor&&<dl>{Object.entries(values).filter(([k,v])=>v).map(([k,v])=><div key={k}><dt>{{title:'Name',headlines:'Headline',primary_texts:'Caption',url:'Destination',regions:'Countries',social_accounts:'Page',creatives:'Artwork'}[k]??k.replaceAll('_',' ')}</dt><dd>{k==='regions'?(JSON.parse(v).include?.countries??[]).join(', '):k==='creatives'?'Attached creative':k==='social_accounts'?text(social.data?.data.find(a=>a.id===JSON.parse(v)[0]?.id)?.name)||'Selected page':k==='demographics'?(JSON.parse(v).automatic?'Automatic audience':'Adults 18–65, all genders'):k==='special_ad_categories'?(JSON.parse(v).join(', ')||'None'):v.replaceAll('_',' ')}</dd></div>)}</dl>}</div><details className="campaign-command"><summary>View exact change</summary><pre>{pending&&commandString(pending.args)}</pre></details>{error&&<p role="alert" className="campaign-error">{error}</p>}<div className="studio-confirm-actions"><Button variant="surface" disabled={busy} onClick={()=>setPending(null)}>Back</Button><Button loading={busy} onClick={execute}>{demo?'Apply to demo':'Confirm change'}</Button></div></Dialog.Content></Dialog.Root>
  <button className="studio-reset" onClick={()=>ask('Help me improve '+(currentCampaign?.title??'my ad campaigns')+'. Read the current performance and suggest changes; do not run writes.')}>Ask Claude for a second opinion</button>
 </section>;
}
