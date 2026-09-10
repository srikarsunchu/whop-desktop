import { Button, StackedHorizontalBarChart, Table, Text } from "frosted-ui";
import { EmptyPanel, PageHeader, Panel, QueryBody } from "../components/Panel";
import { StatusBadge } from "../components/UserCell";
import { money, relative, shortDate, titleCase } from "../lib/format";
import { useAccount, useWhop, type BalanceReport, type LedgerEntry, type Page, type Payout } from "../lib/whop";

interface Dispute {
  id: string;
  status: string;
  reason?: string;
  amount?: { currency: string; amount: string };
  created_at: string;
  due_by?: string | null;
  user?: { username?: string } | null;
}

const BAR_COLORS = ["green", "amber", "gray", "red"] as const;

export function Money({ runInTerminal }: { runInTerminal: (c: string) => void }) {
  const { account } = useAccount();
  const balance = useWhop<BalanceReport>(["ledgers", "report", "--report_type", "balance_summary"]);
  const income = useWhop<BalanceReport>(["ledgers", "report", "--report_type", "income_statement"]);
  const ledger = useWhop<Page<LedgerEntry>>(["ledgers", "list"]);
  const payouts = useWhop<Page<Payout>>(["payouts", "list", "--first", "10"]);
  const disputes = useWhop<Page<Dispute>>(["disputes", "list", "--first", "10"]);

  const rows = (balance.data?.rows ?? []).map((r, i) => ({
    label: titleCase(r.category ?? r.label ?? `row ${i + 1}`),
    value: Number(r.amount ?? r.balance ?? 0),
  }));
  const total = rows.reduce((a, r) => a + Math.max(0, r.value), 0);

  return (
    <div className="stack">
      <PageHeader
        title="Money"
        subtitle={account ? `${account.title} · balance, activity and payouts` : undefined}
        actions={
          <>
            <Button size="1" variant="surface" onClick={() => runInTerminal("whop payouts methods")}>
              Payout methods
            </Button>
            <Button size="1" variant="classic" onClick={() => runInTerminal("whop payouts create --amount ")}>
              New payout
            </Button>
          </>
        }
      />

      <div className="grid-2">
        <Panel title="Balance" query={balance} onRun={runInTerminal}>
          <QueryBody q={balance} onRun={runInTerminal} empty={(d) => (!d.rows?.length && !d.total ? <EmptyPanel title="Balance is $0.00" description="Your wallet fills as payments settle. Payouts move money from here to your bank." /> : null)}>
            {() => (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <Text size="1" color="gray" style={{ display: "block" }}>
                    Total
                  </Text>
                  <Text size="6" weight="medium" className="num">
                    {money(total)}
                  </Text>
                </div>
                {total > 0 && (
                  <StackedHorizontalBarChart
                    data={rows
                      .filter((r) => r.value > 0)
                      .map((r, i) => ({ label: r.label, value: r.value, color: BAR_COLORS[i % BAR_COLORS.length] }))}
                  />
                )}
                <Table.Root variant="ghost" size="1">
                  <Table.Table>
                    <Table.Body>
                      {rows.map((r) => (
                        <Table.Row key={r.label}>
                          <Table.Cell>
                            <Text size="2">{r.label}</Text>
                          </Table.Cell>
                          <Table.Cell justify="end">
                            <Text size="2" weight="medium" className="num">
                              {money(r.value)}
                            </Text>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Table>
                </Table.Root>
              </div>
            )}
          </QueryBody>
        </Panel>

        <Panel title="Income statement" query={income} onRun={runInTerminal}>
          <QueryBody q={income} onRun={runInTerminal} empty={(d) => (!d.rows?.length ? <EmptyPanel title="No income yet" description="Gross sales, refunds and fees will be itemised here." /> : null)}>
            {(d) => (
              <Table.Root variant="ghost" size="1">
                <Table.Table>
                  <Table.Body>
                    {d.rows.map((r, i) => {
                      const v = Number(r.amount ?? r.balance ?? 0);
                      const last = i === d.rows.length - 1;
                      return (
                        <Table.Row key={i}>
                          <Table.Cell>
                            <Text size="2" weight={last ? "medium" : "regular"}>
                              {titleCase(r.label ?? r.category)}
                            </Text>
                          </Table.Cell>
                          <Table.Cell justify="end">
                            <Text size="2" weight={last ? "medium" : "regular"} className="num" style={{ color: v < 0 ? "var(--gray-11)" : undefined }}>
                              {money(v)}
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
      </div>

      <Panel title="Activity" query={ledger} onRun={runInTerminal}>
        <QueryBody q={ledger} onRun={runInTerminal} empty={(d) => (d.data.length === 0 ? <EmptyPanel title="No ledger activity" description="Every payment, refund, fee and payout posts here with a running balance." /> : null)}>
          {(d) => (
            <div className="table-clip">
              <Table.Root variant="ghost" size="1">
                <Table.Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Description</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell justify="end">Amount</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell justify="end">When</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {d.data.map((e) => {
                      const amt = Number(e.amount?.amount ?? 0);
                      return (
                        <Table.Row key={e.id}>
                          <Table.Cell>
                            <Text size="2">{e.description ?? e.id}</Text>
                          </Table.Cell>
                          <Table.Cell>
                            <StatusBadge status={e.type} />
                          </Table.Cell>
                          <Table.Cell justify="end">
                            <Text size="2" weight="medium" className="num" style={{ color: amt < 0 ? "var(--gray-11)" : "var(--success-11)" }}>
                              {amt > 0 ? "+" : ""}
                              {money(e.amount)}
                            </Text>
                          </Table.Cell>
                          <Table.Cell justify="end">
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
            </div>
          )}
        </QueryBody>
      </Panel>

      <div className="grid-2">
        <Panel title="Payouts" query={payouts} onRun={runInTerminal}>
          <QueryBody q={payouts} onRun={runInTerminal} empty={(d) => (d.data.length === 0 ? <EmptyPanel title="No payouts yet" description="Send available balance to a bank or wallet." action={{ label: "Add a payout method", onClick: () => runInTerminal("whop payouts supported-methods") }} /> : null)}>
            {(d) => (
              <Table.Root variant="ghost" size="1">
                <Table.Table>
                  <Table.Body>
                    {d.data.map((p) => (
                      <Table.Row key={p.id}>
                        <Table.Cell>
                          <Text size="2" style={{ display: "block" }}>
                            {p.destination ?? titleCase(p.method) ?? p.id}
                          </Text>
                          <Text size="1" color="gray">
                            {shortDate(p.created_at)}
                            {p.arrival_date ? ` · arrives ${shortDate(p.arrival_date)}` : ""}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <StatusBadge status={p.status} />
                        </Table.Cell>
                        <Table.Cell justify="end">
                          <Text size="2" weight="medium" className="num">
                            {money(p.amount)}
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Table>
              </Table.Root>
            )}
          </QueryBody>
        </Panel>

        <Panel title="Disputes" query={disputes} onRun={runInTerminal}>
          <QueryBody q={disputes} onRun={runInTerminal} empty={(d) => (d.data.length === 0 ? <EmptyPanel title="No open disputes" description="Chargebacks and issuer alerts appear here with their response deadline." /> : null)}>
            {(d) => (
              <Table.Root variant="ghost" size="1">
                <Table.Table>
                  <Table.Body>
                    {d.data.map((x) => (
                      <Table.Row key={x.id}>
                        <Table.Cell>
                          <Text size="2" style={{ display: "block" }}>
                            {titleCase(x.reason) || x.id}
                          </Text>
                          <Text size="1" color="gray">
                            {x.user?.username ? `@${x.user.username} · ` : ""}
                            {x.due_by ? `respond by ${shortDate(x.due_by)}` : relative(x.created_at)}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <StatusBadge status={x.status} />
                        </Table.Cell>
                        <Table.Cell justify="end">
                          <Text size="2" weight="medium" className="num">
                            {money(x.amount)}
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Table>
              </Table.Root>
            )}
          </QueryBody>
        </Panel>
      </div>
    </div>
  );
}
