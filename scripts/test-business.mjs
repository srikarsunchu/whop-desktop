import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";
const moduleFrom = async (path) => {
  const src = fs.readFileSync(path, "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(
    "data:text/javascript;base64," + Buffer.from(js).toString("base64")
  );
};
const { productCommand, planCommand, payoutCommand, bountyCommand } =
  await moduleFrom("src/lib/business-actions.ts");
const { businessDemo } = await moduleFrom("src/lib/business-demo.ts");
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, v),
};
const seed = (args) => ({
  data:
    args[0] === "products"
      ? [
          {
            id: "prod_seed",
            title: "Free community",
            default_plan: {
              id: "plan_free",
              plan_type: "one_time",
              initial_price: { amount: "0", currency: "usd" },
              renewal_price: { amount: "0", currency: "usd" },
            },
          },
        ]
      : [],
});
const run = (a) => businessDemo(a, seed).value;
assert.throws(() => productCommand(undefined, { title: " " }, "k"), /name/);
assert.throws(
  () =>
    payoutCommand(
      { amount: "NaN", currency: "usd", payout_method_id: "potk_1" },
      "k",
    ),
  /amount/,
);
assert.throws(
  () =>
    payoutCommand(
      { amount: "1", currency: "usd", payout_method_id: "wrong" },
      "k",
    ),
  /destination/,
);
assert.throws(
  () =>
    bountyCommand(
      { gross_reward_amount: "2", accepted_submissions_limit: "1" },
      "k",
    ),
  /at least/,
);
assert.throws(
  () =>
    bountyCommand(
      { gross_reward_amount: "2.5", accepted_submissions_limit: "10" },
      "k",
    ),
  /whole/,
);
assert.throws(
  () =>
    planCommand(
      "prod",
      undefined,
      { initial_price: "-1", currency: "usd" },
      "k",
    ),
  /zero/,
);
const args = productCommand(
  undefined,
  { title: "Test offer", description: "Useful work" },
  "same-request",
);
const created = run(args);
assert.equal(created.visibility, "hidden");
assert.equal(run(args).id, created.id);
assert.equal(
  run(["products", "list"]).data.filter((p) => p.id === created.id).length,
  1,
);
assert.throws(
  () =>
    run(productCommand(undefined, { title: "Different body" }, "same-request")),
  /different/,
);
const plan = run(
  planCommand(
    created.id,
    undefined,
    {
      title: "Monthly",
      plan_type: "renewal",
      initial_price: "49",
      renewal_price: "49",
      currency: "usd",
      billing_period: "30",
    },
    "plan-request",
  ),
);
assert.equal(run(["products", "get", created.id]).default_plan.id, plan.id);
assert.equal(run(["plans", "list", "--product_id", created.id]).data.length, 1);
run(["products", "publish", created.id]);
assert.equal(run(["products", "get", created.id]).visibility, "visible");
assert.throws(
  () =>
    run([
      "memberships",
      "invite",
      "--email",
      "test@example.com",
      "--plan_id",
      plan.id,
    ]),
  /free/,
);
const membership = run([
  "memberships",
  "invite",
  "--email",
  "test@example.com",
  "--plan_id",
  "plan_free",
  "--idempotency-key",
  "invite-key",
]);
run(["memberships", "pause", membership.id]);
assert.equal(run(["memberships", "get", membership.id]).status, "paused");
run(["memberships", "cancel", membership.id, "--cancel_at_period_end", "true"]);
assert.equal(run(["memberships", "get", membership.id]).status, "canceling");
const first = run(["products", "list", "--first", "1"]);
assert.equal(first.page_info.has_next_page, true);
const next = run([
  "products",
  "list",
  "--first",
  "1",
  "--after",
  first.page_info.end_cursor,
]);
assert.notEqual(first.data[0].id, next.data[0].id);
const payout = payoutCommand(
  { amount: "25", currency: "usd", payout_method_id: "potk_demo_chase" },
  "payout-key",
);
assert.ok(payout.includes("--acknowledge_bank_warning"));
assert.equal(payout[payout.indexOf("--acknowledge_bank_warning") + 1], "false");
assert.equal(run(payout).id, run(payout).id);
console.log(
  "Business workflow checks passed: validation, product/plan relationships, scoped pagination, persistent actions, free-plan invites, membership transitions, payout guard, and retry deduplication.",
);

