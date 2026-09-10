import { Button, Code, DataList, Table, Text, toast } from "frosted-ui";
import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyPanel, PageHeader, Panel, QueryBody } from "../components/Panel";
import { StatusBadge } from "../components/UserCell";
import { shortDate, titleCase } from "../lib/format";
import { commandString, invalidateAll, runWhopJson, useAccount, useWhop } from "../lib/whop";

interface Profile {
  name: string;
  method: string;
  accountId?: string;
  accountTitle?: string;
  userEmail?: string;
  createdAt?: string;
}
interface AuthList {
  active: string;
  profiles: Profile[];
}
interface AccountDetail {
  id: string;
  title: string;
  route?: string;
  business_type?: string;
  industry_type?: string;
  country?: string;
  email?: string;
  created_at?: string;
}
interface TeamMember {
  id: string;
  status?: string;
  role?: string;
  email?: string | null;
  user?: { username?: string; name?: string | null } | null;
}

export function AccountView({ runInTerminal }: { runInTerminal: (c: string) => void }) {
  const { account, cliPath, cliVersion, loggedIn, profile, refreshAccounts } = useAccount();
  const auth = useWhop<AuthList>(["auth", "list"]);
  const detail = useWhop<AccountDetail>(account && !account.demo ? ["accounts", "get", account.id] : null);
  const team = useWhop<{ data: TeamMember[] }>(["team-members", "list"]);
  const [pending, setPending] = useState<{ title: string; args: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await runWhopJson(pending.args);
      toast.success(pending.title);
      invalidateAll();
      refreshAccounts();
      auth.refresh();
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? "Command failed");
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  return (
    <div className="stack">
      <PageHeader
        title="Account"
        subtitle="The Whop CLI login this app runs as, and the business it points at."
        actions={
          <>
            <Button size="1" variant="surface" onClick={() => invoke("open_web_window")}>
              Open whop.com
            </Button>
            <Button size="1" variant="classic" onClick={() => runInTerminal("whop login")}>
              Sign in
            </Button>
          </>
        }
      />

      <div className="grid-2">
        <Panel title="CLI">
          <DataList.Root size="2">
            <DataList.Item>
              <DataList.Label>Status</DataList.Label>
              <DataList.Value>
                <StatusBadge status={loggedIn === true ? "active" : loggedIn === false ? "expired" : undefined} />
                <Text size="2" style={{ marginLeft: 8 }}>
                  {loggedIn === true ? `signed in as ${profile}` : loggedIn === false ? "not signed in" : "checking…"}
                </Text>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Binary</DataList.Label>
              <DataList.Value>
                <Code size="1" variant="ghost" color="gray">
                  {cliPath ?? "not found"}
                </Code>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Version</DataList.Label>
              <DataList.Value>
                <Text size="2">{cliVersion ?? "—"}</Text>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Upgrade</DataList.Label>
              <DataList.Value>
                <Button size="1" variant="ghost" color="gray" onClick={() => runInTerminal("whop upgrade")}>
                  whop upgrade
                </Button>
              </DataList.Value>
            </DataList.Item>
          </DataList.Root>
          {!cliPath && (
            <div style={{ marginTop: 12 }}>
              <Text size="1" color="gray">
                Install:{" "}
                <Code size="1" style={{ userSelect: "text" }}>
                  curl -fsSL https://whop.com/install.sh | sh
                </Code>
              </Text>
            </div>
          )}
        </Panel>

        <Panel title="Business" query={account && !account.demo ? detail : undefined} onRun={runInTerminal}>
          {account?.demo ? (
            <EmptyPanel title="Northwind Picks is demo data" description="Switch to a real business from the sidebar to see live details." />
          ) : (
            <QueryBody q={detail} onRun={runInTerminal}>
              {(d) => (
                <DataList.Root size="2">
                  <DataList.Item>
                    <DataList.Label>Title</DataList.Label>
                    <DataList.Value>
                      <Text size="2" weight="medium">
                        {d.title}
                      </Text>
                    </DataList.Value>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.Label>ID</DataList.Label>
                    <DataList.Value>
                      <Code size="1" variant="ghost" color="gray" style={{ userSelect: "text" }}>
                        {d.id}
                      </Code>
                    </DataList.Value>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.Label>Type</DataList.Label>
                    <DataList.Value>
                      <Text size="2">{[titleCase(d.business_type), titleCase(d.industry_type)].filter(Boolean).join(" · ") || "—"}</Text>
                    </DataList.Value>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.Label>Country</DataList.Label>
                    <DataList.Value>
                      <Text size="2">{d.country?.toUpperCase() ?? "—"}</Text>
                    </DataList.Value>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.Label>Storefront</DataList.Label>
                    <DataList.Value>
                      <Button size="1" variant="ghost" color="gray" onClick={() => invoke("open_external", { url: `https://whop.com/${d.route ?? d.id}` })}>
                        whop.com/{d.route ?? d.id}
                      </Button>
                    </DataList.Value>
                  </DataList.Item>
                </DataList.Root>
              )}
            </QueryBody>
          )}
        </Panel>
      </div>

      <Panel title="CLI profiles" query={auth} onRun={runInTerminal} actions={<Button size="1" variant="ghost" color="gray" onClick={() => runInTerminal("whop login --method oauth")}>Add profile</Button>}>
        <QueryBody q={auth} onRun={runInTerminal} empty={(d) => (!d.profiles?.length ? <EmptyPanel title="No CLI profiles" description="Sign in once with whop login; the app reuses that session." action={{ label: "whop login", onClick: () => runInTerminal("whop login") }} /> : null)}>
          {(d) => (
            <Table.Root variant="ghost" size="1">
              <Table.Table>
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Profile</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Method</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Business</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell justify="end">Created</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell justify="end" />
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {d.profiles.map((p) => (
                    <Table.Row key={p.name}>
                      <Table.Cell>
                        <Text size="2" weight="medium">
                          {p.name}
                        </Text>{" "}
                        {d.active === p.name && <StatusBadge status="active" />}
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" color="gray">
                          {p.method}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2">{p.accountTitle ?? "—"}</Text>
                      </Table.Cell>
                      <Table.Cell justify="end">
                        <Text size="1" color="gray">
                          {shortDate(p.createdAt)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell justify="end">
                        {d.active !== p.name && (
                          <Button size="1" variant="ghost" color="gray" onClick={() => setPending({ title: `Switched to ${p.name}`, args: ["auth", "switch", p.name] })}>
                            Use
                          </Button>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Table>
            </Table.Root>
          )}
        </QueryBody>
      </Panel>

      <Panel title="Team" query={team} onRun={runInTerminal}>
        <QueryBody q={team} onRun={runInTerminal} empty={(d) => (!d.data?.length ? <EmptyPanel title="Just you" description="Invite teammates with scoped roles from the CLI." action={{ label: "Invite", onClick: () => runInTerminal('whop team-members create --email ""') }} /> : null)}>
          {(d) => (
            <Table.Root variant="ghost" size="1">
              <Table.Table>
                <Table.Body>
                  {d.data.map((m) => (
                    <Table.Row key={m.id}>
                      <Table.Cell>
                        <Text size="2" weight="medium">
                          {m.user?.name ?? m.user?.username ?? m.email ?? m.id}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" color="gray">
                          {titleCase(m.role) || "—"}
                        </Text>
                      </Table.Cell>
                      <Table.Cell justify="end">
                        <StatusBadge status={m.status} />
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Table>
            </Table.Root>
          )}
        </QueryBody>
      </Panel>

      <ConfirmDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)} title={pending?.title ?? ""} command={pending ? commandString(pending.args) : ""} busy={busy} confirmLabel="Switch" onConfirm={confirm} />
    </div>
  );
}
