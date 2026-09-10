import { Button, Card, Kbd, Text, TextField } from "frosted-ui";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "../components/Panel";
import { runWhopRaw, useAccount } from "../lib/whop";

interface Entry {
  id: number;
  command: string;
  out?: string;
  err?: string;
  code?: number;
  ms?: number;
  running: boolean;
}

/** Splits a command line into argv, honouring double quotes. */
function argv(line: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

const WRITE = /\b(create|delete|update|cancel|pause|resume|transfer|deploy|publish|unpublish|replay|extend|invite|logout|switch|mark_read|form_company|transfer_ownership)\b/;

export function Terminal({ seed, onSeedConsumed }: { seed: string | null; onSeedConsumed: () => void }) {
  const { account } = useAccount();
  const [line, setLine] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [history, setHistory] = useState<string[]>(() => JSON.parse(localStorage.getItem("whopdesktop.history") ?? "[]"));
  const [hIdx, setHIdx] = useState(-1);
  const outRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const counter = useRef(0);

  useEffect(() => {
    if (seed) {
      setLine(seed);
      onSeedConsumed();
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [seed, onSeedConsumed]);

  useEffect(() => {
    outRef.current?.scrollTo({ top: outRef.current.scrollHeight });
  }, [entries]);

  const run = async (raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;
    if (cmd.startsWith(":diag")) {
      // Built-in diagnostics: image loading + effective CSP inside this webview.
      const url = cmd.split(/\s+/)[1] ?? "https://assets-2-prod.whop.com/public/uploads/2026-09-10/c99fb4dd-f502-4453-820c-551dedc167bf/image.png";
      const id = ++counter.current;
      setEntries((e) => [...e, { id, command: cmd, running: true }]);
      setLine("");
      const t0 = performance.now();
      const img = await new Promise<string>((res) => {
        const i = new Image();
        i.onload = () => res(`image loaded ${i.naturalWidth}x${i.naturalHeight}`);
        i.onerror = () => res("image error");
        i.src = url;
        setTimeout(() => res("image timeout"), 8000);
      });
      let fetched = "";
      try {
        const r = await fetch(url, { method: "HEAD" });
        fetched = `fetch ${r.status}`;
      } catch (err) {
        fetched = `fetch failed: ${String(err)}`;
      }
      const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content") ?? "(no meta csp)";
      const out = [`url: ${url}`, img, fetched, `origin: ${location.origin}`, `csp: ${csp}`, `ua: ${navigator.userAgent}`].join("\n");
      setEntries((e) => e.map((x) => (x.id === id ? { ...x, out, code: 0, ms: performance.now() - t0, running: false } : x)));
      return;
    }
    let args = argv(cmd);
    if (args[0] === "whop") args = args.slice(1);
    if (args.length === 0) return;
    const id = ++counter.current;
    setEntries((e) => [...e, { id, command: `whop ${args.join(" ")}`, running: true }]);
    setHistory((h) => {
      const next = [cmd, ...h.filter((x) => x !== cmd)].slice(0, 50);
      localStorage.setItem("whopdesktop.history", JSON.stringify(next));
      return next;
    });
    setHIdx(-1);
    setLine("");
    const t0 = performance.now();
    try {
      const res = await runWhopRaw(account?.demo ? ["--demo", ...args] : args);
      setEntries((e) => e.map((x) => (x.id === id ? { ...x, out: res.stdout, err: res.stderr, code: res.code, ms: performance.now() - t0, running: false } : x)));
    } catch (err) {
      setEntries((e) => e.map((x) => (x.id === id ? { ...x, err: String(err), code: -1, ms: performance.now() - t0, running: false } : x)));
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      run(line);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const i = Math.min(hIdx + 1, history.length - 1);
      if (history[i] != null) {
        setHIdx(i);
        setLine(history[i]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const i = hIdx - 1;
      setHIdx(i);
      setLine(i < 0 ? "" : history[i]);
    } else if (e.key === "l" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      setEntries([]);
    }
  };

  const isWrite = WRITE.test(line);

  return (
    <div className="stack" style={{ height: "100%" }}>
      <PageHeader
        title="Terminal"
        subtitle={account?.demo ? "Demo business: read commands are answered from the demo dataset." : "Runs the real whop CLI as you. Every command hits production."}
        actions={
          <Button size="1" variant="ghost" color="gray" onClick={() => setEntries([])}>
            Clear <Kbd size="1">⌘L</Kbd>
          </Button>
        }
      />
      <div className="terminal">
        <TextField.Root size="3" variant="surface" color={isWrite ? "amber" : undefined}>
          <TextField.Slot>
            <Text size="2" color="gray" className="mono">
              $
            </Text>
          </TextField.Slot>
          <TextField.Input ref={inputRef} className="terminal-input" placeholder="whop products list" value={line} onChange={(e) => setLine(e.target.value)} onKeyDown={onKey} autoFocus spellCheck={false} autoCapitalize="off" autoCorrect="off" />
          <TextField.Slot>
            <Text size="1" color="gray">
              {isWrite ? "writes to production" : "↵ to run · ↑ history"}
            </Text>
          </TextField.Slot>
        </TextField.Root>
        <Card size="1" style={{ minHeight: 0, padding: 0 }}>
          <div className="terminal-out" ref={outRef}>
            {entries.length === 0 && (
              <span className="t-muted">
                {`# Try:\n#   whop products list --format json\n#   whop stats list\n#   whop memberships list --status active\n#   whop --llms   (the CLI manifest for agents)`}
              </span>
            )}
            {entries.map((e) => (
              <div key={e.id} style={{ marginBottom: 12 }}>
                <span className="t-cmd">$ {e.command}</span>
                {e.running ? (
                  <div className="t-muted">running…</div>
                ) : (
                  <>
                    {e.out ? <div>{e.out.trimEnd()}</div> : null}
                    {e.err ? <div className="t-err">{e.err.trimEnd()}</div> : null}
                    <div className="t-muted">
                      exit {e.code} · {Math.round(e.ms ?? 0)}ms
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
