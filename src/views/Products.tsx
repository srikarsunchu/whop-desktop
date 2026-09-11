import { Button, toast } from "frosted-ui";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PageHeader, QueryBody } from "../components/Panel";
import {
  ActionEditor,
  Detail,
  Directory,
  Facts,
  RecordDialog,
  RecordTable,
  Records,
  useSaved,
  option,
  type ActionSpec,
  type RecordData,
} from "../components/Workspace";
import { useAccount, useWhop, runWhopJson, type Page } from "../lib/whop";
import { StatusBadge } from "../components/UserCell";
import { planPrice, shortDate } from "../lib/format";
import { productCommand, planCommand } from "../lib/business-actions";

export function Products({
  onStudio,
}: {
  runInTerminal: (c: string) => void;
  onStudio?: (p: RecordData) => void;
}) {
  const { account } = useAccount();
  const [selected, setSelected] = useSaved<RecordData | null>(
    "products.selected",
    null,
  );
  const [action, setAction] = useState<ActionSpec | null>(null);
  const detail = useWhop<RecordData>(
    selected ? ["products", "get", selected.id] : null,
  );
  const p = detail.data?.id === selected?.id ? detail.data : selected;
  const plans = useWhop<Page<RecordData>>(
    p ? ["plans", "list", "--product_id", p.id, "--first", "100"] : null,
  );
  function edit(product?: RecordData) {
    setAction({
      key: `product.${product?.id ?? "new"}`,
      title: product ? "Edit product" : "Create product",
      description: product
        ? "Update the information customers see. Blank optional fields are left unchanged."
        : "Create a hidden product, then add pricing and review it before publishing.",
      initial: {
        title: product?.title ?? "",
        headline: product?.headline ?? "",
        description: product?.description ?? "",
      },
      fields: [
        { key: "title", label: "Product name", required: true },
        { key: "headline", label: "Headline" },
        { key: "description", label: "Description", type: "textarea" },
      ],
      build: (v, k) => productCommand(product?.id, v, k),
      review: (v) => (
        <div className="workspace-preview">
          <span className="workspace-eyebrow">CONTENT PREVIEW</span>
          <h3>{v.title || "Your product"}</h3>
          <strong>{v.headline}</strong>
          <p>
            {v.description || "Add a description of what customers receive."}
          </p>
        </div>
      ),
      onSuccess: (r) => {
        if (r?.id) setSelected(r);
      },
    });
  }
  async function editPlan(plan?: RecordData) {
    if (!p) return;
    if (plan) {
      try {
        plan = await runWhopJson<RecordData>(
          ["plans", "get", plan.id],
          !!account?.demo,
        );
      } catch (e) {
        toast.error((e as Error).message ?? "Could not load the pricing plan.");
        return;
      }
    }
    const price = (x: any) =>
      x && typeof x === "object" ? x.amount : String(x ?? "0");
    setAction({
      key: `plan.${plan?.id ?? p.id}`,
      title: plan ? "Edit pricing plan" : "Add pricing plan",
      description:
        "Prices are in whole currency units, for example 49.00. Existing custom checkout fields are preserved on edits.",
      initial: {
        title: plan?.title ?? "",
        plan_type: plan?.plan_type ?? "renewal",
        currency: plan?.initial_price?.currency ?? plan?.currency ?? "usd",
        initial_price: price(plan?.initial_price),
        renewal_price: price(plan?.renewal_price),
        billing_period: String(plan?.billing_period ?? 30),
      },
      fields: [
        { key: "title", label: "Plan name", required: true },
        ...(!plan
          ? [
              {
                key: "plan_type",
                label: "Billing type",
                required: true,
                options: [
                  option("renewal", "Recurring"),
                  option("one_time", "One time"),
                ],
              },
            ]
          : []),
        { key: "currency", label: "Currency", required: true },
        {
          key: "initial_price",
          label: "Initial price",
          type: "number",
          min: 0,
          required: true,
        },
        {
          key: "renewal_price",
          label: "Renewal price",
          type: "number",
          min: 0,
          hint: "Used for recurring plans.",
        },
        {
          key: "billing_period",
          label: "Billing interval (days)",
          type: "number",
          min: 1,
        },
      ],
      build: (v, k) =>
        planCommand(
          p.id,
          plan?.id,
          {
            ...v,
            ...(plan
              ? { custom_fields: JSON.stringify(plan.custom_fields ?? []) }
              : {}),
          },
          k,
        ),
    });
  }
  function change(verb: string) {
    if (!p) return;
    setAction({
      key: `${verb}.${p.id}`,
      title: `${verb === "publish" ? "Publish" : verb === "delete" ? "Delete" : "Unpublish"} ${p.title}`,
      description:
        verb === "publish"
          ? "Make this product visible to customers. Check its content and pricing first."
          : verb === "delete"
            ? "Permanently delete this product. This cannot be undone."
            : "Hide this product from the storefront.",
      danger: verb === "delete",
      build: () => ["products", verb, p.id],
      onSuccess: () => {
        if (verb === "delete") setSelected(null);
      },
    });
  }
  return (
    <div className="stack">
      <PageHeader
        title="Products"
        subtitle="Build your offer, set its price, and bring it to market."
        actions={
          <Button variant="classic" onClick={() => edit()}>
            New product
          </Button>
        }
      />
      <div className="business-directory">
        <Directory
          title="Products"
          storageKey="products"
          args={["products", "list", "--first", "100"]}
          renderRows={(rows) => (
            <RecordTable
              rows={rows}
              onSelect={setSelected}
              columns={[
                {
                  label: "Product",
                  render: (r) => (
                    <span>
                      <strong>{r.title}</strong>
                      <small>
                        {r.headline ?? (r.route ? `/${r.route}` : "Your offer")}
                      </small>
                    </span>
                  ),
                },
                { label: "Price", render: (r) => planPrice(r.default_plan) },
                {
                  label: "Members",
                  render: (r) => (r.member_count ?? 0).toLocaleString(),
                },
                {
                  label: "Visibility",
                  render: (r) => <StatusBadge status={r.visibility} />,
                },
              ]}
            />
          )}
          selected={p?.id}
          onSelect={setSelected}
          statuses={["visible", "hidden"]}
          secondary={(r) =>
            `${planPrice(r.default_plan)} · ${r.member_count ?? 0} members`
          }
        />
        {p && (
          <RecordDialog
            title={p.title}
            subtitle="Offer details and pricing"
            open={!action}
            onClose={() => {
              if (!action) setSelected(null);
            }}
          >
            <Detail
              title={p.title}
              subtitle={p.route ? `/${p.route}` : p.id}
              onClose={() => setSelected(null)}
              actions={
                <>
                  <Button
                    size="1"
                    onClick={() => edit(p)}
                    disabled={detail.loading || !!detail.error}
                  >
                    Edit product
                  </Button>
                  <Button size="1" variant="soft" onClick={() => editPlan()}>
                    Add plan
                  </Button>
                  <Button size="1" variant="soft" onClick={() => onStudio?.(p)}>
                    Create artwork
                  </Button>
                  <Button
                    size="1"
                    variant="soft"
                    onClick={() =>
                      change(
                        p.visibility === "visible" ? "unpublish" : "publish",
                      )
                    }
                  >
                    {p.visibility === "visible" ? "Unpublish" : "Publish"}
                  </Button>
                </>
              }
            >
              <Facts
                items={[
                  ["Visibility", p.visibility],
                  ["Members", p.member_count],
                  ["Created", shortDate(p.created_at)],
                  ["Default price", planPrice(p.default_plan)],
                ]}
              />
              {detail.error && <QueryBody q={detail}>{() => null}</QueryBody>}
              <div className="workspace-preview">
                <span className="workspace-eyebrow">
                  CONTENT PREVIEW · NOT A LIVE STOREFRONT
                </span>
                <h3>{p.title}</h3>
                <strong>{p.headline}</strong>
                <p>
                  {p.description ||
                    "Add a description to explain the value of your offer."}
                </p>
                <strong>{planPrice(p.default_plan)}</strong>
              </div>
              <div className="workspace-section">
                <h3>Pricing plans</h3>
                <QueryBody q={plans}>
                  {(d) => (
                    <>
                      {d.data.length ? (
                        <Records
                          rows={d.data}
                          onSelect={editPlan}
                          secondary={(r) => planPrice(r as any)}
                        />
                      ) : (
                        <p className="workspace-muted">
                          Add your first pricing plan.
                        </p>
                      )}
                      {d.page_info?.has_next_page && (
                        <p>Showing the first 100 plans.</p>
                      )}
                    </>
                  )}
                </QueryBody>
              </div>
              <div className="workspace-actions">
                {!account?.demo && p.route && (
                  <Button
                    variant="ghost"
                    size="1"
                    onClick={() =>
                      invoke("open_external", {
                        url: `https://whop.com/${account?.route ? `${account.route}/` : ""}${p.route}`,
                      })
                    }
                  >
                    Open storefront
                  </Button>
                )}
                <Button
                  color="red"
                  variant="ghost"
                  size="1"
                  onClick={() => change("delete")}
                >
                  Delete product
                </Button>
              </div>
            </Detail>
          </RecordDialog>
        )}
      </div>
      {action && (
        <ActionEditor
          key={action.key}
          spec={action}
          onClose={() => setAction(null)}
        />
      )}
    </div>
  );
}
