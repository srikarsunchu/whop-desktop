import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, Dialog, Heading, Text } from "frosted-ui";
import { CheckCircledIcon, GearIcon, LockClosedIcon, ReloadIcon, RocketIcon, ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { isTauri } from "@tauri-apps/api/core";
import { PageHeader, Loading, Panel } from "../components/Panel";
import { StatTile } from "../components/StatTile";
import { useAccount } from "../lib/whop";
import { money, relative } from "../lib/format";
import { isConnected, makeDemo, permissions, requestCurfew, signalNames, type CurfewState, type Incident, type Payment } from "../lib/curfew";

type Action = { title: string; description: string; action: string; body?: unknown; confirm: string };
const clock = (time: string) => new Date(time).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});
function remaining(time: string, now: number) { const seconds = Math.max(0, Math.ceil((+new Date(time)-now)/1000)); return seconds ? `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}` : "Processing"; }

export function Curfew() {
  const { account } = useAccount();
  const demo = !!account?.demo;
  const [data, setData] = useState<CurfewState | null>(() => demo ? makeDemo() : null);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState<number | null>(demo ? Date.now() : null);
  const [now, setNow] = useState(Date.now());
  const [dialog, setDialog] = useState<"connect" | "settings" | "launch" | null>(null);
  const [review, setReview] = useState<Action | null>(null);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [key, setKey] = useState("");
  const [delay, setDelay] = useState(10);
  const [revoke, setRevoke] = useState(false);
  const [alert, setAlert] = useState("");
  const [hours, setHours] = useState(2);
  const [filter, setFilter] = useState("all");
  const alive = useRef(true), inFlight = useRef(false), mutating = useRef(false);
  const modalOpen = useRef(false);
  modalOpen.current = !!dialog || !!review;
  const refresh = async (quiet = false) => {
    if (quiet && modalOpen.current) return;
    if (!account || demo || inFlight.current || mutating.current) return;
    if (!isTauri()) { setLoading(false); return; }
    inFlight.current = true;
    if (!quiet) setLoading(true);
    try {
      const result = await requestCurfew(account.id, "state");
      if (alive.current) { setData(isConnected(result) ? result : null); setUpdated(Date.now()); setError(""); }
    } catch (e) { if (alive.current) setError(String(e)); }
    finally { inFlight.current = false; if (alive.current) setLoading(false); }
  };
  useEffect(() => {
    alive.current = true;
    void refresh();
    const timer = setInterval(() => { if (!document.hidden) void refresh(true); }, 15000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { alive.current = false; clearInterval(timer); clearInterval(tick); };
  }, [account?.id]);
  const execute = async (action: Action) => {
    if (!account || mutating.current) return;
    mutating.current = true;
    setBusy(true); setError(""); setNotice("");
    while (inFlight.current && alive.current) await new Promise(resolve => setTimeout(resolve, 100));
    if (!alive.current) { mutating.current = false; return; }
    let succeeded = false;
    try {
      if (demo) {
        const body = action.body as Record<string, any> | undefined;
        setData(d => {
          if (!d) return d;
          if (action.action === "undo") return {...d,incidents:d.incidents.map(i=>i.id===body?.id ? {...i,status:"undone"} : i)};
          if (action.action === "launch") return {...d,launch_until:body?.hours ? new Date(Date.now()+body.hours*3600000).toISOString() : null};
          if (action.action === "settings") return {...d,config:{...d.config,...body}};
          return d;
        });
      } else {
        await requestCurfew(account.id, action.action, action.body);
      }
      if (!alive.current) return;
      succeeded = true;
      setReview(null); setDialog(null); setKey("");
      setNotice(demo ? "Updated sample data. No live payments were changed." : action.action === "disconnect" ? "Curfew disconnected. Monitoring has stopped." : "Saved. Dashboard updated.");
      if (action.action === "disconnect") setData(null);
    } catch (e) { if (alive.current) setError(String(e)); }
    finally {
      mutating.current = false;
      if (alive.current) { setBusy(false); if (succeeded) await refresh(); }
    }
  };
  const showSettings = () => { if (!data) return; setDelay(data.config.refundDelayMin); setRevoke(data.config.immediateRevoke); setAlert(data.config.alertUrl ?? ""); setDialog("settings"); };
  const launchActive = !!data?.launch_until && +new Date(data.launch_until) > now;
  const pending = data?.incidents.filter(i => i.status === "holding") ?? [];
  const heldIds = new Set(pending.flatMap(i=>i.suspect_ids));
  const recent = data?.recent.filter(p => +new Date(p.created_at) >= now-(data.config.windowMin*60000) && +new Date(p.created_at) <= now) ?? [];
  const paid = recent.filter(p=>p.status==="paid");
  const failed = recent.filter(p=>p.status==="failed");
  const status = !data?.baseline ? "Learning baseline" : !data.tenant.webhook ? "Webhook not connected" : launchActive ? "Launch mode" : data.last?.level === "attack" ? "Attack detected" : data.last?.level === "elevated" ? "Elevated activity" : data.last ? "All clear" : "Waiting for payments";
  const tone = data?.last?.level === "attack" && !launchActive ? "red" : !data?.baseline || !data.tenant.webhook || launchActive || data?.last?.level === "elevated" ? "amber" : "green";
  const payments = (data?.scored ?? []).filter(p => filter === "all" || (filter === "flagged" ? heldIds.has(p.id) : p.status === "failed"));
  return <div className="stack curfew-page">
    <PageHeader title="Curfew" subtitle="Your business, watched over."
      actions={<>{demo && <Badge color="gray">Demo · sample data</Badge>}{data && <><Button variant="surface" onClick={() => setDialog("launch")}><RocketIcon />{launchActive ? "Manage launch" : "I’m launching"}</Button><Button variant="ghost" aria-label="Curfew settings" onClick={showSettings}><GearIcon /></Button></>}</>} />
    {error && <div className="curfew-message" role="alert"><ExclamationTriangleIcon /><span>{error}</span><Button size="1" variant="surface" disabled={loading || busy} onClick={()=>void refresh()}>Retry</Button>{!demo && <Button size="1" variant="surface" onClick={()=>setDialog("connect")}>Reconnect</Button>}</div>}
    {notice && <Text size="1" color="gray" role="status">{notice}</Text>}
    {loading && !data ? <Loading label="Checking Curfew…" /> : !data ? <>
      <Card size="3" className="curfew-connect-card"><div className="curfew-shield"><LockClosedIcon /></div><Heading size="5">Catch the attack. Keep the real customers.</Heading><Text size="2" color="gray">Curfew learns your usual payment patterns and watches six signals together. Suspicious payments enter a review window before automatic refunds and access removal.</Text><div className="curfew-connect-facts"><div><strong>60 days</strong><span>of history to learn your baseline</span></div><div><strong>6 signals</strong><span>checked on incoming payments</span></div><div><strong>10 minutes</strong><span>default window to cancel an action</span></div></div><Button variant="classic" onClick={()=>setDialog("connect")} disabled={!isTauri()}>Connect {account?.title ?? "your business"}</Button><Text size="1" color="gray">Monitoring runs on Curfew’s server, even when this app is closed.</Text></Card>
      <Panel title="What Curfew watches"><div className="curfew-preview-signals">{Object.values(signalNames).map(n=><div key={n}><CheckCircledIcon /><Text size="2">{n}</Text></div>)}</div></Panel>
    </> : <>
      {demo && <div className="curfew-demo-bar"><Text size="1" color="gray">Try a scenario</Text>{(["normal","attack","launch"] as const).map(s=><Button size="1" variant="soft" color="gray" key={s} onClick={()=>{setData(makeDemo(s));setUpdated(Date.now());setNotice("");}}>{s === "normal" ? "Normal traffic" : s === "attack" ? "Card-testing attack" : "Product launch"}</Button>)}</div>}
      <div className="curfew-status" data-tone={tone}><div className="curfew-status-icon">{tone==="green" ? <CheckCircledIcon/> : <ExclamationTriangleIcon/>}</div><div><Heading size="4">{status}</Heading><Text size="2" color="gray">{launchActive ? `Automatic actions paused until ${clock(data.launch_until!)}. Signals are still recorded.` : data.last ? `${data.last.score} of 6 signals triggered · ${data.config.windowMin}-minute detection window` : "New payments will appear here as Curfew receives them."}</Text></div><div className="curfew-status-meta"><Badge color={demo ? "gray" : data.tenant.webhook ? "green" : "amber"}>{demo ? "Sample activity" : data.tenant.webhook ? "Webhook connected" : "Setup incomplete"}</Badge><Text size="1" color="gray">{data.last ? `Last payment check ${relative(data.last.at)}` : "No payment checks yet"}</Text></div></div>
      {data.learn?.error && <div className="curfew-message" role="alert">Baseline learning: {data.learn.error}</div>}
      {data.learn?.webhook_error && <div className="curfew-message" role="alert">Webhook setup: {data.learn.webhook_error}</div>}
      <div className="curfew-stats"><StatTile label={`Paid · last ${data.config.windowMin} min`} value={paid.length} note={`${money(paid.reduce((n,p)=>n+p.usd_total,0))} in payments`}/><StatTile label="Declined attempts" value={failed.length} note={`${recent.length ? Math.round(failed.length/recent.length*100) : 0}% of recent attempts`}/><StatTile label="Pending refund" value={heldIds.size} note={heldIds.size ? `${pending.length} incident${pending.length===1 ? "" : "s"} awaiting action` : "No payments on hold"}/><StatTile label="Baseline learned" value={data.baseline?.total_paid} note={data.baseline ? `Across ${data.baseline.days} days of history` : "Learning your payment patterns"}/></div>
      <div className="curfew-main-grid"><Panel title="Payment activity" actions={<Text size="1" color="gray">Last 60 minutes</Text>}><ActivityChart payments={data.recent} now={now}/></Panel><Panel title="Detection signals" actions={<Text size="1" color="gray">{data.last?.score ?? 0} / 6</Text>}><div className="curfew-signals">{Object.entries(signalNames).map(([id,label])=>{const s=data.last?.signals.find(s=>s.name===id);return <div key={id} className="curfew-signal" data-fired={s?.fired}><span className="curfew-signal-dot"/><div><Text size="2" weight="medium">{label}</Text><Text size="1" color="gray">{s?.note ?? "Waiting for a payment check"}</Text></div><Badge size="1" color={s?.fired ? "red" : "gray"}>{s ? s.fired ? "Triggered" : "Normal" : "Waiting"}</Badge></div>;})}</div></Panel></div>
      <Panel title="Incident queue" actions={<Badge color={pending.length ? "amber" : "gray"}>{pending.length} pending</Badge>}>
        {!data.incidents.length ? <div className="curfew-empty"><CheckCircledIcon/><Text size="2">No incidents to review</Text><Text size="1" color="gray">Curfew flags attacks when at least three signals fire together.</Text></div> : <div className="curfew-incidents">{data.incidents.map(i=><IncidentRow key={i.id} incident={i} now={now} demo={demo} onUndo={()=>setReview({title:"Cancel pending refunds?",description:`Remove ${i.suspect_ids.length} payments from this incident’s pending action. Any access already revoked is not restored.`,action:"undo",body:{id:i.id},confirm:"Cancel pending action"})}/>)}</div>}
      </Panel>
      <Panel title="Recent payments" actions={<div className="curfew-filters">{["all","flagged","failed"].map(f=><button key={f} aria-pressed={filter===f} onClick={()=>setFilter(f)}>{f==="all" ? "All payments" : f==="flagged" ? "Pending action" : "Declined"}</button>)}</div>}>
        <div className="curfew-table-scroll"><table className="curfew-table"><thead><tr><th>Customer</th><th>Amount</th><th>Status</th><th>Risk score</th><th>Country</th><th>Time</th><th><span className="sr-only">Details</span></th></tr></thead><tbody>{payments.slice(0,30).map(p=><tr key={p.id}><td><strong>{p.user_name || "Unknown customer"}</strong><span>{p.card_last4 ? `Card •••• ${p.card_last4}` : "Card unavailable"}</span></td><td>{money(p.usd_total)}</td><td><Badge size="1" color={p.refunded_at ? "gray" : p.status==="failed" ? "red" : "green"}>{p.refunded_at ? "Refunded" : p.status}</Badge></td><td><span className="curfew-risk" data-high={(p.risk ?? 0)>=70}>{p.risk ?? "—"}<small>/ 99</small></span></td><td>{p.country ?? "—"}</td><td>{clock(p.created_at)}</td><td><Button size="1" variant="ghost" onClick={()=>setSelected(p)}>Details</Button></td></tr>)}</tbody></table></div>{!payments.length && <div className="curfew-empty"><Text size="2">No payments match this view.</Text></div>}
      </Panel>
      <div className="curfew-footer"><Text size="1" color="gray">{demo ? "Interactive sample · no live actions" : `${data.tenant.title} · refreshes every 15 seconds`}{updated ? ` · Updated ${clock(new Date(updated).toISOString())}` : ""}</Text><Button variant="ghost" size="1" disabled={loading || busy || demo} onClick={()=>void refresh()}><ReloadIcon/>Refresh</Button></div>
    </>}
    {dialog && <Dialog.Root open onOpenChange={o=>{if(!o&&!busy){setDialog(null);setKey("");setError("");}}}><Dialog.Content style={{maxWidth:560}}><Dialog.Title>{dialog==="connect" ? `Connect ${account?.title}` : dialog==="settings" ? "Protection settings" : "Launch mode"}</Dialog.Title><Dialog.Description>{dialog==="connect" ? "Connect Curfew to learn your baseline and monitor incoming payments." : dialog==="settings" ? "Choose how Curfew responds when it detects an attack." : "Pause automatic actions during a planned launch. Curfew continues recording signals."}</Dialog.Description>
      <form className="curfew-form" onSubmit={e=>{e.preventDefault();if(dialog==="connect")void execute({title:"Connect",description:"",action:"connect",body:{apiKey:key},confirm:"Connect"});else if(dialog==="settings")setReview({title:"Save protection settings?",description:`Future incidents will wait ${delay} minutes before refunds. Access will be revoked ${revoke ? "immediately on detection" : "when refunds run"}. Existing holds keep their deadlines.`,action:"settings",body:{refundDelayMin:delay,immediateRevoke:revoke,alertUrl:alert},confirm:"Save settings"});else setReview({title:launchActive ? "Update launch mode?" : "Start launch mode?",description:`Automatic refunds and access removal will be paused for ${hours} hours. Pending holds that expire during launch mode are canceled.`,action:"launch",body:{hours},confirm:"Start launch mode"});}}>
      {dialog==="connect" ? <><p className="workspace-notice">Connecting sends this key to Curfew’s hosted service and enables automatic refunds and membership cancellation. New connections default to a 10-minute review window; reconnecting keeps the business’s existing protection settings. Keys are encrypted on the service.</p><details><summary>Required API key permissions</summary><div className="curfew-permissions">{permissions.map(p=><code key={p}>{p}</code>)}</div></details><label>Whop account API key<input type="password" required autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} placeholder="whop_…" /></label><Text size="1" color="gray">Use a key for {account?.title}. The desktop verifies the business before connecting.</Text></> : dialog==="settings" ? <><label>Refund delay (minutes)<input type="number" min={1} max={120} required value={delay} onChange={e=>setDelay(Number(e.target.value))}/></label><label className="curfew-checkbox"><input type="checkbox" checked={revoke} onChange={e=>setRevoke(e.target.checked)}/>Revoke access immediately when an attack is detected</label><label>Alert webhook (optional)<input type="url" value={alert} placeholder="https://hooks.slack.com/…" onChange={e=>setAlert(e.target.value)}/></label><div className="curfew-settings-extra"><Button type="button" variant="surface" onClick={()=>setReview({title:"Relearn the baseline?",description:"Pull the latest payment history and rebuild your baseline. This can take a minute.",action:"relearn",confirm:"Relearn baseline"})}>Relearn baseline</Button>{!demo&&<Button type="button" variant="soft" color="red" onClick={()=>setReview({title:"Disconnect Curfew?",description:"Stop monitoring this business, remove its webhook, and delete its history stored by Curfew. This cannot be undone.",action:"disconnect",confirm:"Disconnect and delete"})}>Disconnect</Button>}</div></> : <><label>Pause automatic actions for<select value={hours} onChange={e=>setHours(Number(e.target.value))}>{[1,2,4,8,24].map(h=><option key={h} value={h}>{h} hour{h===1 ? "" : "s"}</option>)}</select></label>{launchActive&&<Button type="button" variant="surface" onClick={()=>setReview({title:"Resume automatic protection?",description:"Automatic refunds and access removal will resume. Any pending holds may execute on the next server check.",action:"launch",body:{hours:0},confirm:"Resume protection"})}>End launch mode</Button>}</>}
      {error&&<Text size="2" color="red" role="alert">{error}</Text>}<div className="workspace-dialog-actions"><Button type="button" variant="soft" color="gray" disabled={busy} onClick={()=>{setDialog(null);setKey("");}}>Cancel</Button><Button type="submit" variant="classic" disabled={busy}>{busy ? "Connecting and learning…" : dialog==="connect" ? "Connect and enable protection" : "Review changes"}</Button></div></form></Dialog.Content></Dialog.Root>}
    {review && <Dialog.Root open onOpenChange={o=>{if(!o&&!busy)setReview(null);}}><Dialog.Content style={{maxWidth:480}}><Dialog.Title>{review.title}</Dialog.Title><Dialog.Description>{review.description}</Dialog.Description>{demo&&<p className="workspace-notice">Demo only. No live payments will change.</p>}{error&&<p className="workspace-error" role="alert">{error}</p>}<div className="workspace-dialog-actions"><Button variant="soft" color="gray" disabled={busy} onClick={()=>setReview(null)}>Back</Button><Button variant="classic" disabled={busy} onClick={()=>void execute(review)}>{busy ? "Saving…" : review.confirm}</Button></div></Dialog.Content></Dialog.Root>}
    {selected && <Dialog.Root open onOpenChange={o=>{if(!o)setSelected(null);}}><Dialog.Content style={{maxWidth:500}}><Dialog.Title>Payment details</Dialog.Title><Dialog.Description>{selected.user_name || "Unknown customer"} · {money(selected.usd_total)}</Dialog.Description><div className="curfew-payment-detail"><Badge color={(selected.risk??0)>=70 ? "red" : "gray"}>Risk score {selected.risk ?? "—"} / 99</Badge><Text size="1" color="gray">This is a rules-based score, not a probability of fraud.</Text>{selected.insights?.map((t,i)=><p key={i}>{t}</p>)}<Text size="1" color="gray">{selected.id} · {new Date(selected.created_at).toLocaleString()}</Text></div><div className="workspace-dialog-actions"><Button onClick={()=>setSelected(null)}>Done</Button></div></Dialog.Content></Dialog.Root>}
  </div>;
}
function IncidentRow({incident:i,now,demo,onUndo}:{incident:Incident;now:number;demo:boolean;onUndo:()=>void}) {
  return <div className="curfew-incident"><div className="curfew-incident-mark"><ExclamationTriangleIcon/></div><div className="curfew-incident-copy"><Text size="2" weight="medium">{i.level==="attack" ? "Suspected card-testing attack" : "Elevated payment activity"}</Text><Text size="1" color="gray">{i.score} signals · {i.suspect_ids.length} payments · {clock(i.opened_at)}</Text>{i.acted && <Text size="1" color="gray">{i.acted.refunded.length} refunded · {i.acted.revoked.length} access revocations{ i.acted.errors.length ? ` · ${i.acted.errors.length} errors` : ""}</Text>}{!!i.acted?.errors.length && <details><summary>Action errors</summary>{i.acted.errors.map((e,k)=><p key={k}>{e}</p>)}</details>}</div>{i.status==="holding" ? <><div className="curfew-countdown"><strong>{remaining(i.act_at,now)}</strong><span>{demo ? "sample countdown" : "until automatic action"}</span></div><Button variant="surface" size="2" onClick={onUndo}>Cancel action</Button></> : <Badge color={i.status==="undone" ? "gray" : i.status==="acted" ? "amber" : "blue"}>{i.status==="undone" ? "Canceled" : i.status==="acted" ? "Action completed" : "Alert only"}</Badge>}</div>;
}
function ActivityChart({payments,now}:{payments:Payment[];now:number}) {
  const [hover,setHover] = useState<number|null>(null);
  const end = Math.ceil(now/120000)*120000;
  const bins = Array.from({length:30},(_,i)=>{const start=end-(30-i)*120000;const ps=payments.filter(p=>+new Date(p.created_at)>=start&&+new Date(p.created_at)<start+120000);return {start,paid:ps.filter(p=>p.status==="paid").length,failed:ps.filter(p=>p.status==="failed").length};});
  const max = Math.max(4,...bins.map(b=>b.paid+b.failed));
  return <div className="curfew-activity"><div className="curfew-chart-legend"><span><i/>Paid</span><span><i/>Declined</span><Text size="1" color="gray">{hover===null ? "Hover or focus a bar to inspect" : `${clock(new Date(bins[hover].start).toISOString())} · ${bins[hover].paid} paid · ${bins[hover].failed} declined`}</Text></div><div className="curfew-chart"><div className="curfew-chart-axis"><span>{max}</span><span>{Math.round(max/2)}</span><span>0</span></div><div className="curfew-chart-bars">{bins.map((b,i)=><button key={i} aria-label={`${clock(new Date(b.start).toISOString())}: ${b.paid} paid, ${b.failed} declined`} onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)} onFocus={()=>setHover(i)} onBlur={()=>setHover(null)}><span className="curfew-bar-failed" style={{height:`${b.failed/max*100}%`}}/><span className="curfew-bar-paid" style={{height:`${b.paid/max*100}%`}}/></button>)}</div></div><div className="curfew-chart-times"><span>60 min ago</span><span>30 min ago</span><span>Now</span></div></div>;
}
