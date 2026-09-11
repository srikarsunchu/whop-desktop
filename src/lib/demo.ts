import { businessDemo } from "./business-demo";
// A labeled demo business so the app can be shown fully populated. Shapes
// mirror the real CLI JSON (`whop … --format json`) so the views don't branch.
// Nothing here is real: names, ids and amounts are invented.

export const DEMO_ACCOUNT_ID = "biz_demoNorthwind";
export const DEMO_LOGO =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTQiIGZpbGw9IiMwZjJhMWMiLz48Y2lyY2xlIGN4PSIzMiIgY3k9IjMyIiByPSIxOSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjM2RkNjhjIiBzdHJva2Utd2lkdGg9IjQiLz48Y2lyY2xlIGN4PSIzMiIgY3k9IjMyIiByPSIxMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjM2RkNjhjIiBzdHJva2Utd2lkdGg9IjQiLz48Y2lyY2xlIGN4PSIzMiIgY3k9IjMyIiByPSIzLjUiIGZpbGw9IiMzZGQ2OGMiLz48cGF0aCBkPSJNMzIgOHYxME0zMiA0NnYxME04IDMyaDEwTTQ2IDMyaDEwIiBzdHJva2U9IiMzZGQ2OGMiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PC9zdmc+";
export const DEMO_ACCOUNT = { id: DEMO_ACCOUNT_ID, title: "Northwind Picks", demo: true, route: "northwind-picks", logo: DEMO_LOGO };

const DAY = 86_400;
const now = () => Math.floor(Date.now() / 1000);
const todayUtc = () => now() - (now() % DAY);
const iso = (secondsAgo: number) => new Date((now() - secondsAgo) * 1000).toISOString();
const usd = (n: number) => ({ currency: "usd", amount: n.toFixed(2), decimals: 2, display_decimals: 2 });

// Seeded so the numbers are stable between renders.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function series(metric: string, from: number, to: number): { timestamp: number; value: number }[] {
  const out: { timestamp: number; value: number }[] = [];
  for (let t = from; t <= to; t += DAY) {
    const r = rng((metric.length * 7919) ^ Math.imul(Math.floor(t / DAY), 2654435761));
    const dow = new Date(t * 1000).getUTCDay();
    const weekend = dow === 0 || dow === 6 ? 1.35 : 1;
    // A given day must have the same value in the 7, 30, and 90 day views.
    const i = (t - todayUtc()) / DAY + 29;
    let v: number;
    switch (metric) {
      case "net_revenue":
      case "gross_revenue":
        v = (Math.max(300, 820 + i * 14) + r() * 900) * weekend;
        break;
      case "new_memberships":
        v = Math.round((6 + r() * 11) * weekend);
        break;
      case "active_memberships":
      case "paid_active_members":
        v = t === todayUtc() ? 1211 : 1211 + Math.round((i - 29) * 3.4 + r() * 6);
        break;
      case "new_users":
        v = Math.round((14 + r() * 22) * weekend);
        break;
      case "account_balance":
        v = t === todayUtc() ? 18420.55 : Math.max(0, 12000 + i * 240 + r() * 900 - (i % 7 === 6 ? 4200 : 0));
        break;
      case "ad_spend":
        v = (30 + r() * 45) * weekend;
        break;
      case "visitors":
        v = Math.round((1900 + r() * 1400) * weekend);
        break;
      default:
        v = Math.round(r() * 100);
    }
    out.push({ timestamp: t, value: Math.round(v * 100) / 100 });
  }
  return out;
}

const users = [
  ["user_8Fk2PqLm", "jordan.bets", "Jordan Reyes"],
  ["user_3Vx9TrWe", "mia_capper", "Mia Chen"],
  ["user_Qz71BnKd", "tonyparlay", "Tony Marino"],
  ["user_Lp4MsYhc", "sarah.plays", "Sarah Okafor"],
  ["user_Hw2ZcXaf", "dmitri_edge", "Dmitri Volkov"],
  ["user_Nn6JgUqr", "kaylaunders", "Kayla Underwood"],
  ["user_Bt9RvEol", "marcus.ml", "Marcus Lee"],
  ["user_Yc5KdOsp", "priya_props", "Priya Natarajan"],
  ["user_Ee1WfIzt", "benny_locks", "Ben Alvarez"],
  ["user_Ux8HbQmn", "lena.sharp", "Lena Fischer"],
  ["user_Gg4TkVyw", "omar_units", "Omar Haddad"],
  ["user_Rr2PlAxc", "chloe.stakes", "Chloe Dubois"],
] as const;

