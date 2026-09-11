import { invoke } from "@tauri-apps/api/core";
import { runWhopJson } from "./whop";
import { mediaArgs, resolveMedia, type Generation } from "./media";
import { updateGenerations } from "./studio-jobs";
import { generationBrief, type CreativeContext } from "./studio-context";
import { DEFAULT_FINISH, renderCreative, canvasBytes } from "./studio-canvas";

export function wantsCreative(text: string) {
  return /\b(make|create|generate|design)\b[\s\S]*\b(image|images|ad|ads|creative|creatives|artwork|poster|instagram)\b/i.test(
    text,
  );
}
export function creativePrompt(
  text: string,
  context: CreativeContext,
  parent?: Generation,
) {
  const offer = `Product: ${context.productTitle}. Price: ${context.price}. Headline: ${context.adHeadline}. Caption: ${context.postCopy}.`;
  const instruction = parent
    ? `Revise the reference image. Preserve its subject and composition unless requested otherwise. Requested changes: ${text}`
    : text;
  const prompt = generationBrief(`${offer}\n${instruction}`, context);
  // Never silently discard a user's revision or offer details.
  if (`${offer}\n${instruction}`.length > 1750)
    throw Error(
      "Shorten the brief to leave room for the product and format details.",
    );
  return prompt;
}
const inFlight = new Set<string>();
export async function generateChatImage(job: Generation) {
  const key = job.requestKey!;
  if (inFlight.has(key)) return;
  inFlight.add(key);
  const local = { ...job, status: "processing", error: undefined };
  try {
    updateGenerations((xs) => [
      local,
      ...xs.filter((g) => g.requestKey !== key),
    ]);
    const raw = await runWhopJson(
      mediaArgs({
        type: "image",
        prompt: job.prompt,
        accountId: job.accountId,
        demo: !!job.sample,
        duration: "5",
        resolution: "1080p",
        requestKey: key,
        referenceIds: job.referenceIds,
      }),
      !!job.sample,
    );
    const result = await resolveMedia(raw, local, (id) =>
      runWhopJson(["files", "get", id], !!job.sample),
    );
    updateGenerations((xs) =>
      xs.map((g) => (g.requestKey === key ? result : g)),
    );
  } catch (e) {
    updateGenerations((xs) =>
      xs.map((g) =>
        g.requestKey === key ? { ...g, status: "failed", error: e && typeof e === "object" && "message" in e ? String(e.message) : String(e) } : g,
      ),
    );
  } finally {
    inFlight.delete(key);
  }
}
export async function creativeBytes(g: Generation): Promise<number[]> {
  if (!g.url) throw Error("Wait for the image to finish.");
  let url = g.url,
    objectUrl = "";
  try {
    if (url.startsWith("https:")) {
      const bytes = await invoke<number[]>("studio_read_image", { url });
      objectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)]));
      url = objectUrl;
    }
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(Error("Could not load the image."));
      image.src = url;
    });
    let finish = { ...DEFAULT_FINISH, format: g.context?.format ?? "square" };
    try {
      finish = {
        ...finish,
        ...JSON.parse(
          localStorage.getItem(`studio.finish.${g.accountId}.${g.id}`) ?? "{}",
        ),
      };
    } catch {
      /* default finish */
    }
    await document.fonts.ready;
    const canvas = document.createElement("canvas");
    renderCreative(canvas, image, finish);
    return await canvasBytes(canvas);
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export function matchCreativeProduct<T extends {title:string}>(text:string, products:T[]):T|undefined {
  return [...products].sort((a,b)=>b.title.length-a.title.length).find(p=>p.title.trim() && text.toLowerCase().includes(p.title.toLowerCase()));
}
