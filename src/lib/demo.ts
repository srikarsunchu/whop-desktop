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
  const r = rng(metric.length * 7919 + 17);
  const out: { timestamp: number; value: number }[] = [];
  for (let t = from; t <= to; t += DAY) {
    const dow = new Date(t * 1000).getUTCDay();
    const weekend = dow === 0 || dow === 6 ? 1.35 : 1;
    const i = (t - from) / DAY;
    let v: number;
    switch (metric) {
      case "net_revenue":
      case "gross_revenue":
        v = (820 + i * 14 + r() * 900) * weekend;
        break;
      case "new_memberships":
        v = Math.round((6 + r() * 11) * weekend);
        break;
      case "active_memberships":
        v = 1180 + Math.round(i * 3.4 + r() * 6);
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
      renewal_period_end: p.plan.plan_type === "renewal" ? iso(-(4 + i) * DAY) : null,
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
  { id: "rac_NwWinback", title: "Win back 14 past-due members", description: "Send a 20% promo to memberships that failed renewal this week.", category: "retention" },
  { id: "rac_NwPublish", title: "Publish Model Sheet Access", description: "It has 58 members but is hidden from your storefront.", category: "growth" },
  { id: "rac_NwPayout", title: "Schedule weekly payouts", description: "$18,420.55 is available. Turn on automatic payouts every Friday.", category: "money" },
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
