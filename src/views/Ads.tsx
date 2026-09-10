import { Button, Callout, DropdownMenu, IconButton, Table, Text, toast } from "frosted-ui";
import { DotsHorizontalIcon, Link2Icon } from "@radix-ui/react-icons";
import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyPanel, PageHeader, Panel, QueryBody } from "../components/Panel";
import { StatTile } from "../components/StatTile";
import { StatusBadge } from "../components/UserCell";
import { daysAgo, isoDay, money, num, shortDate, titleCase } from "../lib/format";
import { commandString, invalidateAll, runWhopJson, useAccount, useWhop, type Page } from "../lib/whop";

interface Stats {
  spend?: number | string;
  impressions?: number;
  reach?: number;
  clicks?: number;
  click_through_rate?: number;
  results?: number;
  cost_per_result?: number | string;
  return_on_ad_spend?: number;
}
interface Campaign extends Stats {
  id: string;
  title?: string;
  name?: string;
  status: string;
  objective?: string;
  platform?: string;
  budget_amount?: number | string;
  budget_type?: string;
  budget_optimization?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at?: string;
  stats?: Stats;
}
interface AdGroup extends Stats {
  id: string;
  title?: string;
  status: string;
  ad_campaign_id?: string;
  optimization_goal?: string;
  budget_amount?: number | string;
  budget_type?: string;
  stats?: Stats;
}
interface Ad extends Stats {
  id: string;
  title?: string;
  status: string;
  ad_group_id?: string;
  headlines?: string[];
  descriptions?: string[];
  call_to_action?: string;
  destination_url?: string;
  creatives?: unknown[];
  stats?: Stats;
}
interface Audience {
  id: string;
  title?: string;
  name?: string;
  size?: number;
  people_count?: number;
  created_at?: string;
}
interface SocialAccount {
  id: string;
  platform: string;
  username?: string | null;
  name?: string | null;
  verified?: boolean;
  scopes?: string[];
}

const s = (x: Stats & { stats?: Stats }): Stats => x.stats ?? x;
const n = (v: number | string | undefined | null) => (v == null ? undefined : Number(v));