const products = [
  { id: "prod_NwVipPicks01", title: "VIP Picks", route: "vip-picks", visibility: "visible", member_count: 812, created_at: iso(212 * DAY), plan: { id: "plan_NwVip49", plan_type: "renewal", billing_period: 30, initial_price: usd(49), renewal_price: usd(49), title: "Monthly" } },
  { id: "prod_NwSeason02", title: "Season Pass", route: "season-pass", visibility: "visible", member_count: 341, created_at: iso(97 * DAY), plan: { id: "plan_NwSeason299", plan_type: "one_time", billing_period: null, initial_price: usd(299), renewal_price: usd(0), title: "Full season" } },
  { id: "prod_NwFreeRoom03", title: "Free Picks Room", route: "free-picks", visibility: "visible", member_count: 4120, created_at: iso(240 * DAY), plan: { id: "plan_NwFree0", plan_type: "one_time", billing_period: null, initial_price: usd(0), renewal_price: usd(0), title: null } },
  { id: "prod_NwModel04", title: "Model Sheet Access", route: "model-sheet", visibility: "hidden", member_count: 58, created_at: iso(31 * DAY), plan: { id: "plan_NwModel129", plan_type: "renewal", billing_period: 30, initial_price: usd(129), renewal_price: usd(129), title: "Monthly" } },
];

const statuses = ["active", "active", "active", "active", "trialing", "past_due", "canceling", "active", "canceled", "active", "paused", "expired"];

function memberships() {
  return users.map(([uid, username, name], i) => {
    const p = products[i % 2 === 0 ? 0 : i % 3 === 0 ? 1 : 3];
    return {
      id: `mem_Nw${uid.slice(5, 11)}`,
      status: statuses[i],
      created_at: iso((3 + i * 9) * DAY),
      renewal_period_end: p.plan.plan_type === "renewal" ? iso((statuses[i] === "past_due" ? 2 : -(4 + i)) * DAY) : null,
      cancel_at_period_end: statuses[i] === "canceling",
      product: { id: p.id, title: p.title },
      plan: { id: p.plan.id, title: p.plan.title, plan_type: p.plan.plan_type, renewal_price: p.plan.renewal_price, initial_price: p.plan.initial_price },
      user: { id: uid, username, name },
      member: { id: `mber_Nw${uid.slice(5, 11)}` },
    };
  });
}

function members() {
  return users.map(([uid, username, name], i) => ({
    id: `mber_Nw${uid.slice(5, 11)}`,
    account_id: DEMO_ACCOUNT_ID,
    access_level: i === 0 ? "admin" : "customer",
    status: "joined",
    token_balance: 0,
    joined_at: iso((3 + i * 9) * DAY),
    last_accessed_at: iso(i * 3600 * 5 + 600),
    created_at: iso((3 + i * 9) * DAY),
    user: { id: uid, username, name, profile_picture: null },
  }));
}

function ledger() {
  const r = rng(42);
  const rows = [];
  for (let i = 0; i < 18; i++) {
    const kind = i % 6 === 5 ? "payout" : i % 9 === 8 ? "refund" : "payment";
    const u = users[i % users.length];
    const p = products[i % 2];
    const amt = kind === "payout" ? -(2400 + Math.round(r() * 3000)) : kind === "refund" ? -49 : Number(p.plan.initial_price.amount);
    rows.push({
      id: `led_Nw${(1000 + i).toString(36)}${i}`,
      type: kind,
      description: kind === "payout" ? "Payout to Chase ••4417" : kind === "refund" ? `Refund · ${u[1]}` : `${p.title} · ${u[1]}`,
      amount: usd(amt),
      created_at: iso(i * 5.5 * 3600 + 1200),
    });
  }
  return rows;
}

