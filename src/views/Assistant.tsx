import { loadGenerations } from "../lib/studio-jobs";
import {
  ChatCreatives,
  type CreativeHandle,
} from "../components/ChatCreatives";
import { wantsCreative } from "../lib/chat-creatives";
import { invoke } from "@tauri-apps/api/core";
import {
  Badge,
  Button,
  Callout,
  Code,
  IconButton,
  SegmentedControl,
  Switch,
  Text,
  Tooltip,
  toast,
} from "frosted-ui";
import {
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  Cross2Icon,
  ExclamationTriangleIcon,
  ReloadIcon,
  StopIcon,
  ChatBubbleIcon,
  LockClosedIcon,
  LightningBoltIcon,
  BarChartIcon,
  PersonIcon,
  ArrowRightIcon,
} from "@radix-ui/react-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Markdown, JsonText } from "../components/Markdown";
import { PageHeader } from "../components/Panel";
import {
  claudeAvailable,
  startRun,
  syncDemoFixtures,
  SUGGESTIONS,
  type ChatMessage,
  type Conversation,
  type RunHandle,
  type ToolCall,
} from "../lib/assistant";
import { useAccount } from "../lib/whop";
import { Terminal } from "./Terminal";

const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
import {
  CHAT_OPEN,
  loadLibrary,
  newThread,
  saveLibrary,
  threadTitle,
  type ChatThread,
} from "../lib/conversations";
import type { ViewId } from "../components/Sidebar";