export function Ads({ runInTerminal, ask }: { runInTerminal: (c: string) => void; ask: (prompt: string) => void }) {
  const { account } = useAccount();
  const from = isoDay(daysAgo(29));
  const to = isoDay(daysAgo(0));
  const social = useWhop<Page<SocialAccount>>(["social-accounts", "list"]);
  const campaigns = useWhop<Page<Campaign>>(["ad-campaigns", "list", "--stats_from", from, "--stats_to", to, "--first", "50"]);
  const groups = useWhop<Page<AdGroup>>(["ad-groups", "list", "--first", "50"]);
  const ads = useWhop<Page<Ad>>(["ads", "list", "--first", "50"]);
  const audiences = useWhop<Page<Audience>>(["audiences", "list"]);
  const [pending, setPending] = useState<{ title: string; args: string[]; danger?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await runWhopJson(pending.args, !!account?.demo);
      toast.success(`${pending.title} done`);
      invalidateAll();
      campaigns.refresh();
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? "Command failed");
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const rows = campaigns.data?.data ?? [];
  const total = (k: keyof Stats) => (rows.length ? rows.reduce((a, c) => a + (n(s(c)[k] as number | string | undefined) ?? 0), 0) : undefined);
  const spend = total("spend");
  const impressions = total("impressions");
  const clicks = total("clicks");
  const results = total("results");
  const connected = (social.data?.data ?? []).filter((a) => a.scopes?.includes("advertise") || a.platform === "facebook" || a.platform === "instagram");

  return (
    <div className="stack">
      <PageHeader
        title="Ads"
        subtitle={account ? `${account.title} · Meta campaigns run from your Whop balance, attributed by the Whop pixel` : undefined}
        actions={
          <>
            <Button size="1" variant="surface" onClick={() => runInTerminal("whop ad-groups targeting_options --query ")}>
              Targeting options
            </Button>
            <Button size="1" variant="classic" onClick={() => ask("Plan a Meta ad campaign for my best-selling product: objective, daily budget, audience and two ad copy variants. Show me the whop ad-campaigns create command before running anything.")}>
              Plan a campaign with Claude
            </Button>
          </>
        }
      />

      {social.data && connected.length === 0 && !social.error && (
        <Callout.Root color="amber">
          <Callout.Icon>
            <Link2Icon />
          </Callout.Icon>
          <Callout.Title>No ad account connected</Callout.Title>
          <Callout.Description>Whop Ads run on Meta through a connected Facebook page. Connect one on whop.com, then campaigns created here deliver from your balance.</Callout.Description>
          <Callout.Actions>
            <Callout.Action onClick={() => invoke("open_web_window")}>Open whop.com</Callout.Action>
          </Callout.Actions>
        </Callout.Root>
      )}

      <div className="grid-4">
        <StatTile label="Spend, 30d" value={spend} format={{ style: "currency", currency: "USD" }} loading={campaigns.loading} note={campaigns.error ? campaigns.error.code : `${rows.length} campaign${rows.length === 1 ? "" : "s"}`} />
        <StatTile label="Impressions" value={impressions} loading={campaigns.loading} note="attributed by the Whop pixel" />
        <StatTile label="Clicks" value={clicks} loading={campaigns.loading} note={impressions && clicks ? `${((clicks / impressions) * 100).toFixed(2)}% CTR` : ""} />
        <StatTile label="Results" value={results} loading={campaigns.loading} note={spend && results ? `${money(spend / results)} per result` : "conversions"} />
      </div>

      <Panel title="Campaigns" query={campaigns} onRun={runInTerminal}>
        <QueryBody q={campaigns} onRun={runInTerminal} empty={(d) => (d.data.length === 0 ? <EmptyPanel title="No campaigns yet" description="A campaign holds the objective and budget; ad groups target; ads carry the creative. Claude can draft the whole tree in one command." action={{ label: "Plan with Claude", onClick: () => ask("Draft a Meta leads campaign for my top product with a $40/day budget and a lookalike audience. Show the whop commands first.") }} /> : null)}>
          {(d) => (
            <div className="table-clip">
              <Table.Root variant="ghost" size="1">
                <Table.Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Campaign</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Objective</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell justify="end">Budget</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell justify="end">Spend</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell justify="end">Impr.</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell justify="end">Clicks</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell justify="end">Results</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell justify="end">CPR</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell width={40} />
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {d.data.map((c) => {
                      const st = s(c);
                      return (
                        <Table.Row key={c.id}>
                          <Table.Cell>
                            <Text size="2" weight="medium" style={{ display: "block" }}>
                              {c.title ?? c.name ?? c.id}
                            </Text>
                            <Text size="1" color="gray">
                              {[c.platform ?? "meta", c.starts_at ? `from ${shortDate(c.starts_at)}` : null, c.ends_at ? `to ${shortDate(c.ends_at)}` : null].filter(Boolean).join(" · ")}
                            </Text>
                          </Table.Cell>
                          <Table.Cell>
                            <StatusBadge status={c.status} />
                          </Table.Cell>
                          <Table.Cell>
                            <Text size="2">{titleCase(c.objective) || "—"}</Text>
                          </Table.Cell>
                          <Table.Cell justify="end">
                            <Text size="2" className="num">
                              {c.budget_amount != null ? `${money(n(c.budget_amount))}/${c.budget_type === "lifetime" ? "total" : "day"}` : c.budget_optimization === "ad_group" ? "per group" : "—"}
                            </Text>
                          </Table.Cell>
                          <Table.Cell justify="end">
                            <Text size="2" className="num" weight="medium">
                              {money(n(st.spend))}
                            </Text>
                          </Table.Cell>
                          <Table.Cell justify="end">
                            <Text size="2" className="num">
                              {num(st.impressions)}
                            </Text>
                          </Table.Cell>
                          <Table.Cell justify="end">
                            <Text size="2" className="num">
                              {num(st.clicks)}
                            </Text>
                          </Table.Cell>
                          <Table.Cell justify="end">
                            <Text size="2" className="num">
                              {num(st.results)}
                            </Text>
                          </Table.Cell>
                          <Table.Cell justify="end">
                            <Text size="2" className="num">
                              {money(n(st.cost_per_result))}
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
                                <DropdownMenu.Item onClick={() => runInTerminal(commandString(["ad-campaigns", "get", c.id]))}>View JSON</DropdownMenu.Item>
                                <DropdownMenu.Item onClick={() => ask(`Analyse campaign ${c.id} (${c.title ?? c.name ?? ""}): what is working, what to change, and give me the exact whop commands.`)}>Ask Claude to optimise</DropdownMenu.Item>
                                <DropdownMenu.Separator />
                                {c.status === "paused" ? (
                                  <DropdownMenu.Item onClick={() => setPending({ title: "Unpause campaign", args: ["ad-campaigns", "unpause", c.id] })}>Unpause</DropdownMenu.Item>
                                ) : (
                                  <DropdownMenu.Item onClick={() => setPending({ title: "Pause campaign", args: ["ad-campaigns", "pause", c.id] })}>Pause</DropdownMenu.Item>
                                )}
                                {c.status === "payment_failed" && <DropdownMenu.Item onClick={() => setPending({ title: "Retry payment", args: ["ad-campaigns", "retry_payment", c.id] })}>Retry payment</DropdownMenu.Item>}
                                <DropdownMenu.Item onClick={() => setPending({ title: "Duplicate campaign", args: ["ad-campaigns", "duplicate", c.id] })}>Duplicate</DropdownMenu.Item>
                                <DropdownMenu.Item color="red" onClick={() => setPending({ title: "Delete campaign", args: ["ad-campaigns", "delete", c.id], danger: true })}>
                                  Delete
                                </DropdownMenu.Item>
                              </DropdownMenu.Content>
                            </DropdownMenu.Root>
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
        <Panel title="Ad groups" query={groups} onRun={runInTerminal}>
          <QueryBody q={groups} onRun={runInTerminal} empty={(d) => (d.data.length === 0 ? <EmptyPanel title="No ad groups" description="Targeting, placements and schedule live here, inside a campaign." /> : null)}>
            {(d) => (
              <Table.Root variant="ghost" size="1">
                <Table.Table>
                  <Table.Body>
                    {d.data.map((g) => (
                      <Table.Row key={g.id}>
                        <Table.Cell>
                          <Text size="2" weight="medium" style={{ display: "block" }}>
                            {g.title ?? g.id}
                          </Text>
                          <Text size="1" color="gray">
                            {[titleCase(g.optimization_goal), g.budget_amount != null ? `${money(n(g.budget_amount))}/${g.budget_type === "lifetime" ? "total" : "day"}` : null].filter(Boolean).join(" · ")}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <StatusBadge status={g.status} />
                        </Table.Cell>
                        <Table.Cell justify="end">
                          <Text size="2" className="num">
                            {money(n(s(g).spend))}
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

        <Panel title="Ads" query={ads} onRun={runInTerminal}>
          <QueryBody q={ads} onRun={runInTerminal} empty={(d) => (d.data.length === 0 ? <EmptyPanel title="No ads" description="Creatives and copy variants. Generate images or video in Studio and attach them here." /> : null)}>
            {(d) => (
              <Table.Root variant="ghost" size="1">
                <Table.Table>
                  <Table.Body>
                    {d.data.map((a) => (
                      <Table.Row key={a.id}>
                        <Table.Cell>
                          <Text size="2" weight="medium" style={{ display: "block" }}>
                            {a.title ?? a.headlines?.[0] ?? a.id}
                          </Text>
                          <Text size="1" color="gray">
                            {[a.headlines?.[0] && a.title ? a.headlines[0] : null, a.call_to_action ? titleCase(a.call_to_action) : null, a.creatives?.length ? `${a.creatives.length} creative${a.creatives.length === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ")}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <StatusBadge status={a.status} />
                        </Table.Cell>
                        <Table.Cell justify="end">
                          <Text size="2" className="num">
                            {num(s(a).clicks)} clicks
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

      <div className="grid-2">
        <Panel title="Audiences" query={audiences} onRun={runInTerminal}>
          <QueryBody q={audiences} onRun={runInTerminal} empty={(d) => (d.data.length === 0 ? <EmptyPanel title="No audiences" description="Reusable targeting lists, for example everyone who bought in the last 90 days." action={{ label: "Build one with Claude", onClick: () => ask("Create an audience of members who purchased in the last 90 days, then show me how to use it in an ad group.") }} /> : null)}>
            {(d) => (
              <Table.Root variant="ghost" size="1">
                <Table.Table>
                  <Table.Body>
                    {d.data.map((a) => (
                      <Table.Row key={a.id}>
                        <Table.Cell>
                          <Text size="2" weight="medium">
                            {a.title ?? a.name ?? a.id}
                          </Text>
                        </Table.Cell>
                        <Table.Cell justify="end">
                          <Text size="2" className="num">
                            {a.size ?? a.people_count != null ? `${num(a.size ?? a.people_count)} people` : "—"}
                          </Text>
                        </Table.Cell>
                        <Table.Cell justify="end">
                          <Text size="1" color="gray">
                            {shortDate(a.created_at)}
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

        <Panel title="Connected accounts" query={social} onRun={runInTerminal}>
          <QueryBody q={social} onRun={runInTerminal} empty={(d) => (d.data.length === 0 ? <EmptyPanel title="Nothing connected" description="Connect a Facebook page or Instagram account on whop.com to run ads." action={{ label: "Open whop.com", onClick: () => invoke("open_web_window") }} /> : null)}>
            {(d) => (
              <Table.Root variant="ghost" size="1">
                <Table.Table>
                  <Table.Body>
                    {d.data.map((a) => (
                      <Table.Row key={a.id}>
                        <Table.Cell>
                          <Text size="2" weight="medium" style={{ display: "block" }}>
                            {a.name ?? a.username ?? a.id}
                          </Text>
                          <Text size="1" color="gray">
                            {titleCase(a.platform)}
                            {a.username ? ` · @${a.username}` : ""}
                          </Text>
                        </Table.Cell>
                        <Table.Cell justify="end">
                          <StatusBadge status={a.scopes?.includes("advertise") ? "active" : a.verified ? "verified" : "connected"} />
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

      <ConfirmDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)} title={pending?.title ?? ""} command={pending ? commandString(pending.args) : ""} danger={pending?.danger} busy={busy} confirmLabel={pending?.title.split(" ")[0]} onConfirm={confirm} />
    </div>
  );
}
