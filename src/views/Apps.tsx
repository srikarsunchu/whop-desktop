import { Button, Table, Text } from "frosted-ui";
import { invoke } from "@tauri-apps/api/core";
import { EmptyPanel, PageHeader, Panel, QueryBody } from "../components/Panel";
import { StatusBadge } from "../components/UserCell";
import { relative } from "../lib/format";
import { commandString, useAccount, useWhop, type AppRecord, type Page } from "../lib/whop";

export function Apps({ runInTerminal }: { runInTerminal: (c: string) => void }) {
  const { account } = useAccount();
  const apps = useWhop<Page<AppRecord>>(["apps", "list"]);
  return (
    <div className="stack">
      <PageHeader
        title="Apps"
        subtitle={account ? `${account.title} · fully hosted web apps on *.whop.app` : undefined}
        actions={
          <>
            <Button size="1" variant="surface" onClick={() => runInTerminal("whop apps deploy --preview")}>
              Deploy preview
            </Button>
            <Button size="1" variant="classic" onClick={() => runInTerminal('whop apps init --name "" --app_type b2c_app')}>
              New app
            </Button>
          </>
        }
      />
      <Panel title="Apps" query={apps} onRun={runInTerminal}>
        <QueryBody q={apps} onRun={runInTerminal} empty={(d) => (d.data.length === 0 ? <EmptyPanel title="No apps yet" description="whop apps init scaffolds a hosted app; whop apps deploy ships it." action={{ label: "Scaffold an app", onClick: () => runInTerminal('whop apps init --name "" --app_type b2c_app') }} /> : null)}>
          {(d) => (
            <Table.Root variant="ghost" size="1">
              <Table.Table>
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>App</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell justify="end">Updated</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell justify="end" />
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {d.data.map((a) => (
                    <Table.Row key={a.id}>
                      <Table.Cell>
                        <Text size="2" weight="medium" style={{ display: "block" }}>
                          {a.name}
                        </Text>
                        <Text size="1" color="gray" className="mono">
                          {a.domain ?? a.id}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" color="gray">
                          {a.app_type ?? "—"}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <StatusBadge status={a.status} />
                      </Table.Cell>
                      <Table.Cell justify="end">
                        <Text size="1" color="gray">
                          {relative(a.updated_at ?? a.created_at)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell justify="end">
                        <div className="row-actions">
                          {a.domain && (
                            <Button size="1" variant="ghost" color="gray" onClick={() => invoke("open_external", { url: `https://${a.domain}` })}>
                              Open
                            </Button>
                          )}
                          <Button size="1" variant="ghost" color="gray" onClick={() => runInTerminal(commandString(["apps", "logs", "--app_id", a.id]))}>
                            Logs
                          </Button>
                        </div>
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
  );
}
