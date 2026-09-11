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
