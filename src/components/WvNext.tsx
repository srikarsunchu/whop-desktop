// "What to do next" from a wv screen: the report's next actions and gaps, gtm's gaps, dev's webhook access.
// Each item is a sentence and, when wv knows the fix, a button: a `wv` write runs through the gate in the
// action editor, a `whop` read runs in the terminal. Hidden when wv is not installed or on the demo business.
import { Button } from "frosted-ui";
import { useEffect, useState } from "react";
import { Panel, QueryBody } from "./Panel";
import { ActionEditor, type ActionSpec } from "./Workspace";
import { useAccount, useWv, wvPath } from "../lib/whop";

export interface NextItem {
  what: string;
  run?: string[];
}

type Rec = Record<string, unknown>;
const isObj = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const list = (v: unknown): Rec[] => (Array.isArray(v) ? v.filter(isObj) : []);
const argv = (v: unknown): string[] | undefined => (Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : undefined);

/** The items a screen's JSON carries, by screen. */
export function itemsOf(screen: string, d: unknown): NextItem[] {
  if (!isObj(d)) return [];
  const out: NextItem[] = [];
  const push = (what: unknown, run: unknown) => {
    if (typeof what === "string" && what) out.push({ what, run: argv(run) });
  };
  if (screen === "report") {
    for (const n of list(d.next)) push(n.what, n.run);
    for (const g of list(d.gaps)) if (!out.some((o) => o.what === g.what)) push(g.what, g.fix);
  } else if (screen === "gtm") {
    for (const g of list(d.gaps)) push(g.what, g.fix);
  } else if (screen === "dev") {
    const access = isObj(d.webhookAccess) ? d.webhookAccess : undefined;
    if (access && access.ok === false) push(typeof access.reason === "string" ? access.reason : "This login cannot manage webhooks.", access.fix);
    const errors = typeof d.errorsLast24h === "number" ? d.errorsLast24h : 0;
    if (errors > 0) push(`${errors} error ${errors === 1 ? "line" : "lines"} in the last day of logs.`, undefined);
    const hooks = isObj(d.webhooks) ? d.webhooks : undefined;
    if (hooks && typeof hooks.error === "string") push(`Webhooks could not be read: ${hooks.error}`, undefined);
  }
  return out;
}

export function WvNext({ screen, title, runInTerminal }: { screen: "report" | "gtm" | "dev"; title: string; runInTerminal: (c: string) => void }) {
  const { account } = useAccount();
  const [hasWv, setHasWv] = useState(false);
  useEffect(() => {
    wvPath().then((p) => setHasWv(!!p));
  }, []);
  const q = useWv<unknown>(hasWv && !account?.demo ? screen : null);
  const [action, setAction] = useState<ActionSpec | null>(null);
  if (!hasWv || account?.demo) return null;
  const run = (item: NextItem) => {
    const cmd = item.run ?? [];
    if (cmd[0] === "wv") setAction({ key: `next.${screen}.${cmd.slice(1, 3).join(".")}`, title: item.what, description: "wv shows the plan first; nothing runs until you approve it.", fields: [], build: () => cmd.slice(1) });
    else if (cmd.length) runInTerminal(cmd.join(" "));
  };
  return (
    <>
      <Panel title={title} query={q} onRun={runInTerminal}>
        <QueryBody q={q} onRun={runInTerminal}>
          {(d) => {
            const items = itemsOf(screen, d);
            if (!items.length) return <p className="workspace-muted">Nothing is waiting on you here.</p>;
            return (
              <ul className="next-items">
                {items.map((it, i) => (
                  <li key={i}>
                    <span>{it.what}</span>
                    {it.run && it.run.length > 0 && (
                      <Button size="1" variant={it.run[0] === "wv" ? "classic" : "soft"} onClick={() => run(it)}>
                        {it.run[0] === "wv" ? "Run with approval" : "Run in terminal"}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            );
          }}
        </QueryBody>
      </Panel>
      {action && <ActionEditor key={action.key} spec={action} onClose={() => setAction(null)} />}
    </>
  );
}
