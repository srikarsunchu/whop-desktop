// The plan a write came back with, from wv's gate, and the two buttons that answer it. A plan that moves money
// asks for the amount typed back, the same rule as wv's terminal prompt. A refusal shows Whop's reason and no
// button. Pure over the `Gate` shape; the caller runs the rerun.
import { Badge, Button, Text, TextField } from "frosted-ui";
import { useState } from "react";
import type { Gate } from "../lib/gate";

type Rec = Record<string, unknown>;
const isObj = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);

function money(amount: number | undefined, currency = "usd"): string {
  if (amount === undefined) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** The amount the person has to type back, if the plan moves money: `typedAmount` on a recipe, `money` on a write. */
export function typedAmountOf(plan: Rec | undefined): { amount: number; currency: string } | undefined {
  if (!plan) return undefined;
  const typed = isObj(plan.typedAmount) ? plan.typedAmount : isObj(plan.money) ? plan.money : undefined;
  const amount = num(typed?.amount);
  if (amount === undefined || amount <= 0) return undefined;
  return { amount, currency: str(typed?.currency) ?? "usd" };
}

/** The rows a plan is summarised by, in the order wv's card shows them. */
export function planRows(plan: Rec | undefined): [string, string][] {
  if (!plan) return [];
  const rows: [string, string][] = [];
  const acct = isObj(plan.account) ? plan.account : undefined;
  if (str(plan.command)) rows.push(["command", String(plan.command)]);
  const m = isObj(plan.money) ? plan.money : undefined;
  if (m && num(m.amount) !== undefined) rows.push(["amount", money(num(m.amount), str(m.currency) ?? "usd")]);
  const b = isObj(plan.balance) ? plan.balance : undefined;
  if (b && num(b.available) !== undefined) rows.push(["balance", `${money(num(b.available), str(b.currency) ?? "usd")} available`]);
  const l = isObj(plan.limit) ? plan.limit : undefined;
  if (l) rows.push(["Whop's limit", str(l.code) ? `blocked · ${str(l.message) ?? l.code}` : `${money(num(l.max), str(b?.currency) ?? "usd")} per ${str(l.speed) ?? "standard"} payout`]);
  if (num(plan.cap) !== undefined) rows.push(["wv cap", money(num(plan.cap), str(b?.currency) ?? "usd")]);
  else if (plan.cap === null) rows.push(["wv cap", "off"]);
  const show = (v: unknown) => (v === undefined || v === null || v === "" ? "—" : isObj(v) || Array.isArray(v) ? JSON.stringify(v) : String(v));
  if (Array.isArray(plan.changes)) for (const c of plan.changes as Rec[]) if (isObj(c) && str(c.key) && c.changed !== false) rows.push([String(c.key), `${show(c.before)} → ${show(c.after)}`]);
  else if (isObj(plan.changes)) for (const [k, v] of Object.entries(plan.changes)) rows.push([k, isObj(v) ? `${show(v.before)} → ${show(v.after)}` : show(v)]);
  if (isObj(plan.quote) && num((plan.quote as Rec).rate) !== undefined) rows.push(["rate", `${num((plan.quote as Rec).rate)} · fee ${num((plan.quote as Rec).feeBps) ?? 0} bps`]);
  if (isObj(plan.after)) rows.push(["after", Object.entries(plan.after as Rec).map(([k, v]) => `${k} ${v === undefined || v === null ? "unknown" : String(v)}`).join(" · ")]);
  if (acct && (str(acct.title) || str(acct.id))) rows.push(["from", [str(acct.title), str(acct.id)].filter(Boolean).join("  ")]);
  return rows;
}

export function PlanCard({ gate, result, demo, onApprove, onDecline }: { gate: Gate; result?: { approved: boolean; output?: string; code?: number }; demo?: boolean; onApprove: () => Promise<void>; onDecline: () => void }) {
  const plan = gate.plan;
  const typed = gate.kind === "plan" ? typedAmountOf(plan) : undefined;
  const [entered, setEntered] = useState("");
  const [running, setRunning] = useState(false);
  const rows = planRows(plan);
  const steps = plan && Array.isArray(plan.steps) ? (plan.steps as Rec[]) : [];
  const blockers = plan && Array.isArray(plan.blockers) ? (plan.blockers as string[]) : [];
  const warnings = plan && Array.isArray(plan.warnings) ? (plan.warnings as string[]) : [];
  const shown = typed ? typed.amount.toFixed(2).replace(/\.00$/, "") : "";
  const matches = !typed || entered.trim().replace(/^[^\d]+/, "").replace(/,/g, "") === shown || Number(entered.trim().replace(/[^\d.]/g, "")) === typed.amount;
  const mode = plan && str(plan.mode) === "sandbox" ? "sandbox" : "production";
  return (
    <div className="plan" data-kind={gate.kind} data-answered={!!result}>
      <div className="plan-head">
        <Text size="2" weight="medium">
          {gate.kind === "plan" ? "Plan" : gate.kind === "stale" ? "Approval expired" : "Refused"}
        </Text>
        <Badge size="1" color={demo || mode === "sandbox" ? "green" : "amber"} variant="soft">
          {demo ? "demo · nothing real changes" : mode === "sandbox" ? "sandbox" : "writes to production"}
        </Badge>
      </div>
      {rows.length > 0 && (
        <dl className="plan-rows">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {steps.length > 0 && (
        <ol className="plan-steps">
          {steps.map((s, i) => (
            <li key={String(s.key ?? i)}>
              <span>{str(s.label) ?? String(s.key ?? i + 1)}</span> {str(s.what) ?? ""}
              {str(s.skipped) && <em> · skipped: {String(s.skipped)}</em>}
            </li>
          ))}
        </ol>
      )}
      {blockers.map((b) => (
        <div key={b}>
          <Text size="1" color="red">
            ✗ {b}
          </Text>
        </div>
      ))}
      {warnings.map((w) => (
        <div key={w}>
          <Text size="1" color="amber">
            ! {w}
          </Text>
        </div>
      ))}
      {gate.kind !== "plan" && (
        <div>
          <Text size="1" color={gate.kind === "refused" ? "red" : "amber"}>
            {gate.message}
          </Text>
        </div>
      )}
      {gate.kind === "plan" && !result && (
        <div className="plan-actions">
          {typed && (
            <TextField.Root size="1" variant="surface">
              <TextField.Input placeholder={`Type ${shown} to approve`} value={entered} onChange={(e) => setEntered(e.target.value)} aria-label={`Type ${money(typed.amount, typed.currency)} to approve`} autoComplete="off" spellCheck={false} />
            </TextField.Root>
          )}
          <Button
            size="1"
            color="amber"
            disabled={running || !matches || (!!typed && !entered.trim())}
            onClick={async () => {
              setRunning(true);
              try {
                await onApprove();
              } finally {
                setRunning(false);
              }
            }}
          >
            {running ? "Running…" : typed ? `Approve ${money(typed.amount, typed.currency)}` : "Approve"}
          </Button>
          <Button size="1" variant="soft" color="gray" disabled={running} onClick={onDecline}>
            Decline
          </Button>
        </div>
      )}
      {result && (
        <div className="plan-result" data-approved={result.approved}>
          <Text size="1" color={result.approved ? (result.code === 0 ? "green" : "red") : "gray"}>
            {result.approved ? (result.code === 0 ? "Ran." : `Did not complete (exit ${result.code}).`) : "Declined. Nothing ran."}
          </Text>
          {result.output && (
            <pre className="tool-out">
              <code>{result.output.slice(0, 4000)}</code>
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
