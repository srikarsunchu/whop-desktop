import { Button, Table, Text } from "frosted-ui";
import { EmptyPanel, PageHeader, Panel, QueryBody } from "../components/Panel";
import { UserCell } from "../components/UserCell";
import { money, num, relative } from "../lib/format";
import { commandString, useAccount, useWhop, type Page, type Person } from "../lib/whop";

export function People({ runInTerminal }: { runInTerminal: (c: string) => void }) {
  const { account } = useAccount();
  const people = useWhop<Page<Person>>(["people", "list", "--first", "100"]);
  return (
    <div className="stack">
      <PageHeader
        title="People"
        subtitle={account ? `${account.title} · visitors and customers, with purchase and traffic profiles` : undefined}
        actions={
          <Button size="1" variant="surface" onClick={() => runInTerminal("whop events pulse")}>
            Event pulse
          </Button>
        }
      />
      <Panel title="Visitors" query={people} onRun={runInTerminal}>
        <QueryBody q={people} onRun={runInTerminal} empty={(d) => (d.data.length === 0 ? <EmptyPanel title="No visitors tracked yet" description="Install the Whop pixel on your site and every visit lands here with location, device and LTV." action={{ label: "Validate pixel", onClick: () => runInTerminal("whop events validate_pixel") }} /> : null)}>
          {(d) => (
            <div className="table-clip">
              <Table.Root variant="ghost" size="1">
                <Table.Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Person</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Location</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Device</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell justify="end">Events</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell justify="end">Purchases</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell justify="end">LTV</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell justify="end">Last seen</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {d.data.map((p) => (
                      <Table.Row key={p.id} data-clickable onClick={() => runInTerminal(commandString(["people", "get", p.id]))}>
                        <Table.Cell>
                          {p.name || p.user?.username ? (
                            <UserCell username={p.user?.username} name={p.name} />
                          ) : (
                            <Text size="2" color="gray">
                              Anonymous visitor
                            </Text>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2">{[p.location?.city, p.location?.country].filter(Boolean).join(", ") || "—"}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2" color="gray">
                            {[p.device?.browser, p.device?.os].filter(Boolean).join(" · ") || "—"}
                          </Text>
                        </Table.Cell>
                        <Table.Cell justify="end">
                          <Text size="2" className="num">
                            {num(p.event_count)}
                          </Text>
                        </Table.Cell>
                        <Table.Cell justify="end">
                          <Text size="2" className="num">
                            {num(p.purchase_count)}
                          </Text>
                        </Table.Cell>
                        <Table.Cell justify="end">
                          <Text size="2" className="num" weight={p.ltv > 0 ? "medium" : "regular"}>
                            {money(p.ltv)}
                          </Text>
                        </Table.Cell>
                        <Table.Cell justify="end">
                          <Text size="1" color="gray">
                            {relative(p.last_seen_at)}
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
    </div>
  );
}
