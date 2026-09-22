// Support: one customer on one screen, from `wv support lookup <email | user | membership | license | payment>`,
// which joins the person, the member, their memberships, payments, disputes, and resolution-center cases. Every
// write a ticket ends in (refund, extend, cancel, answer a dispute, reply to a case) is a plan through the gate.
import { Badge, Button, Text, TextField } from "frosted-ui";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { useEffect, useState } from "react";
import { EmptyPanel, PageHeader, Panel, QueryBody } from "../components/Panel";
import { ActionEditor, option, useSaved, type ActionSpec, type RecordData } from "../components/Workspace";
import { StatusBadge } from "../components/UserCell";
import { money, relative, shortDate, titleCase } from "../lib/format";
import { useAccount, useWv, wvPath, type WvSupport } from "../lib/whop";

const rows = (v: RecordData[] | { error: string } | undefined): RecordData[] => (Array.isArray(v) ? v : []);
const failed = (v: RecordData[] | { error: string } | undefined): string | undefined => (v && !Array.isArray(v) ? v.error : undefined);
const amount = (r: RecordData) => r.total ?? r.presentment_total ?? r.amount ?? r.amount_after_fees;
const EVIDENCE = ["digital_fulfillment", "physical_fulfillment", "customer_order_history", "prior_transactions", "customer_session", "product_image", "return_policy", "shipping_policy", "subscription"];

