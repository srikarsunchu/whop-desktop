import { Button, Card, Code, IconButton, SegmentedControl, Select, Text, Tooltip, toast } from "frosted-ui";
import { CopyIcon, ExternalLinkIcon, ReloadIcon, TrashIcon } from "@radix-ui/react-icons";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyPanel, PageHeader } from "../components/Panel";
import { CommandStrip } from "../components/CommandStrip";
import { relative } from "../lib/format";
import { commandString, runWhopJson, useAccount, withAccount } from "../lib/whop";

interface MediaAsset {
  id: string;
  status?: string; // processing | completed | failed …
  type?: string;
  prompt?: string;
  file?: { id?: string; url?: string; content_type?: string } | null;
  url?: string;
  error?: string | null;
  cost?: number | string | null;
  price?: number | string | null;
  model?: string | null;
  created_at?: string;
}

interface Generation {
  id: string;
  type: "image" | "video";
  prompt: string;
  status: string;
  url?: string;
  fileId?: string;
  error?: string;
  cost?: string;
  createdAt: number;
  accountId: string;
}

const LS = "whopdesktop.studio";
const load = (): Generation[] => {
  try {
    return JSON.parse(localStorage.getItem(LS) ?? "[]");
  } catch {
    return [];
  }
};

function fromAsset(a: MediaAsset, g: Generation): Generation {
  return {
    ...g,
    id: a.id ?? g.id,
    status: a.status ?? (a.file?.url ? "completed" : g.status),
    url: a.file?.url ?? a.url ?? g.url,
    fileId: a.file?.id ?? g.fileId,
    error: a.error ?? undefined,
    cost: a.cost != null ? String(a.cost) : a.price != null ? String(a.price) : g.cost,
  };
}