function payouts() {
  return [
    { id: "pay_Nw9d2kA", status: "paid", amount: usd(5140.22), created_at: iso(2 * DAY), arrival_date: iso(0), method: "bank", destination: "Chase ••4417" },
    { id: "pay_Nw7c1zQ", status: "paid", amount: usd(4880.0), created_at: iso(9 * DAY), arrival_date: iso(7 * DAY), method: "bank", destination: "Chase ••4417" },
    { id: "pay_Nw5b8xL", status: "paid", amount: usd(6320.75), created_at: iso(16 * DAY), arrival_date: iso(14 * DAY), method: "bank", destination: "Chase ••4417" },
    { id: "pay_Nw2a4vM", status: "pending", amount: usd(3975.4), created_at: iso(0.4 * DAY), arrival_date: iso(-2 * DAY), method: "bank", destination: "Chase ••4417" },
  ];
}

function people() {
  const cities = [["US", "Austin"], ["US", "Brooklyn"], ["CA", "Toronto"], ["GB", "Manchester"], ["US", "Phoenix"], ["AU", "Sydney"], ["US", "Miami"], ["DE", "Berlin"], ["US", "Chicago"], ["US", "Las Vegas"]];
  const r = rng(7);
  return cities.map(([country, city], i) => {
    const purchased = i % 3 !== 1;
    const u = users[i];
    return {
      id: `prsn_Nw${i}${city.slice(0, 3).toLowerCase()}`,
      account_id: DEMO_ACCOUNT_ID,
      user: purchased ? { id: u[0], username: u[1] } : null,
      member: null,
      name: purchased ? u[2] : null,
      email: purchased ? `${u[1].replace(/[._]/g, "")}@gmail.com` : null,
      first_seen_at: iso((20 + i * 3) * DAY),
      last_seen_at: iso(i * 2 * 3600 + 900),
      event_count: 4 + Math.round(r() * 60),
      purchase_count: purchased ? 1 + (i % 3) : 0,
      ltv: purchased ? 49 * (1 + (i % 3)) + (i % 2 ? 299 : 0) : 0,
      aov: purchased ? 49 : 0,
      location: { continent: null, country, city },
      device: { browser: i % 2 ? "Safari" : "Chrome", os: i % 3 ? "iOS" : "macOS", device: i % 3 ? "mobile" : "desktop" },
    };
  });
}

function balanceSummary() {
  return {
    report_type: "balance_summary",
    rows: [
      { category: "available", currency: "usd", amount: "18420.55" },
      { category: "pending", currency: "usd", amount: "3210.00" },
      { category: "reserve", currency: "usd", amount: "1000.00" },
      { category: "dispute_hold", currency: "usd", amount: "0.00" },
    ],
    total: 22630.55,
  };
}

function incomeStatement() {
  return {
    report_type: "income_statement",
    rows: [
      { label: "Gross sales", currency: "usd", amount: "46210.00" },
      { label: "Refunds", currency: "usd", amount: "-980.00" },
      { label: "Disputes", currency: "usd", amount: "-149.00" },
      { label: "Processing fees", currency: "usd", amount: "-1387.20" },
      { label: "Platform fees", currency: "usd", amount: "-1383.30" },
      { label: "Net revenue", currency: "usd", amount: "42310.50" },
    ],
    total: 42310.5,
  };
}

const apps = [
  { id: "app_NwPicksBoard", name: "Picks Board", status: "live", app_type: "b2c_app", domain: "picks-board.whop.app", created_at: iso(60 * DAY), updated_at: iso(2 * DAY) },
  { id: "app_NwLineTracker", name: "Line Tracker", status: "preview", app_type: "b2c_app", domain: "line-tracker.whop.app", created_at: iso(12 * DAY), updated_at: iso(0.3 * DAY) },
];

const actions = [
  { id: "rac_NwWinback", title: "Follow up on a failed renewal", description: "One membership is past due. Review it before reaching out.", category: "retention" },
  { id: "rac_NwPublish", title: "Publish Model Sheet Access", description: "It has 58 members but is hidden from your storefront.", category: "growth" },
  { id: "rac_NwPayout", title: "Schedule weekly payouts", description: "$18,420.55 is available. Turn on automatic payouts every Friday.", category: "money" },
];