export function Support({ runInTerminal }: { runInTerminal: (command: string) => void }) {
  const { account } = useAccount();
  const [hasWv, setHasWv] = useState<boolean | null>(null);
  useEffect(() => {
    wvPath().then((p) => setHasWv(!!p));
  }, []);
  const [key, setKey] = useSaved<string>("support.key", "");
  const [draft, setDraft] = useState(key);
  useEffect(() => setDraft(key), [key]);
  const lookup = useWv<WvSupport>(hasWv && key ? "support" : null, ["lookup", key], { ttl: 60_000 });
  const [action, setAction] = useState<ActionSpec | null>(null);
  const demo = !!account?.demo;

  const refund = (p: RecordData) =>
    setAction({
      key: `support.refund.${p.id}`,
      title: `Refund ${money(amount(p), p.currency ?? "usd")}`,
      description: "wv reads the payment first and shows what was already refunded and what remains. The plan asks for the amount typed back.",
      fields: [{ key: "amount", label: "Amount (blank for everything that remains)", type: "number", min: 0 }],
      build: (v) => ["support", "refund", String(p.id), ...(v.amount ? ["--amount", v.amount] : [])],
    });
  const extend = (m: RecordData) =>
    setAction({
      key: `support.extend.${m.id}`,
      title: "Extend the membership",
      description: "Adds days to the current period. The plan shows the period end before and after.",
      fields: [{ key: "days", label: "Days", type: "number", required: true, min: 1, max: 365 }],
      initial: { days: "7" },
      build: (v) => ["memberships", "extend", String(m.id), "--days", v.days],
    });
  const cancel = (m: RecordData) =>
    setAction({
      key: `support.cancel.${m.id}`,
      title: "Cancel the membership",
      description: "At period end keeps access until the paid period runs out; immediately ends it now. Neither refunds anything.",
      fields: [{ key: "when", label: "When", type: "select", options: [option("period_end", "at period end"), option("now", "immediately")] }],
      initial: { when: "period_end" },
      danger: true,
      build: (v) => ["memberships", "cancel", String(m.id), "--cancel_at_period_end", v.when === "now" ? "false" : "true"],
    });
  const pause = (m: RecordData) =>
    setAction({ key: `support.pause.${m.id}`, title: "Pause the membership", description: "Stops billing and access until it is resumed.", fields: [], build: () => ["memberships", "pause", String(m.id)] });
  const resume = (m: RecordData) =>
    setAction({ key: `support.resume.${m.id}`, title: "Resume the membership", description: "Billing and access start again from the next cycle.", fields: [], build: () => ["memberships", "resume", String(m.id)] });
  const dispute = (d: RecordData) =>
    setAction({
      key: `support.dispute.${d.id}`,
      title: `Answer the dispute (${titleCase(String(d.reason ?? "dispute"))})`,
      description: "Evidence files are uploaded first with `whop files create --filename …`, which returns a file id. The plan shows the amount, the reason, the evidence deadline, and every document, then submits only after you approve.",
      fields: [
        { key: "evidence", label: "Evidence file ids, comma separated (file_x:type)", required: true, hint: `Types: ${EVIDENCE.join(", ")}. Without a type, digital_fulfillment.` },
      ],
      // One comma-joined --evidence, the form the skill documents: wv folds a repeated flag into a JSON array before the recipe reads it.
      build: (v) => ["support", "dispute", String(d.id), "--evidence", v.evidence.split(",").map((e) => e.trim()).filter(Boolean).join(",")],
    });
  const reply = (c: RecordData) =>
    setAction({
      key: `support.reply.${c.id}`,
      title: "Reply to the case",
      description: "The message goes to the buyer in the resolution center; the plan shows it before it is sent.",
      fields: [{ key: "message", label: "Message", type: "textarea", required: true }],
      build: (v) => ["resolution-center-cases", "reply", String(c.id), "--message", v.message],
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setKey(draft.trim());
  };

  return (
    <div className="stack">
      <PageHeader title="Support" subtitle="One customer on one screen: who they are, what they bought, what they paid, and what is open. Every action is a plan you approve." />
      {hasWv === false ? (
        <EmptyPanel title="Support needs wv" description="Install wv (github.com/srikarsunchu/whop-view) and relaunch: it joins the customer's records and gates every action." />
      ) : (
        <>
          <form className="support-search" onSubmit={submit}>
            <TextField.Root size="2" variant="surface">
              <TextField.Slot>
                <MagnifyingGlassIcon />
              </TextField.Slot>
              <TextField.Input placeholder={demo ? "Try jordanbets@gmail.com, or a user_, mem_, or pay_ id" : "Email, license key, or a user_, mem_, mber_, or pay_ id"} value={draft} onChange={(e) => setDraft(e.target.value)} autoComplete="off" spellCheck={false} aria-label="Customer key" />
            </TextField.Root>
            <Button type="submit" variant="classic" disabled={!draft.trim()}>
              Look up
            </Button>
          </form>
          {!key ? (
            <EmptyPanel title="Who is this customer?" description="Paste what the ticket gives you. wv resolves it to the buyer and reads their memberships, payments, disputes, and cases in one pass." />
          ) : (
            <Panel title={`Lookup · ${key}`} query={lookup} onRun={runInTerminal}>
              <QueryBody q={lookup} onRun={runInTerminal}>
                {(d) =>
                  !d.user ? (
                    <EmptyPanel title="No customer matched" description={`Nothing on ${account?.title ?? "this business"} resolves “${d.key}” as ${d.kind === "email" ? "an email" : `a ${d.kind}`}. Check the spelling, or try the payment or membership id from the ticket.`} />
                  ) : (
                    <div className="stack">
                      <dl className="support-facts">
                        <dt>Who</dt>
                        <dd>
                          <strong>{d.user.name ?? d.user.username ?? d.user.id}</strong>
                          {d.user.username ? ` @${d.user.username}` : ""} · <code>{d.user.id}</code>
                        </dd>
                        {d.user.email && (
                          <>
                            <dt>Email</dt>
                            <dd>{d.user.email}</dd>
                          </>
                        )}
                        {d.person && (
                          <>
                            <dt>Lifetime</dt>
                            <dd>
                              {money(d.person.ltv ?? 0)} over {d.person.purchase_count ?? 0} {d.person.purchase_count === 1 ? "purchase" : "purchases"}
                              {d.person.first_seen_at ? ` · first seen ${shortDate(d.person.first_seen_at)}` : ""}
                              {d.person.last_seen_at ? ` · last seen ${relative(d.person.last_seen_at)}` : ""}
                            </dd>
                          </>
                        )}
                        {d.member && (
                          <>
                            <dt>Member</dt>
                            <dd>
                              <StatusBadge status={d.member.status} />
                              {d.member.joined_at ? ` joined ${shortDate(d.member.joined_at)}` : ""}
                              {d.member.last_accessed_at ? ` · last access ${relative(d.member.last_accessed_at)}` : ""}
                            </dd>
                          </>
                        )}
                      </dl>
                      <div className="support-grid">
                        <Section title="Memberships" error={failed(d.memberships)} items={rows(d.memberships)} empty="No memberships.">
                          {(m) => (
                            <tr key={m.id}>
                              <td>
                                <strong>{m.product?.title ?? m.product_id ?? "—"}</strong>
                                <br />
                                <Text size="1" color="gray">
                                  {m.plan?.title ?? m.plan_id ?? ""} · <code>{m.id}</code>
                                </Text>
                              </td>
                              <td>
                                <StatusBadge status={m.status} />
                                {m.current_period_end || m.renewal_period_end ? (
                                  <>
                                    <br />
                                    <Text size="1" color="gray">
                                      {m.cancel_at_period_end ? "ends" : "renews"} {shortDate(m.current_period_end ?? m.renewal_period_end)}
                                    </Text>
                                  </>
                                ) : null}
                              </td>
                              <td>
                                {["active", "trialing", "past_due"].includes(String(m.status)) && (
                                  <>
                                    <Button size="1" variant="soft" onClick={() => extend(m)}>Extend</Button>{" "}
                                    <Button size="1" variant="soft" onClick={() => pause(m)}>Pause</Button>{" "}
                                    <Button size="1" variant="soft" color="red" onClick={() => cancel(m)}>Cancel</Button>
                                  </>
                                )}
                                {m.status === "paused" && (
                                  <Button size="1" variant="soft" onClick={() => resume(m)}>Resume</Button>
                                )}
                              </td>
                            </tr>
                          )}
                        </Section>
                        <Section title="Payments" error={failed(d.payments)} items={rows(d.payments)} empty="No payments.">
                          {(p) => {
                            const refunded = Number(p.refunded_amount?.amount ?? p.refunded_amount ?? 0);
                            return (
                              <tr key={p.id}>
                                <td>
                                  <strong>{money(amount(p), p.currency ?? "usd")}</strong>
                                  {refunded > 0 && <Text size="1" color="gray"> · {money(refunded, p.currency ?? "usd")} refunded</Text>}
                                  <br />
                                  <Text size="1" color="gray">
                                    {p.created_at ? shortDate(p.created_at) : ""} · {titleCase(String(p.billing_reason ?? ""))} · <code>{p.id}</code>
                                  </Text>
                                </td>
                                <td>
                                  <StatusBadge status={p.status} />
                                </td>
                                <td>
                                  {p.status === "paid" && p.refundable !== false && (
                                    <Button size="1" variant="soft" color="amber" onClick={() => refund(p)}>Refund</Button>
                                  )}
                                </td>
                              </tr>
                            );
                          }}
                        </Section>
                        <Section title="Disputes" error={failed(d.disputes)} items={rows(d.disputes)} empty="No disputes on this customer's payments.">
                          {(x) => {
                            const due = x.evidence_due_at ?? x.due_by;
                            return (
                              <tr key={x.id}>
                                <td>
                                  <strong>{money(x.amount, x.currency ?? "usd")}</strong> · {titleCase(String(x.reason ?? "dispute"))}
                                  {x.inquiry ? <Badge size="1" color="gray" variant="soft" style={{ marginLeft: 6 }}>inquiry</Badge> : null}
                                  <br />
                                  <Text size="1" color={due && +new Date(due) - Date.now() < 86_400_000 ? "red" : "gray"}>
                                    {due ? `evidence due ${relative(due)}` : ""} · <code>{x.id}</code>
                                  </Text>
                                </td>
                                <td>
                                  <StatusBadge status={x.status} />
                                </td>
                                <td>{x.status === "needs_response" && <Button size="1" variant="soft" color="amber" onClick={() => dispute(x)}>Answer</Button>}</td>
                              </tr>
                            );
                          }}
                        </Section>
                        <Section title="Cases" error={failed(d.cases)} items={rows(d.cases)} empty="No resolution-center cases.">
                          {(c) => (
                            <tr key={c.id}>
                              <td>
                                <strong>{c.subject ?? titleCase(String(c.reason ?? "case"))}</strong>
                                <br />
                                <Text size="1" color="gray">
                                  {c.created_at ? `opened ${relative(c.created_at)}` : ""} · <code>{c.id}</code>
                                </Text>
                              </td>
                              <td>
                                <StatusBadge status={c.status} />
                              </td>
                              <td>{c.status === "awaiting_merchant" && <Button size="1" variant="soft" color="amber" onClick={() => reply(c)}>Reply</Button>}</td>
                            </tr>
                          )}
                        </Section>
                      </div>
                    </div>
                  )
                }
              </QueryBody>
            </Panel>
          )}
        </>
      )}
      {action && <ActionEditor key={action.key} spec={action} onClose={() => setAction(null)} />}
    </div>
  );
}

function Section({ title, error, items, empty, children }: { title: string; error?: string; items: RecordData[]; empty: string; children: (r: RecordData) => React.ReactNode }) {
  return (
    <Panel title={title} size="2">
      {error ? (
        <Text size="1" color="amber">{error}</Text>
      ) : items.length === 0 ? (
        <Text size="1" color="gray">{empty}</Text>
      ) : (
        <table className="support-table">
          <tbody>{items.map(children)}</tbody>
        </table>
      )}
    </Panel>
  );
}
