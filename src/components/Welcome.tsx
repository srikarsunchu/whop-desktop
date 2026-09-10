import { useState } from 'react';
import { Button, Dialog, toast } from 'frosted-ui';
import { invoke } from '@tauri-apps/api/core';
import { useAccount } from '../lib/whop';

export function Welcome({open,onDemo,onConnected}:{open:boolean;onDemo:()=>void;onConnected:()=>void}) {
  const {cliPath,loggedIn,accounts,refreshAccounts}=useAccount();
  const [connect,setConnect]=useState(false);
  const [checking,setChecking]=useState(false);
  const ready=!!cliPath && loggedIn && accounts.some(a=>!a.demo);
  const copy=async(text:string)=>{try{await navigator.clipboard.writeText(text);toast.success('Copied');}catch{toast.error('Could not copy. Select the command below.');}};
  return <Dialog.Root open={open}><Dialog.Content className="welcome-dialog" size="3">
    <span className="welcome-label">WHOP DESKTOP · COMMUNITY PREVIEW</span>
    <Dialog.Title>{connect?'Bring your business into view.':'Your business. A little closer.'}</Dialog.Title>
    <Dialog.Description>{connect?'Connect through the official Whop CLI. Your existing login stays on your Mac.':'A desktop workspace for your revenue, customers, creative work, and an assistant that can pull the numbers.'}</Dialog.Description>
    {!connect?<>
      <div className="welcome-demo"><span className="welcome-demo-mark">↗</span><div><strong>Take a look around</strong><p>Explore Northwind Picks, a fictional business with populated dashboards. No account, payment, or setup needed.</p></div></div>
      <div className="welcome-details"><span>Revenue & customers</span><span>Creative Studio</span><span>Campaign planning</span></div>
      <Button size="3" variant="classic" className="welcome-primary" onClick={onDemo}>Explore the demo →</Button>
      <Button size="2" variant="surface" className="welcome-primary" onClick={()=>setConnect(true)}>Connect my business</Button>
      <p className="welcome-note">The demo’s Assistant needs Claude Code installed and signed in. Studio uses labeled samples; it doesn’t generate paid media in demo mode.</p>
    </>:<>
      <div className="welcome-setup"><div className="welcome-check"><span>{cliPath?'✓':'1'}</span><div><strong>Install the Whop CLI</strong><p>{cliPath?'Found on this Mac.':'Open Terminal and run the official installer:'}</p>{!cliPath && <><code>curl -fsSL https://whop.com/install.sh | sh</code><Button size="1" variant="surface" onClick={()=>copy('curl -fsSL https://whop.com/install.sh | sh')}>Copy install command</Button></>}</div></div>
      <div className="welcome-check"><span>{loggedIn?'✓':'2'}</span><div><strong>Sign in to Whop</strong><p>{loggedIn?'An existing Whop login is available.':'Run this in Terminal and finish signing in:'}</p>{!loggedIn && <><code>whop login</code><Button size="1" variant="surface" onClick={()=>copy('whop login')}>Copy sign-in command</Button></>}</div></div></div>
      {ready?<Button className="welcome-primary" variant="classic" size="3" onClick={onConnected}>Open my business →</Button>:<Button className="welcome-primary" variant="classic" size="3" loading={checking} onClick={()=>{setChecking(true);refreshAccounts();setTimeout(()=>setChecking(false),1800);}}>I’m signed in — check again</Button>}
      <Button className="welcome-primary" size="2" variant="surface" onClick={onDemo}>Explore the demo for now</Button>
      <button className="welcome-docs" onClick={()=>invoke('open_external',{url:'https://github.com/whopio/whop-public-cli'})}>Official Whop CLI setup ↗</button>
    </>}
    <footer className="welcome-footer">Built by Srikar. Unofficial and not affiliated with Whop.<br/>Preview release · your feedback helps shape it.</footer>
  </Dialog.Content></Dialog.Root>;
}
