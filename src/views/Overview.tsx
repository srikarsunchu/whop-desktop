import { Badge, Button, Table, Text } from "frosted-ui";
import { ArrowRightIcon, ChatBubbleIcon, LightningBoltIcon } from "@radix-ui/react-icons";
import { useMemo, useState } from "react";
import { PageHeader, Panel, QueryBody, EmptyPanel } from "../components/Panel";
import { StatTile } from "../components/StatTile";
import { RevenueChart } from "../components/RevenueChart";
import type { ViewId } from "../components/Sidebar";
import { daysAgo, isoDay, money, pctDelta, relative } from "../lib/format";
import { useAccount, useWhop, type BalanceReport, type LedgerEntry, type Page, type RecommendedAction, type StatsSeries } from "../lib/whop";

export function Overview({ runInTerminal, onNavigate, ask }: { runInTerminal: (c: string) => void; onNavigate: (v: ViewId) => void; ask: (prompt: string) => void }) {
  const { account } = useAccount();
  const [period, setPeriod] = useState(30);
  const to = isoDay(daysAgo(0));
  const from = isoDay(daysAgo(period - 1));
  const prevTo = isoDay(daysAgo(period));
  const prevFrom = isoDay(daysAgo(period * 2 - 1));

  const revenue = useWhop<StatsSeries>(["stats", "get", "net_revenue", "--from", from, "--to", to, "--interval", "day"]);
  const prevRevenue = useWhop<StatsSeries>(["stats", "get", "net_revenue", "--from", prevFrom, "--to", prevTo, "--interval", "day"]);
  const balance = useWhop<BalanceReport>(["ledgers", "report", "--report_type", "balance_summary"]);
  const activity = useWhop<Page<LedgerEntry>>(["ledgers", "list"]);
  const actions = useWhop<Page<RecommendedAction>>(["recommended-actions", "list"]);
  const paidActive = useWhop<StatsSeries>(["stats", "get", "paid_active_members", "--from", from, "--to", to, "--interval", "day"]);
  const newUsers = useWhop<StatsSeries>(["stats", "get", "new_users", "--from", from, "--to", to, "--interval", "day"]);
  const balanceSeries = useWhop<StatsSeries>(["stats", "get", "account_balance", "--from", from, "--to", to, "--interval", "day"]);
  const spark = (s?: StatsSeries) => {
    const pts = s?.data?.points?.map((p) => p.value ?? 0) ?? [];
    return pts.some((v) => v) ? pts : undefined;
  };

  const sum = (s?: StatsSeries) => s?.data?.points?.reduce((a, p) => a + (p.value || 0), 0);
  const rev30 = sum(revenue.data);
  const revPrev = sum(prevRevenue.data);
  const delta = rev30 != null && revPrev != null ? pctDelta(rev30, revPrev) : null;


  const available = useMemo(() => {
    const rows = balance.data?.rows ?? [];
    const row = rows.find((r) => (r.category ?? r.label ?? "").toLowerCase().includes("available"));
    if (row) return Number(row.amount ?? row.balance ?? 0);
    if (balance.data) return Number(balance.data.total ?? 0);
    return undefined;
  }, [balance.data]);

  return (
    <div className="stack">
      <PageHeader
        title="Overview"
        subtitle={account ? `${account.title} · your business at a glance` : "Choose a business"}
        actions={
          <div className="period-control" role="group" aria-label="Revenue period">
            {[7, 30, 90].map((days) => <button type="button" key={days} aria-pressed={period === days} onClick={() => setPeriod(days)}>{days} days</button>)}
          </div>
        }
      />
      <div className="overview-metrics">
        <StatTile label="Active paid memberships" value={paidActive.error ? null : paidActive.data?.data.points.at(-1)?.value} loading={paidActive.loading} note="At end of period" spark={spark(paidActive.data)} sparkLabel="Paid active memberships, daily" />
        <StatTile label="New users" value={newUsers.error ? null : sum(newUsers.data)} loading={newUsers.loading} note={`In the last ${period} days`} spark={spark(newUsers.data)} sparkLabel="New users, daily" />
        <StatTile label="Available balance" value={balance.error ? null : available} format={{ style: "currency", currency: "USD" }} loading={balance.loading} note="Ready to pay out" spark={spark(balanceSeries.data)} sparkLabel="Balance, daily" />
      </div>
      <div className="overview-main">
      <Panel title="Net revenue" query={revenue} onRun={runInTerminal}>
        <div className="revenue-summary">
          <span className="revenue-value">{rev30 == null ? "—" : money(rev30, revenue.data?.data.currency)}</span>
          <div className="revenue-comparison">
            {delta != null && <Badge size="1" variant="soft" color={delta >= 0 ? "green" : "red"}>{delta > 0 ? "+" : ""}{delta.toFixed(1)}%</Badge>}
            <Text size="1" color="gray">vs. previous {period} days</Text>
          </div>
        </div>
        <QueryBody
          q={revenue}
          onRun={runInTerminal}
          empty={(d) =>
            !d?.data?.points?.length || d.data.points.every((p) => !p.value) ? (
              <EmptyPanel title={`No revenue in the last ${period} days`} description="Sales land here the moment a checkout completes." action={{ label: "See products", onClick: () => onNavigate("products") }} />
            ) : null
          }
        >
          {(d) => <RevenueChart key={period} points={d.data.points} currency={d.data.currency} height={230} label={`Net revenue, last ${period} days`} />}
        </QueryBody>
      </Panel>
      <aside className="overview-assistant">
        <span className="assistant-mark"><ChatBubbleIcon /></span>
        <Text size="4" weight="medium">Ask your business.</Text>
        <Text size="2" color="gray">Explore revenue, retention, and growth with Claude. Every answer shows its work.</Text>
        <div className="overview-prompts">
          {[
            ["Revenue", "What changed this week?", "How did revenue do this week versus last?"],
            ["Retention", "Who’s at risk?", "Who is past due right now, and how much monthly revenue is at risk?"],
            ["Growth", "Which campaign is working?", "How are my ad campaigns doing, and which one should I scale?"],
          ].map(([label, title, prompt]) => <button type="button" key={label} onClick={() => ask(prompt)}><span><small>{label}</small>{title}</span><ArrowRightIcon /></button>)}
        </div>
        <span className="assistant-footnote">You review. Claude helps you act.</span>
      </aside>
      </div>
      <div className="grid-2">
        <Panel title="Recent activity" query={activity} onRun={runInTerminal} actions={<Button size="1" variant="ghost" color="gray" onClick={() => onNavigate("money")}>View all <ArrowRightIcon /></Button>}>
          <QueryBody q={activity} onRun={runInTerminal} empty={(d) => (d.data.length === 0 ? <EmptyPanel title="Nothing on the ledger yet" description="Payments, refunds, fees and payouts show up here as they post." /> : null)}>
            {(d) => (
              <Table.Root variant="ghost" size="1">
                <Table.Table>
                  <Table.Body>
                    {d.data.slice(0, 6).map((e) => {
                      const amt = Number(e.amount?.amount ?? 0);
                      return (
                        <Table.Row key={e.id}>
                          <Table.Cell>
                            <Text size="2">{e.description ?? e.type ?? e.id}</Text>
                          </Table.Cell>
                          <Table.Cell justify="end">
                            <Text size="2" weight="medium" className="num" style={{ color: amt < 0 ? "var(--gray-11)" : "var(--success-11)" }}>
                              {amt > 0 ? "+" : ""}
                              {money(e.amount)}
                            </Text>
                          </Table.Cell>
                          <Table.Cell justify="end" width={96} style={{ whiteSpace: "nowrap" }}>
                            <Text size="1" color="gray">
                              {relative(e.created_at)}
                            </Text>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Table>
              </Table.Root>
            )}
          </QueryBody>
        </Panel>

        <Panel title="Next steps" query={actions} onRun={runInTerminal}>
          <QueryBody q={actions} onRun={runInTerminal} empty={(d) => (d.data.length === 0 ? <EmptyPanel title="Nothing to do right now" description="Whop suggests next steps here once there is activity to act on." /> : null)}>
            {(d) => (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {d.data.slice(0, 5).map((a) => (
                  <div key={a.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: "1px solid var(--color-stroke)" }}>
                    <LightningBoltIcon style={{ color: "var(--gray-9)", marginTop: 3, flex: "none" }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Text size="2" weight="medium" style={{ display: "block" }}>
                        {a.title}
                      </Text>
                      {a.description && (
                        <Text size="1" color="gray" style={{ display: "block" }}>
                          {a.description}
                        </Text>
                      )}
                    </div>
                    <Button size="1" variant="ghost" color="gray" onClick={() => runInTerminal(`whop recommended-actions get ${a.id}`)}>
                      View
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </QueryBody>
        </Panel>
      </div>
    </div>
  );
}
