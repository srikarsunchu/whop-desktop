import { Button, DropdownMenu, IconButton, Table, Text, toast } from "frosted-ui";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyPanel, PageHeader, Panel, QueryBody } from "../components/Panel";
import { StatusBadge } from "../components/UserCell";
import { money, num, relative, shortDate, titleCase } from "../lib/format";
import { commandString, invalidateAll, runWhopJson, useAccount, useWhop, type Page } from "../lib/whop";

interface Bounty {
  id: string;
  title: string;
  status: string;
  bounty_type?: string;
  business_goal_type?: string | null;
  currency?: string;
  gross_reward_amount?: number | string;
  gross_paid_out_amount?: number | string;
  total_available?: number | string;
  total_paid?: number | string;
  submissions_count?: number;
  accepted_submissions_count?: number;
  frequency?: string;
  publish_at?: string | null;
  created_at?: string;
}
interface Partner {
  id: string;
  title?: string;
  name?: string;
  status?: string;
  created_at?: string;
  referred_at?: string;
  total_earnings?: number | string;
  earnings?: number | string;
  volume?: number | string;
}
interface Leaderboard {
  data?: { rank?: number; user?: { username?: string }; title?: string; earnings?: number | string; volume?: number | string }[];
  rank?: number;
}

export function Growth({ runInTerminal, ask }: { runInTerminal: (c: string) => void; ask: (prompt: string) => void }) {
  const { account } = useAccount();
  const bounties = useWhop<Page<Bounty>>(["bounties", "list", "--first", "50"]);
  const partners = useWhop<Page<Partner>>(["partners", "list"]);
  const leaderboard = useWhop<Leaderboard>(["partners", "leaderboard"]);
  const [pending, setPending] = useState<{ title: string; args: string[]; danger?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await runWhopJson(pending.args, !!account?.demo);
      toast.success(`${pending.title} done`);
      invalidateAll();
      bounties.refresh();
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? "Command failed");
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const amt = (b: Bounty, k: "gross_reward_amount" | "gross_paid_out_amount") => {
    const v = b[k] ?? (k === "gross_reward_amount" ? b.total_available : b.total_paid);
    return v == null ? undefined : Number(v);
  };

  return (
    <div className="stack">
      <PageHeader
        title="Growth"
        subtitle={account ? `${account.title} · bounties that pay creators for clips and content, and the businesses you referred to Whop` : undefined}
        actions={
          <>
            <Button size="1" variant="surface" onClick={() => runInTerminal("whop partners create")}>
              Enroll as partner
            </Button>
            <Button size="1" variant="classic" onClick={() => ask("Draft a clipping bounty for my best product: title, description, a $500 reward pool, weekly frequency, and the exact whop bounties create command. Don't run it until I say yes.")}>
              Draft a bounty with Claude
            </Button>
          </>
        }
      />

      <Panel title="Bounties" query={bounties} onRun={runInTerminal}>
        <QueryBody q={bounties} onRun={runInTerminal} empty={(d) => (d.data.length === 0 ? <EmptyPanel title="No bounties yet" description="A bounty escrows a reward pool and pays creators for clips, posts, UGC or data capture. Submissions are reviewed before payout." action={{ label: "Draft one with Claude", onClick: () => ask("Draft a clipping bounty for my top product with a $500 pool and show me the whop bounties create command.") }} /> : null)}>
          {(d) => (
            <div className="table-clip">
              <Table.Root variant="ghost" size="1">
                <Table.Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Bounty</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Goal</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell justify="end">Pool</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell justify="end">Paid out</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell justify="end">Submissions</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell justify="end">Created</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell width={40} />
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {d.data.map((b) => (
                      <Table.Row key={b.id}>
                        <Table.Cell>
                          <Text size="2" weight="medium" style={{ display: "block" }}>
                            {b.title}
                          </Text>
                          <Text size="1" color="gray">
                            {[titleCase(b.bounty_type), b.frequency ? titleCase(b.frequency) : null].filter(Boolean).join(" · ")}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2">{titleCase(b.business_goal_type) || "—"}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <StatusBadge status={b.status} />
                        </Table.Cell>
                        <Table.Cell justify="end">
                          <Text size="2" className="num" weight="medium">
                            {money(amt(b, "gross_reward_amount"), b.currency ?? "usd")}
                          </Text>
                        </Table.Cell>
                        <Table.Cell justify="end">
                          <Text size="2" className="num">
                            {money(amt(b, "gross_paid_out_amount"), b.currency ?? "usd")}
                          </Text>
                        </Table.Cell>
                        <Table.Cell justify="end">
                          <Text size="2" className="num">
                            {b.submissions_count != null ? `${num(b.accepted_submissions_count ?? 0)} / ${num(b.submissions_count)}` : "—"}
                          </Text>
                        </Table.Cell>
                        <Table.Cell justify="end">
                          <Text size="1" color="gray">
                            {shortDate(b.created_at)}
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
                              <DropdownMenu.Item onClick={() => runInTerminal(commandString(["bounties", "submissions", b.id]))}>View submissions</DropdownMenu.Item>
                              <DropdownMenu.Item onClick={() => runInTerminal(commandString(["bounties", "get", b.id]))}>View JSON</DropdownMenu.Item>
                              <DropdownMenu.Separator />
                              <DropdownMenu.Item color="red" onClick={() => setPending({ title: "Cancel bounty", args: ["bounties", "cancel", b.id], danger: true })}>
                                Cancel bounty
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

      <div className="grid-2">
        <Panel title="Referred businesses" query={partners} onRun={runInTerminal}>
          <QueryBody q={partners} onRun={runInTerminal} empty={(d) => (d.data.length === 0 ? <EmptyPanel title="No referrals yet" description="Whop pays partners a share of what the businesses they refer earn. Share your partner link to start." action={{ label: "How partners work", onClick: () => ask("Explain the Whop partner program for my account: how to enroll, what I earn, and how to get my referral link. Use whop partners commands.") }} /> : null)}>
            {(d) => (
              <Table.Root variant="ghost" size="1">
                <Table.Table>
                  <Table.Body>
                    {d.data.map((p) => (
                      <Table.Row key={p.id}>
                        <Table.Cell>
                          <Text size="2" weight="medium" style={{ display: "block" }}>
                            {p.title ?? p.name ?? p.id}
                          </Text>
                          <Text size="1" color="gray">
                            referred {relative(p.referred_at ?? p.created_at)}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <StatusBadge status={p.status} />
                        </Table.Cell>
                        <Table.Cell justify="end">
                          <Text size="2" className="num" weight="medium">
                            {money(p.total_earnings ?? p.earnings ?? undefined)}
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

        <Panel title="Partner leaderboard" query={leaderboard} onRun={runInTerminal}>
          <QueryBody q={leaderboard} onRun={runInTerminal} empty={(d) => (!d?.data?.length ? <EmptyPanel title="Leaderboard unavailable" description="Shows the top-earning Whop partners once you are enrolled." /> : null)}>
            {(d) => (
              <Table.Root variant="ghost" size="1">
                <Table.Table>
                  <Table.Body>
                    {(d.data ?? []).slice(0, 10).map((r, i) => (
                      <Table.Row key={i}>
                        <Table.Cell width={40}>
                          <Text size="2" color="gray" className="num">
                            {r.rank ?? i + 1}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2" weight="medium">
                            {r.user?.username ? `@${r.user.username}` : r.title ?? "—"}
                          </Text>
                        </Table.Cell>
                        <Table.Cell justify="end">
                          <Text size="2" className="num">
                            {money(r.earnings ?? r.volume ?? undefined)}
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

      <ConfirmDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)} title={pending?.title ?? ""} command={pending ? commandString(pending.args) : ""} danger={pending?.danger} busy={busy} confirmLabel="Cancel bounty" onConfirm={confirm} />
    </div>
  );
}
