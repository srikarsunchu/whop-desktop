import { Button, DropdownMenu, IconButton, Table, Text, toast } from "frosted-ui";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyPanel, PageHeader, Panel, QueryBody } from "../components/Panel";
import { StatusBadge } from "../components/UserCell";
import { num, planPrice, shortDate } from "../lib/format";
import { commandString, invalidateAll, runWhopJson, useAccount, useWhop, type Page, type Product } from "../lib/whop";

export function Products({ runInTerminal }: { runInTerminal: (c: string) => void }) {
  const { account } = useAccount();
  const products = useWhop<Page<Product>>(["products", "list", "--first", "100"]);
  const [pending, setPending] = useState<{ title: string; args: string[]; danger?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await runWhopJson(pending.args, !!account?.demo);
      toast.success(`${pending.title} done`);
      invalidateAll();
      products.refresh();
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? "Command failed");
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const storeUrl = (p: Product) => (account?.route && !account.demo ? `https://whop.com/${account.route}/${p.route}` : `https://whop.com/${p.route}`);

  return (
    <div className="stack">
      <PageHeader
        title="Products"
        subtitle={account ? `${account.title} · what you sell, and its default plan` : undefined}
        actions={
          <Button size="1" variant="classic" onClick={() => runInTerminal('whop products create --title ""')}>
            New product
          </Button>
        }
      />
      <Panel title="Products" query={products} onRun={runInTerminal}>
        <QueryBody q={products} onRun={runInTerminal} empty={(d) => (d.data.length === 0 ? <EmptyPanel title="No products yet" description="A product owns plans and a store page. Create one from the CLI in one line." action={{ label: "Create a product", onClick: () => runInTerminal('whop products create --title ""') }} /> : null)}>
          {(d) => (
            <div className="table-clip">
              <Table.Root variant="ghost" size="1">
                <Table.Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Product</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Default plan</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell justify="end">Members</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Visibility</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell justify="end">Created</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell width={40} />
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {d.data.map((p) => (
                      <Table.Row key={p.id}>
                        <Table.Cell>
                          <Text size="2" weight="medium" style={{ display: "block" }}>
                            {p.title}
                          </Text>
                          <Text size="1" color="gray" className="mono">
                            /{p.route}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2" className="num">
                            {planPrice(p.default_plan)}
                          </Text>
                        </Table.Cell>
                        <Table.Cell justify="end">
                          <Text size="2" className="num">
                            {num(p.member_count)}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <StatusBadge status={p.visibility} />
                        </Table.Cell>
                        <Table.Cell justify="end">
                          <Text size="1" color="gray">
                            {shortDate(p.created_at)}
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
                              <DropdownMenu.Item onClick={() => invoke("open_external", { url: storeUrl(p) })}>Open store page</DropdownMenu.Item>
                              <DropdownMenu.Item onClick={() => runInTerminal(commandString(["plans", "list", "--product_id", p.id]))}>List plans</DropdownMenu.Item>
                              <DropdownMenu.Item onClick={() => runInTerminal(commandString(["products", "get", p.id]))}>View JSON</DropdownMenu.Item>
                              <DropdownMenu.Separator />
                              {p.visibility === "visible" ? (
                                <DropdownMenu.Item onClick={() => setPending({ title: "Unpublish product", args: ["products", "unpublish", p.id] })}>Unpublish</DropdownMenu.Item>
                              ) : (
                                <DropdownMenu.Item onClick={() => setPending({ title: "Publish product", args: ["products", "publish", p.id] })}>Publish</DropdownMenu.Item>
                              )}
                              <DropdownMenu.Item color="red" onClick={() => setPending({ title: "Delete product", args: ["products", "delete", p.id], danger: true })}>
                                Delete
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
      <ConfirmDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)} title={pending?.title ?? ""} command={pending ? commandString(pending.args) : ""} danger={pending?.danger} busy={busy} confirmLabel={pending?.title.split(" ")[0]} onConfirm={confirm} />
    </div>
  );
}
