import { Button, Card, Code, IconButton, SegmentedControl, Select, Text, Tooltip, toast } from "frosted-ui";
import { CopyIcon, ExternalLinkIcon, ReloadIcon, TrashIcon, ImageIcon } from "@radix-ui/react-icons";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyPanel, PageHeader } from "../components/Panel";
import { CommandStrip } from "../components/CommandStrip";
import { relative } from "../lib/format";
import { commandString, runWhopJson, useAccount } from "../lib/whop";

import { DEMO_ACCOUNT_ID, DEMO_POSTER, DEMO_VIDEO } from "../lib/demo";
import { mediaArgs, pendingMedia, resolveMedia, type Generation } from "../lib/media";

const LS = "whopdesktop.studio";
const load = (): Generation[] => {
  try {
    const entries: Generation[] = JSON.parse(localStorage.getItem(LS) ?? "[]");
    return entries.map((g) => g.accountId === DEMO_ACCOUNT_ID && !g.sample ? {
      ...g, id: g.id.includes(`_${g.type}_`) ? g.id : `media_Nw_${g.type}_${g.id}`,
      sample: true, cost: "0.00", status: "completed", error: undefined,
      url: g.type === "video" ? DEMO_VIDEO : DEMO_POSTER,
      contentType: g.type === "video" ? "video/mp4" : "image/svg+xml",
    } : g);
  } catch {
    return [];
  }
};

