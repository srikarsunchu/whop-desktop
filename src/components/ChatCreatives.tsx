import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Button, Dialog, toast } from "frosted-ui";
import { invoke } from "@tauri-apps/api/core";
import { useAccount, useWhop, type Page, type Product } from "../lib/whop";
import { planPrice } from "../lib/format";
import {
  EMPTY_CONTEXT,
  FORMAT_LABELS,
  validDestination,
  type CreativeContext,
} from "../lib/studio-context";
import { loadGenerations, updateGenerations } from "../lib/studio-jobs";
import { pendingMedia, type Generation } from "../lib/media";
import {
  creativeBytes,
  creativePrompt,
  generateChatImage,
  wantsCreative,
  matchCreativeProduct,
} from "../lib/chat-creatives";
import { saveAdDraft } from "../lib/studio-drafts";
import type { ViewId } from "./Sidebar";

export interface CreativeHandle {
  prepare(text: string): boolean;
  activate(): void;
  importImage(): void;
}
interface Draft {
  context: CreativeContext;
  parentId?: string;
  enabled: boolean;
  proposal?: { text: string; key: string };
}
export const ChatCreatives = forwardRef<
  CreativeHandle,
  {
    threadId: string;
    onRecord: (text: string) => void;
    onNavigate: (view: ViewId) => void;
    onMode: (enabled: boolean) => void;
    onRevise: () => void;
  }
