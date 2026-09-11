import {
  Button,
  Dialog,
  StackedHorizontalBarChart,
  Table,
  Text,
} from "frosted-ui";
import { useEffect, useState } from "react";
import { EmptyPanel, PageHeader, Panel, QueryBody } from "../components/Panel";
import {
  ActionEditor,
  Detail,
  Directory,
  Facts,
  ReadDetails,
  type ActionSpec,
  type RecordData,
} from "../components/Workspace";
import { useWhop, type BalanceReport, type Page } from "../lib/whop";
import { money, shortDate, relative, titleCase } from "../lib/format";
import { StatusBadge } from "../components/UserCell";
import { payoutCommand } from "../lib/business-actions";
export function Money({
  runInTerminal,
}: {
  runInTerminal: (c: string) => void;
}) {
  const balance = useWhop<BalanceReport>([
    "ledgers",
    "report",
    "--report_type",
    "balance_summary",
  ]);
  const methods = useWhop<Page<RecordData>>([
    "payouts",
    "methods",
    "--first",
    "100",
  ]);
  const [tab, setTab] = useState("ledgers");
  const income = useWhop<BalanceReport>([
    "ledgers",
    "report",
    "--report_type",
    "income_statement",
  ]);
  const [currency, setCurrency] = useState("usd");
  const currencies = [
    ...new Set((balance.data?.rows ?? []).map((r) => r.currency ?? "usd")),
  ];
  const activeCurrency = currencies.includes(currency)
    ? currency
    : (currencies[0] ?? "usd");
  const rows = (balance.data?.rows ?? [])
    .filter((r) => (r.currency ?? "usd") === activeCurrency)
    .map((r, i) => ({
      label: titleCase(r.category ?? r.label ?? `row ${i + 1}`),
      value: Number(r.amount ?? r.balance ?? 0),
    }));
  const total = rows.reduce((n, r) => n + r.value, 0);
  const BAR_COLORS = ["green", "amber", "gray", "red"] as const;
  const [selected, setSelected] = useState<RecordData | null>(null);
  const [action, setAction] = useState<ActionSpec | null>(null);
  const [showMethods, setShowMethods] = useState(false);
  const available = (balance.data?.rows ?? []).filter(
    (r) => r.category === "available",
  );
  const withdraw = () =>
    setAction({
      key: "payout.new",
      title: "Withdraw funds",
      description:
        "Transfer available funds to a saved destination at standard speed. Whop validates eligibility and fees. A failed bank-name check stops this request.",
      fields: [
        {
          key: "payout_method_id",
          label: "Destination",
          required: true,
          options: (methods.data?.data ?? [])
            .filter((m) => m.status !== "broken")
            .map((m) => ({
              value: m.id,
              label: m.name ?? m.destination ?? m.bank_name ?? m.id,
            })),
          hint: methods.error
            ? "Could not load destinations. Refresh and retry."
            : "Saved destinations only. Add a new destination on Whop.",
        },
        {
          key: "currency",
          label: "Balance currency",
          required: true,
          options: available.map((r) => ({
            value: r.currency ?? "usd",
            label: `${(r.currency ?? "usd").toUpperCase()} · ${r.amount ?? r.balance} available`,
          })),
        },
        {
          key: "amount",
          label: "Amount",
          type: "number",
          min: 0.01,
          required: true,
        },
        { key: "notes", label: "Note" },
      ],
      build: (v, k) => {
        const row = available.find((r) => r.currency === v.currency);
        if (!row || Number(v.amount) > Number(row.amount ?? row.balance))
          throw Error(
            "The amount exceeds the available balance in this currency.",
          );
        if (
          !methods.data?.data.some(
            (m) => m.id === v.payout_method_id && m.status !== "broken",
          )
        )
          throw Error("Choose an available saved destination.");
        return payoutCommand(v, k);
      },
      review: (v, reviewing) =>
        reviewing && v.amount && v.currency && Number(v.amount) > 0 ? (
          <ReadDetails
            args={[
              "payouts",
              "methods",
              "--amount",
              v.amount,
              "--currency",
              v.currency,
            ]}
            title="Estimated fee and delivery"
            select={(d) =>
              (d.data ?? []).find(
                (m: RecordData) => m.id === v.payout_method_id,
              )?.quote ?? {
                message:
                  "No quote returned for this destination. Whop validates fees when submitting.",
              }
            }
          />
        ) : null,
    });
  const [focusDisputes] = useState(
    () => sessionStorage.getItem("whopdesktop.moneyFocus") === "disputes",
  );
  const focusActivity = useWhop(
    focusDisputes ? ["ledgers", "list", "--limit", "100"] : null,
  );
  const focusPayouts = useWhop(
    focusDisputes ? ["payouts", "list", "--first", "100"] : null,
  );
  useEffect(() => {
    if (
      !focusDisputes ||
      balance.loading ||
      focusActivity.loading ||
      focusPayouts.loading
    )
      return;
    const frame = requestAnimationFrame(() => {
      document
        .getElementById("directory-money.disputes")
        ?.scrollIntoView({ block: "start" });
      sessionStorage.removeItem("whopdesktop.moneyFocus");
    });
    return () => cancelAnimationFrame(frame);
  }, [
    focusDisputes,
    balance.loading,
    focusActivity.loading,
    focusPayouts.loading,
  ]);
  return (
    <div className="stack">
      <PageHeader
        title="Money"
        subtitle="Follow your funds from payment to payout."
        actions={
          <>
            <Button
              size="1"
              variant="surface"
              onClick={() => setShowMethods(true)}
            >
              Payout methods
            </Button>
            <Button
              size="1"
              variant="classic"
              onClick={withdraw}
              disabled={balance.loading || methods.loading}
            >
              Withdraw
            </Button>
          </>
        }
      />
      <div className="grid-2">
        <Panel
          title="Balance"
          actions={
            currencies.length > 1 ? (
              <select
                aria-label="Balance currency"
                value={activeCurrency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c.toUpperCase()}
                  </option>
                ))}
              </select>
            ) : undefined
          }
          query={balance}
          onRun={runInTerminal}
        >
          <QueryBody
            q={balance}
            onRun={runInTerminal}
            empty={(d) =>
              !d.rows?.length && !d.total ? (
                <EmptyPanel
                  title="Balance is $0.00"
                  description="Your wallet fills as payments settle. Payouts move money from here to your bank."
                />
              ) : null
            }
          >
            {() => (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div>
                  <Text size="1" color="gray" style={{ display: "block" }}>
                    Total
                  </Text>
                  <Text size="6" weight="medium" className="num">
                    {money(total, activeCurrency)}
                  </Text>
                </div>
                {total > 0 && (
                  <StackedHorizontalBarChart
                    data={rows
                      .filter((r) => r.value > 0)
                      .map((r, i) => ({
                        label: r.label,
                        value: r.value,
                        color: BAR_COLORS[i % BAR_COLORS.length],
                      }))}
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
                              {money(r.value, activeCurrency)}
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
          <QueryBody
            q={income}
            onRun={runInTerminal}
            empty={(d) =>
              !d.rows?.length ? (
                <EmptyPanel
                  title="No income yet"
                  description="Gross sales, refunds and fees will be itemised here."
                />
              ) : null
            }
          >
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
                            <Text
                              size="2"
                              weight={last ? "medium" : "regular"}
                              className="num"
                              style={{
                                color: v < 0 ? "var(--gray-11)" : undefined,
                              }}
                            >
                              {money(v, r.currency)}
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

      <MoneyRecords
        group="ledgers"
        title="Activity"
        onSelect={(r) => {
          setTab("ledgers");
          setSelected(r);
        }}
      />
      <div className="grid-2">
        <MoneyRecords
          group="payouts"
          title="Payouts"
          onSelect={(r) => {
            setTab("payouts");
            setSelected(r);
          }}
        />
        <MoneyRecords
          group="disputes"
          title="Disputes"
          onSelect={(r) => {
            setTab("disputes");
            setSelected(r);
          }}
        />
      </div>
      {selected && (
        <Dialog.Root
          open
          onOpenChange={(o) => {
            if (!o) setSelected(null);
          }}
        >
          <Dialog.Content
            style={{ maxWidth: 650, maxHeight: "85vh", overflowY: "auto" }}
          >
            <Dialog.Title>
              {tab === "ledgers"
                ? "Activity details"
                : tab === "payouts"
                  ? "Payout details"
                  : "Dispute details"}
            </Dialog.Title>
            <Dialog.Description>
              {selected.description ??
                selected.destination ??
                titleCase(selected.reason ?? selected.type ?? tab)}
            </Dialog.Description>
            <Facts
              items={
                [
                  ["Amount", money(selected.amount)],
                  ["Status", selected.status ?? selected.type],
                  ["Created", shortDate(selected.created_at)],
                  ...(tab === "payouts"
                    ? [
                        [
                          "Destination",
                          selected.destination ?? selected.method,
                        ],
                        ["Arrival", shortDate(selected.arrival_date)],
                      ]
                    : tab === "disputes"
                      ? [
                          ["Response deadline", shortDate(selected.due_by)],
                          ["Customer", selected.user?.username],
                        ]
                      : []),
                ] as [string, any][]
              }
            />
            {tab !== "ledgers" && (
              <ReadDetails
                args={[tab, "get", selected.id]}
                title="Additional details"
              />
            )}
            <Button variant="soft" onClick={() => setSelected(null)}>
              Close
            </Button>
          </Dialog.Content>
        </Dialog.Root>
      )}
      {showMethods && (
        <Dialog.Root open onOpenChange={setShowMethods}>
          <Dialog.Content
            style={{ maxWidth: 650, maxHeight: "85vh", overflowY: "auto" }}
          >
            <Dialog.Title>Payout methods</Dialog.Title>
            <Dialog.Description>
              Your saved withdrawal destinations.
            </Dialog.Description>
            <ReadDetails
              args={["payouts", "methods", "--first", "100"]}
              title="Saved destinations"
            />
            <Button variant="soft" onClick={() => setShowMethods(false)}>
              Close
            </Button>
          </Dialog.Content>
        </Dialog.Root>
      )}
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

function MoneyRecords({
  group,
  title,
  onSelect,
}: {
  group: string;
  title: string;
  onSelect: (row: RecordData) => void;
}) {
  return (
    <Directory
      title={title}
      storageKey={`money.${group}`}
      statuses={group === "disputes" ? ["needs_response"] : undefined}
      args={[group, "list", group === "ledgers" ? "--limit" : "--first", "100"]}
      onSelect={onSelect}
      renderRows={(rows) => (
        <div className="table-clip money-record-table">
          <Table.Root variant="ghost" size="1">
            <Table.Table>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>
                    {group === "ledgers"
                      ? "Description"
                      : group === "payouts"
                        ? "Destination"
                        : "Reason"}
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>
                    {group === "ledgers" ? "Type" : "Status"}
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell justify="end">
                    Amount
                  </Table.ColumnHeaderCell>
                  {group === "ledgers" && (
                    <Table.ColumnHeaderCell justify="end">
                      When
                    </Table.ColumnHeaderCell>
                  )}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {rows.map((r) => {
                  const amount = Number(r.amount?.amount ?? 0);
                  return (
                    <Table.Row key={r.id}>
                      <Table.Cell>
                        <button
                          className="money-record-link"
                          onClick={() => onSelect(r)}
                        >
                          {r.description ??
                            r.destination ??
                            (titleCase(r.reason ?? r.method) || r.id)}
                        </button>
                        {group !== "ledgers" && (
                          <Text
                            size="1"
                            color="gray"
                            style={{ display: "block", marginTop: 4 }}
                          >
                            {group === "disputes" && r.due_by
                              ? `Respond by ${shortDate(r.due_by)}`
                              : shortDate(r.created_at)}
                            {group === "payouts" && r.arrival_date
                              ? ` · arrives ${shortDate(r.arrival_date)}`
                              : ""}
                          </Text>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <StatusBadge status={r.status ?? r.type} />
                      </Table.Cell>
                      <Table.Cell justify="end">
                        <Text
                          size="2"
                          weight="medium"
                          className="num"
                          style={{
                            color:
                              group === "ledgers"
                                ? amount < 0
                                  ? "var(--gray-11)"
                                  : "var(--success-11)"
                                : undefined,
                          }}
                        >
                          {group === "ledgers" && amount > 0 ? "+" : ""}
                          {money(r.amount)}
                        </Text>
                      </Table.Cell>
                      {group === "ledgers" && (
                        <Table.Cell justify="end">
                          <Text size="1" color="gray">
                            {relative(r.created_at)}
                          </Text>
                        </Table.Cell>
                      )}
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Table>
          </Table.Root>
        </div>
      )}
    />
  );
}
