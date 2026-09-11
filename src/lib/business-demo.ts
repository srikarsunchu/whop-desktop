/** Persistent, isolated business demo. No imports from the command bridge. */
type Row = { id: string; [key: string]: any };
type Store = { tables: Record<string, Row[]>; requests: Record<string, any> };
const STORAGE = "whop.business-demo.v1";
const flag = (a: string[], k: string) => {
  const i = a.indexOf(`--${k}`);
  return i < 0 ? undefined : a[i + 1];
};
const page = (rows: Row[], args: string[]) => {
  const cursor = flag(args, "after") ?? flag(args, "cursor");
  const start = cursor ? rows.findIndex((r) => r.id === cursor) + 1 : 0;
  const count = Number(flag(args, "first") ?? flag(args, "limit") ?? 100);
  const data = rows.slice(start, start + count);
  return {
    data,
    page_info: {
      has_next_page: start + count < rows.length,
      end_cursor: data.at(-1)?.id ?? null,
    },
  };
};
function read(): Store {
  try {
    return (
      JSON.parse(localStorage.getItem(STORAGE) ?? "null") ?? {
        tables: {},
        requests: {},
      }
    );
  } catch {
    return { tables: {}, requests: {} };
  }
}
function write(s: Store) {
  localStorage.setItem(STORAGE, JSON.stringify(s));
}
export function businessDemo(
  args: string[],
  seed: (args: string[]) => any,
): { handled: boolean; value?: any } {
  const [group, verb, id] = args;
  if (
    [
      "media",
      "stats",
      "ad-campaigns",
      "ad-groups",
      "ads",
      "audiences",
      "social-accounts",
      "recommended-actions",
      "accounts",
    ].includes(group)
  )
    return { handled: false };
  const state = read();
  const supported = [
    "products",
    "plans",
    "memberships",
    "members",
    "people",
    "payouts",
    "bounties",
    "apps",
    "team-members",
    "disputes",
    "ledgers",
  ];
  const rows = (g: string): Row[] => {
    if (!state.tables[g]) {
      if (g === "plans")
        state.tables[g] = rows("products").flatMap((p) =>
          p.default_plan
            ? [
                {
                  ...p.default_plan,
                  product_id: p.id,
                  title: p.default_plan.title ?? `${p.title} access`,
                  custom_fields: [],
                  visibility: "visible",
                },
              ]
            : [],
        );
      else if (g === "team-members")
        state.tables[g] = [
          {
            id: "ausr_demo_owner",
            user: { name: "Demo owner" },
            email: "owner@example.com",
            role: "owner",
            status: "active",
          },
        ];
      else state.tables[g] = structuredClone(seed([g, "list"]).data ?? []);
    }
    return state.tables[g];
  };
  if (group === "auth" && verb === "list")
    return {
      handled: true,
      value: {
        active: "demo",
        profiles: [
          { name: "demo", method: "local", accountTitle: "Northwind Picks" },
        ],
      },
    };
  if (group === "auth" && verb === "switch")
    return { handled: true, value: { active: "demo" } };
  if (group === "events" && verb === "pulse")
    return {
      handled: true,
      value: {
        data: [
          {
            id: "event_demo_visit",
            event: "page_view",
            page: "/vip-picks",
            created_at: new Date().toISOString(),
            source: "Local sample",
          },
        ],
      },
    };
  if (group === "partners" && verb === "create")
    return {
      handled: true,
      value: { status: "enrolled", message: "Local demo enrollment" },
    };
  if (!supported.includes(group)) return { handled: false };
  if (group === "ledgers" && verb === "report") {
    const result = structuredClone(seed(args));
    if (flag(args, "report_type") === "balance_summary") {
      const extra = rows("payouts").filter((p) => p.local_demo);
      const total = extra.reduce((n, p) => n + Number(p.amount.amount), 0);
      result.rows = result.rows.map((r: any) =>
        r.category === "available"
          ? { ...r, amount: String(Number(r.amount) - total) }
          : r,
      );
      result.total -= total;
    }
    return { handled: true, value: result };
  }
  if (group === "payouts" && verb === "methods") {
    const amount = Number(flag(args, "amount") ?? 0);
    return {
      handled: true,
      value: page(
        [
          {
            id: "potk_demo_chase",
            name: "Chase ••4417",
            status: "active",
            destination: "Chase ••4417",
            ...(amount
              ? {
                  quote: {
                    amount,
                    fee: 0,
                    amount_received: amount,
                    currency: flag(args, "currency") ?? "usd",
                    speed: "standard",
                  },
                }
              : {}),
          },
        ],
        args,
      ),
    };
  }
  if (group === "apps" && verb === "builds") {
    if (id === "list") {
      const app = flag(args, "app_id")!;
      const builds = state.tables.builds ?? [];
      return {
        handled: true,
        value: page(
          [
            ...builds.filter((b) => b.app_id === app),
            {
              id: `abld_demo_${app}`,
              app_id: app,
              status: "approved",
              created_at: new Date().toISOString(),
              name: "Sample build",
            },
          ],
          args,
        ),
      };
    }
    if (id === "get")
      return {
        handled: true,
        value: {
          id: args[3],
          status: "approved",
          platform: "web",
          message: "Local demo build",
        },
      };
    if (id === "promote")
      return {
        handled: true,
        value: {
          id: args[3],
          status: "promoted",
          message: "Demo promotion only",
        },
      };
  }
  if (group === "apps" && verb === "logs")
    return {
      handled: true,
      value: page(
        [
          {
            id: "log_demo_1",
            level: "info",
            message: "Sample app is ready",
            created_at: new Date().toISOString(),
          },
        ],
        args,
      ),
    };
  if (group === "bounties" && verb === "submissions")
    return {
      handled: true,
      value: page(
        [
          {
            id: `bsub_demo_${id}`,
            status: "submitted",
            title: "Sample creator clip",
            description: "A local sample submission for inspection.",
          },
        ],
        args,
      ),
    };
  if (group === "bounties" && verb === "get-submission")
    return {
      handled: true,
      value: {
        id,
        status: "submitted",
        description: "Sample creator clip submitted for review.",
        creator: "Demo creator",
        sample: true,
      },
    };
  let list = rows(group);
  if (verb === "list") {
    if (group === "ledgers")
      list = [
        ...rows("payouts")
          .filter((p) => p.local_demo)
          .map((p) => ({
            id: `led_${p.id}`,
            description: `Payout to ${p.destination}`,
            type: "payout",
            amount: { ...p.amount, amount: String(-Number(p.amount.amount)) },
            created_at: p.created_at,
          })),
        ...list,
      ];
    if (group === "products")
      list = list.map((p) => ({
        ...p,
        default_plan:
          state.tables.plans?.find(
            (pl) => pl.product_id === p.id && pl.id === p.default_plan?.id,
          ) ?? p.default_plan,
      }));
    if (flag(args, "product_id"))
      list = list.filter((r) => r.product_id === flag(args, "product_id"));
    if (flag(args, "status"))
      list = list.filter((r) => r.status === flag(args, "status"));
    return { handled: true, value: page(list, args) };
  }
  if (verb === "get") {
    const found = list.find((r) => r.id === id);
    if (!found) throw Error("This demo record no longer exists.");
    return {
      handled: true,
      value:
        group === "products"
          ? {
              ...found,
              default_plan:
                state.tables.plans?.find(
                  (p) => p.id === found.default_plan?.id,
                ) ?? found.default_plan,
            }
          : found,
    };
  }
  const key = flag(args, "idempotency-key");
  const body = JSON.stringify(args);
  if (key && state.requests[key]) {
    if (state.requests[key].body !== body)
      throw Error("This request key was already used with different values.");
    return { handled: true, value: state.requests[key].result };
  }
  const values: Record<string, any> = {};
  for (let i = 0; i < args.length; i++)
    if (args[i].startsWith("--")) {
      const field = args[i].slice(2);
      if (!["account_id", "idempotency-key"].includes(field))
        values[field] = args[i + 1];
      i++;
    }
  let result: Row;
  if (["create", "invite", "init"].includes(verb)) {
    const prefixes: Record<string, string> = {
      products: "prod",
      plans: "plan",
      memberships: "mem",
      payouts: "pay",
      bounties: "bnty",
      apps: "app",
      "team-members": "ausri",
    };
    if (!prefixes[group]) return { handled: false };
    result = {
      id: `${prefixes[group]}_demo_${crypto.randomUUID()}`,
      created_at: new Date().toISOString(),
      ...values,
      local_demo: true,
    };
    if (group === "products")
      Object.assign(result, {
        visibility: "hidden",
        route: values.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        member_count: 0,
      });
    if (group === "plans") {
      for (const field of ["initial_price", "renewal_price"])
        result[field] = {
          currency: values.currency ?? "usd",
          amount: values[field] ?? "0",
        };
      result.billing_period = Number(values.billing_period ?? 0);
      result.custom_fields = [];
      const p = rows("products").find((p) => p.id === values.product_id);
      if (p && !p.default_plan) p.default_plan = result;
    }
    if (group === "memberships") {
      const plan = rows("plans").find((p) => p.id === values.plan_id);
      if (
        !plan ||
        Number(plan.initial_price?.amount) > 0 ||
        Number(plan.renewal_price?.amount) > 0
      )
        throw Error("Invites require a free plan.");
      Object.assign(result, {
        status: "active",
        plan,
        product: rows("products").find((p) => p.id === plan.product_id),
        user: {
          id: `user_demo_${crypto.randomUUID()}`,
          name: values.email,
          username: values.email,
        },
      });
    }
    if (group === "payouts") {
      Object.assign(result, {
        amount: { amount: values.amount, currency: values.currency },
        status: "pending",
        destination: "Chase ••4417",
      });
    }
    if (group === "bounties")
      Object.assign(result, {
        status: "open",
        submissions_count: 0,
        accepted_submissions_count: 0,
        gross_paid_out_amount: 0,
      });
    if (group === "apps") Object.assign(result, { status: "draft" });
    if (group === "team-members") Object.assign(result, { status: "pending" });
    list.unshift(result);
  } else if (group === "apps" && verb === "deploy") {
    result = {
      id: `abld_demo_${crypto.randomUUID()}`,
      app_id: values.app,
      status: "approved",
      name: "Local preview",
      created_at: new Date().toISOString(),
    };
    (state.tables.builds ??= []).unshift(result);
  } else {
    const found = list.find((r) => r.id === id);
    if (!found) throw Error("Demo record not found.");
    result = found;
    if (verb === "delete")
      state.tables[group] = list.filter((r) => r.id !== id);
    else if (verb === "update") {
      if (group === "plans") {
        for (const field of ["initial_price", "renewal_price"])
          if (values[field] != null)
            values[field] = {
              amount: values[field],
              currency: values.currency ?? found.currency ?? "usd",
            };
        if (values.custom_fields)
          values.custom_fields = JSON.parse(values.custom_fields);
      }
      Object.assign(found, values);
    } else if (verb === "publish" || verb === "unpublish")
      found.visibility = verb === "publish" ? "visible" : "hidden";
    else if (verb === "pause") found.status = "paused";
    else if (verb === "resume") found.status = "active";
    else if (verb === "cancel") {
      found.status =
        values.cancel_at_period_end === "true" ? "canceling" : "canceled";
      found.cancel_at_period_end = values.cancel_at_period_end === "true";
    } else return { handled: false };
  }
  if (key) state.requests[key] = { body, result: structuredClone(result) };
  write(state);
  return { handled: true, value: result };
}