>(function ChatCreatives(
  { threadId, onRecord, onNavigate, onMode, onRevise },
  ref,
) {
  const { account } = useAccount();
  const storageKey = `chat.creative.${account?.id}.${threadId}`;
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      return {
        ...{ context: EMPTY_CONTEXT, enabled: false },
        ...JSON.parse(localStorage.getItem(storageKey) ?? "{}"),
      };
    } catch {
      return { context: EMPTY_CONTEXT, enabled: false };
    }
  });
  const [items, setItems] = useState(loadGenerations);
  const [error, setError] = useState("");
  const [action, setAction] = useState("");
  const actionLock = useRef(false);
  const importPicker = useRef<HTMLInputElement>(null);
  const [ad, setAd] = useState<{ g: Generation; context: CreativeContext }>();
  const products = useWhop<Page<Product>>([
    "products",
    "list",
    "--first",
    "100",
  ]);
  const mine = items
    .filter((g) => g.accountId === account?.id && g.conversationId === threadId)
    .sort((a, b) => a.createdAt - b.createdAt);
  const parent = draft.parentId ? mine.find(
    (g) => g.id === draft.parentId || g.requestKey === draft.parentId,
  ) : undefined;
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      setError(
        "Could not save the creative brief. Free storage before generating.",
      );
    }
    onMode(draft.enabled);
  }, [draft, storageKey, onMode]);
  useEffect(() => {
    const changed = () => setItems(loadGenerations());
    window.addEventListener("whopdesktop:studio-updated", changed);
    return () =>
      window.removeEventListener("whopdesktop:studio-updated", changed);
  }, []);
  const patch = (context: Partial<CreativeContext>) =>
    setDraft((d) => ({
      ...d,
      context: { ...d.context, ...context },
      proposal: d.proposal
        ? { ...d.proposal, key: crypto.randomUUID() }
        : undefined,
    }));
  const choose = (id: string) => {
    const p = products.data?.data.find((p) => p.id === id);
    if (!p) return;
    setDraft((d) => ({
      ...d,
      parentId: undefined,
      context: {
        ...d.context,
        productId: p.id,
        productTitle: p.title,
        price: planPrice(p.default_plan),
        planId: p.default_plan?.id ?? "",
        destinationUrl:
          !account?.demo && p.route
            ? `https://whop.com/${account?.route ? account.route + "/" : ""}${p.route}`
            : "",
        concept: `${p.title} creative`,
        adHeadline: p.title,
      },
      proposal: d.proposal
        ? { ...d.proposal, key: crypto.randomUUID() }
        : undefined,
    }));
  };
  useImperativeHandle(ref, () => ({
    importImage() { importPicker.current?.click(); },
    activate() {
      setDraft((d) => ({ ...d, enabled: true }));
      onRevise();
    },
    prepare(text) {
      if (!draft.enabled && !wantsCreative(text)) return false;
      setError("");
      const match = matchCreativeProduct(text, products.data?.data ?? []);
      setDraft((d) => ({
        ...d,
        enabled: true,
        context:
          match && !d.context.productId
            ? {
                ...d.context,
                productId: match.id,
                productTitle: match.title,
                price: planPrice(match.default_plan),
                planId: match.default_plan?.id ?? "",
                adHeadline: match.title,
                concept: `${match.title} creative`,
                destinationUrl:
                  !account?.demo && match.route
                    ? `https://whop.com/${account?.route ? account.route + "/" : ""}${match.route}`
                    : "",
              }
            : d.context,
        proposal: { text, key: crypto.randomUUID() },
      }));
      return true;
    },
  }));
  const generate = () => {
    if (!account || !draft.proposal || actionLock.current) return;
    try {
      if (!draft.context.productId)
        throw Error("Choose the product for this creative.");
      if (
        draft.parentId &&
        (!parent?.url || (!parent.sample && !parent.fileId))
      )
        throw Error(
          "This reference is unavailable. Choose another version or start a new creative.",
        );
      const prompt = creativePrompt(draft.proposal.text, draft.context, parent);
      const job: Generation = {
        id: `pending-${draft.proposal.key}`,
        requestKey: draft.proposal.key,
        conversationId: threadId,
        type: "image",
        instruction: draft.proposal.text,
        prompt,
        status: "processing",
        createdAt: Date.now(),
        accountId: account.id,
        sample: !!account.demo,
        context: { ...draft.context },
        parentId: parent?.id,
        referenceIds: parent ? [parent.fileId ?? parent.id] : [],
      };
      // Save the job before closing review or clearing the user's request.
      updateGenerations((xs) => [
        job,
        ...xs.filter((g) => g.requestKey !== job.requestKey),
      ]);
      onRecord(draft.proposal.text);
      setDraft((d) => ({
        ...d,
        proposal: undefined,
        parentId: job.requestKey,
      }));
      void generateChatImage(job);
    } catch (e) {
      setError(String(e));
    }
  };
  const perform = async (id: string, fn: () => Promise<void>) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setAction(id);
    try {
      await fn();
    } catch (e) {
      toast.error(String(e));
    } finally {
      actionLock.current = false;
      setAction("");
    }
  };
  const studio = (g: Generation) => {
    try {
      localStorage.setItem(
        `studio.brief.${g.accountId}`,
        JSON.stringify({
          context: g.context,
          prompt: g.instruction ?? g.prompt,
          selectedId: g.id,
        }),
      );
      onNavigate("studio");
    } catch (e) {
      toast.error(String(e));
    }
  };
  const contextFields = (
    context: CreativeContext,
    change: (p: Partial<CreativeContext>) => void,
  ) => (
    <>
      <label>
        Destination
        <input
          aria-label="Creative destination"
          value={context.destinationUrl}
          placeholder="https://whop.com/your-offer"
          onChange={(e) => change({ destinationUrl: e.target.value })}
        />
      </label>
      <label>
        Headline
        <input
          aria-label="Creative headline"
          maxLength={150}
          value={context.adHeadline}
          onChange={(e) => change({ adHeadline: e.target.value })}
        />
      </label>
      <label>
        Caption
        <textarea
          aria-label="Creative caption"
          maxLength={1000}
          value={context.postCopy}
          onChange={(e) => change({ postCopy: e.target.value })}
        />
      </label>
    </>
  );
  const importArtwork = async (file?:File) => {
    if (!file || !account) return;
    try {
      if (!['image/png','image/jpeg','image/webp'].includes(file.type)) throw Error('Choose a PNG, JPEG or WebP image.');
      if (file.size > 3 * 1024 * 1024) throw Error('Use an image smaller than 3 MB for conversation storage.');
      const url = await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('Could not read this image.'));reader.readAsDataURL(file);});
      const image = new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('This image cannot be opened.'));image.src=url;});
      const id=`import-${crypto.randomUUID()}`;
      const g:Generation={id,type:'image',source:'imported',conversationId:threadId,accountId:account.id,prompt:`Imported artwork: ${file.name}`,instruction:`Imported artwork: ${file.name}`,status:'completed',url,contentType:file.type,createdAt:Date.now(),context:{...draft.context},sample:!!account.demo};
      updateGenerations(xs=>[g,...xs]);onRecord(g.instruction!);setDraft(d=>({...d,enabled:false,parentId:undefined}));
      toast.success('Artwork added to this conversation');
    } catch(e){toast.error(e instanceof Error?e.message:String(e));}
  };
  return (
    <section className="chat-creatives" aria-label="Conversation creatives">
      <input ref={importPicker} type="file" accept="image/png,image/jpeg,image/webp" hidden aria-label="Import artwork" onChange={e=>{const file=e.target.files?.[0];e.target.value='';void importArtwork(file);}} />
      {(draft.enabled || mine.length > 0) && (
        <>
          <div className="creative-context-bar">
            <div>
              <strong>{draft.context.productTitle || "Create an image"}</strong>
              <span>
                {draft.context.price}
                {parent ? " · Revising selected version" : ""}
              </span>
            </div>
            <Button
              size="1"
              variant="soft"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  enabled: !d.enabled,
                  parentId: d.enabled ? undefined : d.parentId,
                }))
              }
            >
              {draft.enabled ? "Switch to chat" : "Create another"}
            </Button>
          </div>
          {draft.enabled && (
            <p className="creative-hint">
              {parent
                ? "Describe the changes in your message. Each revision is a new image."
                : "Describe your image in the message box. You’ll choose the product and review before generating."}
            </p>
          )}
        </>
      )}
      <div className="chat-creative-grid">
        {mine.map((g, i) => (
          <article className="chat-creative-card" key={g.requestKey ?? g.id}>
            <div className="chat-creative-image">
              {g.url ? (
                <CreativePreview
                  g={g}
                  label={`${g.context?.productTitle ?? "Creative"} version ${i + 1}`}
                />
              ) : (
                <div role="status">
                  {pendingMedia(g)
                    ? "Creating your image…"
                    : "Image needs attention"}
                </div>
              )}
            </div>
            <div className="chat-creative-body">
              <strong>
                Version {i + 1}
                {g.parentId ? " · Revision" : ""}
              </strong>
              <span>
                {g.source === "imported" ? "Ready" : g.sample
                  ? "Sample preview · no charge"
                  : g.cost
                    ? `Cost: $${g.cost}`
                    : g.status}
              </span>
              <p>{g.source === "imported" ? g.context?.adHeadline || g.context?.productTitle || "Creative" : g.instruction ?? g.prompt}</p>
              {g.sample && g.source !== "imported" && (
                <small>Sample artwork, not generated from your prompt.</small>
              )}
              {g.error && <p role="alert">{g.error}</p>}
              {g.status === "failed" && g.requestKey && (
                <Button
                  size="1"
                  variant="soft"
                  onClick={() => void generateChatImage(g)}
                >
                  Retry same request
                </Button>
              )}
              {g.url && (
                <div className="chat-creative-actions">
                  <Button
                    size="1"
                    variant={parent?.id === g.id ? "solid" : "soft"}
                    disabled={!g.sample && !g.fileId}
                    onClick={() => {
                      setDraft((d) => ({
                        ...d,
                        enabled: true,
                        parentId: g.id,
                        context: { ...EMPTY_CONTEXT, ...g.context },
                        proposal: undefined,
                      }));
                      onRevise();
                    }}
                  >
                    Revise this
                  </Button>
                  <Button size="1" variant="soft" onClick={() => studio(g)}>
                    Edit in Studio
                  </Button>
                  <Button
                    size="1"
                    variant="soft"
                    disabled={!!action}
                    onClick={() =>
                      perform(g.id, async () => {
                        const bytes = await creativeBytes(g);
                        await invoke("studio_save", {
                          bytes,
                          url: null,
                          video: false,
                        });
                      })
                    }
                  >
                    Download
                  </Button>
                  <Button
                    size="1"
                    variant="soft"
                    disabled={!!action}
                    onClick={() =>
                      setAd({ g, context: { ...EMPTY_CONTEXT, ...g.context } })
                    }
                  >
                    {g.adDraftId ? "Review ad draft" : "Create ad draft"}
                  </Button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      <Dialog.Root
        open={!!draft.proposal}
        onOpenChange={(open) => {
          if (!open) setDraft((d) => ({ ...d, proposal: undefined }));
        }}
      >
        <Dialog.Content size="3" className="creative-review">
          <Dialog.Title>
            {parent ? "Review image revision" : "Review your creative"}
          </Dialog.Title>
          <Dialog.Description>
            One image ·{" "}
            {account?.demo ? "Free sample preview" : "Uses your Whop balance"}
          </Dialog.Description>
          <label>
            Product
            <select
              aria-label="Creative product"
              value={draft.context.productId}
              onChange={(e) => choose(e.target.value)}
            >
              <option value="">Choose a product</option>
              {products.data?.data.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} · {planPrice(p.default_plan)}
                </option>
              ))}
            </select>
          </label>
          {products.loading && <p role="status">Loading products…</p>}
          {products.error && (
            <Button onClick={products.refresh}>Retry products</Button>
          )}
          <p>
            {draft.context.price}
            {parent ? " · Based on your selected image" : ""}
          </p>
          <label>
            Brief
            <textarea
              aria-label="Image brief"
              maxLength={1400}
              value={draft.proposal?.text ?? ""}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  proposal: { text: e.target.value, key: crypto.randomUUID() },
                }))
              }
            />
          </label>
          <label>
            Format
            <select
              aria-label="Creative format"
              value={draft.context.format}
              onChange={(e) =>
                patch({ format: e.target.value as CreativeContext["format"] })
              }
            >
              {Object.entries(FORMAT_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {contextFields(draft.context, patch)}
          <p className="creative-cost">
            {account?.demo
              ? "$0 · Demo shows sample artwork. Your prompt is saved, but the sample does not change to match it."
              : "Upfront price unavailable. Confirming authorizes one paid image generation from your Whop balance. The returned cost will appear with the result."}
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="creative-review-actions">
            <Dialog.Close>
              <Button variant="soft">Cancel</Button>
            </Dialog.Close>
            <Button
              disabled={
                !draft.context.productId || !draft.proposal?.text.trim()
              }
              onClick={generate}
            >
              {account?.demo ? "Preview sample" : "Confirm paid generation"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Root>
      <Dialog.Root
        open={!!ad}
        onOpenChange={(open) => {
          if (!open && !action) setAd(undefined);
        }}
      >
        <Dialog.Content size="3" className="creative-review">
          <Dialog.Title>Review ad draft</Dialog.Title>
          <Dialog.Description>
            Save artwork, product and copy together. Nothing is published.
          </Dialog.Description>
          {ad && (
            <>
              <div className="creative-ad-preview"><CreativePreview g={ad.g} label="Selected ad creative" /></div>
              <p>
                {ad.context.productTitle} · {ad.context.price}
              </p>
              {contextFields(ad.context, (patch) =>
                setAd((a) =>
                  a ? { ...a, context: { ...a.context, ...patch } } : a,
                ),
              )}
              <div className="creative-review-actions">
                <Button
                  variant="soft"
                  disabled={!!action}
                  onClick={() => setAd(undefined)}
                >
                  Cancel
                </Button>
                <Button
                  loading={!!action}
                  disabled={
                    !validDestination(ad.context.destinationUrl) ||
                    !ad.context.adHeadline.trim()
                  }
                  onClick={() =>
                    perform(ad.g.id, async () => {
                      const { g, context } = ad;
                      const bytes = await creativeBytes(g);
                      const id = g.adDraftId ?? `chat-${g.id}`;
                      await saveAdDraft({
                        id,
                        accountId: g.accountId,
                        assetId: g.id,
                        name: context.concept,
                        type: "image",
                        sample: !!g.sample,
                        context,
                        media: new Blob([new Uint8Array(bytes)], {
                          type: "image/png",
                        }),
                        createdAt: Date.now(),
                      });
                      updateGenerations((xs) =>
                        xs.map((x) =>
                          x.id === g.id ? { ...x, adDraftId: id, context } : x,
                        ),
                      );
                      setAd(undefined);
                      onNavigate("ads");
                    })
                  }
                >
                  Save draft & open Ads
                </Button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Root>
    </section>
  );
});

function CreativePreview({ g, label }: { g: Generation; label: string }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    let objectUrl = "";
    setError("");
    creativeBytes(g)
      .then((bytes) => {
        objectUrl = URL.createObjectURL(
          new Blob([new Uint8Array(bytes)], { type: "image/png" }),
        );
        if (disposed) URL.revokeObjectURL(objectUrl);
        else setUrl(objectUrl);
      })
      .catch((e) => {
        if (!disposed) setError(String(e));
      });
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [g]);
  return url ? (
    <img src={url} alt={label} />
  ) : (
    <span role="status">{error || "Preparing preview…"}</span>
  );
}
