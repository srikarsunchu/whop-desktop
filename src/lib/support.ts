// The Support view's rows, pure over wv's `support lookup` JSON: which actions each membership, payment,
// dispute, and case offers, and the titles behind the ids the API's membership record carries. No imports, so
// the test scripts load it as is; the view formats money and dates.

export type SupportRow = { id: string; [key: string]: any };
export type Section = SupportRow[] | { error: string } | undefined;

/** Titles by id, from `products list` and `plans list`, for records that carry only `product_id` and `plan_id`. */
export interface Titles {
  products?: Record<string, string>;
  plans?: Record<string, string>;
}

export interface MembershipRow {
  id: string;
  product: string;
  plan: string;
  status: string;
  /** ISO, when the record carries a period end. */
  periodEnd?: string;
  /** True when the period end is the end, not a renewal. */
  ends: boolean;
  actions: ("extend" | "pause" | "cancel" | "resume")[];
}
export interface PaymentRow {
  id: string;
  amount?: number;
  currency: string;
  refunded: number;
  status: string;
  reason: string;
  createdAt?: string;
  refundable: boolean;
}
export interface DisputeRow {
  id: string;
  amount?: number;
  currency: string;
  reason: string;
  inquiry: boolean;
  due?: string;
  /** Under 24 hours to the evidence deadline. */
  urgent: boolean;
  status: string;
  answerable: boolean;
}
export interface CaseRow {
  id: string;
  subject: string;
  status: string;
  createdAt?: string;
  replyable: boolean;
}
export interface SupportRows {
  memberships: MembershipRow[];
  payments: PaymentRow[];
  disputes: DisputeRow[];
  cases: CaseRow[];
  /** A section wv could not read, in wv's words. */
  errors: Partial<Record<"memberships" | "payments" | "disputes" | "cases", string>>;
}

const LIVE = new Set(["active", "trialing", "past_due"]);
const rows = (v: Section): SupportRow[] => (Array.isArray(v) ? v : []);
const failed = (v: Section): string | undefined => (v && !Array.isArray(v) ? v.error : undefined);
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

/** A money value as the API spells it: `{amount, currency}`, a number, or a numeric string. */
export function amountOf(v: unknown): number | undefined {
  if (v && typeof v === "object" && !Array.isArray(v)) return amountOf((v as Record<string, unknown>).amount);
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string" && v !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}
const currencyOf = (v: unknown, fallback: string): string => (v && typeof v === "object" ? str((v as Record<string, unknown>).currency) : undefined) ?? fallback;
const words = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** The amount a payment shows: the presentment total when the API gives one, else its total or amount. */
export const paymentAmount = (p: SupportRow): unknown => p.total ?? p.presentment_total ?? p.amount ?? p.amount_after_fees;

export function supportRows(d: { memberships?: Section; payments?: Section; disputes?: Section; cases?: Section } | undefined, titles: Titles = {}, now = Date.now()): SupportRows {
  const errors: SupportRows["errors"] = {};
  for (const k of ["memberships", "payments", "disputes", "cases"] as const) {
    const e = failed(d?.[k]);
    if (e) errors[k] = e;
  }
  const memberships = rows(d?.memberships).map((m): MembershipRow => {
    const status = String(m.status ?? "");
    const periodEnd = str(m.current_period_end) ?? str(m.renewal_period_end);
    return {
      id: String(m.id),
      product: str(m.product?.title) ?? (str(m.product_id) && titles.products?.[m.product_id]) ?? str(m.product_id) ?? str(m.product?.id) ?? "—",
      plan: str(m.plan?.title) ?? (str(m.plan_id) && titles.plans?.[m.plan_id]) ?? str(m.plan_id) ?? str(m.plan?.id) ?? "",
      status,
      periodEnd,
      ends: m.cancel_at_period_end === true,
      actions: LIVE.has(status) ? ["extend", "pause", "cancel"] : status === "paused" ? ["resume"] : [],
    };
  });
  const payments = rows(d?.payments).map((p): PaymentRow => {
    const currency = str(p.currency) ?? currencyOf(paymentAmount(p), "usd");
    return {
      id: String(p.id),
      amount: amountOf(paymentAmount(p)),
      currency,
      refunded: amountOf(p.refunded_amount) ?? 0,
      status: String(p.status ?? ""),
      reason: words(String(p.billing_reason ?? "")),
      createdAt: str(p.created_at),
      refundable: p.status === "paid" && p.refundable !== false,
    };
  });
  const disputes = rows(d?.disputes).map((x): DisputeRow => {
    const due = str(x.evidence_due_at) ?? str(x.due_by);
    const left = due ? Date.parse(due) - now : NaN;
    return {
      id: String(x.id),
      amount: amountOf(x.amount),
      currency: str(x.currency) ?? currencyOf(x.amount, "usd"),
      reason: words(String(x.reason ?? "dispute")),
      inquiry: x.inquiry === true,
      due,
      urgent: Number.isFinite(left) && left < 86_400_000,
      status: String(x.status ?? ""),
      answerable: x.status === "needs_response",
    };
  });
  const cases = rows(d?.cases).map((c): CaseRow => ({
    id: String(c.id),
    subject: str(c.subject) ?? words(String(c.reason ?? "case")),
    status: String(c.status ?? ""),
    createdAt: str(c.created_at),
    replyable: c.status === "awaiting_merchant",
  }));
  return { memberships, payments, disputes, cases, errors };
}

/** `id → title` from a list of records that carry both. */
export function titlesOf(list: SupportRow[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of list ?? []) if (str(r.id) && str(r.title)) out[r.id] = r.title;
  return out;
}
