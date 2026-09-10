/** Studio's response contract and state transitions, independent of the view. */
export interface Generation {
  id: string;
  type: "image" | "video";
  prompt: string;
  status: string;
  url?: string;
  fileId?: string;
  contentType?: string;
  error?: string;
  cost?: string;
  createdAt: number;
  accountId: string;
  sample?: boolean;
}

type JsonRecord = Record<string, unknown>;
const record = (v: unknown): JsonRecord => v && typeof v === "object" && !Array.isArray(v) ? v as JsonRecord : {};
const str = (v: unknown) => typeof v === "string" && v.length ? v : undefined;
export const pendingMedia = (g: Generation) => ["queued", "pending", "processing", "resolving"].includes(g.status);
const failures = ["failed", "canceled", "cancelled"];

export function mediaArgs(input: { type: "image" | "video"; prompt: string; accountId?: string; demo: boolean; duration: string; resolution: string; requestKey: string }) {
  return ["media", "generate", "--type", input.type, "--prompt", input.prompt.trim(),
    ...(input.type === "video" ? ["--duration_seconds", input.duration, "--resolution", input.resolution] : []),
    ...(!input.demo && input.accountId ? ["--account_id", input.accountId] : []),
    "--idempotency-key", input.requestKey];
}

/** File URLs may arrive later than the media record, or require files get. */
export async function resolveMedia(payload: unknown, previous: Generation, getFile: (id: string) => Promise<unknown>): Promise<Generation> {
  const envelope = record(payload);
  const a = typeof envelope.id === "string" ? envelope : record(envelope.data);
  if (!str(a.id)) throw new Error("Whop returned no media ID. The result could not be tracked; retrying the same prompt uses the same request key.");
  let file = record(a.file);
  const fileId = str(file.id) ?? previous.fileId;
  const status = str(a.status) ?? "processing";
  const errorObject = record(a.error);
  const error = str(a.error) ?? str(errorObject.message);
  const next: Generation = { ...previous, id: String(a.id), fileId, status, error,
    cost: a.cost != null ? String(a.cost) : a.price != null ? String(a.price) : previous.cost };
  if (failures.includes(status) || error) return { ...next, status: "failed", url: undefined, error: error ?? "Whop could not generate this asset." };
  if (fileId && !str(file.url)) {
    try {
      const loaded = record(await getFile(fileId));
      file = typeof loaded.id === "string" ? loaded : record(loaded.data);
    } catch {
      return { ...next, status: "resolving", url: undefined, error: "The file is not available yet. Refresh to check again." };
    }
  }
  if (file.upload_status === "failed") return { ...next, status: "failed", url: undefined, error: "Whop could not prepare the generated file." };
  const url = str(file.url) ?? str(a.url);
  const contentType = str(file.content_type) ?? previous.contentType;
  if (contentType && !contentType.startsWith(`${previous.type}/`)) {
    return { ...next, status: "failed", url: undefined, error: `Expected ${previous.type}, but Whop returned ${contentType}.` };
  }
  if (url && !/^(https:\/\/|data:(image|video)\/|\/demo\/)/.test(url)) {
    return { ...next, status: "failed", url: undefined, error: "Whop returned an unsupported media URL." };
  }
  if (["pending", "processing"].includes(String(file.upload_status))) return { ...next, status: "resolving", url: undefined, contentType };
  if (url) return { ...next, url, contentType, status: "completed", error: undefined };
  return { ...next, url: undefined, contentType, status: fileId || ["completed", "ready", "succeeded"].includes(status) ? "resolving" : "processing" };
}
