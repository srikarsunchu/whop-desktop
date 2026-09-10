import { Button, Text, toast, AlertDialog, Dialog } from "frosted-ui";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { planPrice } from "../lib/format";
import { EMPTY_CONTEXT, PURPOSE_LABELS, FORMAT_LABELS, generationBrief, validDestination, type CreativeContext, type CreativePurpose, type CreativeFormat } from "../lib/studio-context";
import { saveAdDraft } from "../lib/studio-drafts";
import { PageHeader } from "../components/Panel";
import { runWhopJson, useAccount, useWhop, type Page, type Product } from "../lib/whop";

import { mediaArgs, pendingMedia, resolveMedia, type Generation } from "../lib/media";
import { loadGenerations as load, updateGenerations } from "../lib/studio-jobs";
import { DEFAULT_FINISH, renderCreative, canvasBytes, type Finish } from "../lib/studio-canvas";

export function Studio({ onOpenAds }: { onOpenAds: () => void }) {
  const { account } = useAccount();
  const saved = useMemo(()=>{try{return JSON.parse(localStorage.getItem(`studio.brief.${account?.id}`)??'{}');}catch{return {};}},[account?.id]);
  const [context, setContext] = useState<CreativeContext>({...EMPTY_CONTEXT,...saved.context});
  const [inspector, setInspector] = useState<'brief'|'adjust'|'copy'>('brief');
  const [composing, setComposing] = useState(false);
  const [useOpen, setUseOpen] = useState(false);
  const [useAction, setUseAction] = useState<'download'|'ad'>('download');
  const [handoff, setHandoff] = useState(false);
  const [handoffPreview, setHandoffPreview] = useState('');
  const [guides, setGuides] = useState(false);
  const [postPreview, setPostPreview] = useState(false);
  const [requestNonce,setRequestNonce] = useState(0);
  const [type, setType] = useState<"image" | "video">(load().find(g=>g.id===saved.selectedId && g.accountId===account?.id)?.type ?? load().find(g=>g.accountId===account?.id)?.type ?? "image");
  const [prompt, setPrompt] = useState(saved.prompt??"");
  const [duration, setDuration] = useState("5");
  const [resolution, setResolution] = useState("1080p");
  const [items, setItems] = useState<Generation[]>(load);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const generating = useRef(false);
  const refreshingIds = useRef(new Set<string>());
  const [references, setReferences] = useState<{id:string; url:string; name:string}[]>([]);
  const [selectedId, setSelectedId] = useState(saved.selectedId ?? load().find(g=>g.accountId===account?.id)?.id ?? 'new');
  const [parentId, setParentId] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [imageError, setImageError] = useState('');
  const [edit, setEdit] = useState<Finish>(DEFAULT_FINISH);
  const [dragging, setDragging] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const uploadLock = useRef(false);
  const activeAccount = useRef(account?.id);
  activeAccount.current = account?.id;
  const products = useWhop<Page<Product & {description?:string}>>(["products", "list", "--first", "100"]);
  const referenceKey = references.map(r=>r.id).join(',');
  useEffect(()=>{localStorage.setItem(`studio.brief.${account?.id}`,JSON.stringify({context,prompt,selectedId}));},[account?.id,context,prompt,selectedId]);
  const changeContext=(patch:Partial<CreativeContext>)=>setContext(c=>({...c,...patch}));
  const requestKey = useMemo(() => crypto.randomUUID(), [type, prompt, duration, resolution, account?.id, referenceKey, context.purpose, context.format, requestNonce]);

  useEffect(() => {
    const changed = () => setItems(load());
    window.addEventListener("whopdesktop:studio-updated", changed);
    return () => window.removeEventListener("whopdesktop:studio-updated", changed);
  }, []);

  const args = mediaArgs({ type, prompt: generationBrief(prompt,context), duration, resolution, requestKey, demo: !!account?.demo, accountId: account?.id, referenceIds: references.map(r=>r.id) });

  const mine = items.filter((g) => g.accountId === (account?.id ?? ""));
  const getFile = (id: string) => runWhopJson(["files", "get", id]);

  const generate = async () => {
    const p = prompt.trim();
    if (!p || !account || generating.current) return;
    generating.current = true;
    setBusy(true);
    const local: Generation = { id: `pending-${requestKey}`, type, prompt: p, status: "processing", createdAt: Date.now(), accountId: account.id, sample: !!account.demo, parentId, referenceIds: references.map(r=>r.id), context: {...context} };
    updateGenerations((xs) => [local, ...xs.filter((g) => g.id !== local.id)]);
    setSelectedId(local.id);setComposing(false);
    localStorage.setItem(`studio.finish.${account.id}.${local.id}`,JSON.stringify({...DEFAULT_FINISH,format:context.format}));
    setConfirming(false);
    try {
      const asset = await runWhopJson(args, !!account.demo);
      const result = await resolveMedia(asset, local, getFile);
      localStorage.setItem(`studio.finish.${account.id}.${result.id}`,JSON.stringify({...DEFAULT_FINISH,format:context.format}));
      if(activeAccount.current===account.id)setSelectedId(result.id);
      updateGenerations((xs) => xs.map((g) => g.id === local.id ? result : g));
      if (result.status === "failed") toast.error(result.error ?? "Generation failed");
      else {
        toast.success(account.demo ? "Sample preview ready · no charge" : result.status === "completed" ? "Generation ready" : "Generation started");
        setRequestNonce(n=>n+1);
      }
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? String(e);
      updateGenerations((xs) => xs.map((g) => g.id === local.id ? { ...g, status: "failed", error: msg } : g));
      toast.error(msg);
    } finally {
      generating.current = false;
      setBusy(false);
    }
  };

  const refresh = useCallback(async (g: Generation) => {
    if (g.id.startsWith("pending-") || refreshingIds.current.has(g.id)) return;
    refreshingIds.current.add(g.id);
    setRefreshing(g.id);
    try {
      const asset = await runWhopJson(["media", "get", g.id], !!g.sample);
      const next = await resolveMedia(asset, g, (id) => runWhopJson(["files", "get", id]));
      updateGenerations((xs) => xs.map((x) => x.id === g.id ? next : x));
    } catch (e) {
      const error = (e as { message?: string })?.message ?? "Could not refresh. Try again.";
      updateGenerations((xs) => xs.map((x) => x.id === g.id ? { ...x, error } : x));
    } finally {
      refreshingIds.current.delete(g.id);
      setRefreshing(null);
    }
  }, []);

  const selected = mine.find(g=>g.id===selectedId);
  const selectedKey = selected ? `${account?.id}.${selected.id}` : '';
  useEffect(()=>{
    try { const finish={...DEFAULT_FINISH,format:selected?.context?.format??'original',...JSON.parse(localStorage.getItem(`studio.finish.${selectedKey}`) ?? '{}')};setEdit(finish);if(selected)setContext(c=>({...c,format:finish.format})); }
    catch {setEdit(DEFAULT_FINISH);}
  },[selectedKey]);
  const changeEdit=(patch:Partial<Finish>)=>setEdit(current=>{
    const next={...current,...patch};
    localStorage.setItem(`studio.finish.${selectedKey}`,JSON.stringify(next));return next;
  });
  useEffect(()=>{
    let disposed=false, objectUrl=''; image.current=null;setImageReady(false);setImageError('');
    if(selected?.type!=='image' || !selected.url) return;
    (async()=>{
      let source=selected.url!;
      if(source.startsWith('https:')) {
        const bytes=await invoke<number[]>('studio_read_image',{url:source});
        objectUrl=URL.createObjectURL(new Blob([new Uint8Array(bytes)]));source=objectUrl;
      }
      const img=new Image();
      await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(Error('Preview unavailable. Refresh this asset to try again.'));img.src=source;});
      await document.fonts.ready;
      if(!disposed){image.current=img;setImageReady(true);}else if(objectUrl){URL.revokeObjectURL(objectUrl);}
    })().catch(e=>{if(!disposed)setImageError(String(e));});
    return ()=>{disposed=true;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[selected?.url,selected?.type,selected?.id]);
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>{if(canvas.current && image.current && imageReady)renderCreative(canvas.current,image.current,edit);});
    return ()=>cancelAnimationFrame(frame);
  },[edit,imageReady,postPreview]);
  const finishedCanvas=()=>{
    if(!image.current || !imageReady)throw Error('Wait for the preview to load.');
    const output=document.createElement('canvas');
    renderCreative(output,image.current,edit);
    return output;
  };

  const addReferences=async(files:File[])=>{
    if(uploadLock.current || busy || !account)return;
    const owner=account.id; uploadLock.current=true;setUploading(true);
    try{
      if(files.length+references.length>4)throw Error('Use up to four reference images.');
      for(const file of files){
        if(!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size>15_000_000)throw Error('Choose PNG, JPEG or WebP images under 15 MB.');
      }
      for(const file of files){
        const bytes=Array.from(new Uint8Array(await file.arrayBuffer()));
        const id=account.demo ? `sample-${crypto.randomUUID()}` : await invoke<string>('studio_upload_image',{filename:file.name,bytes});
        if(!account.demo){
          let ready=false;
          for(let attempt=0;attempt<20;attempt++){
            const result=await runWhopJson<{upload_status?:string;data?:{upload_status?:string}}>(['files','get',id]);
            const status=(result.data??result).upload_status;
            if(status==='ready'){ready=true;break;}
            if(status==='failed')throw Error('Whop could not prepare this reference.');
            await new Promise(resolve=>setTimeout(resolve,1500));
          }
          if(!ready)throw Error('Reference is still processing. Please upload it again later.');
        }
        const url=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file);});
        if(activeAccount.current===owner)setReferences(xs=>[...xs,{id,url,name:file.name}].slice(0,4));
      }
    }catch(e){toast.error(String(e));}finally{uploadLock.current=false;setUploading(false);}
  };
  const useSelected=(animate:boolean)=>{
    if(!selected?.url || selected.type!=='image' || (!selected.fileId && !selected.sample))return;
    setReferences([{id:selected.fileId ?? selected.id,url:selected.url,name:animate?'Opening frame':'Source image'}]);
    setComposing(true);setInspector('brief');setContext({...EMPTY_CONTEXT,...selected.context});
    setParentId(selected.id);setType(animate?'video':'image');
    setPrompt(animate?'Slow, deliberate camera push in. Preserve the subject and composition. Subtle natural movement, no added text.':selected.prompt);
    toast.success(animate?'Opening frame added. Describe the motion, then generate.':'Reference added. Edit the brief to make a new version.');
  };
  const exportAsset=async()=>{
    if(!selected?.url)return;setExporting(true);
    try{
      if(selected.type==='image'){
        if(!canvas.current || !imageReady)throw Error('Wait for the preview to load.');
        const bytes=await canvasBytes(finishedCanvas());
        await invoke('studio_save',{bytes,url:null,video:false});
      }else if(selected.sample){
        const bytes=Array.from(new Uint8Array(await (await fetch(selected.url)).arrayBuffer()));
        await invoke('studio_save',{bytes,url:null,video:true});
      }else await invoke('studio_save',{bytes:null,url:selected.url,video:true});
      updateGenerations(xs=>xs.map(g=>g.id===selected.id?{...g,exportedAt:Date.now()}:g));
      toast.success('Saved to Downloads');
    }catch(e){toast.error(String(e));}finally{setExporting(false);}
  };

  const selectAsset=(g:Generation)=>{
    setSelectedId(g.id);setContext({...EMPTY_CONTEXT,...g.context});setPrompt(g.prompt);setType(g.type);
    setReferences([]);setParentId(undefined);setComposing(false);setPostPreview(false);
  };
  const newCreative=()=>{setSelectedId('new');setComposing(true);setParentId(undefined);setReferences([]);setPrompt('');setInspector('brief');changeContext({concept:'Untitled concept'});};
  const saveContext=()=>{
    if(selected && !composing)updateGenerations(xs=>xs.map(g=>g.id===selected.id?{...g,context:{...context}}:g));
  };
  useEffect(()=>{saveContext();},[context]);
  const chooseProduct=(id:string)=>{
    const product=products.data?.data.find(p=>p.id===id);
    if(!product){changeContext({productId:'',productTitle:'',planId:'',price:'',destinationUrl:''});return;}
    changeContext({productId:id,productTitle:product.title,planId:product.default_plan?.id??'',price:planPrice(product.default_plan),destinationUrl:account?.demo?'':`https://whop.com/${account?.route?`${account.route}/`:''}${product.route}`,concept:context.concept==='Untitled concept'?`${product.title} launch`:context.concept});
    if(!prompt)setPrompt(`Introduce ${product.title}. ${product.description??''} Show the value of the offer with a clear focal point. Leave space for text.`.slice(0,2000));
  };
  const setFormat=(format:CreativeFormat)=>{changeContext({format});if(selected?.type==='image' && !composing)changeEdit({format});};
  const openUse=()=>{
    setHandoffPreview(selected?.type==='image' && imageReady?finishedCanvas().toDataURL('image/png'):selected?.url??'');
    setUseAction(context.purpose==='ad'?'ad':'download');setUseOpen(true);
  };
  const continueUse=async()=>{
    if(!selected?.url || handoff)return;
    if(useAction==='download'){await exportAsset();return;}
    setHandoff(true);
    try{
      let media:Blob;
      if(selected.type==='image'){
        if(!canvas.current || !imageReady)throw Error('Wait for the image preview to load.');
        media=new Blob([new Uint8Array(await canvasBytes(finishedCanvas()))],{type:'image/png'});
      }else if(selected.sample)media=await (await fetch(selected.url)).blob();
      else {
        // Video draft keeps its remote identity; it does not pretend a local download exists.
        media=new Blob([],{type:selected.contentType??'video/mp4'});
      }
      const id=selected.adDraftId??crypto.randomUUID();
      await saveAdDraft({id,accountId:selected.accountId,assetId:selected.id,name:context.concept,type:selected.type,sample:!!selected.sample,context:{...context},media,createdAt:Date.now()});
      updateGenerations(xs=>xs.map(g=>g.id===selected.id?{...g,adDraftId:id,context:{...context}}:g));
      setUseOpen(false);toast.success('Creative and copy saved to Ads');onOpenAds();
    }catch(e){toast.error(String(e));}finally{setHandoff(false);}
  };

  return (
    <div className="stack studio-page">
      <PageHeader title="Studio" subtitle="Create something for your next sale." actions={<><Button variant="surface" size="2" onClick={newCreative}>New creative</Button><Button size="2" disabled={!selected?.url || composing || (selected.type==='image' && !imageReady)} onClick={openUse}>Use creative ↗</Button></>} />
      <div className="studio-offer-bar">
        <div className="offer-identity"><span className="offer-symbol">↗</span><div><span className="studio-eyebrow">WHAT YOU’RE PROMOTING</span><select aria-label="Offer" value={context.productId} onChange={e=>chooseProduct(e.target.value)}><option value="">Choose an offer</option>{products.data?.data.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></div></div>
        <div className="offer-detail"><span>Default plan</span><strong>{context.price && context.price!=='—'?context.price:'No plan selected'}</strong></div>
        <div className="offer-destination"><span>Destination</span><input aria-label="Offer destination" placeholder={account?.demo?'Demo offer · add a link to preview':'https://whop.com/your-offer'} value={context.destinationUrl} onChange={e=>changeContext({destinationUrl:e.target.value})}/></div>
        <span className="offer-purpose">{PURPOSE_LABELS[context.purpose]} · {context.format==='story'?'9:16':context.format==='square'?'1:1':context.format==='landscape'?'16:9':'Original'}</span>
      </div>
      {products.error && <p className="studio-hint" role="alert">Could not load products. You can keep creating and enter a destination manually.</p>}
      <div className="creative-workspace studio-workflow">
        <section className="creative-stage">
          <div className="creative-toolbar"><div><span className="studio-state-dot"/><span>{composing?`New ${type}${parentId?' · using selected image as reference':''}`:selected?`${selected.sample?'Sample · ':''}${selected.adDraftId?'Ad draft saved':selected.exportedAt?'Exported':'Draft'}`:'New creative'}</span></div><div>{selected?.type==='image' && selected.url && !composing && <><button disabled={busy} onClick={()=>useSelected(false)}>Variation</button><button disabled={busy} onClick={()=>useSelected(true)}>Animate ↗</button></>}<button aria-pressed={guides} onClick={()=>setGuides(v=>!v)}>Guides</button><button aria-pressed={postPreview} onClick={()=>setPostPreview(v=>!v)} disabled={!selected?.url || composing}>{postPreview?'Canvas':'Post preview'}</button></div></div>
          {composing && parentId && <div className="studio-source-banner">Opening reference below · your new {type} will appear after generation.<button onClick={()=>{setComposing(false);setType(selected?.type??'image');}}>Back to saved creative</button></div>}
          <div className={`creative-preview ${postPreview?'as-post':''}`}>
            <div className="studio-preview-frame">
            {postPreview && <div className="post-preview-header"><span className="post-avatar">{account?.title?.slice(0,1)}</span><div><strong>{account?.title}</strong><small>{context.purpose==='ad'?'Sponsored preview':'Post preview'}</small></div><span>···</span></div>}
            {selected?.url ? selected.type==='image'?<><canvas ref={canvas} aria-label="Creative preview with editable typography" style={{display:imageReady?'block':'none'}}/>{!imageReady && <p>{imageError || 'Preparing preview…'}</p>}</>:<video key={selected.url} src={selected.url} controls playsInline preload="metadata" onError={()=>toast.error('Video preview unavailable. Refresh the asset.')}/>:<div className="creative-empty"><div className="empty-frame">✳</div><h2>{selected?pendingMedia(selected)?'Your creative is taking shape':'Generation needs attention':'Choose what you’re promoting.'}</h2><p>{selected?selected.error ?? 'You can keep working while Whop generates your creative.':'Choose a destination and format, then describe the creative or add a reference.'}</p></div>}
            {guides && selected?.type==='image' && <div className="studio-safe-guide" aria-label="Composition guide"><span>Keep key content inside</span></div>}
            {postPreview && <div className="post-preview-copy"><p>{context.postCopy || 'Write a caption in the Copy tab.'}</p>{context.adHeadline && <strong>{context.adHeadline}</strong>}<span>{context.callToAction.replaceAll('_',' ')}</span></div>}
            </div>
          </div>
          {selected && <div className="creative-caption"><div><span>{selected.sample?'Sample · ':''}{selected.status}{selected.cost && !selected.sample?` · $${Number(selected.cost).toFixed(2)}`:''}</span><p>{selected.prompt}</p>{selected.error && <p role="alert">{selected.error}</p>}</div><div className="studio-asset-actions"><button onClick={()=>{setPrompt(selected.prompt);setType(selected.type);setInspector('brief');}}>Reuse brief</button>{!selected.id.startsWith('pending-') && <button disabled={refreshing===selected.id} onClick={()=>refresh(selected)}>{refreshing===selected.id?'Checking…':'Refresh'}</button>}<button onClick={()=>{updateGenerations(xs=>xs.filter(x=>x.id!==selected.id));setSelectedId('new');}}>Remove</button></div></div>}
          <div className="creative-filmstrip" aria-label="Creative versions">{mine.map((g,i)=><button key={g.id} className={selected?.id===g.id?'is-selected':''} onClick={()=>selectAsset(g)} aria-label={`Select ${g.type} ${mine.length-i}`} aria-pressed={selected?.id===g.id}>{g.url?g.type==='image'?<img src={g.url} alt=""/>:<video src={g.url} muted preload="metadata"/>:<span className="filmstrip-pending">{pendingMedia(g)?'◌':'!'}</span>}<span>{g.context?.concept ?? `${g.type==='video'?'Video':'Image'} ${mine.length-i}`}{g.parentId?' · variation':''}</span></button>)}{!mine.length && <span className="studio-hint">Your creative history, all in one place.</span>}</div>
        </section>
        <aside className="studio-inspector">
          <div className="inspector-tabs" role="tablist" aria-label="Creative controls"><button role="tab" aria-selected={inspector==='brief'} onClick={()=>setInspector('brief')}>Brief</button><button role="tab" aria-selected={inspector==='adjust'} onClick={()=>{setInspector('adjust');setPostPreview(false);}} disabled={!selected?.url || selected.type!=='image' || composing}>Artwork</button><button role="tab" aria-selected={inspector==='copy'} onClick={()=>{setInspector('copy');setPostPreview(true);}} disabled={!selected?.url || composing}>Copy</button></div>
          <div className="inspector-body">
          {inspector==='brief'?<>
            <label className="studio-field">What are you making?<select value={context.purpose} onChange={e=>changeContext({purpose:e.target.value as CreativePurpose})}>{Object.entries(PURPOSE_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
            <label className="studio-field">Placement / format<select value={context.format} onChange={e=>setFormat(e.target.value as CreativeFormat)}>{Object.entries(FORMAT_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
            <label className="studio-field">Concept name<input value={context.concept} maxLength={80} onChange={e=>changeContext({concept:e.target.value})} placeholder="A reason to join"/></label>
          <div className="studio-mode" aria-label="Media type">{(['image','video'] as const).map(t=><button key={t} aria-pressed={type===t} disabled={busy} onClick={()=>setType(t)}>{t==='image'?'Image':'Video'}</button>)}</div>
          <label className="studio-field">{type==='video'?'Describe the motion':'Describe your creative'}
            <textarea className="studio-prompt" placeholder={type==='image'?'Subject, setting, light. What should someone feel?':'Camera movement, action, atmosphere…'} value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={2000} rows={4} disabled={busy}/>
          </label>
          <div className="studio-section-heading"><span>{type==='video' && references.length===1?'Opening frame':'References'}</span><span>{references.length}/4</span></div>
          <div className={`reference-drop ${dragging?'is-dragging':''}`} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);void addReferences(Array.from(e.dataTransfer.files));}}>
            <input ref={picker} type="file" multiple accept="image/png,image/jpeg,image/webp" hidden onChange={e=>{void addReferences(Array.from(e.target.files??[]));e.target.value='';}}/>
            {references.length>0 && <div className="reference-list">{references.map(r=><div key={r.id}><img src={r.url} alt={r.name}/><button aria-label={`Remove ${r.name}`} disabled={busy || uploading} onClick={()=>setReferences(xs=>xs.filter(x=>x.id!==r.id))}>×</button></div>)}</div>}
            <button className="reference-picker" onClick={()=>picker.current?.click()} disabled={uploading || busy || references.length>=4}>{uploading?'Uploading…':'+ Add reference images'}<small>Drop from Finder · PNG, JPG, WebP</small></button>
          </div>
          {type==='video' && <><p className="studio-hint">{references.length===1?'This image seeds the opening frame.':'Multiple references guide subject and style.'}</p><div className="studio-setting-row"><label className="studio-field">Length<select value={duration} onChange={e=>setDuration(e.target.value)}>{['5','10','15'].map(x=><option key={x} value={x}>{x} seconds</option>)}</select></label><label className="studio-field">Resolution<select value={resolution} onChange={e=>setResolution(e.target.value)}>{['480p','720p','1080p','4k'].map(x=><option key={x}>{x}</option>)}</select></label></div><p className="studio-hint">Resolution availability depends on Whop’s generation model.</p></>}


          </>:inspector==='copy'?<>
            <div className="studio-section-heading"><span>Post & ad copy</span><span>Live preview</span></div>
            <label className="studio-field">Headline<input maxLength={150} value={context.adHeadline} onChange={e=>changeContext({adHeadline:e.target.value})} placeholder="A reason to click"/></label>
            <label className="studio-field">Caption<textarea rows={7} maxLength={2200} value={context.postCopy} onChange={e=>changeContext({postCopy:e.target.value})} placeholder="What does your offer help someone do?"/></label>
            <span className="studio-hint">{context.postCopy.length}/2,200 characters · Saved on this Mac</span>
            <label className="studio-field">Call to action<select value={context.callToAction} onChange={e=>changeContext({callToAction:e.target.value})}><option value="learn_more">Learn more</option><option value="sign_up">Sign up</option><option value="subscribe">Subscribe</option><option value="shop_now">Shop now</option></select></label>
            <p className="studio-hint">Your headline and caption travel with the finished artwork into Ads.</p>
          </>:<>
            <div className="studio-section-heading"><span>Artwork adjustments</span><span>{FORMAT_LABELS[context.format]}</span></div>
          <fieldset disabled={!selected?.url || selected.type!=='image'}>

            <label className="studio-field">Text on artwork<textarea rows={3} maxLength={120} placeholder="Your next big thing." value={edit.headline} onChange={e=>changeEdit({headline:e.target.value})}/></label>
            <label className="studio-field">Second line on artwork<input maxLength={100} placeholder="A detail. A price. A reason to act." value={edit.caption} onChange={e=>changeEdit({caption:e.target.value})}/></label>
            <label className="studio-field">Placement<select value={edit.position} onChange={e=>changeEdit({position:e.target.value as Finish['position']})}><option value="bottom">Bottom left</option><option value="top">Top left</option></select></label>
            <label className="studio-color">Text color<input type="color" value={edit.color} onChange={e=>changeEdit({color:e.target.value})}/></label>
            <label className="studio-check"><input type="checkbox" checked={edit.shade} onChange={e=>changeEdit({shade:e.target.checked})}/>Shade behind text</label>
            <label className="studio-field">Format<select value={context.format} onChange={e=>setFormat(e.target.value as CreativeFormat)}>{Object.entries(FORMAT_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
            <label className="studio-field">Horizontal crop · {edit.offsetX}%<input type="range" min="0" max="100" value={edit.offsetX} onChange={e=>changeEdit({offsetX:Number(e.target.value)})}/></label>
            <label className="studio-field">Vertical crop · {edit.offsetY}%<input type="range" min="0" max="100" value={edit.offsetY} onChange={e=>changeEdit({offsetY:Number(e.target.value)})}/></label>
            <button className="studio-reset" onClick={()=>changeEdit({offsetX:50,offsetY:50})}>Center crop</button>
            <button className="studio-reset" onClick={()=>changeEdit({...DEFAULT_FINISH,format:context.format})}>Reset adjustments</button>
          </fieldset>
          <p className="studio-hint">{selected?.type==='video'?'Video exports preserve the original clip. Typography is available for images.':'Reposition the image within the frame. Your original stays in history.'}</p>
          {selected?.type==='image' && <p className="studio-hint">Animate uses the original image, before typography.</p>}

          </>}
          </div>
          {inspector==='brief' && (<div className="studio-generate"><Button size="3" disabled={!account || !prompt.trim() || busy || uploading} loading={busy} onClick={()=>account?.demo?generate():setConfirming(true)}>{account?.demo?'Preview sample':`Generate ${type}`} <span aria-hidden="true">↗</span></Button><p className="studio-hint">{account?.demo?'Sample preview · not generated from your prompt · no charge':'Uses your Whop balance. Review before generating.'}</p></div>)}
        </aside>
      </div>
      <Dialog.Root open={useOpen} onOpenChange={setUseOpen}><Dialog.Content className="studio-use-dialog" size="3"><Dialog.Title>Use this creative</Dialog.Title><Dialog.Description>{context.concept} · Review before you continue</Dialog.Description>
        <div className="handoff-review">
          {selected?.type==='image'?<img src={handoffPreview} alt="Finished creative, including your artwork edits"/>:<video src={handoffPreview} controls/>}
          <div><span className="studio-eyebrow">YOUR OFFER</span><strong>{context.productTitle || 'No offer selected'}</strong><span>{context.price || 'No price selected'}</span><p>{context.destinationUrl || 'Destination not added yet'}</p><small>{FORMAT_LABELS[context.format]}{selected?.sample?' · Sample':''}</small></div>
        </div>
        <div className="studio-use-options"><button aria-pressed={useAction==='download'} onClick={()=>setUseAction('download')}><strong>Download for posting</strong><span>Save your finished artwork. Copy the caption separately.</span></button><button aria-pressed={useAction==='ad'} onClick={()=>setUseAction('ad')}><strong>Continue to an ad draft</strong><span>Keep the creative, offer and copy together in Ads.</span></button></div>
        <label className="studio-field">Post copy<textarea rows={3} value={context.postCopy} maxLength={2200} onChange={e=>changeContext({postCopy:e.target.value})} placeholder="What should someone know before they click?"/></label>
        {useAction==='ad' && <><label className="studio-field">Ad headline<input value={context.adHeadline} onChange={e=>changeContext({adHeadline:e.target.value})} maxLength={150}/></label><label className="studio-field">Call to action<select value={context.callToAction} onChange={e=>changeContext({callToAction:e.target.value})}><option value="learn_more">Learn more</option><option value="sign_up">Sign up</option><option value="subscribe">Subscribe</option><option value="shop_now">Shop now</option></select></label><label className="studio-field">Destination link<input value={context.destinationUrl} onChange={e=>changeContext({destinationUrl:e.target.value})} placeholder="https://whop.com/your-offer"/></label>{context.destinationUrl && !validDestination(context.destinationUrl) && <p role="alert" className="studio-hint">Enter a complete HTTPS destination link.</p>}<p className="studio-hint">Saved on this Mac. Nothing is published and no ad budget is spent.</p></>}
        <div className="studio-confirm-actions"><Button variant="surface" disabled={!context.postCopy} onClick={async()=>{try{await navigator.clipboard.writeText(context.postCopy);toast.success('Post copy copied');}catch{toast.error('Could not copy text');}}}>Copy post text</Button><Button loading={handoff || exporting} disabled={handoff || exporting || (useAction==='ad' && !!context.destinationUrl && !validDestination(context.destinationUrl))} onClick={continueUse}>{useAction==='ad'?'Save draft & open Ads':`Download ${selected?.type==='video'?'video':'PNG'}`}</Button></div>
      </Dialog.Content></Dialog.Root>
      <AlertDialog.Root open={confirming} onOpenChange={setConfirming}><AlertDialog.Content size="2"><AlertDialog.Title>Generate {type}</AlertDialog.Title><AlertDialog.Description>Whop will bill this generation from your balance. {references.length} reference image{references.length===1?'':'s'}. {type==='video'?`${duration} seconds · ${resolution}.`:''}</AlertDialog.Description><p className="studio-confirm-prompt">{prompt}</p><div className="studio-confirm-actions"><AlertDialog.Cancel><Button variant="soft" color="gray">Cancel</Button></AlertDialog.Cancel><Button onClick={generate} loading={busy}>Generate {type}</Button></div></AlertDialog.Content></AlertDialog.Root>
    </div>
  );
}
