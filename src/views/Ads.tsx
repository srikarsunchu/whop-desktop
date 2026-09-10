import { Callout } from 'frosted-ui';
import { Link2Icon } from '@radix-ui/react-icons';
import { invoke } from '@tauri-apps/api/core';
import { PageHeader } from '../components/Panel';
import { CampaignWorkspace } from '../components/CampaignWorkspace';
import { useAccount, useWhop, type Page } from '../lib/whop';
export function Ads({ask}: {runInTerminal:(c:string)=>void;ask:(prompt:string)=>void}){
 const {account}=useAccount();
 const social=useWhop<Page<{id:string;platform:string}>>(['social-accounts','list']);
 return <div className="stack"><PageHeader title="Ads" subtitle={`${account?.title??''} · Build, launch and manage your campaigns.`}/>
 {social.data&&!social.data.data.some(a=>a.platform==='facebook')&&<Callout.Root color="amber"><Callout.Icon><Link2Icon/></Callout.Icon><Callout.Title>Connect a Facebook page</Callout.Title><Callout.Description>Connect your page on Whop before creating ads. Campaign delivery uses your Whop balance.</Callout.Description><Callout.Actions><Callout.Action onClick={()=>invoke('open_web_window')}>Open Whop</Callout.Action></Callout.Actions></Callout.Root>}
 <CampaignWorkspace ask={ask}/></div>;
}
