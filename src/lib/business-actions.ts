/** Validated command builders. Kept independent of React for contract tests. */
export function buildFields(
  group: string,
  verb: string,
  id: string | undefined,
  values: Record<string, string>,
  key?: string,
) {
  const args = [group, verb, ...(id ? [id] : [])];
  for (const [field, value] of Object.entries(values))
    if (value.trim()) args.push(`--${field}`, value.trim());
  if (key) args.push("--idempotency-key", key);
  return args;
}
export function positive(value: string, label: string, integer = false) {
  const n = Number(value);
  if (
    !value?.trim() ||
    !Number.isFinite(n) ||
    n <= 0 ||
    (integer && !Number.isInteger(n))
  )
    throw Error(
      `${label} must be a positive ${integer ? "whole number" : "amount"}.`,
    );
  return n;
}
export function productCommand(
  id: string | undefined,
  v: Record<string, string>,
  key: string,
) {
  if (!v.title?.trim() || v.title.trim().length > 80)
    throw Error("Use a product name between 1 and 80 characters.");
  return buildFields(
    "products",
    id ? "update" : "create",
    id,
    { ...v, ...(!id ? { visibility: "hidden" } : {}) },
    id ? undefined : key,
  );
}
export function planCommand(
  productId: string,
  id: string | undefined,
  v: Record<string, string>,
  key: string,
) {
  for (const field of ["initial_price", "renewal_price"])
    if (
      v[field] &&
      (!Number.isFinite(Number(v[field])) || Number(v[field]) < 0)
    )
      throw Error("Prices must be zero or greater.");
  if (!/^[a-z]{3}$/i.test(v.currency ?? ""))
    throw Error("Use a three-letter currency code.");
  if (v.plan_type === "renewal")
    positive(v.billing_period, "Billing interval", true);
  const { plan_type, ...rest } = v;
  if (plan_type === "one_time") {
    delete rest.renewal_price;
    delete rest.billing_period;
  }
  return buildFields(
    "plans",
    id ? "update" : "create",
    id,
    {
      ...rest,
      ...(!id
        ? { product_id: productId, plan_type, visibility: "visible" }
        : {}),
    },
    id ? undefined : key,
  );
}
export function payoutCommand(v: Record<string, string>, key: string) {
  positive(v.amount, "Withdrawal");
  if (!v.payout_method_id?.startsWith("potk_"))
    throw Error("Choose a saved payout destination.");
  if (!/^[a-z]{3}$/i.test(v.currency ?? "")) throw Error("Choose a currency.");
  return buildFields(
    "payouts",
    "create",
    undefined,
    { ...v, speed: "standard", acknowledge_bank_warning: "false" },
    key,
  );
}
export function bountyCommand(v: Record<string, string>, key: string) {
  const reward = positive(v.gross_reward_amount, "Reward", true),
    slots = positive(v.accepted_submissions_limit, "Winner slots", true);
  if (reward * slots < 5)
    throw Error("The total reward pool must be at least $5.");
  return buildFields("bounties", "create", undefined, v, key);
}