export function Assistant({
  seed,
  onSeedConsumed,
  chatSeed,
  onChatSeedConsumed,
  onNavigate,
}: {
  seed: string | null;
  onSeedConsumed: () => void;
  chatSeed?: string | null;
  onChatSeedConsumed?: () => void;
  onNavigate: (view: ViewId) => void;
}) {
  const { account } = useAccount();
  const acctKey = account?.id ?? "none";
  const [mode, setMode] = useState<"chat" | "raw">(() =>
    seed ? "raw" : "chat",
  );
  const [library, setLibrary] = useState(() => loadLibrary(acctKey));
  const activeId = library.activeId;
  const conv = library.threads.find((t) => t.id === activeId)!;
  const setConv = useCallback(
    (fn: Conversation | ((c: ChatThread) => Conversation)) =>
      setLibrary((l) => ({
        ...l,
        threads: l.threads.map((t) => {
          if (t.id !== activeId) return t;
          const next = typeof fn === "function" ? fn(t) : fn;
          return {
            ...t,
            ...next,
            title: threadTitle(next),
            updatedAt: Date.now(),
          };
        }),
      })),
    [activeId],
  );
  const creativeRef = useRef<CreativeHandle>(null);
  const [creativeMode, setCreativeMode] = useState(false);
  const input = conv.draft;
  const setInput = useCallback(
    (draft: string) =>
      setLibrary((l) => ({
        ...l,
        threads: l.threads.map((t) =>
          t.id === activeId ? { ...t, draft } : t,
        ),
      })),
    [activeId],
  );
  const [allowWrites, setAllowWrites] = useState(false);
  const [settings, setSettings] = useState(false);
  const [history, setHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [model, setModel] = useState("sonnet");
  const [storageError, setStorageError] = useState(false);
  const alive = useRef(true);
  const runRef = useRef<RunHandle | null>(null);
  const [run, setRun] = useState<RunHandle | null>(null);
  const sendingRef = useRef(false);
  const stoppedRef = useRef(false);
  const followRef = useRef(true);
  const busy = conv.messages.some((m) => m.streaming);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const checkConnection = useCallback(async () => {
    try {
      setConnectionError("");
      setConnected(await invoke<boolean>("claude_auth_status"));
    } catch (e) {
      setConnectionError(String(e));
      setConnected(false);
    }
  }, []);
  const connect = async () => {
    setConnecting(true);
    setConnectionError("");
    try {
      await invoke("claude_login");
      await checkConnection();
    } catch (e) {
      setConnectionError(String(e));
    } finally {
      setConnecting(false);
    }
  };
  const [claudePath, setClaudePath] = useState<string | null | undefined>(
    undefined,
  );
  const listRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    claudeAvailable().then((path) => {
      setClaudePath(path);
      if (path) void checkConnection();
    });
  }, []);
  useEffect(() => {
    try {
      saveLibrary(acctKey, library);
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [library, acctKey]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      void runRef.current?.stop().catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (seed) setMode("raw");
  }, [seed]);
  useEffect(() => {
    if (chatSeed) {
      setMode("chat");
      setInput(chatSeed);
      onChatSeedConsumed?.();
      setTimeout(() => taRef.current?.focus(), 0);
    }
  }, [chatSeed, onChatSeedConsumed]);
  useEffect(() => {
    if (account?.demo) syncDemoFixtures();
  }, [account?.demo]);
  useEffect(() => {
    if (followRef.current && listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [conv.messages]);

  const update = useCallback(
    (id: string, fn: (m: ChatMessage) => ChatMessage) => {
      if (!alive.current) return;
      setConv((c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === id ? fn(m) : m)),
      }));
    },
    [setConv],
  );

  const send = useCallback(
    async (text: string) => {
      const prompt = text.trim();
      if (
        prompt &&
        account &&
        !busy &&
        !sendingRef.current &&
        creativeRef.current?.prepare(prompt)
      )
        return;
      if (
        !prompt ||
        !account ||
        !claudePath ||
        !connected ||
        run ||
        sendingRef.current ||
        busy
      )
        return;
      sendingRef.current = true;
      stoppedRef.current = false;
      followRef.current = true;
      setInput("");
      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        blocks: [{ type: "text", text: prompt }],
        createdAt: Date.now(),
      };
      const asstId = uid();
      const asst: ChatMessage = {
        id: asstId,
        role: "assistant",
        blocks: [],
        createdAt: Date.now(),
        streaming: true,
      };
      setConv((c) => ({ ...c, messages: [...c.messages, userMsg, asst] }));

      const appendText = (t: string) =>
        update(asstId, (m) => {
          const last = m.blocks[m.blocks.length - 1];
          if (last && last.type === "text")
            return {
              ...m,
              blocks: [
                ...m.blocks.slice(0, -1),
                { type: "text", text: last.text + t },
              ],
            };
          return { ...m, blocks: [...m.blocks, { type: "text", text: t }] };
        });
      const patchTool = (id: string, fn: (c: ToolCall) => ToolCall) =>
        update(asstId, (m) => ({
          ...m,
          blocks: m.blocks.map((b) =>
            b.type === "tool" && b.call.id === id
              ? { type: "tool", call: fn(b.call) }
              : b,
          ),
        }));

      try {
        const handle = await startRun(
          {
            prompt: (() => {
              const creatives = loadGenerations().filter(g=>g.accountId===account.id && g.conversationId===activeId);
              if (!creatives.length) return prompt;
              return `${prompt}\n\nSaved creative context for this conversation (metadata only; do not claim to see the pixels): ${JSON.stringify(creatives.slice(-6).map(g=>({id:g.id,parentId:g.parentId,status:g.status,sample:g.sample,instruction:g.instruction,product:g.context?.productTitle,adDraftId:g.adDraftId})))}. Images and revisions must be created through Create image in the composer, which provides review and saved previews.`;
            })(),
            sessionId: conv.sessionId,
            accountId: account?.id,
            accountTitle: account?.title,
            demo: !!account?.demo,
            allowWrites,
            model,
          },
          {
            onSession: (sid) => {
              if (alive.current) setConv((c) => ({ ...c, sessionId: sid }));
            },
            onTextDelta: appendText,
            onToolStart: (call) =>
              update(asstId, (m) => ({
                ...m,
                blocks: [...m.blocks, { type: "tool", call }],
              })),
            onToolInput: (id, command, description) =>
              update(asstId, (m) => {
                const exists = m.blocks.some(
                  (b) => b.type === "tool" && b.call.id === id,
                );
                if (!exists)
                  return {
                    ...m,
                    blocks: [
                      ...m.blocks,
                      {
                        type: "tool",
                        call: {
                          id,
                          command,
                          description,
                          done: false,
                          startedAt: Date.now(),
                        },
                      },
                    ],
                  };
                return {
                  ...m,
                  blocks: m.blocks.map((b) =>
                    b.type === "tool" && b.call.id === id
                      ? {
                          type: "tool",
                          call: {
                            ...b.call,
                            command: command || b.call.command,
                            description: description ?? b.call.description,
                          },
                        }
                      : b,
                  ),
                };
              }),
            onToolResult: (id, output, isError) =>
              patchTool(id, (c) => ({
                ...c,
                output,
                isError,
                done: true,
                endedAt: Date.now(),
              })),
            onAssistantMessage: () => {},
            onResult: (meta) =>
              update(asstId, (m) => {
                let error = m.error;
                if (meta.isError) {
                  if (meta.subtype === "error_max_turns")
                    error = `Ran out of steps after ${meta.turns ?? "many"} tool calls without a final answer. Ask a narrower question, or say "continue".`;
                  else if (meta.subtype === "error_max_budget_usd")
                    error =
                      "Stopped: the spend limit for one reply was reached.";
                  else
                    error = meta.result ?? "The assistant returned an error.";
                }
                return {
                  ...m,
                  meta: {
                    model: meta.model,
                    costUsd: meta.costUsd,
                    durationMs: meta.durationMs,
                    turns: meta.turns,
                  },
                  error,
                };
              }),
          },
        );
        if (!alive.current) {
          await handle.stop();
          return;
        }
        runRef.current = handle;
        setRun(handle);
        const { code, stderr } = await handle.done;
        runRef.current = null;
        if (!alive.current) return;
        setRun(null);
        update(asstId, (m) => {
          const err = stoppedRef.current
            ? "Reply stopped. You can continue whenever you’re ready."
            : code !== 0
              ? m.error ||
                stderr.trim().split("\n").slice(-3).join("\n") ||
                `claude exited with code ${code}`
              : m.error;
          return {
            ...m,
            streaming: false,
            error: err,
            blocks: m.blocks.map((b) =>
              b.type === "tool" && !b.call.done
                ? {
                    type: "tool",
                    call: {
                      ...b.call,
                      done: true,
                      isError: true,
                      output: b.call.output ?? "(stopped)",
                    },
                  }
                : b,
            ),
          };
        });
      } catch (e) {
        runRef.current = null;
        if (!alive.current) return;
        setRun(null);
        update(asstId, (m) => ({ ...m, streaming: false, error: String(e) }));
      } finally {
        sendingRef.current = false;
      }
    },
    [
      run,
      busy,
      conv.sessionId,
      activeId,
      account,
      allowWrites,
      update,
      model,
      claudePath,
      connected,
      setConv,
      setInput,
    ],
  );

  const stop = async () => {
    stoppedRef.current = true;
    try {
      await run?.stop();
    } catch {
      toast.error("Could not stop the reply. Try again.");
    }
  };
  const reset = useCallback(() => {
    if (sendingRef.current) return;
    const t = newThread();
    setLibrary((l) => ({
      ...l,
      activeId: t.id,
      threads: [
        t,
        ...l.threads.filter((c) => c.messages.length || c.draft.trim()),
      ],
    }));
    setAllowWrites(false);
    setMode("chat");
    setHistory(false);
    setTimeout(() => taRef.current?.focus(), 0);
  }, []);
  useEffect(() => {
    const open = (event: Event) => {
      if (sendingRef.current) {
        toast("Stop the current reply before switching conversations.");
        return;
      }
      const id = (event as CustomEvent).detail?.id;
      if (id) {
        setLibrary((l) =>
          l.threads.some((t) => t.id === id) ? { ...l, activeId: id } : l,
        );
        setAllowWrites(false);
        setMode("chat");
      } else reset();
    };
    window.addEventListener(CHAT_OPEN, open);
    return () => window.removeEventListener(CHAT_OPEN, open);
  }, [reset]);

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  };

  const empty = conv.messages.length === 0;

  return (
    <div className="assistant-page">
      <header className="assistant-topbar">
        <div>
          <span className="assistant-top-label">Whop assistant</span>
          <h1>{empty ? "New conversation" : conv.title}</h1>
        </div>
        <div className="assistant-top-actions">
          <Button
            size="1"
            variant="ghost"
            color="gray"
            onClick={() => setHistory(!history)}
          >
            History
          </Button>
          <Button
            size="1"
            variant="ghost"
            color="gray"
            onClick={() => setSettings(!settings)}
          >
            Settings
          </Button>
          <Button size="1" variant="soft" onClick={reset} disabled={busy}>
            New chat
          </Button>
        </div>
      </header>
      {storageError && (
        <p role="alert" className="workspace-error">
          This conversation could not be saved on this Mac. Copy important
          replies before closing the app.
        </p>
      )}
      {history && (
        <section className="assistant-history">
          <div className="assistant-history-heading">
            <h2>Conversations</h2>
            <input
              aria-label="Search conversations"
              placeholder="Search conversations…"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
            />
          </div>
          <div className="assistant-history-list">
            {library.threads
              .filter((t) =>
                t.title.toLowerCase().includes(historySearch.toLowerCase()),
              )
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((t) => (
                <button
                  key={t.id}
                  disabled={busy}
                  aria-current={activeId === t.id ? "true" : undefined}
                  onClick={() => {
                    setLibrary((l) => ({ ...l, activeId: t.id }));
                    setAllowWrites(false);
                    setHistory(false);
                    setMode("chat");
                  }}
                >
                  <ChatBubbleIcon />
                  <span>{t.title}</span>
                  <small>
                    {new Date(t.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </small>
                </button>
              ))}
          </div>
        </section>
      )}
      {settings && (
        <section className="assistant-settings">
          <div>
            <strong>Assistant access</strong>
            <p>
              Reads your selected business. Enabling changes also requires
              confirmation in chat.
            </p>
          </div>
          <label className="switch-row">
            <Switch
              size="1"
              aria-label="Allow changes"
              disabled={busy}
              checked={allowWrites}
              onCheckedChange={setAllowWrites}
            />
            <Text size="1">Allow changes</Text>
          </label>
          <Button
            size="1"
            variant="soft"
            onClick={() => {
              setMode(mode === "chat" ? "raw" : "chat");
              setSettings(false);
            }}
          >
            {mode === "chat" ? "Open command line" : "Return to chat"}
          </Button>
        </section>
      )}

      {mode === "raw" ? (
        <Terminal seed={seed} onSeedConsumed={onSeedConsumed} embedded />
      ) : (
        <div className="chat">
          {(claudePath === null || (claudePath && connected === false)) && (
            <div className="assistant-connect">
              <div>
                <strong>
                  {claudePath
                    ? "Connect Claude to start chatting"
                    : "Set up your assistant"}
                </strong>
                <p>
                  {claudePath
                    ? "Sign in with your Claude account. Your conversation and draft will stay here."
                    : "Install Claude Code on this Mac, then connect your Claude account."}
                </p>
                {connectionError && <p role="alert">{connectionError}</p>}
              </div>
              {claudePath ? (
                <Button
                  size="1"
                  onClick={connect}
                  loading={connecting}
                  disabled={connecting}
                >
                  {connecting ? "Finish in browser…" : "Connect Claude"}
                </Button>
              ) : (
                <Button
                  size="1"
                  onClick={() =>
                    invoke("open_external", {
                      url: "https://claude.com/claude-code",
                    })
                  }
                >
                  Get Claude Code
                </Button>
              )}
              <Button
                size="1"
                variant="ghost"
                disabled={connecting}
                onClick={() =>
                  claudeAvailable().then((path) => {
                    setClaudePath(path);
                    if (path) void checkConnection();
                  })
                }
              >
                Check connection
              </Button>
            </div>
          )}
          <div
            className="chat-list"
            data-empty={empty}
            ref={listRef}
            onScroll={() => {
              const el = listRef.current;
              if (el)
                followRef.current =
                  el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
          >
            {empty ? (
              <div className="assistant-welcome">
                <span className="assistant-business">
                  <span className="live-dot" />
                  {account?.title ?? "Connecting your business…"}
                  {account?.demo ? " · Demo" : ""}
                </span>
                <h2>What should we work on?</h2>
                <p>
                  Understand your business. Build your next offer.
                  <br />
                  Decide what to do next, together.
                </p>
              </div>
            ) : (
              conv.messages.map((m, i) => (
                <Message
                  key={m.id}
                  m={m}
                  onNavigate={onNavigate}
                  onRetry={
                    !busy && m.error
                      ? () => {
                          const prev = conv.messages
                            .slice(0, i)
                            .reverse()
                            .find((x) => x.role === "user");
                          setInput(
                            prev?.blocks
                              .filter((b) => b.type === "text")
                              .map((b) => b.text)
                              .join("") ?? "Continue",
                          );
                          taRef.current?.focus();
                        }
                      : undefined
                  }
                />
              ))
            )}
            <ChatCreatives
              key={activeId}
              ref={creativeRef}
              threadId={activeId}
              onMode={setCreativeMode}
              onNavigate={onNavigate}
              onRevise={() => taRef.current?.focus()}
              onRecord={(text) => {
                setInput("");
                setConv((c) => ({
                  ...c,
                  messages: [
                    ...c.messages,
                    {
                      id: uid(),
                      role: "user",
                      blocks: [{ type: "text", text }],
                      createdAt: Date.now(),
                    },
                  ],
                }));
              }}
            />
          </div>
          <div className="chat-composer" data-busy={busy}>
            <textarea
              ref={taRef}
              className="chat-input"
              aria-label="Message Whop assistant"
              placeholder={
                busy
                  ? "Write your next message while I work…"
                  : creativeMode
                    ? "Describe your image or a revision…"
                    : "Ask anything about your Whop business…"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              rows={Math.min(
                6,
                Math.max(empty ? 3 : 2, input.split("\n").length),
              )}
              disabled={!account}
              autoFocus
            />
            <div className="chat-composer-bar">
              <div className="composer-context">
                <button
                  type="button"
                  className="creative-mode-button"
                  disabled={busy}
                  onClick={() => creativeRef.current?.activate()}
                >
                  Create image
                </button>
                <button type="button" className="creative-mode-button" disabled={busy} onClick={()=>creativeRef.current?.importImage()}>Import artwork</button>
                <span>
                  {account?.demo
                    ? "Demo business"
                    : (account?.title ?? "Connecting…")}
                </span>
                <span className="composer-divider" />
                <select
                  aria-label="Assistant model"
                  value={model}
                  disabled={busy}
                  onChange={(e) => setModel(e.target.value)}
                >
                  <option value="sonnet">Claude Sonnet</option>
                  <option value="opus">Claude Opus</option>
                </select>
                {allowWrites && (
                  <Badge size="1" color="amber">
                    Changes enabled
                  </Badge>
                )}
              </div>
              {busy ? (
                <Button
                  size="1"
                  variant="soft"
                  color="gray"
                  onClick={stop}
                  disabled={!run}
                >
                  <StopIcon /> Stop
                </Button>
              ) : (
                <Button
                  size="1"
                  variant="classic"
                  onClick={() => send(input)}
                  disabled={
                    !input.trim() ||
                    !account ||
                    (!(creativeMode || wantsCreative(input)) &&
                      (!claudePath || !connected))
                  }
                >
                  <ArrowUpIcon />{" "}
                  {creativeMode || wantsCreative(input)
                    ? "Review image"
                    : "Send"}
                </Button>
              )}
            </div>
          </div>
          <div className="chat-composer-note">
            <span>
              {busy
                ? "Working · you can explore your business pages"
                : creativeMode
                  ? "One image per request · review before generating"
                  : allowWrites
                  ? "Changes require confirmation in chat"
                  : connected
                    ? "Can read your business · changes are off"
                    : connected === null
                      ? "Checking Claude connection…"
                      : "Connect Claude to send · your draft is saved"}
            </span>
            <span>↵ Send · ⇧↵ New line</span>
          </div>
          {empty && (
            <div className="assistant-starters">
              {[
                {
                  title: "Catch me up",
                  description: "Revenue, members, and what needs attention",
                  prompt:
                    "Give me a concise business briefing: revenue this week, membership health, and the three most useful next steps.",
                  icon: BarChartIcon,
                },
                {
                  title: "Grow my business",
                  description: "Find the next opportunity",
                  prompt:
                    "Review my products and ad performance. What is the best growth opportunity, and what should I do next?",
                  icon: LightningBoltIcon,
                },
                {
                  title: "Take care of members",
                  description: "Spot issues before people leave",
                  prompt: SUGGESTIONS[1],
                  icon: PersonIcon,
                },
                {
                  title: "Build my next offer",
                  description: "Turn an idea into a launch plan",
                  prompt:
                    "Help me plan a new offer based on my current products. Start by reviewing what I sell, then ask me one useful question.",
                  icon: ChatBubbleIcon,
                },
              ].map(({ title, description, prompt, icon: Icon }) => (
                <button
                  key={title}
                  onClick={() => {
                    setInput(prompt);
                    taRef.current?.focus();
                  }}
                >
                  <Icon />
                  <span>
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </span>
                  <ArrowRightIcon />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Message({
  m,
  onNavigate,
  onRetry,
}: {
  m: ChatMessage;
  onNavigate: (view: ViewId) => void;
  onRetry?: () => void;
}) {
  if (m.role === "user") {
    return (
      <div className="msg msg-user">
        <div className="msg-bubble">
          <Text size="2">
            {m.blocks.map((b) => (b.type === "text" ? b.text : "")).join("")}
          </Text>
        </div>
      </div>
    );
  }
  const nothingYet = m.blocks.length === 0;
  return (
    <div className="msg msg-asst">
      <div className="msg-avatar">
        <span className="assistant-mark assistant-mark-small">
          <ChatBubbleIcon />
        </span>
      </div>
      <div className="msg-body">
        <div className="assistant-author">
          <Text size="2" weight="medium">
            Whop assistant
          </Text>
          <Text size="1" color="gray">
            {m.streaming ? "Working" : "Assistant"}
          </Text>
        </div>
        {nothingYet && m.streaming && (
          <div className="thinking" role="status">
            <span />
            <span />
            <span />
            <Text size="2" color="gray">
              Checking your business
            </Text>
          </div>
        )}
        {m.blocks.map((b, i) =>
          b.type === "text" ? (
            <Markdown key={i} text={b.text} />
          ) : (
            <ToolCard key={b.call.id} call={b.call} onNavigate={onNavigate} />
          ),
        )}
        {m.error && (
          <Callout.Root color="red" style={{ marginTop: 8 }}>
            <Callout.Icon>
              <Cross2Icon />
            </Callout.Icon>
            <Callout.Title>Assistant error</Callout.Title>
            <Callout.Description style={{ whiteSpace: "pre-wrap" }}>
              {m.error}
            </Callout.Description>
          </Callout.Root>
        )}
        {!m.streaming && (
          <div className="assistant-message-actions">
            <Button
              size="1"
              variant="ghost"
              color="gray"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    m.blocks
                      .filter((b) => b.type === "text")
                      .map((b) => b.text)
                      .join("\n\n"),
                  );
                  toast.success("Copied reply");
                } catch {
                  toast.error("Could not copy reply");
                }
              }}
            >
              <CopyIcon /> Copy
            </Button>
            {onRetry && (
              <Button size="1" variant="ghost" onClick={onRetry}>
                Edit and retry
              </Button>
            )}
            {m.meta && (
              <details>
                <summary>Reply details</summary>
                <span>
                  {[
                    m.meta.model,
                    m.meta.durationMs != null
                      ? `${(m.meta.durationMs / 1000).toFixed(1)}s`
                      : null,
                    m.meta.costUsd != null
                      ? `$${m.meta.costUsd.toFixed(3)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolCard({
  call,
  onNavigate,
}: {
  call: ToolCall;
  onNavigate: (view: ViewId) => void;
}) {
  const [open, setOpen] = useState(false);
  const destination = toolDestination(call.command);
  const activity =
    call.description ||
    (destination
      ? `Checking ${destination.label.toLowerCase()}`
      : "Working with Whop");
  const shown = call.output ?? "";
  const isWrite =
    /\b(create|delete|update|cancel|pause|resume|transfer|deploy|publish|unpublish|payouts create)\b/.test(
      call.command,
    );
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
    <div
      className="tool"
      data-running={!call.done}
      data-error={!!call.isError && !blocked}
      data-blocked={blocked}
    >
      <div className="tool-head">
        <button
          className="tool-toggle"
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? "Hide command output" : "Show command output"}
        >
          {open ? <ChevronDownIcon /> : <ChevronRightIcon />}
        </button>
        <span className="tool-activity" title={activity}>
          {activity}
        </span>
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
              <CheckIcon />{" "}
              {call.endedAt && call.startedAt
                ? `${Math.max(1, Math.round((call.endedAt - call.startedAt) / 100) / 10)}s`
                : "done"}
            </Text>
          )}
        </span>
        <IconButton
          size="1"
          variant="ghost"
          color="gray"
          onClick={copy}
          aria-label="Copy command"
        >
          <CopyIcon />
        </IconButton>
      </div>
      {open && (
        <div className="tool-inspection">
          <code>{call.command || "Preparing command…"}</code>
          {call.output && (
            <pre className="tool-out">
              <JsonText text={shown} />
            </pre>
          )}
        </div>
      )}
      {call.done && (
        <div className="tool-result-footer">
          <span>
            {blocked
              ? "Changes are off"
              : call.isError
                ? "Could not complete this step"
                : "Checked business data"}
          </span>
          {destination && (
            <button onClick={() => onNavigate(destination.view)}>
              Open {destination.label} <ArrowRightIcon />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function toolDestination(
  command: string,
): { view: ViewId; label: string } | null {
  const group = /\bwhop\s+([a-z-]+)/.exec(command)?.[1];
  const routes: Record<string, { view: ViewId; label: string }> = {
    stats: { view: "overview", label: "Overview" },
    ledgers: { view: "money", label: "Money" },
    payouts: { view: "money", label: "Money" },
    disputes: { view: "money", label: "Money" },
    memberships: { view: "members", label: "Members" },
    members: { view: "members", label: "Members" },
    products: { view: "products", label: "Products" },
    plans: { view: "products", label: "Products" },
    people: { view: "people", label: "People" },
    "ad-campaigns": { view: "ads", label: "Ads" },
    "ad-groups": { view: "ads", label: "Ads" },
    ads: { view: "ads", label: "Ads" },
    bounties: { view: "growth", label: "Growth" },
    apps: { view: "apps", label: "Apps" },
  };
  return group ? (routes[group] ?? null) : null;
}