// wv's gate as the panels see it: data passes, a plan is a gate, a refusal is a gate, a rerun's envelope is read.
const {gatedResult,rerunOutcome}=await moduleFrom('src/lib/gate.ts');
assert.equal(gatedResult({data:{data:[]}}).kind,'done');
const g=gatedResult({ok:false,error:{code:'CONFIRMATION_REQUIRED',message:'m'},plan:{kind:'write'},rerun:['wv','products','update','prod_1','--approve','t']});
assert.equal(g.kind,'gate');assert.equal(g.gate.kind,'plan');
assert.equal(gatedResult({ok:false,error:{code:'WV_CAP',message:'over'},plan:{}}).gate.kind,'refused');
assert.deepEqual(rerunOutcome('{"ok":true,"data":{"id":"prod_1"}}',0),{ok:true,data:{id:'prod_1'}});
assert.equal(rerunOutcome('{"ok":false,"error":{"code":"APPROVAL_EXPIRED","message":"stale"}}',2).ok,false);
assert.equal(rerunOutcome('',0).ok,true);
console.log('Gate checks passed: data, plan, refusal, rerun outcomes.');

// Support's rows: titles behind the ids a real membership carries, the actions each status offers, money shapes,
// the dispute clock, and a section wv could not read.
const { supportRows, titlesOf, amountOf } = await moduleFrom("src/lib/support.ts");
const now = Date.parse("2026-09-22T00:00:00Z");
const real = supportRows(
  {
    memberships: [{ id: "mem_1", status: "completed", product_id: "prod_1", plan_id: "plan_1", current_period_end: null }, { id: "mem_2", status: "active", product_id: "prod_2", plan_id: "plan_9", current_period_end: "2026-10-01T00:00:00Z", cancel_at_period_end: true }],
    payments: [{ id: "pay_1", status: "paid", refundable: true, currency: "usd", total: { amount: "10.00", currency: "usd" }, refunded_amount: { amount: "2.50", currency: "usd" }, billing_reason: "one_time", created_at: "2026-09-16T00:00:00Z" }],
    disputes: [{ id: "dsp_1", status: "needs_response", reason: "product_not_received", amount: { amount: "49.00", currency: "usd" }, evidence_due_at: "2026-09-22T12:00:00Z" }],
    cases: { error: "resolution-center-cases list refused this login" },
  },
  { products: titlesOf([{ id: "prod_1", title: "Hypermotion" }, { id: "prod_2", title: "Frame" }]), plans: titlesOf([{ id: "plan_1", title: "Flex — 300 credits" }]) },
  now,
);
assert.deepEqual(real.memberships.map((m) => [m.product, m.plan, m.actions]), [["Hypermotion", "Flex — 300 credits", []], ["Frame", "plan_9", ["extend", "pause", "cancel"]]], "titles from the lists, the id when no list names it, actions by status");
assert.equal(real.memberships[1].ends, true);
assert.deepEqual([real.payments[0].amount, real.payments[0].refunded, real.payments[0].reason, real.payments[0].refundable], [10, 2.5, "One Time", true]);
assert.deepEqual([real.disputes[0].urgent, real.disputes[0].answerable, real.disputes[0].reason], [true, true, "Product Not Received"], "under 24 hours is urgent");
assert.equal(real.cases.length, 0);
assert.match(real.errors.cases, /refused/);
const demo = supportRows({ memberships: [{ id: "mem_d", status: "paused", product: { id: "p", title: "VIP Picks" }, plan: { id: "q", title: "Monthly" }, renewal_period_end: "2026-09-14T23:26:52Z" }], payments: [], disputes: [{ id: "dsp_d", status: "won", amount: 49, due_by: "2026-09-27T00:00:00Z" }], cases: [] }, {}, now);
assert.deepEqual([demo.memberships[0].product, demo.memberships[0].plan, demo.memberships[0].periodEnd, demo.memberships[0].actions], ["VIP Picks", "Monthly", "2026-09-14T23:26:52Z", ["resume"]], "nested titles win; paused offers resume");
assert.deepEqual([demo.disputes[0].amount, demo.disputes[0].urgent, demo.disputes[0].answerable], [49, false, false]);
assert.deepEqual(supportRows(undefined), { memberships: [], payments: [], disputes: [], cases: [], errors: {} });
assert.equal(amountOf("12.5"), 12.5);
assert.equal(amountOf({ amount: "x" }), undefined);
console.log("Support checks passed: titles, actions by status, money, the dispute clock, and unread sections.");
