import { Badge, Button, Callout, Code, IconButton, Kbd, SegmentedControl, Switch, Text, Tooltip, toast } from "frosted-ui";
import { ArrowUpIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, CopyIcon, Cross2Icon, ExclamationTriangleIcon, ReloadIcon, StopIcon } from "@radix-ui/react-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Markdown, JsonText } from "../components/Markdown";
import { PageHeader } from "../components/Panel";
import { BizAvatar } from "../components/BizAvatar";
import { claudeAvailable, startRun, syncDemoFixtures, SUGGESTIONS, type ChatMessage, type Conversation, type RunHandle, type ToolCall } from "../lib/assistant";
import { useAccount } from "../lib/whop";
import { Terminal } from "./Terminal";

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const LS = (id: string) => `whopdesktop.chat.${id}`;
const LS_WRITES = "whopdesktop.chat.allowWrites";

function load(id: string): Conversation {
  try {
    const raw = localStorage.getItem(LS(id));
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { sessionId: null, messages: [] };
}

export function Assistant({ seed, onSeedConsumed }: { seed: string | null; onSeedConsumed: () => void }) {
  const { account } = useAccount();
  const acctKey = account?.id ?? "none";
  const [mode, setMode] = useState<"chat" | "raw">(() => (seed ? "raw" : "chat"));
  const [conv, setConv] = useState<Conversation>(() => load(acctKey));
  const [input, setInput] = useState("");
  const [allowWrites, setAllowWrites] = useState(() => localStorage.getItem(LS_WRITES) === "1");
  const [run, setRun] = useState<RunHandle | null>(null);
  const [claudePath, setClaudePath] = useState<string | null | undefined>(undefined);
  const listRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    claudeAvailable().then(setClaudePath);
  }, []);
  useEffect(() => {
    setConv(load(acctKey));
  }, [acctKey]);
  useEffect(() => {
    localStorage.setItem(LS(acctKey), JSON.stringify(conv));
  }, [conv, acctKey]);
  useEffect(() => {
    localStorage.setItem(LS_WRITES, allowWrites ? "1" : "0");
  }, [allowWrites]);
  useEffect(() => {
    if (seed) setMode("raw");
  }, [seed]);
  useEffect(() => {
    if (account?.demo) syncDemoFixtures();
  }, [account?.demo]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [conv.messages]);

  const update = useCallback((id: string, fn: (m: ChatMessage) => ChatMessage) => {
    setConv((c) => ({ ...c, messages: c.messages.map((m) => (m.id === id ? fn(m) : m)) }));
  }, []);

  const send = useCallback(
    async (text: string) => {
      const prompt = text.trim();
      if (!prompt || run) return;
      setInput("");
      const userMsg: ChatMessage = { id: uid(), role: "user", blocks: [{ type: "text", text: prompt }], createdAt: Date.now() };
      const asstId = uid();
      const asst: ChatMessage = { id: asstId, role: "assistant", blocks: [], createdAt: Date.now(), streaming: true };
      setConv((c) => ({ ...c, messages: [...c.messages, userMsg, asst] }));

      const appendText = (t: string) =>
        update(asstId, (m) => {
          const last = m.blocks[m.blocks.length - 1];
          if (last && last.type === "text") return { ...m, blocks: [...m.blocks.slice(0, -1), { type: "text", text: last.text + t }] };
          return { ...m, blocks: [...m.blocks, { type: "text", text: t }] };
        });
      const patchTool = (id: string, fn: (c: ToolCall) => ToolCall) =>
        update(asstId, (m) => ({ ...m, blocks: m.blocks.map((b) => (b.type === "tool" && b.call.id === id ? { type: "tool", call: fn(b.call) } : b)) }));

      try {
        const handle = await startRun(
          {
            prompt,
            sessionId: conv.sessionId,
            accountId: account?.id,
            accountTitle: account?.title,
            demo: !!account?.demo,
            allowWrites,
          },
          {
            onSession: (sid) => setConv((c) => ({ ...c, sessionId: sid })),
            onTextDelta: appendText,
            onToolStart: (call) => update(asstId, (m) => ({ ...m, blocks: [...m.blocks, { type: "tool", call }] })),
            onToolInput: (id, command, description) =>
              update(asstId, (m) => {
                const exists = m.blocks.some((b) => b.type === "tool" && b.call.id === id);
                if (!exists) return { ...m, blocks: [...m.blocks, { type: "tool", call: { id, command, description, done: false, startedAt: Date.now() } }] };
                return { ...m, blocks: m.blocks.map((b) => (b.type === "tool" && b.call.id === id ? { type: "tool", call: { ...b.call, command: command || b.call.command, description: description ?? b.call.description } } : b)) };
              }),
            onToolResult: (id, output, isError) => patchTool(id, (c) => ({ ...c, output, isError, done: true, endedAt: Date.now() })),
            onAssistantMessage: () => {},
            onResult: (meta) =>
              update(asstId, (m) => {
                let error = m.error;
                if (meta.isError) {
                  if (meta.subtype === "error_max_turns") error = `Ran out of steps after ${meta.turns ?? "many"} tool calls without a final answer. Ask a narrower question, or say "continue".`;
                  else if (meta.subtype === "error_max_budget_usd") error = "Stopped: the spend limit for one reply was reached.";
                  else error = meta.result ?? "The assistant returned an error.";
                }
                return { ...m, meta: { model: meta.model, costUsd: meta.costUsd, durationMs: meta.durationMs, turns: meta.turns }, error };
              }),
          },
        );
        setRun(handle);
        const { code, stderr } = await handle.done;
        setRun(null);
        update(asstId, (m) => {
          const hasText = m.blocks.some((b) => b.type === "text" && b.text.trim());
          const err = code !== 0 && !hasText ? (stderr.trim().split("\n").slice(-3).join("\n") || `claude exited with code ${code}`) : m.error;
          return { ...m, streaming: false, error: err, blocks: m.blocks.map((b) => (b.type === "tool" && !b.call.done ? { type: "tool", call: { ...b.call, done: true, isError: true, output: b.call.output ?? "(stopped)" } } : b)) };
        });
      } catch (e) {
        setRun(null);
        update(asstId, (m) => ({ ...m, streaming: false, error: String(e) }));
      }
    },
    [run, conv.sessionId, account, allowWrites, update],
  );

  const stop = async () => {
    await run?.stop();
  };
  const reset = () => {
    setConv({ sessionId: null, messages: [] });
    toast("New conversation");
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const empty = conv.messages.length === 0;
  const lastCost = useMemo(() => [...conv.messages].reverse().find((m) => m.meta?.costUsd != null)?.meta?.costUsd, [conv.messages]);

  return (
    <div className="stack" style={{ height: "100%" }}>
      <PageHeader
        title="Assistant"
        subtitle={mode === "chat" ? (account?.demo ? "Claude, operating the demo business through the whop CLI." : `Claude, operating ${account?.title ?? "your business"} through the whop CLI.`) : "Raw whop CLI. Every command hits production."}
        actions={
          <>
            {mode === "chat" && (
              <Tooltip content={allowWrites ? "Claude may run commands that change data after you confirm in chat" : "Commands that change data are blocked"}>
                <label className="switch-row">
                  <Switch size="1" checked={allowWrites} onCheckedChange={(v: boolean) => setAllowWrites(v)} color={allowWrites ? "amber" : undefined} />
                  <Text size="1" color={allowWrites ? "amber" : "gray"}>
                    Allow writes
                  </Text>
                </label>
              </Tooltip>
            )}
            <SegmentedControl.Root value={mode} onValueChange={(v: string) => setMode(v as "chat" | "raw")}>
              <SegmentedControl.List>
                <SegmentedControl.Trigger value="chat">Chat</SegmentedControl.Trigger>
                <SegmentedControl.Trigger value="raw">Raw CLI</SegmentedControl.Trigger>
              </SegmentedControl.List>
            </SegmentedControl.Root>
            {mode === "chat" && (
              <Tooltip content="New conversation">
                <IconButton size="1" variant="ghost" color="gray" onClick={reset} aria-label="New conversation">
                  <ReloadIcon />
                </IconButton>
              </Tooltip>
            )}
          </>
        }
      />

      {mode === "raw" ? (
        <Terminal seed={seed} onSeedConsumed={onSeedConsumed} embedded />
      ) : (
        <div className="chat">
          {claudePath === null && (
            <Callout.Root color="amber">
              <Callout.Icon>
                <ExclamationTriangleIcon />
              </Callout.Icon>
              <Callout.Title>Claude Code CLI not found</Callout.Title>
              <Callout.Description>
                The assistant runs the <Code size="1">claude</Code> command on your Mac. Install it with <Code size="1">npm i -g @anthropic-ai/claude-code</Code> (or from claude.com/claude-code), run <Code size="1">claude</Code> once to sign in, then come back.
              </Callout.Description>
            </Callout.Root>
          )}
          <div className="chat-list" ref={listRef}>
            {empty ? (
              <div className="chat-empty">
                <BizAvatar account={account} size="2" />
                <Text size="4" weight="medium" style={{ display: "block", marginTop: 12 }}>
                  What do you want to know about {account?.title ?? "your business"}?
                </Text>
                <Text size="2" color="gray" style={{ display: "block", marginTop: 4, maxWidth: 520 }}>
                  Claude reads your Whop through the CLI and shows every command it runs. Writes stay blocked until you allow them.
                </Text>
                <div className="chat-suggestions">
                  {SUGGESTIONS.map((s) => (
                    <Button key={s} size="1" variant="surface" color="gray" onClick={() => send(s)}>
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              conv.messages.map((m) => <Message key={m.id} m={m} account={account} />)
            )}
          </div>
          <div className="chat-composer">
            <textarea
              ref={taRef}
              className="chat-input"
              placeholder={run ? "Claude is working…" : "Ask about revenue, members, products, payouts… (↵ to send, ⇧↵ for a new line)"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              rows={Math.min(6, Math.max(1, input.split("\n").length))}
              disabled={claudePath === null}
              autoFocus
            />
            <div className="chat-composer-bar">
              <Text size="1" color="gray">
                {run ? "running whop commands as needed" : lastCost != null ? `last reply $${lastCost.toFixed(3)} · session kept` : conv.sessionId ? "session kept" : "new session"}
                {allowWrites && (
                  <>
                    {" · "}
                    <Badge size="1" color="amber" variant="soft">
                      writes on
                    </Badge>
                  </>
                )}
              </Text>
              {run ? (
                <Button size="1" variant="soft" color="gray" onClick={stop}>
                  <StopIcon /> Stop
                </Button>
              ) : (
                <Button size="1" variant="classic" onClick={() => send(input)} disabled={!input.trim() || claudePath === null}>
                  <ArrowUpIcon /> Send <Kbd size="1">↵</Kbd>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Message({ m, account }: { m: ChatMessage; account: ReturnType<typeof useAccount>["account"] }) {
  if (m.role === "user") {
    return (
      <div className="msg msg-user">
        <div className="msg-bubble">
          <Text size="2">{m.blocks.map((b) => (b.type === "text" ? b.text : "")).join("")}</Text>
        </div>
      </div>
    );
  }
  const nothingYet = m.blocks.length === 0;
  return (
    <div className="msg msg-asst">
      <div className="msg-avatar">
        <BizAvatar account={account} size="1" />
      </div>
      <div className="msg-body">
        {nothingYet && m.streaming && (
          <Text size="2" color="gray">
            Thinking…
          </Text>
        )}
        {m.blocks.map((b, i) => (b.type === "text" ? <Markdown key={i} text={b.text} /> : <ToolCard key={b.call.id} call={b.call} />))}
        {m.error && (
          <Callout.Root color="red" style={{ marginTop: 8 }}>
            <Callout.Icon>
              <Cross2Icon />
            </Callout.Icon>
            <Callout.Title>Assistant error</Callout.Title>
            <Callout.Description style={{ whiteSpace: "pre-wrap" }}>{m.error}</Callout.Description>
          </Callout.Root>
        )}
        {!m.streaming && m.meta && (
          <Text size="0" color="gray" className="msg-meta">
            {[m.meta.model, m.meta.turns != null ? `${m.meta.turns} turn${m.meta.turns === 1 ? "" : "s"}` : null, m.meta.durationMs != null ? `${(m.meta.durationMs / 1000).toFixed(1)}s` : null, m.meta.costUsd != null ? `$${m.meta.costUsd.toFixed(3)}` : null].filter(Boolean).join(" · ")}
          </Text>
        )}
      </div>
    </div>
  );
}

function ToolCard({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  const lines = (call.output ?? "").split("\n");
  const long = lines.length > 14 || (call.output ?? "").length > 1500;
  const shown = open || !long ? call.output ?? "" : lines.slice(0, 12).join("\n") + "\n…";
  const isWrite = /\b(create|delete|update|cancel|pause|resume|transfer|deploy|publish|unpublish|payouts create)\b/.test(call.command);
  const blocked = /WRITE_BLOCKED/.test(call.output ?? "");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(call.command);
      toast.success("Copied command");
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="tool" data-error={!!call.isError && !blocked} data-blocked={blocked}>
      <div className="tool-head">
        <button className="tool-toggle" type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? <ChevronDownIcon /> : <ChevronRightIcon />}
        </button>
        <Code variant="ghost" size="1" color="gray" className="tool-cmd" title={call.command}>
          $ {call.command || "…"}
        </Code>
        {isWrite && (
          <Badge size="1" color="amber" variant="soft">
            write
          </Badge>
        )}
        <span className="tool-status">
          {!call.done ? (
            <Text size="0" color="gray">
              running…
            </Text>
          ) : blocked ? (
            <Badge size="1" color="amber" variant="soft">
              blocked
            </Badge>
          ) : call.isError ? (
            <Badge size="1" color="red" variant="soft">
              error
            </Badge>
          ) : (
            <Text size="0" color="gray" className="tool-ok">
              <CheckIcon /> {call.endedAt && call.startedAt ? `${Math.max(1, Math.round((call.endedAt - call.startedAt) / 100) / 10)}s` : "done"}
            </Text>
          )}
        </span>
        <IconButton size="1" variant="ghost" color="gray" onClick={copy} aria-label="Copy command">
          <CopyIcon />
        </IconButton>
      </div>
      {call.done && call.output && (open || !long) && (
        <pre className="tool-out">
          <JsonText text={shown} />
        </pre>
      )}
      {call.done && call.output && long && !open && (
        <button className="tool-more" type="button" onClick={() => setOpen(true)}>
          Show {lines.length} lines
        </button>
      )}
    </div>
  );
}