export const DEMO_POSTER =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDI0IDEwMjQiPjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0iZyIgeDE9IjAiIHkxPSIwIiB4Mj0iMSIgeTI9IjEiPjxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzBmMmExYyIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzA2MjAxMyIvPjwvbGluZWFyR3JhZGllbnQ+PHJhZGlhbEdyYWRpZW50IGlkPSJyIiBjeD0iMC43IiBjeT0iMC4zIiByPSIwLjYiPjxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzNkZDY4YyIgc3RvcC1vcGFjaXR5PSIwLjU1Ii8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjM2RkNjhjIiBzdG9wLW9wYWNpdHk9IjAiLz48L3JhZGlhbEdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTAyNCIgaGVpZ2h0PSIxMDI0IiBmaWxsPSJ1cmwoI2cpIi8+PHJlY3Qgd2lkdGg9IjEwMjQiIGhlaWdodD0iMTAyNCIgZmlsbD0idXJsKCNyKSIvPjxjaXJjbGUgY3g9IjUxMiIgY3k9IjQ3MCIgcj0iMjMwIiBmaWxsPSJub25lIiBzdHJva2U9IiMzZGQ2OGMiIHN0cm9rZS13aWR0aD0iMjgiLz48Y2lyY2xlIGN4PSI1MTIiIGN5PSI0NzAiIHI9IjEyMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjM2RkNjhjIiBzdHJva2Utd2lkdGg9IjI4Ii8+PGNpcmNsZSBjeD0iNTEyIiBjeT0iNDcwIiByPSIzNCIgZmlsbD0iIzNkZDY4YyIvPjx0ZXh0IHg9IjUxMiIgeT0iODYwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iSW50ZXIsIEhlbHZldGljYSwgQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iNzIiIGZvbnQtd2VpZ2h0PSI2MDAiIGZpbGw9IiNmMmYyZjAiPlZJUCBQSUNLUzwvdGV4dD48dGV4dCB4PSI1MTIiIHk9IjkzMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkludGVyLCBIZWx2ZXRpY2EsIEFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjM0IiBmaWxsPSIjYjRiNGI0Ij5TZWFzb24gcGFzcyDCtyA2MSUgaGl0IHJhdGUgwrcgTm9ydGh3aW5kIFBpY2tzPC90ZXh0Pjwvc3ZnPg==";

