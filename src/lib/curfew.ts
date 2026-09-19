import { invoke } from "@tauri-apps/api/core";
export interface Signal { name: string; value: number; threshold: number; fired: boolean; note: string }
export interface Payment { id: string; status: string; created_at: string; usd_total: number; user_name: string | null; country: string | null; card_last4: string | null; refunded_at: string | null; risk?: number; insights?: string[] }
export interface Incident { id: number; opened_at: string; level: string; score: number; signals: Signal[]; suspect_ids: string[]; status: "holding" | "acted" | "undone" | "alerted"; act_at: string; acted: {refunded: string[]; revoked: string[]; errors: string[]} | null }
export interface CurfewState {
  tenant: { title: string; account_id: string; webhook: boolean };
  baseline: { total_paid: number; days: number; learned_at: string; overall_rate: number; avg_usd: number } | null;
  learn: {state: string; fetched: number; error?: string; webhook_error?: string} | null;
  last: {at: string; level: string; score: number; signals: Signal[]; paid: number} | null;
  scored: Payment[]; recent: Payment[]; incidents: Incident[]; launch_until: string | null;
  config: { refundDelayMin: number; windowMin: number; immediateRevoke: boolean; alertUrl: string | null; dryRun: boolean };
}
export const signalNames: Record<string, string> = {velocity:"Payment velocity",new_buyers:"First-time buyers",declines:"Decline rate",geo_spread:"Unusual geography",card_reuse:"Card reuse",spend_shift:"Spend pattern"};
export const permissions = ["payment:basic:read","payment:manage","payment:dispute:read","payment:resolution_center_case:read","membership:cancel","member:basic:read","member:email:read","member:phone:read","plan:basic:read","access_pass:basic:read","promo_code:basic:read","shipment:basic:read","developer:manage_webhook"];
export async function requestCurfew(account: string, action: string, body?: unknown): Promise<CurfewState | { connected: false }> {
  return invoke("curfew_request", { account, action, body: body ?? null });
}
export function isConnected(s: CurfewState | {connected: false}): s is CurfewState { return "tenant" in s; }
export function makeDemo(scenario: "normal" | "attack" | "launch" = "normal"): CurfewState {
  const now = Date.now(), attack = scenario === "attack", launch = scenario === "launch";
  const iso = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
  const signals = [
    {name:"velocity",value:attack ? 18.9 : launch ? 22.4 : 0.8,threshold:4,fired:attack || launch,note:attack ? "24 paid in 10 min; usual 4" : launch ? "34 paid in 10 min; usual 4" : "5 paid in 10 min; usual 4"},
    {name:"new_buyers",value:attack || launch ? .96 : .4,threshold:.86,fired:attack || launch,note:attack || launch ? "96% first-time buyers; usual 56%" : "40% first-time buyers; usual 56%"},
    {name:"declines",value:attack ? .57 : 0,threshold:.3,fired:attack,note:attack ? "32 declines; 57% of attempts" : "No declines in this window; usual 4%"},
    {name:"geo_spread",value:attack ? .92 : .02,threshold:.4,fired:attack,note:attack ? "92% from countries rarely seen here" : "2% from countries rarely seen here"},
    {name:"card_reuse",value:attack ? 6 : 0,threshold:1,fired:attack,note:attack ? "6 cards shared across 3+ accounts" : "No cards shared across multiple accounts"},
    {name:"spend_shift",value:.3,threshold:2.5,fired:false,note:"Average $49; usual $54"},
  ];
  const recent: Payment[] = Array.from({length: attack ? 78 : launch ? 56 : 29}, (_, i) => {
    const burst = i >= 22 && (attack || launch);
    const failed = attack && burst && (i % 7 < 4);
    return {id:`demo_pay_${i}`,status:failed ? "failed" : "paid",created_at:iso(burst ? (i - 22) / 6 : 57 - i * 2),usd_total:49,user_name:["Alex Morgan","Sam Rivera","Jordan Lee","Taylor Chen","Casey Brooks"][i%5],country:attack && burst ? ["NG","EG","VN"][i%3] : ["US","GB","CA"][i%3],card_last4:String(4210+i%7),refunded_at:null,risk:burst && attack ? 82+i%17 : 8+i%12,insights:burst && attack ? ["Card shared by 4 accounts", "First purchase from this account", "Arrived during a decline burst"] : ["Established buying pattern", "Country matches usual sales"]};
  }).sort((a,b) => a.created_at.localeCompare(b.created_at));
  const suspects = recent.filter(p => p.status === "paid" && (p.risk ?? 0) > 80).map(p => p.id);
  return {tenant:{title:"Northwind Picks",account_id:"biz_demoNorthwind",webhook:true},baseline:{total_paid:1089,days:60,learned_at:iso(150),overall_rate:4,avg_usd:54},learn:{state:"done",fetched:1089},last:{at:iso(0),level:attack ? "attack" : launch ? "elevated" : "normal",score:signals.filter(s=>s.fired).length,signals,paid:recent.filter(p=>p.status==="paid" && +new Date(p.created_at)>=now-600000).length},scored:recent.slice(-60).reverse(),recent,incidents:attack ? [{id:1,opened_at:iso(1),level:"attack",score:5,signals,suspect_ids:suspects,status:"holding",act_at:iso(-9),acted:null}] : [],launch_until:null,config:{refundDelayMin:10,windowMin:10,immediateRevoke:false,alertUrl:null,dryRun:true}};
}
