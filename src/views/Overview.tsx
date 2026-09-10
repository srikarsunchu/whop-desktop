import { Button, Table, Text } from "frosted-ui";
import { ArrowRightIcon, LightningBoltIcon } from "@radix-ui/react-icons";
import { useMemo } from "react";
import { PageHeader, Panel, QueryBody, EmptyPanel } from "../components/Panel";
import { StatTile } from "../components/StatTile";
import { RevenueChart } from "../components/RevenueChart";
import { StatusBadge } from "../components/UserCell";
import type { ViewId } from "../components/Sidebar";
import { daysAgo, isoDay, money, pctDelta, relative } from "../lib/format";
import { useAccount, useWhop, type BalanceReport, type LedgerEntry, type Membership, type Member, type Page, type RecommendedAction, type StatsSeries } from "../lib/whop";

export function Overview({ runInTerminal, onNavigate }: { runInTerminal: (c: string) => void; onNavigate: (v: ViewId) => void }) {
  const { account } = useAccount();
  const to = isoDay(daysAgo(0));
  const from = isoDay(daysAgo(29));
  const prevTo = isoDay(daysAgo(30));
  const prevFrom = isoDay(daysAgo(59));

  const revenue = useWhop<StatsSeries>(["stats", "get", "net_revenue", "--from", from, "--to", to, "--interval", "day"]);
  const prevRevenue = useWhop<StatsSeries>(["stats", "get", "net_revenue", "--from", prevFrom, "--to", prevTo, "--interval", "day"]);
  const active = useWhop<Page<Membership>>(["memberships", "list", "--status", "active", "--first", "100"]);
  const members = useWhop<Page<Member>>(["members", "list", "--first", "100"]);
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

  const count = (p?: Page<unknown>) => (p ? p.data.length : undefined);
  const plus = (p?: Page<unknown>) => (p?.page_info?.has_next_page ? "100+ shown" : undefined);

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
        subtitle={account ? `${account.title} · last 30 days` : "Choose a business"}
        actions={
          <Button size="1" variant="surface" onClick={() => runInTerminal("whop stats list")}>
            Metric catalog
          </Button>
        }
      />

      <div className="grid-4">
        <StatTile label="Net revenue" value={rev30} format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }} delta={revenue.error ? null : delta} loading={revenue.loading} note={revenue.error ? revenue.error.code : undefined} spark={spark(revenue.data)} sparkLabel="net revenue, daily" />
        <StatTile label="Active memberships" value={active.error ? null : count(active.data)} loading={active.loading} note={active.error ? active.error.code : plus(active.data) ?? "paid and active"} spark={spark(paidActive.data)} sparkLabel="paid active members, daily" />
        <StatTile label="Members" value={members.error ? null : count(members.data)} loading={members.loading} note={members.error ? members.error.code : plus(members.data) ?? "new users trend"} spark={spark(newUsers.data)} sparkLabel="new users, daily" />
        <StatTile label="Available balance" value={balance.error ? null : available} format={{ style: "currency", currency: "USD" }} loading={balance.loading} note={balance.error ? balance.error.code : "ready to pay out"} spark={spark(balanceSeries.data)} sparkLabel="balance, daily" />
      </div>

      <Panel title="Net revenue" query={revenue} onRun={runInTerminal}>
        <QueryBody
          q={revenue}
          onRun={runInTerminal}
          empty={(d) =>
            !d?.data?.points?.length || d.data.points.every((p) => !p.value) ? (
              <EmptyPanel title="No revenue in the last 30 days" description="Sales land here the moment a checkout completes." action={{ label: "See products", onClick: () => onNavigate("products") }} />
            ) : null
          }
        >
          {(d) => <RevenueChart points={d.data.points} currency={d.data.currency} />}
        </QueryBody>
      </Panel>

      <div className="grid-2">
        <Panel title="Recent activity" query={activity} onRun={runInTerminal} actions={<Button size="1" variant="ghost" color="gray" onClick={() => onNavigate("money")}>Money <ArrowRightIcon /></Button>}>
          <QueryBody q={activity} onRun={runInTerminal} empty={(d) => (d.data.length === 0 ? <EmptyPanel title="Nothing on the ledger yet" description="Payments, refunds, fees and payouts show up here as they post." /> : null)}>
            {(d) => (
              <Table.Root variant="ghost" size="1">
                <Table.Table>
                  <Table.Body>
                    {d.data.map((e) => {
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

        <Panel title="Recommended actions" query={actions} onRun={runInTerminal}>
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
      <div style={{ display: "none" }}>
        <StatusBadge status="active" />
      </div>
    </div>
  );
}