export function Studio({ runInTerminal, ask }: { runInTerminal: (c: string) => void; ask: (prompt: string) => void }) {
  const { account } = useAccount();
  const [type, setType] = useState<"image" | "video">("image");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("5");
  const [resolution, setResolution] = useState("1080p");
  const [items, setItems] = useState<Generation[]>(load);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  useEffect(() => localStorage.setItem(LS, JSON.stringify(items.slice(0, 60))), [items]);

  const args = ["media", "generate", "--type", type, "--prompt", prompt.trim(), ...(type === "video" ? ["--duration_seconds", duration, "--resolution", resolution] : []), "--wait", "true", "--timeout", "600"];
  const command = commandString(withAccount(args, account));
  const mine = items.filter((g) => g.accountId === (account?.id ?? ""));

  const generate = async () => {
    const p = prompt.trim();
    if (!p) return;
    setBusy(true);
    const local: Generation = { id: `pending-${Date.now()}`, type, prompt: p, status: "processing", createdAt: Date.now(), accountId: account?.id ?? "" };
    setItems((xs) => [local, ...xs]);
    setConfirming(false);
    try {
      const asset = await runWhopJson<MediaAsset>(args, !!account?.demo);
      setItems((xs) => xs.map((g) => (g.id === local.id ? fromAsset(asset, g) : g)));
      toast.success(asset.status === "completed" || asset.file?.url ? "Generated" : `Status: ${asset.status ?? "submitted"}`);
      setPrompt("");
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? String(e);
      setItems((xs) => xs.map((g) => (g.id === local.id ? { ...g, status: "failed", error: msg } : g)));
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const refresh = async (g: Generation) => {
    if (g.id.startsWith("pending-")) return;
    setRefreshing(g.id);
    try {
      const asset = await runWhopJson<MediaAsset>(["media", "get", g.id], !!account?.demo);
      setItems((xs) => xs.map((x) => (x.id === g.id ? fromAsset(asset, x) : x)));
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? "Could not refresh");
    } finally {
      setRefreshing(null);
    }
  };

  const remove = (id: string) => setItems((xs) => xs.filter((x) => x.id !== id));
  const copy = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
      toast.success("Copied");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="stack">
      <PageHeader
        title="Studio"
        subtitle={account ? `${account.title} · AI images and video, billed from your Whop balance, ready to attach to ads and posts` : undefined}
        actions={
          <Button size="1" variant="surface" onClick={() => ask("Write three ad creative prompts for my best-selling product: one lifestyle image, one product-on-white image, and one 5-second video. Keep each under 40 words.")}>
            Prompt ideas from Claude
          </Button>
        }
      />

      <Card size="3">
        <div className="studio">
          <div className="studio-form">
            <div className="studio-row">
              <SegmentedControl.Root value={type} onValueChange={(v: string) => setType(v as "image" | "video")}>
                <SegmentedControl.List>
                  <SegmentedControl.Trigger value="image">Image</SegmentedControl.Trigger>
                  <SegmentedControl.Trigger value="video">Video</SegmentedControl.Trigger>
                </SegmentedControl.List>
              </SegmentedControl.Root>
              {type === "video" && (
                <>
                  <Select.Root size="1" value={duration} onValueChange={(v: string | null) => v && setDuration(v)}>
                    <Select.Trigger variant="surface" color="gray" />
                    <Select.Content>
                      <Select.Item value="5">5 seconds</Select.Item>
                      <Select.Item value="10">10 seconds</Select.Item>
                      <Select.Item value="15">15 seconds</Select.Item>
                    </Select.Content>
                  </Select.Root>
                  <Select.Root size="1" value={resolution} onValueChange={(v: string | null) => v && setResolution(v)}>
                    <Select.Trigger variant="surface" color="gray" />
                    <Select.Content>
                      <Select.Item value="720p">720p</Select.Item>
                      <Select.Item value="1080p">1080p</Select.Item>
                      <Select.Item value="4k">4K</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </>
              )}
            </div>
            <textarea className="studio-prompt" placeholder={type === "image" ? "A 1:1 product shot of a matte-black cordless power scrubber on wet slate, soft morning light" : "A 9:16 sneaker product spin on a white background, studio lighting"} value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} maxLength={2000} />
            <div className="studio-row" style={{ justifyContent: "space-between" }}>
              <CommandStrip command={command} />
              <Button size="2" variant="classic" onClick={() => setConfirming(true)} disabled={!prompt.trim() || busy} loading={busy}>
                Generate {type}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {mine.length === 0 ? (
        <EmptyPanel title="Nothing generated yet" description="Describe the shot. Whop bills the generation from your balance and returns a file you can attach to an ad, a post, or a product page." />
      ) : (
        <div className="studio-grid">
          {mine.map((g) => (
            <Card size="2" key={g.id} className="gen">
              <div className="gen-media">
                {g.url ? (
                  g.type === "video" ? (
                    <video src={g.url} controls muted loop playsInline />
                  ) : (
                    <img src={g.url} alt={g.prompt} />
                  )
                ) : (
                  <div className="gen-placeholder">
                    <Text size="1" color="gray">
                      {g.status === "failed" ? "Failed" : g.status === "processing" ? "Generating…" : g.status}
                    </Text>
                  </div>
                )}
              </div>
              <Text size="2" style={{ display: "block", marginTop: 8 }} title={g.prompt}>
                {g.prompt.length > 110 ? g.prompt.slice(0, 110) + "…" : g.prompt}
              </Text>
              {g.error && (
                <Text size="1" color="red" style={{ display: "block", marginTop: 4 }}>
                  {g.error}
                </Text>
              )}
              <div className="gen-foot">
                <Text size="1" color="gray">
                  {[g.type, g.status, g.cost ? `$${Number(g.cost).toFixed(2)}` : null, relative(g.createdAt)].filter(Boolean).join(" · ")}
                </Text>
                <span className="row-actions">
                  {g.fileId && (
                    <Tooltip content={`Copy file id ${g.fileId}`}>
                      <IconButton size="1" variant="ghost" color="gray" onClick={() => copy(g.fileId!)} aria-label="Copy file id">
                        <CopyIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  {g.url && !g.url.startsWith("data:") && (
                    <Tooltip content="Open in browser">
                      <IconButton size="1" variant="ghost" color="gray" onClick={() => invoke("open_external", { url: g.url })} aria-label="Open">
                        <ExternalLinkIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  {!g.id.startsWith("pending-") && (
                    <Tooltip content="Refresh status">
                      <IconButton size="1" variant="ghost" color="gray" onClick={() => refresh(g)} aria-label="Refresh" loading={refreshing === g.id}>
                        <ReloadIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip content="Remove from list">
                    <IconButton size="1" variant="ghost" color="gray" onClick={() => remove(g.id)} aria-label="Remove">
                      <TrashIcon />
                    </IconButton>
                  </Tooltip>
                </span>
              </div>
              {g.fileId && (
                <Text size="0" color="gray" style={{ display: "block", marginTop: 4 }}>
                  Attach to an ad: <Code size="1">--creatives '[{"{"}"id":"{g.fileId}"{"}"}]'</Code>
                </Text>
              )}
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog open={confirming} onOpenChange={setConfirming} title={`Generate ${type}`} description={account?.demo ? "Demo business: the result is a sample, nothing is billed." : "Whop bills AI generation from your balance. The command waits for the asset, up to 10 minutes for video."} command={command} confirmLabel="Generate" busy={busy} onConfirm={generate} />
      <div style={{ display: "none" }}>
        <Button onClick={() => runInTerminal("whop media generate --schema")}>schema</Button>
      </div>
    </div>
  );
}
