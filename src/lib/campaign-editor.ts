export type AdLevel = 'ad-campaigns' | 'ad-groups' | 'ads';
export type AdRecord = { id:string; title?:string; name?:string; status?:string; [key:string]:unknown };
export function campaignCommand(level:AdLevel, id:string|undefined, values:Record<string,string>, parent?:string, requestKey?:string){
 const args:string[]=[level,id?'update':'create',...(id?[id]:[])];
 if(!id){if(level==='ad-campaigns')args.push('--platform','meta','--budget_optimization','ad_campaign');
 else {if(!parent)throw Error('Choose a parent first.');args.push(level==='ads'?'--ad_group_id':'--ad_campaign_id',parent);if(level==='ad-groups')args.push('--status','paused');}
 if(requestKey)args.push('--idempotency-key',requestKey);}
 if(!id&&level==='ad-campaigns'&&!values.budget_amount?.trim())throw Error('Set a campaign budget.');
 const fields=Object.entries(values).filter(([,v])=>v.trim());
 if(!values.title?.trim())throw Error('Give this a name.');
 for(const [key,value] of fields){
  if(key==='budget_amount' && (!Number.isFinite(Number(value)) || Number(value)<=0))throw Error('Budget must be greater than zero.');
  if(key==='url'){try{if(new URL(value).protocol!=='https:')throw Error();}catch{throw Error('Use a complete HTTPS destination.');}}
  if(key==='starts_at'||key==='ends_at'){if(!Number.isFinite(Date.parse(value)))throw Error('Choose a valid date.');args.push('--'+key,new Date(value).toISOString());continue;}
  if(['regions','demographics','creatives','social_accounts','special_ad_categories','audiences'].includes(key)){JSON.parse(value);}
  if(key==='regions'){const countries=JSON.parse(value).include?.countries;if(countries&&(!countries.length||countries.some((c:string)=>! /^[A-Z]{2}$/.test(c))))throw Error('Use two-letter country codes, such as US or CA.');}
  if(key==='creatives'&&JSON.parse(value).some((c:{id?:string})=>!c.id?.startsWith('file_')&&!c.id?.startsWith('sample-')))throw Error('Use a Whop file ID.');
  if(key==='placements' && value!=='automatic')JSON.parse(value);
  args.push('--'+key,['headlines','primary_texts'].includes(key)?JSON.stringify([value]):value);
 }
 if(values.starts_at&&values.ends_at&&Date.parse(values.ends_at)<=Date.parse(values.starts_at))throw Error('End time must be after the start.');
 return args;
}