const campaigns = [
  { id: "adcamp_NwVipLeads", title: "VIP Picks — NFL kickoff", status: "active", objective: "sales", platform: "meta", budget_amount: 60, budget_type: "daily", budget_optimization: "ad_campaign", starts_at: iso(18 * DAY), ends_at: null, created_at: iso(18 * DAY), spend: 1044.2, impressions: 186400, reach: 121300, clicks: 4210, click_through_rate: 2.26, results: 63, cost_per_result: 16.58, return_on_ad_spend: 2.9 },
  { id: "adcamp_NwSeasonRetarget", title: "Season Pass — retargeting", status: "active", objective: "sales", platform: "meta", budget_amount: 25, budget_type: "daily", budget_optimization: "ad_campaign", starts_at: iso(9 * DAY), ends_at: null, created_at: iso(9 * DAY), spend: 221.75, impressions: 31200, reach: 12800, clicks: 1140, click_through_rate: 3.65, results: 11, cost_per_result: 20.16, return_on_ad_spend: 14.8 },
  { id: "adcamp_NwFreeRoom", title: "Free Picks Room — awareness", status: "paused", objective: "awareness", platform: "meta", budget_amount: 15, budget_type: "daily", budget_optimization: "ad_group", starts_at: iso(40 * DAY), ends_at: iso(12 * DAY), created_at: iso(40 * DAY), spend: 388.0, impressions: 402000, reach: 260000, clicks: 3900, click_through_rate: 0.97, results: 0, cost_per_result: null, return_on_ad_spend: 0 },
];
const adGroups = [
  { id: "adgrp_NwLookalike", ad_campaign_id: "adcamp_NwVipLeads", title: "Lookalike of buyers · US · 21-45", status: "active", optimization_goal: "conversions", budget_amount: null, budget_type: "daily", spend: 690.4, results: 44 },
  { id: "adgrp_NwInterest", ad_campaign_id: "adcamp_NwVipLeads", title: "Interest: sports betting, fantasy football", status: "active", optimization_goal: "conversions", budget_amount: null, budget_type: "daily", spend: 353.8, results: 19 },
  { id: "adgrp_NwVisitors", ad_campaign_id: "adcamp_NwSeasonRetarget", title: "Site visitors 30d, no purchase", status: "active", optimization_goal: "conversions", budget_amount: null, budget_type: "daily", spend: 221.75, results: 11 },
];
const adsList = [
  { id: "ad_NwKickoffA", ad_group_id: "adgrp_NwLookalike", title: "Kickoff — hit rate", status: "active", headlines: ["61% hit rate through Week 3"], descriptions: ["Daily picks, one Discord, cancel anytime."], call_to_action: "sign_up", destination_url: "https://whop.com/northwind-picks/vip-picks", creatives: [{ id: "file_NwPoster1" }], clicks: 2610, spend: 540.1 },
  { id: "ad_NwKickoffB", ad_group_id: "adgrp_NwLookalike", title: "Kickoff — proof", status: "active", headlines: ["Every pick, graded in public"], descriptions: ["See the full record before you pay."], call_to_action: "learn_more", destination_url: "https://whop.com/northwind-picks/vip-picks", creatives: [{ id: "file_NwPoster2" }, { id: "file_NwPoster3" }], clicks: 1600, spend: 504.1 },
  { id: "ad_NwRetarget", ad_group_id: "adgrp_NwVisitors", title: "Season pass — last chance", status: "active", headlines: ["Season Pass closes Sunday"], descriptions: ["One payment. Every pick until the Super Bowl."], call_to_action: "shop_now", destination_url: "https://whop.com/northwind-picks/season-pass", creatives: [{ id: "file_NwPoster4" }], clicks: 1140, spend: 221.75 },
  { id: "ad_NwFreeRoom", ad_group_id: "adgrp_NwInterest", title: "Free room", status: "paused", headlines: ["Free picks room, no card"], descriptions: ["Join 4,100 members."], call_to_action: "sign_up", destination_url: "https://whop.com/northwind-picks/free-picks", creatives: [], clicks: 3900, spend: 388 },
];
const audiences = [
  { id: "aud_NwBuyers90", title: "Buyers · last 90 days", size: 1153, created_at: iso(30 * DAY) },
  { id: "aud_NwVisitorsNoBuy", title: "Site visitors · no purchase · 30d", size: 8620, created_at: iso(10 * DAY) },
];
const socialAccounts = [{ id: "soc_NwFacebook", platform: "facebook", name: "Northwind Picks", username: "northwindpicks", verified: true, scopes: ["advertise"] }];
const bounties = [
  { id: "bnty_NwClips1", title: "Clip our best picks of the week", status: "open", bounty_type: "workforce", business_goal_type: "clipping", currency: "usd", description: "Create a short clip from our weekly picks review. Include captions, keep the original context, and submit a public link.", accepted_submissions_limit: 50, gross_reward_amount: 10, gross_paid_out_amount: 210, submissions_count: 37, accepted_submissions_count: 21, frequency: "weekly", publish_at: null, created_at: iso(6 * DAY) },
  { id: "bnty_NwUgc2", title: "Record a 30s reaction to a winning parlay", status: "open", bounty_type: "workforce", business_goal_type: "ugc_content", currency: "usd", description: "Record an original 30-second reaction. Use clear audio and submit a public video link.", accepted_submissions_limit: 20, gross_reward_amount: 15, gross_paid_out_amount: 60, submissions_count: 9, accepted_submissions_count: 4, frequency: "once", publish_at: null, created_at: iso(3 * DAY) },
  { id: "bnty_NwGrowth3", title: "Follow @northwindpicks and share the free room", status: "completed", bounty_type: "workforce", business_goal_type: "owned_account_growth", currency: "usd", accepted_submissions_limit: 150, gross_reward_amount: 1, gross_paid_out_amount: 150, submissions_count: 150, accepted_submissions_count: 150, frequency: "once", publish_at: null, created_at: iso(40 * DAY) },
];
const referred = [
  { id: "coma_NwRefTrend", title: "Trendline Trades", status: "active", referred_at: iso(80 * DAY), total_earnings: 1240.5 },
  { id: "coma_NwRefClip", title: "Clipfarm Studio", status: "active", referred_at: iso(22 * DAY), total_earnings: 96.2 },
];

