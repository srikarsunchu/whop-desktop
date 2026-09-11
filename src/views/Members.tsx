import { Avatar, Button, Dialog, Table, Text } from "frosted-ui";
import { useState } from "react";
import { PageHeader, QueryBody } from "../components/Panel";
import {
  ActionEditor,
  Directory,
  Facts,
  Records,
  useSaved,
  type ActionSpec,
  type RecordData,
} from "../components/Workspace";
import { useWhop, type Page } from "../lib/whop";
import { StatusBadge, UserCell } from "../components/UserCell";
import { planPrice, shortDate, relative } from "../lib/format";
import { buildFields } from "../lib/business-actions";
export function Members({}: { runInTerminal: (c: string) => void }) {
  const [tab, setTab] = useSaved("members.tab", "memberships");
  const [selected, setSelected] = useSaved<RecordData | null>(
    "members.selected",
    null,
  );
  const [action, setAction] = useState<ActionSpec | null>(null);
  const detail = useWhop<RecordData>(
    selected ? [tab, "get", selected.id] : null,
  );
  const m = detail.data?.id === selected?.id ? detail.data : selected;
  const all = useWhop<Page<RecordData>>([
    "memberships",
    "list",
    "--first",
    "100",
  ]);
  const plans = useWhop<Page<RecordData>>(["plans", "list", "--first", "100"]);
  const free = (plans.data?.data ?? []).filter(
    (p) =>
      p.initial_price != null &&
      Number(p.initial_price?.amount ?? p.initial_price) === 0 &&
      (p.plan_type === "one_time" ||
        (p.renewal_price != null &&
          Number(p.renewal_price?.amount ?? p.renewal_price) === 0)),
  );
  const act = (verb: string) => {
    if (!m || detail.loading || detail.error) return;
    setAction({
      key: `membership.${m.id}.${verb}`,
      title: `${verb === "cancel" ? "Cancel" : verb === "pause" ? "Pause billing for" : "Resume billing for"} ${m.user?.name ?? "membership"}`,
      description:
        verb === "cancel"
          ? "Stop renewal at the end of the paid period, or revoke access immediately."
          : verb === "pause"
            ? "Pause payment collection on this membership."
            : "Resume payment collection for this membership.",
      danger: verb === "cancel",
      fields:
        verb === "cancel"
          ? [
              {
                key: "timing",
                label: "When to cancel",
                required: true,
                options: [
                  { value: "period_end", label: "At end of billing period" },
                  { value: "immediate", label: "Immediately · revoke access" },
                ],
              },
              { key: "reason", label: "Reason", type: "textarea" },
            ]
          : [],
      initial: { timing: "period_end" },
      build: (v, k) => {
        const args = buildFields(
          "memberships",
          verb,
          m.id,
          verb === "cancel" ? { reason: v.reason } : {},
          k,
        );
        if (verb === "cancel" && v.timing === "period_end")
          args.push("--cancel_at_period_end", "true");
        return args;
      },
    });
  };
  const invite = () =>
    setAction({
      key: "membership.invite",
      title: "Invite a member",
      description:
        "Send an invitation to a free plan. Paid access requires checkout.",
      fields: [
        { key: "email", label: "Email", type: "email", required: true },
        {
          key: "plan_id",
          label: "Free plan",
          required: true,
          options: free.map((p) => ({ value: p.id, label: p.title ?? p.id })),
          hint: plans.error
            ? "Plans could not be loaded. Refresh and retry."
            : `Choose from ${free.length} free plans in the first 100 plans.`,
        },
      ],
      build: (v, k) => {
        if (!free.some((p) => p.id === v.plan_id))
          throw Error("Choose a free plan.");
        return buildFields("memberships", "invite", undefined, v, k);
      },
    });
  const snapshot = all.data?.data;
  const stats = [
    {
      label: "Active",
      statuses: ["active", "trialing"],
      hint: "Includes free trials",
      tone: "green",
    },
    {
      label: "Past due",
      statuses: ["past_due"],
      hint: "Renewal needs attention",
      tone: "amber",
    },
    {
      label: "Ending",
      statuses: ["canceling"],
      hint: "Cancellation scheduled",
      tone: "amber",
    },
    {
      label: "Paused",
      statuses: ["paused"],
      hint: "Billing on hold",
      tone: "gray",
    },
  ];
  const renewal = (record: RecordData) =>
    record.status === "paused"
      ? "Billing paused"
      : ["canceled", "expired"].includes(record.status)
        ? "Not renewing"
        : record.renewal_period_end
          ? shortDate(record.renewal_period_end)
          : "No renewal";
  return (
    <div className="stack members-page">
      <PageHeader
        title="Members"
        subtitle="Your customers, their access, and what needs attention."
        actions={
          <Button
            size="1"
            variant="classic"
            onClick={invite}
            disabled={plans.loading}
          >
            Invite member
          </Button>
        }
      />
      <section className="members-snapshot" aria-label="Membership snapshot">
        <div className="members-snapshot-heading">
          <span>Membership snapshot</span>
          <small>
            {all.error
              ? "Snapshot unavailable"
              : snapshot
                ? `${snapshot.length} loaded memberships${all.data?.page_info?.has_next_page ? " · more available" : ""}`
                : "Loading…"}{" "}
            · first 100
          </small>
        </div>
        <div className="members-metrics">
          {stats.map((stat) => (
            <div key={stat.label}>
              <span className="members-metric-label">
                <i style={{ background: `var(--${stat.tone}-9)` }} />
                {stat.label}
              </span>
              <strong>
                {snapshot && !all.error
                  ? snapshot.filter((r) => stat.statuses.includes(r.status))
                      .length
                  : "—"}
              </strong>
              <small>{stat.hint}</small>
            </div>
          ))}
        </div>
      </section>
      <div className="workspace-tabs" aria-label="Member views">
        {["memberships", "members"].map((t) => (
          <button
            key={t}
            aria-pressed={tab === t}
            onClick={() => {
              setTab(t);
              setSelected(null);
            }}
          >
            {t === "memberships" ? "Memberships" : "Member directory"}
          </button>
        ))}
      </div>
      <Directory
        key={tab}
        title={tab === "memberships" ? "Memberships" : "Members"}
        storageKey={tab}
        args={[tab, "list", "--first", "100"]}
        selected={m?.id}
        onSelect={setSelected}
        statuses={
          tab === "memberships"
            ? [
                "active",
                "trialing",
                "past_due",
                "canceling",
                "paused",
                "canceled",
                "expired",
              ]
            : undefined
        }
        renderRows={(rows) => (
          <div className="members-table">
            <Table.Root variant="ghost" size="1">
              <Table.Table>
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Member</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>
                      {tab === "memberships" ? "Product" : "Access"}
                    </Table.ColumnHeaderCell>
                    {tab === "memberships" && (
                      <Table.ColumnHeaderCell>Plan</Table.ColumnHeaderCell>
                    )}
                    <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>
                      {tab === "memberships" ? "Renewal / access" : "Last seen"}
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell justify="end">
                      Joined
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell width={38} />
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {rows.map((r) => (
                    <Table.Row key={r.id}>
                      <Table.Cell>
                        <button
                          className="members-name"
                          onClick={() => setSelected(r)}
                        >
                          <UserCell
                            name={r.user?.name}
                            username={r.user?.username}
                            avatar={r.user?.profile_picture?.url}
                          />
                        </button>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2">
                          {tab === "memberships"
                            ? (r.product?.title ?? "—")
                            : (r.access_level ?? "—")}
                        </Text>
                      </Table.Cell>
                      {tab === "memberships" && (
                        <Table.Cell>
                          <Text size="2" className="num">
                            {planPrice(r.plan)}
                          </Text>
                        </Table.Cell>
                      )}
                      <Table.Cell>
                        <StatusBadge status={r.status} />
                      </Table.Cell>
                      <Table.Cell>
                        <Text
                          size="1"
                          color={r.status === "past_due" ? "amber" : "gray"}
                        >
                          {tab === "memberships"
                            ? `${r.status === "past_due" ? "Overdue · " : r.status === "canceling" ? "Ends · " : ""}${renewal(r)}`
                            : relative(r.last_accessed_at)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell justify="end">
                        <Text size="1" color="gray">
                          {shortDate(r.created_at ?? r.joined_at)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <button
                          className="members-open"
                          aria-label={`Open ${r.user?.name ?? r.user?.username ?? "member"} details`}
                          onClick={() => setSelected(r)}
                        >
                          ›
                        </button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Table>
            </Table.Root>
          </div>
        )}
      />
      {m && (
        <Dialog.Root
          open={!action}
          onOpenChange={(open) => {
            if (!open && !action) setSelected(null);
          }}
        >
          <Dialog.Content
            className="members-profile"
            style={{ maxWidth: 650, maxHeight: "85vh", overflowY: "auto" }}
          >
            <div className="members-profile-head">
              <Avatar
                size="4"
                fallback={(m.user?.name ?? m.user?.username ?? "?").slice(0, 1)}
                src={m.user?.profile_picture?.url}
                color="gray"
              />
              <div>
                <Dialog.Title>
                  {m.user?.name ?? m.user?.username ?? "Member"}
                </Dialog.Title>
                <Dialog.Description>
                  {m.user?.username
                    ? `@${m.user.username}`
                    : "Customer details"}
                </Dialog.Description>
              </div>
              <Button
                variant="ghost"
                color="gray"
                aria-label="Close member details"
                onClick={() => setSelected(null)}
              >
                ×
              </Button>
            </div>
            <div className="members-profile-status">
              <StatusBadge status={m.status} />
              <span>
                {tab === "memberships" ? m.product?.title : m.access_level}
              </span>
            </div>
            {detail.error && <QueryBody q={detail}>{() => null}</QueryBody>}
            {m.status === "past_due" && (
              <div className="members-attention">
                <strong>Renewal payment overdue</strong>
                <p>
                  Review the membership and its billing status before changing
                  access.
                </p>
              </div>
            )}
            {m.status === "paused" && (
              <div className="members-attention members-attention-neutral">
                <strong>Billing is paused</strong>
                <p>
                  Payment collection is on hold. Resume billing when this
                  membership should be charged again.
                </p>
              </div>
            )}
            <Facts
              items={
                tab === "memberships"
                  ? [
                      ["Plan", m.plan?.title ?? "Default plan"],
                      ["Price", planPrice(m.plan)],
                      [
                        m.status === "canceling" ? "Access ends" : "Renewal",
                        renewal(m),
                      ],
                      ["Member since", shortDate(m.created_at)],
                      [
                        "Cancellation scheduled",
                        m.cancel_at_period_end
                          ? "At end of billing period"
                          : "No",
                      ],
                    ]
                  : [
                      ["Access", m.access_level],
                      ["Joined", shortDate(m.joined_at)],
                      ["Last seen", relative(m.last_accessed_at)],
                    ]
              }
            />
            {tab === "members" && (
              <div className="members-linked">
                <h3>Memberships</h3>
                <p>Matching records from the first 100 memberships.</p>
                <QueryBody q={all}>
                  {(d) => {
                    const matching = d.data.filter(
                      (r) => m.user?.id && r.user?.id === m.user.id,
                    );
                    return matching.length ? (
                      <Records
                        rows={matching}
                        onSelect={(r) => {
                          setTab("memberships");
                          setSelected(r);
                        }}
                        label={(r) => r.product?.title ?? "Membership"}
                        secondary={(r) => planPrice(r.plan)}
                      />
                    ) : (
                      <p>No matching memberships in the loaded records.</p>
                    );
                  }}
                </QueryBody>
              </div>
            )}
            <details className="workspace-technical">
              <summary>Record reference</summary>
              <code>{m.id}</code>
            </details>
            <div className="members-profile-actions">
              <Button
                variant="soft"
                color="gray"
                onClick={() => setSelected(null)}
              >
                Done
              </Button>
              {tab === "memberships" && (
                <>
                  <span />
                  {!["canceled", "expired"].includes(m.status) && (
                    <Button
                      size="2"
                      variant="ghost"
                      color="red"
                      disabled={detail.loading || !!detail.error}
                      onClick={() => act("cancel")}
                    >
                      Cancel membership
                    </Button>
                  )}
                  {m.status === "paused" ? (
                    <Button
                      variant="classic"
                      disabled={detail.loading || !!detail.error}
                      onClick={() => act("resume")}
                    >
                      Resume billing
                    </Button>
                  ) : ["active", "trialing", "past_due"].includes(m.status) ? (
                    <Button
                      variant="soft"
                      disabled={detail.loading || !!detail.error}
                      onClick={() => act("pause")}
                    >
                      Pause billing
                    </Button>
                  ) : null}
                </>
              )}
            </div>
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
