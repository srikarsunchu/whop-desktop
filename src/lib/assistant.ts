// Client for the Claude Code-backed assistant. Parses the CLI's stream-json
// events into a small message model the Assistant view renders.
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { demoResolve } from "./demo";

export interface ToolCall {
  id: string;
  command: string; // the shell command Claude ran
  description?: string;
  output?: string;
  isError?: boolean;
  done: boolean;
  startedAt: number;
  endedAt?: number;
}

export type Block = { type: "text"; text: string } | { type: "tool"; call: ToolCall };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  blocks: Block[];
  createdAt: number;
  streaming?: boolean;
  error?: string;
  meta?: { model?: string; costUsd?: number; durationMs?: number; turns?: number };
}

export interface Conversation {
  sessionId: string | null;
  messages: ChatMessage[];
}

export interface StartOpts {
  prompt: string;
  sessionId: string | null;
  accountId?: string;
  accountTitle?: string;
  demo: boolean;
  allowWrites: boolean;
  model?: string;
}

export interface RunHandle {
  runId: string;
  stop: () => Promise<void>;
  done: Promise<{ code: number; stderr: string }>;
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** Parsed event callbacks. */
export interface Sink {
  onSession: (sessionId: string) => void;
  onTextDelta: (text: string) => void;
  onToolStart: (call: ToolCall) => void;
  onToolInput: (id: string, command: string, description?: string) => void;
  onToolResult: (id: string, output: string, isError: boolean) => void;
  onAssistantMessage: () => void; // a full assistant message was emitted (turn boundary)
  onResult: (meta: ChatMessage["meta"] & { isError?: boolean; result?: string; subtype?: string }) => void;
}

/** Feeds one stream-json line into the sink. Exported for tests and the demo path. */
export function handleLine(line: string, sink: Sink, partialInputs: Map<string, string>) {
  let ev: any;
  try {
    ev = JSON.parse(line);
  } catch {
    return;
  }
  switch (ev.type) {
    case "system":
      if (ev.subtype === "init" && ev.session_id) sink.onSession(ev.session_id);
      break;
    case "stream_event": {
      const e = ev.event;
      if (!e) break;
      if (e.type === "content_block_start" && e.content_block?.type === "tool_use") {
        partialInputs.set(e.content_block.id, "");
        sink.onToolStart({ id: e.content_block.id, command: "", done: false, startedAt: Date.now() });
      } else if (e.type === "content_block_delta") {
        const d = e.delta;
        if (d?.type === "text_delta" && d.text) sink.onTextDelta(d.text);
        else if (d?.type === "input_json_delta") {
          // Attribute the delta to the most recently started, still-open tool.
          const ids = [...partialInputs.keys()];
          const id = ids[ids.length - 1];
          if (id) {
            const acc = (partialInputs.get(id) ?? "") + (d.partial_json ?? "");
            partialInputs.set(id, acc);
            const cmd = /"command"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(acc)?.[1];
            if (cmd) sink.onToolInput(id, JSON.parse(`"${cmd}"`));
          }
        }
      }
      break;
    }
    case "assistant": {
      const content = ev.message?.content ?? [];
      for (const c of content) {
        if (c.type === "tool_use") {
          const input = c.input ?? {};
          sink.onToolInput(c.id, String(input.command ?? ""), input.description);
          partialInputs.delete(c.id);
        }
      }
      sink.onAssistantMessage();
      break;
    }
    case "user": {
      const content = ev.message?.content ?? [];
      for (const c of content) {
        if (c.type === "tool_result") {
          const out = Array.isArray(c.content) ? c.content.map((x: any) => (typeof x === "string" ? x : x.text ?? "")).join("\n") : String(c.content ?? "");
          sink.onToolResult(c.tool_use_id, out, !!c.is_error);
        }
      }
      break;
    }
    case "result":
      sink.onResult({
        model: ev.model ?? ev.modelUsage ? Object.keys(ev.modelUsage ?? {})[0] : undefined,
        costUsd: typeof ev.total_cost_usd === "number" ? ev.total_cost_usd : undefined,
        durationMs: ev.duration_ms,
        turns: ev.num_turns,
        isError: !!ev.is_error,
        result: typeof ev.result === "string" ? ev.result : undefined,
        subtype: typeof ev.subtype === "string" ? ev.subtype : undefined,
      });
      break;
  }
}

export async function claudeAvailable(): Promise<string | null> {
  try {
    return await invoke<string | null>("claude_binary_path");
  } catch {
    return null;
  }
}

/** Builds the demo fixtures map the shim serves to Claude in demo mode. */
export function buildDemoFixtures(): Record<string, unknown> {
  const keys = [
    ["products list"],
    ["memberships list"],
    ["memberships list --status active", ["memberships", "list", "--status", "active"]],
    ["memberships list --status past_due", ["memberships", "list", "--status", "past_due"]],
    ["memberships list --status canceled", ["memberships", "list", "--status", "canceled"]],
    ["memberships list --status trialing", ["memberships", "list", "--status", "trialing"]],
    ["memberships list --status canceling", ["memberships", "list", "--status", "canceling"]],
    ["memberships list --status paused", ["memberships", "list", "--status", "paused"]],
    ["members list"],
    ["ledgers list"],
    ["ledgers report balance_summary", ["ledgers", "report", "--report_type", "balance_summary"]],
    ["ledgers report income_statement", ["ledgers", "report", "--report_type", "income_statement"]],
    ["ledgers report", ["ledgers", "report", "--report_type", "balance_summary"]],
    ["payouts list"],
    ["people list"],
    ["apps list"],
    ["recommended-actions list"],
    ["disputes list"],
    ["accounts get"],
    ["auth status"],
    ["stats get net_revenue", ["stats", "get", "net_revenue"]],
    ["stats get gross_revenue", ["stats", "get", "gross_revenue"]],
    ["stats get new_memberships", ["stats", "get", "new_memberships"]],
    ["stats get active_memberships", ["stats", "get", "active_memberships"]],
    ["stats get paid_active_members", ["stats", "get", "paid_active_members"]],
    ["stats get new_users", ["stats", "get", "new_users"]],
    ["stats get account_balance", ["stats", "get", "account_balance"]],
    ["stats get visitors", ["stats", "get", "visitors"]],
    ["stats get", ["stats", "get", "net_revenue"]],
  ] as const;
  const out: Record<string, unknown> = {};
  for (const [key, args] of keys) {
    try {
      out[key] = demoResolve(args ? [...args] : key.split(" "));
    } catch {
      /* skip */
    }
  }
  out["stats list"] = {
    data: ["net_revenue", "gross_revenue", "new_memberships", "active_memberships", "paid_active_members", "new_users", "account_balance", "visitors"].map((key) => ({ key, name: key.replace(/_/g, " "), unit: key.includes("revenue") || key.includes("balance") ? "currency" : "count" })),
  };
  return out;
}

export async function syncDemoFixtures() {
  try {
    await invoke("write_demo_fixtures", { json: JSON.stringify(buildDemoFixtures()) });
  } catch {
    /* not in tauri */
  }
}

/** Starts a run and streams events into the sink. */
export async function startRun(opts: StartOpts, sink: Sink): Promise<RunHandle> {
  const runId = uid();
  const partial = new Map<string, string>();
  let resolveDone!: (v: { code: number; stderr: string }) => void;
  const done = new Promise<{ code: number; stderr: string }>((r) => (resolveDone = r));
  const unlisteners: UnlistenFn[] = [];
  unlisteners.push(
    await listen<{ run_id: string; line: string }>("assistant:line", (e) => {
      if (e.payload.run_id !== runId) return;
      handleLine(e.payload.line, sink, partial);
    }),
  );
  unlisteners.push(
    await listen<{ run_id: string; code: number; stderr: string }>("assistant:done", (e) => {
      if (e.payload.run_id !== runId) return;
      unlisteners.forEach((u) => u());
      resolveDone({ code: e.payload.code, stderr: e.payload.stderr });
    }),
  );
  try {
    await invoke("assistant_start", {
      args: {
        run_id: runId,
        prompt: opts.prompt,
        session_id: opts.sessionId,
        account_id: opts.accountId ?? null,
        account_title: opts.accountTitle ?? null,
        demo: opts.demo,
        allow_writes: opts.allowWrites,
        model: opts.model ?? null,
      },
    });
  } catch (e) {
    unlisteners.forEach((u) => u());
    throw e;
  }
  return {
    runId,
    done,
    stop: () => invoke("assistant_stop", { runId }).then(() => undefined),
  };
}

export const SUGGESTIONS = [
  "How did revenue do this week versus last?",
  "Who is past due and how much is at risk?",
  "Which product has the most members, and what does it earn?",
  "Summarize my balance and when the next payout lands",
  "List members who joined in the last 7 days",
  "Draft a win-back message for members who canceled this month",
];
