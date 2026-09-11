import { SelectionIndicator } from "../components/Motion";
import { Badge, Button, Table, Text } from "frosted-ui";
import {
  ArrowRightIcon,
  ChatBubbleIcon,
  LightningBoltIcon,
} from "@radix-ui/react-icons";
import { useMemo } from "react";
import { PageHeader, Panel, QueryBody, EmptyPanel } from "../components/Panel";
import { useSaved } from "../components/Workspace";
import { StatTile } from "../components/StatTile";
import { RevenueChart } from "../components/RevenueChart";
import type { ViewId } from "../components/Sidebar";
import {
  daysAgo,
  isoDay,
  money,
  pctDelta,
  relative,
  shortDate,
} from "../lib/format";
import {
  useAccount,
  useWhop,
  type BalanceReport,
  type LedgerEntry,
  type Page,
  type StatsSeries,
} from "../lib/whop";

export function Overview({
  runInTerminal,
  onNavigate,
  ask,
}: {
  runInTerminal: (c: string) => void;
  onNavigate: (v: ViewId) => void;
  ask: (prompt: string) => void;
}) {
  const { account } = useAccount();
  const [period, setPeriod] = useSaved("overview.period", 30);
  const to = isoDay(daysAgo(0));
  const from = isoDay(daysAgo(period - 1));
  const prevTo = isoDay(daysAgo(period));
  const prevFrom = isoDay(daysAgo(period * 2 - 1));

  const revenue = useWhop<StatsSeries>([
    "stats",
    "get",
    "net_revenue",
    "--from",
    from,
    "--to",
    to,
    "--interval",
    "day",
  ]);
  const prevRevenue = useWhop<StatsSeries>([
    "stats",
    "get",
    "net_revenue",
    "--from",
    prevFrom,
    "--to",
    prevTo,
    "--interval",
    "day",
  ]);
  const balance = useWhop<BalanceReport>([
    "ledgers",
    "report",
    "--report_type",
    "balance_summary",
  ]);
  const activity = useWhop<Page<LedgerEntry>>(["ledgers", "list"]);
  const overdue = useWhop<Page<{ id: string }>>([
    "memberships",
    "list",
    "--status",
    "past_due",
    "--first",
    "100",
  ]);
  const disputes = useWhop<Page<{ id: string; status: string }>>([
    "disputes",
    "list",
    "--first",
    "100",
  ]);
  const products = useWhop<Page<{ id: string; visibility: string }>>([
    "products",
    "list",
    "--first",
    "100",
  ]);
  const paidActive = useWhop<StatsSeries>([
    "stats",
    "get",
    "paid_active_members",
    "--from",
    from,
    "--to",
    to,
    "--interval",
    "day",
  ]);
  const newUsers = useWhop<StatsSeries>([
    "stats",
    "get",
    "new_users",
    "--from",
    from,
    "--to",
    to,
    "--interval",
    "day",
  ]);

  const spark = (s?: StatsSeries) => {
    const pts = s?.data?.points?.map((p) => p.value ?? 0) ?? [];
    return pts.some((v) => v) ? pts : undefined;
  };

  const sum = (s?: StatsSeries) => {
    const values = s?.data?.points
      ?.map((p) => p.value)
      .filter((v): v is number => v != null && Number.isFinite(v));
    return values?.length ? values.reduce((a, v) => a + v, 0) : undefined;
  };
  const rev30 = revenue.error ? undefined : sum(revenue.data);
  const revPrev = prevRevenue.error ? undefined : sum(prevRevenue.data);
  const delta =
    rev30 != null && revPrev != null ? pctDelta(rev30, revPrev) : null;

  const available = useMemo(() => {
    const rows = balance.data?.rows ?? [];
    const row = rows.find((r) =>
      (r.category ?? r.label ?? "").toLowerCase().includes("available"),
    );
    if (row && (row.amount ?? row.balance) != null) {
      const n = Number(row.amount ?? row.balance);
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  }, [balance.data]);

  const availableRows = (balance.data?.rows ?? []).filter((r) =>
    (r.category ?? r.label ?? "").toLowerCase().includes("available"),
  );
  const balanceCurrency = availableRows[0]?.currency ?? "usd";
  const refreshing = [
    revenue,
    prevRevenue,
    balance,
    activity,
    paidActive,
    newUsers,
    overdue,
    disputes,
    products,
  ].some((q) => q.loading);
  const refresh = () =>
    [
      revenue,
      prevRevenue,
      balance,
      activity,
      paidActive,
      newUsers,
      overdue,
      disputes,
      products,
    ].forEach((q) => q.refresh());
  const openPriority = (
    view: "members" | "products" | "money",
    filter: boolean,
  ) => {
    const prefix = `workspace.${account?.id}.`;
    if (view === "members") {
      sessionStorage.setItem(
        prefix + "members.tab",
        JSON.stringify("memberships"),
      );
      sessionStorage.setItem(
        prefix + "memberships.status",
        JSON.stringify(filter ? "past_due" : "all"),
      );
      sessionStorage.setItem(prefix + "memberships.search", JSON.stringify(""));
      sessionStorage.removeItem(prefix + "members.selected");
    } else if (view === "products") {
      sessionStorage.setItem(
        prefix + "products.status",
        JSON.stringify(filter ? "hidden" : "all"),
      );
      sessionStorage.setItem(prefix + "products.search", JSON.stringify(""));
      sessionStorage.removeItem(prefix + "products.selected");
    } else {
      sessionStorage.setItem("whopdesktop.moneyFocus", "disputes");
      sessionStorage.setItem(
        prefix + "money.disputes.status",
        JSON.stringify(filter ? "needs_response" : "all"),
      );
      sessionStorage.setItem(
        prefix + "money.disputes.search",
        JSON.stringify(""),
      );
    }
    onNavigate(view);
  };
  const briefing = () =>
    ask(
      `Review ${account?.title ?? "my business"} for ${from} through ${to}. Summarize revenue compared with the previous ${period} days, audience changes, and current issues. Separate current balances and issues from period metrics. Recommend the most useful next step; do not change anything.`,
    );

  return (
    <div className="stack overview-page">
      <PageHeader
        title="Overview"
        subtitle={
          account
            ? `${account.title} · performance and priorities`
            : "Choose a business"
        }
        actions={
          <>
            <Button
              size="1"
              variant="ghost"
              color="gray"
              disabled={refreshing}
              onClick={refresh}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
            <div
              className="period-control"
              role="group"
              aria-label="Performance period"
            >
              {[7, 30, 90].map((days) => (
                <button
                  type="button"
                  key={days}
                  aria-pressed={period === days}
                  onClick={() => setPeriod(days)}
                >
                  {period === days && <SelectionIndicator id="overview-period" />}
                  {days} days
                </button>
              ))}
            </div>
          </>
        }
      />
      <div className="overview-period-caption">
        <span>
          {shortDate(`${from}T12:00:00`)} – {shortDate(`${to}T12:00:00`)} · UTC
          · current day included
        </span>
        <button onClick={briefing}>
          <ChatBubbleIcon /> Explain this period <ArrowRightIcon />
        </button>
      </div>
      <div className="overview-metrics">
        <div className="overview-metric">
          <StatTile
            label="Active paid memberships"
            value={
              paidActive.error
                ? null
                : paidActive.data?.data.points.at(-1)?.value
            }
            loading={paidActive.loading}
            note={
              paidActive.error
                ? "Couldn't load memberships"
                : "At end of selected period"
            }
            spark={spark(paidActive.data)}
            sparkLabel="Paid active memberships, daily"
          />
          <button
            onClick={() =>
              paidActive.error ? paidActive.refresh() : onNavigate("members")
            }
          >
            {paidActive.error ? "Retry" : "Manage members"}
            <ArrowRightIcon />
          </button>
        </div>
        <div className="overview-metric">
          <StatTile
            label="New users"
            value={newUsers.error ? null : sum(newUsers.data)}
            loading={newUsers.loading}
            note={
              newUsers.error
                ? "Couldn't load new users"
                : `During these ${period} days`
            }
            spark={spark(newUsers.data)}
            sparkLabel="New users, daily"
          />
          <button
            onClick={() =>
              newUsers.error ? newUsers.refresh() : onNavigate("people")
            }
          >
            {newUsers.error ? "Retry" : "Explore people"}
            <ArrowRightIcon />
          </button>
        </div>
        <div className="overview-metric">
          <StatTile
            label="Available balance"
            value={balance.error ? null : available}
            format={{
              style: "currency",
              currency: balanceCurrency.toUpperCase(),
            }}
            loading={balance.loading}
            note={
              balance.error
                ? "Couldn't load balance"
                : availableRows.length > 1
                  ? `${balanceCurrency.toUpperCase()} · ${availableRows.length} currencies available`
                  : "Current balance · ready to pay out"
            }
          />
          <button
            onClick={() =>
              balance.error ? balance.refresh() : onNavigate("money")
            }
          >
            {balance.error ? "Retry" : "View money"}
            <ArrowRightIcon />
          </button>
        </div>
      </div>
      <div className="overview-main">
        <Panel
          title="Net revenue"
          actions={
            <Button
              size="1"
              variant="ghost"
              color="gray"
              onClick={() => onNavigate("money")}
            >
              View money <ArrowRightIcon />
            </Button>
          }
        >
          <div className="revenue-summary">
            <span className="revenue-value">
              {rev30 == null ? "—" : money(rev30, revenue.data?.data.currency)}
            </span>
            <div className="revenue-comparison">
              {delta != null && (
                <Badge
                  size="1"
                  variant="soft"
                  color={delta >= 0 ? "green" : "red"}
                >
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(1)}%
                </Badge>
              )}
              <Text size="1" color="gray">
                {prevRevenue.error
                  ? "Comparison unavailable"
                  : revPrev == null
                    ? "Loading comparison…"
                    : delta == null
                      ? `Previous ${period} days: ${money(revPrev, revenue.data?.data.currency)}`
                      : `vs. previous ${period} days`}
              </Text>
            </div>
          </div>
          <QueryBody
            q={revenue}
            onRun={runInTerminal}
            empty={(d) =>
              !d?.data?.points?.length ||
              d.data.points.every((p) => !p.value) ? (
                <EmptyPanel
                  title={`No revenue in the last ${period} days`}
                  description="Sales land here the moment a checkout completes."
                  action={{
                    label: "See products",
                    onClick: () => onNavigate("products"),
                  }}
                />
              ) : null
            }
          >
            {(d) => (
              <RevenueChart
                key={period}
                points={d.data.points}
                currency={d.data.currency}
                height={230}
                label={`Net revenue, last ${period} days`}
              />
            )}
          </QueryBody>
        </Panel>
        <Panel
          title="Needs attention"
          actions={
            <Text size="1" color="gray">
              Current
            </Text>
          }
        >
          <p className="overview-attention-note">
            Check these before planning your next move.
          </p>
          <div className="overview-attention-list">
            <QueryBody q={disputes}>
              {(d) => {
                const count = d.data.filter(
                  (r) => r.status === "needs_response",
                ).length;
                return (
                  <Priority
                    title={
                      count
                        ? `${count} ${count === 1 ? "dispute needs" : "disputes need"} a response`
                        : "No disputes need a response"
                    }
                    description={
                      count
                        ? "Check the deadlines and payment details."
                        : "No response required in loaded disputes."
                    }
                    label="Review disputes"
                    active={count > 0}
                    onClick={() => openPriority("money", count > 0)}
                  />
                );
              }}
            </QueryBody>
            <QueryBody q={overdue}>
              {(d) => (
                <Priority
                  title={
                    d.data.length
                      ? `${d.data.length}${d.page_info?.has_next_page ? "+" : ""} past-due memberships`
                      : "No past-due memberships"
                  }
                  description={
                    d.data.length
                      ? "Review failed renewals and access."
                      : "No overdue memberships returned."
                  }
                  label="Review members"
                  active={d.data.length > 0}
                  onClick={() => openPriority("members", d.data.length > 0)}
                />
              )}
            </QueryBody>
            <QueryBody q={products}>
              {(d) => {
                const count = d.data.filter(
                  (r) => r.visibility === "hidden",
                ).length;
                return (
                  <Priority
                    title={
                      count
                        ? `${count} hidden products`
                        : "Your loaded products are visible"
                    }
                    description={
                      count
                        ? "Review offers that are not on your storefront."
                        : "Explore your offers and pricing."
                    }
                    label="Review products"
                    active={false}
                    onClick={() => openPriority("products", count > 0)}
                  />
                );
              }}
            </QueryBody>
          </div>
          <p className="overview-attention-scope">
            Based on up to 100 records in each list.
          </p>
        </Panel>
      </div>
      <div className="overview-briefing">
        <span className="assistant-mark">
          <ChatBubbleIcon />
        </span>
        <div>
          <strong>Turn these numbers into a plan</strong>
          <p>Ask the assistant what changed and where to focus next.</p>
        </div>
        <Button size="1" variant="soft" onClick={briefing}>
          Get a briefing <ArrowRightIcon />
        </Button>
      </div>
      <div>
        <Panel
          title="Latest transactions"
          actions={
            <Button
              size="1"
              variant="ghost"
              color="gray"
              onClick={() => onNavigate("money")}
            >
              View all activity <ArrowRightIcon />
            </Button>
          }
        >
          <QueryBody
            q={activity}
            onRun={runInTerminal}
            empty={(d) =>
              d.data.length === 0 ? (
                <EmptyPanel
                  title="Nothing on the ledger yet"
                  description="Payments, refunds, fees and payouts show up here as they post."
                />
              ) : null
            }
          >
            {(d) => (
              <Table.Root variant="ghost" size="1">
                <Table.Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>
                        Description
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell justify="end">
                        Amount
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell justify="end">
                        When
                      </Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {[...d.data]
                      .sort(
                        (a, b) =>
                          Date.parse(b.created_at) - Date.parse(a.created_at),
                      )
                      .slice(0, 5)
                      .map((e) => {
                        const amt = Number(e.amount?.amount ?? 0);
                        return (
                          <Table.Row key={e.id}>
                            <Table.Cell>
                              <Text size="2">
                                {e.description ?? e.type ?? e.id}
                              </Text>
                            </Table.Cell>
                            <Table.Cell justify="end">
                              <Text
                                size="2"
                                weight="medium"
                                className="num"
                                style={{
                                  color:
                                    amt < 0
                                      ? "var(--gray-11)"
                                      : "var(--success-11)",
                                }}
                              >
                                {amt > 0 ? "+" : ""}
                                {money(e.amount)}
                              </Text>
                            </Table.Cell>
                            <Table.Cell
                              justify="end"
                              width={96}
                              style={{ whiteSpace: "nowrap" }}
                            >
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
      </div>
    </div>
  );
}

function Priority({
  title,
  description,
  label,
  active,
  onClick,
}: {
  title: string;
  description: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div className="overview-priority" data-active={active}>
      <span className="overview-priority-dot" />
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
        <button onClick={onClick}>
          {label}
          <ArrowRightIcon />
        </button>
      </div>
    </div>
  );
}
