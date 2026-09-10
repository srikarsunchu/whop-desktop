import type { Money } from "./whop";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const compactNum = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const plain = new Intl.NumberFormat("en-US");

export function money(m: Money | number | string | null | undefined, currency = "usd"): string {
  if (m == null) return "—";
  const amount = typeof m === "object" ? Number(m.amount) : Number(m);
  const cur = typeof m === "object" ? m.currency : currency;
  if (!Number.isFinite(amount)) return "—";
  if (cur.toLowerCase() === "usd") return usd.format(amount);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: cur.toUpperCase() }).format(amount);
}

export const num = (n: number | null | undefined) => (n == null ? "—" : plain.format(n));
export const compact = (n: number | null | undefined) => (n == null ? "—" : compactNum.format(n));

export function relative(iso: string | number | null | undefined): string {
  if (!iso) return "—";
  const t = typeof iso === "number" ? iso * (iso < 1e12 ? 1000 : 1) : Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  const s = Math.round(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

export function shortDate(iso: string | number | null | undefined): string {
  if (!iso) return "—";
  const t = typeof iso === "number" ? iso * (iso < 1e12 ? 1000 : 1) : Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

export function pctDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export const titleCase = (s: string | null | undefined) =>
  (s ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function planPrice(plan: { plan_type?: string; billing_period?: number | null; initial_price?: Money; renewal_price?: Money } | null | undefined): string {
  if (!plan) return "—";
  const renewal = plan.renewal_price && Number(plan.renewal_price.amount) > 0 ? plan.renewal_price : null;
  const initial = plan.initial_price ?? renewal;
  if (!initial) return "—";
  const base = money(initial);
  if (plan.plan_type === "renewal" && renewal) {
    const days = plan.billing_period ?? 30;
    const unit = days === 7 ? "wk" : days === 365 ? "yr" : days === 90 ? "qtr" : "mo";
    return `${money(renewal)}/${unit}`;
  }
  if (Number(initial.amount) === 0) return "Free";
  return base;
}
