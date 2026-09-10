import { Button, DropdownMenu, IconButton, SegmentedControl, Table, Text, toast } from "frosted-ui";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyPanel, PageHeader, Panel, QueryBody } from "../components/Panel";
import { StatusBadge, UserCell } from "../components/UserCell";
import { planPrice, relative, shortDate } from "../lib/format";
import { commandString, invalidateAll, runWhopJson, useAccount, useWhop, type Member, type Membership, type Page } from "../lib/whop";

type Tab = "memberships" | "members";
const STATUSES = ["all", "active", "trialing", "past_due", "canceling", "paused", "canceled", "expired"] as const;

export function Members({ runInTerminal }: { runInTerminal: (c: string) => void }) {
  const { account } = useAccount();
  const [tab, setTab] = useState<Tab>("memberships");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [pending, setPending] = useState<{ title: string; description: string; args: string[]; danger?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const membershipArgs = ["memberships", "list", "--first", "100", ...(status === "all" ? [] : ["--status", status])];
  const memberships = useWhop<Page<Membership>>(membershipArgs, { enabled: tab === "memberships" });
  const members = useWhop<Page<Member>>(["members", "list", "--first", "100"], { enabled: tab === "members" });

  const act = (m: Membership, verb: "cancel" | "pause" | "resume") => {
    const who = m.user?.username ? `@${m.user.username}` : m.id;
    setPending({
      title: `${verb[0].toUpperCase()}${verb.slice(1)} membership`,
      description: `${who} · ${m.product?.title ?? "membership"} · ${m.status}`,
      args: ["memberships", verb, m.id],
      danger: verb === "cancel",
    });
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await runWhopJson(pending.args, !!account?.demo);
      toast.success(`${pending.title} done`);
      invalidateAll();
      memberships.refresh();
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message ?? "Command failed");
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  return (
    <div className="stack">
      <PageHeader
        title="Members"
        subtitle={account ? `${account.title} · everyone with a purchase or access` : undefined}
        actions={
          <>
            <SegmentedControl.Root value={tab} onValueChange={(v: string) => setTab(v as Tab)}>
              <SegmentedControl.List>
                <SegmentedControl.Trigger value="memberships">Memberships</SegmentedControl.Trigger>
                <SegmentedControl.Trigger value="members">Members</SegmentedControl.Trigger>
              </SegmentedControl.List>
            </SegmentedControl.Root>
            <Button size="1" variant="classic" onClick={() => runInTerminal("whop memberships invite --plan_id ")}>
              Invite
            </Button>
          </>
        }
      />

      {tab === "memberships" ? (
        <Panel
          title="Memberships"
          query={memberships}
          onRun={runInTerminal}
          actions={
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {STATUSES.map((s) => (
                <Button key={s} size="1" variant={status === s ? "soft" : "ghost"} color="gray" onClick={() => setStatus(s)}>
                  {s.replace("_", " ")}
                </Button>
              ))}
            </div>
          }
        >
          <QueryBody
            q={memberships}
            onRun={runInTerminal}
            empty={(d) =>
              d.data.length === 0 ? (
                <EmptyPanel
                  title={status === "all" ? "No memberships yet" : `No ${status.replace("_", " ")} memberships`}
                  description={status === "all" ? "A membership is created the moment someone checks out or accepts an invite." : "Try another status filter."}
                  action={status === "all" ? { label: "Create a checkout link", onClick: () => runInTerminal("whop checkout-configurations create --plan_id ") } : undefined}
                />
              ) : null
            }
          >
            {(d) => (
              <div className="table-clip">
                <Table.Root variant="ghost" size="1">
                  <Table.Table>
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeaderCell>Customer</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Product</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Plan</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Renews</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell justify="end">Since</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell width={40} />
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {d.data.map((m) => (
                        <Table.Row key={m.id}>
                          <Table.Cell>
                            <UserCell username={m.user?.username} name={m.user?.name} />
                          </Table.Cell>
                          <Table.Cell>
                            <Text size="2">{m.product?.title ?? "—"}</Text>
                          </Table.Cell>
                          <Table.Cell>
                            <Text size="2" className="num">
                              {planPrice(m.plan)}
                            </Text>
                          </Table.Cell>
                          <Table.Cell>
                            <StatusBadge status={m.status} />
                          </Table.Cell>
                          <Table.Cell>
                            <Text size="1" color="gray">
                              {m.renewal_period_end ? shortDate(m.renewal_period_end) : "—"}
                            </Text>
                          </Table.Cell>
                          <Table.Cell justify="end">
                            <Text size="1" color="gray">
                              {relative(m.created_at)}
                            </Text>
                          </Table.Cell>
                          <Table.Cell justify="end">
                            <DropdownMenu.Root>
                              <DropdownMenu.Trigger>
                                <IconButton size="1" variant="ghost" color="gray" aria-label="Actions">
                                  <DotsHorizontalIcon />
                                </IconButton>
                              </DropdownMenu.Trigger>
                              <DropdownMenu.Content size="1" align="end">
                                <DropdownMenu.Item onClick={() => runInTerminal(commandString(["memberships", "get", m.id]))}>View JSON</DropdownMenu.Item>
                                {m.status === "paused" ? (
                                  <DropdownMenu.Item onClick={() => act(m, "resume")}>Resume</DropdownMenu.Item>
                                ) : (
                                  <DropdownMenu.Item onClick={() => act(m, "pause")}>Pause billing</DropdownMenu.Item>
                                )}
                                <DropdownMenu.Separator />
                                <DropdownMenu.Item color="red" onClick={() => act(m, "cancel")}>
                                  Cancel membership
                                </DropdownMenu.Item>
                              </DropdownMenu.Content>
                            </DropdownMenu.Root>
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
      ) : (
        <Panel title="Members" query={members} onRun={runInTerminal}>
          <QueryBody q={members} onRun={runInTerminal} empty={(d) => (d.data.length === 0 ? <EmptyPanel title="No members yet" description="Members are people with a relationship to this business, whatever they bought." /> : null)}>
            {(d) => (
              <div className="table-clip">
                <Table.Root variant="ghost" size="1">
                  <Table.Table>
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeaderCell>Member</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Access</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Last seen</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell justify="end">Joined</Table.ColumnHeaderCell>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {d.data.map((m) => (
                        <Table.Row key={m.id} data-clickable onClick={() => runInTerminal(commandString(["members", "get", m.id]))}>
                          <Table.Cell>
                            <UserCell username={m.user?.username} name={m.user?.name} avatar={m.user?.profile_picture?.url} />
                          </Table.Cell>
                          <Table.Cell>
                            <Text size="2">{m.access_level}</Text>
                          </Table.Cell>
                          <Table.Cell>
                            <StatusBadge status={m.status} />
                          </Table.Cell>
                          <Table.Cell>
                            <Text size="1" color="gray">
                              {relative(m.last_accessed_at)}
                            </Text>
                          </Table.Cell>
                          <Table.Cell justify="end">
                            <Text size="1" color="gray">
                              {shortDate(m.joined_at)}
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
      )}

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending?.title ?? ""}
        description={pending?.description}
        command={pending ? commandString(pending.args) : ""}
        danger={pending?.danger}
        busy={busy}
        confirmLabel={pending?.title.split(" ")[0]}
        onConfirm={confirm}
      />
    </div>
  );
}
