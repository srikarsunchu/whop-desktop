import { Command } from "cmdk";
import { Dialog, Kbd } from "frosted-ui";
import { invoke } from "@tauri-apps/api/core";
import { CheckIcon, CodeIcon, LightningBoltIcon, OpenInNewWindowIcon, SwitchIcon } from "@radix-ui/react-icons";
import { useEffect, useState } from "react";
import { NAV, type ViewId } from "./Sidebar";
import { useAccount } from "../lib/whop";

const COMMON: { label: string; command: string }[] = [
  { label: "List products", command: "whop products list" },
  { label: "List active memberships", command: "whop memberships list --status active" },
  { label: "List members", command: "whop members list" },
  { label: "Balance summary", command: "whop ledgers report --report_type balance_summary" },
  { label: "Income statement", command: "whop ledgers report --report_type income_statement" },
  { label: "List payouts", command: "whop payouts list" },
  { label: "List payout methods", command: "whop payouts methods" },
  { label: "Metric catalog", command: "whop stats list" },
  { label: "Net revenue, last 30 days", command: "whop stats get net_revenue --interval day" },
  { label: "List apps", command: "whop apps list" },
  { label: "Deploy app (preview)", command: "whop apps deploy --preview" },
  { label: "List webhooks", command: "whop webhooks list" },
  { label: "Auth status", command: "whop auth status" },
  { label: "Switch business", command: "whop auth account" },
  { label: "Recommended actions", command: "whop recommended-actions list" },
  { label: "Create export", command: "whop exports create" },
];

export function Palette({ open, onOpenChange, onNavigate, onRun }: { open: boolean; onOpenChange: (o: boolean) => void; onNavigate: (v: ViewId) => void; onRun: (command: string) => void }) {
  const [query, setQuery] = useState("");
  const { account, accounts, setAccount } = useAccount();
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const go = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };
  const withAcct = (c: string) => (account && !account.demo && /\b(list|get|report)\b/.test(c) && !c.includes("--account_id") ? `${c} --account_id ${account.id}` : c);
  const typed = query.trim();
  const looksLikeCommand = /^whop\b/i.test(typed) || (typed.length > 0 && !NAV.some((n) => n.label.toLowerCase().includes(typed.toLowerCase())));

  return (
    <Dialog.Root open={open} onOpenChange={(o: boolean) => onOpenChange(o)}>
      <Dialog.Content size="2" className="palette-content" aria-label="Command palette">
        <div className="palette">
          <Command label="Command palette" shouldFilter={!/^whop\b/i.test(typed)}>
            <Command.Input value={query} onValueChange={setQuery} placeholder="Jump to a section or type a whop command…" autoFocus />
            <Command.List>
              <Command.Empty>No matches. Type a full command starting with whop.</Command.Empty>
              {looksLikeCommand && typed && (
                <Command.Group heading="Run">
                  <Command.Item value={`run ${typed}`} onSelect={() => go(() => onRun(/^whop\b/i.test(typed) ? typed : `whop ${typed}`))}>
                    <CodeIcon />
                    <span className="mono">{/^whop\b/i.test(typed) ? typed : `whop ${typed}`}</span>
                    <span className="p-right">
                      <Kbd size="1">↵</Kbd>
                    </span>
                  </Command.Item>
                </Command.Group>
              )}
              <Command.Group heading="Go to">
                {NAV.map(({ id, label, icon: Icon }) => (
                  <Command.Item key={id} value={`go ${label}`} onSelect={() => go(() => onNavigate(id))}>
                    <Icon />
                    {label}
                  </Command.Item>
                ))}
                <Command.Item value="open whop.com web" onSelect={() => go(() => invoke("open_web_window"))}>
                  <OpenInNewWindowIcon />
                  Open whop.com
                </Command.Item>
              </Command.Group>
              <Command.Group heading="Switch business">
                {accounts.map((a) => (
                  <Command.Item key={a.id} value={`switch ${a.title} ${a.id}`} onSelect={() => go(() => setAccount(a))}>
                    <SwitchIcon />
                    <span>{a.title}</span>
                    <span className="p-right" style={{ color: "var(--gray-9)", display: "flex", alignItems: "center", gap: 6 }}>
                      {a.demo ? "demo" : a.id}
                      {account?.id === a.id && <CheckIcon />}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
              <Command.Group heading="Commands">
                {COMMON.map((c) => (
                  <Command.Item key={c.command} value={`${c.label} ${c.command}`} onSelect={() => go(() => onRun(withAcct(c.command)))}>
                    <LightningBoltIcon />
                    <span>{c.label}</span>
                    <span className="p-right mono" style={{ color: "var(--gray-9)" }}>
                      {c.command.replace(/^whop /, "")}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}
