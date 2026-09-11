import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, toast } from 'frosted-ui';
import { invoke } from '@tauri-apps/api/core';
import { claudeAvailable } from '../lib/assistant';
import { useAccount, type Account } from '../lib/whop';

const message = (e: unknown) => e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e);
export function Welcome({open,onFinish}:{open:boolean;onFinish:(account:Account,assistant:boolean)=>void}) {
  const {account,cliPath,loggedIn,accounts,refreshAccounts}=useAccount();
  const [step,setStep]=useState(0);
  const [selected,setSelected]=useState('');
  const [demo,setDemo]=useState(false);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [claude,setClaude]=useState<{installed:boolean;connected:boolean}|null>(null);
  const lock=useRef(false);
  const real=accounts.filter(a=>!a.demo);
  const chosen=demo?accounts.find(a=>a.demo):real.find(a=>a.id===selected);
  useEffect(()=>{if(open){setStep(0);setError('');setDemo(false);setSelected(account&&!account.demo?account.id:'');}},[open]);
  useEffect(()=>{if(!real.some(a=>a.id===selected))setSelected(real[0]?.id??'');},[accounts,selected]);
  const task=async(name:string,fn:()=>Promise<void>)=>{
    if(lock.current)return;
    lock.current=true;setBusy(name);setError('');
    try{await fn();}catch(e){setError(message(e));}finally{lock.current=false;setBusy('');}
  };
  const checkClaude=async()=>{
    const installed=!!await claudeAvailable();
    setClaude({installed,connected:false});
    const connected=installed?await invoke<boolean>('claude_auth_status'):false;
    setClaude({installed,connected});
  };
  useEffect(()=>{if(open&&step===2)void task('Checking Claude',checkClaude);},[open,step]);
  const external=(url:string)=>task('Opening browser',async()=>{await invoke('open_external',{url});});
  const copy=async(text:string)=>{try{await navigator.clipboard.writeText(text);toast.success('Copied. Paste into Terminal.');}catch{setError('Could not copy. Select the command below to copy it manually.');}};
  const next=(n:number)=>{setError('');setStep(n);};
  const startDemo=()=>{setDemo(true);next(2);};
  const titles=['Your Whop, on your Mac.','Connect your business.','Connect your assistant.','You’re ready to get to work.'];
  const descriptions=[
    'Your business and an assistant in one workspace. Let’s get you connected.',
    'Sign in with Whop, then choose the business you want to work on.',
    'Connect Claude to ask questions about your business and work through your next idea.',
    'Start with your business overview or a conversation. You can change connections in Account anytime.',
  ];
  return <Dialog.Root open={open}><Dialog.Content className="welcome-dialog welcome-flow" size="3">
    <div className="welcome-top"><span className="welcome-label">WHOP DESKTOP</span><span className="welcome-step">{step===0?'WELCOME':`STEP ${step} OF 3`}</span></div>
    <Dialog.Title>{titles[step]}</Dialog.Title>
    <Dialog.Description>{descriptions[step]}</Dialog.Description>
    {step>0&&<div className="welcome-progress" aria-label={`Setup step ${step} of 3`}>{['Business','Assistant','Ready'].map((label,i)=><span key={label} data-active={step===i+1} data-done={step>i+1&&(i!==1||!!claude?.connected)}>{step>i+1?(i===1&&!claude?.connected?'–':'✓'):i+1} · {label}</span>)}</div>}
    {step===0&&<>
      <div className="welcome-preview"><span className="welcome-demo-mark">↗</span><div><strong>A place to run your business.</strong><p>Check revenue. Understand your members. Turn an idea into a creative and an ad draft.</p></div></div>
      <Button className="welcome-primary" size="3" onClick={()=>next(1)}>Set up my workspace →</Button>
      <Button className="welcome-primary" size="2" variant="surface" onClick={startDemo}>Try a demo first</Button>
      <p className="welcome-note">Already use Whop or Claude Code on this Mac? We’ll check your existing connections. The demo uses a fictional business.</p>
    </>}
    {step===1&&<div className="welcome-body">
      <div className="welcome-connection"><span className="welcome-status" data-ready={!!cliPath}>{cliPath?'✓':'1'}</span><div><strong>{cliPath?'Whop is installed':'Install the Whop connection'}</strong><p>{cliPath?'Ready to connect to your Whop account.':'The app uses the official Whop CLI to connect. This is a one-time setup on your Mac.'}</p></div></div>
      {!cliPath&&<div className="welcome-install"><p>Open the macOS Terminal app, paste this command, and press Return.</p><code>curl -fsSL https://whop.com/install.sh | sh</code><div className="welcome-actions"><Button size="2" variant="surface" onClick={()=>copy('curl -fsSL https://whop.com/install.sh | sh')}>Copy install command</Button><Button size="2" variant="ghost" disabled={!!busy} onClick={()=>external('https://github.com/whopio/whop-public-cli')}>Installation help ↗</Button></div></div>}
      {!!cliPath&&!loggedIn&&<><Button className="welcome-primary" size="3" loading={busy==='Signing in to Whop'} disabled={!!busy} onClick={()=>task('Signing in to Whop',async()=>{await invoke('whop_login');await refreshAccounts();})}>{busy==='Signing in to Whop'?'Finish signing in in your browser…':'Sign in with Whop ↗'}</Button><p className="welcome-note">Your browser opens for sign-in. Return here when you’re done.</p></>}
      {cliPath&&loggedIn&&<><div className="welcome-connection"><span className="welcome-status" data-ready>✓</span><div><strong>Signed in to Whop</strong><p>Choose the business to open. You can switch later.</p></div></div>{real.length>0?<div className="welcome-businesses" role="radiogroup" aria-label="Choose your business">{real.map(a=><button type="button" role="radio" aria-checked={selected===a.id} className="welcome-business" key={a.id} onClick={()=>setSelected(a.id)}><span className="welcome-business-icon">{a.title.slice(0,1)}</span><span>{a.title}</span><span className="welcome-radio">{selected===a.id?'●':'○'}</span></button>)}</div>:<div className="welcome-install"><strong>No businesses are available yet.</strong><p>If you already have a business, check that you signed in with the right Whop account. Otherwise, create a business on Whop and check again.</p><Button size="2" variant="surface" onClick={()=>external('https://whop.com/')}>Open Whop ↗</Button></div>}</>}
      <div className="welcome-actions"><Button variant="surface" size="2" loading={busy==='Checking Whop'} disabled={!!busy} onClick={()=>task('Checking Whop',async()=>{await refreshAccounts();})}>{cliPath?'Refresh connection':'I’ve installed it — check again'}</Button>{!!cliPath&&loggedIn&&<Button size="2" disabled={!!busy} variant="ghost" onClick={()=>task('Signing in to Whop',async()=>{await invoke('whop_login');await refreshAccounts();})}>Use another login</Button>}</div>
      <Button className="welcome-primary" size="3" disabled={!!busy||!cliPath||!loggedIn||!chosen} onClick={()=>next(2)}>Continue →</Button>
    </div>}
    {step===2&&<div className="welcome-body">
      <div className="welcome-connection"><span className="welcome-status" data-ready={!!claude?.connected}>{claude?.connected?'✓':'✦'}</span><div><strong>{claude?.connected?'Claude is connected':claude?.installed?'Connect your Claude account':'Connect Claude Code'}</strong><p>{claude?.connected?'Your existing Claude connection is ready to use.':'The assistant uses Claude Code on your Mac. You’ll need an account with Claude Code access.'}</p></div></div>
      {demo&&<p className="welcome-note">You’re trying Northwind Picks, a fictional business. Chat still uses your Claude account; Studio samples work without it.</p>}
      {!claude?.installed&&claude!==null&&<Button className="welcome-primary" size="3" disabled={!!busy} onClick={()=>external('https://claude.com/claude-code')}>Get Claude Code ↗</Button>}
      {claude?.installed&&!claude.connected&&<Button className="welcome-primary" size="3" disabled={!!busy} loading={busy==='Connecting Claude'} onClick={()=>task('Connecting Claude',async()=>{await invoke('claude_login');await checkClaude();})}>{busy==='Connecting Claude'?'Finish signing in in your browser…':'Connect Claude ↗'}</Button>}
      {!claude?.connected&&<Button className="welcome-primary" variant="surface" disabled={!!busy} loading={busy==='Checking Claude'} onClick={()=>task('Checking Claude',checkClaude)}>Check connection</Button>}
      <p className="welcome-note">Chat uses your Claude account’s usage. Live image generation is separate and is billed from your Whop balance after you confirm.</p>
      <Button className="welcome-primary" size="3" variant={claude?.connected?'classic':'surface'} disabled={!!busy} onClick={()=>next(3)}>{claude?.connected?'Continue →':'Skip Claude for now'}</Button>
      {!claude?.connected&&<p className="welcome-note">You can still explore your dashboards and Studio. Connect Claude later from the Assistant.</p>}
    </div>}
    {step===3&&<div className="welcome-body">
      <div className="welcome-preview"><span className="welcome-business-icon">{chosen?.title.slice(0,1)??'W'}</span><div><strong>{chosen?.title??'Choose a business to continue'}</strong><p>{demo?'Demo workspace · fictional data':'Your connected Whop business'}<br/>{claude?.connected?'Claude connected · ready for your first conversation':'Claude can be connected whenever you’re ready'}</p></div></div>
      <p className="welcome-note">The assistant starts with read access. Ad drafts are saved locally; publishing or spending is a separate action.</p>
      <Button className="welcome-primary" size="3" disabled={!chosen} onClick={()=>chosen&&onFinish(chosen,!!claude?.connected)}>{claude?.connected?'Open my assistant →':'Open my overview →'}</Button>
      {claude?.connected&&<p className="welcome-first-prompt">Try asking: “Give me a quick overview of my business.”</p>}
    </div>}
    {error&&<p className="welcome-error" role="alert">{error}</p>}
    {busy&&<p className="welcome-note" role="status">{busy}…</p>}
    {step>0&&<div className="welcome-actions welcome-navigation"><Button variant="ghost" size="1" disabled={!!busy} onClick={()=>next(step===2&&demo?0:step-1)}>← Back</Button>{step===1&&<Button variant="ghost" size="1" disabled={!!busy} onClick={startDemo}>Try the demo instead</Button>}</div>}
    <footer className="welcome-footer">Community preview by Srikar. Unofficial and not affiliated with Whop.</footer>
  </Dialog.Content></Dialog.Root>;
}
