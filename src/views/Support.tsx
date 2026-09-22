// Support: one customer on one screen, from `wv support lookup <email | user | membership | license | payment>`,
// which joins the person, the member, their memberships, payments, disputes, and resolution-center cases. Every
// write a ticket ends in (refund, extend, cancel, answer a dispute, reply to a case) is a plan through the gate.
import { Badge, Button, Text, TextField } from "frosted-ui";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { useEffect, useState } from "react";
import { EmptyPanel, PageHeader, Panel, QueryBody } from "../components/Panel";
import { ActionEditor, option, useSaved, type ActionSpec, type RecordData } from "../components/Workspace";
import { StatusBadge } from "../components/UserCell";
import { money, relative, shortDate } from "../lib/format";
import { useAccount, useWhop, useWv, wvPath, type Page, type WvSupport } from "../lib/whop";
import { supportRows, titlesOf, type CaseRow, type DisputeRow, type MembershipRow, type PaymentRow } from "../lib/support";

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
  // The API's membership record carries product_id and plan_id only; two list reads name them.
  const found = !!lookup.data?.user;
  const products = useWhop<Page<RecordData>>(found ? ["products", "list"] : null, { ttl: 5 * 60_000 });
  const plans = useWhop<Page<RecordData>>(found ? ["plans", "list"] : null, { ttl: 5 * 60_000 });
  const titles = { products: titlesOf(products.data?.data), plans: titlesOf(plans.data?.data) };
  const [action, setAction] = useState<ActionSpec | null>(null);
  const demo = !!account?.demo;

  const refund = (p: PaymentRow) =>
    setAction({
      key: `support.refund.${p.id}`,
      title: `Refund ${money(p.amount, p.currency)}`,
      description: "wv reads the payment first and shows what was already refunded and what remains. The plan asks for the amount typed back.",
      fields: [{ key: "amount", label: "Amount (blank for everything that remains)", type: "number", min: 0 }],
      build: (v) => ["support", "refund", String(p.id), ...(v.amount ? ["--amount", v.amount] : [])],
    });
  const extend = (m: MembershipRow) =>
    setAction({
      key: `support.extend.${m.id}`,
      title: "Extend the membership",
      description: "Adds days to the current period. The plan shows the period end before and after.",
      fields: [{ key: "days", label: "Days", type: "number", required: true, min: 1, max: 365 }],
      initial: { days: "7" },
      build: (v) => ["memberships", "extend", String(m.id), "--days", v.days],
    });
  const cancel = (m: MembershipRow) =>
    setAction({
      key: `support.cancel.${m.id}`,
      title: "Cancel the membership",
      description: "At period end keeps access until the paid period runs out; immediately ends it now. Neither refunds anything.",
      fields: [{ key: "when", label: "When", type: "select", options: [option("period_end", "at period end"), option("now", "immediately")] }],
      initial: { when: "period_end" },
      danger: true,
      build: (v) => ["memberships", "cancel", String(m.id), "--cancel_at_period_end", v.when === "now" ? "false" : "true"],
    });
  const pause = (m: MembershipRow) =>
    setAction({ key: `support.pause.${m.id}`, title: "Pause the membership", description: "Stops billing and access until it is resumed.", fields: [], build: () => ["memberships", "pause", String(m.id)] });
  const resume = (m: MembershipRow) =>
    setAction({ key: `support.resume.${m.id}`, title: "Resume the membership", description: "Billing and access start again from the next cycle.", fields: [], build: () => ["memberships", "resume", String(m.id)] });
  const dispute = (d: DisputeRow) =>
    setAction({
      key: `support.dispute.${d.id}`,
      title: `Answer the dispute (${d.reason})`,
      description: "Evidence files are uploaded first with `whop files create --filename …`, which returns a file id. The plan shows the amount, the reason, the evidence deadline, and every document, then submits only after you approve.",
      fields: [
        { key: "evidence", label: "Evidence file ids, comma separated (file_x:type)", required: true, hint: `Types: ${EVIDENCE.join(", ")}. Without a type, digital_fulfillment.` },
      ],
      // One comma-joined --evidence, the form the skill documents: wv folds a repeated flag into a JSON array before the recipe reads it.
      build: (v) => ["support", "dispute", String(d.id), "--evidence", v.evidence.split(",").map((e) => e.trim()).filter(Boolean).join(",")],
    });
  const reply = (c: CaseRow) =>
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
                        {(() => {
                          const r = supportRows(d, titles);
                          return (
                            <>
                              <Section title="Memberships" error={r.errors.memberships} items={r.memberships} empty="No memberships.">
                                {(m) => (
                                  <tr key={m.id}>
                                    <td>
                                      <strong>{m.product}</strong>
                                      <br />
                                      <Text size="1" color="gray">
                                        {m.plan}{m.plan ? " · " : ""}<code>{m.id}</code>
                                      </Text>
                                    </td>
                                    <td>
                                      <StatusBadge status={m.status} />
                                      {m.periodEnd && (
                                        <>
                                          <br />
                                          <Text size="1" color="gray">
                                            {m.ends ? "ends" : "renews"} {shortDate(m.periodEnd)}
                                          </Text>
                                        </>
                                      )}
                                    </td>
                                    <td>
                                      {m.actions.includes("extend") && <><Button size="1" variant="soft" onClick={() => extend(m)}>Extend</Button>{" "}</>}
                                      {m.actions.includes("pause") && <><Button size="1" variant="soft" onClick={() => pause(m)}>Pause</Button>{" "}</>}
                                      {m.actions.includes("cancel") && <Button size="1" variant="soft" color="red" onClick={() => cancel(m)}>Cancel</Button>}
                                      {m.actions.includes("resume") && <Button size="1" variant="soft" onClick={() => resume(m)}>Resume</Button>}
                                    </td>
                                  </tr>
                                )}
                              </Section>
                              <Section title="Payments" error={r.errors.payments} items={r.payments} empty="No payments.">
                                {(p) => (
                                  <tr key={p.id}>
                                    <td>
                                      <strong>{money(p.amount, p.currency)}</strong>
                                      {p.refunded > 0 && <Text size="1" color="gray"> · {money(p.refunded, p.currency)} refunded</Text>}
                                      <br />
                                      <Text size="1" color="gray">
                                        {p.createdAt ? shortDate(p.createdAt) : ""} · {p.reason} · <code>{p.id}</code>
                                      </Text>
                                    </td>
                                    <td>
                                      <StatusBadge status={p.status} />
                                    </td>
                                    <td>{p.refundable && <Button size="1" variant="soft" color="amber" onClick={() => refund(p)}>Refund</Button>}</td>
                                  </tr>
                                )}
                              </Section>
                              <Section title="Disputes" error={r.errors.disputes} items={r.disputes} empty="No disputes on this customer's payments.">
                                {(x) => (
                                  <tr key={x.id}>
                                    <td>
                                      <strong>{money(x.amount, x.currency)}</strong> · {x.reason}
                                      {x.inquiry ? <Badge size="1" color="gray" variant="soft" style={{ marginLeft: 6 }}>inquiry</Badge> : null}
                                      <br />
                                      <Text size="1" color={x.urgent ? "red" : "gray"}>
                                        {x.due ? `evidence due ${relative(x.due)}` : ""} · <code>{x.id}</code>
                                      </Text>
                                    </td>
                                    <td>
                                      <StatusBadge status={x.status} />
                                    </td>
                                    <td>{x.answerable && <Button size="1" variant="soft" color="amber" onClick={() => dispute(x)}>Answer</Button>}</td>
                                  </tr>
                                )}
                              </Section>
                              <Section title="Cases" error={r.errors.cases} items={r.cases} empty="No resolution-center cases.">
                                {(c) => (
                                  <tr key={c.id}>
                                    <td>
                                      <strong>{c.subject}</strong>
                                      <br />
                                      <Text size="1" color="gray">
                                        {c.createdAt ? `opened ${relative(c.createdAt)}` : ""} · <code>{c.id}</code>
                                      </Text>
                                    </td>
                                    <td>
                                      <StatusBadge status={c.status} />
                                    </td>
                                    <td>{c.replyable && <Button size="1" variant="soft" color="amber" onClick={() => reply(c)}>Reply</Button>}</td>
                                  </tr>
                                )}
                              </Section>
                            </>
                          );
                        })()}
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

function Section<T extends { id: string }>({ title, error, items, empty, children }: { title: string; error?: string; items: T[]; empty: string; children: (r: T) => React.ReactNode }) {
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
