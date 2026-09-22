// wv's gate as the app reads it: a write through wv answers with data (it ran, or it was a read), a plan to
// approve, a refusal, or a stale approval. Pure over the JSON wv returned, no imports, so the test scripts load
// it as is; `whop.ts` and the assistant run the commands.

/**
 * The gate as wv's pipe face reports it: `CONFIRMATION_REQUIRED` carries a plan and a `rerun` the app runs on
 * Approve; a refusal (`WHOP_LIMIT`, `WV_CAP`, `INSUFFICIENT_BALANCE`, `WV_AD_CAP`, `*_BLOCKED`) carries the plan
 * and no rerun. `APPROVAL_EXPIRED` and `APPROVAL_INVALID` mean a rerun went stale or was edited.
 */
export interface Gate {
  kind: "plan" | "refused" | "stale";
  code: string;
  message: string;
  hint?: string;
  plan?: Record<string, unknown>;
  rerun?: string[];
}

const REFUSALS = /^(WHOP_LIMIT|WV_CAP|INSUFFICIENT_BALANCE|WV_AD_CAP|[A-Z_]+_BLOCKED)$/;

/** Reads wv's envelope out of a tool result. Anything that is not the gate returns undefined. */
export function parseGate(output: string | undefined): Gate | undefined {
  if (!output) return undefined;
  // The Bash tool prefixes a failed command's output with an "Exit code N" line, and wv exits 2 on a plan
  // or a refusal, so the envelope starts at the first brace, not the first character.
  const text = output.trim().replace(/^Exit code \d+\s*/, "");
  if (!text.startsWith("{")) return undefined;
  let env: any;
  try {
    env = JSON.parse(text);
  } catch {
    return undefined;
  }
  const code = env?.error?.code;
  if (typeof code !== "string" || env.ok !== false) return undefined;
  const plan = env.plan && typeof env.plan === "object" ? (env.plan as Record<string, unknown>) : undefined;
  const rerun = Array.isArray(env.rerun) ? env.rerun.map(String) : undefined;
  const message = String(env.error.message ?? "");
  const hint = typeof env.error.hint === "string" ? env.error.hint : undefined;
  if (code === "CONFIRMATION_REQUIRED" && rerun) return { kind: "plan", code, message, hint, plan, rerun };
  if (code === "APPROVAL_EXPIRED" || code === "APPROVAL_INVALID") return { kind: "stale", code, message, hint, plan };
  if (REFUSALS.test(code)) return { kind: "refused", code, message, hint, plan };
  return undefined;
}


export type Gated<T> = { kind: "done"; data: T } | { kind: "gate"; gate: Gate };

/** Sorts wv's JSON answer: a gate envelope, or the data as it is. */
export function gatedResult<T>(value: unknown): Gated<T> {
  const gate = parseGate(typeof value === "string" ? value : JSON.stringify(value ?? null));
  if (gate) return { kind: "gate", gate };
  return { kind: "done", data: value as T };
}

/** wv's envelope after an approved rerun: `ok: false` with an error is a failure the person should read. */
export function rerunOutcome(stdout: string, code: number): { ok: boolean; data?: unknown; message?: string; code?: string } {
  const text = stdout.trim();
  if (!text.startsWith("{")) return code === 0 ? { ok: true, data: text } : { ok: false, message: text || `exit ${code}` };
  let env: any;
  try {
    env = JSON.parse(text);
  } catch {
    return { ok: code === 0, data: text };
  }
  if (env && typeof env === "object" && env.ok === false && env.error) return { ok: false, message: String(env.error.message ?? ""), code: String(env.error.code ?? "") };
  return { ok: true, data: env?.data ?? env };
}