// Persist each transition immediately, including responses that arrive after navigation.
const updateGenerations = (update: (items: Generation[]) => Generation[]) => {
  const next = update(load()).slice(0, 60);
  localStorage.setItem(LS, JSON.stringify(next));
  window.dispatchEvent(new Event("whopdesktop:studio-updated"));
};

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
  const generating = useRef(false);
  const refreshingIds = useRef(new Set<string>());
  const requestKey = useMemo(() => crypto.randomUUID(), [type, prompt, duration, resolution, account?.id]);

  useEffect(() => {
    const changed = () => setItems(load());
    window.addEventListener("whopdesktop:studio-updated", changed);
    return () => window.removeEventListener("whopdesktop:studio-updated", changed);
  }, []);

  const args = mediaArgs({ type, prompt, duration, resolution, requestKey, demo: !!account?.demo, accountId: account?.id });
  const command = commandString(args);
  const mine = items.filter((g) => g.accountId === (account?.id ?? ""));
  const getFile = (id: string) => runWhopJson(["files", "get", id]);

  const generate = async () => {
    const p = prompt.trim();
    if (!p || !account || generating.current) return;
    generating.current = true;
    setBusy(true);
    const local: Generation = { id: `pending-${requestKey}`, type, prompt: p, status: "processing", createdAt: Date.now(), accountId: account.id, sample: !!account.demo };
    updateGenerations((xs) => [local, ...xs.filter((g) => g.id !== local.id)]);
    setConfirming(false);
    try {
      const asset = await runWhopJson(args, !!account.demo);
      const result = await resolveMedia(asset, local, getFile);
      updateGenerations((xs) => xs.map((g) => g.id === local.id ? result : g));
      if (result.status === "failed") toast.error(result.error ?? "Generation failed");
      else {
        toast.success(account.demo ? "Sample preview ready · no charge" : result.status === "completed" ? "Generation ready" : "Generation started");
        setPrompt((value) => value === p ? "" : value);
      }
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? String(e);
      updateGenerations((xs) => xs.map((g) => g.id === local.id ? { ...g, status: "failed", error: msg } : g));
      toast.error(msg);
    } finally {
      generating.current = false;
      setBusy(false);
    }
  };

  const refresh = useCallback(async (g: Generation) => {
    if (g.id.startsWith("pending-") || refreshingIds.current.has(g.id)) return;
    refreshingIds.current.add(g.id);
    setRefreshing(g.id);
    try {
      const asset = await runWhopJson(["media", "get", g.id], !!g.sample);
      const next = await resolveMedia(asset, g, (id) => runWhopJson(["files", "get", id]));
      updateGenerations((xs) => xs.map((x) => x.id === g.id ? next : x));
    } catch (e) {
      const error = (e as { message?: string })?.message ?? "Could not refresh. Try again.";
      updateGenerations((xs) => xs.map((x) => x.id === g.id ? { ...x, error } : x));
    } finally {
      refreshingIds.current.delete(g.id);
      setRefreshing(null);
    }
  }, []);

  // Poll only existing jobs, never re-submit a billable generation.
  useEffect(() => {
    const pending = items.filter((g) => g.accountId === account?.id && !g.id.startsWith("pending-") && pendingMedia(g) && Date.now() - g.createdAt < 600_000);
    if (!pending.length) return;
    const timer = setTimeout(() => { pending.forEach((g) => void refresh(g)); }, 4000);
    return () => clearTimeout(timer);
  }, [items, account?.id, refresh]);

  const previewError = (id: string) => updateGenerations((xs) => xs.map((g) => g.id === id ? { ...g, error: "Preview could not load. Refresh the asset to get a fresh file URL." } : g));

  const remove = (id: string) => updateGenerations((xs) => xs.filter((x) => x.id !== id));
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
        subtitle={account ? `${account.title} · creative for your next campaign` : undefined}
        actions={
          <Button size="1" variant="surface" onClick={() => ask("Write three ad creative prompts for my best-selling product: one lifestyle image, one product-on-white image, and one 5-second video. Keep each under 40 words.")}>
            Prompt ideas from Claude
          </Button>
        }
      />

      <Card size="3" className="panel">
        <div className="studio">
          <div className="studio-form">
            <div className="studio-row">
              <SegmentedControl.Root value={type} onValueChange={(v: string) => !busy && setType(v as "image" | "video")}>
                <SegmentedControl.List>
                  <SegmentedControl.Trigger value="image">Image</SegmentedControl.Trigger>
                  <SegmentedControl.Trigger value="video">Video</SegmentedControl.Trigger>
                </SegmentedControl.List>
              </SegmentedControl.Root>
              {type === "video" && !account?.demo && (
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
                      <Select.Item value="480p">480p</Select.Item>
                      <Select.Item value="720p">720p</Select.Item>
                      <Select.Item value="1080p">1080p</Select.Item>
                      <Select.Item value="4k">4K</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </>
              )}
            </div>
            <textarea className="studio-prompt" aria-label="Creative prompt" placeholder={type === "image" ? "Describe the image: subject, setting, lighting, and style…" : "Describe the scene, movement, and visual style…"} disabled={busy} value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} maxLength={2000} />
            <div className="studio-starters" aria-label="Prompt starters">
              {[
                ["Campaign poster", `A bold campaign poster for ${account?.title ?? "my business"}, editorial typography, dark background, a single strong visual, square format.`],
                ["Product spotlight", "A carefully lit product spotlight, clean background, soft directional lighting, generous space for a headline, square format."],
                ["Social story", `A vertical social story for ${account?.title ?? "my business"}, high contrast, energetic composition, room for a short call to action, 9:16 format.`],
              ].map(([label, text]) => <button type="button" key={label} disabled={busy} onClick={() => setPrompt(text)}>{label}</button>)}
            </div>
            <div className="studio-row" style={{ justifyContent: "space-between" }}>
              <CommandStrip command={command} />
              <Button size="2" variant="classic" onClick={() => account?.demo ? generate() : setConfirming(true)} disabled={!account || !prompt.trim() || busy} loading={busy}>
                {account?.demo ? "Preview sample" : "Generate"} {type}
              </Button>
            </div>
            <Text size="1" color="gray" className="studio-billing">{account?.demo ? "Demo samples · not generated from your prompt · no charge" : "Generation is billed from your Whop balance. Review the command before generating."}</Text>
          </div>
        </div>
      </Card>

      {mine.length === 0 ? (
        <EmptyPanel icon={<ImageIcon />} title="Your next creative starts here" description="Choose a starting point above, make it your own, and generate an image or video." />
      ) : (
        <div className="studio-grid">
          {mine.map((g) => (
            <Card size="2" key={g.id} className="gen">
              <div className="gen-media">
                {g.url ? (
                  g.type === "video" ? (
                    <video src={g.url} controls muted loop playsInline preload="metadata" onError={() => previewError(g.id)} aria-label={g.sample ? "Sample video, not AI generated" : g.prompt} />
                  ) : (
                    <img src={g.url} alt={g.sample ? "Northwind Picks sample poster, not AI generated" : g.prompt} onError={() => previewError(g.id)} />
                  )
                ) : (
                  <div className="gen-placeholder">
                    <Text size="1" color="gray">
                      {g.status === "failed" ? "Generation failed" : g.status === "resolving" ? "Preparing file…" : pendingMedia(g) ? "Generating…" : g.status}
                    </Text>
                  </div>
                )}
              </div>
              {g.sample && <Text size="1" weight="medium" style={{ display: "block", marginTop: 10 }}>Sample {g.type} · not AI generated</Text>}
              {pendingMedia(g) && <Text size="1" color="gray" style={{ display: "block", marginTop: 8 }}>{Date.now() - g.createdAt < 600_000 ? "Checking status automatically. You can leave this view and return." : "Still processing. Refresh to check again; this does not start a new generation."}</Text>}
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
                  {[g.type, g.status, g.sample ? "No charge" : g.cost != null && Number.isFinite(Number(g.cost)) ? `$${Number(g.cost).toFixed(2)}` : null, relative(g.createdAt)].filter(Boolean).join(" · ")}
                </Text>
                <span className="row-actions">
                  {g.fileId && !g.sample && (
                    <Tooltip content={`Copy file id ${g.fileId}`}>
                      <IconButton size="1" variant="ghost" color="gray" onClick={() => copy(g.fileId!)} aria-label="Copy file id">
                        <CopyIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  {g.url && !g.sample && !g.url.startsWith("data:") && (
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
              {g.fileId && !g.sample && (
                <Text size="0" color="gray" style={{ display: "block", marginTop: 4 }}>
                  Attach to an ad: <Code size="1">--creatives '[{"{"}"id":"{g.fileId}"{"}"}]'</Code>
                </Text>
              )}
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog open={confirming} onOpenChange={setConfirming} title={`Generate ${type}`} description={account?.demo ? "Demo sample, not generated from this prompt. No charge." : "Whop bills generation from your balance. The job runs in the background; Studio checks its progress without submitting it again."} command={command} confirmLabel="Generate" busy={busy} onConfirm={generate} />
      <div style={{ display: "none" }}>
        <Button onClick={() => runInTerminal("whop media generate --schema")}>schema</Button>
      </div>
    </div>
  );
}