function withPage<T>(data: T[]) {
  return { data, page_info: { start_cursor: null, end_cursor: null, has_next_page: false, has_previous_page: false } };
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

/** Resolves a CLI arg list against the demo dataset. Throws `{code,message}` when unknown. */
export function demoResolve(args: string[]): unknown {
  const result = businessDemo(args, demoSeed);
  return result.handled ? result.value : demoSeed(args);
}

function demoSeed(args: string[]): any {
  const [group, sub] = args;
  const key = `${group} ${sub ?? ""}`.trim();
  switch (key) {
    case "stats get": {
      const metric = args[2] ?? "net_revenue";
      const to = flag(args, "--to");
      const from = flag(args, "--from");
      const toTs = to ? Math.floor(Date.parse(to) / 1000) : todayUtc();
      const fromTs = from ? Math.floor(Date.parse(from) / 1000) : toTs - 29 * DAY;
      return { data: { points: series(metric, fromTs, toTs), currency: "usd" } };
    }
    case "ledgers report":
      return flag(args, "--report_type") === "income_statement" ? incomeStatement() : balanceSummary();
    case "ledgers list":
      return withPage(ledger());
    case "memberships list": {
      const st = flag(args, "--status");
      return withPage(memberships().filter((m) => !st || m.status === st));
    }
    case "members list":
      return withPage(members());
    case "payouts list":
      return withPage(payouts());
    case "products list":
      return withPage(products.map(({ plan, ...p }) => ({ ...p, account: { id: DEMO_ACCOUNT_ID, title: DEMO_ACCOUNT.title }, default_plan: plan })));
    case "people list":
      return withPage(people());
    case "apps list":
      return withPage(apps);
    case "recommended-actions list":
      return withPage(actions);
    case "ad-campaigns list": {
      const st = flag(args, "--status");
      return withPage(campaigns.filter((c) => !st || c.status === st));
    }
    case "ad-groups list":
      return withPage(adGroups);
    case "ads list":
      return withPage(adsList);
    case "audiences list":
      return withPage(audiences);
    case "social-accounts list":
      return withPage(socialAccounts);
    case "bounties list":
      return withPage(bounties);
    case "partners list":
      return withPage(referred);
    case "partners leaderboard":
      return { data: [{ rank: 1, user: { username: "growthwithgabe" }, earnings: 48210 }, { rank: 2, user: { username: "clipqueen" }, earnings: 31980 }, { rank: 3, user: { username: "sam.builds" }, earnings: 22440 }, { rank: 118, user: { username: "northwindpicks" }, earnings: 1336.7 }] };
    case "media generate": {
      const type = flag(args, "--type") === "video" ? "video" : "image";
      const id = `media_Nw_${type}_${Date.now().toString(36)}`;
      return demoMedia(type, id, flag(args, "--prompt") ?? "");
    }
    case "media get":
      return demoMedia(args[2]?.includes("_video_") ? "video" : "image", args[2], "");
    case "disputes list":
      return withPage([
        { id: "dis_Nw1xQ", status: "needs_response", reason: "product_not_received", amount: usd(49), created_at: iso(1.2 * DAY), due_by: iso(-5 * DAY), user: { username: "benny_locks" } },
      ]);
    case "accounts get":
      return { ...DEMO_ACCOUNT, business_type: "community", industry_type: "sports_betting", country: "us" };
    case "auth status":
      return { loggedIn: true, profile: "demo", account: { id: DEMO_ACCOUNT_ID, title: DEMO_ACCOUNT.title } };
    default:
      throw { code: "DEMO", message: `No demo data for \`whop ${key}\`. Switch to a real business to run it.` };
  }
}

/** Bundled, labeled samples. Never represented as prompt-generated work. */
export const DEMO_VIDEO = "/demo/studio-sample.mp4";
function demoMedia(type: "image" | "video", id: string, prompt: string) {
  return { id, status: "completed", type, prompt, file: { id: `file_Nw_${type}`, url: type === "video" ? DEMO_VIDEO : DEMO_POSTER, content_type: type === "video" ? "video/mp4" : "image/svg+xml" }, cost: "0.00", model: "demo-sample", created_at: new Date().toISOString() };
}
